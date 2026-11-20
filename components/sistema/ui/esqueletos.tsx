/**
 * Los esqueletos densos del armazón nuevo: la cabecera del módulo, una fila de
 * cifras y una tabla. Imitan la forma real para que nada salte al llegar.
 */

function Caja({ className }: { className?: string }) {
  return <span aria-hidden className={`esqueleto block ${className ?? ''}`} />
}

export function EsqueletoModulo({ kpis = 0, tabla = true }: { kpis?: number; tabla?: boolean }) {
  return (
    <div>
      <div className="-mx-3 -mt-4 mb-4 border-b border-[var(--borde)] bg-white px-3 py-3 sm:-mx-5 sm:px-5">
        <p role="status" aria-live="polite" className="esqueleto-aviso">
          <span className="giro" aria-hidden />
          Cargando la información…
        </p>
        <Caja className="mt-2 h-3 w-48" />
        <Caja className="mt-2 h-6 w-72 max-w-full" />
        <div className="mt-3 flex gap-4">
          {[0, 1, 2, 3].map((i) => (
            <Caja key={i} className="h-4 w-20" />
          ))}
        </div>
      </div>
      {kpis > 0 && (
        <div className="mb-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: kpis }, (_, i) => (
            <div key={i} className="rounded-xl border border-[var(--borde)] bg-white p-3.5">
              <Caja className="h-3 w-24" />
              <Caja className="mt-3 h-6 w-28" />
              <Caja className="mt-3 h-8 w-full" />
            </div>
          ))}
        </div>
      )}
      {tabla && (
        <div className="overflow-hidden rounded-xl border border-[var(--borde)] bg-white">
          {Array.from({ length: 9 }, (_, i) => (
            <div key={i} className="flex gap-4 border-b border-[#eef0f3] px-3 py-2.5">
              <Caja className="h-3.5 w-1/4" />
              <Caja className="h-3.5 w-1/3" />
              <Caja className="h-3.5 w-16" />
              <Caja className="h-3.5 w-16" />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
