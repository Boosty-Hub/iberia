import { memo } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

/**
 * El Markdown de las respuestas del asistente, más compacto que el del
 * informe (`.prosa-chat` en globals.css). Los enlaces abren en otra pestaña y
 * las tablas se deslizan sin ensanchar la página. `react-markdown` descarta el
 * HTML crudo: lo que el modelo escriba como HTML no se ejecuta aquí.
 */
export const MarkdownChat = memo(function MarkdownChat({ contenido }: { contenido: string }) {
  return (
    <div className="prosa prosa-chat">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // Los enlaces a la plataforma (fichas, tablas) abren aquí mismo; los de afuera, en otra pestaña.
          a: ({ href, children }) =>
            href?.startsWith('/sistema') ? (
              <a href={href}>{children}</a>
            ) : (
              <a href={href} target="_blank" rel="noopener noreferrer">
                {children}
              </a>
            ),
          table: ({ children }) => (
            <div className="tabla-chat">
              <table>{children}</table>
            </div>
          ),
        }}
      >
        {contenido}
      </ReactMarkdown>
    </div>
  )
})
