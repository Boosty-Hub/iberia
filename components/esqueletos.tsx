import { cn } from '@/lib/utils'

/**
 * Los esqueletos de carga: la forma de la página que viene, mientras llega.
 *
 * Los usan los `loading.tsx` de cada ruta. Next los pinta al instante del clic
 * —el layout se queda, solo cambia lo de adentro— y los reemplaza cuando la
 * página está lista. Imitan la maqueta de verdad (cabecera, cifras, lista; o la
 * hoja del informe) para que al llegar el contenido nada salte de sitio.
 */

function Caja({ className }: { className?: string }) {
  return <span aria-hidden className={cn('esqueleto', className)} />
}

/** El aviso con la palabra: un esqueleto solo, hay quien no lo reconoce. */
function Aviso() {
  return (
    <p role="status" aria-live="polite" className="esqueleto-aviso">
      <span className="giro" aria-hidden />
      Cargando la información…
    </p>
  )
}

function Lineas({ n, ultima = 'w-2/3' }: { n: number; ultima?: string }) {
  return (
    <span className="block space-y-2.5">
      {Array.from({ length: n }, (_, i) => (
        <Caja key={i} className={cn('h-3.5', i === n - 1 ? ultima : 'w-full')} />
      ))}
    </span>
  )
}

/** El encabezado de una pantalla del panel: rótulo, título y descripción. */
function Encabezado() {
  return (
    <div className="mb-6 space-y-3">
      <Aviso />
      <Caja className="h-3 w-28" />
      <Caja className="h-7 w-64 max-w-full" />
      <Caja className="h-3.5 w-[28rem] max-w-full" />
    </div>
  )
}

/** Una pantalla de lista del panel: cifras arriba y filas debajo. */
export function EsqueletoLista({ cifras = true }: { cifras?: boolean }) {
  return (
    <div>
      <Encabezado />
      {cifras && (
        <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="tarjeta space-y-3 p-5">
              <Caja className="h-7 w-16" />
              <Caja className="h-3 w-32" />
            </div>
          ))}
        </div>
      )}
      <div className="tarjeta overflow-hidden">
        <div className="flex gap-3 border-b border-[var(--borde)] p-4">
          <Caja className="h-10 flex-1" />
          <Caja className="hidden h-10 w-40 sm:block" />
        </div>
        <ul className="divide-y divide-[var(--borde)]">
          {Array.from({ length: 6 }, (_, i) => (
            <li key={i} className="flex items-center gap-4 px-5 py-4">
              <span className="min-w-0 flex-1 space-y-2">
                <Caja className="h-4 w-1/2" />
                <Caja className="h-3 w-3/4" />
              </span>
              <Caja className="hidden h-6 w-20 rounded-full sm:block" />
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

/** Una pantalla de detalle: el cuerpo a la izquierda y una columna al lado. */
export function EsqueletoDetalle() {
  return (
    <div>
      <Caja className="mb-5 h-4 w-32" />
      <Encabezado />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="tarjeta space-y-5 p-6">
          <Lineas n={4} />
          <Caja className="h-40 w-full" />
          <Lineas n={5} ultima="w-1/2" />
        </div>
        <div className="space-y-4">
          <div className="tarjeta space-y-3 p-5">
            <Caja className="h-4 w-24" />
            <Lineas n={3} />
          </div>
          <div className="tarjeta space-y-3 p-5">
            <Caja className="h-4 w-32" />
            <Lineas n={2} />
          </div>
        </div>
      </div>
    </div>
  )
}

/** Un formulario del panel. */
export function EsqueletoFormulario() {
  return (
    <div className="max-w-3xl">
      <Encabezado />
      <div className="tarjeta grid gap-5 p-6 sm:grid-cols-2">
        {Array.from({ length: 6 }, (_, i) => (
          <span key={i} className="space-y-2">
            <Caja className="h-3 w-24" />
            <Caja className="h-10 w-full" />
          </span>
        ))}
        <Caja className="h-10 w-36 sm:col-span-2" />
      </div>
    </div>
  )
}

/** La hoja de una sección del informe, con su índice al lado en pantalla ancha. */
export function EsqueletoSeccion() {
  return (
    <div className="mx-auto w-full max-w-[1200px] sm:px-6 sm:py-8 lg:px-8 lg:py-10">
      <div className="min-[1400px]:grid min-[1400px]:grid-cols-[minmax(0,1fr)_232px] min-[1400px]:gap-10">
        <div className="hoja-informe mx-auto w-full max-w-[840px]">
          <div className="space-y-4 border-b border-[var(--borde)] pb-6">
            <Aviso />
            <Caja className="h-3 w-48" />
            <Caja className="h-9 w-4/5" />
            <Caja className="h-4 w-3/5" />
            <Caja className="h-3 w-40" />
          </div>
          <div className="space-y-8 py-8">
            <Lineas n={4} />
            <span className="block space-y-3">
              <Caja className="h-6 w-2/5" />
              <Lineas n={3} ultima="w-4/5" />
            </span>
            <Caja className="h-48 w-full rounded-xl" />
            <span className="block space-y-3">
              <Caja className="h-6 w-1/3" />
              <Lineas n={5} />
            </span>
          </div>
        </div>
        <div className="hidden space-y-3 pt-10 min-[1400px]:block">
          <Caja className="h-3 w-28" />
          {Array.from({ length: 6 }, (_, i) => (
            <Caja key={i} className={cn('h-3', i % 2 ? 'w-40' : 'w-48')} />
          ))}
        </div>
      </div>
    </div>
  )
}

/** La portada del informe: la cabecera y la rejilla del contenido. */
export function EsqueletoPortada() {
  return (
    <div className="mx-auto w-full max-w-[1200px] sm:px-6 sm:py-8 lg:px-8 lg:py-10">
      <div className="hoja-informe space-y-5">
        <Aviso />
        <Caja className="h-3 w-56" />
        <Caja className="h-12 w-3/4" />
        <Caja className="h-4 w-2/3" />
        <div className="grid grid-cols-2 gap-3 pt-3 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <Caja key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      </div>
      <div className="grid gap-3 px-4 pt-10 sm:px-0 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="tarjeta space-y-3 px-5 py-4">
            <Caja className="h-3 w-10" />
            <Caja className="h-4 w-3/4" />
            <Caja className="h-3 w-full" />
          </div>
        ))}
      </div>
    </div>
  )
}
