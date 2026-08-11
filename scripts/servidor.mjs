/**
 * Arranca Next con un límite de cabeceras HTTP más alto.
 *
 *   node scripts/servidor.mjs dev
 *   node scripts/servidor.mjs start
 *
 * Por qué: las cookies de `localhost` se comparten entre TODOS los puertos, así
 * que en una máquina con varios proyectos locales la cabecera `Cookie` supera
 * los 16 KB que Node acepta por defecto y el navegador recibe un HTTP 431
 * (Request Header Fields Too Large) antes de que la app llegue a ejecutarse.
 *
 * Subir el límite hace tolerante al servidor; la causa de fondo se resuelve
 * limpiando las cookies de localhost en el navegador.
 */

import { spawn } from 'node:child_process'

const MAX_CABECERAS = 65536

const [comando = 'dev', ...resto] = process.argv.slice(2)

if (!['dev', 'start', 'build'].includes(comando)) {
  console.error(`\n✖ Comando no reconocido: ${comando}. Usa dev, start o build.\n`)
  process.exit(1)
}

const opcionesNode = [process.env.NODE_OPTIONS, `--max-http-header-size=${MAX_CABECERAS}`]
  .filter(Boolean)
  .join(' ')

const hijo = spawn('next', [comando, ...resto], {
  stdio: 'inherit',
  // shell: true para resolver el binario de next desde node_modules/.bin en
  // Windows, donde es un .cmd y no un ejecutable directo.
  shell: true,
  env: { ...process.env, NODE_OPTIONS: opcionesNode },
})

hijo.on('exit', (codigo, senal) => {
  if (senal) process.kill(process.pid, senal)
  else process.exit(codigo ?? 0)
})

hijo.on('error', (e) => {
  console.error(`\n✖ No se pudo arrancar next: ${e.message}\n`)
  process.exit(1)
})
