import Link from 'next/link'
import { cerrarSesion } from '@/app/login/actions'
import { IconoPanel, IconoSalir } from '@/components/iconos'
import GithubSlugger from 'github-slugger'
import { IndiceInforme, type EntradaIndice, type NivelIndice } from '@/components/indice-informe'
import { Marca } from '@/components/marca'
import { esEditor, requerirSesion } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

/**
 * El informe vive fuera del dashboard: es una página propia, con su propia
 * cáscara de lectura. Sigue exigiendo sesión — el middleware la protege y
 * requerirSesion() la vuelve a comprobar en el servidor.
 *
 * **Cada sección es una página** (`/informe/[slug]`) y el índice es su
 * navegación. Por eso el índice vive acá y no en la página: así no se vuelve a
 * montar al cambiar de sección, la posición del scroll de la columna se
 * conserva y el destino activo se marca solo.
 */
/**
 * El subíndice de una sección plegable: sus niveles y las fichas de cada uno.
 *
 * ⚠️ **Se saca del propio contenido, no del inventario.** Podría leerse
 * `inventario-procesos.json`, pero entonces el índice y la página podrían decir
 * cosas distintas en cuanto una se regenerara sin la otra. Parseando los
 * encabezados se navega exactamente lo que está escrito, y el ancla es la misma
 * que calcula `rehype-slug` porque la genera el mismo `github-slugger`.
 */
function subindice(slug: string, md: string | null): NivelIndice[] | undefined {
  if (slug !== 'fichas-procesos' || !md) return undefined

  const niveles: NivelIndice[] = []
  let enCodigo = false

  for (const linea of md.split('\n')) {
    if (linea.trimStart().startsWith('```')) enCodigo = !enCodigo
    if (enCodigo) continue

    const h2 = /^## (?!#)(.+)$/.exec(linea)
    if (h2) {
      niveles.push({ titulo: h2[1].trim(), fichas: [] })
      continue
    }
    const h3 = /^### (.+)$/.exec(linea)
    if (h3 && niveles.length) {
      const texto = h3[1].trim()
      niveles[niveles.length - 1].fichas.push({
        titulo: texto,
        ancla: new GithubSlugger().slug(texto),
      })
    }
  }

  return niveles.filter((n) => n.fichas.length)
}

export default async function InformeLayout({ children }: LayoutProps<'/informe'>) {
  const { perfil } = await requerirSesion()
  const puedeEditar = esEditor(perfil)
  const supabase = await createClient()

  // RLS ya filtra: los lectores de Iberia solo reciben las secciones publicadas.
  const { data: secciones } = await supabase
    .from('informe_secciones')
    .select('slug, numero, titulo, parte, contenido_md')
    .order('orden')

  const todas = secciones ?? []
  // Para el lector de Iberia, solo lo escrito: un índice lleno de vacíos no es
  // un informe. Para quien lo escribe, el armazón completo — si no, mientras las
  // secciones estén en blanco no hay forma de ver la estructura.
  const visibles: EntradaIndice[] = (puedeEditar
    ? todas
    : todas.filter((s) => s.contenido_md?.trim())
  ).map((s) => ({
    slug: s.slug,
    numero: s.numero,
    titulo: s.titulo,
    parte: s.parte,
    escrita: Boolean(s.contenido_md?.trim()),
    sub: subindice(s.slug, s.contenido_md),
  }))

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="sticky top-0 z-20 border-b border-[var(--borde)] bg-white/95 backdrop-blur">
        <div className="flex items-center justify-between gap-4 px-5 py-3 lg:px-8">
          <Marca />

          <div className="flex items-center gap-2">
            {puedeEditar && (
              <Link href="/dashboard/informe" className="btn-neutro px-3 text-xs">
                <IconoPanel className="h-4 w-4" />
                <span className="hidden sm:inline">Editar</span>
              </Link>
            )}
            <Link href="/dashboard" className="btn-neutro px-3 text-xs">
              <span className="hidden sm:inline">Dashboard</span>
              <span className="sm:hidden">Panel</span>
            </Link>
            <form action={cerrarSesion}>
              <button type="submit" className="btn-neutro px-3 text-xs" aria-label="Cerrar sesión">
                <IconoSalir className="h-4 w-4" />
              </button>
            </form>
          </div>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* El índice, con el lenguaje de la barra del panel: columna blanca de
            256 px con borde a la derecha. Se pega debajo de la cabecera, que
            mide 57 px. En teléfono se va: allí el índice lo da la portada. */}
        <aside className="hidden w-64 shrink-0 border-r border-[var(--borde)] bg-white lg:block">
          <div className="sticky top-[57px] max-h-[calc(100vh-57px)] overflow-y-auto">
            {visibles.length > 0 && <IndiceInforme secciones={visibles} />}
          </div>
        </aside>

        <main className="min-w-0 flex-1">{children}</main>
      </div>

      <footer className="border-t border-[var(--borde)] bg-[var(--fondo)] px-5 py-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-marca-500">
            Información confidencial de Industrias Iberia bajo acuerdo de confidencialidad.
          </p>
          <p className="text-xs text-marca-400">Boosty International LLC · Anthropic Partner</p>
        </div>
      </footer>
    </div>
  )
}
