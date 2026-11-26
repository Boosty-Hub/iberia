/**
 * Graba los tutoriales de un módulo con la app real contra el proyecto de PRUEBAS y, con `--subir`, los publica en el
 * bucket `tutoriales` y en `ui.tutorial` (migración 20261124030000). Cómo funciona, en AGENTS.md › «Los tutoriales».
 *
 *   node --env-file=.env.local scripts/plataforma/tutoriales/grabar.mjs organizacion                 # graba todo el módulo
 *   … organizacion --solo plazas                                                                     # un capítulo
 *   … organizacion --subir                                                                           # graba y sube a pruebas
 *   … organizacion --solo-subir --destino produccion --confirmo                                       # sube lo ya grabado a producción
 *   --base http://localhost:3007 (por defecto; el build de producción contra pruebas: sin el indicador de Next) · --headed
 *
 * Salida en `capturas/tutoriales/<modulo>/` (fuera de git): <capitulo>.mp4 y .jpg. Antes de subir, mirar la hoja de
 * contacto (`<capitulo>-hoja.jpg`) o el video.
 */
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { createClient } from '@supabase/supabase-js'
import { grabarCapitulo, convertir, sesionDePrueba } from './grabacion.mjs'
import { mezclarVoz } from './voz.mjs'

const args = process.argv.slice(2)
const opc = (n, d) => (args.includes(n) ? args[args.indexOf(n) + 1] : d)
const modulo = args.find((x) => !x.startsWith('--') && args[args.indexOf(x) - 1] !== '--solo' && args[args.indexOf(x) - 1] !== '--base' && args[args.indexOf(x) - 1] !== '--destino')
if (!modulo) throw new Error('Uso: grabar.mjs <modulo> [--solo <capitulo>] [--subir | --solo-subir] [--destino pruebas|produccion --confirmo]')
const SOLO = opc('--solo', null)
const BASE = opc('--base', 'http://localhost:3007')
const SOLO_SUBIR = args.includes('--solo-subir')
const SUBIR = SOLO_SUBIR || args.includes('--subir')
const DESTINO = opc('--destino', 'pruebas')
if (DESTINO === 'produccion' && !args.includes('--confirmo')) throw new Error('Producción pide --confirmo')

const G = await import('./guiones/' + modulo + '.mjs')
const OUT = path.join('capturas', 'tutoriales', modulo)
fs.mkdirSync(OUT, { recursive: true })

const hechos = []
let fallos = 0
if (!SOLO_SUBIR) {
  const cookies = await sesionDePrueba(BASE, G.cuenta)
  for (const cap of G.capitulos) {
    if (SOLO && cap.id !== SOLO) continue
    console.log(`\n▶ ${cap.id} — ${cap.titulo}`)
    // Con voz (Sebastián) si el módulo lo pide (`conVoz` en su guion) o con --voz. Los de Organización y Procesos (24-nov) no la llevan.
    const voz = args.includes('--voz') || G.conVoz === true
    const r = await grabarCapitulo({ base: BASE, cookies, ruta: cap.ruta, guion: cap.guion, dir: path.join(OUT, '_webm', cap.id), headed: args.includes('--headed'), voz })
    if (r.fallo) {
      const lineas = String(r.fallo.message || r.fallo).split(/\r?\n/).filter(Boolean).slice(0, 3)
      console.error('  ✖ el guion falló:', lineas.join(' | '), '→', path.join(OUT, '_webm', cap.id, 'fallo.png'))
      fallos++
      continue
    }
    if (r.errores.length) console.warn('  ! errores de consola:', r.errores.slice(0, 3))
    const mp4 = path.join(OUT, cap.id + '.mp4')
    const poster = path.join(OUT, cap.id + '.jpg')
    const info = convertir({ webm: r.webm, inicio: r.inicio, mp4, poster })
    if (voz) mezclarVoz({ mp4, pistas: r.pistas, inicio: r.inicio })
    // Hoja de contacto: un cuadro cada 6 s, para revisar el capítulo de un vistazo.
    execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-i', mp4, '-vf', 'fps=1/6,scale=480:-2,tile=4x4', '-frames:v', '1', path.join(OUT, cap.id + '-hoja.jpg')])
    console.log(`  ✓ ${info.duracion.toFixed(1)} s · ${(info.bytes / 1048576).toFixed(1)} MB → ${mp4}`)
    hechos.push({ ...cap, mp4, poster, duracion: info.duracion })
  }
} else {
  for (const cap of G.capitulos) {
    if (SOLO && cap.id !== SOLO) continue
    const mp4 = path.join(OUT, cap.id + '.mp4')
    if (!fs.existsSync(mp4)) {
      console.error(`  ✖ falta ${mp4}: grábalo primero`)
      fallos++
      continue
    }
    const duracion = parseFloat(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', mp4]).toString())
    hechos.push({ ...cap, mp4, poster: path.join(OUT, cap.id + '.jpg'), duracion })
  }
}

if (SUBIR && hechos.length && !fallos) {
  const env = process.env
  const cfg = DESTINO === 'produccion' ? { url: env.NEXT_PUBLIC_SUPABASE_URL, clave: env.SUPABASE_SECRET_KEY } : { url: env.SUPABASE_PRUEBAS_URL, clave: env.SUPABASE_PRUEBAS_SECRET_KEY }
  if (DESTINO === 'pruebas' && cfg.url === env.NEXT_PUBLIC_SUPABASE_URL) throw new Error('SUPABASE_PRUEBAS_URL apunta a producción')
  const db = createClient(cfg.url, cfg.clave, { auth: { persistSession: false } })
  console.log(`\nSubiendo a ${DESTINO} (${new URL(cfg.url).host})`)
  for (const h of hechos) {
    const orden = G.capitulos.findIndex((c) => c.id === h.id) + 1
    const archivo = `${modulo}/${h.id}.mp4`
    const poster = `${modulo}/${h.id}.jpg`
    for (const [ruta, local, tipo] of [[archivo, h.mp4, 'video/mp4'], [poster, h.poster, 'image/jpeg']]) {
      const { error } = await db.storage.from('tutoriales').upload(ruta, fs.readFileSync(local), { contentType: tipo, upsert: true, cacheControl: '3600' })
      if (error) throw new Error(`subir ${ruta}: ${error.message}`)
    }
    const { error } = await db.schema('ui').from('tutorial').upsert({
      ruta: h.ruta.split('?')[0], modulo: G.modulo, titulo: h.titulo, descripcion: h.descripcion ?? null, recurso: h.recurso,
      archivo, poster, duracion_seg: Math.round(h.duracion), orden, actualizado_en: new Date().toISOString(),
    })
    if (error) throw new Error(`ui.tutorial ${h.id}: ${error.message}`)
    console.log('  ↑', archivo)
  }
}
if (SUBIR && fallos) console.error('\nNo se subió nada: hubo capítulos con fallas.')
console.log(fallos ? `\n✖ ${fallos} capítulo(s) con fallas` : `\n✓ ${hechos.length} capítulo(s)`)
process.exit(fallos ? 1 : 0)
