import type { Metadata } from 'next'
import { puede, requerirPermiso } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { catalogoModelos } from '@/lib/asistente/servidor'
import type { Esfuerzo } from '@/lib/asistente/tipos'
import { CabeceraModulo } from '@/components/sistema/ui/cabecera-modulo'
import { FormAtajo, type AtajoVista } from '@/components/sistema/asistente/f3-formularios'

export const metadata: Metadata = { title: 'Atajos · Asistente de IA' }

/**
 * Atajos «/» (fase 3): instrucciones probadas que se llaman escribiendo «/» en
 * el chat. Los de la empresa los crea la administración y los ven todos; los
 * personales, cada quien.
 */
export default async function AtajosPage() {
  const sesion = await requerirPermiso('sistema:asistente')
  const admin = puede(sesion, 'sistema:asistente-admin', 'editar')
  const supabase = await createClient()
  const [{ data: atajos }, modelos] = await Promise.all([supabase.schema('asistente').from('atajo').select('*').order('comando'), catalogoModelos()])
  const vista = (a: NonNullable<typeof atajos>[number]): AtajoVista => ({
    id: a.id,
    empresa: a.dueno === null,
    comando: a.comando,
    titulo: a.titulo,
    instruccion: a.instruccion,
    modelo: a.modelo,
    esfuerzo: a.esfuerzo as Esfuerzo | null,
  })
  const empresa = (atajos ?? []).filter((a) => a.dueno === null).map(vista)
  const propios = (atajos ?? []).filter((a) => a.dueno === sesion.userId).map(vista)
  const lista = modelos.filter((m) => m.encendido).map((m) => ({ id: m.id, nombre: m.nombre }))

  return (
    <>
      <CabeceraModulo sesion={sesion} codigo="MI-ASI" titulo="Asistente de IA" migas={[{ etiqueta: 'Atajos' }]} descripcion="Escribe «/» en el chat para usarlos. Los de la empresa son iguales para todos; los tuyos, solo para ti." />
      <section className="mb-4 rounded-xl border border-[var(--borde)] bg-white">
        <header className="border-b border-[var(--borde)] px-4 py-2.5">
          <h2 className="text-[13px] font-semibold text-marca-900">De la empresa</h2>
        </header>
        {empresa.map((a) => (
          <FormAtajo key={a.id} inicial={a} empresa modelos={lista} editable={admin} />
        ))}
        {admin && <FormAtajo empresa modelos={lista} editable />}
      </section>
      <section className="rounded-xl border border-[var(--borde)] bg-white">
        <header className="border-b border-[var(--borde)] px-4 py-2.5">
          <h2 className="text-[13px] font-semibold text-marca-900">Mis atajos</h2>
        </header>
        {propios.map((a) => (
          <FormAtajo key={a.id} inicial={a} empresa={false} modelos={lista} editable />
        ))}
        <FormAtajo empresa={false} modelos={lista} editable />
      </section>
    </>
  )
}
