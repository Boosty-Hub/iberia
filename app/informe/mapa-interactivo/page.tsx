import GithubSlugger from 'github-slugger'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { MapaInteractivo, type MacroDelMapa } from '@/components/mapa-interactivo'
import { esEditor, puede, requerirSesion } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

/**
 * El mapa de procesos navegable.
 *
 * Es una ruta hermana de `[slug]` y no una sección del informe: no tiene
 * contenido propio, es **otra forma de mirar** las secciones 4 y 5. Por eso no
 * está en `SECCIONES`, no aparece en el índice lateral y se entra por el botón
 * que vive dentro del mapa de procesos.
 *
 * ⚠️ Un segmento estático gana al dinámico en Next, así que esta carpeta se
 * atiende antes que `[slug]` y nunca va a caer en el `notFound()` de allá.
 */

export const metadata: Metadata = {
  title: 'Mapa interactivo de procesos · Informe',
}

const NIVELES = ['Estratégico', 'Operativo', 'Soporte']

export default async function MapaInteractivoPage() {
  const sesion = await requerirSesion()
  const supabase = await createClient()

  // ⚠️ El mapa es el inventario entero de procesos. Hasta el 25 de septiembre lo
  // abría cualquiera con sesión, aunque el informe no tuviera nada publicado:
  // un lector de Iberia veía por aquí lo que la sección 2 todavía no le
  // mostraba. Ahora exige su permiso y, para quien no escribe, que la sección
  // del mapa de procesos esté publicada y a su alcance (la RLS decide eso).
  if (!puede(sesion, 'informe:mapa-interactivo')) notFound()
  if (!esEditor(sesion.perfil)) {
    const { data: puerta } = await supabase
      .from('informe_secciones')
      .select('slug')
      .eq('slug', 'mapa-procesos')
      .maybeSingle()
    if (!puerta) notFound()
  }

  const { data } = await supabase
    .from('macroprocesos')
    .select('nivel, numero, nombre, nuevo, procesos(nombre, estado, area, dueno_corregido, orden)')
    .order('numero')

  // El ancla de cada ficha se calcula **igual que en el generador**: el slug de
  // «1.1 · Nombre» con `github-slugger`, que es el mismo que usa `rehype-slug`
  // al renderizar el markdown. Construirla a mano dejaría los veinte enlaces
  // apuntando a la nada, y sin error visible.
  const macros: MacroDelMapa[] = (data ?? [])
    .map((m) => {
      const n = NIVELES.indexOf(m.nivel) + 1
      return {
        nivel: m.nivel,
        numero: m.numero,
        nombre: m.nombre,
        nuevo: m.nuevo,
        ancla: new GithubSlugger().slug(`${n}.${m.numero} · ${m.nombre}`),
        procesos: [...(m.procesos ?? [])]
          .sort((a, b) => a.orden - b.orden)
          .map((p) => ({
            nombre: p.nombre,
            estado: p.estado,
            area: p.area,
            dueno_corregido: p.dueno_corregido,
          })),
      }
    })
    .sort((a, b) => NIVELES.indexOf(a.nivel) - NIVELES.indexOf(b.nivel) || a.numero - b.numero)

  const totalProcesos = macros.reduce(
    (t, m) => t + m.procesos.filter((p) => p.estado === 'VIGENTE' || p.estado === 'NUEVO').length,
    0
  )

  return (
    <article className="tarjeta mx-4 my-8 px-5 py-10 lg:mx-8 lg:my-10 lg:px-10 lg:py-12">
      <header className="border-b border-[var(--borde)] pb-6">
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/informe" className="text-xs text-marca-400 hover:text-acento-700">
            Informe
          </Link>
          <span className="text-xs text-marca-300">/</span>
          <Link
            href="/informe/mapa-procesos"
            className="text-xs text-marca-400 hover:text-acento-700"
          >
            El mapa de procesos
          </Link>
          <span className="text-xs text-marca-300">/</span>
          <span className="text-xs text-marca-500">Mapa interactivo</span>
        </div>

        <h1 className="mt-2 text-3xl font-bold tracking-tight text-marca-900">
          Mapa interactivo de procesos
        </h1>
        <p className="mt-2 text-marca-600">
          Los {macros.length} macroprocesos y sus {totalProcesos} procesos. Abre una caja para ver
          los suyos; cada uno lleva a su ficha en el informe.
        </p>
      </header>

      <div className="py-8">
        {macros.length ? (
          <MapaInteractivo macros={macros} />
        ) : (
          <div className="rounded-xl border border-dashed border-[var(--borde)] px-6 py-12 text-center">
            <p className="text-sm text-marca-400">
              El inventario todavía no está sembrado en la base.
            </p>
            <p className="mt-2 font-mono text-xs text-marca-400">npm run sembrar:procesos</p>
          </div>
        )}
      </div>

      <footer className="flex items-center justify-between border-t border-[var(--borde)] pt-6">
        <Link href="/informe/mapa-procesos" className="text-sm text-marca-500 hover:text-acento-700">
          ← El mapa de procesos
        </Link>
        <Link
          href="/informe/fichas-procesos"
          className="text-sm text-marca-500 hover:text-acento-700"
        >
          Las fichas de proceso →
        </Link>
      </footer>
    </article>
  )
}
