/**
 * El rediseño de Procesos en pantalla, contra PRUEBAS (dev en el 3005): mapa con búsqueda, macroproceso, proceso,
 * documento por secciones, editar una sección → borrador → enviar a revisión, y la base: la versión en revisión con
 * su solicitud del flujo, que el autor no puede aprobar. Al final deja el documento como estaba (borra lo que creó).
 *
 *   node --env-file=.env.local scripts/plataforma/procesos/probar-documentos-vivos.mjs [--base http://localhost:3005]
 */
import { createClient } from '@supabase/supabase-js'
import { chromium } from 'playwright'
import { cookiesDePrueba, URL_PRUEBAS } from '../sesion-pruebas.mjs'

const argv = process.argv.slice(2)
const BASE = argv.includes('--base') ? argv[argv.indexOf('--base') + 1] : 'http://localhost:3005'
const admin = createClient(URL_PRUEBAS, process.env.SUPABASE_PRUEBAS_SECRET_KEY, { auth: { persistSession: false } })
const sgc = admin.schema('sgc')
let fallas = 0
const ok = (c, m) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) fallas++ }

const { data: doc } = await sgc.from('documento').select('id, codigo').eq('codigo', 'S/C-1.1-01').maybeSingle()
if (!doc) throw new Error('Falta la Política de la Calidad de 1.1 (corre cargar-macro.mjs --macro 1.1)')
await sgc.from('documento_version').delete().eq('documento_id', doc.id).in('estado', ['borrador', 'en_revision'])

const nav = await chromium.launch()
const ctx = await nav.newContext({ viewport: { width: 1440, height: 950 } })
await ctx.addCookies(await cookiesDePrueba('admin', BASE))
const p = await ctx.newPage()
const errores = []
p.on('pageerror', (e) => errores.push(e.message))

// 1 · Mapa y búsqueda
await p.goto(`${BASE}/sistema/nucleo/procesos`, { waitUntil: 'networkidle' })
ok(await p.locator('[data-macro]').count() >= 20, 'el mapa muestra los 20 macroprocesos')
ok(!(await p.getByRole('link', { name: 'Catálogo', exact: true }).count()), 'sin pestañas de herramientas en el mapa')
await p.fill('[data-buscar-procesos]', 'politica de la calidad')
await p.waitForSelector('[data-resultados-busqueda] a')
ok((await p.locator('[data-resultados-busqueda]').innerText()).includes('S/C-1.1-01'), 'la búsqueda sin tildes encuentra la Política de la Calidad')

// 2 · Macroproceso → proceso
await p.goto(`${BASE}/sistema/nucleo/procesos/m/1.1`, { waitUntil: 'networkidle' })
ok(await p.locator('[data-proceso="1.1.1"]').count() === 1, 'el macroproceso 1.1 lista 1.1.1')
await p.locator('[data-proceso="1.1.1"] a').first().click()
await p.waitForSelector('[data-proceso-pagina="1.1.1"]')
ok(await p.locator('[data-propuesta-caracterizacion]').count() === 1, 'el proceso 1.1.1 muestra la caracterización propuesta')
ok((await p.locator('main').innerText()).includes('ISO 4.4.1'), 'la caracterización trae los campos de la cláusula 4.4.1')
// La caracterización se edita en la misma página: un campo al borrador.
const { data: p111 } = await sgc.from('proceso').select('ref').eq('codigo_informe', '1.1.1').is('escenario_id', null).eq('estado', 'vigente').maybeSingle()
const refProc = p111?.ref
const { data: fichaAntes } = await sgc.from('proceso').select('id, ficha').eq('ref', refProc).is('escenario_id', null).eq('estado', 'borrador').maybeSingle()
await p.locator('[data-campo="recursos"]').hover()
await p.locator('[data-campo="recursos"] > button').click()
const campo = p.getByLabel('Recursos', { exact: true })
await campo.fill(`${await campo.inputValue()}
Recurso agregado por la prueba automática`)
await p.getByRole('button', { name: 'Guardar en el borrador' }).click()
await p.waitForSelector('[data-editor-campo]', { state: 'detached', timeout: 30000 })
await p.waitForSelector('li:has-text("Recurso agregado por la prueba automática")', { timeout: 30000 })
ok(true, 'un campo de la caracterización se guarda en el borrador desde la página')
const { data: bp } = await sgc.from('proceso').select('ficha').eq('ref', refProc).is('escenario_id', null).eq('estado', 'borrador').maybeSingle()
ok((bp?.ficha?.recursos ?? []).includes('Recurso agregado por la prueba automática'), 'la base guardó el cambio en el borrador del proceso')
// Deja la propuesta como estaba (la caracterización cargada de la revisión del macroproceso).
if (fichaAntes) { const { error: er } = await sgc.from('proceso').update({ ficha: fichaAntes.ficha }).eq('id', fichaAntes.id); if (er) console.warn('no se pudo restaurar:', er.message) }

// 3 · Documento: editar una sección → borrador
await p.goto(`${BASE}/sistema/nucleo/documentos/${doc.id}`, { waitUntil: 'networkidle' })
ok(await p.locator('[data-banda-envio="transcripcion"]').count() === 1, 'la transcripción sale por validar, con «Enviar a revisión»')
await p.locator('section#s0').hover()
await p.getByRole('button', { name: '✎ Editar sección' }).first().click()
const area = p.getByLabel('Contenido de la sección')
const antes = await area.inputValue()
await area.fill(`${antes}\n\nTexto agregado por la prueba automática.`)
await p.getByRole('button', { name: 'Guardar en mi borrador' }).click()
await p.waitForSelector('[data-banda-envio="borrador"]', { timeout: 30000 })
ok(true, 'guardar abre el borrador propio')
ok((await p.locator('main').innerText()).includes('Texto agregado por la prueba automática.'), 'el borrador muestra el cambio')

// 4 · Enviar a revisión
await p.locator('[data-banda-envio="borrador"]').getByRole('button', { name: 'Enviar a revisión' }).click()
await p.getByLabel('Motivo del cambio').fill('Prueba automática del rediseño.')
await p.getByRole('button', { name: 'Enviar', exact: true }).click()
await p.waitForSelector('text=en revisión', { timeout: 30000 })
const { data: vr } = await sgc.from('documento_version').select('id, estado').eq('documento_id', doc.id).eq('estado', 'en_revision').maybeSingle()
ok(!!vr, 'la versión quedó en revisión')
const { data: sol } = vr ? await admin.schema('flujo').from('solicitud').select('id, estado, paso_actual').eq('tipo_objeto', 'documento_version').eq('objeto_id', vr.id).maybeSingle() : { data: null }
ok(sol?.estado === 'en_curso', 'el flujo abrió la solicitud «Documento del SGC»')

// 5 · Comparar versiones
await p.goto(`${BASE}/sistema/nucleo/documentos/${doc.id}?p=versiones`, { waitUntil: 'networkidle' })
ok((await p.locator('[data-comparacion] ins').allInnerTexts()).some((t) => t.includes('prueba automática')), 'la comparación marca lo agregado')
ok(errores.length === 0, `sin errores de página${errores.length ? ': ' + errores.join(' | ') : ''}`)

// Limpieza: la solicitud y la versión de la prueba.
if (sol) await admin.schema('flujo').from('solicitud').delete().eq('id', sol.id)
await sgc.from('documento_version').delete().eq('documento_id', doc.id).in('estado', ['borrador', 'en_revision'])
await nav.close()
console.log(fallas ? `${fallas} falla(s)` : 'Todo bien.')
process.exit(fallas ? 1 : 0)
