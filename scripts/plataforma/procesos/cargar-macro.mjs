/**
 * Carga la revisión a fondo de UN macroproceso (rediseño de Procesos, 28-nov-2026): lo que se hizo macroproceso por
 * macroproceso, por decisión de Gabriel. Lee la carpeta de la revisión (fuera de git):
 *
 *   plataforma/propuestas/macros/<macro>/documentos.json      todo lo que pertenece al macroproceso, inventariado o no
 *   plataforma/propuestas/macros/<macro>/caracterizacion.json la caracterización ISO 4.4 de cada proceso, con fuentes
 *   plataforma/propuestas/macros/<macro>/transcripciones/*.json el texto de cada documento por secciones
 *
 * y deja en la base, sin aprobar nada:
 *   1. los documentos hallados que no estaban en el inventario, dados de alta (`sgc.documento`, con la nota de dónde
 *      salieron) y sus enlaces sugeridos; los del inventario, con el enlace sugerido corregido si la revisión lo movió;
 *   2. las transcripciones como versiones (`sgc.documento_version`): la más nueva «transcripción» por validar, las
 *      anteriores «histórica»;
 *   3. la caracterización de cada proceso como BORRADOR de una versión nueva (`sgc.proceso`), que el dueño revisa y envía.
 *
 *   node --env-file=.env.local scripts/plataforma/procesos/cargar-macro.mjs --macro 1.1 [--revisar] [--destino produccion --confirmo]
 *
 * Idempotente: un documento ya dado de alta (mismo código y título) no se duplica; una transcripción ya cargada (mismo
 * archivo de origen) no se repite; si el proceso ya tiene borrador, la caracterización no se pisa.
 */
import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'

const argv = process.argv.slice(2)
const opc = (n) => (argv.includes(n) ? argv[argv.indexOf(n) + 1] : null)
const macro = opc('--macro')
if (!macro) throw new Error('Falta --macro (ej. 1.1)')
const revisar = argv.includes('--revisar')
const produccion = opc('--destino') === 'produccion'
if (produccion && !argv.includes('--confirmo')) throw new Error('Para producción hace falta --confirmo')
const url = produccion ? process.env.NEXT_PUBLIC_SUPABASE_URL : process.env.SUPABASE_PRUEBAS_URL
const clave = produccion ? process.env.SUPABASE_SECRET_KEY : process.env.SUPABASE_PRUEBAS_SECRET_KEY
const sgc = createClient(url, clave, { auth: { persistSession: false } }).schema('sgc')
const carpeta = path.resolve('plataforma/propuestas/macros', macro)
const leer = async (f) => JSON.parse(await readFile(path.join(carpeta, f), 'utf8'))
const ORIGEN = `revision-macro-${macro}`
const NOTA = `Revisión a fondo del macroproceso ${macro} (28-nov-2026)`
const norm = (t) => (t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
const enMacro = (c) => c === macro || (c ?? '').startsWith(`${macro}.`)

const documentos = await leer('documentos.json')
const caract = await leer('caracterizacion.json')
const transcripciones = []
for (const f of (await readdir(path.join(carpeta, 'transcripciones'))).filter((x) => x.endsWith('.json'))) {
  transcripciones.push({ archivo: f, ...(await leer(path.join('transcripciones', f))) })
}

// Procesos vigentes: código → fila.
const { data: procs, error: e0 } = await sgc.from('proceso').select('*').is('escenario_id', null).eq('estado', 'vigente')
if (e0) throw e0
const procPorCodigo = new Map()
for (const p of procs) {
  if (p.codigo_informe) procPorCodigo.set(p.codigo_informe, p)
  else if (p.codigo_sgc && !procPorCodigo.has(p.codigo_sgc)) procPorCodigo.set(p.codigo_sgc, p)
}

// ── 1 · Documentos ──────────────────────────────────────────────────────────
const TIPO = { 'política': '12', politica: '12', procedimiento: '20', norma: '22', 'instrucción': '31', formato: '40', minuta: '40', registro: '40', 'caracterización': '11', organigrama: '14', manual: '10' }
const tipoYY = (t) => { const k = norm(t).split(' ')[0]; for (const [x, y] of Object.entries(TIPO)) if (norm(x) === k) return y; return null }
const ESTADO = (e) => {
  const x = norm(e)
  if (x.startsWith('vigente')) return 'vigente'
  if (x.startsWith('historico') || x.startsWith('obsoleto')) return 'obsoleto'
  if (x.startsWith('borrador')) return 'borrador'
  if (x.startsWith('nunca')) return null
  return 'sin_determinar'
}
const altaNecesaria = (d) => {
  const inv = d.en_inventario ?? {}
  if (!inv.en_inventario || !inv.id) return true
  return /dar(lo|la)? de alta|separar/i.test(inv.nota_inventario ?? '')
}
const acciones = { altas: [], enlaces: [], versiones: [], borradores: [] }
const docDeEntrada = new Map() // índice de la entrada → id del documento

let n = 0
for (const [i, d] of documentos.entries()) {
  if (!enMacro(d.proceso)) continue
  const estado = ESTADO(d.estado)
  if (!estado) continue // nunca elaborado: va como brecha de la caracterización
  const proc = procPorCodigo.get(d.proceso)
  if (!proc) { console.warn('Sin proceso en el mapa:', d.proceso, d.titulo); continue }
  let id = d.en_inventario?.id ?? null
  if (altaNecesaria(d)) {
    const conCodigo = d.codigo && /^II-[\d-]+$/.test(d.codigo.split(' ')[0])
    const codigo = conCodigo ? d.codigo.split(' ')[0] : `S/C-${macro}-${String(++n).padStart(2, '0')}`
    const titulo = d.titulo.trim().slice(0, 300)
    const { data: ya } = await sgc.from('documento').select('id').eq('codigo', codigo).eq('titulo', titulo).maybeSingle()
    if (ya) id = ya.id
    else {
      const fila = {
        codigo, titulo, tipo_yy: tipoYY(d.tipo), estado, version: d.version ?? null, fecha: /^\d{4}-\d{2}-\d{2}$/.test(d.fecha ?? '') ? d.fecha : null,
        proceso_ref: proc.ref, archivos: (d.archivos ?? []).map((a) => a.ruta).filter(Boolean),
        nota: `${NOTA}: ${d.estado_evidencia ?? d.nota ?? ''}`.slice(0, 2000), evidencia_estado: d.estado_evidencia?.slice(0, 1000) ?? null,
      }
      acciones.altas.push(fila)
      if (!revisar) {
        const { data: x, error } = await sgc.from('documento').insert(fila).select('id').single()
        if (error) throw new Error(`${codigo} ${titulo}: ${error.message}`)
        id = x.id
      } else id = `(nuevo ${codigo})`
    }
  }
  docDeEntrada.set(i, id)
  // Enlaces: principal en su proceso de 1.1 y «también» donde corresponda.
  const destinos = [{ codigo: d.proceso, rol: 'principal' }, ...(d.tambien ?? []).map((c) => ({ codigo: c, rol: 'tambien' }))]
  for (const t of destinos) {
    const p = procPorCodigo.get(t.codigo)
    if (!p || revisar && String(id).startsWith('(')) { if (p) acciones.enlaces.push({ id, ...t }); continue }
    acciones.enlaces.push({ id, ...t })
    if (revisar) continue
    const { data: ex } = await sgc.from('documento_proceso').select('id, proceso_ref, rol, estado').eq('documento_id', id)
    const mismo = ex?.find((e) => e.proceso_ref === p.ref)
    if (mismo) {
      // Ya estaba como «también» y la revisión lo hace principal: se cambian los papeles (si nadie confirmó el principal).
      if (t.rol === 'principal' && mismo.rol === 'tambien') {
        const prin = ex?.find((e) => e.rol === 'principal' && e.estado !== 'descartado')
        if (!prin || prin.estado === 'sugerido') {
          if (prin) await sgc.from('documento_proceso').update({ rol: 'tambien' }).eq('id', prin.id)
          await sgc.from('documento_proceso').update({ rol: 'principal', origen: ORIGEN, razon: `${NOTA}: ${(d.en_inventario?.nota_inventario ?? d.nota ?? '').slice(0, 400)}` }).eq('id', mismo.id)
        }
      }
      continue
    }
    if (t.rol === 'principal') {
      const prin = ex?.find((e) => e.rol === 'principal' && e.estado !== 'descartado')
      if (prin && prin.estado === 'sugerido') {
        await sgc.from('documento_proceso').update({ proceso_ref: p.ref, origen: ORIGEN, razon: `${NOTA}: ${(d.en_inventario?.nota_inventario ?? d.nota ?? '').slice(0, 400)}` }).eq('id', prin.id)
        continue
      }
      if (prin) continue // confirmado por alguien: se respeta
    }
    const { error } = await sgc.from('documento_proceso').insert({ documento_id: id, proceso_ref: p.ref, rol: t.rol, estado: 'sugerido', confianza: 'alta', origen: ORIGEN, razon: `${NOTA}.` })
    if (error && !/duplicate|unique/i.test(error.message)) throw error
  }
}

// ── 2 · Transcripciones ─────────────────────────────────────────────────────
// Cada transcripción va al documento de su entrada (por código y título parecido, o por el archivo de origen).
// `asignaciones.json` (opcional): archivo de transcripción → comienzo del título de su entrada, para los casos que el
// emparejamiento automático no resuelve (una variante de un documento que se llama distinto).
let asignaciones = {}
try { asignaciones = await leer('asignaciones.json') } catch {}
function entradaDe(t) {
  if (asignaciones[t.archivo]) {
    const i = documentos.findIndex((d, k) => docDeEntrada.has(k) && norm(d.titulo).startsWith(norm(asignaciones[t.archivo])))
    if (i >= 0) return i
  }
  const tt = norm(t.titulo)
  let mejor = null
  for (const [i, d] of documentos.entries()) {
    if (!docDeEntrada.has(i)) continue
    const td = norm(d.titulo)
    const mismoCodigo = t.codigo && d.codigo && d.codigo.includes(t.codigo)
    const porArchivo = (d.archivos ?? []).some((a) => a.ruta && t.fuente_archivo && norm(a.ruta) === norm(t.fuente_archivo))
    const porTitulo = td && tt && (td.includes(tt) || tt.includes(td) || td.split(' ').slice(0, 4).join(' ') === tt.split(' ').slice(0, 4).join(' '))
    if (porArchivo) return i
    if (mismoCodigo && porTitulo) return i
    if (!mejor && (porTitulo || (mismoCodigo && !d.codigo.includes('/')))) mejor = i
  }
  return mejor
}
const porDoc = new Map()
for (const t of transcripciones) {
  const i = entradaDe(t)
  if (i == null) { console.warn('Transcripción sin documento:', t.archivo); continue }
  const id = docDeEntrada.get(i)
  if (!porDoc.has(id)) porDoc.set(id, { entrada: documentos[i], ts: [] })
  porDoc.get(id).ts.push(t)
}
const fechaDe = (t) => {
  const f = t.fecha ?? t.control?.fechas?.actualizacion ?? t.control?.fechas?.elaboracion ?? ''
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(f) ?? null
  if (m) return m[0]
  const m2 = /(\d{2})[-/](\d{2})[-/](\d{4})/.exec(f)
  return m2 ? `${m2[3]}-${m2[2]}-${m2[1]}` : /^\d{4}$/.test(f) ? `${f}-01-01` : null
}
for (const [id, { entrada, ts }] of porDoc) {
  ts.sort((a, b) => (fechaDe(a) ?? '').localeCompare(fechaDe(b) ?? ''))
  const vigente = ESTADO(entrada.estado) !== 'obsoleto'
  const { data: ya } = revisar || String(id).startsWith('(') ? { data: [] } : await sgc.from('documento_version').select('numero, archivo_ruta').eq('documento_id', id)
  let numero = Math.max(0, ...(ya ?? []).map((v) => v.numero))
  for (const [k, t] of ts.entries()) {
    const ruta = t.fuente_archivo ?? t.archivo
    if ((ya ?? []).some((v) => v.archivo_ruta === ruta)) continue
    const ultima = k === ts.length - 1
    const c = t.control ?? {}
    const fila = {
      documento_id: id, numero: ++numero,
      etiqueta: [t.version != null && t.version !== '' ? `Versión ${t.version}` : null, fechaDe(t)?.slice(0, 4)].filter(Boolean).join(' · ') || null,
      fecha: fechaDe(t), estado: ultima && vigente ? 'transcripcion' : 'historica', origen: 'transcripcion', archivo_ruta: ruta,
      contenido: {
        control: {
          elaboro: c.elaboro ?? null, reviso: c.reviso ?? null, aprobo: c.aprobo ?? null,
          elaboracion: c.fechas?.elaboracion ?? null, actualizacion: c.fechas?.actualizacion ?? c.fechas?.aprobacion ?? null, version_original: t.version ?? null,
        },
        secciones: (t.secciones ?? []).map((s) => ({ titulo: s.titulo, bloques: (s.bloques ?? []).filter((b) => b && b.tipo) })),
      },
      motivo: t.nota ? `Transcripción del original. ${t.nota}`.slice(0, 1000) : 'Transcripción del original.',
      creado_por: null,
    }
    acciones.versiones.push({ id, etiqueta: fila.etiqueta, estado: fila.estado, secciones: fila.contenido.secciones.length, archivo: t.archivo })
    if (!revisar) {
      const { error } = await sgc.from('documento_version').insert(fila)
      if (error) throw new Error(`${t.archivo}: ${error.message}`)
    }
  }
}

// ── 3 · Caracterización: borrador de una versión nueva de cada proceso ──────
const valor = (campo) => {
  const v = campo?.valor
  if (v == null) return null
  if (typeof v === 'string') return /^por definir/i.test(v.trim()) ? null : v
  if (Array.isArray(v)) {
    const xs = v.map((x) => (typeof x === 'string' ? x : x.valor ?? x.nombre ?? x.texto ?? x.actividad ?? JSON.stringify(x))).filter((x) => x && !/^por definir/i.test(x))
    return xs.length ? xs : null
  }
  return String(v)
}
const fuente = (campo) => {
  if (!campo) return undefined
  const f = Array.isArray(campo.fuente) ? campo.fuente.join(' · ') : campo.fuente
  const ev = campo.evidencia ? `${campo.evidencia}` : ''
  const txt = [ev, f].filter(Boolean).join(' — ').replace(/Procesos Iberia\\/g, '')
  return txt ? txt.slice(0, 400) : undefined
}
for (const c of caract.procesos ?? []) {
  const p = procPorCodigo.get(c.codigo)
  if (!p) { console.warn('Caracterización sin proceso:', c.codigo); continue }
  const ficha = { ...(p.ficha ?? {}) }
  const fuentes = {}
  const poner = (clave, campo, transformar = valor) => { const x = transformar(campo); if (x != null) ficha[clave] = x; else delete ficha[clave]; const f = fuente(campo); if (f) fuentes[clave] = f }
  poner('objetivo', c.objetivo); poner('alcance', c.alcance); poner('proveedores', c.proveedores); poner('entradas', c.entradas)
  poner('salidas', c.salidas); poner('clientes', c.clientes); poner('criterios', c.criterios_metodos); poner('recursos', c.recursos)
  poner('responsabilidades', c.responsabilidades_autoridades); poner('riesgos', c.riesgos); poner('oportunidades', c.oportunidades)
  poner('evaluacion', c.evaluacion_mejora); poner('dueno', c.dueno); poner('estado_hoy', c.estado_hoy)
  if (Array.isArray(c.actividades?.valor)) {
    const fases = { planificar: [], hacer: [], verificar: [], actuar: [] }
    for (const a of c.actividades.valor) {
      const k = norm(a.fase ?? '').split(' ')[0]
      ;(fases[k] ?? fases.hacer).push(a.actividad ?? String(a))
    }
    ficha.actividades = fases
    const f = fuente(c.actividades); if (f) fuentes.actividades = f
  }
  if (Array.isArray(c.indicadores?.valor)) {
    const lim = (x) => (x && !/^por definir/i.test(x) ? x : null)
    ficha.indicadores = c.indicadores.valor.map((x) => ({ nombre: x.nombre, formula: lim(x.formula), meta: lim(x.meta), frecuencia: lim(x.frecuencia), fuente: x.nota ?? x.fuente ?? undefined }))
    const f = fuente(c.indicadores); if (f) fuentes.indicadores = f
  }
  if (Array.isArray(c.brechas)) ficha.brechas = c.brechas.map((b) => (typeof b === 'string' ? b : b.valor)).filter(Boolean)
  ficha.fuentes = fuentes
  ficha.origen = { ...(p.ficha?.origen ?? {}), revision: ORIGEN }
  acciones.borradores.push({ codigo: c.codigo, campos: Object.keys(ficha).length })
  if (revisar) continue
  const { data: abierto } = await sgc.from('proceso').select('id').eq('ref', p.ref).is('escenario_id', null).in('estado', ['borrador', 'en_revision']).maybeSingle()
  if (abierto) { console.log(`${c.codigo}: ya tiene un borrador; no se pisa`); continue }
  const { id: _i, vigencia: _v, creado_en: _c, esc: _e, tipo_cat: _t, estado_cat: _ec, ...base } = p
  const { error } = await sgc.from('proceso').insert({ ...base, ficha, estado: 'borrador', version: p.version + 1, creado_por: null, nota: `Caracterización propuesta: ${NOTA}. Por validar con el dueño del proceso.` })
  if (error) throw new Error(`${c.codigo}: ${error.message}`)
}

console.log(JSON.stringify({ altas: acciones.altas.map((a) => `${a.codigo} · ${a.titulo} (${a.estado})`), enlaces: acciones.enlaces.length, versiones: acciones.versiones, borradores: acciones.borradores }, null, 1))
console.log(revisar ? 'Revisión: no se escribió nada.' : 'Listo.')
