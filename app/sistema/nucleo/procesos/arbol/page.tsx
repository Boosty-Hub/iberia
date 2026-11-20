import type { Metadata } from 'next'
import { EncabezadoPagina } from '@/components/ui'
import { ArbolProcesos, type NodoArbol } from '@/components/sistema/procesos/arbol'
import { fichaVacia, normalizarFicha } from '@/components/sistema/procesos/comun'
import { activarProgramados, conteoDocumentos, leerCatalogo, leerPlazas, leerProcesos } from '@/components/sistema/procesos/datos'
import { PestanasProcesos } from '@/components/sistema/procesos/piezas'
import { puede, requerirPermiso } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'Árbol de procesos · Plataforma Iberia' }

/**
 * El catálogo completo en sus cuatro niveles. Los procesos nuevos que esperan
 * aprobación salen marcados bajo su padre; los cambios a uno existente se ven
 * en su ficha. Crear y mover abren borradores: aquí no se publica nada.
 */
export default async function ArbolPage({ searchParams }: PageProps<'/sistema/nucleo/procesos/arbol'>) {
  const [sesion, consulta] = await Promise.all([requerirPermiso('sistema:procesos'), searchParams])
  const supabase = await createClient()
  await activarProgramados(supabase)

  const [{ vigentes, abiertos }, plazas, catalogo] = await Promise.all([leerProcesos(supabase), leerPlazas(supabase), leerCatalogo(supabase)])
  const { propio } = await conteoDocumentos(supabase, vigentes)
  const etiquetaPlaza = new Map(plazas.map((p) => [p.ref, p.etiqueta]))
  const vigenteRefs = new Set(vigentes.map((v) => v.ref))
  const nuevos = [...abiertos.values()].filter((a) => !vigenteRefs.has(a.ref))

  const nodos: NodoArbol[] = [...vigentes, ...nuevos].map((p) => ({
    ref: p.ref,
    padre_ref: p.padre_ref,
    nivel: p.nivel,
    nombre: p.nombre,
    tipo: p.tipo,
    estado_operativo: p.estado_operativo,
    codigo_sgc: p.codigo_sgc,
    codigo_informe: p.codigo_informe,
    con_ficha: !fichaVacia(normalizarFicha(p.ficha)),
    dueno: (p.dueno_plaza_ref && etiquetaPlaza.get(p.dueno_plaza_ref)) || p.dueno_texto,
    dueno_casado: Boolean(p.dueno_plaza_ref),
    abierto: abiertos.get(p.ref)?.estado ?? null,
    nuevo: !vigenteRefs.has(p.ref),
    docs: propio.get(p.ref)?.total ?? 0,
  }))

  const leer = (k: string) => (typeof consulta[k] === 'string' ? (consulta[k] as string) : undefined)

  return (
    <>
      <EncabezadoPagina
        rotulo="Procesos"
        titulo="Árbol de procesos"
        descripcion="Macroproceso → proceso → subproceso → actividad. Busca, filtra, agrega un hijo o mueve un nodo: todo cambio nace en borrador y pasa por aprobación."
      />
      <PestanasProcesos activa="arbol" escenarios={puede(sesion, 'sistema:escenarios')} />
      {consulta.descartado === '1' && (
        <p className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">Se descartó el borrador.</p>
      )}
      <ArbolProcesos
        nodos={nodos}
        tipos={catalogo.tipos}
        estados={catalogo.estados}
        plazas={plazas.map((p) => ({ valor: p.ref, etiqueta: p.etiqueta }))}
        inicial={{ q: leer('q'), ficha: leer('ficha'), dueno: leer('dueno'), version: leer('version'), tipo: leer('tipo'), estado: leer('estado') }}
        puedeCrear={puede(sesion, 'sistema:procesos', 'crear')}
        puedeEditar={puede(sesion, 'sistema:procesos', 'editar')}
      />
    </>
  )
}
