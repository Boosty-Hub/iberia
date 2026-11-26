import Link from 'next/link'
import type { ReactNode } from 'react'
import { puede, type Sesion } from '@/lib/auth'
import { DOMINIOS, ESTADO_MODULO, MODULOS_INTERFAZ, PESTANAS, dominioDe, type Pestana } from '@/lib/plataforma/dominios'
import { modulosDelPlan } from '@/lib/plataforma/servidor'
import { PestanasModulo } from '@/components/sistema/ui/pestanas-modulo'
import { BotonPreguntarIa } from '@/components/sistema/ia/boton-preguntar'
import { estadoIa } from '@/lib/ia/servidor'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/server'
import { BotonTutorial, type TutorialMenu } from '@/components/sistema/ui/boton-tutorial'
import { GuiaAsistente } from '@/components/sistema/asistente/guia'
import { BotonVentanaAsistente } from '@/components/sistema/asistente/boton-ventana'

/**
 * La cabecera de un módulo (Anexo E §3, «zona de trabajo»): migas, título,
 * código, estado, acciones y pestañas por URL. El módulo sale de
 * `control.modulo`; las pestañas, de `PESTANAS` (recortadas por permiso) o de
 * las que pase la página.
 *
 * Va a sangre: se come el margen de la zona de trabajo para pegarse a la barra.
 */
export async function CabeceraModulo({
  sesion,
  codigo,
  titulo,
  migas,
  acciones,
  pestanas,
  cuentas,
  descripcion,
}: {
  sesion: Sesion
  codigo: string
  /** Por defecto, el nombre del módulo. */
  titulo?: string
  /** Lo que va después del módulo en las migas (la pestaña, un objeto). */
  migas?: { etiqueta: string; href?: string }[]
  acciones?: ReactNode
  pestanas?: Pestana[]
  /** Un número al lado de una pestaña, por su href. */
  cuentas?: Record<string, number>
  descripcion?: ReactNode
}) {
  const [modulos, ia, tutoriales] = await Promise.all([modulosDelPlan(), estadoIa(), tutorialesDe(pestanas ?? PESTANAS[codigo] ?? [])])
  // «Preguntar a la IA» abre el asistente (26-nov-2026): sale para quien lo tiene, con la IA encendida, y no en el propio asistente.
  const preguntar = !!ia?.general && puede(sesion, 'sistema:asistente') && codigo !== 'MI-ASI'
  const m = [...MODULOS_INTERFAZ, ...modulos].find((x) => x.codigo === codigo)
  const dominio = m ? (m.dominio === 'Mi día' ? DOMINIOS[0] : DOMINIOS.find((d) => d.clave === dominioDe(m))) : null
  const lista = (pestanas ?? PESTANAS[codigo] ?? []).filter(
    (p) => !p.recurso || puede(sesion, p.recurso, p.accion ?? 'ver') || (p.accion === 'crear' && puede(sesion, p.recurso))
  )
  const estado = m ? ESTADO_MODULO[m.estado] : null
  const esMiDia = codigo.startsWith('MI-')

  return (
    <div className={cn('-mx-3 -mt-4 mb-4 border-b border-[var(--borde)] bg-white px-3 sm:-mx-5 sm:px-5', lista.length > 1 ? 'pt-3' : 'py-3')}>
      <nav aria-label="Migas" className="text-[12px] text-marca-400">
        <ol className="flex flex-wrap items-center gap-1">
          {dominio && !esMiDia && (
            <li>
              {dominio.nombre}
              <span aria-hidden> /</span>
            </li>
          )}
          {m && (
            <li>
              {migas?.length && m.ruta ? (
                <Link href={m.ruta} className="hover:text-marca-700 hover:underline">
                  {m.nombre}
                </Link>
              ) : (
                m.nombre
              )}
              {migas?.length ? <span aria-hidden> /</span> : null}
            </li>
          )}
          {migas?.map((x, i) => (
            <li key={i}>
              {x.href ? (
                <Link href={x.href} className="hover:text-marca-700 hover:underline">
                  {x.etiqueta}
                </Link>
              ) : (
                <span aria-current="page">{x.etiqueta}</span>
              )}
              {i < migas.length - 1 && <span aria-hidden> /</span>}
            </li>
          ))}
        </ol>
      </nav>
      <div className="mt-1 mb-2 flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
        <h1 className="text-[19px] leading-tight font-bold text-marca-900">{titulo ?? m?.nombre ?? codigo}</h1>
        {!esMiDia && <span className="rounded-full bg-[#eef0f3] px-2 py-0.5 font-mono text-[10.5px] font-semibold text-marca-600">{codigo}</span>}
        {estado && !esMiDia && (
          <span
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold',
              m?.estado === 'operando' ? 'bg-[#e7f5ee] text-[#1f6f4b]' : m?.estado === 'en_construccion' ? 'bg-[#fdf4e3] text-[#8a5a12]' : 'bg-[#eef0f3] text-marca-600'
            )}
          >
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: estado.color }} aria-hidden />
            {estado.etiqueta}
          </span>
        )}
        {(acciones || preguntar || tutoriales.length > 0 || codigo === 'MI-ASI') && (
          <div className="ml-auto flex flex-wrap items-center gap-1.5">
            {/* En el asistente: la guía con el alcance real de quien mira y el chat en ventana flotante (26-nov-2026). */}
            {codigo === 'MI-ASI' && <GuiaAsistente sesion={sesion} />}
            {codigo === 'MI-ASI' && <BotonVentanaAsistente />}
            {tutoriales.length > 0 && <BotonTutorial tutoriales={tutoriales} pestanas={lista} />}
            {preguntar && <BotonPreguntarIa contexto={[m?.nombre ?? titulo, ...(migas ?? []).map((x) => x.etiqueta)].filter(Boolean).join(' › ')} />}
            {acciones}
          </div>
        )}
      </div>
      {descripcion && <p className="-mt-1 mb-2 max-w-3xl text-[12.5px] text-marca-500">{descripcion}</p>}
      {lista.length > 1 && <PestanasModulo pestanas={lista} cuentas={cuentas} />}
    </div>
  )
}

/**
 * Los tutoriales de las pestañas del módulo que quien mira puede abrir (la RLS de `ui.tutorial` pide el permiso de
 * cada pestaña). Sin la tabla —antes de su migración— no hay botón.
 */
async function tutorialesDe(pestanas: Pestana[]): Promise<TutorialMenu[]> {
  if (!pestanas.length) return []
  const supabase = await createClient()
  const { data, error } = await supabase
    .schema('ui')
    .from('tutorial')
    .select('ruta, titulo, descripcion, duracion_seg')
    .in('ruta', pestanas.map((p) => p.href))
  return error ? [] : (data ?? [])
}

/** Botón de la cabecera, con el estilo denso del modelo. */
export const BOTON_CABECERA = 'inline-flex h-8 items-center gap-1.5 rounded-lg border border-[var(--borde)] bg-white px-2.5 text-xs font-medium text-marca-800 hover:bg-marca-50'
export const BOTON_CABECERA_PRINCIPAL = 'inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#2b2a28] px-3 text-xs font-semibold text-white hover:bg-marca-700'
