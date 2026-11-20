/**
 * Captura de tasas a mano (o desde un programador): BCV verificado contra
 * DolarApi, y el paralelo de DolarApi. Por defecto contra el proyecto de PRUEBAS.
 *
 *   node --env-file=.env.local scripts/plataforma/capturar-tasas.mjs
 *   … --solo-paralelo
 *   … --historico 30     # siembra 30 días de la serie de DolarApi (solo pruebas)
 *   … --destino produccion --confirmo
 */
import { createClient } from '@supabase/supabase-js'
import { capturarTasas } from '../../lib/tasas/capturar.mjs'

const args = process.argv.slice(2)
const destino = args.includes('--destino') ? args[args.indexOf('--destino') + 1] : 'pruebas'
if (destino === 'produccion' && !args.includes('--confirmo')) { console.error('Producción pide --confirmo.'); process.exit(1) }
const e = process.env
const db = destino === 'produccion'
  ? createClient(e.NEXT_PUBLIC_SUPABASE_URL, e.SUPABASE_SECRET_KEY, { auth: { persistSession: false } })
  : createClient(e.SUPABASE_PRUEBAS_URL, e.SUPABASE_PRUEBAS_SECRET_KEY, { auth: { persistSession: false } })

if (args.includes('--historico')) {
  // Siembra la serie oficial y paralela de los últimos N días desde los
  // históricos públicos de DolarApi, para que el gráfico tenga historia.
  const n = Number(args[args.indexOf('--historico') + 1] || 30)
  const desde = new Date(Date.now() - n * 864e5).toISOString().slice(0, 10)
  const traer = async (u) => (await fetch(u)).json()
  const [of, par, eur] = await Promise.all([
    traer('https://ve.dolarapi.com/v1/historicos/dolares/oficial'),
    traer('https://ve.dolarapi.com/v1/historicos/dolares/paralelo'),
    traer('https://ve.dolarapi.com/v1/historicos/euros/oficial').catch(() => []),
  ])
  let k = 0
  for (const [lista, tipo, moneda] of [[of, 'oficial', 'USD'], [eur, 'oficial', 'EUR'], [par, 'paralelo', 'USD']]) {
    for (const x of (Array.isArray(lista) ? lista : []).filter((x) => (x.fecha ?? '').slice(0, 10) >= desde)) {
      const fecha = x.fecha.slice(0, 10)
      const { error } = await db.schema('control').from('tasa_cambio').insert({
        tipo, fuente: 'dolarapi', moneda, lado: 'promedio', tasa: x.promedio, fecha_valor: fecha, metodo: 'api',
        verificada_con: 'histórico de DolarApi (carga inicial)', payload: x,
      })
      if (!error) k++
      if (!error && tipo === 'oficial' && moneda === 'USD')
        await db.schema('org').from('tasa_cambio').upsert({ fecha, ves_por_usd: x.promedio, fuente: 'BCV vía DolarApi' }, { onConflict: 'fecha' })
    }
  }
  console.log(`Histórico: ${k} filas`)
}

const r = await capturarTasas(db, { soloParalelo: args.includes('--solo-paralelo') })
console.log(JSON.stringify(r, null, 2))
