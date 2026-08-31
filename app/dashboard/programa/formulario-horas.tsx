'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { cargarHoras, crearHito, type EstadoFormulario } from './acciones'
import {
  ENTREGABLES,
  ESTADOS_HITO,
  ORDEN_ENTREGABLES,
  IMPUTACIONES,
  IMPUTACION_NOTA,
  ORDEN_PERFILES,
  PERFILES,
  PERFIL_ROL,
  TIPOS_HITO,
} from '@/lib/programa'

const INICIAL: EstadoFormulario = {}

function Boton({ etiqueta }: { etiqueta: string }) {
  const { pending } = useFormStatus()
  return (
    <button type="submit" className="btn-acento" disabled={pending}>
      {pending ? 'Guardando…' : etiqueta}
    </button>
  )
}

function Mensaje({ estado }: { estado: EstadoFormulario }) {
  if (estado.error) {
    return <p className="mt-3 text-sm text-acento-700">{estado.error}</p>
  }
  if (estado.ok) {
    return <p className="mt-3 text-sm text-emerald-700">{estado.ok}</p>
  }
  return null
}

/** Hoy, en la zona del navegador, para el valor por defecto de la fecha. */
function hoy(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

export function FormularioHoras() {
  const [estadoHoras, accionHoras] = useActionState(cargarHoras, INICIAL)
  const [estadoHito, accionHito] = useActionState(crearHito, INICIAL)

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {/* --- Horas ---------------------------------------------------------- */}
      <form action={accionHoras} className="tarjeta p-5">
        <p className="mb-4 text-sm font-semibold text-marca-800">Horas consumidas</p>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="h-fecha" className="etiqueta">
              Fecha
            </label>
            <input
              id="h-fecha"
              name="fecha"
              type="date"
              required
              defaultValue={hoy()}
              className="campo"
            />
          </div>

          <div>
            <label htmlFor="h-horas" className="etiqueta">
              Horas
            </label>
            <input
              id="h-horas"
              name="horas"
              type="text"
              inputMode="decimal"
              required
              placeholder="3,5"
              className="campo"
            />
          </div>
        </div>

        <div className="mt-4">
          <label htmlFor="h-perfil" className="etiqueta">
            Perfil
          </label>
          <select id="h-perfil" name="perfil" required className="campo">
            {ORDEN_PERFILES.map((p) => (
              <option key={p} value={p}>
                {PERFILES[p]}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-marca-500">
            Se tarifa el perfil, no la persona: la misma persona carga como perfiles
            distintos según lo que estuviera haciendo. {PERFIL_ROL.consultor_procesos}, por
            ejemplo, cubre las entrevistas.
          </p>
        </div>

        <div className="mt-4">
          <label htmlFor="h-entregable" className="etiqueta">
            Contra qué entregable
          </label>
          <select id="h-entregable" name="entregable" className="campo" defaultValue="gestion">
            {ORDEN_ENTREGABLES.map((e) => (
              <option key={e} value={e}>
                {ENTREGABLES[e]}
              </option>
            ))}
          </select>
        </div>

        <div className="mt-4">
          <label htmlFor="h-descripcion" className="etiqueta">
            En qué se fueron
          </label>
          <input
            id="h-descripcion"
            name="descripcion"
            required
            placeholder="Entrevista al Gerente de Planta, con preparación y traslado"
            className="campo"
          />
        </div>

        <div className="mt-4">
          <label htmlFor="h-persona" className="etiqueta">
            Quién <span className="font-normal text-marca-400">· opcional</span>
          </label>
          <input id="h-persona" name="persona" placeholder="Gabriel Montiel" className="campo" />
        </div>

        <div className="mt-4">
          <label htmlFor="h-imputacion" className="etiqueta">
            Contra qué se mide
          </label>
          <select id="h-imputacion" name="imputacion" className="campo" defaultValue="bolsa">
            {Object.entries(IMPUTACIONES).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-marca-500">
            {IMPUTACION_NOTA.bolsa} · <strong>Fase 0</strong>: {IMPUTACION_NOTA.fase_0} ·{' '}
            <strong>Fase 2</strong>: {IMPUTACION_NOTA.fase_2} · <strong>Adicional</strong>:{' '}
            {IMPUTACION_NOTA.adicional}
          </p>
        </div>

        <div className="mt-5">
          <Boton etiqueta="Cargar horas" />
        </div>
        <Mensaje estado={estadoHoras} />
      </form>

      {/* --- Hito ----------------------------------------------------------- */}
      <form action={accionHito} className="tarjeta p-5">
        <p className="mb-1 text-sm font-semibold text-marca-800">Hito de la línea de tiempo</p>
        <p className="mb-4 text-xs text-marca-500">
          Las entrevistas y las formaciones ya salen solas del levantamiento. Aquí van las
          demás: un entregable que salió, una decisión, un comunicado.
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="t-fecha" className="etiqueta">
              Fecha
            </label>
            <input
              id="t-fecha"
              name="fecha"
              type="date"
              required
              defaultValue={hoy()}
              className="campo"
            />
          </div>

          <div>
            <label htmlFor="t-tipo" className="etiqueta">
              Tipo
            </label>
            <select id="t-tipo" name="tipo" className="campo" defaultValue="hito">
              {Object.entries(TIPOS_HITO).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-4">
          <label htmlFor="t-titulo" className="etiqueta">
            Qué pasó
          </label>
          <input
            id="t-titulo"
            name="titulo"
            required
            placeholder="Salió el comunicado oficial"
            className="campo"
          />
        </div>

        <div className="mt-4">
          <label htmlFor="t-descripcion" className="etiqueta">
            Detalle <span className="font-normal text-marca-400">· opcional</span>
          </label>
          <textarea id="t-descripcion" name="descripcion" rows={2} className="campo" />
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="t-entregable" className="etiqueta">
              Entregable
            </label>
            <select id="t-entregable" name="entregable" className="campo" defaultValue="">
              <option value="">Ninguno</option>
              {ORDEN_ENTREGABLES.map((e) => (
                <option key={e} value={e}>
                  {ENTREGABLES[e]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="t-estado" className="etiqueta">
              Estado
            </label>
            <select id="t-estado" name="estado" className="campo" defaultValue="hecho">
              {Object.entries(ESTADOS_HITO).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-5">
          <Boton etiqueta="Añadir hito" />
        </div>
        <Mensaje estado={estadoHito} />
      </form>
    </div>
  )
}
