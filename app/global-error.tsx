'use client'

import './globals.css'
import { PantallaDeError } from './error'

/**
 * Cuando falla el layout raíz, Next reemplaza el documento entero: esta pantalla
 * trae su propio `<html>` y `<body>`. Es la misma de `app/error.tsx`.
 */
export default function ErrorGlobal({
  error,
  retry,
}: {
  error: Error & { digest?: string }
  retry: () => void
}) {
  return (
    <html lang="es">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <title>No se pudo cargar · Iberia</title>
      </head>
      <body>
        <PantallaDeError error={error} retry={retry} />
      </body>
    </html>
  )
}
