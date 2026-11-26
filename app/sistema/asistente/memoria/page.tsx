import type { Metadata } from 'next'
import { requerirPermiso } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { CabeceraModulo } from '@/components/sistema/ui/cabecera-modulo'
import { FilaMemoria, InterruptorMemoria, NuevaMemoria } from '@/components/sistema/asistente/f3-formularios'

export const metadata: Metadata = { title: 'Mi memoria · Asistente de IA' }

/**
 * Mi memoria (fase 3): lo que el asistente recuerda de cómo trabajas, con de
 * dónde salió. Se edita, se borra y se apaga. Nunca guarda datos de la
 * plataforma ni de otras personas, y no entra a los chats compartidos.
 */
export default async function MemoriaPage() {
  const sesion = await requerirPermiso('sistema:asistente')
  const supabase = await createClient()
  const db = supabase.schema('asistente')
  const [{ data: recuerdos }, { data: pref }, { data: chats }] = await Promise.all([
    db.from('memoria').select('id, texto, origen_chat, creado_en').eq('dueno', sesion.userId).order('creado_en', { ascending: false }),
    db.from('preferencia').select('memoria').eq('perfil_id', sesion.userId).maybeSingle(),
    db.from('chat').select('id, titulo').eq('dueno', sesion.userId),
  ])
  const titulo = new Map((chats ?? []).map((c) => [c.id, c.titulo]))

  return (
    <>
      <CabeceraModulo sesion={sesion} codigo="MI-ASI" titulo="Asistente de IA" migas={[{ etiqueta: 'Mi memoria' }]} descripcion="Lo que el asistente recuerda de cómo trabajas. Solo tú lo ves; lo puedes corregir, borrar o apagar." />
      <section className="rounded-xl border border-[var(--borde)] bg-white">
        <header className="border-b border-[var(--borde)] px-4 py-3">
          <InterruptorMemoria encendida={pref?.memoria !== false} />
        </header>
        <ul>
          {(recuerdos ?? []).map((r) => (
            <FilaMemoria key={r.id} id={r.id} texto={r.texto} origen={r.origen_chat && titulo.has(r.origen_chat) ? { id: r.origen_chat, titulo: titulo.get(r.origen_chat)! } : null} />
          ))}
          {!(recuerdos ?? []).length && <li className="px-4 py-6 text-center text-[13px] text-marca-400">El asistente todavía no recuerda nada de ti. Dile «recuerda que…» en cualquier chat.</li>}
        </ul>
        <div className="border-t border-[var(--borde)]">
          <NuevaMemoria />
        </div>
      </section>
    </>
  )
}
