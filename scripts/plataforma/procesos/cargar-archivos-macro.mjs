/**
 * Carga la transcripción archivo por archivo de un macroproceso (28-nov-2026, Gabriel: «todo debe estar transcrito en la
 * plataforma»). Lee `plataforma/propuestas/macros/<macro>/archivos/*.json`, uno por archivo de origen:
 *   - clase "version": otra versión o copia del texto del documento → `sgc.documento_version` como «histórica»;
 *   - clase "registro": un formato LLENO → `sgc.documento_registro`;
 *   - "duplicado" y "sin_texto": no se cargan (se informan).
 *
 *   node --env-file=.env.local scripts/plataforma/procesos/cargar-archivos-macro.mjs --macro 1.1 [--revisar] [--destino produccion --confirmo]
 *
 * Idempotente por (documento, archivo de origen).
 */
import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'

const argv = process.argv.slice(2)
const opc = (n) => (argv.includes(n) ? argv[argv.indexOf(n) + 1] : null)
const macro = opc('--macro')
if (!macro) throw new Error('Falta --macro')
const revisar = argv.includes('--revisar')
const produccion = opc('--destino') === 'produccion'
if (produccion && !argv.includes('--confirmo')) throw new Error('Para producción hace falta --confirmo')
const sgc = createClient(produccion ? process.env.NEXT_PUBLIC_SUPABASE_URL : process.env.SUPABASE_PRUEBAS_URL, produccion ? process.env.SUPABASE_SECRET_KEY : process.env.SUPABASE_PRUEBAS_SECRET_KEY, { auth: { persistSession: false } }).schema('sgc')
const carpeta = path.resolve('plataforma/propuestas/macros', macro, 'archivos')

const fecha = (f) => (/^\d{4}-\d{2}-\d{2}$/.test(f ?? '') ? f : null)
const contenido = (t) => ({
  control: { elaboro: t.control?.elaboro ?? null, reviso: t.control?.reviso ?? null, aprobo: t.control?.aprobo ?? null, elaboracion: t.control?.elaboracion ?? null, actualizacion: t.control?.actualizacion ?? null, version_original: t.version ?? null },
  secciones: (t.secciones ?? []).map((s) => ({ titulo: s.titulo ?? '', bloques: (s.bloques ?? []).filter((b) => b && b.tipo) })),
})
const cuenta = { version: 0, registro: 0, duplicado: 0, sin_texto: 0, ya: 0 }
for (const f of (await readdir(carpeta)).filter((x) => x.endsWith('.json')).sort((a, b) => parseInt(a) - parseInt(b))) {
  const t = JSON.parse(await readFile(path.join(carpeta, f), 'utf8'))
  cuenta[t.clase] = (cuenta[t.clase] ?? 0) + 1
  if (t.clase !== 'version' && t.clase !== 'registro') { console.log(`${t.codigo} · ${path.basename(t.archivo ?? '')} → ${t.clase}: ${t.nota ?? ''}`); continue }
  if (t.clase === 'registro') {
    const { data: ya } = await sgc.from('documento_registro').select('id').eq('documento_id', t.documento_id).eq('archivo_ruta', t.archivo).maybeSingle()
    if (ya) { cuenta.ya++; continue }
    console.log(`${t.codigo} · registro «${t.titulo}»`)
    if (!revisar) {
      const { error } = await sgc.from('documento_registro').insert({ documento_id: t.documento_id, titulo: (t.titulo ?? path.basename(t.archivo)).slice(0, 300), fecha: fecha(t.fecha), contenido: contenido(t), archivo_ruta: t.archivo, origen: 'transcripcion', nota: t.nota ?? null, creado_por: null })
      if (error) throw new Error(`${f}: ${error.message}`)
    }
  } else {
    const { data: vs } = await sgc.from('documento_version').select('numero, archivo_ruta').eq('documento_id', t.documento_id)
    if ((vs ?? []).some((v) => v.archivo_ruta === t.archivo)) { cuenta.ya++; continue }
    const numero = Math.max(0, ...(vs ?? []).map((v) => v.numero)) + 1
    console.log(`${t.codigo} · versión ${numero} «${t.titulo}»`)
    if (!revisar) {
      const { error } = await sgc.from('documento_version').insert({
        documento_id: t.documento_id, numero, etiqueta: [t.version ? `Versión ${t.version}` : null, fecha(t.fecha)?.slice(0, 4)].filter(Boolean).join(' · ') || path.basename(t.archivo).slice(0, 80),
        fecha: fecha(t.fecha), estado: 'historica', origen: 'transcripcion', archivo_ruta: t.archivo, contenido: contenido(t), motivo: `Transcripción del original. ${t.nota ?? ''}`.slice(0, 1000), creado_por: null,
      })
      if (error) throw new Error(`${f}: ${error.message}`)
    }
  }
}
console.log(JSON.stringify(cuenta), revisar ? '(revisión: no se escribió nada)' : 'Listo.')
