import type { Metadata } from 'next'
import Link from 'next/link'
import { IconoAlerta, IconoBuscar } from '@/components/iconos'
import { EncabezadoPagina, Insignia } from '@/components/ui'
import { ESTADOS_DOCUMENTO, PERIMETROS, TONO_DOCUMENTO, fecha } from '@/components/sistema/procesos/comun'
import { leerProcesos } from '@/components/sistema/procesos/datos'
import { nombresDeTipo } from '@/components/sistema/procesos/documentos'
import { puede, requerirPermiso } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'Documentos · Plataforma Iberia' }

const POR_PAGINA = 50
const RUTA = '/sistema/nucleo/documentos'

/**
 * La biblioteca del SGC (NUC-DOC, inventario de solo lectura en contenido).
 * Por defecto, los vigentes. Todo se filtra y se pagina **en la base**
 * (`sgc.buscar_documentos`): son más de mil, y la API corta en mil.
 *
 * Los documentos de perímetro (nómina, médico, PCP, fórmulas) solo existen para
 * quien tiene `sistema:perimetros`: lo cierra la RLS, no esta página.
 */
export default async function DocumentosPage({ searchParams }: PageProps<'/sistema/nucleo/documentos'>) {
  const [sesion, consulta] = await Promise.all([requerirPermiso('sistema:documentos'), searchParams])
  const supabase = await createClient()
  const sgc = supabase.schema('sgc')
  const p = (k: string) => (typeof consulta[k] === 'string' ? (consulta[k] as string).trim() : '')

  const q = p('q')
  const estado = p('estado') || 'vigente'
  const xx = p('xx')
  const yy = p('yy')
  const familia = p('familia')
  const perimetro = p('perimetro')
  const proceso = /^[0-9a-f-]{36}$/i.test(p('proceso')) ? p('proceso') : ''
  const pagina = Math.max(1, Number(p('pagina')) || 1)

  const [resultado, { data: opciones }, tipos, procesosSgc] = await Promise.all([
    sgc.rpc('buscar_documentos', {
      p_texto: q || undefined,
      p_estado: estado === 'todos' ? undefined : estado,
      p_xx: xx || undefined,
      p_yy: yy || undefined,
      p_familia: familia || undefined,
      p_perimetro: perimetro || undefined,
      p_proceso: proceso || undefined,
      p_desde: (pagina - 1) * POR_PAGINA,
      p_limite: POR_PAGINA,
    }),
    sgc.rpc('opciones_documentos'),
    nombresDeTipo(supabase),
    puede(sesion, 'sistema:procesos') ? leerProcesos(supabase).then((r) => r.vigentes) : Promise.resolve([]),
  ])
  const filas = resultado.data ?? []
  const total = Number(filas[0]?.total ?? 0)
  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA))

  const de = (campo: string) =>
    (opciones ?? [])
      .filter((o) => o.campo === campo && o.valor)
      .sort((a, b) => String(a.valor).localeCompare(String(b.valor), 'es', { numeric: true }))
  const nombreXX = new Map<string, string>()
  for (const x of procesosSgc) if (x.codigo_sgc && /^II-\d{2}$/.test(x.codigo_sgc)) nombreXX.set(x.codigo_sgc.slice(3), x.nombre)
  const nombreProceso = new Map(procesosSgc.map((x) => [x.ref, x.nombre]))
  const vePerimetros = puede(sesion, 'sistema:perimetros')
  const totalEstados = de('estado').reduce((s, o) => s + Number(o.total), 0)

  const enlace = (cambios: Record<string, string | number | null>) => {
    const u = new URLSearchParams()
    const base: Record<string, string> = { q, estado, xx, yy, familia, perimetro, proceso }
    for (const [k, v] of Object.entries({ ...base, ...cambios })) if (v !== null && v !== '' && !(k === 'estado' && v === 'vigente')) u.set(k, String(v))
    const s = u.toString()
    return s ? `${RUTA}?${s}` : RUTA
  }

  const selector = (nombre: string, etiqueta: string, valor: string, opcionesSel: { valor: string; etiqueta: string }[], todos = 'Todos') => (
    <label className="min-w-0 text-xs text-marca-600">
      {etiqueta}
      <select name={nombre} defaultValue={valor} className="campo mt-1">
        <option value="">{todos}</option>
        {opcionesSel.map((o) => (
          <option key={o.valor} value={o.valor}>
            {o.etiqueta}
          </option>
        ))}
      </select>
    </label>
  )

  return (
    <>
      <EncabezadoPagina
        rotulo="Documentos"
        titulo="Biblioteca de documentos"
        descripcion="El inventario del SGC: código, versión, estado, proceso y alias. Busca por código (también los viejos), alias o título, sin importar tildes."
      />

      <form method="get" action={RUTA} className="tarjeta mb-4 p-4">
        <div className="flex gap-2">
          <div className="relative min-w-0 flex-1">
            <IconoBuscar className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-marca-400" />
            <input type="search" name="q" defaultValue={q} placeholder="II-32-40-009, alias o palabras del título" className="campo pl-10" aria-label="Buscar documentos" />
          </div>
          <button type="submit" className="btn-primario h-[42px] shrink-0">
            Buscar
          </button>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
          <label className="min-w-0 text-xs text-marca-600">
            Estado
            <select name="estado" defaultValue={estado} className="campo mt-1">
              <option value="todos">Todos los estados</option>
              {Object.entries(ESTADOS_DOCUMENTO).map(([v, e]) => (
                <option key={v} value={v}>
                  {e}
                </option>
              ))}
            </select>
          </label>
          {selector(
            'xx',
            'Proceso (XX)',
            xx,
            de('proceso_xx').map((o) => ({ valor: o.valor!, etiqueta: `${o.valor}${nombreXX.get(o.valor!) ? ` · ${nombreXX.get(o.valor!)}` : ''} (${o.total})` })),
          )}
          {selector(
            'yy',
            'Tipo (YY)',
            yy,
            de('tipo_yy').map((o) => ({ valor: o.valor!, etiqueta: `${o.valor}${tipos.get(o.valor!) ? ` · ${tipos.get(o.valor!)}` : ''} (${o.total})` })),
          )}
          {selector('familia', 'Familia', familia, de('familia').map((o) => ({ valor: o.valor!, etiqueta: `${o.valor} (${o.total})` })), 'Todas')}
          {vePerimetros &&
            selector(
              'perimetro',
              'Perímetro',
              perimetro,
              de('perimetro').map((o) => ({ valor: o.valor!, etiqueta: `${PERIMETROS[o.valor!] ?? o.valor} (${o.total})` })),
            )}
        </div>
        {proceso && <input type="hidden" name="proceso" value={proceso} />}
        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-marca-500">
          <span>
            {total.toLocaleString('es-VE')} {total === 1 ? 'documento' : 'documentos'}
            {estado === 'vigente' && ' vigentes'} · {totalEstados.toLocaleString('es-VE')} en el inventario que puedes ver
          </span>
          {proceso && (
            <span className="inline-flex items-center gap-1.5">
              Del proceso «{nombreProceso.get(proceso) ?? 'elegido'}»
              <Link href={enlace({ proceso: null, pagina: null })} className="text-acento-700 hover:underline">
                quitar
              </Link>
            </span>
          )}
          {(q || xx || yy || familia || perimetro || proceso || estado !== 'vigente') && (
            <Link href={RUTA} className="text-acento-700 hover:underline">
              Limpiar filtros
            </Link>
          )}
        </div>
      </form>

      {resultado.error && (
        <p role="alert" className="mb-4 rounded-xl border border-acento-200 bg-acento-50 px-4 py-3 text-sm text-acento-800">
          No se pudo buscar: {resultado.error.message}
        </p>
      )}

      <div className="tarjeta divide-y divide-[var(--borde)]">
        {filas.length === 0 ? (
          <p className="p-5 text-sm text-marca-500">Nada coincide con esa búsqueda.</p>
        ) : (
          filas.map((d) => (
            <Link key={d.id} href={`${RUTA}/${d.id}`} className="flex flex-col gap-1 px-5 py-3 hover:bg-marca-50/60 sm:flex-row sm:items-center sm:gap-4">
              <span className="w-36 shrink-0 font-mono text-xs text-marca-600">{d.codigo}</span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm text-marca-800">{d.titulo}</span>
                <span className="mt-0.5 flex flex-wrap gap-x-2 text-[11px] text-marca-500">
                  {d.tipo_yy && <span>{tipos.get(d.tipo_yy)?.split(' · ')[0] ?? `Tipo ${d.tipo_yy}`}</span>}
                  {d.version && <span>Versión {d.version}</span>}
                  {d.fecha && <span>{fecha(d.fecha)}</span>}
                  {d.proceso_ref && nombreProceso.get(d.proceso_ref) && <span>{nombreProceso.get(d.proceso_ref)}</span>}
                  {d.alias.length > 0 && <span>Alias: {d.alias.join(', ')}</span>}
                </span>
              </span>
              <span className="flex shrink-0 flex-wrap items-center gap-1.5">
                {d.datos_sensibles && (
                  <Insignia tono="ambar">
                    <IconoAlerta className="h-3 w-3" />
                    Datos sensibles
                  </Insignia>
                )}
                {d.perimetro !== 'general' && <Insignia tono="marca">{PERIMETROS[d.perimetro] ?? d.perimetro}</Insignia>}
                <Insignia tono={TONO_DOCUMENTO[d.estado] ?? 'neutro'}>{ESTADOS_DOCUMENTO[d.estado] ?? d.estado}</Insignia>
              </span>
            </Link>
          ))
        )}
      </div>

      {paginas > 1 && (
        <nav className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm" aria-label="Páginas">
          {pagina > 1 ? (
            <Link href={enlace({ pagina: pagina - 1 })} className="btn-neutro h-10">
              ← Anterior
            </Link>
          ) : (
            <span />
          )}
          <span className="text-marca-500">
            Página {pagina} de {paginas}
          </span>
          {pagina < paginas ? (
            <Link href={enlace({ pagina: pagina + 1 })} className="btn-neutro h-10">
              Siguiente →
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}
    </>
  )
}
