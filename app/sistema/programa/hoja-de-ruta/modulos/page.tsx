import type { Metadata } from 'next'
import { puede, requerirPermiso } from '@/lib/auth'
import { leerContexto } from '@/lib/plataforma/servidor'
import { KpiMetrica, leerMetrica, puedeVerMetrica } from '@/lib/plataforma/metricas'
import { ESTADO_MODULO } from '@/lib/plataforma/dominios'
import { TABLA_MODULOS_PLAN } from '@/lib/plataforma/tablas-hoja-de-ruta'
import { CabeceraModulo } from '@/components/sistema/ui/cabecera-modulo'
import { TablaServidor } from '@/components/sistema/ui/tabla-servidor'
import { Seccion } from '@/components/sistema/programa/piezas'
import { BarrasDominio, type FilaDominio } from '@/components/sistema/programa/hoja-de-ruta'
import { editarCeldaModulo } from '../acciones'

export const metadata: Metadata = { title: 'Módulos del plan · Hoja de ruta' }

/**
 * PRG-PLN · Módulos del plan: los 65 módulos de la plataforma en sus doce
 * dominios (`control.modulo`, el plan como dato), con filtros por dominio, fase
 * y estado, el avance por dominio y la ficha de cada uno (propósito, frontera,
 * dueño, fase, estado y lo que ya está construido). El estado se cambia en la
 * celda con `modulo:programa` · editar. Sin régimen contractual.
 */
export default async function ModulosDelPlanPage({ searchParams }: PageProps<'/sistema/programa/hoja-de-ruta/modulos'>) {
  const [sesion, sp] = await Promise.all([requerirPermiso('modulo:programa'), searchParams])
  const ctx = await leerContexto(sp)
  const editar = puede(sesion, 'modulo:programa', 'editar')
  const metrica = await leerMetrica('plataforma_modulos', ctx)
  const porDominio = metrica && puedeVerMetrica(sesion, metrica) ? ((metrica.detalle?.por_dominio as FilaDominio[] | undefined) ?? []) : []

  const fuente = editar
    ? {
        ...TABLA_MODULOS_PLAN,
        columnas: TABLA_MODULOS_PLAN.columnas.map((c) =>
          c.clave === 'estado'
            ? {
                ...c,
                editable: true,
                opciones: Object.entries(ESTADO_MODULO).map(([valor, x]) => ({ valor, etiqueta: x.etiqueta })),
                ayudaEdicion: 'Operando: en producción y en uso. En construcción: una parte opera. Queda en la auditoría.',
              }
            : c
        ),
      }
    : TABLA_MODULOS_PLAN

  return (
    <>
      <CabeceraModulo
        sesion={sesion}
        codigo="PRG-PLN"
        migas={[{ etiqueta: 'Hoja de ruta', href: '/sistema/programa/hoja-de-ruta' }, { etiqueta: 'Módulos' }]}
        descripcion={`Los 65 módulos de la plataforma, con la fase en que entran y su estado de hoy. La fila abre su ficha: para qué es, qué no hace, quién es su dueño y qué ya está construido.${editar ? ' El estado se cambia en la celda.' : ''}`}
      />
      <div className="mb-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiMetrica clave="plataforma_modulos" ctx={ctx} sesion={sesion} />
        <KpiMetrica
          clave="plataforma_modulos"
          ctx={ctx}
          sesion={sesion}
          parte={{ detalle: 'en_construccion', titulo: 'En construcción', texto: 'una parte opera y otra está por hacer', href: '/sistema/programa/hoja-de-ruta/modulos?f.estado=en_construccion' }}
        />
        <KpiMetrica
          clave="plataforma_modulos"
          ctx={ctx}
          sesion={sesion}
          parte={{ detalle: 'planificado', titulo: 'Planificados', texto: 'esperan su fase en la hoja de ruta', href: '/sistema/programa/hoja-de-ruta/modulos?f.estado=planificado' }}
        />
        <KpiMetrica clave="plataforma_hitos" ctx={ctx} sesion={sesion} />
      </div>
      <Seccion titulo="Avance por dominio" id="dominios" className="mb-3" descripcion="Un clic filtra la tabla por ese dominio.">
        <BarrasDominio filas={porDominio} hrefDe={(d) => `/sistema/programa/hoja-de-ruta/modulos?f.dominio=${encodeURIComponent(d)}`} />
      </Seccion>
      <TablaServidor fuente={fuente} sp={sp} sesion={sesion} ctx={ctx} alEditar={editar ? editarCeldaModulo : undefined} vacio="Ningún módulo con estos filtros." />
    </>
  )
}
