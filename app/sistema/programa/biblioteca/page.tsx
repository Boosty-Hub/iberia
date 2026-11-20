import type { Metadata } from 'next'
import Link from 'next/link'
import { puede, requerirSesion } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { rutaDeSeccion } from '@/lib/informe-rutas'
import { ENTREGABLES, ORDEN_ENTREGABLES, VENCE } from '@/lib/programa'
import { ESTADOS_ACTIVIDAD, FRENTE, rango, type EstadoActividad, type Frente } from '@/lib/calendario'
import { CATEGORIAS_ARCHIVO, type CategoriaArchivo } from '@/lib/types'
import { fechaCorta } from '@/lib/plataforma/formato'
import { CabeceraModulo, BOTON_CABECERA_PRINCIPAL } from '@/components/sistema/ui/cabecera-modulo'
import { BotonFicha } from '@/components/sistema/colaboracion/boton-ficha'
import { Seccion } from '@/components/sistema/programa/piezas'
import { IconoNuevaPestana } from '@/components/iconos'

export const metadata: Metadata = { title: 'Biblioteca del programa' }

/**
 * PRG-BIB · Biblioteca del programa: el Documento de Arquitectura (el informe,
 * que se queda afuera de la plataforma, intacto, y abre en otra pestaña), los
 * entregables de la Fase 1, los de la Fase 2 y New Iberia, y lo último del
 * expediente. Cada bloque sale solo con su casilla: la del informe (alguna
 * sección `informe:*`), `modulo:programa`, `modulo:calendario` y
 * `modulo:archivos`. No es la biblioteca del SGC (NUC-DOC).
 */
export default async function BibliotecaPage() {
  const sesion = await requerirSesion()
  const verInforme = sesion.rol.nivel === 'admin' || Object.entries(sesion.permisos).some(([r, p]) => r.startsWith('informe:') && p.ver)
  const verPrograma = puede(sesion, 'modulo:programa')
  const verCalendario = puede(sesion, 'modulo:calendario')
  const verArchivos = puede(sesion, 'modulo:archivos')
  const supabase = await createClient()

  const [{ data: secciones }, { data: entregables }, { data: archivos }] = await Promise.all([
    verInforme
      ? supabase.from('informe_secciones').select('id, slug, numero, titulo, publicado, orden').order('orden')
      : Promise.resolve({ data: [] as { id: string; slug: string; numero: string | null; titulo: string; publicado: boolean; orden: number }[] }),
    verCalendario
      ? supabase.from('calendario_actividades').select('ref, titulo, frente, estado, inicio, fin, fecha_confirmada').eq('tipo', 'entregable').order('inicio').order('orden')
      : Promise.resolve({ data: [] as never[] }),
    verArchivos
      ? supabase.from('archivos').select('id, nombre, categoria, created_at').order('created_at', { ascending: false }).range(0, 7)
      : Promise.resolve({ data: [] as { id: string; nombre: string; categoria: string; created_at: string }[] }),
  ])
  const nada = !verInforme && !verPrograma && !verCalendario && !verArchivos

  return (
    <>
      <CabeceraModulo
        sesion={sesion}
        codigo="PRG-BIB"
        migas={[{ etiqueta: 'Documentos del programa' }]}
        descripcion="El Documento de Arquitectura de IA y los entregables del programa, con su fecha. El informe se lee aparte, en otra pestaña: es el documento que recibe la dirección."
        acciones={
          verInforme ? (
            <a href="/informe" target="_blank" rel="noopener" className={BOTON_CABECERA_PRINCIPAL}>
              Abrir el informe
              <IconoNuevaPestana className="h-3.5 w-3.5" aria-hidden />
              <span className="sr-only">(abre en otra pestaña)</span>
            </a>
          ) : undefined
        }
      />

      {nada && (
        <p className="rounded-xl border border-[var(--borde)] bg-white p-6 text-center text-[13px] text-marca-600">
          Tu rol no abre ningún documento del programa. Si lo necesitas, pídeselo a un administrador.
        </p>
      )}

      <div className="grid gap-3 xl:grid-cols-2">
        {verInforme && (
          <Seccion titulo="Documento de Arquitectura de IA" descripcion="Las secciones del informe que tu rol puede leer. Cada una abre en otra pestaña.">
            <ol className="divide-y divide-[#eef0f3]">
              {(secciones ?? []).map((s) => (
                <li key={s.id} className="flex items-center gap-2 py-1.5">
                  <span className="w-8 shrink-0 font-mono text-[11px] text-marca-500">{s.numero ?? ''}</span>
                  <a href={rutaDeSeccion(s.slug)} target="_blank" rel="noopener" className="min-w-0 flex-1 truncate text-[13px] text-marca-900 hover:underline">
                    {s.titulo}
                    <span className="sr-only"> (abre en otra pestaña)</span>
                  </a>
                  {!s.publicado && <span className="rounded-full bg-[#eef0f3] px-2 py-0.5 text-[11px] text-marca-600">Borrador</span>}
                </li>
              ))}
            </ol>
          </Seccion>
        )}

        {verPrograma && (
          <Seccion titulo="Entregables de la Fase 1" descripcion="Los siete del contrato (cláusula 5), con la fecha en que se comprometen.">
            <ul className="divide-y divide-[#eef0f3]">
              {ORDEN_ENTREGABLES.filter((e) => e !== 'gestion').map((e) => (
                <li key={e} className="flex items-baseline justify-between gap-3 py-1.5">
                  <span className="text-[13px] text-marca-900">{ENTREGABLES[e]}</span>
                  <span className="shrink-0 text-[12px] text-marca-600 tabular-nums">{VENCE[e] ? fechaCorta(VENCE[e]) : '—'}</span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-[11.5px] text-marca-500">
              Las horas de cada uno están en{' '}
              <Link href="/sistema/programa/consumos" className="text-acento-700 underline underline-offset-2">
                Consumos
              </Link>
              .
            </p>
          </Seccion>
        )}

        {verCalendario && (
          <Seccion titulo="Entregables de la Fase 2 y New Iberia" descripcion="Los del calendario, con su estado. El título abre la ficha de la actividad.">
            {entregables?.length ? (
              <ul className="divide-y divide-[#eef0f3]">
                {entregables.map((a) => (
                  <li key={a.ref} className="flex items-start gap-2 py-1.5">
                    <span className="mt-1.5 h-2 w-2 shrink-0 rotate-45" style={{ background: FRENTE[a.frente as Frente]?.color }} aria-hidden />
                    <div className="min-w-0 flex-1">
                      <BotonFicha tipo="actividad" id={a.ref} className="text-[13px] text-marca-900">
                        {a.titulo}
                      </BotonFicha>
                      <p className="text-[11.5px] text-marca-500">
                        {FRENTE[a.frente as Frente]?.nombre} · {a.fecha_confirmada ? `confirmada ${fechaCorta(a.fecha_confirmada)}` : rango(a)}
                      </p>
                    </div>
                    <span className="shrink-0 text-[11.5px] text-marca-600">{ESTADOS_ACTIVIDAD[a.estado as EstadoActividad]?.nombre}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="py-2 text-[12.5px] text-marca-400">Sin entregables en el calendario.</p>
            )}
          </Seccion>
        )}

        {verArchivos && (
          <Seccion
            titulo="Lo último del expediente"
            acciones={
              <Link href="/sistema/programa/levantamiento/archivos" className="text-[12px] font-medium text-acento-700 hover:underline">
                Ver el expediente
              </Link>
            }
          >
            {archivos?.length ? (
              <ul className="divide-y divide-[#eef0f3]">
                {archivos.map((a) => (
                  <li key={a.id} className="flex items-baseline gap-2 py-1.5">
                    <BotonFicha tipo="archivo" id={a.id} className="min-w-0 flex-1 truncate text-[13px] text-marca-900">
                      {a.nombre}
                    </BotonFicha>
                    <span className="shrink-0 text-[11.5px] text-marca-500">{CATEGORIAS_ARCHIVO[a.categoria as CategoriaArchivo] ?? a.categoria}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="py-2 text-[12.5px] text-marca-400">El expediente está vacío.</p>
            )}
          </Seccion>
        )}
      </div>
    </>
  )
}
