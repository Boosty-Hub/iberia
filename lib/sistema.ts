import type { ClaveSistema } from '@/components/nav-sistema'
import { puede, type Sesion } from '@/lib/auth'

/**
 * Qué destinos de la barra puede abrir esta sesión: **el mismo permiso que exige
 * cada página**. Si dijeran cosas distintas, la barra llevaría a una pantalla que
 * devuelve.
 */
export function destinosSistema(sesion: Sesion): ClaveSistema[] {
  const reglas: [ClaveSistema, boolean][] = [
    ['inicio', puede(sesion, 'sistema:inicio')],
    ['bandeja', true],
    ['estructura', puede(sesion, 'sistema:estructura')],
    ['dotacion', puede(sesion, 'sistema:dotacion')],
    ['requisiciones', puede(sesion, 'sistema:requisiciones', 'crear') || puede(sesion, 'sistema:requisiciones')],
    ['escenarios', puede(sesion, 'sistema:escenarios')],
    ['conciliacion', puede(sesion, 'sistema:estructura') || puede(sesion, 'sistema:procesos') || puede(sesion, 'sistema:documentos')],
    ['procesos', puede(sesion, 'sistema:procesos')],
    ['documentos', puede(sesion, 'sistema:documentos')],
    ['programa', puede(sesion, 'modulo:panel')],
    ['usuarios', puede(sesion, 'modulo:usuarios')],
    ['roles', puede(sesion, 'modulo:roles')],
    ['aprobaciones', puede(sesion, 'sistema:aprobaciones')],
    ['catalogos', puede(sesion, 'sistema:catalogos')],
    ['auditoria', puede(sesion, 'sistema:auditoria')],
  ]
  return reglas.filter(([, si]) => si).map(([clave]) => clave)
}

