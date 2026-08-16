import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { IconoCheck, IconoReloj } from '@/components/iconos'
import {
  CURSO,
  FORMA_GANCHO,
  FORMAS_IA,
  minutosTexto,
  type FormaIA,
} from '@/lib/adiestramiento'
import { requerirEmpleado } from '@/lib/canal'
import { createClient } from '@/lib/supabase/server'
import { cn } from '@/lib/utils'

export const metadata: Metadata = { title: 'Conoce a Ajito' }

export default async function AdiestramientoPage() {
  const empleado = await requerirEmpleado()
  const supabase = await createClient()

  const { data: curso } = await supabase
    .from('cursos')
    .select('*')
    .eq('clave', CURSO)
    .maybeSingle()

  if (!curso) return <Aviso titulo="El curso todavía no está listo" />

  const [{ data: lecciones }, { data: matricula }] = await Promise.all([
    supabase
      .from('lecciones')
      .select('*')
      .eq('curso_id', curso.id)
      .eq('activa', true)
      .order('numero'),
    supabase
      .from('matriculas')
      .select('*')
      .eq('curso_id', curso.id)
      .eq('empleado_id', empleado.id)
      .maybeSingle(),
  ])

  // Sin matrícula no es un error: es que a esta persona todavía no le toca.
  // Las gerencias y jefaturas van a las formaciones presenciales.
  if (!matricula) {
    return (
      <Aviso
        titulo="Este curso no es para tu nivel"
        detalle="El adiestramiento por el teléfono es para el personal de planta y administrativo. A ti te toca una formación presencial."
      />
    )
  }

  if (!curso.abierto) {
    return (
      <Aviso
        titulo="Ajito está terminando de prepararse"
        detalle="Ya tienes tu cupo apartado. Apenas abra, te avisamos por aquí."
        conAjito
      />
    )
  }

  const { data: avances } = await supabase
    .from('avances')
    .select('leccion_id, estado')
    .eq('matricula_id', matricula.id)

  const estadoPorLeccion = new Map(
    (avances ?? []).map((a) => [a.leccion_id, a.estado])
  )

  const total = lecciones?.length ?? 0
  const hechas = (avances ?? []).filter((a) => a.estado === 'completada').length

  // La siguiente es la primera sin completar. Si no queda ninguna, terminó.
  const siguiente = lecciones?.find(
    (l) => estadoPorLeccion.get(l.id) !== 'completada'
  )

  return (
    <div className="space-y-4">
      {/* Portada del curso */}
      <section className="tarjeta-canal overflow-hidden">
        <div className="flex items-center gap-4 border-b border-marca-100 bg-marca-50/60 px-5 py-5">
          <Image
            src="/marca/ajito.png"
            alt="Ajito"
            width={200}
            height={200}
            priority
            className="h-16 w-16 shrink-0 object-contain"
          />
          <div className="min-w-0">
            <p className="text-[11px] font-bold tracking-[0.14em] text-acento-600 uppercase">
              Nuevo Sabor
            </p>
            <h1 className="text-xl leading-tight font-bold text-marca-900">
              {curso.nombre}
            </h1>
            <p className="mt-0.5 text-[13px] text-marca-500">
              {total} clases de tres minutos
            </p>
          </div>
        </div>

        <div className="px-5 py-4">
          <Avance hechas={hechas} total={total} />

          {siguiente ? (
            <Link
              href={`/canal/adiestramiento/${siguiente.numero}`}
              className="btn-canal btn-canal-rojo mt-4 w-full"
            >
              {hechas === 0 ? 'Empezar' : 'Seguir donde quedé'}
            </Link>
          ) : (
            <Link
              href="/canal/adiestramiento/certificado"
              className="btn-canal btn-canal-oro mt-4 w-full"
            >
              Ver mi certificado
            </Link>
          )}
        </div>
      </section>

      {/* Las nueve */}
      <ol className="space-y-2">
        {(lecciones ?? []).map((leccion) => {
          const estado = estadoPorLeccion.get(leccion.id)
          const completada = estado === 'completada'
          const empezada = estado === 'en_curso'
          const esSiguiente = siguiente?.id === leccion.id

          return (
            <li key={leccion.id}>
              <Link
                href={`/canal/adiestramiento/${leccion.numero}`}
                className={cn(
                  'tarjeta-canal flex items-center gap-3 px-4 py-3 transition-colors active:bg-marca-50',
                  esSiguiente && 'ring-2 ring-acento-500/30'
                )}
              >
                <span
                  className={cn(
                    'grid h-9 w-9 shrink-0 place-items-center rounded-full text-sm font-bold',
                    completada
                      ? 'bg-acento-600 text-white'
                      : empezada
                        ? 'bg-oro-300 text-marca-900'
                        : 'bg-marca-100 text-marca-500'
                  )}
                >
                  {completada ? (
                    <IconoCheck className="h-5 w-5" />
                  ) : (
                    leccion.numero
                  )}
                </span>

                {/* El título envuelve en vez de cortarse: «Ajito entiende lo
                    que le dices» no cabe de una línea en un teléfono, y
                    truncarlo lo dejaba en «Ajito entiende lo que le…». */}
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] leading-snug font-semibold text-balance text-marca-900">
                    {leccion.titulo}
                  </span>
                  <span className="mt-0.5 block truncate text-[13px] text-marca-500">
                    {FORMA_GANCHO[leccion.forma as FormaIA] ??
                      FORMAS_IA[leccion.forma as FormaIA]}
                  </span>
                </span>

                {!completada && (
                  <span className="flex shrink-0 items-center gap-1 text-[12px] text-marca-400">
                    <IconoReloj className="h-4 w-4" />
                    {minutosTexto(leccion.minutos)}
                  </span>
                )}
              </Link>
            </li>
          )
        })}
      </ol>

      <p className="px-1 pb-2 text-[13px] leading-relaxed text-marca-500">
        Lo que le escribas o le hables a Ajito no lo lee tu supervisor ni nadie de
        tu área. Lo único que se mira es cuántas lecciones llevas, porque de ahí
        sale tu certificado.
      </p>
    </div>
  )
}

function Avance({ hechas, total }: { hechas: number; total: number }) {
  const porcentaje = total ? Math.round((hechas / total) * 100) : 0

  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="text-[13px] font-semibold text-marca-700">
          {hechas} de {total}
        </span>
        <span className="text-[13px] text-marca-500">{porcentaje}%</span>
      </div>
      <div
        className="mt-2 h-2 overflow-hidden rounded-full bg-marca-100"
        role="progressbar"
        aria-valuenow={hechas}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-label="Lecciones terminadas"
      >
        <div
          className="h-full rounded-full bg-acento-600 transition-[width]"
          style={{ width: `${porcentaje}%` }}
        />
      </div>
    </div>
  )
}

function Aviso({
  titulo,
  detalle,
  conAjito = false,
}: {
  titulo: string
  detalle?: string
  conAjito?: boolean
}) {
  return (
    <div className="tarjeta-canal px-5 py-8 text-center">
      {conAjito && (
        <Image
          src="/marca/ajito.png"
          alt=""
          width={200}
          height={200}
          className="mx-auto mb-4 h-20 w-20 object-contain"
        />
      )}
      <h1 className="text-lg font-bold text-marca-900">{titulo}</h1>
      {detalle && (
        <p className="mx-auto mt-2 max-w-xs text-[14px] leading-relaxed text-marca-500">
          {detalle}
        </p>
      )}
    </div>
  )
}
