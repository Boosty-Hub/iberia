// Mira el «Descargar PDF» de las secciones del informe (23 de noviembre de 2026).
//
//   node --env-file=.env.local scripts/mirar-pdf-informe.mjs [--base http://localhost:3001] [--solo plataforma]
//
// Entra con la sesión de Gabriel (enlace mágico con la clave de servicio, como las
// demás verificaciones), abre cada sección, toca el botón y guarda el PDF que baja en
// capturas/pdf-informe/. Comprueba que baje, que sea un PDF y cuántas hojas trae;
// mirar las hojas es aparte (renderizarlas a PNG y abrirlas).
import { chromium } from 'playwright'
import { createClient } from '@supabase/supabase-js'
import { mkdir, readFile } from 'node:fs/promises'

const args = Object.fromEntries(
  process.argv.slice(2).reduce((pares, a, i, todos) => {
    if (a.startsWith('--')) pares.push([a.slice(2), todos[i + 1]?.startsWith('--') ? true : (todos[i + 1] ?? true)])
    return pares
  }, [])
)
const BASE = args.base ?? process.env.BASE_URL ?? 'http://localhost:3001'
const EMAIL = args.email ?? 'gmontiel@spatiumgroup.com'
const URL_SUPA = process.env.NEXT_PUBLIC_SUPABASE_URL
const SECCIONES = args.solo ? [args.solo] : ['arquitectura-ia', 'plataforma', 'seguridad-operacion', 'ia-en-el-sistema']

const admin = createClient(URL_SUPA, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } })
const anon = createClient(URL_SUPA, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } })

async function cookies() {
  const { data: enlace, error } = await admin.auth.admin.generateLink({ type: 'magiclink', email: EMAIL })
  if (error) throw new Error(`no se pudo emitir el enlace: ${error.message}`)
  const { data, error: e2 } = await anon.auth.verifyOtp({ token_hash: enlace.properties.hashed_token, type: 'magiclink' })
  if (e2) throw new Error(`no se pudo canjear el enlace: ${e2.message}`)
  const ref = new URL(URL_SUPA).hostname.split('.')[0]
  const valor = 'base64-' + Buffer.from(JSON.stringify(data.session)).toString('base64url')
  const LIMITE = 3180
  const partes =
    valor.length <= LIMITE
      ? [{ name: `sb-${ref}-auth-token`, value: valor }]
      : Array.from({ length: Math.ceil(valor.length / LIMITE) }, (_, i) => ({
          name: `sb-${ref}-auth-token.${i}`,
          value: valor.slice(i * LIMITE, (i + 1) * LIMITE),
        }))
  return partes.map((p) => ({ ...p, domain: new URL(BASE).hostname, path: '/' }))
}

let fallos = 0
const comprobar = (ok, texto) => {
  console.log(`${ok ? '✔' : '✘'} ${texto}`)
  if (!ok) fallos++
}

await mkdir('capturas/pdf-informe', { recursive: true })
const navegador = await chromium.launch()
const contexto = await navegador.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true })
await contexto.addCookies(await cookies())
const p = await contexto.newPage()
p.on('console', (m) => {
  if (m.type() === 'error') console.log(`  consola: ${m.text().slice(0, 200)}`)
})

for (const slug of SECCIONES) {
  await p.goto(`${BASE}/informe/${slug}`)
  const boton = p.getByRole('button', { name: /Descargar PDF/ })
  comprobar(await boton.waitFor({ state: 'visible', timeout: 30_000 }).then(() => true, () => false), `${slug}: el botón está arriba`)
  const inicio = Date.now()
  const [descarga] = await Promise.all([p.waitForEvent('download', { timeout: 150_000 }), boton.click()])
  const destino = `capturas/pdf-informe/${descarga.suggestedFilename()}`
  await descarga.saveAs(destino)
  const bytes = await readFile(destino)
  const hojas = (bytes.toString('latin1').match(/\/Type\s*\/Page[^s]/g) ?? []).length
  comprobar(bytes.subarray(0, 5).toString() === '%PDF-', `${slug}: ${descarga.suggestedFilename()} · ${hojas} hojas · ${(bytes.length / 1024).toFixed(0)} KB · ${((Date.now() - inicio) / 1000).toFixed(1)} s`)
  comprobar(await p.getByRole('button', { name: 'Descargar PDF' }).isVisible(), `${slug}: el botón vuelve a quedar listo`)
}

await navegador.close()
console.log(fallos ? `\n${fallos} fallos` : '\nsin fallos')
process.exit(fallos ? 1 : 0)
