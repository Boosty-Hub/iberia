import type { Metadata } from 'next'
import Link from 'next/link'
import { puede, requerirPermiso } from '@/lib/auth'
import { contenidoDe, misCarpetas, type Carpeta } from '@/lib/archivos/servidor'
import { fechaCorta } from '@/lib/plataforma/formato'
import { CabeceraModulo } from '@/components/sistema/ui/cabecera-modulo'
import { Explorador } from '@/components/sistema/archivos/explorador'

export const metadata: Metadata = { title: 'Mis archivos' }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

/** Las carpetas en orden de árbol, con su nivel (para «Mover a…»). */
function enArbol(carpetas: Carpeta[]): { id: string; nombre: string; nivel: number }[] {
  const hijas = new Map<string | null, Carpeta[]>()
  for (const c of carpetas) hijas.set(c.padre_id, [...(hijas.get(c.padre_id) ?? []), c])
  const salida: { id: string; nombre: string; nivel: number }[] = []
  const recorrer = (padre: string | null, nivel: number) => {
    for (const c of (hijas.get(padre) ?? []).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))) {
      salida.push({ id: c.id, nombre: c.nombre, nivel })
      if (nivel < 30) recorrer(c.id, nivel + 1)
    }
  }
  recorrer(null, 0)
  return salida
}

/**
 * Mis archivos (26-nov-2026, pedido de Gabriel): las carpetas de cada quien, como un SharePoint chico. Solo las ve
 * su dueño o a quien él se las comparta. El asistente las cita con «/».
 */
export default async function MisArchivosPage({ searchParams }: PageProps<'/sistema/archivos'>) {
  const [sesion, sp] = await Promise.all([requerirPermiso('sistema:archivos'), searchParams])
  const c = typeof sp.c === 'string' && UUID.test(sp.c) ? sp.c : null
  const [contenido, todas] = await Promise.all([contenidoDe(c, sesion.userId), misCarpetas(sesion.userId)])
  if (!contenido) {
    return (
      <>
        <CabeceraModulo sesion={sesion} codigo="MI-ARC" />
        <p className="rounded-xl border border-[var(--borde)] bg-white px-4 py-8 text-center text-[13px] text-marca-500">
          Esa carpeta no existe o no te la compartieron. <Link href="/sistema/archivos" className="text-acento-700 hover:underline">Volver a Mis carpetas</Link>
        </p>
      </>
    )
  }
  const migas = [
    contenido.esPropia ? { etiqueta: 'Mis carpetas', href: '/sistema/archivos' } : { etiqueta: 'Compartido conmigo', href: '/sistema/archivos/compartido' },
    ...contenido.migas.map((m, i) => ({ etiqueta: m.nombre, href: i < contenido.migas.length - 1 ? `/sistema/archivos?c=${m.id}` : undefined })),
  ]
  return (
    <>
      <CabeceraModulo
        sesion={sesion}
        codigo="MI-ARC"
        titulo={contenido.carpeta?.nombre ?? 'Mis archivos'}
        migas={contenido.carpeta ? migas : undefined}
        descripcion={contenido.esPropia ? 'Solo tú los ves, salvo lo que compartas. En el asistente, escribe «/» y el nombre para usarlos en el chat.' : 'Carpeta compartida contigo: la puedes ver y descargar.'}
      />
      <Explorador
        carpetaId={c}
        esPropia={contenido.esPropia}
        puedeCrear={puede(sesion, 'sistema:archivos', 'crear')}
        destinos={enArbol(todas)}
        carpetas={contenido.carpetas.map((x) => ({ id: x.id, nombre: x.nombre, padre_id: x.padre_id, propia: x.dueno === sesion.userId }))}
        archivos={contenido.archivos.map((a) => ({ id: a.id, nombre: a.nombre, mime: a.mime, bytes: Number(a.bytes), aviso: a.aviso, propio: a.dueno === sesion.userId, fecha: fechaCorta(a.creado_en) }))}
      />
    </>
  )
}
