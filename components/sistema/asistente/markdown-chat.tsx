import { memo, type ReactElement } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import { BloqueCodigo } from './bloque-codigo'

type NodoHast = { type: string; value?: string; tagName?: string; properties?: { className?: unknown }; children?: NodoHast[] }

/** El texto plano de un nodo (para «Copiar»: sin las marcas del resaltado). */
function textoDe(n: NodoHast | undefined): string {
  if (!n) return ''
  if (n.type === 'text') return n.value ?? ''
  return (n.children ?? []).map(textoDe).join('')
}

/**
 * El Markdown de las respuestas del asistente, más compacto que el del
 * informe (`.prosa-chat` en globals.css). Los enlaces abren en otra pestaña y
 * las tablas se deslizan sin ensanchar la página. `react-markdown` descarta el
 * HTML crudo: lo que el modelo escriba como HTML no se ejecuta aquí. El código va
 * en la ventana oscura de terminal, con sus colores y «Copiar» (`BloqueCodigo`).
 */
export const MarkdownChat = memo(function MarkdownChat({ contenido }: { contenido: string }) {
  return (
    <div className="prosa prosa-chat">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        // Sin detección automática: se colorea el lenguaje que el modelo declara en el bloque (```sql, ```python…).
        rehypePlugins={[[rehypeHighlight, { detect: false }]]}
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
          pre: ({ node, children }) => {
            const codigo = (node as NodoHast | undefined)?.children?.find((c) => c.tagName === 'code')
            const clases = ([] as string[]).concat((codigo?.properties?.className as string[] | undefined) ?? [])
            const lenguaje = clases.find((c) => c.startsWith('language-'))?.slice(9) ?? null
            return (
              <BloqueCodigo lenguaje={lenguaje} texto={textoDe(codigo).replace(/\n$/, '')}>
                {children as ReactElement}
              </BloqueCodigo>
            )
          },
        }}
      >
        {contenido}
      </ReactMarkdown>
    </div>
  )
})
