import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { IconoAtras, IconoOficial } from '@/components/iconos'
import { AUDIENCIAS, TIPOS_PUBLICACION, requerirEmpleado } from '@/lib/canal'
import { createClient } from '@/lib/supabase/server'
import { publicar } from './acciones'

export const metadata: Metadata = { title: 'Publicar' }

const CAMPO =
  'w-full rounded-xl border border-marca-200 bg-white px-3.5 py-2.5 text-[15px] text-marca-900 placeholder:text-marca-400 focus:border-acento-400 focus:ring-2 focus:ring-acento-100 focus:outline-none'

export default async function PublicarPage() {
  const yo = await requerirEmpleado()
  if (!yo.puede_publicar && !yo.es_moderador) redirect('/canal')

  const supabase = await createClient()
  const { data: areas } = await supabase.from('areas').select('id, nombre').order('nombre')

  const puedeMarcarOficial = yo.nivel === 'direccion' || yo.es_moderador

  return (
    <>
      <Link
        href="/canal"
        className="mb-2 -ml-2 inline-flex min-h-11 items-center gap-1 px-2 text-sm text-marca-500 active:text-marca-800"
      >
        <IconoAtras className="h-4 w-4" />
        Inicio
      </Link>

      <h1 className="mb-4 text-[22px] leading-tight font-bold tracking-tight text-marca-900">
        Publicar en el canal
      </h1>

      <form action={publicar} className="space-y-4">
        <div className="tarjeta-canal space-y-3 p-4">
          <div>
            <label htmlFor="tipo" className="mb-1 block text-[13px] font-medium text-marca-600">
              Tipo
            </label>
            <select id="tipo" name="tipo" defaultValue="noticia" className={CAMPO}>
              {Object.entries(TIPOS_PUBLICACION).map(([valor, etiqueta]) => (
                <option key={valor} value={valor}>
                  {etiqueta}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="titulo" className="mb-1 block text-[13px] font-medium text-marca-600">
              Título
            </label>
            <input
              id="titulo"
              name="titulo"
              required
              maxLength={200}
              placeholder="Lo que la gente va a leer primero"
              className={CAMPO}
            />
          </div>

          <div>
            <label htmlFor="bajada" className="mb-1 block text-[13px] font-medium text-marca-600">
              Entrada
            </label>
            <textarea
              id="bajada"
              name="bajada"
              rows={2}
              maxLength={400}
              placeholder="Dos líneas que resuman de qué se trata"
              className={CAMPO}
            />
            <p className="mt-1 text-[12px] text-marca-400">
              Es lo único que se ve en el feed. Si esto no se entiende, no se abre.
            </p>
          </div>

          <div>
            <label htmlFor="cuerpo" className="mb-1 block text-[13px] font-medium text-marca-600">
              Contenido
            </label>
            <textarea
              id="cuerpo"
              name="cuerpo"
              rows={9}
              placeholder="El texto completo"
              className={CAMPO}
            />
          </div>
        </div>

        <div className="tarjeta-canal space-y-3 p-4">
          <div>
            <label
              htmlFor="audiencia"
              className="mb-1 block text-[13px] font-medium text-marca-600"
            >
              Para quién
            </label>
            <select id="audiencia" name="audiencia" defaultValue="todos" className={CAMPO}>
              {Object.entries(AUDIENCIAS).map(([valor, etiqueta]) => (
                <option key={valor} value={valor}>
                  {etiqueta}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="audiencia_area_id"
              className="mb-1 block text-[13px] font-medium text-marca-600"
            >
              Área
            </label>
            <select id="audiencia_area_id" name="audiencia_area_id" defaultValue="" className={CAMPO}>
              <option value="">—</option>
              {(areas ?? []).map((a) => (
                <option key={a.id} value={a.id}>
                  {a.nombre}
                </option>
              ))}
            </select>
            <p className="mt-1 text-[12px] text-marca-400">
              Solo cuenta si arriba elegiste «Un área específica».
            </p>
          </div>

          {puedeMarcarOficial && (
            <div className="space-y-2 rounded-xl bg-oro-50 p-3">
              <label className="flex items-start gap-2.5">
                <input
                  type="checkbox"
                  name="oficial"
                  value="si"
                  className="mt-0.5 h-5 w-5 shrink-0 rounded border-marca-300 text-acento-600 focus:ring-acento-500"
                />
                <span className="text-[14px] leading-snug text-marca-800">
                  <span className="inline-flex items-center gap-1 font-semibold">
                    <IconoOficial className="h-4 w-4" />
                    Comunicado oficial
                  </span>
                  <br />
                  <span className="text-marca-500">
                    Habla en nombre de la empresa. Se marca con la banda dorada.
                  </span>
                </span>
              </label>
              <label className="flex items-start gap-2.5">
                <input
                  type="checkbox"
                  name="fijado"
                  value="si"
                  className="mt-0.5 h-5 w-5 shrink-0 rounded border-marca-300 text-acento-600 focus:ring-acento-500"
                />
                <span className="text-[14px] leading-snug text-marca-800">
                  Fijar arriba del feed
                  <br />
                  <span className="text-marca-500">Solo aplica a comunicados oficiales.</span>
                </span>
              </label>
            </div>
          )}
        </div>

        <div className="tarjeta-canal p-4">
          <h2 className="text-[13px] font-semibold text-marca-700">Envío por WhatsApp</h2>
          <p className="mt-1.5 text-[13px] leading-relaxed text-marca-500">
            El envío masivo del enlace personal a las 280 personas se activa
            cuando esté conectada la cuenta de WhatsApp Business de Iberia.
            Todavía no está: lo que se publique aquí se ve en el canal.
          </p>
        </div>

        <button type="submit" className="btn-canal btn-canal-rojo w-full">
          Publicar
        </button>
      </form>
    </>
  )
}
