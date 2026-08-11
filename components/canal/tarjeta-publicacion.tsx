import Link from 'next/link'
import { IconoChat, IconoOficial } from '@/components/iconos'
import {
  TIPOS_PUBLICACION,
  haceCuanto,
  iniciales,
  type TipoPublicacion,
} from '@/lib/canal'
import { cn } from '@/lib/utils'

export type PublicacionFeed = {
  id: string
  tipo: string
  titulo: string
  bajada: string | null
  imagen_url: string | null
  oficial: boolean
  fijado: boolean
  publicado_en: string | null
  empleados: { nombre_completo: string; cargo: string | null } | null
  comentarios?: { count: number }[]
  reacciones?: { count: number }[]
}

/** Cada tipo lleva su color, para que el feed se lea de un vistazo. */
const TONO_TIPO: Record<TipoPublicacion, string> = {
  comunicado: 'bg-acento-50 text-acento-800',
  noticia: 'bg-marca-100 text-marca-700',
  nuestra_gente: 'bg-oro-100 text-oro-800',
  evento: 'bg-emerald-50 text-emerald-800',
  hito_ia: 'bg-acento-50 text-acento-800',
  formacion: 'bg-oro-100 text-oro-800',
}

export function TarjetaPublicacion({
  publicacion,
  ahora,
}: {
  publicacion: PublicacionFeed
  ahora: Date
}) {
  const tipo = publicacion.tipo as TipoPublicacion
  const comentarios = publicacion.comentarios?.[0]?.count ?? 0
  const reacciones = publicacion.reacciones?.[0]?.count ?? 0

  return (
    <article
      className={cn(
        'tarjeta-canal overflow-hidden',
        // Un comunicado oficial se distingue por una banda dorada al borde:
        // es la voz de la empresa, no una publicación más del feed.
        publicacion.oficial && 'border-l-[3px] border-l-oro-300'
      )}
    >
      <Link href={`/canal/publicacion/${publicacion.id}`} className="block active:bg-marca-50/60">
        {/* Las imágenes las sube Comunicaciones a Storage: no hay dominios
            fijos que declarar, así que no pasan por next/image. */}
        {publicacion.imagen_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={publicacion.imagen_url}
            alt=""
            className="h-44 w-full object-cover"
            loading="lazy"
          />
        )}

        <div className="p-4">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            {publicacion.oficial && (
              <span className="chip bg-oro-300 text-marca-900">
                <IconoOficial className="h-3.5 w-3.5" />
                Oficial
              </span>
            )}
            <span className={cn('chip', TONO_TIPO[tipo] ?? 'bg-marca-100 text-marca-700')}>
              {TIPOS_PUBLICACION[tipo] ?? tipo}
            </span>
            {publicacion.fijado && (
              <span className="chip bg-marca-100 text-marca-600">Fijado</span>
            )}
          </div>

          <h2 className="text-[17px] leading-snug font-bold text-marca-900">
            {publicacion.titulo}
          </h2>

          {publicacion.bajada && (
            <p className="mt-1.5 line-clamp-3 text-[15px] leading-relaxed text-marca-600">
              {publicacion.bajada}
            </p>
          )}

          <div className="mt-3 flex items-center gap-2 border-t border-marca-100 pt-3">
            {publicacion.empleados && (
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-marca-100 text-[10px] font-bold text-marca-700">
                {iniciales(publicacion.empleados.nombre_completo)}
              </span>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-marca-700">
                {publicacion.empleados?.nombre_completo ?? 'Industrias Iberia'}
              </p>
              <p className="truncate text-[11px] text-marca-400">
                {publicacion.empleados?.cargo ?? 'Comunicación interna'}
              </p>
            </div>
            <span className="shrink-0 text-[11px] text-marca-400">
              {haceCuanto(publicacion.publicado_en, ahora)}
            </span>
          </div>

          {(comentarios > 0 || reacciones > 0) && (
            <div className="mt-2 flex items-center gap-4 text-[11px] text-marca-500">
              {reacciones > 0 && <span>{reacciones} reacciones</span>}
              {comentarios > 0 && (
                <span className="inline-flex items-center gap-1">
                  <IconoChat className="h-3.5 w-3.5" />
                  {comentarios}
                </span>
              )}
            </div>
          )}
        </div>
      </Link>
    </article>
  )
}
