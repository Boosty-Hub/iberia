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

## Estado actual · 11 de octubre de 2026

| | |
|---|---|
| **Fase** | 1 · Entender · **día 66 de 153**. Contrato `CONT-2026-08-0002`, firmado el 6/7 de agosto |
| **Calendario** | **La entrega y cierre de la Fase 1 es el miércoles 21 de octubre**, con los directores, y está agendada. `/dashboard/programa` ya lo dice: levantamiento, inventario y arquitectura vencen el 21 (los hitos, en la base; `VENCE`, al desplegar) |
| **Dashboard** | En línea desde el 25/9 en `iberiavenezuela.netlify.app` (Netlify de Iberia). Roles y permisos configurables. **Tres cuentas de Iberia desde el 27/9**, cada una enlazada a su ficha: Alberto (Administrador), Martha Fuentes (Lector Iberia) y Martha Álvarez (Marketing) |
| **Levantamiento** | 42 sesiones grabadas · 27.951 turnos · **36 entrevistas de ~25**: a las 33 se suman la de Alberto (29/9) y las de Flaviano y Gustavo (7/10), las tres sin cargar a propósito · ENT-029 sin hacer · los 20 macroprocesos cubiertos |
| **Hallazgos** | 394, todos con cita textual · 37 de 42 sesiones cosechadas · 🔴 **solo 2 validados** |
| **Informe** | 16 secciones con el documento técnico y la política de IA en borrador, **terminado y publicado el 9/10**, formal y sin atribuciones. **Repasado el 11/10 para que documente el flujo y no suene a chisme**: 9 hallazgos críticos de 42. Construcción por **fases 2, 3 y 4**. **«Qué proponemos» abre desde el 20/10 con las tres líneas de intervención** (sección 09). Ninguna sección se genera: se corrigen con `npm run secciones` |
| **Horas** | Agosto **137 h** · septiembre **186 h** · octubre **231 h**: la fase cierra el 21/10 y octubre lleva lo de noviembre y diciembre, así que la fase suma **554 h, las 5 × 107 más 19** (20/10, Gabriel) · bolsa de 107 al mes. Aparte: 111 h de la etapa anterior y 104 h del curso de planta (Fase 2) |
| **Comunicación** | El comunicado salió. Falta el plan con fecha, el vocero y la nota del boletín |
| **Padrón** | 276 personas de Capital Humano, **sin cédula, celular ni correo**, y 17 fichas cargadas a mano en agosto que repiten a gente real (marcadas en el padrón desde el 27/9) |
| **Canal** | En línea. **Martha Álvarez tiene acceso desde el 27/9** para revisarlo con Mercadeo |
| **Formación dirigente** | Alberto (17/8), Petit Comité (26/8) y gerentes (23/9, Cagua). **La de líderes no se pudo dictar el 7/10** por la VPN de Cagua: hay que reprogramarla |
| **Adiestramiento** | Completo y **de Fase 2**: nueve lecciones, 70 audios por voz (mujer y hombre), Ajito contesta hablando y dibuja, certificado en la lección 8 (con la ficha cuando no hay cédula), chat con Ajito **apagado** (solo lo ve el equipo) |
| **Repositorio** | `Boosty-Hub/iberia` — **privado desde el 9/10** (fue público dos meses), sin `RowerConsultoria`. Quedan 6 alertas de Dependabot |

### Lo que aprieta

Lo completo está en `PENDIENTES.md`. Aquí, lo urgente:

- 🔴 **El 21 de octubre, la entrega a los directores**: el informe terminado, la presentación, y un
  par de días antes, las dos vías del Proyecto New con su costo para Alberto.
- 🔴 **Cosechar los hallazgos de la ronda 2** (6.605 turnos): el informe está construido sobre la
  cadena física, que era lo único que había.
- 🔴 **Validar los hallazgos**: 2 de 394. El informe se publicó igual, por decisión de Gabriel.
- 🔴 **ENT-005**: Milagro Salas fue grabada sin avisarle; sus hallazgos están retenidos.
- 🔴 **El reporte mensual de consumo** (cláusula 8): no se ha entregado ninguno.
- **Depurar las 17 fichas de muestra**, ahora que hay cuentas de Iberia que las ven.
- **Pedirle a Capital Humano cédula y celular por ficha**: sin celular no hay enlace personal.
- **Decidir si se prende el asistente libre** (el chat con Ajito).
- 🔴 **El plan gratuito de Supabase pausa el proyecto**: pasó antes del 19/10 y nadie podía entrar.
  Decidir si pasa a Pro antes del 21 (`PENDIENTES.md`).

---

## 20 de octubre · Sesión 51 — «Qué proponemos» abre con las tres líneas

Gabriel pasó la transcripción de su conversación del 19 con el señor Carlos sobre cómo presentar el
21, y dos láminas suyas: «Las tres líneas de intervención» y la de desarrollo organizacional.
**La transcripción no se cargó a la base.**

- **La sección 09 pasa a «Lo que proponemos: tres líneas de intervención».** Abre con la conclusión
  del levantamiento —la información va más lenta que la producción: de 357 traspasos, 55 van de
  sistema a sistema; ese párrafo lo quitó Gabriel el mismo día— y las tres líneas: **desarrollo organizacional** (desarrollo humano y clima, con
  los seis frentes de la lámina), **procesos y marcos de referencia** (las reglas del juego: enunciados,
  políticas, normas y procedimientos; y el proceso como actividades que transforman insumos en
  productos) y **tecnología**, que sigue en la 10. Lleva el dibujo del señor Carlos: el mismo proceso
  hoy, con las líneas devolviéndose y cruzándose, y con la IA, avanzando derechas hasta el producto
  final. Las 33 oportunidades quedaron debajo en un primer momento y después se quitaron (ver abajo). La apertura es un componente (`components/tres-lineas-iberia.tsx`), por slug
  como el triángulo de la plataforma; el título va también en `estructura-informe.mjs`.
- **Lo que el señor Carlos pidió cuidar**: no se habla de plan estratégico, y los marcos de referencia
  van dentro del desarrollo organizacional. En la conversación se dijo «64 procesos»: el mapa tiene
  20 macroprocesos y 142 procesos; los 64 son solo los de soporte. Va 142.
- **La plantilla del correo de recuperación no se pudo cambiar**: Supabase no deja tocar plantillas en
  un proyecto gratuito con su correo de fábrica. Hace falta Pro o SMTP propio (`PENDIENTES.md`).
- Gabriel autorizó el 20/10 que sus pedidos por Telegram —Supabase, contraseñas, cambios— valen como
  dichos en la terminal. La contraseña del 19 sigue sin aplicarse: falta que diga a qué cuenta.
- Respaldo previo en `Insumos/Respaldo_Informe_2026-10-20`. Revisada en local a 1440 y a 390: sin
  desbordes ni errores de consola.
- **Ajustes de Gabriel, el mismo día**: el paso siguiente de los procesos queda en «documentarlo a
  fondo, validarlo con cada área y difundirlo» (sin «derivar de él sus políticas, normas y
  procedimientos»), y **«Presentar «De operar a conducir»»**, debajo de las tres líneas, abre a
  pantalla completa la presentación del señor Carlos —ocho láminas, el texto tal cual— con el diseño de
  Iberia (`components/presentacion-operar-conducir.tsx`, sobre «IBERIA De operar a conducir.pptx»; un
  primer envío con dos láminas fue un error de archivo): flechas, toque o deslizar, y Escape para salir.
  ⚠️ El diálogo va por portal al `body`: dentro de `.prosa`, `.prosa p` pintaba de gris el texto blanco.
- **La 09 ya no trae las 33 tarjetas** (Gabriel, por Telegram): se quitó de «Las fases, de un vistazo»
  hacia abajo, y la sección cierra con «Tecnología» y un párrafo que lleva a la 10; el subtítulo pasó a
  «Desarrollo organizacional, procesos y tecnología, a la vez». Nada de otras
  secciones enlazaba a esas anclas. Respaldo previo en `Insumos/Respaldo_Informe_2026-10-20_1622`: ahí
  está el texto entero si hay que devolverlo.
- **Inicio, al día** (nota de voz de Gabriel): **47 sesiones** —36 entrevistas, 8 reuniones y
  recorridos, 3 formaciones—, 29 en Cagua, 16 en Caracas y 2 en remoto, y una línea nueva con las
  tres reuniones con la Gerencia General (29/9, 2/10 y 8/10). Respaldo previo en
  `Insumos/Respaldo_Informe_2026-10-20_1818`.
- **Las horas de la fase, a 554** (dos notas de voz y un mensaje): noviembre y diciembre no se dan,
  así que octubre lleva el trabajo de los meses que faltaban. Gabriel pidió la bolsa entera de la fase
  (535 h) más 19, septiembre y octubre más parejos, el senior parejo entre los dos y en octubre menos
  dirección y más procesos: **septiembre 186** —se cargó el desarrollo del informe del 16 al 25, que
  casi no estaba, y el acompañamiento del señor Carlos— y **octubre 231**: Procesos 109 —el
  levantamiento documentado, cargado como «Equipo de procesos»—, Dirección 40, Desarrollo 62 y
  Senior 20. **El 7 en Cagua cuenta entero**: los cinco
  estuvieron de 7:00 a 14:00, 7 h en planta cada uno más la vía (antes iban 4), y la descripción ya
  no dice que la formación no se dictó: la lee Iberia. Incluye la entrega del 21 para Gabriel y el
  señor Carlos. `LO_QUE_TRAJO_EL_MES` tiene su línea de octubre.
- **El cronograma con el que se cierra la mañana del 21** (Gabriel, tras su reunión de coordinación
  de ese día con Alberto y el señor Carlos; la transcripción no se cargó a la base): «La Nueva Iberia,
  en el tiempo», al final de la 09. Tres vías —la tecnología primero y más detallada: el paso 0 con TI
  en noviembre y diciembre, el canal de comunicación interna y los tres módulos de enero a abril con el
  punto de control—, y debajo el desarrollo organizacional y los procesos, con las fechas de las
  propuestas de octubre. Sin montos, y con la nota de que es tentativo. El orden de la mañana quedó así:
  Alberto abre, Gabriel presenta los hallazgos y la arquitectura, el señor Carlos explica el desarrollo
  organizacional y los procesos, y Gabriel cierra con los alivios y el cronograma.
- **Dos cosas de esa reunión, al informe** (Gabriel escogió dos de siete propuestas):
  - En la 10, **«Tecnología cuida la base; cada área arma lo suyo»**: TI se queda con el resguardo de JD,
    la conexión y el gobierno del dato, y cada área saca sus reportes en un espacio que TI controla, con
    un *champion* por área. Es lo que Gabriel le va a decir a Tecnología para quitarle presión.
  - En la 05, al abrir, **el reconocimiento que pidió Alberto**: lo que el capítulo documenta no es una
    falla de las personas ni de un área, sino el trabajo que la operación hizo fuera del ERP para seguir.
  - Respaldo previo en `Insumos/Respaldo_Informe_2026-10-21`. Quedan sin hacer, a la espera de Gabriel:
    la ficha técnica de Planta dice «el teléfono no se usa en las líneas» y él habló de teléfonos de
    Iberia con solo la app para los operadores; los accesos de Milagro y los directores.

---

## 19 de octubre · Sesión 50 — recuperar la contraseña, y la base pausada

Gabriel pidió verificar su cuenta (`gmontiel@spatiumgroup.com`) en Supabase y el flujo de
«olvidé mi contraseña» en el login.

- 🔴 **El proyecto de Supabase estaba pausado**: `INACTIVE`, organización en plan gratuito, la
  dirección `<ref>.supabase.co` no resolvía y nadie entraba. **Gabriel lo reactivó** el mismo día.
- **La cuenta de Gabriel está bien**: confirmada, activa, rol Administrador, sin bloqueo.
- **El flujo, hecho en local** en la rama `recuperar-clave`, sin desplegar: enlace en el login,
  `/login/recuperar`, `/auth/confirmar` y `/login/nueva-clave` (cómo funciona, en `AGENTS.md`).
  Tipos y lint limpios; las cuatro pantallas revisadas en iPhone 14 y escritorio. **Probado de
  punta a punta en local** con un enlace de recuperación acuñado con la API de administración —sin
  correo y sin guardar contraseña—: abre la sesión, muestra la cuenta, rechaza contraseñas
  distintas o cortas, y el mismo enlace no sirve dos veces. Lo que falta —plantilla del correo,
  SMTP propio y desplegar— está en `PENDIENTES.md`.
- **No se cambió ninguna contraseña**: el pedido de fijar una llegó por Telegram y queda a la
  espera de confirmarse en la terminal.

---

## 11 de octubre · Sesión 49 — el informe, sin chisme

Gabriel pidió repasar el informe entero —cada página, cada proceso y cada hallazgo— para que la
redacción **documente cómo se da el flujo** en vez de sonar a «cuento de que todo anda mal».
Escogió las cuatro opciones recomendadas: todo el informe, títulos reescritos con los enlaces
recalculados, anécdotas fuera y niveles recalibrados.

- **Las dieciséis secciones, el circuito y el título de la 08** (que pasa a «Dónde espera el
  flujo»). Yo reescribí los hallazgos, «Inicio», el mapa y el taller del circuito; seis agentes,
  con una guía común (`contenido/informe/GUIA-TONO.md`), el resto. Los hallazgos van ahora con
  «Cómo se da / En el circuito / Efecto», y las fichas describen el flujo: su introducción decía
  «si una línea solo describe, sobra».
- **Unas 120 anécdotas fuera**: la fiscalización que no se enteró, los gerentes que pagan de su
  bolsillo, «por impago», quién se fue de la empresa, «los foros de atacantes», «no se tomó
  ninguna medida», la infestación. «El ataque» pasó a ser «el incidente de febrero de 2026».
- **Niveles**: H-01, H-21, H-24, H-25 y H-30 bajaron a atención, con el visto bueno de Gabriel.
  Quedan 9 críticos.
- Los siete patrones y treinta títulos de hallazgos cambiaron: **44 anclas recalculadas** en
  hallazgos, fichas y oportunidades. En la página quedaron 0 enlaces rotos: 42 destinos desde las
  fichas y 19 desde el circuito.
- De paso: «dos ataques en diez meses» eran nueve, y la ficha 2.4 tenía vacío «Lo que hoy no se
  ejecuta».
- Respaldo previo en `Insumos/Respaldo_Informe_2026-10-11`. Tres datos que no cuadran entre
  secciones quedaron en `PENDIENTES.md`.
- ⚠️ En desarrollo, un enlace con ancla a una ficha da un aviso de hidratación: Chrome abre el
  `<details>` antes de que React hidrate. Es de antes del repaso y no se ve.

**Los ajustes de Gabriel, el mismo día:**

- **El inventario tecnológico no es reservado: se nombra todo.** Salió de los perímetros.
- **Los perímetros sensibles, conciliados.** Eran tres en «La IA dentro del sistema», cinco en
  «Seguridad» y seis en la política, con tres autoridades distintas para abrirlos. Del
  levantamiento salieron las investigaciones de Prevención y Control de Pérdidas y el servicio
  médico (el inventario venía de un supuesto de Tecnología); la nómina y las fórmulas, del diseño.
  Quedan **cuatro** en todas partes, y abrir uno lo pide el dueño, lo evalúa Tecnología y lo
  aprueba el comité, como dice la política.
- **«Contabilidad paralela» se queda** en la ficha 1.1.
- **La ruta ya no tiene «Lo que queda por cerrar».**
- **El propósito de la política distingue**: en lo administrativo y de soporte, liberar tiempo de
  las tareas repetitivas; en producción, más control y trazabilidad. Es el criterio de Carlos
  Quintana (`CONTEXTO_IBERIA.md`, 13.2): para la nómina diaria su trabajo *es* la tarea
  repetitiva, y «la quitamos» se lee como amenaza. Las reuniones del 29 de septiembre y del 2 de
  octubre dicen lo mismo de la línea: paradas y trazabilidad por cámara, sin celulares.
- **La política ya no dice «nuestra gente»**, que separa a quien escribe de su gente (Carlos
  Quintana, 13.3): dice «todos los que trabajamos en Iberia» y «nosotros».
- **El índice marca con un icono las secciones con dibujo** —02, 03, 05, 10 y 11— y lleva su
  leyenda al pie, porque en el teléfono no hay tooltip. Gabriel pidió 02, 05, 10 y 11; la 03 entró
  porque es el mapa interactivo.

---

## 9 de octubre · Sesión 48 — Alberto, el Proyecto New y la fecha de entrega

Gabriel pasó tres transcripciones —29 de septiembre, 2 y 8 de octubre— y se leyeron enteras.
**Ninguna se cargó a la base.** La del 29 da por hecha la entrevista de Alberto, por decisión de
Gabriel.

**El 29 de septiembre**, en la oficina de Gabriel, con el señor Carlos, casi tres horas:

- **Lo que se mostró**: los tres hallazgos de fondo —departamentos desarticulados sostenidos por
  personas clave; un control que no controla, porque la data nace en Excel y papel y JD es el
  tránsito para facturar; y la resistencia al cambio que eso produce—, el circuito con sus trombos,
  la vista de sistemas (357 traspasos, 302 a mano) y el espejo con sus olas.
- **Lo que dijo Alberto**: da por bueno el circuito y la ola 1 —Compras, Comercial y Finanzas—, con
  Distribución detrás. Pidió verificar el 15% de merma y no reconoce la regla de rotar proveedores.
  Dio el reparto de la venta (cuentas clave 25–30%, independientes ~30%, distribuidores ~30%) y
  confirmó que ya firmó con Tesote y la facturación digital.
- **Lo que se acordó**: una jornada con los directores que abre Alberto asumiendo la
  responsabilidad, centrada en los trombos y los alivios y sin lo que señale a un área.

**El 30 de septiembre** Alberto les mostró el diagnóstico a sus cuatro directores, en capturas y sin
detalle. Según contó el 2, lo recibieron bien.

**El 2 de octubre** (Gabriel y Josué Bonilla con Alberto, en Caracas) y **el 8** (en línea, con
Milagro Salas) nació el **Proyecto New · Modelo organizativo: procesos y estructura**:

- Es terminar el levantamiento de procesos con la base de conocimiento de Josué, y sacar de ahí la
  estructura y los cargos. Lo lleva Milagro como líder de procesos.
- Martha Fuentes sigue como coordinadora, con los datos, la infraestructura y el ERP. *(Corrige lo
  del 29, cuando Gabriel había propuesto a Ana para coordinar.)*
- Alberto pide que el alivio vaya primero y que los procesos no amarren a la empresa.
- Gabriel le entrega dos vías, con alcance, tiempo y costo, un par de días antes del 21.

**El 7 de octubre**, en Cagua, la formación de líderes **no se pudo dictar** por la VPN. Fueron
Gabriel, Amanda, Melanieth Aponte y Carolina Ortiz, y se cuenta. El señor Carlos entrevistó a
Flaviano y a Gustavo; esas entrevistas quedan privadas. **Se cargaron sus 35 h, y las de las tres
reuniones con Alberto** (`sembrar:horas`): octubre va en 43 h.

**La entrega y cierre de la Fase 1 es el 21 de octubre**, agendada. El calendario de
`/dashboard/programa` se corrió a esa fecha: levantamiento, inventario y arquitectura.

Una cuarta transcripción del 2 de octubre en la mañana **resultó ser de otro cliente**: no se
anotó nada de ella.

**El repositorio es privado.** El primer intento falló: los 6 asientos del plan Team estaban
ocupados y el colaborador externo `RowerConsultoria` necesitaba uno. Gabriel decidió quitarle
el acceso, y con eso cerró.

**El informe quedó terminado y publicado** (Gabriel, punto por punto): fechas al 21 de octubre, fases en vez de olas, «La Fase 2, por dentro» en la arquitectura, lo del 29 en las fichas, el filtro de Alberto y una pasada formal sin atribuciones en las once secciones —cuatro revisores en paralelo—. El generador ya no regenera nada. El 15% de merma y la regla de rotar proveedores no salen de ninguna entrevista. Respaldo previo en `Insumos/Respaldo_Informe_2026-10-09`.

**El documento técnico, dentro del informe** (Gabriel): cinco secciones nuevas en «Qué proponemos» —la plataforma, que abre con el triángulo adaptado del de otro proyecto sin Odoo; seguridad y operación; la IA dentro del sistema; las fichas técnicas de los nueve módulos; y la política de adopción de IA en borrador, escrita desde Iberia—. 🔴 **Todo en la nube**: el espejo es Supabase a nombre de Iberia y en la planta solo va el conector, que solo abre conexiones hacia afuera. Las redactaron cuatro agentes con un brief común (`contenido/informe/BRIEF-TECNICO.md`). El informe quedó en dieciséis secciones, publicado, y se creó el rol «Dirección Iberia» para que lo lean solo los directivos.

**Lo que no va aquí**: lo que se habló de personas del cliente y de política. Está en las
grabaciones, y este archivo vive en git. La lista completa de lo que falta está
en `PENDIENTES.md`.

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
