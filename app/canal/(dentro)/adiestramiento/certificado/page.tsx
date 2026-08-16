import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { CertificadoHoja, fechaLarga } from '@/components/certificado-hoja'
import { IconoAtras } from '@/components/iconos'
import { CURSO } from '@/lib/adiestramiento'
import { requerirEmpleado } from '@/lib/canal'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'Tu certificado' }

/**
 * El certificado del curso, para quien lo hizo.
 *
 * Es lo contractual del adiestramiento —la capacitación y certificación que
 * Boosty se comprometió a entregar— y lo último que Ajito promete, en el audio
 * 5 de la lección 8. Hasta esta página, terminar las nueve lecciones no
 * entregaba nada.
 */
export default async function CertificadoPage() {
  const empleado = await requerirEmpleado()
  const supabase = await createClient()

  const { data: curso } = await supabase
    .from('cursos')
    .select('id')
    .eq('clave', CURSO)
    .maybeSingle()
  if (!curso) notFound()

  const { data: matricula } = await supabase
    .from('matriculas')
    .select('id')
    .eq('curso_id', curso.id)
    .eq('empleado_id', empleado.id)
    .maybeSingle()
  if (!matricula) notFound()

  const { data: certificado } = await supabase
    .from('certificados')
    .select('*')
    .eq('matricula_id', matricula.id)
    .maybeSingle()

  // Sin certificado: o no ha terminado, o la emisión falló al cerrar la novena.
  // Desde aquí se ven igual, y a la persona le sirve la misma salida —volver al
  // curso—, así que no se le cuenta la diferencia.
  if (!certificado) {
    return (
      <div className="space-y-4">
        <Volver />
        <div className="tarjeta-canal px-5 py-6 text-center">
          <p className="text-[15px] leading-relaxed text-marca-600">
            Tu certificado sale cuando termines las nueve lecciones. Te falta poco.
          </p>
          <Link href="/canal/adiestramiento" className="btn-canal btn-canal-rojo mt-4 w-full">
            Seguir el curso
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <Volver />

      <CertificadoHoja certificado={certificado} />

      <p className="px-1 text-[14px] leading-relaxed text-marca-500">
        Queda registrado en Capital Humano como adiestramiento. El Gerente de Planta te
        entrega el impreso en mano.
      </p>

      {certificado.entregado_en && (
        <p className="px-1 text-[14px] leading-relaxed text-marca-500">
          Ya te lo entregaron el {fechaLarga(certificado.entregado_en)}.
        </p>
      )}
    </div>
  )
}

function Volver() {
  return (
    <Link
      href="/canal/adiestramiento"
      className="-ml-1 inline-flex min-h-11 items-center gap-1.5 text-[14px] font-medium text-marca-500 active:text-marca-800"
    >
      <IconoAtras className="h-5 w-5" />
      El curso
    </Link>
  )
}
