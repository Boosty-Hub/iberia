'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import {
  AVISO_RESGUARDO,
  ETIQUETA_ESFUERZO,
  MAX_BYTES_ARCHIVO,
  TOPICO_CHAT,
  ETIQUETA_CLASE,
  bytesLegibles,
  comoArtefacto,
  horaCaracas,
  dentroDelMaximo,
  type Bloque,
  type ClaseArtefacto,
  type Esfuerzo,
  type EstadoTurno,
  type EventoTurno,
  type ModeloCatalogo,
  type Politica,
  estadoCupo,
  type EstadoCupo,
} from '@/lib/asistente/tipos'
import type { ArchivoVista, ChatLista, MensajeVista, TurnoVista } from '@/lib/asistente/datos'
import { calificar, confirmarSubida, crearChat, detenerTurno, enviarMensaje, prepararSubida, reintentarTurno } from './acciones'
import { adjuntarDeBiblioteca, buscarEnBiblioteca, type ItemBiblioteca } from '@/components/sistema/archivos/acciones'
import { borrarMemoria } from './acciones-f3'
import { CompartirObjeto, PanelCompartirChat } from './compartir'
import { useRouter } from 'next/navigation'
import { aWavDe16k, formatoDeGrabacion } from '@/lib/wav'
import { MarkdownChat } from './markdown-chat'
import { MantenerAlDia, TarjetaPropuesta } from './tareas-chat'
import { cn } from '@/lib/utils'

type Paso = Extract<Bloque, { tipo: 'paso' }>
type TurnoEnCurso = { id: string; estado: EstadoTurno; texto: string; pensamiento: string; pasos: Paso[]; bloques: Bloque[]; inicio: number }
type Abierto = { id: string; grupo: string; titulo: string; version: number; clase: ClaseArtefacto }
type Adjunto = { local: string; nombre: string; bytes: number; estado: 'subiendo' | 'listo' | 'error'; archivoId?: string; error?: string }

const ACEPTA = '.xlsx,.xls,.xlsm,.csv,.tsv,.docx,.doc,.pptx,.pdf,.txt,.md,.json,.xml,.png,.jpg,.jpeg,.webp,.gif'

const MIME_POR_EXTENSION: Record<string, string> = {
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  xlsm: 'application/vnd.ms-excel.sheet.macroEnabled.12',
  xls: 'application/vnd.ms-excel',
  csv: 'text/csv',
  tsv: 'text/tab-separated-values',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  doc: 'application/msword',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  pdf: 'application/pdf',
  txt: 'text/plain',
  md: 'text/markdown',
  json: 'application/json',
  xml: 'application/xml',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
}

function mimeDe(f: File): string {
  const ext = f.name.split('.').pop()?.toLowerCase() ?? ''
  return MIME_POR_EXTENSION[ext] ?? (f.type || 'application/octet-stream')
}

const usd = (n: number) => `US$ ${n.toFixed(2).replace('.', ',')}`
const ETIQUETA_CAPACIDAD: Record<string, string> = { herramientas: 'datos de la plataforma', archivos: 'archivos', busqueda: 'internet', investigacion: 'investigación profunda' }

export function ChatAsistente(props: {
  yo: { id: string; nombre: string }
  politica: Politica | null
  modelos: ModeloCatalogo[]
  chats: ChatLista[]
  chatId: string | null
  tituloInicial: string | null
  mensajesIniciales: MensajeVista[]
  archivosIniciales: ArchivoVista[]
  turnoInicial: TurnoVista | null
  modeloDelChat: string | null
  esfuerzoDelChat: string | null
  proyecto: { id: string; nombre: string } | null
  compartido: boolean
  esDueno: boolean
  participantes: { perfil_id: string; nombre: string; rol: string }[]
  fuentesDelChat: string[]
  atajos: { id: string; comando: string; titulo: string; instruccion: string; modelo: string | null; esfuerzo: string | null; empresa: boolean }[]
  /** Los mensajes de este chat cuya propuesta de tarea ya se programó. */
  tareasProgramadas: string[]
  /** Si el chat es el resultado de una tarea programada. */
  deTarea: { nombre: string; tipo: 'tarea' | 'tablero' } | null
  /** Lo que puede el motor activo (fase 6): lo que no, sale apagado con su motivo. */
  capacidades: { capacidad: string; disponible: boolean; motivo: string | null }[]
  /** En el panel lateral («Preguntar a la IA» desde cualquier pantalla): sin la lista de chats ni cambiar la URL. */
  compacto?: boolean
  /** Desde dónde se pregunta (módulo, ficha): viaja con el primer mensaje. */
  contexto?: string | null
  /** La ventana flotante: la pantalla en que está la persona AL ENVIAR; viaja con cada mensaje. */
  contextoVivo?: () => string | null
  /** Una pregunta que llega escrita (Ctrl K): se manda sola. */
  preguntaInicial?: string | null
  alCrearChat?: (id: string) => void
}) {
  const supabase = useMemo(() => createClient(), [])
  const [politica, setPolitica] = useState(props.politica)
  const [chatId, setChatId] = useState(props.chatId)
  const [chats, setChats] = useState(props.chats)
  const [mensajes, setMensajes] = useState(props.mensajesIniciales)
  const [archivos, setArchivos] = useState(() => new Map(props.archivosIniciales.map((a) => [a.id, a])))
  const abiertoAlEntrar = props.turnoInicial && (props.turnoInicial.estado === 'en_cola' || props.turnoInicial.estado === 'corriendo')
  const [turno, setTurno] = useState<TurnoEnCurso | null>(
    abiertoAlEntrar ? { id: props.turnoInicial!.id, estado: props.turnoInicial!.estado, texto: '', pensamiento: '', pasos: [], bloques: [], inicio: Date.parse(props.turnoInicial!.creado_en) } : null
  )
  const [fallo, setFallo] = useState<{ turno: string; error: string } | null>(
    props.turnoInicial && (props.turnoInicial.estado === 'fallido' || props.turnoInicial.estado === 'detenido')
      ? { turno: props.turnoInicial.id, error: props.turnoInicial.error ?? (props.turnoInicial.estado === 'detenido' ? 'Detenido.' : 'No se pudo completar.') }
      : null
  )
  const [texto, setTexto] = useState(props.preguntaInicial?.trim() ?? '')
  const [adjuntos, setAdjuntos] = useState<Adjunto[]>([])
  const [aviso, setAviso] = useState<string | null>(null)
  const [ahora, setAhora] = useState(() => Date.now())
  const [renovado, setRenovado] = useState<string | null>(null)
  const [avisarNavegador, setAvisarNavegador] = useState<'no' | 'pedido'>('no')
  const [ocupado, setOcupado] = useState(false)
  const [html, setHtml] = useState<Abierto | null>(null)
  const archivoInput = useRef<HTMLInputElement>(null)
  const [listaAbierta, setListaAbierta] = useState(false)
  const [filtro, setFiltro] = useState('')
  const [arrastrando, setArrastrando] = useState(false)
  const [panelCompartir, setPanelCompartir] = useState(false)
  const [alAsistente, setAlAsistente] = useState(true)
  const [investigacion, setInvestigacion] = useState(false)
  const programadas = useMemo(() => new Set(props.tareasProgramadas), [props.tareasProgramadas])
  const autoEnvio = useRef(!!props.preguntaInicial?.trim())
  const capacidad = (k: string) => props.capacidades.find((c) => c.capacidad === k) ?? { capacidad: k, disponible: true, motivo: null }
  const sinArchivos = !capacidad('archivos').disponible
  const sinInvestigacion = !capacidad('investigacion').disponible
  const router = useRouter()
  const nombreDe = useMemo(() => new Map(props.participantes.map((p) => [p.perfil_id, p.nombre])), [props.participantes])
  const [grabando, setGrabando] = useState<'no' | 'grabando' | 'transcribiendo'>('no')
  const grabadora = useRef<MediaRecorder | null>(null)
  // El menú «/»: se abre cuando el texto empieza con «/» y todavía no tiene espacio.
  const consultaAtajo = /^\/[a-z0-9-]*$/i.test(texto) ? texto.slice(1).toLowerCase() : null
  const atajosVisibles = consultaAtajo === null ? [] : props.atajos.filter((a) => a.comando.includes(consultaAtajo) || a.titulo.toLowerCase().includes(consultaAtajo)).slice(0, 8)
  // «/» también busca en Mis archivos (26-nov-2026): con dos letras o más, carpetas y archivos propios o compartidos.
  const consultaBiblio = /^\/[^\n]{2,60}$/.test(texto) ? texto.slice(1).trim() : null
  const [resBiblio, setResBiblio] = useState<{ q: string; items: ItemBiblioteca[] }>({ q: '', items: [] })
  const biblioteca = consultaBiblio && resBiblio.q === consultaBiblio ? resBiblio.items : []
  useEffect(() => {
    if (!consultaBiblio || consultaBiblio.length < 2) return
    let vigente = true
    const t = setTimeout(() => void buscarEnBiblioteca(consultaBiblio).then((items) => vigente && setResBiblio({ q: consultaBiblio, items })), 250)
    return () => {
      vigente = false
      clearTimeout(t)
    }
  }, [consultaBiblio])
  const usarDeBiblioteca = async (item: ItemBiblioteca) => {
    setTexto('')
    setResBiblio({ q: '', items: [] })
    const local = crypto.randomUUID()
    setAdjuntos((a) => [...a, { local, nombre: item.tipo === 'carpeta' ? `📁 ${item.nombre}` : item.nombre, bytes: 0, estado: 'subiendo' }])
    const r = await adjuntarDeBiblioteca(item.tipo, item.id)
    if (!r.ok) return setAdjuntos((a) => a.map((x) => (x.local === local ? { ...x, estado: 'error', error: r.error } : x)))
    setArchivos((m) => {
      const n = new Map(m)
      for (const x of r.adjuntos) n.set(x.archivoId, { id: x.archivoId, nombre: x.nombre, mime: x.mime, bytes: x.bytes, origen: 'subido' })
      return n
    })
    setAdjuntos((a) => [...a.filter((x) => x.local !== local), ...r.adjuntos.map((x) => ({ local: crypto.randomUUID(), nombre: x.nombre, bytes: x.bytes, estado: 'listo' as const, archivoId: x.archivoId }))])
    setTimeout(() => entrada.current?.focus(), 0)
  }
  const usarAtajo = (a: (typeof props.atajos)[number]) => {
    setTexto(a.instruccion)
    if (a.modelo && disponibles.some((m) => m.id === a.modelo)) elegirModelo(a.modelo)
    if (a.esfuerzo) setEsfuerzo(a.esfuerzo as Esfuerzo)
    setTimeout(() => entrada.current?.focus(), 0)
  }
  // Dictado: graba, convierte a WAV de 16 kHz y lo transcribe; el texto se revisa antes de enviar.
  const dictar = async () => {
    if (grabando === 'grabando') {
      grabadora.current?.stop()
      return
    }
    try {
      const flujo = await navigator.mediaDevices.getUserMedia({ audio: true })
      const formato = formatoDeGrabacion()
      const g = new MediaRecorder(flujo, formato ? { mimeType: formato } : undefined)
      const trozos: Blob[] = []
      g.ondataavailable = (e) => e.data.size && trozos.push(e.data)
      g.onstop = async () => {
        flujo.getTracks().forEach((t) => t.stop())
        setGrabando('transcribiendo')
        try {
          const wav = await aWavDe16k(new Blob(trozos, { type: g.mimeType }))
          const r = await fetch('/sistema/asistente/transcribir', { method: 'POST', body: wav, headers: { 'Content-Type': 'audio/wav' } })
          const j = (await r.json()) as { texto?: string; error?: string }
          if (j.texto) setTexto((t) => (t.trim() ? `${t.trim()} ${j.texto}` : j.texto!))
          else setAviso(j.error ?? 'No se pudo transcribir.')
        } catch {
          setAviso('No se pudo transcribir.')
        } finally {
          setGrabando('no')
          entrada.current?.focus()
        }
      }
      grabadora.current = g
      g.start()
      setGrabando('grabando')
      setTimeout(() => g.state === 'recording' && g.stop(), 60_000)
    } catch {
      setAviso('No se pudo usar el micrófono. Revisa el permiso del navegador.')
    }
  }

  const motor = politica?.motor ?? 'anthropic'
  const disponibles = props.modelos.filter((m) => m.proveedor === motor && m.encendido && (politica?.modelos ?? []).includes(m.id))
  const inicialModelo = disponibles.find((m) => m.id === props.modeloDelChat)?.id ?? disponibles.find((m) => m.id === politica?.modelo_defecto)?.id ?? disponibles[0]?.id ?? ''
  const [modelo, setModelo] = useState(inicialModelo)
  const modeloActual = disponibles.find((m) => m.id === modelo)
  const esfuerzos = (modeloActual?.esfuerzos ?? ['medium']).filter((e) => !politica || dentroDelMaximo(e, politica.esfuerzo_max))
  const [esfuerzo, setEsfuerzo] = useState<Esfuerzo>(
    (esfuerzos.includes(props.esfuerzoDelChat as Esfuerzo) ? props.esfuerzoDelChat : esfuerzos.includes(politica?.esfuerzo_defecto ?? 'medium') ? politica?.esfuerzo_defecto : esfuerzos.at(-1)) as Esfuerzo
  )
  // Al cambiar de modelo, el esfuerzo se ajusta a lo que ese modelo admite (en el evento, no en un efecto).
  const elegirModelo = (id: string) => {
    setModelo(id)
    const admite = (disponibles.find((m) => m.id === id)?.esfuerzos ?? ['medium']).filter((e) => !politica || dentroDelMaximo(e, politica.esfuerzo_max))
    if (!admite.includes(esfuerzo)) setEsfuerzo((admite.includes('medium') ? 'medium' : admite[0]) as Esfuerzo)
  }

  const canal = useRef<RealtimeChannel | null>(null)
  const fin = useRef<HTMLDivElement>(null)
  const lista = useRef<HTMLDivElement>(null)
  const entrada = useRef<HTMLTextAreaElement>(null)
  const pegado = useRef(true)
  // El canal se suscribe una vez; sus eventos llaman siempre a la versión más
  // nueva del manejador y del chat (si no, un chat recién creado se quedaba con
  // `chatId` nulo y no refrescaba su título ni sus archivos).
  const chatIdRef = useRef(chatId)
  const manejarRef = useRef<(e: EventoTurno) => void>(() => undefined)
  useEffect(() => {
    chatIdRef.current = chatId
  }, [chatId])

  // ── Al terminar un turno: el mensaje guardado, los archivos y el título ──
  const cerrarTurno = useCallback(
    async (turnoId: string, mensajeId: string | null, estado: EstadoTurno, error?: string | null) => {
      const db = supabase.schema('asistente')
      const id = chatIdRef.current
      if (mensajeId) {
        const { data: m } = await db.from('mensaje').select('id, rol, texto, bloques, adjuntos, turno_id, calificacion, creado_en').eq('id', mensajeId).maybeSingle()
        if (m) setMensajes((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m as MensajeVista]))
      }
      if (id) {
        const [{ data: arch }, { data: c }] = await Promise.all([
          db.from('archivo').select('id, nombre, mime, bytes, origen').eq('chat_id', id),
          db.from('chat').select('id, titulo, actualizado_en, compartido').eq('id', id).maybeSingle(),
        ])
        if (arch) setArchivos(new Map((arch as ArchivoVista[]).map((a) => [a.id, a])))
        if (c) setChats((prev) => [c as ChatLista, ...prev.filter((x) => x.id !== c.id)])
      }
      setTurno((t) => (t && (t.id === turnoId || t.id === 'pendiente') ? null : t))
      if (estado === 'fallido' || estado === 'detenido') setFallo({ turno: turnoId, error: error ?? (estado === 'detenido' ? 'Detenido.' : 'No se pudo completar.') })
      const { data: pol } = await supabase.schema('asistente').rpc('mi_politica')
      if (pol) setPolitica(pol as Politica)
    },
    [supabase]
  )

  const manejar = useCallback(
    (e: EventoTurno) => {
      if (e.t === 'fin') {
        void cerrarTurno(e.turno, e.mensaje, e.estado, e.error)
        return
      }
      if (e.t === 'mensaje') {
        void supabase
          .schema('asistente')
          .from('mensaje')
          .select('id, rol, texto, bloques, adjuntos, turno_id, autor, calificacion, creado_en')
          .eq('id', e.id)
          .maybeSingle()
          .then(({ data: m }) => m && setMensajes((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m as MensajeVista])))
        return
      }
      setTurno((t) => {
        const base: TurnoEnCurso = t && (t.id === e.turno || t.id === 'pendiente') ? { ...t, id: e.turno } : { id: e.turno, estado: 'corriendo', texto: '', pensamiento: '', pasos: [], bloques: [], inicio: Date.now() }
        if (e.t === 'estado') return { ...base, estado: e.estado }
        if (e.t === 'texto') return { ...base, estado: 'corriendo', texto: base.texto + e.d }
        if (e.t === 'pensamiento') return { ...base, estado: 'corriendo', pensamiento: base.pensamiento + e.d }
        if (e.t === 'paso') return { ...base, estado: 'corriendo', pasos: [...base.pasos.filter((p) => p.id !== e.paso.id), e.paso] }
        if (e.t === 'bloque') {
          // Como en Claude: el artefacto se abre solo en el panel apenas existe (o cambia de versión).
          const a = comoArtefacto(e.bloque)
          if (a) setHtml(a)
          return { ...base, bloques: [...base.bloques, e.bloque] }
        }
        return base
      })
    },
    [cerrarTurno, supabase]
  )
  useEffect(() => {
    manejarRef.current = manejar
  }, [manejar])

  const suscribir = useCallback(
    async (id: string) => {
      if (canal.current?.topic === `realtime:${TOPICO_CHAT(id)}`) return
      if (canal.current) await supabase.removeChannel(canal.current)
      await supabase.realtime.setAuth()
      const c = supabase.channel(TOPICO_CHAT(id), { config: { private: true } })
      c.on('broadcast', { event: 'evento' }, ({ payload }) => manejarRef.current(payload as EventoTurno))
      canal.current = c
      await new Promise<void>((listo) => {
        const tope = setTimeout(listo, 3000)
        c.subscribe((s) => {
          if (s === 'SUBSCRIBED') {
            clearTimeout(tope)
            listo()
          }
        })
      })
    },
    [supabase]
  )

  useEffect(() => {
    if (chatId) void suscribir(chatId)
    return () => {
      if (canal.current) void supabase.removeChannel(canal.current)
      canal.current = null
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Respaldo por si se pierde un evento: mientras corre un turno se mira su estado cada 4 s.
  useEffect(() => {
    if (!turno || turno.id === 'pendiente') return
    const id = turno.id
    const t = setInterval(async () => {
      const { data } = await supabase.schema('asistente').from('turno').select('estado, error').eq('id', id).maybeSingle()
      if (!data || data.estado === 'en_cola' || data.estado === 'corriendo') return
      const { data: m } = await supabase.schema('asistente').from('mensaje').select('id').eq('turno_id', id).eq('rol', 'asistente').maybeSingle()
      void cerrarTurno(id, m?.id ?? null, data.estado as EstadoTurno, data.error)
    }, 4000)
    return () => clearInterval(t)
  }, [turno?.id, supabase, cerrarTurno]) // eslint-disable-line react-hooks/exhaustive-deps

  // Bajar al final mientras llega texto, si la persona no subió a leer.
  useEffect(() => {
    if (pegado.current) fin.current?.scrollIntoView({ block: 'end' })
  }, [mensajes.length, turno?.texto, turno?.pasos.length, turno?.bloques.length])

  const alDesplazar = () => {
    const el = lista.current
    if (el) pegado.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120
  }

  // ── Adjuntar: la subida empieza en el acto, mientras se escribe ──
  const adjuntar = (files: FileList | File[]) => {
    const nuevos = Array.from(files)
    for (const f of nuevos) {
      const local = crypto.randomUUID()
      if (f.size > MAX_BYTES_ARCHIVO) {
        setAdjuntos((a) => [...a, { local, nombre: f.name, bytes: f.size, estado: 'error', error: 'Pasa de 100 MB' }])
        continue
      }
      setAdjuntos((a) => [...a, { local, nombre: f.name, bytes: f.size, estado: 'subiendo' }])
      const marcar = (cambio: Partial<Adjunto>) => setAdjuntos((a) => a.map((x) => (x.local === local ? { ...x, ...cambio } : x)))
      void (async () => {
        const mime = mimeDe(f)
        const p = await prepararSubida({ nombre: f.name, mime, bytes: f.size, chatId })
        if (!p.ok) return marcar({ estado: 'error', error: p.error })
        const { error } = await supabase.storage.from('asistente').upload(p.ruta, f, { contentType: mime, upsert: false })
        if (error) return marcar({ estado: 'error', error: 'No se pudo subir' })
        const c = await confirmarSubida(p.archivoId)
        if (!c.ok) return marcar({ estado: 'error', error: c.error })
        setArchivos((m) => new Map(m).set(p.archivoId, { id: p.archivoId, nombre: f.name, mime, bytes: c.bytes, origen: 'subido' }))
        marcar({ estado: 'listo', archivoId: p.archivoId })
      })()
    }
  }

  // ── Enviar ──
  const enviar = async () => {
    if (ocupado || (turno && turno.estado !== 'fallido')) return
    const t = texto.trim()
    if (cupo.tipo !== 'ok' && paraElAsistenteAhora) return
    if (adjuntos.some((a) => a.estado === 'subiendo')) return setAviso('Espera a que terminen de subir los archivos.')
    const listos = adjuntos.filter((a) => a.estado === 'listo' && a.archivoId)
    if (!t && !listos.length) return
    setAviso(null)
    setFallo(null)
    setOcupado(true)
    try {
      let id = chatId
      if (!id) {
        const r = await crearChat(t || listos[0]?.nombre || 'Chat nuevo', props.proyecto?.id ?? null)
        if (!r.ok) return setAviso(r.error)
        id = r.chatId
        chatIdRef.current = id
        setChatId(id)
        if (!props.compacto) window.history.replaceState(null, '', `/sistema/asistente/c/${id}`)
        props.alCrearChat?.(id)
        setChats((c) => [{ id: r.chatId, titulo: (t || listos[0]?.nombre || 'Chat nuevo').slice(0, 60), actualizado_en: new Date().toISOString(), compartido: false }, ...c])
      }
      await suscribir(id)
      const temporal = `tmp-${crypto.randomUUID()}`
      // El contexto de la página (panel lateral) va con el primer mensaje del chat.
      // En la ventana flotante, con cada mensaje: la persona navega y pregunta por lo que tiene delante.
      const contexto = props.contextoVivo ? props.contextoVivo() : props.contexto && !mensajes.some((m) => m.rol === 'usuario') ? props.contexto : null
      setMensajes((m) => [...m, { id: temporal, rol: 'usuario', texto: t, bloques: contexto ? [{ tipo: 'nota', texto: `Desde: ${contexto}` }] : [], adjuntos: listos.map((a) => a.archivoId!), turno_id: null, autor: props.yo.id, calificacion: null, creado_en: new Date().toISOString() }])
      setTexto('')
      setAdjuntos((a) => a.filter((x) => x.estado === 'error'))
      const paraElAsistente = !props.compartido || alAsistente
      if (paraElAsistente) setTurno({ id: 'pendiente', estado: 'en_cola', texto: '', pensamiento: '', pasos: [], bloques: [], inicio: Date.now() })
      pegado.current = true
      const r = await enviarMensaje({ chatId: id, texto: t, adjuntos: listos.map((a) => a.archivoId!), modelo, esfuerzo, alAsistente: paraElAsistente, investigacion: paraElAsistente && investigacion, contexto })
      setInvestigacion(false)
      if (!r.ok) {
        setMensajes((m) => m.filter((x) => x.id !== temporal))
        setTexto(t)
        setTurno(null)
        setAviso(r.error)
        return
      }
      setMensajes((m) => m.map((x) => (x.id === temporal ? { ...x, id: r.mensajeId, turno_id: r.turnoId } : x)))
      if (r.turnoId) {
        const tid = r.turnoId
        setTurno((x) => (x && x.id === 'pendiente' ? { ...x, id: tid } : x))
      }
    } finally {
      setOcupado(false)
      entrada.current?.focus()
    }
  }
  // La pregunta que llegó escrita (Ctrl K) se manda sola, una vez.
  useEffect(() => {
    if (!autoEnvio.current) return
    autoEnvio.current = false
    void enviar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])


  const detener = async () => {
    if (turno && turno.id !== 'pendiente') await detenerTurno(turno.id)
  }

  const reintentar = async () => {
    if (!fallo) return
    const r = await reintentarTurno(fallo.turno)
    if (!r.ok) return setAviso(r.error)
    setFallo(null)
    setTurno({ id: r.turnoId, estado: 'en_cola', texto: '', pensamiento: '', pasos: [], bloques: [], inicio: Date.now() })
  }

  const corriendo = !!turno
  const chatsFiltrados = filtro.trim() ? chats.filter((c) => c.titulo.toLowerCase().includes(filtro.trim().toLowerCase())) : chats
  const sinHabilitar = !politica?.habilitado || !politica.encendido
  // El cupo (26-nov-2026, Gabriel): al llegar al tope la caja se cierra hasta que se renueve, en vez de dejar mandar
  // mensajes que se quedan sin respuesta. En un chat compartido se le sigue pudiendo escribir al grupo (no gasta).
  const cupo: EstadoCupo = politica && !sinHabilitar ? estadoCupo(politica, modelo, investigacion, disponibles.map((m) => m.id), ahora) : { tipo: 'ok' }
  const paraElAsistenteAhora = !props.compartido || alAsistente
  const cerradoPorCupo = cupo.tipo === 'bloqueado' && paraElAsistenteAhora
  // Cerrado por el tope: se anota para el aviso de la campana y, a la hora de la renovación, se vuelve a pedir la
  // política. Entonces sale un aviso flotante (y uno del navegador, si la persona lo permitió).
  const claveBloqueo = cupo.tipo === 'bloqueado' ? `${cupo.motivo}|${cupo.renueva ?? ''}` : ''
  useEffect(() => {
    if (!claveBloqueo) return
    const [motivo, renueva] = claveBloqueo.split('|')
    if (!renueva) return
    // Las consultas de supabase-js no salen hasta que alguien las espera: sin el then, nunca se mandaba.
    if (motivo !== 'empresa') supabase.schema('asistente').rpc('anotar_tope', { p_motivo: motivo, p_renueva: renueva }).then(() => undefined)
    const espera = Math.min(Math.max(1000, Date.parse(renueva) - Date.now() + 3000), 2_000_000_000)
    const reloj = setTimeout(async () => {
      const { data: pol } = await supabase.schema('asistente').rpc('mi_politica')
      setAhora(Date.now())
      if (!pol) return
      setPolitica(pol as Politica)
      const texto = motivo === 'ventana' ? 'Tu ventana de 5 horas se renovó: ya puedes seguir conversando.' : motivo === 'dia' ? 'Tu cupo del día se renovó: ya puedes seguir.' : 'Tu cupo se renovó: ya puedes seguir.'
      setRenovado(texto)
      setTimeout(() => setRenovado(null), 12_000)
      try {
        if ('Notification' in window && Notification.permission === 'granted') new Notification('Asistente de IA', { body: texto, icon: '/icon.png' })
      } catch {}
    }, espera)
    return () => clearTimeout(reloj)
  }, [claveBloqueo, supabase])

  const pct = (g: number, t: number) => Math.min(100, Math.round((g / Math.max(t, 0.0001)) * 100))

  return (
    <div className={cn('flex gap-3', props.compacto ? 'h-full min-h-0' : 'h-[calc(100dvh-196px)] min-h-[520px]')}>
      {/* Lista de chats */}
      {!props.compacto && (
      <aside
        className={cn(
          'w-64 shrink-0 flex-col rounded-xl border border-[var(--borde)] bg-white',
          listaAbierta ? 'fixed inset-y-3 left-3 z-40 flex shadow-xl' : html ? 'hidden' : 'hidden lg:flex'
        )}
        aria-label="Tus chats"
      >
        <div className="flex items-center gap-2 border-b border-[var(--borde)] p-2.5">
          <Link href="/sistema/asistente" className="btn-acento h-9 flex-1 px-3 text-[13px]" onClick={() => setListaAbierta(false)}>
            + Chat nuevo
          </Link>
          {listaAbierta && (
            <button type="button" className="btn-neutro h-9 px-3 text-[13px]" onClick={() => setListaAbierta(false)} aria-label="Cerrar la lista">
              ✕
            </button>
          )}
        </div>
        <div className="p-2.5 pb-1">
          <input value={filtro} onChange={(e) => setFiltro(e.target.value)} placeholder="Buscar en tus chats" aria-label="Buscar en tus chats" className="h-8 w-full rounded-lg border border-[var(--borde)] px-2.5 text-[13px] outline-none focus:border-marca-400" />
        </div>
        <nav className="min-h-0 flex-1 overflow-y-auto px-1.5 pb-2">
          {chatsFiltrados.length === 0 && <p className="px-2 py-3 text-[12.5px] text-marca-400">{chats.length ? 'Nada coincide.' : 'Aquí van a salir tus chats.'}</p>}
          {chatsFiltrados.map((c) => (
            <Link
              key={c.id}
              href={`/sistema/asistente/c/${c.id}`}
              onClick={() => setListaAbierta(false)}
              aria-current={c.id === chatId ? 'page' : undefined}
              className={cn('block truncate rounded-lg px-2.5 py-2 text-[13px]', c.id === chatId ? 'bg-marca-100 font-semibold text-marca-900' : 'text-marca-700 hover:bg-marca-50')}
            >
              {c.titulo}
            </Link>
          ))}
        </nav>
        {politica && (
          <div className="space-y-2 border-t border-[var(--borde)] p-3 text-[11.5px] text-marca-500" data-uso>
            <Medidor
              etiqueta="Esta ventana de 5 h"
              valor={politica.ventana_renueva ? pct(politica.gastado_ventana_usd, politica.tope_ventana_usd) : 0}
              nota={politica.ventana_renueva ? `Se renueva a las ${horaCaracas(politica.ventana_renueva)}` : 'Arranca con tu próximo mensaje'}
            />
            <Medidor etiqueta="Hoy" valor={pct(politica.gastado_dia_usd, politica.tope_diario_usd)} />
            <Medidor etiqueta="Este mes" valor={pct(politica.gastado_mes_usd, politica.tope_mensual_usd)} />
          </div>
        )}
      </aside>
      )}

      {/* El chat */}
      <section
        className={cn('relative flex min-w-0 flex-1 flex-col rounded-xl border border-[var(--borde)] bg-white', arrastrando && 'ring-2 ring-acento-400')}
        onDragOver={(e) => {
          e.preventDefault()
          if (!sinHabilitar) setArrastrando(true)
        }}
        onDragLeave={() => setArrastrando(false)}
        onDrop={(e) => {
          e.preventDefault()
          setArrastrando(false)
          if (!sinHabilitar && e.dataTransfer.files.length) adjuntar(e.dataTransfer.files)
        }}
      >
        <div className="flex items-center gap-2 border-b border-[var(--borde)] px-3 py-2">
          {!props.compacto && (
            <button type="button" className={cn('btn-neutro h-8 px-3 text-[12.5px]', !html && 'lg:hidden')} onClick={() => setListaAbierta(true)}>
              ☰ Chats
            </button>
          )}
          <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-marca-800">{chats.find((c) => c.id === chatId)?.titulo ?? props.tituloInicial ?? 'Chat nuevo'}</span>
          {props.participantes.length > 1 && (
            <span className="flex -space-x-1.5" aria-label={`En el chat: ${props.participantes.map((p) => p.nombre).join(', ')}`}>
              {props.participantes.slice(0, 5).map((p) => (
                <span key={p.perfil_id} title={p.nombre} className="grid h-6 w-6 place-items-center rounded-full border-2 border-white bg-marca-200 text-[10.5px] font-semibold text-marca-800">
                  {p.nombre.slice(0, 1)}
                </span>
              ))}
            </span>
          )}
          {chatId && (props.esDueno || props.compartido) && (
            <button type="button" className="btn-neutro h-8 px-3 text-[12.5px]" onClick={() => setPanelCompartir((x) => !x)} aria-expanded={panelCompartir}>
              {props.compartido ? 'Personas' : 'Compartir chat'}
            </button>
          )}
        </div>
        {props.deTarea && (
          <p className="flex flex-wrap items-center gap-2 border-b border-[var(--borde)] bg-marca-50 px-3 py-1.5 text-[12px] text-marca-600">
            <span aria-hidden>⏱</span>
            Resultado de {props.deTarea.tipo === 'tablero' ? 'el tablero vivo' : 'la tarea programada'} «{props.deTarea.nombre}», hecho con tus permisos de ese día.
            <Link href="/sistema/asistente/tareas" className="font-semibold text-acento-700 hover:underline">
              Ver tareas
            </Link>
          </p>
        )}
        {panelCompartir && chatId && (
          <PanelCompartirChat
            chatId={chatId}
            esDueno={props.esDueno}
            yo={props.yo.id}
            participantes={props.participantes}
            fuentes={props.fuentesDelChat}
            onCambio={() => router.refresh()}
            onCerrar={() => setPanelCompartir(false)}
          />
        )}

        <div ref={lista} onScroll={alDesplazar} className="min-h-0 flex-1 overflow-y-auto px-3 py-4 sm:px-6">
          <div className="mx-auto flex max-w-3xl flex-col gap-5">
            {props.proyecto && (
              <Link href={`/sistema/asistente/proyectos/${props.proyecto.id}`} className="self-center rounded-full border border-[var(--borde)] bg-marca-50 px-3 py-1 text-[12px] text-marca-600 hover:bg-marca-100">
                Proyecto: {props.proyecto.nombre}
              </Link>
            )}
            {mensajes.length === 0 && !turno && <Bienvenida nombre={props.yo.nombre} sinHabilitar={sinHabilitar} onEjemplo={(t) => setTexto(t)} />}
            {mensajes.map((m) =>
              m.rol === 'usuario' ? (
                <MensajeUsuario key={m.id} m={m} archivos={archivos} autor={props.compartido && m.autor && m.autor !== props.yo.id ? (nombreDe.get(m.autor) ?? 'Alguien') : null} />
              ) : (
                <MensajeAsistente key={m.id} m={m} archivos={archivos} onHtml={setHtml} chatId={chatId} programadas={programadas} />
              )
            )}
            {turno && <TurnoVivo turno={turno} archivos={archivos} onHtml={setHtml} />}
            {fallo && !turno && (
              <div role="alert" className="rounded-xl border border-acento-200 bg-acento-50/60 px-4 py-3 text-[13.5px] text-acento-800">
                <p>{fallo.error}</p>
                <button type="button" className="btn-neutro mt-2 h-8 px-3 text-[12.5px]" onClick={reintentar}>
                  Reintentar
                </button>
              </div>
            )}
            <div ref={fin} />
          </div>
        </div>

        {/* La caja de escribir */}
        <div className="border-t border-[var(--borde)] px-3 pt-2.5 pb-2 sm:px-6">
          <div className="mx-auto max-w-3xl">
            {aviso && (
              <p role="status" className="mb-2 rounded-lg bg-amber-50 px-3 py-1.5 text-[12.5px] text-amber-900">
                {aviso}
              </p>
            )}
            {renovado && (
              <div role="alert" className="fixed right-4 bottom-4 z-[70] flex max-w-sm items-start gap-3 rounded-2xl border border-emerald-200 bg-white p-4 shadow-xl" data-cupo-renovado>
                <span className="mt-0.5 text-[18px]" aria-hidden>
                  ✅
                </span>
                <p className="min-w-0 flex-1 text-[13px] text-marca-800">
                  <strong className="block text-marca-900">Asistente de IA</strong>
                  {renovado}
                </p>
                <button type="button" aria-label="Cerrar el aviso" className="h-8 w-8 shrink-0 rounded-lg text-marca-500 hover:bg-marca-50" onClick={() => setRenovado(null)}>
                  ✕
                </button>
              </div>
            )}
            {adjuntos.length > 0 && (
              <ul className="mb-2 flex flex-wrap gap-1.5" aria-label="Adjuntos">
                {adjuntos.map((a) => (
                  <li key={a.local} className={cn('inline-flex max-w-[260px] items-center gap-1.5 rounded-lg border px-2 py-1 text-[12px]', a.estado === 'error' ? 'border-acento-200 bg-acento-50 text-acento-800' : 'border-[var(--borde)] bg-marca-50 text-marca-700')}>
                    {a.estado === 'subiendo' ? <Giro /> : a.estado === 'listo' ? <span aria-hidden>📎</span> : <span aria-hidden>⚠</span>}
                    <span className="truncate">{a.nombre}</span>
                    <span className="shrink-0 text-marca-400">{a.estado === 'error' ? a.error : bytesLegibles(a.bytes)}</span>
                    <button type="button" aria-label={`Quitar ${a.nombre}`} className="shrink-0 px-0.5 text-marca-400 hover:text-marca-800" onClick={() => setAdjuntos((x) => x.filter((y) => y.local !== a.local))}>
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {atajosVisibles.length > 0 && (
              <ul role="listbox" aria-label="Atajos" className="mb-1.5 max-h-60 overflow-y-auto rounded-xl border border-[var(--borde)] bg-white p-1 shadow-lg">
                {atajosVisibles.map((a) => (
                  <li key={a.id}>
                    <button type="button" role="option" aria-selected={false} onClick={() => usarAtajo(a)} className="flex w-full items-baseline gap-2 rounded-lg px-2.5 py-1.5 text-left hover:bg-marca-50">
                      <span className="font-mono text-[12.5px] text-acento-700">/{a.comando}</span>
                      <span className="text-[13px] text-marca-800">{a.titulo}</span>
                      <span className="ml-auto text-[11px] text-marca-400">{a.empresa ? 'Empresa' : 'Mío'}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {biblioteca.length > 0 && (
              <ul role="listbox" aria-label="Mis archivos" className="mb-1.5 max-h-60 overflow-y-auto rounded-xl border border-[var(--borde)] bg-white p-1 shadow-lg" data-menu-biblioteca>
                {biblioteca.map((b) => (
                  <li key={`${b.tipo}-${b.id}`}>
                    <button type="button" role="option" aria-selected={false} onClick={() => void usarDeBiblioteca(b)} className="flex w-full items-baseline gap-2 rounded-lg px-2.5 py-1.5 text-left hover:bg-marca-50">
                      <span aria-hidden>{b.tipo === 'carpeta' ? '📁' : '📄'}</span>
                      <span className="min-w-0 truncate text-[13px] text-marca-800">{b.nombre}</span>
                      <span className="ml-auto shrink-0 text-[11px] text-marca-400">{b.detalle}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {cupo.tipo !== 'ok' && paraElAsistenteAhora && (
              <div role="status" className="mb-1.5 flex flex-wrap items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[12.5px] text-amber-900" data-cupo={cupo.tipo}>
                <span className="min-w-0 flex-1">
                  {cupo.texto}
                  {cupo.tipo === 'bloqueado' && cupo.motivo !== 'empresa' ? ' Te avisamos cuando se renueve.' : ''}
                </span>
                {cupo.tipo === 'cambiar' && cupo.quitarInvestigacion && (
                  <button type="button" className="btn-neutro h-8 px-2.5 text-[12px]" onClick={() => setInvestigacion(false)}>
                    Quitar «Investigación»
                  </button>
                )}
                {cupo.tipo === 'cambiar' && !cupo.quitarInvestigacion && (
                  <button type="button" className="btn-neutro h-8 px-2.5 text-[12px]" onClick={() => elegirModelo(cupo.otroModelo)}>
                    Usar {disponibles.find((m) => m.id === cupo.otroModelo)?.nombre ?? cupo.otroModelo}
                  </button>
                )}
                {cupo.tipo === 'bloqueado' && cupo.motivo !== 'empresa' && avisarNavegador === 'no' && (
                  <button
                    type="button"
                    className="btn-neutro h-8 px-2.5 text-[12px]"
                    onClick={() => {
                      setAvisarNavegador('pedido')
                      try {
                        if ('Notification' in window && Notification.permission === 'default') void Notification.requestPermission()
                      } catch {}
                    }}
                  >
                    Avisarme también en el navegador
                  </button>
                )}
              </div>
            )}
            <div className="rounded-xl border border-marca-200 bg-white focus-within:border-marca-400">
              <textarea
                ref={entrada}
                value={texto}
                disabled={sinHabilitar || cerradoPorCupo}
                onChange={(e) => setTexto(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                    e.preventDefault()
                    if (atajosVisibles.length) usarAtajo(atajosVisibles[0])
                    else if (biblioteca.length) void usarDeBiblioteca(biblioteca[0])
                    else void enviar()
                  }
                }}
                onPaste={(e) => {
                  if (e.clipboardData.files.length) {
                    e.preventDefault()
                    adjuntar(e.clipboardData.files)
                  }
                }}
                rows={Math.min(8, Math.max(2, texto.split('\n').length))}
                placeholder={sinHabilitar ? 'El asistente no está disponible para ti.' : cerradoPorCupo && cupo.tipo === 'bloqueado' ? cupo.texto : 'Escríbele al asistente… («/» para atajos y tus archivos · Enter envía · Mayús+Enter salta de línea)'}
                aria-label="Mensaje para el asistente"
                className="block w-full resize-none rounded-t-xl px-3.5 pt-3 text-[14.5px] text-marca-900 outline-none placeholder:text-marca-400"
              />
              <div className="flex flex-wrap items-center gap-1.5 px-2 pb-2">
                <label
                  className={cn('btn-neutro h-8 cursor-pointer px-2.5 text-[12.5px]', (sinHabilitar || sinArchivos) && 'pointer-events-none opacity-50')}
                  title={sinArchivos ? capacidad('archivos').motivo ?? undefined : undefined}
                  aria-disabled={sinArchivos || undefined}
                >
                  📎 Adjuntar
                  <input ref={archivoInput} type="file" multiple accept={ACEPTA} disabled={sinHabilitar || sinArchivos} className="sr-only" onChange={(e) => e.target.files && (adjuntar(e.target.files), (e.target.value = ''))} />
                </label>
                <button
                  type="button"
                  disabled={sinHabilitar || grabando === 'transcribiendo'}
                  onClick={() => void dictar()}
                  aria-label={grabando === 'grabando' ? 'Detener el dictado' : 'Dictar'}
                  className={cn('btn-neutro h-8 px-2.5 text-[12.5px]', grabando === 'grabando' && 'border-acento-300 bg-acento-50 text-acento-700')}
                >
                  {grabando === 'grabando' ? '● Detener' : grabando === 'transcribiendo' ? 'Transcribiendo…' : '🎙 Dictar'}
                </button>
                <select value={modelo} onChange={(e) => elegirModelo(e.target.value)} aria-label="Modelo" className="h-8 rounded-lg border border-[var(--borde)] bg-white px-2 text-[12.5px] text-marca-700">
                  {disponibles.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.nombre}
                    </option>
                  ))}
                </select>
                <select value={esfuerzo} onChange={(e) => setEsfuerzo(e.target.value as Esfuerzo)} aria-label="Esfuerzo" className="h-8 rounded-lg border border-[var(--borde)] bg-white px-2 text-[12.5px] text-marca-700">
                  {esfuerzos.map((e) => (
                    <option key={e} value={e}>
                      Esfuerzo {ETIQUETA_ESFUERZO[e].toLowerCase()}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  aria-pressed={investigacion}
                  disabled={sinHabilitar || sinInvestigacion || (props.compartido && !alAsistente)}
                  onClick={() => setInvestigacion((x) => !x)}
                  title={sinInvestigacion ? capacidad('investigacion').motivo ?? undefined : 'Investiga a fondo en internet, la plataforma y tus archivos, y entrega un informe con fuentes. Puede tardar varios minutos.'}
                  className={cn('btn-neutro h-8 px-2.5 text-[12.5px]', investigacion && 'border-acento-300 bg-acento-50 text-acento-700')}
                >
                  🔎 Investigación
                </button>
                {props.compartido && (
                  <label className="inline-flex items-center gap-1.5 text-[12px] text-marca-600">
                    <input type="checkbox" checked={alAsistente} onChange={(e) => setAlAsistente(e.target.checked)} />
                    Preguntarle al asistente
                  </label>
                )}
                <span className="flex-1" />
                {corriendo ? (
                  <button type="button" className="btn-primario h-8 px-3 text-[12.5px]" onClick={detener}>
                    ■ Detener
                  </button>
                ) : (
                  <button type="button" className="btn-acento h-8 px-4 text-[12.5px]" disabled={ocupado || sinHabilitar || (cupo.tipo !== 'ok' && paraElAsistenteAhora) || (!texto.trim() && !adjuntos.some((a) => a.estado === 'listo'))} onClick={() => void enviar()}>
                    {ocupado ? <Giro /> : null} Enviar
                  </button>
                )}
              </div>
            </div>
            {investigacion && (
              <p className="mt-1.5 text-center text-[11.5px] text-acento-700">
                Investigación profunda: arma un plan, busca a fondo y entrega un informe con fuentes. Puede tardar varios minutos
                {politica?.tope_investigacion_usd ? ` y gastar hasta ${usd(politica.tope_investigacion_usd)}` : ''}; te aviso al terminar.
              </p>
            )}
            {politica?.motor === 'local' && (
              <p className="mt-1.5 text-center text-[11.5px] text-marca-500" data-motor-local>
                Motor local de Iberia
                {props.capacidades.filter((c) => !c.disponible).length > 0 && <> · sin {props.capacidades.filter((c) => !c.disponible).map((c) => ETIQUETA_CAPACIDAD[c.capacidad] ?? c.capacidad).join(', ')}</>}
              </p>
            )}
            <p className="mt-1.5 text-center text-[11px] text-marca-400">{AVISO_RESGUARDO}</p>
          </div>
        </div>
      </section>

      {/* El HTML abierto */}
      {html && (
        <PanelArtefacto
          compacto={!!props.compacto}
          abierto={html}
          onCambiar={setHtml}
          onCerrar={() => setHtml(null)}
          onActualizar={(titulo) => {
            setTexto(`Actualiza el artefacto «${titulo}» con los datos del archivo que te adjunto. Mantén el mismo diseño.`)
            archivoInput.current?.click()
            entrada.current?.focus()
          }}
        />
      )}
    </div>
  )
}

function Bienvenida({ nombre, sinHabilitar, onEjemplo }: { nombre: string; sinHabilitar: boolean; onEjemplo: (t: string) => void }) {
  const ejemplos = [
    'Te adjunto un Excel de ventas: dame el total por zona y producto y devuélveme un Excel con el resumen.',
    'Arma un tablero en HTML con estos datos para presentarlo en la reunión.',
    'Redáctame un correo formal para un proveedor pidiendo la actualización de precios.',
    'Convierte este PDF escaneado en una tabla de Excel.',
  ]
  return (
    <div className="mx-auto mt-6 max-w-xl text-center">
      <p className="text-[22px] font-semibold text-marca-900">{nombre ? `Hola, ${nombre}.` : 'Hola.'} ¿En qué te ayudo?</p>
      {sinHabilitar ? (
        <p className="mt-2 text-[13.5px] text-marca-500">No tienes el asistente de IA habilitado o la administración lo apagó. Pídele acceso a la administración de la plataforma.</p>
      ) : (
        <>
          <p className="mt-2 text-[13.5px] text-marca-500">Puedes adjuntar Excel, Word, PDF o fotos, pedir documentos y tableros, o buscar en internet.</p>
          <div className="mt-5 grid gap-2 sm:grid-cols-2">
            {ejemplos.map((e) => (
              <button key={e} type="button" onClick={() => onEjemplo(e)} className="rounded-xl border border-[var(--borde)] bg-white px-3 py-2.5 text-left text-[12.5px] text-marca-600 hover:bg-marca-50">
                {e}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function MensajeUsuario({ m, archivos, autor }: { m: MensajeVista; archivos: Map<string, ArchivoVista>; autor: string | null }) {
  return (
    <div className={cn('flex flex-col', autor ? 'items-start' : 'items-end')}>
      {autor && <span className="mb-0.5 px-1 text-[11.5px] font-semibold text-marca-500">{autor}{!m.turno_id ? ' · para el grupo' : ''}</span>}
      {m.bloques
        .filter((b): b is Extract<Bloque, { tipo: 'nota' }> => b.tipo === 'nota' && b.texto.startsWith('Desde:'))
        .map((b) => (
          <span key={b.texto} className="mb-1 max-w-[85%] truncate rounded-full bg-[#f3f1fb] px-2.5 py-0.5 text-[11.5px] text-[#4f4577]" title={b.texto}>
            ✦ {b.texto}
          </span>
        ))}
      <div className="max-w-[85%] rounded-2xl rounded-br-md bg-marca-100 px-4 py-2.5 text-[14.5px] whitespace-pre-wrap text-marca-900">
        {m.adjuntos.length > 0 && (
          <div className="mb-1.5 flex flex-wrap gap-1.5">
            {m.adjuntos.map((id) => {
              const a = archivos.get(id)
              return (
                <a key={id} href={`/sistema/asistente/archivo/${id}`} className="inline-flex items-center gap-1 rounded-lg bg-white px-2 py-0.5 text-[12px] text-marca-700 hover:underline">
                  📎 {a?.nombre ?? 'Archivo'}
                </a>
              )
            })}
          </div>
        )}
        {m.texto}
      </div>
    </div>
  )
}

function Pasos({ pasos, vivo }: { pasos: Paso[]; vivo?: boolean }) {
  const [abierto, setAbierto] = useState(false)
  if (!pasos.length) return null
  const ultimo = pasos.at(-1)!
  return (
    <div className="mb-2 rounded-lg border border-[var(--borde)] bg-marca-50/60 text-[12.5px] text-marca-600">
      <button type="button" onClick={() => setAbierto((x) => !x)} className="flex w-full items-center gap-2 px-3 py-1.5 text-left" aria-expanded={abierto}>
        {vivo && ultimo.estado === 'corriendo' ? <Giro /> : <span aria-hidden>⚙</span>}
        <span className="flex-1 truncate">{vivo && ultimo.estado === 'corriendo' ? `${ultimo.titulo}…` : `${pasos.length} ${pasos.length === 1 ? 'paso' : 'pasos'} de trabajo`}</span>
        <span aria-hidden>{abierto ? '▴' : '▾'}</span>
      </button>
      {abierto && (
        <ol className="border-t border-[var(--borde)] px-3 py-1.5">
          {pasos.map((p) => (
            <li key={p.id} className="flex items-center gap-2 py-0.5">
              <span aria-hidden>{p.estado === 'corriendo' ? '…' : p.estado === 'error' ? '⚠' : '✓'}</span>
              {p.titulo}
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}

function Pensamiento({ texto }: { texto: string }) {
  if (!texto.trim()) return null
  return (
    <details className="mb-2 text-[12.5px] text-marca-500">
      <summary className="cursor-pointer select-none">Ver el razonamiento</summary>
      <p className="mt-1 border-l-2 border-marca-200 pl-3 whitespace-pre-wrap">{texto}</p>
    </details>
  )
}

function Entregables({
  bloques,
  archivos,
  onHtml,
  chatId,
  mensajeId,
  programada,
}: {
  bloques: Bloque[]
  archivos: Map<string, ArchivoVista>
  onHtml: (h: Abierto) => void
  chatId: string | null
  mensajeId: string | null
  programada: boolean
}) {
  const propuestas = bloques.filter((b): b is Extract<Bloque, { tipo: 'propuesta_tarea' }> => b.tipo === 'propuesta_tarea')
  const archivosB = bloques.filter((b): b is Extract<Bloque, { tipo: 'archivo' }> => b.tipo === 'archivo')
  const artefactos = bloques.map(comoArtefacto).filter((a): a is Abierto => !!a)
  const fuentes = bloques.filter((b): b is Extract<Bloque, { tipo: 'fuente' }> => b.tipo === 'fuente')
  const recuerdos = bloques.filter((b): b is Extract<Bloque, { tipo: 'memoria' }> => b.tipo === 'memoria')
  const notas = bloques.filter((b): b is Extract<Bloque, { tipo: 'nota' }> => b.tipo === 'nota')
  if (!archivosB.length && !artefactos.length && !fuentes.length && !recuerdos.length && !notas.length && !propuestas.length) return null
  return (
    <div className="mt-3 flex flex-col gap-2">
      {propuestas.map((p, i) => (
        <TarjetaPropuesta key={`${p.propuesta.nombre}-${i}`} propuesta={p.propuesta} chatId={chatId} mensajeId={mensajeId} programada={programada} />
      ))}
      {notas.map((n) => (
        <p key={n.texto} className="text-[11.5px] text-marca-500 italic">
          {n.texto}
        </p>
      ))}
      {recuerdos.map((r) => (
        <Recuerdo key={r.memoriaId} id={r.memoriaId} texto={r.texto} />
      ))}
      {artefactos.map((a) => (
        <button key={a.id} type="button" onClick={() => onHtml(a)} className="group/art flex items-center gap-3 rounded-xl border border-[var(--borde)] bg-white px-3 py-2.5 text-left shadow-[0_1px_2px_rgba(0,0,0,0.04)] hover:border-marca-300">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-marca-800 text-white" aria-hidden>
            {a.clase === 'documento' ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" /><path d="M14 3v6h6M8 13h8M8 17h5" /></svg>
            ) : a.clase === 'svg' ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /><path d="M10 6.5h4a3 3 0 0 1 3 3V14" /></svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></svg>
            )}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13.5px] font-semibold text-marca-900">{a.titulo}</span>
            <span className="text-[12px] text-marca-500">
              {ETIQUETA_CLASE[a.clase]} · versión {a.version}
            </span>
          </span>
          <span className="text-[12.5px] font-semibold text-acento-700 group-hover/art:underline">Abrir</span>
        </button>
      ))}
      {archivosB.map((b) => (
        <a key={b.archivoId} href={`/sistema/asistente/archivo/${b.archivoId}`} className="flex items-center gap-3 rounded-xl border border-[var(--borde)] bg-white px-3 py-2.5 hover:border-marca-300">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-acento-50 text-[11px] font-bold text-acento-700 uppercase">{b.nombre.split('.').pop()?.slice(0, 4)}</span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13.5px] font-semibold text-marca-900">{b.nombre}</span>
            <span className="text-[12px] text-marca-500">{bytesLegibles(archivos.get(b.archivoId)?.bytes ?? b.bytes)}</span>
          </span>
          <span className="text-[12.5px] font-semibold text-acento-700">Descargar</span>
        </a>
      ))}
      {archivosB.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {archivosB.map((b) => (
            <span key={b.archivoId} className="inline-flex items-center gap-1.5 text-[11.5px] text-marca-500">
              <CompartirObjeto tipo="archivo" id={b.archivoId} /> {b.nombre}
            </span>
          ))}
        </div>
      )}
      {fuentes.length > 0 && (
        <details className="text-[12px] text-marca-500">
          <summary className="cursor-pointer select-none">{fuentes.length} fuentes de internet</summary>
          <ul className="mt-1 space-y-0.5 pl-4">
            {fuentes.map((f) => (
              <li key={f.url} className="truncate">
                <a href={f.url} target="_blank" rel="noopener noreferrer" className="text-acento-700 hover:underline">
                  {f.titulo}
                </a>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  )
}

function Recuerdo({ id, texto }: { id: string; texto: string }) {
  const [borrado, setBorrado] = useState(false)
  return (
    <p className="flex items-center gap-2 rounded-lg bg-marca-50 px-3 py-1.5 text-[12.5px] text-marca-600">
      <span aria-hidden>🧠</span>
      <span className={cn('min-w-0 flex-1', borrado && 'line-through opacity-60')}>Guardé en tu memoria: «{texto}»</span>
      {!borrado && (
        <button
          type="button"
          className="text-[12px] font-semibold text-acento-700 hover:underline"
          onClick={async () => {
            const r = await borrarMemoria(id)
            if (r.ok) setBorrado(true)
          }}
        >
          Deshacer
        </button>
      )}
    </p>
  )
}

function MensajeAsistente({
  m,
  archivos,
  onHtml,
  chatId,
  programadas,
}: {
  m: MensajeVista
  archivos: Map<string, ArchivoVista>
  onHtml: (h: Abierto) => void
  chatId: string | null
  programadas: Set<string>
}) {
  const [voto, setVoto] = useState<number | null>(m.calificacion)
  const [copiado, setCopiado] = useState(false)
  const pasos = m.bloques.filter((b): b is Paso => b.tipo === 'paso')
  const pensamiento = m.bloques.find((b): b is Extract<Bloque, { tipo: 'pensamiento' }> => b.tipo === 'pensamiento')?.texto ?? ''
  const votar = async (v: -1 | 1) => {
    const nuevo = voto === v ? null : v
    setVoto(nuevo)
    await calificar(m.id, nuevo)
  }
  return (
    <div className="group">
      <Pasos pasos={pasos} />
      <Pensamiento texto={pensamiento} />
      <MarkdownChat contenido={m.texto} />
      <Entregables bloques={m.bloques} archivos={archivos} onHtml={onHtml} chatId={chatId} mensajeId={m.id} programada={programadas.has(m.id)} />
      <div className="mt-1.5 flex gap-1 text-[12px] text-marca-400 opacity-70 group-hover:opacity-100">
        <button type="button" aria-label="Copiar la respuesta" className="rounded px-1.5 py-0.5 hover:bg-marca-100 hover:text-marca-700" onClick={async () => { await navigator.clipboard.writeText(m.texto); setCopiado(true); setTimeout(() => setCopiado(false), 1500) }}>
          {copiado ? 'Copiado' : 'Copiar'}
        </button>
        <button type="button" aria-label="Buena respuesta" aria-pressed={voto === 1} className={cn('rounded px-1.5 py-0.5 hover:bg-marca-100', voto === 1 && 'text-marca-900')} onClick={() => void votar(1)}>
          👍
        </button>
        <button type="button" aria-label="Mala respuesta" aria-pressed={voto === -1} className={cn('rounded px-1.5 py-0.5 hover:bg-marca-100', voto === -1 && 'text-marca-900')} onClick={() => void votar(-1)}>
          👎
        </button>
      </div>
    </div>
  )
}

function TurnoVivo({ turno, archivos, onHtml }: { turno: TurnoEnCurso; archivos: Map<string, ArchivoVista>; onHtml: (h: Abierto) => void }) {
  const [segundos, setSegundos] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setSegundos(Math.round((Date.now() - turno.inicio) / 1000)), 1000)
    return () => clearInterval(t)
  }, [turno.inicio])
  const sinTexto = !turno.texto.trim()
  return (
    <div aria-live="polite">
      <Pasos pasos={turno.pasos} vivo />
      {sinTexto ? (
        <div className="flex items-center gap-2 text-[13px] text-marca-500">
          <Giro />
          <span>{turno.estado === 'en_cola' ? 'Arrancando…' : turno.pensamiento ? 'Pensando…' : 'Trabajando…'}</span>
          {segundos >= 5 && <span className="text-marca-400">{segundos} s</span>}
        </div>
      ) : (
        <MarkdownChat contenido={turno.texto} />
      )}
      {turno.pensamiento && sinTexto && <p className="mt-1.5 line-clamp-3 border-l-2 border-marca-200 pl-3 text-[12.5px] text-marca-400">{turno.pensamiento.slice(-400)}</p>}
      <Entregables bloques={turno.bloques} archivos={archivos} onHtml={onHtml} chatId={null} mensajeId={null} programada={false} />
    </div>
  )
}

function PanelArtefacto({
  abierto,
  onCambiar,
  onCerrar,
  onActualizar,
  compacto,
}: {
  compacto: boolean
  abierto: Abierto
  onCambiar: (a: Abierto) => void
  onCerrar: () => void
  onActualizar: (titulo: string) => void
}) {
  const supabase = useMemo(() => createClient(), [])
  const [versiones, setVersiones] = useState<{ id: string; version: number; titulo: string; creado_en: string }[]>([])
  const [doc, setDoc] = useState<string | null>(null)
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => e.key === 'Escape' && onCerrar()
    window.addEventListener('keydown', tecla)
    return () => window.removeEventListener('keydown', tecla)
  }, [onCerrar])
  useEffect(() => {
    let vivo = true
    void supabase
      .schema('asistente')
      .from('html')
      .select('id, version, titulo, creado_en')
      .eq('grupo', abierto.grupo)
      .order('version', { ascending: false })
      .then(({ data }) => vivo && setVersiones(data ?? []))
    return () => {
      vivo = false
    }
  }, [supabase, abierto.grupo, abierto.version])
  useEffect(() => {
    if (abierto.clase !== 'documento') return
    let vivo = true
    void fetch(`/sistema/asistente/html/${abierto.id}?crudo=1`)
      .then((r) => (r.ok ? r.text() : ''))
      .then((t) => vivo && setDoc(t))
    return () => {
      vivo = false
      setDoc(null)
    }
  }, [abierto.id, abierto.clase])
  const ultima = versiones[0]?.version ?? abierto.version
  return (
    <div className={cn('fixed inset-0 flex flex-col bg-white', compacto ? 'z-[80]' : 'z-50 xl:static xl:z-auto xl:w-[50%] xl:shrink-0 xl:rounded-xl xl:border xl:border-[var(--borde)]')}>
      <div className="flex flex-wrap items-center gap-2 border-b border-[var(--borde)] px-3 py-2">
        <div className="min-w-0 flex-1 basis-[220px]">
          <p className="truncate text-[13.5px] font-semibold text-marca-900">{abierto.titulo}</p>
          <p className="text-[11.5px] text-marca-500">{ETIQUETA_CLASE[abierto.clase]}{abierto.version < ultima ? ' · versión anterior' : ''}</p>
        </div>
        {versiones.length > 1 && (
          <select
            aria-label="Versión"
            className="h-8 rounded-lg border border-[var(--borde)] bg-white px-2 text-[12px] text-marca-700"
            value={abierto.id}
            onChange={(e) => {
              const v = versiones.find((x) => x.id === e.target.value)
              if (v) onCambiar({ ...abierto, id: v.id, version: v.version, titulo: v.titulo })
            }}
          >
            {versiones.map((v) => (
              <option key={v.id} value={v.id}>
                Versión {v.version}{v.version === ultima ? ' (última)' : ''}
              </option>
            ))}
          </select>
        )}
        <button type="button" className="btn-neutro h-8 px-2.5 text-[12px]" onClick={() => onActualizar(abierto.titulo)} title="Monta un archivo nuevo y pide la actualización">
          Actualizar con datos nuevos
        </button>
        {abierto.clase !== 'documento' && (
          <a href={`/sistema/asistente/html/${abierto.id}`} target="_blank" rel="noopener" className="btn-neutro h-8 px-2.5 text-[12px]">
            Pantalla completa
          </a>
        )}
        <a href={`/sistema/asistente/html/${abierto.id}?descargar=1`} className="btn-neutro h-8 px-2.5 text-[12px]">
          Descargar
        </a>
        <MantenerAlDia htmlId={abierto.id} />
        <CompartirObjeto tipo="html" id={abierto.id} />
        <button type="button" className="btn-neutro h-8 px-2.5 text-[12px]" onClick={onCerrar} aria-label="Cerrar el artefacto">
          ✕
        </button>
      </div>
      {abierto.clase === 'documento' ? (
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{doc === null ? <p className="text-[13px] text-marca-400">Cargando…</p> : <MarkdownChat contenido={doc} />}</div>
      ) : (
        <iframe key={abierto.id} title={abierto.titulo} src={`/sistema/asistente/html/${abierto.id}`} sandbox="allow-scripts allow-downloads allow-modals" className="min-h-0 w-full flex-1 rounded-b-xl bg-[#f6f7f9]" />
      )}
    </div>
  )
}

/** Cuánto se usó, en %, como en Claude web: sin dólares para la persona. */
function Medidor({ etiqueta, valor, nota }: { etiqueta: string; valor: number; nota?: string }) {
  return (
    <div>
      <div className="flex justify-between">
        <span>{etiqueta}</span>
        <span className={cn(valor >= 85 && 'font-semibold text-amber-700')}>{valor} % usado</span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-marca-100" role="meter" aria-label={etiqueta} aria-valuemin={0} aria-valuemax={100} aria-valuenow={valor}>
        <div className={cn('h-full rounded-full', valor >= 85 ? 'bg-amber-500' : 'bg-marca-500')} style={{ width: `${valor}%` }} />
      </div>
      {nota && <p className="mt-0.5 text-[11px] text-marca-400">{nota}</p>}
    </div>
  )
}

function Giro() {
  return <span aria-hidden className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-marca-300 border-t-acento-500" />
}
