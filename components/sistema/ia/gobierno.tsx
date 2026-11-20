'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState, useTransition, type ReactNode } from 'react'
import { encenderCapacidad, fijarInterruptorGeneral, fijarTopeDiario, pedirCambioNivel } from '@/components/sistema/ia/acciones'
import { NivelIA } from '@/components/sistema/ia/nivel-ia'
import type { NivelIa } from '@/lib/ia/niveles'
import { cn } from '@/lib/utils'

/**
 * Las piezas interactivas del Gobierno de IA: el interruptor general (con
 * confirmación), el de cada capacidad, el tope diario y la solicitud de cambio
 * de nivel. Todo vuelve a pedir «Gobierno de IA · editar» en el servidor; subir
 * de nivel no cambia nada hasta que la ruta «nivel_ia» lo aprueba.
 */

type Res = { ok?: string; error?: string }

function Aviso({ r }: { r: Res | null }) {
  if (!r) return null
  return (
    <p role="status" className={cn('text-[12px]', r.error ? 'text-[#a3241f]' : 'text-[#1f6f4b]')}>
      {r.error ? `⚠ ${r.error}` : `✓ ${r.ok}`}
    </p>
  )
}

/** Un diálogo nativo (`<dialog>`): foco atrapado, Esc cierra, sin librerías. */
function Dialogo({ abierto, cerrar, titulo, children }: { abierto: boolean; cerrar: () => void; titulo: string; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (abierto && !el.open) el.showModal()
    if (!abierto && el.open) el.close()
  }, [abierto])
  return (
    <dialog
      ref={ref}
      onClose={cerrar}
      className="m-auto w-[min(440px,calc(100vw-2rem))] rounded-2xl border border-[var(--borde)] p-0 backdrop:bg-black/35"
      aria-label={titulo}
    >
      <div className="p-4">
        <h2 className="text-[15px] font-bold text-marca-900">{titulo}</h2>
        <div className="mt-2 text-[13px]">{children}</div>
      </div>
    </dialog>
  )
}

export function InterruptorGeneral({ encendido, puedeEditar, detalle }: { encendido: boolean; puedeEditar: boolean; detalle: string | null }) {
  const router = useRouter()
  const [abierto, setAbierto] = useState(false)
  const [motivo, setMotivo] = useState('')
  const [r, setR] = useState<Res | null>(null)
  const [ocupado, iniciar] = useTransition()
  const confirmar = () =>
    iniciar(async () => {
      const x = await fijarInterruptorGeneral(!encendido, motivo)
      setR(x)
      if (!x.error) {
        setAbierto(false)
        setMotivo('')
        router.refresh()
      }
    })
  return (
    <div data-interruptor-general className={cn('flex flex-wrap items-center gap-3 rounded-xl border bg-white p-3', encendido ? 'border-[var(--borde)]' : 'border-[#a3241f]')}>
      <div className="min-w-0 flex-1">
        <p className="text-[12px] font-semibold text-marca-500">Interruptor general</p>
        <p className="mt-0.5 flex items-center gap-1.5 text-[15px] font-bold text-marca-900">
          <span aria-hidden className={encendido ? 'text-[#1f6f4b]' : 'text-[#a3241f]'}>
            {encendido ? '●' : '■'}
          </span>
          {encendido ? 'La IA está encendida' : 'La IA está apagada en toda la plataforma'}
        </p>
        {detalle && <p className="mt-0.5 text-[11.5px] text-marca-400">{detalle}</p>}
      </div>
      {puedeEditar && (
        <button
          type="button"
          onClick={() => setAbierto(true)}
          className={cn(
            'inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold',
            encendido ? 'border border-[#a3241f] bg-white text-[#a3241f] hover:bg-[#fdf3f2]' : 'bg-[#2b2a28] text-white hover:bg-marca-700'
          )}
        >
          {encendido ? '■ Apagar toda la IA' : '● Encender la IA'}
        </button>
      )}
      <div className="w-full">
        <Aviso r={r} />
      </div>
      <Dialogo abierto={abierto} cerrar={() => setAbierto(false)} titulo={encendido ? '¿Apagar la IA en toda la plataforma?' : '¿Encender la IA?'}>
        <p className="text-marca-600">
          {encendido
            ? 'Desde ya ninguna capacidad responde, propone ni aplica nada: se esconden el panel «Preguntar», las marcas ⚑ y las propuestas. Todo sigue funcionando por el camino manual y nada se borra. Apagar lo puede hacer una sola persona; explícalo si puedes.'
            : 'Vuelven a funcionar las capacidades encendidas, cada una en su nivel. Encender pide un motivo.'}
        </p>
        <label className="mt-2 flex flex-col gap-1 text-[12px] text-marca-600">
          Motivo {encendido ? '(opcional)' : '(obligatorio)'}
          <textarea className="campo min-h-16" value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={500} />
        </label>
        <div className="mt-3 flex justify-end gap-2">
          <button type="button" onClick={() => setAbierto(false)} className="inline-flex h-9 items-center rounded-lg px-3 text-xs text-marca-600 hover:bg-marca-50">
            Cancelar
          </button>
          <button
            type="button"
            data-confirmar-interruptor
            disabled={ocupado}
            onClick={confirmar}
            className={cn('inline-flex h-9 items-center rounded-lg px-3 text-xs font-semibold disabled:opacity-60', encendido ? 'border border-[#a3241f] bg-white text-[#a3241f]' : 'bg-[#2b2a28] text-white')}
          >
            {ocupado ? 'Guardando…' : encendido ? '■ Sí, apagar' : '● Encender'}
          </button>
        </div>
        <Aviso r={r} />
      </Dialogo>
    </div>
  )
}

export function InterruptorCapacidad({ codigo, encendida, nivel, puedeEditar }: { codigo: string; encendida: boolean; nivel: NivelIa; puedeEditar: boolean }) {
  const router = useRouter()
  const [abierto, setAbierto] = useState(false)
  const [motivo, setMotivo] = useState('')
  const [r, setR] = useState<Res | null>(null)
  const [ocupado, iniciar] = useTransition()
  const enN0 = nivel === 'N0'
  const cambiar = () =>
    iniciar(async () => {
      const x = await encenderCapacidad(codigo, !encendida, motivo)
      setR(x)
      if (!x.error) {
        setAbierto(false)
        setMotivo('')
        router.refresh()
      }
    })
  return (
    <>
      <button
        type="button"
        role="switch"
        aria-checked={encendida}
        aria-label={`${encendida ? 'Apagar' : 'Encender'} ${codigo}`}
        disabled={!puedeEditar || (enN0 && !encendida)}
        title={enN0 && !encendida ? 'En N0 no se enciende: primero se pide subirla a N1' : undefined}
        onClick={() => setAbierto(true)}
        className={cn(
          'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors disabled:cursor-not-allowed disabled:opacity-50',
          encendida ? 'border-[#1f6f4b] bg-[#1f8a5b]' : 'border-[#b9bfc8] bg-[#d9dde3]'
        )}
      >
        <span className={cn('absolute h-4.5 w-4.5 rounded-full bg-white shadow transition-all', encendida ? 'left-[22px]' : 'left-[3px]')} />
        <span className="sr-only">{encendida ? 'Encendida' : 'Apagada'}</span>
      </button>
      <span className="ml-1.5 text-[11px] text-marca-500">{encendida ? 'Encendida' : 'Apagada'}</span>
      {r?.error && <span className="ml-1 text-[11px] text-[#a3241f]">⚠</span>}
      <Dialogo abierto={abierto} cerrar={() => setAbierto(false)} titulo={`${encendida ? 'Apagar' : 'Encender'} ${codigo}`}>
        <p className="text-marca-600">
          {encendida ? 'Apagar es inmediato y lo puede hacer una sola persona. Las propuestas pendientes se quedan guardadas.' : 'Encender la deja trabajar en su nivel actual. En la Fase 2 caben 10 encendidas (D-13).'}
        </p>
        <label className="mt-2 flex flex-col gap-1 text-[12px] text-marca-600">
          Motivo {encendida ? '(opcional)' : '(obligatorio)'}
          <textarea className="campo min-h-14" value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={500} />
        </label>
        <div className="mt-3 flex justify-end gap-2">
          <button type="button" onClick={() => setAbierto(false)} className="inline-flex h-9 items-center rounded-lg px-3 text-xs text-marca-600 hover:bg-marca-50">
            Cancelar
          </button>
          <button type="button" disabled={ocupado} onClick={cambiar} className="inline-flex h-9 items-center rounded-lg bg-[#2b2a28] px-3 text-xs font-semibold text-white disabled:opacity-60">
            {ocupado ? 'Guardando…' : encendida ? 'Apagar' : 'Encender'}
          </button>
        </div>
        <Aviso r={r} />
      </Dialogo>
    </>
  )
}

export function CambioNivel({ codigo, nivel, techo, puedeEditar, pendiente }: { codigo: string; nivel: NivelIa; techo: NivelIa; puedeEditar: boolean; pendiente: string | null }) {
  const router = useRouter()
  const [abierto, setAbierto] = useState(false)
  const n = Number(nivel.slice(1))
  const t = Number(techo.slice(1))
  const opciones = [...Array.from({ length: n }, (_, i) => `N${i}`), ...(n < t ? [`N${n + 1}`] : [])] as NivelIa[]
  const [destino, setDestino] = useState<NivelIa>(opciones.at(-1) ?? 'N0')
  const [motivo, setMotivo] = useState('')
  const [evidencia, setEvidencia] = useState('')
  const [r, setR] = useState<Res | null>(null)
  const [ocupado, iniciar] = useTransition()
  const sube = Number(destino.slice(1)) > n
  if (!puedeEditar) return null
  if (pendiente)
    return (
      <a href="/sistema/bandeja" className="text-[11px] font-semibold text-[#8f4a00] underline">
        Pide {pendiente} · en aprobación
      </a>
    )
  return (
    <>
      <button type="button" onClick={() => setAbierto(true)} className="text-[11px] font-medium text-[#1d4f8f] underline" data-cambiar-nivel={codigo}>
        Cambiar nivel
      </button>
      <Dialogo abierto={abierto} cerrar={() => setAbierto(false)} titulo={`Nivel de ${codigo}`}>
        <p className="flex items-center gap-1.5 text-marca-600">
          Hoy: <NivelIA nivel={nivel} /> · techo <NivelIA nivel={techo} />
        </p>
        <label className="mt-2 flex flex-col gap-1 text-[12px] text-marca-600">
          Nivel nuevo
          <select className="campo h-9" value={destino} onChange={(e) => setDestino(e.target.value as NivelIa)}>
            {opciones.map((o) => (
              <option key={o} value={o}>
                {o} {Number(o.slice(1)) > n ? '· subir (pide aprobación)' : '· bajar (inmediato)'}
              </option>
            ))}
          </select>
        </label>
        <p className="mt-1 text-[11.5px] text-marca-500">
          {sube
            ? 'Subir es configuración sensible: queda quién lo pidió y por qué, y pasa por la ruta «nivel_ia» (revisa el Gerente de TI, aprueba el Gerente General). Un nivel a la vez y nunca por encima del techo.'
            : 'Bajar es inmediato y queda en la actividad.'}
        </p>
        <label className="mt-2 flex flex-col gap-1 text-[12px] text-marca-600">
          Motivo (obligatorio)
          <textarea className="campo min-h-14" value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={1000} />
        </label>
        {sube && (
          <label className="mt-2 flex flex-col gap-1 text-[12px] text-marca-600">
            Evidencia para subir (juego de casos, tasas, firmas)
            <textarea className="campo min-h-14" value={evidencia} onChange={(e) => setEvidencia(e.target.value)} maxLength={2000} />
          </label>
        )}
        <div className="mt-3 flex justify-end gap-2">
          <button type="button" onClick={() => setAbierto(false)} className="inline-flex h-9 items-center rounded-lg px-3 text-xs text-marca-600 hover:bg-marca-50">
            Cancelar
          </button>
          <button
            type="button"
            disabled={ocupado}
            onClick={() =>
              iniciar(async () => {
                const x = await pedirCambioNivel(codigo, destino, motivo, evidencia)
                setR(x)
                if (!x.error) {
                  setAbierto(false)
                  router.refresh()
                }
              })
            }
            className="inline-flex h-9 items-center rounded-lg bg-[#2b2a28] px-3 text-xs font-semibold text-white disabled:opacity-60"
          >
            {ocupado ? 'Enviando…' : sube ? 'Pedir aprobación' : 'Bajar ahora'}
          </button>
        </div>
        <Aviso r={r} />
      </Dialogo>
      {r?.ok && <span className="block text-[11px] text-[#1f6f4b]">✓ {r.ok}</span>}
    </>
  )
}

export function TopeDiario({ tope, puedeEditar }: { tope: number; puedeEditar: boolean }) {
  const router = useRouter()
  const [editando, setEditando] = useState(false)
  const [valor, setValor] = useState(String(tope))
  const [motivo, setMotivo] = useState('')
  const [r, setR] = useState<Res | null>(null)
  const [ocupado, iniciar] = useTransition()
  if (!puedeEditar) return null
  return editando ? (
    <div className="mt-2 flex flex-wrap items-end gap-2">
      <label className="flex flex-col gap-0.5 text-[11.5px] text-marca-600">
        US$ al día
        <input type="number" min={0} max={500} step="0.5" className="campo h-8 w-24" value={valor} onChange={(e) => setValor(e.target.value)} />
      </label>
      <label className="flex min-w-40 flex-1 flex-col gap-0.5 text-[11.5px] text-marca-600">
        Motivo
        <input className="campo h-8" value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={200} />
      </label>
      <button
        type="button"
        disabled={ocupado}
        onClick={() =>
          iniciar(async () => {
            const x = await fijarTopeDiario(Number(valor), motivo)
            setR(x)
            if (!x.error) {
              setEditando(false)
              router.refresh()
            }
          })
        }
        className="inline-flex h-8 items-center rounded-lg bg-[#2b2a28] px-2.5 text-xs font-semibold text-white disabled:opacity-60"
      >
        Guardar
      </button>
      <Aviso r={r} />
    </div>
  ) : (
    <button type="button" onClick={() => setEditando(true)} className="mt-1 text-[11px] font-medium text-[#1d4f8f] underline">
      Cambiar el tope diario
    </button>
  )
}

/** Un botón que corre una acción de la IA (revisar plazas, clasificar) y dice qué pasó. */
export function BotonAccionIa({ etiqueta, accion, ayuda }: { etiqueta: string; accion: () => Promise<Res>; ayuda?: string }) {
  const router = useRouter()
  const [r, setR] = useState<Res | null>(null)
  const [ocupado, iniciar] = useTransition()
  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        title={ayuda}
        disabled={ocupado}
        data-accion-ia={etiqueta}
        onClick={() =>
          iniciar(async () => {
            const x = await accion().catch(() => ({ error: 'No se pudo hablar con el servidor.' }))
            setR(x)
            router.refresh()
          })
        }
        className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-dashed border-[#9d93bd] bg-white px-2.5 text-xs font-medium text-[#4f4577] hover:bg-[#fbfaff] disabled:opacity-60"
      >
        <span aria-hidden>✦</span> {ocupado ? 'La IA está revisando…' : etiqueta}
      </button>
      {r && (
        <span className="max-w-md">
          {r.ok && <Aviso r={{ ok: r.ok }} />}
          {r.error && <Aviso r={{ error: r.error }} />}
        </span>
      )}
    </span>
  )
}
