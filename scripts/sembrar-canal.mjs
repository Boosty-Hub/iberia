/**
 * Siembra el padrón inicial del canal y publicaciones de muestra.
 *
 *   node --env-file=.env.local scripts/sembrar-canal.mjs
 *
 * El padrón real de ~280 personas lo entrega Capital Humano. Aquí van los que
 * ya conocemos del levantamiento, más algunos perfiles de planta para poder
 * comprobar cómo se ve el canal desde abajo, que es el caso difícil.
 *
 * Idempotente.
 */

import { createClient } from '@supabase/supabase-js'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY,
  { auth: { persistSession: false } }
)

// Las cédulas son de marcador: el padrón real lo entrega Capital Humano.
const EMPLEADOS = [
  { cedula: 'V-6912626', nombre: 'Alberto García-Ramos', cargo: 'Director Gerente General', area: 'direccion-general', nivel: 'direccion', sede: 'caracas', publica: true },
  { cedula: 'PADRON-002', nombre: 'Antonio Sorrentino', cargo: 'Director de Comercialización', area: 'comercializacion', nivel: 'direccion', sede: 'caracas', publica: true },
  { cedula: 'PADRON-003', nombre: 'Flaviano Tucci', cargo: 'Director de Operaciones', area: 'operaciones', nivel: 'direccion', sede: 'cagua', publica: true },
  { cedula: 'PADRON-004', nombre: 'Dora Luciche', cargo: 'Directora de Finanzas', area: 'finanzas', nivel: 'direccion', sede: 'caracas', publica: true },
  { cedula: 'PADRON-005', nombre: 'Gustavo Carballo', cargo: 'Director de Capital Humano', area: 'capital-humano', nivel: 'direccion', sede: 'caracas', publica: true },

  { cedula: 'PADRON-010', nombre: 'Martha Fuentes', cargo: 'Gerente de Tecnología de la Información', area: 'g-tecnologia', nivel: 'gerencia', sede: 'caracas', publica: true, modera: true },
  { cedula: 'PADRON-011', nombre: 'Luis Daniel Agostini', cargo: 'Gerente de Desarrollo Comercial', area: 'g-desarrollo-comercial', nivel: 'gerencia', sede: 'caracas', publica: true, modera: true },
  { cedula: 'PADRON-012', nombre: 'Milagro Salas', cargo: 'Gerente de Calidad, Investigación y Desarrollo', area: 'g-calidad', nivel: 'gerencia', sede: 'cagua' },
  { cedula: 'PADRON-013', nombre: 'Ana Karina Vázquez', cargo: 'Gerente de Contabilidad', area: 'g-contabilidad', nivel: 'gerencia', sede: 'caracas' },
  { cedula: 'PADRON-014', nombre: 'Martha E. Álvarez', cargo: 'Comunicaciones', area: 'j-comunicaciones', nivel: 'jefatura', sede: 'caracas', publica: true, modera: true },

  { cedula: 'PADRON-020', nombre: 'Delina Castro', cargo: 'Jefa de Laboratorio', area: 'j-laboratorio', nivel: 'jefatura', sede: 'cagua' },

  // Perfiles de planta: el caso difícil del diseño. Nómina diaria, teléfono
  // propio, poca familiaridad con aplicaciones.
  { cedula: 'PADRON-100', nombre: 'José Ramírez', cargo: 'Supervisor de Producción', area: 'j-produccion', nivel: 'planta', sede: 'cagua', nomina: 'diaria' },
  { cedula: 'PADRON-101', nombre: 'Yulimar Rodríguez', cargo: 'Operadora de Envasado', area: 'j-produccion', nivel: 'planta', sede: 'cagua', nomina: 'diaria' },
  { cedula: 'PADRON-102', nombre: 'Pedro Silva', cargo: 'Despachador de Insumos y Productos', area: 'j-almacen-materia-prima', nivel: 'planta', sede: 'cagua', nomina: 'diaria' },
  { cedula: 'PADRON-103', nombre: 'Ramón Escalona', cargo: 'Preparador de Mezclas', area: 'j-produccion', nivel: 'planta', sede: 'cagua', nomina: 'diaria' },
  { cedula: 'PADRON-104', nombre: 'Carmen Bolívar', cargo: 'Analista de Laboratorio', area: 'j-laboratorio', nivel: 'administrativo', sede: 'cagua' },

  // Acceso del equipo consultor durante la Fase 1: opera el canal junto con
  // Comunicaciones hasta transferirlo.
  { cedula: 'BOOSTY-001', nombre: 'Gabriel Montiel Toro', cargo: 'Consultor · Boosty Digital', area: 'boosty', nivel: 'direccion', sede: 'caracas', publica: true, modera: true, correo: 'gmontiel@spatiumgroup.com' },
]

const PUBLICACIONES = [
  {
    tipo: 'comunicado',
    oficial: true,
    fijado: true,
    autor: 'Alberto García-Ramos',
    titulo: 'Comenzamos una nueva etapa',
    bajada:
      'Industrias Iberia inicia un programa para incorporar inteligencia artificial a nuestra forma de trabajar. Es una decisión del Comité Gerencial y nos toca a todos.',
    cuerpo: `Nuestra empresa cumplió más de seis décadas dándole sabor a la mesa de los venezolanos. Llegamos hasta aquí adaptándonos, y hoy nos toca hacerlo otra vez.

Vamos a incorporar inteligencia artificial a nuestra manera de trabajar. No es un proyecto del área de sistemas: es una nueva forma de trabajar que iremos construyendo entre todos, por etapas y con acompañamiento.

**Qué va a pasar en los próximos meses.** Un equipo consultor nos acompañará a entender cómo trabajamos hoy, área por área. Vamos a conversar con muchos de ustedes. De ahí saldrá el plan de lo que viene.

**Qué necesitamos de cada quien.** Que nos cuenten cómo hacen su trabajo de verdad, no como dice el manual. Ahí está el conocimiento que ninguna herramienta trae de fábrica.

Iremos compartiendo cada avance por este canal.`,
    audiencia: 'todos',
  },
  {
    tipo: 'hito_ia',
    autor: 'Martha Fuentes',
    titulo: 'Este es nuestro canal',
    bajada:
      'Desde hoy los comunicados, las noticias y las historias de nuestra gente viven aquí. Se abre desde el teléfono, sin instalar nada.',
    cuerpo: `Hasta ahora la información de la empresa se repartía entre el boletín, el correo y la cartelera. Quien no tenía correo se enteraba tarde, o no se enteraba.

Este canal reúne todo en un solo lugar y llega a cualquier teléfono. No hay que descargar nada de ninguna tienda: se abre con un enlace y queda guardado.

En las próximas semanas iremos sumando cosas: grupos de trabajo, mensajes entre compañeros, y más adelante trámites que hoy toca hacer en papel.`,
    audiencia: 'todos',
  },
  {
    tipo: 'nuestra_gente',
    autor: 'Martha E. Álvarez',
    titulo: 'La planta de Cagua, por dentro',
    bajada:
      'Ocho líneas, más de doscientos productos y un molino que sigue siendo el corazón de la empresa desde 1957.',
    cuerpo: `Todo empezó con un molino de especias en una esquina de Caracas. Hoy, en Cagua, ese molino sigue siendo el punto donde arranca buena parte de lo que producimos.

Por sus líneas pasan salsas, adobos, caldos, sopas deshidratadas e infusiones. Cada producto lleva su fórmula, sus tiempos y sus controles.

Detrás de cada frasco hay gente que conoce su proceso como nadie.`,
    audiencia: 'todos',
  },
  {
    tipo: 'formacion',
    autor: 'Gustavo Carballo',
    titulo: 'Formación en inteligencia artificial para todos',
    bajada:
      'El programa contempla formación en tres niveles. Empezamos por la dirección y vamos bajando hasta llegar a planta.',
    cuerpo: `La formación es parte central del programa, no un añadido. Nadie tiene que aprender solo.

Arrancamos con el equipo directivo y seguimos con las gerencias y las jefaturas. El personal de planta tendrá su propio programa, pensado para hacerse desde el teléfono y en el tiempo de cada quien.

Primero aprendemos todos; después la herramienta va llegando a cada puesto.`,
    audiencia: 'todos',
  },
  {
    tipo: 'evento',
    autor: 'Martha E. Álvarez',
    titulo: 'Entrevistas del diagnóstico en planta',
    bajada:
      'Durante la semana del 18 de agosto conversaremos con nueve compañeros de la operación en Cagua.',
    cuerpo: `Como parte del levantamiento, el equipo consultor estará en Cagua conversando con compañeros de producción, almacén, mantenimiento, calidad, laboratorio, compras y distribución.

No hay que preparar nada. La idea es entender cómo se trabaja hoy, con sus dificultades reales.`,
    audiencia: 'planta',
  },
]

// -----------------------------------------------------------------------------

const { data: areas } = await admin.from('areas').select('id, slug')
const areaPorSlug = new Map((areas ?? []).map((a) => [a.slug, a.id]))

console.log('\n── Padrón')

for (const e of EMPLEADOS) {
  let perfilId = null
  if (e.correo) {
    const { data: perfil } = await admin
      .from('profiles')
      .select('id')
      .ilike('email', e.correo)
      .maybeSingle()
    perfilId = perfil?.id ?? null
  }

  const fila = {
    cedula: e.cedula,
    nombre_completo: e.nombre,
    cargo: e.cargo,
    area_id: areaPorSlug.get(e.area) ?? null,
    nivel: e.nivel,
    sede: e.sede,
    tipo_nomina: e.nomina ?? 'mensual',
    email: e.correo ?? null,
    puede_publicar: !!e.publica,
    es_moderador: !!e.modera,
    ...(perfilId ? { perfil_id: perfilId } : {}),
  }

  const { error } = await admin.from('empleados').upsert(fila, { onConflict: 'cedula' })
  if (error) {
    console.error(`\n✖ ${e.nombre}: ${error.message}\n`)
    process.exit(1)
  }
  console.log(`  ${e.nivel.padEnd(15)} ${e.nombre}${perfilId ? '  ← sesión enlazada' : ''}`)
}

// --- Publicaciones ------------------------------------------------------------
console.log('\n── Publicaciones')

const { data: empleados } = await admin.from('empleados').select('id, nombre_completo')
const porNombre = new Map((empleados ?? []).map((e) => [e.nombre_completo, e.id]))

const { data: yaHay } = await admin.from('publicaciones').select('titulo')
const titulos = new Set((yaHay ?? []).map((p) => p.titulo))

// Se escalonan hacia atrás para que el feed no muestre todo con la misma hora.
let horasAtras = 2

for (const p of PUBLICACIONES) {
  if (titulos.has(p.titulo)) {
    console.log(`  = ${p.titulo}`)
    horasAtras += 20
    continue
  }

  const publicado = new Date(Date.now() - horasAtras * 3600_000).toISOString()

  const { error } = await admin.from('publicaciones').insert({
    tipo: p.tipo,
    titulo: p.titulo,
    bajada: p.bajada,
    cuerpo_md: p.cuerpo,
    audiencia: p.audiencia,
    autor_id: porNombre.get(p.autor) ?? null,
    estado: 'publicado',
    oficial: !!p.oficial,
    fijado: !!p.fijado,
    publicado_en: publicado,
  })

  if (error) {
    console.error(`\n✖ ${p.titulo}: ${error.message}\n`)
    process.exit(1)
  }
  console.log(`  + ${p.titulo}`)
  horasAtras += 20
}

console.log('\nListo.\n')
