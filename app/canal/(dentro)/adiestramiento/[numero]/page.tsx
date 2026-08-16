import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import guion from '@/contenido/adiestramiento/guion.json'
import { AudioAjito } from '@/components/canal/audio-ajito'
import { DevolucionAjito } from '@/components/canal/devolucion-ajito'
import { EntradaRespuesta } from '@/components/canal/entrada-respuesta'
import { IconoAtras, IconoCheck } from '@/components/iconos'
import {
  CURSO,
  ejerciciosDeLeccion,
  minutosTexto,
  preguntaDeCampo,
  TIPOS_ENTRADA,
  type Ejercicio as EjercicioCatalogo,
  type FamiliaOficio,
  type FormaIA,
} from '@/lib/adiestramiento'
import { requerirEmpleado } from '@/lib/canal'
import { esSalida, segunInterruptor, turnosDe, type LeccionGuion, type Turno } from '@/lib/guion'
import { createClient } from '@/lib/supabase/server'
import { avanzarPaso, empezarLeccion, terminarLeccion } from '../acciones'

export const metadata: Metadata = { title: 'Lección' }

const LECCIONES = guion.lecciones as LeccionGuion[]

/** Lo que ya contestó, y lo que Ajito le contestó a eso. */
type Contestada = {
  clave_paso: string
  texto: string | null
  devolucion: string | null
  devolucion_audio: string | null
  /** Cuándo se le pidió. Con fecha y sin texto: se intentó y no salió. */
  devolucion_en: string | null
}

export default async function LeccionPage({
  params,
}: PageProps<'/canal/adiestramiento/[numero]'>) {
  const { numero: crudo } = await params
  const numero = Number(crudo)
  if (!Number.isInteger(numero) || numero < 0) notFound()

  const empleado = await requerirEmpleado()
  const supabase = await createClient()

  const { data: curso } = await supabase
    .from('cursos')
    .select('*')
    .eq('clave', CURSO)
    .maybeSingle()
  if (!curso?.abierto) notFound()

  const [{ data: leccion }, { data: matricula }] = await Promise.all([
    supabase
      .from('lecciones')
      .select('*')
      .eq('curso_id', curso.id)
      .eq('numero', numero)
      .eq('activa', true)
      .maybeSingle(),
    supabase
      .from('matriculas')
      .select('*')
      .eq('curso_id', curso.id)
      .eq('empleado_id', empleado.id)
      .maybeSingle(),
  ])

  if (!leccion || !matricula) notFound()

  const forma = leccion.forma as FormaIA
  const familia = matricula.familia_oficio as FamiliaOficio
  const nombre = matricula.nombre_corto ?? empleado.nombre_completo.split(' ')[0]

  const [{ data: avance }, { data: respuestas }] = await Promise.all([
    supabase
      .from('avances')
      .select('*')
      .eq('matricula_id', matricula.id)
      .eq('leccion_id', leccion.id)
      .maybeSingle(),
    supabase
      .from('respuestas')
      .select('clave_paso, texto, devolucion, devolucion_audio, devolucion_en')
      .eq('matricula_id', matricula.id)
      .eq('leccion_id', leccion.id)
      .order('created_at'),
  ])

  const contestadas = new Map((respuestas ?? []).map((r) => [r.clave_paso, r]))

  // A cuál le toca pedirle la devolución a Ajito. Solo una a la vez: quien abre
  // una lección con varias respuestas viejas sin contestar no puede disparar
  // cuatro llamadas al modelo de golpe. Van cayendo de arriba abajo.
  //
  // Las que ya se intentaron y fallaron quedan fuera de la cola —tienen fecha
  // pero no texto—: si no, una sola caída congelaría el resto de la lección
  // detrás de ella. Esas muestran su botón y se reintentan a mano.
  const siguienteSinDevolucion =
    (respuestas ?? []).find((r) => r.texto && !r.devolucion && !r.devolucion_en)?.clave_paso ??
    null

  // El recorrido sale del guion; las consignas, del catálogo por oficio. Son dos
  // fuentes a propósito: el guion manda el orden y lo que Ajito dice, y
  // `lib/adiestramiento.ts` decide qué se le pide a un montacarguista y qué a
  // una cocinera. `generar:guion` comprueba que las dos estén de acuerdo.
  const enGuion = LECCIONES.find((l) => l.numero === numero)
  const turnos = enGuion ? turnosDe(enGuion) : []
  const catalogo = new Map(ejerciciosDeLeccion(forma, familia).map((e) => [e.clave, e]))
  const pregunta = preguntaDeCampo(forma, familia)

  // Hasta dónde ha llegado. Se muestran los turnos anteriores completos —como
  // en un chat, donde lo dicho sigue arriba— y el actual esperando.
  const hasta = Math.min(avance?.paso ?? 0, Math.max(turnos.length - 1, 0))
  const visibles = turnos.slice(0, hasta + 1)
  const enElUltimo = hasta >= turnos.length - 1

  const pendientes = turnos.filter(
    (t) => t.espera.tipo === 'ejercicio' && t.espera.clave && !contestadas.has(t.espera.clave)
  ).length

  const audios = turnos.reduce(
    (t, x) => t + x.bloques.filter((b) => b.tipo === 'audio').length,
    0
  )

  return (
    <div className="space-y-4">
      <Link
        href="/canal/adiestramiento"
        className="-ml-1 inline-flex min-h-11 items-center gap-1.5 text-[14px] font-medium text-marca-500 active:text-marca-800"
      >
        <IconoAtras className="h-5 w-5" />
        El curso
      </Link>

      <header className="tarjeta-canal flex items-center gap-4 bg-marca-50/60 px-5 py-4">
        <Image
          src="/marca/ajito.png"
          alt=""
          width={200}
          height={200}
          priority
          className="h-14 w-14 shrink-0 object-contain"
        />
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold tracking-[0.14em] text-acento-600 uppercase">
            Lección {leccion.numero} · {minutosTexto(leccion.minutos)}
          </p>
          <h1 className="text-lg leading-tight font-bold text-marca-900">
            {leccion.titulo}
          </h1>
          {avance && (
            <div className="mt-2 flex items-center gap-2">
              <span className="h-1 flex-1 overflow-hidden rounded-full bg-marca-200/70">
                <span
                  className="block h-full rounded-full bg-acento-600 transition-[width]"
                  style={{ width: `${((hasta + 1) / Math.max(turnos.length, 1)) * 100}%` }}
                />
              </span>
              <span className="shrink-0 text-[12px] tabular-nums text-marca-500">
                {hasta + 1}/{turnos.length}
              </span>
            </div>
          )}
        </div>
      </header>

      {!avance ? (
        <>
          <p className="px-1 text-[15px] leading-relaxed text-marca-600">
            {audios} audios de Ajito. Puedes parar cuando quieras: cuando vuelvas,
            sigues donde te quedaste.
          </p>
          <form action={empezarLeccion}>
            <input type="hidden" name="numero" value={numero} />
            <button type="submit" className="btn-canal btn-canal-rojo w-full">
              Empezar la lección
            </button>
          </form>
        </>
      ) : (
        <>
          {visibles.map((turno) => (
            <TurnoVista
              key={turno.indice}
              turno={turno}
              esActual={turno.indice === hasta}
              esFinal={turno.indice === turnos.length - 1}
              pendientes={pendientes}
              numero={numero}
              nombre={nombre}
              asistenteLibre={curso.asistente_libre_activo}
              catalogo={catalogo}
              pregunta={pregunta}
              contestadas={contestadas}
              siguienteSinDevolucion={siguienteSinDevolucion}
            />
          ))}

          {enElUltimo && turnos[hasta]?.espera.tipo !== 'botones' && (
            <form action={terminarLeccion} className="pt-2">
              <input type="hidden" name="numero" value={numero} />
              <button
                type="submit"
                disabled={pendientes > 0}
                className="btn-canal btn-canal-rojo w-full"
              >
                {avance.estado === 'completada'
                  ? 'Seguir a la siguiente'
                  : 'Terminar la lección'}
              </button>
              {pendientes > 0 && (
                <p className="mt-2 text-center text-[13px] text-marca-400">
                  Te falta{pendientes > 1 ? 'n' : ''} {pendientes}{' '}
                  {pendientes > 1 ? 'cosas' : 'cosa'} por contestar más arriba.
                </p>
              )}
            </form>
          )}
        </>
      )}
    </div>
  )
}

function TurnoVista({
  turno,
  esActual,
  esFinal,
  pendientes,
  numero,
  nombre,
  asistenteLibre,
  catalogo,
  pregunta,
  contestadas,
  siguienteSinDevolucion,
}: {
  turno: Turno
  esActual: boolean
  /** El último turno de la lección: sus botones cierran, no adelantan. */
  esFinal: boolean
  pendientes: number
  numero: number
  nombre: string
  asistenteLibre: boolean
  catalogo: Map<string, EjercicioCatalogo>
  pregunta: string | null
  contestadas: Map<string, Contestada>
  /** La única clave que puede pedirle devolución a Ajito ahora mismo. */
  siguienteSinDevolucion: string | null
}) {
  const bloques = segunInterruptor(turno.bloques, asistenteLibre)
  const primerAudio = bloques.findIndex((b) => b.tipo === 'audio')

  return (
    <section className="space-y-3">
      {bloques.map((bloque, i) => {
        if (bloque.tipo === 'audio') {
          return (
            <AudioAjito
              key={i}
              src={`/canal/adiestramiento/${numero}/audio/${bloque.id}`}
              // El título de la sección solo va en el primer audio que la
              // abre. Ni el segundo audio del mismo turno ni el turno que
              // retoma la misma sección lo repiten: dos rótulos iguales
              // seguidos se leen como un error.
              etiqueta={i === primerAudio && !turno.continuacion ? turno.titulo : 'Ajito sigue'}
              segundos={bloque.segundos}
            />
          )
        }

        if (bloque.tipo === 'texto') {
          // Cuando el turno termina en ejercicio, esta línea dice lo mismo que
          // la consigna de la tarjeta —«Mándame una nota de voz» y debajo
          // «Nancy, mándame una nota de voz contándome…»—. En el chat del guion
          // hace falta porque el input va aparte; aquí sobra.
          if (turno.espera.tipo === 'ejercicio') return null
          return (
            <p key={i} className="px-1 text-[15px] leading-relaxed text-marca-700">
              {bloque.texto}
            </p>
          )
        }

        // La ficha de bolsillo es lo que la persona se guarda en la galería y
        // vuelve a mirar en el bus dos semanas después. Las demás piezas —la
        // portada cuadrada, las fotos autorizadas— no se dibujan: la portada ya
        // la hace el encabezado de arriba, y las fotos están por tomar en Cagua.
        if (bloque.tipo === 'pieza' && bloque.clase === 'ficha' && bloque.lineas.length > 1) {
          return (
            <FichaVista
              key={i}
              numero={numero}
              pieza={`${String(numero).padStart(2, '0')}${bloque.sufijo}`}
              titulo={bloque.lineas[0]}
            />
          )
        }

        return null
      })}

      {turno.espera.tipo === 'botones' && esActual && (
        <div className="flex flex-wrap gap-2">
          {turno.espera.opciones.map((opcion) =>
            esSalida(opcion) ? (
              <Link
                key={opcion}
                href="/canal/adiestramiento"
                className="btn-canal btn-canal-suave flex-1"
              >
                {opcion}
              </Link>
            ) : (
              // En el último turno, «Sigo ahora» ES terminar la lección: poner
              // debajo otro botón que dice lo mismo es preguntar dos veces.
              <form
                key={opcion}
                action={esFinal ? terminarLeccion : avanzarPaso}
                className="min-w-[45%] flex-1"
              >
                <input type="hidden" name="numero" value={numero} />
                <input type="hidden" name="turno" value={turno.indice} />
                <button
                  type="submit"
                  disabled={esFinal && pendientes > 0}
                  className="btn-canal btn-canal-rojo w-full"
                >
                  {opcion}
                </button>
              </form>
            )
          )}
        </div>
      )}

      {turno.espera.tipo === 'botones' && esActual && esFinal && pendientes > 0 && (
        <p className="text-center text-[13px] text-marca-400">
          Te falta{pendientes > 1 ? 'n' : ''} {pendientes}{' '}
          {pendientes > 1 ? 'cosas' : 'cosa'} por contestar más arriba.
        </p>
      )}

      {turno.espera.tipo === 'ejercicio' && turno.espera.clave && (
        <EjercicioVista
          numero={numero}
          nombre={nombre}
          clave={turno.espera.clave}
          catalogo={catalogo}
          pregunta={pregunta}
          respuesta={contestadas.get(turno.espera.clave) ?? null}
          leToca={turno.espera.clave === siguienteSinDevolucion}
        />
      )}
    </section>
  )
}

/**
 * La ficha de bolsillo.
 *
 * Sale a lo ancho y sin recortar, porque el gesto que tiene que provocar es
 * mantener el dedo encima y darle a guardar. Va con `unoptimized` a propósito:
 * el optimizador de Next se comería el PNG que acaba de generarse a medida y
 * dejaría en la galería de la persona una versión reescalada.
 */
function FichaVista({
  numero,
  pieza,
  titulo,
}: {
  numero: number
  pieza: string
  titulo: string
}) {
  return (
    <figure className="space-y-2" data-ficha={pieza}>
      <Image
        src={`/canal/adiestramiento/${numero}/ficha/${pieza}`}
        alt={`Ficha de bolsillo: ${titulo}`}
        width={1080}
        height={1920}
        unoptimized
        className="w-full rounded-2xl border border-marca-200/60"
      />
      <figcaption className="px-1 text-[13px] text-marca-400">
        Déjale el dedo encima y guárdala en tu galería.
      </figcaption>
    </figure>
  )
}

function EjercicioVista({
  numero,
  nombre,
  clave,
  catalogo,
  pregunta,
  respuesta,
  leToca,
}: {
  numero: number
  nombre: string
  clave: string
  catalogo: Map<string, EjercicioCatalogo>
  pregunta: string | null
  respuesta: Contestada | null
  /** Si es a este ejercicio al que le toca pedirle la devolución a Ajito. */
  leToca: boolean
}) {
  const esCampo = clave === 'campo'
  const delCatalogo = catalogo.get(clave)
  const consigna = esCampo ? pregunta : delCatalogo?.consigna
  if (!consigna) return null

  const hecha = respuesta !== null

  return (
    // `data-ejercicio` no pinta nada: lo lee `capturar:oficios` para comprobar
    // que a cada oficio le llega su consigna y no la de otro.
    <div className="tarjeta-canal px-5 py-4" data-ejercicio={clave} data-hecha={hecha ? 'si' : 'no'}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-[11px] font-bold tracking-[0.12em] text-marca-400 uppercase">
          {esCampo
            ? 'La pregunta de hoy'
            : `Te toca · ${TIPOS_ENTRADA[delCatalogo!.entrada]}`}
        </p>
        {hecha && (
          <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-acento-600 text-white">
            <IconoCheck className="h-4 w-4" />
          </span>
        )}
      </div>

      <p data-consigna className="mt-2 text-[15px] leading-relaxed text-marca-800">
        {esCampo ? consigna : `${nombre}, ${minuscula(consigna)}`}
      </p>

      {delCatalogo?.aviso && !hecha && (
        <p className="mt-2 rounded-xl bg-oro-300/25 px-3 py-2 text-[13px] leading-relaxed text-marca-700">
          {delCatalogo.aviso}
        </p>
      )}

      {respuesta ? (
        <>
          {/* Lo que dijo la persona va sangrado y en gris: es la cita de lo
              suyo. Lo que contesta Ajito va debajo, con su voz. */}
          <p className="mt-3 border-l-2 border-marca-200 pl-3 text-[14px] leading-relaxed text-marca-500">
            {respuesta.texto}
          </p>
          <DevolucionAjito
            numero={numero}
            clave={clave}
            texto={respuesta.devolucion}
            tieneAudio={Boolean(respuesta.devolucion_audio)}
            autoPedir={leToca}
            intentada={Boolean(respuesta.devolucion_en)}
          />
        </>
      ) : (
        <EntradaRespuesta
          numero={numero}
          clave={clave}
          // La pregunta de campo se pide siempre hablando: es la más larga y la
          // que más cuesta escribir en un teléfono.
          entrada={esCampo ? 'voz' : (delCatalogo?.entrada ?? 'texto')}
          esCampo={esCampo}
        />
      )}
    </div>
  )
}

/** «Tómate una foto» → «Yuli, tómate una foto». */
function minuscula(texto: string): string {
  const [primera, ...resto] = texto
  return primera ? primera.toLowerCase() + resto.join('') : texto
}
