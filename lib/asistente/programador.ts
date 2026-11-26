import 'server-only'
import { createClient as clienteSupabase } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/server'
import { fuentesDePersona } from '@/lib/asistente/alcance'
import { esMicrosoft } from '@/lib/asistente/fuentes'
import { lanzarTurno } from '@/lib/asistente/servidor'
import { contextoCorrida } from '@/lib/asistente/motor/tareas'
import { urlBase } from '@/lib/asistente/motor/servicio'
import { AVISO_RESGUARDO, dentroDelMaximo, type Esfuerzo, type Politica } from '@/lib/asistente/tipos'
import { estaLista, mandarPlantilla, type Conexion } from '@/lib/whatsapp'

/**
 * El programador del asistente (fase 5). Dos momentos:
 *
 *  1. `lanzarCorrida`: arma el chat de la corrida, deja el turno en cola a
 *     nombre del dueño y lo dispara con una sesión acuñada para esa corrida
 *     (la RLS de siempre: corre con sus permisos de ese día).
 *  2. `entregarCorrida`: cuando el turno termina, cierra la sesión acuñada,
 *     lleva la cuenta de fallas (reintenta una vez; a las tres seguidas, pausa)
 *     y entrega por cada canal: aviso en la campana, destinatarios (con la
 *     revisión de linaje de la fase 4), correo y WhatsApp.
 */

type Entrega = { canal: 'plataforma' | 'correo' | 'whatsapp'; a: string; estado: 'enviada' | 'pendiente' | 'bloqueada' | 'fallida'; detalle?: string }

const db = () => createAdminClient()

function fechaCorta(d = new Date()): string {
  return new Intl.DateTimeFormat('es-VE', { timeZone: 'America/Caracas', day: 'numeric', month: 'short' }).format(d)
}

/**
 * Una sesión de la persona para correr su tarea sin que esté conectada. Se
 * acuña con la clave de servicio (un enlace mágico que nunca sale del servidor),
 * vive lo que dura la corrida y se cierra al entregar. Si no se puede, la
 * corrida sigue sin datos de la plataforma.
 */
async function sesionDe(perfilId: string): Promise<string | null> {
  try {
    const admin = db()
    const { data: u } = await admin.auth.admin.getUserById(perfilId)
    const email = u.user?.email
    if (!email) return null
    const { data: enlace, error } = await admin.auth.admin.generateLink({ type: 'magiclink', email })
    if (error || !enlace.properties?.hashed_token) return null
    const anon = clienteSupabase(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } })
    const { data } = await anon.auth.verifyOtp({ token_hash: enlace.properties.hashed_token, type: 'magiclink' })
    return data.session?.access_token ?? null
  } catch (e) {
    console.error('[programador] no se pudo acuñar la sesión', e)
    return null
  }
}

async function avisar(destinatario: string, texto: string, enlace: string, detalle?: string | null) {
  await db().schema('nucleo').from('notificacion').insert({ destinatario, tipo: 'ia', texto: texto.slice(0, 300), detalle: detalle?.slice(0, 500) ?? null, enlace })
}

/** Arranca una corrida que el programador (o «Correr ahora») ya marcó `corriendo`. */
export async function lanzarCorrida(corridaId: string): Promise<void> {
  const admin = db()
  const a = admin.schema('asistente')
  const { data: c } = await a.from('corrida').select('*, tarea:tarea_id (*)').eq('id', corridaId).maybeSingle()
  if (!c?.tarea || c.estado !== 'corriendo' || c.turno_id) return
  const t = c.tarea
  try {
    const { data: polData } = await a.rpc('politica_de', { p_perfil: t.dueno })
    const pol = polData as (Politica & { encendido: boolean }) | null
    if (!pol?.habilitado) {
      await a.from('corrida').update({ estado: 'saltada', error: 'El dueño ya no tiene el asistente de IA.', terminado_en: new Date().toISOString() }).eq('id', c.id)
      await a.from('tarea').update({ estado: 'pausada', pausada_motivo: 'Su dueño ya no tiene el asistente de IA.' }).eq('id', t.id)
      return
    }
    // Las fuentes que la última corrida usó y hoy ya no puede ver: la corrida lo dice.
    let perdidas: string[] = []
    if (t.fuentes_usadas.length) {
      const hoy = await fuentesDePersona(t.dueno)
      perdidas = t.fuentes_usadas.filter((f) => hoy.find((x) => x.clave === f)?.estado !== 'si').map((f) => hoy.find((x) => x.clave === f)?.titulo ?? f)
    }
    // Modelo y esfuerzo: los de la tarea si siguen en su política; si no, los de siempre.
    const { data: modelos } = await a.from('modelo').select('id, proveedor, esfuerzos, encendido')
    const permitido = (id: string | null) => (modelos ?? []).find((m) => m.id === id && m.encendido && m.proveedor === pol.motor && pol.modelos.includes(m.id))
    const modelo = permitido(t.modelo) ?? permitido(pol.modelo_defecto) ?? (modelos ?? []).find((m) => m.proveedor === pol.motor && m.encendido && pol.modelos.includes(m.id))
    if (!modelo) throw new Error('No hay un modelo habilitado para el dueño.')
    let esfuerzo = (t.esfuerzo ?? pol.esfuerzo_defecto) as Esfuerzo
    if (!dentroDelMaximo(esfuerzo, pol.esfuerzo_max)) esfuerzo = pol.esfuerzo_max
    if (!(modelo.esfuerzos as string[]).includes(esfuerzo)) esfuerzo = (modelo.esfuerzos as string[]).includes('medium') ? 'medium' : (modelo.esfuerzos[0] as Esfuerzo)

    const chatId = crypto.randomUUID()
    const turnoId = crypto.randomUUID()
    const titulo = `${t.tipo === 'tablero' ? 'Tablero' : 'Tarea'} · ${t.nombre} · ${fechaCorta()}`.slice(0, 200)
    const { error: e1 } = await a.from('chat').insert({ id: chatId, dueno: t.dueno, titulo, titulo_auto: false, tarea_id: t.id, proyecto_id: t.proyecto_id })
    if (e1) throw new Error(`chat: ${e1.message}`)
    const { error: e2 } = await a.from('turno').insert({ id: turnoId, chat_id: chatId, solicitante: t.dueno, motor: modelo.proveedor, modelo: modelo.id, esfuerzo, corrida_id: c.id })
    if (e2) throw new Error(`turno: ${e2.message}`)
    const { error: e3 } = await a.from('mensaje').insert({ chat_id: chatId, turno_id: turnoId, rol: 'usuario', autor: t.dueno, texto: t.instruccion })
    if (e3) throw new Error(`mensaje: ${e3.message}`)
    await a.from('corrida').update({ chat_id: chatId, turno_id: turnoId }).eq('id', c.id)
    const token = await sesionDe(t.dueno)
    await lanzarTurno(turnoId, urlBase(), token, { nota: contextoCorrida(t.nombre, perdidas), efimero: !!token })
  } catch (e) {
    console.error('[programador] no se pudo lanzar la corrida', corridaId, e)
    await a.from('corrida').update({ error: `No se pudo arrancar: ${e instanceof Error ? e.message : 'error'}`.slice(0, 2000) }).eq('id', c.id)
    await entregarCorrida(c.id, null)
  }
}

/** Cierra una corrida: cuenta, reintentos y entregas. Idempotente (solo actúa sobre una corrida `corriendo`). */
export async function entregarCorrida(corridaId: string, token: string | null): Promise<void> {
  const admin = db()
  if (token) await admin.auth.admin.signOut(token, 'local').catch(() => null)
  const a = admin.schema('asistente')
  const { data: c } = await a.from('corrida').select('*, tarea:tarea_id (*)').eq('id', corridaId).maybeSingle()
  if (!c?.tarea || c.estado !== 'corriendo') return
  // Que otra entrega simultánea no la tome: se marca en una sola sentencia.
  const { data: tomada } = await a.from('corrida').update({ terminado_en: new Date().toISOString() }).eq('id', c.id).eq('estado', 'corriendo').is('terminado_en', null).select('id')
  if (!tomada?.length) return
  const t = c.tarea
  const { data: turno } = c.turno_id ? await a.from('turno').select('estado, error').eq('id', c.turno_id).maybeSingle() : { data: null }
  const enlace = c.chat_id ? `/sistema/asistente/c/${c.chat_id}` : '/sistema/asistente/tareas'

  if (turno?.estado !== 'listo') {
    const motivo = turno?.error ?? c.error ?? 'La corrida no terminó.'
    // Sin saldo no es una falla de la tarea: se salta y se avisa.
    if (/tope/i.test(motivo)) {
      await a.from('corrida').update({ estado: 'saltada', error: motivo }).eq('id', c.id)
      await avisar(t.dueno, `«${t.nombre}» no corrió hoy`, enlace, motivo)
      return
    }
    const fallas = t.fallas_seguidas + 1
    await a.from('corrida').update({ estado: 'fallida', error: motivo.slice(0, 2000) }).eq('id', c.id)
    if (fallas >= 3) {
      await a.from('tarea').update({ fallas_seguidas: fallas, estado: 'pausada', pausada_motivo: 'Se pausó sola tras tres fallas seguidas.' }).eq('id', t.id)
      await avisar(t.dueno, `«${t.nombre}» se pausó tras tres fallas seguidas`, '/sistema/asistente/tareas', motivo)
      return
    }
    await a.from('tarea').update({ fallas_seguidas: fallas }).eq('id', t.id)
    if (c.intento === 1 && !c.manual) {
      await a.from('corrida').insert({
        tarea_id: t.id,
        dueno: t.dueno,
        programada_para: c.programada_para,
        intento: 2,
        estado: 'en_cola',
        reintentar_en: new Date(Date.now() + 5 * 60_000).toISOString(),
      })
    } else {
      await avisar(t.dueno, `«${t.nombre}» falló`, enlace, motivo)
    }
    return
  }

  // Salió bien.
  const { data: consultas } = await a.from('consulta_fuente').select('fuente').eq('turno_id', c.turno_id!)
  const linaje = [...new Set((consultas ?? []).map((q) => q.fuente))]
  await a.from('tarea').update({ ultima_en: new Date().toISOString(), fallas_seguidas: 0, fuentes_usadas: linaje }).eq('id', t.id)
  const entregas: Entrega[] = []
  const { data: dueno } = await admin.from('profiles').select('nombre_completo').eq('id', t.dueno).maybeSingle()
  const nombreDueno = dueno?.nombre_completo || 'Alguien'
  await avisar(t.dueno, `«${t.nombre}» está lista`, enlace, t.tipo === 'tablero' ? 'Tablero actualizado con los datos de hoy.' : null)
  entregas.push({ canal: 'plataforma', a: nombreDueno, estado: 'enviada' })

  // Mandarle el resultado a otra persona es compartir: pasa por la revisión de linaje.
  const aceptados: { id: string; nombre: string }[] = [{ id: t.dueno, nombre: nombreDueno }]
  if (t.destinatarios.length && c.chat_id) {
    const { data: gente } = await admin.from('profiles').select('id, nombre_completo').in('id', t.destinatarios)
    for (const d of t.destinatarios) {
      const nombre = gente?.find((g) => g.id === d)?.nombre_completo || 'Alguien'
      const { data: polD } = await a.rpc('politica_de', { p_perfil: d })
      if (!(polD as { habilitado?: boolean } | null)?.habilitado) {
        entregas.push({ canal: 'plataforma', a: nombre, estado: 'bloqueada', detalle: 'Ya no tiene el asistente de IA.' })
        continue
      }
      // Lo hecho con su correo o sus archivos de Microsoft es información del dueño: se comparte a mano, con confirmación.
      if (linaje.some(esMicrosoft)) {
        entregas.push({ canal: 'plataforma', a: nombre, estado: 'bloqueada', detalle: 'Trae datos de tu Microsoft 365: compártelo a mano si quieres.' })
        continue
      }
      if (linaje.length) {
        const suyas = await fuentesDePersona(d)
        const faltan = suyas.filter((f) => linaje.includes(f.clave) && f.estado !== 'si')
        if (faltan.length) {
          entregas.push({ canal: 'plataforma', a: nombre, estado: 'bloqueada', detalle: `Trae datos de ${faltan.map((f) => `«${f.titulo}»`).join(', ')}, que no puede ver.` })
          continue
        }
      }
      await a.from('participante').upsert({ chat_id: c.chat_id, perfil_id: d, rol: 'participante' }, { onConflict: 'chat_id,perfil_id', ignoreDuplicates: true })
      await a.from('chat').update({ compartido: true }).eq('id', c.chat_id)
      await avisar(d, `${nombreDueno} te compartió «${t.nombre}»`, enlace)
      entregas.push({ canal: 'plataforma', a: nombre, estado: 'enviada' })
      aceptados.push({ id: d, nombre })
    }
    const bloqueadas = entregas.filter((e) => e.estado === 'bloqueada')
    if (bloqueadas.length) await avisar(t.dueno, `«${t.nombre}» no se le mandó a ${bloqueadas.map((b) => b.a).join(', ')}`, '/sistema/asistente/tareas', bloqueadas.map((b) => `${b.a}: ${b.detalle}`).join(' '))
  }

  const { data: config } = await a.from('config').select('correo_remitente, correo_nombre, whatsapp_plantilla').eq('id', true).single()
  const { data: respuesta } = c.chat_id
    ? await a.from('mensaje').select('id, texto').eq('chat_id', c.chat_id).eq('rol', 'asistente').order('creado_en', { ascending: false }).limit(1).maybeSingle()
    : { data: null }
  const url = `${urlBase()}${enlace}`

  if (t.canales.includes('correo')) {
    if (!config?.correo_remitente) {
      entregas.push({ canal: 'correo', a: 'todos', estado: 'pendiente', detalle: 'Falta verificar en Resend el remitente de Iberia.' })
    } else {
      // Adjuntos solo si el resultado no trae datos de la plataforma: un correo se reenvía.
      const adjuntos = !linaje.length && respuesta ? await adjuntosDe(respuesta.id) : []
      for (const p of aceptados) {
        const { data: u } = await admin.auth.admin.getUserById(p.id)
        const email = u.user?.email
        if (!email || email.endsWith('.local')) {
          if (!process.env.ASISTENTE_CORREO_DESVIO) {
            entregas.push({ canal: 'correo', a: p.nombre, estado: 'fallida', detalle: 'No tiene correo.' })
            continue
          }
        }
        const r = await mandarCorreo({
          de: `${config.correo_nombre} <${config.correo_remitente}>`,
          para: process.env.ASISTENTE_CORREO_DESVIO || email!,
          asunto: `${t.nombre} · ${fechaCorta()}`,
          html: correoHtml(t.nombre, respuesta?.texto ?? '', url, !!linaje.length),
          adjuntos,
        })
        entregas.push({ canal: 'correo', a: p.nombre, estado: r.ok ? 'enviada' : 'fallida', detalle: r.ok ? (adjuntos.length ? `${adjuntos.length} adjunto(s)` : undefined) : r.detalle })
      }
    }
  }

  if (t.canales.includes('whatsapp')) {
    const { data: ajustes } = await admin.from('ajustes_whatsapp').select('activo, id_numero, token, plantilla').eq('id', true).maybeSingle()
    const conexion: Conexion | null = ajustes ? { ...ajustes, plantilla: config?.whatsapp_plantilla ?? null } : null
    if (!estaLista(conexion)) {
      entregas.push({ canal: 'whatsapp', a: 'todos', estado: 'pendiente', detalle: 'La cuenta de WhatsApp de Iberia y su plantilla están en trámite.' })
    } else {
      for (const p of aceptados) {
        const { data: emp } = await admin.from('empleados').select('telefono').eq('perfil_id', p.id).maybeSingle()
        const r = await mandarPlantilla(conexion, emp?.telefono ?? null, [p.nombre.split(' ')[0], t.nombre, url])
        entregas.push({ canal: 'whatsapp', a: p.nombre, estado: r.ok ? 'enviada' : 'fallida', detalle: r.ok ? undefined : r.motivo })
      }
    }
  }

  await a.from('corrida').update({ estado: 'lista', entregas: entregas as never }).eq('id', c.id)
}

async function adjuntosDe(mensajeId: string): Promise<{ filename: string; content: string }[]> {
  const admin = db()
  const { data: archivos } = await admin.schema('asistente').from('archivo').select('nombre, ruta, bytes').eq('mensaje_id', mensajeId).eq('origen', 'generado').eq('estado', 'listo')
  const salida: { filename: string; content: string }[] = []
  let total = 0
  for (const f of archivos ?? []) {
    total += Number(f.bytes)
    if (total > 10 * 1024 * 1024) break
    const { data } = await admin.storage.from('asistente').download(f.ruta)
    if (data) salida.push({ filename: f.nombre, content: Buffer.from(await data.arrayBuffer()).toString('base64') })
  }
  return salida
}

async function mandarCorreo(c: { de: string; para: string; asunto: string; html: string; adjuntos: { filename: string; content: string }[] }): Promise<{ ok: true } | { ok: false; detalle: string }> {
  const clave = process.env.RESEND_API_KEY
  if (!clave) return { ok: false, detalle: 'Falta RESEND_API_KEY.' }
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${clave}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: c.de, to: [c.para], subject: c.asunto, html: c.html, ...(c.adjuntos.length ? { attachments: c.adjuntos } : {}) }),
    })
    if (r.ok) return { ok: true }
    const cuerpo = (await r.json().catch(() => null)) as { message?: string } | null
    return { ok: false, detalle: `${r.status} · ${cuerpo?.message ?? ''}`.slice(0, 300) }
  } catch (e) {
    return { ok: false, detalle: String(e).slice(0, 300) }
  }
}

const escapar = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** El correo: un resumen corto y el enlace (que pide sesión). Nunca el resultado entero. */
export function correoHtml(nombre: string, texto: string, url: string, conDatos: boolean): string {
  const plano = texto
    .replace(/```[\s\S]*?```/g, '')
    .replace(/[#*_`>|]/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  const resumen = plano.length > 700 ? `${plano.slice(0, 700).replace(/\s+\S*$/, '')}…` : plano
  return `<!doctype html><html lang="es"><body style="margin:0;background:#f6f7f9;font-family:Arial,Helvetica,sans-serif;color:#2b2a28">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f7f9;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #e6e4e1;border-radius:16px">
<tr><td style="padding:24px 28px 8px"><div style="font-size:12px;color:#706a67;letter-spacing:.04em;text-transform:uppercase">Asistente de IA · Plataforma Iberia</div>
<h1 style="margin:8px 0 0;font-size:20px;line-height:1.3;color:#2b2a28">${escapar(nombre)}</h1></td></tr>
<tr><td style="padding:8px 28px 0;font-size:14px;line-height:1.6;white-space:pre-line">${escapar(resumen) || 'La tarea terminó.'}</td></tr>
<tr><td style="padding:20px 28px"><a href="${escapar(url)}" style="display:inline-block;background:#d4332c;color:#ffffff;text-decoration:none;font-weight:bold;font-size:14px;padding:11px 18px;border-radius:10px">Abrir en la plataforma</a>
${conDatos ? '<div style="margin-top:10px;font-size:12px;color:#706a67">Trae datos de la plataforma: el detalle y los archivos se abren con tu sesión.</div>' : ''}</td></tr>
<tr><td style="padding:0 28px 22px;font-size:11px;color:#706a67;border-top:1px solid #efedea;padding-top:14px">${escapar(AVISO_RESGUARDO)}</td></tr>
</table></td></tr></table></body></html>`
}
