import type { Metadata } from 'next'
import { agregarEntrada, alternarEntrada, guardarEntrada, moverEntrada } from './acciones'
import { IconoMas } from '@/components/iconos'
import { Enviar, FormAccion } from '@/components/sistema/flujo/formulario'
import { Aviso, EncabezadoPagina, Insignia } from '@/components/ui'
import { puede, requerirPermiso } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { cn } from '@/lib/utils'

export const metadata: Metadata = { title: 'Catálogos' }

/** Cómo se llama cada catálogo en pantalla. Uno nuevo en la base sale con su clave. */
const TIPOS: Record<string, { titulo: string; uso: string }> = {
  tipo_unidad: { titulo: 'Tipos de unidad', uso: 'Unidades de la estructura' },
  tipo_nomina: { titulo: 'Tipos de nómina', uso: 'Plazas y requisiciones' },
  sede: { titulo: 'Sedes', uso: 'Unidades y plazas' },
  estado_plaza: { titulo: 'Estados de una plaza', uso: 'Plazas; «cerrada» y «en creación» los usan las reglas' },
  tipo_ocupacion: { titulo: 'Tipos de ocupación', uso: 'Ocupaciones; «titular» lo usa la regla de dotación' },
  familia_cargo: { titulo: 'Familias de cargo', uso: 'Catálogo de cargos' },
  origen_requisicion: { titulo: 'Orígenes de una requisición', uso: 'Requisiciones; las rutas condicionan pasos por origen' },
  tipo_proceso: { titulo: 'Tipos de proceso', uso: 'Procesos' },
  estado_operativo: { titulo: 'Estado operativo de un proceso', uso: 'Procesos' },
  perimetro: { titulo: 'Perímetros de documentos', uso: 'Documentos; «general» lo usa la regla de lectura' },
}

/**
 * Los catálogos editables de la plataforma (NUC-CFG). Se agregan, se renombran,
 * se reordenan y se desactivan; **no se borran**, porque las reglas y las llaves
 * foráneas usan sus claves. La clave no cambia: la etiqueta sí.
 */
export default async function CatalogosPage() {
  const sesion = await requerirPermiso('sistema:catalogos')
  const supabase = await createClient()
  const { data } = await supabase.schema('control').from('catalogo').select('*').order('tipo').order('orden').order('clave')
  const filas = data ?? []
  const editar = puede(sesion, 'sistema:catalogos', 'editar')
  const crear = puede(sesion, 'sistema:catalogos', 'crear') || editar
  const tipos = [...new Set(filas.map((f) => f.tipo))].sort((a, b) => (TIPOS[a]?.titulo ?? a).localeCompare(TIPOS[b]?.titulo ?? b, 'es'))

  return (
    <>
      <EncabezadoPagina
        rotulo="Administración"
        titulo="Catálogos"
        descripcion="Las listas que usa la plataforma: tipos de unidad, de nómina, sedes, orígenes de una requisición… Se editan aquí, sin código."
      />
      <Aviso>
        Una entrada <strong>no se borra</strong>: la usan registros y reglas. Si ya no aplica, se desactiva y deja de ofrecerse en los
        formularios; lo que ya la tenía la conserva. La clave es fija; la etiqueta, el orden y la descripción se cambian. Todo queda en la
        auditoría.
      </Aviso>

      <nav className="mb-6 flex flex-wrap gap-2" aria-label="Catálogos">
        {tipos.map((t) => (
          <a key={t} href={`#${t}`} className="insignia bg-marca-100 text-marca-700 hover:bg-marca-200">
            {TIPOS[t]?.titulo ?? t}
          </a>
        ))}
      </nav>

      <div className="space-y-6">
        {tipos.map((t) => {
          const lista = filas.filter((f) => f.tipo === t)
          return (
            <section key={t} id={t} className="tarjeta scroll-mt-20 p-5 sm:p-6" aria-labelledby={`t-${t}`}>
              <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
                <h2 id={`t-${t}`} className="text-base font-semibold text-marca-900">
                  {TIPOS[t]?.titulo ?? t}
                </h2>
                <span className="text-xs text-marca-500">
                  <code>{t}</code>
                  {TIPOS[t] ? ` · ${TIPOS[t].uso}` : ''}
                </span>
              </div>
              <ul className="divide-y divide-[var(--borde)] rounded-xl border border-marca-200/70">
                {lista.map((f, i) => (
                  <li key={f.clave} className={cn('flex flex-wrap items-center gap-2 px-3 py-2.5', !f.activo && 'bg-marca-50/70')}>
                    {editar && (
                      <FormAccion accion={moverEntrada} className="flex gap-0.5" mensajeClase="mt-1 py-1 text-xs">
                        <input type="hidden" name="tipo" value={t} />
                        <input type="hidden" name="clave" value={f.clave} />
                        <Enviar clase="btn-neutro" className="h-8 w-8 px-0" name="direccion" value="arriba" pendiente="…">
                          ↑<span className="sr-only">Subir {f.etiqueta}</span>
                        </Enviar>
                        <Enviar clase="btn-neutro" className="h-8 w-8 px-0" name="direccion" value="abajo" pendiente="…">
                          ↓<span className="sr-only">Bajar {f.etiqueta}</span>
                        </Enviar>
                      </FormAccion>
                    )}
                    <code className="min-w-0 flex-1 truncate text-xs text-marca-500 sm:w-40 sm:flex-none" title={f.clave}>
                      {i + 1}. {f.clave}
                    </code>
                    {editar ? (
                      <FormAccion accion={guardarEntrada} className="flex w-full min-w-0 flex-wrap items-center gap-2 sm:w-auto sm:flex-1" mensajeClase="mt-0 w-full py-1 text-xs">
                        <input type="hidden" name="tipo" value={t} />
                        <input type="hidden" name="clave" value={f.clave} />
                        <input name="etiqueta" defaultValue={f.etiqueta} maxLength={80} className="campo h-9 min-w-0 flex-[3] basis-44 py-1" aria-label={`Etiqueta de ${f.clave}`} />
                        <input
                          name="descripcion"
                          defaultValue={f.descripcion ?? ''}
                          maxLength={300}
                          className="campo h-9 min-w-0 flex-[2] basis-40 py-1"
                          placeholder="Descripción (opcional)"
                          aria-label={`Descripción de ${f.clave}`}
                        />
                        <Enviar clase="btn-neutro" className="h-9">
                          Guardar
                        </Enviar>
                      </FormAccion>
                    ) : (
                      <span className="min-w-0 flex-1 text-sm text-marca-800">
                        {f.etiqueta}
                        {f.descripcion && <span className="block text-xs text-marca-500">{f.descripcion}</span>}
                      </span>
                    )}
                    {editar ? (
                      <FormAccion accion={alternarEntrada} mensajeClase="mt-1 py-1 text-xs">
                        <input type="hidden" name="tipo" value={t} />
                        <input type="hidden" name="clave" value={f.clave} />
                        <input type="hidden" name="activo" value={f.activo ? 'no' : 'si'} />
                        <Enviar clase={f.activo ? 'btn-neutro' : 'btn-primario'} className="h-9 w-28" pendiente="…">
                          {f.activo ? 'Desactivar' : 'Activar'}
                        </Enviar>
                      </FormAccion>
                    ) : (
                      !f.activo && <Insignia>Inactiva</Insignia>
                    )}
                    {editar && !f.activo && <Insignia>Inactiva</Insignia>}
                  </li>
                ))}
              </ul>
              {crear && (
                <FormAccion accion={agregarEntrada} className="mt-3 flex flex-wrap items-center gap-2">
                  <input type="hidden" name="tipo" value={t} />
                  <input name="clave" maxLength={40} pattern="[a-z0-9_]+" className="campo h-9 w-full py-1 font-mono text-xs sm:w-40" placeholder="clave_nueva" aria-label="Clave nueva" />
                  <input name="etiqueta" maxLength={80} className="campo h-9 min-w-0 flex-1 basis-40 py-1" placeholder="Etiqueta que se ve" aria-label="Etiqueta nueva" />
                  <Enviar clase="btn-neutro" className="h-9" pendiente="Agregando…">
                    <IconoMas className="h-4 w-4" />
                    Agregar
                  </Enviar>
                </FormAccion>
              )}
            </section>
          )
        })}
      </div>
    </>
  )
}
