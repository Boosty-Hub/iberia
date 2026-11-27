import Link from 'next/link'
import type { EventoMicrosoft, TareaMicrosoft } from '@/lib/asistente/microsoft-agenda'
import type { Agenda } from '@/lib/plataforma/agenda'
import type { Tarea } from '@/lib/plataforma/colaboracion'
import { cn } from '@/lib/utils'

/**
 * Las piezas de la agenda (27-nov-2026): lo de la plataforma, lo de Outlook y lo de To Do, cada uno con su color de
 * borde para distinguirlos de un vistazo. Todo se pinta en el servidor (las fechas llegan escritas: sin `Intl` en el
 * cliente).
 */

export const COLOR_ORIGEN = { plataforma: '#D4332C', outlook: '#0f6cbd', todo: '#7b61b9' } as const

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
const DIAS_CORTOS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb']
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

export function diaDe(fecha: string) {
  const d = new Date(`${fecha}T12:00:00Z`)
  return { semana: DIAS[d.getUTCDay()], corto: DIAS_CORTOS[d.getUTCDay()], numero: d.getUTCDate(), mes: MESES[d.getUTCMonth()], anio: d.getUTCFullYear() }
}

/** «9:00 a. m.», de `AAAA-MM-DDTHH:mm`. */
export function horaCorta(f: string): string {
  const [h, m] = f.slice(11, 16).split(':').map(Number)
  if (Number.isNaN(h)) return ''
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'a. m.' : 'p. m.'}`
}

/** «10:00 – 11:00 a. m.» (el sufijo una vez si las dos horas son del mismo lado del mediodía). */
export function rangoHoras(inicio: string, fin: string): string {
  const a = horaCorta(inicio)
  const b = horaCorta(fin)
  const sufijo = (x: string) => x.slice(-5)
  return sufijo(a) === sufijo(b) ? `${a.slice(0, -6)} – ${b}` : `${a} – ${b}`
}

/** Lo de un día, en orden: lo de todo el día y las tareas arriba, las reuniones por hora. */
export type ItemDia =
  | { tipo: 'outlook'; e: EventoMicrosoft }
  | { tipo: 'tarea'; t: Tarea }
  | { tipo: 'todo'; t: TareaMicrosoft }

export function itemsDelDia(agenda: Pick<Agenda, 'eventos' | 'tareas' | 'todo'>, fecha: string): ItemDia[] {
  const todoElDia = agenda.eventos.filter((e) => e.todoElDia && e.inicio.slice(0, 10) <= fecha && (e.fin.slice(0, 10) > fecha || e.fin.slice(0, 10) === e.inicio.slice(0, 10)))
  const conHora = agenda.eventos.filter((e) => !e.todoElDia && e.inicio.slice(0, 10) === fecha).sort((a, b) => a.inicio.localeCompare(b.inicio))
  return [
    ...todoElDia.map((e) => ({ tipo: 'outlook' as const, e })),
    ...agenda.tareas.filter((t) => t.vence === fecha).map((t) => ({ tipo: 'tarea' as const, t })),
    ...agenda.todo.tareas.filter((t) => t.vence === fecha).map((t) => ({ tipo: 'todo' as const, t })),
    ...conHora.map((e) => ({ tipo: 'outlook' as const, e })),
  ]
}

export function ItemAgenda({ item, compacto = false }: { item: ItemDia; compacto?: boolean }) {
  const base = 'block rounded-lg border border-[var(--borde)] border-l-[3px] bg-white px-2.5 py-1.5 text-left hover:bg-marca-50'
  if (item.tipo === 'outlook') {
    const e = item.e
    const cuerpo = (
      <>
        <span className="block text-[11px] font-medium text-[#0f6cbd]">
          {e.todoElDia ? 'Todo el día' : rangoHoras(e.inicio, e.fin)}
          {e.enLinea && <span className="text-marca-400"> · en línea</span>}
        </span>
        <span className={cn('block text-[12.5px] leading-snug text-marca-900', compacto ? 'truncate' : 'line-clamp-2', e.cancelado && 'line-through opacity-60')}>{e.asunto}</span>
        {!compacto && e.lugar && <span className="block truncate text-[11px] text-marca-500">{e.lugar}</span>}
      </>
    )
    return e.enlace ? (
      <a href={e.enlace} target="_blank" rel="noreferrer" className={base} style={{ borderLeftColor: COLOR_ORIGEN.outlook }} data-item-agenda="outlook" title="Abrir en Outlook">
        {cuerpo}
      </a>
    ) : (
      <div className={base} style={{ borderLeftColor: COLOR_ORIGEN.outlook }} data-item-agenda="outlook">
        {cuerpo}
      </div>
    )
  }
  if (item.tipo === 'todo') {
    const t = item.t
    return (
      <a href={t.enlace} target="_blank" rel="noreferrer" className={base} style={{ borderLeftColor: COLOR_ORIGEN.todo }} data-item-agenda="todo" title="Abrir en Microsoft To Do">
        <span className="block text-[11px] font-medium text-[#6a52a8]">
          To Do · {t.lista}
          {t.importante && <span className="text-acento-700"> · importante</span>}
        </span>
        <span className={cn('block text-[12.5px] leading-snug text-marca-900', compacto ? 'truncate' : 'line-clamp-2')}>{t.titulo}</span>
      </a>
    )
  }
  const t = item.t
  const href = t.objetoTipo && t.objetoId ? `/sistema/ficha/${t.objetoTipo}/${t.objetoId}` : '/sistema/tareas'
  return (
    <Link href={href} className={base} style={{ borderLeftColor: COLOR_ORIGEN.plataforma }} data-item-agenda="tarea">
      <span className="block text-[11px] font-medium text-acento-700">Tarea{t.objetoTitulo ? ` · ${t.objetoTitulo}` : ''}</span>
      <span className={cn('block text-[12.5px] leading-snug text-marca-900', compacto ? 'truncate' : 'line-clamp-2')}>{t.titulo}</span>
    </Link>
  )
}

export function Leyenda({ conMicrosoft, conTodo }: { conMicrosoft: boolean; conTodo: boolean }) {
  const punto = (color: string, texto: string) => (
    <span className="inline-flex items-center gap-1.5">
      <span className="h-2.5 w-2.5 rounded-sm" style={{ background: color }} aria-hidden />
      {texto}
    </span>
  )
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11.5px] text-marca-600">
      {punto(COLOR_ORIGEN.plataforma, 'Tareas de la plataforma')}
      {conMicrosoft && punto(COLOR_ORIGEN.outlook, 'Reuniones de Outlook')}
      {conTodo && punto(COLOR_ORIGEN.todo, 'Microsoft To Do')}
    </div>
  )
}

/** El aviso de Microsoft, según cómo esté la persona. Nada si todo está bien o si su rol no lo tiene. */
export function AvisoMicrosoft({ agenda, conTodo = true }: { agenda: Agenda; conTodo?: boolean }) {
  const m = agenda.microsoft.estado
  if (m === 'sin-conectar')
    return (
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl border border-[var(--borde)] bg-white px-3.5 py-2.5 text-[12.5px] text-marca-700" data-agenda-conectar>
        <span className="inline-grid h-3.5 w-3.5 grid-cols-2 gap-px" aria-hidden>
          <span className="bg-[#f25022]" />
          <span className="bg-[#7fba00]" />
          <span className="bg-[#00a4ef]" />
          <span className="bg-[#ffb900]" />
        </span>
        <span className="min-w-0 flex-1">Conecta tu cuenta de Microsoft para ver aquí tus reuniones de Outlook y tus tareas de To Do.</span>
        <Link href="/sistema/asistente/conexiones" className="font-semibold text-acento-700 hover:underline">
          Conectar mi cuenta
        </Link>
      </p>
    )
  if (m === 'error')
    return (
      <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-[12.5px] text-amber-900">
        No se pudo leer tu calendario de Microsoft: {agenda.microsoft.error}
      </p>
    )
  if (m === 'ok' && conTodo && agenda.todo.estado === 'sin-permiso')
    return (
      <p className="rounded-xl border border-[var(--borde)] bg-white px-3.5 py-2.5 text-[12px] text-marca-500" data-agenda-sin-todo>
        Tus reuniones de Outlook ya están aquí. Las tareas de Microsoft To Do aparecen cuando Tecnología habilite el permiso «Tasks.Read» en la aplicación de Microsoft.
      </p>
    )
  return null
}
