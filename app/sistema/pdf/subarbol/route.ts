import { NextResponse, type NextRequest } from 'next/server'
import { obtenerSesion, puede } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { esFecha, esUuid, fechaLarga, hoyCaracas } from '@/lib/plataforma/formato'
import { htmlSubarbol, nodosMapa, nodosOrganigrama, rama, type NodoPdf } from '@/lib/plataforma/pdf-subarbol'

/**
 * El PDF del subárbol de un lienzo (organigrama o mapa de procesos), con
 * cajetín: código, versión, fecha y «Uso interno» (Anexo E §5, pendiente de R0).
 *
 *   POST /sistema/pdf/subarbol   (formulario del botón «PDF del subárbol»)
 *     tipo = organizacion | procesos · raiz = id de la caja (vacío: todo)
 *     abiertos = ids desplegados, separados por coma (vacío: todo) · al · esc
 *     formato = html (opcional): la hoja sin pasar por Chromium
 *
 * La rama se vuelve a leer en la base con la sesión de quien la pide (RLS y el
 * permiso del módulo); del navegador solo llegan ids. El PDF lo imprime
 * Chromium (Playwright, el mismo de `npm run documento`) donde está instalado;
 * donde no —una función de Netlify no trae navegador— responde la misma hoja en
 * HTML, lista para «Imprimir o guardar en PDF».
 */
export async function POST(req: NextRequest) {
  const f = await req.formData()
  return generar(Object.fromEntries([...f.entries()].map(([k, v]) => [k, String(v)])))
}

export async function GET(req: NextRequest) {
  return generar(Object.fromEntries(req.nextUrl.searchParams.entries()))
}

const ID = /^[\w:.-]{1,80}$/

async function generar(p: Record<string, string>) {
  const sesion = await obtenerSesion()
  if (!sesion) return NextResponse.json({ error: 'Sin sesión' }, { status: 401 })
  const tipo = p.tipo === 'procesos' ? 'procesos' : p.tipo === 'organizacion' ? 'organizacion' : null
  if (!tipo) return NextResponse.json({ error: 'tipo: organizacion o procesos' }, { status: 400 })
  if (!puede(sesion, tipo === 'procesos' ? 'sistema:procesos' : 'sistema:estructura')) return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

  const al = esFecha(p.al) ? p.al : hoyCaracas()
  const escId = esUuid(p.esc) && puede(sesion, 'sistema:escenarios') ? p.esc : null
  const raiz = p.raiz && ID.test(p.raiz) ? p.raiz : null
  const abiertos = p.abiertos ? new Set(p.abiertos.split(',').filter((x) => ID.test(x)).slice(0, 5000)) : null

  const supabase = await createClient()
  const [escenario, datos, tipos] = await Promise.all([
    escId ? supabase.schema('org').from('escenario').select('nombre, alcance').eq('id', escId).maybeSingle() : Promise.resolve({ data: null }),
    tipo === 'procesos'
      ? supabase.schema('sgc').rpc('lienzo', { p_fecha: al, p_escenario: escId ?? undefined })
      : supabase.schema('org').rpc('lienzo', { p_fecha: al, p_escenario: escId ?? undefined }),
    tipo === 'organizacion' ? supabase.schema('control').from('catalogo').select('clave, etiqueta').eq('tipo', 'tipo_unidad') : Promise.resolve({ data: [] }),
  ])
  if (datos.error) return NextResponse.json({ error: datos.error.message }, { status: 400 })
  const filas = (datos.data ?? []) as never[]

  const nodos: NodoPdf[] =
    tipo === 'procesos' ? nodosMapa(filas) : nodosOrganigrama(filas, new Map((tipos.data ?? []).map((t) => [t.clave, t.etiqueta])))
  const visibles = rama(nodos, raiz, abiertos)
  if (!visibles.length) return NextResponse.json({ error: 'Esa rama no existe o no está a tu alcance' }, { status: 404 })
  const cabeza = visibles[0][0]
  const filaRaiz = tipo === 'procesos' ? (filas as { id: string; version: number | null }[]).find((x) => x.id === cabeza.id) : null

  const html = htmlSubarbol(
    {
      modulo: tipo === 'procesos' ? 'NUC-PRO' : 'NUC-ORG',
      titulo: raiz ? cabeza.titulo : tipo === 'procesos' ? 'Mapa de procesos completo' : 'Organigrama completo',
      codigo: raiz ? cabeza.codigo : null,
      version: filaRaiz?.version
        ? `v${filaRaiz.version} (ficha del proceso)`
        : `${tipo === 'procesos' ? 'Catálogo' : 'Estructura'} vigente al ${fechaLarga(al)}`,
      al,
      escenario: escenario.data?.nombre ?? null,
      generadoPor: sesion.perfil.nombre_completo || sesion.email,
      generadoEn: new Date(),
    },
    visibles,
    false
  )

  const nombre = `${tipo === 'procesos' ? 'NUC-PRO' : 'NUC-ORG'}-${(cabeza.codigo ?? cabeza.titulo).replace(/[^\p{L}\p{N}]+/gu, '-').slice(0, 60)}-${al}.pdf`
  // `formato=html`: la hoja sin imprimir (vista previa, o para imprimir desde el navegador).
  const pdf = p.formato === 'html' ? null : await imprimir(html)
  if (pdf)
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${encodeURIComponent(nombre)}"`,
        'Cache-Control': 'private, no-store',
      },
    })
  return new NextResponse(html.replace('<body>', '<body><p class="imprimir"><button onclick="print()">Imprimir o guardar en PDF</button></p>'), {
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'private, no-store', 'X-Pdf': 'navegador' },
  })
}

/** Chromium por Playwright, si está. El nombre va en una variable para que el empaquetador no lo arrastre a la función. */
async function imprimir(html: string): Promise<Buffer | null> {
  const modulo = 'playwright'
  try {
    const { chromium } = (await import(/* webpackIgnore: true */ /* turbopackIgnore: true */ modulo)) as typeof import('playwright')
    const nav = await chromium.launch()
    try {
      const pagina = await nav.newPage()
      await pagina.setContent(html, { waitUntil: 'load' })
      return await pagina.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '16mm', bottom: '18mm', left: '14mm', right: '14mm' },
        displayHeaderFooter: true,
        headerTemplate: '<div></div>',
        footerTemplate:
          '<div style="width:100%;font-family:system-ui,sans-serif;font-size:8px;color:#575251;padding:0 14mm;display:flex;justify-content:space-between;"><span>Industrias Iberia · Plataforma Iberia · USO INTERNO</span><span><span class="pageNumber"></span> de <span class="totalPages"></span></span></div>',
      })
    } finally {
      await nav.close()
    }
  } catch {
    return null
  }
}
