# Qué falta

Todo lo que está sin cerrar, en un solo sitio. Hasta hoy vivía repartido entre la
bitácora, `herramientas.md`, las nueve tablas de producción del guion y
`DESPLIEGUE.md`, y así no se puede llevar a una reunión.

Ordenado por **lo que bloquea**, no por quién lo pidió: es lo que decide en qué orden
hay que empujarlo. Cada cosa dice de quién es.

> **La regla para leer esto:** lo que está en «Bloquea abrir el curso» impide que las
> 200 personas empiecen. Lo demás se puede resolver con el curso ya andando.

---

## 1 · Bloquea abrir el curso

Nada de lo demás importa hasta que estas estén.

| Qué | De quién | Por qué bloquea |
|---|---|---|
| **Saldo en la cuenta de Anthropic** (~$60 para las 200) | **Boosty** | Sin esto Ajito no contesta ningún ejercicio: la respuesta se guarda y sale «No pude contestarte ahorita». El circuito está montado y verificado; falta el crédito. Consola → Plans & Billing |
| **Cuenta de WhatsApp Business + plantilla aprobada** | Martha Fuentes | Es la vía de los 200 enlaces. La plantilla es lo que tarda: Meta no deja escribirle a quien no te ha escrito en 24 h sin una aprobada. Sin ella, los enlaces se copian del panel y se mandan a mano |
| **Padrón real con teléfonos** (~280 personas) | Gustavo Carballo | Hoy hay 17 fichas de muestra. **Sin teléfono no hay enlace**, y sin enlace no hay curso para quien no tiene correo |
| **Lista completa de nombres y cargos** | Gabriel la pidió | Cierra las familias de oficio. Hasta entonces todo lo que bifurca es provisional, y mandarle a la cocinera de pruebas el ejercicio del codificador de frascos es el daño que no podemos causar |
| **Aprobación de la lista de confidencialidad** (lección 7, audio 6) | Milagro Salas · y Martha Fuentes si hay algo escrito | Qué no se le cuenta a una IA de afuera no lo inventamos nosotros |
| **Decidir la retención de las fotos** | Milagro Salas | Propuesta: borrarlas a las 24 h. Hay que decidirlo **antes de grabar la lección 0**, porque el audio lo tiene que decir |
| **Regenerar `AZURE_SPEECH_KEY`** | **Boosty** | Quedó visible en una captura de pantalla. Consola de Azure → Keys and Endpoint → Regenerate Key 1 |
| **Borrar las dos claves legacy de `.env.local`** (líneas `# NEXT_PUBLIC_SUPABASE_ANON_KEY` y `# SUPABASE_SERVICE_ROLE_KEY`) | **Boosty** | Están comentadas y **ningún código las usa**, pero hasta que se apaguen los JWT legacy en Supabase, la de `service_role` es una llave que bypasea la RLS entera, en texto plano, en una carpeta que sincroniza OneDrive. `probar:supabase` falla mientras sigan ahí |
| **Probar la transcripción con audio real de Cagua** | **Boosty** | Lo verificado es voz sintética, que es fácil de entender. Con ruido de planta y acento de verdad puede ser otra cosa — y la transcripción es la puerta del curso |

---

## 2 · Bloquea cerrar el guion (hay que regrabar)

Cada una de estas obliga a volver a grabar al menos un audio, así que conviene juntarlas
y hacer una sola tanda.

| Qué | De quién |
|---|---|
| **La lección 0 no menciona las fotos.** El audio de «lo que se guarda» habla solo de lo que se escribe. Hay que añadirle una línea y regrabarlo | **Boosty**, en cuanto Milagro decida la retención |
| **11 fotos autorizadas** para el audio 5 de la lección 3 | Hay que tomarlas en Cagua con permiso de Calidad. Es lo único del curso que exige ir a planta |
| **Fotos autorizadas de etiquetas y equipos**, para que las ponga Ajito | Milagro Salas / Delina Castro |
| **Qué contesta Ajito a una petición de imagen que no va** (lección 4). Doscientas personas pidiendo dibujos sin nadie mirando, y esa respuesta no está escrita | **Boosty** |
| **Las variantes por oficio de los audios que bifurcan.** Salen de `lib/adiestramiento.ts` y el generador todavía no las toca | **Boosty** |
| **Oír la voz con alguien de planta**, no solo nosotros | **Boosty** |

---

## 3 · Sin decidir todavía

No bloquean nada hoy porque el curso funciona sin ellas, pero hay que resolverlas antes
de dar la Fase 1 por cerrada.

| Qué | Estado |
|---|---|
| **Generador de imágenes** para la lección 4 | Abierto. Candidatos sin probar. Requisitos: menos de 15 segundos, filtro de contenido, barato. Hoy Ajito describe con palabras el dibujo que haría, y lo dice |
| **Transcripción rápida** con un recurso de tipo Speech dedicado | Bajaría lo que sube el trabajador de ~34 MB a ~1 MB por persona. Hoy el endpoint clásico funciona y cuesta datos de su bolsillo |
| **Quién lee las 200 respuestas** a la pregunta grande, cuándo, y qué se le devuelve a la gente | Si se pregunta y nunca se responde nada, la próxima vez que preguntemos algo en esta planta no nos contestan |
| **Aviso a los gerentes**: si se les manda un resumen del avance de su área y cada cuánto | El tablero por área ya existe |
| **Avatares de planta** (operadora de envasado, montacarguista, técnico, despachador) | Martha E. Álvarez y la agencia. Los 18 que mandaron son de oficina |
| **Archivos fuente de Ajito y poses adicionales** (señalando, con una foto, confundido) | La agencia |

---

## 4 · Bloquea el despliegue

Detalle completo en `DESPLIEGUE.md`.

| Qué | De quién |
|---|---|
| **En qué cuenta y plataforma vive la aplicación** | Boosty. Es material de Iberia bajo NDA; no es una decisión técnica |
| **El dominio definitivo** | Boosty. Va **dentro de los 200 enlaces personales**: cambiarlo después obliga a volver a acuñarlos y a mandarlos otra vez. Elegirlo antes del primer envío |

---

## 5 · De la aplicación (código, Boosty)

Nada de esto bloquea abrir el curso.

- **Que los recordatorios lleven el enlace personal**, no el general del curso. El
  mecanismo ya existe en `/dashboard/empleados`; falta enganchar `{enlace}` de
  `recordatorios.md` al token de cada quien.
- **«Guardarlo» y «Mandárselo a alguien»**, los dos botones que el guion pone bajo el
  certificado. Hoy el certificado es una página, no una imagen, así que no se guarda en
  la galería ni se manda por WhatsApp. Pide o un rasterizador en el servidor —dependencia
  nativa— o aceptar que la imagen salga de un lote que corra Boosty. **Es una decisión,
  no un olvido.**
- **Las portadas de lección.** Dentro de la aplicación ya las hace el encabezado; harían
  falta solo si el curso sale por WhatsApp.
- **Borrar `scripts/aplicar-migracion.mjs`**, superado por `npx supabase db push` desde
  que el CLI quedó enlazado.

---

## 6 · Del levantamiento, aparte del curso

- **Identificar hablantes** en SES-002 y SES-005. Sin nombre, lo que se dijo no se puede
  citar en el informe. SES-001, SES-003 y SES-004 están completas.
- **Extraer hallazgos** de las 5 sesiones cargadas. En espera del rodaje de entrevistas,
  por indicación de Gabriel.
- **Registrar los certificados en Capital Humano** — Gustavo Carballo. La aplicación los
  emite y los imprime; que consten en el expediente es acuerdo, no código.
- **Confirmaciones de Iberia**: día del rodaje, nombres de los 9 entrevistados, y la
  tarjeta para las licencias.
- **Desplegar** para que Martha y Luis puedan entrar.

---

## Lo que ya está resuelto y no hay que volver a preguntar

Para que no se repita en la próxima reunión:

- ~~¿Se pueden tomar fotos en la línea?~~ **No.** Ningún ejercicio pide fotografiar el
  área productiva.
- ~~¿La restricción es a la cámara o al teléfono?~~ **Al teléfono en las líneas de
  producción.** Se usa en el salón, el comedor y los demás espacios libres.
- ~~¿Dónde se guardan las fotos?~~ **En Supabase**, bucket privado con RLS. La base es de
  Iberia. Lo que falta es decidir cuánto tiempo, no dónde.
- ~~¿Qué voz?~~ **`es-VE-PaolaNeural` de Azure, a +16%.** Venezolana de fábrica.
- ~~¿Qué modelo?~~ **Claude Opus 5, por la API.** Las licencias de asiento no sirven para
  esto: una licencia es una persona delante de una ventana; esto es un programa llamando
  doscientas veces al día.
- ~~¿Cuánto cuesta?~~ **~$117 en servicios** para las 200 personas: voz, modelo y
  transcripción. El desglose está en `contenido/adiestramiento/herramientas.md`.
