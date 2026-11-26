'use client'

import { useState, type ReactNode } from 'react'

/** Nombres legibles de los lenguajes más comunes (lo demás se muestra tal cual). */
const LENGUAJE: Record<string, string> = {
  js: 'JavaScript', javascript: 'JavaScript', jsx: 'JSX', ts: 'TypeScript', typescript: 'TypeScript', tsx: 'TSX',
  py: 'Python', python: 'Python', sql: 'SQL', bash: 'Bash', sh: 'Shell', shell: 'Shell', powershell: 'PowerShell', ps1: 'PowerShell',
  json: 'JSON', xml: 'XML', html: 'HTML', css: 'CSS', java: 'Java', csharp: 'C#', cs: 'C#', php: 'PHP', go: 'Go', rust: 'Rust',
  yaml: 'YAML', yml: 'YAML', ini: 'INI', vbnet: 'VB.NET', vba: 'VBA', r: 'R', kotlin: 'Kotlin', swift: 'Swift', cpp: 'C++', c: 'C',
  dax: 'DAX', mermaid: 'Mermaid', diff: 'Diff', markdown: 'Markdown', md: 'Markdown', plaintext: 'Texto', text: 'Texto',
}

/**
 * Un bloque de código en la respuesta del asistente (26-nov-2026, pedido de Gabriel para la gente de IT): la ventana
 * oscura de terminal, con el lenguaje, los colores de sintaxis (`rehype-highlight`) y «Copiar». Se desliza en
 * horizontal sin ensanchar la página.
 */
export function BloqueCodigo({ lenguaje, texto, children }: { lenguaje: string | null; texto: string; children: ReactNode }) {
  const [copiado, setCopiado] = useState(false)
  const etiqueta = lenguaje ? (LENGUAJE[lenguaje.toLowerCase()] ?? lenguaje) : 'Código'
  return (
    <div className="codigo-chat" data-codigo>
      <div className="codigo-chat-barra">
        <span className="codigo-chat-luces" aria-hidden>
          <i />
          <i />
          <i />
        </span>
        <span className="codigo-chat-lenguaje">{etiqueta}</span>
        <button
          type="button"
          className="codigo-chat-copiar"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(texto)
              setCopiado(true)
              setTimeout(() => setCopiado(false), 1800)
            } catch {}
          }}
          aria-label={copiado ? 'Copiado' : `Copiar el código${lenguaje ? ` (${etiqueta})` : ''}`}
        >
          {copiado ? '✓ Copiado' : 'Copiar'}
        </button>
      </div>
      <pre>{children}</pre>
    </div>
  )
}
