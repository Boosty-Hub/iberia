/**
 * Siembra las personas del programa, reclasifica las sesiones ya cargadas y
 * pone nombre a los hablantes de las transcripciones.
 *
 *   node --env-file=.env.local scripts/sembrar-contexto.mjs [--simular]
 *
 * Los mapeos hablante → persona solo incluyen los que se pueden PROBAR con
 * evidencia textual de la propia transcripción (alguien se presenta con su
 * nombre y cargo, o le hablan por su nombre). Los dudosos se dejan sin asignar
 * a propósito: una atribución errónea en el informe es peor que ninguna.
 *
 * Es idempotente: se puede volver a correr sin duplicar nada.
 */

import { createClient } from '@supabase/supabase-js'

const SIMULAR = process.argv.includes('--simular')

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY,
  { auth: { persistSession: false } }
)

// -----------------------------------------------------------------------------
// Personas
// -----------------------------------------------------------------------------

const PERSONAS = [
  // Iberia · dirección
  { nombre: 'Alberto García-Ramos', cargo: 'Director Gerente General', area: 'direccion-general', sede: 'caracas' },
  { nombre: 'Antonio Sorrentino', cargo: 'Director de Comercialización', area: 'comercializacion', sede: 'caracas' },
  { nombre: 'Flaviano Fuchi', cargo: 'Director de Operaciones y de Calidad y Logística', area: 'operaciones', sede: 'cagua' },
  { nombre: 'Dora Luciche', cargo: 'Directora de Finanzas', area: 'finanzas', sede: 'caracas' },
  { nombre: 'Gustavo Carvallo', cargo: 'Director de Capital Humano', area: 'capital-humano', sede: 'caracas' },

  // Iberia · gerencia
  { nombre: 'Marta Fuentes', cargo: 'Gerente de Tecnología de la Información', area: 'g-tecnologia', sede: 'caracas', lider: true },
  { nombre: 'Luis Daniel Agustín', cargo: 'Gerente de Desarrollo Comercial', area: 'g-desarrollo-comercial', sede: 'caracas', lider: true },
  { nombre: 'Milagro Salas', cargo: 'Gerente de Calidad, Investigación y Desarrollo', area: 'g-calidad', sede: 'cagua' },
  { nombre: 'Ana Karina Vázquez', cargo: 'Gerente de Contabilidad', area: 'g-contabilidad', sede: 'caracas' },

  // Iberia · jefatura
  { nombre: 'Delina Castro', cargo: 'Jefa de Laboratorio', area: 'j-laboratorio', sede: 'cagua' },

  // Equipo consultor
  { nombre: 'Gabriel Montiel Toro', cargo: 'CEO · Boosty Digital', area: 'boosty', org: 'boosty' },
  { nombre: 'Carlos Quintana', cargo: 'Consultor senior en dirigencia y gestión del cambio', area: 'boosty', org: 'boosty' },
  { nombre: 'Josué Bonilla', cargo: 'Consultor en metodología y procesos (UCAB)', area: 'boosty', org: 'boosty' },
  { nombre: 'Jesús Plana', cargo: 'Consultor de procesos (Consultores UCAB)', area: 'boosty', org: 'boosty' },
]

// -----------------------------------------------------------------------------
// Sesiones ya cargadas
//
// Fechas: el kick-off del comité es el 9 de julio de 2026 (consta en la
// propuesta y lo confirma Gabriel en la sesión). La visita a Cagua es el 5 de
// agosto de 2026: "hoy es 5", "hoy es 4 de agosto, 5 de agosto" en ENT-003.
// -----------------------------------------------------------------------------

const SESIONES = {
  'ENT-001': {
    codigo: 'SES-001',
    tipo: 'reunion',
    titulo: 'Comité gerencial extraordinario · Kick-off del programa (parte 1)',
    sede: 'caracas',
    fecha: '2026-07-09',
    resumen:
      'Sesión de arranque del programa con el comité gerencial ampliado. Alberto García-Ramos abre planteando la IA como respuesta a la pérdida de eficiencia y de márgenes; Carlos Quintana desarrolla el compromiso dirigente y el modelo de cascada; cada director y gerente se presenta y expone su lectura de la IA.',
  },
  'ENT-002': {
    codigo: 'SES-002',
    tipo: 'reunion',
    titulo: 'Comité gerencial extraordinario · Kick-off del programa (parte 2)',
    sede: 'caracas',
    fecha: '2026-07-09',
    resumen:
      'Continuación del kick-off: metodología y gobierno del programa, discusión sobre el liderazgo interno, y demostración del funcionamiento de la IA en comercial, producción, logística y finanzas.',
  },
  'ENT-003': {
    codigo: 'SES-003',
    tipo: 'reunion',
    titulo: 'Visita a Cagua · Sesión con Finanzas y Tecnología',
    sede: 'cagua',
    fecha: '2026-08-05',
    resumen:
      'Condiciones administrativas del programa, licenciamiento e infraestructura a nombre de Iberia, y primer levantamiento del panorama de sistemas: JD Edwards sobre IBM Power, CPI de nómina, Power BI sobre DB2, sistema de clínica y la dispersión de la data en Excel.',
  },
  'ENT-004': {
    codigo: 'SES-004',
    tipo: 'visita',
    titulo: 'Visita a Cagua · Recorrido de manufactura (parte 1)',
    sede: 'cagua',
    fecha: '2026-08-05',
    resumen:
      'Recorrido de planta guiado por el Director de Operaciones: portafolio de ~200 productos y 8 líneas, molino y fumigación de especias, laboratorio de control de calidad, preparación de caldos y bases deshidratadas, línea de mayonesa y envasado, codificación y trazabilidad por lote.',
  },
  'ENT-005': {
    codigo: 'SES-005',
    tipo: 'reunion',
    titulo: 'Visita a Cagua · Recorrido (parte 2) y reunión con gerentes',
    sede: 'cagua',
    fecha: '2026-08-05',
    resumen:
      'Cierre del recorrido y sesión con el equipo gerencial de planta: presentación de las cuatro fases del programa, autoevaluación del nivel de uso de IA, las dos vías (chat y conexión), y designación del liderazgo transversal del proyecto.',
  },
}

// -----------------------------------------------------------------------------
// Mapeo hablante → persona · SOLO lo demostrable
// -----------------------------------------------------------------------------

const MAPEOS = {
  // Todos se presentan con nombre y cargo entre los minutos 15 y 19.
  'SES-001': {
    'speaker 1': 'Alberto García-Ramos',
    'speaker 2': 'Gabriel Montiel Toro',
    'speaker 3': 'Flaviano Fuchi',
    'speaker 4': 'Carlos Quintana',
    'speaker 5': 'Luis Daniel Agustín',
    'speaker 6': 'Gustavo Carvallo',
    'speaker 7': 'Milagro Salas',
    'speaker 8': 'Antonio Sorrentino',
    'speaker 9': 'Marta Fuentes',
    'speaker 10': 'Ana Karina Vázquez',
    'speaker 11': 'Dora Luciche',
  },
  // Fireflies renumera en cada grabación. Aquí solo va lo probado:
  //  · speaker 2 conduce la demostración y presenta al equipo consultor.
  //  · Gabriel dice "entiendo la pregunta de Mar[ta]" y speaker 3 responde.
  //  · speaker 9 describe Investigación y Desarrollo y las normas técnicas,
  //    que es literalmente el cargo declarado de Milagro Salas.
  'SES-002': {
    'speaker 2': 'Gabriel Montiel Toro',
    'speaker 3': 'Marta Fuentes',
    'speaker 9': 'Milagro Salas',
  },
  //  · speaker 3 negocia el contrato y menciona a su gente de cuentas por pagar.
  //  · speaker 1 habla del ERP, IBM, los ataques y los respaldos.
  //  · speaker 4 repite el símil niño/adulto de Carlos Quintana.
  'SES-003': {
    'speaker 1': 'Marta Fuentes',
    'speaker 2': 'Gabriel Montiel Toro',
    'speaker 3': 'Dora Luciche',
    'speaker 4': 'Carlos Quintana',
  },
  //  · speaker 1 guía el recorrido y presenta al personal como su equipo.
  //  · speaker 3 es presentada como la jefa de laboratorio.
  'SES-004': {
    'speaker 1': 'Flaviano Fuchi',
    'speaker 3': 'Delina Castro',
  },
  //  · speaker 6 expone las cuatro fases y se presenta como Antropic Partner.
  //  · speaker 3 repite el símil niño/adulto de Carlos Quintana.
  'SES-005': {
    'speaker 6': 'Gabriel Montiel Toro',
    'speaker 3': 'Carlos Quintana',
  },
}

// -----------------------------------------------------------------------------

function log(...args) {
  console.log(...args)
}

async function fallar(mensaje) {
  console.error(`\n✖ ${mensaje}\n`)
  process.exit(1)
}

// --- Áreas -------------------------------------------------------------------
const { data: areas } = await admin.from('areas').select('id, slug')
const areaPorSlug = new Map((areas ?? []).map((a) => [a.slug, a.id]))
if (areaPorSlug.size === 0) await fallar('No hay áreas: falta aplicar la migración del organigrama.')

// --- Personas ----------------------------------------------------------------
log('\n── Personas')
for (const p of PERSONAS) {
  const fila = {
    nombre_completo: p.nombre,
    cargo: p.cargo,
    area_id: areaPorSlug.get(p.area) ?? null,
    organizacion: p.org ?? 'iberia',
    sede: p.sede ?? null,
    es_lider_programa: !!p.lider,
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
    log(`  ~ ${p.nombre}`)
  } else {
    const { error } = await admin.from('personas').insert(fila)
    if (error) await fallar(`${p.nombre}: ${error.message}`)
    log(`  + ${p.nombre}`)
  }
}

const { data: personas } = await admin.from('personas').select('id, nombre_completo')
const personaPorNombre = new Map((personas ?? []).map((p) => [p.nombre_completo, p.id]))

// --- Sesiones ----------------------------------------------------------------
log('\n── Sesiones')
const { data: sesiones } = await admin.from('entrevistas').select('id, codigo')

for (const [codigoViejo, datos] of Object.entries(SESIONES)) {
  const sesion =
    sesiones?.find((s) => s.codigo === codigoViejo) ??
    sesiones?.find((s) => s.codigo === datos.codigo)
  if (!sesion) {
    log(`  ! ${codigoViejo} no está en la base, se omite`)
    continue
  }

  if (SIMULAR) {
    log(`  (simulado) ${codigoViejo} → ${datos.codigo}  ${datos.titulo}`)
    continue
  }

  const { error } = await admin
    .from('entrevistas')
    .update({
      codigo: datos.codigo,
      tipo: datos.tipo,
      titulo: datos.titulo,
      sede: datos.sede,
      fecha_entrevista: datos.fecha,
      resumen: datos.resumen,
      // En una reunión no hay "entrevistado": el título es lo que la nombra.
      entrevistado_nombre: null,
      entrevistado_cargo: null,
      estado: 'transcrita',
    })
    .eq('id', sesion.id)

  if (error) await fallar(`${codigoViejo}: ${error.message}`)
  log(`  ~ ${datos.codigo}  ${datos.titulo}`)
}

// --- Participantes y renombrado ----------------------------------------------
log('\n── Hablantes')
const { data: sesionesFinales } = await admin.from('entrevistas').select('id, codigo')

for (const [codigo, mapeo] of Object.entries(MAPEOS)) {
  const sesion = sesionesFinales?.find((s) => s.codigo === codigo)
  if (!sesion) continue

  // Hablantes realmente presentes en la transcripción.
  const presentes = new Set()
  for (let desde = 0; ; desde += 1000) {
    const { data } = await admin
      .from('transcripcion_segmentos')
      .select('hablante, hablante_original')
      .eq('entrevista_id', sesion.id)
      .range(desde, desde + 999)
    if (!data?.length) break
    data.forEach((s) => presentes.add(s.hablante_original ?? s.hablante))
    if (data.length < 1000) break
  }

  let asignados = 0
  for (const [etiqueta, nombre] of Object.entries(mapeo)) {
    const personaId = personaPorNombre.get(nombre)
    if (!personaId) await fallar(`No existe la persona ${nombre}`)
    if (!presentes.has(etiqueta)) {
      log(`  ! ${codigo}: ${etiqueta} no aparece en la transcripción`)
      continue
    }

    if (SIMULAR) {
      asignados++
      continue
    }

    await admin.from('sesion_participantes').upsert(
      {
        entrevista_id: sesion.id,
        persona_id: personaId,
        etiqueta_hablante: etiqueta,
        rol: 'participante',
      },
      { onConflict: 'entrevista_id,persona_id' }
    )

    // Se guarda la etiqueta cruda antes de pisarla, para poder rehacerlo.
    const { error } = await admin.rpc('renombrar_hablante', {
      p_entrevista: sesion.id,
      p_etiqueta: etiqueta,
      p_nombre: nombre,
    })
    if (error) await fallar(`renombrar ${codigo}/${etiqueta}: ${error.message}`)
    asignados++
  }

  const sinAsignar = [...presentes].filter((h) => h && !mapeo[h] && /^speaker/i.test(h))
  log(
    `  ${codigo}: ${asignados} hablante(s) identificado(s)` +
      (sinAsignar.length ? ` · pendientes: ${sinAsignar.sort().join(', ')}` : ' · completo')
  )
}

log('\nListo.\n')
