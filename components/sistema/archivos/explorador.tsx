'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { bytesLegibles, MAX_BYTES_ARCHIVO } from '@/lib/asistente/tipos'
import { VisorPdf } from '@/components/sistema/ui/visor-pdf'
import { borrar, compartir, confirmarSubida, crearCarpeta, mover, prepararSubida, renombrar, retirarCompartido } from './acciones'
import { cn } from '@/lib/utils'

export type CarpetaVista = { id: string; nombre: string; padre_id: string | null; propia: boolean; de?: string }
export type ArchivoVista = { id: string; nombre: string; mime: string; bytes: number; aviso: string | null; propio: boolean; fecha: string; de?: string }

const ICONO = (mime: string, nombre: string) => {
  const ext = nombre.toLowerCase().split('.').pop() ?? ''
  if (mime === 'application/pdf' || ext === 'pdf') return '📕'
  if (mime.startsWith('image/')) return '🖼️'
  if (mime.startsWith('audio/')) return '🎧'
  if (mime.startsWith('video/')) return '🎬'
  if (/xls|csv/.test(ext)) return '📊'
  if (/doc|txt|md/.test(ext)) return '📝'
  if (/ppt/.test(ext)) return '📽️'
  return '📄'
}
const previsualizable = (mime: string, nombre: string) =>
  mime === 'application/pdf' || nombre.toLowerCase().endsWith('.pdf') || /^(image|audio|video)\//.test(mime) || /^text\/(plain|markdown|csv)/.test(mime)

/**
 * El explorador de Mis archivos: carpetas y archivos de la carpeta abierta, con subir (arrastrando o con el botón),
 * nueva carpeta, renombrar, mover, compartir, borrar, vista previa y descarga. En lo que no es propio (compartido
 * conmigo) solo se ve y se descarga.
 */
export function Explorador({
  carpetaId,
  carpetas,
  archivos,
  puedeCrear,
  esPropia,
  destinos,
}: {
  carpetaId: string | null
  carpetas: CarpetaVista[]
  archivos: ArchivoVista[]
  puedeCrear: boolean
  esPropia: boolean
  destinos: { id: string; nombre: string; nivel: number }[]
}) {
  const router = useRouter()
  const [filtro, setFiltro] = useState('')
  const [aviso, setAviso] = useState<string | null>(null)
  const [subiendo, setSubiendo] = useState<{ nombre: string; estado: 'subiendo' | 'error'; error?: string }[]>([])
  const [arrastrando, setArrastrando] = useState(false)
  const [pendiente, iniciar] = useTransition()
  const [dialogo, setDialogo] = useState<
    | { tipo: 'nueva' }
    | { tipo: 'renombrar' | 'mover' | 'compartir' | 'borrar'; objeto: 'carpeta' | 'archivo'; id: string; nombre: string }
    | { tipo: 'ver'; archivo: ArchivoVista }
    | null
  >(null)
  const input = useRef<HTMLInputElement>(null)
  const editable = puedeCrear && esPropia
  const f = filtro.trim().toLowerCase()
  const cs = useMemo(() => carpetas.filter((c) => !f || c.nombre.toLowerCase().includes(f)), [carpetas, f])
  const as = useMemo(() => archivos.filter((a) => !f || a.nombre.toLowerCase().includes(f)), [archivos, f])

  const correr = (fn: () => Promise<{ ok: boolean; error?: string }>, alTerminar?: () => void) =>
    iniciar(async () => {
      const r = await fn()
      if (!r.ok) setAviso(r.error ?? 'No se pudo.')
      else {
        setAviso(null)
        alTerminar?.()
        router.refresh()
      }
    })

  const subir = (files: FileList | File[]) => {
    const supabase = createClient()
    for (const file of Array.from(files)) {
      if (file.size > MAX_BYTES_ARCHIVO) {
        setSubiendo((s) => [...s, { nombre: file.name, estado: 'error', error: 'Pasa de 100 MB' }])
        continue
      }
      setSubiendo((s) => [...s, { nombre: file.name, estado: 'subiendo' }])
      const marcar = (cambio: { estado: 'error'; error: string } | null) =>
        setSubiendo((s) => (cambio ? s.map((x) => (x.nombre === file.name ? { ...x, ...cambio } : x)) : s.filter((x) => x.nombre !== file.name)))
      void (async () => {
        const p = await prepararSubida({ nombre: file.name, mime: file.type || 'application/octet-stream', bytes: file.size, carpetaId })
        if (!p.ok) return marcar({ estado: 'error', error: p.error })
        const { error } = await supabase.storage.from('asistente').upload(p.ruta, file, { contentType: file.type || 'application/octet-stream', upsert: false })
        if (error) return marcar({ estado: 'error', error: 'No se pudo subir' })
        const c = await confirmarSubida(p.archivoId)
        if (!c.ok) return marcar({ estado: 'error', error: c.error })
        marcar(null)
        router.refresh()
      })()
    }
  }

  const menu = (objeto: 'carpeta' | 'archivo', id: string, nombre: string) =>
    editable && (
      <span className="inline-flex gap-1">
        <button type="button" className="btn-neutro h-7 px-2 text-[12px]" onClick={() => setDialogo({ tipo: 'compartir', objeto, id, nombre })}>
          Compartir
        </button>
        <button type="button" className="btn-neutro h-7 px-2 text-[12px]" onClick={() => setDialogo({ tipo: 'renombrar', objeto, id, nombre })}>
          Renombrar
        </button>
        <button type="button" className="btn-neutro h-7 px-2 text-[12px]" onClick={() => setDialogo({ tipo: 'mover', objeto, id, nombre })}>
          Mover
        </button>
        <button type="button" className="btn-peligro h-7 px-2 text-[12px]" aria-label={`Borrar ${nombre}`} onClick={() => setDialogo({ tipo: 'borrar', objeto, id, nombre })}>
          🗑
        </button>
      </span>
    )

  return (
    <div
      onDragOver={(e) => {
        if (!editable) return
        e.preventDefault()
        setArrastrando(true)
      }}
      onDragLeave={() => setArrastrando(false)}
      onDrop={(e) => {
        if (!editable) return
        e.preventDefault()
        setArrastrando(false)
        if (e.dataTransfer.files.length) subir(e.dataTransfer.files)
      }}
      className={cn('rounded-xl', arrastrando && 'outline-2 outline-offset-4 outline-dashed outline-acento-500')}
    >
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {editable && (
          <>
            <button type="button" className="btn-acento h-8 px-3 text-[12.5px]" onClick={() => input.current?.click()}>
              ⬆ Subir archivos
            </button>
            <input ref={input} type="file" multiple className="sr-only" aria-label="Subir archivos a esta carpeta" onChange={(e) => e.target.files && (subir(e.target.files), (e.target.value = ''))} />
            <button type="button" className="btn-neutro h-8 px-3 text-[12.5px]" onClick={() => setDialogo({ tipo: 'nueva' })}>
              + Nueva carpeta
            </button>
          </>
        )}
        <input value={filtro} onChange={(e) => setFiltro(e.target.value)} placeholder="Buscar en esta carpeta…" aria-label="Buscar en esta carpeta" className="campo ml-auto h-8 w-full max-w-[260px] text-[12.5px]" />
      </div>
      {aviso && (
        <p role="alert" className="mb-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[12.5px] text-red-800">
          {aviso}
        </p>
      )}
      {subiendo.length > 0 && (
        <ul className="mb-2 flex flex-wrap gap-1.5 text-[12px]" aria-live="polite">
          {subiendo.map((s) => (
            <li key={s.nombre} className={cn('rounded-full border px-2.5 py-1', s.estado === 'error' ? 'border-red-200 bg-red-50 text-red-800' : 'border-[var(--borde)] bg-white text-marca-700')}>
              {s.estado === 'subiendo' ? '⏳' : '⚠'} {s.nombre}
              {s.error ? ` · ${s.error}` : ''}
            </li>
          ))}
        </ul>
      )}

      <section className="relative overflow-x-auto rounded-xl border border-[var(--borde)] bg-white" data-explorador>
        {cs.length + as.length === 0 ? (
          <p className="px-4 py-10 text-center text-[13px] text-marca-400">{f ? 'Nada coincide con la búsqueda.' : editable ? 'Esta carpeta está vacía. Arrastra archivos aquí o usa «Subir archivos».' : 'Esta carpeta está vacía.'}</p>
        ) : (
          <table className="w-full min-w-[680px] text-[13px]">
            <thead className="border-b border-[var(--borde)] bg-marca-50 text-left text-[12px] text-marca-600">
              <tr>
                <th className="px-4 py-2 font-semibold">Nombre</th>
                <th className="px-3 py-2 text-right font-semibold">Tamaño</th>
                <th className="px-3 py-2 font-semibold">{esPropia ? 'Fecha' : 'De'}</th>
                <th className="px-4 py-2 text-right font-semibold">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {cs.map((c) => (
                <tr key={c.id} className="border-b border-[var(--borde)] last:border-0 hover:bg-marca-50/60">
                  <td className="max-w-[420px] truncate px-4 py-2">
                    <Link href={`/sistema/archivos?c=${c.id}`} className="font-medium text-marca-900 hover:underline">
                      <span aria-hidden>📁 </span>
                      {c.nombre}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-right text-marca-400">—</td>
                  <td className="px-3 py-2 text-marca-500">{c.de ?? ''}</td>
                  <td className="px-4 py-2 text-right whitespace-nowrap">{menu('carpeta', c.id, c.nombre)}</td>
                </tr>
              ))}
              {as.map((a) => (
                <tr key={a.id} className="border-b border-[var(--borde)] last:border-0 hover:bg-marca-50/60">
                  <td className="max-w-[420px] px-4 py-2">
                    <span className="flex min-w-0 items-center gap-1.5">
                      <span aria-hidden>{ICONO(a.mime, a.nombre)}</span>
                      {previsualizable(a.mime, a.nombre) ? (
                        <button type="button" className="min-w-0 truncate text-left font-medium text-marca-900 hover:underline" title={a.nombre} onClick={() => setDialogo({ tipo: 'ver', archivo: a })}>
                          {a.nombre}
                        </button>
                      ) : (
                        <span className="min-w-0 truncate font-medium text-marca-900" title={a.nombre}>
                          {a.nombre}
                        </span>
                      )}
                      {a.aviso && (
                        <span className="insignia shrink-0 border-amber-200 bg-amber-50 text-amber-800" title={a.aviso}>
                          Privado
                        </span>
                      )}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right whitespace-nowrap text-marca-600">{bytesLegibles(a.bytes)}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-marca-600">{esPropia ? a.fecha : (a.de ?? '')}</td>
                  <td className="px-4 py-2 text-right whitespace-nowrap">
                    <span className="inline-flex gap-1">
                      <a href={`/sistema/archivos/${a.id}/descargar`} className="btn-neutro h-7 px-2 text-[12px]">
                        Descargar
                      </a>
                      {menu('archivo', a.id, a.nombre)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {dialogo?.tipo === 'ver' && <VistaPrevia archivo={dialogo.archivo} alCerrar={() => setDialogo(null)} />}
      {dialogo && dialogo.tipo !== 'ver' && (
        <Dialogo titulo={TITULO[dialogo.tipo]} alCerrar={() => setDialogo(null)}>
          {dialogo.tipo === 'nueva' && <FormNombre etiqueta="Nombre de la carpeta" pendiente={pendiente} alGuardar={(n) => correr(() => crearCarpeta(n, carpetaId), () => setDialogo(null))} />}
          {dialogo.tipo === 'renombrar' && <FormNombre etiqueta="Nombre" inicial={dialogo.nombre} pendiente={pendiente} alGuardar={(n) => correr(() => renombrar(dialogo.objeto, dialogo.id, n), () => setDialogo(null))} />}
          {dialogo.tipo === 'mover' && (
            <FormMover
              destinos={destinos.filter((d) => dialogo.objeto === 'archivo' || d.id !== dialogo.id)}
              pendiente={pendiente}
              alMover={(destino) => correr(() => mover(dialogo.objeto, dialogo.id, destino), () => setDialogo(null))}
            />
          )}
          {dialogo.tipo === 'borrar' && (
            <div className="flex flex-col gap-3 text-[13px]">
              <p>
                ¿Borrar {dialogo.objeto === 'carpeta' ? 'la carpeta' : ''} <strong>{dialogo.nombre}</strong>
                {dialogo.objeto === 'carpeta' ? ' con todo lo que tiene adentro' : ''}? Lo que subiste se borra; lo que vino de otro módulo (un documento, el expediente) sigue en su lugar.
              </p>
              <div className="flex justify-end gap-2">
                <button type="button" className="btn-neutro h-8 px-3" onClick={() => setDialogo(null)}>
                  Cancelar
                </button>
                <button type="button" className="btn-peligro h-8 px-3" disabled={pendiente} onClick={() => correr(() => borrar(dialogo.objeto, dialogo.id), () => setDialogo(null))}>
                  🗑 Borrar
                </button>
              </div>
            </div>
          )}
          {dialogo.tipo === 'compartir' && <FormCompartir objeto={dialogo.objeto} id={dialogo.id} />}
        </Dialogo>
      )}
    </div>
  )
}

const TITULO = { nueva: 'Nueva carpeta', renombrar: 'Renombrar', mover: 'Mover a…', compartir: 'Compartir', borrar: 'Borrar' } as const

function Dialogo({ titulo, alCerrar, children }: { titulo: string; alCerrar: () => void; children: React.ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (!d.open) d.showModal()
    d.addEventListener('close', alCerrar)
    return () => d.removeEventListener('close', alCerrar)
  }, [alCerrar])
  return (
    <dialog ref={ref} aria-label={titulo} className="m-auto w-[min(440px,94vw)] rounded-2xl border border-[var(--borde)] bg-white p-0 shadow-xl backdrop:bg-black/40">
      <div className="flex items-center border-b border-[var(--borde)] px-4 py-2.5">
        <h2 className="flex-1 text-[14px] font-semibold text-marca-900">{titulo}</h2>
        <button type="button" aria-label="Cerrar" className="h-8 w-8 rounded-lg text-marca-500 hover:bg-marca-50" onClick={() => ref.current?.close()}>
          ✕
        </button>
      </div>
      <div className="p-4">{children}</div>
    </dialog>
  )
}

function FormNombre({ etiqueta, inicial = '', pendiente, alGuardar }: { etiqueta: string; inicial?: string; pendiente: boolean; alGuardar: (n: string) => void }) {
  const [n, setN] = useState(inicial)
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault()
        if (n.trim()) alGuardar(n)
      }}
    >
      <label className="flex flex-col gap-1 text-[12.5px] text-marca-700">
        {etiqueta}
        <input autoFocus value={n} onChange={(e) => setN(e.target.value)} maxLength={200} className="campo h-9" />
      </label>
      <div className="flex justify-end">
        <button type="submit" className="btn-acento h-8 px-4" disabled={pendiente || !n.trim()}>
          Guardar
        </button>
      </div>
    </form>
  )
}

function FormMover({ destinos, pendiente, alMover }: { destinos: { id: string; nombre: string; nivel: number }[]; pendiente: boolean; alMover: (d: string | null) => void }) {
  const [d, setD] = useState('')
  return (
    <div className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-[12.5px] text-marca-700">
        Carpeta de destino
        <select value={d} onChange={(e) => setD(e.target.value)} className="campo h-9">
          <option value="">Mis carpetas (arriba de todo)</option>
          {destinos.map((x) => (
            <option key={x.id} value={x.id}>
              {' '.repeat(x.nivel * 2)}
              {x.nombre}
            </option>
          ))}
        </select>
      </label>
      <div className="flex justify-end">
        <button type="button" className="btn-acento h-8 px-4" disabled={pendiente} onClick={() => alMover(d || null)}>
          Mover aquí
        </button>
      </div>
    </div>
  )
}

function FormCompartir({ objeto, id }: { objeto: 'carpeta' | 'archivo'; id: string }) {
  const [personas, setPersonas] = useState<{ perfil_id: string; nombre: string }[] | null>(null)
  const [actuales, setActuales] = useState<{ id: string; con: string }[]>([])
  const [elegida, setElegida] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [confirmar, setConfirmar] = useState<string | null>(null)
  const [pendiente, iniciar] = useTransition()
  const cargar = () => {
    const db = createClient().schema('asistente')
    void db.rpc('personas_con_archivos').then(({ data }) => setPersonas((data ?? []) as { perfil_id: string; nombre: string }[]))
    void db
      .from('compartido')
      .select('id, con')
      .eq('objeto_id', id)
      .then(({ data }) => setActuales(data ?? []))
  }
  useEffect(cargar, [id])
  const nombre = new Map((personas ?? []).map((p) => [p.perfil_id, p.nombre]))
  const hacer = (confirmado: boolean) =>
    iniciar(async () => {
      const r = await compartir(objeto, id, elegida, confirmado)
      if (r.ok) {
        setError(null)
        setConfirmar(null)
        setElegida('')
        cargar()
      } else if ('confirmar' in r && r.confirmar) setConfirmar(r.error)
      else setError(r.error)
    })
  return (
    <div className="flex flex-col gap-3 text-[13px]">
      <p className="text-[12.5px] text-marca-600">{objeto === 'carpeta' ? 'Quien la reciba ve todo lo que tiene adentro, también lo que agregues después.' : 'Quien lo reciba lo ve en «Compartido conmigo».'}</p>
      <div className="flex gap-2">
        <select value={elegida} onChange={(e) => (setElegida(e.target.value), setConfirmar(null), setError(null))} className="campo h-9 min-w-0 flex-1" aria-label="Con quién">
          <option value="">{personas ? 'Elige a una persona…' : 'Cargando…'}</option>
          {(personas ?? [])
            .filter((p) => !actuales.some((a) => a.con === p.perfil_id))
            .map((p) => (
              <option key={p.perfil_id} value={p.perfil_id}>
                {p.nombre}
              </option>
            ))}
        </select>
        <button type="button" className="btn-acento h-9 px-3" disabled={!elegida || pendiente} onClick={() => hacer(false)}>
          Compartir
        </button>
      </div>
      {confirmar && (
        <div role="alert" className="rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-[12.5px] text-amber-900">
          <p>{confirmar}</p>
          <button type="button" className="btn-peligro mt-2 h-8 px-3" disabled={pendiente} onClick={() => hacer(true)}>
            Compartir igual
          </button>
        </div>
      )}
      {error && (
        <p role="alert" className="text-[12.5px] text-red-700">
          {error}
        </p>
      )}
      {actuales.length > 0 && (
        <div>
          <p className="mb-1 text-[12px] font-semibold text-marca-600">Ya lo tienen</p>
          <ul className="flex flex-col gap-1">
            {actuales.map((a) => (
              <li key={a.id} className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate">{nombre.get(a.con) ?? 'Otra persona'}</span>
                <button type="button" className="btn-neutro h-7 px-2 text-[12px]" disabled={pendiente} onClick={() => iniciar(async () => (await retirarCompartido(a.id), cargar()))}>
                  Quitar
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function VistaPrevia({ archivo, alCerrar }: { archivo: ArchivoVista; alCerrar: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (!d.open) d.showModal()
    d.addEventListener('close', alCerrar)
    return () => d.removeEventListener('close', alCerrar)
  }, [alCerrar])
  const ver = `/sistema/archivos/${archivo.id}/descargar?ver=1`
  const esPdf = archivo.mime === 'application/pdf' || archivo.nombre.toLowerCase().endsWith('.pdf')
  return (
    <dialog
      ref={ref}
      aria-label={`Vista previa: ${archivo.nombre}`}
      className="m-auto h-[92dvh] w-[min(1100px,96vw)] max-w-none overflow-hidden rounded-2xl border border-[var(--borde)] bg-white p-0 shadow-xl backdrop:bg-black/40"
      onClick={(e) => e.target === ref.current && ref.current?.close()}
    >
      <div className="flex h-full flex-col">
        <div className="flex items-center gap-2 border-b border-[var(--borde)] px-3 py-2">
          <p className="min-w-0 flex-1 truncate text-[13px] font-semibold text-marca-900" title={archivo.nombre}>
            {archivo.nombre}
          </p>
          <a href={`/sistema/archivos/${archivo.id}/descargar`} className="h-8 rounded-lg border border-[var(--borde)] px-2.5 text-[12px] leading-8 hover:bg-marca-50">
            Descargar
          </a>
          <button type="button" onClick={() => ref.current?.close()} className="h-8 w-8 rounded-lg border border-[var(--borde)] text-[14px] hover:bg-marca-50" aria-label="Cerrar la vista previa">
            ✕
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto bg-[#eef0f3]">
          {esPdf ? (
            <VisorPdf url={ver} />
          ) : archivo.mime.startsWith('image/') ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={ver} alt={archivo.nombre} className="mx-auto max-h-full max-w-full object-contain p-4" />
          ) : archivo.mime.startsWith('audio/') ? (
            <audio controls src={ver} className="mx-auto mt-10 w-[min(520px,90%)]" />
          ) : archivo.mime.startsWith('video/') ? (
            <video controls src={ver} className="mx-auto max-h-full max-w-full" />
          ) : (
            <iframe src={ver} title={archivo.nombre} sandbox="" className="h-full w-full bg-white" />
          )}
        </div>
      </div>
    </dialog>
  )
}
