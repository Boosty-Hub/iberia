/**
 * Verifica la deducción de los datos de la entrevista a partir del archivo,
 * que es lo que permite cargar sin escribir nada.
 *
 *   node --experimental-strip-types scripts/probar-derivacion.ts
 */

import { parsearTranscripcion } from '../lib/fireflies.ts'
import { derivarEntrevista, type AreaMinima } from '../lib/entrevista-desde-transcripcion.ts'

const AREAS: AreaMinima[] = [
  { id: 'a-gg', nombre: 'Gerencia General', slug: 'gerencia-general' },
  { id: 'a-com', nombre: 'Comercial y Ventas', slug: 'comercial' },
  { id: 'a-prod', nombre: 'Producción', slug: 'produccion' },
  { id: 'a-plan', nombre: 'Planificación', slug: 'planificacion' },
  { id: 'a-log', nombre: 'Logística y Despacho', slug: 'logistica' },
  { id: 'a-fin', nombre: 'Finanzas', slug: 'finanzas' },
  { id: 'a-rrhh', nombre: 'Recursos Humanos', slug: 'rrhh' },
  { id: 'a-sis', nombre: 'Sistemas / TI', slug: 'sistemas' },
]

let fallos = 0
let pruebas = 0

function verificar(nombre: string, condicion: boolean, detalle?: unknown) {
  pruebas++
  if (condicion) console.log(`  ✔ ${nombre}`)
  else {
    fallos++
    console.log(`  ✖ ${nombre}`)
    if (detalle !== undefined) console.log('     obtenido:', JSON.stringify(detalle))
  }
}

function titulo(t: string) {
  console.log(`\n── ${t}`)
}

// -----------------------------------------------------------------------------
titulo('Markdown típico · el entrevistado es quien más habla')

const md = `# Entrevista Gerente de Producción — Planta Cagua

**Date:** 2026-08-05
**Duration:** 47 mins
**Participants:** Gabriel Montiel, Luis Pérez

## Overview

Se revisó el flujo de planificación de producción en la planta de Cagua.

## Transcript

**Gabriel Montiel** 00:03
¿Cómo entra un pedido?

**Luis Pérez** 00:18
El pedido entra por el vendedor, lo mete en el ERP y de ahí nosotros lo vemos en un
reporte que sacamos en Excel todas las mañanas. Ese reporte lo armo yo a mano, me toma
como hora y media, y si el vendedor cargó mal algo hay que devolverse hasta el origen
para corregirlo antes de programar la línea.

**Gabriel Montiel** 01:02
¿Y eso lo haces todos los días?

**Luis Pérez** 01:05
Todos los días sin falta, incluso los sábados cuando hay producción. Llevo años con
esa rutina y sin ese Excel la planta no sabe qué correr.
`

const a = derivarEntrevista(parsearTranscripcion(md, 'ent.md'), AREAS, 'ent.md')
verificar('entrevistado = quien más habla', a.entrevistadoNombre === 'Luis Pérez', a.entrevistadoNombre)
verificar('entrevistador = el otro', a.entrevistador === 'Gabriel Montiel', a.entrevistador)
verificar('confianza alta', a.confianza === 'alta', a.confianza)
verificar('cargo desde el título', /Gerente de Producci/i.test(a.entrevistadoCargo ?? ''), a.entrevistadoCargo)
verificar('área = Producción', a.areaNombre === 'Producción', a.areaNombre)
verificar('sede = cagua', a.sede === 'cagua', a.sede)
verificar('fecha', a.fecha === '2026-08-05', a.fecha)
verificar('duración', a.duracionMinutos === 47, a.duracionMinutos)
verificar('resumen', !!a.resumen?.includes('planificación'), a.resumen)
verificar('dos hablantes perfilados', a.hablantes.length === 2, a.hablantes)
verificar(
  'el entrevistado acumula más palabras',
  a.hablantes[0].palabras > a.hablantes[1].palabras,
  a.hablantes
)

// -----------------------------------------------------------------------------
titulo('JSON de la API · hablantes como correos')

const json = JSON.stringify({
  title: 'Entrevista Finanzas - Conciliación bancaria',
  date: 1786464000000,
  duration: 52,
  transcript_url: 'https://app.fireflies.ai/view/xyz789',
  summary: { overview: 'La conciliación bancaria es manual y toma dos días al mes.' },
  sentences: [
    { speaker_name: 'gabriel.montiel@boosty.com', text: '¿Cómo concilian?', start_time: 1 },
    {
      speaker_name: 'maria.gomez@iberia.com',
      text: 'A mano, con el estado de cuenta del banco, revisando partida por partida hasta que cuadra el saldo del mes completo.',
      start_time: 5,
    },
    {
      speaker_name: 'maria.gomez@iberia.com',
      text: 'Nos toma dos días completos y siempre queda alguna diferencia que hay que buscar.',
      start_time: 20,
    },
  ],
})

const b = derivarEntrevista(parsearTranscripcion(json, 'ent.json'), AREAS, 'ent.json')
verificar('correo → nombre presentable', b.entrevistadoNombre === 'Maria Gomez', b.entrevistadoNombre)
verificar('entrevistador desde correo', b.entrevistador === 'Gabriel Montiel', b.entrevistador)
verificar('área = Finanzas', b.areaNombre === 'Finanzas', b.areaNombre)
verificar('url de Fireflies', b.firefliesUrl === 'https://app.fireflies.ai/view/xyz789', b.firefliesUrl)
verificar('duración 52', b.duracionMinutos === 52, b.duracionMinutos)

// -----------------------------------------------------------------------------
titulo('Un solo hablante')

const unico = `## Transcript

**Ana Rodríguez** 00:01
Yo llevo toda la cobranza sola desde hace tres años.
`
const c = derivarEntrevista(parsearTranscripcion(unico, 'x.md'), AREAS, 'x.md')
verificar('entrevistado detectado', c.entrevistadoNombre === 'Ana Rodríguez', c.entrevistadoNombre)
verificar('sin entrevistador', c.entrevistador === null, c.entrevistador)

// -----------------------------------------------------------------------------
titulo('Sin hablantes · cae al título y luego al archivo')

const soloTexto = `# Entrevista Carmen Ruiz

Notas sueltas de la conversación, sin marcas de hablante.
`
const d = derivarEntrevista(parsearTranscripcion(soloTexto, 'x.md'), AREAS, 'x.md')
verificar('nombre desde el título', d.entrevistadoNombre === 'Carmen Ruiz', d.entrevistadoNombre)
verificar('confianza media', d.confianza === 'media', d.confianza)

const sinNada = derivarEntrevista(
  parsearTranscripcion('Texto plano cualquiera sin nada.', 'entrevista_pedro_silva.md'),
  AREAS,
  'entrevista_pedro_silva.md'
)
verificar(
  'cae al nombre del archivo',
  sinNada.entrevistadoNombre === 'entrevista pedro silva',
  sinNada.entrevistadoNombre
)
verificar('confianza baja', sinNada.confianza === 'baja', sinNada.confianza)

// -----------------------------------------------------------------------------
titulo('Área: gana el nombre más largo y específico')

const logistica = `# Entrevista Logística y Despacho

## Transcript

**Pedro Silva** 00:01
Despachamos por orden de llegada y coordinamos con el almacén cada mañana.
`
const e = derivarEntrevista(parsearTranscripcion(logistica, 'x.md'), AREAS, 'x.md')
verificar('área = Logística y Despacho', e.areaNombre === 'Logística y Despacho', e.areaNombre)

const sinArea = derivarEntrevista(
  parsearTranscripcion('# Conversación general\n\n**Juan Diaz** 00:01\nHola.', 'x.md'),
  AREAS,
  'x.md'
)
verificar('sin área cuando no hay señal', sinArea.areaId === null, sinArea.areaNombre)

// -----------------------------------------------------------------------------
titulo('El título no debe confundir cargo con nombre')

const soloCargo = derivarEntrevista(
  parsearTranscripcion('# Entrevista Coordinador de Compras\n\n**Luis Mota** 00:01\nBuenas.', 'x.md'),
  AREAS,
  'x.md'
)
verificar('nombre del hablante, no del cargo', soloCargo.entrevistadoNombre === 'Luis Mota', soloCargo.entrevistadoNombre)
verificar(
  'cargo detectado aparte',
  /Coordinador de Compras/i.test(soloCargo.entrevistadoCargo ?? ''),
  soloCargo.entrevistadoCargo
)

// -----------------------------------------------------------------------------
console.log(`\n${'─'.repeat(52)}`)
if (fallos === 0) {
  console.log(`✔ ${pruebas} verificaciones de deducción, todas en verde\n`)
} else {
  console.log(`✖ ${fallos} de ${pruebas} verificaciones fallaron\n`)
  process.exit(1)
}
