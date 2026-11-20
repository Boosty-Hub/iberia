import type { Metadata } from 'next'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { IconoAtras } from '@/components/iconos'
import {
  aplanar,
  direccionDe,
  etiquetaDe,
  fmtBs,
  fmtEntero,
  fmtFecha,
  fmtMomento,
  fmtNumero,
  fmtUsd,
  hoyCaracas,
  leerCatalogos,
  leerEstructura,
  rango,
  todas,
  VIGENTE_EN,
  type Catalogos,
  type Estructura,
  type Nodo,
} from '@/components/sistema/organizacion/datos'
import { Formulario, Plegable } from '@/components/sistema/organizacion/formulario'
import { EncabezadoPagina, Insignia, Metrica } from '@/components/ui'
import { puede, requerirPermiso, type Sesion } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { cn } from '@/lib/utils'
import {
  aprobarPlan,
  crearComponente,
  editarComponente,
  fijarCostoReferencia,
  fijarParametro,
  fijarTasa,
  guardarLineas,
  nuevoPlan,
  retirarComponente,
} from './acciones'

export const metadata: Metadata = { title: 'Dotación · Organización' }

/**
 * La dotación (headcount) en tres vistas: el tablero —aprobada, ocupada,
 * vacantes, por encima y en requisición, por dirección y unidad—, el plan del
 * año —versionado: borrador, aprobado y congelado— y, **solo con
 * `sistema:costos`**, los costos: costo de referencia por cargo, componentes,
 * parámetros, tasa del día y el costo de la dotación aprobada. Nunca el salario
 * de una persona.
 */

type Vista = 'tablero' | 'plan' | 'costos'
type Cliente = Awaited<ReturnType<typeof createClient>>

const TH = 'px-3 py-2 font-medium'
const TD = 'px-3 py-2 tabular-nums text-right'

function Tabla({ children, min = 640, titulo }: { children: ReactNode; min?: number; titulo?: string }) {
  return (
    <div className="tarjeta overflow-x-auto">
      <table className="w-full text-sm" style={{ minWidth: min }}>
        {titulo && <caption className="sr-only">{titulo}</caption>}
        {children}
      </table>
    </div>
  )
}

/** Las direcciones con sus unidades, en el orden del organigrama. */
function porDireccion(e: Estructura) {
  const grupos = new Map<string, Nodo[]>()
  for (const n of aplanar(e.raices)) {
    const d = direccionDe(e, n.unidad.ref)
    const lista = grupos.get(d) ?? []
    lista.push(n)
    grupos.set(d, lista)
  }
  return [...grupos.entries()].map(([ref, nodos]) => ({ ref, nombre: e.unidades.get(ref)?.nombre ?? '—', nodos }))
}

export default async function DotacionPage({ searchParams }: PageProps<'/sistema/nucleo/organizacion/dotacion'>) {
  const [sesion, sp] = await Promise.all([requerirPermiso('sistema:dotacion'), searchParams])
  const supabase = await createClient()
  const hoy = hoyCaracas()
  const verCostos = puede(sesion, 'sistema:costos')
  const pedida = typeof sp.vista === 'string' ? sp.vista : 'tablero'
  const vista: Vista = pedida === 'plan' ? 'plan' : pedida === 'costos' && verCostos ? 'costos' : 'tablero'

  const [e, catalogos] = await Promise.all([leerEstructura(supabase, hoy), leerCatalogos(supabase)])
  const total = e.raices.reduce((t, r) => ({ d: t.d + r.total.dotacion, o: t.o + r.total.ocupadas, v: t.v + r.total.vacantes, x: t.x + r.total.porEncima }), { d: 0, o: 0, v: 0, x: 0 })

  const pestanas: [Vista, string][] = [['tablero', 'Tablero'], ['plan', 'Plan del año'], ...(verCostos ? [['costos', 'Costos'] as [Vista, string]] : [])]

  return (
    <>
      <Link href="/sistema/nucleo/organizacion" className="mb-4 inline-flex min-h-10 items-center gap-1.5 text-sm text-marca-500 hover:text-acento-700">
        <IconoAtras className="h-4 w-4" />
        Estructura
      </Link>
      <EncabezadoPagina
        rotulo="Organización"
        titulo="Dotación"
        descripcion={`La dotación aprobada contra la ocupada, al ${fmtFecha(hoy, true)}, con lo que está en requisición y el plan del año.${verCostos ? ' Los costos están en su pestaña: es perímetro de nómina.' : ''}`}
      />
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Metrica valor={total.d} etiqueta="Aprobada" />
        <Metrica valor={total.o} etiqueta="Ocupada" />
        <Metrica valor={total.v} etiqueta="Vacantes" />
        <Metrica valor={total.x} etiqueta="Por encima" />
      </div>

      <nav aria-label="Vistas" className="mb-5 flex gap-1 overflow-x-auto rounded-xl border border-marca-200 bg-white p-1">
        {pestanas.map(([v, t]) => (
          <Link
            key={v}
            href={`/sistema/nucleo/organizacion/dotacion${v === 'tablero' ? '' : `?vista=${v}`}`}
            aria-current={vista === v ? 'page' : undefined}
            className={cn(
              'flex min-h-10 flex-1 items-center justify-center rounded-lg px-3 text-sm font-medium whitespace-nowrap',
              vista === v ? 'bg-acento-50 font-semibold text-acento-700' : 'text-marca-600 hover:bg-marca-50',
            )}
          >
            {t}
          </Link>
        ))}
      </nav>

      {vista === 'tablero' && <Tablero supabase={supabase} e={e} catalogos={catalogos} />}
      {vista === 'plan' && <Plan supabase={supabase} e={e} sesion={sesion} sp={sp} />}
      {vista === 'costos' && <Costos supabase={supabase} e={e} catalogos={catalogos} sesion={sesion} hoy={hoy} />}
    </>
  )
}

// -----------------------------------------------------------------------------
// Tablero
// -----------------------------------------------------------------------------

async function Tablero({ supabase, e, catalogos }: { supabase: Cliente; e: Estructura; catalogos: Catalogos }) {
  // Si la lectura de requisiciones falla, el tablero sigue y lo dice: no pone ceros.
  let requisiciones: { unidad_ref: string; cantidad: number }[] = []
  let sinRequisiciones = false
  try {
    requisiciones = await todas((a, b) =>
      supabase.schema('org').from('requisicion').select('unidad_ref, cantidad').in('estado', ['en_aprobacion', 'aprobada', 'en_seleccion']).range(a, b),
    )
  } catch {
    sinRequisiciones = true
  }
  const enReq = new Map<string, number>()
  for (const r of requisiciones) enReq.set(r.unidad_ref, (enReq.get(r.unidad_ref) ?? 0) + r.cantidad)
  const req = (ref: string) => (sinRequisiciones ? '—' : (enReq.get(ref) ?? 0))

  const grupos = porDireccion(e)
  const nominas = [...catalogos.tipo_nomina.map((o) => ({ clave: o.clave, etiqueta: o.etiqueta })), { clave: '', etiqueta: 'Sin definir' }]
  const nominaDe = (refs: Nodo[]) => {
    const m = new Map<string, { a: number; o: number }>()
    for (const n of refs)
      for (const p of n.plazas) {
        const k = p.tipo_nomina ?? ''
        const x = m.get(k) ?? { a: 0, o: 0 }
        x.a += p.dotacion
        x.o += p.titulares
        m.set(k, x)
      }
    return m
  }
  const nominasUsadas = nominas.filter((t) => grupos.some((g) => nominaDe(g.nodos).has(t.clave)))

  return (
    <div className="space-y-6">
      {grupos.map((g) => {
        const base = g.nodos[0]?.profundidad ?? 0
        const sub = g.nodos.reduce(
          (t, n) => ({ a: t.a + n.propio.dotacion, o: t.o + n.propio.ocupadas, v: t.v + n.propio.vacantes, x: t.x + n.propio.porEncima, r: t.r + (enReq.get(n.unidad.ref) ?? 0) }),
          { a: 0, o: 0, v: 0, x: 0, r: 0 },
        )
        if (!sub.a && !sub.o && !sub.r) return null
        return (
          <section key={g.ref} aria-label={g.nombre}>
            <h2 className="mb-2 text-sm font-semibold text-marca-800">{g.nombre}</h2>
            <Tabla titulo={`Dotación de ${g.nombre}`}>
              <thead className="border-b border-marca-200 bg-marca-50 text-left text-xs text-marca-600">
                <tr>
                  <th className={TH}>Unidad</th>
                  <th className={cn(TH, 'text-right')}>Aprobada</th>
                  <th className={cn(TH, 'text-right')}>Ocupada</th>
                  <th className={cn(TH, 'text-right')}>Vacantes</th>
                  <th className={cn(TH, 'text-right')}>Por encima</th>
                  <th className={cn(TH, 'text-right')}>En requisición</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-marca-100">
                {g.nodos
                  .filter((n) => n.propio.plazas || enReq.get(n.unidad.ref))
                  .map((n) => (
                    <tr key={n.unidad.ref}>
                      <td className="px-3 py-2" style={{ paddingLeft: 12 + (n.profundidad - base) * 14 }}>
                        <Link href={`/sistema/nucleo/organizacion/unidades/${n.unidad.ref}`} className="text-marca-900 hover:text-acento-700">
                          {n.unidad.nombre}
                        </Link>
                      </td>
                      <td className={TD}>{n.propio.dotacion}</td>
                      <td className={TD}>{n.propio.ocupadas}</td>
                      <td className={cn(TD, n.propio.vacantes && 'text-acento-700')}>{n.propio.vacantes}</td>
                      <td className={cn(TD, n.propio.porEncima && 'text-amber-700')}>{n.propio.porEncima}</td>
                      <td className={TD}>{req(n.unidad.ref)}</td>
                    </tr>
                  ))}
              </tbody>
              <tfoot className="border-t border-marca-200 bg-marca-50/60 font-semibold text-marca-900">
                <tr>
                  <td className="px-3 py-2">Total</td>
                  <td className={TD}>{sub.a}</td>
                  <td className={TD}>{sub.o}</td>
                  <td className={TD}>{sub.v}</td>
                  <td className={TD}>{sub.x}</td>
                  <td className={TD}>{sinRequisiciones ? '—' : sub.r}</td>
                </tr>
              </tfoot>
            </Tabla>
          </section>
        )
      })}

      <section>
        <h2 className="mb-1 text-sm font-semibold text-marca-800">Por tipo de nómina</h2>
        <p className="mb-2 text-xs text-marca-500">Ocupada / aprobada. «Sin definir» son plazas a las que la carga no les pudo asignar nómina: se completa al editar la plaza.</p>
        <Tabla titulo="Dotación por tipo de nómina" min={560}>
          <thead className="border-b border-marca-200 bg-marca-50 text-left text-xs text-marca-600">
            <tr>
              <th className={TH}>Dirección</th>
              {nominasUsadas.map((t) => (
                <th key={t.clave} className={cn(TH, 'text-right')}>
                  {t.etiqueta}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-marca-100">
            {grupos.map((g) => {
              const m = nominaDe(g.nodos)
              if (!m.size) return null
              return (
                <tr key={g.ref}>
                  <td className="px-3 py-2 text-marca-900">{g.nombre}</td>
                  {nominasUsadas.map((t) => {
                    const x = m.get(t.clave)
                    return (
                      <td key={t.clave} className={TD}>
                        {x ? `${x.o} / ${x.a}` : '—'}
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </Tabla>
      </section>
      {sinRequisiciones && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          No se pudieron leer las requisiciones: la columna «En requisición» queda sin dato (—), no en cero.
        </p>
      )}
      <p className="text-xs text-marca-500">
        «En requisición» suma las requisiciones en aprobación, aprobadas o en selección que tu rol puede ver.
      </p>
    </div>
  )
}

// -----------------------------------------------------------------------------
// Plan del año
// -----------------------------------------------------------------------------

async function Plan({ supabase, e, sesion, sp }: { supabase: Cliente; e: Estructura; sesion: Sesion; sp: Record<string, string | string[] | undefined> }) {
  const org = supabase.schema('org')
  const anioActual = Number(hoyCaracas().slice(0, 4))
  const anio = Number(typeof sp.anio === 'string' ? sp.anio : anioActual) || anioActual
  const editar = puede(sesion, 'sistema:dotacion', 'editar')

  const { data: planes } = await org.from('plan_dotacion').select('*').eq('anio', anio).order('version', { ascending: false })
  const lista = planes ?? []
  const elegido =
    lista.find((p) => p.id === sp.plan) ?? lista.find((p) => p.estado === 'borrador') ?? lista.find((p) => p.estado === 'aprobado') ?? lista[0]
  const lineas = elegido
    ? await todas((a, b) => org.from('plan_dotacion_linea').select('unidad_ref, cargo_id, cantidad, nota').eq('plan_id', elegido.id).range(a, b))
    : []
  const editable = editar && elegido?.estado === 'borrador'
  const hayBorrador = lista.some((p) => p.estado === 'borrador')

  // Aprobada hoy por (unidad, cargo), para comparar.
  const aprobada = new Map<string, number>()
  for (const p of e.plazas.values()) aprobada.set(`${p.unidad_ref}__${p.cargo_id}`, (aprobada.get(`${p.unidad_ref}__${p.cargo_id}`) ?? 0) + p.dotacion)
  const enPlan = new Map(lineas.map((l) => [`${l.unidad_ref}__${l.cargo_id}`, l]))
  const claves = new Set([...enPlan.keys(), ...(editable ? aprobada.keys() : [])])
  const orden = new Map(aplanar(e.raices).map((n, i) => [n.unidad.ref, i]))
  const filas = [...claves]
    .map((k) => {
      const [u, c] = k.split('__')
      return { k, u, c, plan: enPlan.get(k)?.cantidad ?? null, hoy: aprobada.get(k) ?? 0 }
    })
    .sort((a, b) => (orden.get(a.u) ?? 999) - (orden.get(b.u) ?? 999) || (e.cargos.get(a.c)?.nombre ?? '').localeCompare(e.cargos.get(b.c)?.nombre ?? '', 'es'))
  const totPlan = filas.reduce((s, f) => s + (f.plan ?? 0), 0)
  const totHoy = [...aprobada.values()].reduce((s, n) => s + n, 0)
  const ESTADO: Record<string, { t: string; tono: 'verde' | 'ambar' | 'neutro' }> = {
    borrador: { t: 'Borrador', tono: 'ambar' },
    aprobado: { t: 'Aprobado · congelado', tono: 'verde' },
    reemplazado: { t: 'Reemplazado', tono: 'neutro' },
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        {[anioActual - 1, anioActual, anioActual + 1].map((a) => (
          <Link
            key={a}
            href={`/sistema/nucleo/organizacion/dotacion?vista=plan&anio=${a}`}
            className={cn('btn-neutro h-9 px-3', a === anio && 'border-acento-300 bg-acento-50 text-acento-700')}
          >
            {a}
          </Link>
        ))}
      </div>

      <section className="tarjeta p-4 sm:p-5">
        <h2 className="text-sm font-semibold text-marca-800">Versiones del plan {anio}</h2>
        {lista.length ? (
          <ul className="mt-3 flex flex-wrap gap-2">
            {lista.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/sistema/nucleo/organizacion/dotacion?vista=plan&anio=${anio}&plan=${p.id}`}
                  className={cn('flex flex-col rounded-xl border px-3 py-2 text-sm', p.id === elegido?.id ? 'border-acento-300 bg-acento-50' : 'border-marca-200 hover:bg-marca-50')}
                >
                  <span className="flex items-center gap-2 font-medium text-marca-900">
                    Versión {p.version} <Insignia tono={ESTADO[p.estado]?.tono}>{ESTADO[p.estado]?.t ?? p.estado}</Insignia>
                  </span>
                  {p.aprobado_en && <span className="text-xs text-marca-500">Aprobada el {fmtMomento(p.aprobado_en)}</span>}
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-marca-500">Todavía no hay plan para {anio}.</p>
        )}
        {editar && !hayBorrador && (
          <div className="mt-4">
            <Formulario accion={nuevoPlan} boton={lista.length ? 'Abrir una versión nueva' : `Crear el plan ${anio}`} tono="primario" pendiente="Creando…">
              <input type="hidden" name="anio" value={anio} />
              <p className="text-xs text-marca-500">
                {lista.length
                  ? 'Copia la última versión en un borrador: el aprobado sigue rigiendo hasta que apruebes el nuevo.'
                  : 'Parte de la dotación aprobada de hoy, unidad por unidad y cargo por cargo.'}
              </p>
              <label htmlFor="np-nota" className="etiqueta mt-3">
                Nota (opcional)
              </label>
              <input id="np-nota" name="nota" className="campo" placeholder="Qué cambia en esta versión" />
            </Formulario>
          </div>
        )}
      </section>

      {elegido && (
        <section>
          <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-sm font-semibold text-marca-800">
              Versión {elegido.version} · {fmtEntero(totPlan)} planificadas{' '}
              <span className="font-normal text-marca-500">contra {fmtEntero(totHoy)} aprobadas hoy</span>
            </h2>
            {elegido.nota && <p className="text-xs text-marca-500">{elegido.nota}</p>}
          </div>
          <Formulario accion={guardarLineas} boton={editable ? 'Guardar cantidades' : undefined}>
            <input type="hidden" name="plan" value={elegido.id} />
            <Tabla titulo="Líneas del plan" min={600}>
              <thead className="border-b border-marca-200 bg-marca-50 text-left text-xs text-marca-600">
                <tr>
                  <th className={TH}>Unidad</th>
                  <th className={TH}>Cargo</th>
                  <th className={cn(TH, 'text-right')}>Plan</th>
                  <th className={cn(TH, 'text-right')}>Aprobada hoy</th>
                  <th className={cn(TH, 'text-right')}>Diferencia</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-marca-100">
                {filas.map((f) => {
                  const dif = (f.plan ?? 0) - f.hoy
                  return (
                    <tr key={f.k}>
                      <td className="px-3 py-1.5 text-marca-700">{e.unidades.get(f.u)?.nombre ?? 'Unidad fuera de la estructura de hoy'}</td>
                      <td className="px-3 py-1.5 text-marca-900">{e.cargos.get(f.c)?.nombre ?? '—'}</td>
                      <td className="px-3 py-1.5 text-right">
                        {editable ? (
                          <input
                            type="number"
                            min={0}
                            max={999}
                            name={`l__${f.u}__${f.c}`}
                            defaultValue={f.plan ?? ''}
                            aria-label={`Plan de ${e.cargos.get(f.c)?.nombre} en ${e.unidades.get(f.u)?.nombre}`}
                            className="campo h-9 w-20 px-2 py-1 text-right"
                          />
                        ) : (
                          <span className="tabular-nums">{f.plan ?? '—'}</span>
                        )}
                      </td>
                      <td className={TD}>{f.hoy}</td>
                      <td className={cn(TD, dif > 0 && 'text-emerald-700', dif < 0 && 'text-acento-700')}>{f.plan === null ? '—' : dif > 0 ? `+${dif}` : dif}</td>
                    </tr>
                  )
                })}
              </tbody>
            </Tabla>
            {editable && (
              <div className="tarjeta mt-3 grid gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_100px]">
                <p className="text-xs font-semibold text-marca-700 sm:col-span-3">Agregar una línea (un cargo nuevo en una unidad)</p>
                <select name="nueva_unidad" defaultValue="" className="campo" aria-label="Unidad">
                  <option value="">Unidad</option>
                  {aplanar(e.raices).map((n) => (
                    <option key={n.unidad.ref} value={n.unidad.ref}>
                      {'  '.repeat(n.profundidad)}
                      {n.unidad.nombre}
                    </option>
                  ))}
                </select>
                <select name="nuevo_cargo" defaultValue="" className="campo" aria-label="Cargo">
                  <option value="">Cargo</option>
                  {[...e.cargos.values()]
                    .filter((c) => c.activo)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nombre}
                      </option>
                    ))}
                </select>
                <input type="number" min={0} name="nueva_cantidad" placeholder="Cant." className="campo" aria-label="Cantidad" />
              </div>
            )}
          </Formulario>
          {editable && (
            <div className="mt-4">
              <Plegable titulo="Aprobar esta versión">
                <Formulario accion={aprobarPlan} boton="Aprobar y congelar" pendiente="Aprobando…">
                  <input type="hidden" name="plan" value={elegido.id} />
                  <p className="text-sm text-marca-600">
                    Guarda antes las cantidades. Al aprobarla queda congelada: no se edita más, y cualquier cambio será otra versión. La requisición
                    compara contra el plan aprobado del año para decir si está dentro o fuera de plan.
                  </p>
                  <label className="mt-3 flex items-center gap-2 text-sm text-marca-700">
                    <input type="checkbox" name="confirmo" className="h-4 w-4 accent-[var(--color-acento-600)]" />
                    Confirmo que esta versión es el plan de dotación {anio}
                  </label>
                </Formulario>
              </Plegable>
            </div>
          )}
        </section>
      )}
    </div>
  )
}

// -----------------------------------------------------------------------------
// Costos · perímetro de nómina
// -----------------------------------------------------------------------------

const FORMAS: Record<string, string> = { porcentaje: 'Porcentaje', dias_anuales: 'Días de salario al año', monto_mensual: 'Monto fijo mensual' }
const BASES: Record<string, string> = {
  salario_normal: 'salario normal',
  salario_integral: 'salario integral',
  salario_y_bonos: 'salario y bonos',
  ninguna: 'ninguna',
}

type Componente = {
  id: string
  nombre: string
  forma: string
  valor: number
  base: string
  tope_salarios_minimos: number | null
  piso_parametro: string | null
  moneda: string | null
  aplica_a: string
  base_legal: string | null
  fuente: string | null
  por_confirmar: boolean
  vigencia: unknown
  nota: string | null
}
type Costo = { total_ves: number | null; total_usd: number | null; tasa: number | null; por_confirmar: boolean }

function describir(c: Componente) {
  if (c.forma === 'porcentaje') return `${fmtNumero(c.valor)} % del ${BASES[c.base] ?? c.base}`
  if (c.forma === 'dias_anuales') return `${fmtNumero(c.valor)} días de ${BASES[c.base] ?? c.base} al año`
  return `${c.moneda ?? 'VES'} ${fmtNumero(c.valor)} al mes`
}

function CamposComponente({ c, hoy, parametros, catalogos, id }: { c?: Componente; hoy: string; parametros: { clave: string; nombre: string }[]; catalogos: Catalogos; id: string }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div>
        <label htmlFor={`${id}-forma`} className="etiqueta">
          Forma
        </label>
        <select id={`${id}-forma`} name="forma" defaultValue={c?.forma ?? 'porcentaje'} className="campo">
          {Object.entries(FORMAS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor={`${id}-valor`} className="etiqueta">
          Valor <span className="text-acento-600">*</span>
        </label>
        <input id={`${id}-valor`} type="number" step="0.0001" min={0} name="valor" required defaultValue={c?.valor ?? ''} className="campo" />
      </div>
      <div>
        <label htmlFor={`${id}-base`} className="etiqueta">
          Se calcula sobre
        </label>
        <select id={`${id}-base`} name="base" defaultValue={c?.base ?? 'salario_normal'} className="campo">
          {Object.entries(BASES).map(([k, v]) => (
            <option key={k} value={k}>
              {v.charAt(0).toUpperCase() + v.slice(1)}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor={`${id}-moneda`} className="etiqueta">
          Moneda (solo monto fijo)
        </label>
        <select id={`${id}-moneda`} name="moneda" defaultValue={c?.moneda ?? 'VES'} className="campo">
          <option value="VES">Bolívares</option>
          <option value="USD">Dólares</option>
        </select>
      </div>
      <div>
        <label htmlFor={`${id}-tope`} className="etiqueta">
          Tope de la base (salarios mínimos)
        </label>
        <input id={`${id}-tope`} type="number" step="0.01" min={0} name="tope" defaultValue={c?.tope_salarios_minimos ?? ''} className="campo" />
      </div>
      <div>
        <label htmlFor={`${id}-piso`} className="etiqueta">
          Piso de la base
        </label>
        <select id={`${id}-piso`} name="piso" defaultValue={c?.piso_parametro ?? ''} className="campo">
          <option value="">Sin piso</option>
          {parametros.map((p) => (
            <option key={p.clave} value={p.clave}>
              {p.nombre}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor={`${id}-aplica`} className="etiqueta">
          Aplica a
        </label>
        <select id={`${id}-aplica`} name="aplica_a" defaultValue={c?.aplica_a ?? 'todos'} className="campo">
          <option value="todos">Todas las nóminas</option>
          {catalogos.tipo_nomina.map((o) => (
            <option key={o.clave} value={o.clave}>
              Nómina {o.etiqueta.toLowerCase()}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor={`${id}-fecha`} className="etiqueta">
          Rige desde <span className="text-acento-600">*</span>
        </label>
        <input id={`${id}-fecha`} type="date" name="fecha" required min={hoy} defaultValue={hoy} className="campo" />
      </div>
      <div className="sm:col-span-2">
        <label htmlFor={`${id}-legal`} className="etiqueta">
          Base legal
        </label>
        <input id={`${id}-legal`} name="base_legal" defaultValue={c?.base_legal ?? ''} className="campo" />
      </div>
      <div className="sm:col-span-2">
        <label htmlFor={`${id}-fuente`} className="etiqueta">
          Fuente
        </label>
        <input id={`${id}-fuente`} name="fuente" defaultValue={c?.fuente ?? ''} className="campo" placeholder="Convención colectiva, Gaceta Oficial…" />
      </div>
      <label className="flex items-center gap-2 text-sm text-marca-700 sm:col-span-2">
        <input type="checkbox" name="por_confirmar" defaultChecked={c?.por_confirmar ?? true} className="h-4 w-4 accent-[var(--color-amber-600)]" />
        Por confirmar con Capital Humano
      </label>
    </div>
  )
}

async function Costos({ supabase, e, catalogos, sesion, hoy }: { supabase: Cliente; e: Estructura; catalogos: Catalogos; sesion: Sesion; hoy: string }) {
  const org = supabase.schema('org')
  const editar = puede(sesion, 'sistema:costos', 'editar')
  const [{ data: tasas }, referencias, componentes, { data: parametros }, { data: costos }] = await Promise.all([
    org.from('tasa_cambio').select('fecha, ves_por_usd, fuente').order('fecha', { ascending: false }).limit(8),
    todas((a, b) => org.from('costo_referencia').select('id, cargo_id, salario_mensual, moneda, bonos_usd_mensual, vigencia, fuente').filter('vigencia', 'cs', VIGENTE_EN(hoy)).range(a, b)),
    todas<Componente>((a, b) => org.from('componente_costo').select('*').filter('vigencia', 'cs', VIGENTE_EN(hoy)).order('orden').range(a, b)),
    supabase.schema('control').from('parametro').select('id, clave, nombre, valor, unidad, vigencia, fuente, por_confirmar').filter('vigencia', 'cs', VIGENTE_EN(hoy)).order('clave'),
    org.rpc('costo_cargos', { p_fecha: hoy }),
  ])
  const tasa = tasas?.[0] ?? null
  const refDe = new Map(referencias.map((r) => [r.cargo_id, r]))
  const costoDe = new Map((costos ?? []).map((c) => [c.cargo_id, c.costo as unknown as Costo | null]))
  const cargosConPlaza = [...new Set([...e.plazas.values()].map((p) => p.cargo_id))]
    .map((id) => e.cargos.get(id)!)
    .filter(Boolean)
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
  const sinReferencia = cargosConPlaza.filter((c) => !refDe.has(c.id)).length
  const pendientes = componentes.filter((c) => c.por_confirmar).length

  // El costo de la dotación aprobada, por unidad: Σ dotación × costo mensual del cargo.
  const costoUnidad = (n: Nodo) => {
    let ves = 0
    let usd = 0
    let faltan = 0
    for (const p of n.plazas) {
      const c = costoDe.get(p.cargo_id)
      if (!c || c.total_ves == null) {
        faltan += 1
        continue
      }
      ves += p.dotacion * c.total_ves
      usd += p.dotacion * (c.total_usd ?? 0)
    }
    return { ves, usd, faltan, plazas: n.plazas.length }
  }
  const grupos = porDireccion(e)

  return (
    <div className="space-y-8">
      <p className="rounded-xl border border-marca-200 bg-marca-50 px-4 py-3 text-xs text-marca-600">
        Perímetro de nómina: solo lo ve quien tiene el permiso de costos. Son costos <strong>de referencia por cargo</strong>, no el salario de
        ninguna persona; el salario individual sigue en el sistema de nómina.
      </p>

      {/* Tasa */}
      <section aria-labelledby="t-tasa" className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="tarjeta p-4 sm:p-5">
          <h2 id="t-tasa" className="text-sm font-semibold text-marca-800">
            Tasa de cambio
          </h2>
          {tasa ? (
            <>
              <p className="mt-2 text-2xl font-bold text-marca-900 tabular-nums">Bs {fmtNumero(Number(tasa.ves_por_usd))} por USD</p>
              <p className="text-xs text-marca-500">
                Del {fmtFecha(tasa.fecha)} · {tasa.fuente}
                {tasa.fecha !== hoy && <span className="ml-1 text-amber-700">· no es la de hoy</span>}
              </p>
              {tasas && tasas.length > 1 && (
                <ul className="mt-3 space-y-0.5 text-xs text-marca-500">
                  {tasas.slice(1).map((t) => (
                    <li key={t.fecha}>
                      {fmtFecha(t.fecha)}: Bs {fmtNumero(Number(t.ves_por_usd))} ({t.fuente})
                    </li>
                  ))}
                </ul>
              )}
            </>
          ) : (
            <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              Falta la tasa. Sin ella no se calcula ningún costo: los bonos y los montos fijos están en dólares. Cárgala a mano con la del BCV del día.
            </p>
          )}
        </div>
        {editar && (
          <div className="tarjeta p-4 sm:p-5">
            <h3 className="mb-3 text-sm font-semibold text-marca-800">Cargar la tasa de un día</h3>
            <Formulario accion={fijarTasa} boton="Guardar tasa">
              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <label htmlFor="tasa-fecha" className="etiqueta">
                    Fecha
                  </label>
                  <input id="tasa-fecha" type="date" name="fecha" max={hoy} defaultValue={hoy} required className="campo" />
                </div>
                <div>
                  <label htmlFor="tasa-valor" className="etiqueta">
                    Bs por USD
                  </label>
                  <input id="tasa-valor" type="number" step="0.0001" min={0} name="valor" required className="campo" />
                </div>
                <div>
                  <label htmlFor="tasa-fuente" className="etiqueta">
                    Fuente
                  </label>
                  <input id="tasa-fuente" name="fuente" defaultValue="BCV" className="campo" />
                </div>
              </div>
              <p className="mt-2 text-xs text-marca-500">La plataforma no inventa ni descarga la tasa: se copia del BCV. Si ya hay una para ese día, se corrige.</p>
            </Formulario>
          </div>
        )}
      </section>

      {/* Costo de la dotación */}
      <section aria-labelledby="t-costo">
        <h2 id="t-costo" className="mb-1 text-sm font-semibold text-marca-800">
          Costo de la dotación aprobada
        </h2>
        <p className="mb-3 text-xs text-marca-500">
          Dotación × costo mensual de referencia del cargo (salario, bonos y componentes vigentes). El anual es doce veces el mensual: utilidades y
          bono vacacional ya van prorrateados.
          {pendientes > 0 && ` ${pendientes} componentes están por confirmar: el número es preliminar.`}
        </p>
        {!tasa ? (
          <p className="tarjeta px-4 py-6 text-center text-sm text-amber-800">Falta la tasa: no se muestra ningún costo hasta cargarla.</p>
        ) : (
          <div className="space-y-4">
            {grupos.map((g) => {
              const filas = g.nodos.filter((n) => n.plazas.length).map((n) => ({ n, c: costoUnidad(n) }))
              if (!filas.length) return null
              const faltan = filas.reduce((s, f) => s + f.c.faltan, 0)
              const ves = filas.reduce((s, f) => s + f.c.ves, 0)
              const usd = filas.reduce((s, f) => s + f.c.usd, 0)
              const base = g.nodos[0]?.profundidad ?? 0
              return (
                <div key={g.ref}>
                  <h3 className="mb-2 text-sm font-medium text-marca-800">{g.nombre}</h3>
                  <Tabla titulo={`Costo de ${g.nombre}`} min={720}>
                    <thead className="border-b border-marca-200 bg-marca-50 text-left text-xs text-marca-600">
                      <tr>
                        <th className={TH}>Unidad</th>
                        <th className={cn(TH, 'text-right')}>Aprobada</th>
                        <th className={cn(TH, 'text-right')}>Mensual Bs</th>
                        <th className={cn(TH, 'text-right')}>Mensual USD</th>
                        <th className={cn(TH, 'text-right')}>Anual Bs</th>
                        <th className={cn(TH, 'text-right')}>Anual USD</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-marca-100">
                      {filas.map(({ n, c }) => (
                        <tr key={n.unidad.ref}>
                          <td className="px-3 py-2 text-marca-900" style={{ paddingLeft: 12 + (n.profundidad - base) * 14 }}>
                            {n.unidad.nombre}
                          </td>
                          <td className={TD}>{n.propio.dotacion}</td>
                          {c.faltan ? (
                            <td colSpan={4} className="px-3 py-2 text-right text-xs text-amber-800">
                              Falta costo de referencia ({c.faltan} de {c.plazas} plazas)
                            </td>
                          ) : (
                            <>
                              <td className={TD}>{fmtBs(c.ves)}</td>
                              <td className={TD}>{fmtUsd(c.usd)}</td>
                              <td className={TD}>{fmtBs(c.ves * 12)}</td>
                              <td className={TD}>{fmtUsd(c.usd * 12)}</td>
                            </>
                          )}
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="border-t border-marca-200 bg-marca-50/60 font-semibold text-marca-900">
                      <tr>
                        <td className="px-3 py-2">Total</td>
                        <td className={TD}>{filas.reduce((s, f) => s + f.n.propio.dotacion, 0)}</td>
                        {faltan ? (
                          <td colSpan={4} className="px-3 py-2 text-right text-xs font-medium text-amber-800">
                            Incompleto: faltan costos de referencia en {faltan} plazas
                          </td>
                        ) : (
                          <>
                            <td className={TD}>{fmtBs(ves)}</td>
                            <td className={TD}>{fmtUsd(usd)}</td>
                            <td className={TD}>{fmtBs(ves * 12)}</td>
                            <td className={TD}>{fmtUsd(usd * 12)}</td>
                          </>
                        )}
                      </tr>
                    </tfoot>
                  </Tabla>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* Componentes */}
      <section aria-labelledby="t-comp">
        <h2 id="t-comp" className="mb-1 text-sm font-semibold text-marca-800">
          Componentes de costo
        </h2>
        <p className="mb-3 text-xs text-marca-500">
          Lo que se suma al salario: son datos con vigencia, no código, porque la ley y la convención cambian. Sin la convención colectiva vigente se
          cargaron con los valores de ley y quedan «por confirmar».
        </p>
        <ul className="grid items-start gap-3 lg:grid-cols-2">
          {componentes.map((c) => (
            <li key={c.id} className="tarjeta min-w-0 p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium text-marca-900">{c.nombre}</p>
                  <p className="text-sm text-marca-700">
                    {describir(c)}
                    {c.tope_salarios_minimos && ` · tope ${fmtNumero(c.tope_salarios_minimos)} salarios mínimos`}
                    {c.piso_parametro && ` · piso: ${parametros?.find((p) => p.clave === c.piso_parametro)?.nombre ?? c.piso_parametro}`}
                    {c.aplica_a !== 'todos' && ` · solo nómina ${etiquetaDe(catalogos.tipo_nomina, c.aplica_a).toLowerCase()}`}
                  </p>
                  {c.base_legal && <p className="mt-1 text-xs text-marca-500">Base legal: {c.base_legal}</p>}
                  <p className="text-xs text-marca-400">Desde {fmtFecha(rango(c.vigencia).desde)}{c.fuente ? ` · ${c.fuente}` : ''}</p>
                </div>
                {c.por_confirmar ? <Insignia tono="ambar">Por confirmar</Insignia> : <Insignia tono="verde">Confirmado</Insignia>}
              </div>
              {editar && (
                <div className="mt-3 space-y-2">
                  <Plegable titulo="Cambiar (versión nueva)">
                    <Formulario accion={editarComponente} boton="Guardar versión nueva">
                      <input type="hidden" name="id" value={c.id} />
                      <CamposComponente c={c} hoy={hoy} parametros={parametros ?? []} catalogos={catalogos} id={`cc-${c.id.slice(0, 8)}`} />
                    </Formulario>
                  </Plegable>
                  <Plegable titulo="Dejar de aplicar" peligro>
                    <Formulario accion={retirarComponente} boton="Retirar" tono="peligro">
                      <input type="hidden" name="id" value={c.id} />
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                          <label htmlFor={`rc-${c.id}`} className="etiqueta">
                            Deja de aplicar desde
                          </label>
                          <input id={`rc-${c.id}`} type="date" name="fecha" required min={hoy} defaultValue={hoy} className="campo" />
                        </div>
                        <label className="flex items-center gap-2 self-end pb-2 text-sm text-marca-700">
                          <input type="checkbox" name="confirmo" className="h-4 w-4 accent-[var(--color-acento-600)]" />
                          Confirmo
                        </label>
                      </div>
                    </Formulario>
                  </Plegable>
                </div>
              )}
            </li>
          ))}
        </ul>
        {editar && (
          <Plegable titulo="Agregar un componente" className="mt-3">
            <Formulario accion={crearComponente} boton="Crear componente">
              <div className="mb-3">
                <label htmlFor="nc-nombre" className="etiqueta">
                  Nombre <span className="text-acento-600">*</span>
                </label>
                <input id="nc-nombre" name="nombre" required minLength={3} className="campo" placeholder="Bono de transporte" />
              </div>
              <CamposComponente hoy={hoy} parametros={parametros ?? []} catalogos={catalogos} id="nc" />
            </Formulario>
          </Plegable>
        )}
      </section>

      {/* Parámetros */}
      <section aria-labelledby="t-par">
        <h2 id="t-par" className="mb-3 text-sm font-semibold text-marca-800">
          Parámetros
        </h2>
        <ul className="grid gap-3 md:grid-cols-2">
          {(parametros ?? []).map((p) => (
            <li key={p.id} className="tarjeta p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-marca-900">{p.nombre}</p>
                  <p className="text-lg font-semibold text-marca-900 tabular-nums">
                    {p.unidad === 'VES' ? fmtBs(Number(p.valor)) : p.unidad === 'USD' ? fmtUsd(Number(p.valor)) : `${fmtNumero(Number(p.valor))} ${p.unidad}`}
                  </p>
                  <p className="text-xs text-marca-500">
                    Desde {fmtFecha(rango(p.vigencia).desde)}
                    {p.fuente && ` · ${p.fuente}`}
                  </p>
                </div>
                {p.por_confirmar && <Insignia tono="ambar">Por confirmar</Insignia>}
              </div>
              {editar && (
                <details className="mt-2">
                  <summary className="cursor-pointer text-xs font-medium text-acento-700 select-none">Cambiar</summary>
                  <Formulario accion={fijarParametro} boton="Guardar versión nueva" className="mt-3">
                    <input type="hidden" name="clave" value={p.clave} />
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <label htmlFor={`pa-v-${p.id}`} className="etiqueta">
                          Valor ({p.unidad})
                        </label>
                        <input id={`pa-v-${p.id}`} type="number" step="0.0001" min={0} name="valor" required defaultValue={p.valor} className="campo" />
                      </div>
                      <div>
                        <label htmlFor={`pa-f-${p.id}`} className="etiqueta">
                          Rige desde
                        </label>
                        <input id={`pa-f-${p.id}`} type="date" name="fecha" required min={hoy} defaultValue={hoy} className="campo" />
                      </div>
                      <div className="sm:col-span-2">
                        <label htmlFor={`pa-u-${p.id}`} className="etiqueta">
                          Fuente
                        </label>
                        <input id={`pa-u-${p.id}`} name="fuente" defaultValue={p.fuente ?? ''} className="campo" />
                      </div>
                      <label className="flex items-center gap-2 text-sm text-marca-700 sm:col-span-2">
                        <input type="checkbox" name="por_confirmar" defaultChecked={p.por_confirmar} className="h-4 w-4 accent-[var(--color-amber-600)]" />
                        Por confirmar
                      </label>
                    </div>
                  </Formulario>
                </details>
              )}
            </li>
          ))}
        </ul>
      </section>
      {/* Costo de referencia por cargo */}
      <section aria-labelledby="t-ref">
        <h2 id="t-ref" className="mb-1 text-sm font-semibold text-marca-800">
          Costo de referencia por cargo
        </h2>
        <p className="mb-3 text-xs text-marca-500">
          {sinReferencia
            ? `${sinReferencia} de ${cargosConPlaza.length} cargos con plaza no tienen costo de referencia todavía.`
            : 'Todos los cargos con plaza tienen costo de referencia.'}{' '}
          Cada cambio rige desde su fecha y deja la versión anterior en el historial.
        </p>
        <ul className="tarjeta divide-y divide-marca-100">
          {cargosConPlaza.map((c) => {
            const r = refDe.get(c.id)
            const k = costoDe.get(c.id)
            return (
              <li key={c.id} className="px-4 py-3">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <span className="font-medium text-marca-900">{c.nombre}</span>
                  {r ? (
                    <span className="text-xs text-marca-600 tabular-nums">
                      Salario {r.moneda === 'USD' ? fmtUsd(Number(r.salario_mensual)) : fmtBs(Number(r.salario_mensual))}
                      {Number(r.bonos_usd_mensual) > 0 && ` + bonos ${fmtUsd(Number(r.bonos_usd_mensual))}`} · desde {fmtFecha(rango(r.vigencia).desde)}
                      {k?.total_ves != null && tasa && (
                        <span className="ml-2 font-semibold text-marca-900">
                          Costo mensual {fmtBs(k.total_ves)} · {fmtUsd(k.total_usd ?? 0)}
                        </span>
                      )}
                    </span>
                  ) : (
                    <Insignia tono="ambar">Falta costo de referencia</Insignia>
                  )}
                </div>
                {editar && (
                  <details className="group mt-2">
                    <summary className="cursor-pointer text-xs font-medium text-acento-700 select-none">{r ? 'Cambiar' : 'Cargar'} el costo de referencia</summary>
                    <Formulario accion={fijarCostoReferencia} boton="Guardar" className="mt-3">
                      <input type="hidden" name="cargo" value={c.id} />
                      <div className="grid gap-3 sm:grid-cols-5">
                        <div className="sm:col-span-2">
                          <label htmlFor={`cr-sal-${c.id}`} className="etiqueta">
                            Salario mensual de referencia
                          </label>
                          <input id={`cr-sal-${c.id}`} type="number" step="0.01" min={0} name="salario" required defaultValue={r?.salario_mensual ?? ''} className="campo" />
                        </div>
                        <div>
                          <label htmlFor={`cr-mon-${c.id}`} className="etiqueta">
                            Moneda
                          </label>
                          <select id={`cr-mon-${c.id}`} name="moneda" defaultValue={r?.moneda ?? 'VES'} className="campo">
                            <option value="VES">Bs</option>
                            <option value="USD">USD</option>
                          </select>
                        </div>
                        <div>
                          <label htmlFor={`cr-bon-${c.id}`} className="etiqueta">
                            Bonos USD/mes
                          </label>
                          <input id={`cr-bon-${c.id}`} type="number" step="0.01" min={0} name="bonos" defaultValue={r?.bonos_usd_mensual ?? 0} className="campo" />
                        </div>
                        <div>
                          <label htmlFor={`cr-fec-${c.id}`} className="etiqueta">
                            Rige desde
                          </label>
                          <input id={`cr-fec-${c.id}`} type="date" name="fecha" required min={hoy} defaultValue={hoy} className="campo" />
                        </div>
                        <div className="sm:col-span-5">
                          <label htmlFor={`cr-fue-${c.id}`} className="etiqueta">
                            Fuente
                          </label>
                          <input id={`cr-fue-${c.id}`} name="fuente" defaultValue={r?.fuente ?? ''} className="campo" placeholder="Tabulador de Capital Humano, banda salarial…" />
                        </div>
                      </div>
                    </Formulario>
                  </details>
                )}
              </li>
            )
          })}
        </ul>
      </section>

    </div>
  )
}
