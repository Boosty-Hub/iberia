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
| **Próximo entregable de software** | App de comunicación interna (a la espera de indicación de Gabriel) |
| **Repositorio** | `Boosty-Hub/iberia` — privado |

### Pendiente inmediato

- **Identificar hablantes** en SES-002 y SES-005. Sin nombre, lo que se dijo no se
  puede citar en el informe. SES-001, SES-003 y SES-004 ya están completas.
- **Extraer hallazgos** de las 5 sesiones cargadas.
- Confirmación de Iberia: día del rodaje, nombres de los 9 entrevistados, tarjeta para
  las licencias.
- Desplegar el dashboard para que Martha y Luis puedan entrar.

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
