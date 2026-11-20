import Link from 'next/link'
import { Insignia } from '@/components/ui'
import { cn } from '@/lib/utils'
import { etiquetaDe, fmtEntero, type Catalogos, type Nodo, type PlazaVista, type Totales } from './datos'

/**
 * El organigrama vivo como árbol plegable. Es HTML nativo (`<details>`): abre y
 * cierra sin JavaScript y cabe en 390 px —la sangría es corta y las cifras
 * bajan de línea en el teléfono—.
 */

export function Cifras({ t, compacto }: { t: Totales; compacto?: boolean }) {
  const item = (valor: number, etiqueta: string, clase?: string) => (
    <span className={cn('inline-flex items-baseline gap-1 whitespace-nowrap', clase)}>
      <span className="font-semibold tabular-nums">{fmtEntero(valor)}</span>
      <span className={compacto ? 'text-[11px]' : 'text-xs'}>{etiqueta}</span>
    </span>
  )
  return (
    <span className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-marca-600">
      {item(t.dotacion, 'aprobada')}
      {item(t.ocupadas, 'ocupada')}
      {item(t.vacantes, t.vacantes === 1 ? 'vacante' : 'vacantes', t.vacantes ? 'text-acento-700' : undefined)}
      {t.porEncima > 0 && item(t.porEncima, 'por encima', 'text-amber-700')}
    </span>
  )
}

function FilaPlaza({ p, catalogos }: { p: PlazaVista; catalogos: Catalogos }) {
  const muchos = p.ocupantes.length > 8
  const nombres = (
    <ul className="flex flex-wrap gap-1.5">
      {p.ocupantes.map((o) => (
        <li
          key={o.id}
          className={cn(
            'inline-flex max-w-full items-center gap-1 rounded-full px-2 py-0.5 text-xs',
            o.excede ? 'bg-amber-50 text-amber-900' : 'bg-marca-100 text-marca-700',
          )}
          title={o.excede ? 'Registrada por encima de la dotación' : undefined}
        >
          <span className="truncate">{o.nombre}</span>
          {o.tipo !== 'titular' && <span className="text-[10px] text-marca-500">· {etiquetaDe(catalogos.tipo_ocupacion, o.tipo)}</span>}
          {o.certeza === 'por_nombre_de_cargo' && <span className="text-[10px] text-marca-500">· casada por cargo</span>}
        </li>
      ))}
    </ul>
  )
  return (
    <li className="rounded-xl border border-marca-200/70 bg-white px-3 py-2.5">
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
        <p className="min-w-0 text-sm font-medium text-marca-900">
          {p.cargo}
          {p.certeza === 'inferencia' && (
            <Insignia tono="ambar" className="ml-2 py-0.5 align-middle">
              Inferencia
            </Insignia>
          )}
          {p.estado !== 'aprobada' && (
            <Insignia tono="neutro" className="ml-2 py-0.5 align-middle">
              {etiquetaDe(catalogos.estado_plaza, p.estado)}
            </Insignia>
          )}
        </p>
        <Cifras t={{ plazas: 1, dotacion: p.dotacion, ocupadas: p.titulares, vacantes: p.vacantes, porEncima: p.porEncima }} compacto />
      </div>
      {(p.tipo_nomina || p.sedeEfectiva) && (
        <p className="mt-0.5 text-xs text-marca-500">
          {[p.tipo_nomina && `Nómina ${etiquetaDe(catalogos.tipo_nomina, p.tipo_nomina).toLowerCase()}`, p.sedeEfectiva && etiquetaDe(catalogos.sede, p.sedeEfectiva)]
            .filter(Boolean)
            .join(' · ')}
        </p>
      )}
      {p.ocupantes.length > 0 && (
        <div className="mt-2">
          {muchos ? (
            <details className="group">
              <summary className="cursor-pointer text-xs font-medium text-marca-600 select-none hover:text-acento-700">
                Ver las {p.ocupantes.length} personas
              </summary>
              <div className="mt-2">{nombres}</div>
            </details>
          ) : (
            nombres
          )}
        </div>
      )}
    </li>
  )
}

export function ArbolUnidad({
  nodo,
  catalogos,
  visibles,
  abrirHasta,
  fecha,
}: {
  nodo: Nodo
  catalogos: Catalogos
  /** Con filtros: qué unidades y plazas se muestran. Sin filtros, todo. */
  visibles: { unidades: Set<string>; plazas: Set<string> } | null
  abrirHasta: number
  fecha: string
}) {
  const u = nodo.unidad
  const plazas = visibles ? nodo.plazas.filter((p) => visibles.plazas.has(p.ref)) : nodo.plazas
  const hijos = visibles ? nodo.hijos.filter((h) => visibles.unidades.has(h.unidad.ref)) : nodo.hijos
  const total = visibles ? nodo.visibleTotal : nodo.total
  const tieneAlgo = plazas.length > 0 || hijos.length > 0

  return (
    <li className="min-w-0">
      <details open={nodo.profundidad < abrirHasta} className="group/u">
        <summary className="flex min-h-11 cursor-pointer list-none items-start gap-2 rounded-xl px-2 py-2 select-none hover:bg-marca-50 [&::-webkit-details-marker]:hidden">
          <span
            aria-hidden
            className={cn('mt-0.5 w-3 shrink-0 text-marca-400 transition-transform group-open/u:rotate-90', !tieneAlgo && 'opacity-0')}
          >
            ›
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="text-[15px] font-semibold text-marca-900">{u.nombre}</span>
              <span className="text-xs text-marca-500">{etiquetaDe(catalogos.tipo_unidad, u.tipo)}</span>
              {u.certeza === 'inferencia' && <Insignia tono="ambar" className="py-0.5">Inferencia</Insignia>}
            </span>
            <span className="mt-0.5 block text-sm">
              <Cifras t={total} />
            </span>
          </span>
          <Link
            href={`/sistema/nucleo/organizacion/unidades/${u.ref}${fecha ? `?fecha=${fecha}` : ''}`}
            className="mt-0.5 shrink-0 rounded-lg px-2 py-1 text-xs font-medium text-acento-700 hover:bg-acento-50"
          >
            Abrir
          </Link>
        </summary>
        {tieneAlgo && (
          <div className="ml-3 border-l border-marca-200 pl-2 sm:ml-4 sm:pl-3">
            {plazas.length > 0 && (
              <ul className="mt-1 mb-2 space-y-1.5">
                {plazas.map((p) => (
                  <FilaPlaza key={p.ref} p={p} catalogos={catalogos} />
                ))}
              </ul>
            )}
            {hijos.length > 0 && (
              <ul className="space-y-0.5">
                {hijos.map((h) => (
                  <ArbolUnidad key={h.unidad.ref} nodo={h} catalogos={catalogos} visibles={visibles} abrirHasta={abrirHasta} fecha={fecha} />
                ))}
              </ul>
            )}
          </div>
        )}
      </details>
    </li>
  )
}
