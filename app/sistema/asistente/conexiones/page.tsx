import type { Metadata } from 'next'
import { requerirPermiso } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { PARTES_M365, configMicrosoft } from '@/lib/asistente/microsoft'
import { fechaCaracas } from '@/lib/asistente/tipos'
import { CabeceraModulo } from '@/components/sistema/ui/cabecera-modulo'
import { BotonDesconectar } from '@/components/sistema/asistente/microsoft'

export const metadata: Metadata = { title: 'Conexiones · Asistente de IA' }

/**
 * Conexiones (fase 7): la cuenta de Microsoft de la persona. El asistente lee
 * solo lo que ella ve en Microsoft, solo lectura, y solo las partes que su rol
 * tiene en el alcance.
 */
export default async function ConexionesPage({ searchParams }: PageProps<'/sistema/asistente/conexiones'>) {
  const sesion = await requerirPermiso('sistema:asistente')
  const sp = await searchParams
  const supabase = await createClient()
  const [cfg, { data: conexion }, { data: alcance }] = await Promise.all([
    configMicrosoft(),
    supabase.schema('asistente').from('conexion_microsoft').select('cuenta, nombre, conectado_en, usado_en').maybeSingle(),
    supabase.schema('asistente').rpc('mi_alcance'),
  ])
  const partes = ((alcance ?? []) as { fuente: string }[]).map((a) => a.fuente).filter((f): f is keyof typeof PARTES_M365 => f in PARTES_M365)
  const ok = typeof sp.ok === 'string' ? sp.ok : null
  const error = typeof sp.error === 'string' ? (sp.error === 'sin-configurar' ? 'La conexión con Microsoft 365 todavía no está configurada.' : sp.error) : null

  return (
    <>
      <CabeceraModulo sesion={sesion} codigo="MI-ASI" titulo="Asistente de IA" migas={[{ etiqueta: 'Conexiones' }]} descripcion="Las cuentas que el asistente puede leer por ti. Solo lectura, y solo lo que tú ya ves." />
      {ok !== null && <p className="mb-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-[13px] text-emerald-900">Listo: conectaste {ok || 'tu cuenta de Microsoft'}.</p>}
      {error && (
        <p role="alert" className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-[13px] text-amber-900">
          {error}
        </p>
      )}
      <section className="rounded-xl border border-[var(--borde)] bg-white p-4" data-conexion-microsoft>
        <div className="flex flex-wrap items-start gap-3">
          <span className="grid h-11 w-11 shrink-0 grid-cols-2 gap-0.5 rounded-lg bg-marca-50 p-2.5" aria-hidden>
            <span className="bg-[#f25022]" />
            <span className="bg-[#7fba00]" />
            <span className="bg-[#00a4ef]" />
            <span className="bg-[#ffb900]" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-[15px] font-semibold text-marca-900">Microsoft 365</h2>
            <p className="text-[12.5px] text-marca-600">Correo de Outlook, calendario, OneDrive y SharePoint, y Teams. «Prepárame la reunión de mañana con lo que hay en mi correo y en la plataforma».</p>
            {conexion ? (
              <p className="mt-2 text-[13px] text-marca-800">
                Conectada como <strong>{conexion.cuenta || conexion.nombre}</strong> desde el {fechaCaracas(conexion.conectado_en)}
                {conexion.usado_en && <> · último uso: {fechaCaracas(conexion.usado_en)}</>}.
              </p>
            ) : (
              <p className="mt-2 text-[13px] text-marca-700">Sin conectar.</p>
            )}
            <p className="mt-2 text-[12.5px] text-marca-600">
              {partes.length ? (
                <>Tu rol le deja leer: {partes.map((p) => PARTES_M365[p].replace('Microsoft 365 · ', '')).join(', ')}.</>
              ) : (
                <>Tu rol todavía no tiene Microsoft 365 en el alcance del asistente.</>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {conexion ? (
              <BotonDesconectar />
            ) : cfg && partes.length ? (
              <a href="/api/asistente/microsoft/conectar" className="btn-acento h-9 px-4 text-[13px]">
                Conectar mi cuenta
              </a>
            ) : (
              <span className="text-[12.5px] text-marca-500">{cfg ? 'Pídele a la administración que lo habilite.' : 'Pendiente de configurar por la administración.'}</span>
            )}
          </div>
        </div>
        <ul className="mt-4 space-y-1 border-t border-[var(--borde)] pt-3 text-[12.5px] text-marca-600">
          <li>· Es tu inicio de sesión de Microsoft: el asistente actúa como tú, nunca con una llave sobre los buzones de otros.</li>
          <li>· Solo lee. No manda correos, no cambia archivos ni acepta reuniones.</li>
          <li>· Lo que lee no se guarda en la plataforma, salvo lo que le pidas volcar en un archivo. Si compartes ese archivo, te pide confirmarlo.</li>
          <li>· Desconectar borra el acceso guardado. Si Iberia te retira el acceso en Microsoft, deja de funcionar en el acto.</li>
        </ul>
      </section>
    </>
  )
}
