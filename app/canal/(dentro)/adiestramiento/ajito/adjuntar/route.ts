import { NextResponse, type NextRequest } from 'next/server'
import { contextoCharla } from '@/lib/charla'
import { BUCKET_RESPUESTAS, rutaCharla } from '@/lib/storage'
import { transcribir } from '@/lib/transcribir'

/** El endpoint de audio corto corta en 60 s; el grabador también. */
const MAXIMO_AUDIO = 60 * 32_000 + 100_000
/** Una foto de teléfono ronda los 3 MB. Con 12 sobra y se corta lo absurdo. */
const MAXIMO_FOTO = 12 * 1024 * 1024

/**
 * Lo que se le manda a Ajito en la conversación —una nota de voz o una foto—: se
 * guarda en la carpeta de la persona y, si es voz, se devuelve escrito para que
 * lo confirme antes de mandarlo. Es la misma regla que en los ejercicios (ver
 * `[numero]/adjuntar`): una transcripción mala sin confirmar sería una pregunta
 * mala mandada.
 */
export async function POST(peticion: NextRequest) {
  const ctx = await contextoCharla()
  if (!ctx) return NextResponse.json({ error: 'Sin acceso a la conversación' }, { status: 403 })

  const formulario = await peticion.formData()
  const archivo = formulario.get('audio')
  if (!(archivo instanceof Blob)) {
    return NextResponse.json({ error: 'Petición inválida' }, { status: 400 })
  }

  const esFoto = archivo.type.startsWith('image/')
  if (archivo.size > (esFoto ? MAXIMO_FOTO : MAXIMO_AUDIO)) {
    return NextResponse.json({ error: 'El archivo es muy grande' }, { status: 413 })
  }

  const bytes = await archivo.arrayBuffer()
  const ruta = rutaCharla(ctx.empleado.id, esFoto ? 'foto' : 'nota', esFoto ? extensionDe(archivo.type) : 'wav')
  const { error } = await ctx.supabase.storage
    .from(BUCKET_RESPUESTAS)
    .upload(ruta, bytes, { contentType: archivo.type || 'audio/wav', upsert: false })
  if (error) return NextResponse.json({ error: 'No se pudo guardar' }, { status: 500 })

  if (esFoto) return NextResponse.json({ ruta })

  const oido = await transcribir(bytes)
  if (!oido.ok) return NextResponse.json({ ruta, motivo: oido.motivo })
  return NextResponse.json({ ruta, texto: oido.texto })
}

function extensionDe(tipo: string): string {
  if (tipo.includes('png')) return 'png'
  if (tipo.includes('webp')) return 'webp'
  if (tipo.includes('heic') || tipo.includes('heif')) return 'heic'
  return 'jpg'
}
