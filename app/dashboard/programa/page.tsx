import type { Metadata } from 'next'
import { EncabezadoPagina, Insignia, Metrica, type Tono } from '@/components/ui'
import { esEditor, requerirSesion } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import {
  AVISO_RENOVACION,
  BOLSA_MENSUAL,
  CUOTA,
  ENTREGABLES,
  ENTREGABLE_NOTA,
  ESTADOS_HITO,
  IMPUTACIONES,
  IMPUTACION_DETALLE,
  IMPUTACION_TITULO,
  ORDEN_ENTREGABLES,
  ORDEN_PERFILES,
  PERFILES,
  PERFIL_CORTO,
  PERFIL_ROL,
  PERFIL_TRABAJO,
  TIPOS_HITO,
  VENCE,
  consumeBolsa,
  mesDe,
  mesesDelReporte,
  nombreMes,
  type Entregable,
  type EstadoHito,
  type Imputacion,
  type Perfil,
  type TipoHito,
} from '@/lib/programa'
import { TIPOS_SESION, type TipoSesion } from '@/lib/types'
import { formatFecha } from '@/lib/utils'
import { FormularioHoras } from './formulario-horas'

export const metadata: Metadata = { title: 'El programa' }

/**
 * ⚠️ **Esta página la lee Iberia**, no solo el equipo de Boosty. Es la vista que
 * abre el cliente para saber en qué se le está trabajando: qué horas se le
 * dedicaron, quién las dedicó y cómo va su calendario.
 *
 * De ahí salen tres reglas que conviene no perder:
 *
 * 1. **Nada de dinero en pantalla.** Ni tarifas por perfil, ni valor consumido,
 *    ni el fee. El precio está firmado; un contador de dólares corriendo no
 *    informa, negocia. Las tarifas viven en `lib/programa.ts` y se usan al
 *    escribir el reporte mensual.
 * 2. **Nada de alarmas.** Las horas se administran como promedio dentro de la
 *    fase (cláusula 8) y el riesgo de la implementación es de Boosty (cláusula
 *    5): un mes por encima de la referencia es información, no un problema del
 *    cliente. Se muestra la cifra y se explica; no se le pone un triángulo rojo
 *    ni se pintan las casillas en rojo.
 * 3. **Lo interno va en `PENDIENTES.md`.** Lo que falta por confirmar, quién
 *    debe qué y las estimaciones que hay que revisar no se escriben en la
 *    descripción de un hito.
 *
 * Lo único que se muestra solo a editores es el formulario de carga y la marca
 * de «en riesgo», que es un juicio de seguimiento interno.
 */

const TONO_ESTADO: Record<EstadoHito, Tono> = {
  hecho: 'verde',
  previsto: 'neutro',
  en_riesgo: 'ambar',
  cancelado: 'neutro',
}

const HOY = new Date().toISOString().slice(0, 10)

/** «12,5 h» — coma decimal, y sin decimales cuando es redondo. */
function horas(n: number): string {
  return `${n.toLocaleString('es-VE', { maximumFractionDigits: 2 })} h`
}

/** Días que faltan para una fecha. Negativo = ya pasó. */
function diasHasta(iso: string): number {
  const ms = new Date(`${iso}T12:00:00Z`).getTime() - new Date(`${HOY}T12:00:00Z`).getTime()
  return Math.round(ms / 86_400_000)
}

/**
 * Cómo se nombra a quien hizo el trabajo.
 *
 * En el registro, `persona` es «Boosty» cuando la partida es trabajo de taller
 * —desarrollo, lectura de transcripciones, redacción— que no lo hizo una sola
 * persona. Atribuírselo a alguien sería inventar; dejarlo como «Boosty» a secas,
 * al lado de nombres propios, se lee como un hueco.
 */
function comoSeLlama(persona: string | null): string {
  if (!persona || persona === 'Boosty') return 'Equipo Boosty'
  return persona
}

const NOTA_EQUIPO =
  'Trabajo de taller —desarrollo, lectura de transcripciones y redacción— que no ' +
  'corresponde a una sola persona.'

type Evento = {
  origen: string | null
  id: string | null
  fecha: string | null
  titulo: string | null
  descripcion: string | null
  tipo: string | null
  entregable: string | null
  estado: string | null
  duracion_minutos: number | null
}

/**
 * El hilo une dos cosas con vocabularios distintos: los hitos traen un `tipo` de
 * `TIPOS_HITO` y las sesiones uno de `TIPOS_SESION`. Rotulando solo con el
 * primero, las sesiones caían al valor crudo y salían en minúscula y sin tilde
 * —«entrevista», «reunion», «formacion»— al lado de «Comunicación» y «Decisión».
 */
function comoSeRotula(tipo: string | null): string {
  if (!tipo) return ''
  return TIPOS_HITO[tipo as TipoHito] ?? TIPOS_SESION[tipo as TipoSesion] ?? tipo
}

/**
 * Una casilla del cuadro: las horas y, debajo, la diferencia contra la cuota.
 *
 * La diferencia se escribe —«+34», «−2»— en vez de pintarse. En rojo se leería
 * como error, y aquí no lo es: la cláusula 8 administra las horas como promedio
 * dentro de la fase y la 5 pone el riesgo de la implementación del lado de
 * Boosty, así que un mes por encima es información. Lo que sí se distingue es
 * por **forma**: quien se pasa va en seminegrita, para poder encontrarlo de un
 * barrido sin que la tabla grite.
 */
function Casilla({
  horas: h,
  cuota,
  mide,
  corrido,
  total,
}: {
  horas: number
  cuota: number
  mide: boolean
  corrido: boolean
  total?: boolean
}) {
  const delta = h - cuota
  return (
    <td className="px-4 py-3 text-right align-top">
      <span
        className={`block tabular-nums ${
          !corrido
            ? 'text-marca-400'
            : total || (mide && delta > 0)
              ? 'font-semibold text-marca-900'
              : 'text-marca-800'
        }`}
      >
        {h ? h.toLocaleString('es-VE', { maximumFractionDigits: 2 }) : '—'}
      </span>
      {mide && corrido && h > 0 && delta !== 0 && (
        <span className="mt-0.5 block text-xs tabular-nums text-marca-500">
          {delta > 0 ? '+' : '−'}
          {Math.abs(delta).toLocaleString('es-VE', { maximumFractionDigits: 2 })}
        </span>
      )}
    </td>
  )
}

/**
 * El hilo, agrupado por mes. Con más de cuarenta entradas —cada sesión del
 * levantamiento es una— un hilo corrido no se puede recorrer: el mes es la
 * unidad con la que el cliente piensa su programa, y es también la unidad con la
 * que se factura.
 */
function Hilo({ eventos, marcarRiesgo }: { eventos: Evento[]; marcarRiesgo: boolean }) {
  const meses: { mes: string; eventos: Evento[] }[] = []
  for (const ev of eventos) {
    const mes = ev.fecha ? mesDe(ev.fecha) : 'sin-fecha'
    const ultimo = meses.at(-1)
    if (ultimo?.mes === mes) ultimo.eventos.push(ev)
    else meses.push({ mes, eventos: [ev] })
  }

  return (
    <div className="flex flex-col gap-6">
      {meses.map(({ mes, eventos: delMes }) => (
        <div key={mes}>
          <p className="mb-3 text-xs font-semibold tracking-wide text-marca-400 uppercase">
            {mes === 'sin-fecha' ? 'Sin fecha' : nombreMes(mes)}
            <span className="ml-2 font-normal normal-case">
              · {delMes.length} {delMes.length === 1 ? 'entrada' : 'entradas'}
            </span>
          </p>
          <ol className="relative border-l border-marca-200 pl-6">
            {delMes.map((ev) => {
              const futuro = (ev.fecha ?? '') > HOY
              const enRiesgo = marcarRiesgo && ev.estado === 'en_riesgo'
              return (
                <li key={`${ev.origen}-${ev.id}`} className="relative pb-6 last:pb-0">
                  <span
                    className={`absolute top-1.5 -left-[27px] h-2.5 w-2.5 rounded-full border-2 border-white ${
                      enRiesgo ? 'bg-amber-400' : futuro ? 'bg-marca-300' : 'bg-acento-500'
                    }`}
                  />
                  <p className="text-xs text-marca-500">{formatFecha(ev.fecha)}</p>
                  <p className="mt-0.5 flex flex-wrap items-baseline gap-2">
                    <span className="font-semibold text-marca-900">{ev.titulo}</span>
                    {ev.duracion_minutos && (
                      <span className="text-xs text-marca-500">{ev.duracion_minutos} min</span>
                    )}
                  </p>
                  {ev.descripcion && (
                    <p className="mt-1 max-w-3xl text-sm text-marca-600">{ev.descripcion}</p>
                  )}
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <Insignia tono="neutro">{comoSeRotula(ev.tipo)}</Insignia>
                    {ev.entregable && (
                      <Insignia tono="marca">
                        {ENTREGABLES[ev.entregable as Entregable] ?? ev.entregable}
                      </Insignia>
                    )}
                    {/* «En riesgo» es un juicio de seguimiento interno: para el
                        cliente, un previsto con su fecha ya dice lo que hay que
                        saber. La urgencia se transmite con el plazo. */}
                    {ev.estado === 'previsto' && (
                      <Insignia tono="neutro">{ESTADOS_HITO.previsto}</Insignia>
                    )}
                    {enRiesgo && (
                      <Insignia tono={TONO_ESTADO.en_riesgo}>{ESTADOS_HITO.en_riesgo}</Insignia>
                    )}
                    {!marcarRiesgo && ev.estado === 'en_riesgo' && (
                      <Insignia tono="neutro">{ESTADOS_HITO.previsto}</Insignia>
                    )}
                  </div>
                </li>
              )
            })}
          </ol>
        </div>
      ))}
    </div>
  )
}

export default async function ProgramaPage() {
  const sesion = await requerirSesion()
  const puedeEditar = esEditor(sesion.perfil)
  const supabase = await createClient()

  const [{ data: linea }, { data: registros }] = await Promise.all([
    supabase.from('linea_de_tiempo').select('*').order('fecha', { ascending: false }),
    supabase.from('registros_horas').select('*').order('fecha', { ascending: false }),
  ])

  const eventos = linea ?? []
  const horasCargadas = registros ?? []

  // Lo que viene, de más cerca a más lejos; lo hecho, de lo último a lo primero.
  // Con dos entradas el mismo día, el vencimiento de contrato va de último: leer
  // «vence el aviso de renovación» antes que «se entrega la arquitectura»
  // invierte la historia, y las dos caen el 6 de diciembre.
  const orden = (e: Evento) => `${e.fecha}-${e.tipo === 'contrato' ? '1' : '0'}`
  const porVenir = eventos
    .filter((e) => (e.fecha ?? '') > HOY)
    .sort((a, b) => orden(a).localeCompare(orden(b)))
  const hecho = eventos.filter((e) => (e.fecha ?? '') <= HOY)
  const sesionesDeTrabajo = eventos.filter((e) => e.origen === 'sesion').length

  // --- Consumo por mes --------------------------------------------------------
  // El reporte arranca en el mes más viejo con horas, aunque sea anterior a la
  // firma: el trabajo previo existió y tiene que verse. Lo que no hace es
  // descontarse de la bolsa — ver `consumeBolsa`.
  const primerMes = horasCargadas.reduce(
    (min, r) => (mesDe(r.fecha) < min ? mesDe(r.fecha) : min),
    mesDe(HOY)
  )
  const meses = mesesDelReporte(primerMes)

  // La tabla mensual mide contra la referencia del contrato, así que solo cuenta
  // lo que consume bolsa. El programa de formación de planta se factura aparte:
  // meterlo aquí haría ver un consumo que no es de esta cuenta.
  const enBolsa = (r: { imputacion: string | null }) => (r.imputacion ?? 'bolsa') === 'bolsa'

  // Por mes **y por perfil**: es el cuadro que el contrato define, y es el que
  // dice en qué mes se pasó un perfil y en cuál otro se quedó corto. Un total
  // mensual solo no lo dice: 137 h pueden ser cualquier reparto.
  const vacio = (): Record<Perfil, number> => ({
    consultor_senior: 0,
    director_arquitecto: 0,
    consultor_procesos: 0,
    desarrollador_ia: 0,
  })
  const porMes = new Map<string, Record<Perfil, number>>(meses.map((m) => [m, vacio()]))
  for (const r of horasCargadas) {
    if (!enBolsa(r)) continue
    const fila = porMes.get(mesDe(r.fecha))
    if (fila) fila[r.perfil as Perfil] += Number(r.horas)
  }
  const totalDelMes = (m: string) =>
    ORDEN_PERFILES.reduce((t, p) => t + (porMes.get(m)?.[p] ?? 0), 0)

  const imputacionDe = (r: { imputacion: string | null }) =>
    (r.imputacion ?? 'bolsa') as Imputacion

  const deLaFase = horasCargadas.filter((r) => consumeBolsa(mesDe(r.fecha)) && enBolsa(r))

  // La etapa anterior son dos cosas: lo de antes del mes de la firma, y lo que
  // cae dentro de ese mes pero es cierre de la etapa anterior —el deck de la
  // sesión de lanzamiento, la negociación del contrato—. Sin lo segundo, el
  // trabajo del 1 al 5 de agosto se cobraría dos veces, porque el corte de
  // `consumeBolsa()` va por mes calendario y no por día.
  const previas = horasCargadas.filter(
    (r) => !consumeBolsa(mesDe(r.fecha)) || imputacionDe(r) === 'fase_0'
  )
  const aparte = horasCargadas.filter(
    (r) => consumeBolsa(mesDe(r.fecha)) && !enBolsa(r) && imputacionDe(r) !== 'fase_0'
  )

  const suma = (l: typeof horasCargadas) => l.reduce((t, r) => t + Number(r.horas), 0)
  const totalHoras = suma(deLaFase)
  const totalPrevias = suma(previas)

  // Y lo que se factura aparte, agrupado por su motivo: hoy es solo el curso de
  // planta, pero `adicional` existe y no se puede meter en la misma tarjeta.
  const bolsasAparte = [...new Set(aparte.map(imputacionDe))].map((imp) => ({
    imp,
    horas: suma(aparte.filter((r) => imputacionDe(r) === imp)),
  }))

  // Meses ya empezados: es contra eso que se mide el promedio de fase, no contra
  // los cinco completos (cláusula 8, «como promedio dentro de cada fase»).
  const mesesCorridos = meses.filter((m) => consumeBolsa(m) && m <= mesDe(HOY)).length

  // --- Quién dedicó las horas -------------------------------------------------
  const porPersona = new Map<string, { horas: number; perfiles: Set<Perfil> }>()
  for (const r of deLaFase) {
    const clave = comoSeLlama(r.persona)
    const ficha = porPersona.get(clave) ?? { horas: 0, perfiles: new Set<Perfil>() }
    ficha.horas += Number(r.horas)
    ficha.perfiles.add(r.perfil as Perfil)
    porPersona.set(clave, ficha)
  }
  const gente = [...porPersona].sort((a, b) => b[1].horas - a[1].horas)

  // --- Horas por entregable ---------------------------------------------------
  // Solo las de la fase, igual que el resto de la página. Metiendo la etapa
  // anterior y el programa de planta, las tres secciones daban tres totales
  // distintos del mismo trabajo y ninguna cuadraba con la cifra de arriba —y
  // «Dirección, gobierno y reportería» se llevaba 172 h, que es la propuesta y
  // las demos de la etapa anterior, no la gestión de esta fase.
  const porEntregable = new Map<Entregable, number>()
  for (const r of deLaFase) {
    const e = r.entregable as Entregable
    porEntregable.set(e, (porEntregable.get(e) ?? 0) + Number(r.horas))
  }

  // Y lo que se factura aparte, por entregable: sin esto el programa de planta
  // marcaba un guion al lado de una tarjeta que dice «104 h», arriba en la misma
  // pantalla.
  const aparteDe = new Map<Entregable, number>()
  for (const r of aparte) {
    const e = r.entregable as Entregable
    aparteDe.set(e, (aparteDe.get(e) ?? 0) + Number(r.horas))
  }

  const diasArquitectura = diasHasta(VENCE.arquitectura ?? AVISO_RENOVACION)

  return (
    <>
      <EncabezadoPagina
        rotulo="El programa"
        titulo="Cómo va el programa"
        descripcion={
          <>
            El calendario de la Fase 1 y las horas que el equipo de Boosty le ha dedicado:
            en qué se fueron, quién las dedicó y qué queda por delante.
          </>
        }
      />

      {/* --- Las cuatro cifras que contestan «¿en qué están?» --------------- */}
      <section className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metrica valor={horas(totalHoras)} etiqueta="Dedicadas a la Fase 1" />
        <Metrica valor={sesionesDeTrabajo} etiqueta="Sesiones de trabajo" />
        <Metrica
          valor={horas(BOLSA_MENSUAL)}
          etiqueta={`Referencia del contrato · al mes`}
        />
        <Metrica
          valor={diasArquitectura}
          sufijo="días"
          etiqueta="Para el Documento de Arquitectura"
        />
      </section>

      {/* Informativo y sin alarma: qué significa la referencia mensual y por qué
          un mes puede ir por encima. */}
      <div className="tarjeta mb-10 p-5 text-sm leading-relaxed text-marca-700">
        <p>
          El contrato dispone un equipo multidisciplinario con una referencia de{' '}
          <strong>{BOLSA_MENSUAL} horas al mes</strong>, que se administra{' '}
          <strong>como promedio dentro de la fase</strong>: unos meses van por encima y
          otros por debajo, y lo que cuenta es el conjunto de los cinco.
        </p>
        <p className="mt-3">
          {mesesCorridos === 1 ? 'El primer mes' : `Los primeros ${mesesCorridos} meses`} de
          la fase concentró el arranque: los dos rodajes de entrevistas en Cagua, la primera
          formación de la directiva y el desarrollo del aplicativo cayeron todos aquí. De
          aquí a diciembre el peso se mueve hacia la consultoría y la redacción del{' '}
          <strong>Documento de Arquitectura de IA</strong>, que se entrega el{' '}
          {formatFecha(VENCE.arquitectura)}: el calendario se adelantó un mes respecto de la
          propuesta para que el comité pueda decidir la continuidad con el documento en la
          mano y no de memoria.
        </p>
      </div>

      {/* --- Mes a mes, perfil por perfil -----------------------------------
          El cuadro que define el contrato. Se lee de dos maneras: hacia abajo,
          cómo va cada perfil mes a mes; y a lo ancho, cómo se repartió un mes.
          La diferencia contra la cuota va escrita en la casilla —«+34», «−2»—
          porque es lo que se quiere saber y es aritmética, no una alarma. */}
      <section className="mb-10">
        <h2 className="mb-1 text-lg font-semibold text-marca-900">
          Mes a mes, perfil por perfil
        </h2>
        <p className="mb-4 text-sm text-marca-600">
          Cada perfil tiene su cuota mensual, y las cuatro suman las {BOLSA_MENSUAL} horas de
          referencia. Debajo de cada cifra va la diferencia contra esa cuota, para ver en qué
          mes se pasa un perfil y en cuál se queda corto.
        </p>
        <div className="tarjeta overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-marca-200 text-left text-xs tracking-wide text-marca-500 uppercase">
                <th className="px-4 py-3 font-medium">Mes</th>
                {ORDEN_PERFILES.map((p) => (
                  <th key={p} className="px-4 py-3 text-right font-medium">
                    {PERFIL_CORTO[p]}
                    <span className="ml-1 font-normal normal-case">/{CUOTA[p]} h</span>
                  </th>
                ))}
                <th className="px-4 py-3 text-right font-medium">
                  Total
                  <span className="ml-1 font-normal normal-case">/{BOLSA_MENSUAL} h</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {meses.map((m) => {
                const fila = porMes.get(m)!
                const total = totalDelMes(m)
                const corrido = m <= mesDe(HOY)
                // Lo previo a la firma se muestra pero no se mide contra la
                // cuota: es trabajo de la etapa anterior, facturado aparte.
                const cuenta = consumeBolsa(m)
                return (
                  <tr key={m} className="border-b border-marca-100 last:border-0">
                    {/* `capitalize` de Tailwind sube todas las palabras y deja
                        «Agosto De 2026». */}
                    <td
                      className={`px-4 py-3 align-top font-medium first-letter:uppercase ${
                        corrido ? 'text-marca-800' : 'text-marca-400'
                      }`}
                    >
                      {nombreMes(m)}
                      {!cuenta && (
                        <span className="block text-xs font-normal text-marca-500">
                          Etapa anterior
                        </span>
                      )}
                    </td>
                    {ORDEN_PERFILES.map((p) => (
                      <Casilla
                        key={p}
                        horas={fila[p]}
                        cuota={CUOTA[p]}
                        mide={cuenta}
                        corrido={corrido}
                      />
                    ))}
                    <Casilla
                      horas={total}
                      cuota={BOLSA_MENSUAL}
                      mide={cuenta}
                      corrido={corrido}
                      total
                    />
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-marca-500">
          Un perfil por encima de su cuota en un mes no se compensa con otro perfil: lo que se
          administra como promedio es <strong>el conjunto dentro de la fase</strong>, no la
          casilla del mes. Por eso lo que hay que leer es la columna del total y su acumulado.
        </p>

        {(totalPrevias > 0 || bolsasAparte.length > 0) && (
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {totalPrevias > 0 && (
              <div className="tarjeta p-4 text-sm text-marca-600">
                <p className="font-semibold text-marca-900">
                  {horas(totalPrevias)} {IMPUTACION_TITULO.fase_0}
                </p>
                <p className="mt-1">{IMPUTACION_DETALLE.fase_0}</p>
              </div>
            )}
            {bolsasAparte.map(({ imp, horas: h }) => (
              <div key={imp} className="tarjeta p-4 text-sm text-marca-600">
                <p className="font-semibold text-marca-900">
                  {horas(h)} {IMPUTACION_TITULO[imp] ?? IMPUTACIONES[imp]}
                </p>
                <p className="mt-1">{IMPUTACION_DETALLE[imp] ?? IMPUTACIONES[imp]}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* --- Quién ----------------------------------------------------------- */}
      <section className="mb-10">
        <h2 className="mb-1 text-lg font-semibold text-marca-900">Quién dedicó las horas</h2>
        <p className="mb-4 text-sm text-marca-600">
          Las {horas(totalHoras)} de la Fase 1, por quien las trabajó.
        </p>
        <div className="tarjeta divide-y divide-marca-100">
          {gente.map(([nombre, ficha]) => (
            <div key={nombre} className="flex items-baseline gap-4 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-marca-900">{nombre}</p>
                <p className="mt-0.5 text-xs text-marca-500">
                  {nombre === 'Equipo Boosty'
                    ? NOTA_EQUIPO
                    : [...ficha.perfiles]
                        .sort(
                          (a, b) => ORDEN_PERFILES.indexOf(a) - ORDEN_PERFILES.indexOf(b)
                        )
                        .map((p) => PERFIL_TRABAJO[p])
                        .join(' · ')}
                </p>
              </div>
              <p className="shrink-0 text-sm font-semibold tabular-nums text-marca-900">
                {horas(ficha.horas)}
              </p>
            </div>
          ))}
        </div>

        <h3 className="mt-6 mb-3 text-sm font-semibold text-marca-800">
          Qué hace cada papel del equipo
        </h3>
        <dl className="grid gap-3 sm:grid-cols-2">
          {ORDEN_PERFILES.map((p) => (
            <div key={p} className="tarjeta p-4">
              <dt className="text-sm font-medium text-marca-900">{PERFILES[p]}</dt>
              <dd className="mt-1 text-xs text-marca-600">{PERFIL_ROL[p]}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* --- En qué se fueron ------------------------------------------------ */}
      <section className="mb-10">
        <h2 className="mb-1 text-lg font-semibold text-marca-900">En qué se fueron</h2>
        <p className="mb-4 text-sm text-marca-600">
          Las {horas(totalHoras)} de la Fase 1 repartidas por entregable, cada uno con la
          fecha en que se compromete.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          {ORDEN_ENTREGABLES.map((e) => {
            const h = porEntregable.get(e) ?? 0
            const fuera = aparteDe.get(e) ?? 0
            const vence = VENCE[e]
            const dias = vence ? diasHasta(vence) : null
            return (
              <div key={e} className="tarjeta flex items-baseline justify-between gap-4 p-4">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-marca-800">{ENTREGABLES[e]}</p>
                  <p className="mt-0.5 text-xs text-marca-500">
                    {vence ? (
                      <>
                        Se entrega el {formatFecha(vence)}
                        {dias !== null && dias >= 0 && ` · faltan ${dias} días`}
                      </>
                    ) : (
                      ENTREGABLE_NOTA.gestion
                    )}
                  </p>
                  {fuera > 0 && (
                    <p className="mt-1 text-xs text-marca-500">
                      Más <strong>{horas(fuera)}</strong> que se facturan aparte, en la Fase 2.
                    </p>
                  )}
                </div>
                <span className="shrink-0 text-sm font-semibold tabular-nums text-marca-900">
                  {h ? horas(h) : '—'}
                </span>
              </div>
            )
          })}
        </div>
      </section>

      {/* --- Cargar horas · solo editores ------------------------------------ */}
      {puedeEditar && (
        <section className="mb-10">
          <h2 className="mb-1 text-lg font-semibold text-marca-900">Cargar horas</h2>
          <p className="mb-4 text-sm text-marca-600">
            Solo lo ve el equipo de Boosty. Cada partida dice de dónde sale su número, que
            es lo que permite corregirla después.
          </p>
          <FormularioHoras />
        </section>
      )}

      {/* --- La línea de tiempo ----------------------------------------------
          Partida en dos y en sentidos opuestos: lo que viene se lee de más
          cerca a más lejos, y lo hecho de lo último a lo primero. En un solo
          hilo descendente, lo primero que se ve es enero de 2027, que no le
          sirve a nadie. */}
      <section>
        <h2 className="mb-1 text-lg font-semibold text-marca-900">Lo que viene</h2>
        <p className="mb-4 text-sm text-marca-600">
          El calendario se adelantó un mes respecto de la propuesta, para que el Documento de
          Arquitectura esté sobre la mesa cuando Iberia decida la continuidad.
        </p>
        <Hilo eventos={porVenir} marcarRiesgo={puedeEditar} />
      </section>

      <section className="mt-10">
        <h2 className="mb-1 text-lg font-semibold text-marca-900">Lo hecho</h2>
        <p className="mb-4 text-sm text-marca-600">
          {hecho.length} {hecho.length === 1 ? 'entrada' : 'entradas'}, de la más reciente a
          la primera. Cada entrevista, recorrido y formación queda registrada con su fecha y
          su duración.
        </p>
        <Hilo eventos={hecho} marcarRiesgo={puedeEditar} />
      </section>

      <p className="mt-10 text-xs text-marca-500">
        Fase 1 · Entender · contrato CONT-2026-08-0002, cláusula 8. Referencia de{' '}
        {BOLSA_MENSUAL} horas al mes, administradas como promedio dentro de la fase.
      </p>
    </>
  )
}
