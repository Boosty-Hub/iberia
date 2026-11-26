import type { Metadata } from 'next'
import { puede, requerirPermiso } from '@/lib/auth'
import { leerConfig, leerModelosAdmin } from '@/lib/asistente/admin'
import { createClient } from '@/lib/supabase/server'
import { claveAnthropic } from '@/lib/clave-anthropic'
import { numero } from '@/lib/plataforma/formato'
import { ETIQUETA_ESFUERZO, type Esfuerzo } from '@/lib/asistente/tipos'
import { CabeceraModulo } from '@/components/sistema/ui/cabecera-modulo'
import { FormMotor, InterruptorModelo, PanelMotorLocal } from '@/components/sistema/asistente/admin-formularios'

export const metadata: Metadata = { title: 'Motor y modelos · Asistente de IA' }

/**
 * Motor y modelos: qué proveedor contesta, los modelos que se pueden elegir
 * (con su precio de lista y la fecha en que se verificó), el interruptor y los
 * topes de la empresa. Las claves viven en el entorno del servidor: aquí solo
 * se dice si están.
 */
export default async function MotorPage() {
  const sesion = await requerirPermiso('sistema:asistente-admin')
  const editable = puede(sesion, 'sistema:asistente-admin', 'editar')
  const supabase = await createClient()
  const [config, modelos, { data: tareas }, { data: capacidades }] = await Promise.all([
    leerConfig(),
    leerModelosAdmin(),
    supabase.schema('asistente').rpc('tareas_resumen'),
    supabase.schema('asistente').from('capacidad_motor').select('capacidad, disponible, solo_hibrido, motivo, orden').eq('motor', 'local').order('orden'),
  ])
  const t = tareas as { activas: number; pausadas: number; tableros: number; corridas_mes: number; fallidas_mes: number; pausado: boolean } | null
  const claves = { anthropic: !!claveAnthropic().clave, openai: !!process.env.OPENAI_API_KEY?.trim() }

  return (
    <>
      <CabeceraModulo sesion={sesion} codigo="NUC-IA" titulo="Asistente de IA" migas={[{ etiqueta: 'Motor y modelos' }]} />
      {t && (
        <p className="mb-3 rounded-xl border border-[var(--borde)] bg-white px-4 py-2.5 text-[12.5px] text-marca-600">
          <span className="font-semibold text-marca-900">Tareas programadas:</span> {numero(t.activas)} activas ({numero(t.tableros)} tableros vivos) · {numero(t.pausadas)} pausadas · {numero(t.corridas_mes)} corridas este mes
          {t.fallidas_mes > 0 && <>, {numero(t.fallidas_mes)} fallidas</>}.
          {t.pausado && <span className="ml-1 font-semibold text-amber-700">El programador está pausado.</span>}{' '}
          <span className="text-marca-500">Solo cuentas: las instrucciones no se leen.</span>
        </p>
      )}
      {config && <FormMotor config={config} modelos={modelos.map((m) => ({ id: m.id, nombre: m.nombre, proveedor: m.proveedor, encendido: m.encendido }))} claves={claves} editable={editable} />}

      {config && (
        <PanelMotorLocal
          config={config}
          modelos={modelos.filter((m) => m.proveedor === 'local').map((m) => ({ id: m.id, nombre: m.nombre, nombre_api: m.nombre_api, precio_entrada: Number(m.precio_entrada), precio_salida: Number(m.precio_salida), encendido: m.encendido }))}
          capacidades={capacidades ?? []}
          editable={editable}
          conClave={!!process.env.ASISTENTE_LOCAL_CLAVE?.trim()}
        />
      )}

      <section className="relative mt-4 overflow-x-auto rounded-xl border border-[var(--borde)] bg-white">
        <header className="border-b border-[var(--borde)] px-4 py-2.5">
          <h2 className="text-[13px] font-semibold text-marca-900">Catálogo de modelos</h2>
          <p className="text-[12px] text-marca-500">Un modelo apagado no sale para nadie. Cuál ve cada quien se afina por rol o por persona en «Usuarios y roles».</p>
        </header>
        <table className="w-full min-w-[760px] text-[13px]">
          <thead className="bg-marca-50 text-left text-[12px] text-marca-600">
            <tr>
              <th className="px-4 py-2 font-semibold">Modelo</th>
              <th className="px-3 py-2 font-semibold">Proveedor</th>
              <th className="px-3 py-2 text-right font-semibold">Entrada / salida (US$ por millón)</th>
              <th className="px-3 py-2 font-semibold">Esfuerzos</th>
              <th className="px-3 py-2 font-semibold">Verificado</th>
              <th className="px-4 py-2 font-semibold">Estado</th>
            </tr>
          </thead>
          <tbody>
            {modelos.map((m) => (
              <tr key={m.id} className="border-t border-[var(--borde)]">
                <td className="px-4 py-2">
                  <span className="font-medium text-marca-900">{m.nombre}</span>
                  <span className="ml-2 font-mono text-[11.5px] text-marca-400">{m.id}</span>
                  <p className="text-[12px] text-marca-500">{m.descripcion}</p>
                </td>
                <td className="px-3 py-2 text-marca-600">{m.proveedor === 'anthropic' ? 'Anthropic' : m.proveedor === 'openai' ? 'OpenAI' : 'Local'}</td>
                <td className="px-3 py-2 text-right whitespace-nowrap">
                  {numero(Number(m.precio_entrada), 2)} / {numero(Number(m.precio_salida), 2)}
                </td>
                <td className="px-3 py-2 text-[12px] text-marca-600">{(m.esfuerzos as Esfuerzo[]).map((e) => ETIQUETA_ESFUERZO[e]).join(', ')}</td>
                <td className="px-3 py-2 whitespace-nowrap text-[12px] text-marca-500">{m.verificado_en}</td>
                <td className="px-4 py-2">
                  <InterruptorModelo id={m.id} encendido={m.encendido} editable={editable} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  )
}
