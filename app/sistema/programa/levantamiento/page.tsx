import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { puede, requerirSesion } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { leerContexto } from '@/lib/plataforma/servidor'
import { KpiMetrica, precargarMetricas } from '@/lib/plataforma/metricas'
import { fechaCorta } from '@/lib/plataforma/formato'
import { ESTADOS_ENTREVISTA, ESTADO_ENTREVISTA_ORDEN, SEDES, type EstadoEntrevista, type Sede } from '@/lib/types'
import { nombreSesion } from '@/lib/utils'
import { CabeceraModulo, BOTON_CABECERA, BOTON_CABECERA_PRINCIPAL } from '@/components/sistema/ui/cabecera-modulo'
import { BotonFicha } from '@/components/sistema/colaboracion/boton-ficha'
import { Seccion } from '@/components/sistema/programa/piezas'
import { IconoNuevaPestana } from '@/components/iconos'

export const metadata: Metadata = { title: 'Resumen · Levantamiento' }

const TONO: Record<EstadoEntrevista, string> = {
  programada: 'bg-[#eef0f3] text-marca-600',
  realizada: 'bg-[#fdf4e3] text-[#8a5a12]',
  transcrita: 'bg-[#eaf2fb] text-[#2f5f9a]',
  analizada: 'bg-[#e7f5ee] text-[#1f6f4b]',
}

/**
 * PRG-LEV · Resumen: lo que era la portada del panel viejo (`/dashboard`), en
 * cifras del registro de métricas: entrevistas contra la meta de ~25 de la
 * cláusula 5 (las SES y FOR aparte), el expediente, el avance por estado, las
 * últimas sesiones y el estado del informe. Quien solo tiene el expediente entra
 * directo a Archivos.
 */
export default async function LevantamientoResumenPage({ searchParams }: PageProps<'/sistema/programa/levantamiento'>) {
  const [sesion, sp] = await Promise.all([requerirSesion(), searchParams])
  if (!puede(sesion, 'modulo:entrevistas')) {
    redirect(puede(sesion, 'modulo:archivos') ? '/sistema/programa/levantamiento/archivos' : '/sistema?aviso=sin-permiso')
  }
  const ctx = await leerContexto(sp)
  const supabase = await createClient()
  const crear = puede(sesion, 'modulo:entrevistas', 'crear')
  const verInforme = Object.entries(sesion.permisos).some(([r, p]) => r.startsWith('informe:') && p.ver) || sesion.rol.nivel === 'admin'

  const [{ data: ultimas }, { data: secciones }, metricas] = await Promise.all([
    supabase
      .from('entrevistas')
      .select('id, codigo, titulo, entrevistado_nombre, entrevistado_cargo, estado, sede, fecha_entrevista, areas(nombre)')
      .order('fecha_entrevista', { ascending: false, nullsFirst: false })
      .order('codigo')
      .range(0, 7),
    verInforme ? supabase.from('informe_secciones').select('id, publicado') : Promise.resolve({ data: [] as { id: string; publicado: boolean }[] }),
    precargarMetricas(['levantamiento_entrevistas', 'programa_sesiones', 'levantamiento_archivos'], ctx),
  ])
  const ent = metricas.find((m) => m.clave === 'levantamiento_entrevistas')
  const publicadas = (secciones ?? []).filter((s) => s.publicado).length

  return (
    <>
      <CabeceraModulo
        sesion={sesion}
        codigo="PRG-LEV"
        migas={[{ etiqueta: 'Resumen' }]}
        descripcion="El levantamiento que alimenta el Documento de Arquitectura: entrevistas a directores, gerentes y coordinadores, reuniones de comité, recorridos de planta y formaciones, con su expediente."
        acciones={
          crear ? (
            <>
              <Link href="/sistema/programa/levantamiento/entrevistas/importar" className={BOTON_CABECERA_PRINCIPAL}>
                Importar de Fireflies
              </Link>
              <Link href="/sistema/programa/levantamiento/entrevistas/nueva" className={BOTON_CABECERA}>
                Crear a mano
              </Link>
            </>
          ) : undefined
        }
      />
      <div className="mb-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiMetrica clave="levantamiento_entrevistas" ctx={ctx} sesion={sesion} />
        <KpiMetrica
          clave="levantamiento_entrevistas"
          ctx={ctx}
          sesion={sesion}
          parte={{ detalle: 'ses', titulo: 'Reuniones y recorridos', texto: 'serie SES · no cuentan contra la meta', href: '/sistema/programa/levantamiento/entrevistas?f.serie=SES' }}
        />
        <KpiMetrica
          clave="levantamiento_entrevistas"
          ctx={ctx}
          sesion={sesion}
          parte={{ detalle: 'for', titulo: 'Formaciones', texto: 'serie FOR · se miden aparte', href: '/sistema/programa/levantamiento/entrevistas?f.serie=FOR' }}
        />
        <KpiMetrica clave="levantamiento_archivos" ctx={ctx} sesion={sesion} />
      </div>

      <div className="grid gap-3 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-3">
          {ent && (
            <Seccion titulo="Avance del diagnóstico por estado" descripcion="Las entrevistas de la serie ENT, de la programada a la analizada. El clic filtra la tabla.">
              <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {ESTADO_ENTREVISTA_ORDEN.map((e) => (
                  <li key={e}>
                    <Link
                      href={`/sistema/programa/levantamiento/entrevistas?f.serie=ENT&f.estado=${e}`}
                      className="block rounded-lg border border-[var(--borde)] px-3 py-2 hover:bg-marca-50 focus-visible:outline-2 focus-visible:outline-acento-500"
                    >
                      <span className="block text-[11.5px] text-marca-500">{ESTADOS_ENTREVISTA[e]}</span>
                      <span className="block text-[18px] font-semibold text-marca-900 tabular-nums">{Number(ent.detalle?.[e] ?? 0)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Seccion>
          )}
          <Seccion
            titulo="Últimas sesiones"
            acciones={
              <Link href="/sistema/programa/levantamiento/entrevistas" className="text-[12px] font-medium text-acento-700 hover:underline">
                Ver todas
              </Link>
            }
          >
            {ultimas?.length ? (
              <ul className="divide-y divide-[#eef0f3]">
                {ultimas.map((e) => (
                  <li key={e.id} className="flex items-center gap-3 py-2">
                    <div className="min-w-0 flex-1">
                      <BotonFicha tipo="entrevista" id={e.id} className="block truncate text-[13px] font-medium text-marca-900">
                        <span className="font-mono text-[11px] text-marca-500">{e.codigo}</span> {nombreSesion(e)}
                      </BotonFicha>
                      <p className="truncate text-[11.5px] text-marca-500">
                        {[e.entrevistado_cargo, e.areas?.nombre, e.sede ? SEDES[e.sede as Sede] : null].filter(Boolean).join(' · ') || '—'}
                      </p>
                    </div>
                    <span className="hidden text-[11.5px] text-marca-500 tabular-nums sm:inline">{fechaCorta(e.fecha_entrevista)}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${TONO[e.estado as EstadoEntrevista] ?? TONO.programada}`}>{ESTADOS_ENTREVISTA[e.estado as EstadoEntrevista] ?? e.estado}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="py-3 text-[12.5px] text-marca-400">Todavía no hay sesiones registradas.</p>
            )}
          </Seccion>
        </div>

        {verInforme && (
          <Seccion titulo="El informe">
            <p className="flex items-baseline gap-1.5">
              <span className="text-[26px] font-bold text-marca-900 tabular-nums">{publicadas}</span>
              <span className="text-[12.5px] text-marca-500">de {(secciones ?? []).length} secciones publicadas para el comité</span>
            </p>
            <p className="mt-2 text-[12.5px] leading-relaxed text-marca-600">
              El informe cierra la Fase 1: el mapa del negocio con sus cuellos de botella, dónde interviene la IA y en qué orden. Los hallazgos se leen ahí, cada uno en su punto del circuito.
            </p>
            <a href="/informe" target="_blank" rel="noopener" className={`${BOTON_CABECERA} mt-3`}>
              Ver el informe
              <IconoNuevaPestana className="h-3.5 w-3.5 text-marca-500" aria-hidden />
              <span className="sr-only">(abre en otra pestaña)</span>
            </a>
          </Seccion>
        )}
      </div>
    </>
  )
}
