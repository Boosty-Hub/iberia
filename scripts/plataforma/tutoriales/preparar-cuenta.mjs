/**
 * La cuenta con la que se graban los tutoriales del asistente, de Mis archivos y de la administración (26-nov-2026),
 * en el proyecto de PRUEBAS: tutorial.pruebas@plataforma.local, «Gabriela Rondón» (nombre ficticio), nivel
 * administrador. Siembra datos ficticios y ordenados —un proyecto, un atajo, una memoria, carpetas con un Excel— para
 * que los videos no muestren lo que dejan las suites de prueba. Idempotente: borra lo sembrado antes y lo vuelve a
 * crear. Después, `importar-storage.mjs --email tutorial.pruebas@plataforma.local` le pone el Storage en carpetas.
 *
 *   node --env-file=.env.local scripts/plataforma/tutoriales/preparar-cuenta.mjs
 */
import fs from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const URL_SUPA = process.env.SUPABASE_PRUEBAS_URL
if (!URL_SUPA || URL_SUPA === process.env.NEXT_PUBLIC_SUPABASE_URL) throw new Error('Esto corre solo contra pruebas')
const db = createClient(URL_SUPA, process.env.SUPABASE_PRUEBAS_SECRET_KEY, { auth: { persistSession: false } })
const A = db.schema('asistente')
export const CUENTA_TUTORIAL = 'tutorial.pruebas@plataforma.local'
const NOMBRE = 'Gabriela Rondón'

const { data: lista } = await db.auth.admin.listUsers({ perPage: 1000 })
let u = lista.users.find((x) => x.email === CUENTA_TUTORIAL)
if (!u) u = (await db.auth.admin.createUser({ email: CUENTA_TUTORIAL, email_confirm: true, user_metadata: { nombre_completo: NOMBRE, rol_clave: 'administrador', organizacion: 'iberia' } })).data.user
const { data: rol } = await db.from('roles').select('id').eq('clave', 'administrador').single()
await db.from('profiles').update({ rol_id: rol.id, activo: true, nombre_completo: NOMBRE, cargo: 'Gerente de Administración' }).eq('id', u.id)
const yo = u.id

// Lo sembrado antes (y los chats de corridas anteriores de los tutoriales).
await A.from('proyecto').delete().eq('dueno', yo)
await A.from('atajo').delete().eq('dueno', yo)
await A.from('memoria').delete().eq('dueno', yo)
await A.from('chat').delete().eq('dueno', yo)
const { data: htmls } = await A.from('html').select('ruta').eq('dueno', yo)
if (htmls?.length) await db.storage.from('asistente').remove(htmls.map((h) => h.ruta))
await A.from('html').delete().eq('dueno', yo)
const { data: propios } = await A.from('archivo').select('ruta').eq('dueno', yo).eq('origen', 'subido')
if (propios?.length) await db.storage.from('asistente').remove(propios.map((p) => p.ruta))
await A.from('archivo').delete().eq('dueno', yo).in('origen', ['subido', 'generado', 'biblioteca'])
await A.from('carpeta').delete().eq('dueno', yo).in('nombre', ['Finanzas', 'Compras'])

await A.from('proyecto').insert({
  dueno: yo,
  nombre: 'Cierre de mes · Administración',
  instrucciones: 'Ayúdame con el cierre contable del mes. Montos en bolívares y su equivalente en dólares a la tasa BCV. Conclusiones primero, en viñetas cortas.',
})
await A.from('atajo').insert({
  dueno: yo,
  creado_por: yo,
  comando: 'resumen',
  titulo: 'Resumen ejecutivo',
  instruccion: 'Haz un resumen ejecutivo de lo que te paso: tres conclusiones, las cifras clave y lo que hay que decidir. Máximo media página.',
  modelo: 'claude-sonnet-5-5',
  esfuerzo: 'medium',
})
await A.from('memoria').insert([
  { dueno: yo, texto: 'Prefiere respuestas en viñetas cortas, con las conclusiones primero.' },
  { dueno: yo, texto: 'Trabaja el cierre de mes de Administración; los montos los quiere en bolívares y en dólares.' },
])

// Mis archivos: Finanzas › Cierre de noviembre (con un Excel de ventas de ejemplo) y Compras.
const carpeta = async (nombre, padre = null) => {
  const id = crypto.randomUUID()
  const { error } = await A.from('carpeta').insert({ id, dueno: yo, padre_id: padre, nombre })
  if (error) throw new Error(`${nombre}: ${error.message}`)
  return id
}
const finanzas = await carpeta('Finanzas')
const cierre = await carpeta('Cierre de noviembre', finanzas)
await carpeta('Presupuesto 2027', finanzas)
await carpeta('Compras')
const excel = 'capturas/asistente/ventas-onedrive.xlsx'
if (fs.existsSync(excel)) {
  const id = crypto.randomUUID()
  const ruta = `${yo}/biblioteca/${id}-Ventas por zona y producto 2026.xlsx`
  const bytes = fs.readFileSync(excel)
  await db.storage.from('asistente').upload(ruta, bytes, { contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', upsert: true })
  await A.from('archivo').insert({ id, dueno: yo, carpeta_id: cierre, origen: 'subido', estado: 'listo', bucket: 'asistente', ruta, nombre: 'Ventas por zona y producto 2026.xlsx', mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', bytes: bytes.length })
} else console.warn(`⚠ Falta ${excel}: la carpeta de cierre queda vacía`)
// Un artefacto de ejemplo, en dos versiones, en su chat (para el capítulo «Artefactos»).
{
  const chat = crypto.randomUUID()
  await A.from('chat').insert({ id: chat, dueno: yo, titulo: 'Ventas por zona · noviembre', titulo_auto: false })
  const grupo = crypto.randomUUID()
  const tablero = (v, filas) => `<!doctype html><html lang="es"><meta charset="utf-8"><title>Ventas por zona</title>
<style>body{font-family:system-ui,sans-serif;margin:24px;color:#2b2a28}h1{font-size:20px}.b{display:flex;align-items:center;gap:8px;margin:6px 0}
.b i{display:block;height:18px;background:#D4332C;border-radius:4px}.b span{width:110px;font-size:13px}</style>
<h1>Ventas por zona · noviembre 2026 (versión ${v})</h1>${filas.map(([z, n]) => `<div class="b"><span>${z}</span><i style="width:${n / 12}px"></i><b>${n.toLocaleString('es-VE')} cajas</b></div>`).join('')}</html>`
  for (const [v, filas] of [[1, [['Centro', 4120], ['Occidente', 3010], ['Oriente', 2480]]], [2, [['Centro', 4120], ['Occidente', 3010], ['Oriente', 2480], ['Andes', 1890], ['Llanos', 1320]]]]) {
    const id = crypto.randomUUID()
    const html = Buffer.from(tablero(v, filas), 'utf8')
    const ruta = `${yo}/${chat}/artefactos/${grupo}/v${v}-${id}.html`
    await db.storage.from('asistente').upload(ruta, html, { contentType: 'text/html; charset=utf-8', upsert: true })
    await A.from('html').insert({ id, grupo, dueno: yo, chat_id: chat, titulo: 'Tablero de ventas por zona', tipo: 'html', ruta, version: v, bytes: html.length })
  }
}

// «Compartido conmigo»: la administración de pruebas le comparte su carpeta de Tutoriales (la del Storage importado).
const adminPruebas = lista.users.find((x) => x.email === 'admin.pruebas@plataforma.local')
if (adminPruebas) {
  const { data: c } = await A.from('carpeta').select('id').eq('dueno', adminPruebas.id).eq('nombre', 'Tutoriales').is('padre_id', null).maybeSingle()
  if (c) await A.from('compartido').upsert({ tipo: 'carpeta', objeto_id: c.id, con: yo, por: adminPruebas.id, linaje: [] }, { onConflict: 'tipo,objeto_id,con' })
}
console.log(`Cuenta de tutoriales lista: ${CUENTA_TUTORIAL} (${NOMBRE}), administrador, con proyecto, atajo, memoria y carpetas.`)
