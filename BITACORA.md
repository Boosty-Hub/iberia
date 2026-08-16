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
| **Adiestramiento** | Guion de las 9 lecciones escrito y grabado (70 audios, 21m40s), 10 fichas de bolsillo y el certificado. Módulo en pie con RLS verificada. Ajito ya contesta: falta saldo en la cuenta de Anthropic para verlo hablar |
| **Padrón** | Módulo de empleados con enrolamiento masivo y enlace personal por WhatsApp. 17 fichas de muestra a la espera del padrón real |
| **Repositorio** | `Boosty-Hub/iberia` — privado |

### Pendiente inmediato

- **Identificar hablantes** en SES-002 y SES-005. Sin nombre, lo que se dijo no se
  puede citar en el informe. SES-001, SES-003 y SES-004 ya están completas.
- **Extraer hallazgos** de las 5 sesiones cargadas. En espera del rodaje de entrevistas,
  por indicación de Gabriel.
- **Padrón real** de las ~280 personas, de Capital Humano: hoy hay 17 fichas de muestra.
- **Cuenta de WhatsApp Business** de Iberia — Martha Fuentes. Todo lo demás está listo:
  la conexión se pega en `/dashboard/adiestramiento/recordatorios` y se enciende un
  interruptor. Hay que pedir también la **aprobación de la plantilla** de recordatorio,
  que es lo que suele tardar. Mientras tanto los mensajes se copian y se mandan a mano.
- **Que los recordatorios lleven el enlace personal**, no el del curso. El mecanismo ya
  existe (`/dashboard/empleados`); falta enganchar `{enlace}` de `recordatorios.md` al
  token de cada quien en vez de a la URL general.
- **Lista completa de nombres y cargos** del personal — Gabriel la pidió. Cierra las
  familias de oficio del adiestramiento; hasta entonces todo lo que bifurca es
  provisional.
- **Avatares de planta** a Martica: operadora de envasado, montacarguista, técnico,
  despachador. Los 18 que mandó la agencia son de oficina.
- **Probar la transcripción con audio real de Cagua**, con ruido y acento de planta —no
  con la voz sintética, que es fácil de entender.
- **Intentar la API de transcripción rápida** con un recurso de tipo Speech: bajaría los
  datos que sube el trabajador de ~34 MB a ~1 MB por persona.
- **Crédito en la cuenta de Anthropic.** La clave ya está puesta y sirve; lo que falta es
  saldo (`Your credit balance is too low`). Consola de Anthropic → **Plans & Billing**. Es
  lo único que separa a Ajito de contestar: el circuito está montado y verificado menos
  la llamada al modelo. Con unos **$60** sobra para las 200 personas del curso completo.
  **Va por la API, no por las licencias de asiento** que Iberia está contratando para las
  formaciones: una licencia es una persona delante de una ventana; esto es un programa
  llamando doscientas veces al día. Hay que decirlo en la próxima reunión.
- **Registrar los certificados en Capital Humano** — con Gustavo Carballo. La aplicación
  los emite y los imprime; que consten en el expediente de cada quien es acuerdo, no
  código.
- **Las portadas de lección.** Dentro de la aplicación ya las hace el encabezado; harían
  falta si el curso sale por WhatsApp.
- **«Guardarlo» y «Mandárselo a alguien»**, los dos botones que el guion pone bajo el
  certificado. Hoy el certificado es una página, no una imagen, así que no se guarda en
  la galería ni se manda por WhatsApp. Hacerlo pide un rasterizador en el servidor
  —dependencia nativa— o aceptar que la imagen salga de un lote que corra Boosty. Es una
  decisión, no un olvido.
- **Las variantes por oficio de los audios que bifurcan.** Salen de
  `lib/adiestramiento.ts`, no del guion, y el generador todavía no las toca.
- **Regenerar la clave de Azure Speech** cuando se termine de configurar: quedó
  visible en una captura de pantalla.
- Confirmación de Iberia: día del rodaje, nombres de los 9 entrevistados, tarjeta para
  las licencias.
- Desplegar el dashboard y el canal para que Martha y Luis puedan entrar.

---

## 16 de agosto de 2026 · Sesión 5

**Que Ajito conteste.** Hasta esta sesión Ajito era un guion grabado: decía lo mismo a
las doscientas personas. Ahora contesta lo que cada quien le manda, con su voz, y esa
es la mitad del curso que no se puede grabar por adelantado. Sin esto el
adiestramiento es un video largo; con esto, la persona **vive una vez** lo que las
nueve lecciones le están explicando.

**Construido**

- **`lib/ajito.ts` — el personaje.** Las reglas de `00-reglas-del-guion.md` traducidas a
  instrucción para el modelo: tuteo venezolano, frases cortas, sin género para sí mismo
  ni para la persona, sin adular, sin inglés, sin el vocabulario que en una planta
  anuncia despidos (automatización, optimizar, monitorear, sustituir). Y la rúbrica
  hablada: qué hiciste, qué te faltó —una sola cosa, nunca «mal»— y cómo se ve mejor,
  que Ajito **hace** en vez de explicar.
- **Una instrucción propia por ejercicio**, que es donde está la pedagogía y no en la
  regla general. En la lección 2 hay que devolver ordenado en pasos lo que la persona
  contó revuelto; en la 3, describir una foto sin decir una palabra del cuerpo de nadie;
  en la 6, sacar la cuenta del pasaje y **callarse la opinión sobre la plata**; y en la 7
  decir «no sé», el único ejercicio del curso donde acertar sería el fracaso — porque la
  lección enseña que la IA inventa cuando no sabe, y se enseña dejándose pillar.
- **`lib/hablar.ts`** pone a hablar la devolución con la misma `es-VE-PaolaNeural` a +16%
  de las nueve lecciones. Si la clase la dijera una voz y la devolución otra, habría dos
  Ajitos y se notaría en la primera lección.
- **La ruta `…/devolver`**, idempotente, y `…/devolucion/[clave]` para servir el mp3. El
  audio va al bucket de la persona: una devolución habla de lo que ella contestó, así
  que hereda la misma promesa que la respuesta —la oye quien la provocó y nadie más—.
- **Migración `…_devolucion.sql`**: `devolucion_audio` y `devolucion_en`.
- **`npm run probar:ajito`**: crea un trabajador de prueba por caso, le mete una
  respuesta escrita como contestaría alguien de planta —sin tildes, con la frase
  cortada—, pide la devolución por el mismo camino que la pediría el teléfono e
  **imprime lo que contestó**. Ocho casos, elegidos por dónde duele: la cuenta del
  pasaje, el «pillame» de la 7, la crítica al curso en la 8.

**Decidido**

- **El modelo es `claude-opus-5` y va por la API.** La visión es el requisito duro —leer
  la letra chiquita de la etiqueta de un frasco, con mala luz y en ángulo— y es donde el
  escalón entre modelos se nota. Esfuerzo en `medium`, no en `low`: la devolución es
  corta pero respeta quince reglas a la vez, y las que fallan son caras.
- **Las licencias corporativas no sirven para esto**, y conviene decirlo antes de que
  aparezca en una factura. Está anotado en `herramientas.md`.
- **El curso completo sale por unos 90 dólares de servicios** para las 200 personas: ~$40
  de voz, ~$52 de modelo. Las fotos son el renglón caro —hasta 4.800 tokens cada una—.

**Corregido, y salió de mirar la captura**

- **La lección 3 disparaba cuatro llamadas al modelo de golpe**, con sus cuatro fotos, al
  abrirse con respuestas viejas sin contestar. En una conexión de planta se caen las
  cuatro juntas. Ahora **solo pide una a la vez**, la primera a la que le falte, y se van
  llenando de arriba abajo.
- **Y una que fallara dejaba la cola atascada detrás suyo**, congelando el resto de la
  lección. Ahora queda marcada con `devolucion_en` sin texto, sale de la cola, enseña su
  botón de reintentar y las demás siguen.

**Verificado**

`tipos` y `eslint` limpios. `capturar:adiestramiento` recorre el curso completo en
iPhone 14 sin desbordes ni objetivos táctiles chicos, y las capturas se abrieron: la
respuesta de la persona sale citada con su filete gris y debajo va lo de Ajito.

**Lo que no se pudo verificar, y es lo importante:** Gabriel puso la clave a media
sesión y la llamada siguió fallando. No era la clave: **la cuenta de Anthropic no tiene
crédito** (`Your credit balance is too low`). Así que **nadie ha leído todavía una
devolución de Ajito**. El circuito entero está probado menos la llamada al modelo — y ni
siquiera se puede comprobar que la petición esté bien armada, porque el cobro se verifica
**antes** que el cuerpo: con tres cuerpos distintos, uno de ellos inválido a propósito,
la API devolvió el mismo error de saldo. En cuanto haya crédito, `npm run probar:ajito`
lo dice en un minuto.

De ese rato salió una mejora: **los fallos ahora se clasifican** —`sin-saldo`,
`sin-permiso`, `ocupado`, `sin-configurar`, `fallo`— porque cada uno se arregla en un
sitio distinto y la diferencia se paga en horas. Con «fallo» a secas se perdió una hora
buscando en el código lo que estaba en la consola de facturación.

Y con eso se corrigió algo peor: **un fallo por saldo o por red no debe marcar la
respuesta como intentada**. Solo se marca cuando el problema es de esa respuesta. Si el
problema es del servicio, le pasa igual a las doscientas, así que la cola se para sola y
el día que se arregle se recuperan todas sin que nadie toque un botón. Con la versión
anterior, todas las respuestas de estas pruebas habrían quedado fuera de la cola para
siempre.

### Las fichas de bolsillo

Los bloques 🖼 del guion llevaban desde el principio sin dibujar nada. Ya están las
**diez fichas** —una por lección y dos para la 8, según el interruptor—: verticales,
1080×1920, para guardar en la galería del teléfono y volver a mirarlas en el bus dos
semanas después.

- **Salen del guion**, como los audios: el texto está en la cita debajo de cada bloque
  `🖼 **Ficha de bolsillo**`. La de la lección 8 no estaba escrita —solo descrita en
  prosa— y se escribió, porque el guion manda.
- **Se dibujan con Playwright**, no con GDI+ como la marca. Esto es tipografía, Chromium
  ya sabe componerla, y corre en cualquier sistema; los `.ps1` solo en Windows.
- **El tamaño se mide.** La primera versión tenía los tamaños a mano y la ficha de la
  lección 8 —siete líneas contra tres— salió con Ajito cortado por abajo, mientras las de
  tres líneas dejaban medio metro de blanco. Ahora `medir()` baja la escala hasta que
  cabe y avisa por debajo del 70%, donde el arreglo ya no es encoger sino escribir menos.

**Dos fallos del lector que salieron de esto:** la descripción de un bloque 🖼 partida en
dos líneas dejaba la cita fuera de alcance —así salió vacía la ficha de la 8, sin que
nada se quejara—, y la ficha no heredaba el `-A`/`-B` de su audio, así que al apagar el
interruptor se oía una despedida y se veía la otra.

### El certificado

Es lo contractual del adiestramiento y lo último que Ajito promete, en el audio 5 de la
lección 8. Hasta hoy, terminar las nueve lecciones no entregaba nada: el botón «Ver mi
certificado» de la portada del curso llevaba a la lección 8.

- **Se emite solo al cerrar la novena**, y `terminarLeccion` redirige al certificado en
  vez de al índice — llegar a una lista de lecciones tachadas después de ese audio sería
  quedarle mal. Si la emisión falla, la lección igual queda terminada.
- **Nadie se lo puede fabricar.** La política de la tabla —correctamente— solo deja
  escribir a los editores de Boosty. La emisión pasa por `emitir_mi_certificado()`,
  `security definer`, que comprueba que la matrícula sea de quien llama y que las nueve
  lecciones estén completadas **contándolas**, sin fiarse del estado de la matrícula.
- **Una sola hoja para dos públicos**: la que ve el trabajador en su teléfono es la misma
  que sale en `/dashboard/adiestramiento/certificados`, de donde Boosty imprime los
  doscientos para que el Gerente de Planta los entregue en mano. Si fueran dos maquetas,
  el papel y la pantalla dirían cosas distintas del mismo curso.
- **Los datos van congelados en la fila.** Si la persona cambia de cargo en noviembre, el
  certificado sigue diciendo lo que era el día que lo hizo. Y el código va legible
  —`IB-AJITO-2026-0001`— porque alguien de Capital Humano lo va a teclear copiándolo del
  impreso.

### El empujón

Lo último que faltaba del adiestramiento. El curso es a su ritmo y los gerentes piden
que avancen; entre esas dos cosas hay un hueco de doscientas personas que empiezan la
lección 0 un martes y no vuelven.

**Está armado para funcionar sin WhatsApp, y esa es la decisión de diseño.** La cuenta
de WhatsApp Business está pedida a Martha Fuentes y va a tardar —alta del número,
verificación del negocio con Meta, aprobación de cada plantilla—. Un empujón que solo
empuja cuando la integración esté lista no empuja nada durante los meses que tarde, que
es justo cuando la gente está haciendo el curso. Así que apagado el panel prepara los
mensajes con el nombre de cada quien y alguien los copia y los manda desde su teléfono;
encendido salen solos, y son exactamente los mismos.

**La conexión se pega desde el panel**, como pediste. Va ahí y no en el `.env` porque la
pone quien tenga la consola de Meta delante, y esa persona no despliega. El token es un
secreto: RLS de solo administradores, y **el panel no lo enseña de vuelta ni
enmascarado** — un token en pantalla es un token en una captura de pantalla. Hay botón de
probar la conexión que le pregunta a Meta por el número sin escribirle a nadie.

**La escalera está en el guion**, en `contenido/adiestramiento/recordatorios.md`: 2, 5, 8
y 13 días, que es lo que hace MAIA y que ya habíamos decidido copiar. Con una regla
propia que es la que separa un empujón de una molestia: **no se reclama**. Nadie tiene
que explicar por qué no ha vuelto. Se manda el escalón más alto vencido y no todos, y
después del de los 13 no se escribe más — si a los trece días no volvió, eso lo resuelve
alguien hablándole en persona, no un cuarto mensaje.

`npm run probar:recordatorios` son 38 comprobaciones: que la escalera se lea del guion,
que no traiga vocabulario prohibido ni reclame, que con veinte días de silencio salga uno
solo y no cuatro, que no se repita el ya mandado, y —la que más importa para no meter la
pata con alguien— **que un teléfono mal copiado en el padrón no se mande a nadie**. Once
formatos venezolanos probados; un fijo de Caracas o un número corto se descartan.

Después monta tres trabajadores con 1, 6 y 22 días de silencio, le da al botón del panel
y comprueba que a cada quien le tocó lo suyo. El de los 6 recibe: *«Wilmer, llevas 0 de
nueve. La que sigue es Conoce a Ajito y son tres minutos. Aquí te espero.»*

### El padrón, y el enlace personal por fin construido

El hueco que quedó abierto hace un rato —`accesos` en el esquema y nada que lo usara— se
cerró en la misma sesión, porque Gabriel pidió el módulo de empleados con enrolamiento
masivo y envío de los enlaces.

**`/dashboard/empleados`** es ahora la mesa de trabajo de las ~200 personas: quién está,
quién tiene teléfono, quién está matriculado, a quién se le mandó su enlace y **quién ha
entrado con él**. Con selección múltiple y tres acciones en lote —matricular, acuñar el
enlace, mandarlo—, porque doscientas personas no se enrolan de una en una. La barra de
acciones va pegada abajo: al marcar cuarenta filas la cabecera ya no se ve.

**El enlace es la credencial**, y por eso se trató como una contraseña:

- **El token no se guarda, se guarda su SHA-256.** Quien lea `accesos` —incluido quien
  tenga la clave de servicio— puede comprobar un token que le presenten, no suplantar a
  nadie.
- **Caduca a los 120 días**, que cubre la Fase 1. Un enlace en un chat de WhatsApp es
  reenviable.
- **Se puede volver a usar hasta entonces y cada uso se cuenta.** El curso son semanas;
  un enlace de un solo uso obligaría a mandar uno nuevo cada vez. Y «mandado, cero
  entradas» es el dato que más dice del despliegue: significa que no llegó.
- **Acuñar le crea la cuenta a quien no la tiene**, con un correo interno derivado de la
  cédula que nadie va a usar nunca para entrar. Supabase necesita colgar la sesión de
  algo; la puerta es el enlace.
- `/entrar/[token]` **no dice por qué falló**. Caducado, inventado o de alguien que ya no
  está devuelven todos lo mismo: distinguirlos convertiría la ruta en una forma de
  averiguar qué tokens existen.

`npm run probar:padron` son 25 comprobaciones, y las que importan son las cuatro maneras
en que un enlace se vuelve un agujero: que el token esté guardado en claro, que uno
inventado abra sesión, que uno caducado siga sirviendo, y que `accesos` se pueda leer
desde una sesión normal. Las cuatro fallan como deben. Después comprueba el módulo:
matricular en lote, acuñar —creando la cuenta— y entrar con el enlace directo al curso,
sin clave, dos veces.

**Un fallo que salió de volver a abrir la captura:** el padrón decía «sin acuñar» de un
enlace que sí existía. `padron_estado` se creó con `security_invoker = on` —el ajuste
correcto por defecto— pero dentro mira `accesos`, cuya política **niega el SELECT a todo
el mundo**. La subconsulta volvía vacía en silencio. Un panel que dice que a alguien no
se le mandó su enlace cuando sí, lleva a mandárselo dos veces. Corregido con el mismo
patrón que ya usaba `accesos_estado`: la vista corre como su dueña y se cierra con un
`where es_editor()` dentro.

`npm run probar:certificado` monta dos trabajadores —uno que termina y uno que se queda a
mitad— y prueba los tres caminos por los que se colaría un certificado falso: emitir a
medio curso, emitir el de otra persona pasándole su id, y escribir en la tabla a mano.
Los tres fallan. Diecisiete comprobaciones, con capturas de las tres vistas.

---

## 16 de agosto de 2026 · Sesión 4

Arranca el **adiestramiento en IA por el teléfono**: el curso de Ajito, para las ~200
personas que **no** van a las tres formaciones presenciales. Es la tercera capa de
formación que Boosty prometió en comité y que nunca se había detallado.

**Investigado**

- **El curso MAIA** (`Downloads/Telegram Desktop/WhatsApp Chat - MAIA (Conversed)`):
  3.577 líneas de chat, 21 videos, 28 tarjetas, 12 PDF. Dos módulos de Alberto Benbunan
  bajo la marca *rebundle*. Lo que se copia: la anatomía de la lección, la devolución con
  rúbrica (✅ / 🔧 / ✨, nunca «mal»), la confirmación de la transcripción de voz, la
  memoria larga —te devuelve tu propio prompt malo del onboarding— y el acoso amable a
  los 2, 5, 8 y 13 días. Lo que **no** sirve para planta: texto denso, jerga en inglés
  sin glosar, caso final de una fintech, y PDFs A4 a 9 pt que en un teléfono quedan a 3.
- **Realidad del piso**, de las cinco transcripciones: la planta corre a **un solo
  turno** (6:00–14:00); **no hay señal en el piso** —por eso usan radio—; hay wifi en el
  **salón Toronjil**, con 8 computadoras de uso libre donde la gente ya va en su
  almuerzo; **nadie de planta tiene correo corporativo** y la vía que ya funciona es una
  línea de WhatsApp con todo el personal cargado.

**Decidido**

- **Objetivo**: que sepan cómo opera la IA y de cuántas formas puede actuar. No se entra
  en el miedo al puesto. Sencillo, con ejercicios divertidos —fotos—, ligado a la
  cosecha de hallazgos, y cumple la capacitación y certificación del contrato.
- **Audiencia**: todos los que no van a las tres formaciones — planta y administrativo.
- **La única IA que tocan es el asistente del curso.** Sin licencias para planta.
- **A su ritmo, sin arranque presencial.** Los gerentes empujan.
- **`asistente_libre_activo` apagado de fábrica**, con interruptor en el panel. Tal vez
  se encienda más adelante, no de entrada.
- **La voz es sintética**, femenina y caribeña. Ajito no declara sexo y el audio grabado
  tampoco le pone género al trabajador: «list@» no existe en voz.
- **La voz quedó cerrada: `es-VE-PaolaNeural`, de Azure Speech.** Venezolana de fábrica,
  no aproximada. Azure es el único proveedor grande que declara los 22 locales del
  español país por país; Google solo tiene España y México, y ElevenLabs no tiene locale
  venezolano. La letra chica: `es-VE` se quedó en la generación estándar —sin las
  variantes HD que Microsoft solo le dio a España y México— así que se cambió prosodia
  por acento, y se compensa con SSML. Para esta gente el acento pesa más. De paso Azure
  hace también el habla a texto, así que la transcripción sale del mismo proveedor.
  **Costo de la voz del curso completo, para las 200 personas: unos 40 dólares.**
- **La velocidad quedó en `+16%`, y el número está medido.** Gabriel oyó las dos y
  Paola le sonó lenta. Con `npm run probar:voz` se generaron siete muestras del
  arranque de la lección 0 y se midió cada una: Paola de fábrica va a 166 palabras por
  minuto y Sebastián a 200 — **Sebastián de fábrica y Paola a +20% duran exactamente lo
  mismo**, o sea que corre un 20% más rápido y eso era lo que se oía. Se quedó en +16%
  (192 ppm) y no en +20%: a 199 la voz queda de pódcast de oficina, y quien va a oír
  esto está entendiendo por primera vez qué es la IA, en el comedor y con ruido.
  La perilla vive en `lib/voz.ts`.
- **El recurso de Azure ya existía**: `industriasiberiait-9652-resource`, `westus3`,
  nivel S0, en la cuenta de Iberia. No hizo falta crear nada.
- **No se fotografía el área productiva** ni se usa el teléfono en las líneas. Los
  ejercicios de foto se mudaron a los espacios libres y a la cocina de su casa — la
  etiqueta de un producto de Iberia, que además le devuelve orgullo: *«ese lote salió de
  envasado, o sea que eso pasó por tus manos»*.
- **El ejercicio bifurca por familia de oficio, no por nivel.** Bajo `planta` conviven la
  operadora de envasado, la cocinera de pruebas y el vigilante; mandarle a la cocinera un
  ejercicio del codificador de frascos es decirle que la empresa no sabe qué hace.

**Recibido de la agencia** (`LOGOS IBERIA + IA.pptx`, vía Mercadeo)

- **La marca del programa**: `IBER[IA] · Nuevo Sabor`, con el *IA* recuadrado dentro del
  propio nombre de la empresa.
- **Ajito**: cabeza de ajo, cuerpo de ají con el logo, ojos verdes y **ruedita en vez de
  piernas** —que resuelve sola la lección de «no soy una persona»—, más una animación de
  bienvenida de 2,5 MB ya montada.
- **18 avatares caricaturizados** del personal. Todos de oficina salvo uno: **faltan los
  de planta** y hay que pedírselos a Martica.

**Construido**

- **El guion completo** en `contenido/adiestramiento/`: las reglas, las nueve lecciones
  palabra por palabra y el inventario de herramientas por verificar (~14.000 palabras).
- **Migración `20260816120000_adiestramiento.sql`**, aplicada: `cursos`, `lecciones`,
  `matriculas`, `avances`, `respuestas`, `certificados`, `empleados.familia_oficio`, la
  vista `adiestramiento_avance` y `matricular_pendientes()` con el EXECUTE revocado a
  `authenticated`.
- **`/canal/adiestramiento`** — portada del curso, las nueve lecciones con su avance, la
  lección con sus ejercicios ya bifurcados por oficio y la pregunta de campo. Más la
  tarjeta de entrada arriba del feed.
- **`/dashboard/adiestramiento`** — el interruptor del asistente libre, el de apertura,
  matricular a los que faltan, y el tablero por oficio y por área.
- **`scripts/generar-ajito.ps1`**, `sembrar-adiestramiento.mjs`,
  `probar-adiestramiento.mjs` (16 comprobaciones) y `capturar-adiestramiento.mjs`.
- **`lib/voz.ts`** — la voz de Ajito en un solo sitio: nombre, velocidad, tono y
  pausas, más `aSSML()`, que toma el guion en crudo y arma el SSML. El guion nunca
  lleva marcado a mano. Y `scripts/probar-voz.mjs`, que genera muestras para elegir
  de oído en vez de discutir.
- **`capturar:oficios`: el curso visto por los ocho oficios.** Crea un trabajador de
  prueba por familia —Yorgelis de envasado, Nancy de la cocina de pruebas, Wilmer
  montacarguista, Douglas vigilante…—, cada uno con su sesión, recorre la lección
  completa y **compara la consigna que salió en pantalla contra el catálogo**. Verificado
  en las lecciones 2, 6 y 7: la cocinera recibe «cómo preparas una de las pruebas», el
  montacarguista «qué hay en el rack 16» y el vigilante «quién entró ayer por la mañana».
  Nadie recibe algo que no hace. Todo se borra al salir.
- **Se contesta hablando.** Grabador en el navegador, conversión a WAV 16 kHz en el
  teléfono, transcripción con Azure en `es-VE` —el mismo recurso que la voz— y la
  confirmación de MAIA: se muestra lo entendido, se puede corregir, y solo entonces se
  guarda. **Probado de punta a punta**: la frase «los códigos de lote del frasco» volvió
  exacta.
- **Y con foto.** El botón abre la cámara directo, no el explorador de archivos. Ninguna
  vía está cerrada: de voz se pasa a texto y al revés con un toque.
- **Bucket aparte para lo que manda la gente**, con el dueño en la ruta y la política
  comprobándolo. Los audios del curso los oye cualquiera con matrícula; una nota de voz
  la oye quien la grabó.
- **La lección se recorre turno a turno.** `lib/guion.ts` lee el markdown y
  `generar:guion` deja `guion.json`, que es lo que recorre la página. Un turno va hasta
  el próximo botón o ejercicio, y en cuál va cada quien vive en `avances.paso` — así
  quien la deje por la mitad la retoma donde estaba. Los turnos anteriores quedan
  arriba, como en un chat. **De rollo de 8.300 píxeles a conversación.**
- **Chequeo de coherencia entre el guion y el catálogo.** Cada 🎯 lleva su clave
  (`selfie`, `campo`, `pillame`) y `generar:guion` verifica que exista en
  `lib/adiestramiento.ts`. 27 ejercicios enlazados, las nueve lecciones de acuerdo.
- **Los audios se sirven desde un bucket privado**, por una ruta que exige sesión,
  **matrícula en el curso** y firma un enlace de 60 segundos. Nada por URL pública.
- **El reproductor se parece a una nota de voz de WhatsApp**, a propósito: es el modelo
  mental de quien lo va a usar. Toda la fila se toca —con guantes 56 px falla—, se marca
  lo ya oído, y `preload="none"` para que nueve audios no se bajen solos del plan de
  datos del trabajador.
- **Los 70 audios de Ajito, grabados.** `scripts/generar-audios.mjs` lee los bloques
  `🔊 **Audio N**` de los nueve guiones y sintetiza cada uno. **21 minutos y 40
  segundos de voz por 31 centavos.** Ninguno pasa de 38 segundos ni de 1 MB. Es
  incremental por huella del texto: la segunda corrida no gastó un solo carácter.

**Corregido**

- Dato falso que yo mismo había metido en el repo: que Paola venía a 130 palabras por
  minuto. Salía de una página de terceros. Medida sobre el texto real va a 166.
- **«Nueve ratos» → «nueve clases».** En Venezuela «rato» no funciona como unidad
  contable. El «rato» idiomático —«hace rato», «reírnos un rato»— se quedó, que ese sí
  es venezolano puro. La descripción del curso ya estaba en la base, así que el cambio
  fue en una migración aparte y no editando la que ya corrió.
- La prueba de RLS **dejó dos usuarios de prueba en el auth de producción** y dos
  fichas del padrón amarradas a ellos, porque el bloque de limpieza no se aplicó como
  creí. Se detectó en el lint final, se borraron y el padrón quedó como estaba. La
  limpieza ahora barre por prefijo de correo, así que recoge también lo que quede de
  una corrida que se caiga a mitad.
- La **historia de migraciones remota estaba vacía**: las seis anteriores se habían
  aplicado a mano. Se repararon como aplicadas, así que de ahora en adelante
  `npx supabase db push` funciona.
- El clasificador de oficios mandaba a **«Preparador de Mezclas» a la cocina de pruebas**
  cuando es de línea — justo el error que Gabriel advirtió. Corregido en las reglas.
- La prueba de RLS se contradecía: hacía pasar por «ajena» una respuesta del propio
  empleado que después suplantaba. Ahora monta una sesión de empleado corriente de
  verdad y comprueba la promesa de la lección 0 contra la base real.
- Dos cosas de la interfaz que solo se vieron mirando las capturas: los títulos de
  lección se cortaban en el teléfono, y el aviso de las fotos se repetía en cada
  ejercicio hasta volverse ruido.
- **El error del `
`**: los guiones quedaron con saltos de línea de Windows y ningún
  `$` de las expresiones casaba, así que el lector devolvía vacío sin quejarse. Peor:
  `generar-audios` tenía su propia copia del lector con el mismo fallo — una regrabación
  habría encontrado cero audios y no habría dicho nada. Ahora hay un solo lector, que
  normaliza el salto de línea.
- **Dos redundancias que solo se vieron mirando las capturas por oficio.** El cierre
  mostraba «Sigo ahora» y debajo «Terminar la lección», que son lo mismo — ahora el botón
  del guion cierra la lección. Y la línea 💬 repetía la consigna del ejercicio
  («Mándame una nota de voz» y debajo «Nancy, mándame una nota de voz contándome…»): en
  el chat del guion hace falta porque el input va aparte, aquí sobraba.
- En modo foto, «Prefiero contárselo escrito» rotulaba el botón de enviar y salía
  deshabilitado: parecía roto. Ahora es un cambio de vía, como en el modo voz.
- El chequeo de objetivos táctiles daba por chico el selector de archivo oculto de 1 px
  —la técnica estándar—, cuando quien recibe el toque es la etiqueta que lo envuelve.
- La prueba de RLS reventaba si la persona ya tenía matrícula. Ahora la reutiliza y solo
  borra lo que ella misma creó.
- Rótulos repetidos en los audios: el primero decía «Portada» —heredaba una sección que
  solo tiene una imagen— y «Ahora un compañero» salía dos veces. El título sale ahora de
  la sección del primer audio, y un turno que retoma una sección dice «Ajito sigue».

**Novedad de verificación.** `probar:adiestramiento` y `capturar:adiestramiento` **no
piden contraseña**: acuñan la sesión con un enlace mágico y la inyectan como cookie. La
verificación visual y la de RLS dejan de depender de que alguien esté delante.

**Dónde quedamos**

El módulo camina en local con las 17 fichas de muestra. Falta lo que no depende de
nosotros: la **lista completa de nombres y cargos** para cerrar las familias de oficio,
los **avatares de planta**, las **fotos autorizadas** que pone Ajito en la lección 3, y
**elegir la voz** con una prueba a ciegas. Y falta conectar el modelo, la transcripción,
la voz y la generación de imágenes — hoy la lección se hace escrita y lo dice sin
disimular.

---

## 12 de agosto de 2026 · Sesión 3

- **Regla de registro fijada**: todo lo que se hable, escriba o redacte en este
  proyecto —correos, mensajes, textos de la app— va en **modismo venezolano**, con
  **tuteo** (nunca voseo rioplatense ni otro) y **siempre en tono profesional**.
  Queda en `AGENTS.md` bajo Convenciones.
- Borrador de correo para Alberto: aviso de que el canal de comunicación interna
  ya tiene el diseño terminado, propuesta de revisión conjunta con mercadeo antes
  de conectarlo a base de datos real y sacarlo al aire. No se comunicó como
  producto de IA (es el entregable de comunicación interna, capítulo de
  «La Nueva Iberia»).

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
