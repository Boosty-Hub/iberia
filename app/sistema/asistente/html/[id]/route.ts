import { NextResponse, type NextRequest } from 'next/server'
import { obtenerSesion, puede } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

/**
 * Un artefacto del asistente (una versión), servido desde el mismo origen pero
 * **aislado por la política de contenido**: `sandbox allow-scripts` le da un
 * origen opaco (no lee la sesión ni las cookies de la plataforma aunque se abra
 * suelto) y `connect-src 'none'` le cierra la red: un artefacto no puede sacar
 * datos de Iberia hacia afuera. Solo carga librerías de los dos CDN de la lista.
 *
 *  · `?crudo=1` devuelve el texto tal cual (el panel pinta los documentos con
 *    su propio Markdown).
 *  · `?descargar=1` lo baja como archivo: .html, .md o .svg según su tipo.
 */
const POLITICA = [
  'sandbox allow-scripts allow-downloads allow-modals',
  "default-src 'none'",
  "script-src 'unsafe-inline' https://cdn.jsdelivr.net https://cdnjs.cloudflare.com",
  "style-src 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net https://cdnjs.cloudflare.com",
  'font-src https://fonts.gstatic.com data:',
  'img-src data: blob:',
  "connect-src 'none'",
  "form-action 'none'",
  "base-uri 'none'",
  "frame-ancestors 'self'",
].join('; ')

const EXTENSION: Record<string, string> = { html: 'html', documento: 'md', svg: 'svg' }

function envolverSvg(svg: string, titulo: string): string {
  const t = titulo.replace(/[<>&"]/g, '')
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${t}</title><style>html,body{margin:0;height:100%;background:#f6f7f9}body{display:grid;place-items:center;padding:16px;box-sizing:border-box}svg{max-width:100%;height:auto}</style></head><body>${svg}</body></html>`
}

export async function GET(peticion: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const sesion = await obtenerSesion()
  if (!sesion) return NextResponse.json({ error: 'Sesión requerida' }, { status: 401 })
  if (!puede(sesion, 'sistema:asistente')) return NextResponse.json({ error: 'Sin el asistente de IA habilitado' }, { status: 403 })
  const { id } = await params
  if (!/^[0-9a-f-]{36}$/.test(id)) return NextResponse.json({ error: 'No válido' }, { status: 400 })
  const supabase = await createClient()
  const { data: fila } = await supabase.schema('asistente').from('html').select('titulo, ruta, tipo, version').eq('id', id).maybeSingle()
  if (!fila) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
  const { data, error } = await supabase.storage.from('asistente').download(fila.ruta)
  if (error || !data) return NextResponse.json({ error: 'No se pudo leer' }, { status: 500 })
  const sp = peticion.nextUrl.searchParams
  const tipo = fila.tipo ?? 'html'
  const comunes = { 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'Cache-Control': 'private, no-store' }

  if (sp.get('descargar') === '1') {
    const base = fila.titulo.replace(/[^\p{L}\p{N} _-]/gu, '').trim() || 'artefacto'
    const nombre = `${base}${fila.version > 1 ? ` v${fila.version}` : ''}.${EXTENSION[tipo] ?? 'txt'}`
    return new Response(data, {
      headers: {
        ...comunes,
        'Content-Type': tipo === 'documento' ? 'text/markdown; charset=utf-8' : tipo === 'svg' ? 'image/svg+xml' : 'text/html; charset=utf-8',
        'Content-Security-Policy': POLITICA,
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(nombre)}`,
      },
    })
  }
  if (sp.get('crudo') === '1') {
    return new Response(await data.text(), { headers: { ...comunes, 'Content-Type': 'text/plain; charset=utf-8', 'Content-Security-Policy': "default-src 'none'; sandbox" } })
  }
  const cuerpo = tipo === 'svg' ? envolverSvg(await data.text(), fila.titulo) : data
  return new Response(cuerpo, { headers: { ...comunes, 'Content-Type': 'text/html; charset=utf-8', 'Content-Security-Policy': POLITICA } })
}
