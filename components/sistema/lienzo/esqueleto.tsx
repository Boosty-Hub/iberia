/** Lo que se ve mientras llega el lienzo: el encabezado, las pestañas y el marco con unas cajas. */
export function EsqueletoLienzo() {
  const caja = 'rounded-lg bg-marca-100 animate-pulse'
  return (
    <div aria-busy="true" aria-label="Cargando">
      <div className="mb-6 space-y-2">
        <div className={`${caja} h-3 w-24`} />
        <div className={`${caja} h-7 w-56`} />
        <div className={`${caja} h-4 w-96 max-w-full`} />
      </div>
      <div className="mb-4 flex gap-2">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className={`${caja} h-10 w-24`} />
        ))}
      </div>
      <div className="relative h-[calc(100dvh-15rem)] min-h-[520px] overflow-hidden rounded-2xl border border-[var(--borde)] bg-white">
        <div className="absolute top-10 left-1/2 flex -translate-x-1/2 flex-col items-center gap-14">
          <div className={`${caja} h-20 w-[200px]`} />
          <div className="flex gap-6">
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className={`${caja} h-20 w-[200px]`} />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
