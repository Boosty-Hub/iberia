/**
 * Las secciones del informe, entre la base y el disco.
 *
 *   npm run secciones -- --bajar                 # la base → contenido/informe/secciones/<slug>.md
 *   npm run secciones -- --subir                 # el disco → la base, solo las que cambiaron
 *   npm run secciones -- --subir --revisar       # dice cuáles subiría, sin escribir
 *   npm run secciones -- --publicar              # las once, publicadas
 *
 * Desde el 9 de octubre de 2026 **las once secciones se escriben en Supabase** y ninguna
 * se genera: el taller de Jesús Planas no quedó en esta máquina y el generador ya no
 * tiene de dónde sacar inicio, mapa y fichas. Para corregir una sección en sesión se
 * baja, se edita el archivo y se sube. La carpeta está fuera de git —`/contenido/*`—
 * porque es material de Iberia bajo NDA.
 *
 * ⚠️ **Antes de subir, `npm run respaldar:informe`.** Subir pisa lo que haya en la
 * base, y la única vuelta atrás es un respaldo.
 */

import { createClient } from '@supabase/supabase-js'
import { mkdir, readFile, writeFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY,
  { auth: { persistSession: false } }
)

const CARPETA = 'contenido/informe/secciones'
const tiene = (bandera) => process.argv.includes(bandera)
const revisar = tiene('--revisar')

const { data: secciones, error } = await admin
  .from('informe_secciones')
  .select('id, slug, numero, titulo, contenido_md, publicado')
  .order('orden')
if (error) {
  console.error(`✖ ${error.message}`)
  process.exit(1)
}

if (tiene('--bajar')) {
  await mkdir(CARPETA, { recursive: true })
  for (const s of secciones) {
    await writeFile(join(CARPETA, `${s.slug}.md`), s.contenido_md ?? '')
    console.log(`  ↓ ${s.numero} ${s.slug}`)
  }
  console.log(`\n${secciones.length} secciones en ${CARPETA}/\n`)
}

if (tiene('--subir')) {
  const archivos = new Set(await readdir(CARPETA))
  let subidas = 0
  for (const s of secciones) {
    const nombre = `${s.slug}.md`
    if (!archivos.has(nombre)) continue
    const texto = await readFile(join(CARPETA, nombre), 'utf8')
    if (texto === (s.contenido_md ?? '')) continue
    // Una sección vacía en el disco es casi siempre un error de edición, no una
    // decisión: no se sube.
    if (!texto.trim()) {
      console.error(`  ✖ ${s.slug}: el archivo está vacío; no se sube`)
      continue
    }
    console.log(`  ↑ ${s.numero} ${s.slug}  ${(s.contenido_md ?? '').length} → ${texto.length} caracteres`)
    if (!revisar) {
      const { error: e } = await admin.from('informe_secciones').update({ contenido_md: texto }).eq('id', s.id)
      if (e) {
        console.error(`  ✖ ${s.slug}: ${e.message}`)
        process.exit(1)
      }
    }
    subidas++
  }
  console.log(revisar ? `\nRevisión: ${subidas} por subir, nada escrito.\n` : `\n${subidas} subidas.\n`)
}

if (tiene('--publicar')) {
  const vacias = secciones.filter((s) => !s.contenido_md?.trim())
  if (vacias.length) {
    console.error(`✖ No se publica: hay secciones vacías (${vacias.map((s) => s.slug).join(', ')})`)
    process.exit(1)
  }
  if (!revisar) {
    const { error: e } = await admin
      .from('informe_secciones')
      .update({ publicado: true })
      .in('id', secciones.map((s) => s.id))
    if (e) {
      console.error(`✖ ${e.message}`)
      process.exit(1)
    }
  }
  console.log(`${revisar ? 'Se publicarían' : 'Publicadas'} las ${secciones.length} secciones.`)
}
