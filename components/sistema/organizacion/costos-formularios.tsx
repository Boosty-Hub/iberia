'use client'

import { useActionState, useState, useTransition } from 'react'
import { crearComponente } from '@/app/sistema/nucleo/organizacion/dotacion/acciones'
import { fijarParametro } from '@/app/sistema/nucleo/organizacion/celdas'
import { Desplegable } from '@/components/sistema/ui/desplegable'
import { fechaLarga, hoyCaracas, numero } from '@/lib/plataforma/formato'
import { cn } from '@/lib/utils'

/**
 * Lo editable de Costos 🔒 que no cabe en una celda: los parámetros (con su
 * fecha) y el alta de un componente. Todo va por las funciones de la base, que
 * cierran la versión que rige y abren otra.
 */

const CAMPO = 'h-8 w-full rounded-md border border-[var(--borde)] bg-white px-2 text-[13px] outline-none focus:border-marca-500'
const BTN = 'inline-flex h-8 items-center justify-center rounded-md px-3 text-xs font-semibold disabled:opacity-60'

export type Parametro = { id: string; clave: string; nombre: string; valor: number; unidad: string; desde: string; fuente: string | null; por_confirmar: string }

function FilaParametro({ p, editar }: { p: Parametro; editar: boolean }) {
  const hoy = hoyCaracas()
  const [abierto, setAbierto] = useState(false)
  const [valor, setValor] = useState(numero(p.valor, 2))
  const [fecha, setFecha] = useState(hoy)
  const [confirmar, setConfirmar] = useState(p.por_confirmar === 'si')
  const [r, setR] = useState<{ error?: string; ok?: string } | null>(null)
  const [pendiente, iniciar] = useTransition()
  return (
    <li className="px-3 py-2.5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="min-w-0 flex-1 font-medium text-marca-900">{p.nombre}</span>
        <span className="font-semibold text-marca-900 tabular-nums">
          {p.unidad === 'USD' ? 'USD ' : p.unidad === 'VES' ? 'Bs ' : ''}
          {numero(p.valor, 2)}
          {p.unidad === '%' ? ' %' : p.unidad === 'días' ? ' días' : ''}
        </span>
        <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-semibold', p.por_confirmar === 'si' ? 'bg-[#fdf4e3] text-[#8a5a12]' : 'bg-[#e7f5ee] text-[#1f6f4b]')}>
          {p.por_confirmar === 'si' ? 'Por confirmar' : 'Confirmado'}
        </span>
        {editar && !abierto && (
          <button type="button" onClick={() => setAbierto(true)} className="text-[12px] font-semibold text-marca-600 underline decoration-dotted underline-offset-2">
            Cambiar
          </button>
        )}
      </div>
      <p className="text-[11.5px] text-marca-400">
        Rige desde el {fechaLarga(p.desde)} · {p.fuente ?? 'sin fuente'}
      </p>
      {abierto && (
        <form
          className="mt-2 grid gap-2 rounded-lg border border-[var(--borde)] bg-[#fafafa] p-2 sm:grid-cols-[8rem_10rem_1fr_auto] sm:items-end"
          onSubmit={(e) => {
            e.preventDefault()
            iniciar(async () => {
              const res = await fijarParametro(p.clave, valor, fecha, confirmar)
              setR(res)
              if (!res.error) setAbierto(false)
            })
          }}
        >
          <label className="flex flex-col gap-0.5 text-[12px] text-marca-600">
            Valor ({p.unidad})
            <input value={valor} onChange={(e) => setValor(e.target.value)} inputMode="decimal" className={CAMPO} autoFocus />
          </label>
          <label className="flex flex-col gap-0.5 text-[12px] text-marca-600">
            Rige desde
            <input type="date" min={hoy} value={fecha} onChange={(e) => setFecha(e.target.value)} className={CAMPO} />
          </label>
          <label className="flex items-center gap-1.5 text-[12px] text-marca-700">
            <input type="checkbox" checked={confirmar} onChange={(e) => setConfirmar(e.target.checked)} className="h-4 w-4" />
            Por confirmar con Capital Humano
          </label>
          <span className="flex gap-1.5">
            <button type="submit" disabled={pendiente} className={cn(BTN, 'bg-[#2b2a28] text-white')}>
              {pendiente ? 'Guardando…' : 'Guardar'}
            </button>
            <button type="button" onClick={() => setAbierto(false)} className={cn(BTN, 'border border-[var(--borde)] bg-white text-marca-800')}>
              Cancelar
            </button>
          </span>
        </form>
      )}
      {r && <p className={cn('mt-1.5 rounded-md px-2 py-1 text-[12px]', r.error ? 'bg-[#fbeceb] text-[#a3241f]' : 'bg-[#e7f5ee] text-[#1f6f4b]')}>{r.error ?? `✓ ${r.ok}`}</p>}
    </li>
  )
}

export function ListaParametros({ parametros, editar }: { parametros: Parametro[]; editar: boolean }) {
  if (!parametros.length) return <p className="py-6 text-center text-sm text-marca-400">No hay parámetros vigentes a esa fecha.</p>
  return (
    <ul className="divide-y divide-[var(--borde)] rounded-xl border border-[var(--borde)] bg-white text-[13px]">
      {parametros.map((p) => (
        <FilaParametro key={p.id} p={p} editar={editar} />
      ))}
    </ul>
  )
}

export function NuevoComponente() {
  const [estado, accion, pendiente] = useActionState(crearComponente, {})
  const hoy = hoyCaracas()
  return (
    <Desplegable
      etiqueta="Agregar un componente de costo"
      alinear="der"
      ancho="w-[22rem]"
      claseBoton="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#2b2a28] px-3 text-xs font-semibold text-white hover:bg-marca-700"
      boton={<>+ Componente</>}
    >
      <form action={accion} className="flex flex-col gap-2 p-3 text-[12px] text-marca-600">
        <label className="flex flex-col gap-0.5">
          Nombre
          <input name="nombre" required minLength={3} className={CAMPO} autoFocus />
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-0.5">
            Forma
            <select name="forma" className={CAMPO} defaultValue="porcentaje">
              <option value="porcentaje">% de la base</option>
              <option value="dias_anuales">Días de salario al año</option>
              <option value="monto_mensual">Monto mensual</option>
            </select>
          </label>
          <label className="flex flex-col gap-0.5">
            Valor
            <input name="valor" required inputMode="decimal" className={CAMPO} />
          </label>
          <label className="flex flex-col gap-0.5">
            Base
            <select name="base" className={CAMPO} defaultValue="salario_normal">
              <option value="salario_normal">Salario normal</option>
              <option value="salario_integral">Salario integral</option>
              <option value="salario_y_bonos">Salario y bonos</option>
              <option value="ninguna">Ninguna</option>
            </select>
          </label>
          <label className="flex flex-col gap-0.5">
            Moneda (si es monto)
            <select name="moneda" className={CAMPO} defaultValue="VES">
              <option value="VES">Bs</option>
              <option value="USD">USD</option>
            </select>
          </label>
        </div>
        <label className="flex flex-col gap-0.5">
          Base legal
          <input name="base_legal" className={CAMPO} placeholder="Ley, artículo o cláusula de la convención" />
        </label>
        <label className="flex flex-col gap-0.5">
          Rige desde
          <input type="date" name="fecha" min={hoy} defaultValue={hoy} className={CAMPO} />
        </label>
        <label className="flex items-center gap-1.5 text-marca-700">
          <input type="checkbox" name="por_confirmar" defaultChecked className="h-4 w-4" /> Por confirmar con Capital Humano
        </label>
        {(estado.error || estado.ok) && (
          <p className={cn('rounded-md px-2 py-1', estado.error ? 'bg-[#fbeceb] text-[#a3241f]' : 'bg-[#e7f5ee] text-[#1f6f4b]')}>{estado.error ?? `✓ ${estado.ok}`}</p>
        )}
        <button type="submit" disabled={pendiente} className={cn(BTN, 'bg-[#2b2a28] text-white')}>
          {pendiente ? 'Guardando…' : 'Agregar componente'}
        </button>
      </form>
    </Desplegable>
  )
}
