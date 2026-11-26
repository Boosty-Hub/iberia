/**
 * El motor del asistente lee `process.env` con los nombres de Next. En una Edge
 * Function de Supabase los secretos propios no pueden empezar por `SUPABASE_`, y
 * la plataforma trae los suyos (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`):
 * aquí se traducen antes de que cargue el motor (el ejecutor lee el entorno al
 * cargarse). ⚠️ No se escribe en el entorno de la función (en Supabase arrancar
 * escribiéndolo tumbaba el worker): se arma un `process` propio con una copia.
 */
import nodeProcess from 'node:process'
import { Buffer } from 'node:buffer'

// El motor usa `Buffer` de Node (subir archivos a la Files API, leer de Storage): Deno no lo trae como global.
const g = globalThis as unknown as { Buffer?: typeof Buffer }
g.Buffer ??= Buffer

const base = Deno.env.toObject()
const env: Record<string, string | undefined> = {
  ...base,
  NEXT_PUBLIC_SUPABASE_URL: base.NEXT_PUBLIC_SUPABASE_URL ?? base.SUPABASE_URL,
  SUPABASE_SECRET_KEY: base.ASISTENTE_CLAVE_SERVICIO || base.SUPABASE_SERVICE_ROLE_KEY,
  ASISTENTE_EJECUTOR: 'supabase',
}
const propio = new Proxy(nodeProcess, { get: (t, k) => (k === 'env' ? env : Reflect.get(t, k)) })
Object.defineProperty(globalThis, 'process', { value: propio, configurable: true, writable: true })
