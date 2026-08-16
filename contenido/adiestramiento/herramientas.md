# Herramientas y servicios del adiestramiento

Inventario de lo que hace falta contratar, probar o construir. Se actualiza a
medida que se cierra cada punto. **Cerrado: la voz.** Lo demás sigue abierto.

Estado: `? por verificar` · `~ en prueba` · `✓ cerrado` · `✕ descartado`

---

## 1 · Voz de Ajito (texto a voz)

**Para qué.** Los audios de las lecciones **y** las devoluciones de los ejercicios,
que se generan distintas para cada persona. Tiene que ser la misma voz en ambos
casos, o hay dos Ajitos.

**Requisitos**

- Español del Caribe. El «latino» de fábrica de casi todos es mexicano.
- API, no solo consola web: la mitad del audio se genera en el momento.
- Voz estable entre llamadas — que no cambie de timbre entre una lección y otra.
- Respuesta bajo 3 segundos para las devoluciones.
- Costo por carácter razonable a escala de 200 personas × 9 lecciones.

### Verificado el 16 de agosto de 2026 — gana Azure

| Candidato | Qué se encontró | Estado |
|---|---|---|
| **Azure Speech** | ✅ **Elegido.** Tiene `es-VE` de fábrica: `es-VE-PaolaNeural` (femenina) y `es-VE-SebastianNeural` (masculina). Venezolanas nativas, con la aspiración caribeña y la entonación caraqueña. Es el único proveedor grande que llega a ese nivel de detalle: declara 22 locales de español, país por país. | `✓` |
| **Google Cloud TTS** | Solo **es-ES y es-MX**. Sin ningún caribeño. Descartado por acento. | `✕` |
| **ElevenLabs** | No tiene locale venezolano. Hay una voz de comunidad, «Daniela Valentina», descrita como de acento venezolano, pero es juvenil estilo anime y las voces de comunidad las puede retirar su autor cuando quiera. El acento propio habría que clonarlo de una grabación, y no tenemos a quién grabar. | `✕` |
| **OpenAI TTS** | Sin control de acento. | `✕` |

**La voz es `es-VE-PaolaNeural`.** Femenina, como se decidió, y de la casa.

**La letra chica, que hay que saberla.** `es-VE` se queda en la generación
**estándar**: no tiene las variantes nuevas —Neural HD (`DragonHDLatestNeural`),
Multilingual ni MAI Voice 2—, que Microsoft solo le dio a `es-ES` y `es-MX`.
Tampoco tiene estilos de habla (alegre, empático).

O sea que la elección real era:

- **Paola, es-VE**: acento de la casa, prosodia de generación anterior.
- **es-MX en HD**: mucho más natural y expresiva, y con acento de comercial de
  televisión mexicano.

**Se queda Paola, sin dudarlo.** Para esta gente el acento pesa más que la
prosodia: una voz un poco más plana que suena a Venezuela le gana a una preciosa
que suena a doblaje. Y ya está escrito que el guion hace la mitad del acento.

Lo que sí hay que compensar con **SSML**: bajarle un punto la velocidad
—arranca en 130 palabras por minuto— y meter pausas de verdad entre ideas. Para
quien lee con dificultad y depende del audio, eso no es un detalle.

**Y de paso resuelve el punto 2.** Azure hace también el habla a texto, así que
la transcripción de las notas de voz sale del mismo proveedor, la misma clave y
la misma factura.

### Cerrado el 16 de agosto: Paola a +16%

Se generaron siete muestras del arranque de la lección 0 (88 palabras) con
`npm run probar:voz` y se midió la duración de cada una:

| Muestra | Duración | Palabras/min |
|---|---|---|
| Paola tal cual | 31,8 s | 166 |
| Paola +8% | 29,5 s | 179 |
| Paola +12% | 28,4 s | 186 |
| **Paola +16%** | **27,5 s** | **192** ← elegida |
| Paola +20% | 26,5 s | 199 |
| Sebastián tal cual | 26,4 s | 200 |
| Sebastián +5% | 25,2 s | 210 |

**Sebastián de fábrica y Paola a +20% duran lo mismo.** O sea que Sebastián corre
un 20% más rápido, y eso es lo que se oye —y lo que hacía que Paola pareciera
lenta.

Se quedó en **+16%** y no en el +20% que igualaría a Sebastián: a 199 la voz
queda al nivel de un pódcast de oficina, y quien va a oír esto es alguien
entendiendo por primera vez qué es la IA, en el comedor y con ruido.

> **Corrección.** Antes decía aquí que Paola venía a 130 palabras por minuto. Era
> un dato de una página de terceros y es falso: medida sobre el texto real va a
> 166. No es objetivamente lenta —una narración de audiolibro anda en 150-160—;
> lo que la hace *sentir* lenta es la cadencia, que es justo lo que el porcentaje
> no arregla.

La perilla vive en `lib/voz.ts`. Para volver a medir:

```
npm run probar:voz     # necesita AZURE_SPEECH_KEY y AZURE_SPEECH_REGION
```

### Costo

**16 dólares por millón de caracteres** en voz neural estándar, con 500.000
gratis al mes. Para lo nuestro:

| | Caracteres | Costo |
|---|---|---|
| Los audios de las 9 lecciones, con sus variantes por oficio | ~50.000, una sola vez | menos de 1 $ |
| Las devoluciones generadas: ~30 por persona × 200 personas | ~2.400.000 | ~38 $ |

**La voz del curso completo, para las 200 personas, cuesta unos 40 dólares.** No
es una variable de decisión: se elige por cómo suena y ya.

---

## 2 · Transcripción de notas de voz

**Para qué.** Casi todos los ejercicios se contestan hablando. Hay que oírlos.

**Requisitos**

- Español venezolano de planta, con ruido de fondo y con modismos.
- Confirmación al usuario antes de evaluar — como hace MAIA: *«¿te entendí
  bien?»*. Sin eso, una mala transcripción se convierte en una mala devolución.
- Audios cortos, de 10 a 60 segundos.

### Cerrado el 16 de agosto: Azure, endpoint de audio corto, `es-VE`

Mismo recurso que la voz. **`es-VE` existe también para reconocimiento**, así que
Ajito habla y oye en el mismo acento. Probado de punta a punta contra el recurso
de Iberia con una frase de planta y devolvió «envasado», «codificador» y
«códigos de lote» correctos.

**Pero se usa el endpoint viejo, y eso cuesta datos.** La API de *transcripción
rápida* sería mejor —acepta el WebM comprimido del navegador tal cual, ~50 KB por
minuto— pero contra este recurso devuelve `429 TooManyRequests · Resource
Exhausted` de forma consistente. No es la región: `westus3` la soporta según la
tabla de Microsoft. Lo más probable es el **tipo de recurso**, que es
`AIServices` y no `SpeechServices`.

El endpoint clásico sí funciona, pero solo come **WAV PCM 16 kHz mono**: el
navegador convierte antes de subir (`lib/wav.ts`). Son unos 32 KB por segundo.

| | Por respuesta de 30 s | Por persona, curso completo | Las 200 personas |
|---|---|---|---|
| Hoy, WAV | ~950 KB | ~34 MB | ~6,8 GB |
| Si la rápida funcionara | ~30 KB | ~1 MB | ~0,2 GB |

**Treinta veces menos datos del bolsillo del trabajador.** Vale la pena
intentarlo: crear un recurso de tipo **Speech** (no AIServices) y reintentar la
API rápida. Si funciona, se cambia `lib/transcribir.ts` y el grabador deja de
convertir. `?`

| Alternativa | Nota | Estado |
|---|---|---|
| **Whisper (OpenAI)** | Acepta formatos comprimidos y es muy bueno con acentos. Sería la salida si lo del recurso de Speech no prospera — a costa de meter un segundo proveedor. | `?` |
| **Deepgram** | Rápido y barato. Sin probar. | `?` |

**Límite duro:** el endpoint corta en **60 segundos**, y por eso el grabador
también. La pregunta de campo de la lección 7 —la mejor del curso— pide contar
con calma; hay que vigilar que un minuto alcance.

---

## 3 · El modelo (devoluciones, lectura de fotos, asistente libre)

**Para qué.** Evaluar lo que la persona manda, leer las fotos, y —si se enciende
el interruptor— responder cualquier cosa.

**Requisitos**

- **Visión.** Tiene que leer letra chiquita de etiquetas, con mala luz y en
  ángulo. Es el requisito más exigente de todo el curso.
- Buen español y capacidad de sostener el personaje de Ajito.
- Barandas: 200 personas escribiendo sin supervisión.

### Cerrado el 16 de agosto: Claude Opus 5 por la API

**Es Claude.** Iberia ya está contratando licencias corporativas para las
formaciones, pero esto no va por ahí: **las licencias de asiento no sirven para
lo que hace el curso.** Una licencia es una persona sentada delante de una
ventana de chat; aquí lo que hay es un programa que llama al modelo doscientas
veces al día sin nadie delante. Eso es la API y se factura aparte. ⚠️ Hay que
decirlo en la próxima reunión, que es la clase de renglón que se descubre tarde.

**El modelo es `claude-opus-5`** y la perilla está en `lib/ajito.ts`, en
`MODELO`. La visión es el requisito duro del curso —leer la letra chiquita de la
etiqueta de un frasco, con mala luz y en ángulo, que es la lección 3— y es donde
el escalón entre modelos se nota.

**El esfuerzo está en `medium`, y no es lo barato.** `low` responde más rápido y
cuesta menos, pero la devolución tiene que respetar quince reglas a la vez y las
que fallan son caras: hablar del cuerpo de alguien en la lección 3, opinar del
pasaje de alguien en la 6, o acertar en la 7 —donde acertar **es** el fracaso—.
Se baja a `low` cuando haya devoluciones reales que comparar, no antes.

**El personaje está en `lib/ajito.ts`, no en el guion.** Son las mismas reglas de
`00-reglas-del-guion.md`, traducidas a instrucción: si una cambia allá, cambia
aquí. La persona no distingue —ni tiene por qué— qué salió grabado y qué salió
del modelo.

**Y cada ejercicio lleva su propia instrucción.** No es un «evalúa esto» genérico:
en la 2 hay que devolver ordenado lo que la persona contó revuelto, en la 6 hay
que sacar la cuenta y callarse la opinión, en la 7 hay que decir que no se sabe.
Eso está escrito ejercicio por ejercicio en el mapa `INSTRUCCION`.

### Cómo se comprueba

```
npm run probar:ajito                 # los 8 casos con más filo
npm run probar:ajito -- --caso plata # uno solo, para iterar
```

Crea un trabajador de prueba por caso, le mete una respuesta escrita como
contestaría alguien de planta —sin tildes, con la frase cortada— y pide la
devolución por el mismo camino que la pediría el teléfono. Después **imprime lo
que contestó**, que es la verificación de verdad, y le pasa por encima lo que se
puede comprobar a máquina: el largo, el vocabulario prohibido, el inglés, el
género, el marcado de Markdown, y lo propio de cada caso.

Los números del caso `numeros` están puestos para poder revisar la cuenta a mano:
suman 1.000 y el promedio es 200 clavado.

### Costo

Con la respuesta escrita y el guion, una devolución ronda los 1.500 tokens de
entrada y 150 de salida — unos **0,4 centavos**. Una foto pesa mucho más: hasta
4.800 tokens, unos **2,7 centavos** con su devolución.

| | Por persona | Por 200 |
|---|---|---|
| ~24 devoluciones de texto o voz | $0,10 | **$20** |
| 6 devoluciones con foto | $0,16 | **$32** |
| | | **~$52** |

Súmale los ~$40 de la voz y el curso completo sale por **unos 90 dólares de
servicios**. Es un renglón chico al lado de las horas de la gente, y conviene
tenerlo dicho antes de que alguien lo pregunte.

⚠️ **Falta la clave.** `ANTHROPIC_API_KEY` está vacía en `.env.local`. Sin ella
todo el circuito funciona menos el modelo: la respuesta se guarda, y donde iría
la devolución sale «No pude contestarte ahorita» con su botón. El día que entre
la clave, `npm run probar:ajito` dice en un minuto si Ajito habla como Ajito.

---

## 4 · Generación de imágenes (lección 4)

**Para qué.** Que Ajito dibuje lo que le pidan.

**Requisitos**

- Rápido. Si tarda más de 15 segundos, la lección se cae.
- **Filtro de contenido.** Doscientas personas pidiendo dibujos sin nadie mirando.
  Hay que decidir qué hace Ajito cuando le piden algo que no va — y escribir esa
  respuesta en el guion, que hoy no está.
- Barato: dos imágenes por persona como mínimo.

| Candidato | Estado |
|---|---|
| Generador de imágenes de OpenAI | `?` |
| Nano Banana (Google) | `?` |
| Flux | `?` |

---

## 5 · Video

La animación de bienvenida **ya existe** (`media1.mp4`, 2,5 MB). Si hacen falta
más clips de Ajito, lo natural es pedírselos a la agencia y no generarlos: la
consistencia del personaje pesa más que el ahorro. `?`

---

## 6 · Piezas gráficas

Portadas de lección y fichas de bolsillo **se generan por script**, como ya
hacemos con la marca en `scripts/generar-marca.ps1`. No hace falta herramienta
externa. Lo que sí hace falta es que la agencia mande los archivos fuente de
Ajito y algunas poses más. `?`

---

## 7 · Entrega

| | Nota | Estado |
|---|---|---|
| **WhatsApp Business Cloud API** (Meta) | Iberia ya tiene una línea con todo el personal cargado. Falta la cuenta de Business API propiamente. Costo por conversación. | `?` |
| **Azure AI Speech** | Recurso `industriasiberiait-9652-resource`, región `westus3`, nivel **S0**. Ya existía en la cuenta de Iberia — no hizo falta crearlo. Sirve para voz y para transcripción. | `✓` |
| **El canal** | Ya construido. Cero costo por mensaje, sesión y padrón resueltos, RLS puesta. | `✓` |

La decisión de dónde vive el curso sigue abierta. Mi lectura no ha cambiado: el
contenido en el canal, WhatsApp solo de timbre.

---

## 8 · Almacenamiento de las fotos

Vamos a recibir alrededor de **cuatrocientas fotos de personas**: la de cada
quien y la de un compañero.

**Resuelto:** la base es de Iberia, así que las fotos se quedan. Van a Supabase
Storage en bucket privado con RLS, como los archivos del dashboard — nunca
públicas, nunca legibles por otro empleado.

Lo que sigue en pie es que **la lección 0 lo diga**: hoy el audio de «lo que se
guarda» habla de lo que se escribe y no menciona las fotos. Hay que añadirle una
línea antes de grabar.

---

## 9 · Costos

Lo cerrado, para las 200 personas:

| | |
|---|---|
| Voz de las nueve lecciones (una vez) | ~$0 · 45.000 caracteres, dentro del gratis |
| Voz de las devoluciones (~30 por persona) | **~$40** |
| Modelo, devoluciones de texto y voz | **~$20** |
| Modelo, devoluciones con foto | **~$32** |
| Transcripción de las notas de voz | ~$25 · el detalle en la sección 2 |
| | **~$117** |

Lo que falta por estimar:

- Imágenes generadas: 2 por persona como mínimo. Sección 4, todavía abierta.
- Mensajes de WhatsApp, si el curso corre por ahí. Sección 7.
- Almacenamiento de las fotos y los audios. Sección 8.
