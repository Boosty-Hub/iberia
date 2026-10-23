/**
 * Comprueba contra Apple que la clave de APNs, el equipo y el bundle autentican.
 *
 *   npm run probar:apns                                     # con APNS_* del entorno
 *   npm run probar:apns -- C:\ruta\AuthKey_9QWXFT269C.p8    # con la clave del disco
 *
 * Manda un aviso a un token **inventado**, con el mismo código que usa el
 * servidor (`lib/apns.ts`). No le llega a nadie y no toca la base. Lo que
 * contesta Apple es el resultado:
 *
 *   400 BadDeviceToken          la clave, el equipo y el topic autentican: el token
 *                               es lo único que falla, y es falso a propósito.
 *   403 InvalidProviderToken    la clave, su id o el equipo no cuadran.
 *   400 DeviceTokenNotForTopic  el bundle no es de ese equipo, o la app no tiene push.
 *   400 TopicDisallowed         la clave no puede mandar a ese bundle.
 *
 * Con la ruta del `.p8`, el id de la clave sale del nombre del archivo
 * (`AuthKey_<id>.p8`) y el equipo y el bundle, de los de la app, salvo que
 * APNS_KEY_ID, APNS_TEAM_ID o APNS_BUNDLE_ID digan otra cosa. La clave no se
 * imprime nunca.
 */

import { readFileSync } from 'node:fs'
import { basename } from 'node:path'
import { HOST_PRODUCCION, configDesdeEntorno, mandarApns } from '../lib/apns.ts'

const EQUIPO = '45TRWF6998'
const BUNDLE = 'com.industriasiberia.canal'
// 32 bytes en hexadecimal, como un token de verdad, y obviamente falso.
const TOKEN_FALSO = '0'.repeat(64)

const ruta = process.argv.slice(2).find((a) => !a.startsWith('--'))

let entorno = process.env
if (ruta) {
  const idDelNombre = basename(ruta).match(/^AuthKey_([A-Z0-9]+)\.p8$/i)?.[1]
  entorno = {
    ...process.env,
    APNS_KEY_P8: readFileSync(ruta, 'utf8'),
    APNS_KEY_ID: process.env.APNS_KEY_ID ?? idDelNombre,
    APNS_TEAM_ID: process.env.APNS_TEAM_ID ?? EQUIPO,
    APNS_BUNDLE_ID: process.env.APNS_BUNDLE_ID ?? BUNDLE,
  }
}

const leida = configDesdeEntorno(entorno)
if ('faltan' in leida) {
  console.error(`
✖ Faltan ${leida.faltan.join(', ')}.

  Pásale la ruta del .p8 —npm run probar:apns -- <ruta>\\AuthKey_<id>.p8— o
  pon las cuatro variables APNS_* en el entorno.
`)
  process.exit(1)
}

const { config } = leida
console.log(`
APNs · ${HOST_PRODUCCION}
  clave   ${config.idClave}
  equipo  ${config.equipo}
  topic   ${config.bundle}
  token   ${TOKEN_FALSO.slice(0, 8)}… (inventado)
`)

const [resultado] = await mandarApns(config, [
  {
    token: TOKEN_FALSO,
    aviso: { titulo: 'Prueba', cuerpo: 'Este aviso no le llega a nadie.', ruta: '/canal' },
  },
])

console.log(`  Apple contestó: ${resultado.estado || 'sin respuesta'}${resultado.motivo ? ` ${resultado.motivo}` : ''}\n`)

if (resultado.estado === 400 && resultado.motivo === 'BadDeviceToken') {
  console.log('✔ La clave, el equipo y el topic autentican. Solo falla el token, que es falso.')
  process.exit(0)
}
if (resultado.estado === 403) {
  console.error('✖ Apple no acepta la clave: revisa el .p8, su id y el equipo.')
} else if (resultado.motivo === 'DeviceTokenNotForTopic' || resultado.motivo === 'TopicDisallowed') {
  console.error('✖ La clave autentica, pero no puede mandar a ese bundle.')
} else if (!resultado.estado) {
  console.error('✖ Sin respuesta de Apple: ¿hay red hasta api.push.apple.com:443?')
} else {
  console.error('✖ Respuesta inesperada.')
}
process.exit(1)
