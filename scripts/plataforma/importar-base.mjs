/**
 * Plataforma Iberia · carga inicial de lo que NO sale de las semillas de NDA:
 * el registro de módulos (el plan como dato), las rutas de aprobación de
 * fábrica, los componentes de costo y parámetros (por confirmar), y la matriz
 * de permisos del grupo `sistema` para los roles de fábrica.
 *
 * En el proyecto de PRUEBAS además copia de producción, solo lectura allá, las
 * tablas de referencia que el núcleo enlaza (áreas, mapa de procesos del
 * informe, padrón), con los mismos ids.
 *
 *   node --env-file=.env.local scripts/plataforma/importar-base.mjs            # pruebas
 *   node --env-file=.env.local scripts/plataforma/importar-base.mjs --revisar  # dice qué haría
 *
 * ⚠️ Producción no se toca desde aquí sin `--destino produccion --confirmo`.
 * Es idempotente: vuelve a correr sin duplicar (upsert por clave).
 */
import fs from 'node:fs'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'

const args = process.argv.slice(2)
const REVISAR = args.includes('--revisar')
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
if (!cfg.url || !cfg.clave) throw new Error(`Faltan las variables del proyecto de ${destino}`)
const db = createClient(cfg.url, cfg.clave, { auth: { persistSession: false } })
console.log(`Destino: ${destino} (${new URL(cfg.url).host})`)

// 🔴 El registro público tiene que estar cerrado: el alta toma el rol de los
// metadatos, así que con el registro abierto cualquiera con la clave pública se
// crea una cuenta con el rol que quiera. Pasó en el proyecto de pruebas el 20-nov.
if (env.SUPABASE_ACCESS_TOKEN) {
  const ref = new URL(cfg.url).hostname.split('.')[0]
  const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/config/auth`, { headers: { Authorization: `Bearer ${env.SUPABASE_ACCESS_TOKEN}` } })
  const auth = r.ok ? await r.json() : null
  if (!auth) console.log('  ⚠️ no se pudo comprobar el registro público')
  else if (!auth.disable_signup) { console.error('✖ El registro público está ABIERTO en este proyecto. Ciérralo antes de cargar datos.'); process.exit(1) }
  else console.log('  registro público cerrado ✓')
}

const RAIZ = path.resolve(import.meta.dirname, '..', '..')
const MODULOS_CSV = path.join(RAIZ, 'plataforma', 'plan', 'datos', 'modulos.csv')

async function escribir(esquema, tabla, filas, onConflict) {
  if (!filas.length) return
  if (REVISAR) return console.log(`  [revisar] ${esquema}.${tabla}: ${filas.length} filas`)
  for (let i = 0; i < filas.length; i += 500) {
    const { error } = await db.schema(esquema).from(tabla).upsert(filas.slice(i, i + 500), { onConflict })
    if (error) throw new Error(`${esquema}.${tabla}: ${error.message}`)
  }
  console.log(`  ${esquema}.${tabla}: ${filas.length}`)
}

// ── 1) Tablas de referencia de producción → pruebas ─────────────────────────
if (destino === 'pruebas') {
  const prod = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } })
  async function todo(tabla) {
    const filas = []
    for (let desde = 0; ; desde += 1000) {
      const { data, error } = await prod.from(tabla).select('*').range(desde, desde + 999)
      if (error) throw new Error(`${tabla} (producción): ${error.message}`)
      filas.push(...data)
      if (data.length < 1000) return filas
    }
  }
  console.log('Copiando referencia de producción (solo lectura allá)…')
  const areas = await todo('areas')
  // Las migraciones sembraron sus propias áreas en pruebas, con otros ids y los
  // mismos slugs: se sacan las que producción no tiene, para quedar con los ids
  // de producción (de los que cuelga el padrón).
  if (!REVISAR) {
    const ids = new Set(areas.map((a) => a.id))
    const { data: locales } = await db.from('areas').select('id')
    const sobran = (locales ?? []).map((a) => a.id).filter((id) => !ids.has(id))
    if (sobran.length) {
      await db.from('areas').update({ padre_id: null }).in('id', sobran)
      for (const t of ['empleados', 'personas', 'entrevistas']) await db.from(t).update({ area_id: null }).in('area_id', sobran)
      const { error } = await db.from('areas').delete().in('id', sobran)
      if (error) throw new Error(`areas (limpieza): ${error.message}`)
      console.log(`  areas de las migraciones retiradas: ${sobran.length}`)
    }
  }
  // Dos pasadas: primero sin padre, después el padre (la tabla se apunta a sí misma).
  await escribir('public', 'areas', areas.map((a) => ({ ...a, padre_id: null })), 'id')
  await escribir('public', 'areas', areas, 'id')
  await escribir('public', 'macroprocesos', await todo('macroprocesos'), 'id')
  await escribir('public', 'procesos', await todo('procesos'), 'id')
  const empleados = await todo('empleados')
  // Las cuentas no se copian: en pruebas nadie entra con la cuenta de un cliente.
  await escribir(
    'public',
    'empleados',
    empleados.map(({ busqueda, ...e }) => ({ ...e, perfil_id: null })),
    'id'
  )
}

// ── 2) Registro de módulos: el plan como dato ───────────────────────────────
function leerCsv(texto) {
  const filas = []
  let fila = [], campo = '', comillas = false
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i]
    if (comillas) {
      if (c === '"' && texto[i + 1] === '"') { campo += '"'; i++ }
      else if (c === '"') comillas = false
      else campo += c
    } else if (c === '"') comillas = true
    else if (c === ',') { fila.push(campo); campo = '' }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && texto[i + 1] === '\n') i++
      fila.push(campo); campo = ''
      if (fila.some((x) => x !== '')) filas.push(fila)
      fila = []
    } else campo += c
  }
  if (campo || fila.length) { fila.push(campo); filas.push(fila) }
  const [cab, ...resto] = filas
  return resto.map((f) => Object.fromEntries(cab.map((k, i) => [k, f[i] ?? ''])))
}

// Lo que opera hoy o se construye en la Etapa 1, con su ruta y su recurso.
const EN_ETAPA_1 = {
  'NUC-IDN': ['en_construccion', '/sistema/administracion/usuarios', 'modulo:usuarios'],
  'NUC-ORG': ['en_construccion', '/sistema/nucleo/organizacion', 'sistema:estructura'],
  'NUC-PRO': ['en_construccion', '/sistema/nucleo/procesos', 'sistema:procesos'],
  'NUC-DOC': ['en_construccion', '/sistema/nucleo/documentos', 'sistema:documentos'],
  'NUC-FLU': ['en_construccion', '/sistema/bandeja', null],
  'NUC-AUD': ['en_construccion', '/sistema/administracion/auditoria', 'sistema:auditoria'],
  'NUC-CFG': ['en_construccion', '/sistema/administracion/catalogos', 'sistema:catalogos'],
  'NUC-CAN': ['operando', '/sistema/nucleo/canal', 'modulo:reportes'],
  'NUC-FOR': ['operando', '/sistema/nucleo/formacion', 'modulo:adiestramiento'],
  'PRG-PLN': ['operando', '/sistema/programa', 'modulo:programa'],
  'PRG-LEV': ['operando', '/sistema/programa/levantamiento', 'modulo:entrevistas'],
  'PRG-BIB': ['operando', '/sistema/programa/biblioteca', null],
}

const modulos = leerCsv(fs.readFileSync(MODULOS_CSV, 'utf8')).map((m, i) => {
  const [estado, ruta, recurso] = EN_ETAPA_1[m.codigo] ?? ['planificado', null, null]
  return {
    codigo: m.codigo,
    nombre: m.nombre,
    dominio: m.dominio,
    fase: m.fase || null,
    estado,
    ruta,
    recurso,
    descripcion: m.proposito || null,
    orden: i + 1,
  }
})
console.log('Registro de módulos…')
await escribir('control', 'modulo', modulos, 'codigo')

// ── 3) Parámetros y componentes de costo (por confirmar con Capital Humano) ──
// Fuentes en `plataforma/plan/D-etapa-1-procesos-estructura.md` §6. Todo nace
// «por confirmar»: la convención colectiva vigente no está en el material.
const parametros = [
  { clave: 'salario_minimo_ves', nombre: 'Salario mínimo mensual', valor: 130, unidad: 'VES', vigencia: '[2022-05-01,)', fuente: 'Gaceta Oficial (sin cambio desde may-2022)' },
  { clave: 'ingreso_minimo_integral_usd', nombre: 'Ingreso mínimo integral', valor: 240, unidad: 'USD', vigencia: '[2026-04-30,)', fuente: 'Anuncio del Ejecutivo, 30-abr-2026 (prensa)' },
]
const componentes = [
  { nombre: 'Bono de alimentación (cestaticket)', forma: 'monto_mensual', valor: 40, moneda: 'USD', base: 'ninguna', base_legal: 'Ley del Cestaticket Socialista; monto indexado', orden: 1 },
  { nombre: 'Utilidades', forma: 'dias_anuales', valor: 30, base: 'salario_normal', base_legal: 'LOTTT art. 131 (mínimo 30 días; la convención puede dar más)', orden: 2 },
  { nombre: 'Bono vacacional', forma: 'dias_anuales', valor: 15, base: 'salario_normal', base_legal: 'LOTTT art. 192 (15 días + 1 por año de servicio)', orden: 3 },
  { nombre: 'Prestaciones sociales (garantía)', forma: 'dias_anuales', valor: 60, base: 'salario_integral', base_legal: 'LOTTT art. 142 (15 días por trimestre)', orden: 4 },
  { nombre: 'IVSS · aporte patronal', forma: 'porcentaje', valor: 9, base: 'salario_normal', tope_salarios_minimos: 5, base_legal: 'Ley del Seguro Social (9 %, 10 % u 11 % según riesgo)', orden: 5 },
  { nombre: 'Régimen prestacional de empleo', forma: 'porcentaje', valor: 2, base: 'salario_normal', tope_salarios_minimos: 10, base_legal: 'Ley del Régimen Prestacional de Empleo', orden: 6 },
  { nombre: 'FAOV · aporte patronal', forma: 'porcentaje', valor: 2, base: 'salario_integral', base_legal: 'Ley del Régimen Prestacional de Vivienda y Hábitat', orden: 7 },
  { nombre: 'INCES · aporte patronal', forma: 'porcentaje', valor: 2, base: 'salario_normal', base_legal: 'Ley del INCES (base en discusión: salario normal o nómina total)', orden: 8 },
  { nombre: 'Contribución especial de pensiones', forma: 'porcentaje', valor: 9, base: 'salario_y_bonos', piso_parametro: 'ingreso_minimo_integral_usd', base_legal: 'Ley de Protección de las Pensiones; Decreto 4.952 (9 %)', orden: 9 },
].map((c) => ({ ...c, por_confirmar: true, vigencia: '[2026-01-01,)' }))

console.log('Parámetros y componentes de costo…')
if (!REVISAR) {
  // Sin clave natural: se cargan solo si la tabla está vacía.
  // Por clave: otras migraciones siembran parámetros propios (topes de la IA).
  for (const p of parametros) {
    const { data: ya } = await db.schema('control').from('parametro').select('id').eq('clave', p.clave).maybeSingle()
    if (!ya) await escribir('control', 'parametro', [{ ...p, por_confirmar: true }], 'id')
  }
  const { count: nc } = await db.schema('org').from('componente_costo').select('id', { count: 'exact', head: true })
  if (!nc) await escribir('org', 'componente_costo', componentes, 'id')
}

// ── 4) Matriz del grupo `sistema` para los roles de fábrica ─────────────────
// El administrador lo puede todo sin matriz. El consultor (Boosty) trabaja en
// todo menos costos; el lector de Iberia ve estructura, procesos y documentos;
// el usuario de Iberia ve eso y pide requisiciones. Costos y perímetros se
// marcan a mano, rol por rol.
const T = { ver: true, crear: true, editar: true, eliminar: true }
const V = { ver: true, crear: false, editar: false, eliminar: false }
const MATRIZ = {
  consultor: {
    'sistema:inicio': V, 'sistema:estructura': T, 'sistema:escenarios': T, 'sistema:procesos': T,
    'sistema:documentos': { ...V, editar: true }, 'sistema:dotacion': { ...V, editar: true },
    'sistema:requisiciones': { ...V, crear: true, editar: true }, 'sistema:aprobaciones': { ...V, editar: true },
    'sistema:catalogos': { ...V, crear: true, editar: true }, 'sistema:auditoria': V, 'sistema:tasas': V,
  },
  lector: { 'sistema:inicio': V, 'sistema:estructura': V, 'sistema:procesos': V, 'sistema:documentos': V, 'sistema:dotacion': V, 'sistema:tasas': V },
  'usuario-iberia': {
    'sistema:inicio': V, 'sistema:estructura': V, 'sistema:procesos': V, 'sistema:documentos': V,
    'sistema:requisiciones': { ...V, ver: false, crear: true }, 'sistema:tasas': V,
  },
}
console.log('Matriz del grupo sistema…')
const { data: roles, error: errRoles } = await db.from('roles').select('id, clave')
if (errRoles) throw errRoles
const filasMatriz = []
for (const r of roles) {
  for (const [recurso, p] of Object.entries(MATRIZ[r.clave] ?? {})) filasMatriz.push({ rol_id: r.id, recurso, ...p })
}
await escribir('public', 'rol_permisos', filasMatriz, 'rol_id,recurso')

console.log(REVISAR ? 'Revisión terminada: nada se escribió.' : 'Listo.')
