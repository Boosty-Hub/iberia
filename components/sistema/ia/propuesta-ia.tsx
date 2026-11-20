'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useTransition } from 'react'
import { aceptarPropuestaPlaza, decidirPropuesta, deshacerPropuesta } from '@/components/sistema/ia/acciones'
import { GeneradoConIa, NivelIA } from '@/components/sistema/ia/nivel-ia'
import { ESTADOS_PROPUESTA, sigueAbierta, type PropuestaVista } from '@/lib/ia/niveles'
import { fechaHora } from '@/lib/plataforma/formato'
import { cn } from '@/lib/utils'

/**
 * `<PropuestaIA/>` (Anexo E §7): la tarjeta de una propuesta de la IA sobre un
 * objeto. Nivel siempre visible con su texto; evidencia a la vista desde N2;
 * N3 dice Aprobar / Editar / Rechazar; N4 trae «Deshacer» con su cuenta
 * regresiva. Rechazar pide motivo. La IA propone; quien decide es la persona.
 */

const BORDE: Record<string, string> = {
  N1: 'border-dashed border-[#9d93bd]',
  N2: 'border-[#a9c4ec] border-l-4 border-l-[#3b6fb6]',
  N3: 'border-[#efc27f] border-l-4 border-l-[#c77a12]',
  N4: 'border-[#b9bfc8] border-l-4 border-l-[#6b7380]',
}

const ETIQUETA_CAMPO: Record<string, string> = { familia: 'Familia', proceso_ref: 'Proceso', estado: 'Estado' }

export function CuentaRegresiva({ hasta, onVencer }: { hasta: string; onVencer?: () => void }) {
  const [ahora, setAhora] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setAhora(Date.now()), 30_000)
    return () => clearInterval(t)
  }, [])
  const resta = new Date(hasta).getTime() - ahora
  useEffect(() => {
    if (resta <= 0) onVencer?.()
  }, [resta, onVencer])
  if (resta <= 0) return <span>La ventana para deshacer cerró</span>
  const h = Math.floor(resta / 3_600_000)
  const m = Math.floor((resta % 3_600_000) / 60_000)
  return (
    <span className="tabular-nums" data-cuenta-regresiva>
      Se puede deshacer por {h > 0 ? `${h} h ` : ''}
      {m} min
    </span>
  )
}

export function PropuestaIA({
  p,
  puedeDecidir,
  decidioNombre,
  alCambiar,
  compacta = false,
}: {
  p: PropuestaVista
  puedeDecidir: boolean
  decidioNombre?: string | null
  alCambiar?: () => void
  compacta?: boolean
}) {
  const router = useRouter()
  const [modo, setModo] = useState<'nada' | 'aceptar' | 'editar' | 'rechazar' | 'deshacer'>('nada')
  const [motivo, setMotivo] = useState('')
  const [valor, setValor] = useState('')
  const [fecha, setFecha] = useState(() => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Caracas' }).format(new Date()))
  const [aviso, setAviso] = useState<{ ok?: string; error?: string } | null>(null)
  const [ocupado, iniciar] = useTransition()
  const [vencida, setVencida] = useState(false)

  const pl = p.payload as { accion?: string; dotacion_actual?: number; dotacion_propuesta?: number; cambios?: Record<string, string>; antes?: Record<string, string | null> }
  const esN3 = p.nivel === 'N3'
  const pendiente = p.estado === 'pendiente'
  const deshacible = p.nivel === 'N4' && p.estado === 'aceptada' && p.deshacer_hasta && !vencida && sigueAbierta(p.deshacer_hasta)

  const hecho = (r: { ok?: string; error?: string; href?: string }) => {
    setAviso(r)
    if (!r.error) {
      setModo('nada')
      alCambiar?.()
      router.refresh()
      if (r.href) router.push(r.href)
    }
  }

  const aceptar = () =>
    iniciar(async () => {
      if (p.objeto_tipo === 'plaza') hecho(await aceptarPropuestaPlaza(p.id, { dotacion: valor || undefined, fecha }))
      else hecho(await decidirPropuesta(p.id, 'aceptada'))
    })
  const editar = () =>
    iniciar(async () => {
      const campo = Object.keys(pl.cambios ?? {})[0]
      if (!campo || !valor) return setAviso({ error: 'Elige el valor.' })
      hecho(await decidirPropuesta(p.id, 'editada', '', { [campo]: valor }))
    })
  const rechazar = () =>
    iniciar(async () => {
      if (!motivo.trim()) return setAviso({ error: 'Rechazar pide un motivo: es lo que la IA y su dueño leen para mejorar.' })
      hecho(await decidirPropuesta(p.id, 'rechazada', motivo))
    })
  const deshacer = () => iniciar(async () => hecho(await deshacerPropuesta(p.id, motivo)))

  const etiquetaAceptar = esN3 ? 'Aprobar' : p.objeto_tipo === 'plaza' && pl.accion === 'revisar_vacante' ? 'Pedir la requisición' : 'Aceptar'

  return (
    <article data-propuesta-ia={p.id} className={cn('rounded-xl border bg-white p-2.5', BORDE[p.nivel] ?? BORDE.N2)}>
      <header className="flex flex-wrap items-center gap-1.5">
        <NivelIA nivel={p.nivel} />
        <span className="font-mono text-[10.5px] text-marca-400">{p.capacidad}</span>
        {!pendiente && (
          <span className="ml-auto rounded-full bg-[#eef0f3] px-2 py-px text-[10.5px] font-semibold text-marca-600">{p.nivel === 'N4' && p.estado === 'aceptada' && !p.decidido_por ? 'Aplicada por la IA' : (ESTADOS_PROPUESTA[p.estado] ?? p.estado)}</span>
        )}
      </header>
      <p className="mt-1.5 font-semibold text-marca-900">{p.titulo}</p>
      <p className="mt-0.5 text-[12.5px] text-marca-700">{p.cuerpo}</p>

      {p.explicacion && (
        <div className="mt-1.5 rounded-lg border border-dashed border-[#cdc5e4] bg-[#fbfaff] p-2 text-[12.5px] text-marca-700">
          <GeneradoConIa className="mb-1" />
          <p>{p.explicacion}</p>
        </div>
      )}

      {pl.cambios && (
        <dl className="mt-1.5 grid grid-cols-[6.5rem_1fr] gap-x-2 gap-y-0.5 text-[12px]">
          {Object.entries(pl.cambios).map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-marca-500">{ETIQUETA_CAMPO[k] ?? k}</dt>
              <dd className="text-marca-800">
                <span className="text-marca-400 line-through">{pl.antes?.[k] ?? 'vacío'}</span> → <strong>{k === 'proceso_ref' ? 'proceso sugerido' : v}</strong>
              </dd>
            </div>
          ))}
        </dl>
      )}

      {!compacta && p.evidencia?.length > 0 && (
        <details className="mt-1.5 text-[12px]" open={p.nivel !== 'N1'}>
          <summary className="cursor-pointer text-marca-500 select-none">Evidencia ({p.evidencia.length})</summary>
          <ul className="mt-1 flex flex-col gap-0.5">
            {p.evidencia.map((e, i) => (
              <li key={i} className="flex gap-1.5 text-marca-600">
                <span aria-hidden className="text-marca-300">›</span>
                <span className="min-w-0">
                  <strong className="font-semibold text-marca-700">{e.campo}</strong>
                  {e.valor !== undefined && e.valor !== null && <> = {String(e.valor)}</>}
                  {e.fuente && <span className="text-marca-400"> · {e.fuente}</span>}
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}

      {!pendiente && (p.decidido_en || p.motivo) && (
        <p className="mt-1.5 text-[11.5px] text-marca-500">
          {p.decidido_por ? `${decidioNombre ?? 'Una persona'} · ` : p.nivel === 'N4' ? 'La IA lo aplicó sola · ' : ''}
          {fechaHora(p.decidido_en)}
          {p.motivo && <> · «{p.motivo}»</>}
        </p>
      )}

      {deshacible && p.deshacer_hasta && (
        <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg bg-[#f4f5f7] px-2 py-1.5 text-[12px] text-marca-700">
          <span aria-hidden>↶</span>
          <CuentaRegresiva hasta={p.deshacer_hasta} onVencer={() => setVencida(true)} />
          {puedeDecidir && (
            <button type="button" className="ml-auto inline-flex h-7 items-center gap-1 rounded-md border border-[#6b7380] bg-white px-2 font-semibold text-marca-800 hover:bg-marca-50" onClick={() => setModo(modo === 'deshacer' ? 'nada' : 'deshacer')}>
              ↶ Deshacer
            </button>
          )}
        </div>
      )}

      {pendiente && puedeDecidir && modo === 'nada' && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          <button type="button" className="inline-flex h-8 items-center rounded-lg bg-[#2b2a28] px-2.5 text-xs font-semibold text-white hover:bg-marca-700" onClick={() => setModo('aceptar')}>
            ✓ {etiquetaAceptar}
          </button>
          {(esN3 || p.objeto_tipo === 'documento') && pl.cambios && (
            <button type="button" className="inline-flex h-8 items-center rounded-lg border border-[var(--borde)] bg-white px-2.5 text-xs font-medium text-marca-800 hover:bg-marca-50" onClick={() => setModo('editar')}>
              ✎ Editar
            </button>
          )}
          <button type="button" className="inline-flex h-8 items-center rounded-lg border border-[var(--borde)] bg-white px-2.5 text-xs font-medium text-marca-800 hover:bg-marca-50" onClick={() => setModo('rechazar')}>
            ✕ Rechazar
          </button>
        </div>
      )}
      {pendiente && !puedeDecidir && <p className="mt-2 text-[11.5px] text-marca-400">La decide quien edita este tipo de objeto.</p>}

      {modo === 'aceptar' && (
        <div className="mt-2 flex flex-col gap-2 rounded-lg border border-[var(--borde)] bg-[#fafbfc] p-2">
          {p.objeto_tipo === 'plaza' && pl.accion === 'editar_dotacion' && (
            <label className="flex flex-col gap-0.5 text-[12px] text-marca-600">
              Dotación nueva (propuesta: {pl.dotacion_propuesta}; hoy: {pl.dotacion_actual})
              <input type="number" min={1} max={999} className="campo h-8 w-28" defaultValue={pl.dotacion_propuesta} onChange={(e) => setValor(e.target.value)} />
            </label>
          )}
          {p.objeto_tipo === 'plaza' && pl.accion !== 'revisar_vacante' && (
            <label className="flex flex-col gap-0.5 text-[12px] text-marca-600">
              Rige desde
              <input type="date" className="campo h-8 w-40" value={fecha} onChange={(e) => setFecha(e.target.value)} />
            </label>
          )}
          {p.objeto_tipo === 'plaza' && pl.accion === 'editar_dotacion' && (
            <p className="text-[11.5px] text-marca-500">
              ¿Prefieres verlo antes como «debería ser»?{' '}
              <Link href="/sistema/nucleo/escenarios" className="font-semibold text-[#1d4f8f] underline">
                Ábrelo en un escenario
              </Link>
              .
            </p>
          )}
          <div className="flex flex-wrap gap-1.5">
            <button type="button" disabled={ocupado} onClick={aceptar} className="inline-flex h-8 items-center rounded-lg bg-[#2b2a28] px-2.5 text-xs font-semibold text-white disabled:opacity-60">
              {ocupado ? 'Aplicando…' : p.objeto_tipo === 'plaza' && pl.accion !== 'revisar_vacante' ? 'Aplicar con fecha' : `Confirmar: ${etiquetaAceptar.toLowerCase()}`}
            </button>
            <button type="button" onClick={() => setModo('nada')} className="inline-flex h-8 items-center rounded-lg px-2 text-xs text-marca-600 hover:bg-marca-50">
              Cancelar
            </button>
          </div>
        </div>
      )}

      {modo === 'editar' && pl.cambios && (
        <div className="mt-2 flex flex-col gap-2 rounded-lg border border-[var(--borde)] bg-[#fafbfc] p-2">
          {Object.keys(pl.cambios)[0] === 'estado' ? (
            <select className="campo h-8" defaultValue="" onChange={(e) => setValor(e.target.value)} aria-label="Estado que aplicas">
              <option value="" disabled>
                Elige el estado…
              </option>
              <option value="vigente">Vigente</option>
              <option value="obsoleto">Obsoleto</option>
              <option value="borrador">Borrador</option>
              <option value="retirado">Retirado</option>
            </select>
          ) : (
            <input className="campo h-8" placeholder={`Valor de ${ETIQUETA_CAMPO[Object.keys(pl.cambios)[0]] ?? 'campo'} (p. ej. FAM-05)`} onChange={(e) => setValor(e.target.value)} />
          )}
          <div className="flex gap-1.5">
            <button type="button" disabled={ocupado} onClick={editar} className="inline-flex h-8 items-center rounded-lg bg-[#2b2a28] px-2.5 text-xs font-semibold text-white disabled:opacity-60">
              Aplicar mi versión
            </button>
            <button type="button" onClick={() => setModo('nada')} className="inline-flex h-8 items-center rounded-lg px-2 text-xs text-marca-600 hover:bg-marca-50">
              Cancelar
            </button>
          </div>
        </div>
      )}

      {(modo === 'rechazar' || modo === 'deshacer') && (
        <div className="mt-2 flex flex-col gap-2 rounded-lg border border-[var(--borde)] bg-[#fafbfc] p-2">
          <label className="flex flex-col gap-0.5 text-[12px] text-marca-600">
            {modo === 'rechazar' ? 'Motivo (obligatorio)' : 'Motivo (opcional)'}
            <textarea className="campo min-h-16" value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={1000} placeholder={modo === 'rechazar' ? '¿Por qué no aplica?' : ''} />
          </label>
          <div className="flex gap-1.5">
            <button
              type="button"
              disabled={ocupado}
              onClick={modo === 'rechazar' ? rechazar : deshacer}
              className="inline-flex h-8 items-center rounded-lg border border-[#a3241f] bg-white px-2.5 text-xs font-semibold text-[#a3241f] disabled:opacity-60"
            >
              {modo === 'rechazar' ? '✕ Rechazar la propuesta' : '↶ Deshacer ahora'}
            </button>
            <button type="button" onClick={() => setModo('nada')} className="inline-flex h-8 items-center rounded-lg px-2 text-xs text-marca-600 hover:bg-marca-50">
              Cancelar
            </button>
          </div>
        </div>
      )}

      {aviso && (
        <p role="status" className={cn('mt-1.5 text-[12px]', aviso.error ? 'text-[#a3241f]' : 'text-[#1f6f4b]')}>
          {aviso.error ? `⚠ ${aviso.error}` : `✓ ${aviso.ok}`}
        </p>
      )}
    </article>
  )
}
