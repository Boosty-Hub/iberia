import type { Metadata } from 'next'
import { BarraLienzo } from '@/components/sistema/lienzo/BarraLienzo'
import { MapaLienzo } from '@/components/sistema/lienzo/MapaLienzo'
import { fechaDe, fmtFecha, hoyCaracas } from '@/components/sistema/organizacion/datos'
import { activarProgramados, leerCatalogo } from '@/components/sistema/procesos/datos'
import { EsquemaMapa } from '@/components/sistema/procesos/esquema-mapa'
import { PestanasProcesos } from '@/components/sistema/procesos/piezas'
import { Aviso, EncabezadoPagina } from '@/components/ui'
import { puede, requerirPermiso } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'Mapa de procesos · Plataforma Iberia' }

/**
 * El mapa de procesos (NUC-PRO) como lienzo: cuatro niveles, de macroproceso a
 * actividad, que arranca en los macroprocesos y se despliega con un clic. Lee
 * `sgc.lienzo`, que trae la salud documental, el dueño y los documentos de
 * cada proceso ya contados.
 *
 * - `al`: el catálogo de cualquier día.
 * - `esc`: un escenario de procesos; en borrador y con permiso se edita
 *   arrastrando procesos y con el menú «⋯».
 * - `vista=esquema`: las tarjetas por macroproceso de la Etapa 1.
 */
export default async function MapaProcesosPage({ searchParams }: PageProps<'/sistema/nucleo/procesos'>) {
  const [sesion, sp] = await Promise.all([requerirPermiso('sistema:procesos'), searchParams])
  const supabase = await createClient()
  await activarProgramados(supabase)
  const hoy = hoyCaracas()
  const fecha = fechaDe(sp.al)
  const vista = sp.vista === 'esquema' ? 'esquema' : 'lienzo'
  const verEscenarios = puede(sesion, 'sistema:escenarios')
  const escPedido = typeof sp.esc === 'string' && /^[0-9a-f-]{36}$/i.test(sp.esc) && verEscenarios && vista === 'lienzo' ? sp.esc : null

  const org = supabase.schema('org')
  const [escenarios, escenario] = await Promise.all([
    verEscenarios
      ? org.from('escenario').select('id, nombre, estado').eq('alcance', 'procesos').in('estado', ['borrador', 'en_aprobacion', 'aprobado']).order('creado_en', { ascending: false })
      : Promise.resolve({ data: [] as { id: string; nombre: string; estado: string }[] }),
    escPedido ? org.from('escenario').select('id, nombre, estado, alcance, fecha_base').eq('id', escPedido).maybeSingle() : Promise.resolve({ data: null }),
  ])
  const esc = escenario.data && escenario.data.alcance === 'procesos' ? escenario.data : null

  const encabezado = (
    <>
      <EncabezadoPagina
        rotulo="Procesos"
        titulo="Mapa de procesos"
        descripcion={
          esc ? (
            <>
              Escenario <strong className="font-semibold text-[#6b4fb3]">«{esc.nombre}»</strong>: lo que cambia sale en morado, con su rótulo.
              Nada toca la realidad hasta que se apruebe.
            </>
          ) : (
            <>
              Los procesos de Iberia en cuatro niveles, como regían el <strong className="font-semibold text-marca-800">{fmtFecha(fecha, true)}</strong>.
              Toca un macroproceso para desplegarlo; «Ficha ›» abre su ficha PHVA.
            </>
          )
        }
      />
      <PestanasProcesos activa="mapa" escenarios={verEscenarios} />
      <BarraLienzo
        ruta="/sistema/nucleo/procesos"
        fecha={fecha}
        hoy={hoy}
        escenarios={escenarios.data ?? []}
        esc={esc?.id ?? null}
        vista={vista}
        fechaBase={esc ? fmtFecha(esc.fecha_base) : null}
        editarEscenario={esc ? `/sistema/nucleo/procesos/escenarios/${esc.id}` : null}
        nuevoEscenario={puede(sesion, 'sistema:escenarios', 'crear') && puede(sesion, 'sistema:procesos', 'editar') ? '/sistema/nucleo/procesos/escenarios' : null}
      />
    </>
  )

  if (vista === 'esquema') {
    return (
      <>
        {encabezado}
        <EsquemaMapa />
      </>
    )
  }

  const editable = !!esc && esc.estado === 'borrador' && puede(sesion, 'sistema:escenarios', 'editar') && puede(sesion, 'sistema:procesos', 'editar')
  const [filas, catalogo] = await Promise.all([
    supabase.schema('sgc').rpc('lienzo', { p_fecha: fecha, p_escenario: esc?.id }),
    leerCatalogo(supabase),
  ])

  return (
    <>
      {encabezado}
      {escPedido && !esc && <Aviso tono="ambar">Ese escenario no es de procesos (o no existe): se muestra la realidad.</Aviso>}
      {filas.error ? (
        <Aviso tono="rojo">No se pudo leer el mapa: {filas.error.message}</Aviso>
      ) : !filas.data?.length ? (
        <Aviso tono="ambar">No hay procesos vigentes en esa fecha.</Aviso>
      ) : (
        <MapaLienzo filas={filas.data} estados={catalogo.estados} escenario={esc ? { id: esc.id, nombre: esc.nombre, editable } : null} />
      )}
      <p className="mt-3 text-xs text-pretty text-marca-500">
        Salud documental: «vigente» si tiene documentos vigentes o ficha PHVA; «en revisión» si hay un borrador abierto o sus documentos no están
        vigentes; «sin documentar» si no tiene ninguno. La barra de cada caja cuenta todo lo que tiene debajo.
      </p>
    </>
  )
}
