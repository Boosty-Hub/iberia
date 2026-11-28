/**
 * Verifica un macroproceso ya cargado (rediseño de Procesos, 28-nov-2026; Gabriel: «cuando termines un macroproceso
 * verificas que quedó bien y sigues al otro»). Contra PRUEBAS, con el dev en el 3005:
 *   - en la base: cada proceso con su caracterización en borrador; cada documento activo con texto (versión o
 *     registro); los archivos de origen con su PDF o anotados; cuántos archivos quedan sin cuenta de su contenido;
 *   - en pantalla: el macroproceso, cada proceso (caracterización y documentos) y una muestra de documentos (texto y
 *     archivo de origen), sin errores de la página. Deja capturas en plataforma/_trabajo/verificacion/<macro>/.
 *
 *   node --env-file=.env.local scripts/plataforma/procesos/verificar-macro.mjs --macro 1.3 [--base http://127.0.0.1:3005]
 */
import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { chromium } from 'playwright'
import { cookiesDePrueba, URL_PRUEBAS } from '../sesion-pruebas.mjs'

const argv = process.argv.slice(2)
const opc = (n) => (argv.includes(n) ? argv[argv.indexOf(n) + 1] : null)
const macro = opc('--macro')
if (!macro) throw new Error('Falta --macro')
const BASE = opc('--base') ?? 'http://localhost:3005'
const sgc = createClient(URL_PRUEBAS, process.env.SUPABASE_PRUEBAS_SECRET_KEY, { auth: { persistSession: false } }).schema('sgc')
const SALIDA = path.resolve('plataforma/_trabajo/verificacion', macro)
await mkdir(SALIDA, { recursive: true })
let fallas = 0
const ok = (c, m) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) fallas++ }
const aviso = (m) => console.log(`· ${m}`)

// ── Base ─────────────────────────────────────────────────────────────────────
const { data: procs } = await sgc.from('proceso').select('ref, codigo_informe, nombre, estado').is('escenario_id', null).in('estado', ['vigente', 'borrador'])
const vigentes = procs.filter((p) => p.estado === 'vigente' && (p.codigo_informe ?? '').startsWith(`${macro}.`))
const conBorrador = new Set(procs.filter((p) => p.estado === 'borrador').map((p) => p.ref))
const sinCaract = vigentes.filter((p) => !conBorrador.has(p.ref))
ok(!sinCaract.length, `los ${vigentes.length} procesos tienen caracterización propuesta${sinCaract.length ? ` (faltan: ${sinCaract.map((p) => p.codigo_informe).join(', ')})` : ''}`)
const refs = vigentes.map((p) => p.ref)
const { data: en } = await sgc.from('documento_proceso').select('documento_id, proceso_ref, rol').in('proceso_ref', refs).neq('estado', 'descartado')
const ids = [...new Set(en.map((e) => e.documento_id))]
const trozos = (xs, n = 150) => Array.from({ length: Math.ceil(xs.length / n) }, (_, i) => xs.slice(i * n, i * n + n))
const docs = [], vs = [], rs = [], as = []
for (const t of trozos(ids)) {
  const [d, v, r, a] = await Promise.all([
    sgc.from('documento').select('id, codigo, titulo, estado, archivos').in('id', t),
    sgc.from('documento_version').select('documento_id, estado').in('documento_id', t),
    sgc.from('documento_registro').select('documento_id').in('documento_id', t),
    sgc.from('documento_archivo').select('documento_id, nombre, estado, pdf_ruta, transcripcion').in('documento_id', t),
  ])
  docs.push(...d.data); vs.push(...v.data); rs.push(...r.data); as.push(...a.data)
}
const conTexto = new Set([...vs, ...rs].map((x) => x.documento_id))
const activos = docs.filter((d) => ['vigente', 'sin_determinar', 'borrador'].includes(d.estado) && (d.archivos ?? []).length)
const sinTexto = activos.filter((d) => !conTexto.has(d.id))
ok(!sinTexto.length, `${activos.length} documentos activos con archivos: todos con texto en la plataforma${sinTexto.length ? ` (faltan ${sinTexto.length}: ${sinTexto.slice(0, 5).map((d) => d.codigo).join(', ')}…)` : ''}`)
const porLeer = activos.filter((d) => conTexto.has(d.id) && !vs.some((v) => v.documento_id === d.id && ['transcripcion', 'vigente', 'borrador', 'en_revision'].includes(v.estado)) && vs.some((v) => v.documento_id === d.id))
if (porLeer.length) aviso(`${porLeer.length} documentos solo con versiones históricas (sin una «por validar»): ${porLeer.slice(0, 5).map((d) => d.codigo).join(', ')}`)
const disp = as.filter((a) => a.estado === 'disponible' && a.pdf_ruta).length
aviso(`${docs.length} documentos enlazados · ${vs.length} versiones · ${rs.length} registros · ${as.length} archivos de origen (${disp} se ven en la plataforma)`)

// ── Pantalla ─────────────────────────────────────────────────────────────────
const nav = await chromium.launch()
const ctx = await nav.newContext({ viewport: { width: 1440, height: 950 } })
await ctx.addCookies(await cookiesDePrueba('admin', BASE))
const p = await ctx.newPage()
const errores = []
p.on('pageerror', (e) => errores.push(e.message))
const ir = async (url) => { const r = await p.goto(`${BASE}${url}`, { waitUntil: 'networkidle', timeout: 90_000 }); return r?.status() ?? 0 }

ok(await ir(`/sistema/nucleo/procesos/m/${macro}`) === 200, `la página del macroproceso ${macro} abre`)
const filas = await p.locator('[data-proceso]').count()
ok(filas >= vigentes.length, `el macroproceso lista sus procesos (${filas} de ${vigentes.length})`)
await p.screenshot({ path: path.join(SALIDA, '1-macro.png'), fullPage: true })
for (const pr of vigentes.sort((a, b) => a.codigo_informe.localeCompare(b.codigo_informe, 'es', { numeric: true }))) {
  const s1 = await ir(`/sistema/nucleo/procesos/${pr.ref}`)
  const caract = await p.locator('[data-propuesta-caracterizacion], details[data-seccion-caracterizacion]').count()
  const s2 = await ir(`/sistema/nucleo/procesos/${pr.ref}?p=documentos`)
  const n = en.filter((e) => e.proceso_ref === pr.ref).length
  const texto = await p.locator('main').innerText()
  ok(s1 === 200 && s2 === 200 && caract > 0, `${pr.codigo_informe} ${pr.nombre}: caracterización y ${n} documentos`)
  if (n && /sin documentos/i.test(texto) && !/También aplican/i.test(texto)) aviso(`${pr.codigo_informe}: la pestaña Documentos dice «sin documentos» con ${n} enlaces`)
}
await p.screenshot({ path: path.join(SALIDA, '2-proceso-documentos.png'), fullPage: true })
// Muestra: hasta 6 documentos con texto, repartidos.
const muestra = activos.filter((d) => conTexto.has(d.id)).filter((_, i, xs) => i % Math.max(1, Math.floor(xs.length / 6)) === 0).slice(0, 6)
for (const [i, d] of muestra.entries()) {
  await ir(`/sistema/nucleo/documentos/${d.id}`)
  const cuerpo = await p.locator('main').innerText()
  const conRegistros = rs.some((r) => r.documento_id === d.id)
  ok(cuerpo.length > 400 || conRegistros, `${d.codigo} muestra su texto`)
  await ir(`/sistema/nucleo/documentos/${d.id}?p=origen`)
  const falta = await p.getByText('Falta transcribir').count()
  ok(!falta, `${d.codigo}: «Archivo de origen» sin archivos por transcribir`)
  if (i < 2) await p.screenshot({ path: path.join(SALIDA, `3-documento-${i + 1}-origen.png`), fullPage: true })
}
ok(!errores.length, `sin errores de la página${errores.length ? `: ${errores.slice(0, 3).join(' | ')}` : ''}`)
await nav.close()
console.log(fallas ? `${fallas} falla(s)` : 'Todo bien.', `Capturas en ${SALIDA}`)
process.exit(fallas ? 1 : 0)
