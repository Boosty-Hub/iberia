import type { Metadata } from 'next'
import { puede, requerirPermiso } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { catalogoFuentes } from '@/lib/asistente/fuentes'
import { leerRolesYPoliticas } from '@/lib/asistente/admin'
import { CabeceraModulo } from '@/components/sistema/ui/cabecera-modulo'
import { ExcepcionesAlcance, MatrizAlcance, VerComo } from '@/components/sistema/asistente/alcance-formularios'

export const metadata: Metadata = { title: 'Alcance · Asistente de IA' }

/**
 * Alcance (fase 2): qué datos de la plataforma puede consultar el asistente de
 * cada quien. Lo que ve = lo que la persona puede ver en la plataforma Y lo que
 * su alcance permite. Una fuente nueva nace apagada. Sin aprobación (P3).
 */
export default async function AlcancePage() {
  const sesion = await requerirPermiso('sistema:asistente-admin')
  const editable = puede(sesion, 'sistema:asistente-admin', 'editar')
  const supabase = await createClient()
  const db = supabase.schema('asistente')
  const [{ roles, personas }, { data: fuentesDb }, { data: porRol }, { data: porUsuario }] = await Promise.all([
    leerRolesYPoliticas(),
    db.from('fuente').select('clave, encendida, sensible'),
    db.from('alcance_rol').select('rol_id, fuente, permitido'),
    db.from('alcance_usuario').select('perfil_id, fuente, permitido'),
  ])
  const estado = new Map((fuentesDb ?? []).map((f) => [f.clave, f]))
  const fuentes = catalogoFuentes()
    .map((f) => ({ clave: f.clave, titulo: f.titulo, modulo: f.modulo, encendida: estado.get(f.clave)?.encendida ?? false, sensible: estado.get(f.clave)?.sensible ?? false }))
    .sort((a, b) => a.modulo.localeCompare(b.modulo) || a.titulo.localeCompare(b.titulo, 'es'))
  const marcadas = (porRol ?? []).filter((r) => r.permitido).map((r) => `${r.rol_id}|${r.fuente}`)

  return (
    <>
      <CabeceraModulo
        sesion={sesion}
        codigo="NUC-IA"
        titulo="Asistente de IA"
        migas={[{ etiqueta: 'Alcance' }]}
        descripcion="Qué datos de la plataforma puede consultar el asistente de cada rol. El asistente nunca ve más que la persona: lo que consulta es lo que ella puede ver Y lo que su alcance permite. Una fuente nueva nace apagada."
      />
      <section className="mb-4 rounded-xl border border-[var(--borde)] bg-white">
        <header className="border-b border-[var(--borde)] px-4 py-2.5">
          <h2 className="text-[13px] font-semibold text-marca-900">Fuentes por rol</h2>
          <p className="text-[12px] text-marca-500">Encendida: disponible para el asistente en toda la empresa. Sensible: se marca en las respuestas y en el registro. Los mensajes del Portal planta, las charlas de Ajito, las transcripciones y el contacto del padrón no son fuente, a propósito.</p>
        </header>
        <MatrizAlcance fuentes={fuentes} roles={roles.map((r) => ({ id: r.id, nombre: r.nombre, habilitado: r.habilitado }))} marcadas={marcadas} editable={editable} />
      </section>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <section className="rounded-xl border border-[var(--borde)] bg-white">
          <header className="border-b border-[var(--borde)] px-4 py-2.5">
            <h2 className="text-[13px] font-semibold text-marca-900">Excepciones por persona</h2>
            <p className="text-[12px] text-marca-500">Mandan sobre la casilla de su rol: permitir una fuente que su rol no tiene, o negarle una que sí tiene.</p>
          </header>
          <ExcepcionesAlcance personas={personas} fuentes={fuentes} excepciones={porUsuario ?? []} editable={editable} />
        </section>
        <section className="rounded-xl border border-[var(--borde)] bg-white">
          <header className="border-b border-[var(--borde)] px-4 py-2.5">
            <h2 className="text-[13px] font-semibold text-marca-900">Ver como</h2>
            <p className="text-[12px] text-marca-500">Qué fuentes tendría el asistente de una persona y por qué no tiene las demás. No entra con su cuenta.</p>
          </header>
          <VerComo personas={personas} />
        </section>
      </div>
    </>
  )
}
