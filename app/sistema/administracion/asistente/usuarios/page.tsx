import type { Metadata } from 'next'
import Link from 'next/link'
import { puede, requerirPermiso } from '@/lib/auth'
import { leerConfig, leerModelosAdmin, leerRolesYPoliticas } from '@/lib/asistente/admin'
import { CabeceraModulo } from '@/components/sistema/ui/cabecera-modulo'
import { FilaPoliticaRol, FormExcepcion } from '@/components/sistema/asistente/admin-formularios'

export const metadata: Metadata = { title: 'Usuarios y roles · Asistente de IA' }

/**
 * Usuarios y roles (decisiones 1, 4, 8 y 14): quién tiene el asistente sale de
 * la casilla «Asistente de IA» del rol, en Roles; aquí, por rol, los topes, el
 * espacio, el esfuerzo máximo y los modelos, y las excepciones por persona. Un
 * campo vacío hereda de la configuración general.
 */
export default async function UsuariosAsistentePage() {
  const sesion = await requerirPermiso('sistema:asistente-admin')
  const editable = puede(sesion, 'sistema:asistente-admin', 'editar')
  const [config, modelos, datos] = await Promise.all([leerConfig(), leerModelosAdmin(), leerRolesYPoliticas()])
  if (!config) return null
  const encendidos = modelos.filter((m) => m.encendido).map((m) => ({ id: m.id, nombre: `${m.nombre} (${m.proveedor === 'anthropic' ? 'Anthropic' : 'OpenAI'})` }))
  const nombres = new Map(datos.personas.map((p) => [p.id, p.nombre]))
  const sinExcepcion = datos.personas.filter((p) => !datos.excepciones.some((e) => e.perfil_id === p.id))

  return (
    <>
      <CabeceraModulo
        sesion={sesion}
        codigo="NUC-IA"
        titulo="Asistente de IA"
        migas={[{ etiqueta: 'Usuarios y roles' }]}
        descripcion={
          <>
            Quién tiene el asistente se marca en{' '}
            <Link href="/sistema/administracion/roles" className="text-acento-700 underline">
              Roles
            </Link>{' '}
            (casilla «Asistente de IA»). Aquí van los topes, el espacio y los modelos de cada rol, y las excepciones por persona. Un campo vacío hereda la configuración general.
          </>
        }
      />
      <section className="mb-4 rounded-xl border border-[var(--borde)] bg-white">
        <header className="border-b border-[var(--borde)] px-4 py-2.5">
          <h2 className="text-[13px] font-semibold text-marca-900">Política por rol</h2>
        </header>
        {datos.roles.map((r) => (
          <FilaPoliticaRol key={r.id} rol={r} inicial={r.politica} modelos={encendidos} editable={editable} herencia={config} />
        ))}
      </section>

      <section className="rounded-xl border border-[var(--borde)] bg-white">
        <header className="border-b border-[var(--borde)] px-4 py-2.5">
          <h2 className="text-[13px] font-semibold text-marca-900">Excepciones por persona</h2>
          <p className="text-[12px] text-marca-500">Para habilitar o quitar el asistente a alguien sin tocar su rol, o darle otros topes y modelos.</p>
        </header>
        {datos.excepciones.map((e) => (
          <FormExcepcion key={e.perfil_id} personas={[{ id: e.perfil_id, nombre: nombres.get(e.perfil_id) ?? 'Persona' }]} modelos={encendidos} herencia={config} inicial={e} />
        ))}
        {editable && <FormExcepcion personas={sinExcepcion} modelos={encendidos} herencia={config} />}
      </section>
    </>
  )
}
