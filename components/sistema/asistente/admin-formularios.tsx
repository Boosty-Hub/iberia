'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ESFUERZOS, ETIQUETA_ESFUERZO, type Esfuerzo, type Motor } from '@/lib/asistente/tipos'
import { encenderModelo, guardarConfig, guardarPoliticaRol, guardarPoliticaUsuario, quitarPoliticaUsuario } from './admin-acciones'
import { cn } from '@/lib/utils'

const campo = 'h-9 rounded-lg border border-[var(--borde)] bg-white px-2.5 text-[13px] text-marca-900 outline-none focus:border-marca-400 disabled:bg-marca-50'
const rotulo = 'mb-1 block text-[12px] font-semibold text-marca-600'

function Estado({ pendiente, msg }: { pendiente: boolean; msg: { ok: boolean; texto: string } | null }) {
  if (pendiente) return <span className="text-[12px] text-marca-500">Guardando…</span>
  if (!msg) return null
  return <span className={cn('text-[12px]', msg.ok ? 'text-emerald-700' : 'text-acento-700')}>{msg.texto}</span>
}

function useGuardar() {
  const [pendiente, iniciar] = useTransition()
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null)
  const router = useRouter()
  const guardar = (f: () => Promise<{ ok: true } | { ok: false; error: string }>) =>
    iniciar(async () => {
      const r = await f()
      setMsg(r.ok ? { ok: true, texto: 'Guardado.' } : { ok: false, texto: r.error })
      if (r.ok) router.refresh()
    })
  return { pendiente, msg, guardar }
}

export type ConfigVista = {
  motor: Motor
  encendido: boolean
  tope_mensual_empresa_usd: number
  modelo_anthropic: string
  modelo_openai: string
  esfuerzo_defecto: Esfuerzo
  tope_diario_usd: number
  tope_mensual_usd: number
  cuota_mb: number
  esfuerzo_max: Esfuerzo
  instrucciones_empresa: string
  programador_pausado: boolean
  max_tareas: number
  frecuencia_min_min: number
  tope_investigacion_usd: number
  correo_remitente: string | null
  correo_nombre: string
  whatsapp_plantilla: string | null
}

export function FormMotor({
  config,
  modelos,
  claves,
  editable,
}: {
  config: ConfigVista
  modelos: { id: string; nombre: string; proveedor: string; encendido: boolean }[]
  claves: { anthropic: boolean; openai: boolean }
  editable: boolean
}) {
  const [c, setC] = useState(config)
  const { pendiente, msg, guardar } = useGuardar()
  const deAnthropic = modelos.filter((m) => m.proveedor === 'anthropic')
  const deOpenai = modelos.filter((m) => m.proveedor === 'openai')
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="rounded-xl border border-[var(--borde)] bg-white p-4">
        <h2 className="text-[14px] font-semibold text-marca-900">Motor activo</h2>
        <p className="mt-0.5 text-[12.5px] text-marca-500">El proveedor que contesta en todos los chats. Los archivos se procesan siempre con Anthropic (decisión 19).</p>
        <div className="mt-3 flex flex-col gap-2">
          {(['anthropic', 'openai', 'local'] as const).map((m) => (
            <label key={m} className={cn('flex items-center gap-2.5 rounded-lg border px-3 py-2 text-[13px]', c.motor === m ? 'border-marca-800 bg-marca-50' : 'border-[var(--borde)]', m === 'local' && 'opacity-60')}>
              <input type="radio" name="motor" disabled={!editable || m === 'local'} checked={c.motor === m} onChange={() => setC({ ...c, motor: m })} />
              <span className="flex-1 font-medium text-marca-900">{m === 'anthropic' ? 'Anthropic (Claude)' : m === 'openai' ? 'OpenAI' : 'Local'}</span>
              <span className="text-[12px] text-marca-500">
                {m === 'local' ? 'Fase 6' : (m === 'anthropic' ? claves.anthropic : claves.openai) ? 'Clave configurada' : '⚠ Falta la clave'}
              </span>
            </label>
          ))}
        </div>
        <label className="mt-4 flex items-center gap-2.5 text-[13px] text-marca-800">
          <input type="checkbox" disabled={!editable} checked={c.encendido} onChange={(e) => setC({ ...c, encendido: e.target.checked })} />
          Asistente encendido para toda la empresa
        </label>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div>
            <label className={rotulo} htmlFor="m-ant">Modelo por defecto · Anthropic</label>
            <select id="m-ant" className={cn(campo, 'w-full')} disabled={!editable} value={c.modelo_anthropic} onChange={(e) => setC({ ...c, modelo_anthropic: e.target.value })}>
              {deAnthropic.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nombre}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={rotulo} htmlFor="m-oai">Modelo por defecto · OpenAI</label>
            <select id="m-oai" className={cn(campo, 'w-full')} disabled={!editable} value={c.modelo_openai} onChange={(e) => setC({ ...c, modelo_openai: e.target.value })}>
              {deOpenai.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nombre}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={rotulo} htmlFor="esf">Esfuerzo por defecto</label>
            <select id="esf" className={cn(campo, 'w-full')} disabled={!editable} value={c.esfuerzo_defecto} onChange={(e) => setC({ ...c, esfuerzo_defecto: e.target.value as Esfuerzo })}>
              {ESFUERZOS.map((e) => (
                <option key={e} value={e}>
                  {ETIQUETA_ESFUERZO[e]}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-[var(--borde)] bg-white p-4">
        <h2 className="text-[14px] font-semibold text-marca-900">Topes y valores por defecto</h2>
        <p className="mt-0.5 text-[12.5px] text-marca-500">El tope de la empresa manda sobre todos. Lo demás vale para quien no tiene política de rol ni excepción.</p>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <Numero etiqueta="Tope mensual de la empresa (US$)" valor={c.tope_mensual_empresa_usd} editable={editable} onCambio={(v) => setC({ ...c, tope_mensual_empresa_usd: v })} />
          <div />
          <Numero etiqueta="Tope diario por persona (US$)" valor={c.tope_diario_usd} editable={editable} onCambio={(v) => setC({ ...c, tope_diario_usd: v })} />
          <Numero etiqueta="Tope mensual por persona (US$)" valor={c.tope_mensual_usd} editable={editable} onCambio={(v) => setC({ ...c, tope_mensual_usd: v })} />
          <Numero etiqueta="Espacio por persona (MB)" valor={c.cuota_mb} editable={editable} onCambio={(v) => setC({ ...c, cuota_mb: v })} />
          <div>
            <label className={rotulo} htmlFor="esf-max">Esfuerzo máximo</label>
            <select id="esf-max" className={cn(campo, 'w-full')} disabled={!editable} value={c.esfuerzo_max} onChange={(e) => setC({ ...c, esfuerzo_max: e.target.value as Esfuerzo })}>
              {ESFUERZOS.map((e) => (
                <option key={e} value={e}>
                  {ETIQUETA_ESFUERZO[e]}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-[var(--borde)] bg-white p-4 lg:col-span-2">
        <h2 className="text-[14px] font-semibold text-marca-900">Tareas programadas e investigación</h2>
        <p className="mt-0.5 text-[12.5px] text-marca-500">
          Las tareas corren a nombre de su dueño, con sus permisos de ese día y contra sus topes. Lo de abajo vale para quien no tiene otro valor en su rol o en su excepción.
        </p>
        <label className="mt-3 flex items-center gap-2.5 text-[13px] text-marca-800">
          <input type="checkbox" disabled={!editable} checked={c.programador_pausado} onChange={(e) => setC({ ...c, programador_pausado: e.target.checked })} />
          Pausar todas las tareas programadas de la empresa
        </label>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Numero etiqueta="Máximo de tareas activas por persona" valor={c.max_tareas} editable={editable} onCambio={(v) => setC({ ...c, max_tareas: v })} />
          <div>
            <label className={rotulo} htmlFor="frec-min">Frecuencia máxima</label>
            <select id="frec-min" className={cn(campo, 'w-full')} disabled={!editable} value={c.frecuencia_min_min} onChange={(e) => setC({ ...c, frecuencia_min_min: Number(e.target.value) })}>
              {[60, 120, 240, 360, 720, 1440].map((m) => (
                <option key={m} value={m}>
                  {m === 1440 ? 'Una vez al día' : `Una vez cada ${m / 60} ${m === 60 ? 'hora' : 'horas'}`}
                </option>
              ))}
            </select>
          </div>
          <Numero etiqueta="Tope por investigación profunda (US$)" valor={c.tope_investigacion_usd} editable={editable} onCambio={(v) => setC({ ...c, tope_investigacion_usd: v })} />
          <div />
          <div>
            <label className={rotulo} htmlFor="correo-rem">Remitente del correo (verificado en Resend)</label>
            <input id="correo-rem" className={cn(campo, 'w-full')} disabled={!editable} placeholder="asistente@…iberia" value={c.correo_remitente ?? ''} onChange={(e) => setC({ ...c, correo_remitente: e.target.value })} />
            <p className="mt-1 text-[11.5px] text-marca-500">{c.correo_remitente ? 'El correo sale desde aquí.' : 'Vacío: el canal de correo queda pendiente.'}</p>
          </div>
          <div>
            <label className={rotulo} htmlFor="correo-nom">Nombre del remitente</label>
            <input id="correo-nom" className={cn(campo, 'w-full')} disabled={!editable} maxLength={80} value={c.correo_nombre} onChange={(e) => setC({ ...c, correo_nombre: e.target.value })} />
          </div>
          <div>
            <label className={rotulo} htmlFor="wa-plantilla">Plantilla de WhatsApp (aprobada por Meta)</label>
            <input id="wa-plantilla" className={cn(campo, 'w-full font-mono')} disabled={!editable} placeholder="resultado_asistente" value={c.whatsapp_plantilla ?? ''} onChange={(e) => setC({ ...c, whatsapp_plantilla: e.target.value })} />
            <p className="mt-1 text-[11.5px] text-marca-500">Usa la conexión de WhatsApp de la plataforma. Parámetros: nombre, tarea y enlace.</p>
          </div>
        </div>
      </section>

      {editable && (
        <div className="flex items-center gap-3 lg:col-span-2">
          <button
            type="button"
            className="btn-acento h-9 px-4 text-[13px]"
            disabled={pendiente}
            onClick={() =>
              guardar(() =>
                guardarConfig({
                  motor: c.motor,
                  encendido: c.encendido,
                  modelo_anthropic: c.modelo_anthropic,
                  modelo_openai: c.modelo_openai,
                  esfuerzo_defecto: c.esfuerzo_defecto,
                  tope_mensual_empresa_usd: c.tope_mensual_empresa_usd,
                  tope_diario_usd: c.tope_diario_usd,
                  tope_mensual_usd: c.tope_mensual_usd,
                  cuota_mb: c.cuota_mb,
                  esfuerzo_max: c.esfuerzo_max,
                  programador_pausado: c.programador_pausado,
                  max_tareas: c.max_tareas,
                  frecuencia_min_min: c.frecuencia_min_min,
                  tope_investigacion_usd: c.tope_investigacion_usd,
                  correo_remitente: c.correo_remitente,
                  correo_nombre: c.correo_nombre,
                  whatsapp_plantilla: c.whatsapp_plantilla,
                })
              )
            }
          >
            Guardar cambios
          </button>
          <Estado pendiente={pendiente} msg={msg} />
        </div>
      )}
    </div>
  )
}

function Numero({ etiqueta, valor, editable, onCambio }: { etiqueta: string; valor: number; editable: boolean; onCambio: (v: number) => void }) {
  const id = etiqueta.replace(/\W+/g, '-')
  return (
    <div>
      <label className={rotulo} htmlFor={id}>
        {etiqueta}
      </label>
      <input id={id} type="number" min={0} step="0.5" className={cn(campo, 'w-full')} disabled={!editable} value={valor} onChange={(e) => onCambio(Number(e.target.value))} />
    </div>
  )
}

export function InterruptorModelo({ id, encendido, editable }: { id: string; encendido: boolean; editable: boolean }) {
  const [v, setV] = useState(encendido)
  const { pendiente, guardar } = useGuardar()
  return (
    <label className="inline-flex items-center gap-2 text-[12.5px] text-marca-700">
      <input
        type="checkbox"
        disabled={!editable || pendiente}
        checked={v}
        onChange={(e) => {
          setV(e.target.checked)
          guardar(() => encenderModelo(id, e.target.checked))
        }}
      />
      {v ? 'Encendido' : 'Apagado'}
    </label>
  )
}

export type PoliticaFila = {
  modelos: string[] | null
  esfuerzo_max: Esfuerzo | null
  tope_diario_usd: number | null
  tope_mensual_usd: number | null
  cuota_mb: number | null
  puede_programar: boolean | null
  max_tareas: number | null
}

function CamposPolitica({ p, set, modelos, editable, herencia }: { p: PoliticaFila; set: (p: PoliticaFila) => void; modelos: { id: string; nombre: string }[]; editable: boolean; herencia: ConfigVista }) {
  const marcados = p.modelos ?? modelos.map((m) => m.id)
  const num = (v: string) => (v === '' ? null : Number(v))
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-7">
      <div>
        <label className={rotulo}>Programar tareas</label>
        <select className={cn(campo, 'w-full')} disabled={!editable} value={p.puede_programar === null ? '' : p.puede_programar ? 'si' : 'no'} onChange={(e) => set({ ...p, puede_programar: e.target.value === '' ? null : e.target.value === 'si' })}>
          <option value="">Hereda (sí)</option>
          <option value="si">Sí</option>
          <option value="no">No</option>
        </select>
      </div>
      <div>
        <label className={rotulo}>Tareas activas</label>
        <input type="number" min={0} max={100} step="1" className={cn(campo, 'w-full')} disabled={!editable} placeholder={String(herencia.max_tareas)} value={p.max_tareas ?? ''} onChange={(e) => set({ ...p, max_tareas: num(e.target.value) })} />
      </div>
      <div>
        <label className={rotulo}>Tope diario (US$)</label>
        <input type="number" min={0} step="0.5" className={cn(campo, 'w-full')} disabled={!editable} placeholder={String(herencia.tope_diario_usd)} value={p.tope_diario_usd ?? ''} onChange={(e) => set({ ...p, tope_diario_usd: num(e.target.value) })} />
      </div>
      <div>
        <label className={rotulo}>Tope mensual (US$)</label>
        <input type="number" min={0} step="1" className={cn(campo, 'w-full')} disabled={!editable} placeholder={String(herencia.tope_mensual_usd)} value={p.tope_mensual_usd ?? ''} onChange={(e) => set({ ...p, tope_mensual_usd: num(e.target.value) })} />
      </div>
      <div>
        <label className={rotulo}>Espacio (MB)</label>
        <input type="number" min={0} step="256" className={cn(campo, 'w-full')} disabled={!editable} placeholder={String(herencia.cuota_mb)} value={p.cuota_mb ?? ''} onChange={(e) => set({ ...p, cuota_mb: num(e.target.value) })} />
      </div>
      <div>
        <label className={rotulo}>Esfuerzo máximo</label>
        <select className={cn(campo, 'w-full')} disabled={!editable} value={p.esfuerzo_max ?? ''} onChange={(e) => set({ ...p, esfuerzo_max: (e.target.value || null) as Esfuerzo | null })}>
          <option value="">Hereda ({ETIQUETA_ESFUERZO[herencia.esfuerzo_max]})</option>
          {ESFUERZOS.map((e) => (
            <option key={e} value={e}>
              {ETIQUETA_ESFUERZO[e]}
            </option>
          ))}
        </select>
      </div>
      <fieldset className="lg:col-span-1">
        <legend className={rotulo}>Modelos</legend>
        <div className="flex flex-col gap-0.5">
          {modelos.map((m) => (
            <label key={m.id} className="flex items-center gap-1.5 text-[12.5px] text-marca-700">
              <input
                type="checkbox"
                disabled={!editable}
                checked={marcados.includes(m.id)}
                onChange={(e) => {
                  const nuevos = e.target.checked ? [...marcados, m.id] : marcados.filter((x) => x !== m.id)
                  set({ ...p, modelos: nuevos.length === modelos.length ? null : nuevos })
                }}
              />
              {m.nombre}
            </label>
          ))}
        </div>
      </fieldset>
    </div>
  )
}

export function FilaPoliticaRol({
  rol,
  inicial,
  modelos,
  editable,
  herencia,
}: {
  rol: { id: string; nombre: string; habilitado: boolean; personas: number }
  inicial: PoliticaFila
  modelos: { id: string; nombre: string }[]
  editable: boolean
  herencia: ConfigVista
}) {
  const [p, setP] = useState(inicial)
  const { pendiente, msg, guardar } = useGuardar()
  return (
    <div className="border-b border-[var(--borde)] px-4 py-3 last:border-0">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="text-[13.5px] font-semibold text-marca-900">{rol.nombre}</span>
        <span className="text-[12px] text-marca-500">{rol.personas} {rol.personas === 1 ? 'persona' : 'personas'}</span>
        <span className={cn('insignia', rol.habilitado ? 'bg-emerald-50 text-emerald-800' : 'bg-marca-100 text-marca-600')}>{rol.habilitado ? 'Asistente habilitado' : 'Sin asistente'}</span>
        <span className="flex-1" />
        {editable && (
          <>
            <Estado pendiente={pendiente} msg={msg} />
            <button type="button" className="btn-neutro h-8 px-3 text-[12.5px]" disabled={pendiente} onClick={() => guardar(() => guardarPoliticaRol(rol.id, p))}>
              Guardar
            </button>
          </>
        )}
      </div>
      <CamposPolitica p={p} set={setP} modelos={modelos} editable={editable} herencia={herencia} />
    </div>
  )
}

export function FormExcepcion({
  personas,
  modelos,
  herencia,
  inicial,
}: {
  personas: { id: string; nombre: string }[]
  modelos: { id: string; nombre: string }[]
  herencia: ConfigVista
  inicial?: { perfil_id: string; habilitado: boolean | null; nota: string | null } & PoliticaFila
}) {
  const [perfil, setPerfil] = useState(inicial?.perfil_id ?? '')
  const [habilitado, setHabilitado] = useState<boolean | null>(inicial?.habilitado ?? null)
  const [nota, setNota] = useState(inicial?.nota ?? '')
  const [p, setP] = useState<PoliticaFila>(inicial ?? { modelos: null, esfuerzo_max: null, tope_diario_usd: null, tope_mensual_usd: null, cuota_mb: null, puede_programar: null, max_tareas: null })
  const { pendiente, msg, guardar } = useGuardar()
  return (
    <div className="border-b border-[var(--borde)] px-4 py-3 last:border-0">
      <div className="mb-2 flex flex-wrap items-end gap-3">
        {inicial ? (
          <span className="text-[13.5px] font-semibold text-marca-900">{personas.find((x) => x.id === perfil)?.nombre ?? 'Persona'}</span>
        ) : (
          <div>
            <label className={rotulo} htmlFor="persona">Persona</label>
            <select id="persona" className={cn(campo, 'w-64')} value={perfil} onChange={(e) => setPerfil(e.target.value)}>
              <option value="">Elige una persona…</option>
              {personas.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.nombre}
                </option>
              ))}
            </select>
          </div>
        )}
        <div>
          <label className={rotulo}>Asistente</label>
          <select className={campo} value={habilitado === null ? '' : habilitado ? 'si' : 'no'} onChange={(e) => setHabilitado(e.target.value === '' ? null : e.target.value === 'si')}>
            <option value="">Como su rol</option>
            <option value="si">Habilitado</option>
            <option value="no">Sin asistente</option>
          </select>
        </div>
        <div className="min-w-[200px] flex-1">
          <label className={rotulo}>Nota</label>
          <input className={cn(campo, 'w-full')} value={nota} maxLength={500} onChange={(e) => setNota(e.target.value)} placeholder="Por qué la excepción" />
        </div>
        <Estado pendiente={pendiente} msg={msg} />
        <button type="button" className="btn-neutro h-9 px-3 text-[12.5px]" disabled={pendiente || !perfil} onClick={() => guardar(() => guardarPoliticaUsuario(perfil, { ...p, habilitado, nota }))}>
          {inicial ? 'Guardar' : 'Agregar excepción'}
        </button>
        {inicial && (
          <button type="button" className="btn-peligro h-9 px-3 text-[12.5px]" disabled={pendiente} onClick={() => guardar(() => quitarPoliticaUsuario(perfil))}>
            Quitar
          </button>
        )}
      </div>
      <CamposPolitica p={p} set={setP} modelos={modelos} editable herencia={herencia} />
    </div>
  )
}

export function FormInstrucciones({ inicial, editable }: { inicial: string; editable: boolean }) {
  const [texto, setTexto] = useState(inicial)
  const { pendiente, msg, guardar } = useGuardar()
  return (
    <section className="rounded-xl border border-[var(--borde)] bg-white p-4">
      <label htmlFor="instr" className="text-[14px] font-semibold text-marca-900">
        Lo que el asistente sabe de Iberia en todo chat
      </label>
      <p className="mt-0.5 text-[12.5px] text-marca-500">
        Vocabulario de la empresa, cómo se llaman las áreas y los productos, el formato de los informes, lo que no se hace. Va en cada chat, de todos. Mantenlo corto y concreto: lo largo cuesta en cada turno.
      </p>
      <textarea
        id="instr"
        className="mt-3 block min-h-[320px] w-full rounded-lg border border-[var(--borde)] p-3 font-mono text-[12.5px] leading-relaxed text-marca-900 outline-none focus:border-marca-400"
        disabled={!editable}
        maxLength={20000}
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        placeholder={'Ejemplo:\n- Las áreas se llaman Planta Cagua, Distribución, Comercial…\n- Los montos van en USD y en Bs a tasa BCV del día.\n- No se habla de nómina ni de personas por nombre en un informe.'}
      />
      <div className="mt-2 flex items-center gap-3">
        <span className="text-[12px] text-marca-400">{texto.length.toLocaleString('es-VE')} de 20.000 caracteres</span>
        <span className="flex-1" />
        <Estado pendiente={pendiente} msg={msg} />
        {editable && (
          <button type="button" className="btn-acento h-9 px-4 text-[13px]" disabled={pendiente} onClick={() => guardar(() => guardarConfig({ instrucciones_empresa: texto }))}>
            Guardar
          </button>
        )}
      </div>
    </section>
  )
}
