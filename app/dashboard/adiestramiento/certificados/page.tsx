import type { Metadata } from 'next'
import Link from 'next/link'
import { CertificadoHoja, fechaLarga } from '@/components/certificado-hoja'
import { requerirEditor } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'Certificados' }

/**
 * Los certificados emitidos, para imprimirlos.
 *
 * El guion cierra la lección 8 con esto: *«aparte del PDF, el certificado se
 * imprime y lo entrega el Gerente de Planta en persona. Eso pesa más que el
 * archivo.»* Doscientas personas es un lote, no un trámite de uno en uno — así
 * que salen todos en una página, uno por hoja, y se manda a imprimir del
 * navegador.
 *
 * Usa la misma hoja que ve el trabajador en su teléfono. Si fueran dos maquetas,
 * el papel y la pantalla dirían cosas distintas del mismo curso, y el papel es
 * el que queda.
 */
export default async function CertificadosPage() {
  await requerirEditor()
  const supabase = await createClient()

  const { data: certificados } = await supabase
    .from('certificados')
    .select('*')
    .order('emitido_en', { ascending: false })

  const emitidos = certificados ?? []
  const entregados = emitidos.filter((c) => c.entregado_en).length

  return (
    <div className="space-y-6">
      <header className="no-imprimir">
        <Link
          href="/dashboard/adiestramiento"
          className="text-sm font-medium text-marca-500 hover:text-marca-800"
        >
          ← El adiestramiento
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-marca-900">Certificados</h1>
        <p className="mt-1 text-sm text-marca-600">
          {emitidos.length} emitido{emitidos.length === 1 ? '' : 's'} ·{' '}
          {entregados} entregado{entregados === 1 ? '' : 's'} en mano. Imprime esta página
          desde el navegador: sale uno por hoja.
        </p>
      </header>

      {emitidos.length === 0 ? (
        <p className="tarjeta px-5 py-6 text-sm text-marca-600">
          Todavía no hay ninguno. Se emiten solos cuando alguien termina las nueve
          lecciones.
        </p>
      ) : (
        <div className="space-y-6">
          {emitidos.map((certificado) => (
            <section key={certificado.id} className="hoja mx-auto max-w-md">
              <CertificadoHoja certificado={certificado} />
              <p className="no-imprimir mt-2 px-1 text-xs text-marca-400">
                Emitido el {fechaLarga(certificado.emitido_en)}
                {certificado.entregado_en
                  ? ` · entregado el ${fechaLarga(certificado.entregado_en)}`
                  : ' · sin entregar'}
              </p>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
