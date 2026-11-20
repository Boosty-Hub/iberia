import type { Metadata } from 'next'
import { requerirPermiso } from '@/lib/auth'
import { leerContexto } from '@/lib/plataforma/servidor'
import { KpiMetrica, precargarMetricas } from '@/lib/plataforma/metricas'
import { TABLA_CANAL_USO } from '@/lib/plataforma/tablas-canal'
import { CabeceraModulo } from '@/components/sistema/ui/cabecera-modulo'
import { TablaServidor } from '@/components/sistema/ui/tabla-servidor'
import { BarrasApiladas } from '@/components/sistema/procesos/piezas-r2'
import { TRAMOS_USO, filasUso, leerUso } from '../datos'

export const metadata: Metadata = { title: 'Uso · Canal' }

/**
 * La adopción del canal por área, sede y nivel: quién está en el padrón, quién
 * tiene cuenta, quién entró y quién está activo. Cuentas por grupo, sin nombres
 * y sin contenido de mensajes. «Mandado, cero entradas» se lee aquí: con cuenta
 * y sin entrar es que el enlace no llegó.
 */
export default async function UsoCanalPage({ searchParams }: PageProps<'/sistema/nucleo/canal/uso'>) {
  const [sesion, sp] = await Promise.all([requerirPermiso('modulo:reportes'), searchParams])
  const ctx = await leerContexto(sp)
  const [uso] = await Promise.all([leerUso(ctx.al), precargarMetricas(['canal_personas_activas', 'canal_mensajes_mes'], ctx)])
  const porSede = filasUso(uso, 'sede').map((f) => ({ ...f, href: `/sistema/nucleo/canal/uso?f.sede=${encodeURIComponent(f.clave)}` }))
  const porArea = filasUso(uso, 'area')
    .slice(0, 12)
    .map((f) => ({ ...f, href: `/sistema/nucleo/canal/uso?f.area=${encodeURIComponent(f.clave)}` }))

  return (
    <>
      <CabeceraModulo
        sesion={sesion}
        codigo="NUC-CAN"
        titulo="Canal"
        migas={[{ etiqueta: 'Uso' }]}
        descripcion="Quién usa el canal, por área, sede y nivel. Son cuentas por grupo: ni nombres ni el contenido de los mensajes."
      />
      <div className="mb-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiMetrica clave="canal_personas_activas" ctx={ctx} sesion={sesion} titulo="Personas activas · 30 días" />
        <KpiMetrica clave="canal_personas_activas" ctx={ctx} sesion={sesion} parte={{ detalle: 'en_padron', titulo: 'En el padrón', texto: 'Personas activas del padrón' }} />
        <KpiMetrica clave="canal_personas_activas" ctx={ctx} sesion={sesion} parte={{ detalle: 'con_cuenta', titulo: 'Con cuenta', deTotal: false, texto: 'Con la cuenta enlazada a su ficha' }} />
        <KpiMetrica clave="canal_mensajes_mes" ctx={ctx} sesion={sesion} />
      </div>
      <div className="mb-3 grid gap-3 xl:grid-cols-2">
        <section className="min-w-0 rounded-xl border border-[var(--borde)] bg-white p-3.5">
          <h2 className="mb-2 text-[13px] font-semibold text-marca-900">Por sede</h2>
          <BarrasApiladas filas={porSede} tramos={TRAMOS_USO} titulo="Personas del padrón por sede: activas, con cuenta sin actividad y sin cuenta" />
        </section>
        <section className="min-w-0 rounded-xl border border-[var(--borde)] bg-white p-3.5">
          <h2 className="mb-2 text-[13px] font-semibold text-marca-900">Por área · las 12 con más gente</h2>
          <BarrasApiladas filas={porArea} tramos={TRAMOS_USO} titulo="Personas del padrón por área: activas, con cuenta sin actividad y sin cuenta" />
        </section>
      </div>
      <TablaServidor fuente={TABLA_CANAL_USO} sp={sp} sesion={sesion} ctx={ctx} vacio="El padrón está vacío." />
    </>
  )
}
