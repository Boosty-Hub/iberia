import type { Metadata } from 'next'
import Link from 'next/link'
import { requerirSesion } from '@/lib/auth'
import { cargarFicha } from '@/lib/plataforma/fichas'
import { TIPOS_FICHA, leerFicha } from '@/lib/plataforma/ficha-tipos'
import { FichaObjeto } from '@/components/sistema/ui/ficha-objeto'

export const metadata: Metadata = { title: 'Ficha' }

/**
 * La ficha a página completa: la misma `FichaObjeto` del panel lateral, para
 * mandarla por enlace o trabajarla con espacio. Pasa por los mismos permisos y
 * la misma RLS: si no está a tu alcance, lo dice sin distinguir «no existe».
 */
export default async function FichaPage({ params }: PageProps<'/sistema/ficha/[tipo]/[id]'>) {
  const [sesion, { tipo, id }] = await Promise.all([requerirSesion(), params])
  const f = leerFicha(`${tipo}:${id}`)
  const ficha = f ? await cargarFicha(sesion, f.tipo, f.id) : null

  if (!ficha)
    return (
      <div className="mx-auto max-w-md rounded-xl border border-[var(--borde)] bg-white p-6 text-center">
        <p className="font-semibold text-marca-900">Esta ficha no está a tu alcance</p>
        <p className="mt-1 text-[12.5px] text-marca-500">O no existe, o tu rol no abre {f ? `las de tipo «${TIPOS_FICHA[f.tipo].toLowerCase()}»` : 'este tipo de objeto'}.</p>
        <Link href="/sistema" className="mt-4 inline-flex h-9 items-center rounded-lg border border-[var(--borde)] px-3 text-xs hover:bg-marca-50">
          Volver a Mi día
        </Link>
      </div>
    )

  return (
    <div className="mx-auto max-w-4xl overflow-hidden rounded-xl border border-[var(--borde)] bg-white">
      <FichaObjeto ficha={ficha} variante="pagina" />
    </div>
  )
}
