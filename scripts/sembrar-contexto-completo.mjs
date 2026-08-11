/**
 * Alinea el registro de personas con el documento de contexto del proyecto.
 *
 *   node --env-file=.env.local scripts/sembrar-contexto-completo.mjs
 *
 * Fireflies transcribió mal varios apellidos y así quedaron sembrados. El
 * documento de contexto es la fuente autorizada, así que manda sobre lo que se
 * dedujo de la transcripción.
 *
 * Idempotente.
 */

import { createClient } from '@supabase/supabase-js'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY,
  { auth: { persistSession: false } }
)

// --- Correcciones de nombre ---------------------------------------------------
// Izquierda: lo que oyó Fireflies. Derecha: lo correcto.
const CORRECCIONES = [
  ['Flaviano Fuchi', 'Flaviano Tucci'],
  ['Gustavo Carvallo', 'Gustavo Carballo'],
  ['Marta Fuentes', 'Martha Fuentes'],
]

// --- Notas de manejo ----------------------------------------------------------
// Salen del documento de contexto. Importan para preparar cada entrevista.
const NOTAS = {
  'Alberto García-Ramos':
    'Nombre completo: Alberto García-Ramos Cortiñas · C.I. 6.912.626 · 16 años en la empresa · apoderado. ' +
    'Sponsor del proyecto. Directo, se tutea. Piensa en metáforas. Le preocupa el vacío comunicacional.',
  'Flaviano Tucci':
    '35 años en la empresa. Temperamento fuerte y sensible al reconocimiento: conviene hacerlo protagonista ' +
    'de cualquier demostración de producción.',
  'Dora Luciche':
    'Firma los cheques y es la primera en objetar costos. Copiada en la correspondencia contractual.',
  'Martha Fuentes':
    'Coordinadora del proyecto designada por la Gerencia General. Sensible por el antecedente de ransomware: ' +
    'posicionarla como socia de gobernanza, nunca como obstáculo.',
  'Milagro Salas': 'Viene de Unilever. Orientada a resultados.',
  'Luis Daniel Agostini':
    'Líder del proyecto junto con Martha Fuentes. Apoyo de coordinación e implementación desde Caracas.',
}

// --- Personas que faltaban ----------------------------------------------------
const NUEVAS = [
  {
    nombre: 'Vasco',
    cargo: 'Accionista mayoritario',
    area: 'direccion-general',
    org: 'iberia',
    notas: 'Dueño. Portugués. Afín a la tecnología.',
  },
  {
    nombre: 'Martha E. Álvarez',
    cargo: 'Frente comunicacional',
    area: 'j-comunicaciones',
    org: 'iberia',
    notas:
      'Aparece en la coordinación comunicacional. Por verificar si es la Gerencia de Mercadeo. ' +
      'No confundir con Martha Fuentes: hay dos Marthas en el proyecto.',
  },
  {
    nombre: 'Luisa Elena Montiel Toro',
    cargo: 'Representante legal · Boosty Digital',
    area: 'boosty',
    org: 'boosty',
    notas: 'Firmó el contrato CONT-2026-07-0005.',
  },
  {
    nombre: 'Amado Fuguet',
    cargo: 'Fuguet Comunicación y Cambio · consultoría de comunicaciones',
    area: null,
    org: 'externo',
    notas: 'Consultoría de comunicaciones de Iberia. Aportó el marco de tres bloques de mensaje.',
  },
  {
    nombre: 'Marcela Ojeda',
    cargo: 'Consultora senior · Fuguet Comunicación y Cambio',
    area: null,
    org: 'externo',
    notas: 'Redactó el Q&A del proyecto.',
  },
  {
    nombre: 'Simón Guevara Camacho',
    cargo: 'Abogado · Travieso Evans Arria & Rengel',
    area: null,
    org: 'externo',
    notas: 'Revisión legal del contrato por parte de Iberia.',
  },
]

// -----------------------------------------------------------------------------

console.log('\n── Correcciones de nombre')

for (const [viejo, nuevo] of CORRECCIONES) {
  const { data: persona } = await admin
    .from('personas')
    .select('id')
    .ilike('nombre_completo', viejo)
    .maybeSingle()

  if (!persona) {
    console.log(`  = ${nuevo} (ya corregido)`)
    continue
  }

  await admin.from('personas').update({ nombre_completo: nuevo }).eq('id', persona.id)

  // La transcripción ya renombrada también arrastra el apellido equivocado.
  const { data: turnos } = await admin
    .from('transcripcion_segmentos')
    .select('id')
    .eq('hablante', viejo)

  for (let i = 0; i < (turnos?.length ?? 0); i += 500) {
    const lote = turnos.slice(i, i + 500).map((t) => t.id)
    await admin.from('transcripcion_segmentos').update({ hablante: nuevo }).in('id', lote)
  }

  const { data: sesiones } = await admin
    .from('entrevistas')
    .select('id, entrevistador')
    .ilike('entrevistador', `%${viejo}%`)
  for (const s of sesiones ?? []) {
    await admin
      .from('entrevistas')
      .update({ entrevistador: s.entrevistador.replaceAll(viejo, nuevo) })
      .eq('id', s.id)
  }

  console.log(`  ~ ${viejo} → ${nuevo}  (${turnos?.length ?? 0} turnos)`)
}

// --- Notas --------------------------------------------------------------------
console.log('\n── Notas de manejo')
for (const [nombre, notas] of Object.entries(NOTAS)) {
  const { data } = await admin
    .from('personas')
    .select('id')
    .ilike('nombre_completo', nombre)
    .maybeSingle()
  if (!data) {
    console.log(`  ! ${nombre} no existe`)
    continue
  }
  await admin.from('personas').update({ notas }).eq('id', data.id)
  console.log(`  ~ ${nombre}`)
}

// --- Personas nuevas ----------------------------------------------------------
console.log('\n── Personas añadidas')
const { data: areas } = await admin.from('areas').select('id, slug')
const areaPorSlug = new Map((areas ?? []).map((a) => [a.slug, a.id]))

for (const p of NUEVAS) {
  const { data: existente } = await admin
    .from('personas')
    .select('id')
    .ilike('nombre_completo', p.nombre)
    .maybeSingle()

  const fila = {
    nombre_completo: p.nombre,
    cargo: p.cargo,
    area_id: p.area ? (areaPorSlug.get(p.area) ?? null) : null,
    organizacion: p.org,
    notas: p.notas,
  }

  if (existente) {
    await admin.from('personas').update(fila).eq('id', existente.id)
    console.log(`  ~ ${p.nombre}`)
  } else {
    const { error } = await admin.from('personas').insert(fila)
    if (error) {
      console.error(`\n✖ ${p.nombre}: ${error.message}\n`)
      process.exit(1)
    }
    console.log(`  + ${p.nombre}`)
  }
}

console.log('\nListo.\n')
