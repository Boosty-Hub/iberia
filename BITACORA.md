# Bitácora del proyecto

Registro de lo ejecutado en cada sesión de trabajo, para saber en la siguiente dónde
quedamos. **Se actualiza al cierre de cada sesión, añadiendo la entrada más reciente
arriba.**

Contexto de fondo: `CONTEXTO_IBERIA.md` (cargado en el módulo de archivos del
dashboard) y `AGENTS.md` para las convenciones técnicas.

---

## Estado actual

| | |
|---|---|
| **Fase** | 1 · Entender (5 meses en firme, arrancó tras la firma del 4 de agosto de 2026) |
| **Dashboard** | Operativo en local. Sin desplegar. |
| **Sesiones cargadas** | 5 (2 del comité del 9 de julio, 3 de la visita a Cagua del 5 de agosto) |
| **Entrevistas** | 9 programadas para la semana del 18 de agosto, en Cagua |
| **Hallazgos** | 0 — pendiente de extraer del material ya cargado |
| **Informe** | 21 secciones estructuradas, todas vacías |
| **Canal de comunicación** | Primera versión funcionando en local: feed, directorio, mensajes, grupos, avisos, perfil y consola de publicación |
| **Repositorio** | `Boosty-Hub/iberia` — privado |

### Pendiente inmediato

- **Identificar hablantes** en SES-002 y SES-005. Sin nombre, lo que se dijo no se
  puede citar en el informe. SES-001, SES-003 y SES-004 ya están completas.
- **Extraer hallazgos** de las 5 sesiones cargadas. En espera del rodaje de entrevistas,
  por indicación de Gabriel.
- **Padrón real** de las ~280 personas, de Capital Humano: hoy hay 17 fichas de muestra.
- **Cuenta de WhatsApp Business** de Iberia, para el envío masivo del enlace personal.
- Confirmación de Iberia: día del rodaje, nombres de los 9 entrevistados, tarjeta para
  las licencias.
- Desplegar el dashboard y el canal para que Martha y Luis puedan entrar.

---

## 11 de agosto de 2026 · Sesión 2

Primera versión del **canal de comunicación interna**, pensado desde el teléfono: es
donde lo va a abrir la mayoría de las 280 personas, y donde el personal de planta lo va
a abrir siempre.

**Construido**

- Esquema del canal con RLS completa: `empleados` (el padrón, con nivel y tipo de
  nómina), `publicaciones`, `publicacion_lecturas`, `accesos`, `conexiones`, `grupos`,
  `grupo_miembros`, `conversaciones`, `conversacion_participantes`, `mensajes`,
  `comentarios` y `reacciones`.
- Identidad propia del canal, tomada del demo que gustó: fondo claro, tarjetas
  redondeadas, el rojo de Iberia y el amarillo como segundo acento. Tipografía DM Sans
  autoalojada, sin llamadas a Google en producción.
- Concha móvil: cabecera discreta, navegación fija al pie con cinco destinos y objetivo
  táctil de 44 px en todo lo que se toca.
- **Inicio** — feed segmentado por audiencia: cada quien ve lo suyo según nivel y área,
  y el comunicado oficial se distingue por una banda dorada.
- **Gente** — directorio de toda la organización, agrupado por nivel, con buscador.
- **Mensajes** — conversaciones directas, con contador de no leídos.
- **Grupos** — creación, incorporación a los abiertos y conversación por grupo.
- **Avisos** — solicitudes de conexión y comunicados oficiales con marca de lectura.
- **Yo** — ficha propia, conexiones y salida de sesión.
- **Publicar** — consola de publicación con segmentación de audiencia y el sello de
  oficial reservado a la dirección y a quien modera.
- `scripts/probar-canal.mjs` (21 comprobaciones contra la base real, con sesión de
  empleado y no con clave de servicio) y `scripts/capturar-canal.mjs` (recorre el canal
  en un iPhone 14 y mide desbordes y objetivos táctiles).
- 17 fichas de muestra sembradas, incluidos perfiles de planta: es el caso difícil del
  diseño y había que poder verlo.

**Decisiones**

- **Conectar antes de conversar, pero solo entre pares.** Entre niveles vecinos se
  solicita conexión y la otra persona acepta. Hacia arriba —a dos niveles o más— se
  escribe directo, sin solicitud: nadie de planta queda expuesto a que la dirección le
  rechace una solicitud dentro de su propia empresa.
- **El enlace de WhatsApp es la credencial.** El personal de planta no tiene correo
  corporativo. Se guarda el hash del token, nunca el token en claro.
- **Un grupo es una conversación con nombre y propósito**, no un módulo aparte: reusa el
  mismo hilo y la misma pantalla.
- **La lectura se registra.** Hasta ahora el comunicado salía por correo y cartelera sin
  saber quién lo leía; ahora el alcance es un dato.
- Un comentario oculto por moderación **sigue siendo visible para quien lo escribió**.
  Requerimiento explícito de la Gerencia General: se prefiere saber que alguien está
  molesto a suponer que todo va bien.

**Corregido**

- **Recursión infinita en RLS.** Las políticas de `conversacion_participantes` y
  `grupo_miembros` se preguntaban por sí mismas, y Postgres las cortaba con
  «infinite recursion detected in policy». El síntoma era mudo: tocar «Escribir» en el
  directorio no hacía nada. Resuelto sacando la pregunta a funciones
  `security definer` (`participo_en`, `soy_miembro`, `coordino_grupo`,
  `cabe_otro_participante`).
- **`.select()` después de un `insert` bajo RLS.** Al crear una conversación todavía no
  se participa en ella, así que el `RETURNING` volvía vacío y la acción moría en
  silencio. Ahora el id se genera en el servidor antes de insertar.
- Objetivos táctiles por debajo de 44 px (logo de la cabecera, enlaces de volver) y
  nombres recortados en el directorio: «Alberto García-Ra…» no le sirve a nadie.

**Unificado**

El estilo del canal se adoptó como el del producto entero, por indicación de Gabriel.
DM Sans en todas partes, fondo claro, tarjetas `rounded-2xl` con una sola sombra. Las
superficies oscuras desaparecieron: la barra lateral del panel, el login y el pie del
informe ahora son claros, y el informe se lee como una hoja blanca sobre la mesa. El
carbón queda para el texto y para la acción secundaria de peso.

**Dónde quedamos**

El canal funciona de extremo a extremo en local y está verificado por vista en teléfono.
Falta el padrón real de Capital Humano y la cuenta de WhatsApp Business para el envío
masivo; hasta entonces, lo que se publica se ve dentro del canal.

---

## 11 de agosto de 2026 · Sesión 1

Primera sesión de construcción. Se levantó el dashboard completo desde cero.

**Construido**

- Proyecto Next.js 16 + React 19 + Tailwind 4 + TypeScript sobre Supabase.
- Schema con RLS en todas las tablas: perfiles y roles, áreas, sesiones,
  transcripciones, hallazgos, archivos y secciones del informe.
- Autenticación con correo y contraseña, tres roles (admin, consultor, lector) y
  provisión de usuarios sin registro abierto.
- **Parser de Fireflies** (`lib/fireflies.ts`): interpreta el export en Markdown y en
  JSON, con los cuatro formatos de marca de hablante. 50 verificaciones.
- **Importador de entrevistas**: se sueltan los archivos y el sistema deduce
  entrevistado, cargo, área, sede, fecha, duración y resumen. El archivo se lee en el
  navegador; al servidor solo viaja la transcripción interpretada.
- Módulos de archivos (bucket privado, descarga por enlace firmado), hallazgos e
  informe con editor markdown.
- Rebranding completo a la identidad de Iberia: rojo `#D4332C` sobre carbón cálido,
  con los assets generados desde el máster del logo.
- Suites de verificación: parser, deducción, RLS reales, render de páginas con sesión,
  importación de extremo a extremo por navegador.
- Generador de PDF para entregables (`scripts/generar-pdf.mjs`).

**Cargado**

- 5 sesiones con 4.484 turnos de transcripción.
- 2 organigramas (documento II-21-14-008).
- `CONTEXTO_IBERIA.md`.

**Decisiones**

- Las transcripciones vienen de Fireflies; no se transcribe audio en la app.
- Acceso por correo y contraseña, sin registro abierto.
- El informe es una página aparte del admin, pero exige sesión.
- El informe es un **levantamiento que conduce a la arquitectura**, no un documento de
  arquitectura suelto. 21 secciones.
- Organigrama real cargado como jerarquía de áreas (39 nodos).
- Las sesiones grupales y las entrevistas 1:1 conviven con series de código separadas
  (`SES-` y `ENT-`), para medir el avance contra la meta de ~25 entrevistas.

**Corregido**

- Tres apellidos que Fireflies transcribió por sonido: Flaviano **Tucci** (no Fuchi),
  Gustavo **Carballo** (no Carvallo), **Martha** Fuentes (no Marta). 536 turnos
  reatribuidos.
- Luis Daniel **Agostini** (no Agustín). 25 turnos.
- SES-004: Fireflies partió a Flaviano Tucci en dos etiquetas. Fusionadas — 187 turnos
  más, con lo que el recorrido de planta completo (línea de mayonesa, molino,
  laboratorio, envasado) queda atribuible y citable.

**Entregado**

- `documentos/2026-08-primer-rodaje-y-formacion.pdf` — propuesta de agenda para la
  semana del 18 de agosto: 9 entrevistas en Cagua en dos pistas y la formación
  dirigente de 3 horas en Caracas.

**Dónde quedamos**

Esperando que Iberia elija el día del rodaje y confirme los nombres. El siguiente paso
de construcción es la app de comunicación interna, cuando Gabriel lo indique.
