import type { Metadata } from 'next'
import Image from 'next/image'
import { puede, requerirPermiso } from '@/lib/auth'
import { CURSO } from '@/lib/adiestramiento'
import { createClient } from '@/lib/supabase/server'
import { numero, porcentaje } from '@/lib/plataforma/formato'
import { KpiMetrica, leerMetrica, precargarMetricas, puedeVerMetrica } from '@/lib/plataforma/metricas'
import { leerContexto } from '@/lib/plataforma/servidor'
import { BOTON_CABECERA, CabeceraModulo } from '@/components/sistema/ui/cabecera-modulo'
import { guardarConfiguracion, matricularPendientes } from './acciones'

const ESTADO = 'inline-flex h-7 items-center rounded-full bg-[#eef0f3] px-2.5 text-[11.5px] font-semibold text-marca-600'

export const metadata: Metadata = { title: 'Resumen · Formación' }

type PorLeccion = { numero: number; titulo: string; completadas: number; en_curso: number }

/**
 * Formación (NUC-FOR) · Resumen: el curso de Ajito en cifras. Las cifras salen
 * del registro de métricas (`ui.m_formacion_*`): las mismas en cualquier
 * pantalla. El avance por lección es el detalle de la métrica «Lecciones
 * completadas», no otra cuenta. Lo que la gente responde no aparece en ninguna
 * parte: son cuentas, sin nombres.
 *
 * Con `modulo:adiestramiento` · editar, la configuración: abrir el curso, el
 * asistente libre y matricular a los que faltan.
 */
export default async function FormacionResumenPage({ searchParams }: PageProps<'/sistema/nucleo/formacion'>) {
  const [sesion, sp] = await Promise.all([requerirPermiso('modulo:adiestramiento'), searchParams])
  const ctx = await leerContexto(sp)
  const supabase = await createClient()
  const [{ data: curso }] = await Promise.all([
    supabase.from('cursos').select('abierto, asistente_libre_activo').eq('clave', CURSO).maybeSingle(),
    precargarMetricas(['formacion_matriculados', 'formacion_completaron', 'formacion_avance', 'formacion_certificados'], ctx),
  ])
  const [avance, matriculados] = await Promise.all([leerMetrica('formacion_avance', ctx), leerMetrica('formacion_matriculados', ctx)])
  const porLeccion = avance && puedeVerMetrica(sesion, avance) ? ((avance.detalle?.por_leccion as PorLeccion[] | undefined) ?? []) : []
  const base = avance && puedeVerMetrica(sesion, avance) ? Number(matriculados?.valor ?? 0) : 0
  const sinMatricula = Number(matriculados?.detalle?.sin_matricula ?? 0)
  const editar = puede(sesion, 'modulo:adiestramiento', 'editar')

  return (
    <>
      <CabeceraModulo
        sesion={sesion}
        codigo="NUC-FOR"
        migas={[{ etiqueta: 'Resumen' }]}
        acciones={
          <>
            <span className={ESTADO}>{curso?.abierto ? 'Curso abierto' : 'Curso cerrado'}</span>
            <a href="/canal/adiestramiento" target="_blank" rel="noopener" className={BOTON_CABECERA}>
              Abrir el curso ↗<span className="sr-only"> (en otra pestaña)</span>
            </a>
          </>
        }
        descripcion="El curso de Ajito por el teléfono, para el personal que no va a las formaciones presenciales: nueve lecciones de audio, ejercicios por oficio y certificado. El guion vive en contenido/adiestramiento/."
      />

      <div className="mb-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiMetrica clave="formacion_matriculados" ctx={ctx} sesion={sesion} titulo="Matriculados" />
        <KpiMetrica clave="formacion_avance" ctx={ctx} sesion={sesion} titulo="Lecciones completadas" />
        <KpiMetrica clave="formacion_completaron" ctx={ctx} sesion={sesion} titulo="Terminaron" />
        <KpiMetrica clave="formacion_certificados" ctx={ctx} sesion={sesion} titulo="Certificados emitidos" />
      </div>

      <div className="grid gap-3 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <section className="min-w-0 rounded-xl border border-[var(--borde)] bg-white p-3.5" aria-labelledby="titulo-por-leccion">
          <h2 id="titulo-por-leccion" className="text-[13px] font-semibold text-marca-900">
            Avance por lección
          </h2>
          <p className="mb-2.5 text-xs text-marca-500">
            De {numero(base)} matriculados, cuántos terminaron cada lección y cuántos van por ella. Es el detalle de «Lecciones completadas».
          </p>
          {porLeccion.length === 0 ? (
            <p className="py-6 text-center text-xs text-marca-500">Todavía no hay nadie matriculado.</p>
          ) : (
            <ol className="space-y-1.5">
              {porLeccion.map((l) => {
                const hecha = base ? (l.completadas / base) * 100 : 0
                const va = base ? (l.en_curso / base) * 100 : 0
                return (
                  <li key={l.numero} className="grid grid-cols-[1.5rem_minmax(0,1fr)] items-center gap-2 text-xs sm:grid-cols-[1.5rem_minmax(0,14rem)_minmax(0,1fr)]">
                    <span className="text-right text-marca-500 tabular-nums">{l.numero}</span>
                    <span className="truncate text-marca-800" title={l.titulo}>
                      {l.titulo}
                    </span>
                    <span className="col-span-2 flex items-center gap-2 sm:col-span-1">
                      <span className="flex h-2.5 min-w-0 flex-1 overflow-hidden rounded-full bg-[#eef0f3]" aria-hidden>
                        <span className="h-full bg-[#1f8a5b]" style={{ width: `${hecha}%` }} />
                        <span className="h-full bg-[#e3b25a]" style={{ width: `${va}%` }} />
                      </span>
                      <span className="w-40 shrink-0 text-marca-600 tabular-nums">
                        ✓ {numero(l.completadas)} · va {numero(l.en_curso)} <span className="text-marca-500">({porcentaje(hecha, 0)})</span>
                      </span>
                    </span>
                  </li>
                )
              })}
            </ol>
          )}
        </section>

        <section className="min-w-0 rounded-xl border border-[var(--borde)] bg-white p-3.5">
          <div className="flex items-start gap-3">
            <Image src="/marca/ajito.png" alt="" width={200} height={200} className="h-12 w-12 shrink-0 object-contain" />
            <div className="min-w-0 text-xs text-marca-600">
              <h2 className="text-[13px] font-semibold text-marca-900">Lo que se ve y lo que no</h2>
              <p className="mt-1">
                Aquí y en Avance hay cuentas por área y por oficio, sin una sola respuesta: es lo que una gerencia puede ver para empujar a su gente sin leer lo que su gente contestó.
              </p>
              <p className="mt-1.5">Lo que la gente le responde a Ajito solo lo leen su autor y el equipo de Boosty. Ajito lo promete en la lección 0 y la base lo cumple.</p>
            </div>
          </div>
        </section>
      </div>

      {editar && curso && (
        <section className="mt-3 rounded-xl border border-[var(--borde)] bg-white p-3.5" aria-labelledby="titulo-configuracion">
          <h2 id="titulo-configuracion" className="text-[13px] font-semibold text-marca-900">
            Configuración del curso
          </h2>
          <form action={guardarConfiguracion} className="mt-2.5 space-y-2.5">
            <Interruptor
              nombre="abierto"
              activo={curso.abierto}
              titulo="El curso está abierto"
              detalle="Cerrado, nadie entra aunque tenga matrícula. Sirve para dejar todo listo y abrir el mismo día para todos."
            />
            <Interruptor
              nombre="asistente_libre"
              activo={curso.asistente_libre_activo}
              titulo="Ajito se queda después del curso"
              detalle="Encendido, aparece «Pregúntale a Ajito» y la lección 8 se despide distinto: Ajito se queda en vez de irse. Apagado, el curso son las nueve lecciones y cierra con el certificado. Cambia lo que el curso promete."
            />
            <div className="flex flex-wrap items-center gap-2 border-t border-[var(--borde)] pt-2.5">
              <button type="submit" className="inline-flex h-8 items-center rounded-lg bg-[#D4332C] px-3 text-xs font-semibold text-white hover:bg-[#b92a24]">
                Guardar
              </button>
              <button type="submit" formAction={matricularPendientes} className={BOTON_CABECERA}>
                Matricular a los que faltan{sinMatricula > 0 ? ` (${numero(sinMatricula)})` : ''}
              </button>
              <span className="text-xs text-marca-500">
                Matricula a planta y administración del padrón que no tenga matrícula. Es idempotente: se corre cada vez que Capital Humano complete el padrón.
              </span>
            </div>
          </form>
        </section>
      )}
    </>
  )
}

function Interruptor({ nombre, activo, titulo, detalle }: { nombre: string; activo: boolean; titulo: string; detalle: string }) {
  return (
    <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-[var(--borde)] p-3 hover:bg-marca-50">
      <input type="checkbox" name={nombre} value="si" defaultChecked={activo} className="mt-0.5 h-4 w-4 shrink-0 accent-[#D4332C]" />
      <span className="min-w-0">
        <span className="block text-[13px] font-medium text-marca-900">{titulo}</span>
        <span className="mt-0.5 block text-xs text-marca-500">{detalle}</span>
      </span>
    </label>
  )
}
