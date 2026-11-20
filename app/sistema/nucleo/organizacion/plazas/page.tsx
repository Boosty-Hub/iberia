import type { Metadata } from 'next'
import { puede, requerirPermiso } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { fechaLarga } from '@/lib/plataforma/formato'
import { leerContexto } from '@/lib/plataforma/servidor'
import { TABLA_PLAZAS } from '@/lib/plataforma/tablas'
import { editarCeldaPlaza } from '@/app/sistema/nucleo/organizacion/celdas'
import { BOTON_CABECERA, CabeceraModulo } from '@/components/sistema/ui/cabecera-modulo'
import { TablaServidor } from '@/components/sistema/ui/tabla-servidor'
import Link from 'next/link'
import { marcasPlazas } from '@/lib/ia/marcas'
import { BotonAccionIa } from '@/components/sistema/ia/gobierno'
import { revisarPlazasIa } from '@/components/sistema/ia/acciones'

export const metadata: Metadata = { title: 'Plazas · Organización' }

/**
 * Las plazas como tabla (NUC-ORG · Explorar): la fuente es `ui.plazas(al, esc)`,
 * con ocupadas y vacantes al día de los datos y, en un escenario, la versión del
 * escenario encima de la real. La dotación se edita en la celda: en la realidad
 * crea una versión nueva desde hoy (`org.editar_plaza`); en un escenario en
 * borrador cambia solo el escenario. La fila abre la ficha de la plaza.
 */
export default async function PlazasPage({ searchParams }: PageProps<'/sistema/nucleo/organizacion/plazas'>) {
  const [sesion, sp] = await Promise.all([requerirPermiso('sistema:estructura'), searchParams])
  const ctx = await leerContexto(sp)
  const supabase = await createClient()
  // Se edita lo de hoy (la fecha de otro día se mira, no se cambia).
  const editaReal = !ctx.esc && ctx.esHoy && puede(sesion, 'sistema:estructura', 'editar')
  const editaEsc = Boolean(ctx.esc) && puede(sesion, 'sistema:escenarios', 'editar')
  const { data: nominas } = editaReal
    ? await supabase.schema('control').from('catalogo').select('clave, etiqueta').eq('tipo', 'tipo_nomina').eq('activo', true).order('orden')
    : { data: [] as { clave: string; etiqueta: string }[] }
  // R4 · NUC-ORG-IA-05: las marcas ⚑ de la IA (solo en la realidad) y el filtro «con propuestas».
  const ia = ctx.esc ? null : await marcasPlazas()
  const conPropuestas = sp.ia === 'con' && ia !== null
  const otros = new URLSearchParams()
  for (const [k, v] of Object.entries(sp)) if (k !== 'ia' && k !== 'pag') for (const x of [v].flat()) if (x) otros.append(k, String(x))
  if (!conPropuestas) otros.set('ia', 'con')
  const hrefFiltroIa = `?${otros.toString()}`
  const fuente = {
    ...TABLA_PLAZAS,
    ...(conPropuestas
      ? { consulta: ((supabase, c, select, opciones) => TABLA_PLAZAS.consulta(supabase, c, select, opciones).in('ref', ia.refs)) as typeof TABLA_PLAZAS.consulta }
      : {}),
    columnas: TABLA_PLAZAS.columnas.map((c) =>
      c.clave === 'dotacion' && (editaReal || editaEsc)
        ? { ...c, editable: true, ayudaEdicion: editaEsc ? 'Cambia la dotación solo dentro del escenario' : c.ayudaEdicion }
        : c.clave === 'tipo_nomina' && editaReal
          ? { ...c, editable: true, opciones: [{ valor: '', etiqueta: 'Sin definir' }, ...(nominas ?? []).map((n) => ({ valor: n.clave, etiqueta: n.etiqueta }))], ayudaEdicion: 'Nuevo tipo de nómina: rige desde hoy' }
          : c
    ),
  }
  return (
    <>
      <CabeceraModulo
        sesion={sesion}
        codigo="NUC-ORG"
        titulo="Organización"
        migas={[{ etiqueta: 'Plazas' }]}
        acciones={
          ia ? (
            <>
              <Link
                href={hrefFiltroIa}
                aria-pressed={conPropuestas}
                className={BOTON_CABECERA + (conPropuestas ? ' border-[#1d4f8f] font-semibold text-[#1d4f8f]' : '')}
                data-filtro-propuestas
              >
                <span aria-hidden>⚑</span> Con propuestas de la IA ({ia.refs.length})
              </Link>
              {editaReal && <BotonAccionIa etiqueta="Revisar plazas con la IA" accion={revisarPlazasIa} ayuda="NUC-ORG-IA-05 · reglas en SQL y una explicación breve del modelo" />}
            </>
          ) : undefined
        }
        descripcion={`Las plazas vigentes al ${fechaLarga(ctx.al)}${ctx.esc ? ', con los cambios del escenario' : ''}: dotación aprobada, titulares y lo que falta o sobra. ${editaReal ? 'La dotación y la nómina se editan en la celda (rige desde hoy; la versión anterior queda en el historial). ' : editaEsc ? 'La dotación se edita en la celda, solo dentro del escenario. ' : ''}Una fila abre su ficha.`}
      />
      <TablaServidor
        fuente={fuente}
        sp={sp}
        sesion={sesion}
        ctx={ctx}
        alEditar={editaReal || editaEsc ? editarCeldaPlaza.bind(null, ctx.esc) : undefined}
        marcas={ia?.marcas}
        vacio="No hay plazas con estos filtros a esa fecha."
      />
    </>
  )
}
