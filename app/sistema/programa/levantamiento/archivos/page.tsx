import type { Metadata } from 'next'
import { puede, requerirPermiso } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { leerContexto } from '@/lib/plataforma/servidor'
import { TABLA_ARCHIVOS } from '@/lib/plataforma/tablas-programa'
import { CabeceraModulo } from '@/components/sistema/ui/cabecera-modulo'
import { TablaServidor } from '@/components/sistema/ui/tabla-servidor'
import { SubirArchivo } from '@/components/subir-archivo'

export const metadata: Metadata = { title: 'Archivos · Levantamiento' }

/**
 * PRG-LEV · Archivos: el expediente del levantamiento (manuales, reportes del
 * ERP, muestras de datos, políticas y material de comunicación), material de
 * Iberia bajo NDA en un bucket privado.
 *
 * El modelo de seguridad no cambia: la subida va del navegador directo a
 * Storage y una acción registra la metadata; la previa sirve los bytes desde el
 * mismo origen (`[id]/ver`) y la descarga firma un enlace de 60 s
 * (`[id]/descargar`). La fila abre la ficha; «Ver» abre el visor.
 */
export default async function ArchivosPage({ searchParams }: PageProps<'/sistema/programa/levantamiento/archivos'>) {
  const [sesion, sp] = await Promise.all([requerirPermiso('modulo:archivos'), searchParams])
  const ctx = await leerContexto(sp)
  const subir = puede(sesion, 'modulo:archivos', 'crear')
  const supabase = await createClient()
  const [{ data: areas }, { data: entrevistas }] = subir
    ? await Promise.all([
        supabase.from('areas').select('id, nombre, tipo').order('orden'),
        supabase.from('entrevistas').select('id, codigo, titulo, entrevistado_nombre').order('codigo'),
      ])
    : [{ data: [] }, { data: [] }]

  return (
    <>
      <CabeceraModulo
        sesion={sesion}
        codigo="PRG-LEV"
        migas={[{ etiqueta: 'Archivos' }]}
        descripcion="El expediente del levantamiento: manuales, reportes del ERP, muestras de datos, políticas y material de comunicación. Se ven sin descargarlos; la descarga es un enlace que vence en 60 segundos."
      />
      {subir && (
        <details className="mb-3 rounded-xl border border-[var(--borde)] bg-white">
          <summary className="cursor-pointer px-3.5 py-2.5 text-[13px] font-semibold text-marca-900 select-none">Subir un archivo al expediente</summary>
          <div className="border-t border-[var(--borde)] p-3.5">
            <SubirArchivo areas={areas ?? []} entrevistas={entrevistas ?? []} />
          </div>
        </details>
      )}
      <TablaServidor fuente={TABLA_ARCHIVOS} sp={sp} sesion={sesion} ctx={ctx} vacio="Ningún archivo coincide con esa búsqueda." />
    </>
  )
}
