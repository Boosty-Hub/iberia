import type { Metadata } from 'next'
import { puede, requerirPermiso } from '@/lib/auth'
import { leerConfig } from '@/lib/asistente/admin'
import { CabeceraModulo } from '@/components/sistema/ui/cabecera-modulo'
import { FormInstrucciones } from '@/components/sistema/asistente/admin-formularios'

export const metadata: Metadata = { title: 'Instrucciones · Asistente de IA' }

/** Las instrucciones de la empresa: lo que el asistente sabe de Iberia en todo chat, de todos. */
export default async function InstruccionesPage() {
  const sesion = await requerirPermiso('sistema:asistente-admin')
  const config = await leerConfig()
  return (
    <>
      <CabeceraModulo sesion={sesion} codigo="NUC-IA" titulo="Asistente de IA" migas={[{ etiqueta: 'Instrucciones' }]} />
      <FormInstrucciones inicial={config?.instrucciones_empresa ?? ''} editable={puede(sesion, 'sistema:asistente-admin', 'editar')} />
    </>
  )
}
