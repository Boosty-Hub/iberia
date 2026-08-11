/**
 * Prueba de extremo a extremo de la importación de entrevistas, por la UI real.
 *
 *   node --env-file=.env.local scripts/probar-importacion.mjs --password "<clave>"
 *
 * Sube los archivos de ejemplos/fireflies/ por el navegador, confirma que el
 * sistema dedujo los datos, crea las entrevistas, verifica en base que quedaron
 * bien (incluida la transcripción) y **borra lo que creó**.
 *
 * Con --conservar no borra, para poder mirar el resultado en la app.
 */

import { chromium } from 'playwright'
import { createClient } from '@supabase/supabase-js'
import { mkdir } from 'node:fs/promises'
import { join, resolve } from 'node:path'

const args = {}
for (let i = 2; i < process.argv.length; i++) {
  if (process.argv[i].startsWith('--')) {
    const siguiente = process.argv[i + 1]
    args[process.argv[i].slice(2)] = siguiente && !siguiente.startsWith('--') ? siguiente : 'true'
  }
}

const BASE = process.env.BASE_URL ?? 'http://localhost:3000'
const EMAIL = args.email ?? 'gmontiel@spatiumgroup.com'
const CLAVE = args.password
const CONSERVAR = args.conservar === 'true'
const SALIDA = 'capturas'

if (!CLAVE) {
  console.error('\n✖ Falta --password.\n')
  process.exit(1)
}

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false },
})

let fallos = 0
let pruebas = 0
function verificar(nombre, condicion, detalle) {
  pruebas++
  if (condicion) console.log(`  ✔ ${nombre}`)
  else {
    fallos++
    console.log(`  ✖ ${nombre}`)
    if (detalle !== undefined) console.log('     ', JSON.stringify(detalle))
  }
}

const ARCHIVOS = [
  resolve('ejemplos/fireflies/entrevista-produccion.md'),
  resolve('ejemplos/fireflies/entrevista-finanzas.json'),
]

await mkdir(SALIDA, { recursive: true })

// Se anota qué había antes para borrar solo lo que cree esta prueba.
const { data: previas } = await admin.from('entrevistas').select('id')
const idsPrevias = new Set((previas ?? []).map((e) => e.id))

const navegador = await chromium.launch()
const contexto = await navegador.newContext({
  viewport: { width: 1440, height: 1000 },
  deviceScaleFactor: 2,
  locale: 'es-VE',
})
const pagina = await contexto.newPage()

const errores = []
pagina.on('console', (m) => {
  if (m.type() === 'error' && !/React DevTools|\[HMR\]/.test(m.text())) errores.push(m.text())
})
pagina.on('pageerror', (e) => errores.push(e.message))

try {
  // --- Entrar -----------------------------------------------------------------
  await pagina.goto(`${BASE}/login`, { waitUntil: 'networkidle' })
  await pagina.fill('#email', EMAIL)
  await pagina.fill('#password', CLAVE)
  await pagina.click('button[type="submit"]')
  await pagina.waitForURL(/\/dashboard/, { timeout: 30000 })

  // --- Cargar los archivos ----------------------------------------------------
  console.log('\n── Deducción a partir de los archivos')
  await pagina.goto(`${BASE}/dashboard/entrevistas/importar`, { waitUntil: 'networkidle' })
  await pagina.setInputFiles('input[type="file"]', ARCHIVOS)
  await pagina.waitForSelector('text=Crear 2 entrevistas', { timeout: 15000 })

  const tarjetas = pagina.locator('ul > li.tarjeta')
  verificar('se listan las dos entrevistas', (await tarjetas.count()) === 2, await tarjetas.count())

  // Los valores deducidos aparecen ya escritos en el formulario.
  const nombres = await pagina.locator('input[placeholder="Nombre y apellido"]').all()
  const valores = await Promise.all(nombres.map((n) => n.inputValue()))
  verificar('entrevistado deducido en ambos', valores.includes('Luis Pérez') && valores.includes('María Gómez'), valores)

  const cargos = await Promise.all(
    (await pagina.locator('input[placeholder="Opcional"]').all()).map((c) => c.inputValue())
  )
  verificar('cargo deducido del título', cargos.some((c) => /Gerente de Producci/i.test(c)), cargos)

  const areas = await Promise.all(
    (await pagina.locator('select').all()).map((s) => s.inputValue())
  )
  verificar('se preseleccionó un área en ambas', areas.filter(Boolean).length >= 2, areas)

  await pagina.screenshot({ path: join(SALIDA, '12-importar-previa.png'), fullPage: true })
  console.log('  12-importar-previa.png')

  // --- Crear ------------------------------------------------------------------
  console.log('\n── Creación')
  await pagina.click('text=Crear 2 entrevistas')
  await pagina.waitForSelector('text=turnos cargados', { timeout: 60000 })
  await pagina.waitForTimeout(1500)
  await pagina.screenshot({ path: join(SALIDA, '13-importar-resultado.png'), fullPage: true })
  console.log('  13-importar-resultado.png')

  // --- Verificar en base ------------------------------------------------------
  const { data: todas } = await admin
    .from('entrevistas')
    .select('id, codigo, entrevistado_nombre, entrevistado_cargo, sede, fecha_entrevista, duracion_minutos, estado, resumen, entrevistador, areas(nombre)')
  const nuevas = (todas ?? []).filter((e) => !idsPrevias.has(e.id))

  verificar('se crearon 2 entrevistas', nuevas.length === 2, nuevas.length)

  const produccion = nuevas.find((e) => e.entrevistado_nombre === 'Luis Pérez')
  const finanzas = nuevas.find((e) => e.entrevistado_nombre === 'María Gómez')

  verificar('markdown → Luis Pérez', !!produccion, nuevas.map((e) => e.entrevistado_nombre))
  verificar('json → María Gómez', !!finanzas)

  if (produccion) {
    verificar('  área Producción', produccion.areas?.nombre === 'Producción', produccion.areas?.nombre)
    verificar('  sede Cagua', produccion.sede === 'cagua', produccion.sede)
    verificar('  fecha 2026-08-05', produccion.fecha_entrevista === '2026-08-05', produccion.fecha_entrevista)
    verificar('  duración 47 min', produccion.duracion_minutos === 47, produccion.duracion_minutos)
    verificar('  entrevistador Gabriel Montiel', produccion.entrevistador === 'Gabriel Montiel', produccion.entrevistador)
    verificar('  estado transcrita', produccion.estado === 'transcrita', produccion.estado)
    verificar('  resumen cargado', !!produccion.resumen?.includes('planificación'), produccion.resumen?.slice(0, 60))
    verificar('  código consecutivo', /^ENT-\d{3}$/.test(produccion.codigo), produccion.codigo)

    const { data: seg } = await admin
      .from('transcripcion_segmentos')
      .select('hablante, texto, inicio_segundos')
      .eq('entrevista_id', produccion.id)
      .order('indice')
    verificar('  transcripción con 8 turnos', seg?.length === 8, seg?.length)
    verificar('  primer turno del entrevistador', seg?.[0]?.hablante === 'Gabriel Montiel', seg?.[0]?.hablante)
    verificar(
      '  el texto llegó íntegro',
      !!seg?.some((s) => s.texto.includes('paramos una línea seis horas')),
      seg?.length
    )
  }

  if (finanzas) {
    verificar('  área Finanzas', finanzas.areas?.nombre === 'Finanzas', finanzas.areas?.nombre)
    verificar('  duración 52 min', finanzas.duracion_minutos === 52, finanzas.duracion_minutos)
    const { data: seg } = await admin
      .from('transcripcion_segmentos')
      .select('hablante')
      .eq('entrevista_id', finanzas.id)
    verificar('  transcripción con 6 turnos', seg?.length === 6, seg?.length)
  }

  // --- La lista las muestra ---------------------------------------------------
  console.log('\n── La lista ya las muestra')
  await pagina.goto(`${BASE}/dashboard/entrevistas`, { waitUntil: 'networkidle' })
  const textoLista = await pagina.textContent('body')
  verificar('aparecen en el listado', textoLista.includes('Luis Pérez') && textoLista.includes('María Gómez'))
  await pagina.screenshot({ path: join(SALIDA, '14-entrevistas-con-datos.png'), fullPage: true })
  console.log('  14-entrevistas-con-datos.png')

  if (produccion) {
    await pagina.goto(`${BASE}/dashboard/entrevistas/${produccion.id}`, { waitUntil: 'networkidle' })
    await pagina.screenshot({ path: join(SALIDA, '15-entrevista-detalle.png'), fullPage: true })
    console.log('  15-entrevista-detalle.png')
  }

  verificar('sin errores de consola', errores.length === 0, errores.slice(0, 2))
} finally {
  await navegador.close()

  console.log('\n── Limpieza')
  if (CONSERVAR) {
    console.log('  (--conservar: las entrevistas de prueba se dejan en la app)')
  } else {
    const { data: todas } = await admin.from('entrevistas').select('id')
    const aBorrar = (todas ?? []).map((e) => e.id).filter((id) => !idsPrevias.has(id))
    if (aBorrar.length) {
      // Los segmentos caen por ON DELETE CASCADE.
      const { error } = await admin.from('entrevistas').delete().in('id', aBorrar)
      console.log(error ? `  ✖ ${error.message}` : `  ✔ ${aBorrar.length} entrevista(s) de prueba borrada(s)`)
    } else {
      console.log('  (nada que borrar)')
    }
  }
}

console.log(`\n${'─'.repeat(52)}`)
if (fallos === 0) console.log(`✔ ${pruebas} verificaciones de importación, todas en verde\n`)
else {
  console.log(`✖ ${fallos} de ${pruebas} verificaciones fallaron\n`)
  process.exit(1)
}
