/**
 * El registro de horas del programa, partida por partida.
 *
 *   npm run sembrar:horas
 *   npm run sembrar:horas -- --revisar     # dice qué cargaría, sin escribir
 *
 * ⚠️ **Estas horas son una estimación por entregable, no un parte de trabajo.**
 * Nadie llevó reloj. Lo que hace este archivo es que **no se olvide nada**: la
 * preparación, los traslados Caracas↔Cagua, la redacción de los documentos, las
 * horas de Carlos y de Jesús Planas, y el desarrollo del aplicativo, que es el renglón
 * más grande y el que más fácil se pierde porque no tiene una reunión que lo
 * recuerde.
 *
 * Cada partida dice **de dónde sale su número**. Quien lo vivió corrige; corregir
 * una cifra que está escrita cuesta un minuto, acordarse de una partida que falta
 * cuesta el mes.
 *
 * **Lo previo a la firma es Fase 0** y se registra aparte: se cobró por USD 4.700
 * y no descuenta de las 107 mensuales. `consumeBolsa()` en `lib/programa.ts` lo
 * separa; aquí solo van con su fecha real.
 *
 * Idempotente por (fecha, descripción).
 */

import { createClient } from '@supabase/supabase-js'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY,
  { auth: { persistSession: false } }
)

const revisar = process.argv.includes('--revisar')

/** Caracas ↔ Cagua son hora y media por vía. Una jornada en planta son 3 h de vía. */
const VIA = 3

const HORAS = [
  // ===========================================================================
  // FASE 0 · antes de la firma. No descuenta bolsa.
  // ===========================================================================
  {
    fecha: '2026-07-08',
    perfil: 'desarrollador_ia',
    horas: 6,
    persona: 'Boosty',
    entregable: 'gestion',
    descripcion:
      'Las cuatro demos del comité: carga de camión, cartera priorizada, lectura de factura ' +
      'y señales de planta. En julio todavía no se ejecutaba el aplicativo, sino sus primeras ' +
      'bases: cuatro maquetas para mostrar el razonamiento en la sala, hora y media cada una.',
  },
  {
    fecha: '2026-07-08',
    perfil: 'director_arquitecto',
    horas: 8,
    persona: 'Gabriel Montiel Toro',
    entregable: 'gestion',
    descripcion:
      'Preparación del Comité Gerencial: estructura de los tres bloques, guion del bloque de ' +
      'Tecnología y montaje de las demos.',
  },
  {
    fecha: '2026-07-09',
    perfil: 'director_arquitecto',
    horas: 6,
    persona: 'Gabriel Montiel Toro',
    entregable: 'gestion',
    descripcion:
      'Comité Gerencial Extraordinario · Hotel Eurobuilding, 9:00–12:00, ocho directores. ' +
      'Bloque de Tecnología y demos. 3 h de sesión + 3 h de traslado y montaje.',
  },
  {
    fecha: '2026-07-09',
    perfil: 'consultor_senior',
    horas: 7,
    persona: 'Carlos Quintana',
    entregable: 'gestion',
    descripcion:
      'Comité Gerencial · bloque de Personas y compromiso dirigente. 3 h de sesión + 4 h de ' +
      'preparación del marco de gestión del cambio.',
  },
  {
    fecha: '2026-07-09',
    perfil: 'consultor_procesos',
    horas: 6,
    persona: 'Jesús Planas',
    entregable: 'gestion',
    descripcion:
      'Comité Gerencial · bloque de Proceso, en remoto. 3 h de sesión + 3 h de preparación.',
  },
  {
    fecha: '2026-07-14',
    perfil: 'director_arquitecto',
    horas: 10,
    persona: 'Gabriel Montiel Toro',
    entregable: 'gestion',
    descripcion:
      'Memoria Estratégica y Hoja de Ruta (12 págs.), entregada tras el comité. Base: ~50 min ' +
      'por página entre redacción, composición y verificación del render.',
  },
  {
    fecha: '2026-07-14',
    perfil: 'consultor_senior',
    horas: 4,
    persona: 'Carlos Quintana',
    entregable: 'gestion',
    descripcion:
      'Anexo · Lineamientos de la Política de Adopción de IA (6 págs.), borrador semilla ' +
      'para el comité.',
  },
  {
    fecha: '2026-07-16',
    perfil: 'director_arquitecto',
    horas: 4,
    persona: 'Gabriel Montiel Toro',
    entregable: 'gestion',
    descripcion:
      'Reunión con la Gerencia General y Carlos Quintana: validación de la estructura de ' +
      'cuatro fases. Más la reunión aparte sobre horas y tarifas.',
  },
  {
    fecha: '2026-07-16',
    perfil: 'consultor_senior',
    horas: 3,
    persona: 'Carlos Quintana',
    entregable: 'gestion',
    descripcion: 'Reunión de validación de la estructura del programa con la Gerencia General.',
  },
  {
    fecha: '2026-07-21',
    perfil: 'director_arquitecto',
    horas: 4,
    persona: 'Gabriel Montiel Toro',
    entregable: 'comunicacion',
    descripcion:
      'Reunión del frente comunicacional con Fuguet, Marcela Ojeda, Martha E. Álvarez y la ' +
      'Gerencia General. 2 h de reunión + traslado.',
  },
  {
    fecha: '2026-07-24',
    perfil: 'director_arquitecto',
    horas: 10,
    persona: 'Gabriel Montiel Toro',
    entregable: 'gestion',
    descripcion:
      'Propuesta Técnica y Económica (13 págs.): las cuatro fases, las cuatro corrientes, la ' +
      'tabla de entregables, el modelo de 107 horas y el licenciamiento por despliegue.',
  },
  {
    fecha: '2026-07-30',
    perfil: 'director_arquitecto',
    horas: 14,
    persona: 'Gabriel Montiel Toro',
    entregable: 'comunicacion',
    descripcion:
      'Insumos para el comunicado (14 págs.) y Mapa narrativo por fases (14 págs.). 28 páginas ' +
      'con la IA en tres niveles, el vocabulario, quince preguntas con respuesta y las ' +
      'metáforas. Entregados el 31 de julio.',
  },
  {
    fecha: '2026-07-31',
    perfil: 'consultor_senior',
    horas: 3,
    persona: 'Carlos Quintana',
    entregable: 'comunicacion',
    descripcion:
      'Observaciones sobre los documentos comunicacionales: la línea del empleo y el ' +
      'principio del «nosotros».',
  },
  {
    // ⚠️ Estas dos son de antes de la firma del 6 y por eso van con
    // `imputacion: 'fase_0'`. El corte de `consumeBolsa()` va por mes calendario,
    // así que sin la marca caerían del lado de la Fase 1 y se cobrarían dos
    // veces: ya están dentro de los USD 4.700 de la etapa anterior.
    fecha: '2026-08-01',
    perfil: 'director_arquitecto',
    horas: 12,
    persona: 'Gabriel Montiel Toro',
    entregable: 'gestion',
    imputacion: 'fase_0',
    descripcion:
      'Deck de lanzamiento (32 láminas co-brandeadas) y agenda de la sesión del 5 de agosto ' +
      '(7 págs.). Anterior a la firma: cierre de la etapa anterior.',
  },
  {
    fecha: '2026-08-03',
    perfil: 'director_arquitecto',
    horas: 6,
    persona: 'Gabriel Montiel Toro',
    entregable: 'gestion',
    imputacion: 'fase_0',
    descripcion:
      'Negociación contractual con Travieso Evans: revisión del control de cambios y los ' +
      'cinco puntos devueltos. Anterior a la firma: cierre de la etapa anterior.',
  },
  {
    fecha: '2026-08-05',
    perfil: 'director_arquitecto',
    horas: 7,
    persona: 'Gabriel Montiel Toro',
    entregable: 'comunicacion',
    descripcion:
      'Sesión de lanzamiento con la línea gerencial · Planta Cagua, 11:00–13:00, ~15 gerentes. ' +
      `2 h de sesión + ${VIA} h de traslado + 2 h de montaje. Ese mismo día se grabaron las ` +
      'tres sesiones del recorrido de planta.',
  },
  {
    fecha: '2026-08-05',
    perfil: 'consultor_senior',
    horas: 1,
    persona: 'Carlos Quintana',
    entregable: 'comunicacion',
    descripcion: 'Sesión de lanzamiento en Cagua · su bloque de Personas dentro de la sesión.',
  },

  // ===========================================================================
  // MES 1 · agosto, desde la firma del 6
  // ===========================================================================
  {
    fecha: '2026-08-11',
    perfil: 'desarrollador_ia',
    horas: 14,
    persona: 'Boosty',
    entregable: 'gestion',
    descripcion:
      'El dashboard del levantamiento, de cero: Next.js sobre Supabase con RLS en las siete tablas, tres roles ' +
      'sin registro abierto, el parser de Fireflies con sus 50 verificaciones, el importador, ' +
      'los módulos de archivos, hallazgos e informe, el rebranding a la identidad de Iberia y ' +
      'cinco suites de verificación.',
  },
  {
    fecha: '2026-08-11',
    perfil: 'desarrollador_ia',
    horas: 12,
    persona: 'Boosty',
    entregable: 'app',
    descripcion:
      'El canal de comunicación interna: doce tablas con RLS completa, identidad móvil propia, ' +
      'las siete secciones (feed segmentado, directorio, mensajes, grupos, avisos, perfil y ' +
      'consola de publicación), 21 comprobaciones contra la base real y las capturas en ' +
      'iPhone 14.',
  },
  {
    fecha: '2026-08-12',
    perfil: 'consultor_senior',
    horas: 1,
    persona: 'Carlos Quintana',
    entregable: 'gestion',
    descripcion:
      'Acompañamiento del cambio con la línea gerencial en Cagua, en la jornada del 12 de ' +
      'agosto.',
  },
  {
    fecha: '2026-08-12',
    perfil: 'director_arquitecto',
    horas: 2,
    persona: 'Gabriel Montiel Toro',
    entregable: 'app',
    descripcion:
      'Presentación del canal a la Gerencia General y propuesta de revisión con mercadeo ' +
      'antes de conectarlo a datos reales.',
  },
  {
    fecha: '2026-08-16',
    perfil: 'consultor_procesos',
    horas: 20,
    persona: 'Boosty',
    entregable: 'planta',
    imputacion: 'fase_2',
    descripcion:
      'El guion del adiestramiento: nueve lecciones palabra por palabra, ~14.000 palabras de ' +
      'diseño instruccional, más el análisis del curso MAIA (3.577 líneas de chat, 21 videos, ' +
      '28 tarjetas y 12 PDF) para decidir qué se copia y qué no sirve para planta.',
  },
  {
    fecha: '2026-08-16',
    perfil: 'desarrollador_ia',
    horas: 40,
    persona: 'Boosty',
    entregable: 'planta',
    imputacion: 'fase_2',
    descripcion:
      'El módulo del adiestramiento: migración de seis tablas, la vista del curso en el ' +
      'teléfono y el panel de seguimiento, la voz con su SSML, el lector del guion, la ' +
      'respuesta hablada con conversión a WAV y transcripción, la respuesta con foto, los ' +
      'buckets separados, y la grabación de los 70 audios.',
  },
  {
    fecha: '2026-08-17',
    perfil: 'desarrollador_ia',
    horas: 44,
    persona: 'Boosty',
    entregable: 'planta',
    imputacion: 'fase_2',
    descripcion:
      'Que Ajito conteste, y lo que cuelga de eso: el personaje con una instrucción por ' +
      'ejercicio, la devolución hablada, las diez fichas de bolsillo, el certificado con su ' +
      'función de emisión y su hoja imprimible, el empujón completo con la conexión de ' +
      'WhatsApp y sus 38 comprobaciones, y el padrón con el enlace personal y sus 25.',
  },
  {
    fecha: '2026-08-17',
    perfil: 'director_arquitecto',
    horas: 7,
    persona: 'Gabriel Montiel Toro',
    entregable: 'formacion',
    descripcion:
      'Formación uno a uno con la Gerencia General, en su oficina. 3 h 05 min grabadas de ' +
      'hora y media pedida + 3 h de preparación del ambiente y los ejemplos + traslado.',
  },
  {
    fecha: '2026-08-19',
    perfil: 'consultor_procesos',
    horas: 6,
    persona: 'Gabriel Montiel Toro',
    entregable: 'levantamiento',
    descripcion:
      'Preparación del rodaje: guion de entrevista, reparto de las nueve en dos pistas y ' +
      'coordinación de agendas con planta.',
  },
  {
    fecha: '2026-08-20',
    perfil: 'consultor_procesos',
    horas: 10.5,
    persona: 'Gabriel Montiel Toro',
    entregable: 'levantamiento',
    descripcion:
      'Cinco entrevistas en Cagua: Planta, Producción, Diseño y Desarrollo, Distribución y ' +
      `Compras. 5 h 25 min grabadas + ${VIA} h de traslado + 2 h de espera entre citas y notas.`,
  },
  {
    fecha: '2026-08-20',
    perfil: 'consultor_procesos',
    horas: 8.5,
    persona: 'Ruth Velázquez',
    entregable: 'levantamiento',
    descripcion:
      'Cuatro entrevistas en Cagua: Almacén de Materia Prima, Mantenimiento, Calidad y ' +
      `Aseguramiento. 3 h 22 min grabadas + ${VIA} h de traslado + 2 h de espera y notas.`,
  },
  {
    fecha: '2026-08-22',
    perfil: 'desarrollador_ia',
    horas: 6,
    persona: 'Boosty',
    entregable: 'gestion',
    descripcion:
      'El importador de transcripciones con el mapa de hablantes, el cargador de hallazgos, ' +
      'la subida de documentos al expediente y el módulo del programa con su migración.',
  },
  {
    fecha: '2026-08-22',
    perfil: 'consultor_procesos',
    horas: 12,
    persona: 'Boosty',
    entregable: 'levantamiento',
    descripcion:
      'Lectura de las nueve entrevistas completas y extracción de los 236 hallazgos con su ' +
      'cita, más la identificación de hablantes uno por uno.',
  },
  {
    fecha: '2026-08-22',
    perfil: 'director_arquitecto',
    horas: 8,
    persona: 'Gabriel Montiel Toro',
    entregable: 'gestion',
    // Trabajo sobre los **términos** del encargo, no sobre sus entregables:
    // leerse la propuesta y el contrato firmados para fijar el calendario de
    // entrega. Se imputa a la etapa anterior, que es donde se acordaron.
    imputacion: 'fase_0',
    descripcion:
      'Lectura completa de la propuesta y del contrato firmados, reordenamiento del plan por ' +
      'los siete entregables de la cláusula 5, y el adelanto del calendario al 6 de diciembre ' +
      'por la colisión con el aviso de no renovación.',
  },
  {
    fecha: '2026-08-25',
    perfil: 'consultor_procesos',
    horas: 5,
    persona: 'Boosty',
    entregable: 'levantamiento',
    descripcion:
      'Preparación de la ronda 2: reparto de las diez en dos pistas, coordinación de agendas ' +
      'con planta, y la reubicación de la fila 5 al caer que Comercial y Mercadeo despachan ' +
      'desde Caracas.',
  },
  {
    fecha: '2026-08-26',
    perfil: 'director_arquitecto',
    horas: 11,
    persona: 'Gabriel Montiel Toro',
    entregable: 'formacion',
    descripcion:
      'Sesión IA Petit Comité, la primera de las tres formaciones. 4 h 00 min grabadas + 4 h ' +
      'de preparación —licencias, prueba del acceso, ejemplos por área— + ' +
      `${VIA} h de traslado. La sala quedó en seis de Iberia y dos de Boosty.`,
  },
  {
    fecha: '2026-08-26',
    perfil: 'consultor_procesos',
    horas: 7,
    persona: 'Amanda Leañez',
    entregable: 'formacion',
    descripcion:
      'Acompañamiento de la formación directiva en Caracas: apoyo en sala mientras cada ' +
      `participante montaba su cuenta y su primer artefacto. 4 h de sala + ${VIA} h de traslado.`,
  },
  {
    fecha: '2026-08-27',
    perfil: 'consultor_procesos',
    horas: 10,
    persona: 'Jesús Planas',
    entregable: 'levantamiento',
    descripcion:
      'Pista A de la ronda 2, cuatro entrevistas en Cagua: Dirección de Finanzas, Contabilidad ' +
      'y Costos, Tesorería con Impuestos y Cuentas por Pagar, y Recursos Humanos con ' +
      `Administración de Personal. 5 h 10 min grabadas + ${VIA} h de traslado + 2 h de espera ` +
      'entre citas y notas.',
  },
  {
    fecha: '2026-08-27',
    perfil: 'consultor_procesos',
    horas: 11,
    persona: 'Ruth Velázquez',
    entregable: 'levantamiento',
    descripcion:
      'Pista B de la ronda 2, seis entrevistas en Cagua: Operaciones, Compras, Prevención de ' +
      'Pérdidas, Seguridad y Salud, Gestión de la Calidad con Laboratorio, y Servicios ' +
      `Generales. 5 h 41 min grabadas + ${VIA} h de traslado + 2 h de espera y notas.`,
  },
  {
    fecha: '2026-08-27',
    perfil: 'consultor_senior',
    horas: 2,
    persona: 'Carlos Quintana',
    entregable: 'comunicacion',
    descripcion:
      'Reunión de comunicaciones con Fuguet Comunicación y Cambio: la nota del boletín después ' +
      'del comunicado, y el planteamiento del comité de comunicaciones a tres patas —Iberia, ' +
      'comunicaciones y consultoría—. 31 min de llamada + preparación.',
  },
  {
    fecha: '2026-08-31',
    perfil: 'desarrollador_ia',
    horas: 4,
    persona: 'Boosty',
    entregable: 'levantamiento',
    descripcion:
      'Carga de la ronda 2 y de la formación directiva: doce transcripciones —11.522 turnos— ' +
      'con su mapa de hablantes triangulado uno por uno, los nombres y cargos cotejados contra ' +
      'el padrón de Capital Humano, y las fichas de las quince personas nuevas.',
  },
]

// -----------------------------------------------------------------------------

let nuevas = 0
let actualizadas = 0

for (const r of HORAS) {
  const { data: existente } = await admin
    .from('registros_horas')
    .select('id')
    .eq('fecha', r.fecha)
    .eq('descripcion', r.descripcion)
    .maybeSingle()

  if (revisar) continue

  if (existente) {
    await admin.from('registros_horas').update(r).eq('id', existente.id)
    actualizadas++
  } else {
    const { error } = await admin.from('registros_horas').insert(r)
    if (error) {
      console.error(`\n✖ ${r.fecha} ${r.descripcion.slice(0, 50)}: ${error.message}\n`)
      process.exit(1)
    }
    nuevas++
  }
}

// --- Huérfanas ----------------------------------------------------------------
//
// La idempotencia va por (fecha, descripción), así que **cambiarle el texto a una
// partida deja la vieja viva** y las horas se cuentan dos veces. Pasó: al mover el
// dashboard de `app` a `gestion` se le tocó la descripción y quedaron 40 h
// fantasma que la pantalla sí sumaba. Ahora se avisa, y con `--limpiar` se borran.
{
  const { data: enBase } = await admin.from('registros_horas').select('id, fecha, descripcion, horas')
  const conocidas = new Set(HORAS.map((r) => `${r.fecha}|${r.descripcion}`))
  const huerfanas = (enBase ?? []).filter((r) => !conocidas.has(`${r.fecha}|${r.descripcion}`))

  if (huerfanas.length) {
    const limpiar = process.argv.includes('--limpiar')
    console.log(
      `\n⚠️  ${huerfanas.length} partidas en la base que no están en este archivo ` +
        `(${huerfanas.reduce((t, r) => t + Number(r.horas), 0)} h):`
    )
    for (const h of huerfanas) console.log(`     · ${h.fecha}  ${h.horas} h  ${h.descripcion.slice(0, 60)}…`)
    if (limpiar && !revisar) {
      await admin.from('registros_horas').delete().in('id', huerfanas.map((h) => h.id))
      console.log('   Borradas.')
    } else {
      console.log('   Pueden ser cargadas a mano desde el panel — o restos de una')
      console.log('   descripción que cambió. Para borrarlas: --limpiar\n')
    }
  }
}

// --- El resumen, que es lo que se mira ---------------------------------------

// El corte va por **mes**, no por día, igual que `consumeBolsa()` en
// `lib/programa.ts`: el fee se factura por mes calendario y una fila mensual que
// mezclara horas que cuentan con horas que no, no se podría leer. Lo del 1 al 5
// de agosto que es cierre de la etapa anterior —el deck y la negociación
// contractual— se saca con `imputacion: 'fase_0'`, no con la fecha. Si el script
// y la pantalla usaran criterios distintos, el reporte diría dos cosas.
const MES_FIRMA = '2026-08'
const enFase = (r) => r.fecha.slice(0, 7) >= MES_FIRMA
const imputacionDe = (r) => r.imputacion ?? 'bolsa'
const enBolsa = (r) => imputacionDe(r) === 'bolsa'

const previas = HORAS.filter((r) => !enFase(r) || imputacionDe(r) === 'fase_0')
const fase = HORAS.filter((r) => enFase(r) && enBolsa(r))
const faseAparte = HORAS.filter(
  (r) => enFase(r) && !enBolsa(r) && imputacionDe(r) !== 'fase_0'
)
const suma = (l) => l.reduce((t, r) => t + r.horas, 0)

const porPerfil = {}
for (const r of fase) porPerfil[r.perfil] = (porPerfil[r.perfil] ?? 0) + r.horas

const CUOTA = {
  consultor_senior: 6,
  director_arquitecto: 20,
  consultor_procesos: 36,
  desarrollador_ia: 45,
}

console.log(`\n── Etapa anterior · Fase 0, no descuenta bolsa`)
console.log(`   ${suma(previas)} h en ${previas.length} partidas`)

console.log(`\n── Mes 1 · agosto, desde el 6`)
for (const p of ['consultor_senior', 'director_arquitecto', 'consultor_procesos', 'desarrollador_ia']) {
  const h = porPerfil[p] ?? 0
  const d = h - CUOTA[p]
  const señal = d === 0 ? '  = su cuota' : `  ${d > 0 ? '+' : '−'}${Math.abs(d)} sobre ${CUOTA[p]} h`
  console.log(`   ${p.padEnd(22)} ${String(h).padStart(6)} h${señal}`)
}
console.log(`   ${'TOTAL'.padEnd(22)} ${String(suma(fase)).padStart(6)} h  de 107 h de bolsa`)

if (faseAparte.length) {
  console.log(`\n── Fuera de la bolsa · se factura aparte en la Fase 2`)
  console.log(`   ${suma(faseAparte)} h en ${faseAparte.length} partidas — el curso de planta`)
}

console.log(
  revisar ? '\nRevisión: no se escribió nada.\n' : `\n${nuevas} nuevas · ${actualizadas} actualizadas.\n`
)

console.log('⚠️  Son estimaciones por entregable, no un parte de trabajo. Cada partida dice')
console.log('   de dónde sale su número; corrígelas desde /dashboard/programa.\n')
