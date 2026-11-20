import type { Metadata } from 'next'
import Link from 'next/link'
import { CertificadoHoja, fechaLarga } from '@/components/certificado-hoja'
import { requerirPermiso } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { COLUMNAS_CERTIFICADO, cedulasDeCertificados } from '@/lib/contacto'
import { BotonImprimir } from '@/components/sistema/procesos/boton-imprimir'
import { BOTON_CABECERA, BOTON_CABECERA_PRINCIPAL } from '@/components/sistema/ui/cabecera-modulo'

export const metadata: Metadata = { title: 'Certificados para imprimir · Formación' }

/**
 * El lote para imprimir: uno por hoja, con `components/certificado-hoja.tsx`,
 * la misma hoja que ve el trabajador en su teléfono —si fueran dos maquetas, el
 * papel y la pantalla dirían cosas distintas, y el papel es el que queda—.
 * Doscientas personas son un lote, no un trámite de uno en uno: se manda a
 * imprimir del navegador. Con `?entregado=no`, solo los que faltan por entregar.
 *
 * Lleva la cédula (o, sin ella, la ficha) porque es el papel que se entrega en
 * mano; la imagen que va al canal no la lleva.
 */
export default async function ImprimirCertificadosPage({ searchParams }: PageProps<'/sistema/nucleo/formacion/certificados/imprimir'>) {
  const [, sp] = await Promise.all([requerirPermiso('modulo:certificados'), searchParams])
  const soloPendientes = sp.entregado === 'no'
  const supabase = await createClient()
  let consulta = supabase.from('certificados').select(COLUMNAS_CERTIFICADO).order('emitido_en', { ascending: false }).range(0, 999)
  if (soloPendientes) consulta = consulta.is('entregado_en', null)
  const { data } = await consulta
  // La cédula, a quien le toca (equipo, o Certificados + Capital Humano); a los demás la
  // hoja les sale con el número de ficha (`identificacion()`).
  const cedulas = await cedulasDeCertificados(supabase, (data ?? []).map((c) => c.id))
  const emitidos = (data ?? []).map((c) => ({ ...c, cedula: cedulas.get(c.id) ?? null }))

  return (
    <>
      {/* En papel solo salen las hojas: el armazón de la plataforma se queda en la pantalla. */}
      <style>{`@media print {
        .plataforma > header, .plataforma > a, .plataforma > div > :not(main), main#contenido > :not(div:last-child), .solo-pantalla { display: none !important; }
        .plataforma, main#contenido { background: #fff !important; }
        main#contenido > div:last-child { padding: 0 !important; }
        @page { margin: 12mm; }
      }`}</style>
      <header className="solo-pantalla mb-4 flex flex-wrap items-center gap-2 border-b border-[var(--borde)] pb-3">
        <div className="min-w-0 flex-1">
          <p className="text-[12px] text-marca-500">
            <Link href="/sistema/nucleo/formacion/certificados" className="hover:underline">
              Formación / Certificados
            </Link>{' '}
            / Para imprimir
          </p>
          <h1 className="text-[19px] font-bold text-marca-900">
            {emitidos.length} certificado{emitidos.length === 1 ? '' : 's'}
            {soloPendientes ? ' por entregar' : ''}
          </h1>
          <p className="text-xs text-marca-500">Sale uno por hoja. Imprime desde aquí o guarda en PDF.</p>
        </div>
        {soloPendientes ? (
          <Link href="/sistema/nucleo/formacion/certificados/imprimir" className={BOTON_CABECERA}>
            Ver todos
          </Link>
        ) : (
          <Link href="/sistema/nucleo/formacion/certificados/imprimir?entregado=no" className={BOTON_CABECERA}>
            Solo los que faltan por entregar
          </Link>
        )}
        <BotonImprimir className={BOTON_CABECERA_PRINCIPAL} />
      </header>

      {emitidos.length === 0 ? (
        <p className="rounded-xl border border-[var(--borde)] bg-white px-4 py-8 text-center text-xs text-marca-500">
          {soloPendientes ? 'No falta ninguno por entregar.' : 'Todavía no hay ninguno. Se emiten solos cuando alguien termina las nueve lecciones.'}
        </p>
      ) : (
        <div className="space-y-6">
          {emitidos.map((certificado) => (
            <section key={certificado.id} className="hoja mx-auto max-w-md">
              <CertificadoHoja certificado={certificado} />
              <p className="solo-pantalla mt-2 px-1 text-xs text-marca-500">
                Emitido el {fechaLarga(certificado.emitido_en)}
                {certificado.entregado_en ? ` · entregado el ${fechaLarga(certificado.entregado_en)}` : ' · sin entregar'}
              </p>
            </section>
          ))}
        </div>
      )}
    </>
  )
}
