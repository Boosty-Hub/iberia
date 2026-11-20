'use client'

import { useActionState, useState } from 'react'
import { IconoBasura, IconoMas } from '@/components/iconos'
import { descartarBorrador, enviarARevision, guardarBorrador, type EstadoAccion } from '@/app/sistema/nucleo/procesos/acciones'
import { FASES_PHVA, LISTAS_FICHA, type Ficha, type Indicador } from './comun'
import { Enviar, Mensaje, type OpcionSimple } from './formularios'

/**
 * El formulario del borrador: los datos del nodo y la ficha PHVA entera, con
 * editores de lista. La ficha viaja como JSON en un campo oculto; el servidor
 * la normaliza y conserva lo que la pantalla no toca (el origen de la hoja).
 *
 * Todo es controlado: React 19 limpia los formularios con `action` al
 * terminar, y un campo no controlado volvería al valor de antes de guardar.
 */

export type DatosBorrador = {
  id: string
  ref: string
  nivel: number
  nombre: string
  tipo: string | null
  estado_operativo: string
  codigo_sgc: string | null
  generacion: string | null
  codigo_informe: string | null
  padre_ref: string | null
  dueno_plaza_ref: string | null
  dueno_texto: string | null
  area_texto: string | null
  nota: string | null
}

function ListaEditable({
  id,
  titulo,
  items,
  cambiar,
  ayuda,
}: {
  id: string
  titulo: string
  items: string[]
  cambiar: (v: string[]) => void
  ayuda?: string
}) {
  const mover = (i: number, d: number) => {
    const j = i + d
    if (j < 0 || j >= items.length) return
    const x = [...items]
    ;[x[i], x[j]] = [x[j], x[i]]
    cambiar(x)
  }
  return (
    <fieldset className="min-w-0">
      <legend className="etiqueta">{titulo}</legend>
      {ayuda && <p className="-mt-1 mb-2 text-xs text-marca-500">{ayuda}</p>}
      <ul className="space-y-2">
        {items.map((v, i) => (
          <li key={i} className="flex items-start gap-1.5">
            <textarea
              aria-label={`${titulo}, renglón ${i + 1}`}
              value={v}
              rows={1}
              onChange={(e) => cambiar(items.map((x, k) => (k === i ? e.target.value : x)))}
              className="campo min-h-10 flex-1 resize-y py-2"
            />
            <div className="flex shrink-0 flex-col">
              <button type="button" onClick={() => mover(i, -1)} disabled={i === 0} className="h-5 w-8 text-xs text-marca-500 hover:text-marca-900 disabled:opacity-30" aria-label="Subir">
                ▲
              </button>
              <button type="button" onClick={() => mover(i, 1)} disabled={i === items.length - 1} className="h-5 w-8 text-xs text-marca-500 hover:text-marca-900 disabled:opacity-30" aria-label="Bajar">
                ▼
              </button>
            </div>
            <button
              type="button"
              onClick={() => cambiar(items.filter((_, k) => k !== i))}
              className="btn-peligro h-10 w-10 shrink-0 px-0"
              aria-label={`Quitar el renglón ${i + 1} de ${titulo}`}
            >
              <IconoBasura className="h-4 w-4" />
            </button>
          </li>
        ))}
      </ul>
      <button type="button" id={id} onClick={() => cambiar([...items, ''])} className="btn-neutro mt-2 h-9 px-3 text-xs">
        <IconoMas className="h-3.5 w-3.5" />
        Agregar
      </button>
    </fieldset>
  )
}

function EditorIndicadores({ items, cambiar }: { items: Indicador[]; cambiar: (v: Indicador[]) => void }) {
  const campo = (i: number, k: keyof Indicador, v: string) =>
    cambiar(items.map((x, j) => (j === i ? { ...x, [k]: k === 'nombre' ? v : v || null } : x)))
  return (
    <fieldset className="min-w-0">
      <legend className="etiqueta">Indicadores</legend>
      <div className="space-y-3">
        {items.map((x, i) => (
          <div key={i} className="rounded-xl border border-[var(--borde)] p-3">
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="text-xs text-marca-600">
                Nombre
                <input value={x.nombre} onChange={(e) => campo(i, 'nombre', e.target.value)} className="campo mt-1" />
              </label>
              <label className="text-xs text-marca-600">
                Fórmula
                <input value={x.formula ?? ''} onChange={(e) => campo(i, 'formula', e.target.value)} className="campo mt-1" />
              </label>
              <label className="text-xs text-marca-600">
                Meta
                <input value={x.meta ?? ''} onChange={(e) => campo(i, 'meta', e.target.value)} className="campo mt-1" />
              </label>
              <label className="text-xs text-marca-600">
                Frecuencia
                <input value={x.frecuencia ?? ''} onChange={(e) => campo(i, 'frecuencia', e.target.value)} placeholder="Mensual" className="campo mt-1" />
              </label>
            </div>
            <button type="button" onClick={() => cambiar(items.filter((_, j) => j !== i))} className="btn-peligro mt-2 h-9 px-3 text-xs">
              <IconoBasura className="h-3.5 w-3.5" />
              Quitar indicador
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={() => cambiar([...items, { nombre: '', formula: null, meta: null, frecuencia: null }])}
        className="btn-neutro mt-2 h-9 px-3 text-xs"
      >
        <IconoMas className="h-3.5 w-3.5" />
        Agregar indicador
      </button>
    </fieldset>
  )
}

export function EditorBorrador({
  datos,
  fichaInicial,
  tipos,
  estados,
  plazas,
  padres,
  alCambiar,
  puedeDescartar,
}: {
  datos: DatosBorrador
  fichaInicial: Ficha
  tipos: OpcionSimple[]
  estados: OpcionSimple[]
  plazas: OpcionSimple[]
  padres: OpcionSimple[]
  alCambiar?: string
  puedeDescartar?: boolean
}) {
  const [estado, accion] = useActionState<EstadoAccion, FormData>(guardarBorrador, {})
  const [d, setD] = useState(datos)
  const [ficha, setFicha] = useState(fichaInicial)
  const [sucio, setSucio] = useState(false)

  const nodo = <K extends keyof DatosBorrador>(k: K, v: DatosBorrador[K]) => {
    setD((x) => ({ ...x, [k]: v }))
    setSucio(true)
  }
  const fichaCampo = <K extends keyof Ficha>(k: K, v: Ficha[K]) => {
    setFicha((x) => ({ ...x, [k]: v }))
    setSucio(true)
  }
  const etiquetas = Object.fromEntries(LISTAS_FICHA) as Record<string, string>
  const lista = (k: (typeof LISTAS_FICHA)[number][0], ayuda?: string) => (
    <ListaEditable key={k} id={`agregar-${k}`} titulo={etiquetas[k]} items={ficha[k]} cambiar={(v) => fichaCampo(k, v)} ayuda={ayuda} />
  )
  const plazaElegida = plazas.some((p) => p.valor === d.dueno_plaza_ref)

  return (
    <>
    <form
      action={(fd) => {
        setSucio(false)
        return accion(fd)
      }}
      className="space-y-6"
      onChange={() => setSucio(true)}
    >
      <input type="hidden" name="id" value={d.id} />
      <input type="hidden" name="ficha" value={JSON.stringify(ficha)} />

      <section className="tarjeta space-y-4 p-5">
        <h2 className="text-sm font-semibold text-marca-900">Datos del proceso</h2>
        <div>
          <label className="etiqueta" htmlFor="b-nombre">
            Nombre <span className="text-acento-600">*</span>
          </label>
          <input id="b-nombre" name="nombre" value={d.nombre} onChange={(e) => nodo('nombre', e.target.value)} required minLength={3} className="campo" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="etiqueta" htmlFor="b-tipo">Tipo</label>
            <select id="b-tipo" name="tipo" value={d.tipo ?? ''} onChange={(e) => nodo('tipo', e.target.value || null)} className="campo">
              <option value="">Sin tipo</option>
              {tipos.map((t) => (
                <option key={t.valor} value={t.valor}>
                  {t.etiqueta}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="etiqueta" htmlFor="b-estado">Estado operativo</label>
            <select id="b-estado" name="estado_operativo" value={d.estado_operativo} onChange={(e) => nodo('estado_operativo', e.target.value)} className="campo">
              {estados.map((t) => (
                <option key={t.valor} value={t.valor}>
                  {t.etiqueta}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="etiqueta" htmlFor="b-sgc">Código SGC</label>
            <input id="b-sgc" name="codigo_sgc" value={d.codigo_sgc ?? ''} onChange={(e) => nodo('codigo_sgc', e.target.value)} placeholder="II-XX" className="campo" />
          </div>
          <div>
            <label className="etiqueta" htmlFor="b-gen">Generación del código</label>
            <input id="b-gen" name="generacion" value={d.generacion ?? ''} onChange={(e) => nodo('generacion', e.target.value)} placeholder="2012" className="campo" />
          </div>
          <div>
            <label className="etiqueta" htmlFor="b-inf">Código del informe</label>
            <input id="b-inf" name="codigo_informe" value={d.codigo_informe ?? ''} onChange={(e) => nodo('codigo_informe', e.target.value)} placeholder="2.6.1" className="campo" />
          </div>
          <div className="sm:col-span-2 lg:col-span-3">
            <label className="etiqueta" htmlFor="b-padre">Cuelga de</label>
            {d.nivel === 0 ? (
              <p className="campo bg-marca-50 text-marca-500">Es un macroproceso: no cuelga de otro.</p>
            ) : (
              <select id="b-padre" name="padre_ref" value={d.padre_ref ?? ''} onChange={(e) => nodo('padre_ref', e.target.value || null)} className="campo">
                {padres.map((p) => (
                  <option key={p.valor} value={p.valor}>
                    {p.etiqueta}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <div>
            <label className="etiqueta" htmlFor="b-plaza">Dueño (plaza de la estructura)</label>
            <select id="b-plaza" name="dueno_plaza_ref" value={d.dueno_plaza_ref ?? ''} onChange={(e) => nodo('dueno_plaza_ref', e.target.value || null)} className="campo">
              <option value="">Sin plaza asignada</option>
              {!plazaElegida && d.dueno_plaza_ref && <option value={d.dueno_plaza_ref}>Plaza actual (fuera de tu alcance)</option>}
              {plazas.map((p) => (
                <option key={p.valor} value={p.valor}>
                  {p.etiqueta}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-marca-500">Cambiar el dueño es un cambio sensible: lo revisa el SGC y lo aprueba la Gerencia de Calidad y Desarrollo.</p>
          </div>
          <div>
            <label className="etiqueta" htmlFor="b-duenotxt">Dueño según la fuente (texto)</label>
            <input id="b-duenotxt" name="dueno_texto" value={d.dueno_texto ?? ''} onChange={(e) => nodo('dueno_texto', e.target.value)} className="campo" />
          </div>
          <div>
            <label className="etiqueta" htmlFor="b-area">Área según la fuente</label>
            <input id="b-area" name="area_texto" value={d.area_texto ?? ''} onChange={(e) => nodo('area_texto', e.target.value)} className="campo" />
          </div>
          <div>
            <label className="etiqueta" htmlFor="b-nota">Nota del proceso</label>
            <textarea id="b-nota" name="nota" value={d.nota ?? ''} onChange={(e) => nodo('nota', e.target.value)} rows={2} className="campo" />
          </div>
        </div>
      </section>

      <section className="tarjeta space-y-5 p-5">
        <h2 className="text-sm font-semibold text-marca-900">Ficha PHVA</h2>
        <div className="grid gap-4 lg:grid-cols-2">
          <div>
            <label className="etiqueta" htmlFor="f-obj">Objetivo</label>
            <textarea id="f-obj" value={ficha.objetivo} onChange={(e) => fichaCampo('objetivo', e.target.value)} rows={3} className="campo" />
          </div>
          <div>
            <label className="etiqueta" htmlFor="f-alc">Alcance</label>
            <textarea id="f-alc" value={ficha.alcance} onChange={(e) => fichaCampo('alcance', e.target.value)} rows={3} className="campo" />
          </div>
        </div>
        <div className="grid gap-5 lg:grid-cols-2">
          {lista('proveedores')}
          {lista('entradas')}
        </div>
        <div>
          <p className="etiqueta">Actividades · ciclo PHVA</p>
          <div className="grid gap-4 rounded-xl border border-[var(--borde)] bg-marca-50/40 p-4 lg:grid-cols-2">
            {FASES_PHVA.map(([k, etiqueta]) => (
              <ListaEditable
                key={k}
                id={`agregar-${k}`}
                titulo={etiqueta}
                items={ficha.actividades[k]}
                cambiar={(v) => fichaCampo('actividades', { ...ficha.actividades, [k]: v })}
              />
            ))}
          </div>
        </div>
        <div className="grid gap-5 lg:grid-cols-2">
          {lista('salidas')}
          {lista('clientes')}
          {lista('recursos')}
          {lista('documentos', 'Por código o nombre; el vínculo formal vive en la biblioteca de documentos.')}
          {lista('registros')}
          {lista('requisitos')}
        </div>
        <EditorIndicadores items={ficha.indicadores} cambiar={(v) => fichaCampo('indicadores', v)} />
        <div className="grid gap-5 lg:grid-cols-2">
          {lista('riesgos', 'Lo que puede salir mal (ISO 9001: se registran aparte de las oportunidades).')}
          {lista('oportunidades', 'Lo que se puede aprovechar o mejorar.')}
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <div>
            <label className="etiqueta" htmlFor="f-dueno">Dueño según la hoja PHVA</label>
            <input id="f-dueno" value={ficha.dueno_segun_ficha ?? ''} onChange={(e) => fichaCampo('dueno_segun_ficha', e.target.value || null)} className="campo" />
          </div>
          <div>
            <label className="etiqueta" htmlFor="f-nota">Nota de la ficha</label>
            <textarea id="f-nota" value={ficha.nota_ficha ?? ''} onChange={(e) => fichaCampo('nota_ficha', e.target.value || null)} rows={2} className="campo" />
          </div>
        </div>
      </section>

      <div className="sticky bottom-0 z-10 -mx-4 flex flex-wrap items-center gap-3 border-t border-[var(--borde)] bg-white/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-2xl sm:border">
        <Enviar texto="Guardar borrador" pendiente="Guardando…" />
        <p className="text-xs text-marca-500">{sucio ? 'Hay cambios sin guardar.' : (alCambiar ?? 'Todo guardado.')}</p>
        <div className="w-full sm:w-auto sm:flex-1">
          <Mensaje estado={estado} />
        </div>
      </div>
    </form>

    <section className="tarjeta mt-6 flex flex-wrap items-center gap-3 p-5">
      <div className="min-w-0 flex-1">
        <h2 className="text-sm font-semibold text-marca-900">Enviar a revisión</h2>
        <p className="mt-1 text-xs text-marca-500">
          Abre la solicitud con la ruta de aprobación de procesos: revisa la Coordinación del SGC y aprueba la Gerencia de Calidad y
          Desarrollo. Mientras está en revisión nadie lo edita; quien lo envía no lo aprueba.
        </p>
        {sucio && <p className="mt-1 text-xs font-medium text-amber-800">Guarda el borrador antes de enviarlo.</p>}
      </div>
      <form action={enviarARevision}>
        <input type="hidden" name="id" value={d.id} />
        <input type="hidden" name="ref" value={d.ref} />
        <button type="submit" className="btn-primario h-10" disabled={sucio}>
          Enviar a revisión
        </button>
      </form>
      {puedeDescartar && (
        <form
          action={descartarBorrador}
          onSubmit={(e) => {
            if (!confirm('¿Descartar este borrador? Se pierden sus cambios; la versión vigente no se toca.')) e.preventDefault()
          }}
        >
          <input type="hidden" name="id" value={d.id} />
          <input type="hidden" name="ref" value={d.ref} />
          <button type="submit" className="btn-peligro h-10">
            <IconoBasura className="h-4 w-4" />
            Descartar borrador
          </button>
        </form>
      )}
    </section>
    </>
  )
}
