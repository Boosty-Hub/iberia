import type { Metadata } from 'next'
import { requerirPermiso } from '@/lib/auth'
import { compartidoConmigo } from '@/lib/archivos/servidor'
import { CabeceraModulo } from '@/components/sistema/ui/cabecera-modulo'
import { Explorador } from '@/components/sistema/archivos/explorador'

export const metadata: Metadata = { title: 'Compartido conmigo · Mis archivos' }

/** Lo que otros me compartieron: carpetas (con todo lo de adentro) y archivos sueltos. Se ve y se descarga. */
export default async function CompartidoConmigoPage() {
  const sesion = await requerirPermiso('sistema:archivos')
  const { carpetas, archivos } = await compartidoConmigo(sesion.userId)
  return (
    <>
      <CabeceraModulo sesion={sesion} codigo="MI-ARC" migas={[{ etiqueta: 'Compartido conmigo' }]} descripcion="Lo que otras personas compartieron contigo. Lo puedes ver, descargar y usar en el asistente con «/»." />
      <Explorador
        carpetaId={null}
        esPropia={false}
        puedeCrear={false}
        destinos={[]}
        carpetas={carpetas.map((c) => ({ id: c.id, nombre: c.nombre, padre_id: c.padre_id, propia: false, de: c.de }))}
        archivos={archivos.map((a) => ({ id: a.id, nombre: a.nombre, mime: a.mime, bytes: Number(a.bytes), aviso: a.aviso, propio: false, fecha: '', de: a.de }))}
      />
    </>
  )
}
