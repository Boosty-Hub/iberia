/**
 * Sonda del motor de Anthropic para el asistente (fase 1): sube un Excel a la
 * Files API, lo procesa con la ejecución de código y la habilidad `xlsx`, pide
 * un Excel de vuelta y mide el tiempo hasta la primera palabra.
 *
 *   node --env-file=.env.local scripts/asistente/sonda-anthropic.mjs <archivo.xlsx> [--modelo claude-opus-5-5] [--esfuerzo medium]
 *
 * Gasta unos centavos. No toca la base.
 */
import Anthropic, { toFile } from '@anthropic-ai/sdk'
import { readFile, writeFile } from 'node:fs/promises'
import { basename } from 'node:path'

const argv = process.argv.slice(2)
const archivo = argv.find((a) => !a.startsWith('--'))
const opcion = (n, d) => (argv.includes(n) ? argv[argv.indexOf(n) + 1] : d)
const modelo = opcion('--modelo', 'claude-opus-5-5')
const esfuerzo = opcion('--esfuerzo', 'medium')
if (!archivo) throw new Error('Falta el archivo .xlsx')

const clave = process.env.ANTHROPIC_API_KEY_SALDO || process.env.ANTHROPIC_API_KEY
const cliente = new Anthropic({ apiKey: clave, baseURL: 'https://api.anthropic.com' })

const t0 = Date.now()
const subido = await cliente.beta.files.upload({
  file: await toFile(await readFile(archivo), basename(archivo), { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
  betas: ['files-api-2025-04-14'],
})
console.log(`subido ${subido.id} en ${Date.now() - t0} ms`)

const t1 = Date.now()
let primera = null
const stream = cliente.beta.messages.stream({
  model: modelo,
  max_tokens: 32000,
  betas: ['code-execution-2025-08-25', 'files-api-2025-04-14', 'skills-2025-10-02'],
  thinking: { type: 'adaptive', display: 'summarized' },
  output_config: { effort: esfuerzo },
  container: { skills: [{ type: 'anthropic', skill_id: 'xlsx', version: 'latest' }] },
  tools: [
    { type: 'code_execution_20260521', name: 'code_execution' },
    { type: 'web_search_20250305', name: 'web_search', max_uses: 3 },
  ],
  system: 'Eres el asistente de IA de la Plataforma Iberia. Respondes en español de Venezuela, con tuteo y tono profesional.',
  messages: [
    {
      role: 'user',
      content: [
        { type: 'container_upload', file_id: subido.id },
        { type: 'text', text: 'Analiza este Excel: total de cantidad × precio por zona y por producto, y compáralo con la hoja Metas. Devuélveme un Excel con una hoja Resumen y una hoja por zona. Explícame en tres líneas lo más importante.' },
      ],
    },
  ],
})
stream.on('text', () => {
  if (primera === null) primera = Date.now() - t1
})
stream.on('thinking', () => {
  if (primera === null) primera = Date.now() - t1
})
const final = await stream.finalMessage()
console.log(`fin: ${final.stop_reason} · ${Date.now() - t1} ms · primera señal ${primera} ms · contenedor ${final.container?.id}`)
console.log('uso', JSON.stringify(final.usage))
const ids = []
const recorrer = (x) => {
  if (!x || typeof x !== 'object') return
  if (Array.isArray(x)) return x.forEach(recorrer)
  if (typeof x.file_id === 'string' && x.type !== 'container_upload') ids.push(x.file_id)
  Object.values(x).forEach(recorrer)
}
for (const b of final.content) {
  if (b.type === 'text') console.log('TEXTO:', b.text.slice(0, 800))
  else console.log('bloque', b.type, b.type === 'server_tool_use' ? JSON.stringify(b.input).slice(0, 160) : '')
  if (b.type !== 'text') recorrer(b)
}
for (const id of ids) {
  const meta = await cliente.beta.files.retrieveMetadata(id, { betas: ['files-api-2025-04-14'] })
  const r = await cliente.beta.files.download(id, { betas: ['files-api-2025-04-14'] })
  const buf = Buffer.from(await r.arrayBuffer())
  await writeFile(`capturas/sonda-${meta.filename}`, buf)
  console.log(`archivo generado: ${meta.filename} (${meta.mime_type}, ${buf.length} bytes) → capturas/sonda-${meta.filename}`)
}
await cliente.beta.files.delete(subido.id, { betas: ['files-api-2025-04-14'] })
