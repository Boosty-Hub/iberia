import type { Metadata } from 'next'
import Link from 'next/link'
import { esEditor, puede, requerirPermiso } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { leerContexto } from '@/lib/plataforma/servidor'
import { TABLA_ENTREVISTAS } from '@/lib/plataforma/tablas-programa'
import { nombreSesion } from '@/lib/utils'
import { CabeceraModulo, BOTON_CABECERA, BOTON_CABECERA_PRINCIPAL } from '@/components/sistema/ui/cabecera-modulo'
import { TablaServidor } from '@/components/sistema/ui/tabla-servidor'
import { BotonFicha } from '@/components/sistema/colaboracion/boton-ficha'

export const metadata: Metadata = { title: 'Entrevistas · Levantamiento' }

/**
 * PRG-LEV · Entrevistas y sesiones: la tabla del levantamiento con filtros en
 * chips por serie (ENT/SES/FOR), estado, área y sede; búsqueda sin tildes en los
 * datos de la sesión. La fila abre la ficha (datos, participantes, hallazgos y,
 * para el equipo, la transcripción).
 *
 * La búsqueda «en lo que se dijo» recorre las transcripciones, que son
 * perímetro «solo Boosty»: solo la hace el equipo (`esEditor`).
 */
export default async function EntrevistasPage({ searchParams }: PageProps<'/sistema/programa/levantamiento/entrevistas'>) {
  const [sesion, sp] = await Promise.all([requerirPermiso('modulo:entrevistas'), searchParams])
  const ctx = await leerContexto(sp)
  const crear = puede(sesion, 'modulo:entrevistas', 'crear')
  const equipo = esEditor(sesion.perfil)
  const q = typeof sp.q === 'string' ? sp.q.replace(/[,()%\\_]/g, ' ').trim().slice(0, 80) : ''

  // Lo que se dijo dentro de las transcripciones (solo el equipo).
  let dicho: { id: string; codigo: string; nombre: string; turnos: number }[] = []
  if (equipo && q.length >= 3) {
    const supabase = await createClient()
    const { data } = await supabase.from('transcripcion_segmentos').select('entrevista_id').ilike('texto', `%${q}%`).range(0, 1999)
    const cuenta = new Map<string, number>()
    for (const s of data ?? []) cuenta.set(s.entrevista_id, (cuenta.get(s.entrevista_id) ?? 0) + 1)
    if (cuenta.size) {
      const { data: ents } = await supabase.from('entrevistas').select('id, codigo, titulo, entrevistado_nombre').in('id', [...cuenta.keys()])
      dicho = (ents ?? []).map((e) => ({ id: e.id, codigo: e.codigo, nombre: nombreSesion(e), turnos: cuenta.get(e.id) ?? 0 })).sort((a, b) => b.turnos - a.turnos)
    }
  }

  return (
    <>
      <CabeceraModulo
        sesion={sesion}
        codigo="PRG-LEV"
        migas={[{ etiqueta: 'Entrevistas' }]}
        descripcion="Todo lo levantado: entrevistas (ENT, cuentan contra la meta de ~25), reuniones y recorridos (SES) y formaciones (FOR). Cada sesión guarda sus participantes, su transcripción y los hallazgos que salieron de ella."
        acciones={
          crear ? (
            <>
              <Link href="/sistema/programa/levantamiento/entrevistas/importar" className={BOTON_CABECERA_PRINCIPAL}>
                Importar de Fireflies
              </Link>
              <Link href="/sistema/programa/levantamiento/entrevistas/nueva" className={BOTON_CABECERA}>
                Crear a mano
              </Link>
            </>
          ) : undefined
        }
      />
      {dicho.length > 0 && (
        <section aria-label="Coincidencias en las transcripciones" className="mb-3 rounded-xl border border-[#e6dff7] bg-[#fbf8ff] p-3 text-[12.5px]">
          <p className="text-marca-700">
            <strong className="font-semibold">«{q}» se dijo en {dicho.length} {dicho.length === 1 ? 'sesión' : 'sesiones'}</strong>{' '}
            <span className="text-marca-500">· transcripciones, perímetro «solo Boosty» 🔒</span>
          </p>
          <ul className="mt-1.5 flex flex-wrap gap-1.5">
            {dicho.slice(0, 24).map((d) => (
              <li key={d.id}>
                <BotonFicha tipo="entrevista" id={d.id} className="rounded-full border border-[var(--borde)] bg-white px-2 py-0.5 text-[12px] text-marca-800">
                  <span className="font-mono text-[11px] text-marca-500">{d.codigo}</span> {d.nombre} · {d.turnos} {d.turnos === 1 ? 'turno' : 'turnos'}
                </BotonFicha>
              </li>
            ))}
          </ul>
        </section>
      )}
      <TablaServidor fuente={TABLA_ENTREVISTAS} sp={sp} sesion={sesion} ctx={ctx} vacio={q ? 'Ninguna sesión coincide en sus datos.' : 'Todavía no hay sesiones registradas.'} />
    </>
  )
}
