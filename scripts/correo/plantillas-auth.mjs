/**
 * Los correos de la plataforma: las plantillas de Supabase Auth y el SMTP de Resend.
 * La fuente es `lib/correo/plantillas-auth.ts` (con el diseño de `lib/correo/diseno.ts`);
 * lo que se cambie a mano en el panel de Supabase se pisa al volver a aplicar.
 *
 *   node --env-file=.env.local scripts/correo/plantillas-auth.mjs --vista
 *       Escribe cada correo con datos de ejemplo en capturas/correos/ (HTML y PNG, escritorio y teléfono).
 *   node --env-file=.env.local scripts/correo/plantillas-auth.mjs --muestras <correo>
 *       Manda cada correo, con datos de ejemplo, a esa dirección por Resend (para revisarlos en un buzón real).
 *   node --env-file=.env.local scripts/correo/plantillas-auth.mjs --aplicar [--destino produccion --confirmo]
 *       Aplica asuntos, plantillas, avisos de seguridad, SMTP de Resend y el límite de envíos.
 *       Sin --destino, a PRUEBAS. Sin --confirmo, solo dice qué cambiaría.
 *
 * Pide SUPABASE_ACCESS_TOKEN (Management API) y RESEND_API_KEY (la clave de solo envío sirve de
 * contraseña SMTP). El remitente sale de `portal.industriasiberia.com`, verificado en Resend.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { PLANTILLAS_AUTH, AVISOS_ENCENDIDOS } from '../../lib/correo/plantillas-auth.ts'
import { correoIberia } from '../../lib/correo/diseno.ts'

const args = process.argv.slice(2)
const tiene = (f) => args.includes(f)
const valor = (f) => (args.includes(f) ? args[args.indexOf(f) + 1] : undefined)

const REMITENTE = 'notificaciones@portal.industriasiberia.com'
const NOMBRE_REMITENTE = 'Plataforma Iberia'
/** Con SMTP propio Supabase deja subir el tope de correos por hora (de fábrica, 2). */
const CORREOS_POR_HORA = 60

const EJEMPLO = {
  '{{ .SiteURL }}': 'https://portal.industriasiberia.com',
  '{{ .TokenHash }}': 'pkce_ejemplo0123456789abcdef',
  '{{ .Token }}': '48213907',
  '{{ .Email }}': 'maria.perez@industriasiberia.com',
  '{{ .NewEmail }}': 'mperez@industriasiberia.com',
  '{{ .OldEmail }}': 'maria.perez@industriasiberia.com',
  '{{ .Phone }}': '+58 414 000 0000',
  '{{ .OldPhone }}': '+58 412 000 0000',
  '{{ .FactorType }}': 'TOTP',
  '{{ .Provider }}': 'Microsoft',
}
const conEjemplo = (s) => Object.entries(EJEMPLO).reduce((t, [k, v]) => t.split(k).join(v), s)

/** El correo de una tarea programada del asistente, con el mismo diseño (lo arma `correoHtml` de programador.ts). */
const TAREA = {
  asunto: 'Resumen semanal de requisiciones · 27 nov',
  html: correoIberia({
    preencabezado: 'Esta semana entraron 6 requisiciones nuevas y 2 esperan tu aprobación.',
    rotulo: 'Asistente de IA · Tarea programada',
    titulo: 'Resumen semanal de requisiciones',
    parrafos: [
      'Esta semana entraron 6 requisiciones nuevas: 4 de Producción y 2 de Mantenimiento.',
      '2 esperan tu aprobación desde hace más de tres días. El detalle por unidad está en el resultado completo.',
    ],
    boton: { texto: 'Ver el resultado completo', url: 'https://portal.industriasiberia.com/sistema/asistente' },
    nota: 'Trae datos de la plataforma: el detalle y los archivos se abren con tu sesión. La información de este chat queda en resguardo de Industrias Iberia para fines de mejora.',
    pie: 'Este correo lo envía el asistente de IA de la Plataforma Iberia porque programaste esta tarea o te incluyeron en ella. Es automático: si lo respondes, nadie lo va a leer.',
  }),
}

const todos = () => [...Object.entries(PLANTILLAS_AUTH).map(([k, p]) => [k, { asunto: conEjemplo(p.asunto), html: conEjemplo(p.html) }]), ['tarea_asistente', TAREA]]

if (tiene('--vista')) {
  const dir = join('capturas', 'correos')
  mkdirSync(dir, { recursive: true })
  const { chromium } = await import('playwright')
  const nav = await chromium.launch()
  for (const [clave, p] of todos()) {
    const ruta = join(dir, `${clave}.html`)
    writeFileSync(ruta, p.html)
    for (const [sufijo, ancho] of [['', 720], ['-telefono', 390]]) {
      const pag = await nav.newPage({ viewport: { width: ancho, height: 900 }, deviceScaleFactor: 2 })
      await pag.goto('file:///' + join(process.cwd(), ruta).replace(/\\/g, '/'))
      await pag.waitForLoadState('networkidle')
      await pag.screenshot({ path: join(dir, `${clave}${sufijo}.png`), fullPage: true })
      await pag.close()
    }
    console.log(`✓ ${clave} · ${p.asunto}`)
  }
  await nav.close()
  console.log(`\nEn ${dir}/`)
}

if (tiene('--muestras')) {
  const para = valor('--muestras')
  if (!para || !para.includes('@')) throw new Error('--muestras <correo>')
  for (const [clave, p] of todos()) {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: `${NOMBRE_REMITENTE} <${REMITENTE}>`, to: [para], subject: `[Muestra] ${p.asunto}`, html: p.html }),
    })
    const j = await r.json().catch(() => ({}))
    console.log(r.ok ? `✓ ${clave}` : `✗ ${clave} · ${r.status} ${j.message ?? ''}`)
    await new Promise((res) => setTimeout(res, 600)) // Resend: 2 por segundo
  }
}

if (tiene('--aplicar')) {
  const produccion = valor('--destino') === 'produccion'
  const ref = produccion ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname.split('.')[0] : process.env.SUPABASE_PRUEBAS_REF
  const api = `https://api.supabase.com/v1/projects/${ref}/config/auth`
  const cab = { Authorization: `Bearer ${process.env.SUPABASE_ACCESS_TOKEN}`, 'Content-Type': 'application/json' }

  const cuerpo = {
    smtp_host: 'smtp.resend.com',
    smtp_port: '465',
    smtp_user: 'resend',
    smtp_pass: process.env.RESEND_API_KEY,
    smtp_admin_email: REMITENTE,
    smtp_sender_name: NOMBRE_REMITENTE,
    rate_limit_email_sent: CORREOS_POR_HORA,
  }
  for (const [clave, p] of Object.entries(PLANTILLAS_AUTH)) {
    cuerpo[`mailer_subjects_${clave}`] = p.asunto
    cuerpo[`mailer_templates_${clave}_content`] = p.html
  }
  for (const aviso of AVISOS_ENCENDIDOS) cuerpo[`mailer_notifications_${aviso}_enabled`] = true

  const antes = await (await fetch(api, { headers: cab })).json()
  const cambia = Object.keys(cuerpo).filter((k) => String(antes[k] ?? '') !== String(cuerpo[k]))
  console.log(`Proyecto ${ref} (${produccion ? 'PRODUCCIÓN' : 'pruebas'}): ${cambia.length} ajustes cambian`)
  for (const k of cambia) console.log(`  · ${k}${/pass/.test(k) ? '' : /content/.test(k) ? '' : `: ${JSON.stringify(antes[k])} → ${JSON.stringify(cuerpo[k])}`}`)

  if (!tiene('--confirmo')) {
    console.log('\nSin --confirmo no se aplica nada.')
  } else {
    const r = await fetch(api, { method: 'PATCH', headers: cab, body: JSON.stringify(cuerpo) })
    const j = await r.json().catch(() => ({}))
    if (!r.ok) throw new Error(`${r.status} ${JSON.stringify(j).slice(0, 400)}`)
    const despues = await (await fetch(api, { headers: cab })).json()
    const faltan = Object.keys(cuerpo).filter((k) => !/pass/.test(k) && String(despues[k] ?? '') !== String(cuerpo[k]))
    console.log(faltan.length ? `✗ No quedaron: ${faltan.join(', ')}` : '✓ Aplicado y comprobado')
  }
}
