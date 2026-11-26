/**
 * Carga en Supabase Vault la llave privada y el certificado de la app de Microsoft 365 del asistente
 * (los que dejó certificado-microsoft.mjs en .env.local). No van en el entorno de Netlify: AWS Lambda
 * limita a 4 KB el total de variables. Nunca imprime la llave.
 *
 *   node --env-file=.env.local scripts/asistente/subir-certificado-microsoft.mjs                      # pruebas
 *   node --env-file=.env.local scripts/asistente/subir-certificado-microsoft.mjs --destino produccion --confirmo
 */
import { createHash } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

const e = process.env
const prod = process.argv.includes('--destino') && process.argv[process.argv.indexOf('--destino') + 1] === 'produccion'
if (prod && !process.argv.includes('--confirmo')) throw new Error('A producción pide --confirmo')
const [url, clave] = prod ? [e.NEXT_PUBLIC_SUPABASE_URL, e.SUPABASE_SECRET_KEY] : [e.SUPABASE_PRUEBAS_URL, e.SUPABASE_PRUEBAS_SECRET_KEY]
if (!e.MICROSOFT_CLAVE_PRIVADA || !e.MICROSOFT_CERTIFICADO) throw new Error('Faltan MICROSOFT_CLAVE_PRIVADA y MICROSOFT_CERTIFICADO en .env.local (certificado-microsoft.mjs)')
const db = createClient(url, clave, { auth: { persistSession: false } }).schema('asistente')
const { error } = await db.rpc('guardar_credencial_microsoft', { p_clave: e.MICROSOFT_CLAVE_PRIVADA, p_certificado: e.MICROSOFT_CERTIFICADO })
if (error) throw new Error(error.message)
const { data } = await db.rpc('credencial_microsoft')
const huella = createHash('sha1').update(Buffer.from(data.certificado, 'base64')).digest('hex').toUpperCase()
console.log(`✓ certificado en Vault de ${prod ? 'PRODUCCIÓN' : 'pruebas'} · huella ${huella} · llave ${data.clave ? 'guardada' : 'FALTA'}`)
