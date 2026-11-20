import { abrirAviso } from '@/app/canal/(dentro)/avisos/acciones'
import { haceCuanto } from '@/lib/canal'
import { TIPO_NOTIFICACION, type Notificacion } from '@/lib/plataforma/colaboracion'
import { cn } from '@/lib/utils'

export const ETIQUETA_AVISO: Record<string, string> = {
  aprobacion: 'Aprobación',
  mencion: 'Mención',
  seguimiento: 'Algo que sigues',
  tarea: 'Tarea',
  ia: 'IA',
  sistema: 'Plataforma',
}

/**
 * Un aviso de la plataforma en el canal: la misma notificación de la campana de
 * `/sistema`, en fila de teléfono (44 px o más, todo el ancho se toca). Tocarlo
 * lo marca leído y abre su objeto (`abrirAviso`). El tipo se lee por la marca y
 * por el texto, nunca solo por el color.
 */
export function AvisoPlataforma({ aviso, ahora }: { aviso: Notificacion; ahora: Date }) {
  const tipo = TIPO_NOTIFICACION[aviso.tipo] ?? TIPO_NOTIFICACION.sistema
  return (
    <form action={abrirAviso}>
      <input type="hidden" name="id" value={aviso.id} />
      <button type="submit" className="flex min-h-14 w-full items-start gap-3 px-4 py-3 text-left active:bg-marca-50">
        <span aria-hidden className={cn('mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full text-[15px] font-bold', tipo.clase)}>
          {tipo.marca}
        </span>
        <span className="min-w-0 flex-1">
          <span className={cn('block text-[15px] leading-snug text-marca-900', !aviso.leida && 'font-semibold')}>{aviso.texto}</span>
          <span className="mt-0.5 block text-[12px] text-marca-500">
            {ETIQUETA_AVISO[aviso.tipo] ?? 'Aviso'}
            {aviso.detalle ? ` · ${aviso.detalle}` : ''} · {haceCuanto(aviso.creadoEn, ahora)}
            {!aviso.leida && <span className="sr-only"> · sin leer</span>}
          </span>
        </span>
        {!aviso.leida && <span aria-hidden className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full bg-acento-600" />}
      </button>
    </form>
  )
}
