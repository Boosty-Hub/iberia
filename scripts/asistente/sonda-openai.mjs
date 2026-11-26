/**
 * Sonda del motor de OpenAI (Responses API): streaming, razonamiento, búsqueda
 * web y una herramienta propia. Imprime los tipos de evento que llegan para que
 * el adaptador no adivine nombres.
 *
 *   node --env-file=.env.local scripts/asistente/sonda-openai.mjs [--modelo gpt-6.2-sol] [--esfuerzo medium]
 */
const argv = process.argv.slice(2)
const opcion = (n, d) => (argv.includes(n) ? argv[argv.indexOf(n) + 1] : d)
const modelo = opcion('--modelo', 'gpt-6.2-sol')
const esfuerzo = opcion('--esfuerzo', 'medium')

const cuerpo = (input) => ({
  model: modelo,
  instructions: 'Eres el asistente de IA de la Plataforma Iberia. Respondes en español de Venezuela, con tuteo.',
  input,
  stream: true,
  store: false,
  include: ['reasoning.encrypted_content'],
  reasoning: { effort: esfuerzo, summary: 'auto' },
  tools: [
    { type: 'web_search' },
    {
      type: 'function',
      name: 'publicar_html',
      description: 'Publica un HTML autocontenido para el usuario.',
      parameters: { type: 'object', properties: { titulo: { type: 'string' }, html: { type: 'string' } }, required: ['titulo', 'html'], additionalProperties: false },
      strict: true,
    },
  ],
})

async function correr(input) {
  const t0 = Date.now()
  const r = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(cuerpo(input)),
  })
  if (!r.ok) throw new Error(`HTTP ${r.status}: ${(await r.text()).slice(0, 800)}`)
  const tipos = new Map()
  let primera = null
  let final = null
  const lector = r.body.getReader()
  const dec = new TextDecoder()
  let resto = ''
  for (;;) {
    const { value, done } = await lector.read()
    if (done) break
    resto += dec.decode(value, { stream: true })
    let i
    while ((i = resto.indexOf('\n\n')) >= 0) {
      const trozo = resto.slice(0, i)
      resto = resto.slice(i + 2)
      const linea = trozo.split('\n').find((l) => l.startsWith('data: '))
      if (!linea) continue
      const ev = JSON.parse(linea.slice(6))
      tipos.set(ev.type, (tipos.get(ev.type) ?? 0) + 1)
      if (primera === null && /delta/.test(ev.type)) primera = Date.now() - t0
      if (ev.type === 'response.completed') final = ev.response
      if (ev.type === 'response.output_item.done' && ev.item?.type !== 'message') console.log('item', ev.item?.type, JSON.stringify(ev.item).slice(0, 200))
    }
  }
  console.log(`${Date.now() - t0} ms · primera ${primera} ms`)
  console.log('eventos', JSON.stringify([...tipos]))
  console.log('uso', JSON.stringify(final?.usage))
  return final
}

const f1 = await correr([{ role: 'user', content: [{ type: 'input_text', text: '¿Cuál es la tasa oficial del dólar del BCV hoy? Busca en internet y dime en una línea.' }] }])
console.log('salida', JSON.stringify(f1.output.map((o) => o.type)))
const texto = f1.output.filter((o) => o.type === 'message').flatMap((o) => o.content.map((c) => c.text)).join('')
console.log('TEXTO', texto.slice(0, 400))

const f2 = await correr([{ role: 'user', content: [{ type: 'input_text', text: 'Publica con publicar_html un gráfico de barras muy simple (HTML de menos de 30 líneas) de ventas por zona: Centro 10, Oriente 7.' }] }])
const llamada = f2.output.find((o) => o.type === 'function_call')
console.log('llamada', llamada?.name, llamada?.call_id, (llamada?.arguments ?? '').length)
if (llamada) {
  const f3 = await correr([
    { role: 'user', content: [{ type: 'input_text', text: 'Publica con publicar_html un gráfico de barras muy simple (HTML de menos de 30 líneas) de ventas por zona: Centro 10, Oriente 7.' }] },
    ...f2.output,
    { type: 'function_call_output', call_id: llamada.call_id, output: 'Publicado.' },
  ])
  console.log('cierre', f3.output.filter((o) => o.type === 'message').flatMap((o) => o.content.map((c) => c.text)).join('').slice(0, 300))
}
