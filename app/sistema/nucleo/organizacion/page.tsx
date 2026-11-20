import type { Metadata } from 'next'
import { BarraLienzo } from '@/components/sistema/lienzo/BarraLienzo'
import { OrganigramaLienzo } from '@/components/sistema/lienzo/OrganigramaLienzo'
import { fechaDe, fmtFecha, hoyCaracas } from '@/components/sistema/organizacion/datos'
import { EsquemaOrganizacion } from '@/components/sistema/organizacion/esquema'
import { CabeceraModulo } from '@/components/sistema/ui/cabecera-modulo'
import { Aviso } from '@/components/ui'
import { puede, requerirPermiso } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'Organigrama · Organización' }

/**
 * El organigrama (NUC-ORG) como lienzo: se mueve, se despliega con un clic y
 * cada caja abre su ficha. Lee `org.lienzo`, que hace las cuentas en la base.
 *
 * - `al`: la estructura de cualquier día (por defecto, hoy en Caracas).
 * - `esc`: un escenario de estructura; en borrador y con permiso se edita
 *   arrastrando cajas y con el menú «⋯». La realidad no se toca.
 * - `vista=esquema`: el árbol en lista de la Etapa 1, con sus filtros.
 */
export default async function OrganizacionPage({ searchParams }: PageProps<'/sistema/nucleo/organizacion'>) {
  const [sesion, sp] = await Promise.all([requerirPermiso('sistema:estructura'), searchParams])
  const supabase = await createClient()
  const hoy = hoyCaracas()
  const fecha = fechaDe(sp.al ?? sp.fecha)
  const vista = sp.vista === 'esquema' ? 'esquema' : 'lienzo'
  const verEscenarios = puede(sesion, 'sistema:escenarios')
  const escPedido = typeof sp.esc === 'string' && /^[0-9a-f-]{36}$/i.test(sp.esc) && verEscenarios && vista === 'lienzo' ? sp.esc : null

  const org = supabase.schema('org')
  const [escenarios, conciliacion, escenario] = await Promise.all([
    verEscenarios
      ? org.from('escenario').select('id, nombre, estado, fecha_base').eq('alcance', 'estructura').in('estado', ['borrador', 'en_aprobacion', 'aprobado']).order('creado_en', { ascending: false })
      : Promise.resolve({ data: [] as { id: string; nombre: string; estado: string; fecha_base: string }[] }),
    supabase.schema('control').from('conciliacion').select('id', { count: 'exact', head: true }).eq('estado', 'abierto').eq('modulo', 'NUC-ORG'),
    escPedido ? org.from('escenario').select('id, nombre, estado, alcance, fecha_base').eq('id', escPedido).maybeSingle() : Promise.resolve({ data: null }),
  ])
  const esc = escenario.data && escenario.data.alcance === 'estructura' ? escenario.data : null
  const escAjeno = escPedido && !esc

  const encabezado = (
    <>
      <CabeceraModulo
        sesion={sesion}
        codigo="NUC-ORG"
        titulo="Organización"
        migas={[{ etiqueta: esc ? `Organigrama · escenario «${esc.nombre}»` : 'Organigrama' }]}
        cuentas={conciliacion.count ? { '/sistema/nucleo/conciliacion': conciliacion.count } : undefined}
        descripcion={
          esc ? (
            <>
              Escenario <strong className="font-semibold text-[#6b4fb3]">«{esc.nombre}»</strong>: lo que cambia sale en morado, con su rótulo. Arrastra una caja sobre otra para
              cambiar de quién depende. Nada toca la realidad hasta que se apruebe.
            </>
          ) : (
            <>
              La estructura de Iberia como regía el <strong className="font-semibold text-marca-800">{fmtFecha(fecha, true)}</strong>: unidades, plazas, dotación aprobada y quién
              las ocupa. Toca una caja para desplegarla; «Ficha ›» la abre al lado.
            </>
          )
        }
      />
      <BarraLienzo
        ruta="/sistema/nucleo/organizacion"
        fecha={fecha}
        hoy={hoy}
        escenarios={(escenarios.data ?? []).map((e) => ({ id: e.id, nombre: e.nombre, estado: e.estado }))}
        esc={esc?.id ?? null}
        vista={vista}
        fechaBase={esc ? fmtFecha(esc.fecha_base) : null}
        editarEscenario={esc ? `/sistema/nucleo/escenarios/${esc.id}` : null}
        nuevoEscenario={puede(sesion, 'sistema:escenarios', 'crear') ? '/sistema/nucleo/escenarios' : null}
      />
    </>
  )

  if (vista === 'esquema') {
    return (
      <>
        {encabezado}
        <EsquemaOrganizacion sp={sp} />
      </>
    )
  }

  const editable = !!esc && esc.estado === 'borrador' && puede(sesion, 'sistema:escenarios', 'editar')
  const [filas, tipos, cargos] = await Promise.all([
    org.rpc('lienzo', { p_fecha: fecha, p_escenario: esc?.id }),
    supabase.schema('control').from('catalogo').select('clave, etiqueta').eq('tipo', 'tipo_unidad').eq('activo', true).order('orden'),
    editable ? org.from('cargo').select('id, nombre').eq('activo', true).order('nombre').range(0, 1999) : Promise.resolve({ data: [] as { id: string; nombre: string }[] }),
  ])

  return (
    <>
      {encabezado}
      {escAjeno && (
        <Aviso tono="ambar">
          Ese escenario no es de estructura (o no existe): se muestra la realidad.
        </Aviso>
      )}
      {filas.error ? (
        <Aviso tono="rojo">No se pudo leer el organigrama: {filas.error.message}</Aviso>
      ) : !filas.data?.length ? (
        <Aviso tono="ambar">No hay unidades vigentes en esa fecha.</Aviso>
      ) : (
        <OrganigramaLienzo
          filas={filas.data}
          tiposUnidad={tipos.data ?? []}
          verCostos={puede(sesion, 'sistema:costos')}
          escenario={esc ? { id: esc.id, nombre: esc.nombre, editable } : null}
          cargos={cargos.data ?? []}
        />
      )}
      <p className="mt-3 text-xs text-pretty text-marca-500">
        «Inferido» marca lo que la carga dedujo de los organigramas sin poder confirmarlo. «Por encima» es gente registrada de más sobre la
        dotación aprobada: no es un error de carga, es un hallazgo. Del padrón solo se muestra el nombre.
      </p>
    </>
  )
}
