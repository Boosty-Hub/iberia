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
const cargados = []
for (const f of (await readdir(carpeta)).filter((x) => x.endsWith('.json')).sort((a, b) => parseInt(a) - parseInt(b))) {
  const t = JSON.parse(await readFile(path.join(carpeta, f), 'utf8'))
  cuenta[t.clase] = (cuenta[t.clase] ?? 0) + 1
  if (t.clase !== 'version' && t.clase !== 'registro') {
    console.log(`${t.codigo} · ${path.basename(t.archivo ?? '')} → ${t.clase}: ${t.nota ?? ''}`)
    // La copia de algo ya transcrito: se anota en su archivo, para que «Archivo de origen» diga dónde está su contenido.
    if (!revisar && t.documento_id && t.archivo) {
      const texto = t.clase === 'duplicado' ? `Mismo contenido que lo ya transcrito: ${t.nota ?? ''}` : `No se pudo leer: ${t.nota ?? ''}`
      await sgc.from('documento_archivo').update({ transcripcion: texto.slice(0, 500) }).eq('documento_id', t.documento_id).eq('nombre', path.basename(t.archivo.replace(/\\/g, '/')))
    }
    continue
  }
  // Sin id (documento dado de alta por la revisión): se busca por el archivo de origen entre los archivos del documento.
  if (!t.documento_id) {
    const { data: candidatos } = await sgc.from('documento').select('id, codigo, titulo').contains('archivos', [t.archivo])
    const c = (candidatos ?? []).find((x) => !t.codigo || x.codigo === t.codigo) ?? candidatos?.[0]
    if (!c) { console.warn(`Sin documento para ${t.archivo}`); continue }
    t.documento_id = c.id
  }
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
    cargados.push(t.documento_id)
    if (!revisar) {
      const { error } = await sgc.from('documento_version').insert({
        documento_id: t.documento_id, numero, etiqueta: [t.version ? `Versión ${t.version}` : null, fecha(t.fecha)?.slice(0, 4)].filter(Boolean).join(' · ') || path.basename(t.archivo).slice(0, 80),
        fecha: fecha(t.fecha), estado: 'historica', origen: 'transcripcion', archivo_ruta: t.archivo, contenido: contenido(t), motivo: `Transcripción del original. ${t.nota ?? ''}`.slice(0, 1000), creado_por: null,
      })
      if (error) throw new Error(`${f}: ${error.message}`)
    }
  }
}
// Un documento activo que solo quedó con versiones históricas: la más nueva pasa a «transcripción por validar».
if (!revisar) {
  const ids = [...new Set(cargados)]
  for (const id of ids) {
    const { data: d } = await sgc.from('documento').select('estado').eq('id', id).maybeSingle()
    if (!d || !['vigente', 'sin_determinar', 'borrador'].includes(d.estado)) continue
    const { data: vs } = await sgc.from('documento_version').select('id, estado, fecha, numero').eq('documento_id', id)
    if (!vs?.length || vs.some((v) => ['transcripcion', 'vigente', 'borrador', 'en_revision'].includes(v.estado))) continue
    const ult = vs.sort((a, b) => (b.fecha ?? '').localeCompare(a.fecha ?? '') || b.numero - a.numero)[0]
    await sgc.from('documento_version').update({ estado: 'transcripcion' }).eq('id', ult.id)
  }
}
console.log(JSON.stringify(cuenta), revisar ? '(revisión: no se escribió nada)' : 'Listo.')
