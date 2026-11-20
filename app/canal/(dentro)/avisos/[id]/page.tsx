import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { IconoAtras } from '@/components/iconos'
import { ETIQUETA_AVISO } from '@/components/canal/aviso-plataforma'
import { tieneFicha } from '@/components/sistema/colaboracion/abrir'
import { aNotificacion, COLUMNAS_NOTIFICACION } from '@/components/sistema/colaboracion/datos'
import { requerirEmpleado } from '@/lib/canal'
import { ETIQUETA_OBJETO, TIPO_NOTIFICACION, hrefFicha, type TipoConLinea } from '@/lib/plataforma/colaboracion'
import { fechaHora } from '@/lib/plataforma/formato'
import { createClient } from '@/lib/supabase/server'
import { cn } from '@/lib/utils'

export const metadata: Metadata = { title: 'Aviso' }

/**
 * La vista de lectura de un aviso de la plataforma, para quien no puede abrir
 * su objeto en `/sistema` (o no tiene la plataforma): qué pasó, quién y cuándo.
 * La RLS solo devuelve los avisos propios; uno ajeno es un 404.
 */
export default async function AvisoPage({ params }: PageProps<'/canal/avisos/[id]'>) {
  const [, { id }] = await Promise.all([requerirEmpleado(), params])
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound()
  const supabase = await createClient()
  const nucleo = supabase.schema('nucleo')
  const { data: fila } = await nucleo.from('notificacion').select(`${COLUMNAS_NOTIFICACION}, actor`).eq('id', id).maybeSingle()
  if (!fila) notFound()
  const aviso = aNotificacion(fila)
  const [{ data: actor }, { data: titulos }] = await Promise.all([
    fila.actor ? nucleo.rpc('nombres', { p_ids: [fila.actor] }) : Promise.resolve({ data: null }),
    aviso.objetoTipo && aviso.objetoId
      ? nucleo.rpc('titulos_objetos', { p_tipos: [aviso.objetoTipo], p_ids: [aviso.objetoId] })
      : Promise.resolve({ data: null }),
  ])
  const tipo = TIPO_NOTIFICACION[aviso.tipo] ?? TIPO_NOTIFICACION.sistema
  const objeto = titulos?.[0] ?? null
  const etiquetaObjeto = aviso.objetoTipo ? (ETIQUETA_OBJETO[aviso.objetoTipo as TipoConLinea] ?? 'Objeto') : null

  return (
    <>
      <Link href="/canal/avisos" className="mb-2 -ml-2 inline-flex min-h-11 items-center gap-1 px-2 text-sm text-marca-500 active:text-marca-800">
        <IconoAtras className="h-4 w-4" />
        Avisos
      </Link>

      <article className="tarjeta-canal px-5 py-5">
        <div className="flex items-center gap-2">
          <span aria-hidden className={cn('grid h-8 w-8 place-items-center rounded-full text-[14px] font-bold', tipo.clase)}>
            {tipo.marca}
          </span>
          <span className="text-[12px] font-semibold text-marca-600">{ETIQUETA_AVISO[aviso.tipo] ?? 'Aviso'}</span>
        </div>
        <h1 className="mt-3 text-[19px] leading-snug font-bold text-balance text-marca-900">{aviso.texto}</h1>
        {aviso.detalle && <p className="mt-2 text-[15px] leading-relaxed text-marca-700">{aviso.detalle}</p>}
        <dl className="mt-4 space-y-1.5 text-[13px]">
          {actor?.[0] && (
            <div className="flex gap-2">
              <dt className="text-marca-500">De</dt>
              <dd className="font-medium text-marca-800">{actor[0].nombre}</dd>
            </div>
          )}
          <div className="flex gap-2">
            <dt className="text-marca-500">Cuándo</dt>
            <dd className="font-medium text-marca-800 tabular-nums">{fechaHora(aviso.creadoEn)}</dd>
          </div>
          {objeto && (
            <div className="flex gap-2">
              <dt className="text-marca-500">{etiquetaObjeto}</dt>
              <dd className="font-medium text-marca-800">{objeto.titulo}</dd>
            </div>
          )}
        </dl>

        {objeto && tieneFicha(objeto.tipo) ? (
          <Link href={hrefFicha(objeto.tipo, objeto.id)} className="btn-canal btn-canal-suave mt-5 w-full">
            Abrir en la plataforma
          </Link>
        ) : aviso.objetoTipo ? (
          <p className="mt-5 rounded-xl bg-marca-50 px-3.5 py-3 text-[13px] leading-relaxed text-marca-600">
            Esto vive en la plataforma de Iberia y tu cuenta no lo abre desde aquí. Si lo necesitas, pídeselo a quien te avisó.
          </p>
        ) : null}
      </article>
    </>
  )
}
