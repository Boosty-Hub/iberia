import type { Metadata } from 'next'
import Link from 'next/link'
import { Enviar, Formulario, Plegable } from '@/components/sistema/organizacion/formulario'
import { fmtMomento, todas } from '@/components/sistema/organizacion/datos'
import { EncabezadoPagina, Insignia } from '@/components/ui'
import { puede, requerirPermiso, requerirSesion } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { cn } from '@/lib/utils'
import { resolverConciliacion } from './acciones'

export const metadata: Metadata = { title: 'Conciliación' }

/**
 * La mesa de conciliación (cap. 05 §4.2): lo que la carga inicial no pudo
 * decidir sola —contradicciones entre fuentes, faltantes, personas sin casar,
 * inferencias— para que Capital Humano y Calidad lo resuelvan con un texto que
 * queda en la auditoría. Nada se borra: un punto se resuelve, se descarta o se
 * reabre.
 */

const MODULOS: Record<string, { nombre: string; recurso: string }> = {
  'NUC-ORG': { nombre: 'Estructura', recurso: 'sistema:estructura' },
  'NUC-PRO': { nombre: 'Procesos', recurso: 'sistema:procesos' },
  'NUC-DOC': { nombre: 'Documentos', recurso: 'sistema:documentos' },
}
const TIPOS: Record<string, string> = {
  contradiccion: 'Contradicción',
  faltante: 'Faltante',
  sin_casar: 'Sin casar',
  inferencia: 'Inferencia',
  decision: 'Decisión pendiente',
}
const ESTADOS: Record<string, { t: string; tono: 'ambar' | 'verde' | 'neutro' }> = {
  abierto: { t: 'Abierto', tono: 'ambar' },
  resuelto: { t: 'Resuelto', tono: 'verde' },
  descartado: { t: 'Descartado', tono: 'neutro' },
}

type Punto = {
  id: string
  modulo: string
  tipo: string
  descripcion: string
  objeto: string | null
  fuente: string | null
  responsable: string | null
  estado: string
  resolucion: string | null
  resuelto_en: string | null
}

export default async function ConciliacionPage({ searchParams }: PageProps<'/sistema/nucleo/conciliacion'>) {
  const sesion = await requerirSesion()
  // La ve quien ve cualquiera de los tres módulos; sin ninguno, la puerta de siempre.
  const visibles = Object.entries(MODULOS).filter(([, m]) => puede(sesion, m.recurso))
  if (!visibles.length) await requerirPermiso('sistema:estructura')
  const sp = await searchParams
  const modulo = typeof sp.modulo === 'string' && MODULOS[sp.modulo] ? sp.modulo : ''
  const tipo = typeof sp.tipo === 'string' && TIPOS[sp.tipo] ? sp.tipo : ''
  const estado = typeof sp.estado === 'string' && (ESTADOS[sp.estado] || sp.estado === 'todos') ? sp.estado : 'abierto'

  const supabase = await createClient()
  const puntos = await todas<Punto>((a, b) => {
    let q = supabase
      .schema('control')
      .from('conciliacion')
      .select('id, modulo, tipo, descripcion, objeto, fuente, responsable, estado, resolucion, resuelto_en')
      .order('modulo')
      .order('tipo')
      .order('creado_en')
    if (modulo) q = q.eq('modulo', modulo)
    if (tipo) q = q.eq('tipo', tipo)
    return q.range(a, b)
  })
  const cuenta = (e: string) => puntos.filter((p) => p.estado === e).length
  const lista = estado === 'todos' ? puntos : puntos.filter((p) => p.estado === estado)

  const enlace = (cambios: Record<string, string>) => {
    const q = new URLSearchParams({ ...(modulo && { modulo }), ...(tipo && { tipo }), estado, ...cambios })
    for (const [k, v] of [...q.entries()]) if (!v) q.delete(k)
    return `/sistema/nucleo/conciliacion?${q.toString()}`
  }

  return (
    <>
      <EncabezadoPagina
        rotulo="Núcleo"
        titulo="Conciliación"
        descripcion="Lo que la carga inicial no pudo decidir sola: contradicciones entre fuentes, datos que faltan, personas sin casar y decisiones pendientes. Cada punto se resuelve con un texto que dice qué se decidió; queda en la auditoría."
        acciones={
          <Link href="/sistema/nucleo/organizacion" className="btn-neutro h-10">
            Estructura
          </Link>
        }
      />

      <nav aria-label="Estado" className="mb-4 grid grid-cols-2 gap-1 rounded-xl border border-marca-200 bg-white p-1 sm:flex">
        {(['abierto', 'resuelto', 'descartado', 'todos'] as const).map((e) => (
          <Link
            key={e}
            href={enlace({ estado: e })}
            aria-current={estado === e ? 'page' : undefined}
            className={cn(
              'flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-lg px-3 text-sm font-medium whitespace-nowrap',
              estado === e ? 'bg-acento-50 font-semibold text-acento-700' : 'text-marca-600 hover:bg-marca-50',
            )}
          >
            {e === 'todos' ? 'Todos' : ESTADOS[e].t + 's'}
            <span className="text-xs tabular-nums opacity-70">{e === 'todos' ? puntos.length : cuenta(e)}</span>
          </Link>
        ))}
      </nav>

      <form method="get" className="tarjeta mb-5 grid gap-3 p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <input type="hidden" name="estado" value={estado} />
        <div>
          <label htmlFor="cn-mod" className="etiqueta">
            Módulo
          </label>
          <select id="cn-mod" name="modulo" defaultValue={modulo} className="campo">
            <option value="">Todos</option>
            {Object.entries(MODULOS).map(([k, m]) => (
              <option key={k} value={k}>
                {m.nombre}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="cn-tipo" className="etiqueta">
            Tipo
          </label>
          <select id="cn-tipo" name="tipo" defaultValue={tipo} className="campo">
            <option value="">Todos</option>
            {Object.entries(TIPOS).map(([k, t]) => (
              <option key={k} value={k}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className="btn-primario h-10">
          Filtrar
        </button>
      </form>

      {lista.length === 0 ? (
        <p className="tarjeta px-4 py-12 text-center text-sm text-marca-500">No hay puntos con esos filtros.</p>
      ) : (
        <ul className="space-y-3">
          {lista.map((p) => {
            const m = MODULOS[p.modulo]
            const puedeResolver = m ? puede(sesion, m.recurso, 'editar') : sesion.rol.nivel === 'admin'
            return (
              <li key={p.id} className="tarjeta min-w-0 p-4 [overflow-wrap:anywhere] sm:p-5">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Insignia tono={ESTADOS[p.estado]?.tono}>{ESTADOS[p.estado]?.t ?? p.estado}</Insignia>
                  <Insignia>{TIPOS[p.tipo] ?? p.tipo}</Insignia>
                  <Insignia tono="marca">{m?.nombre ?? p.modulo}</Insignia>
                  {p.responsable && <span className="text-xs text-marca-500">Lo resuelve: {p.responsable}</span>}
                </div>
                <p className="mt-2 text-sm text-pretty [overflow-wrap:anywhere] text-marca-900">{p.descripcion}</p>
                {(p.objeto || p.fuente) && (
                  <p className="mt-1 text-xs [overflow-wrap:anywhere] text-marca-500">
                    {p.objeto && <span>Afecta a: {p.objeto}</span>}
                    {p.objeto && p.fuente && ' · '}
                    {p.fuente && <span>Fuente: {p.fuente}</span>}
                  </p>
                )}
                {p.estado !== 'abierto' && p.resolucion && (
                  <p className="mt-2 rounded-lg bg-marca-50 px-3 py-2 text-sm text-marca-700">
                    <span className="font-medium">{p.estado === 'resuelto' ? 'Resolución' : 'Por qué se descartó'}:</span> {p.resolucion}
                    {p.resuelto_en && <span className="block text-xs text-marca-500">{fmtMomento(p.resuelto_en)}</span>}
                  </p>
                )}
                {puedeResolver && (
                  <div className="mt-3">
                    {p.estado === 'abierto' ? (
                      <Plegable titulo="Resolver o descartar">
                        <Formulario
                          accion={resolverConciliacion}
                          botones={
                            <>
                              <Enviar texto="Resuelto" nombre="estado" valor="resuelto" />
                              <Enviar texto="Descartar" nombre="estado" valor="descartado" tono="neutro" />
                            </>
                          }
                        >
                          <input type="hidden" name="id" value={p.id} />
                          <label htmlFor={`res-${p.id}`} className="etiqueta">
                            Qué se decidió <span className="text-acento-600">*</span>
                          </label>
                          <textarea
                            id={`res-${p.id}`}
                            name="resolucion"
                            rows={3}
                            required
                            minLength={5}
                            className="campo"
                            placeholder="Por ejemplo: confirmado con Capital Humano, la jefatura reporta a la Gerencia de Planta desde 2025."
                          />
                        </Formulario>
                      </Plegable>
                    ) : (
                      <Formulario accion={resolverConciliacion} botones={<Enviar texto="Reabrir" nombre="estado" valor="abierto" tono="neutro" />}>
                        <input type="hidden" name="id" value={p.id} />
                      </Formulario>
                    )}
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </>
  )
}
