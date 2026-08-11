/**
 * Prueba de humo del parser de Fireflies contra los formatos de export reales.
 *
 *   node --experimental-strip-types scripts/probar-fireflies.ts
 *
 * Cubre: markdown con hablante en negrita, markdown con timestamp al frente,
 * "Nombre: texto" sin timestamps, JSON de la API, y los falsos positivos que
 * rompían el parser (horas dentro de una frase).
 */

import { parsearTranscripcion, parsearTiempo, parsearFecha } from '../lib/fireflies.ts'

let fallos = 0
let pruebas = 0

function verificar(nombre: string, condicion: boolean, detalle?: unknown) {
  pruebas++
  if (condicion) {
    console.log(`  ✔ ${nombre}`)
  } else {
    fallos++
    console.log(`  ✖ ${nombre}`)
    if (detalle !== undefined) console.log('     obtenido:', JSON.stringify(detalle))
  }
}

function titulo(t: string) {
  console.log(`\n── ${t}`)
}

// -----------------------------------------------------------------------------
titulo('Utilidades de tiempo y fecha')

verificar('mm:ss → segundos', parsearTiempo('12:34') === 754, parsearTiempo('12:34'))
verificar('h:mm:ss → segundos', parsearTiempo('1:02:03') === 3723, parsearTiempo('1:02:03'))
verificar('número crudo pasa igual', parsearTiempo(78.5) === 78.5)
verificar('vacío → null', parsearTiempo('') === null)
verificar('basura → null', parsearTiempo('hola') === null)
verificar('ISO se recorta', parsearFecha('2026-08-05T14:00:00Z') === '2026-08-05')
verificar('dd/mm/yyyy en orden local', parsearFecha('05/08/2026') === '2026-08-05', parsearFecha('05/08/2026'))
verificar('epoch ms', parsearFecha(1786464000000)?.startsWith('2026-') === true, parsearFecha(1786464000000))

// -----------------------------------------------------------------------------
titulo('Markdown de Fireflies · hablante en negrita')

const mdNegrita = `# Entrevista Gerencia de Producción

**Date:** 2026-08-05
**Duration:** 47 mins
**Participants:** Gabriel Montiel, Luis Pérez

## Overview

Se revisó el flujo de planificación de producción y la dependencia de reportes
armados a mano en Excel cada mañana.

## Action Items

- Luis Pérez: enviar el maestro de materiales
- Gabriel Montiel: agendar visita a planta

## Transcript

**Gabriel Montiel** 00:03
Buenos días Luis, gracias por el tiempo. Cuéntame cómo entra un pedido hoy.

**Luis Pérez** 00:18
El pedido entra por el vendedor, lo mete en el ERP y de ahí nosotros lo vemos
en un reporte que sacamos en Excel todas las mañanas.

**Gabriel Montiel** 01:02
¿Ese Excel lo armas tú?

**Luis Pérez** 01:05
Sí, lo armo yo. Me toma como hora y media cada mañana.
`

const a = parsearTranscripcion(mdNegrita, 'entrevista.md')
verificar('formato markdown', a.formato === 'markdown')
verificar('título del H1', a.titulo === 'Entrevista Gerencia de Producción', a.titulo)
verificar('fecha del encabezado', a.fecha === '2026-08-05', a.fecha)
verificar('duración en minutos', a.duracionMinutos === 47, a.duracionMinutos)
verificar('2 participantes', a.participantes.length === 2, a.participantes)
verificar('4 turnos', a.segmentos.length === 4, a.segmentos.length)
verificar('2 hablantes distintos', a.hablantes.length === 2, a.hablantes)
verificar('primer hablante', a.segmentos[0]?.hablante === 'Gabriel Montiel', a.segmentos[0]?.hablante)
verificar('primer timestamp = 3s', a.segmentos[0]?.inicioSegundos === 3, a.segmentos[0]?.inicioSegundos)
verificar(
  'el turno multilínea se une',
  a.segmentos[1]?.texto.includes('Excel todas las mañanas'),
  a.segmentos[1]?.texto
)
verificar('resumen tomado del Overview', !!a.resumen?.includes('planificación'), a.resumen)
verificar('action items en meta', !!a.meta.action_items, a.meta.action_items)
verificar(
  'el resumen no contamina la transcripción',
  !a.segmentos.some((s) => s.texto.includes('Se revisó el flujo')),
  a.segmentos.map((s) => s.texto.slice(0, 30))
)
verificar('fin del turno = inicio del siguiente', a.segmentos[0]?.finSegundos === 18, a.segmentos[0]?.finSegundos)

// -----------------------------------------------------------------------------
titulo('Markdown · timestamp al frente, sin encabezados')

const mdTimestamp = `Transcript

[00:00] Ana Rodríguez: Buenos días, arranquemos.
[00:12] Carlos Díaz: Perfecto. Te cuento que el cierre lo hacemos manual.
[01:30] Ana Rodríguez: ¿Cuánto te toma?
`

const b = parsearTranscripcion(mdTimestamp, 'x.md')
verificar('3 turnos', b.segmentos.length === 3, b.segmentos.length)
verificar(
  'la etiqueta "Transcript" no se cuela como turno',
  !b.segmentos.some((s) => /^transcript$/i.test(s.texto)),
  b.segmentos.map((s) => s.texto)
)
verificar('hablante correcto', b.segmentos[0]?.hablante === 'Ana Rodríguez', b.segmentos[0]?.hablante)
verificar('timestamp 90s', b.segmentos[2]?.inicioSegundos === 90, b.segmentos[2]?.inicioSegundos)

// -----------------------------------------------------------------------------
titulo('Markdown · "Nombre: texto" sin timestamps')

const mdSimple = `Pedro Silva: Nosotros despachamos por orden de llegada.
Gabriel Montiel: ¿Y cómo priorizan cuando hay retraso?
Pedro Silva: Llamamos al cliente y reacomodamos la ruta.
`

const c = parsearTranscripcion(mdSimple, 'x.md')
verificar('3 turnos por fallback simple', c.segmentos.length === 3, c.segmentos.length)
verificar('hablantes detectados', c.hablantes.length === 2, c.hablantes)

// -----------------------------------------------------------------------------
titulo('Markdown · nombre entre paréntesis')

const mdParen = `## Transcripción

María Gómez (00:05): La conciliación la hago contra el estado de cuenta.
Gabriel Montiel (00:22): ¿Bajas el estado de cuenta del banco a mano?
`

const d = parsearTranscripcion(mdParen, 'x.md')
verificar('2 turnos', d.segmentos.length === 2, d.segmentos.length)
verificar('hablante sin paréntesis', d.segmentos[0]?.hablante === 'María Gómez', d.segmentos[0]?.hablante)
verificar('timestamp 5s', d.segmentos[0]?.inicioSegundos === 5, d.segmentos[0]?.inicioSegundos)

// -----------------------------------------------------------------------------
titulo('Regresión · una hora dentro de la frase no crea hablante')

const mdHoraEnFrase = `## Transcript

**Luis Pérez** 00:18
Llegamos a las 10:30 todos los días y el reporte sale a las 11:00 en punto.
Nos reunimos 08:00 en el galpón para revisar la carga.
`

const e = parsearTranscripcion(mdHoraEnFrase, 'x.md')
verificar('sigue siendo 1 turno', e.segmentos.length === 1, e.segmentos.length)
verificar('un solo hablante', e.hablantes.length === 1, e.hablantes)
verificar(
  'el texto con horas queda íntegro',
  e.segmentos[0]?.texto.includes('10:30') && e.segmentos[0]?.texto.includes('08:00'),
  e.segmentos[0]?.texto
)

// -----------------------------------------------------------------------------
titulo('JSON de la API de Fireflies')

const json = JSON.stringify({
  title: 'Entrevista Finanzas',
  date: 1786464000000,
  duration: 52,
  transcript_url: 'https://app.fireflies.ai/view/abc123',
  participants: [{ name: 'María Gómez' }, 'Gabriel Montiel'],
  summary: {
    overview: 'La conciliación bancaria es manual y toma dos días al mes.',
    action_items: '- Solicitar accesos de lectura al ERP',
    keywords: ['conciliación', 'cobranzas'],
  },
  sentences: [
    { index: 0, speaker_name: 'Gabriel Montiel', raw_text: '¿Cómo concilian hoy?', text: '¿Cómo concilian hoy?', start_time: 3.2, end_time: 6.1 },
    { index: 1, speaker_name: 'María Gómez', text: 'A mano, con el estado de cuenta del banco.', start_time: 6.4, end_time: 11 },
    { index: 2, speaker_id: 0, text: '¿Y cuánto tiempo te toma?', start_time: 11.5, end_time: 13 },
  ],
})

const f = parsearTranscripcion(json, 'entrevista.json')
verificar('formato json', f.formato === 'json')
verificar('título', f.titulo === 'Entrevista Finanzas', f.titulo)
verificar('duración 52 min', f.duracionMinutos === 52, f.duracionMinutos)
verificar('3 turnos', f.segmentos.length === 3, f.segmentos.length)
verificar('participantes mixtos string/objeto', f.participantes.length === 2, f.participantes)
verificar('resumen del overview', !!f.resumen?.includes('conciliación'), f.resumen)
verificar('keywords en meta', Array.isArray(f.meta.keywords), f.meta.keywords)
verificar('url de fireflies en meta', f.meta.fireflies_url === 'https://app.fireflies.ai/view/abc123', f.meta.fireflies_url)
verificar('speaker_id → etiqueta', f.segmentos[2]?.hablante === 'Hablante 1', f.segmentos[2]?.hablante)
verificar('tiempos decimales', f.segmentos[0]?.inicioSegundos === 3.2, f.segmentos[0]?.inicioSegundos)

// -----------------------------------------------------------------------------
titulo('JSON envuelto en data.transcript')

const jsonEnvuelto = JSON.stringify({
  data: {
    transcript: {
      title: 'Entrevista Comercial',
      sentences: [{ speaker_name: 'Ana', text: 'Hola', start_time: 0 }],
    },
  },
})

const g = parsearTranscripcion(jsonEnvuelto, 'x.json')
verificar('desenvuelve data.transcript', g.titulo === 'Entrevista Comercial', g.titulo)
verificar('1 turno', g.segmentos.length === 1, g.segmentos.length)

// -----------------------------------------------------------------------------
titulo('Casos límite')

const vacio = parsearTranscripcion('', 'x.md')
verificar('archivo vacío avisa', vacio.advertencias.length > 0 && vacio.segmentos.length === 0)

const jsonRoto = parsearTranscripcion('{ "sentences": [ ', 'x.json')
verificar('JSON roto avisa y no lanza', jsonRoto.advertencias.length > 0, jsonRoto.advertencias)

const soloTexto = parsearTranscripcion(
  'Esto es una nota suelta sin ninguna marca de hablante ni timestamps.',
  'x.md'
)
verificar('texto plano entra como bloque único', soloTexto.segmentos.length === 1, soloTexto.segmentos.length)
verificar('y avisa que no reconoció hablantes', soloTexto.advertencias.length > 0, soloTexto.advertencias)

// -----------------------------------------------------------------------------
console.log(`\n${'─'.repeat(52)}`)
if (fallos === 0) {
  console.log(`✔ ${pruebas} verificaciones, todas en verde\n`)
} else {
  console.log(`✖ ${fallos} de ${pruebas} verificaciones fallaron\n`)
  process.exit(1)
}
