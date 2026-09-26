# Bitácora del proyecto

Qué pasó en cada sesión y dónde quedamos. **La entrada más reciente arriba.**

> **Esto se lee entero o no sirve.** Antes de escribir aquí hay que leerla completa y
> comprobar que lo nuevo no repita ni contradiga lo que ya está. Y hay que mantenerla
> corta: una bitácora larga no se lee, y una que no se lee no es memoria de nada.
>
> **Qué va aquí y qué no.** Aquí va lo que pasó, lo que se decidió y por qué, y lo que se
> rompió. **Cómo funciona el sistema va en `AGENTS.md`**, no aquí — si algo se puede
> explicar una vez y consultarse, no se repite en cada entrada.

Contexto de fondo: `CONTEXTO_IBERIA.md` (en el módulo de archivos), `AGENTS.md` para las
convenciones, **`PENDIENTES.md` para lo que falta** y `DESPLIEGUE.md` para poner esto en
línea.

---

## Estado actual

| | |
|---|---|
| **Fase** | 1 · Entender · **día 50 de 153**. Contrato `CONT-2026-08-0002`, firmado el 6/7 de agosto de 2026 |
| **Calendario** | Adelantado: **nada se entrega después del 6 de diciembre**, porque el aviso de no renovación vence antes que el entregable que sirve para decidir |
| **Dashboard** | **En línea desde el 25/9** en `iberiavenezuela.netlify.app`, cuenta de Netlify de Iberia, público con su propio login. Roles y permisos configurables desde el 25/9. **Sin módulo de hallazgos ni editor del informe** desde el 25/9: el informe se escribe en las sesiones |
| **Levantamiento** | **42 sesiones grabadas · 27.951 turnos**. **33 entrevistas hechas de ~25** y una programada (ENT-029) · los 20 macroprocesos cubiertos |
| **Hallazgos** | **394, todos con cita textual verificada** · 37 de 42 sesiones cosechadas · 🔴 **solo 2 validados** |
| **Informe** | **11 secciones** y 20 de 20 fichas, **sin citas, sin códigos y sin nombres** (18/9, con Gabriel). Ninguna publicada. **Desde el 25/9 son 11, hallazgos primero**: lo que encontramos → cómo funciona hoy → qué proponemos, en tarjetas con nivel de criticidad. Ocho se escriben en Supabase; el generador solo lleva inicio, mapa y fichas |
| **Horas** | **137 h en agosto**, revisadas con Gabriel, y **119 h en septiembre**, estimadas y por revisar: 256 h en la fase contra 107 al mes. Aparte: 111 h de la etapa anterior y 104 h del curso de planta, que se factura en Fase 2 |
| **Comunicación** | **El comunicado salió.** Falta el plan con fecha, el vocero y la nota del boletín |
| **Padrón** | **276 personas cargadas** con ficha, cargo, nivel y familia de oficio. ⚠️ Sin cédula, sin celular y sin correo |
| **Canal** | Funciona en local. Anunciado el 12 de agosto; **la revisión con mercadeo se cayó y no tiene fecha** |
| **Formación dirigente** | Uno a uno con Alberto el 17 de agosto, **Petit Comité el 26** y **gerentes el 23 de septiembre en Cagua**. Falta la tercera —los líderes— y su fecha |
| **Adiestramiento de planta** | Completo: guion, **70 audios (20 min 02 s)**, **dos voces a elegir desde el 26/9** —la de hombre falta grabarla—, 10 fichas, certificado, padrón, recordatorios. **Ajito ya contesta** con la clave que tiene saldo — 🔴 **pero sin voz desde el 24/9**: la clave de Azure no autentica, y con ella cae la transcripción de las notas de voz. **Es de Fase 2** — avance para mostrar, no para abrir |
| **Repositorio** | `Boosty-Hub/iberia` — 🔴 **público**. Cinco commits subidos el 17/9 con la bitácora dentro. Hace falta un administrador de la organización para cerrarlo |

### Lo que aprieta

**La lista completa está en `PENDIENTES.md`**, ordenada por los siete entregables de la
cláusula 5. Aquí solo lo urgente:

- 🔴 **La reunión con Alberto, el martes 29 de 11:00 a 13:00.** Es la que abre la Fase 2: se le
  muestran los tres dibujos y los alivios. Lo que falta para llegar está en `PENDIENTES.md`,
  bajo el Documento de Arquitectura.
- 🔴 **Cosechar los hallazgos de la ronda 2.** Son 6.605 turnos del dinero, la gente, las
  compras por dentro, el laboratorio, la seguridad y los servicios generales, y no hay ni
  uno cargado. **El informe entero está construido sobre la cadena física**, que es lo único
  que había cuando se redactó.
- 🔴 **La grabación de ENT-005.** Milagro Salas fue grabada sin avisarle y pidió que se
  borrara. Sus 38 hallazgos están retenidos y nada de esa entrevista puede citarse.
- 🔴 **El corte del mes 1 es el 6 de septiembre**, en seis días: **redactar el reporte
  mensual de consumo**, que la cláusula 8 obliga y del que no se ha entregado ninguno. Las 38
  partidas ya están revisadas y el mes cierra en **137 h contra 107**, con la mezcla que
  promete la propuesta. **`/dashboard/programa` ya está escrito para que lo lea Iberia**, así
  que el reporte se apoya en él en vez de repetirlo.
- **Agendar lo que falta del levantamiento**: queda **Alberto (E1)** y `ENT-029`, programada.
  *(Corregido el 24/9: Antonio Sorrentino, Arianna González, Martha E. Álvarez, Martha
  Fuentes y Yelitza Pérez se entrevistaron entre el 10 y el 15 de septiembre.)*
- **Confirmar el comunicado** —día, vía y acuse— y sacar la nota del boletín. Y **aprobar el
  comité de comunicaciones** propuesto el 27, que de paso cierra la cadencia de gobierno.
- **Cerrar el acceso antes de la segunda formación**, no en la sala: en la primera se fueron
  48 de los 240 minutos en que la gente lograra entrar.
- **Aclarar el estado de las licencias de Claude Team** y fechar la tercera formación. *(La segunda, a los gerentes, se dio el 23 de septiembre.)*
- **Refijar la revisión del canal con mercadeo** — Alberto la agenda. *(Bloqueaba el despliegue; el sitio salió el 25/9 a pedido de Gabriel, y la revisión sigue antes de dar cuentas del canal.)*
- **Leer los 42 hallazgos redactados** del informe y validar los que los sostienen.
- **Pedirle a Capital Humano cédula y celular por ficha.** El padrón llegó sin ellos.

---

## 26 de septiembre de 2026 · Sesión 44 — Ajito, con dos voces

Encargo de Gabriel: que el curso tenga dos voces, una de mujer y una de hombre, y que cada quien
escoja con cuál oye a Ajito.

### Lo que quedó

- **Paola y Sebastián**, las dos venezolanas de Azure —no hay más en `es-VE`—. En el índice del
  curso, debajo del botón de seguir, «¿Con qué voz quieres oír a Ajito?» y dos botones:
  «Mujer» y «Hombre». Se cambia cuando se quiera y queda en `matriculas.voz`.
- **La elección vale para todo**: la clase grabada y las devoluciones que se generan en el
  momento. Si la clase la dijera una voz y la devolución otra, habría dos Ajitos.
- **El guion no cambia**: ya estaba escrito sin género, para Ajito y para quien lo oye.
- **Cada voz en su carpeta**: la de mujer conserva sus rutas y sus 70 audios; la de hombre va en
  `hombre/`. Si a la voz elegida le falta un audio, se sirve el de la de siempre: mejor otra voz
  que el silencio.
- **`medir:ritmo`, nuevo**: las palabras por minuto sobre el WAV, como la calibración de agosto,
  que se había hecho a mano. Arranca con Paola a `+12%` de testigo.

⚠️ **La primera versión del botón decía «Voz de hombre», y con el ✓ al lado no cabía**: se partía
en dos renglones en un iPhone 14. Ahora dice «Mujer» y «Hombre», porque la pregunta de arriba ya
dice de qué se trata. Lo cazó la captura, no la comprobación, que ahora mide que siga en un
renglón.

**Verificado en producción** con `mirar-voces`, en un iPhone 14: las dos voces, 44 px por botón,
elegir marca y guarda, y sin la voz de hombre grabada el audio cae en la de siempre. 9 de 9.

🔴 **Dónde quedamos: Azure está pausado.** Al ir a buscar la clave, el portal dijo por qué no
autentica desde el 24: **la prueba gratuita venció, los servicios están en pausa y el 15 de
octubre la cuenta se borra**. No era la clave. Hasta que se reactive con pago por uso no se
pueden grabar los 70 audios de Sebastián ni calibrarlo, y «Hombre» suena con la voz de mujer.
Lo que sigue está en `PENDIENTES.md`.

---

## 25 de septiembre de 2026 · Sesión 43 — lo que pidió la reunión del equipo

El equipo se reunió el 25 para recorrer el informe antes de mostrárselo a Alberto el martes 29.
Gabriel pasó la transcripción, pidió comentarios y la lista de pendientes, y después que se
ejecutara lo que le tocaba a Boosty.

⚠️ **La transcripción no se cargó al panel ni se cosechó.** Trae juicios muy francos sobre
personas del cliente, el panel ya está en línea, y no es una sesión del levantamiento. Tampoco
va aquí ni en `PENDIENTES.md`, que están en un repositorio público.

### Lo que se corrigió en el informe

- **La numeración del circuito iba 8 → 10 → 9.** Se movieron los dos trombos, no los números: la
  tabla de puntos de «Los hallazgos» ya decía «9 · Entrega» y «10 · Devoluciones».
- **«Se vende lo que el sistema ve» pasó a «se factura»**: Iberia produce contra pronóstico, y en
  la sala se leyó como si produjera lo ya vendido.
- **Cada estación del flujo lleva debajo el área que la ejecuta**, como se pidió. Son nombres de
  Iberia, así que viven en la base, no en el código.
- 🔴 **«Nuevo» pasó a «No documentado».** Lo propuso el señor Carlos: un proceso que se hace desde
  hace años no es nuevo, es que nadie lo escribió, y «nuevo» hacía creer que el levantamiento lo
  había inventado. Contado en la base, son **99 de los 142 procesos** y 6 de los 20
  macroprocesos. Lo único nuevo de verdad —la gestión de la transformación y adopción
  tecnológica, que abrió el programa— lleva **«Propuesto»**, con estado propio en la base.
- **«Los hallazgos» abre con lo que atraviesa a los 42: la operación no está escrita.** Fue «el
  gran hallazgo» de la reunión. Y las fichas dicen en su primera pantalla que salen de las
  entrevistas y no de documentos: lo único escrito era el organigrama.
- **H-18 decía «la sostiene una persona desde su casa»**, y la sala lo leyó como trabajo remoto.
  La cita (ENT-001) dice otra cosa: de vacaciones pide que le manden el archivo y lo corre igual.
  Ahora es «depende de una sola persona, aun de vacaciones», con su ancla en las fichas y en las
  oportunidades.
- **El trombo 4 decía a la vez que sin liberación no se despacha y que el material se usa antes
  del resultado.** Las dos cosas pasan: la norma y la práctica. Ahora lo dice así.

### Lo que se buscó y no era hallazgo nuevo

- **Las devoluciones de materia prima**: en la reunión se dijo que Calidad no las registra.
  Almacén dice lo contrario —Calidad emite la nota de devolución (ENT-003)—; lo que no existe
  es el historial de rechazos como dato, y eso ya es la oportunidad del indicador de recepciones.
- **El peso de cuentas clave en la facturación y la política de cobranza** no están en ninguna
  transcripción. Quedan como preguntas para Iberia.

### Lo que costó

- ⚠️ **Los talleres de las fichas, el mapa e Inicio no están en esta máquina**: son de Jesús.
  Esas secciones se corrigieron en la base y el generador ya escribe lo nuevo, pero su taller
  todavía tiene el título viejo de H-18 y el «desde su casa». Anotado para él en `PENDIENTES.md`;
  si corre el generador antes de corregirlo, el enlace de la ficha a H-18 se rompe.
- **Las áreas de arriba del anillo las tapaban las burbujas que cuentan los hallazgos de cada
  trombo**: la de la recepción tapaba «Almacén de». Se subieron encima del nombre de la estación.
  La primera verificación no lo cazó porque comparaba texto contra texto; ahora mide también
  contra las burbujas.

**Verificado en producción**: `mirar-reunion` 14 de 14 —el orden de los trombos, el codo, las
áreas sin pisarse, los enlaces a H-18 desde las fichas y las oportunidades, las marcas y la
leyenda del mapa—; `tipos`, `lint` y `build` limpios. Respaldo antes de tocar la base en
`Insumos/Respaldo_Informe_2026-09-25_1603`.

**Dónde quedamos.** Lo de Boosty para el martes, hecho. Lo que queda es de Gabriel —el estimado
de la Fase 2, la respuesta a la objeción de seguridad, cómo se rotulan las fases— y está en
`PENDIENTES.md`.

---

## 25 de septiembre de 2026 · Sesión 42 — en línea, el registro que estaba abierto, y las cuatro que no cabían

Encargo de Gabriel: entrar a Netlify con la credencial de `.env.local`, cargar las variables
que hagan falta y dejar el sitio funcionando y público.

**Lo que había.** Una cuenta de Netlify **de Industrias Iberia**, plan Pro, con un solo sitio
—`iberiavenezuela`— conectado al repositorio y desplegando cada push a `main`. Dos cosas lo
tenían muerto: **ninguna variable de entorno** y el **login de equipo de Netlify** activo, que
le respondía 401 a quien no fuera miembro de la cuenta.

### 🔴 Antes de abrirlo: cualquiera se podía hacer administrador

Al revisar Supabase salió que **el registro público estaba abierto**, y `handle_new_user` toma
el rol de los metadatos del alta. O sea: con la clave pública —que va en el JavaScript de
cualquier sitio publicado— una llamada de registro con `rol: 'admin'` daba una cuenta de
administrador. «Sin registro abierto» se cumplía en la interfaz, que no tiene botón de
registro, pero no en la API. **Se cerró antes de quitar el login de Netlify**; solo existen las
dos cuentas de administrador de Boosty, así que nadie lo aprovechó. Comprobado desde afuera: un
intento de alta devuelve `signup_disabled`, y `probar:supabase` ahora falla si se reabre.

### Lo que quedó

- **Seis variables**: las tres públicas, la región de Azure, y la clave secreta de Supabase y la
  de Anthropic con saldo **como secretas y solo en producción** —el repositorio es público y una
  vista previa la puede disparar un PR de afuera—.
- ⚠️ **La clave de Azure no se subió**: sigue en 401 y además quedó expuesta en una captura. Sin
  ella, Ajito contesta escrito y las notas de voz no se transcriben.
- **Las funciones pasaron de `us-east-2` a `us-east-1`**, la región de Supabase, que es lo que
  pedía `DESPLIEGUE.md`.
- **Supabase apunta al dominio**: *Site URL* y *Redirect URLs*, con `localhost` para seguir
  trabajando en local.
- **Público**: sin el login de Netlify, las rutas protegidas mandan al login de la app y un
  enlace inventado de `/entrar` cae en el aviso genérico.

`capturar` contra producción, con sesión real: **14 páginas, cero errores de consola**, y el
panel con los datos de la base. `DESPLIEGUE.md` se reescribió con cómo quedó.

### Las cuatro oportunidades de IA, a su módulo

Gabriel decidió que **las cuatro que no cabían entran a la arquitectura**: la foto del anaquel a
Comercial, los audios de anomalía a Distribución, la ubicación al recibir a Calidad y la
secuencia de corridas a Planta. El sistema pasa de **47 capacidades y 17 de IA a 51 y 21**, y
fuera quedan cuatro oportunidades, ninguna de IA.

⚠️ **Tres de las cuatro esperan un dato que no existe** —la captura en el punto de venta, el mapa
de posiciones del almacén, las reglas de secuenciación escritas—, y **la del anaquel cae en la
ola 1, que es la Fase 2 que se recomienda**. Para que eso no se lea como una promesa, cada módulo
lleva una nota («entra al módulo, no a su primera entrega») y la arquitectura lo dice debajo de su
tabla. Cambió el taller de circuitos y se volvió a sembrar; en la base, las oportunidades, la
arquitectura y la ruta. Verificado en producción: las cuatro con su marca de IA y su nota, 16 de
16; las oportunidades, 10 de 10.

⚠️ **El respaldo de esta mañana pisó el de antes de reestructurar**: la carpeta de `Insumos/` solo
llevaba la fecha. Ese estado sigue en `contenido/informe-v2/respaldo-antes-de-reestructurar.json`,
y `respaldar:informe` ahora le pone la hora si la carpeta ya existe. El de antes de este cambio
está en `Insumos/Respaldo_Informe_2026-09-25_antes-de-las-cuatro`.

**Dónde quedamos.** En línea en **https://iberiavenezuela.netlify.app**. Antes del primer enlace
personal falta elegir el dominio definitivo y probar `/entrar` con un teléfono de verdad; está
en `PENDIENTES.md`.

---

## 25 de septiembre de 2026 · Sesión 41 — el panel se aligera, y la ficha del circuito se lee al lado

Ocho encargos de Gabriel sobre el panel y el informe, y publicar todo en `main`.

### Lo que decidió Gabriel

- **Fuera del panel el módulo de hallazgos y el editor del informe.** Los hallazgos ya se leen en
  el informe, cada uno en su punto del circuito, y **el informe se escribe en estas sesiones** y
  queda listo en la base. Las rutas, sus acciones y sus componentes se borraron; la tabla
  `hallazgos` se queda, que es la que guarda las citas y de la que sale el expediente.
- **Una sección «Cursos» en la barra**: el adiestramiento, el padrón y el curso de Ajito juntos.
- **«El programa» pasa a «Consumos y línea de tiempo»**, «Consumos» en la barra.
- **«Ver el informe» sube a la cabecera**, en otra pestaña.
- **«El mapa de procesos» abre directo el mapa interactivo**: la página previa decía lo mismo que
  las fichas. La sección conserva su número y su sitio; su ruta de texto redirige al mapa, y el
  mapa se viste de sección con su miga y sus flechas.
- **La ficha de cada trombo, en un panel que entra desde la derecha**, para leerla sin perder el
  circuito de vista. Aplica a los tres dibujos: flujo, sistemas y espejo.
- **Las oportunidades, releídas y reordenadas** contra el circuito y la arquitectura.

### Las oportunidades, en el orden en que se construye

Antes iban en tres grupos por disponibilidad del dato, y no se sabía a qué parte del sistema
Iberia iba cada una. Ahora van **por tramo de la ruta y por módulo** —paso 0 (2), ola 1 (4), ola 2
(4), ola 3 (11)—, y cada tarjeta dice qué punto del circuito destraba, **con enlace a sus
hallazgos** (27), dónde vive en el módulo, si es IA, y el dato como etiqueta: `[Arranca ya]`,
`[Paso previo]`, `[Falta el dato]`. Un agente la reescribió sobre el texto que había y yo
recomputé contra las tarjetas cada cifra del cuadro y del cierre antes de cargarla. **Salió del
generador de Jesús**: se escribe en Supabase, como las otras seis.

⚠️ **La reordenación destapó dos cosas que el orden por grupos escondía:**

- **Ocho de las 29 no caben en ningún módulo del sistema Iberia**, y cuatro de ellas son IA que no
  está entre las 17 capacidades de la arquitectura —la foto del anaquel, los audios del
  transporte, la ubicación al recibir, la secuenciación de corridas—. No se metieron a la fuerza:
  van aparte, con el módulo más cercano nombrado. Es decisión para Gabriel y Jesús si alguna
  entra a un módulo. *(Decidido el mismo día: entraron las cuatro. Ver sesión 42.)*
- **Finanzas y Personas no traen ninguna oportunidad de la lista.** Sus módulos salen del
  circuito, no de lo que las áreas pidieron. Y la ola 3 guarda cinco de las doce que arrancan ya:
  va al final por lo físico, no por el dato.

### El panel de la ficha

- **No es un modal**: tocar otro trombo cambia la ficha sin cerrarla, las flechas recorren lo que
  deja ver el filtro, Esc cierra, y `?punto=` lo abre en ese punto.
- ⚠️ **Tapando, la mitad derecha del circuito quedaba debajo del panel.** Ahora le hace sitio: el
  índice del informe se retira, el contenido se corre y el dibujo se encoge hasta caber entero.
  El espejo tenía su propio ancho mínimo de 1.000 px y seguía desbordando; lo cazó la medición,
  no la captura.
- **El aviso «desliza de lado» se quedaba puesto** al encogerse el dibujo, porque medía la
  ventana y no el marco.
- Un clic en un trombo le dejaba al navegador un recuadro de foco encima.

### 🔴 El mapa no se veía en el teléfono

La auditoría del informe cazó que **por debajo de 1024 px el lienzo del mapa medía cero de
alto**: en la columna del teléfono, el `flex-1` le ganaba al alto fijo, y como todo lo de adentro
va en absoluto no quedaba nada que lo estirara. El CSS es de la sesión 29; lo destapó el marco
nuevo de la página, ahora que el mapa es la sección. Arreglado y medido en los cuatro anchos.

### Los permisos, al día

Migración `informe_de_lectura`: fuera las filas de los dos módulos borrados, **las secciones
solo tienen «ver»** —una casilla de editar sin editor sería una mentira— y una sección nueva entra
así. El recurso aparte del mapa se fue: el mapa se lee con la casilla de su sección, o con la de
las fichas, que marcan «Nuevo» con esas tablas.

⚠️ **Validar hallazgos se quedó sin pantalla.** Es lo que bloquea publicar, y ahora se hace en
sesión, sobre el expediente. Anotado en `PENDIENTES.md`.

### Verificación

`probar:permisos` **35** (una nueva: la sección nueva entra solo con «ver») · `probar:supabase`
65 · roles por la interfaz 33 · carga y fichas 10 · **el panel de la ficha 33**, nuevo
(`mirar-cajon`: ningún trombo debajo del panel a 1440 y 1920, teléfono a ancho completo, el mapa
como sección, la cabecera y la barra) · **auditoría del informe: 130 páginas en cinco anchos y dos perfiles, 750 enlaces del índice, 0 rotos, 0 errores de consola, 0 desbordes de página** · las oportunidades 10 (29 tarjetas, 12 verdes, 8 ámbar y 9 rojas, los 27 enlaces a hallazgos caen en su tarjeta) · `capturar` 14 páginas
sin errores de consola · `tipos`, `lint` y `build` limpios.

⚠️ **La auditoría de roles falló en un umbral, no en el producto**: contaba más de diez candados
en la matriz de solo lectura, y con las secciones en «ver» son diez. Ahora comprueba la regla —
ninguna casilla por encima del techo— en vez de un número.

**Dónde quedamos.** Todo publicado en `main`. Jesús tiene que hacer pull antes de volver a correr
el generador: salieron las oportunidades, el editor y el módulo de hallazgos.

---

## 25 de septiembre de 2026 · Sesión 40 — el informe arranca por lo que se encontró

Seis encargos de Gabriel sobre el informe y la navegación.

### Lo que decidió Gabriel

- **El orden: hallazgos, después procesos, después la propuesta.** Se lo recomendé porque un
  comité lee la conclusión primero y la evidencia después. Quedan 11 secciones: Inicio → Lo que
  encontramos → Cómo funciona hoy → Qué proponemos. «Los circuitos del negocio» dejó de ser
  sección y se fundió en los hallazgos (la vista del flujo) y en «Sistemas y estado del dato» (la
  de sistemas).
- **Los hallazgos no van sueltos**: van en el circuito, cada uno en el punto donde golpea, con su
  nivel. 14 críticos, 24 de atención y 4 que funcionan; 16 son transversales.
- **Cinco secciones salen del generador de Jesús** y se escriben en Supabase: hallazgos,
  sistemas, inventario, riesgo y trabas. *(Ese mismo día salió también «Las oportunidades»: ver
  sesión 41.)* Se reescribieron «ordenadas, puntualizadas y con color
  en lo crítico»: un sistema por tarjeta, cada caso con su nivel.

### Cómo se hizo

Tres agentes reescribieron las cinco secciones en paralelo sobre el texto que había, con una
guía común (`contenido/informe-v2/GUIA.md`): nada inventado, sin nombres ni códigos, largo igual
o menor. Revisé cada entrega antes de cargarla. **Los 42 `### H-NN · Título` y los siete `##` de
patrón quedaron idénticos**, porque las fichas enlazan a los hallazgos 64 veces y la portada a
los patrones.

⚠️ **Sus decisiones de nivel son de criterio y están en `PENDIENTES.md` para revisar**: JD en verde
porque resistió, aunque su configuración a medias sea el problema central; los cinco sistemas
perdidos en rojo; los 16 días de la compra en ámbar y la firma que falta en rojo.

### Lo demás

- **La carga ahora se ve.** Cada una de las 24 pantallas tiene su esqueleto, que aparece al
  instante del clic, y el enlace pulsado lleva un giro. Antes el clic no hacía nada visible
  durante medio segundo o más y parecía perdido.
- **El subíndice de las fichas arranca desplegado**, y su chevrón apuntaba al revés.
- **El salto a un macroproceso caía más abajo de donde empieza**: iba al `###` de adentro y la
  barra con el nombre de la ficha quedaba escondida arriba. Ahora cae en la barra.
- **Las fichas van a 1080 px** y con menos relleno por nivel: a 840, tres niveles anidados dejaban
  el texto en 650 px de una pantalla de 1900.
- **La marca «Nuevo»** en los 6 macroprocesos y los procesos nuevos, puesta al pintar con el dato
  de la base.

⚠️ **La matriz de «Lector Iberia» ya no tenía entrevistas, archivos ni hallazgos** cuando se
corrió la verificación: se ajustó desde el panel después de la sesión 38. Dos comprobaciones de
`auditar-roles` la daban por fija; ahora leen la matriz real.

### Verificación

`probar:supabase` 65 · `probar:permisos` 34 · carga, subíndice, salto y marcas 10 · roles 33 ·
auditoría del informe en cuatro anchos: 52 páginas, 584 enlaces del índice y **0 rotos**, 0
desbordes y 0 errores de consola · `tipos`, `lint` y `build` limpios. Respaldo antes de tocar la
base en `contenido/informe-v2/respaldo-antes-de-reestructurar.json`. *(El de `Insumos/` del mismo
día lo pisó otra corrida: ver sesión 42.)*

**Dónde quedamos.** El informe completo en borrador con su orden nuevo. Falta que Gabriel y Jesús
lean las secciones reescritas y confirmen los niveles, y que Jesús haga pull antes de volver a
correr el generador.

---

## 25 de septiembre de 2026 · Sesión 39 — septiembre entra al programa, y la formación de gerentes

Encargo de Gabriel: cargar septiembre en el programa —con la formación de gerentes, que se dio
el miércoles 23 en Cagua de 7:00 a 16:00, ida y vuelta incluida— y poner al día la línea de
tiempo con todo lo que hay.

### Lo que decidió Gabriel

- **En septiembre el peso va en Jesús Planas**, que condujo el levantamiento y lo estructuró.
- **Al entrenamiento fueron él, Ruth y Humberto**, de apoyo. Humberto no es uno de los cuatro
  perfiles del contrato, y se carga **como consultor de procesos**.

### 🔴 Correr el script habría metido 18 h de más

Antes de cargar se comparó el archivo contra la base, y no coincidían: cuatro partidas de agosto
estaban corregidas desde el panel —el 26 partido en sala y traslado, y tres con Jesús Planas en
vez de Gabriel o «Boosty»— y el archivo tenía la versión vieja. Correrlo habría metido la vieja al
lado de la corregida y deshecho los cambios de persona. Se pasaron al archivo, se comprobó que
agosto siguiera en 137 h, y **el script ya no escribe si la base tiene partidas que él no conoce**.

### Septiembre, cargado

**119 h en 24 partidas**, estimadas con la base de cada una. Jesús Planas 51 · Ruth 24 · Gabriel
19 · desarrollo 14 · Humberto 9 · Carlos 2. Por perfil: procesos 87 (+51 sobre su cuota),
dirección 16, desarrollo 14 y senior 2. La fase va en **256 h** en dos meses.

⚠️ **Salvo las 9 h del entrenamiento por persona, son estimaciones mías** —como en agosto, que
Gabriel corrigió después—. Revisarlas está en `PENDIENTES.md`.

### La línea de tiempo

- **La formación de gerentes es `FOR-003`**, una sesión en `entrevistas` sin grabación, no un
  hito: así la vista la une sola, como a las otras dos formaciones.
- Tres hitos hechos: el levantamiento pasa la meta con **33 entrevistas** —no 34: ENT-029 sigue
  programada—, el mapa de procesos validado contra las entrevistas, y el Documento de
  Arquitectura completo en borrador. Y al día los previstos: dos de tres formaciones, el
  inventario cerrado con Tecnología de la Información, y la app en riesgo porque la revisión con
  Mercadeo no tiene fecha.
- ⚠️ **La página daba por hecho lo que solo tenía fecha pasada.** Separaba «lo que viene» de
  «lo hecho» por fecha, así que ENT-029 salía hecha con sus 60 minutos y el plan de comunicación
  vencido también. Ahora separa por estado, lo vencido y sin hacer sale como «Pendiente», y la
  vista le da «previsto» a una sesión programada.
- El resumen de arriba seguía diciendo «el primer mes concentró el arranque». Ahora es una línea
  por mes.

**Verificado** con un lector de Iberia de prueba y como editor, a 1440 y 390 px: sin dinero, sin
«en riesgo» y sin formulario para el lector; ENT-029 en «Lo que viene»; ningún desborde ni error
de consola.

---

## 25 de septiembre de 2026 · Sesión 38 — el informe se rediseña, y los roles se vuelven configurables

Dos encargos de Gabriel: revisar con Playwright todo el diseño del informe —«hay muchos
espacios vacíos a los lados»— hasta dejarlo de nivel profesional y responsive, y un módulo
de **roles y permisos** con matriz de ver, crear, editar y eliminar sobre todos los módulos,
las secciones del informe y las lecciones de Ajito.

### 🔴 Lo más grave: cualquiera se podía hacer administrador

Al leer las políticas de `profiles` para enlazar los roles salió esto: **«actualizar perfil
propio» deja escribir la fila entera**, porque la RLS decide qué filas y no qué columnas. Con
una cuenta de prueba de nivel lector, una llamada a la API con la clave pública puso
`rol = 'admin'` y **la base lo aceptó**. Estuvo abierto desde el 11 de agosto. No hay cuentas
de Iberia todavía —solo existen los dos administradores de Boosty—, así que no hubo a quién
aprovecharlo, pero con el repositorio público era de las puertas fáciles de ver. Cerrado con
un trigger que rechaza cambios de rol, estado, organización o correo que no vengan de un
administrador, y comprobado por `probar:permisos`.

### El informe

La auditoría midió lo que Gabriel vio: a 1920 px la hoja medía 896 y dejaba **736 px vacíos**
a la derecha, pegada a la izquierda; en teléfono no había forma de pasar de sección sin volver
a la portada, y los enlaces de la cabecera medían 16 px de alto.

- **La hoja se centra**, con medida de lectura fija, y a partir de 1400 px sale a su lado el
  índice «En esta sección», que marca dónde va el lector. Por debajo, plegado arriba del texto.
- **En teléfono**, la hoja va de borde a borde (el texto ganó 32 px de 390), la cabecera lleva
  iconos de 40 px y el índice del documento se abre desde un menú.
- **La portada** pasa de una lista a tarjetas por parte, en rejilla; las cifras, en tarjetas.
- Texto a 16/17 px con interlineado de 1,75; las anclas ya no quedan debajo de la cabecera
  fija; las tablas avisan con sombra cuando se deslizan.
- ⚠️ **El mapa interactivo lo abría cualquiera con sesión** aunque el informe no tuviera nada
  publicado: el lector veía por ahí el inventario entero de procesos. Ahora exige su permiso y
  que la sección del mapa esté publicada. *(Desde la sesión 41 el mapa **es** esa sección y se ve
  con su casilla; el permiso aparte se fue.)*
- El panel ganó el mismo menú de teléfono: antes pintaba los ocho enlaces arriba del contenido.

### Roles y permisos

Decisión de diseño que conviene no perder: **el nivel es el techo y la matriz afina por
debajo.** Cada rol tiene un nivel (administrador, equipo consultor, solo lectura) que se copia
al viejo `profiles.rol`, así que las políticas que ya existían siguen valiendo sin tocarlas, y
**una casilla nunca puede dar más de lo que la base deja escribir**. La alternativa —meter la
matriz en las cuarenta políticas— era reescribir la seguridad entera a ciegas contra
producción. La matriz entra en la RLS solo donde se abre a gente de fuera del equipo: el
informe, el mapa y las lecciones. Cómo funciona, en `AGENTS.md`.

- **Cuatro roles de fábrica** que reproducen el acceso de ayer, y uno de ellos nuevo:
  **Personal de planta**, el que recibe quien entra con su enlace. Antes tenía rol de lector y
  con él podía abrir el panel y el informe publicado; ahora solo el canal y las nueve lecciones.
- **Empleados y recordatorios no tienen «ver» a secas**: sus vistas solo le responden al
  equipo, así que una casilla de ver abría una pantalla vacía. Lo cazó el agente que conectó la
  matriz en los módulos.
- Una sección nueva del informe entra sola en la matriz: en los roles de fábrica con lo que su
  nivel veía, y en los creados desde el panel, apagada.

### Verificación

| | |
|---|---|
| `probar:permisos` (nuevo) | **34** · escalada cerrada, techo del nivel, «ver» cerrando la lectura y «editar»/«eliminar» la escritura, con cuentas y una sección temporales que se borran |
| Auditoría del informe | 14 páginas × 5 anchos × 2 perfiles · **750 enlaces del índice, 0 rotos** · 0 desbordes · 0 errores de consola |
| Auditoría de roles | **33** · el módulo de punta a punta por la interfaz (crear, marcar, guardar, bajar de nivel, borrar) y el destino de cada tipo de cuenta · 0 desbordes a 1440, 1024 y 390 |
| `probar:supabase` | **63** · `roles` y `rol_permisos` cerradas sin sesión |
| adiestramiento · padrón · certificado · recordatorios | 17 · 25 · 17 · 38 |
| `capturar` · `capturar:adiestramiento` | limpias, salvo la voz, que sigue sin clave de Azure |
| `tipos` · `lint` · `build` | limpios |

⚠️ **Un `sed` sobre la bitácora le puso una comilla invertida al principio de cada línea**: en
GNU sed, `` \` `` es el ancla de inicio del texto, no una comilla. Se restauró de git. Para
tocar markdown con comillas invertidas, la herramienta de edición o un script de Node.

**Dónde quedamos.** Todo aplicado en la base. Antes de dar la primera cuenta a Iberia hay que
decidir qué ve «Lector Iberia»: hoy reproduce lo de antes, que incluye las transcripciones y
los hallazgos crudos. Anotado en `PENDIENTES.md`.

---

## 24 de septiembre de 2026 · Sesión 37 — los circuitos y el sistema Iberia entran al informe

Empezó con la reunión del equipo del 22 —el señor Carlos, Ruth, Jesús y Gabriel— y la pregunta
de Gabriel: cómo va Iberia de la venta a la factura y de la materia prima al producto
terminado. Terminó rehaciendo la parte de arquitectura del informe.

### Lo que decidió Gabriel

- **JD se queda.** No por lo que hace bien solamente: nadie recibió inducción, cuesta
  aprenderlo y nadie lo sabe explicar. Por eso no se construye más dentro de él.
- **Delante va el sistema Iberia, un espejo de JD de primera mano**, con una capa de
  actualización continua. Obtiene, se trabaja ahí —fácil de enseñar y en el teléfono— y
  **postea en JD cuando toca**. En el sistema Iberia se ve todo.
- **La explosión de materiales corre en el sistema Iberia**, leyendo fórmulas e inventario de
  JD, y se recalcula con cada consumo y cada recepción.
- ⚠️ **La primera idea era «JD como facturador» y se afinó a «JD como registro contable y
  fiscal».** Ocho agentes volvieron a leer las entrevistas crudas, y seis de los ocho grupos
  traen la misma evidencia: sin cerrar y costear la orden en JD no se vende, la liberación de
  Calidad en JD es el único candado, y la orden de compra aprobada vive ahí. El espejo nunca
  guarda su versión de un asiento, una factura o un costo.

Primero se armó un artefacto privado con los tres circuitos —flujo, sistemas y espejo en
3D—; lo que se validó ahí es lo que entró al informe.

### El informe

```
09 Los circuitos del negocio          nueva · los dos anillos, interactivos   (fundida el 25/9 en los hallazgos y en sistemas: ver sesión 40)
10 Las oportunidades, priorizadas     igual, renumerada
11 La arquitectura de IA: el sistema Iberia    reescrita · el espejo en 3D
12 La ruta de construcción            reescrita · paso 0 y tres olas, sin fechas
   «Dónde no va la IA»                fuera
```

- **La arquitectura nombra productos** —lectura de DB2 por JDBC y captura de cambios, el espejo
  en PostgreSQL, el Orchestrator para escribir, Microsoft 365 para la identidad, Claude con
  licencia corporativa— como recomendación de los consultores. **Sin costos.** Antes decía «no
  fija productos»; Gabriel pidió lo contrario.
- **«Dónde no va la IA» salió** porque lo que prometía lo dice ahora cada módulo: 17 de 47
  capacidades son IA *(21 de 51 desde la sesión 42)*. En palabras de Gabriel: ser claros en qué proceso se construye el sistema
  y en cuál de esos procesos, con ese sistema, opera la IA.
- **La Fase 2 que se recomienda es el paso 0 y la ola 1** (Compras, Comercial y Finanzas). El
  paso 0 cierra cuando el espejo cuadra con JD cuatro semanas seguidas.

⚠️ **«Todo lo que el informe documenta tiene que existir en Supabase»**, dicho así por Gabriel.
Los dibujos salen de tres tablas nuevas sembradas desde `contenido/circuitos/circuitos.json`, y
las tres secciones **se escriben en la base, no en el generador**. Cómo funciona está en
`AGENTS.md`. Y una consecuencia: **las fechas de la ruta ya no se leen de `lib/programa.ts`**; si
el calendario cambia, hay que corregir la prosa a mano.

### Lo que se cazó

- 🔴 **El punto 2 del circuito contradecía la decisión**: decía «Fase 3» y proponía hacer la
  explosión «en JD o en el sistema nuevo». Corregido en el taller, y `sembrar:circuitos` ahora
  falla si un destape trae un tipo sin rótulo, porque el nuevo salía como etiqueta vacía.
- **Escribí que JD resistió «los dos ataques»**; lo que está documentado es que resistió el de
  febrero. Corregido antes de cargar.
- **A todo el ancho, la prosa salía a 150 caracteres por línea.** Solo el dibujo va ancho.
- **En el teléfono el dibujo abría por el borde izquierdo**, que está casi vacío. Arranca
  centrado y avisa que se desliza.
- **Tres referencias de capítulo quedaron viejas** en fichas, riesgo y trabas. Se parcharon en
  la base, pero dos viven en los talleres de Jesús como `{cap:donde-no-va-la-ia}`: su próxima
  corrida las vuelve a pisar y el generador avisará. **Anotado en `PENDIENTES.md`, y Gabriel le
  avisa que haga pull antes de correrlo.**

### Verificación

`tipos` y `build` limpios, `lint` sin errores. `probar:supabase` pasa de 52 a **58**: las tres
tablas existen y no devuelven nada sin sesión. Capturas a 1440 y a 390 px de las tres
secciones, con enlaces cruzados entre punto y módulo: **cero errores de consola y ningún
desborde**. Respaldo antes de tocar la base en `contenido/circuitos/`, y
`respaldar:informe` guarda ahora también los circuitos.

**Dónde quedamos.** Las tres secciones sin publicar. Falta que Gabriel y Jesús lean la prosa,
contrastarla con la Gerencia de Tecnología y que Iberia decida dónde vive el espejo.

---

## 24 de septiembre de 2026 · Sesión 36 — verificación completa, la velocidad por módulo y el informe en otra pestaña

Encargo de Gabriel: verificar todo lo construido, medir cuánto tarda en cargar cada módulo,
y que el informe abra en pestaña nueva desde el panel, «igual que el curso de Ajito».

**El curso tampoco abría en pestaña nueva**, así que ahora lo hacen los dos: «Ver el informe»
en el menú, en el panel y en el editor, y «El curso de Ajito». *(Desde la sesión 41 «Ver el
informe» va en la cabecera del panel y el editor ya no existe.)* Llevan el icono de la flecha
que sale de la caja. Comprobado con clic de verdad: se abre la pestaña y la de origen se
queda en el panel.

### La velocidad, medida sobre la compilación de producción

`next build` + `next start`, tres vueltas con caché vacía por ruta y la mediana. **51 rutas,
todas en 200 y cero errores de consola.**

```
Panel y sus módulos, escritorio    lo visible en 0,37 – 0,77 s
Informe, 12 secciones y el mapa    0,46 – 0,61 s
Canal y curso, teléfono            0,40 – 0,84 s
Canal y curso, 4G lento y CPU 4×   lo visible en 1,0 – 1,9 s · completo en 1,8 – 2,5 s
Clic en el menú, ya dentro         0,40 – 0,69 s
```

⚠️ **Casi todo ese tiempo es distancia, no código.** Cada consulta a Supabase cuesta de 90 a
140 ms desde aquí —el proyecto está en Virginia— y una página encadena de cuatro a ocho: el
proxy valida la sesión, `requerirSesion` la vuelve a validar, el perfil, y lo de la página.
Desplegada en la misma región, cada vuelta baja a milisegundos. **Quedó escrito en
`DESPLIEGUE.md`, porque es una decisión de despliegue y no se puede arreglar después con
código.**

### 🔴 Las transcripciones largas se cortaban en el turno mil

Supabase corta cada consulta en 1.000 filas y no avisa. **Seis sesiones pasan de ahí**, y
FOR-002 enseñaba 1.000 de sus 2.723 turnos; el buscador de la página no encontraba nada de lo
que se dijo después. Ahora pagina, y deja de traer `busqueda` —el tsvector del buscador, que
el navegador no usa—: en ENT-010 la consulta baja de 282 a 149 KB. FOR-002 completa carga en
1,1 s.

El mismo tope estaba en `corregir-nombre` y `sembrar-contexto-completo`: renombrar a alguien
con más de mil turnos dejaba el resto con el nombre viejo, y Gabriel tiene 5.463. **Revisado
en la base: no quedó ningún nombre viejo regado**, porque las correcciones hechas cayeron por
debajo del tope. Ahora van en tandas hasta vaciar. La trampa quedó en `AGENTS.md`.

### 🔴 Ajito se quedó sin voz

`probar:ajito` dio **8 de 8 contestadas, con buen personaje, y 0 con audio**. Azure devuelve
401 en las veinte regiones probadas y en el endpoint propio del recurso: la clave de
`.env.local` ya no vale. Lo más probable es que se regeneró —estaba en pendientes, por una
captura— y no se pegó la nueva. *(No era eso: la prueba gratuita de Azure había vencido y los
servicios estaban en pausa. Se supo el 26 de septiembre, ver sesión 44.)* Cae también la transcripción de las notas de voz. La
devolución escrita sigue saliendo, que es el respaldo con que se diseñó.

### `/entrar/[token]` mandaba a la persona a otra máquina

Abría la sesión en el host que recibía el enlace y redirigía a `NEXT_PUBLIC_SITE_URL`. En esta
máquina el 3000 lo ocupa el Website Boosty, así que `probar:padron` entraba y caía en un 404
ajeno. En producción habría pasado igual con cualquier host distinto del configurado —una
vista previa, `www`—: la cookie en uno y la persona en otro, sin sesión. Ahora redirige al
mismo origen, como ya hacía el proxy. 25 de 25.

⚠️ **Las suites apuntan al 3000 por defecto.** Aquí hay que pasarles `BASE_URL`, o prueban
otra aplicación.

### Lo demás que salió de mirar

- La tarjeta «Reuniones y visitas» decía **«8 · 41 transcritas»**: contaba las entrevistas.
- El editor de sección enseñaba `/informe#inicio`, el ancla de cuando el informe era una sola
  página. Ahora es enlace a `/informe/inicio`, en pestaña nueva.
- `capturar` y `probar:paginas` seguían apuntando a `resumen-ejecutivo`, que ya no existe:
  capturaban un 404 y nadie lo miraba.
- `20260918120000_mapa_de_procesos` estaba aplicada a mano y fuera del historial. Se comparó
  el esquema remoto contra el archivo —columnas, restricciones, políticas— y se reparó el
  historial: el próximo `db push` habría fallado al recrear las políticas.
- El error de hidratación de `/dashboard/hallazgos` **ya no aparece**, ni en producción ni en
  desarrollo.

### Lo que corrió y lo que no

| | |
|---|---|
| `tipos` · `lint` · `build` | limpios · 0 errores, 10 avisos viejos en `estructura-informe.mjs` |
| fireflies · derivación · guion · audios | 50 · 26 · de acuerdo · 70 sin cambios |
| adiestramiento · certificado · recordatorios · padrón | 17 · 17 · 38 · 25 |
| `capturar` · `:adiestramiento` · `:oficios` | sin errores de consola · cada oficio recibe lo suyo |
| `probar:supabase` | 52 · migraciones 23 de 23 · tipos idénticos a los del proyecto |
| `probar:ajito` | 8 de 8 contestadas · **0 con voz** |
| **No corrieron** | `probar:acceso`, `probar:paginas`, `probar:canal`, `capturar:canal` y `probar:importacion`: piden contraseña. Anotado en pendientes |

---

## 18 de septiembre de 2026 · Sesión 35 — la portada dice ahora qué se encontró

«Inicio» contaba cuánto se había cubierto y no insinuaba **qué se había encontrado**, que es lo
primero que un comité quiere saber. De cuatro propuestas, Jesús eligió una: los siete patrones
como titulares, enlazando cada uno a su desarrollo.

⚠️ **Nombra, no argumenta**, y esa es la diferencia con el resumen ejecutivo que ocupaba este
sitio hasta la sesión 31. Aquel adelantaba el argumento entero en nueve mil caracteres y
envejecía cada vez que cambiaba un capítulo, sin que nadie se acordara de corregirlo. **Siete
títulos no envejecen** — y salen del taller de destacados, así que tampoco se escriben.

Los siete enlaces apuntan a los `##` del capítulo 8 y el ancla se calcula con el mismo
`github-slugger` que usa `rehype-slug` al renderizar. Comprobado: 7 de 7 caen en un encabezado
que existe.

La portada pasa de 1.900 a 2.950 caracteres y queda con el arco completo: qué se pidió, cuánto
se cubrió, qué se encontró, cuál es el mapa.

---

## 18 de septiembre de 2026 · Sesión 34 — 🔴 la guarda de ENT-005 cubría la firma, no el contenido

### El hallazgo de la auditoría

`SIN_CONSENTIMIENTO` impedía **acreditar** a la sesión retenida, y dejaba pasar lo que dijo.
Se coló una observación publicada en la sección de fichas cuya **única** fuente era ENT-005 —y
que además nombraba su cargo—. «No citarla» incluye no publicar lo que contó.

La guarda ahora **omite la entrada entera** cuando todas sus fuentes están retenidas, y avisa
por consola de cuántas se quedaron fuera. Si hay otra sesión que documenta lo mismo, se
publica: ahí el hallazgo no depende de ella.

```
ENT-005 como fuente en el taller:        7 procesos + 1 nota interna
  · con otra sesión que corrobora:       4  → se publican
  · única fuente, solo el nombre:        2  → fila de tabla, sin observación
  · única fuente, con observación:       1  → retenida
cifras publicadas con ENT-005:           0
```

⚠️ **Queda una decisión abierta**: dos procesos cuya única fuente es ENT-005 siguen en el mapa
como fila —nombre y área, sin observación—. Se conservan porque la *existencia* de un proceso
es un hecho estructural de la empresa y no algo que ella contara; quitarlos falsearía el
inventario de 142. Queda dicho por si el criterio debe ser más estricto.

### Las alusiones que sí sonaban a grabación

De todo lo que el barrido levantó, la mayoría era legítimo —la base de datos **del ERP**, los
audios de anomalía de las transportadoras, la transcripción del pedido que simula la API de
EXA—. Ocho no lo eran, y las tres peores estaban en observaciones del inventario: «no se
levantó en ninguna entrevista», «sin dueño entrevistado» y una **cita textual superviviente**
—«Preguntado directamente en la entrevista, la respuesta fue: "No, no"»—.

Y «voces» pasa a «áreas» en los tres sitios donde quedaba: se leía como gente hablando en una
grabación, y lo que el dato dice de verdad —cuántas **áreas** coinciden— es además más fuerte.

### Pantalla completa en el mapa

⚠️ **No usa `requestFullscreen`.** El mapa vive dentro de un documento con barra lateral, y el
modo nativo saca el elemento de la página: pierde estilos heredados en algunos motores, pone su
propio botón de salir y en iOS no existe fuera del vídeo. Un panel fijo da lo mismo —704 px de
alto pasan a 968— y se comporta igual en los cuatro motores. Escapar cierra.

---

## 18 de septiembre de 2026 · Sesión 33 — dos comodidades

**Expandir y colapsar todo en las fichas.** Veinte fichas en tres niveles son veintitrés
chevrones, y buscarlos uno a uno para leer de corrido o para imprimir era justo lo incómodo
del plegado.

⚠️ **Actúan sobre el DOM, no sobre estado de React.** El `open` de un `<details>` lo maneja el
navegador cuando alguien pulsa el resumen; llevarlo también en estado daría dos versiones de la
verdad, y la de React se impondría al primer re-render cerrando lo que el lector acababa de
abrir a mano. Misma razón por la que `revelarAncla` tampoco usa estado.

**El lienzo del mapa se separa de su tarjeta.** Estaba en `marca-50` y, con la página clara y
las cajas blancas, los tres planos —página, lienzo y nodo— quedaban casi al mismo tono. Ahora
es `marca-100` con una insinuación del rojo de marca en diagonal:

```
página   #f6f7f9
tarjeta   #ffffff
lienzo    #efeded  ← el que cambió
nodo      #ffffff
```

---

## 18 de septiembre de 2026 · Sesión 32 — doce encargos de pulido, y el informe deja de sonar a transcripción

Un lote largo de Jesús sobre cada sección. El hilo común: **nada puede sonar a que el
documento sale de grabaciones**, y menos texto seguido.

| Lo que se quitó | Dónde estaba |
|---|---|
| «6 de diciembre de 2026» | Inicio y hoja de ruta → ahora «hacia final de año» y «diciembre» |
| «Los hallazgos de este capítulo» | seis capítulos |
| La nota de la sesión retenida | Inicio |
| «394 hallazgos» | Inicio, hallazgos, dónde no va la IA, hoja de ruta |
| «Dónde está el resto» y «Dónde está concentrada la fricción» | hallazgos y trabas |
| Los conteos del cuadro de los siete | trabas |
| «N voces» en el consenso | oportunidades |
| «se cosechó de las entrevistas», «aparece en ocho sesiones» | inventario de sistemas |

### Tres decisiones que conviene no perder

**«Inicio» bajó de 4.700 a 1.900 caracteres** al quitarle la lista de los veinte macroprocesos.
No se perdió nada: el mapa los lista enteros en el capítulo siguiente y las fichas otra vez
después. **Tres sitios con la misma lista es una lista que se desincroniza.**

⚠️ **El cuadro «Dónde está concentrada la fricción» se quitó por una razón editorial, no de
espacio.** Un ranking de áreas por número de trabas se lee como una tabla de culpables, y el
capítulo argumenta justo lo contrario — que ninguna traba pertenece al área donde se ve.

⚠️ **Y las columnas de conteo del cuadro de los siete patrones** invítaban a comparar patrones
por tamaño, que es lo que ese capítulo dice que no hay que hacer: lo que pesa no es cuántas
veces ocurre sino que ocurra en áreas sin contacto. Queda lo único accionable: qué lo cierra.

### El doble chevrón de las fichas

Abrir «Operativo» daba nueve fichas de golpe —otra vez la página de corrido que el plegado
venía a evitar—. Ahora cada ficha tiene el suyo dentro del de su nivel.

⚠️ **Eso obligó a cambiar `revelarAncla`**: abría solo el `<details>` más cercano, y con dos
niveles de profundidad el bloque del nivel se quedaba cerrado y el salto volvía a caer sobre un
elemento sin altura. Ahora **recorre toda la cadena de padres**. Comprobado con el enlace que
viene del mapa interactivo.

### Y la arquitectura, de 0 a 3 tablas

Las nueve reglas pasan a tabla con una columna nueva —**de dónde sale cada una**—, los cuatro
flujos a «cómo debe correr / dónde se rompe hoy», y las tres ausencias a «por qué / qué deja en
pie». El diagrama de capas se queda como bloque monoespaciado: es un dibujo, no texto.

---

## 18 de septiembre de 2026 · Sesión 31 — el armazón se comprime de 15 a 12

Cinco encargos de Jesús sobre la estructura. Tres directos, dos que pidió opinar antes.

| | Antes | Después |
|---|---|---|
| Secciones | 15 | **12** |
| «Resumen ejecutivo» | 9.700 car. de síntesis | **«Inicio»**: portada de 6.100 |
| «Las cifras del levantamiento» | capítulo de 25.400 | **disuelto** en 11 destinos |
| «Inventario de trabas» | capítulo de 19.700, 26 tablas | **fundido**, condensado a un cuadro |
| «Los hallazgos» | 23.000 car., 1 tabla | 30.800 car., **9 tablas**, 0 alusiones |
| «Quién lo contó» en las fichas | 20 líneas | **0** |

### Por qué «Inicio» no es un resumen ejecutivo

Un documento que se resume a sí mismo en la primera página invita a no leer el resto, y esa
síntesis envejece cada vez que cambia un capítulo **sin que nadie se acuerde de corregirla**.
Ahora es una portada: de qué va el encargo, cuánto se cubrió, cuál es el mapa. Las conclusiones
se leen donde se argumentan. La prosa del resumen sigue en el taller por si vuelve.

### La disolución de las cifras, y lo que costó

Jesús eligió disolver en vez de reformular, sabiendo el reparo: hay cifras que no cuelgan de
ningún macroproceso. Se resolvió repartiendo los once grupos a mano —**el destino se escribe en
el taller, no se deduce del texto**, porque adivinarlo pondría cifras en la ficha equivocada— y
dándole sitio a los que no encajaban:

```
9 grupos (149 cifras)  → la ficha del macroproceso que miden
El tamaño del negocio  → Inicio
El incidente de febrero → Riesgo y continuidad
Las 6 discrepancias    → Sistemas y estado del dato
```

⚠️ **Las discrepancias no podían ir a una ficha** y ese fue el punto fino: cada una compara
**dos áreas** dando números distintos de lo mismo, así que metida en la ficha de un macroproceso
la comparación desaparece — y la comparación *es* el hallazgo. Van al capítulo que argumenta que
no hay una sola fuente de verdad, que es su tesis contada en números.

### Lo que cazó el guardián de referencias

Quitar tres secciones renumera todo lo de abajo. Los `{cap:slug}` lo absorbieron solos, pero el
generador **avisó tres veces** de referencias a capítulos que ya no existían —`{cap:cifras}` en
hoja de ruta, en riesgo y en el resumen—. Sin ese aviso habrían quedado enlaces a la nada, y sin
error visible.

### Y tres trampas de siempre

- ⚠️ **El heredoc colapsa `\\\\` en `\\`.** Tres veces esta sesión: `replace(/\\n/g…)` quedó con un
  salto de línea real dentro del regex, y una plantilla con `${dis.join('\\n')}` se partió en
  tres líneas. Cuando hay barras, se escribe el archivo con la herramienta de escritura, no con
  un heredoc.
- **Una cabecera de tabla vacía se pintaba como una banda gris suelta.** Markdown obliga a
  escribir la fila aunque el cuadro no tenga títulos; ahora se oculta por CSS.
- Los **subtítulos de sección viven en `SECCIONES`, no en `contenido_md`**, así que la auditoría
  de alusiones no los miraba: «Lo que encontramos, cada uno con su cita» sobrevivió a todo el
  barrido anterior. Cuatro corregidos.

---

## 18 de septiembre de 2026 · Sesión 30 — el informe pierde el aparato de referencias

Decisión del cliente, hablada con Gabriel: **el informe va sin citas textuales, sin códigos de
sesión y sin nombres.** Se sostiene en la autoría del equipo consultor. Ejecutada entera.

| Antes | Después |
|---|---|
| 742 códigos de sesión en 14 secciones | **0** |
| 49 nombres y cargos en la sección 2 | **0** |
| 8 fragmentos entrecomillados en la prosa | **0** |
| La duración de cada sesión en minutos | **0** |
| 15 secciones | **14** |

### `SIN_CODIGOS` es un interruptor, no una demolición

Todo lo que se quitó **sigue en el taller y en la base**. Ponerlo en `false` y regenerar
devuelve el informe con referencias. Lo que lo hizo barato ya estaba comprobado: de 571 códigos
del taller, 569 viven en casillas propias y **ninguno dentro de una oración**, así que esto era
renderizado y no reescritura.

Dos columnas de tabla **se quitan enteras** en vez de dejarse vacías —la de «Sesión» en el
inventario de trabas y en riesgo—: una columna con 149 guiones es ruido con encabezado. Y dos
sitios cambiaron de oficio en vez de callarse: «Quién lo contó» en las fichas y el rastro de un
sistema ahora **cuentan sesiones** en vez de nombrarlas. Un macroproceso que salió en seis
conversaciones está mejor sostenido que uno que salió en una, y eso sigue siendo cierto sin
decir cuáles.

### La sección 2 desapareció, y era lo que tenía que pasar

Sin nombres y sin códigos, «Cobertura del levantamiento» se quedaba en su cuadro de
indicadores. Ese cuadro es justo lo que un resumen ejecutivo quiere arriba, así que se fundió
en la apertura: **entrada breve → cuánto se cubrió → qué encontramos**.

```
42 sesiones · 34 entrevistas, 6 reuniones y recorridos, 2 formaciones
50 personas · 26 en Planta Cagua · 15 en Caracas · 1 remota
28 áreas · 20 macroprocesos · 142 procesos · 394 hallazgos
```

⚠️ **Ni una de esas cifras se escribe**: salen de la base y del inventario. Y la sesión retenida
sigue contando en el total con su nota al pie, sin identificarla — sacarla falsearía la
cobertura, nombrarla sería usar lo que pidió que no se usara.

### El expediente, que es donde vive ahora la defensa

`npm run expediente` deja en `Insumos/` —fuera de git— los 394 hallazgos con su área, su
sesión, quién lo dijo, su cargo y **la cita literal**. 41 sesiones citables de 42.

⚠️ **Pasa a ser el único puente entre el informe y su evidencia**, así que `respaldar:informe`
lo genera dentro del respaldo: el informe se puede reconstruir del taller, pero el expediente
sale de `hallazgos` y `entrevistas`, que esa copia no guardaba. **No se comparte con el
cliente.**

⚠️ **`ENT-005` tampoco entra ahí.** No citarla incluye no guardarla.

### Lo que queda dicho y sin resolver

- De 394 hallazgos hay **2 validados**. El código era lo que permitía que un gerente
  reconociera su conversación y corrigiera; ahora la validación depende de que el consultor
  lleve el expediente a la mesa.
- 🔴 **El repositorio sigue público** y la bitácora, que va dentro, lleva nombres de sesiones
  viejas. Es lo que peor casa con esta decisión.

---

## 18 de septiembre de 2026 · Sesión 29 — el mapa navegable, y una barra que faltaba

### 🔴 `\p` dentro de una plantilla no es `\p`

La auditoría de nombres cazó esto en una casilla de la sección 5: donde decía
**«Analista de Operaciones»** había quedado escrito **«…lista de Operaciones»**, con un rol
pegado delante. En un *template literal* de JavaScript, un escape que el
lenguaje no reconoce **pierde la barra**, así que el `[^\p{L}]` de `despersonalizar()`
llegaba al motor como `[^p{L}]` —una clase con las letras p, llave, L— y el límite de
palabra no existía: «Ana» casaba dentro de «Analista». Va con doble barra.

⚠️ Es la tercera vez que muerde la misma trampa, con `\d`, con `\b` y ahora con `\p`.
Cuando un regex se arma en una plantilla, **la barra se escribe doble o no está**.

### La auditoría, que era el encargo

Grabaciones, minutos y nombres en las quince secciones. **Todo lo que queda está en la
sección 2**, que es justo la que se va a fusionar:

| | |
|---|---|
| Grabaciones | **0 reales.** Los 14 avisos son «transcripción» del pedido en la API de EXA y del parte de papel a Excel, y los audios de anomalía del transporte — flujos de negocio, no sesiones |
| Minutos y horas | Las cifras de negocio se quedan, que son hallazgos. De entrevista solo hay dos cosas, las dos en la 2: la línea de «44 horas» y la columna *Duración* |
| Nombres | **49, todos en la 2.** Fuera de ahí, cero: lo que saltaba era «Fuentes» del rótulo, «Edward» de JD Edwards y Campo, Parada, Mercado y Cruz, que son palabras corrientes |

### El mapa interactivo

`/informe/mapa-interactivo`. **Se rehizo en la misma sesión**: la primera versión eran tres
bandas apiladas, y Jesús trajo un ejemplo en PPTX de cómo lo quería. Ahora es un **lienzo
navegable** con el lenguaje de ese ejemplo y la paleta de Iberia: se arrastra, se acerca con
Ctrl + rueda, y **al pulsar una caja el lienzo se centra en ella** y abre su panel de
procesos. Leyenda arrastrable y plegable, pestañas de familia abajo, controles de zoom.

**Lo que costó decidir fue dónde vive el dato.** El inventario estaba solo en el taller, y el
mapa lo necesita al leer, no al generar. Leer el JSON del disco daba una página que funciona
en local y sale vacía al desplegar; un módulo generado iría a un repositorio público;
`public/` se sirve sin sesión. Así que dos tablas con RLS, sembradas desde el taller —**que
sigue mandando**: cada siembra pisa.

Tres cosas que se vieron en pantalla y no en el código:

- ⚠️ **El centrado iba en el `onClick` y se desviaba 169 px.** El panel se abre al lado y le
  quita ancho al lienzo, así que el cálculo usaba el ancho de antes. Movido a un efecto, que
  corre con la maqueta ya rehecha: 1 px.
- ⚠️ **Abrir con todo el mapa a la vista era abrir un mapa ilegible** —veinte cajas a un
  tercio de tamaño—. Arranca a escala de lectura por el principio de la cadena, y el botón
  de ver todo da la vista de pájaro.
- La leyenda flota abajo a la izquierda y tapaba el primer eslabón; el lienzo abre corrido a
  la derecha, y además la leyenda se pliega.

⚠️ **No hay ancla por proceso y no la puede haber**: los procesos son filas de una tabla y
`rehype-slug` solo trabaja sobre encabezados. El enlace lleva a la ficha **más `?proceso=`**,
y la página de fichas busca la fila por texto y la resalta en ámbar. Si no la encuentra no
avisa — el lector se queda en la ficha, que es a donde iba igual.

**Las flechas, en dos registros.** Jesús hizo notar que las cajas de estratégico y soporte
estaban sueltas. **Entre sí siguen sin flecha**, y es a propósito: no son una secuencia, y una
flecha de 1.1 a 1.2 afirmaría un orden que no existe. Lo que faltaba dibujar era lo que el
rótulo ya decía en palabras —que orientan la cadena y que la sostienen—, y ahora cada caja
baja o sube punteada hasta un **riel** que abarca la banda.

⚠️ **El riel existe para no emparejar.** Una línea de un estratégico a un eslabón concreto
sería inventar una relación que nadie validó; la línea al riel dice «a la cadena entera», que
es lo único que el levantamiento sostiene. Por eso el punteado pesa menos que la troncal: una
es secuencia real y la otra relación de banda. Los cruces documentados entre áreas siguen en la
prosa del capítulo 9, y la leyenda enlaza allá.

### Decisión aplazada

Jesús está pensando si el informe **quita los códigos de sesión y la tabla de cobertura**
para quedar solo en prosa formal. Pidió que se le recuerde. Se comprobó que sería
reversible: de 571 códigos, **569 están en casillas propias y ninguno dentro de una frase**,
así que es renderizado y no reescritura. Se le dieron tres caminos —bandera al generar, dos
columnas con botón, o filtrar al leer— y la recomendación de **esperar a que avance la
validación**: con 2 hallazgos validados de 394, el código es lo que permite que un gerente
reconozca su conversación y corrija.

---

## 18 de septiembre de 2026 · Sesión 28 — seis encargos, y un nombre que se escapaba

Jesús pidió seis cosas de una vez sobre el informe. Todas están hechas. Dos merecen quedar
escritas porque cambian cómo funciona el generador.

### 🔴 La política de atribución no llegaba a `hallazgos.descripcion`

Con las citas ya convertidas en prosa y la acreditación reducida al código de sesión,
**quedaban trece nombres de pila dentro del capítulo 12**. No venían de la lógica de
atribución: venían del texto de la cosecha, que se escribió nombrando a quien lo dijo, y ese
texto se renderiza tal cual.

`despersonalizar()` los cambia por el rol —«Fulano describe el módulo» → «la jefatura de
Almacén de Materia Prima describe el módulo»—. Tres decisiones dentro:

- **El mapa nombre → rol se construye de la base, no se escribe en el script.**
  `estructura-informe.mjs` sí va a git y el repositorio es público: una lista de nombres de
  Iberia ahí sería la misma fuga que la política viene a cerrar, y encima permanente.
- **Se aplica al markdown final, en el mismo sitio donde se resuelven los `{cap:}`**, no en
  cada generadora. Puesto en cada una, la próxima se olvida.
- **No toca la base.** El original sigue en `hallazgos.descripcion`, así que revertir es
  quitar la llamada.

Cobertura es la excepción, como ya lo era: ahí el nombre *es* el contenido del capítulo.

Verificado: **0 nombres de pila fuera de cobertura** en las quince secciones.

### Un caso puede ser una etiqueta o una fila

El capítulo 13 tenía sus casos en viñetas sueltas. Ahora `capituloConCitas` mira los `casos`:
si son cadenas salen en viñetas, y si el taller les pone detalle al lado **salen en tabla**.
Una categoría gana columnas editando el taller, sin tocar el generador, y el conteo del cuadro
de mando sigue siendo el mismo `casos.length`.

### Lo demás

| Encargo | Qué se hizo |
|---|---|
| Sin «grabadas» en la 02 | «44 horas de entrevista · 27.951 turnos de diálogo registrados». Comprobado en todo el informe: la única coincidencia que queda es un «que quede grabado en el momento» que habla de registrar en el sistema |
| Numerar el mapa de procesos | `1. Estratégico` y `1.1. Dirección y Gobierno Corporativo`, con las mismas funciones que ya numeraban las fichas |
| Color por categoría en las fichas | Rojo de marca para estratégico, oro para operativo, carbón para soporte — tonos 50/100. **El tinte se deduce del nombre del nivel, no de su posición**: numerado por el inventario, tintar por orden haría que el color siguiera al sitio y no a la categoría |
| Tablas en la 06 | De 1 tabla a **8**. La que más pesa es «qué dato es confiable»: cuatro grados, y la fila «no confiable» dice por qué ningún modelo puede entrenarse ahí |
| Tablas en la 13 | De 1 a **8**, contando las cinco de casos y las dos escritas —los seis límites que pusieron los entrevistados, y las tres razones por las que decirlo importa |

Verificación visual hecha: los tres tintes medidos con `getComputedStyle`, ninguna tabla
desborda su caja, y 0 errores de consola.

---

## 18 de septiembre de 2026 · Sesión 27 — el respaldo no servía para revertir

Antes de decidir si el informe pasa a prosa formal sin citas, se revisó si esa versión sería
recuperable. **No lo era**, y el motivo no era obvio.

⚠️ **Las quince secciones están en `GENERADAS`, o sea que se regeneran siempre.** Restaurar un
respaldo devuelve `contenido_md` a la base y lo recupera **hasta la próxima corrida**, que lo
pisa con lo que digan los talleres. El respaldo servía para leer, no para volver atrás.

Y la capa que hacía falta —`contenido/informe/*.json`, donde vive la prosa y los pares
`(sesión, hallazgo)`— **no está en git**: `contenido/*` está ignorado, y con razón, porque
lleva material bajo NDA. Así que no tenía ningún historial.

### Lo que se hizo

`respaldar-informe.mjs` **copia ahora también el taller**. No fue una copia suelta: va en el
script, así que todos los respaldos futuros lo incluyen sin que nadie se acuerde.

```
Insumos/Respaldo_Informe_2026-09-18_con-citas/    1,3 MB
  informe.json          las 15 filas de la base
  informe-completo.md   las 15 seguidas
  secciones/            una por sección
  taller/               13 json · 102 pares (sesión, hallazgo)  ← lo nuevo
```

**La reversión completa son tres pasos**, y queda escrito en la cabecera del script: copiar
`taller/` de vuelta, `git checkout` del generador —que sí está versionado— y regenerar.

⚠️ **El respaldo del 17 no se puede completar retroactivamente.** Los talleres han cambiado
mucho desde entonces —las trabas, los cuadros de mando, las tablas de la 08— y no hay forma de
reconstruir su estado de aquel día. Ese respaldo sigue sirviendo para leer, no para revertir.

---

## 17 de septiembre de 2026 · Sesión 26 — la 08 pasa de prosa a tablas

Jesús pidió menos texto puro en **«Riesgo y continuidad»**. El capítulo pasa de nueve bloques
de prosa a **seis tablas y dos bloques**, y baja de 12.841 a 10.194 caracteres diciendo más.

```
Los dos ataques              comparados en paralelo, seis filas
Qué resistió y qué cayó      siete componentes con su estado
Qué perdió cada área         14 filas · generada de la base
Levantar no es recuperar     las cuatro mediciones del mismo incidente
Lo que se hizo después       ocho medidas con qué resuelve cada una
Lo que sigue abierto         cinco frentes · con quién lo cierra
```

### La tabla que justifica el capítulo

**«Qué perdió cada área, y si volvió»** es lo que el capítulo prometía y estaba en prosa. Ahora
se genera: **el área y la sesión salen de la base** por el título del hallazgo, y el taller
solo aporta el juicio editorial —qué se perdió, en corto, y si volvió—.

```
14 pérdidas · 6 no volvieron · 6 parciales · 2 recuperadas
```

⚠️ **Ese conteo se cuenta, no se escribe.** Es la tesis del capítulo: una cifra tecleada
seguiría diciendo lo mismo el día que se añada una pérdida más, que es como un documento
empieza a mentir sin que nadie lo toque.

Y la cronología comparada deja ver algo que la prosa escondía: **la fila que más pesa es la
última**, «qué se hizo después» — *nada estructural* en mayo de 2025 contra la respuesta
completa de febrero de 2026.

### 🔴 Un borrado accidental, y cómo se recuperó

Al reescribir el generador delimité el reemplazo con «hasta `const GENERADAS`» en vez de
«hasta el cierre de la función». **Se llevó por delante 939 líneas** — todas las generadoras
declaradas entre medias. El script dejó de arrancar con `elResumenEjecutivo is not defined`.

Recuperado con `git checkout` del archivo, que estaba commiteado, y rehecho **acotando por el
cierre real de la función** —la primera línea que es exactamente `}`—.

⚠️ La lección: **delimitar un reemplazo por «lo siguiente que reconozco» es frágil** cuando
entre medias hay más código del que uno recuerda. Y el motivo de que costara dos minutos y no
una tarde es que el archivo estaba commiteado: **commitear antes de una cirugía grande no es
ceremonia.**

### Y cuadro de carga en la 10

La 10 ya era todo tablas —25, una por área— así que aquí no había prosa que convertir. Lo que
faltaba era **ver el conjunto**: para saber quién carga más había que recorrer las veinticinco
cabeceras contando.

Se le añadió **«Dónde está concentrada la fricción»**: una fila por área con sus trabas, las de
impacto alto y el reparto entre cuello de botella y trabajo manual, ordenada de mayor a menor y
con fila de total.

```
Gerencia de Distribución   22   13 altas   13 cuello · 9 manual
Gerencia de Compras        16   10 altas    8 cuello · 8 manual
Gerencia de Planta         14    9 altas    9 cuello · 5 manual
Total                     149   91 altas   83 cuello · 66 manual
```

**Tres áreas concentran 52 de las 149** — y la lectura que se añade debajo es que son las tres
que más papel mueven y las que más dependen de que otro termine primero.

⚠️ Detalle de render que costó una corrida: **la fila de total no puede llevar línea en blanco
delante**. Separada del cuerpo, Markdown la trata como **otra tabla** de una sola fila con
cabecera vacía. La comprobación ahora cuenta las filas de la primera tabla: 25 áreas + total =
26.

---

## 17 de septiembre de 2026 · Sesión 25 — cuadro de mando en la 12, y una cifra que me inventé

La **12 · Oportunidades** abre ahora con el mismo cuadro de mando que la 09: los cuatro grupos
con sus oportunidades, cuántas son de impacto alto, qué disponibilidad de dato tienen y cuándo
arrancan.

```
Grupo 1 · Se puede empezar ya          12   7 altas   ✅ Disponible
Grupo 2 · Exigen un paso previo         8   6 altas   ⚠️ Hay que limpiarlo
Grupo 3 · Construir el dato primero     9   6 altas   🔴 No existe
No son oportunidades: son condiciones   4   3 altas   —
```

⚠️ **Va primero, antes de los criterios.** Se colocó en tercer lugar por error y se subió: un
cuadro de mando que va tercero no es de un vistazo.

Las cuatro columnas de conteo **se calculan** —de la lista y de la base—; solo «Arranca» es
criterio editorial y vive en el taller. Y la disponibilidad del dato se **deduce** del grupo,
que por diseño es uniforme: si algún día deja de serlo, la celda dice *mezclado* en vez de
mentir.

### 🔴 Una cifra que me inventé al proponerlo

Al enseñarle el borrador a Jesús afirmé que **«la mitad de lo de alto impacto está en el grupo
3»**. Es falso, y el cierre que había escrito se apoyaba en esa cifra. Al generarlo con datos
reales:

```
22 de impacto alto en total
 6 en el grupo 3  →  27%, no la mitad
 7 pueden empezar ya  →  32%
```

Reescrito con lo que el dato sí dice, que además es un argumento mejor: **de las 22 de impacto
alto, solo siete pueden empezar ya**; las otras quince esperan por limpiar un dato,
construirlo o una decisión que nadie ha tomado. Dos de cada tres cosas que más pesan **no
arrancan el lunes**.

⚠️ Lección: **el cuadro se calculó y la afirmación del cierre no.** La cifra inventada
sobrevivió hasta que el generador produjo la real. Cualquier afirmación cuantitativa de un
cierre debería salir del mismo sitio que la tabla que la sostiene — por eso ahora `{ALTAS}`,
`{ALTAS1}` y `{ALTASRESTO}` se sustituyen en la corrida.

Se completó de paso `EN_LETRA` con los números del 1 al 13, que faltaban: el cierre decía «6
de las oportunidades» en medio de un párrafo de prosa.

### Y cuadro de mando en la 13

Mismo tratamiento para **«Dónde no va la IA»** *(sección retirada el 24 de septiembre)*. Ahí el cuadro tiene una columna que no tienen
los otros dos y es la que más pesa: **quién lo tiene que hacer**.

```
1  Configurar el ERP              5 casos   TI + proveedor de JD
2  Conectar dos sistemas          4 casos   TI + proveedores
3  Decidir y escribirlo           6 casos   Las áreas y la dirección
4  Comprar o autorizar            5 casos   Compras y Finanzas
5  Disciplina de proceso          1 caso    Cada área, con Excel
6  Arreglar la captura primero    2 casos   Operaciones
```

**23 casos que salen del alcance de IA.** El cierre dice lo que el cuadro no puede: no
desaparecen, cambian de dueño y de partida — y si no se les asigna dueño explícito quedan
esperando a que los resuelva el programa de IA, que es lo único con presupuesto asignado.

⚠️ **El cuadro es opcional en `capituloConCitas`, no incrustado.** Lo lleva el 13 y no el 6,
porque el 13 tiene seis filtros comparables entre sí y el 6 son nueve bloques de argumento que
no forman una serie. **Un cuadro de mando sobre cosas que no son comparables es decoración.**

---

## 17 de septiembre de 2026 · Sesión 24 — el informe se acredita por código, no por nombre

Decisión de Jesús, con respaldo previo. **El documento nombraba a 34 personas en 712
menciones**, varias asociadas a hallazgos incómodos. Ahora acredita por código de sesión.

```
antes:  712 menciones de nombre en 13 secciones
ahora:   79, todas en la tabla de cobertura
```

### La excepción es deliberada

**El capítulo 2 conserva nombre y cargo.** Ahí el nombre *es* la evidencia de a quién se
escuchó, que es la función del capítulo.

⚠️ Y de ahí se sigue algo que conviene no olvidar: **esto no anonimiza, formaliza.** Esa misma
tabla resuelve cualquier código, así que quien necesite el nombre lo encuentra en el propio
documento. Lo que cambia es que el texto deja de leerse como un señalamiento.

⚠️ **Va en dirección contraria a la nota de `AGENTS.md`** —«se cita por nombre, decisión de
Gabriel»—, que regulaba nombre frente a **cargo**, no frente a código. Se avisó a Jesús y
decidió avanzar. **Queda pendiente revisarlo con Gabriel.**

### Las citas del bloque de argumento pasan a prosa

Los capítulos **1, 12, 13, 14 y 15** son argumento, no evidencia: su prosa ya afirma lo que la
cita repetía —«el MRP no corre», «la nómina lleva siete años sin interfaz»— y la cita solo
reforzaba, en registro coloquial. Ahí el bloque de cita se sustituye por **una línea de
fuentes** al pie: `*Fuentes · ENT-003 · ENT-004*`.

```
levantamiento (2-11):  169 citas textuales, intactas
argumento (1,12-15):    20 líneas de fuentes
```

⚠️ **Los capítulos del levantamiento las conservan, y no es negociable**: ahí la cita no
ilustra, **prueba**. Borrarla dejaría al informe diciendo cosas que nadie dijo, que es
literalmente lo que `AGENTS.md` advierte.

### El respaldo

```
Insumos/Respaldo_Informe_2026-09-17_antes-de-anonimizar/   992 KB
  informe.json          las 15 filas tal cual — es lo que restaura
  informe-completo.md   las 15 seguidas
  secciones/NN-slug.md  una por sección
```

Se usó el script del proyecto, no un formato inventado. Para devolverlo:
`npm run respaldar:informe -- --restaurar "Insumos/Respaldo_Informe_2026-09-17_antes-de-anonimizar"`

Y hay una segunda red: **las 394 citas y los 34 nombres siguen intactos en la base**. El
informe los componía al vuelo, así que revertir es quitar una bandera del generador.

### Verificación

15 secciones en 200, **125 enlaces internos resuelven, 0 nombres fuera de la cobertura**. El
documento baja de 233.933 a 217.928 caracteres renderizados.

---

## 17 de septiembre de 2026 · Sesión 23 — vuelven los cuellos de botella, como par

Jesús pidió una sección de «puntos de dolor». **Ya existía**: en el armazón de 32 era «14 ·
Cuellos de botella y trabajo manual» y se cortó el 16 de septiembre con otras diecinueve. Se
le dieron cuatro opciones y eligió recuperarla **con su par**, que es lo que manda la regla 1.

```
09 · Dónde se traba el trabajo    los siete patrones, con su costo
10 · Inventario de trabas         las 149, por área
```

El nombre salió de las propias guías de entrevista —*«cuando algo se traba, ¿a quién
buscas?»*—, y se descartó «mapa del dolor» por metafórico: ningún otro título del documento lo
es.

**El documento pasa a 15 secciones.**

### ⚠️ Lo que casi se rompe al renumerar

Insertar dos secciones corre la numeración de la 09 a la 15. Y había **39 referencias
«capítulo N» escritas a mano en diez talleres**. Todas habrían apuntado a otra sección **sin
que nada avisara**.

Se sustituyeron por `{cap:slug}`, que el generador resuelve en la corrida contra `SECCIONES`
—y avisa si el slug no existe—. Se aplica en **un solo sitio**, justo antes de escribir en la
base: ponerlo en cada generadora sería olvidarlo en la siguiente.

Dos cosas que el reemplazo masivo rompió y hubo que devolver:

- **Las `nota` de los talleres** son documentación interna, no se renderizan: ahí el token
  nunca se resolvería. Vuelven a texto plano.
- **El diagrama de capas del {cap:arquitectura-ia}** tiene ancho fijo de 62 caracteres, y el
  token cambia el largo de la línea al resolverse. Se quitó la referencia de dentro de la caja.
  ⚠️ **En un dibujo monoespaciado no puede haber nada que se sustituya en tiempo de
  generación.**

### El contenido

**Siete patrones transversales**, cada uno en áreas que no hablan entre sí: la doble
transcripción, la espera por una firma, el sistema que tiene el dato y no lo da como hace
falta, el registro que llega tarde para servir, corregir cuesta más que equivocarse, el papel
que sube a la oficina, y **la traba de uno es la parada de otro** — que es el que justifica
que el capítulo exista, porque no se ve desde ningún área.

El cierre dice lo que más importa: **de los siete, cinco no necesitan un modelo**. Eso no los
hace menos importantes, los hace más baratos.

⚠️ **El inventario va por área, no por tipo.** Agrupado en «cuello de botella» contra «trabajo
manual» se lee como taxonomía y no dice a quién llamar; por área cada gerencia encuentra lo
suyo y ve cuánto carga comparada con el resto.

### La 09 pasa a formato de tablas

A petición de Jesús, el capítulo deja de ser prosa corrida. Ahora abre con un **cuadro de
mando de los siete patrones** —casos, áreas, con qué se cierra y si necesita un modelo— y cada
patrón lleva debajo su tabla de casos concretos: `Dónde · Qué se traba · Lo que cuesta`.

```
7 patrones · 28 casos · 6 se cierran sin modelo
8 tablas · 35 filas · 19 citas
```

⚠️ **El cuadro de mando no se escribe: se cuenta.** Los casos y las áreas de cada patrón salen
de su propia lista y la columna del modelo de su bandera. Un resumen tecleado sería un segundo
sitio donde vive el mismo dato, y al primer patrón que gane un caso dejaría de coincidir con la
tabla de abajo.

**Decisión: tablas, no barras de bloques.** Se descartó cualquier gráfico monoespaciado —barras
de `▓`, sparklines— por dos motivos: ya hubo dos sustos de alineación en este documento, y el
entregable acaba en PDF, donde un gráfico hecho con caracteres envejece mal. La columna
«¿Modelo?» con el **No** en negrita hace el argumento sin necesidad de dibujo.

---

## 17 de septiembre de 2026 · Sesión 22 — la 05 se pliega

«Las fichas de proceso» eran **49.940 caracteres en una sola página**, ilegibles de corrido.
Ahora se pliega por nivel. **La página pasa de todo ese scroll a 930 px** al cargar.

- **Tres bloques cerrados de entrada** —Estratégico 3, Operativo 9, Soporte 8—, cada uno con
  su cuenta de fichas en el resumen.
- **Chevron en el índice lateral** sobre la 05, que despliega los tres niveles y los veinte
  macroprocesos como enlaces directos a su ancla.

### La decisión: acordeón, no tres páginas

Se evaluó partir la sección en `/estrategico`, `/operativo` y `/soporte`. **Se descartó**:
rompía los 20 enlaces del mapa de procesos y los 60 de las fichas a hallazgos, ya verificados,
y obligaba a rehacer el generador de anclas. El acordeón resuelve la lectura sin tocar nada de
lo verificado, y es reversible.

### ⚠️ El riesgo de plegar no es visual, son las anclas

A las fichas apuntan **veinte enlaces desde el mapa de procesos, que es otra página**, y caen
dentro de bloques que pueden estar cerrados. `MarkdownPlegable` **abre el bloque que contiene
el id del hash** antes de dejar que el navegador salte, al cargar y en cada `hashchange`, y
rehace el scroll — el primer intento cae sobre un elemento sin altura.

Comprobado: **los 20 enlaces del mapa resuelven y el ancla directa abre su bloque.**

### Decisiones de implementación

- **El subíndice se saca del contenido, no del inventario.** Podría leerse el JSON, pero
  entonces índice y página dirían cosas distintas en cuanto una se regenerara sin la otra. Se
  parsean los encabezados, y el ancla la calcula el mismo `github-slugger` que usa `rehype-slug`.
- **El chevron es un botón aparte, fuera del enlace.** Anidado dentro, desplegar obligaría a
  navegar — lo contrario de lo que sirve.
- **`PLEGABLES` es una lista en la página, no un atributo de la sección**: plegar es una
  decisión de lectura, no una propiedad del contenido.
- ⚠️ **No hay regla de impresión, y no es un olvido**: un `<details>` cerrado oculta su
  contenido por el navegador y ocultar el `summary` no lo revela. Si algún día se imprime desde
  esta página, hay que abrir los bloques con JavaScript antes de `print()`. Queda anotado en el
  CSS.

Trampa repetida por tercera vez: **`
` escrito desde un script pierde la barra y se
convierte en salto de línea real**. Lo cazó `tsc`.

### 🔴 Y un bug de etiquetado que solo se veía mirando

Lo cazó Jesús: en el subíndice, **Estratégico conservaba el prefijo «Estratégico 1 · » y
Operativo y Soporte no**.

⚠️ **La causa: `\w` es ASCII.** El patrón que quitaba el prefijo dejaba de casar en la «é» de
«Estratégico», mientras «Operativo» y «Soporte» —sin acentos— sí se limpiaban. El resultado
era un índice donde un nivel se numeraba distinto de los otros dos. **Arreglado con `\p{L}` y
la bandera `u`**, y conviene recordarlo: en este proyecto todo el vocabulario lleva acentos, y
`\w` va a fallar siempre en el primero que los tenga.

El subíndice se numera ahora en jerarquía —`1. Estratégico`, `1.1. Dirección…`, `2. Operativo`,
`2.1. Planificación Integrada…`—, decidido así con Jesús.

### Y la numeración pasó al contenido

Primero se numeró solo el índice. A petición de Jesús **la numeración va ahora en los propios
encabezados** del documento: los niveles son `## 1 · Estratégico` y las fichas
`### 2.1 · Planificación Integrada…`.

⚠️ **Eso cambia el ancla de cada ficha**, porque el ancla la calcula `github-slugger` sobre el
texto del encabezado. **No rompió nada porque el enlace del mapa sale de la misma función que
el título** —`tituloDeFicha()`— y los dos lados cambiaron juntos. Un enlace escrito a mano sí
se habría roto; por eso no hay ninguno.

Comprobado tras el cambio: **los 20 enlaces del mapa y los 60 de las fichas a hallazgos
resuelven**, con anclas nuevas del tipo `22--gestión-de-compras-y-abastecimiento`.

Y **el índice dejó de calcular su propia numeración**: la lee del título. Antes la contaba por
posición, y eran dos numeraciones que podían separarse — si el inventario reordenaba un
macroproceso, el índice habría dicho «2.5» y la ficha de destino otra cosa.

⚠️ El orden de los niveles **se deriva del inventario**, no está escrito: si mañana se añade
uno o se reordenan, la numeración lo sigue en vez de mentir.

### 🔴 Y el submenú no llevaba a ninguna parte desde la propia página

Lo reportó Jesús: estando **ya en** `/informe/fichas-procesos`, pulsar cualquier entrada del
submenú no hacía nada. Desde otra sección sí funcionaba.

⚠️ **La causa: `history.pushState` no dispara `hashchange`.** Next navega la misma ruta con
`pushState`, así que la URL cambiaba —se veía el `#` nuevo— pero el listener de
`MarkdownPlegable` nunca corría, el bloque seguía cerrado y el navegador no podía saltar a un
destino sin altura. **Un enlace que parece roto y no da ningún error.** Medido antes de tocar
nada: 0 eventos `hashchange` en el clic.

Arreglado extrayendo `revelarAncla(id)` de `MarkdownPlegable` y llamándola desde el índice
cuando ya se está en esa página: se hace el `pushState` a mano y se revela el ancla. El
manejador **respeta Cmd/Ctrl/Shift y el botón central**, para no romper «abrir en pestaña
nueva».

Comprobado: los veinte enlaces del submenú abren su bloque y saltan, **desde la propia página y
desde otra sección**.

⚠️ Nota de método: la primera pasada de la prueba dio por roto el caso «desde otra sección».
No lo estaba — **la página de fichas tarda en montar y el `waitForTimeout` de 1.200 ms se
quedaba corto**. Se cambió por `waitForURL`. Conviene recordarlo: en esta sección, las esperas
fijas mienten.

---

## 17 de septiembre de 2026 · Sesión 21 — las veinte fichas, y «Quién lo contó» baja al pie

Se redactaron **las quince fichas que faltaban**. La 05 pasa de 5 a **20 de 20**, y el
generador ya no imprime advertencia. La sección creció de 33.268 a **49.940 caracteres
renderizados**, que es casi la mitad de lo que aporta al documento.

### «Quién lo contó» se movió, no se quitó

Jesús planteó quitarla de todas las fichas, para que se centren en el contenido y no en quién
lo dijo. **El diagnóstico era correcto y la solución no.**

La línea iba **entre «Quién lo ejecuta» y «Sistemas»** — o sea, interrumpiendo el contenido con
la procedencia. Pero quitarla costaba tres cosas: la ficha **absorbió el informe por área
justamente con esa línea** (regla 4 del armazón); es el atajo de quien tenga que validar los
392 hallazgos que siguen propuestos; y la Fase 2 la necesita para saber a qué sesión volver
por cada macroproceso.

**Se bajó al pie de la ficha, en cursiva y sin negrita.** El contenido manda y la trazabilidad
queda disponible sin competir. Acordado así con Jesús.

### Lo que las fichas dejaron ver al escribirlas

Escribirlas una por una hizo visibles cosas que el mapa por sí solo no muestra:

- **La proporción de procesos que no se ejecutan es desigual y dice mucho.** Capital Humano
  tiene tres de once —sin plan de formación, sin evaluación de desempeño—, que es la más alta
  del inventario.
- **Hay procesos ejecutados por el área equivocada, y son varios**: la facturación la hace
  Distribución; la liquidación de guías la opera Tesorería dentro de Distribución; el bono de
  productividad lo ejecuta TI; la metrología figura en Mantenimiento y la hace Calidad.
- **El «Dato disponible» no es uniforme y esa es la conclusión.** Almacén de materia prima es
  de los mejores del levantamiento; Producción es **no confiable justo donde más se usa**;
  Mantenimiento y Capital Humano sencillamente no existen.

### Verificación

Las trece secciones recorridas otra vez: **todas en 200, ninguna desborda, cero pendientes
visibles, cero errores de página**. 253.192 caracteres renderizados. Comprobado también que el
nombre de la sesión retenida sigue sin aparecer en las fichas.

**Dónde quedamos.** El documento está escrito de verdad ahora. Lo que falta no es redacción:
son los **392 hallazgos por validar**, que es lo que la hoja de ruta pone como primer punto de
control.

---

## 17 de septiembre de 2026 · Sesión 20 — la fuga de ENT-005, y las fichas no estaban hechas

Sesión que empezó revisando un hueco que señaló Jesús y terminó encontrando algo más serio.

### 🔴 ENT-005 estaba citada en el documento

`ENT-005` no puede cosecharse ni citarse. **Aparecía igual en dos secciones**, con nombre y
apellido:

- **05 · Fichas** — en «Quién lo contó» de dos macroprocesos, y acreditando una observación
  en «Lo que NO se hace».
- **02 · Cobertura** — una fila de la tabla con su nombre, cargo y duración, más su nombre
  como participante en dos comités.

⚠️ **La causa: `SIN_CONSENTIMIENTO` se creó al escribir el capítulo 8 y las generadoras
anteriores no la tenían.** `quienesContaron()` y la cobertura son del armazón de septiembre y
leen el inventario y la base directamente, donde ENT-005 sigue figurando como fuente de varios
procesos. **No citarla incluye no acreditarla**, y eso no estaba implementado.

Arreglado en los tres sitios. **Decidido con Jesús**:

- La fila de cobertura **se queda y se anonimiza**: `Sesión retenida · sin consentimiento de
  grabación`, sin nombre, cargo, área ni duración. Quitarla habría dejado un hueco en el
  conteo de 42 que citan otros tres capítulos.
- **Su nombre se filtra también de los comités** SES-001 y SES-002, aunque esas sesiones no
  estén vetadas. Criterio máximo: no aparece en ninguna parte del documento.

Comprobado: **cero apariciones de su nombre en las trece secciones**. Queda el código
`ENT-005` en la fila retenida, que es lo que sostiene el conteo.

⚠️ **Queda un resto por decidir**: la observación del proceso «Gestión de Quejas y Reclamos»
en el inventario dice «lo primero que automatizaría la Gerente de Calidad». Se le quitó la
acreditación, pero el texto la identifica por cargo y el contenido sale de su sesión. Vive en
`inventario-procesos.json`, que produce otro proceso.

### Las fichas estaban a medias, y yo las di por hechas

De los cinco campos de cada ficha, **solo se llenaron los dos que salen del dato**. Los tres
que son redacción quedaron como plantilla visible: **60 campos en 20 fichas**.

Mi reporte de aquella sesión —«las veinte fichas, con sus fuentes y sus hallazgos»— era exacto
sobre lo hecho y **nunca dijo lo que faltaba**, y sobre esa base llamé «completo» al documento.

Escritas **las cinco primeras** (Estratégico 1-3, Operativo 1-2). La prosa vive en
`contenido/informe/fichas-prosa.json`, con clave `«Nivel N»`.

⚠️ **El relleno es parcial a propósito y la plantilla se queda a la vista.** Veinte por tres
escritos de una sentada dan prosa de relleno; en blanco, los campos se vuelven invisibles. Y
**el generador ahora cuenta**: imprime `5 de 20 fichas redactadas · faltan 45 campos` en cada
corrida. Eso es lo que faltó la primera vez.

**Dónde quedamos.** Quince fichas, 45 campos. Y el documento **no está completo** — corregido
en el estado de arriba.

---

## 17 de septiembre de 2026 · Sesión 19 — el resumen ejecutivo: el documento está escrito

Se escribió **«01 · Resumen ejecutivo»**, que va primero y se escribió el último porque resume
a los demás. **El Documento de Arquitectura de IA está completo: 13 de 13 secciones, 252.077
caracteres.**

### Verificación de las trece, de una vez

Las trece secciones recorridas con sesión real: **todas en 200, ninguna desborda, cero errores
de página**. 231.173 caracteres renderizados.

```
01 resumen-ejecutivo    9.464     08 riesgo-continuidad  13.128
02 cobertura            8.349     09 hallazgos           40.472
03 cifras              27.791     10 oportunidades       25.096
04 mapa-procesos        2.607     11 donde-no-va-la-ia   16.907
05 fichas-procesos     27.855     12 arquitectura-ia     16.143
06 sistemas-datos      20.914     13 hoja-de-ruta         9.763
07 inventario-sistemas 12.684
```

### La regla que gobierna este capítulo

⚠️ **Ninguna cifra del resumen se escribe a mano.** Las siete —sesiones, entrevistas,
hallazgos, validados, oportunidades, macroprocesos y procesos— se calculan en la corrida desde
la base y desde el inventario, que es de donde las sacan los capítulos que resume. **Es la
sección donde más tienta escribirlas, porque son pocas**, y es donde más caro sale: un resumen
ejecutivo que no coincide con su propio capítulo es la forma más rápida de que el lector deje
de creer el documento entero.

### Cómo quedó

Está escrito para leerse **solo**. Quien no pase de esta sección sale con el encargo, el
diagnóstico en seis puntos, lo que ya funciona en la casa, la propuesta, lo que decide el
comité y lo que aprieta antes.

Dos decisiones de redacción que conviene conservar:

- **Lleva una sección de lo que ya funciona**, y no es cortesía. Un diagnóstico que solo
  enumera fallas se descarta: la API de EXA, el control de plagas, lo que construyó su propia gente y el
  inventario de materia prima son la prueba de que lo que se propone es realizable **porque ya
  está ocurriendo aquí**.
- **Cierra con la validación, no con la propuesta.** De los 394 hallazgos hay 2 validados, y el
  resumen lo dice en su propia sección de urgencias. Terminar con el plano habría sido más
  vistoso y menos honesto.

**Dónde quedamos.** El documento está escrito y **ninguna sección está publicada**: un lector
de Iberia todavía no ve nada, y no debe verlo mientras los hallazgos sigan en `propuesto`. Lo
que toca ahora no es escribir más, es **validar**.

---

## 17 de septiembre de 2026 · Sesión 18 — la 13, y el documento queda a una sección

Se escribió **«13 · Hoja de ruta»**: cinco bloques, siete citas, cuatro olas y su tabla de
puntos de control. 10.332 caracteres. El informe va en **242.494 caracteres · 12 de 13** —
solo falta el resumen ejecutivo.

### Lo que el capítulo promete, y lo que no

El subtítulo dice *secuencia, dependencias y puntos de control*, y eso es exactamente lo que
da. **No promete fechas de Fase 2**, y se dice por qué en la primera línea: dependen de una
decisión que se toma el 6 de diciembre. Comprometerlas antes sería inventarlas.

Lo único con fecha es lo que falta de la fase actual, porque esa sí está firmada.

### «La decisión» encontró casa

⚠️ Cuando se eliminó esa sección del armazón, quedó anotado que con ella se iba **el único
sitio donde vivía qué aprueba el comité al aprobar el documento**. Va ahora en el punto de
control del 6 de diciembre, que es su lugar natural: un punto de control sin criterio de
aprobación no es un punto de control.

Son **cinco cosas y no más**: las nueve reglas, las seis capas y la conexión al núcleo, el
orden de los tres grupos, lo que queda fuera, y que la capa de captura se presupueste aparte.
Y se dice también lo que **no** se aprueba: ni herramientas, ni proveedores, ni inversión.

*(⚠️ Cambió el 24 de septiembre: la ruta ahora es un paso 0 y tres olas de módulos del
sistema Iberia, y las cinco cosas que se aprueban son otras. Las fechas ya no se leen de
`lib/programa.ts`, porque la sección se escribe en Supabase. Ver sesión 37.)*

### El dato que abre y cierra el capítulo

**De los 394 hallazgos, 2 están validados.** Es el punto de control más urgente y el que no
puede hacer Boosty solo. El capítulo lo pone al principio como primer pendiente y lo repite en
el cierre, porque mientras siga así la hoja de ruta es una propuesta bien fundamentada sobre
material que Iberia todavía no ha confirmado.

### Decisiones de secuencia, con su porqué escrito

- **La ola 1 no lleva las doce oportunidades del grupo 1, sino tres o cuatro.** El objetivo de
  la primera ola no es cubrir, es demostrar — y la demostración es lo que financia el resto.
- **El gobierno va en la ola 1**, no después, porque la adopción ya empezó sin él y cada mes
  que pasa hay más material de Iberia en cuentas personales.
- **La captura va antes que los modelos.** La foto del anaquel no espera por presupuesto ni por
  tecnología: espera por dato que nadie está recogiendo.
- **Los puntos de control se responden con evidencia, no con avance porcentual.** El de la ola 1
  es el que más importa: *¿alguien que no sea de Boosty lo está usando solo?* Hay precedente de
  lo contrario en la propia casa — licencias de tableros compradas y sin usar, y un sistema de
  tesorería cancelado porque nadie lo abrió.

### Dos cosas que ya no se escriben a mano

⚠️ **Las fechas del contrato se leen de `lib/programa.ts`.** Es un `.ts` y el script es `.mjs`,
así que se extraen con expresión regular en vez de importarlo: feo, pero mantiene **una sola
fuente** para el calendario. El panel del programa y el informe no pueden decir fechas
distintas del mismo contrato.

⚠️ **Y el conteo de hallazgos validados sale de la base en cada corrida**, porque cambia todos
los días. Escrito a mano, el cierre del documento diría una cifra falsa en una tarde.

Trampa que costó una corrida: en un template literal, **`\d` pierde la barra invertida** y el
patrón pasa a buscar la letra «d». Fallaba en silencio devolviendo `null`, y la guarda —no
escribir si no hay fechas— fue lo que lo delató.

**Dónde quedamos.** Falta **01 · Resumen ejecutivo**, que va de última porque resume a las
demás y ahora sí tiene a qué referirse.

**Verificación de la 12 y la 13, hecha.** Las dos en 200 a 1440 y a 390 px, sin desborde, las
once anclas al capítulo 9 resuelven y cero errores de consola.

⚠️ **Y el 500 volvió a aparecer, con el mismo diagnóstico de siempre.** El servidor que quedó
vivo tras el corte por memoria —PID de las 9:38— servía `arquitectura-ia` con *«Jest worker
encountered 2 child process exceptions»*. **No era el contenido.** La receta de la bitácora
funcionó otra vez: matar el proceso, borrar `.next` y relevantar. Arrancó en 710 ms contra los
6,6 s del arranque bajo presión.

Detalle nuevo que conviene anotar: **cortar la tarea de fondo no mata el servidor**. Queda el
proceso `node` escuchando en el 3000 con los workers muertos, y `npm run dev` se niega a
arrancar diciendo que ya hay uno. Hay que matarlo por PID.

---

## 17 de septiembre de 2026 · Sesión 17 — la 12, el plano

Se escribió **«12 · La arquitectura propuesta»**: seis bloques, 15 citas, el diagrama de capas
y ocho enlaces al capítulo 9. 17.038 caracteres. El informe va en **232.162 caracteres · 11 de
13**.

### Las reglas van antes que el dibujo

En el armazón viejo «Principios» y «Gobierno del dato» eran secciones aparte. Aquí se
absorben, y el capítulo abre con **nueve reglas** antes de enseñar una sola caja. El motivo:
una arquitectura sin sus reglas se lee como un catálogo, y la fase 2 la ejecutaría eligiendo
herramientas sin saber qué no puede romper.

⚠️ **Ninguna de las nueve es doctrina importada.** Cada una se deriva de algo que el
levantamiento encontró, y lleva su origen al lado: *bandera, no acción* lo puso Contabilidad;
*alguien pregunta, nada sale solo a buscar* lo puso la Gerencia de TI y es la que más
condiciona el diseño; *ningún respaldo en una sola máquina* es la lección literal de febrero.

### Las seis capas, y la que falta

```
6 interacción · 5 asistentes · 4 dato gobernado · 3 integración
1 núcleo (JD/DB2/Power)    2 captura
gobierno y seguridad — transversal
```

**La capa 2, la de captura, es la que hoy prácticamente no existe**, y es la que condiciona el
calendario: sin ella el grupo 3 del capítulo 10 no arranca nunca. La capa 4 es la que resuelve
que tres áreas produzcan el mismo dato distinto, y no es un almacén de datos: es un acuerdo
escrito con un dueño por fuente.

### La conexión al núcleo, en una línea

**De lectura, libre; de escritura, por la puerta del ERP.** Ninguna capa escribe por su
cuenta: entra como lo hace EXA, presentándose al ERP como si lo hubiera transcrito una persona
para que dispare sus validaciones nativas. Consecuencia que se dejó explícita: **las reglas de
negocio no se reimplementan en la capa de IA**, porque duplicarlas garantiza que dentro de un
año digan cosas distintas.

### Lo que el plano declara que NO resuelve

Se escribió aparte y a propósito. **No hay nube**, así que **el riesgo físico sigue en pie** —
todos los servidores en el mismo edificio, con el historial que documenta el capítulo 8— y el
plano no debe fingir que lo resuelve. Tampoco fija productos ni proveedores: eso es decisión de
fase 2.

*(⚠️ Cambió el 24 de septiembre: la arquitectura se rehízo como el sistema Iberia —JD de
registro y un espejo delante— y ahora sí nombra productos, como recomendación de los
consultores. Las seis capas se fueron. Ver sesión 37.)*

### El diagrama, y una corrección mía

Va en bloque de código monoespaciado porque el renderizador no tiene mermaid. ⚠️ **Al revisarlo
di por roto lo que estaba bien**: las cajas parecían no cerrar. Medido, las 35 líneas son de 62
caracteres exactos y todos los glifos —incluidos los de dibujo— miden 7,8 px en Geist Mono. Lo
que se ve es el **interlineado**, que deja hueco entre los `│` de filas contiguas. Es cosmético
y legible; no se tocó `.prosa pre` por eso.

**Dónde quedamos.** Dos secciones: **13 · Hoja de ruta**, que ya tiene todo lo que necesita —los
tres grupos de oportunidades, las dependencias y la capa de captura como condicionante del
calendario—, y **01 · Resumen ejecutivo**, de última.

⚠️ **El servidor de desarrollo lo detuvo el sistema por memoria baja** al final de la sesión.
No es fallo del comando. Antes de seguir, liberar memoria y volver a levantarlo.

---

## 17 de septiembre de 2026 · Sesión 16 — la 11, y los cuatro filtros

*(⚠️ La sección salió del armazón el 24 de septiembre: lo que decía lo dice ahora cada módulo
del sistema Iberia, capacidad por capacidad. Ver sesión 37.)*

Se escribió **«11 · Dónde no va la IA»**, el par de la 10. Nueve bloques, 21 citas, siete
enlaces al capítulo 9 comprobados. 17.724 caracteres. El informe va en **215.124 caracteres ·
10 de 13**.

### El argumento: cuatro filtros antes de que algo sea IA

El capítulo **no es el negativo de la 10**. Tiene tesis propia: de todo lo que el levantamiento
pidió, una parte se resuelve **configurando** lo que ya está pagado, otra **conectando** dos
sistemas, otra **decidiendo y escribiendo** una regla, y otra **comprando un equipo o pagando
una licencia**. Lo que queda después de esos cuatro filtros es el programa de IA — y es más
pequeño de lo que parecía, y por eso realizable.

El filtro más incómodo es el cuarto, y por eso se dejó escrito con nombre: **los dos
supervisores de Distribución no tienen computadora**, el gestor documental se dio de baja por
impago, las cuentas de tesorería se cancelaron por desuso, SharePoint no fluye por permisos y
el antivirus no se aprobó antes de febrero. Cinco problemas serios y ninguno necesita un
modelo: necesita una orden de compra.

### Los límites los puso la empresa, no nosotros

La mejor parte del capítulo no la escribimos: la dijeron los entrevistados, casi siempre sin
que se les preguntara así.

- **Bandera, no acción** — Contabilidad, dos veces en la misma sesión.
- **Alguien pregunta; la IA no sale sola a buscar** — el límite arquitectónico más importante
  del documento, y lo puso la Gerencia de TI.
- **Lo que no se cuantifica no se decide por número** — Servicios Generales, sobre evaluar
  proveedores.
- **Tres perímetros de confidencialidad nombrados**: las investigaciones de PCP, los datos del
  servicio médico y las cámaras, que la propia TI se autolimita pese a tener la potestad.
- **Lo que exige la norma no se negocia** — COVENIN y la normativa de alimentos.
- **IA con perfiles y alcance por rol**, porque una IA conversacional abierta sobre la
  plataforma publica el mapa que un atacante necesita.

### Por qué decirlo importa, con dato

Se cerró con las tres razones, y dos son cifras del propio levantamiento: la autoevaluación de
uso de IA del equipo gerencial de planta fue **3, 3, 5, 4, 5 y algún 7 u 8** —con esa
dispersión, desplegar en todo a la vez no produce adopción—, y el temor ya se nombró en la
sesión de arranque: *que van a cortar al 30% de los trabajadores*. La tercera es de negocio:
**vender como IA lo que es configuración destruye la credibilidad del programa** el día de la
demostración.

### Lo que se mejoró del código

⚠️ **El 6 y el 11 se escriben igual, y eran dos funciones idénticas.** Se extrajo
`capituloConCitas()`. Antes, arreglar la guarda de citas en una dejaba la otra sin arreglar —
que es exactamente lo que había pasado con la guarda de cita repetida.

Y `donde-no-va-la-ia` salió de `BORRADORES`: ya no es prosa suelta.

**Dónde quedamos.** Tres secciones: **12 · La arquitectura propuesta**, que es el plano y ya
tiene sus insumos —las 33 oportunidades clasificadas, los límites de este capítulo y el
inventario de sistemas—; **13 · Hoja de ruta**; y **01 · Resumen ejecutivo**, de última.

---

## 17 de septiembre de 2026 · Sesión 15 — la 10, y la regla que ordena el programa

Se escribió **«10 · Las oportunidades, priorizadas»**, primera sección del bloque de
arquitectura: **33 oportunidades clasificadas de 33 que hay en la base**, 26.191 caracteres.
El informe va en **197.400 caracteres · 9 de 13**.

### La regla que produce el orden

**El dato manda sobre el impacto.** Una oportunidad de impacto alto cuyo dato no existe no va
primero: va después de construirlo, y construirlo es un proyecto con su propio plazo. Ordenar
por impacto e ignorar esto es exactamente cómo un programa de IA acumula pilotos que no llegan
a producción.

De ahí salen tres grupos:

```
Grupo 1 · dato disponible, se puede empezar ya      12
Grupo 2 · el dato existe sucio, paso previo corto    8
Grupo 3 · hay que construir el dato primero          9
No son oportunidades: son condiciones                4
```

**Y la consecuencia incómoda va escrita en el capítulo**: casi todo lo que más entusiasmo
genera está en el grupo 3 — la foto del anaquel, el mantenimiento por condición, el ruteo
inteligente. Buenas ideas sin dato detrás todavía. Decirlo ahí protege al programa de
prometer la foto del anaquel para el primer trimestre.

### Decisiones

- **Cuatro entradas clasificadas como oportunidad no lo son, y se separaron.** Las reglas de
  negocio del S&OP, la tesis de devolver tiempo de análisis, el desarrollo con IA sin gobierno
  y la adopción propia del gerente de distribuidores son **condiciones**, no piezas que se
  puedan escoger. Mezclarlas haría creer que son opcionales.
- **Se añadió el eje del consenso**, separado del orden por dato: cuántas voces independientes
  piden lo mismo. Siete el S&OP, cinco la foto del anaquel, cuatro el ruteo, tres devolver
  tiempo de análisis.
- **La dependencia más repetida no es técnica.** Aparece en nueve de las treinta y tres y
  siempre con la misma forma: *alguien tiene que decidir algo y escribirlo*. La política de
  inventario, las reglas de secuenciación, el formato único de sell-out, qué se hace cuando
  salta una alerta.
- **Se dice en el capítulo qué parte no es IA** —el asistente de la sábana de compras es en
  buena medida parametrizar el ERP—, porque decirlo ahí y no al pasar la factura es lo que
  separa un programa de un catálogo. *(⚠️ Cambió el 24 de septiembre: la explosión corre en el
  sistema Iberia, no en el MRP de JD. Ver sesión 37.)*

### La guarda nueva: cobertura en las dos direcciones

⚠️ El taller referencia cada oportunidad por el **título exacto de su hallazgo**, y el
generador comprueba **las dos direcciones**: que todo título del taller exista en la base, y
que **toda oportunidad de la base esté clasificada en algún grupo**. Imprime
`33 clasificadas de 33 · cobertura completa`.

Sin eso, reordenar los grupos deja caer una en silencio, que es el modo de fallar de una lista
que se edita a mano. El impacto y el área tampoco se escriben en el taller: se heredan del
hallazgo. El taller solo pone lo que es juicio de priorización — costo, dato y dependencias.

### Verificación

37 filas en cinco tablas, renderizado a 1440 y 390 px, sin desborde, cero errores de consola,
`tsc` limpio. La tabla de seis columnas mide 814 px y se lee entera.

**Dónde quedamos.** Quedan cuatro: **11 · Dónde no va la IA**, que es el par de esta y ya tiene
su material señalado desde los capítulos 6 y 10; **12 · La arquitectura propuesta**; **13 ·
Hoja de ruta**; y **01 · Resumen ejecutivo**, de última porque resume a las demás.

---

## 17 de septiembre de 2026 · Sesión 14 — la 03, y el bloque de levantamiento cerrado

Se escribió **«03 · Las cifras del levantamiento»**: **188 cifras de 31 sesiones**, en once
grupos temáticos más las discrepancias. 30.791 caracteres. Con esto **el bloque de
levantamiento queda completo**: las ocho secciones de la parte 1, 171.209 caracteres.

### El respaldo viejo no servía, y por qué

`310-anexo-cifras.md` tenía 97 cifras **de ocho sesiones** —el texto decía literalmente «las
ocho sesiones»— cuando hoy son 35 utilizables. Cubría menos de una cuarta parte y toda la
ronda 2 quedaba fuera. Se conservó **su estructura temática**, que seguía siendo la correcta,
y se rehízo la extracción sobre el resto. Los grupos nuevos son **el tamaño del negocio**, **el
dinero**, **la gente** y **los sistemas**, que son justo lo que la ronda 1 no alcanzó.

### Dos defectos del anexo viejo que ahora no pueden repetirse

🔴 **La atribución estaba escrita a mano y estaba mal.** Tres filas firmadas «Jesús · ENT-004»
—que es el consultor que condujo la sesión, no el entrevistado— y nueve firmadas con el área
en vez de la persona, cuando el informe cita por nombre. Las dieciséis son Luis Cáceres.

**Ahora la fila solo lleva el código** y el generador resuelve el nombre contra `entrevistas`.
El padrón manda y no se puede desviar.

⚠️ **Y cada cifra lleva marca.** Una cifra medida y una estimación de quien habló se parecen
mucho en una tabla y no son lo mismo. El reparto que salió:

```
159 dato · 15 estimación · 11 ejemplo · 3 sin confirmar
```

Importa porque varias de estas cifras terminan en la hoja de ruta, y comprometerse con un
ahorro calculado sobre una estimación es la forma más rápida de incumplir. El grupo de
capacidad de planta es el que más lo necesita: **los 280.000 cajas/mes los propios
entrevistados no los dan por firmes.**

### «Las cifras que no coinciden»

Sección nueva al cierre, con los **seis casos donde dos voces dieron números distintos para lo
mismo**. No se resolvieron a favor de ninguna: van las dos con su fuente, que es lo que
permite ir a cerrarlas con el área.

El más útil es el impacto de febrero —**4 días** según Contabilidad contra **casi 10 meses**
según Capital Humano—, que no es contradicción sino la distinción entre levantar y recuperar.
Y el más accionable, el umbral de variación de consumo: **3%** que el sistema devuelve contra
**5%** que exige explicación formal. Hay que cerrarlo antes de automatizar nada encima.

Esa sección es, además, la manifestación contable de **H-35**: no hay una sola fuente de
verdad. Dos áreas consultan el mismo maestro de clientes el mismo mes y dan 2.370 y 2.372.

### Verificación

188 filas en once tablas, renderizado a 1440 y a 390 px, **sin desborde en ninguno**, cero
errores de consola, `tsc` limpio. Comprobado además que no aparece ENT-005 y que ninguna fila
conserva la atribución vieja.

**Dónde quedamos.** Quedan cinco secciones y todas son de arquitectura o de cierre: **10 ·
Oportunidades**, **11 · Dónde no va la IA**, **12 · La arquitectura propuesta**, **13 · Hoja de
ruta** y **01 · Resumen ejecutivo**, que va de última porque resume a las demás. La natural es
la **10**, que ya tiene con qué priorizar: los 42 hallazgos redactados y estas 188 cifras.

---

## 17 de septiembre de 2026 · Sesión 13 — la 07, y una generadora que había que descartar

Se escribió **«07 · Inventario de sistemas»**, que cierra el par con la 06. **27 sistemas en
ocho capas más los proveedores**, 13.695 caracteres. El informe va en **140.418 caracteres ·
7 de 13**, y con esto **el bloque de levantamiento queda completo salvo «Las cifras»**.

### La generadora vieja no servía, y conviene que quede dicho por qué

`anexoInventario` construía el inventario listando los hallazgos de `tipo = 'sistema'`. Eso
no es un inventario de sistemas: **son hallazgos *sobre* sistemas**. La columna «Sistema»
habría dicho «El MRP no corre en el ERP» y «Almacén de repuestos con inventario mínimo de dos
unidades». Además no traía **dueño ni estado**, que es justo lo que promete el subtítulo, y le
colgaba una tabla con los documentos del expediente, que no son sistemas.

Se dejó escrita por si el anexo vuelve. El capítulo sale ahora de
`contenido/informe/inventario-sistemas.json`, que es criterio editorial: qué cuenta como
sistema, en qué capa va y en qué estado está.

### El rastro se cuenta, no se teclea

Cada sistema lleva sus **alias** y el generador busca en cuáles de las 35 notas aparece. Un
inventario con las sesiones escritas a mano envejece a la primera cosecha, y esa cifra es lo
que un lector usa para calibrar cuánto pesa cada sistema. Hasta cuatro sesiones se enumeran;
a partir de ahí va el número, porque **JD Edwards aparece en 29** y enumerarlas llena la celda
sin informar.

⚠️ Los alias son expresiones regulares **con frontera de palabra**: `JD`, `EXA`, `ATC` y `SPI`
aparecen dentro de otras palabras. Y los nombres largos llevan sus variantes de escritura —
«Star Quality», «StarQuality», «Star Point».

### Lo que el inventario deja ver

- **Cinco sistemas perdidos contra uno integrado de verdad.** Star Quality, el sistema de
  laboratorio, el gestor documental, SAGE/XRT y el instalador del sistema de clínica, contra
  EXA, que es el único conectado por API. Tres se los llevó el ataque y dos se cayeron por
  decisiones administrativas — impago y cancelación por desuso—, y el efecto operativo es el
  mismo.
- **El perímetro es casi todo propio.** Salvo Microsoft 365 y las plataformas de terceros,
  todo corre dentro del edificio: control, y riesgo concentrado en el mismo sitio.
- **La IA ya está adentro en ocho sesiones**, sin licencia ni gobierno.
- Se añadió una tabla de **proveedores**, porque en varios casos la capacidad de cambiar un
  sistema no está dentro de la empresa: Infocen no deja tocar los programas sin perder la
  garantía, y el implantador original dejó la instalación a medias.

### Verificación

Renderizado a 1440 y a 390 px. **Sin desborde en ninguno de los dos**: la tabla mide 487 px en
el teléfono y se desplaza dentro de `.tabla-scroll`, que es como está diseñado. Cero errores
de consola, `tsc` limpio. Las notas largas de cada sistema van **debajo** de la tabla y no en
una celda: tres líneas de prosa en una celda rompen el ancho en teléfono.

**Dónde quedamos.** Quedan seis secciones, todas fuera del levantamiento salvo **03 · Las
cifras del levantamiento**, que es la que falta para cerrar el bloque. ⚠️ No es generada: salía
de `NUMEROS.md`, que ya no está en el taller, y **hay que recuperarlo del respaldo del 16 de
septiembre** o rehacerlo del dato.

---

## 17 de septiembre de 2026 · Sesión 12 — la 06, y el argumento que da vuelta al diagnóstico

Se escribió **«06 · Sistemas y estado del dato»**, sexta sección: 22.314 caracteres, nueve
apartados, 33 citas y doce enlaces al capítulo 9, comprobados contra el ancla real. El
informe va en **126.723 caracteres · 6 de 13**.

### La tesis del capítulo

**El problema de Iberia no es que le falte sistema: es que el que tiene se configuró
incompleto y la empresa aprendió a trabajar alrededor.** JD Edwards ya tiene las fórmulas
con mano de obra y tiempos de máquina, la traza completa de cada orden, las rutas con cajas
y kilos, la hora a la que recibe cada cliente y el gasto por centro de costo. Nada de eso se
usa. Y el cálculo que dispara todas las compras de la empresa —la explosión de materiales—
vive en un Excel, teniendo el ERP módulo de MRP.

La brecha que describe el capítulo **no es entre lo que hay y lo que haría falta, sino entre
lo que ya está pagado y lo que se explota**. Eso cambia el orden de la fase siguiente: buena
parte de lo que se pidió en las entrevistas no necesita un modelo, necesita terminar de
configurar el ERP. *(⚠️ Matizado el 24 de septiembre: lo que es de JD se configura en JD; lo
que JD hace mal o no trae —la explosión entre ello, que se probó y se desbordó— se construye
en el espejo. Es la regla 8 de la arquitectura. Ver sesión 37.)*

El resto del argumento, en orden: dónde vive el dato que el ERP no tiene (Excel, papel,
WhatsApp, correo, Access); que los sistemas no se hablan —siete años sin interfaz contable
con la nómina— salvo EXA, que sí y demuestra que se puede; que el ERP monomoneda se paga en
horas de Excel; **qué dato es confiable y qué dato no**, graduado en cuatro niveles; y que no
hay una sola fuente de verdad, porque tres áreas producen el dato de ventas y no coincide.

### Decisiones

- **El capítulo no lleva tabla de sistemas.** Ese es el 7, que sale de la base. Van en
  pareja —el 6 afirma, el 7 enseña la evidencia— y dos tablas del mismo material se
  desincronizan. El cuadro que sí lleva es otro: los **soportes** (Excel, papel, WhatsApp,
  correo) sobre los que se apoya la operación cuando el ERP no llega. Queda anotado en el
  código para que no se reintroduzca.
- **Se gradúa la confiabilidad del dato en cuatro niveles** en vez de afirmar que «el dato es
  malo». Hay dato confiable hoy (inventario de materia prima), recuperable con un paso previo
  (causas de parada en texto libre), **no confiable** (las paradas anotadas de memoria, y las
  horas de arranque mal clasificadas que inflan la eficiencia al doble) e inexistente (merma,
  mantenimiento). Sin esa gradación no se puede decidir qué se construye primero.
- **Se registra que la adopción ya empezó sin gobierno**: hay desarrollo con IA en producción
  hecho a título individual, y uso de IA en cuentas personales. Ninguno malintencionado, todo
  sobre material bajo NDA. El programa llega a ordenarlo, no a iniciarlo.

### Lo que se mejoró del código

- **El pegado de citas es ahora común** (`pegarCitas`), y con él viajan las dos guardas que
  ningún capítulo puede saltarse: la de consentimiento y la de cita repetida. Antes vivían
  dentro del generador del capítulo 8.
- ⚠️ **Un capítulo que referencia hallazgos sueltos los nombra por título, nunca por número.**
  El número es la posición en el capítulo 9: en cuanto se inserte un hallazgo antes, un
  `H-37` escrito a mano apunta a otro. `enlacesAHallazgos()` resuelve el número en cada
  corrida y avisa si el título no existe.
- `sistemas-datos` salió de `BORRADORES`: ya no es prosa suelta, se genera del taller.

**Dónde quedamos.** Quedan siete secciones. La natural es **07 · Inventario de sistemas**,
que cierra el par y ya tiene generadora escrita (`anexoInventario`): es reconectarla y
revisar lo que saca.

---

## 17 de septiembre de 2026 · Sesión 11 — la 08, y dos cifras que no se sostenían

Se escribió **«08 · Riesgo y continuidad»**, quinta sección del informe: el incidente de
febrero visto desde las áreas, no desde TI. Quedó en 13.749 caracteres, con 17 citas y los
seis enlaces al capítulo 9 comprobados uno a uno contra el ancla real. El informe va en
**104.409 caracteres · 5 de 13**.

El capítulo se apoya en una distinción que puso el coordinador de infraestructura y que
ordena todo lo demás: **una cosa es levantar y otra recuperar**. El argumento central es que
el ataque no se llevó archivos, se llevó capacidades — el indicador de merma que se perdió y
nunca volvió es el caso limpio—, y que **el único respaldo que funcionó en toda la empresa
fue el papel**, en Calidad y en Crédito y Cobranza.

### Dos cifras que estaban mal, y de dónde salían

- 🔴 **El subtítulo decía «treinta y cuatro entrevistas» y son diecisiete.** Era un número
  puesto a ojo al montar el armazón. Contado sobre las notas: diecisiete sesiones hablan del
  ataque, catorce con hallazgo documentado. Un número inflado en la primera línea de un
  capítulo sobre pérdida de datos es justo lo que un lector usa para dejar de creerte.
- 🔴 **`ENT-005` entraba en el conteo, y no puede usarse.** La entrevistada fue grabada sin
  saberlo y pidió que se borrara. No citarla no basta: contarla para afirmar «el ataque
  aparece en N sesiones» es usar su material por la puerta de atrás. Se descuenta del
  numerador y del denominador — de ahí 17 sobre 35 y no 18 sobre 36.

**El conteo ya no se escribe a mano**: lo calcula `sesionesDelAtaque()` sobre las notas y lo
imprime en cada corrida. Si se resuelve el consentimiento de ENT-005, se saca de
`SIN_CONSENTIMIENTO` y la cifra se corrige sola.

### Lo que se rompió y se arregló en el camino

- **La misma cita salía dos veces**, en dos bloques distintos de la misma página: la de
  Martha Fuentes sobre el proveedor de respaldo sostiene a la vez el relato del ataque y el
  del respaldo, y al escribir el taller eso no se ve. Ahora el generador omite la repetida y
  avisa.
- **Falso positivo en el conteo**: `SES-004` habla de un «ataque de plagas» —gorgojos en las
  especias— y entraba como si hablara del ciberataque. Es el único del corpus y va excluido
  por nombre.
- **La guarda de consentimiento vive en el generador**, no solo en la cosecha: el taller se
  escribe a mano y nadie se acuerda de la lista al pegar una cita.

### Decisiones

- **El capítulo registra también lo que se hizo bien.** Los servidores nuevos, el TrueNAS
  con inmutabilidad, la cinta que sale del edificio, el Kaspersky y la auditoría en curso van
  con el mismo detalle que las pérdidas. Un capítulo de riesgos que solo enumera fallos se lee
  como un reproche y se descarta.
- **Cierra apuntando a la arquitectura**: ningún componente nuevo puede sumar un punto único
  de falla ni apoyarse en un respaldo que viva en una sola máquina.

### Ojo con esto

- 🔴 **El repositorio sigue público** y ya tiene dentro la bitácora con las citas del
  levantamiento y el detalle del ataque. Hace falta un administrador de la organización:
  `gh repo edit Boosty-Hub/iberia --visibility private --accept-visibility-change-consequences`.
- 🔴 **`RowerConsultoria` tiene permiso de escritura** sobre el repositorio y sigue sin
  saberse de quién es. Cuenta personal creada el 17 de julio, sin organización.
- **Dependabot reporta 6 vulnerabilidades** (4 críticas, 2 altas) en las dependencias. No se
  tocaron: actualizar en mitad de la escritura del informe puede romper el render.
- ⚠️ **`AGENTS.md` dice «28 secciones» y habla de «La decisión» y de los cuatro anexos.** Es
  del armazón viejo; el vigente son 13 secciones sin anexos. Hay que corregirlo.
- ⚠️ **«las 36 sesiones» no es lo mismo que «las 42 del levantamiento»**: 36 son las notas
  extraídas. El capítulo dice «sesiones con nota» para no confundirlas.

**Dónde quedamos.** Siguen sin escribir ocho secciones. La natural es **06 · Sistemas y
estado del dato**, que hace par con **07 · Inventario de sistemas** y tiene material de
sobra en ENT-020 y ENT-021.

---

## 16 de septiembre de 2026 · Sesión 10 — el inventario contra las entrevistas, y el armazón nuevo

Se cerró la extracción de las 36 notas de entrevista y con ellas se validó el mapa de
procesos contra lo que dijeron las personas que los ejecutan. El resultado obligó a rehacer
el armazón del informe.

### El mapa de partida no describía la empresa

De los **47 procesos N1 del inventario original, 30 se confirmaron**, 6 resultaron no
ejecutarse y 11 tenían mal el dueño. Y faltaban **cinco macroprocesos enteros** —más uno
recomendado— que sí se ejecutan y no estaban en el papel. El inventario pasó de 14/47 a
**20 macroprocesos y 142 procesos vigentes**.

Los ocho que más se repitieron en las entrevistas: **S&OP y la explosión de materiales**
(siete voces independientes), la **maquila en las dos direcciones**, la **facturación que
ejecuta Distribución** y la **cobranza de calle que hace Comercial** — ninguno de los cuatro
existía en el mapa. Y dos hallazgos que el mapa no podía mostrar: la empresa **no está
certificada en ISO** pese a que se afirma internamente, y los indicadores que destruyó el
ataque de febrero **nunca se reconstruyeron**.

Todo está en `Insumos/Validacion_Inventario_vs_Entrevistas.md` y en el Excel **V2**
(`Inventario_Macroprocesos_Procesos_V2.xlsx`), que colorea cada proceso por estado. **El V1
no se tocó**: son dos archivos.

### Decisiones de esta sesión

- **El informe web es el Documento de Arquitectura de IA completo**, no solo el entregable
  de entendimiento: en la Fase 2 otro consultor lo usa como insumo íntegro. Por eso el
  armazón incluye arquitectura, hoja de ruta y la decisión.
- **Los procesos que no se ejecutan salen del mapa y del conteo**, pero no del informe: van
  al pie de la ficha de su macroproceso, bajo «Lo que NO se hace», con su cita. Una ausencia
  suelta en un anexo no es un hallazgo; pegada al proceso que le falta, sí.
- **Una ficha por macroproceso (20), no por proceso N1 (142).** A media página, 142 fichas
  son 71 páginas y el entregable se convierte en el manual de procesos que las guías dicen
  explícitamente no estar produciendo.
- **La prosa vieja se queda por ahora.** Está respaldada y se decide sección por sección.

### El armazón · **13 secciones en blanco**

Se montó primero uno de 32 secciones que conservaba la prosa anterior. **Jesús lo revisó esa
misma tarde y lo rehízo entero**, y esto es lo que quedó — no lo de 32, que ya no existe:

- **Todo el contenido se borró.** Los 155.232 caracteres eran «relleno básico» escrito antes
  de procesar las entrevistas. Respaldado en `Insumos/Respaldo_Informe_2026-09-16_antes-de-vaciar`.
- **Trece secciones**, en tres partes. **Sin anexos**: lo que era anexo se volvió sección y
  entró pegado al argumento que sostiene. El orden va **por pares —una sección afirma y la
  siguiente la respalda**: *Cobertura* / *Las cifras*, *Sistemas y estado del dato* /
  *Inventario de sistemas*.
- **«Los hallazgos» cierra el levantamiento**: es la bisagra, todo lo anterior los construye y
  todo lo posterior actúa sobre ellos.
- **El informe por área desapareció como sección** y lo absorbe *Las fichas de proceso*, que
  gana una línea «Quién lo contó». Cortar el mismo material por proceso y por área obliga a
  contarlo dos veces y las dos versiones se desincronizan. La columna vertebral del documento
  es el mapa de procesos, no el organigrama.
- **«La decisión» se eliminó** a petición de Jesús. ⚠️ Con ella se fue el único sitio donde
  vivía lo que el comité aprueba al aprobar el documento; si hace falta, hay que buscarle
  casa.
- **Las generadoras quedaron desconectadas, no borradas**, y se reconectan de una en una
  a medida que se revisa cada sección. Al cierre del día iban **dos: «Cobertura del
  levantamiento» y «El mapa de procesos»**. El resto sigue fuera de `GENERADAS`, con su
  código en el script y `contenido/informe/inventario-procesos.json` en su sitio.
  ⚠️ **«Las cifras del levantamiento» no es generada** —salía de `NUMEROS.md`, que ya no
  existe en el taller, igual que `HALLAZGOS.md` y `MAPA.md`—; se recupera del respaldo.
- Al reconectar, tres cosas que el dato desmintió: la cobertura por área se contaba solo
  por `entrevistas.area_id` y daba 10 áreas «no escuchadas», cuando **varias sí están por
  boca de quien asistió** —Laboratorio entre ellas—; ahora suma los participantes y son 5.
  El mapa decía «treinta y seis sesiones» a mano cuando son 42. Y mezclaba los 11 procesos
  que no se ejecutan con los 3 sin evidencia.
- ⚠️ **Los enlaces del mapa a las fichas son ahora entre páginas.** Con una sección por
  ruta, un `#ancla` a secas se queda en el mapa y no lleva a ninguna parte: el destino
  tiene que ser `/informe/fichas-procesos#…`.

### El informe dejó de ser una sola página

**Cada sección es ahora su propia página**: `/informe/[slug]`. `/informe` quedó como portada
—título, cifras, nota de confidencialidad y el índice completo— y el índice es la navegación.

- **El índice vive en el layout, no en la página.** Así no se vuelve a montar al cambiar de
  sección, el scroll de la columna se conserva y el destino activo se marca solo. Va a la
  izquierda con el lenguaje de la barra del panel: columna blanca de 256 px, borde a la
  derecha, y el activo en rojo tenue —no en bloque sólido, que en una barra blanca pesa como
  un botón de acción y compite con los de la página.
- **La portada repite el índice a propósito.** En pantalla ancha duplica la barra; en teléfono,
  donde la barra no está, es la única forma de navegar.
- **Cada sección lleva «anterior / siguiente».** Un documento se lee de corrido, y obligar a
  volver al índice entre sección y sección lo rompe.
- **Un slug que no existe da 404**, y para un lector de Iberia una sección sin escribir
  tampoco existe: no llega a ella ni escribiendo la URL.

⚠️ **`/informe` solo pintaba secciones con texto, así que el armazón vacío no se veía.**
Ahora **un editor ve las trece** con su marca «Por escribir» y el contador dice *0 / 13*; el
lector de Iberia sigue viendo solo lo escrito y publicado, que es lo correcto.

⚠️ **`npx prettier` sin más reformateó `app/informe/page.tsx` con comillas dobles y punto y
coma.** El repositorio no tiene `.prettierrc`, así que prettier aplica sus valores por
defecto, que son lo contrario del estilo del proyecto. **No correrlo a pelo** — se deshizo
reescribiendo el archivo.

### Dos formas de perder contenido, tapadas

⚠️ **Una generadora que devuelve `null` borraba la sección.** `null` no es `undefined`, así
que `contenido_md` se guardaba vacío: sin su archivo del taller, el anexo se regeneraba a
nada y se llevaba por delante lo que ya estaba escrito. Ahora, sin fuente no se escribe y el
script dice qué secciones dejó intactas.

⚠️ **Y `indiceDeHallazgos()` devolvía la introducción con la tabla vacía**, que no dispara la
guarda anterior porque no está vacío. Sin hallazgos que indexar devuelve `null`.

`--podar` borra las secciones que quedan fuera del armazón **y están vacías**. Las huérfanas
con texto no se borran nunca, ni con la bandera.

### La cosecha de hallazgos · de 8 a 37 sesiones

Se cosecharon las 29 sesiones que faltaban. **De 236 hallazgos a 394**, todos con cita
textual, y de 8 sesiones cosechadas a **37 de 42**.

| Bloque | Sesiones | Hallazgos |
|---|---:|---:|
| Comercial | 10 | 54 |
| Finanzas | 4 | 23 |
| Cadena de valor | 4 | 26 |
| Gente, seguridad y calidad | 3 | 23 |
| Tecnología | 3 | 16 |
| Recorridos y comités | 5 | 16 |

⚠️ **Las citas de las notas no servían tal cual.** Al contrastarlas contra la transcripción,
varias estaban levemente reformuladas —`ENT-031` dice literalmente «ISO, no estamos
certificados», no «Nosotros no estamos certificados ISO»—. Todas las cargadas son **el turno
exacto**, extraído de `transcripcion_segmentos`. Convención: `…` marca elisión y los
corchetes corrigen errores evidentes de Fireflies (`[EXA]`, `[DAX]`), nada más.

**Criterio: selectivo, no exhaustivo.** Al ritmo de las primeras ocho sesiones —61 hallazgos
por cada 1.000 turnos— habrían salido ~1.500 candidatos, que no es un catálogo sino un
vertedero. Se descartó todo lo que describe sin sostener una decisión.

**Cinco sesiones quedan sin cosechar, y las cinco por una razón:**
- `ENT-005` — grabada sin consentimiento; no puede cosecharse ni citarse.
- `ENT-029` — programada, todavía sin hacer (0 turnos).
- `FOR-001`, `FOR-002`, `SES-006` — **4.515 turnos que no contienen hallazgos de proceso**:
  son el consultor enseñando a usar la herramienta y la reunión con la agencia. Comprobado
  con un barrido por señales, no por lectura completa.

⚠️ **`SES-002` tiene siete hablantes sin identificar** y de ahí salen tres hallazgos de
gobierno. La cita es literal, pero **no se pueden atribuir por nombre** hasta que alguien que
estuvo en la sala los reconozca. Lo mismo aplica a `SES-005` en parte.

### La sección 09 · los hallazgos

**42 hallazgos redactados de los 394**, en siete bloques temáticos, con **101 citas**. El
criterio: impacto alto, y al menos dos voces independientes o una consecuencia medible.

La prosa vive en `contenido/informe/hallazgos-destacados.json` porque es criterio editorial
y no sale del dato. **Las citas no se copian ahí**: el generador las lee de la tabla
`hallazgos` por la pareja (entrevista, título), de modo que la cita del informe y la que
Iberia valida en el panel sean siempre la misma. Si alguien renombra un hallazgo, la
referencia deja de casar y el script lo dice en vez de publicar un hueco.

⚠️ **La primera versión metía los 394 en tablas y estaba mal por dos motivos.** El
editorial —un índice de cientos de filas no lo lee nadie, y el detalle vive en el panel— y
el práctico: 421 filas de tabla en una sola sección. Se sustituyó por un cuadro de reparto
por área, 27 filas.

⚠️ **Y hubo un 500 que no era del contenido.** `/informe/hallazgos` devolvía «Jest worker
encountered 2 child process exceptions» sin más traza, y el servidor servía el error
cacheado. **Era el servidor de desarrollo degradado** tras el aviso de memoria del sistema:
con `rm -rf .next` y reinicio limpio, renderiza. Ante un 500 sin traza útil en esta app,
reiniciar antes de sospechar del contenido.

### La sección 05 · las veinte fichas

Cada ficha trae ahora **quién lo contó** —las sesiones que documentaron más de uno de sus
procesos, con el nombre de quien habló— y **sus hallazgos**, enlazados al capítulo 9. Son
**60 enlaces** entre las dos secciones, y con ellos los **20 del mapa** ya caen en su ficha:
el documento se recorre entero sin volver al índice.

⚠️ **La atribución de hallazgos a fichas no se puede inferir.** Se intentó cruzando las
sesiones del macroproceso con las del hallazgo, y un macroproceso que cita una sesión por un
proceso tangencial hereda todo lo suyo: a Capital Humano le caía un hallazgo sobre la
recepción del laboratorio, y S&OP se llevaba 27 de los 42. Estrechar el cruce a las sesiones
«principales» dejaba a Compras sin ninguno, teniendo nueve voces. **Va explícita**, en el
campo `macros` de `hallazgos-destacados.json`: es criterio editorial, como la selección.

⚠️ **Y el ancla de un hallazgo se calcula sobre el encabezado completo**, `H-01 · Título`,
no sobre el título solo: el separador deja su hueco y el id real lleva doble guion
(`h-01--la-explosion…`). Construirlo a mano dejó los sesenta enlaces apuntando a la nada, y
sin error visible en ningún sitio.

### ⚠️ La máquina se está quedando sin memoria

Los 500 de `/informe/hallazgos` y `/informe/fichas-procesos` **no eran del contenido**: los
procesos de render de Next se caen con «Jest worker encountered 2 child process exceptions»
y el servidor repite el error cacheado. Medido durante la sesión: **0,9 GB libres de 7,8**.
El sistema mató además dos tareas de fondo por lo mismo.

Receta: `rm -rf .next` y reiniciar `npm run dev`. Tras el reinicio las tres secciones
grandes renderizan sin problema. **Ante un 500 sin traza útil en esta app, reiniciar antes
de sospechar del contenido.**

### Dónde quedamos

Trece secciones, cero caracteres, ninguna publicada. Lo siguiente es **escribir**, y el
primer paso no es redactar: es **cosechar los hallazgos de la ronda 2**. Ahora se nota más
que nunca, porque ya no queda prosa vieja tapando el hueco.

---

## 31 de agosto de 2026 · Sesión 9 — la ronda 2, la formación directiva y Ajito hablando

Doce transcripciones nuevas: la ronda 2 completa, el Petit Comité del 26 y la reunión de
comunicaciones con Fuguet. **La base pasa de 15 sesiones a 27 y de 10.481 turnos a 20.011**;
el levantamiento, de 9 entrevistas a **19 de ~25**. Y entró la clave de Anthropic con saldo,
así que Ajito contesta por primera vez.

### Lo que trajeron las transcripciones

**El comunicado oficial salió, y no lo trajimos nosotros.** Consta en `SES-006`, por boca de
Carlos Quintana: «tomando en cuenta que ya salió el comunicado (…) queremos ahora que salga
algo dentro del boletín». Era el pendiente más viejo de la lista. Falta el dato duro —qué
día, por qué vía, a quién llegó— y por eso no se da por entregado. De la misma reunión salió
un **comité de comunicaciones a tres patas** —Iberia, Fuguet y Boosty—, que es la vía más
corta para cerrar la cadencia de gobierno de la cláusula 10; Alberto y Martha Fuentes no
estaban en la llamada y falta que lo aprueben.

⚠️ **Un archivo venía mal rotulado y por poco perdemos una entrevista entera.**
`Entrevista-Beatriz-Parte-2` no es la parte 2 de Beatriz: **es la sesión de Compras** —José
Acevedo y Josgleisy Ascanio, 83 minutos— que se daba por no hecha. Se cazó leyendo el primer
minuto, donde la conductora dice «lo primero que necesito es que **ustedes** me digan sus
nombres». Con ella la ronda 2 cierra en diez sesiones y no en nueve.

**El padrón de Capital Humano resultó ser el árbitro de los nombres.** Fireflies transcribe
por sonido: «Paola Mancillo», «Beatriz Nazaret», «Juan Pablo Yepes», «Glaciar Caño», «Pedro
Ruiz Méndez». Cotejados contra las 276 fichas quedaron Paola Mansilla, Beatriz Vieira, Juan
Pablo Yépez, Josgleisy Ascanio y Pedro Méndez, con su cargo real. De paso cazó dos errores
viejos: **«Ana Karina Vázquez» era Vargas** y **«Vasco» es Vasco De Freitas, Director
Gerente**, a quien Jesús describe en `ENT-013` como «el director general, el accionista
mayoritario». Corregidos con `corregir-nombre.mjs`.

**Quedan tres hablantes sin identificar, y son de la directiva: los speakers 5, 6 y 7 de
`FOR-002`.** Entre ellos están Antonio Sorrentino y Gustavo Carballo, pero cuatro horas con
siete voces no dan para cerrarlo desde el texto. Quien estuvo en la sala los reconoce de una;
no se les inventa nombre.

**Contra el mapa de macroprocesos: de 7 a 10 de 14**, y de ~20 a **33 de los 47 procesos N1**.
Cerraron E3, S4 y S5; S3 entró completo; S1 quedó a una sesión. **Y las cuatro que faltan son
exactamente Caracas**: Dirección, Planificación Comercial, Comercialización y Ventas, y
Tecnología de la Información. La ronda 1 remitía siempre a las mismas cuatro puertas y la
ronda 2 abrió tres.

🔴 **Yelitza Pérez, de Crédito y Cobranza, no vino.** *(Se entrevistó después, el 10 de
septiembre: `ENT-023`.)* Es la puerta que más veces nombra la
ronda 1 —la liberación que comprime el despacho— y sigue sin levantar.

✅ **Las guías nuevas midieron bien.** Seis de las diez sesiones cayeron entre 62 y 86 minutos
contra los 60 planificados y ninguna quedó a medias. Es la corrección de la ronda 1, donde la
guía estimaba 90–150 y ninguna llegó a 90.

### La formación de la directiva

Cuatro horas, y cada participante salió con su cuenta trabajando sobre un archivo propio:
listas de precio y venta, proyecciones, márgenes por SKU, el esquema variable de comisiones,
ingresos en bolívares y dólares contra nómina diaria. **Eso es el arranque de los «artefactos
por área» que promete la propuesta y que no existían.**

⚠️ **Pero 48 de los 240 minutos se fueron en que la gente lograra entrar.** Alberto entró un
día y al siguiente no; «algunos sí pudieron entrar con la VPN de Iberia» y a los demás hubo
que instalarles un **Proton VPN en el momento**. Con seis personas se absorbe; con la cohorte
de gerentes, no. **El acceso se cierra antes, en una máquina limpia, el día antes.**

Y sobre las licencias, dos frases de la misma sala que no cuadran: «el pago de la cuenta y lo
que tú manejas está a nombre de Iberia» y, en el minuto 1, «me falta pagar las otras». Hay
licencia corporativa andando; **falta saber quién la contrató, cuántos asientos son y si la
tarjeta de Dora ya pasó.**

### Las horas, revisadas con Gabriel · 248 h → **137 h**

Las estimaciones de desarrollo estaban infladas y las de Carlos y de dirección no reflejaban
lo dedicado. Los números los fijó él: **procesos 70, desarrollo 36, dirección 27, senior 4**.
En julio el desarrollo baja de 24 h a 6 — ahí todavía no se ejecutaba el aplicativo, sino
cuatro maquetas para el comité.

✅ **Y con eso la mezcla deja de estar invertida.** El único perfil por encima de su cuota es
**consultores de procesos (+34)** —los dos rodajes— y **desarrollo cerró por debajo (−9)**. Es
el reparto que la propuesta promete para la Fase 1, y eso cambia lo que dice el reporte
mensual: ya no hay que explicar un desbalance, hay que señalarlo como cumplido.

⚠️ **Salió una imputación nueva, `fase_0`.** El corte por mes calendario metía en la Fase 1 el
deck de la sesión de lanzamiento (12 h, 1.º de agosto) y la negociación del contrato (6 h, día
3) **aunque el contrato se firmó el 6**, y ya estaban cobradas en los USD 4.700. Era contarlas
dos veces, la misma trampa que resolvió `fase_2` con el curso de planta. La etapa anterior son
**111 h** y van en su propia tarjeta.

### El módulo del programa, rehecho para que lo lea Iberia

**Decisión de Gabriel: `/dashboard/programa` lo abre el cliente.** Estaba escrito para Boosty
—tarifas, valor consumido, «⚠ 2,6× la cuota», casillas en rojo— y la RLS lo cerraba a
editores. Un reporte mensual llega una vez al mes; la pregunta «¿en qué están?» aparece
cualquier martes. **Las reglas de qué se muestra y qué no están en `AGENTS.md`.** Lo que
enseñó hacerlo:

- **El rótulo engañaba más que el dato.** `gestion` se llamaba «Dirección, gobierno y
  reportería» y llevaba dentro las 40 h del dashboard y las 16 del importador: el cliente
  leía **90 horas de pura administración**. Ahora es «Herramientas y dirección del programa»
  con su nota. **No se movió un solo registro** — y se resistió la tentación de reatribuirlos,
  porque la decisión de que el dashboard no cuenta contra ningún entregable ya estaba tomada.
- **Tres secciones daban tres totales distintos del mismo trabajo.** Ahora las tres hablan de
  las mismas horas de la fase y cuadran con la cifra de arriba.
- **El cuadro por perfil volvió, porque es el que define el contrato.** Se había quitado con
  las alarmas; sin él, «137 h» puede ser cualquier reparto. Cada casilla lleva debajo su «+34»
  o su «−9» —aritmética, no alarma— y quien se pasa va en seminegrita: forma, no tono.
- **Se verificó con los dos ojos.** Un script crea un lector de prueba, abre la página con su
  sesión y comprueba lo que no debe verle: dinero, formulario de carga y la marca «en riesgo».
  Sin eso, «esto no se lo ve el cliente» es una creencia, no una comprobación.
- **La pantalla cazó que el Documento de Arquitectura marca cero horas** con 28 secciones
  escritas. Sigue en cero: al revisar el registro, esas horas no van ahí. Es honesto, pero el
  entregable principal aparece en blanco para el cliente. **Queda anotado en `PENDIENTES.md`**,
  que es donde va lo que falta.

### Ajito: la clave, la voz y el reproductor

**La clave con saldo entró como `ANTHROPIC_API_KEY_SALDO`** y `probar:ajito` devolvió las
ocho, todas dentro de las reglas. Era el 🔴 más viejo del adiestramiento: *«nadie ha leído
todavía una devolución de Ajito»*. Contestar de verdad destapó **dos fallos de personaje que
no se ven con el modelo apagado**: en el saludo de la lección 0 decía «Encantado» —se pone
género, que es regla que no se rompe— y se quedaba en 23 palabras, diez segundos de audio
cortado en seco.

**Y sale hablada.** El circuito estaba completo desde la sesión 5 y funciona: medido, la
pregunta «¿esto manejará las máquinas de producción?» devuelve **22 segundos de nota de voz**,
y Ajito contesta lo que se le preguntó — «no tengo manos ni cables en la línea». ⚠️ Lo que
faltaba era la recuperación: el atajo de idempotencia devolvía «ya está» al ver el texto, así
que **una devolución que se quedó escrita se quedaba escrita para siempre**. Ahora el
siguiente toque sintetiza solo la voz, en 2,9 s y sin volver a preguntarle al modelo.

⚠️ **Los audios sonaban cortados, y era el markdown.** En SSML un salto de línea es una pausa,
y las citas del guion están ajustadas a 78 columnas: Azure metía silencio en mitad de
cualquier frase partida, entre «Me» y «parece bien». Y `mstts:silence type="Sentenceboundary"`
**se suma** al silencio que Azure ya pone, así que 180 ms caían sobre cada punto de unas
frases que son cortas por diseño. Medido sobre el WAV —RMS en marcos de 10 ms— el Audio 1 de
la lección 0 pasó de **16 pausas, 11 de ellas de 400 ms o más**, a **12 y ninguna llega a
400**.

**De paso salió que la velocidad estaba mal medida.** El `+16%` de agosto se cronometró sobre
el texto: el audio real iba a **174 palabras por minuto**, no a las 192 elegidas a propósito.
Sin las pausas falsas, `+16%` se va a 198 —las 199 que en su día se descartaron por «pódcast
de oficina»— y **`+12%` da exactamente 192**. Regrabados los 70 por 31 centavos: el curso mide
**20 min 02 s** contra 21 min 40 s, diciendo lo mismo.

**Y el reproductor pasó de dos estados a cuatro**, porque el gris de «ya oído» se leía como
botón apagado: rojo con ▶ sin oír, rojo con anillo girando mientras carga, **tarjeta dorada**
con ⏸ sonando, y gris con **✓** y «Ya lo oíste» al terminar. Lo que importa es de dónde sale
el estado: **de los eventos del `<audio>`, no de la promesa de `play()`**, que resuelve cuando
el sonido ya arrancó — con `preload="none"` y una conexión de planta, entre el toque y ella
pasan segundos, y ese hueco era el que no se veía. `waiting` devuelve al cargando si el buffer
se queda corto a mitad, que en el piso pasa. *No se metió un verde para «ya oído»: la paleta
del canal son tres familias a propósito, y lo que separa «ya oído» de «apagado» es el ✓ —
forma, no tono, la misma regla del rojo.*

### El expediente y el curso, con dos cosas que faltaban

**Previsualizador en el módulo de archivos.** El nombre del archivo abre un `<dialog>` con el
PDF, el markdown maquetado o el aviso honesto de que un xlsx no lo abre el navegador. Antes,
saber cuál de los siete PDF era el que hacía falta obligaba a descargarlos: material bajo NDA,
en la carpeta de descargas de quien fuera. *Chromium headless no trae visor de PDF, así que
esa parte se verificó con navegador real: cinco páginas, miniaturas y el contrato legible.*

**Botón de reiniciar el curso, solo para editores**, para poder volver a recorrer una lección
sin entrar a la base a mano. Borra avances, respuestas, los archivos de la carpeta del
empleado en el bucket y el certificado.

**Y en el menú, bajo Administración, un acceso directo a El curso de Ajito**: es la única
forma de oír un audio después de regrabarlo, y hasta hoy había que escribir la ruta a mano.
*(Desde el 25 de septiembre va en el grupo «Cursos», con el adiestramiento y el padrón.)*

### Lo que enseñó romperse

El día dejó seis fallos, y **cinco eran de la verificación, no del producto**. Vale anotarlos
juntos porque son el mismo error de fondo: una comprobación que no comprueba es peor que no
tenerla, porque además da tranquilidad.

- 🔴 **`probar:adiestramiento` pasó de 16 comprobaciones a 9 y siguió diciendo «sin fallos».**
  El bloque de «lo que NO se puede» necesita una segunda matrícula y solo reutilizaba una que
  estuviera por ahí; el día que no hubo ninguna se saltó entero **en silencio**. Y las siete
  que se saltaron son justo las que prueban la promesa de la lección 0: que lo que alguien
  contesta no lo lee nadie más. Van 17.
- 🔴 **Sin política de DELETE, Postgres no se queja: filtra las filas y `delete()` devuelve
  cero afectadas.** El botón de reiniciar decía «curso reiniciado» con los cuatro avances
  intactos. `avances`, `respuestas` y `certificados` tenían SELECT, INSERT y UPDATE, y ninguna
  DELETE — el curso se escribió para avanzar, nunca para retroceder. Ahora la tienen, solo
  editores, y **la acción mira el error de cada borrado y vuelve a contar antes de decir que
  sí**. *De paso: me inventé el estado `'matriculada'` —es `'pendiente'`— y borraba solo los
  archivos que apuntan las filas, dejando 2 borrados y 7 huérfanos.*
- ⚠️ **`capturar:adiestramiento` pasaba *porque* el modelo estaba roto.** Usaba `networkidle`,
  y una lección con devolución pendiente dispara un `fetch` de diez a veinte segundos: con la
  clave sin saldo fallaba al instante y la red se quedaba quieta.
- ⚠️ **Dos patrones de `probar:ajito` reprobaban la respuesta correcta.** La lección 7 exigía
  «no lo sé» con una frontera de palabra al final, y en JavaScript esa frontera es **ASCII**:
  detrás de una `é` no hay ninguna, así que solo podía casar «no lo se», sin tilde. Y la 6
  pedía «doscientos» cuando Ajito escribe «doscient**as** cajas», que es la concordancia
  correcta. *Un chequeo que reprueba lo bueno enseña a ignorar los chequeos.*
- ⚠️ **`sembrar:programa` y `sembrar:horas` escribían los dos en `registros_horas`**, con
  descripciones distintas para el mismo trabajo: la jornada del 20 de agosto entraba dos
  veces, 5,42 h en uno y 10,5 h en el otro. Y como `--limpiar` borra lo que no está en su
  archivo, **correr los dos en un orden duplicaba las horas y en el otro las desaparecía sin
  decir nada.** Es la familia de las 40 h fantasma de la sesión 6. Un solo registro.
- ⚠️ **Los hitos tenían la misma trampa sin el aviso.** Al renombrar «Comunicado oficial
  publicado» quedó el viejo vivo, y el panel mostraba el mismo comunicado a la vez como hecho
  el 27 de agosto y en riesgo el 6 de septiembre.

**Y dos comodidades que eran huecos de verificación.** `capturar` ya no pide contraseña
—acuña la sesión con la clave de servicio—, porque una verificación obligatoria que depende de
que alguien esté delante para teclear una clave es una verificación que se salta. Y
`capturar:adiestramiento` comprueba ahora los tres colores del reproductor con
`getComputedStyle` y no por captura: una clase puede estar puesta y pisada por otra. Ese
chequeo cazó, el mismo día, que el botón de reiniciar medía 40 px contra los 44 de objetivo
táctil del canal.

**Dónde quedamos.** La ronda 2 y la formación directiva adentro, las horas revisadas y
cuadradas contra la pantalla, el módulo del programa listo para que Iberia lo abra, Ajito
contestando con voz y el expediente con previa. Lo que sigue es **cosechar los hallazgos de la
ronda 2**, que es lo que hoy le falta al informe, y **el reporte mensual antes del 6 de
septiembre**.

---

## 24 de agosto de 2026 · Sesión 8 — la fila 5 de la ronda 2 estaba mal ubicada

Gabriel cayó en algo que la sesión 7 no cazó: **Luis Daniel Agostini y Alexis Rojas son de
Comercial y Mercadeo, y esas dos áreas despachan desde Caracas**, no desde Cagua. Meterlos
en la fila 5 de la Pista A rompía la premisa del documento entero —diez entrevistas, todas
en la planta—. Y el suplente que los cubría, **Jesús Acosta**, tampoco servía: es el mismo
«Jesús, Gerente de Mantenimiento» de `ENT-004`, ya entrevistado en la ronda 1.

**Reemplazo, mirando qué macroproceso queda sin ni siquiera una fecha diferida.** Del mapa
v7, **S3 · Gestión de Capital Humano** era el único de los catorce que no tenía ronda ni
estaba en la lista de «para más adelante» junto con E1, E2, O6 y TI. La fila 5 ahora la
llevan **Luz Marina Sanz** (Gerente de Recursos Humanos) y **Liseth Yánez** (Jefa de
Administración de Personal) — Liseth ya estaba anotada como «de Cagua» entre los suplentes,
así que se promovió y ese puesto de suplente quedó vacante. Ajustados en el mismo paso: el
horario de las 13:40–14:40, el responsable de elegir la fecha (ya no Luis Daniel Agostini)
y la lista de suplentes en el documento y en `PENDIENTES.md`.

⚠️ **Sigue sin confirmarse con Martha.** El padrón no trae sede — se decidió así a propósito,
por lo mismo que no se le inventa cédula a nadie— así que la ubicación de Luz Marina Sanz y
Liseth Yánez es inferencia por área, no dato duro. Va como pedido en el documento.

---

## 23 de agosto de 2026 · Sesión 7 — el documento de la ronda 2, revisado por Gabriel

Cinco correcciones al PDF que se le manda a Martha, todas de criterio de trato con el
cliente. Vale anotarlas porque son la línea, no el detalle de un documento:

- **Los documentos se piden, no se exigen, y pueden llegar después.** La fila decía «se
  pedirán documentos en la sesión»; ahora dice que puede que se pidan, para validar el
  proceso que lleva cada quien, y que **lo que no esté a la mano se envía después**. Poner
  al convocado a buscar papeles contrarreloj es la forma de que llegue a la defensiva.
- **Fuera la fila de la grabación.** El consentimiento se pide en la sala, en voz alta, y
  está en el guion desde ENT-005. Anunciarlo por escrito y por adelantado lo convierte en
  un trámite antes de que la conversación empiece.
- **Urgente no es regaño.** «Se pidió para el 14 y todavía no está», «puede dejar la sesión
  sin piso», «la gente mira en vez de trabajar» — describían el fallo, no la salida. Las
  dos alertas ahora dicen qué se gana resolviéndolas: la conexión andando hace la sesión
  práctica, las licencias hacen que cada quien salga con su acceso propio. **La urgencia se
  transmite con el plazo y con lo que está en juego, no con el reproche.**
- **Nada de Capital Humano en este documento.** Cédula y celular por ficha se siguen
  necesitando —está en `PENDIENTES.md`—, pero no se piden acá: mezclar un pedido de datos
  del padrón con la convocatoria de la ronda 2 diluye las dos cosas.
- **Dora asiste a la formación, Flaviano no**, así que la primera cohorte queda en seis.
  Eso deja de ser pregunta y sale del documento: quién va a la sala no es materia de un PDF.
- **La sección 04 se dejó en dos avisos y nada más.** Fuera «a cuatro días de la sesión»
  —contar los días es apurar—, fuera el repaso de las condiciones del licenciamiento —ya
  estaban en el documento del 11— y fuera el «cómo despejar las dos de una vez», que era
  decirle a Martha cómo hacer su trabajo. **Se dice qué falta y por qué importa; el cómo lo
  pone quien lo va a resolver.**

**Y la fecha ya no se pregunta en abstracto: se propone.** Jueves 27 de agosto o martes 1.º
de septiembre. Un «elijan el día» devuelve silencio; dos fechas concretas devuelven una.

---

## 22 de agosto de 2026 · Sesión 6

**Volver a medir contra la propuesta.** El proyecto se estaba midiendo contra sí mismo:
`PENDIENTES.md` entero estaba ordenado alrededor de «abrir el curso», y abrir el curso
**es Fase 2**. Nadie llevaba la cuenta de los siete entregables que compromete la
cláusula 5 para la Fase 1.

**Cargado**

- **Las 9 entrevistas del rodaje del 20 de agosto** en Cagua, dos pistas —cinco Gabriel,
  cuatro Ruth—: Macedo, Martínez, Acosta, Cáceres, Salas, Castro, Armas, Valor y Peña.
  4.407 turnos, 8 h 47 min. Calzaron una a una con las nueve filas ya programadas.
- **`FOR-001`, la formación uno a uno con Alberto** del 17 de agosto: 1.590 turnos,
  **3 h 05 min** de una hora y media pedida. Serie propia — no cuenta contra las ~25.
- **Al expediente**: la propuesta, el contrato firmado y los tres correos de constancia.
- **236 hallazgos propuestos**, de leer las nueve entrevistas completas. 56 riesgos, 54
  cuellos de botella, 46 de trabajo manual, 27 datos disponibles, 23 oportunidades, 19
  supuestos y 11 sistemas.

**Construido** — `importar-transcripciones`, `cargar-hallazgos`, `subir-documentos`,
`sembrar-programa` y **`/dashboard/programa`** con su migración: línea de tiempo y consumo
de la bolsa de 107 horas.

🔴 **Lo más grave del día.** Al cerrar ENT-005, **Milagro Salas supo que estaba grabada y
pidió que se borrara** — «bórrala, sí, por favor». Ruth reconoció que fue la única persona
a la que no se le avisó. Sus 38 hallazgos quedaron retenidos sin cargar, y en las ~16 que
faltan el aviso de grabación va al inicio del guion.

**Lo que salió de leer la propuesta y el contrato completos**

- ⚠️ **Colisión de calendario.** El aviso de no renovación es de 30 días sobre un plazo que
  vence el 6 de enero: **Iberia decide si sigue el 6 de diciembre**, y la propuesta pone el
  Documento de Arquitectura un mes después. Todo el calendario se corrió al 6 de diciembre.
- **Los informes de levantamiento por área** están pedidos por partida doble y no existía
  ni el formato. Sale de los hallazgos validados: los siete tipos son sus secciones.
- **El reporte mensual de horas es contractual** (cláusula 8) y no se estaba llevando.
- **El contrato quedó firme.** Firma Gabriel Andrés Montiel Toro y es quien comparece —la
  discrepancia con Luisa Elena desapareció—; el aviso de ajuste de fee quedó en 45 días
  contra los 30 de la no renovación, así que ya no chocan; y las 107 horas y el
  licenciamiento de USD 60 entraron los dos a la cláusula 8. Queda vigilar que no hay
  derogatoria expresa del `CONT-2026-07-0005` anterior.

**Corregido con Gabriel**

- **El «chat organizacional» no es software.** Son las **licencias de Claude Team** a
  nombre de Iberia más las **tres formaciones**: la directiva el 26 de agosto, después los
  gerentes, después los líderes que ellos escojan. Es adopción, no desarrollo. *(Ojo con la
  nota de la sesión 5 —«las licencias corporativas no sirven para esto»—: era cierta para
  el curso de planta, que va por API, y no aplica a este entregable.)*
- **El inventario de sistemas sale de las entrevistas** y ya está saliendo. Cierra con la
  entrevista de Tecnología de la Información, que falta agendar.
- **Las encuestas de pulso las hace Iberia**, no nosotros. Están nombradas como componente
  de la v1 en la página 8 de la propuesta, así que conviene dejarlo por escrito en el acta
  de la revisión con mercadeo.
- **El curso de planta es Fase 2.** La cláusula 5 pone el despliegue ahí y la 8 hace el
  licenciamiento de USD 60 facturable «a partir de su activación en la Fase 2». Abrirlo en
  Fase 1 sería regalar unos $12.000 antes de que Iberia se comprometa con la fase que los
  paga.
- **Se puede citar y nombrar en el informe.**

**Cómo se identificó a cada hablante.** Buscando el nombre dentro del texto, no adivinando
por quién habla más. Luis Cáceres se presenta solo y ahí se cayó la corazonada que iba por
otro hablante; en ENT-002 el entrevistador se delata leyendo la lista del rodaje; y **en
ENT-006 los números van al revés** que en las otras tres de Ruth. Un importador que asuma
«el primero es el entrevistador» le habría puesto las palabras de Andreína Castro en boca
de Ruth. `ENT-004 · speaker 3` resultó ser **Jesús, Gerente de Mantenimiento** — y esa
etiqueta viene contaminada: entre los minutos 5 y 6 se cuela Rafael Acosta, que llegó a la
hora equivocada. **Quedan cuatro sin identificar.**

**Corregido de mirar la pantalla** — la tabla de consumo arrancaba en julio, porque
`Intl.DateTimeFormat` sin `timeZone` lee el primero del mes a medianoche UTC como el mes
anterior visto desde Venezuela; la línea de tiempo abría por enero de 2027 y ahora va
partida en «lo que viene» y «lo hecho»; y los encabezados de perfil decían «Consultor» dos
veces por recortar a la primera palabra.

### Cierre del día · las horas, el padrón y el informe

**El registro de horas completo, y lo que dice.** 31 partidas, cada una con la base de su
número: la preparación, los traslados Caracas↔Cagua, la redacción de los documentos, las
horas de Carlos y de Josué, y el desarrollo del aplicativo. **El mes 1 va en 290 h contra
una bolsa de 107**, más 103 h de Fase 0 que se registran aparte y no descuentan.

De los cuatro perfiles, el que se disparó es desarrollo: **176 h contra una cuota de 45**,
y 124 de ellas son el curso de planta, que es entregable de Fase 2. **Se invirtió la mezcla
que promete la propuesta** —«en la Fase 1 pesan los consultores; en las fases 2 y 3, los
desarrolladores»—. No es incumplimiento: la cláusula 8 promedia dentro de la fase y la 5
pone el riesgo del lado de Boosty. Pero obliga a que los meses 2 a 5 pesen en consultoría,
y a que el reporte lo diga en vez de esconderlo.

*Son estimaciones por entregable, no un parte de trabajo. El valor no está en la cifra sino
en que no falte ninguna partida: corregir un número escrito cuesta un minuto, acordarse de
una partida que falta cuesta el mes.*

**El padrón llegó y le falta lo que hace falta.** 276 personas —no ~280—, sin un vacío, con
ficha única, cargo y departamento; sirve para clasificar familias de oficio. Pero **no trae
cédula, ni celular, ni correo, ni sede**: sin celular no hay enlace personal. Hay que
pedirle a Capital Humano un segundo archivo.

**El informe arrancó.** 26 secciones —se añadieron «De quién depende cada proceso», «El
estado del dato», «Dónde no va la IA», «La decisión» y el anexo de informes por área—, y
seis ya tienen contenido. *(Quedaron en 28 al añadirse «En sus palabras» y el anexo de
cifras, y hoy 15 tienen contenido.)* **Los tres anexos se regeneran solos de la base**; las secciones
de prosa se escriben una vez y, en cuanto alguien las toca desde el editor, el script no
las vuelve a pisar. Nada publicado: los hallazgos que las sostienen siguen propuestos.

**Corregido de mirar la pantalla, segunda tanda** — el tope de 24 h por partida daba por
hecho que cada fila era una jornada, y obligaba a partir cada entregable en trozos con
fechas inventadas; ahora son 160, que sigue cazando el cero de más. El script de horas
resumía por fecha exacta y la pantalla por mes, así que decían cifras distintas del mismo
dato. Y la portada del informe rotulaba «15 entrevistas» cuando 15 son las sesiones y 9 las
entrevistas: en el documento que lee el cliente, eso es inflar el avance.

### Tercera vuelta · el padrón, la imputación de horas y dos fallos serios

**El padrón real, cargado.** Las 276 personas están en `/dashboard/empleados` con ficha,
cargo, departamento mapeado al organigrama, nivel y familia de oficio —94 de línea, 43 de
supervisión, 30 de oficina, 20 de almacén—. `importar:padron` lee el `.xlsx` del bucket, no
de la carpeta de descargas de nadie, y descomprime en un temporal que borra al salir. La
migración añadió `ficha` —la clave de Capital Humano— y **volvió opcional la cédula**:
inventarle una a 276 personas para satisfacer una restricción sería meter dato falso en la
tabla de la que salen los certificados.

**Lo que se cobra aparte no consume bolsa.** El booleano `adicional` no alcanzaba, así que
ahora hay `imputacion`: `bolsa`, `fase_2` o `adicional`. Con el curso de planta fuera —104 h
que van por el licenciamiento de USD 60— y la app en las 32 h que dijo Gabriel, el mes 1
queda en **182 h contra 107**, y no en las 290 que se veían antes. *(⚠️ Cifra superada: el
31 de agosto Gabriel revisó el registro partida por partida y el mes 1 cerró en **137 h**.
Y se sumó una cuarta imputación, `fase_0`. Ver esa sesión.)*

🔴 **`probar:supabase` matriculó a 201 personas.** La comprobación de que
`matricular_pendientes` existe la llamaba con el curso real, así que **verificar escribía**:
correrla justo después de cargar el padrón metió a 201 personas en un curso cerrado que es
entregable de Fase 2. Deshecho —solo las de hoy y solo las que no tenían avance ni
respuestas— y corregido: ahora pregunta por un curso inexistente a propósito, y la excepción
«no existe el curso» prueba que la función está sin tocarle la matrícula a nadie. Una suite
que corre contra producción no puede escribir.

⚠️ **La idempotencia por descripción deja huérfanas.** Al mover el dashboard de `app` a
`gestion` se le tocó el texto, y como la clave es (fecha, descripción), la fila vieja
sobrevivió: 40 h fantasma que la pantalla sí sumaba y el script no. Se veía en que la página
decía 222 h y el resumen 182. Ahora el script lista lo que está en la base y no en el
archivo, y `--limpiar` lo borra.

### Los hallazgos, redactados

De las **236 observaciones en crudo quedaron 28 hallazgos numerados**, en prosa y agrupados
por tema. El recorte es la mitad del trabajo: entró lo que dijeron desde áreas distintas
—las 24 a 48 horas de la caja a la factura las cuentan Producción y Distribución por
separado, el MRP en Excel lo describen tres áreas— o lo que es hecho duro con cifra, plazo o
sistema. Lo de una sola mención espera a la ronda 2.

El informe los recibió repartidos por `MAPA.md`, que no sigue el orden con que se
redactaron: leerlos de corrido pide un orden y el entregable pide otro. Van 6 en «Del pedido
al cobro», 5 en sistemas, 5 en el estado del dato, 3 en cuellos de botella, 3 en
restricciones, 3 en «Dónde no va la IA», 2 en dependencias y 1 en madurez.

Dos secciones nuevas: **«En sus palabras»**, con las 18 citas que mueven la aguja y en un
solo sitio —no repartidas por todo el documento—, y el **anexo de cifras**, con las ~85
que salieron dichas, cada una con su fuente y marcando cuáles son estimación de quien
habló. Y el anexo de hallazgos dejó de ser un volcado de las 236: ahora es el índice de los
28. Las crudas se quedan en el panel, que es su mesa de trabajo.

**Corregido de mirar la pantalla** — el limpiador de portada cortaba hasta el siguiente
`##`, y `CITAS.md` no tiene ninguno: se comió el archivo entero y dejó la sección vacía. En
`NUMEROS.md` se llevó el párrafo de entrada. Al recortar por estructura hay que recortar lo
mínimo.

### Las guías, rehechas · y el documento para Martha

Las tres guías de entrevista se rehicieron con `generar:guias`: **siete secciones con su
minuto, que suman 60**, solo las preguntas —es guía de entrevistador, no manual— y cuatro
secciones marcadas «No se salta» que son los cuatro huecos de la ronda 1. Adaptadas a
Iberia: fuera lo multi-país, el e-commerce y la casa matriz de marca representada; dentro
las maquilas —Iberia *es* la casa matriz de las suyas—, el cumplimiento sanitario venezolano
y el turno único.

**El generador avisa si una pregunta se puede contestar con sí o con no**, que es la regla
del archivo: una abierta hace que la persona cuente el proceso, una cerrada solo confirma el
que ya trae el entrevistador en la cabeza. Ese chequeo cazó cuatro —«¿se hace igual para
todo?», «¿los sistemas se hablan?», «¿hay algo que JD debería hacer?», «¿el área tiene
presupuesto?»— que ahora preguntan por el cómo y no por el sí.

**La ronda 2 es un día entero en Cagua**, dos pistas de cinco: Jesús Planas con el dinero y
la venta, Ruth con la planta por debajo —Beatriz, los coordinadores de Compras, Prevención
de Pérdidas, Laboratorio y Servicios Generales—. En Caracas no hay ronda por ahora; lo que
hay en Caracas es la formación del 26.

**Y el documento se rehízo después de leer el del 11 de agosto.** La primera versión repetía
lo que Iberia ya sabía: el contenido de la formación, los participantes, el costo de las
licencias, la forma de pago. Todo eso ya estaba dicho. El documento nuevo dice solo lo que
cambió o lo que sigue abierto —**la VPN y la tarjeta**— y de paso caza que en la
convocatoria del 21 faltan dos de los siete de la lista original. *(Resuelto el 23: Dora
asiste, Flaviano no. Y el tono de esas dos alertas se rehizo — ver sesión 7.)* *Antes de
escribirle otra vez al cliente, hay que leer lo que ya se le mandó.*

**Corregido de usarlo:** `generar-pdf.mjs` tomaba `--vista` como nombre del archivo de
salida, así que la vista previa reventaba justo cuando se quería revisar el PDF antes de
entregarlo. Las banderas ahora se apartan de los posicionales.

**Dónde quedamos.** Levantamiento cargado, 28 hallazgos redactados dentro del informe,
padrón real adentro, horas cuadradas, las guías listas y la ronda 2 en un PDF para mandar. Lo que sigue no es construir: es
resolver lo de la grabación, sacar el comunicado, refijar la revisión del canal, cotizar las
licencias, pedir los teléfonos y agendar las nueve.

---

## 16 de agosto de 2026 · Sesión 5 — que Ajito conteste

Hasta aquí Ajito era un guion grabado: decía lo mismo a las doscientas personas. Ahora
contesta lo que cada quien le manda, con su voz. Es la mitad del curso que no se puede
grabar por adelantado.

**Construido** — `lib/ajito.ts` (el personaje, con una instrucción propia por ejercicio),
`lib/hablar.ts` (la devolución hablada con la misma voz), la ruta de devolución idempotente
y `probar:ajito` con ocho casos. Más **las 10 fichas de bolsillo**, **el certificado**, **el
empujón** y **el padrón con el enlace personal**.

**Decidido**

- **El modelo es `claude-opus-5` por API, esfuerzo `medium`.** La visión es el requisito
  duro —leer la letra chiquita de una etiqueta con mala luz y en ángulo—. Las licencias de
  asiento no sirven para esto: una licencia es una persona delante de una ventana, esto es
  un programa llamando doscientas veces al día.
- **El curso completo sale por unos $90 de servicios** para las 200: ~$40 de voz, ~$52 de
  modelo. Las fotos son el renglón caro, hasta 4.800 tokens cada una.
- **El empujón funciona sin WhatsApp, y es decisión de diseño.** La cuenta está pedida y va
  a tardar meses, que es justo cuando la gente hace el curso. Apagado, el panel prepara los
  mensajes y alguien los copia; encendido salen solos y son los mismos.
- **La escalera —2, 5, 8 y 13 días— vive en el guion**, con una regla propia: **no se
  reclama**. Se manda el escalón más alto vencido y después del de 13 no se escribe más.
- **El enlace es la credencial**, y se trató como una contraseña: se guarda el SHA-256,
  caduca a 120 días, se reusa contando los usos, y `/entrar/[token]` no dice por qué falló.

🔴 **Lo que no se pudo verificar, y es lo importante: nadie ha leído todavía una devolución
de Ajito.** *(✅ Resuelto el 31 de agosto: entró una clave con saldo y se leyeron las ocho de
`probar:ajito`. Ver esa sesión.)* La cuenta de Anthropic no tiene crédito. El circuito entero está probado menos
la llamada al modelo, y ni siquiera se puede comprobar que la petición esté bien armada,
porque el cobro se verifica **antes** que el cuerpo: con tres cuerpos distintos, uno
inválido a propósito, la API devolvió el mismo error de saldo.

**Lo que enseñó romperse**

- **Un fallo de saldo o de red no debe marcar la respuesta como intentada.** Si el problema
  es del servicio le pasa igual a las doscientas: la cola se para sola y el día que se
  arregle se recuperan todas. Con la versión anterior habrían quedado fuera para siempre.
- Por eso los fallos ahora **se clasifican** —`sin-saldo`, `sin-permiso`, `ocupado`,
  `sin-configurar`, `fallo`—: cada uno se arregla en un sitio distinto, y con «fallo» a
  secas se perdió una hora buscando en el código lo que estaba en la consola de facturación.
- La lección 3 disparaba **cuatro llamadas de golpe** con sus cuatro fotos; y una que
  fallara atascaba la cola detrás suyo.
- **El tamaño de las fichas se mide, no se calcula.** Con los tamaños a mano, la de la
  lección 8 salió con Ajito cortado y las de tres líneas con medio metro de blanco.
- **`padron_estado` con `security_invoker = on`** decía «sin acuñar» de enlaces que sí
  existían: la vista mira `accesos`, cuya política niega el SELECT a todo el mundo, y la
  subconsulta volvía vacía en silencio. Eso lleva a mandar el mismo enlace dos veces.

---

## 16 de agosto de 2026 · Sesión 4 — arranca el adiestramiento

El curso de Ajito, para las ~200 personas que **no** van a las tres formaciones
presenciales. Es la tercera capa de formación que Boosty prometió en comité y que nunca se
había detallado.

**Investigado**

- **El curso MAIA** (3.577 líneas de chat, 21 videos, 28 tarjetas, 12 PDF). Se copia: la
  anatomía de la lección, la devolución con rúbrica —nunca «mal»—, la confirmación de la
  transcripción y el acoso amable a los 2, 5, 8 y 13 días. No sirve para planta: texto
  denso, jerga en inglés sin glosar y PDFs A4 a 9 pt que en un teléfono quedan a 3.
- **La realidad del piso**, de las cinco transcripciones: un solo turno (6:00–14:00), **no
  hay señal en el piso** —por eso usan radio—, wifi en el salón Toronjil con 8 computadoras
  de uso libre, **nadie de planta tiene correo corporativo**, y la vía que ya funciona es
  una línea de WhatsApp con todo el personal cargado.

**Construido** — el guion de las nueve lecciones (~14.000 palabras), la migración,
`/canal/adiestramiento`, `/dashboard/adiestramiento`, `lib/voz.ts`, `lib/guion.ts`,
`capturar:oficios` y **los 70 audios: 21 min 40 s por 31 centavos**, ninguno de más de 38 s.
*(Regrabados el 31 de agosto y ahora son 20 min 02 s — ver esa sesión: los saltos de línea
del markdown metían pausas falsas.)*

**Decidido**

- **Objetivo**: que sepan cómo opera la IA y de cuántas formas puede actuar. No se entra en
  el miedo al puesto. A su ritmo, sin arranque presencial; los gerentes empujan.
- **`es-VE-PaolaNeural` de Azure, y el objetivo son 192 palabras por minuto.** Azure es el único
  proveedor grande con locale venezolano de fábrica. Paola va a 166 palabras por minuto y
  Sebastián a 200 — Paola a +20% dura exactamente lo mismo que Sebastián, y eso era lo que
  sonaba lento. **192 ppm** es el objetivo: a 199 queda de pódcast de oficina, y quien va a
  oír esto está entendiendo por primera vez qué es la IA, en el comedor y con ruido.
  **La voz quedó cerrada aquí; no queda prueba a ciegas pendiente.** *(El 26 de septiembre se
  sumó Sebastián como segunda voz a elegir: ver sesión 44.)*
  *(⚠️ El porcentaje que da esas 192 cambió a `+12%` el 31 de agosto. Aquí se escribió +16%
  porque la medición se hizo cronometrando el texto y no el audio, que llevaba pausas de más
  adentro. El objetivo no cambió; el número que lo consigue, sí.)*
- **No se fotografía el área productiva** ni se usa el teléfono en las líneas.
- **El ejercicio bifurca por familia de oficio, no por nivel.** Bajo `planta` conviven la
  operadora de envasado, la cocinera de pruebas y el vigilante.
- **`asistente_libre_activo` apagado de fábrica.**

**De la agencia** (`LOGOS IBERIA + IA.pptx`, vía Mercadeo): la marca `IBER[IA] · Nuevo
Sabor`, **Ajito** —cabeza de ajo, cuerpo de ají, ruedita en vez de piernas, que resuelve
sola la lección de «no soy una persona»— y 18 avatares del personal, todos de oficina:
**faltan los de planta**.

**Lo que enseñó romperse**

- **Los saltos de línea de Windows** dejaron el lector del guion devolviendo vacío sin
  quejarse. Peor: `generar-audios` tenía su propia copia del lector con el mismo fallo, así
  que una regrabación habría encontrado cero audios y no habría dicho nada. Ahora hay un
  solo lector.
- La prueba de RLS **dejó dos usuarios de prueba en el auth de producción**. La limpieza
  ahora barre por prefijo, así que recoge también lo que quede de una corrida caída.
- Un dato falso que estaba en el repo: que Paola venía a 130 ppm. Salía de una página de
  terceros; medida sobre el texto real va a 166.
- **«Nueve ratos» → «nueve clases»**: en Venezuela «rato» no funciona como unidad contable.
- El clasificador mandaba al **Preparador de Mezclas a la cocina de pruebas**, cuando es de
  línea.
- La historia de migraciones remota estaba vacía —las seis anteriores se habían aplicado a
  mano—. Reparada; desde entonces `npx supabase db push` funciona.

---

## 12 de agosto de 2026 · Sesión 3

- **Regla de registro fijada**: todo lo que se hable o escriba en este proyecto va en
  **modismo venezolano**, con **tuteo** y siempre en tono profesional. Quedó en `AGENTS.md`.
- Borrador de correo a Alberto avisando que el canal ya tiene el diseño terminado, con
  propuesta de revisarlo con mercadeo antes de conectarlo a datos reales. **No se comunicó
  como producto de IA**: es el entregable de comunicación interna.

---

## 11 de agosto de 2026 · Sesión 2 — el canal de comunicación interna

Pensado desde el teléfono: es donde lo va a abrir la mayoría de las 280 personas, y donde
el personal de planta lo va a abrir siempre.

**Construido** — el esquema completo con RLS, las siete secciones (Inicio, Gente, Mensajes,
Grupos, Avisos, Yo, Publicar), `probar:canal` con 21 comprobaciones contra la base real y
`capturar:canal`, que mide desbordes y objetivos táctiles en un iPhone 14. Más 17 fichas de
muestra, con perfiles de planta incluidos: es el caso difícil del diseño y había que verlo.

**Decidido**

- **Conectar antes de conversar, pero solo entre pares.** Hacia arriba —dos niveles o más—
  se escribe directo: nadie de planta queda expuesto a que la dirección le rechace una
  solicitud dentro de su propia empresa.
- **Un grupo es una conversación con nombre y propósito**, no un módulo aparte.
- **La lectura se registra.** Hasta ahora el comunicado salía por correo y cartelera sin
  saber quién lo leía.
- **Un comentario oculto por moderación sigue siendo visible para quien lo escribió.**
  Requerimiento explícito de la Gerencia General: se prefiere saber que alguien está molesto
  a suponer que todo va bien.

**Lo que enseñó romperse**

- **Recursión infinita en RLS**: las políticas se preguntaban por sí mismas y Postgres las
  cortaba. El síntoma era mudo — tocar «Escribir» no hacía nada. Se resolvió sacando la
  pregunta a funciones `security definer`.
- **`.select()` después de un `insert` bajo RLS**: al crear una conversación todavía no
  participas en ella, así que el `RETURNING` volvía vacío y la acción moría en silencio.

**Unificado**: el estilo del canal se adoptó para el producto entero, por indicación de
Gabriel. Las superficies oscuras desaparecieron del panel, el login y el informe.

---

## 11 de agosto de 2026 · Sesión 1 — se levanta el dashboard

**Construido** — Next.js 16 + React 19 + Tailwind 4 sobre Supabase, con RLS en todas las
tablas y tres roles sin registro abierto. El **parser de Fireflies** (50 verificaciones), el
importador de entrevistas, los módulos de archivos, hallazgos e informe, el rebranding
completo a la identidad de Iberia y las suites de verificación.

**Cargado** — 5 sesiones con 4.484 turnos, 2 organigramas y `CONTEXTO_IBERIA.md`.

**Decidido**

- Las transcripciones vienen de Fireflies; **no se transcribe audio en la app**.
- El informe es página aparte del admin pero **exige sesión**. Es un levantamiento que
  conduce a la arquitectura, no un documento de arquitectura suelto: 21 secciones.
- El organigrama real se cargó como jerarquía de áreas (39 nodos).
- **Series separadas `SES-` y `ENT-`**, para medir el avance contra la meta de ~25
  entrevistas. *(Después se sumó `FOR-` para las formaciones.)*

**Corregido** — tres apellidos que Fireflies transcribió por sonido: Flaviano **Tucci**,
Gustavo **Carballo** y **Martha** Fuentes (536 turnos reatribuidos), más Luis Daniel
**Agostini** (25). En SES-004, Fireflies había partido a Tucci en dos etiquetas: fusionadas,
187 turnos más, con lo que el recorrido de planta completo queda citable.

**Entregado** — `documentos/2026-08-primer-rodaje-y-formacion.pdf`, la propuesta de agenda
del rodaje de entrevistas.
