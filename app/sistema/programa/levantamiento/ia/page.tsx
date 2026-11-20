import type { Metadata } from 'next'
import { puede, requerirSesion } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { CabeceraModulo } from '@/components/sistema/ui/cabecera-modulo'
import { IaDelModulo } from '@/components/sistema/programa/ia-modulo'

export const metadata: Metadata = { title: 'IA · Levantamiento' }

/** PRG-LEV · IA: el levantamiento no tiene capacidades de IA encendidas. */
export default async function IaLevantamientoPage() {
  const sesion = await requerirSesion()
  if (!puede(sesion, 'modulo:entrevistas') && !puede(sesion, 'modulo:archivos')) redirect('/sistema?aviso=sin-permiso')
  return (
    <>
      <CabeceraModulo sesion={sesion} codigo="PRG-LEV" migas={[{ etiqueta: 'IA' }]} />
      <IaDelModulo codigo="PRG-LEV" />
    </>
  )
}
