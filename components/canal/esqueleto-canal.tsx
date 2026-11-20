/**
 * Lo que se ve en el canal entre el toque y la pantalla (`loading.tsx` de cada
 * ruta). Imita la forma del contenido —título y tarjetas redondas— para que nada
 * salte al llegar, y avisa a los lectores de pantalla que está cargando. En una
 * conexión de planta son uno o dos segundos: sin esto el toque parecía perdido.
 */
export function EsqueletoCanal({ tarjetas = 4, conTitulo = true }: { tarjetas?: number; conTitulo?: boolean }) {
  return (
    <div>
      <p role="status" aria-live="polite" className="sr-only">
        Cargando…
      </p>
      {conTitulo && (
        <div className="mb-4">
          <span aria-hidden className="esqueleto block h-3 w-24 rounded" />
          <span aria-hidden className="esqueleto mt-2 block h-6 w-56 max-w-full rounded" />
        </div>
      )}
      <div className="space-y-3">
        {Array.from({ length: tarjetas }, (_, i) => (
          <div key={i} aria-hidden className="tarjeta-canal flex items-center gap-3 px-4 py-4">
            <span className="esqueleto block h-10 w-10 shrink-0 rounded-full" />
            <span className="min-w-0 flex-1">
              <span className="esqueleto block h-3.5 w-3/4 rounded" />
              <span className="esqueleto mt-2 block h-3 w-1/2 rounded" />
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
