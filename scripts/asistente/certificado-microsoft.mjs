/**
 * El certificado con que la plataforma se autentica ante la aplicación de Iberia
 * en Microsoft Entra (fase 7). Microsoft recomienda certificado en vez de clave
 * secreta: la llave privada nunca sale de la plataforma.
 *
 *   node scripts/asistente/certificado-microsoft.mjs [--dias 730] [--forzar]
 *
 * Deja en `plataforma/microsoft/` (fuera de git):
 *   - plataforma-iberia-asistente.cer   el certificado PÚBLICO: es lo que se le entrega a Iberia
 *   - plataforma-iberia-asistente.key   la llave privada (respaldo local; no se manda a nadie)
 * y agrega a `.env.local` (sin imprimirlas):
 *   - MICROSOFT_CLAVE_PRIVADA   la llave en PEM, en base64 (secreta: va también a Netlify, solo producción)
 *   - MICROSOFT_CERTIFICADO     el .cer en base64 (público: la plataforma calcula la huella con él)
 *
 * Usa el openssl de Git para Windows. Vence a los 730 días: antes, se genera otro y se sube a Entra junto al viejo.
 */
import { execFileSync } from 'node:child_process'
import { createHash, X509Certificate } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, appendFileSync, unlinkSync } from 'node:fs'

const argv = process.argv.slice(2)
const dias = argv.includes('--dias') ? Number(argv[argv.indexOf('--dias') + 1]) : 730
const forzar = argv.includes('--forzar')
const env = readFileSync('.env.local', 'utf8')
if (/^MICROSOFT_CLAVE_PRIVADA=/m.test(env) && !forzar) {
  console.log('Ya hay un certificado en .env.local (MICROSOFT_CLAVE_PRIVADA). Para reemplazarlo: --forzar, y quitar las dos líneas viejas a mano.')
  process.exit(0)
}
const openssl = ['C:/Program Files/Git/usr/bin/openssl.exe', 'openssl'].find((x) => x === 'openssl' || existsSync(x))
const dir = 'plataforma/microsoft'
mkdirSync(dir, { recursive: true })
const base = `${dir}/plataforma-iberia-asistente`
execFileSync(openssl, ['req', '-x509', '-newkey', 'rsa:2048', '-sha256', '-nodes', '-keyout', `${base}.key`, '-out', `${base}.pem`, '-days', String(dias), '-subj', '/CN=Plataforma Iberia - Asistente de IA/O=Boosty Digital'], { stdio: 'ignore' })
execFileSync(openssl, ['x509', '-outform', 'der', '-in', `${base}.pem`, '-out', `${base}.cer`], { stdio: 'ignore' })
unlinkSync(`${base}.pem`)
const der = readFileSync(`${base}.cer`)
const clave = readFileSync(`${base}.key`)
const cert = new X509Certificate(der)
appendFileSync('.env.local', `\n# Microsoft 365 del asistente (fase 7): certificado de la app en Entra. Vence ${cert.validTo}\nMICROSOFT_CLAVE_PRIVADA=${clave.toString('base64')}\nMICROSOFT_CERTIFICADO=${der.toString('base64')}\n`)
console.log(`✓ certificado en ${base}.cer (público, para Iberia)`)
console.log(`  vence: ${cert.validTo}`)
console.log(`  huella SHA-1 (la que muestra Entra): ${createHash('sha1').update(der).digest('hex').toUpperCase()}`)
console.log('✓ MICROSOFT_CLAVE_PRIVADA y MICROSOFT_CERTIFICADO agregadas a .env.local (no se imprimen)')
