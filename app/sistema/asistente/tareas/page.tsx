import type { Metadata } from 'next'
import { requerirPermiso } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { catalogoModelos, miPolitica } from '@/lib/asistente/servidor'
import { fechaCaracas, type Bloque, type CanalTarea, type Frecuencia } from '@/lib/asistente/tipos'
import { CabeceraModulo } from '@/components/sistema/ui/cabecera-modulo'
import { ListaTareas, NuevaTarea, type CorridaVista, type TareaVista } from '@/components/sistema/asistente/tareas'
import type { EntradaTarea } from '@/components/sistema/asistente/acciones-f5'

export const metadata: Metadata = { title: 'Tareas programadas · Asistente de IA' }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

/**
 * Tareas programadas (fase 5): instrucciones que el asistente corre solo, a su
 * hora de Caracas, con los permisos de su dueño ese día. `?desde=<mensaje>`
 * abre el formulario con la propuesta que hizo el asistente en el chat.
 */
export default async function TareasPage({ searchParams }: PageProps<'/sistema/asistente/tareas'>) {
  const sesion = await requerirPermiso('sistema:asistente')
  const sp = await searchParams
  const desde = typeof sp.desde === 'string' && UUID.test(sp.desde) ? sp.desde : null
  const supabase = await createClient()
  const db = supabase.schema('asistente')
  const [pol, modelos, { data: tareas }, { data: corridas }, { data: proyectos }, { data: personas }, { data: config }, { data: origen }] = await Promise.all([
    miPolitica(),
    catalogoModelos(),
    db.from('tarea').select('*').eq('dueno', sesion.userId).order('creado_en', { ascending: false }),
    db.from('corrida').select('id, tarea_id, estado, programada_para, empezado_en, creado_en, manual, intento, chat_id, error, entregas').eq('dueno', sesion.userId).order('creado_en', { ascending: false }).limit(300),
    db.from('proyecto').select('id, nombre').eq('dueno', sesion.userId).order('nombre'),
    db.rpc('personas_con_asistente'),
    db.from('config').select('correo_remitente, whatsapp_plantilla').eq('id', true).maybeSingle(),
    desde ? db.from('mensaje').select('id, chat_id, bloques').eq('id', desde).maybeSingle() : Promise.resolve({ data: null }),
  ])

  const porTarea = new Map<string, CorridaVista[]>()
  for (const c of corridas ?? []) {
    const lista = porTarea.get(c.tarea_id) ?? []
    if (lista.length < 15)
      lista.push({
        id: c.id,
        estado: c.estado as CorridaVista['estado'],
        cuando: c.empezado_en ?? c.programada_para ?? c.creado_en,
        cuandoTexto: fechaCaracas(c.empezado_en ?? c.programada_para ?? c.creado_en),
        manual: c.manual,
        intento: c.intento,
        chatId: c.chat_id,
        error: c.error,
        entregas: (c.entregas ?? []) as CorridaVista['entregas'],
      })
    porTarea.set(c.tarea_id, lista)
  }
  const vistas: TareaVista[] = (tareas ?? []).map((t) => ({
    id: t.id,
    tipo: t.tipo as TareaVista['tipo'],
    nombre: t.nombre,
    instruccion: t.instruccion,
    proyectoId: t.proyecto_id,
    modelo: t.modelo,
    frecuencia: t.frecuencia as Frecuencia['frecuencia'],
    hora: String(t.hora).slice(0, 5),
    dias: t.dias ?? [],
    dia_mes: t.dia_mes,
    cada_horas: t.cada_horas,
    canales: t.canales as CanalTarea[],
    destinatarios: t.destinatarios ?? [],
    enMiDia: t.en_mi_dia,
    estado: t.estado as TareaVista['estado'],
    pausadaMotivo: t.pausada_motivo,
    proximaTexto: fechaCaracas(t.proxima_en),
    ultimaEn: t.ultima_en,
    fallas: t.fallas_seguidas,
    corridas: porTarea.get(t.id) ?? [],
  }))

  // La propuesta que hizo el asistente en el chat, para revisarla antes de programarla.
  let inicial: Partial<EntradaTarea> | undefined
  const propuesta = ((origen?.bloques ?? []) as Bloque[]).find((b) => b.tipo === 'propuesta_tarea')
  if (origen && propuesta?.tipo === 'propuesta_tarea') {
    const p = propuesta.propuesta
    inicial = { ...p, proyectoId: null, modelo: null, destinatarios: [], enMiDia: false, origenChat: origen.chat_id, origenMensaje: origen.id }
  }

  const opciones = {
    proyectos: proyectos ?? [],
    modelos: modelos.filter((m) => m.encendido && pol?.modelos.includes(m.id) && m.proveedor === pol?.motor).map((m) => ({ id: m.id, nombre: m.nombre })),
    personas: ((personas ?? []) as { perfil_id: string; nombre: string }[]).map((p) => ({ id: p.perfil_id, nombre: p.nombre })),
    correoListo: !!config?.correo_remitente,
    whatsappListo: !!config?.whatsapp_plantilla,
  }
  const activas = vistas.filter((t) => t.estado === 'activa').length

  return (
    <>
      <CabeceraModulo
        sesion={sesion}
        codigo="MI-ASI"
        titulo="Asistente de IA"
        migas={[{ etiqueta: 'Tareas programadas' }]}
        descripcion={`El asistente las corre solo, a su hora de Caracas y con tus permisos de ese día. Tienes ${activas} de ${pol?.max_tareas ?? 0} activas.`}
      />
      {pol && !pol.puede_programar ? (
        <p className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-900">Tu política no te deja programar tareas. Si lo necesitas, pídeselo a la administración de la plataforma.</p>
      ) : (
        <NuevaTarea key={inicial?.origenMensaje ?? 'nueva'} opciones={opciones} inicial={inicial} />
      )}
      <ListaTareas tareas={vistas} opciones={opciones} />
    </>
  )
}
