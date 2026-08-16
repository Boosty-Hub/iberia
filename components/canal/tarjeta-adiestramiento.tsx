import Image from 'next/image'
import Link from 'next/link'
import { CURSO } from '@/lib/adiestramiento'
import { createClient } from '@/lib/supabase/server'

/**
 * El curso de Ajito, arriba del feed.
 *
 * Es el único llamado a la acción del canal que no está en la navegación del
 * pie: se decidió no meter un sexto destino y dejarlo aquí, donde lo ve todo el
 * mundo al entrar. Los gerentes van a pedir que la gente avance, y este es el
 * sitio donde la gente lo va a encontrar sin que nadie le explique dónde queda.
 *
 * No se dibuja nada si esta persona no tiene matrícula —las gerencias y
 * jefaturas van a las formaciones presenciales— ni si el curso sigue cerrado.
 */
export async function TarjetaAdiestramiento({ empleadoId }: { empleadoId: string }) {
  const supabase = await createClient()

  const { data: curso } = await supabase
    .from('cursos')
    .select('id, nombre, abierto')
    .eq('clave', CURSO)
    .maybeSingle()

  if (!curso?.abierto) return null

  const { data: matricula } = await supabase
    .from('matriculas')
    .select('id, estado')
    .eq('curso_id', curso.id)
    .eq('empleado_id', empleadoId)
    .maybeSingle()

  if (!matricula) return null

  const [{ count: total }, { count: hechas }] = await Promise.all([
    supabase
      .from('lecciones')
      .select('id', { count: 'exact', head: true })
      .eq('curso_id', curso.id)
      .eq('activa', true),
    supabase
      .from('avances')
      .select('id', { count: 'exact', head: true })
      .eq('matricula_id', matricula.id)
      .eq('estado', 'completada'),
  ])

  const listas = hechas ?? 0
  const todas = total ?? 0
  const terminado = matricula.estado === 'completado'
  const porcentaje = todas ? Math.round((listas / todas) * 100) : 0

  return (
    <Link
      href="/canal/adiestramiento"
      className="tarjeta-canal mb-4 flex items-center gap-4 px-4 py-4 active:bg-marca-50"
    >
      <Image
        src="/marca/ajito.png"
        alt=""
        width={200}
        height={200}
        className="h-14 w-14 shrink-0 object-contain"
      />

      <span className="min-w-0 flex-1">
        <span className="block text-[11px] font-bold tracking-[0.14em] text-acento-600 uppercase">
          Nuevo Sabor
        </span>
        <span className="block text-[15px] leading-tight font-semibold text-marca-900">
          {terminado
            ? 'Terminaste el curso de Ajito'
            : listas === 0
              ? 'Conoce a Ajito'
              : `Vas por ${listas} de ${todas}`}
        </span>
        <span className="mt-0.5 block text-[13px] text-marca-500">
          {terminado
            ? 'Mira tu certificado'
            : listas === 0
              ? `${todas} clases de tres minutos`
              : 'Sigue donde quedaste'}
        </span>

        {!terminado && listas > 0 && (
          <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-marca-100">
            <span
              className="block h-full rounded-full bg-acento-600"
              style={{ width: `${porcentaje}%` }}
            />
          </span>
        )}
      </span>
    </Link>
  )
}
