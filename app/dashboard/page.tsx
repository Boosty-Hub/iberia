import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { requerirSesion } from '@/lib/auth'
import { Aviso, EncabezadoPagina, Insignia, Metrica } from '@/components/ui'
import { formatFecha, nombreSesion } from '@/lib/utils'
import {
  ESTADOS_ENTREVISTA,
  ESTADO_ENTREVISTA_ORDEN,
  SEDES,
  type EstadoEntrevista,
  type Sede,
} from '@/lib/types'

/** Meta de la Corriente B según la propuesta: alrededor de 25 entrevistas. */
const META_ENTREVISTAS = 25

const TONO_ESTADO: Record<EstadoEntrevista, 'neutro' | 'ambar' | 'marca' | 'verde'> = {
  programada: 'neutro',
  realizada: 'ambar',
  transcrita: 'marca',
  analizada: 'verde',
}

export default async function PanelPage({ searchParams }: PageProps<'/dashboard'>) {
  const [{ perfil }, params] = await Promise.all([requerirSesion(), searchParams])
  const supabase = await createClient()

  const [entrevistasRes, hallazgosRes, archivosRes, seccionesRes] = await Promise.all([
    supabase
      .from('entrevistas')
      .select('id, codigo, tipo, titulo, entrevistado_nombre, entrevistado_cargo, estado, sede, fecha_entrevista, areas(nombre)')
      .order('fecha_entrevista', { ascending: false, nullsFirst: false })
      .order('codigo', { ascending: true }),
    supabase.from('hallazgos').select('id, estado, tipo'),
    supabase.from('archivos').select('id', { count: 'exact', head: true }),
    supabase.from('informe_secciones').select('id, publicado'),
  ])

  const sesiones = entrevistasRes.data ?? []
  const hallazgos = hallazgosRes.data ?? []
  const secciones = seccionesRes.data ?? []

  // La meta de ~25 de la propuesta cuenta entrevistas del diagnóstico. Las
  // reuniones de comité y los recorridos de planta se miden aparte.
  const entrevistas = sesiones.filter((e) => e.tipo === 'entrevista')
  const otrasSesiones = sesiones.filter((e) => e.tipo !== 'entrevista')

  const porEstado = ESTADO_ENTREVISTA_ORDEN.map((estado) => ({
    estado,
    total: entrevistas.filter((e) => e.estado === estado).length,
  }))

  const transcritas = sesiones.filter(
    (e) => e.estado === 'transcrita' || e.estado === 'analizada'
  ).length
  const hallazgosValidados = hallazgos.filter((h) => h.estado === 'validado').length
  const seccionesPublicadas = secciones.filter((s) => s.publicado).length

  const aviso = Array.isArray(params.aviso) ? params.aviso[0] : params.aviso

  return (
    <>
      {aviso === 'solo-lectura' && (
        <Aviso tono="ambar">
          Tu cuenta tiene permiso de <strong>solo lectura</strong>. Puedes consultar el
          levantamiento y el informe, pero no editarlos.
        </Aviso>
      )}
      {aviso === 'solo-admin' && (
        <Aviso tono="ambar">
          Esa sección es exclusiva de los administradores del programa.
        </Aviso>
      )}

      <EncabezadoPagina
        rotulo="Fase 1 · Entender"
        titulo={`Hola, ${(perfil.nombre_completo || perfil.email).split(' ')[0]}`}
        descripcion="Estado del diagnóstico y del levantamiento de procesos que alimenta el Documento de Arquitectura de IA."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Metrica
          valor={entrevistas.length}
          sufijo={`de ~${META_ENTREVISTAS}`}
          etiqueta="Entrevistas registradas"
          href="/dashboard/entrevistas"
        />
        <Metrica
          valor={otrasSesiones.length}
          sufijo={transcritas > 0 ? `${transcritas} transcritas` : undefined}
          etiqueta="Reuniones y visitas"
          href="/dashboard/entrevistas?tipo=reunion"
        />
        <Metrica
          valor={hallazgos.length}
          sufijo={hallazgosValidados > 0 ? `${hallazgosValidados} validados` : undefined}
          etiqueta="Hallazgos"
          href="/dashboard/hallazgos"
        />
        <Metrica
          valor={archivosRes.count ?? 0}
          etiqueta="Archivos"
          href="/dashboard/archivos"
        />
      </div>

      {/* Avance de la Corriente B */}
      <section className="tarjeta mt-6 p-5">
        <div className="mb-4 flex items-baseline justify-between gap-4">
          <h2 className="text-sm font-semibold text-marca-800">
            Avance del diagnóstico
          </h2>
          <span className="text-xs text-marca-500">
            {entrevistas.length} de ~{META_ENTREVISTAS} entrevistas
          </span>
        </div>

        <div
          className="mb-4 h-2 w-full overflow-hidden rounded-full bg-marca-100"
          role="progressbar"
          aria-valuenow={entrevistas.length}
          aria-valuemin={0}
          aria-valuemax={META_ENTREVISTAS}
          aria-label="Entrevistas completadas"
        >
          <div
            className="h-full rounded-full bg-acento-500 transition-[width]"
            style={{
              width: `${Math.min(100, (entrevistas.length / META_ENTREVISTAS) * 100)}%`,
            }}
          />
        </div>

        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {porEstado.map(({ estado, total }) => (
            <div key={estado} className="rounded-md bg-marca-50 px-3 py-2.5">
              <dt className="text-xs text-marca-500">{ESTADOS_ENTREVISTA[estado]}</dt>
              <dd className="mt-0.5 text-lg font-semibold text-marca-800">{total}</dd>
            </div>
          ))}
        </dl>
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        {/* Últimas sesiones */}
        <section className="tarjeta lg:col-span-2">
          <div className="flex items-baseline justify-between gap-4 border-b border-[var(--borde)] px-5 py-3.5">
            <h2 className="text-sm font-semibold text-marca-800">Últimas sesiones</h2>
            <Link
              href="/dashboard/entrevistas"
              className="text-xs font-medium text-acento-700 hover:underline"
            >
              Ver todas
            </Link>
          </div>

          {sesiones.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-marca-500">
              Todavía no hay entrevistas registradas.{' '}
              <Link
                href="/dashboard/entrevistas/nueva"
                className="font-medium text-acento-700 hover:underline"
              >
                Registrar la primera
              </Link>
              .
            </p>
          ) : (
            <ul className="divide-y divide-[var(--borde)]">
              {sesiones.slice(0, 6).map((e) => (
                <li key={e.id}>
                  <Link
                    href={`/dashboard/entrevistas/${e.id}`}
                    className="flex items-center justify-between gap-4 px-5 py-3 transition-colors hover:bg-marca-50/40"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-marca-800">
                        <span className="font-mono text-xs text-marca-400">{e.codigo}</span>{' '}
                        {nombreSesion(e)}
                      </p>
                      <p className="truncate text-xs text-marca-500">
                        {[
                          e.entrevistado_cargo,
                          e.areas?.nombre,
                          e.sede ? SEDES[e.sede as Sede] : null,
                        ]
                          .filter(Boolean)
                          .join(' · ') || '—'}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <span className="hidden text-xs text-marca-400 sm:inline">
                        {formatFecha(e.fecha_entrevista)}
                      </span>
                      <Insignia tono={TONO_ESTADO[e.estado as EstadoEntrevista]}>
                        {ESTADOS_ENTREVISTA[e.estado as EstadoEntrevista]}
                      </Insignia>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Estado del informe */}
        <section className="tarjeta">
          <div className="flex items-baseline justify-between gap-4 border-b border-[var(--borde)] px-5 py-3.5">
            <h2 className="text-sm font-semibold text-marca-800">Informe</h2>
            <Link
              href="/dashboard/informe"
              className="text-xs font-medium text-acento-700 hover:underline"
            >
              Editar
            </Link>
          </div>
          <div className="px-5 py-4">
            <p className="flex items-baseline gap-1.5">
              <span className="text-3xl font-bold text-marca-800">
                {seccionesPublicadas}
              </span>
              <span className="text-sm text-marca-500">de {secciones.length} secciones</span>
            </p>
            <p className="mt-1 text-xs text-marca-500">publicadas para el comité</p>

            <p className="mt-4 text-sm leading-relaxed text-marca-600">
              El informe cierra la Fase 1: el mapa del negocio con sus cuellos de botella,
              dónde interviene la IA y en qué orden.
            </p>

            <Link href="/informe" className="btn-neutro mt-4 w-full">
              Ver el informe
            </Link>
          </div>
        </section>
      </div>
    </>
  )
}
