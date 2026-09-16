import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeSlug from 'rehype-slug'
import { cn } from '@/lib/utils'

/**
 * Renderiza el markdown de las secciones del informe.
 * Los estilos viven en la clase `.prosa` de globals.css; aquí solo se envuelven
 * las tablas para que nunca desborden el ancho de la página.
 *
 * ⚠️ `rehype-slug` le pone id a cada encabezado, y de eso dependen los enlaces
 * internos —el mapa de procesos apunta a la ficha de cada macroproceso—. No se
 * puede resolver con un `<a id="…">` escrito en el markdown: `react-markdown`
 * descarta el HTML crudo y el ancla desaparece sin dar error. Quien genera el
 * enlace usa `github-slugger`, que es el mismo que usa este plugin.
 */
export function Markdown({
  contenido,
  className,
}: {
  contenido: string
  className?: string
}) {
  return (
    <div className={cn('prosa', className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeSlug]}
        components={{
          table: ({ children }) => (
            <div className="tabla-scroll">
              <table>{children}</table>
            </div>
          ),
          a: ({ href, children }) => (
            <a
              href={href}
              target={href?.startsWith('http') ? '_blank' : undefined}
              rel={href?.startsWith('http') ? 'noopener noreferrer' : undefined}
            >
              {children}
            </a>
          ),
        }}
      >
        {contenido}
      </ReactMarkdown>
    </div>
  )
}
