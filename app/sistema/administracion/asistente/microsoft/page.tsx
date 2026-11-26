import type { Metadata } from 'next'
import Link from 'next/link'
import { puede, requerirPermiso } from '@/lib/auth'
import { createAdminClient, createClient } from '@/lib/supabase/server'
import { PERMISOS_MICROSOFT, estadoCertificado } from '@/lib/asistente/microsoft'
import { CabeceraModulo } from '@/components/sistema/ui/cabecera-modulo'
import { FormIdentificadores } from '@/components/sistema/asistente/microsoft'

export const metadata: Metadata = { title: 'Microsoft 365 · Asistente de IA' }

/**
 * Microsoft 365 (fase 7): la aplicación de Iberia en Entra. Aquí van los dos
 * identificadores que devuelve el administrador de Microsoft de Iberia; el
 * certificado (público) se descarga para entregárselo, y su llave privada vive
 * en el entorno del servidor. Qué rol lee qué parte se decide en Alcance.
 */
export default async function MicrosoftPage() {
  const sesion = await requerirPermiso('sistema:asistente-admin')
  const editable = puede(sesion, 'sistema:asistente-admin', 'editar')
  const supabase = await createClient()
  const [{ data: cfg }, { count: conectadas }] = await Promise.all([
    supabase.schema('asistente').from('config').select('microsoft_tenant, microsoft_cliente').eq('id', true).maybeSingle(),
    // Solo la cuenta: quién conectó qué cuenta no se muestra.
    createAdminClient().schema('asistente').from('conexion_microsoft').select('perfil_id', { count: 'exact', head: true }),
  ])
  const cert = await estadoCertificado()
  const retorno = `${(process.env.NEXT_PUBLIC_SITE_URL || 'https://portal.industriasiberia.com').replace(/\/$/, '')}/api/asistente/microsoft/retorno`
  const listo = cert.listo && !!cfg?.microsoft_tenant && !!cfg?.microsoft_cliente

  return (
    <>
      <CabeceraModulo sesion={sesion} codigo="NUC-IA" titulo="Asistente de IA" migas={[{ etiqueta: 'Microsoft 365' }]} />
      <p className={`mb-3 rounded-xl border px-4 py-2.5 text-[13px] ${listo ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-amber-200 bg-amber-50 text-amber-900'}`}>
        {listo ? `Configurado. ${conectadas ?? 0} ${conectadas === 1 ? 'persona conectó' : 'personas conectaron'} su cuenta.` : 'Falta configurar: los identificadores de la aplicación de Iberia en Entra y, en el servidor, el certificado.'}
      </p>
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-[var(--borde)] bg-white p-4">
          <h2 className="text-[14px] font-semibold text-marca-900">La aplicación de Iberia en Microsoft Entra</h2>
          <p className="mt-0.5 mb-3 text-[12.5px] text-marca-500">Los dos identificadores de la página «Overview» de la aplicación. No son secretos.</p>
          <FormIdentificadores tenant={cfg?.microsoft_tenant ?? ''} cliente={cfg?.microsoft_cliente ?? ''} editable={editable} />
        </section>
        <section className="rounded-xl border border-[var(--borde)] bg-white p-4">
          <h2 className="text-[14px] font-semibold text-marca-900">Lo que se le entrega al administrador de Microsoft</h2>
          <dl className="mt-2 space-y-2 text-[13px]">
            <div>
              <dt className="text-[12px] font-semibold text-marca-600">Dirección de retorno (Authentication › Web)</dt>
              <dd className="font-mono text-[12.5px] break-all text-marca-900">{retorno}</dd>
            </div>
            <div>
              <dt className="text-[12px] font-semibold text-marca-600">Certificado (Certificates &amp; secrets › Certificates)</dt>
              <dd className="text-marca-900">
                {cert.huella ? (
                  <>
                    <a href="/sistema/administracion/asistente/microsoft/certificado" className="font-semibold text-acento-700 hover:underline">
                      Descargar el .cer
                    </a>{' '}
                    <span className="font-mono text-[11.5px] text-marca-500">huella {cert.huella}</span>
                    {!cert.listo && <span className="block text-[12px] text-acento-700">Falta la llave privada en el servidor.</span>}
                  </>
                ) : (
                  <span className="text-acento-700">Sin certificado en el servidor (se carga en Vault con subir-certificado-microsoft.mjs).</span>
                )}
              </dd>
            </div>
            <div>
              <dt className="text-[12px] font-semibold text-marca-600">Permisos delegados de Microsoft Graph (solo lectura)</dt>
              <dd className="font-mono text-[12px] text-marca-800">{PERMISOS_MICROSOFT.filter((p) => p !== 'offline_access').join(', ')}</dd>
            </div>
          </dl>
          <p className="mt-3 text-[12.5px] text-marca-600">
            Qué rol lee qué parte (correo, calendario, archivos, Teams) se decide en{' '}
            <Link href="/sistema/administracion/asistente/alcance" className="font-semibold text-acento-700 hover:underline">
              Alcance
            </Link>
            : nacen apagadas, como todas las fuentes.
          </p>
        </section>
      </div>
    </>
  )
}
