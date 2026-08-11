import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { cn } from '@/lib/utils'

/**
 * Renderiza el markdown de las secciones del informe.
 * Los estilos viven en la clase `.prosa` de globals.css; aquí solo se envuelven
 * las tablas para que nunca desborden el ancho de la página.
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
