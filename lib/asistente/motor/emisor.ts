import type { EventoTurno } from '../tipos'
import { TOPICO_CHAT } from '../tipos'

/**
 * Manda los eventos de un turno por Realtime Broadcast al canal privado del
 * chat. Son efímeros: no se escriben filas que luego se leen (la meta de la
 * primera palabra en menos de 2 s). Lo que no se puede perder —el mensaje, los
 * archivos, el estado— se guarda en la base; si un evento no llega, la pantalla
 * igual encuentra todo al refrescar.
 *
 * Los trozos de texto se juntan y salen cada `cada` ms en una sola petición:
 * una petición por token saturaría la API. El primer trozo sale en el acto.
 */
export class Emisor {
  private cola: EventoTurno[] = []
  private reloj: ReturnType<typeof setTimeout> | null = null
  private enCurso: Promise<void> = Promise.resolve()
  private primero = true

  constructor(
    private chat: string,
    private cada = 120
  ) {}

  emitir(e: EventoTurno) {
    // Dos trozos seguidos del mismo tipo se juntan en uno.
    const ultimo = this.cola.at(-1)
    if (ultimo && (e.t === 'texto' || e.t === 'pensamiento') && ultimo.t === e.t && ultimo.turno === e.turno) {
      ultimo.d += e.d
    } else {
      this.cola.push(structuredClone(e))
    }
    if (this.primero || e.t === 'fin' || e.t === 'estado') {
      this.primero = false
      void this.vaciar()
    } else if (!this.reloj) {
      this.reloj = setTimeout(() => void this.vaciar(), this.cada)
    }
  }

  /** Espera a que salga todo lo pendiente (al cerrar el turno). */
  async terminar() {
    await this.vaciar()
    await this.enCurso
  }

  private vaciar(): Promise<void> {
    if (this.reloj) {
      clearTimeout(this.reloj)
      this.reloj = null
    }
    if (!this.cola.length) return this.enCurso
    const lote = this.cola
    this.cola = []
    this.enCurso = this.enCurso.then(() => enviar(this.chat, lote)).catch(() => undefined)
    return this.enCurso
  }
}

async function enviar(chat: string, eventos: EventoTurno[]) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const secreto = process.env.SUPABASE_SECRET_KEY
  if (!url || !secreto) return
  try {
    const r = await fetch(`${url}/realtime/v1/api/broadcast`, {
      method: 'POST',
      headers: { apikey: secreto, Authorization: `Bearer ${secreto}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: eventos.map((payload) => ({ topic: TOPICO_CHAT(chat), event: 'evento', payload, private: true })),
      }),
    })
    if (!r.ok) console.warn(`[asistente] broadcast ${r.status}: ${(await r.text()).slice(0, 200)}`)
  } catch (e) {
    console.warn('[asistente] broadcast falló:', e instanceof Error ? e.message : e)
  }
}
