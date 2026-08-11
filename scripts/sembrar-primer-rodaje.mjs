/**
 * Deja listo el primer rodaje de entrevistas en Cagua y actualiza el equipo
 * consultor.
 *
 *   node --env-file=.env.local scripts/sembrar-primer-rodaje.mjs [--simular]
 *
 * Las ocho entrevistas se crean en estado "programada" y sin nombre: todavía no
 * se sabe quién ocupa cada cargo. Se identifican por cargo y área, que es lo que
 * hace falta para agendar el viaje; el nombre se completa después.
 *
 * Es idempotente: se puede volver a correr sin duplicar.
 */

import { createClient } from '@supabase/supabase-js'

const SIMULAR = process.argv.includes('--simular')

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY,
  { auth: { persistSession: false } }
)

// -----------------------------------------------------------------------------
// Equipo consultor
// -----------------------------------------------------------------------------

const EQUIPO = [
  { nombre: 'Gabriel Montiel Toro', cargo: 'CEO · Boosty Digital' },
  { nombre: 'Carlos Quintana', cargo: 'Consultor senior en dirigencia y gestión del cambio' },
  { nombre: 'Jesús Planas', cargo: 'Consultor de procesos (Consultores UCAB)' },
  { nombre: 'Ruth Velázquez', cargo: 'Apoyo de entrevistas · consultora' },
  { nombre: 'Amanda Leañez', cargo: 'Líder de proyecto por Boosty' },
]

// Corrección de nombre: en el primer sembrado quedó como "Jesús Plana".
const RENOMBRAR = [{ de: 'Jesús Plana', a: 'Jesús Planas' }]

// -----------------------------------------------------------------------------
// Primer rodaje · 8 entrevistas en la planta de Cagua
//
// El orden sigue el flujo físico del producto —materia prima, producción,
// calidad, despacho— para que la jornada tenga sentido y cada entrevista
// contextualice la siguiente.
// -----------------------------------------------------------------------------

const RODAJE = [
  {
    cargo: 'Gerente de Planta',
    area: 'g-planta',
    foco: 'Programa de producción, las 8 líneas, capacidad instalada y cómo se decide qué se corre cada día.',
  },
  {
    cargo: 'Jefe de Producción',
    area: 'j-produccion',
    foco: 'Ejecución diaria, los ~200 SKU, semielaborados y bases maceradas, paradas de línea y cambios de formato.',
  },
  {
    cargo: 'Jefe de Almacén de Materia Prima',
    area: 'j-almacen-materia-prima',
    foco: 'Recepción de materiales, fumigación, inventario y trazabilidad. Es donde nace físicamente el dato.',
  },
  {
    cargo: 'Jefe de Mantenimiento',
    area: 'j-mantenimiento',
    foco: 'Paradas de máquina, repuestos importados, planes de mantenimiento y el registro de fallas por código de barras que se dejó de usar.',
  },
  {
    cargo: 'Gerente de Calidad',
    area: 'g-calidad',
    foco: 'Normas COVENIN e ISO, liberación de lotes, control sobre maquiladores y permisología.',
  },
  {
    cargo: 'Jefe de Laboratorio',
    area: 'j-laboratorio',
    foco: 'Análisis fisicoquímico, microbiológico y sensorial, tiempos de respuesta y muestras testigo.',
  },
  {
    cargo: 'Jefe de Diseño y Desarrollo',
    area: 'j-diseno-desarrollo',
    foco: 'Fórmulas, especificaciones técnicas y la estructura real de la explosión de materiales multinivel.',
  },
  {
    cargo: 'Gerente de Distribución',
    area: 'g-distribucion',
    foco: 'Despacho, armado de rutas, transportistas terceros y comprobantes de entrega.',
  },
]

// -----------------------------------------------------------------------------

function log(...a) {
  console.log(...a)
}
async function fallar(m) {
  console.error(`\n✖ ${m}\n`)
  process.exit(1)
}

// --- Renombrados -------------------------------------------------------------
for (const { de, a } of RENOMBRAR) {
  const { data } = await admin.from('personas').select('id').ilike('nombre_completo', de).maybeSingle()
  if (data && !SIMULAR) {
    await admin.from('personas').update({ nombre_completo: a }).eq('id', data.id)
    log(`  ~ ${de} → ${a}`)
  }
}

// --- Equipo consultor --------------------------------------------------------
log('\n── Equipo consultor')
const { data: areaBoosty } = await admin
  .from('areas')
  .select('id')
  .eq('slug', 'boosty')
  .maybeSingle()

for (const p of EQUIPO) {
  const fila = {
    nombre_completo: p.nombre,
    cargo: p.cargo,
    area_id: areaBoosty?.id ?? null,
    organizacion: 'boosty',
  }
  if (SIMULAR) {
    log(`  (simulado) ${p.nombre}`)
    continue
  }
  const { data: existente } = await admin
    .from('personas')
    .select('id')
    .ilike('nombre_completo', p.nombre)
    .maybeSingle()

  if (existente) {
    await admin.from('personas').update(fila).eq('id', existente.id)
    log(`  ~ ${p.nombre} · ${p.cargo}`)
  } else {
    const { error } = await admin.from('personas').insert(fila)
    if (error) await fallar(`${p.nombre}: ${error.message}`)
    log(`  + ${p.nombre} · ${p.cargo}`)
  }
}

// --- Entrevistas programadas -------------------------------------------------
log('\n── Primer rodaje · Cagua')

const { data: areas } = await admin.from('areas').select('id, slug')
const areaPorSlug = new Map((areas ?? []).map((a) => [a.slug, a.id]))

const { data: existentes } = await admin
  .from('entrevistas')
  .select('id, codigo, titulo')
  .eq('tipo', 'entrevista')

let n = existentes?.length ?? 0

for (const e of RODAJE) {
  const titulo = `Entrevista · ${e.cargo}`
  const yaEsta = existentes?.find((x) => x.titulo === titulo)

  if (yaEsta) {
    log(`  = ${yaEsta.codigo}  ${e.cargo}`)
    continue
  }

  n++
  const codigo = `ENT-${String(n).padStart(3, '0')}`

  if (SIMULAR) {
    log(`  (simulado) ${codigo}  ${e.cargo}`)
    continue
  }

  const { error } = await admin.from('entrevistas').insert({
    codigo,
    tipo: 'entrevista',
    titulo,
    entrevistado_cargo: e.cargo,
    area_id: areaPorSlug.get(e.area) ?? null,
    sede: 'cagua',
    estado: 'programada',
    entrevistador: 'Gabriel Montiel Toro / Ruth Velázquez',
    notas_consultor: `Foco: ${e.foco}`,
  })

  if (error) await fallar(`${e.cargo}: ${error.message}`)
  log(`  + ${codigo}  ${e.cargo}`)
}

log('\nListo.\n')
