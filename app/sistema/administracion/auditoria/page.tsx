import type { Metadata } from 'next'
import Link from 'next/link'
import { nombresDe } from '@/components/sistema/flujo/datos'
import { fechaHora } from '@/components/sistema/flujo/formato'
import { EncabezadoPagina, EstadoVacio, Insignia } from '@/components/ui'
import { requerirPermiso } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'Auditoría' }

const POR_PAGINA = 50
const RUTA = '/sistema/administracion/auditoria'

/** Las tablas auditadas (trigger `control.auditar`), con su nombre en pantalla. */
const TABLAS: Record<string, string> = {
  'org.unidad': 'Unidades',
  'org.cargo': 'Cargos',
  'org.plaza': 'Plazas',
  'org.ocupacion': 'Ocupaciones',
  'org.escenario': 'Escenarios',
  'org.plan_dotacion': 'Planes de dotación',
  'org.plan_dotacion_linea': 'Líneas del plan de dotación',
  'org.componente_costo': 'Componentes de costo',
  'org.costo_referencia': 'Costos de referencia',
  'org.tasa_cambio': 'Tasas de cambio',
  'org.requisicion': 'Requisiciones',
  'org.requisicion_costo': 'Costo de requisiciones',
  'sgc.proceso': 'Procesos',
  'sgc.proceso_cruce': 'Cruces de procesos',
  'sgc.documento': 'Documentos',
  'flujo.ruta': 'Rutas de aprobación',
  'flujo.ruta_paso': 'Pasos de las rutas',
  'flujo.solicitud': 'Solicitudes de aprobación',
  'flujo.paso': 'Pasos de las solicitudes',
  'control.catalogo': 'Catálogos',
  'control.modulo': 'Registro de módulos',
  'control.parametro': 'Parámetros',
  'control.conciliacion': 'Conciliación',
  'public.roles': 'Roles',
  'public.rol_permisos': 'Matriz de permisos',
}

const ACCION = {
  INSERT: { etiqueta: 'Alta', tono: 'verde' },
  UPDATE: { etiqueta: 'Cambio', tono: 'ambar' },
  DELETE: { etiqueta: 'Baja', tono: 'rojo' },
} as const

/** Columnas que calcula la base y no dicen nada en un diff. */
const RUIDO = (k: string) => k === 'esc' || k.endsWith('_cat')

function valor(v: unknown): string {
  if (v === null || v === undefined || v === '') return '—'
  if (typeof v === 'string') return v
  if (typeof v === 'boolean') return v ? 'sí' : 'no'
  const s = JSON.stringify(v)
  return s.length > 240 ? `${s.slice(0, 240)}…` : s
}

function diferencias(accion: string, antes: Record<string, unknown> | null, despues: Record<string, unknown> | null) {
  if (accion === 'UPDATE') {
    const claves = new Set([...Object.keys(antes ?? {}), ...Object.keys(despues ?? {})])
    return [...claves]
      .filter((k) => !RUIDO(k) && JSON.stringify(antes?.[k] ?? null) !== JSON.stringify(despues?.[k] ?? null))
      .map((k) => ({ campo: k, antes: valor(antes?.[k]), despues: valor(despues?.[k]) }))
  }
  const fila = (accion === 'INSERT' ? despues : antes) ?? {}
  return Object.entries(fila)
    .filter(([k, v]) => !RUIDO(k) && v !== null && v !== '' && !(Array.isArray(v) && !v.length))
    .map(([k, v]) => ({ campo: k, antes: accion === 'DELETE' ? valor(v) : '', despues: accion === 'INSERT' ? valor(v) : '' }))
}

/**
 * La auditoría: cada alta, cambio y baja de lo editable, con quién, cuándo y el
 * antes y después. Es de solo inserción y va encadenada por hash: la evidencia
 * no se edita. Paginada (la base corta en mil filas), con filtros por tabla,
 * fecha y persona.
 */
export default async function AuditoriaPage({ searchParams }: PageProps<'/sistema/administracion/auditoria'>) {
  const [, params] = await Promise.all([requerirPermiso('sistema:auditoria'), searchParams])
  const supabase = await createClient()
  const control = supabase.schema('control')

  const texto = (k: string) => (typeof params[k] === 'string' ? (params[k] as string) : '')
  const tabla = texto('tabla')
  const desde = /^\d{4}-\d{2}-\d{2}$/.test(texto('desde')) ? texto('desde') : ''
  const hasta = /^\d{4}-\d{2}-\d{2}$/.test(texto('hasta')) ? texto('hasta') : ''
  const actor = /^[0-9a-f-]{36}$/.test(texto('actor')) ? texto('actor') : ''
  const pagina = Math.max(1, Number(texto('pagina')) || 1)

  let q = control
    .from('auditoria')
    .select('id, esquema, tabla, registro_id, accion, antes, despues, actor, en', { count: 'exact' })
    .order('id', { ascending: false })
    .range((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA - 1)
  if (tabla.includes('.')) {
    const [esquema, nombre] = tabla.split('.')
    q = q.eq('esquema', esquema).eq('tabla', nombre)
  }
  if (desde) q = q.gte('en', `${desde}T00:00:00-04:00`)
  if (hasta) q = q.lte('en', `${hasta}T23:59:59.999-04:00`)
  if (actor) q = q.eq('actor', actor)

  // Las personas para el filtro: las que aparecen en lo último que se registró.
  const [{ data, count }, { data: recientes }] = await Promise.all([q, control.from('auditoria').select('actor').not('actor', 'is', null).order('id', { ascending: false }).range(0, 999)])
  const filas = data ?? []
  const nombres = await nombresDe(supabase, [...filas.map((f) => f.actor), ...(recientes ?? []).map((r) => r.actor), actor])
  const actores = Object.entries(nombres).sort((a, b) => a[1].localeCompare(b[1], 'es'))
  const total = count ?? 0
  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA))

  const enlace = (n: number) => {
    const p = new URLSearchParams()
    if (tabla) p.set('tabla', tabla)
    if (desde) p.set('desde', desde)
    if (hasta) p.set('hasta', hasta)
    if (actor) p.set('actor', actor)
    if (n > 1) p.set('pagina', String(n))
    const s = p.toString()
    return s ? `${RUTA}?${s}` : RUTA
  }

  return (
    <>
      <EncabezadoPagina
        rotulo="Administración"
        titulo="Auditoría"
        descripcion="Quién cambió qué y cuándo, con el antes y el después. Se escribe sola en cada cambio y no se edita ni se borra: cada fila va encadenada a la anterior."
      />

      <form method="get" action={RUTA} className="tarjeta mb-6 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,2fr)_auto] lg:items-end">
        <div>
          <label htmlFor="f-tabla" className="etiqueta">
            Qué
          </label>
          <select id="f-tabla" name="tabla" defaultValue={tabla} className="campo">
            <option value="">Todas las tablas</option>
            {Object.entries(TABLAS).map(([k, v]) => (
              <option key={k} value={k}>
                {v} · {k}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="f-desde" className="etiqueta">
            Desde
          </label>
          <input id="f-desde" name="desde" type="date" defaultValue={desde} className="campo" />
        </div>
        <div>
          <label htmlFor="f-hasta" className="etiqueta">
            Hasta
          </label>
          <input id="f-hasta" name="hasta" type="date" defaultValue={hasta} className="campo" />
        </div>
        <div>
          <label htmlFor="f-actor" className="etiqueta">
            Quién
          </label>
          <select id="f-actor" name="actor" defaultValue={actor} className="campo">
            <option value="">Cualquier persona</option>
            {actores.map(([id, nombre]) => (
              <option key={id} value={id}>
                {nombre}
              </option>
            ))}
          </select>
        </div>
        <div className="flex gap-2">
          <button type="submit" className="btn-primario h-10">
            Filtrar
          </button>
          {(tabla || desde || hasta || actor) && (
            <Link href={RUTA} className="btn-neutro h-10">
              Limpiar
            </Link>
          )}
        </div>
      </form>

      <p className="mb-3 text-sm text-marca-600">
        {total.toLocaleString('es-VE')} {total === 1 ? 'registro' : 'registros'}
        {paginas > 1 && ` · página ${pagina} de ${paginas}`}
      </p>

      {!filas.length ? (
        <EstadoVacio titulo="Nada con esos filtros" />
      ) : (
        <ol className="space-y-3">
          {filas.map((f) => {
            const a = ACCION[f.accion as keyof typeof ACCION] ?? { etiqueta: f.accion, tono: 'neutro' as const }
            const cambios = diferencias(f.accion, f.antes as Record<string, unknown> | null, f.despues as Record<string, unknown> | null)
            const nombre = (f.despues as Record<string, unknown> | null)?.nombre ?? (f.antes as Record<string, unknown> | null)?.nombre
            return (
              <li key={f.id} className="tarjeta p-4">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <Insignia tono={a.tono}>{a.etiqueta}</Insignia>
                  <span className="font-semibold text-marca-900">{TABLAS[`${f.esquema}.${f.tabla}`] ?? `${f.esquema}.${f.tabla}`}</span>
                  {typeof nombre === 'string' && <span className="text-marca-700">· {nombre}</span>}
                  <span className="ml-auto text-xs text-marca-500">
                    {f.actor ? (nombres[f.actor] ?? 'Persona sin nombre') : 'Sistema o carga'} · {fechaHora(f.en)}
                  </span>
                </div>
                <p className="mt-1 truncate font-mono text-[11px] text-marca-400" title={f.registro_id}>
                  #{f.id} · {f.esquema}.{f.tabla} · {f.registro_id}
                </p>
                {cambios.length > 0 && (
                  <div className="mt-3 overflow-x-auto">
                    <table className="w-full min-w-[480px] text-left text-xs">
                      <thead className="text-marca-500">
                        <tr>
                          <th className="w-40 py-1 pr-3 font-medium">Campo</th>
                          {f.accion !== 'INSERT' && <th className="py-1 pr-3 font-medium">Antes</th>}
                          {f.accion !== 'DELETE' && <th className="py-1 font-medium">Después</th>}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--borde)]">
                        {cambios.map((c) => (
                          <tr key={c.campo} className="align-top">
                            <td className="py-1.5 pr-3 font-mono text-marca-600">{c.campo}</td>
                            {f.accion !== 'INSERT' && <td className="py-1.5 pr-3 break-all text-marca-500 line-through decoration-marca-300">{c.antes}</td>}
                            {f.accion !== 'DELETE' && <td className="py-1.5 break-all text-marca-900">{c.despues}</td>}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {f.accion === 'UPDATE' && !cambios.length && <p className="mt-2 text-xs text-marca-500">Se guardó sin cambiar ningún valor.</p>}
              </li>
            )
          })}
        </ol>
      )}

      {paginas > 1 && (
        <nav className="mt-6 flex flex-wrap items-center justify-between gap-3" aria-label="Páginas">
          {pagina > 1 ? (
            <Link href={enlace(pagina - 1)} className="btn-neutro h-10">
              ← Más recientes
            </Link>
          ) : (
            <span />
          )}
          <span className="text-sm text-marca-500">
            Página {pagina} de {paginas}
          </span>
          {pagina < paginas ? (
            <Link href={enlace(pagina + 1)} className="btn-neutro h-10">
              Más antiguos →
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}
    </>
  )
}
