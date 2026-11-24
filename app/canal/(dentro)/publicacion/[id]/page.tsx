import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { IconoAtras, IconoOficial } from '@/components/iconos'
import { Markdown } from '@/components/markdown'
import { MenuModeracion } from '@/components/canal/menu-moderacion'
import { RegistrarLectura } from '@/components/canal/registrar-lectura'
import {
  TIPOS_PUBLICACION,
  haceCuanto,
  iniciales,
  requerirEmpleado,
  type TipoPublicacion,
} from '@/lib/canal'
import { createClient } from '@/lib/supabase/server'
import { legible } from '@/lib/certificado'
import { obtenerSesion, puede } from '@/lib/auth'
import { Comentarios } from './comentarios'

export async function generateMetadata({
  params,
}: PageProps<'/canal/publicacion/[id]'>): Promise<Metadata> {
  const { id } = await params
  const supabase = await createClient()
  const { data } = await supabase
    .from('publicaciones')
    .select('titulo')
    .eq('id', id)
    .maybeSingle()
  return { title: data?.titulo ?? 'Publicación' }
}

export default async function PublicacionPage({
  params,
}: PageProps<'/canal/publicacion/[id]'>) {
  const [empleado, { id }, sesion] = await Promise.all([requerirEmpleado(), params, obtenerSesion()])
  const supabase = await createClient()
  const ahora = new Date()

  const { data: publicacion } = await supabase
    .from('publicaciones')
    .select('*, empleados(nombre_completo, cargo)')
    .eq('id', id)
    .maybeSingle()

  if (!publicacion) notFound()

  const tipo = publicacion.tipo as TipoPublicacion

  return (
    <>
      {/* Registra la apertura: es lo que convierte el alcance en un dato. */}
      <RegistrarLectura publicacionId={publicacion.id} empleadoId={empleado.id} />

      <Link
        href="/canal"
        className="mb-2 -ml-2 inline-flex min-h-11 items-center gap-1 px-2 text-sm text-marca-500 active:text-marca-800"
      >
        <IconoAtras className="h-4 w-4" />
        Inicio
      </Link>

      <article className="tarjeta-canal overflow-hidden">
        {publicacion.imagen_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={publicacion.imagen_url}
            alt=""
            // El escudo y el certificado del adiestramiento van completos: ver
            // `TarjetaPublicacion`.
            className={
              publicacion.certificado_id
                ? 'aspect-[3/4] w-full bg-white object-contain'
                : publicacion.respuesta_id
                  ? 'aspect-square w-full bg-white object-contain'
                  : 'h-52 w-full object-cover'
            }
          />
        )}

        <div className="p-5">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            {publicacion.oficial && (
              <span className="chip bg-oro-300 text-marca-900">
                <IconoOficial className="h-3.5 w-3.5" />
                Comunicado oficial
              </span>
            )}
            <span className="chip bg-marca-100 text-marca-700">
              {TIPOS_PUBLICACION[tipo] ?? tipo}
            </span>
          </div>

          <h1 className="text-[24px] leading-tight font-bold tracking-tight text-marca-900">
            {publicacion.titulo}
          </h1>

          {publicacion.bajada && (
            <p className="mt-2 text-[16px] leading-relaxed text-marca-600">
              {publicacion.bajada}
            </p>
          )}

          <div className="mt-4 flex items-center gap-2.5 border-y border-marca-100 py-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-marca-100 text-xs font-bold text-marca-700">
              {iniciales(publicacion.empleados?.nombre_completo ?? 'Iberia')}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-marca-800">
                {publicacion.empleados?.nombre_completo ?? 'Industrias Iberia'}
              </p>
              <p className="truncate text-xs text-marca-500">
                {publicacion.empleados?.cargo ? legible(publicacion.empleados.cargo) : 'Comunicación interna'}
              </p>
            </div>
            <span className="shrink-0 text-xs text-marca-400">
              {haceCuanto(publicacion.publicado_en, ahora)}
            </span>
            {/* Reportar, y bloquear a quien la escribió. Un comunicado oficial se
                reporta pero no se bloquea: se sigue viendo siempre. */}
            {publicacion.autor_id !== empleado.id && (
              <MenuModeracion
                etiqueta="Opciones de la publicación"
                contenido={{ tipo: 'publicacion', id: publicacion.id }}
                persona={
                  publicacion.autor_id && publicacion.empleados && !publicacion.oficial
                    ? {
                        id: publicacion.autor_id,
                        nombre: publicacion.empleados.nombre_completo,
                        bloqueada: false,
                      }
                    : undefined
                }
                className="-mr-2"
              />
            )}
          </div>

          {publicacion.cuerpo_md && (
            <Markdown contenido={publicacion.cuerpo_md} className="mt-4 text-[16px]" />
          )}
        </div>
      </article>

      {publicacion.permite_comentarios && publicacion.estado === 'publicado' ? (
        <Comentarios
          publicacionId={publicacion.id}
          yo={{ id: empleado.id }}
          modero={empleado.puede_publicar || empleado.es_moderador || puede(sesion, 'modulo:reportes', 'editar')}
        />
      ) : (
        <p className="mt-3 px-1 text-center text-[12px] text-marca-400">Esta publicación no recibe comentarios.</p>
      )}
    </>
  )
}
