/**
 * Agenda el primer rodaje: añade Compras, fija la fecha y reparte las nueve
 * entrevistas entre las dos pistas.
 *
 *   node --env-file=.env.local scripts/agendar-primer-rodaje.mjs
 *
 * Idempotente.
 */

import { createClient } from '@supabase/supabase-js'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY,
  { auth: { persistSession: false } }
)

const FECHA = '2026-08-18'

// Pista A recorre la cadena que define la arquitectura: demanda, plan,
// explosión de materiales, cobertura y despacho.
// Pista B recorre las funciones de control y soporte, donde nace y se valida
// el dato.
const PISTAS = {
  'Gerente de Planta': 'Gabriel Montiel Toro',
  'Jefe de Producción': 'Gabriel Montiel Toro',
  'Gerente de Compras': 'Gabriel Montiel Toro',
  'Jefe de Diseño y Desarrollo': 'Gabriel Montiel Toro',
  'Gerente de Distribución': 'Gabriel Montiel Toro',
  'Jefe de Almacén de Materia Prima': 'Ruth Velázquez',
  'Jefe de Mantenimiento': 'Ruth Velázquez',
  'Jefe de Laboratorio': 'Ruth Velázquez',
  'Gerente de Calidad': 'Ruth Velázquez',
}

const COMPRAS = {
  cargo: 'Gerente de Compras',
  area: 'g-compras',
  foco:
    'Cobertura de materiales, proveedores, tiempos de reposición y puntos de quiebre. ' +
    'Es la contraparte del programa de producción: hoy la cobertura vive en un archivo aparte.',
}

// --- Compras ------------------------------------------------------------------
const { data: areas } = await admin.from('areas').select('id, slug')
const areaId = areas?.find((a) => a.slug === COMPRAS.area)?.id ?? null

const { data: existentes } = await admin
  .from('entrevistas')
  .select('id, codigo, titulo, entrevistado_cargo')
  .eq('tipo', 'entrevista')

const tituloCompras = `Entrevista · ${COMPRAS.cargo}`

if (!existentes?.some((e) => e.titulo === tituloCompras)) {
  const codigo = `ENT-${String((existentes?.length ?? 0) + 1).padStart(3, '0')}`
  const { error } = await admin.from('entrevistas').insert({
    codigo,
    tipo: 'entrevista',
    titulo: tituloCompras,
    entrevistado_cargo: COMPRAS.cargo,
    area_id: areaId,
    sede: 'cagua',
    estado: 'programada',
    notas_consultor: `Foco: ${COMPRAS.foco}`,
  })
  if (error) {
    console.error(`\n✖ ${error.message}\n`)
    process.exit(1)
  }
  console.log(`  + ${codigo}  ${COMPRAS.cargo}`)
}

// --- Fecha y pistas -----------------------------------------------------------
const { data: rodaje } = await admin
  .from('entrevistas')
  .select('id, codigo, entrevistado_cargo')
  .eq('tipo', 'entrevista')
  .order('codigo')

console.log('\n── Agenda del martes 18 de agosto de 2026\n')

for (const e of rodaje ?? []) {
  const entrevistador = PISTAS[e.entrevistado_cargo ?? '']
  if (!entrevistador) {
    console.log(`  ! ${e.codigo} ${e.entrevistado_cargo}: sin pista asignada`)
    continue
  }

  const { error } = await admin
    .from('entrevistas')
    .update({ fecha_entrevista: FECHA, entrevistador, duracion_minutos: 50 })
    .eq('id', e.id)

  if (error) {
    console.error(`\n✖ ${e.codigo}: ${error.message}\n`)
    process.exit(1)
  }

  const pista = entrevistador === 'Ruth Velázquez' ? 'B' : 'A'
  console.log(
    `  ${e.codigo}  pista ${pista}  ${(e.entrevistado_cargo ?? '').padEnd(34)} ${entrevistador}`
  )
}

console.log('\nListo.\n')
