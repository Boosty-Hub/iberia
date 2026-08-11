import type { Metadata } from 'next'
import Link from 'next/link'
import { IconoEditar, IconoMas, IconoVerInforme } from '@/components/iconos'
import { EncabezadoPagina, Insignia } from '@/components/ui'
import { esEditor, requerirSesion } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { formatFecha } from '@/lib/utils'
import { PARTES_INFORME, PARTES_INFORME_ORDEN, type ParteInforme } from '@/lib/types'
import { alternarPublicacion } from './acciones'

export const metadata: Metadata = { title: 'Editor del informe' }

export default async function EditorInformePage() {
  const { perfil } = await requerirSesion()
  const puedeEditar = esEditor(perfil)
  const supabase = await createClient()

  const { data: secciones } = await supabase
    .from('informe_secciones')
    .select('id, slug, numero, titulo, subtitulo, parte, orden, publicado, contenido_md, updated_at')
    .order('orden')

  const todas = secciones ?? []
  const publicadas = todas.filter((s) => s.publicado).length
  const conContenido = todas.filter((s) => s.contenido_md?.trim()).length

  return (
    <>
      <EncabezadoPagina
        rotulo="Entregable de cierre · Fase 1"
        titulo="Editor del informe"
        descripcion="El Documento de Arquitectura de IA se escribe aquí, sección por sección. Lo que publiques queda visible para los lectores de Iberia en la página del informe."
        acciones={
          <>
            <Link href="/informe" className="btn-neutro">
              <IconoVerInforme className="h-4 w-4" />
              Ver el informe
            </Link>
            {puedeEditar && (
              <Link href="/dashboard/informe/nueva" className="btn-acento">
                <IconoMas className="h-4 w-4" />
                Nueva sección
              </Link>
            )}
          </>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <div className="tarjeta p-4">
          <p className="text-2xl font-bold text-marca-800">{todas.length}</p>
          <p className="mt-0.5 text-xs tracking-wide text-marca-500 uppercase">Secciones</p>
        </div>
        <div className="tarjeta p-4">
          <p className="text-2xl font-bold text-marca-800">{conContenido}</p>
          <p className="mt-0.5 text-xs tracking-wide text-marca-500 uppercase">Con contenido</p>
        </div>
        <div className="tarjeta p-4">
          <p className="text-2xl font-bold text-marca-800">{publicadas}</p>
          <p className="mt-0.5 text-xs tracking-wide text-marca-500 uppercase">Publicadas</p>
        </div>
      </div>

      {PARTES_INFORME_ORDEN.map((parte) => {
        const delParte = todas.filter((s) => s.parte === parte)
        if (delParte.length === 0) return null

        return (
          <section key={parte} className="mb-8">
            <h2 className="rotulo mb-3">{PARTES_INFORME[parte as ParteInforme]}</h2>

            <ul className="grid gap-2">
              {delParte.map((s) => {
                const vacia = !s.contenido_md?.trim()

                return (
                  <li key={s.id} className="tarjeta flex flex-wrap items-center gap-4 p-4">
                    <span className="w-8 shrink-0 font-mono text-xs text-marca-400">
                      {s.numero ?? '—'}
                    </span>

                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-marca-800">{s.titulo}</p>
                      {s.subtitulo && (
                        <p className="truncate text-sm text-marca-500">{s.subtitulo}</p>
                      )}
                      <p className="mt-1 text-xs text-marca-400">
                        Actualizada {formatFecha(s.updated_at)}
                      </p>
                    </div>

                    <div className="flex shrink-0 flex-wrap items-center gap-2">
                      {vacia ? (
                        <Insignia tono="neutro">Vacía</Insignia>
                      ) : s.publicado ? (
                        <Insignia tono="verde">Publicada</Insignia>
                      ) : (
                        <Insignia tono="ambar">Borrador</Insignia>
                      )}

                      {puedeEditar && (
                        <>
                          <form action={alternarPublicacion}>
                            <input type="hidden" name="id" value={s.id} />
                            <button
                              type="submit"
                              className="btn-neutro px-2.5 py-1 text-xs"
                              disabled={vacia && !s.publicado}
                              title={
                                vacia && !s.publicado
                                  ? 'Escribe contenido antes de publicar'
                                  : s.publicado
                                    ? 'Quitar de la vista de Iberia'
                                    : 'Publicar para Iberia'
                              }
                            >
                              {s.publicado ? 'Despublicar' : 'Publicar'}
                            </button>
                          </form>

                          <Link
                            href={`/dashboard/informe/${s.slug}`}
                            className="btn-neutro px-2.5 py-1 text-xs"
                          >
                            <IconoEditar className="h-3.5 w-3.5" />
                            Editar
                          </Link>
                        </>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          </section>
        )
      })}
    </>
  )
}
