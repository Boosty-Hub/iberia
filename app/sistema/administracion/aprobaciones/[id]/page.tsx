import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { guardarRuta, moverPaso, quitarPaso } from '../acciones'
import { IconoAtras, IconoBasura } from '@/components/iconos'
import { plazasDe } from '@/components/sistema/flujo/datos'
import { EditorPaso, type PasoRuta } from '@/components/sistema/flujo/editor-paso'
import { ACCION_PASO, RESOLUTOR, TIPO_OBJETO, hoyCaracas, textoCondicion } from '@/components/sistema/flujo/formato'
import { Enviar, FormAccion } from '@/components/sistema/flujo/formulario'
import { Aviso, Insignia } from '@/components/ui'
import { puede, requerirPermiso } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'Ruta de aprobación' }

/** El editor de una ruta: sus pasos en orden, cada uno con quién firma, qué hace y cuándo aplica. */
export default async function RutaPage({ params }: PageProps<'/sistema/administracion/aprobaciones/[id]'>) {
  const [sesion, { id }] = await Promise.all([requerirPermiso('sistema:aprobaciones'), params])
  const supabase = await createClient()
  const hoy = hoyCaracas()

  const { data: ruta } = await supabase.schema('flujo').from('ruta').select('*').eq('id', id).maybeSingle()
  if (!ruta) notFound()

  const [{ data: pasos }, { data: cargos }, { data: estructura }, { data: roles }, { data: origenes }] = await Promise.all([
    supabase.schema('flujo').from('ruta_paso').select('*').eq('ruta_id', id).order('orden'),
    supabase.schema('org').from('cargo').select('id, nombre').eq('activo', true).order('nombre'),
    supabase.schema('org').rpc('estructura_al', { p_fecha: hoy }),
    supabase.from('roles').select('id, nombre').order('nombre'),
    supabase.schema('control').from('catalogo').select('clave, etiqueta').eq('tipo', 'origen_requisicion').order('orden'),
  ])
  const lista = (pasos ?? []) as unknown as PasoRuta[]
  const editar = puede(sesion, 'sistema:aprobaciones', 'editar')
  const plazas = (estructura ?? [])
    .filter((f) => f.plaza_ref)
    .map((f) => ({ id: f.plaza_ref, nombre: `${f.cargo} · ${f.unidad}` }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
  const descPlazas = await plazasDe(supabase, lista.map((p) => p.plaza_ref))
  const nombreCargo = new Map((cargos ?? []).map((c) => [c.id, c.nombre]))
  const nombreRol = new Map((roles ?? []).map((r) => [r.id, r.nombre]))
  const etiquetasOrigen = Object.fromEntries((origenes ?? []).map((o) => [o.clave, o.etiqueta]))
  const esRequisicion = ruta.tipo_objeto === 'requisicion_personal'
  const hitos = lista.filter((p) => p.hito).length
  const comunes = {
    ruta: id,
    cargos: cargos ?? [],
    plazas,
    roles: roles ?? [],
    origenes: origenes ?? [],
    conCondicionRequisicion: esRequisicion,
  }

  return (
    <>
      <Link href="/sistema/administracion/aprobaciones" className="mb-4 inline-flex min-h-10 items-center gap-1.5 text-sm text-marca-500 hover:text-acento-700">
        <IconoAtras className="h-4 w-4" />
        Rutas de aprobación
      </Link>
      <div className="mb-5">
        <p className="rotulo mb-2">{TIPO_OBJETO[ruta.tipo_objeto] ?? ruta.tipo_objeto}</p>
        <h1 className="text-2xl font-bold tracking-tight text-marca-900">{ruta.nombre}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Insignia tono={ruta.activa ? 'verde' : 'neutro'}>{ruta.activa ? 'Activa' : 'Inactiva'}</Insignia>
          <span className="text-xs text-marca-500">
            Clave del tipo: <code>{ruta.tipo_objeto}</code>
          </span>
        </div>
      </div>

      <Aviso tono="ambar">
        <strong>Configuración sensible.</strong> Lo que cambies aquí decide quién aprueba desde la próxima solicitud. Queda en la auditoría.
        {hitos !== 1 && (
          <>
            {' '}
            <strong>Ojo:</strong> la ruta tiene {hitos} pasos marcados como hito; lo normal es uno (el que aprueba el objeto).
          </>
        )}
      </Aviso>

      {editar && (
        <FormAccion accion={guardarRuta} className="tarjeta mb-6 grid gap-3 p-5 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_auto_auto] md:items-end">
          <input type="hidden" name="id" value={id} />
          <div>
            <label htmlFor="ruta-nombre" className="etiqueta">
              Nombre
            </label>
            <input id="ruta-nombre" name="nombre" defaultValue={ruta.nombre} maxLength={120} className="campo" />
          </div>
          <div>
            <label htmlFor="ruta-desc" className="etiqueta">
              Descripción
            </label>
            <input id="ruta-desc" name="descripcion" defaultValue={ruta.descripcion ?? ''} maxLength={600} className="campo" />
          </div>
          <label className="flex h-10 items-center gap-2 text-sm text-marca-700">
            <input type="checkbox" name="activa" defaultChecked={ruta.activa} className="accent-[var(--color-acento-600)]" />
            Activa
          </label>
          <label className="flex min-h-10 items-start gap-2 text-sm text-marca-700" title="Solo en pasos cuyo aprobador no tiene cuenta. Queda marcado «por suplencia».">
            <input type="checkbox" name="permite_suplencia_repetida" defaultChecked={ruta.permite_suplencia_repetida} className="mt-1 accent-[var(--color-acento-600)]" />
            <span>
              Una misma persona de administración puede suplir varios pasos sin cuenta
              <span className="block text-xs text-marca-500">Para rutas operativas. No lo actives en las de doble firma (escenarios, nivel de IA).</span>
            </span>
          </label>
          <Enviar clase="btn-primario">Guardar</Enviar>
        </FormAccion>
      )}

      <ol className="space-y-4">
        {lista.map((p, i) => {
          const cond = textoCondicion(p.condicion, etiquetasOrigen)
          return (
            <li key={p.id} className="tarjeta p-5">
              <div className="mb-2 flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-marca-900">
                    {p.orden}. {p.nombre}
                  </p>
                  <p className="mt-1 text-xs text-marca-600">
                    {ACCION_PASO[p.accion]?.etiqueta ?? p.accion}: {RESOLUTOR[p.resolutor] ?? p.resolutor}
                    {p.cargo_id ? ` · ${nombreCargo.get(p.cargo_id) ?? 'cargo inactivo'}` : ''}
                    {p.plaza_ref ? ` · ${descPlazas[p.plaza_ref] ?? 'plaza'}` : ''}
                    {p.rol_id ? ` · ${nombreRol.get(p.rol_id) ?? 'rol'}` : ''}
                    {cond ? ` · aplica ${cond}` : ' · siempre'}
                  </p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {p.hito && <Insignia tono="marca">Hito</Insignia>}
                    {p.ve_costos && <Insignia tono="neutro">Ve costos</Insignia>}
                  </div>
                </div>
                {editar && (
                  <div className="flex flex-wrap gap-2">
                    <FormAccion accion={moverPaso} mensajeClase="mt-1">
                      <input type="hidden" name="ruta" value={id} />
                      <input type="hidden" name="id" value={p.id} />
                      <div className="flex gap-1">
                        {i > 0 && (
                          <Enviar clase="btn-neutro" className="h-9 px-3" name="direccion" value="arriba" pendiente="…">
                            ↑<span className="sr-only">Subir</span>
                          </Enviar>
                        )}
                        {i < lista.length - 1 && (
                          <Enviar clase="btn-neutro" className="h-9 px-3" name="direccion" value="abajo" pendiente="…">
                            ↓<span className="sr-only">Bajar</span>
                          </Enviar>
                        )}
                      </div>
                    </FormAccion>
                    <FormAccion accion={quitarPaso} mensajeClase="mt-1">
                      <input type="hidden" name="ruta" value={id} />
                      <input type="hidden" name="id" value={p.id} />
                      <Enviar clase="btn-peligro" className="h-9 px-3" pendiente="…" confirmar={`¿Quitar el paso «${p.nombre}» de la ruta?`}>
                        <IconoBasura className="h-4 w-4" />
                        Quitar
                      </Enviar>
                    </FormAccion>
                  </div>
                )}
              </div>
              {editar && (
                <details>
                  <summary className="cursor-pointer text-sm font-medium text-acento-700">Editar el paso</summary>
                  <div className="mt-4">
                    <EditorPaso {...comunes} paso={p} />
                  </div>
                </details>
              )}
            </li>
          )
        })}
      </ol>

      {editar && (
        <section className="tarjeta mt-6 p-5 sm:p-6" aria-labelledby="nuevo-paso">
          <h2 id="nuevo-paso" className="mb-4 text-sm font-semibold text-marca-800">
            Agregar un paso al final
          </h2>
          <EditorPaso {...comunes} />
        </section>
      )}
    </>
  )
}
