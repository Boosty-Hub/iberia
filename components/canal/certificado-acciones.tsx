'use client'

import Link from 'next/link'
import { useState, useTransition } from 'react'
import { avanzarPaso, publicarCertificado } from '@/app/canal/(dentro)/adiestramiento/acciones'
import { Girando } from '@/components/canal/boton-sigue'
import { nombreArchivo } from '@/lib/certificado'

const IMAGEN = '/canal/adiestramiento/certificado/imagen'

/**
 * Lo que se hace con el certificado: guardarlo, mandárselo a alguien y
 * publicarlo en el canal.
 *
 * Los rótulos salen del guion (lección 8, «El certificado») y los tres hacen lo
 * que dicen: hasta el 27 de septiembre de 2026 los dos que había solo seguían la
 * lección, y debajo de «Tu certificado» no había certificado.
 *
 * Se quedan debajo del certificado aunque la lección siga —se puede guardar hoy y
 * publicarlo mañana—. En el turno que toca, el primero que salga bien sigue
 * además la lección (`turno`); en la página del certificado no hay turno.
 */
export function CertificadoAcciones({
  numero,
  turno,
  codigo,
  publicacion,
  etiquetas = ['Guardarlo', 'Mandárselo a alguien', 'Publicarlo en el canal'],
}: {
  /** La lección 8: de ahí sale la matrícula para publicar. */
  numero: number
  /** El turno de la lección, si es el que toca: la primera acción lo sigue. */
  turno: number | null
  codigo: string
  /** La publicación del canal, si ya lo publicó. */
  publicacion: string | null
  etiquetas?: string[]
}) {
  const [guardar, mandar, publicar] = etiquetas
  const [ocupado, setOcupado] = useState<'mandar' | 'publicar' | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [publicada, setPublicada] = useState(publicacion)
  const [, iniciar] = useTransition()

  /** Sigue la lección, una vez, si este es el turno que toca. */
  function seguir() {
    if (turno === null) return
    const datos = new FormData()
    datos.set('numero', String(numero))
    datos.set('turno', String(turno))
    iniciar(() => avanzarPaso(datos))
  }

  /**
   * «Mandárselo a alguien»: el compartir del teléfono, con la imagen adentro —de
   * ahí se va por WhatsApp—. Un enlace no serviría: la imagen pide sesión, y quien
   * lo reciba no la tiene. Donde el navegador no deja compartir archivos, se baja
   * y se le dice que lo mande desde la galería.
   */
  async function mandarlo() {
    setOcupado('mandar')
    setAviso(null)
    try {
      const respuesta = await fetch(IMAGEN)
      if (!respuesta.ok) throw new Error(String(respuesta.status))
      const archivo = new File([await respuesta.blob()], nombreArchivo(codigo), { type: 'image/png' })

      if (navigator.canShare?.({ files: [archivo] })) {
        try {
          await navigator.share({
            files: [archivo],
            title: 'Mi certificado',
            text: 'Terminé el curso de Ajito, de Industrias Iberia.',
          })
          seguir()
        } catch (error) {
          // Cerró el compartir sin mandar nada: no es un fallo, y no se sigue.
          if ((error as Error).name !== 'AbortError') throw error
        }
      } else {
        const enlace = document.createElement('a')
        enlace.href = URL.createObjectURL(archivo)
        enlace.download = archivo.name
        enlace.click()
        setTimeout(() => URL.revokeObjectURL(enlace.href), 10_000)
        setAviso('Desde aquí no se puede mandar directo: ya se bajó, mándalo desde tu galería.')
        seguir()
      }
    } catch {
      setAviso('No se pudo preparar la imagen. Intenta otra vez.')
    } finally {
      setOcupado(null)
    }
  }

  function publicarlo() {
    setOcupado('publicar')
    setAviso(null)
    const datos = new FormData()
    datos.set('numero', String(numero))
    if (turno !== null) datos.set('turno', String(turno))
    iniciar(async () => {
      const { ok, id } = await publicarCertificado(datos)
      setOcupado(null)
      if (ok && id) setPublicada(id)
      else setAviso('No se pudo publicar. Intenta otra vez.')
    })
  }

  return (
    <div className="space-y-2" data-certificado-acciones>
      <div className="flex flex-wrap gap-2">
        {/* Un enlace de verdad, con el archivo detrás: el navegador lo guarda
            solo, sin JavaScript de por medio que un teléfono viejo no corra. */}
        <a
          href={`${IMAGEN}?descargar`}
          download={nombreArchivo(codigo)}
          onClick={() => seguir()}
          className="btn-canal btn-canal-rojo min-w-[45%] flex-1"
        >
          {guardar}
        </a>
        <button
          type="button"
          onClick={() => void mandarlo()}
          disabled={ocupado !== null}
          aria-busy={ocupado === 'mandar'}
          className="btn-canal btn-canal-suave min-w-[45%] flex-1"
        >
          {ocupado === 'mandar' && <Girando />}
          {mandar}
        </button>
      </div>

      {publicada ? (
        <Link
          data-publicado
          href={`/canal/publicacion/${publicada}`}
          className="toque w-full justify-between rounded-xl bg-oro-300/25 px-4 text-[14px] font-medium text-marca-800 active:bg-oro-300/40"
        >
          <span>Está en el canal, en «Nuestra gente»</span>
          <span className="underline underline-offset-4">Verlo</span>
        </Link>
      ) : (
        <button
          type="button"
          onClick={publicarlo}
          disabled={ocupado !== null}
          aria-busy={ocupado === 'publicar'}
          className="btn-canal btn-canal-oro w-full"
        >
          {ocupado === 'publicar' && <Girando />}
          {ocupado === 'publicar' ? 'Publicándolo…' : publicar}
        </button>
      )}

      {!publicada && (
        <p className="px-1 text-[13px] leading-relaxed text-marca-400">
          En el canal sale sin tu cédula.
        </p>
      )}

      {aviso && (
        <p className="rounded-xl bg-oro-300/25 px-3 py-2 text-[13px] leading-relaxed text-marca-700">
          {aviso}
        </p>
      )}
    </div>
  )
}
