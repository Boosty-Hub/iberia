import GithubSlugger from 'github-slugger'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { MapaInteractivo, type MacroDelMapa } from '@/components/mapa-interactivo'
import { Insignia } from '@/components/ui'
import { esEditor, puede, requerirSesion } from '@/lib/auth'
import { rutaDeSeccion } from '@/lib/informe-rutas'
import { createClient } from '@/lib/supabase/server'
import { PARTES_INFORME, type ParteInforme } from '@/lib/types'

/**
 * El mapa de procesos navegable — y, desde el 25 de septiembre, **la sección
 * «El mapa de procesos»**: su página de texto decía lo mismo que las fichas y
 * era un clic de más antes del dibujo. `/informe/mapa-procesos` redirige aquí y
 * todo enlace a esa sección pasa por `rutaDeSeccion()`.
 *
 * Por eso esta página se viste de sección: la miga con su parte y su número,
 * el título de la fila y las flechas de anterior y siguiente. Y se ve con la
 * casilla «ver» de esa sección; el recurso aparte del mapa se fue.
 *
 * ⚠️ Un segmento estático gana al dinámico en Next, así que esta carpeta se
 * atiende antes que `[slug]` y nunca va a caer en el `notFound()` de allá.
 */

export const metadata: Metadata = {
  title: 'El mapa de procesos · Informe',
}

const NIVELES = ['Estratégico', 'Operativo', 'Soporte']

export default async function MapaInteractivoPage() {
  const sesion = await requerirSesion()
  const quienEscribe = esEditor(sesion.perfil)
  const supabase = await createClient()

  // La lista de secciones que ve esta sesión, igual que en `[slug]`: la RLS
  // filtra lo no publicado y `puede()` la casilla «ver» de cada rol.
  const { data: filas } = await supabase
    .from('informe_secciones')
    .select('slug, numero, titulo, subtitulo, parte, contenido_md, publicado')
    .order('orden')
  const todas = (filas ?? []).filter((s) => puede(sesion, `informe:${s.slug}`))
  const visibles = quienEscribe ? todas : todas.filter((s) => s.contenido_md?.trim())
  const i = visibles.findIndex((s) => s.slug === 'mapa-procesos')
  // ⚠️ El mapa es el inventario entero de procesos: quien no ve la sección no
  // ve el mapa, aunque tenga sesión.
  if (i === -1) notFound()
  const seccion = visibles[i]
  const anterior = i > 0 ? visibles[i - 1] : null
  const siguiente = i < visibles.length - 1 ? visibles[i + 1] : null

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
    <div className="mx-auto w-full max-w-[1640px] sm:px-6 sm:py-8 lg:px-8 lg:py-10">
      <article className="hoja-informe mx-auto w-full">
        <header className="border-b border-[var(--borde)] pb-6">
          <nav aria-label="Ruta" className="flex flex-wrap items-center gap-x-1 gap-y-2 text-xs">
            <Link href="/informe" className="migas-enlace">
              Informe
            </Link>
            <span className="text-marca-300" aria-hidden>
              /
            </span>
            <span className="px-1 text-marca-500">{PARTES_INFORME[seccion.parte as ParteInforme]}</span>
            {seccion.numero && <span className="font-mono text-acento-600">{seccion.numero}</span>}
            {!seccion.publicado && (
              <Insignia tono="ambar" className="ml-1">
                Borrador
              </Insignia>
            )}
          </nav>

          <h1 className="mt-4 text-[1.75rem] leading-tight font-bold tracking-tight text-balance text-marca-900 sm:text-4xl">
            {seccion.titulo}
          </h1>
          <p className="mt-3 text-base text-pretty text-marca-600 sm:text-lg">
            Los {macros.length} macroprocesos y sus {totalProcesos} procesos. Abre una caja para ver
            los suyos; cada uno lleva a su ficha en el informe.
          </p>
        </header>

        <div className="py-8">
          {macros.length ? (
            <MapaInteractivo macros={macros} />
          ) : (
            <div className="rounded-xl border border-dashed border-[var(--borde)] px-6 py-12 text-center">
              <p className="text-sm text-marca-400">El inventario todavía no está sembrado en la base.</p>
              <p className="mt-2 font-mono text-xs text-marca-400">npm run sembrar:procesos</p>
            </div>
          )}
        </div>

        <nav aria-label="Secciones contiguas" className="grid gap-3 border-t border-[var(--borde)] pt-6 sm:grid-cols-2">
          {anterior ? (
            <Link href={rutaDeSeccion(anterior.slug)} className="contigua">
              <span className="text-xs text-marca-400">← Anterior</span>
              <span className="contigua-titulo">
                {anterior.numero && <span className="font-mono text-marca-400">{anterior.numero}</span>}
                {anterior.titulo}
              </span>
            </Link>
          ) : (
            <span className="hidden sm:block" />
          )}
          {siguiente ? (
            <Link href={rutaDeSeccion(siguiente.slug)} className="contigua sm:text-right">
              <span className="text-xs text-marca-400">Siguiente →</span>
              <span className="contigua-titulo sm:justify-end">
                {siguiente.numero && <span className="font-mono text-marca-400">{siguiente.numero}</span>}
                {siguiente.titulo}
              </span>
            </Link>
          ) : (
            <span className="hidden sm:block" />
          )}
        </nav>
      </article>
    </div>
  )
}
