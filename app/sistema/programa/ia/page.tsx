import type { Metadata } from 'next'
import { puede, requerirSesion } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { CabeceraModulo } from '@/components/sistema/ui/cabecera-modulo'
import { IaDelModulo } from '@/components/sistema/programa/ia-modulo'

export const metadata: Metadata = { title: 'IA · Plan y seguimiento' }

/** PRG-PLN · IA: el programa no tiene capacidades de IA encendidas. */
export default async function IaProgramaPage() {
  const sesion = await requerirSesion()
  if (!puede(sesion, 'modulo:programa') && !puede(sesion, 'modulo:calendario')) redirect('/sistema?aviso=sin-permiso')
  return (
    <>
      <CabeceraModulo sesion={sesion} codigo="PRG-PLN" migas={[{ etiqueta: 'IA' }]} />
      <IaDelModulo codigo="PRG-PLN" />
    </>
  )
}
