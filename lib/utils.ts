import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** 1.234,5 kB → tamaños legibles en formato local. */
export function formatBytes(bytes: number | null | undefined): string {
  if (!bytes) return '—'
  const units = ['B', 'kB', 'MB', 'GB']
  let i = 0
  let n = bytes
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024
    i++
  }
  return `${n.toFixed(i === 0 ? 0 : 1).replace('.', ',')} ${units[i]}`
}

/** Segundos → mm:ss (o h:mm:ss cuando pasa la hora). */
export function formatTimestamp(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined) return ''
  const total = Math.floor(seconds)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const pad = (v: number) => String(v).padStart(2, '0')
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`
}

export function formatFecha(fecha: string | null | undefined): string {
  if (!fecha) return '—'
  // Se fuerza mediodía UTC para que la zona horaria no corra el día.
  const d = new Date(`${fecha.slice(0, 10)}T12:00:00Z`)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('es-VE', { day: '2-digit', month: 'short', year: 'numeric' })
}

/**
 * Cómo se llama una sesión en pantalla: una entrevista se identifica por su
 * entrevistado; una reunión o una visita, por su título.
 */
export function nombreSesion(sesion: {
  titulo?: string | null
  entrevistado_nombre?: string | null
  codigo?: string | null
}): string {
  return sesion.titulo?.trim() || sesion.entrevistado_nombre?.trim() || sesion.codigo || 'Sesión'
}

/** Nombre de archivo seguro para una ruta de Storage. */
export function slugifyFilename(name: string): string {
  const dot = name.lastIndexOf('.')
  const base = dot > 0 ? name.slice(0, dot) : name
  const ext = dot > 0 ? name.slice(dot).toLowerCase() : ''
  const clean = base
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()
  return `${clean || 'archivo'}${ext.replace(/[^a-z0-9.]/g, '')}`
}
