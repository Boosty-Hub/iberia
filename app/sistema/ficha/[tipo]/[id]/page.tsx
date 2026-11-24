import type { Metadata } from 'next'
import Link from 'next/link'
import { requerirSesion } from '@/lib/auth'
import { cargarFicha } from '@/lib/plataforma/fichas'
import { anotarReciente } from '@/lib/plataforma/recientes'
import { TIPOS_FICHA, leerFicha } from '@/lib/plataforma/ficha-tipos'
import { FichaObjeto } from '@/components/sistema/ui/ficha-objeto'
import { BotonVolver } from '@/components/sistema/ui/boton-volver'
import { RutaDeFicha } from '@/components/sistema/shell/ruta-de-ficha'
import { DOMINIOS, MODULOS_INTERFAZ, dominioDe, moduloDeRuta } from '@/lib/plataforma/dominios'
import { modulosDelPlan } from '@/lib/plataforma/servidor'

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
  await anotarReciente(ficha)

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

  // Las migas (24-nov-2026, Gabriel: «a este nivel se pierde dónde se está y cómo volver»): el módulo del objeto es el
  // que calza con su `hrefModulo` (`moduloDeRuta`, el mismo del menú); de ahí sale también el dominio.
  const ruta = ficha.hrefModulo?.split('?')[0] ?? null
  const modulo = ruta ? moduloDeRuta(ruta, [...MODULOS_INTERFAZ, ...(await modulosDelPlan())]) : null
  const dominio = modulo ? (modulo.dominio === 'Mi día' ? null : DOMINIOS.find((d) => d.clave === dominioDe(modulo))) : null
  const tipoNombre = f ? TIPOS_FICHA[f.tipo] : 'Ficha'

  return (
    <div className="mx-auto max-w-4xl">
      <RutaDeFicha ruta={ruta} />
      <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-2">
        <BotonVolver respaldo={modulo?.ruta ?? '/sistema'} />
        <nav aria-label="Migas" className="min-w-0 text-[12px] text-marca-500">
          <ol className="flex flex-wrap items-center gap-1">
            <li>
              <Link href="/sistema" className="hover:text-marca-800 hover:underline">
                Mi día
              </Link>
              <span aria-hidden> /</span>
            </li>
            {dominio && (
              <li>
                {dominio.nombre}
                <span aria-hidden> /</span>
              </li>
            )}
            {modulo?.ruta && (
              <li>
                <Link href={modulo.ruta} className="hover:text-marca-800 hover:underline">
                  {modulo.nombre}
                </Link>
                <span aria-hidden> /</span>
              </li>
            )}
            <li>
              {tipoNombre}
              <span aria-hidden> /</span>
            </li>
            <li aria-current="page" className="font-medium text-marca-800">
              {ficha.titulo}
            </li>
          </ol>
        </nav>
      </div>
      <div className="overflow-hidden rounded-xl border border-[var(--borde)] bg-white">
        <FichaObjeto ficha={ficha} variante="pagina" />
      </div>
    </div>
  )
}
