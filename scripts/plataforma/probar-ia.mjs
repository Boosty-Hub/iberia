/**
 * Plataforma Iberia · R4 · prueba de punta a punta de la IA visible, contra el
 * PROYECTO DE PRUEBAS (nunca producción). Gasta unos centavos: 3 llamadas a
 * Claude (revisar plazas, una pregunta, clasificar documentos).
 *
 *   MSYS_NO_PATHCONV=1 node --env-file=.env.local scripts/plataforma/probar-ia.mjs [--base http://localhost:3005] [--sin-modelo]
 *
 * Comprueba:
 *  1. Revisar plazas (NUC-ORG-IA-05): salen marcas ⚑ y el filtro «con propuestas».
 *  2. Una propuesta se rechaza con motivo desde la ficha y queda en la actividad
 *     (y en la línea de tiempo del objeto).
 *  3. «Preguntar a la IA» responde con citas y la cita abre la ficha.
 *  4. RLS: el lector ve las propuestas solo mientras puede leer la estructura.
 *  5. La ruta «nivel_ia»: subir NUC-DOC-IA-02 a N3 y a N4 pide dos firmas que no
 *     son de quien pide; en N4 la clasificación se aplica sola, sale «Deshacer» y
 *     deshacer devuelve el documento. Al final la capacidad vuelve a N2.
 *  6. El interruptor general apagado esconde y bloquea todo; se vuelve a encender.
 */
import { chromium } from 'playwright'
import { createClient } from '@supabase/supabase-js'
import { mkdir } from 'node:fs/promises'

const argv = process.argv.slice(2)
const BASE = argv.includes('--base') ? argv[argv.indexOf('--base') + 1] : 'http://localhost:3005'
const SIN_MODELO = argv.includes('--sin-modelo')
const URL_SUPA = process.env.SUPABASE_PRUEBAS_URL
const PUB = process.env.SUPABASE_PRUEBAS_PUBLISHABLE_KEY
const SECRETO = process.env.SUPABASE_PRUEBAS_SECRET_KEY
if (!URL_SUPA || !SECRETO || !URL_SUPA.includes('wsqhsjbwkjlqrdxnyadq')) throw new Error('Esta prueba corre solo contra el proyecto de pruebas')

const admin = createClient(URL_SUPA, SECRETO, { auth: { persistSession: false } })
const anon = createClient(URL_SUPA, PUB, { auth: { persistSession: false } })
const CUENTAS = { admin: 'admin.pruebas@plataforma.local', consultor: 'consultor.pruebas@plataforma.local', lector: 'lector.pruebas@plataforma.local' }

let fallos = 0
const ok = (cond, texto) => {
  console.log(`${cond ? '✓' : '✖'} ${texto}`)
  if (!cond) fallos++
  return cond
}

async function sesion(email) {
  const { data: enlace, error } = await admin.auth.admin.generateLink({ type: 'magiclink', email })
  if (error) throw error
  const { data, error: e2 } = await anon.auth.verifyOtp({ token_hash: enlace.properties.hashed_token, type: 'magiclink' })
  if (e2) throw e2
  return data.session
}
const cliente = (s) => createClient(URL_SUPA, PUB, { auth: { persistSession: false }, global: { headers: { Authorization: `Bearer ${s.access_token}` } } })

function cookies(s) {
  const ref = new URL(URL_SUPA).hostname.split('.')[0]
  const nombre = `sb-${ref}-auth-token`
  const valor = 'base64-' + Buffer.from(JSON.stringify(s)).toString('base64url')
  const L = 3180
  const partes = valor.length <= L ? [{ name: nombre, value: valor }] : Array.from({ length: Math.ceil(valor.length / L) }, (_, i) => ({ name: `${nombre}.${i}`, value: valor.slice(i * L, (i + 1) * L) }))
  return partes.map((p) => ({ ...p, domain: new URL(BASE).hostname, path: '/' }))
}

const sAdmin = await sesion(CUENTAS.admin)
const sConsultor = await sesion(CUENTAS.consultor)
const sLector = await sesion(CUENTAS.lector)
const cAdmin = cliente(sAdmin)
const cConsultor = cliente(sConsultor)
const cLector = cliente(sLector)
const inicio = new Date().toISOString()

await mkdir('capturas/sistema', { recursive: true })
const nav = await chromium.launch()
const ctx = await nav.newContext({ viewport: { width: 1440, height: 900 } })
await ctx.addCookies(cookies(sAdmin))
const pagina = await ctx.newPage()
const errores = []
pagina.on('pageerror', (e) => errores.push(String(e)))
const foto = (n) => pagina.screenshot({ path: `capturas/sistema/ia-${n}.png`, fullPage: false })

// Que la IA arranque encendida (una corrida anterior pudo quedar a mitad).
await cAdmin.schema('ia').rpc('fijar_interruptor', { p_encendido: true, p_motivo: 'probar-ia: estado inicial' })

try {
  // ── 1. Revisar plazas ───────────────────────────────────────────────────
  await pagina.goto(`${BASE}/sistema/nucleo/organizacion/plazas`, { waitUntil: 'networkidle', timeout: 120000 })
  if (!SIN_MODELO) {
    await pagina.locator('[data-accion-ia="Revisar plazas con la IA"]').click()
    await pagina.getByText(/La IA marcó|Sin señales nuevas/).first().waitFor({ timeout: 180000 })
    await pagina.reload({ waitUntil: 'networkidle' })
  }
  const marcas = await pagina.locator('[data-marca-ia]').count()
  ok(marcas > 0, `plazas: ${marcas} marcas ⚑ en la tabla`)
  await foto('1-plazas-marcas')
  await pagina.locator('[data-filtro-propuestas]').click()
  await pagina.waitForURL(/ia=con/, { timeout: 60000 })
  await pagina.waitForLoadState('networkidle')
  const filas = await pagina.locator('tbody tr').count()
  const filasConMarca = await pagina.locator('tbody tr:has([data-marca-ia])').count()
  ok(filas > 0 && filas === filasConMarca, `filtro «con propuestas»: ${filasConMarca} de ${filas} filas con marca`)
  const { data: expl } = await admin.schema('ia').from('propuesta').select('id').eq('capacidad', 'NUC-ORG-IA-05').not('explicacion', 'is', null).limit(1)
  ok(SIN_MODELO || (expl?.length ?? 0) > 0, 'el modelo explicó al menos una propuesta (texto aparte de la regla)')

  // ── 2. Rechazar una con motivo desde la ficha ───────────────────────────
  const { data: pend } = await admin.schema('ia').from('propuesta').select('id, objeto_id, regla').eq('capacidad', 'NUC-ORG-IA-05').eq('estado', 'pendiente').eq('regla', 'exceso').limit(1)
  const objetivo = pend?.[0] ?? (await admin.schema('ia').from('propuesta').select('id, objeto_id, regla').eq('capacidad', 'NUC-ORG-IA-05').eq('estado', 'pendiente').limit(1)).data?.[0]
  await pagina.goto(`${BASE}/sistema/nucleo/organizacion/plazas?ficha=plaza:${objetivo.objeto_id}`, { waitUntil: 'networkidle' })
  await pagina.locator('[data-ficha-objeto] [role="tab"]', { hasText: /^IA$/ }).click()
  const tarjeta = pagina.locator(`[data-propuesta-ia="${objetivo.id}"]`)
  await tarjeta.waitFor({ timeout: 60000 })
  await foto('2-ficha-propuesta')
  await tarjeta.getByRole('button', { name: /Rechazar$/ }).click()
  await tarjeta.locator('textarea').fill('La dotación de 2026 ya contempla el segundo turno; se corrige en el plan.')
  await tarjeta.getByRole('button', { name: /Rechazar la propuesta/ }).click()
  await pagina.getByText(/Rechazada\. El motivo queda/).first().waitFor({ timeout: 60000 })
  const { data: tras } = await admin.schema('ia').from('propuesta').select('estado, motivo, decidido_por').eq('id', objetivo.id).single()
  ok(tras.estado === 'rechazada' && tras.motivo && tras.decidido_por === sAdmin.user.id, `propuesta rechazada con motivo («${tras.motivo?.slice(0, 40)}…»)`)
  const { data: act } = await admin.schema('ia').from('actividad').select('accion, actor_es_ia').eq('propuesta_id', objetivo.id).eq('accion', 'decidio')
  ok(act?.length === 1 && act[0].actor_es_ia === false, 'la decisión quedó en ia.actividad como de una persona')
  const { data: ev } = await admin.schema('nucleo').from('evento').select('tipo').eq('objeto_id', objetivo.objeto_id).in('tipo', ['ia', 'sistema'])
  ok((ev ?? []).some((e) => e.tipo === 'ia') && (ev ?? []).some((e) => e.tipo === 'sistema'), 'la línea de tiempo de la plaza tiene la entrada de la IA y la decisión')
  const { data: aud } = await admin.schema('control').from('auditoria').select('actor_es_ia').eq('esquema', 'ia').eq('tabla', 'actividad').gte('en', SIN_MODELO ? new Date(Date.now() - 7 * 86_400_000).toISOString() : inicio).eq('actor_es_ia', true).limit(1)
  ok((aud?.length ?? 0) > 0, 'control.auditoria registra la actividad de la IA con actor_es_ia')

  // ── 3. Preguntar a la IA, con cita que abre la ficha ────────────────────
  if (!SIN_MODELO) {
    await pagina.goto(`${BASE}/sistema/nucleo/procesos/catalogo`, { waitUntil: 'networkidle' })
    await pagina.locator('[data-boton-preguntar-ia]').click()
    const panel = pagina.locator('[data-panel-pregunta-ia]')
    await panel.locator('textarea').fill('¿Qué registros genera la gestión del Sistema de Gestión de la Calidad?')
    await panel.getByRole('button', { name: 'Preguntar' }).click()
    await panel.locator('[data-respuesta-ia], [role="status"]:has-text("⚠")').first().waitFor({ timeout: 180000 })
    await foto('3-respuesta')
    const citas = await panel.locator('[data-cita-ia]').count()
    ok(citas > 0, `la respuesta trae ${citas} cita(s)`)
    if (citas) {
      const titulo = (await panel.locator('[data-cita-ia]').first().innerText()).split('\n')[0]
      await panel.locator('[data-cita-ia]').first().click()
      await pagina.locator('[data-ficha-objeto] h2').first().waitFor({ timeout: 60000 })
      const abierta = await pagina.locator('[data-ficha-objeto] h2').first().innerText()
      ok(Boolean(abierta), `la cita abre la ficha «${abierta.slice(0, 60)}» (cita: ${titulo.slice(0, 50)})`)
      await foto('3b-cita-ficha')
    }
  }

  // ── 4. RLS: el lector y las propuestas ──────────────────────────────────
  const { count: veLector } = await cLector.schema('ia').from('propuesta').select('id', { count: 'exact', head: true }).eq('objeto_tipo', 'plaza')
  const { data: rolLector } = await admin.from('roles').select('id').eq('clave', 'lector').single()
  await admin.from('rol_permisos').update({ ver: false }).eq('rol_id', rolLector.id).eq('recurso', 'sistema:estructura')
  try {
    const { count: sinPermiso } = await cLector.schema('ia').from('propuesta').select('id', { count: 'exact', head: true }).eq('objeto_tipo', 'plaza')
    const { count: actSin } = await cLector.schema('ia').from('actividad').select('id', { count: 'exact', head: true }).eq('objeto_tipo', 'plaza')
    ok(veLector > 0 && sinPermiso === 0 && actSin === 0, `lector: ve ${veLector} propuestas de plazas con la estructura; sin ella, ${sinPermiso} propuestas y ${actSin} actividades`)
  } finally {
    await admin.from('rol_permisos').update({ ver: true }).eq('rol_id', rolLector.id).eq('recurso', 'sistema:estructura')
  }
  const { error: noDecide } = await cLector.schema('ia').rpc('decidir_propuesta', { p_id: objetivo.id, p_decision: 'aceptada', p_motivo: '' })
  ok(Boolean(noDecide), 'el lector no puede decidir una propuesta')

  // ── 5. N4 por la ruta «nivel_ia» y deshacer ─────────────────────────────
  const subir = async (a) => {
    const { error } = await cAdmin.schema('ia').rpc('pedir_cambio_nivel', { p_codigo: 'NUC-DOC-IA-02', p_nivel: a, p_motivo: `probar-ia: subir a ${a}`, p_evidencia: 'prueba automática' })
    if (error) throw new Error(`pedir ${a}: ${error.message}`)
    const { data: k } = await admin.schema('ia').from('cambio_nivel').select('solicitud_id').eq('capacidad', 'NUC-DOC-IA-02').eq('estado', 'pendiente').single()
    const { error: propio } = await cAdmin.schema('flujo').rpc('decidir', { p_paso: (await admin.schema('flujo').from('paso').select('id').eq('solicitud_id', k.solicitud_id).eq('orden', 1).single()).data.id, p_decision: 'aprobado', p_comentario: '' })
    ok(Boolean(propio), `${a}: quien pide no firma su propia subida`)
    for (const orden of [1, 2]) {
      const { data: paso } = await admin.schema('flujo').from('paso').select('id').eq('solicitud_id', k.solicitud_id).eq('orden', orden).single()
      const { error: e } = await cConsultor.schema('flujo').rpc('decidir', { p_paso: paso.id, p_decision: 'aprobado', p_comentario: 'probar-ia' })
      if (e) throw new Error(`decidir paso ${orden}: ${e.message}`)
    }
    const { data: c } = await admin.schema('ia').from('capacidad').select('nivel_actual').eq('codigo', 'NUC-DOC-IA-02').single()
    return c.nivel_actual
  }
  const { error: salto } = await cAdmin.schema('ia').rpc('pedir_cambio_nivel', { p_codigo: 'NUC-DOC-IA-02', p_nivel: 'N4', p_motivo: 'probar-ia: saltar', p_evidencia: '' })
  ok(Boolean(salto), 'no se salta de N2 a N4 de una vez')
  ok((await subir('N3')) === 'N3', 'N2 → N3 con doble aprobación')
  ok((await subir('N4')) === 'N4', 'N3 → N4 con doble aprobación')
  try {
    if (!SIN_MODELO) {
      await pagina.goto(`${BASE}/sistema/nucleo/documentos/conciliacion`, { waitUntil: 'networkidle' })
      await pagina.locator('[data-accion-ia="Clasificar con la IA"]').click()
      await pagina.getByText(/La IA leyó|Nada por clasificar|No quedan/).first().waitFor({ timeout: 180000 })
      await pagina.reload({ waitUntil: 'networkidle' })
      await foto('5-n4-clasificado')
      const { data: aplicadas } = await admin.schema('ia').from('propuesta').select('id, objeto_id, payload').eq('capacidad', 'NUC-DOC-IA-02').eq('estado', 'aceptada').eq('nivel', 'N4').gte('creado_en', inicio)
      ok((aplicadas?.length ?? 0) > 0, `en N4 la IA aplicó sola ${aplicadas?.length ?? 0} clasificación(es) de metadatos internos`)
      if (aplicadas?.length) {
        const a = aplicadas[0]
        const tarjetaN4 = pagina.locator(`[data-propuesta-ia="${a.id}"]`)
        await tarjetaN4.waitFor({ timeout: 30000 })
        ok((await tarjetaN4.locator('[data-cuenta-regresiva]').count()) === 1, 'la tarjeta N4 muestra la cuenta regresiva para deshacer')
        await tarjetaN4.getByRole('button', { name: '↶ Deshacer' }).click()
        await tarjetaN4.getByRole('button', { name: /Deshacer ahora/ }).click()
        await pagina.getByText(/Deshecho: el documento volvió/).first().waitFor({ timeout: 60000 })
        const { data: doc } = await admin.schema('sgc').from('documento').select('familia, proceso_ref').eq('id', a.objeto_id).single()
        const antes = a.payload.antes ?? {}
        ok(Object.keys(antes).every((k) => (doc[k] ?? null) === (antes[k] ?? null)), 'deshacer devolvió el documento a como estaba')
        const { data: p2 } = await admin.schema('ia').from('propuesta').select('estado').eq('id', a.id).single()
        ok(p2.estado === 'revertida', 'la propuesta quedó «revertida»')
        await foto('5b-deshecho')
      }
    }
  } finally {
    // Lo demás que la IA aplicó sola en esta corrida se deshace: la base de pruebas queda como estaba.
    const { data: resto } = await admin.schema('ia').from('propuesta').select('id').eq('capacidad', 'NUC-DOC-IA-02').eq('estado', 'aceptada').eq('nivel', 'N4').gte('creado_en', inicio)
    for (const r of resto ?? []) await cAdmin.schema('ia').rpc('deshacer', { p_id: r.id, p_motivo: 'probar-ia: limpieza' })
    const { error } = await cAdmin.schema('ia').rpc('pedir_cambio_nivel', { p_codigo: 'NUC-DOC-IA-02', p_nivel: 'N2', p_motivo: 'probar-ia: volver al nivel de fábrica', p_evidencia: '' })
    ok(!error, 'NUC-DOC-IA-02 vuelve a N2 al instante (bajar no pide aprobación)')
  }

  // ── 6. Interruptor general ──────────────────────────────────────────────
  await pagina.goto(`${BASE}/sistema/administracion/ia`, { waitUntil: 'networkidle' })
  await pagina.locator('[data-interruptor-general] button', { hasText: 'Apagar toda la IA' }).click()
  await pagina.locator('dialog[open] textarea').fill('probar-ia: simulacro de apagado')
  await pagina.locator('dialog[open] [data-confirmar-interruptor]').click()
  await pagina.getByText('La IA está apagada en toda la plataforma').first().waitFor({ timeout: 60000 })
  await foto('6-apagada')
  await pagina.goto(`${BASE}/sistema/nucleo/organizacion/plazas`, { waitUntil: 'networkidle' })
  ok((await pagina.locator('[data-marca-ia]').count()) === 0 && (await pagina.locator('[data-boton-preguntar-ia]').count()) === 0, 'apagada: sin marcas ⚑ ni botón «Preguntar»')
  const { data: bloqueo } = await cAdmin.schema('ia').rpc('motivo_bloqueo', { p_codigo: 'NUC-PRO-IA-01' })
  ok(/apagada/.test(bloqueo ?? ''), `apagada: la base bloquea la capacidad («${bloqueo}»)`)
  const { error: revisarApagada } = await cAdmin.schema('ia').rpc('revisar_plazas')
  ok(Boolean(revisarApagada), 'apagada: la vigilancia de plazas no corre')
  await pagina.goto(`${BASE}/sistema/administracion/ia`, { waitUntil: 'networkidle' })
  await pagina.locator('[data-interruptor-general] button', { hasText: 'Encender la IA' }).click()
  await pagina.locator('dialog[open] textarea').fill('probar-ia: fin del simulacro')
  await pagina.locator('dialog[open] [data-confirmar-interruptor]').click()
  await pagina.getByText('La IA está encendida').first().waitFor({ timeout: 60000 })
  ok(true, 'encendida otra vez desde la pantalla, con motivo')
} finally {
  await cAdmin.schema('ia').rpc('fijar_interruptor', { p_encendido: true, p_motivo: 'probar-ia: dejar encendida' })
  const { data: gasto } = await admin.schema('ia').from('actividad').select('costo_usd, costo_tokens').gte('creado_en', inicio)
  const usd = (gasto ?? []).reduce((s, r) => s + Number(r.costo_usd), 0)
  const tok = (gasto ?? []).reduce((s, r) => s + Number(r.costo_tokens), 0)
  console.log(`· gasto de esta corrida: US$ ${usd.toFixed(4)} · ${tok} tokens`)
  ok(errores.length === 0, `sin errores de la página${errores.length ? `: ${errores.slice(0, 3).join(' | ')}` : ''}`)
  await nav.close()
}
process.exit(fallos ? 1 : 0)
