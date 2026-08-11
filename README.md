# Industrias Iberia · Programa de Adopción de IA

Dashboard interno del programa que **Boosty Digital** ejecuta para **Industrias Iberia**.
Cubre la **Fase 1 · Entender** (5 meses) y alimenta su entregable de cierre: el
**Documento de Arquitectura de IA** con el que el comité gerencial decide la Fase 2.

> Todo el contenido es información confidencial de Industrias Iberia, bajo acuerdo de
> confidencialidad. Ninguna ruta se sirve sin sesión válida, y el sitio no se indexa.

## Qué hay dentro

| Módulo | Ruta | Para qué |
| --- | --- | --- |
| **Panel** | `/dashboard` | Avance del diagnóstico: entrevistas por estado, hallazgos, archivos, informe. |
| **Entrevistas** | `/dashboard/entrevistas` | Las ~25 entrevistas de la Corriente B, con importador de transcripciones de Fireflies, búsqueda dentro de lo dicho y marcado de citas. |
| **Archivos** | `/dashboard/archivos` | Inventario de sistemas y datos: documentos en bucket privado con descarga firmada. |
| **Hallazgos** | `/dashboard/hallazgos` | Cuellos de botella, trabajo manual, datos disponibles y oportunidades de IA — cada uno con la cita que lo respalda. Es el puente entre las entrevistas y la arquitectura. |
| **Editor del informe** | `/dashboard/informe` | Redacción del informe sección por sección, en markdown con vista previa. |
| **Informe** | `/informe` | El documento que lee el comité. Página aparte del admin, pero igualmente autenticada. |
| **Usuarios** | `/dashboard/usuarios` | Provisión de accesos y roles (solo administradores). |

## Puesta en marcha

```bash
npm install
npm run dev          # http://localhost:3000
```

Las variables ya están en `.env.local` (no se commitea). Lo único pendiente es
`ANTHROPIC_API_KEY`, que solo hace falta cuando se active la síntesis asistida del
levantamiento; nada más depende de ella.

### Crear el primer acceso

```bash
npm run crear:usuario -- \
  --email nombre@empresa.com --password "mínimo 10 caracteres" \
  --nombre "Nombre Apellido" --cargo "Cargo" --rol admin --org boosty
```

No hay registro abierto: las cuentas se provisionan desde aquí o desde
`/dashboard/usuarios`.

## Roles

| Rol | Organización | Puede |
| --- | --- | --- |
| `admin` | Boosty | Todo, incluida la gestión de usuarios. |
| `consultor` | Boosty | Editar entrevistas, archivos, hallazgos e informe. |
| `lector` | Iberia | Leer el levantamiento y **solo las secciones publicadas** del informe. |

## Cargar entrevistas desde Fireflies

**El camino normal es no escribir nada.** En `/dashboard/entrevistas/importar` sueltas
uno o varios archivos de Fireflies (`.json` o `.md`) y el sistema arma cada entrevista:

| Dato | De dónde sale |
| --- | --- |
| Entrevistado | El hablante que **más habla**: en una entrevista, quien responde habla más que quien pregunta. |
| Entrevistador | El segundo que más habla. |
| Cargo | Del título de la reunión, si nombra un rol. |
| Área | Del título (y si no, del resumen), emparejando contra las áreas de Iberia. |
| Sede | Menciones a Cagua / planta / Caracas / remoto. |
| Fecha y duración | Metadatos del archivo. |
| Resumen, compromisos, palabras clave | Del bloque de resumen de Fireflies. |
| Código | Consecutivo automático (ENT-001…). |

Todo se muestra antes de guardar y se puede corregir; si el entrevistado detectado no
es el correcto, un clic en el chip del otro hablante lo cambia. En
`ejemplos/fireflies/` hay dos archivos de muestra para probar el flujo.

También se puede importar la transcripción a una entrevista que ya exista, desde su
detalle, o pegar el texto a mano. En todos los casos el archivo se lee y se interpreta
**en el navegador**: al servidor solo viaja la transcripción ya estructurada.

El parser (`lib/fireflies.ts`) reconoce los formatos de hablante habituales
(`**Nombre** 00:12`, `[00:12] Nombre:`, `Nombre (00:12):`, `Nombre: texto`), extrae
resumen, compromisos, palabras clave, participantes y duración, y **avisa** cuando algo
no se pudo interpretar en lugar de fallar en silencio. Importar de nuevo reemplaza la
transcripción anterior.

## Marca

La app lleva la identidad de Industrias Iberia: rojo **`#D4332C`**, muestreado del
máster del logo, sobre un carbón cálido que lo hace destacar.

El máster está en `assets/marca/` (`.ai` vectorial + `.jpg`). Los PNG que consume la
web se generan, no se editan:

```bash
pwsh scripts/generar-marca.ps1     # requiere Windows
```

Como el rojo es a la vez color de marca y señal de peligro, se distinguen por forma:
**crear** es un botón rojo sólido, **eliminar** es rojo perfilado sobre blanco y con
icono de papelera. El resaltado de búsqueda va en ámbar.

## Arquitectura

- **Next.js 16** (App Router, Turbopack) · **React 19** · **Tailwind 4** · TypeScript estricto.
- **Supabase**: Postgres con RLS, Auth por email/contraseña y Storage privado.
- `proxy.ts` refresca la sesión y bloquea rutas sin autenticar. Cada página vuelve a
  comprobar permisos en el servidor con `lib/auth.ts`: la autorización nunca depende de
  una sola capa.
- **RLS activo en las 7 tablas** — es la última línea de defensa, no un adorno.
- El schema vive en `supabase/migrations/`. Tras cambiarlo, regenerar los tipos:

  ```bash
  supabase gen types typescript --project-id <ref> --schema public > lib/database.types.ts
  ```

## Si el navegador muestra «HTTP ERROR 431»

Las cookies de `localhost` se comparten entre **todos los puertos**, así que en una
máquina con varios proyectos locales la cabecera `Cookie` supera los 16 KB que Node
acepta por defecto y el navegador recibe un 431 *antes* de que la app se ejecute.

`npm run dev` y `npm run start` pasan por `scripts/servidor.mjs`, que sube el límite a
64 KB, así que no debería ocurrir. Si aun así aparece:

1. Limpia las cookies de `localhost` en el navegador (DevTools → Application →
   Cookies → `http://localhost:3000` → borrar todo). Es la causa de fondo.
2. Como atajo inmediato, abre **`http://127.0.0.1:3000`**: para el navegador es otro
   host y usa un frasco de cookies distinto, sin la basura acumulada.

## Pruebas

```bash
npm run tipos                 # tsc --noEmit
npm run probar:fireflies      # 50 verificaciones del parser, sin red
npm run probar:derivacion     # 26 verificaciones de la deducción de datos, sin red
npm run probar:acceso      -- --password "<clave>"   # 20 · políticas RLS reales
npm run probar:paginas     -- --password "<clave>"   # 16 · render y descargas con sesión
npm run probar:importacion -- --password "<clave>"   # 23 · importación completa por el navegador
npm run capturar           -- --password "<clave>"   # capturas de todas las páginas
```

`probar:importacion` es de extremo a extremo: abre Chromium, entra con usuario y
contraseña, sube los archivos de `ejemplos/fireflies/`, comprueba que los datos
deducidos aparecen en el formulario, crea las entrevistas, verifica en base que
quedaron completas (transcripción incluida) y **borra lo que creó**. Con `--conservar`
las deja para poder mirarlas en la app.

`probar:acceso` comprueba las tres identidades (anónimo, lector, admin) contra el
proyecto real: crea un lector y una entrevista temporales, verifica que el lector no
escribe ni ve borradores, y limpia lo que creó. `probar:paginas` necesita el servidor
de desarrollo corriendo.
