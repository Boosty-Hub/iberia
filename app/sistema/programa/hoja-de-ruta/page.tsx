import type { Metadata } from 'next'
import Link from 'next/link'
import { puede, requerirPermiso } from '@/lib/auth'
import { leerContexto } from '@/lib/plataforma/servidor'
import { KpiMetrica, comparacionMetrica, leerMetrica, precargarMetricas, puedeVerMetrica } from '@/lib/plataforma/metricas'
import { esEquipoBoosty, leerDecisiones, leerFases, leerHitos } from '@/lib/plataforma/hoja-de-ruta'
import { ESTADO_DECISION_ETIQUETA, ESTADO_FASE, ESTADO_HITO } from '@/lib/plataforma/hoja-de-ruta-vocabulario'
import { TABLA_PENDIENTES_PLATAFORMA } from '@/lib/plataforma/tablas-hoja-de-ruta'
import { fechaLarga, hoyCaracas, numero } from '@/lib/plataforma/formato'
import { CabeceraModulo } from '@/components/sistema/ui/cabecera-modulo'
import { TablaServidor } from '@/components/sistema/ui/tabla-servidor'
import { Seccion } from '@/components/sistema/programa/piezas'
import { diasHasta } from '@/components/sistema/programa/consumos'
import { BOTON_CHICO, BarrasDominio, CAMPO_CHICO, LeyendaFases, LineaFases, Pastilla, PastillaFase, type FilaDominio } from '@/components/sistema/programa/hoja-de-ruta'
import { Aviso } from '@/components/ui'
import { actualizarFase, actualizarHito, editarCeldaPendiente, registrarDecision } from './acciones'

export const metadata: Metadata = { title: 'Hoja de ruta · Plan y seguimiento' }

const AVISOS: Record<string, { tono: 'verde' | 'ambar'; texto: string }> = {
  guardado: { tono: 'verde', texto: 'Guardado. El cambio queda en la auditoría.' },
  'sin-permiso': { tono: 'ambar', texto: 'Tu rol no actualiza la hoja de ruta.' },
  'dato-invalido': { tono: 'ambar', texto: 'Revisa los datos: alguno no es válido.' },
  'no-guardado': { tono: 'ambar', texto: 'No se guardó: tu sesión no puede cambiar eso, o ya no existe.' },
  'falta-decision': { tono: 'ambar', texto: 'Para darla por decidida, escribe qué se decidió.' },
}

/**
 * PRG-PLN · Hoja de ruta de la plataforma: lo ejecutado y lo que falta, todo
 * desde la base (el plan es dato; la carpeta del plan está fuera de git). Las
 * cifras salen del registro de métricas (`plataforma_*`); las fases, los hitos y
 * lo que falta, de `control.*` con la RLS de quien mira.
 *
 * Es una pestaña propia y no el Resumen: el Resumen habla del programa de
 * consultoría (horas contra la referencia, sesiones, calendario); esto habla de
 * la plataforma (fases, módulos, dependencias), y cada uno tiene su tabla.
 *
 * ⚠️ Lo lee Iberia (Alberto es administrador): nada de dinero, nada de régimen
 * contractual, nada de alarmas. Las decisiones «para Gabriel», los pendientes
 * internos y la nota interna de los hitos solo salen al equipo de Boosty.
 */
export default async function HojaDeRutaPage({ searchParams }: PageProps<'/sistema/programa/hoja-de-ruta'>) {
  const [sesion, sp] = await Promise.all([requerirPermiso('modulo:programa'), searchParams])
  const ctx = await leerContexto(sp)
  const equipo = esEquipoBoosty(sesion)
  const editar = puede(sesion, 'modulo:programa', 'editar')
  const hoy = hoyCaracas()

  // Todo en una tanda; las métricas, en una sola vuelta (las sueltas la encuentran ya pedida).
  const metricas = precargarMetricas(['plataforma_modulos', 'plataforma_hitos', 'plataforma_pendientes'], ctx)
  const [fases, hitos, decisiones, modulos, hitosM] = await Promise.all([
    leerFases(),
    leerHitos(equipo),
    leerDecisiones(sesion),
    metricas.then(() => leerMetrica('plataforma_modulos', ctx)),
    metricas.then(() => leerMetrica('plataforma_hitos', ctx)),
  ])

  const actual = fases.find((f) => f.actual) ?? null
  const proximos = hitos.filter((h) => h.estado === 'pendiente' && (!h.fecha || h.fecha >= hoy)).slice(0, 6)
  const hechos = hitos.filter((h) => h.estado === 'hecho').sort((a, b) => (b.fecha ?? '').localeCompare(a.fecha ?? '') || b.orden - a.orden)
  const hitosDeFase = (clave: string) => hitos.filter((h) => h.fase === clave && h.estado !== 'cancelado')
  const porDominio = modulos && puedeVerMetrica(sesion, modulos) ? ((modulos.detalle?.por_dominio as FilaDominio[] | undefined) ?? []) : []
  const aviso = typeof sp.aviso === 'string' ? AVISOS[sp.aviso] : undefined

  const fuente = editar
    ? {
        ...TABLA_PENDIENTES_PLATAFORMA,
        columnas: TABLA_PENDIENTES_PLATAFORMA.columnas.map((c) =>
          c.clave === 'estado'
            ? {
                ...c,
                editable: true,
                opciones: [
                  { valor: 'abierto', etiqueta: 'Abierto' },
                  { valor: 'resuelto', etiqueta: 'Resuelto' },
                ],
                ayudaEdicion: 'Resolver pone la fecha de hoy; reabrir la borra. Queda en la auditoría.',
              }
            : c
        ),
      }
    : TABLA_PENDIENTES_PLATAFORMA

  return (
    <>
      <CabeceraModulo
        sesion={sesion}
        codigo="PRG-PLN"
        migas={[{ etiqueta: 'Hoja de ruta' }]}
        descripcion="La plataforma, fase por fase: lo que ya está hecho y en producción, lo que viene y lo que falta para destrabarlo. Todo sale de la base y se actualiza aquí mismo."
      />

      {aviso && (
        <div className="mb-3">
          <Aviso tono={aviso.tono}>{aviso.texto}</Aviso>
        </div>
      )}

      {/* Las cifras salen del registro de métricas: las mismas de Mi día. */}
      <div className="mb-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiMetrica clave="plataforma_modulos" ctx={ctx} sesion={sesion} />
        <KpiMetrica
          clave="plataforma_modulos"
          ctx={ctx}
          sesion={sesion}
          parte={{ detalle: 'en_construccion', titulo: 'En construcción', texto: 'una parte opera y otra está por hacer', href: '/sistema/programa/hoja-de-ruta/modulos?f.estado=en_construccion' }}
        />
        <KpiMetrica
          clave="plataforma_modulos"
          ctx={ctx}
          sesion={sesion}
          parte={{ detalle: 'planificado', titulo: 'Planificados', texto: 'esperan su fase en la hoja de ruta', href: '/sistema/programa/hoja-de-ruta/modulos?f.estado=planificado' }}
        />
        <KpiMetrica clave="plataforma_pendientes" ctx={ctx} sesion={sesion} />
      </div>

      <div className="mb-3 grid gap-3 xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <Seccion titulo="En qué vamos" id="actual">
          {actual ? (
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-[17px] leading-tight font-bold text-marca-900">{actual.nombre}</p>
                <PastillaFase estado={actual.estado} />
              </div>
              {actual.situacion && <p className="mt-1 text-[13px] text-marca-700">{actual.situacion}.</p>}
              {actual.periodo_texto && <p className="mt-1 text-[12px] text-marca-500">{actual.periodo_texto}</p>}
              <p className="mt-3 text-[12.5px] text-marca-600">
                Lo de antes ya está en producción: la Etapa 1 de procesos y estructura, el rediseño y la integración del panel y del canal. El espejo de JD del Paso 0 espera lo que falta de Iberia.
              </p>
            </div>
          ) : (
            <p className="py-3 text-[12.5px] text-marca-400">Ninguna fase marcada como la actual.</p>
          )}
        </Seccion>

        <Seccion
          titulo="Próximos hitos"
          id="hitos"
          descripcion="Lo que viene, por fecha. Un hito se da por cumplido cuando ocurre, no cuando se acerca su fecha."
          acciones={
            hitosM && puedeVerMetrica(sesion, hitosM) ? (
              <span className="text-[11.5px] text-marca-500" data-metrica="plataforma_hitos">
                {numero(hitosM.valor)} por cumplir · {comparacionMetrica(hitosM)}
              </span>
            ) : undefined
          }
        >
          {proximos.length ? (
            <ul className="divide-y divide-[#eef0f3]">
              {proximos.map((h) => {
                const dias = h.fecha ? diasHasta(h.fecha, hoy) : null
                return (
                  <li key={h.id} className="flex flex-col gap-1.5 py-2 sm:flex-row sm:items-start sm:gap-3">
                    <p className="w-24 shrink-0 text-[12.5px] font-semibold text-marca-900 tabular-nums">
                      {h.fecha ? fechaLarga(h.fecha) : 'Sin fecha'}
                      {dias !== null && <span className="block text-[11px] font-normal text-marca-500">{dias === 0 ? 'hoy' : `faltan ${dias} días`}</span>}
                    </p>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] text-marca-900">{h.titulo}</p>
                      <p className="text-[11.5px] text-marca-500">{[h.dueno, fases.find((f) => f.clave === h.fase)?.nombre].filter(Boolean).join(' · ')}</p>
                      {equipo && h.nota_interna && <p className="mt-1 text-[11.5px] text-[#5a3f9e]">🔒 Solo Boosty: {h.nota_interna}</p>}
                      {editar && <FormularioHito id={h.id} estado={h.estado} fecha={h.fecha} />}
                    </div>
                  </li>
                )
              })}
            </ul>
          ) : (
            <p className="py-3 text-[12.5px] text-marca-400">No quedan hitos por cumplir con fecha.</p>
          )}
        </Seccion>
      </div>

      <Seccion
        titulo="La ruta, fase por fase"
        id="fases"
        className="mb-3"
        descripcion="Cada fase con lo que contiene y cómo se da por terminada. Las que no tienen fecha firme se deciden en el punto de control de abril de 2027, con la evidencia de la Fase 2."
        acciones={<LeyendaFases />}
      >
        <LineaFases fases={fases} hoy={hoy} />
        <ol className="mt-3 grid gap-2.5 md:grid-cols-2 2xl:grid-cols-3">
          {fases.map((f) => {
            const deFase = hitosDeFase(f.clave)
            return (
              <li key={f.id} className="flex min-w-0 flex-col rounded-lg border border-[var(--borde)] p-3" style={{ borderLeft: `3px solid ${ESTADO_FASE[f.estado].color}` }}>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-[13px] font-semibold text-marca-900">{f.nombre}</h3>
                  <PastillaFase estado={f.estado} />
                  {f.actual && <Pastilla tono="rojo">Aquí vamos</Pastilla>}
                </div>
                <p className="mt-0.5 text-[11.5px] text-marca-500">{f.periodo_texto ?? (f.contratada ? '—' : 'Sin fecha firme')}</p>
                {f.contiene && <p className="mt-2 text-[12.5px] text-marca-700">{f.contiene}</p>}
                {f.criterio_salida && (
                  <p className="mt-2 text-[12px] text-marca-600">
                    <span className="font-semibold text-marca-800">Termina cuando: </span>
                    {f.criterio_salida}
                  </p>
                )}
                {deFase.length > 0 && (
                  <ul className="mt-2 space-y-0.5 border-t border-[#eef0f3] pt-2 text-[12px] text-marca-700">
                    {deFase.map((h) => (
                      <li key={h.id} className="flex gap-2">
                        <span className="w-[4.5rem] shrink-0 text-marca-500 tabular-nums">{h.fecha ? fechaLarga(h.fecha).replace(/ 20(\d\d)$/, ' $1') : '—'}</span>
                        <span className="min-w-0 flex-1">
                          {h.titulo} <span className="text-marca-500">· {ESTADO_HITO[h.estado].etiqueta.toLowerCase()}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                {editar && (
                  <form action={actualizarFase} className="mt-auto flex flex-wrap items-center gap-2 pt-2.5">
                    <input type="hidden" name="id" value={f.id} />
                    <label className="text-[11.5px] text-marca-500" htmlFor={`fase-${f.id}`}>
                      Estado
                    </label>
                    <select id={`fase-${f.id}`} name="estado" defaultValue={f.estado} className={CAMPO_CHICO}>
                      {Object.entries(ESTADO_FASE).map(([k, v]) => (
                        <option key={k} value={k}>
                          {v.etiqueta}
                        </option>
                      ))}
                    </select>
                    <button type="submit" className={BOTON_CHICO}>
                      Guardar
                    </button>
                  </form>
                )}
              </li>
            )
          })}
        </ol>
      </Seccion>

      <div className="mb-3 grid gap-3 xl:grid-cols-2">
        <Seccion titulo="Lo que ya está hecho" id="hecho" descripcion="Lo entregado, con su fecha. Todo está en producción.">
          {hechos.length ? (
            <ol className="relative border-l border-marca-200 pl-5">
              {hechos.map((h) => (
                <li key={h.id} className="relative pb-3 last:pb-0">
                  <span aria-hidden className="absolute top-1.5 -left-[25px] h-2.5 w-2.5 rounded-full border-2 border-white bg-[#1f8a5b]" />
                  <p className="text-[11.5px] text-marca-500 tabular-nums">{fechaLarga(h.fecha)}</p>
                  <p className="text-[13px] text-marca-900">{h.titulo}</p>
                  {equipo && h.nota_interna && <p className="mt-0.5 text-[11.5px] text-[#5a3f9e]">🔒 Solo Boosty: {h.nota_interna}</p>}
                </li>
              ))}
            </ol>
          ) : (
            <p className="py-3 text-[12.5px] text-marca-400">Todavía no hay hitos cumplidos.</p>
          )}
        </Seccion>

        <Seccion
          titulo="Avance por dominio"
          id="dominios"
          descripcion="Los 65 módulos del plan en sus doce dominios. Un clic abre los módulos del dominio."
          acciones={
            <Link href="/sistema/programa/hoja-de-ruta/modulos" className="text-[12px] font-medium text-acento-700 hover:underline">
              Ver los módulos
            </Link>
          }
        >
          <BarrasDominio filas={porDominio} hrefDe={(d) => `/sistema/programa/hoja-de-ruta/modulos?f.dominio=${encodeURIComponent(d)}`} />
        </Seccion>
      </div>

      <section id="falta" aria-labelledby="falta-t" className="mb-3">
        <div className="mb-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h2 id="falta-t" className="text-[13px] font-semibold text-marca-900">
            Lo que falta
          </h2>
          <p className="text-[12px] text-marca-500">
            Insumos, accesos y decisiones que destraban una fase, con su dueño. {editar ? 'El estado se cambia en la celda.' : ''}
            {equipo ? ' Lo marcado 🔒 es interno de Boosty.' : ''}
          </p>
        </div>
        <TablaServidor fuente={fuente} sp={sp} sesion={sesion} ctx={ctx} alEditar={editar ? editarCeldaPendiente : undefined} vacio="No queda nada pendiente con estos filtros." />
      </section>

      {equipo && decisiones.length > 0 && (
        <Seccion
          titulo="Decisiones abiertas · para Gabriel 🔒"
          id="decisiones"
          descripcion="Solo el equipo de Boosty las ve: Iberia no tiene acceso a esta lista, ni en pantalla ni en la base. Cada una trae la opción que el plan asume mientras no haya respuesta."
        >
          <ul className="divide-y divide-[#eef0f3]">
            {decisiones.map((d) => (
              <li key={d.id} className="py-2.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-[#eef0f3] px-2 py-0.5 font-mono text-[10.5px] font-semibold text-marca-600">{d.codigo}</span>
                  <p className="min-w-0 flex-1 text-[13px] font-medium text-marca-900">{d.pregunta}</p>
                  <Pastilla tono={d.estado === 'decidida' ? 'verde' : 'morado'}>{ESTADO_DECISION_ETIQUETA[d.estado]}</Pastilla>
                </div>
                {d.opciones && <p className="mt-1 text-[12px] text-marca-600">{d.opciones}</p>}
                <p className="mt-1 text-[12px] text-marca-500">
                  Por defecto: <strong className="font-semibold text-marca-700">{d.opcion_por_defecto ?? '—'}</strong>
                  {d.antes_de ? ` · antes de: ${d.antes_de}` : ''}
                  {d.fecha_limite ? ` (${fechaLarga(d.fecha_limite)})` : ''}
                </p>
                {d.estado === 'decidida' && d.decision && (
                  <p className="mt-1 text-[12.5px] text-marca-800">
                    Decidido el {fechaLarga(d.decidida_en)}: {d.decision}
                  </p>
                )}
                {editar && (
                  <details className="mt-1.5">
                    <summary className="cursor-pointer text-[12px] font-medium text-acento-700">Registrar la decisión</summary>
                    <form action={registrarDecision} className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-end">
                      <input type="hidden" name="id" value={d.id} />
                      <label className="flex flex-col gap-1 text-[11.5px] text-marca-500">
                        Estado
                        <select name="estado" defaultValue={d.estado} className={CAMPO_CHICO}>
                          <option value="abierta">Abierta</option>
                          <option value="decidida">Decidida</option>
                        </select>
                      </label>
                      <label className="flex min-w-0 flex-1 flex-col gap-1 text-[11.5px] text-marca-500">
                        Qué se decidió
                        <input name="decision" defaultValue={d.decision ?? ''} maxLength={1000} className={`${CAMPO_CHICO} w-full`} />
                      </label>
                      <button type="submit" className={BOTON_CHICO}>
                        Guardar
                      </button>
                    </form>
                  </details>
                )}
              </li>
            ))}
          </ul>
        </Seccion>
      )}
    </>
  )
}

/** El estado y la fecha de un hito, para quien actualiza la hoja de ruta. */
function FormularioHito({ id, estado, fecha }: { id: string; estado: string; fecha: string | null }) {
  return (
    <details className="mt-1">
      <summary className="cursor-pointer text-[11.5px] font-medium text-acento-700">Actualizar</summary>
      <form action={actualizarHito} className="mt-1.5 flex flex-wrap items-end gap-2">
        <input type="hidden" name="id" value={id} />
        <label className="flex flex-col gap-1 text-[11.5px] text-marca-500">
          Estado
          <select name="estado" defaultValue={estado} className={CAMPO_CHICO}>
            {Object.entries(ESTADO_HITO).map(([k, v]) => (
              <option key={k} value={k}>
                {v.etiqueta}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-[11.5px] text-marca-500">
          Fecha
          <input type="date" name="fecha" defaultValue={fecha ?? ''} className={CAMPO_CHICO} />
        </label>
        <button type="submit" className={BOTON_CHICO}>
          Guardar
        </button>
      </form>
    </details>
  )
}
