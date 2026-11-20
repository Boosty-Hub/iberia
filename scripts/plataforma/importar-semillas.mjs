/**
 * Plataforma Iberia · importación inicial de las semillas (estructura,
 * procesos, documentos) y de las rutas de aprobación de fábrica.
 *
 * Las semillas viven en `plataforma/semillas/*.json`, fuera de git (NDA): las
 * prepararon agentes leyendo el levantamiento ISO, los organigramas, el padrón
 * y el inventario del informe. **No es «el taller pisa la base»**: es una
 * importación única con versión. Después de importar, lo editable se edita en
 * la plataforma. Volver a correr solo agrega lo que falte (ids deterministas,
 * `ignoreDuplicates`); nunca pisa lo que se corrigió en el sistema.
 *
 *   node --env-file=.env.local scripts/plataforma/importar-semillas.mjs [--solo estructura|procesos|documentos|rutas]
 *   … --revisar      # dice qué haría, sin escribir
 *
 * ⚠️ Producción pide `--destino produccion --confirmo`.
 */
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

const args = process.argv.slice(2)
const REVISAR = args.includes('--revisar')
const SOLO = args.includes('--solo') ? args[args.indexOf('--solo') + 1] : null
const destino = args.includes('--destino') ? args[args.indexOf('--destino') + 1] : 'pruebas'
if (destino === 'produccion' && !args.includes('--confirmo')) {
  console.error('Producción pide --confirmo.')
  process.exit(1)
}
const env = process.env
const cfg =
  destino === 'produccion'
    ? { url: env.NEXT_PUBLIC_SUPABASE_URL, clave: env.SUPABASE_SECRET_KEY }
    : { url: env.SUPABASE_PRUEBAS_URL, clave: env.SUPABASE_PRUEBAS_SECRET_KEY }
const db = createClient(cfg.url, cfg.clave, { auth: { persistSession: false } })
console.log(`Destino: ${destino} (${new URL(cfg.url).host})`)

const SEMILLAS = path.resolve(import.meta.dirname, '..', '..', 'plataforma', 'semillas')
const leer = (n) => JSON.parse(fs.readFileSync(path.join(SEMILLAS, n), 'utf8'))
const existe = (n) => fs.existsSync(path.join(SEMILLAS, n))

/** UUID determinista: la misma clave da siempre el mismo id, así re-correr no duplica. */
function uid(...partes) {
  const h = crypto.createHash('sha1').update(partes.join('|')).digest('hex')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`
}

const INICIO = '2026-01-01' // la estructura se carga como vigente desde el inicio del año

async function insertar(esquema, tabla, filas, onConflict = 'id') {
  if (!filas.length) return
  if (REVISAR) return console.log(`  [revisar] ${esquema}.${tabla}: ${filas.length}`)
  for (let i = 0; i < filas.length; i += 400) {
    const { error } = await db.schema(esquema).from(tabla).upsert(filas.slice(i, i + 400), { onConflict, ignoreDuplicates: true })
    if (error) throw new Error(`${esquema}.${tabla}: ${error.message}`)
  }
  console.log(`  ${esquema}.${tabla}: ${filas.length}`)
}

const pendientes = [] // → control.conciliacion

// ── Estructura ──────────────────────────────────────────────────────────────
if (!SOLO || SOLO === 'estructura') {
  console.log('Estructura…')
  const e = leer('estructura.json')
  const sede = (s) => (s ? String(s).toLowerCase().replace('caracas', 'caracas').trim() : null)
  const refUnidad = (clave) => uid('unidad', clave)
  const unidades = e.unidades.map((u, i) => ({
    id: uid('unidad-fila', u.clave, INICIO),
    ref: refUnidad(u.clave),
    clave: u.clave,
    nombre: u.nombre,
    tipo: u.tipo,
    padre_ref: u.padre ? refUnidad(u.padre) : null,
    codigo_organigrama: u.codigo_organigrama,
    sede: ['caracas', 'cagua'].includes(sede(u.sede)) ? sede(u.sede) : null,
    area_id: u.area_actual || null,
    orden: i,
    vigencia: `[${INICIO},)`,
    fuente: u.fuente,
    certeza: u.certeza === 'inferencia' ? 'inferencia' : 'hecho',
    nota: u.nota || null,
  }))
  const cargos = e.cargos.map((c) => ({
    id: uid('cargo', c.clave),
    clave: c.clave,
    nombre: c.nombre,
    familia: c.familia || null,
    sinonimos: c.sinonimos ?? [],
  }))
  const idCargo = Object.fromEntries(cargos.map((c) => [c.clave, c.id]))
  const refPlaza = (unidad, cargo) => uid('plaza', unidad, cargo)
  const plazaPorCargo = {}
  for (const p of e.plazas) (plazaPorCargo[p.cargo] ??= []).push(p)
  const NOMINAS = new Set(['diaria', 'mensual', 'rotativa', 'confidencial', 'ventas'])
  const plazas = e.plazas.map((p) => {
    // A quién reporta: la plaza de ese cargo en esa unidad, o la única de ese cargo.
    let reporta = null
    if (p.reporta_a_cargo) {
      const misma = e.plazas.find((q) => q.cargo === p.reporta_a_cargo && q.unidad === p.reporta_a_unidad)
      const unica = (plazaPorCargo[p.reporta_a_cargo] ?? []).length === 1 ? plazaPorCargo[p.reporta_a_cargo][0] : null
      const q = misma ?? unica
      if (q) reporta = refPlaza(q.unidad, q.cargo)
    }
    return {
      id: uid('plaza-fila', p.unidad, p.cargo, INICIO),
      ref: refPlaza(p.unidad, p.cargo),
      unidad_ref: refUnidad(p.unidad),
      cargo_id: idCargo[p.cargo],
      reporta_a_ref: reporta,
      dotacion: p.dotacion ?? 1,
      tipo_nomina: NOMINAS.has(p.tipo_nomina) ? p.tipo_nomina : null,
      estado: 'aprobada',
      vigencia: `[${INICIO},)`,
      fuente: p.fuente,
      certeza: p.certeza === 'inferencia' ? 'inferencia' : 'hecho',
      nota: p.dotacion == null ? 'El organigrama trae la caja sin dotación: se cargó 1.' : null,
    }
  })
  for (const p of e.plazas.filter((x) => x.dotacion == null))
    pendientes.push({ modulo: 'NUC-ORG', tipo: 'faltante', descripcion: `Plaza sin dotación en el organigrama: ${p.cargo} en ${p.unidad} (se cargó 1)`, objeto: `${p.unidad}/${p.cargo}`, fuente: p.fuente, responsable: 'Jefe de Desarrollo Organizacional' })

  // Ocupaciones: por ficha del padrón. Lo que pasa de la dotación se marca.
  const { data: emp, error } = await db.from('empleados').select('id, ficha, nombre_completo')
  if (error) throw error
  const porFicha = Object.fromEntries(emp.filter((x) => x.ficha).map((x) => [String(x.ficha), x.id]))
  const dot = Object.fromEntries(plazas.map((p) => [p.ref, p.dotacion]))
  const cuenta = {}
  const ocupaciones = []
  for (const o of e.ocupaciones) {
    if (!o.plaza || !o.ficha || !porFicha[String(o.ficha)]) {
      if (o.certeza === 'sin_casar' && !String(o.motivo ?? '').startsWith('muestra'))
        pendientes.push({ modulo: 'NUC-ORG', tipo: 'sin_casar', descripcion: `${o.nombre} (${o.cargo_nomina}) no casa con ninguna plaza`, objeto: String(o.ficha ?? ''), fuente: o.motivo, responsable: 'Jefe de Desarrollo Organizacional' })
      continue
    }
    const ref = refPlaza(o.plaza.unidad, o.plaza.cargo)
    cuenta[ref] = (cuenta[ref] ?? 0) + 1
    ocupaciones.push({
      id: uid('ocupacion', o.ficha, ref),
      plaza_ref: ref,
      empleado_id: porFicha[String(o.ficha)],
      tipo: 'titular',
      vigencia: `[${INICIO},)`,
      motivo: 'Carga inicial desde el padrón',
      certeza: o.certeza === 'exacta' ? 'exacta' : 'por_nombre_de_cargo',
      excede_dotacion: cuenta[ref] > (dot[ref] ?? 1),
    })
  }
  for (const [ref, n] of Object.entries(cuenta)) if (n > (dot[ref] ?? 1)) {
    const p = plazas.find((x) => x.ref === ref)
    pendientes.push({ modulo: 'NUC-ORG', tipo: 'contradiccion', descripcion: `Más ocupantes que dotación: ${n} para ${p.dotacion} (${e.plazas.find((x) => refPlaza(x.unidad, x.cargo) === ref)?.cargo})`, objeto: ref, fuente: p.fuente, responsable: 'Director de Capital Humano' })
  }
  for (const c of e.contradicciones) pendientes.push({ modulo: 'NUC-ORG', tipo: 'contradiccion', descripcion: c, responsable: 'Director de Capital Humano' })
  for (const f of e.faltantes) pendientes.push({ modulo: 'NUC-ORG', tipo: 'faltante', descripcion: f, responsable: 'Director de Capital Humano' })
  const inferidas = unidades.filter((u) => u.certeza === 'inferencia').length + plazas.filter((p) => p.certeza === 'inferencia').length
  pendientes.push({ modulo: 'NUC-ORG', tipo: 'inferencia', descripcion: `${inferidas} unidades y plazas se cargaron por inferencia (líneas de reporte que el PDF no trae): validar con Capital Humano`, responsable: 'Director de Capital Humano' })

  await insertar('org', 'cargo', cargos)
  await insertar('org', 'unidad', unidades)
  await insertar('org', 'plaza', plazas)
  await insertar('org', 'ocupacion', ocupaciones)
  console.log(`  por encima de la dotación: ${ocupaciones.filter((o) => o.excede_dotacion).length}`)
}

// ── Procesos ────────────────────────────────────────────────────────────────
if (!SOLO || SOLO === 'procesos') {
  console.log('Procesos…')
  const p = leer('procesos.json')
  const refProceso = (clave) => uid('proceso', clave)
  const ESTADOS = new Set(['vigente', 'nuevo', 'no_se_ejecuta', 'sin_evidencia', 'propuesto'])
  // Dueño: la plaza cuyo cargo se llama como dice la fuente (si hay una sola).
  const { data: cargos } = await db.schema('org').from('cargo').select('id, nombre, sinonimos')
  const { data: plazas } = await db.schema('org').from('plaza').select('ref, cargo_id').is('escenario_id', null)
  const norm = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
  const plazaDe = (texto) => {
    if (!texto) return null
    const c = (cargos ?? []).filter((x) => norm(x.nombre) === norm(texto) || (x.sinonimos ?? []).some((s) => norm(s) === norm(texto)))
    if (c.length !== 1) return null
    const ps = (plazas ?? []).filter((x) => x.cargo_id === c[0].id)
    return ps.length === 1 ? ps[0].ref : null
  }
  let fichas = {}
  if (existe('fichas_phva.json')) {
    for (const f of leer('fichas_phva.json').fichas) {
      if (f.calidad_texto === 'ilegible') continue
      const prev = fichas[f.proceso_clave]
      if (!prev || (f.anio ?? 0) > (prev.anio ?? 0)) fichas[f.proceso_clave] = f
    }
  }
  const nodos = p.nodos.map((n, i) => {
    const f = fichas[n.clave]
    return {
      id: uid('proceso-fila', n.clave, 1),
      ref: refProceso(n.clave),
      clave: n.clave.slice(0, 60).replace(/-+$/, ''),
      nivel: n.nivel,
      padre_ref: n.padre ? refProceso(n.padre) : null,
      orden: i,
      nombre: n.nombre,
      tipo: n.tipo,
      codigo_sgc: n.codigo_sgc,
      generacion: n.generacion_codigo,
      codigo_informe: n.codigo_informe,
      estado_operativo: ESTADOS.has(n.estado) ? n.estado : 'vigente',
      dueno_plaza_ref: plazaDe(n.dueno_cargo),
      dueno_texto: n.dueno_cargo,
      area_texto: n.area,
      ficha: f
        ? {
            origen: { codigo: f.codigo, anio: f.anio, archivo: f.archivo, calidad: f.calidad_texto },
            objetivo: f.objetivo, alcance: f.alcance, proveedores: f.proveedores, entradas: f.entradas,
            actividades: f.actividades, salidas: f.salidas, clientes: f.clientes, recursos: f.recursos,
            documentos: f.documentos, registros: f.registros, indicadores: f.indicadores,
            requisitos: f.requisitos, riesgos: f.riesgos, oportunidades: [],
          }
        : {},
      estado: 'vigente',
      version: 1,
      vigencia: `[${INICIO},)`,
      fuente: n.fuente ?? [],
      nota: n.nota,
    }
  })
  const porClave = Object.fromEntries(p.nodos.map((n) => [n.clave, n]))
  // Cruces con el inventario del informe (public.procesos / macroprocesos).
  const { data: macros } = await db.from('macroprocesos').select('id, nivel, numero')
  const { data: procs } = await db.from('procesos').select('id, macroproceso_id, orden')
  const idMacro = Object.fromEntries((macros ?? []).map((m) => [`${m.nivel}-${m.numero}`, m.id]))
  const nodoPorCodigo = Object.fromEntries(p.nodos.filter((n) => n.codigo_sgc).map((n) => [n.codigo_sgc, n.clave]))
  const cruces = p.cruces.map((c, i) => {
    const macro = idMacro[c.informe_macro_numero] ?? null
    const proc = macro && c.informe_proceso_orden ? (procs ?? []).find((x) => x.macroproceso_id === macro && x.orden === c.informe_proceso_orden)?.id : null
    const clave = c.sgc ? nodoPorCodigo[c.sgc] : null
    return {
      id: uid('cruce', i, c.sgc ?? '', c.informe_macro_numero ?? ''),
      proceso_ref: clave ? refProceso(clave) : refProceso(Object.keys(porClave)[0]),
      codigo_sgc: c.sgc,
      informe_proceso_id: proc ?? null,
      informe_macro_id: macro,
      tipo: c.tipo,
      nota: c.nota,
    }
  }).filter((c) => c.codigo_sgc)
  for (const q of p.pendientes_iberia) pendientes.push({ modulo: 'NUC-PRO', tipo: 'decision', descripcion: q, responsable: 'Gerente de Calidad y Desarrollo' })
  const sinDueno = nodos.filter((n) => n.nivel <= 1 && n.dueno_texto && !n.dueno_plaza_ref).length
  if (sinDueno) pendientes.push({ modulo: 'NUC-PRO', tipo: 'sin_casar', descripcion: `${sinDueno} procesos traen dueño en texto que no casa con una sola plaza: asignarlo en la ficha`, responsable: 'Gerente de Calidad y Desarrollo' })
  await insertar('sgc', 'proceso', nodos)
  await insertar('sgc', 'proceso_cruce', cruces)
}

// ── Documentos ──────────────────────────────────────────────────────────────
if ((!SOLO || SOLO === 'documentos') && existe('documentos.json')) {
  console.log('Documentos…')
  const d = leer('documentos.json')
  const { data: procs } = await db.schema('sgc').from('proceso').select('ref, codigo_sgc, nivel').is('escenario_id', null).eq('estado', 'vigente')
  const porXX = {}
  for (const x of procs ?? []) if (x.codigo_sgc && /^II-\d{2}$/.test(x.codigo_sgc)) porXX[x.codigo_sgc.slice(3)] = x.ref
  const PERIM = new Set(['general', 'nomina', 'medico', 'pcp', 'formulas'])
  const DEST = new Set(['formulario', 'funcion', 'vista_espejo', 'no_migra'])
  const ESTADO = new Set(['vigente', 'obsoleto', 'borrador', 'sin_determinar', 'retirado'])
  const vistos = new Set()
  const docs = []
  for (const x of d.documentos) {
    x.titulo = (x.titulo ?? '').trim() || '(sin título en el listado)'
    const k = `${x.codigo}|${x.titulo}`
    if (vistos.has(k)) continue
    vistos.add(k)
    const fecha = /^\d{4}-\d{2}-\d{2}$/.test(x.fecha ?? '') ? x.fecha : null
    docs.push({
      id: uid('documento', x.codigo, x.titulo),
      codigo: x.codigo,
      titulo: x.titulo,
      proceso_xx: x.proceso_xx,
      tipo_yy: x.tipo_yy,
      proceso_ref: porXX[x.proceso_xx] ?? null,
      version: x.version,
      fecha,
      estado: ESTADO.has(x.estado) ? x.estado : 'sin_determinar',
      evidencia_estado: x.evidencia_estado,
      perimetro: PERIM.has(x.perimetro) ? x.perimetro : 'general',
      datos_sensibles: Boolean(x.contiene_datos_personales_o_credenciales),
      familia: x.familia,
      destino: DEST.has(x.destino) ? x.destino : null,
      alias: x.alias ?? [],
      archivos: (x.archivos ?? []).slice(0, 5),
      nota: x.nota,
    })
  }
  if (d.tipos) {
    await insertar('sgc', 'tipo_documento', d.tipos.filter((t) => t.yy && t.generacion).map((t) => ({ yy: String(t.yy), generacion: String(t.generacion), nombre: t.nombre, nivel: t.nivel ?? null })), 'yy,generacion')
  }
  const sensibles = docs.filter((x) => x.datos_sensibles).length
  if (sensibles) pendientes.push({ modulo: 'NUC-DOC', tipo: 'decision', descripcion: `${sensibles} documentos marcados con datos personales o credenciales: sanear antes de publicarlos; las credenciales se reportan a TI para rotarlas`, responsable: 'Coordinador del SGC' })
  await insertar('sgc', 'documento', docs, 'codigo,titulo')
}

// ── Rutas de aprobación de fábrica ──────────────────────────────────────────
if (!SOLO || SOLO === 'rutas') {
  console.log('Rutas de aprobación…')
  const { data: cargos } = await db.schema('org').from('cargo').select('id, clave')
  const c = Object.fromEntries((cargos ?? []).map((x) => [x.clave, x.id]))
  const rutas = [
    {
      id: uid('ruta', 'requisicion_personal'),
      tipo_objeto: 'requisicion_personal',
      nombre: 'Requisición de personal (II-21-40-001)',
      descripcion: 'La del formato rev 2 de 2024: autoriza el director, aprueba el Gerente General, recibe Recursos Humanos, Desarrollo Organizacional registra candidato e ingreso y cierra el Gerente de RRHH. Finanzas entra solo si es cargo nuevo o fuera del plan (propuesta).',
      pasos: [
        { nombre: 'Director de la unidad · autoriza', resolutor: 'director_unidad' },
        { nombre: 'Finanzas · revisa el costo', resolutor: 'cargo', cargo: 'director-finanzas', ve_costos: true, condicion: { origen: ['cargo_nuevo'] } },
        { nombre: 'Gerente General · aprueba', resolutor: 'cargo', cargo: 'gerente-general', ve_costos: true, hito: true },
        { nombre: 'Recursos Humanos · recibe', resolutor: 'cargo', cargo: 'gerente-recursos-humanos', accion: 'recibir', ve_costos: true },
        { nombre: 'Desarrollo Organizacional · candidato e ingreso', resolutor: 'cargo', cargo: 'jefe-desarrollo-organizacional', accion: 'completar' },
      ],
    },
    {
      id: uid('ruta', 'proceso'),
      tipo_objeto: 'proceso',
      nombre: 'Ficha de proceso',
      descripcion: 'Revisa el SGC y aprueba la Gerencia de Calidad y Desarrollo (comité de validación de procesos de New Iberia).',
      pasos: [
        { nombre: 'Coordinación del SGC · revisa', resolutor: 'cargo', cargo: 'coordinador-sgc' },
        { nombre: 'Gerente de Calidad y Desarrollo · aprueba', resolutor: 'cargo', cargo: 'gerente-calidad-desarrollo', hito: true },
      ],
    },
    {
      id: uid('ruta', 'escenario_estructura'),
      tipo_objeto: 'escenario_estructura',
      nombre: 'Escenario de estructura',
      descripcion: 'Doble aprobación (configuración sensible): el Director de Capital Humano y el Gerente General.',
      pasos: [
        { nombre: 'Director de Capital Humano · revisa', resolutor: 'cargo', cargo: 'director-capital-humano' },
        { nombre: 'Gerente General · aprueba', resolutor: 'cargo', cargo: 'gerente-general', hito: true },
      ],
    },
  ]
  for (const r of rutas) {
    await insertar('flujo', 'ruta', [{ id: r.id, tipo_objeto: r.tipo_objeto, nombre: r.nombre, descripcion: r.descripcion, vigencia: '[2026-01-01,)' }])
    await insertar(
      'flujo',
      'ruta_paso',
      r.pasos.map((p, i) => ({
        id: uid('ruta-paso', r.tipo_objeto, i),
        ruta_id: r.id,
        orden: i + 1,
        nombre: p.nombre,
        resolutor: p.resolutor,
        cargo_id: p.cargo ? (c[p.cargo] ?? null) : null,
        accion: p.accion ?? 'aprobar',
        condicion: p.condicion ?? null,
        ve_costos: Boolean(p.ve_costos),
        hito: Boolean(p.hito),
      }))
    )
    const faltan = r.pasos.filter((p) => p.cargo && !c[p.cargo]).map((p) => p.cargo)
    if (faltan.length) console.log(`  ⚠️ ${r.tipo_objeto}: cargos que no están en el catálogo: ${faltan.join(', ')}`)
  }
}

// ── Conciliación ────────────────────────────────────────────────────────────
if (pendientes.length) {
  console.log('Conciliación…')
  await insertar('control', 'conciliacion', pendientes.map((x) => ({ ...x, descripcion: String(x.descripcion).slice(0, 2000) })), 'modulo,tipo,descripcion')
}
console.log(REVISAR ? 'Revisión terminada: nada se escribió.' : 'Listo.')
