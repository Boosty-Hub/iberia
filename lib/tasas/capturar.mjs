/**
 * Captura de tasas: la oficial del BCV (bcv.org.ve, verificada contra DolarApi)
 * y el paralelo (DolarApi). Lo usan la ruta `/api/tasas/capturar` (programada) y
 * `scripts/plataforma/capturar-tasas.mjs` (a mano). Ver el Anexo E §6.
 *
 * ⚠️ bcv.org.ve manda un certificado intermedio equivocado y Node falla con
 * UNABLE_TO_VERIFY_LEAF_SIGNATURE. No se apaga la verificación TLS: se agrega el
 * intermedio verdadero (Sectigo Public Server Authentication CA OV R36, público,
 * vence en 2036) a las raíces de esta sola petición.
 *
 * Reglas:
 *   · La oficial se guarda con la fecha valor que publica el BCV. Si ya hay una
 *     vigente para esa fecha valor y moneda, no se duplica.
 *   · Si el BCV no responde, se toma la de DolarApi (que lo replica) y se anota.
 *   · Si BCV y DolarApi difieren en más de 0,5 %, se guarda la del BCV y se anota
 *     la diferencia: es una alerta para revisar, no un bloqueo.
 *   · Si la nueva oficial se mueve más de 5 % contra la anterior, NO se guarda:
 *     se reporta para confirmación manual.
 *   · El paralelo se guarda en cada corrida (9, 13 y 17 h), con su hora.
 */
import https from 'node:https'
import tls from 'node:tls'
import fs from 'node:fs'
import path from 'node:path'

const CA_BCV = fs.readFileSync(path.join(process.cwd(), 'lib', 'tasas', 'sectigo-ov-r36.pem'), 'utf8')

function obtener(url, { ca } = {}) {
  return new Promise((resolver, rechazar) => {
    const req = https.get(url, { ca: ca ? [...tls.rootCertificates, ca] : undefined, timeout: 20000, headers: { 'User-Agent': 'Plataforma/1.0 (tasas de referencia)' } }, (res) => {
      let cuerpo = ''
      res.setEncoding('utf8')
      res.on('data', (c) => (cuerpo += c))
      res.on('end', () => (res.statusCode === 200 ? resolver(cuerpo) : rechazar(new Error(`${url} → ${res.statusCode}`))))
    })
    req.on('timeout', () => req.destroy(new Error(`${url} → sin respuesta en 20 s`)))
    req.on('error', rechazar)
  })
}

const numeroVe = (s) => Number(String(s).trim().replace(/\./g, '').replace(',', '.'))

/** La portada del BCV: USD y EUR (venta) y la fecha valor. */
export async function leerBcv() {
  const html = await obtener('https://www.bcv.org.ve/', { ca: CA_BCV })
  const tasa = (id) => {
    const m = html.match(new RegExp(`id="${id}"[\\s\\S]*?<strong[^>]*>\\s*([\\d.,]+)`))
    return m ? numeroVe(m[1]) : null
  }
  const f = html.match(/Fecha Valor:[\s\S]{0,200}?content="(\d{4}-\d{2}-\d{2})/)
  const usd = tasa('dolar'), eur = tasa('euro')
  if (!usd || !eur || !f) throw new Error('La portada del BCV cambió de forma: no se encontraron las tasas o la fecha valor')
  return { usd, eur, fechaValor: f[1] }
}

/** DolarApi: oficial y paralelo, USD y EUR. */
export async function leerDolarApi() {
  const [d, e] = await Promise.all([obtener('https://ve.dolarapi.com/v1/dolares'), obtener('https://ve.dolarapi.com/v1/euros')])
  const dl = JSON.parse(d), eu = JSON.parse(e)
  const de = (lista, fuente) => lista.find((x) => x.fuente === fuente)
  const of = de(dl, 'oficial'), par = de(dl, 'paralelo'), ofe = de(eu, 'oficial')
  return {
    usd: of?.promedio ?? null,
    eur: ofe?.promedio ?? null,
    fechaValor: of?.fechaActualizacion?.slice(0, 10) ?? null,
    paralelo: par?.promedio ?? null,
    paraleloEn: par?.fechaActualizacion ?? null,
    crudo: { dolares: dl, euros: eu },
  }
}

const hoyCaracas = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Caracas' }).format(new Date())

/**
 * Captura y guarda. `db` es un cliente de Supabase con clave de servicio.
 * Devuelve el resumen de lo que hizo (para el registro y para la alerta).
 */
export async function capturarTasas(db, { soloParalelo = false } = {}) {
  const r = { oficial: [], paralelo: null, avisos: [] }
  let bcv = null, api = null
  try { api = await leerDolarApi() } catch (e) { r.avisos.push(`DolarApi no respondió: ${e.message}`) }

  if (!soloParalelo) {
    try { bcv = await leerBcv() } catch (e) { r.avisos.push(`BCV no respondió: ${e.message}`) }
    const fuente = bcv ? 'bcv_web' : api?.usd ? 'dolarapi' : null
    if (!fuente) r.avisos.push('Sin tasa oficial: ni el BCV ni DolarApi respondieron')
    else {
      const base = bcv ?? api
      for (const moneda of ['USD', 'EUR']) {
        const tasa = moneda === 'USD' ? base.usd : base.eur
        const otra = bcv && api ? (moneda === 'USD' ? api.usd : api.eur) : null
        let verificada = bcv ? (otra ? `dolarapi ${otra}` : 'sin verificar: DolarApi no respondió') : 'tomada de DolarApi: el BCV no respondió'
        if (bcv && otra) {
          const dif = Math.abs(tasa / otra - 1) * 100
          verificada += dif < 0.01 ? ' · coincide' : ` · difiere ${dif.toFixed(2)} %`
          if (dif > 0.5) r.avisos.push(`${moneda}: BCV ${tasa} y DolarApi ${otra} difieren ${dif.toFixed(2)} %`)
        }
        // ¿Ya está esta fecha valor?
        const { data: ya } = await db.schema('control').from('tasa_cambio').select('id, tasa')
          .eq('tipo', 'oficial').eq('moneda', moneda).eq('estado', 'vigente').eq('fecha_valor', base.fechaValor).maybeSingle()
        if (ya) { r.oficial.push({ moneda, tasa, fechaValor: base.fechaValor, estado: 'ya estaba' }); continue }
        // Salto de más de 5 % contra la anterior: no se guarda sin confirmación.
        const { data: ant } = await db.schema('control').from('tasa_cambio').select('tasa, fecha_valor')
          .eq('tipo', 'oficial').eq('moneda', moneda).eq('estado', 'vigente').lt('fecha_valor', base.fechaValor)
          .order('fecha_valor', { ascending: false }).limit(1).maybeSingle()
        if (ant && Math.abs(tasa / Number(ant.tasa) - 1) > 0.05) {
          r.avisos.push(`${moneda}: ${tasa} se mueve más de 5 % contra ${ant.tasa} (${ant.fecha_valor}); no se guardó, pide confirmación manual`)
          continue
        }
        const { error } = await db.schema('control').from('tasa_cambio').insert({
          tipo: 'oficial', fuente, moneda, lado: 'venta', tasa, fecha_valor: base.fechaValor,
          metodo: fuente === 'bcv_web' ? 'web' : 'api', verificada_con: verificada,
          payload: { bcv, dolarapi: api ? { usd: api.usd, eur: api.eur, fechaValor: api.fechaValor } : null },
        })
        if (error) r.avisos.push(`${moneda}: no se guardó (${error.message})`)
        else {
          r.oficial.push({ moneda, tasa, fechaValor: base.fechaValor, estado: 'guardada', verificada })
          // El costo de personal lee org.tasa_cambio (una fila por fecha valor).
          if (moneda === 'USD') await db.schema('org').from('tasa_cambio').upsert({ fecha: base.fechaValor, ves_por_usd: tasa, fuente: fuente === 'bcv_web' ? 'BCV' : 'BCV vía DolarApi' }, { onConflict: 'fecha' })
        }
      }
    }
  }

  if (api?.paralelo) {
    const { error } = await db.schema('control').from('tasa_cambio').insert({
      tipo: 'paralelo', fuente: 'dolarapi', moneda: 'USD', lado: 'promedio', tasa: api.paralelo,
      fecha_valor: hoyCaracas(), publicada_en: api.paraleloEn, metodo: 'api', payload: { dolarapi: api.crudo.dolares },
    })
    if (error) r.avisos.push(`Paralelo: no se guardó (${error.message})`)
    else r.paralelo = { tasa: api.paralelo, en: api.paraleloEn }
  }
  return r
}
