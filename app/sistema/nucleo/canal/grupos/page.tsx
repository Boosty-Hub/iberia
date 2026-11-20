import type { Metadata } from 'next'
import { requerirPermiso } from '@/lib/auth'
import { leerContexto } from '@/lib/plataforma/servidor'
import { KpiMetrica } from '@/lib/plataforma/metricas'
import { TABLA_CANAL_GRUPOS } from '@/lib/plataforma/tablas-canal'
import { CabeceraModulo } from '@/components/sistema/ui/cabecera-modulo'
import { TablaServidor } from '@/components/sistema/ui/tabla-servidor'

export const metadata: Metadata = { title: 'Grupos · Canal' }

/**
 * Los grupos del canal: tipo, miembros, quién los coordina y cuánto se escribe
 * en ellos. De los mensajes solo sale la cuenta y la fecha del último: el
 * contenido no se lee desde la plataforma.
 */
export default async function GruposCanalPage({ searchParams }: PageProps<'/sistema/nucleo/canal/grupos'>) {
  const [sesion, sp] = await Promise.all([requerirPermiso('modulo:reportes'), searchParams])
  const ctx = await leerContexto(sp)
  return (
    <>
      <CabeceraModulo
        sesion={sesion}
        codigo="NUC-CAN"
        titulo="Canal"
        migas={[{ etiqueta: 'Grupos' }]}
        descripcion="Los grupos los arma la gente desde la app. Aquí se ve quién los coordina y cuánto se usan; lo que se escribe adentro no."
      />
      <div className="mb-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiMetrica clave="canal_grupos" ctx={ctx} sesion={sesion} titulo="Grupos activos" />
        <KpiMetrica clave="canal_grupos" ctx={ctx} sesion={sesion} parte={{ detalle: 'miembros', titulo: 'Personas en algún grupo', texto: 'Miembros distintos de los grupos activos' }} />
      </div>
      <TablaServidor fuente={TABLA_CANAL_GRUPOS} sp={sp} sesion={sesion} ctx={ctx} vacio="Todavía nadie ha creado un grupo en el canal." />
    </>
  )
}
