# Bitácora del proyecto

Qué pasó en cada sesión y dónde quedamos. **La entrada más reciente arriba.**

> **Regla: máximo 800 líneas.** Una bitácora larga no se lee entera, y lo que no se lee no es
> memoria de nada. **Antes de escribir se lee completa** y se revisa que lo nuevo no repita,
> contradiga ni deje vencido lo que ya está: una decisión que cambia se corrige donde estaba.
> Al añadir, se compacta lo viejo.
>
> **Qué va aquí:** lo que pasó, lo que se decidió y por qué, y lo que se rompió. **Cómo
> funciona el sistema va en `AGENTS.md`; lo que falta, en `PENDIENTES.md`.**
>
> La versión larga, sesión por sesión hasta el 27 de septiembre de 2026, está en git:
> `git show 2104916:BITACORA.md`.

Contexto de fondo: `CONTEXTO_IBERIA.md` (en el módulo de archivos) y `DESPLIEGUE.md` para lo
que está en línea.

---

## Estado actual · 27 de septiembre de 2026

| | |
|---|---|
| **Fase** | 1 · Entender · **día 52 de 153**. Contrato `CONT-2026-08-0002`, firmado el 6/7 de agosto |
| **Calendario** | Adelantado: **nada se entrega después del 6 de diciembre**, porque el aviso de no renovación vence antes que el entregable que sirve para decidir |
| **Dashboard** | En línea desde el 25/9 en `iberiavenezuela.netlify.app` (Netlify de Iberia). Roles y permisos configurables. **Tres cuentas de Iberia desde el 27/9**, cada una enlazada a su ficha: Alberto (Administrador), Martha Fuentes (Lector Iberia) y Martha Álvarez (Marketing) |
| **Levantamiento** | 42 sesiones grabadas · 27.951 turnos · **33 entrevistas de ~25** y una programada (ENT-029) · los 20 macroprocesos cubiertos |
| **Hallazgos** | 394, todos con cita textual · 37 de 42 sesiones cosechadas · 🔴 **solo 2 validados** |
| **Informe** | 11 secciones, hallazgos primero, **sin citas, códigos ni nombres**. Ninguna publicada. Ocho se escriben en Supabase; el generador lleva inicio, mapa y fichas |
| **Horas** | Agosto **137 h** (revisadas con Gabriel) · septiembre **119 h** (estimadas, por revisar) · bolsa de 107 al mes. Aparte: 111 h de la etapa anterior y 104 h del curso de planta (Fase 2) |
| **Comunicación** | El comunicado salió. Falta el plan con fecha, el vocero y la nota del boletín |
| **Padrón** | 276 personas de Capital Humano, **sin cédula, celular ni correo**, y 17 fichas cargadas a mano en agosto que repiten a gente real (marcadas en el padrón desde el 27/9) |
| **Canal** | En línea. **Martha Álvarez tiene acceso desde el 27/9** para revisarlo con Mercadeo |
| **Formación dirigente** | Alberto (17/8), Petit Comité (26/8) y gerentes (23/9, Cagua). Falta la de los líderes |
| **Adiestramiento** | Completo y **de Fase 2**: nueve lecciones, 70 audios por voz (mujer y hombre), Ajito contesta hablando y dibuja, certificado en la lección 8 (con la ficha cuando no hay cédula), chat con Ajito **apagado** (solo lo ve el equipo) |
| **Repositorio** | `Boosty-Hub/iberia` — 🔴 **público**, con `RowerConsultoria` con escritura y 6 alertas de Dependabot. La sesión de GitHub de esta máquina ya tiene permiso de administrador para cerrarlo |

### Lo que aprieta

Lo completo está en `PENDIENTES.md`. Aquí, lo urgente:

- 🔴 **La reunión con Alberto, martes 29 de 11:00 a 13:00.** Abre la Fase 2: los tres dibujos y
  los alivios.
- 🔴 **Cerrar el repositorio**: es público y lleva material bajo NDA en la historia.
- 🔴 **Cosechar los hallazgos de la ronda 2** (6.605 turnos): el informe está construido sobre la
  cadena física, que era lo único que había.
- 🔴 **Validar los hallazgos**: 2 de 394. Sin eso no se publica nada.
- 🔴 **ENT-005**: Milagro Salas fue grabada sin avisarle; sus hallazgos están retenidos.
- 🔴 **El reporte mensual de consumo** (cláusula 8): no se ha entregado ninguno.
- **Depurar las 17 fichas de muestra**, ahora que hay cuentas de Iberia que las ven.
- **Pedirle a Capital Humano cédula y celular por ficha**: sin celular no hay enlace personal.
- **Decidir si se prende el asistente libre** (el chat con Ajito).

---

## 27 de septiembre · Sesiones 46 y 47 — el cierre del curso y las primeras cuentas de Iberia

**El cierre del curso** (Gabriel llegó al final de la lección 8 y no había certificado):

- El certificado sale **en su turno**, emitido al abrirse, que es donde el audio dice «terminaste
  las nueve». Guardarlo, Mandárselo a alguien y **Publicarlo en el canal** (nuevo) hacen lo que
  dicen. La imagen la dibuja la aplicación; la del canal va sin cédula.
- **«Preguntarle algo a Ajito» abre un chat**: varias conversaciones, texto, voz o foto, respuesta
  escrita y hablada, memoria, búsqueda y dibujos. Tope de 40 mensajes al día. Con el interruptor
  apagado solo lo ve el equipo; prenderlo es de Gabriel.
- 🔴 Con el interruptor apagado, la despedida de la lección 8 traía el texto y el botón de la otra
  versión: iban en el mismo turno. Ahora cada versión es su turno.
- ⚠️ La lección emitía el certificado y decía «se está preparando»: Next memoriza las consultas
  GET idénticas dentro de un render. Se pinta la fila que devuelve la emisión.

**Las cuentas de Iberia** — Gabriel dio las tres primeras, y ninguna funcionaba del todo:

- **Las cuentas de Usuarios no nacían enlazadas a su ficha**, y el canal cuelga todo de ella. Ahora
  Usuarios y el padrón las enlazan, proponiendo la ficha por el nombre. Quedaron: Martha Álvarez
  con la 5034, Martha Fuentes con la 4837 y Alberto con la 4774.
- 🔴 **Se matriculó la ficha de muestra de Martha Fuentes**, no la suya, y acuñar el enlace le creó
  una segunda cuenta. Deshecho. El padrón dice ahora el número de ficha y la cuenta de cada fila,
  marca la de muestra repetida y no deja matricularla ni acuñarle enlace, ofrece enlazar la cuenta
  que coincide, y la búsqueda no distingue tildes.
- **Un rol con módulos del panel sin su portada no llegaba a ellos**: `/dashboard` lo devolvía al
  canal. Ahora el canal lleva «Panel» y el panel «El canal».
- 🔴 **Las casillas de Ajito no abrían nada**: el tablero salía en cero (corría con los permisos de
  quien lo pide), Certificados salía vacío y las lecciones pedían una matrícula que solo pone el
  equipo. Ahora el tablero y los certificados se abren con su casilla, y quien tiene lecciones en su
  rol se matricula con «Recorrer el curso». Martha Álvarez ya lo hizo.
- 🔴 **A nadie del padrón real se le podía emitir el certificado**: exigía cédula y el listado no las
  trae. Ahora lleva el número de ficha.
- Alberto: su apellido salía «García-ramos» (el importador no ponía mayúscula tras un guion); se le
  pasó la cédula que tenía su ficha de muestra (V-6912626, **confirmarla**); y el canal ponía los
  cargos en las mayúsculas del listado, a las 276 personas. Corregido.
- Las pruebas creaban a sus trabajadores con el rol de la dirección, que ahora sí lee el tablero y
  los certificados: pasan a Personal de planta.
- Redactado el correo de acceso para Martha Álvarez (revisar el curso, las voces y el diseño).
- **Verificado en producción**: `mirar-puertas` con los roles y los datos reales de Martha y de
  Alberto, `mirar-padron-cuentas`, `probar:certificado` 33, `probar:padron` 25, `probar:supabase`
  78. `probar:permisos` falla en 2 porque Lector Iberia no tiene secciones del informe marcadas; no
  se tocó (en `PENDIENTES.md`).
- La bitácora se compactó de 3.308 líneas a esta versión, y la regla de las 800 líneas quedó arriba
  y en `AGENTS.md`.

---

## 26 de septiembre · Sesiones 44 y 45 — dos voces, y el curso recorrido por Gabriel

**Dos voces** (encargo de Gabriel): Paola y Sebastián, las dos venezolanas de Azure, a elegir en el
índice del curso. La elección vale para la clase y para las devoluciones: un solo Ajito. Sebastián
a −7% da el mismo ritmo (20:09 contra 20:02); los 70 audios costaron 0,31 USD.

- **Azure no estaba sin clave: estaba en pausa.** La prueba gratuita había vencido y la cuenta se
  iba a borrar el 15 de octubre. Gabriel la pasó a pago por uso y la clave de siempre volvió.
- 🔴 En producción Ajito devolvía 401 y en local contestaba: el SDK tomaba del entorno de Netlify
  una `ANTHROPIC_BASE_URL` que no es nuestra. La dirección va fija.

**El curso recorrido por Gabriel** (lección 0 en adelante, 26 y 27 de septiembre). Lo que trajo:

- 🔴 El audio de la lección 0 le decía a todo el mundo el nombre de una trabajadora de ejemplo. Ahora
  lo muestra una tarjeta del padrón, y «No soy yo» abre dónde escribir quién es (aviso para Capital
  Humano, no dato).
- 🔴 El audio siguiente salía mientras Ajito seguía pensando. La lección espera la devolución, y
  desde el 27, también a que se oiga la mitad; lo siguiente aparece al oír la mitad de cada audio,
  con una manito en el play.
- 🔴 **Ninguna respuesta hablada había recibido nunca su devolución**: la ruta tomaba el `.wav` por
  una foto ilegible.
- Ajito sabe la fecha y la hora, busca en internet donde se le pregunta libre (nunca en la 7), no
  ofrece datos de adentro de Iberia y no habla de política.
- La barra se arrastra, cada audio dice «3 de 8», los botones que avanzan laten, la nota de voz está
  siempre a mano, el apodo y el ✓ de «ya oído» se guardan, la foto se manda sola.
- **Ajito dibuja** con `gpt-image-2.5-flare`, que eligió Gabriel entre cuatro. Un filtro revisa el
  pedido antes, y lo que no va recibe los textos que Gabriel aprobó. 🔴 Para el generador «Iberia»
  era la aerolínea: ahora se le pasa el logo verdadero. El escudo se publica en el feed.
- **Ajito deja de avisar quién lee** lo que le cuentan: se dice una vez, en la lección 0. Y la regla
  de la lección 7 pasó a «la información sensible no se comparte si no hace falta». Audios
  regrabados.
- 🔴 Las verificaciones habían dejado 115 archivos huérfanos en el bucket. Barridos, y
  `probar:supabase` avisa si vuelve a pasar.

---

## 25 de septiembre · Sesiones 38 a 43 — en línea, roles, y el informe reordenado

- 🔴 **Cualquiera se podía hacer administrador, dos veces.** La política de «perfil propio» dejaba
  escribir el rol (cerrado con un trigger), y el registro público de Supabase estaba abierto
  (cerrado antes de abrir el sitio). Nadie lo aprovechó: solo había cuentas de Boosty.
- **Roles y permisos configurables**: el nivel es el techo y la matriz afina por debajo. Rol nuevo,
  Personal de planta, para quien entra con su enlace.
- **En línea** en la cuenta de Netlify de Iberia: variables secretas solo en producción, funciones
  en la región de Supabase, sin el login de equipo.
- **El informe se rediseñó** (hoja centrada, índice lateral, teléfono) y **se reordenó**, por
  decisión de Gabriel: primero los hallazgos, en el circuito y con su nivel; después cómo funciona
  hoy; después la propuesta. Once secciones.
- **El panel se aligeró** (Gabriel): fuera el módulo de hallazgos y el editor del informe —el
  informe se escribe en las sesiones—, grupo «Cursos», «Consumos», «Ver el informe» en la
  cabecera, el mapa abre directo, la ficha del circuito en un panel lateral.
- **Las cuatro oportunidades de IA que no cabían entraron a su módulo**: 51 capacidades, 21 de IA.
- **Septiembre cargado**: 119 h estimadas, el peso en Jesús Planas. 🔴 Correr el script de horas
  habría metido 18 h de más, porque en el panel había partidas corregidas: ahora no escribe si la
  base tiene partidas que él no conoce. La formación de gerentes es `FOR-003`.
- **La reunión del equipo** corrigió el informe: la numeración del circuito, «se factura», el área
  bajo cada estación, H-18, y **«Nuevo» pasó a «No documentado»** (99 de 142 procesos): un proceso
  que se hace desde hace años no es nuevo. Su transcripción no se cargó ni se escribió aquí: trae
  juicios sobre personas del cliente y el repositorio es público.
- ⚠️ Los talleres de Jesús no viajan por git: lo corregido del informe se hizo en la base y se le
  anotó a él en `PENDIENTES.md`.

---

## 24 de septiembre · Sesiones 36 y 37 — verificación completa, y el sistema Iberia

- **Todo verificado y medido**: 51 rutas, lo visible entre 0,37 y 0,84 s. Casi todo ese tiempo es la
  distancia a Supabase, y por eso las funciones van en su región.
- 🔴 Las transcripciones largas se cortaban en el turno mil (`max_rows`), y los scripts de renombrar
  hablantes tenían el mismo tope. Ahora paginan.
- `/entrar/[token]` mandaba a la persona a otro host y la dejaba sin sesión: ahora vuelve al mismo.
- **La arquitectura es el sistema Iberia** (decisión de Gabriel, afinada con ocho lecturas de las
  entrevistas): JD se queda como registro contable y fiscal, y delante va un espejo que obtiene,
  donde se trabaja, y que postea en JD por el Orchestrator. La explosión de materiales corre en el
  espejo. Productos nombrados, sin costos. La Fase 2 que se recomienda: el paso 0 y la ola 1.
- «Todo lo que el informe documenta tiene que existir en Supabase», dicho por Gabriel.

---

## 16 a 18 de septiembre · Sesiones 10 a 35 — el informe se escribe

- **El mapa de partida no describía la empresa.** De 47 procesos, 30 se confirmaron, 6 no se
  ejecutan y 11 tenían mal el dueño, y faltaban cinco macroprocesos. Quedaron 20 y 142.
- **La cosecha pasó de 8 a 37 sesiones**: 394 hallazgos, cada cita contra el turno exacto de la
  transcripción. 42 redactados para el informe.
- **Jesús rehízo el armazón**: se borró la prosa escrita antes de procesar las entrevistas (queda
  respaldada) y se escribió sección por sección. El 18 se comprimió de 15 a 12, con «Inicio» como
  portada y no como resumen.
- 🔴 **Decisión del cliente, hablada con Gabriel el 18: el informe va sin citas, sin códigos y sin
  nombres.** Es un interruptor (`SIN_CODIGOS`), no una demolición. La trazabilidad queda en el
  expediente, fuera de git, y no se comparte con el cliente.
- **Reglas que salieron de escribirlo**: el dato manda sobre el impacto; las cifras se cuentan, no se
  escriben; cada cifra lleva si es dato o estimación; los límites de la IA los puso la empresa, no
  nosotros.
- **Errores cazados, y lo que enseñaron:**
  - «Treinta y cuatro entrevistas» eran diecisiete: número puesto a ojo.
  - ENT-005 se colaba en conteos, fichas y cobertura. La guarda omite todo lo que solo ella
    sostiene.
  - Afirmé que «la mitad de lo de alto impacto está en el grupo 3», y era el 27%. Las cifras de un
    cierre salen del mismo sitio que la tabla.
  - Di las fichas por hechas con 60 campos en plantilla. Ahora el generador cuenta lo que falta.
  - Un reemplazo se llevó 939 líneas del generador; se recuperó de git. Se commitea antes de una
    cirugía grande.
- Quedan abiertas dos decisiones sobre ENT-005 —dos procesos que solo ella sostiene siguen como fila
  del mapa— y hablantes sin identificar en `SES-002` y `FOR-002` (en `PENDIENTES.md`).

---

## 11 al 31 de agosto · Sesiones 1 a 9 — el dashboard, el canal, el curso y el levantamiento

- **11/8 · el dashboard** (Next.js 16, Supabase con RLS, sin registro abierto) y **el canal**,
  pensado para el teléfono. Decisiones del canal: se pide conexión solo entre pares, un comentario
  oculto lo sigue viendo su autor (pedido de la Gerencia General), y su estilo pasó a todo el
  producto.
- **12/8 · el registro del proyecto**: modismo venezolano, con tuteo, siempre profesional.
- **16/8 · el curso de Ajito**: guion de nueve lecciones, voz de Azure a 192 palabras por minuto, el
  ejercicio bifurca por oficio, no se fotografía el área productiva. Ajito contesta con
  `claude-opus-5` por API —las licencias de asiento no sirven para doscientas personas— y el curso
  entero cuesta unos 90 USD. El empujón funciona sin WhatsApp; el enlace es la credencial.
- **22/8 · medir contra la cláusula 5**, no contra el curso, que es de Fase 2. Entraron las nueve
  entrevistas del rodaje y el padrón real: 276 personas sin cédula, celular, correo ni sede.
  - 🔴 Milagro Salas (ENT-005) fue grabada sin avisarle.
  - 🔴 `probar:supabase` matriculó a 201 personas al comprobar una función: una suite que corre
    contra producción no puede escribir.
  - El calendario se corrió al 6 de diciembre, y el «chat organizacional» resultó ser licencias de
    Claude más tres formaciones.
- **23 y 24/8 · el documento de la ronda 2 para Martha Fuentes**, con la línea de trato con el
  cliente:
  - Los documentos se piden, no se exigen.
  - La grabación se consiente en la sala.
  - La urgencia va con el plazo, no con el reproche.
  - Las fechas se proponen, no se preguntan.
- **31/8 · la ronda 2 y el Petit Comité, cargados.**
  - El comunicado salió, y falta su dato duro. Se propuso un comité de comunicaciones a tres patas.
  - Las horas se revisaron con Gabriel: agosto cierra en 137 h, y lo previo a la firma va como
    `fase_0`.
  - `/dashboard/programa` pasó a leerlo Iberia.
  - Ajito contestó por primera vez con saldo. Los audios tenían pausas falsas del SSML: sin ellas,
    192 palabras por minuto salen a `+12%`.
  - Cinco verificaciones que no comprobaban nada se corrigieron.
