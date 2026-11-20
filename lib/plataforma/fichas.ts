import { puede, type Sesion } from '@/lib/auth'
import type { Ficha, TipoFicha } from '@/lib/plataforma/ficha-tipos'
import { fichaDocumento, fichaProceso } from '@/lib/plataforma/fichas/procesos'
import { cargarFichaOrganizacion, esTipoOrganizacion } from '@/lib/plataforma/fichas/organizacion'

/**
 * Arma la ficha de un objeto con la sesión de quien la pide: cada consulta pasa
 * por la RLS, y además se exige el permiso del módulo antes de preguntar. Si no
 * puede verlo, devuelve null (la pantalla dice «no está a tu alcance», sin
 * distinguir «no existe» de «no puedes»).
 */

const PERMISO: Record<TipoFicha, [string, 'ver' | 'crear']> = {
  unidad: ['sistema:estructura', 'ver'],
  plaza: ['sistema:estructura', 'ver'],
  cargo: ['sistema:estructura', 'ver'],
  proceso: ['sistema:procesos', 'ver'],
  documento: ['sistema:documentos', 'ver'],
  requisicion: ['sistema:requisiciones', 'crear'],
  persona: ['sistema:estructura', 'ver'],
  escenario: ['sistema:escenarios', 'ver'],
  conciliacion: ['sistema:estructura', 'ver'],
}

export async function cargarFicha(sesion: Sesion, tipo: TipoFicha, id: string): Promise<Ficha | null> {
  // R1: Organización tiene su resolutor (unidad, plaza, cargo, persona,
  // requisición, escenario, conciliación); pide sus permisos por dentro.
  if (esTipoOrganizacion(tipo)) return cargarFichaOrganizacion(sesion, tipo, id)
  const [recurso, accion] = PERMISO[tipo]
  if (!puede(sesion, recurso, accion)) return null

  switch (tipo) {
    // R2: Procesos y Documentos tienen su resolutor (con lo que se edita en la ficha).
    case 'proceso':
      return fichaProceso(sesion, id)
    case 'documento':
      return fichaDocumento(sesion, id)
  }
}
