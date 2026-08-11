<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Industrias Iberia · Programa de Adopción de IA

## Antes de empezar y antes de terminar

**Lee `BITACORA.md` al abrir la sesión** — dice en qué estado quedó todo y qué está
pendiente. **Añade una entrada al cerrarla**, arriba del todo: qué se construyó, qué se
decidió, qué se corrigió y dónde quedamos. Sin eso, cada sesión reconstruye contexto
desde cero.

El contexto de fondo del encargo está en `CONTEXTO_IBERIA.md`, cargado en el módulo de
archivos del dashboard: contrato, mapa de personas con sus notas de manejo, vocabulario
obligatorio hacia el cliente y reglas de comunicación.

Dashboard interno del programa de adopción de IA que **Boosty Digital** ejecuta para
**Industrias Iberia** (Fase 1 · Entender, 5 meses). Alimenta el entregable de cierre:
el **Documento de Arquitectura de IA**.

## Convenciones

- **Todo en español**: nombres de archivos, funciones, variables, rutas, tipos y
  comentarios. `entrevistas`, no `interviews`.
- **Vocabulario del dominio en `lib/types.ts`**: las claves espejan los `CHECK`
  constraints del schema; los valores son las etiquetas que ve el usuario. Al añadir
  una opción, se cambia en la migración SQL *y* en el mapa correspondiente.
- **Estilos**: primitivas en `@layer components` de `app/globals.css` (`tarjeta`,
  `campo`, `btn-*`, `insignia`, `rotulo`, `prosa`). Tailwind 4 **no** permite
  `@apply` de una clase definida en el mismo layer — las variantes de botón heredan
  la base por selector agrupado.
## Marca

La app va con la identidad de **Industrias Iberia**, no la de Boosty.

- **Rojo Iberia `#D4332C`** — muestreado del máster del logo. Es `acento-500`.
- **Carbón cálido** — es `marca-*`. Un gris frío (el `slate` de Tailwind) apagaba el
  rojo; un azul competía con él. No usar `slate-*`.
- **El rojo es a la vez marca y peligro.** Se distingue por forma, no por tono:
  acción principal = rojo sólido (`.btn-acento`); acción destructiva = rojo
  perfilado sobre blanco (`.btn-peligro`) y siempre con icono. El resaltado de
  búsqueda usa **ámbar**, porque en rojo se leería como error.
- **Assets**: el máster vive en `assets/marca/` (el `.ai` vectorial y el `.jpg`).
  Los PNG que consume la web se generan — no se editan a mano:

  ```
  pwsh scripts/generar-marca.ps1     # requiere Windows (GDI+)
  ```

  Produce `public/marca/iberia.png` (rojo), `iberia-blanco.png` (para el carbón),
  `iberia-onda-blanca.png` y `app/icon.png` (baldosa roja con "IB"). El script
  recorta al trazo, descarta la sombra gris del JPG y reconstruye el alfa.
- El favicon usa **"IB"**, no la onda: la onda tiene relación 8.7:1 y a 16 px se
  convierte en un borrón.

- **Cuidado con los reemplazos masivos de clases**: `translate-` contiene la
  cadena `slate`. Un `slate- → marca-` a ciegas lo rompe.

## Seguridad — no negociable

Todo el contenido es material de Iberia bajo NDA (sección 09 de la propuesta).

- **RLS activo en las 7 tablas.** Nada es legible sin sesión. Al crear una tabla,
  habilitar RLS y escribir sus políticas en la misma migración.
- **Autorización en dos capas**: `lib/auth.ts` (`requerirSesion`, `requerirEditor`,
  `requerirAdmin`) en el servidor, y RLS en la base. Una página nunca confía solo en
  el `proxy.ts`.
- **Roles**: `admin` y `consultor` (Boosty) editan; `lector` (Iberia) solo lee y no ve
  las secciones del informe en borrador.
- **`SUPABASE_SECRET_KEY` bypasea RLS.** Solo en `createAdminClient()`, y solo para
  provisionar usuarios. Nunca para leer datos por cuenta de un usuario.
- **Sin registro abierto**: las cuentas se crean desde `/dashboard/usuarios` o con
  `npm run crear:usuario`.
- **Bucket privado**: se descarga por `app/dashboard/archivos/[id]/descargar/route.ts`,
  que exige sesión y firma una URL de 60 s.
- El binario de un archivo **no pasa por el servidor de Next**: el navegador sube
  directo a Storage y luego una server action registra la metadata.

## Trampas conocidas

- Un módulo `'use server'` solo puede exportar funciones async. Las constantes
  compartidas van aparte — por eso existe `lib/storage.ts`.
- Los tipos de ruta (`PageProps<'/…'>`) se generan: tras añadir una ruta, correr
  `npx next typegen` antes de `tsc --noEmit`.
- Regenerar tipos de base tras cada migración:
  `supabase gen types typescript --project-id <ref> --schema public > lib/database.types.ts`

## Verificación visual — obligatoria

Si el cambio toca la interfaz, **hay que mirarla**. Que compile, que el asset devuelva
200 y que el HTML contenga los marcadores esperados **no** demuestra que se vea bien:
un logo deformado por `align-items: stretch` pasa las tres comprobaciones.

```
npm run capturar -- --password "<clave admin>"        # todas las páginas
npm run capturar -- --password "<clave>" --solo login # iterar sobre una
```

Levanta Chromium, hace login real, recorre las 11 páginas, recorta los detalles que se
juzgan de cerca (los logos), reporta los errores de consola y deja todo en `capturas/`
(ignorada por git). Luego **abrir las imágenes**.

## Comandos

```
npm run dev                 # servidor de desarrollo
npm run tipos               # tsc --noEmit
npm run probar:fireflies    # 50 verificaciones del parser (sin red)
npm run probar:acceso       -- --password "<clave admin>"   # políticas RLS reales
npm run probar:paginas      -- --password "<clave admin>"   # render con sesión real
npm run crear:usuario       -- --email … --password … --rol …
```
