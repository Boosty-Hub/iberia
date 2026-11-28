import Link from 'next/link'
import { puede, type Sesion } from '@/lib/auth'
import { indiceBusqueda, leerMapa } from '@/lib/plataforma/procesos-vivos'
import { createClient } from '@/lib/supabase/server'
import { BOTON_CABECERA, CabeceraModulo } from '@/components/sistema/ui/cabecera-modulo'
import { TarjetaMacro } from '@/components/sistema/procesos/vivos'
import { BuscadorProcesos } from '@/components/sistema/procesos/vivos-cliente'

/**
 * El mapa de procesos (rediseño del 28-nov-2026): la entrada única. Los 20 macroprocesos del mapa del informe en sus
 * tres bandas, con cuánto está documentado cada uno, y arriba la búsqueda de documentos y procesos. De aquí se baja a
 * macroproceso → proceso → documento → versiones.
 */
export async function MapaProcesos({ sesion }: { sesion: Sesion }) {
  const supabase = await createClient()
  const mapa = await leerMapa(supabase)
  const macros = mapa.procesos.filter((p) => p.nivel === 0)
  const bandas = [
    { tipo: 'estrategico', nombre: 'Procesos estratégicos' },
    { tipo: 'operativo', nombre: 'Procesos operativos' },
    { tipo: 'soporte', nombre: 'Procesos de soporte' },
  ]
  const indice = indiceBusqueda(mapa)
  return (
    <>
      <CabeceraModulo
        sesion={sesion}
        codigo="NUC-PRO"
        titulo="Procesos"
        migas={[{ etiqueta: 'Mapa' }]}
        acciones={<Link href="/sistema/nucleo/procesos/herramientas" className={BOTON_CABECERA}>Herramientas del SGC</Link>}
      />
      <div className="grid gap-5">
        <BuscadorProcesos indice={indice} />
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-marca-500">
          <span className="flex flex-wrap gap-4">
            <span className="inline-flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm bg-[#1f7a4d]" />Con documentos confirmados</span>
            <span className="inline-flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm bg-oro-400" />Con documentos sugeridos, por confirmar</span>
            <span className="inline-flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm border border-[var(--borde)] bg-marca-100" />Sin documentar</span>
          </span>
          <span>{macros.length} macroprocesos · {indice.docs.length.toLocaleString('es')} documentos activos{puede(sesion, 'sistema:procesos', 'editar') ? '' : ' · solo lectura'}</span>
        </div>
        {bandas.map((b) => {
          const ms = macros.filter((m) => m.tipo === b.tipo)
          if (!ms.length) return null
          return (
            <section key={b.tipo} className="grid gap-2.5">
              <h2 className="flex items-center gap-3 font-mono text-[11px] uppercase tracking-wider text-marca-500 after:h-px after:flex-1 after:bg-[var(--borde)]">{b.nombre}</h2>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(210px,1fr))] gap-2.5">
                {ms.map((m) => <TarjetaMacro key={m.ref} m={m} mapa={mapa} />)}
              </div>
            </section>
          )
        })}
      </div>
    </>
  )
}
