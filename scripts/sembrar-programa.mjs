/**
 * Siembra la línea de tiempo del programa.
 *
 *   npm run sembrar:programa
 *
 * Los hitos son hechos con fecha, sacados del contrato y de los correos que
 * están en el módulo de archivos. Los previstos son el calendario reordenado
 * para que el Documento de Arquitectura llegue **antes** del aviso de no
 * renovación, no después.
 *
 * ⚠️ **Las horas no van aquí.** Este script las sembraba —solo el tiempo grabado
 * de cada sesión— y eso chocaba de frente con `sembrar-horas.mjs`, que es el
 * registro. Los dos escribían en `registros_horas` con descripciones distintas
 * para el mismo trabajo, así que la misma jornada del 20 de agosto entraba dos
 * veces: 5,42 h aquí y 10,5 h allá. Y como `sembrar:horas --limpiar` borra lo que
 * no está en su archivo, correr los dos en un orden duplicaba las horas y en el
 * otro las desaparecía sin decir nada. **Un solo registro: `sembrar-horas.mjs`**,
 * que ya lleva esas partidas con su preparación y su traslado adentro.
 *
 * Idempotente: se reconoce por la pareja (fecha, título).
 */

import { createClient } from '@supabase/supabase-js'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY,
  { auth: { persistSession: false } }
)

// --- Lo que pasó y lo que viene ----------------------------------------------
// Las entrevistas, las visitas y las formaciones NO van aquí: ya viven en
// `entrevistas` con su fecha y la vista `linea_de_tiempo` las une al leer.

const HITOS = [
  {
    fecha: '2026-07-31',
    titulo: 'Entregados los insumos del comunicado y el mapa narrativo',
    descripcion:
      'A la Gerencia General, para el equipo de comunicaciones y Fuguet. Dos documentos: ' +
      'el contenido verificado para que ellos escriban, y qué se puede contar en cada fase. ' +
      'Alberto acusó recibo el mismo día.',
    tipo: 'comunicacion',
    entregable: 'comunicacion',
    estado: 'hecho',
  },
  {
    fecha: '2026-08-06',
    titulo: 'Contrato CONT-2026-08-0002 firmado',
    descripcion:
      'Acuerdo de Partnership. Firman Gabriel Andrés Montiel Toro por Boosty y Alberto ' +
      'García-Ramos Cortiñas por Iberia. Sello electrónico del 7 de agosto. Arranca el ' +
      'plazo mínimo de cinco meses.',
    tipo: 'contrato',
    entregable: null,
    estado: 'hecho',
  },
  {
    fecha: '2026-08-12',
    titulo: 'El canal interno se anuncia a la Gerencia General',
    descripcion:
      '«El primer entregable que se puede tocar.» Queda pedida la revisión con mercadeo ' +
      'antes de conectarlo a datos reales.',
    tipo: 'comunicacion',
    entregable: 'app',
    estado: 'hecho',
  },
  {
    fecha: '2026-08-22',
    titulo: 'El primer rodaje de entrevistas, transcrito y atribuido',
    descripcion:
      'Las nueve entrevistas del 20 de agosto en Cagua y la formación uno a uno con la ' +
      'Gerencia General quedan transcritas, con cada intervención atribuida a quien la dijo. ' +
      'Es la base sobre la que se escribe el informe: sin nombre, lo que se dijo no se puede ' +
      'citar.',
    tipo: 'hito',
    entregable: 'levantamiento',
    estado: 'hecho',
  },

  {
    fecha: '2026-08-27',
    titulo: 'El comunicado oficial salió',
    descripcion:
      'Redactado por Fuguet Comunicación y Cambio sobre los insumos que Boosty entregó el 31 ' +
      'de julio. Lo que sigue en ese frente es la nota del boletín interno y la fecha de ' +
      'publicación del plan de comunicación.',
    tipo: 'comunicacion',
    entregable: 'comunicacion',
    estado: 'hecho',
  },
  {
    fecha: '2026-08-27',
    titulo: 'Propuesto un comité de comunicaciones',
    descripcion:
      'Salió de la reunión con Fuguet: un comité con las tres partes —Iberia, comunicaciones ' +
      'y la consultoría de implementación— para que lo que se comunica vaya al mismo paso que ' +
      'lo que se entrega. Queda a consideración de la Gerencia General, y de aprobarse cubre ' +
      'también la cadencia de reuniones de gobierno que prevé el contrato.',
    tipo: 'decision',
    entregable: 'comunicacion',
    estado: 'previsto',
  },

  // --- Septiembre ---------------------------------------------------------------
  // Los rodajes y la formación de gerentes del 23 no van aquí: viven en
  // `entrevistas` (el 23 es FOR-003) y la vista los une solos.
  {
    fecha: '2026-09-15',
    titulo: 'El levantamiento pasa la meta: 33 entrevistas de ~25',
    descripcion:
      'Con el rodaje del 10 de septiembre en Cagua —Tecnología de la Información y Crédito y ' +
      'Cobranza— y los del 11 y 15 en Caracas —la parte comercial—, el levantamiento llega a ' +
      '33 entrevistas y cubre los veinte macroprocesos. Queda una más, la de la Coordinación de ' +
      'Distribuidores, programada.',
    tipo: 'hito',
    entregable: 'levantamiento',
    estado: 'hecho',
  },
  {
    fecha: '2026-09-16',
    titulo: 'El mapa de procesos, validado contra las entrevistas',
    descripcion:
      'De los 47 procesos del mapa de partida, 30 se confirmaron tal cual; seis no se ejecutan ' +
      'y once tenían otro dueño. El mapa queda en 20 macroprocesos y 142 procesos vigentes, con ' +
      'cinco macroprocesos que se ejecutan y no estaban en el papel.',
    tipo: 'hito',
    entregable: 'levantamiento',
    estado: 'hecho',
  },
  {
    fecha: '2026-09-24',
    titulo: 'El Documento de Arquitectura, completo en borrador',
    descripcion:
      'Las doce secciones escritas: el levantamiento —el mapa de procesos, las veinte fichas, ' +
      'los sistemas, el riesgo, dónde se traba el trabajo y los hallazgos— y la arquitectura: ' +
      'los circuitos del negocio, las oportunidades, el sistema Iberia y su ruta de ' +
      'construcción. Sigue en borrador hasta validar con cada área los hallazgos que lo sostienen.',
    tipo: 'hito',
    entregable: 'arquitectura',
    estado: 'hecho',
  },

  // --- Lo previsto, con el calendario adelantado ------------------------------
  {
    fecha: '2026-09-06',
    titulo: 'Plan de comunicación con fecha de publicación',
    descripcion:
      'El comunicado ya salió. Lo que cierra el entregable es el plan con su fecha, el vocero ' +
      'del proyecto y la nota del boletín interno que Fuguet estaba redactando el 27 de ' +
      'agosto.',
    tipo: 'entregable',
    entregable: 'comunicacion',
    estado: 'en_riesgo',
  },
  {
    fecha: '2026-09-30',
    titulo: 'App de comunicación interna desplegada',
    descripcion:
      'Construida y funcionando en el ambiente de prueba. Para desplegarla falta la revisión ' +
      'con Mercadeo y fijar el dominio definitivo antes del primer envío de enlaces personales: ' +
      'el dominio va dentro de cada enlace, y cambiarlo después obliga a volver a mandarlos.',
    tipo: 'entregable',
    entregable: 'app',
    // La revisión con Mercadeo no tiene fecha y sin ella no se despliega. Es
    // marca interna: el lector de Iberia no ve «en riesgo».
    estado: 'en_riesgo',
  },
  {
    fecha: '2026-10-31',
    titulo: 'Las tres formaciones dictadas y el chat organizacional andando',
    descripcion:
      'Directiva, gerentes y líderes, con las licencias corporativas a nombre de Iberia. ' +
      'Van dos: la directiva, el 26 de agosto en Caracas, y los gerentes, el 23 de septiembre ' +
      'en Cagua. Falta la tercera, con los líderes que escojan los gerentes, y su fecha.',
    tipo: 'entregable',
    entregable: 'formacion',
    estado: 'previsto',
  },
  {
    fecha: '2026-11-07',
    titulo: 'Las ~25 entrevistas cerradas, con su informe por área',
    descripcion:
      'Las entrevistas ya están: 33 hechas y una programada, en tres rodajes —dos en Cagua y uno ' +
      'repartido entre Cagua y Caracas—, con los veinte macroprocesos cubiertos. Lo que cierra el entregable es el ' +
      'informe de levantamiento por área, que sale de los hallazgos validados.',
    tipo: 'entregable',
    entregable: 'levantamiento',
    estado: 'previsto',
  },
  {
    fecha: '2026-11-14',
    titulo: 'Inventario de sistemas, datos, equipos y conectividad',
    descripcion:
      'Armado con los sistemas, archivos y equipos que la propia gente nombró en las ' +
      'entrevistas, y cerrado con la sesión de Tecnología de la Información del 10 de ' +
      'septiembre: 27 sistemas en ocho capas, cada uno con su dueño y su estado, dentro del ' +
      'informe. Falta confirmarlo con las áreas.',
    tipo: 'entregable',
    entregable: 'inventario',
    estado: 'previsto',
  },
  {
    fecha: '2026-11-30',
    titulo: 'Programa de formación de planta entregado como diseño',
    descripcion:
      'El curso para el personal de planta: nueve lecciones por el teléfono, con audio, ' +
      'material de bolsillo, ejercicios por oficio y certificado. Ya está construido; lo que ' +
      'falta es entregarlo como diseño. El despliegue y su licenciamiento son de la Fase 2.',
    tipo: 'entregable',
    entregable: 'planta',
    estado: 'previsto',
  },
  {
    fecha: '2026-12-06',
    titulo: 'Documento de Arquitectura de IA al comité',
    descripcion:
      'El único entregable en firme de la Fase 1. La cláusula 7 lo hace condición para ' +
      'pasar a la Fase 2: el comité tiene que aprobarlo antes de continuar. Está completo en ' +
      'borrador desde el 24 de septiembre; lo que falta es validarlo con las áreas.',
    tipo: 'entregable',
    entregable: 'arquitectura',
    estado: 'previsto',
  },
  {
    fecha: '2026-12-06',
    titulo: 'Vence el aviso de no renovación',
    descripcion:
      'Treinta días antes del cierre del plazo mínimo. Es la fecha que manda sobre todo el ' +
      'calendario: por eso la arquitectura se entrega en diciembre y no en enero.',
    tipo: 'contrato',
    entregable: null,
    estado: 'previsto',
  },
  {
    fecha: '2027-01-06',
    titulo: 'Cierre del plazo mínimo de la Fase 1',
    descripcion: 'Cinco meses desde la firma. Punto de control: Iberia decide la Fase 2.',
    tipo: 'contrato',
    entregable: null,
    estado: 'previsto',
  },
]

// -----------------------------------------------------------------------------

console.log('\n── Hitos')
for (const h of HITOS) {
  const { data: existente } = await admin
    .from('hitos')
    .select('id')
    .eq('fecha', h.fecha)
    .eq('titulo', h.titulo)
    .maybeSingle()

  if (existente) {
    await admin.from('hitos').update(h).eq('id', existente.id)
    console.log(`  ~ ${h.fecha}  ${h.titulo}`)
    continue
  }

  const { error } = await admin.from('hitos').insert(h)
  if (error) {
    console.error(`\n✖ ${h.titulo}: ${error.message}\n`)
    process.exit(1)
  }
  console.log(`  + ${h.fecha}  ${h.titulo}`)
}

// --- Los que quedaron atrás ---------------------------------------------------
//
// La idempotencia va por (fecha, título), así que **cambiarle el título a un hito
// deja el viejo vivo**. Pasó al renombrar «Comunicado oficial publicado»: el
// panel lo mostraba a la vez como hecho el 27 de agosto y en riesgo el 6 de
// septiembre, del mismo comunicado. Es la misma trampa que ya tenía el registro
// de horas, y se avisa igual.
{
  const { data: enBase } = await admin.from('hitos').select('id, fecha, titulo')
  const conocidos = new Set(HITOS.map((h) => `${h.fecha}|${h.titulo}`))
  const huerfanos = (enBase ?? []).filter((h) => !conocidos.has(`${h.fecha}|${h.titulo}`))

  if (huerfanos.length) {
    console.log(`\n⚠️  ${huerfanos.length} hitos en la base que no están en este archivo:`)
    for (const h of huerfanos) console.log(`     · ${h.fecha}  ${h.titulo}`)
    if (process.argv.includes('--limpiar')) {
      await admin
        .from('hitos')
        .delete()
        .in(
          'id',
          huerfanos.map((h) => h.id)
        )
      console.log('   Borrados.')
    } else {
      console.log('   Pueden ser hitos cargados a mano desde el panel — o restos de un')
      console.log('   título que cambió. Para borrarlos: --limpiar')
    }
  }
}

console.log(`\n${HITOS.length} hitos.`)
console.log('\n   Las horas van por su cuenta: npm run sembrar:horas\n')
