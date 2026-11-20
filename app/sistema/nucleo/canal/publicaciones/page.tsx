import type { Metadata } from 'next'
import Link from 'next/link'
import { puede, requerirPermiso } from '@/lib/auth'
import { legible } from '@/lib/certificado'
import { AUDIENCIAS, TIPOS_PUBLICACION, type Audiencia, type TipoPublicacion } from '@/lib/canal'
import { createClient } from '@/lib/supabase/server'
import { leerContexto } from '@/lib/plataforma/servidor'
import { KpiMetrica } from '@/lib/plataforma/metricas'
import { fechaHora, numero } from '@/lib/plataforma/formato'
import { CabeceraModulo } from '@/components/sistema/ui/cabecera-modulo'
import { Segmentos } from '@/components/sistema/procesos/piezas-r2'
import { cn } from '@/lib/utils'
import { autorizarPersona, moderarPublicacion } from '../acciones'

export const metadata: Metadata = { title: 'Publicaciones · Canal' }

const RUTA = '/sistema/nucleo/canal/publicaciones'
const BOTON = 'inline-flex min-h-7 items-center rounded-md border border-[var(--borde)] bg-white px-2 text-[11.5px] font-medium text-marca-800 hover:bg-marca-50 focus-visible:outline-2 focus-visible:outline-acento-500'
const BOTON_PELIGRO = 'inline-flex min-h-7 items-center rounded-md border border-acento-200 bg-white px-2 text-[11.5px] font-semibold text-acento-700 hover:bg-acento-50 focus-visible:outline-2 focus-visible:outline-acento-500'
const ESTADOS = { publicado: 'Publicadas', archivado: 'Archivadas', borrador: 'Borradores', oficial: 'Oficiales' } as const
type Vista = keyof typeof ESTADOS

type Publicacion = {
  id: string
  tipo: string
  titulo: string
  autor: string | null
  autor_cargo: string | null
  estado: string
  oficial: boolean
  fijado: boolean
  audiencia: string
  area: string | null
  publicado_en: string | null
  creado_en: string
  lecturas: number
  reacciones: number
  comentarios: number
  reportes_abiertos: number
}

/**
 * El feed del canal visto por quien lo administra: todo lo publicado, archivado
 * o en borrador, con sus lecturas (el alcance medido) y sus reportes abiertos.
 * Archivar no borra: se restaura. Abajo, quién publica en nombre de la
 * organización y quién modera (`empleados.puede_publicar` / `es_moderador`).
 */
export default async function PublicacionesCanalPage({ searchParams }: PageProps<'/sistema/nucleo/canal/publicaciones'>) {
  const [sesion, sp] = await Promise.all([requerirPermiso('modulo:reportes'), searchParams])
  const ctx = await leerContexto(sp)
  const vista: Vista = typeof sp.estado === 'string' && sp.estado in ESTADOS ? (sp.estado as Vista) : 'publicado'
  const q = typeof sp.q === 'string' ? sp.q.trim().slice(0, 60) : ''
  const puedeEditar = puede(sesion, 'modulo:reportes', 'editar')

  const supabase = await createClient()
  const [{ data, error }, { data: autorizadas }, { data: candidatas }] = await Promise.all([
    supabase.schema('ui').rpc('canal_publicaciones'),
    supabase
      .from('empleados')
      .select('id, nombre_completo, cargo, puede_publicar, es_moderador')
      .eq('activo', true)
      .or('puede_publicar.eq.true,es_moderador.eq.true')
      .order('nombre_completo')
      .range(0, 199),
    q.length >= 2
      ? supabase
          .from('empleados')
          .select('id, nombre_completo, cargo, puede_publicar, es_moderador')
          .eq('activo', true)
          .or(`nombre_completo.ilike.%${q.replace(/[%,()]/g, '')}%,cargo.ilike.%${q.replace(/[%,()]/g, '')}%`)
          .order('nombre_completo')
          .range(0, 11)
      : Promise.resolve({ data: null }),
  ])
  const todas = (data ?? []) as Publicacion[]
  const cuenta = (v: Vista) => todas.filter((p) => (v === 'oficial' ? p.oficial : p.estado === v)).length
  const filas = todas.filter((p) => (vista === 'oficial' ? p.oficial : p.estado === vista))
  const volver = `${RUTA}?estado=${vista}`

  return (
    <>
      <CabeceraModulo
        sesion={sesion}
        codigo="NUC-CAN"
        titulo="Canal"
        migas={[{ etiqueta: 'Publicaciones' }]}
        descripcion="El feed de la app: comunicados, noticias e historias de la gente. Lo oficial se ve siempre, aunque alguien haya bloqueado a quien lo firma."
        acciones={
          puede(sesion, 'modulo:canal') ? (
            <Link href="/canal/publicar" className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#2b2a28] px-3 text-xs font-semibold text-white hover:bg-marca-700">
              Publicar desde la app
            </Link>
          ) : null
        }
      />

      {(sp.aviso === 'error' || error) && (
        <p role="alert" className="mb-3 rounded-xl border border-acento-200 bg-acento-50 px-3.5 py-2.5 text-[12.5px] text-acento-800">
          {error ? 'No se pudo leer el feed.' : 'No se pudo guardar el cambio. Inténtalo otra vez.'}
        </p>
      )}

      <div className="mb-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiMetrica clave="canal_publicaciones_mes" ctx={ctx} sesion={sesion} />
        <KpiMetrica clave="canal_publicaciones_mes" ctx={ctx} sesion={sesion} parte={{ detalle: 'lecturas', titulo: 'Lecturas del mes', texto: 'Aperturas de las publicaciones del mes' }} />
        <KpiMetrica clave="canal_publicaciones_mes" ctx={ctx} sesion={sesion} parte={{ detalle: 'oficiales', titulo: 'Oficiales del mes', texto: 'Comunicados oficiales publicados', href: `${RUTA}?estado=oficial` }} />
      </div>

      <Segmentos
        etiqueta="Qué publicaciones ver"
        activa={vista}
        opciones={(Object.keys(ESTADOS) as Vista[]).map((v) => ({ valor: v, etiqueta: ESTADOS[v], href: `${RUTA}?estado=${v}`, n: cuenta(v) }))}
      />

      <section className="mb-5 overflow-x-auto rounded-xl border border-[var(--borde)] bg-white">
        {filas.length === 0 ? (
          <p className="px-4 py-8 text-center text-[12.5px] text-marca-500">No hay publicaciones en esta vista.</p>
        ) : (
          <table className="w-full min-w-[760px] text-left text-[12.5px]">
            <caption className="sr-only">{ESTADOS[vista]} del canal</caption>
            <thead className="border-b border-[var(--borde)] bg-[#fafafa] text-[11.5px] text-marca-600">
              <tr>
                <th scope="col" className="px-3 py-2 font-semibold">Publicación</th>
                <th scope="col" className="px-3 py-2 font-semibold">Para</th>
                <th scope="col" className="px-3 py-2 font-semibold">Fecha</th>
                <th scope="col" className="px-3 py-2 text-right font-semibold">Lecturas</th>
                <th scope="col" className="px-3 py-2 text-right font-semibold">Reacciones</th>
                <th scope="col" className="px-3 py-2 text-right font-semibold">Reportes</th>
                {puedeEditar && <th scope="col" className="px-3 py-2 font-semibold">Acciones</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#eef0f3]">
              {filas.map((p) => (
                <tr key={p.id} className="align-top">
                  <td className="max-w-[340px] px-3 py-2">
                    <div className="flex flex-wrap items-center gap-1">
                      {p.oficial && <span className="rounded-full bg-oro-200 px-1.5 py-0.5 text-[10.5px] font-bold text-marca-900">Oficial</span>}
                      {p.fijado && <span className="rounded-full bg-[#eef0f3] px-1.5 py-0.5 text-[10.5px] font-semibold text-marca-700">Fijada</span>}
                      <span className="text-[11px] text-marca-500">{TIPOS_PUBLICACION[p.tipo as TipoPublicacion] ?? p.tipo}</span>
                    </div>
                    {p.estado === 'publicado' ? (
                      <Link href={`/canal/publicacion/${p.id}`} className="mt-0.5 block font-semibold text-marca-900 hover:underline">
                        {p.titulo}
                      </Link>
                    ) : (
                      <span className="mt-0.5 block font-semibold text-marca-900">{p.titulo}</span>
                    )}
                    <span className="block text-[11.5px] text-marca-500">
                      {p.autor ? `${p.autor}${p.autor_cargo ? ` · ${legible(p.autor_cargo)}` : ''}` : 'La empresa'}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-marca-700">{p.audiencia === 'area' && p.area ? p.area : (AUDIENCIAS[p.audiencia as Audiencia] ?? p.audiencia)}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-marca-700 tabular-nums">{fechaHora(p.publicado_en ?? p.creado_en)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{numero(p.lecturas)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{numero(p.reacciones)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {p.reportes_abiertos ? (
                      <Link href="/sistema/nucleo/canal/moderacion" className="font-semibold text-acento-700 hover:underline">
                        {numero(p.reportes_abiertos)}
                      </Link>
                    ) : (
                      '0'
                    )}
                  </td>
                  {puedeEditar && (
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-1">
                        {p.estado === 'publicado' && <Accion id={p.id} accion="archivar" volver={volver} peligro etiqueta="Archivar" titulo={p.titulo} />}
                        {p.estado === 'archivado' && <Accion id={p.id} accion="restaurar" volver={volver} etiqueta="Restaurar" titulo={p.titulo} />}
                        <Accion id={p.id} accion={p.fijado ? 'soltar' : 'fijar'} volver={volver} etiqueta={p.fijado ? 'Soltar' : 'Fijar arriba'} titulo={p.titulo} />
                        <Accion id={p.id} accion={p.oficial ? 'no_oficial' : 'oficial'} volver={volver} etiqueta={p.oficial ? 'Quitar oficial' : 'Marcar oficial'} titulo={p.titulo} />
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section aria-labelledby="quien-publica" className="rounded-xl border border-[var(--borde)] bg-white p-3.5">
        <h2 id="quien-publica" className="text-[13px] font-semibold text-marca-900">
          Quién publica y quién modera
        </h2>
        <p className="mt-0.5 max-w-3xl text-[12px] text-marca-500">
          Publicar en el feed es de pocos: llega a toda la organización. Moderar deja además ver los borradores y ocultar comentarios desde la app. El equipo editor publica sin necesidad de marcarlo.
        </p>
        <ul className="mt-2.5 divide-y divide-[#eef0f3]">
          {(autorizadas ?? []).map((e) => (
            <FilaPersona key={e.id} e={e} editar={puedeEditar} volver={volver} />
          ))}
          {!(autorizadas ?? []).length && <li className="py-2 text-[12px] text-marca-500">Nadie del padrón tiene permiso de publicar todavía.</li>}
        </ul>

        {puedeEditar && (
          <div className="mt-3 border-t border-[var(--borde)] pt-3">
            <form method="get" action={RUTA} className="flex flex-wrap items-end gap-2">
              <input type="hidden" name="estado" value={vista} />
              <label className="flex min-w-[240px] flex-1 flex-col gap-1 text-[12px] font-medium text-marca-700">
                Buscar a alguien del padrón para darle permiso
                <input name="q" defaultValue={q} placeholder="Nombre o cargo" className="h-8 rounded-lg border border-[var(--borde)] px-2.5 text-[12.5px]" />
              </label>
              <button type="submit" className="inline-flex h-8 items-center rounded-lg border border-[var(--borde)] bg-white px-3 text-xs font-medium text-marca-800 hover:bg-marca-50">
                Buscar
              </button>
            </form>
            {candidatas && (
              <ul className="mt-2 divide-y divide-[#eef0f3]">
                {candidatas.map((e) => (
                  <FilaPersona key={e.id} e={e} editar volver={`${volver}&q=${encodeURIComponent(q)}`} />
                ))}
                {!candidatas.length && <li className="py-2 text-[12px] text-marca-500">Nadie coincide con «{q}».</li>}
              </ul>
            )}
          </div>
        )}
      </section>
    </>
  )
}

function Accion({ id, accion, volver, etiqueta, titulo, peligro }: { id: string; accion: string; volver: string; etiqueta: string; titulo: string; peligro?: boolean }) {
  return (
    <form action={moderarPublicacion}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="accion" value={accion} />
      <input type="hidden" name="volver" value={volver} />
      <button type="submit" className={peligro ? BOTON_PELIGRO : BOTON} title={`${etiqueta}: ${titulo}`}>
        {etiqueta}
      </button>
    </form>
  )
}

function FilaPersona({
  e,
  editar,
  volver,
}: {
  e: { id: string; nombre_completo: string; cargo: string | null; puede_publicar: boolean; es_moderador: boolean }
  editar: boolean
  volver: string
}) {
  const insignia = (si: boolean, texto: string) => (
    <span className={cn('rounded-full px-1.5 py-0.5 text-[10.5px] font-semibold', si ? 'bg-[#e7f5ee] text-[#1f6f4b]' : 'bg-[#eef0f3] text-marca-500')}>
      {si ? '✓' : '–'} {texto}
    </span>
  )
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[12.5px] font-semibold text-marca-900">{e.nombre_completo}</span>
        <span className="block truncate text-[11.5px] text-marca-500">{e.cargo ? legible(e.cargo) : 'Sin cargo en el padrón'}</span>
      </span>
      {insignia(e.puede_publicar, 'Publica')}
      {insignia(e.es_moderador, 'Modera')}
      {editar && (
        <span className="flex gap-1">
          <form action={autorizarPersona}>
            <input type="hidden" name="empleado" value={e.id} />
            <input type="hidden" name="publica" value={e.puede_publicar ? 'no' : 'si'} />
            <input type="hidden" name="volver" value={volver} />
            <button type="submit" className={BOTON}>
              {e.puede_publicar ? 'Quitar publicar' : 'Dar publicar'}
            </button>
          </form>
          <form action={autorizarPersona}>
            <input type="hidden" name="empleado" value={e.id} />
            <input type="hidden" name="modera" value={e.es_moderador ? 'no' : 'si'} />
            <input type="hidden" name="volver" value={volver} />
            <button type="submit" className={BOTON}>
              {e.es_moderador ? 'Quitar moderar' : 'Dar moderar'}
            </button>
          </form>
        </span>
      )}
    </li>
  )
}
