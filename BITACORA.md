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

## Estado actual · 6 de noviembre de 2026

| | |
|---|---|
| **Fase** | 1 · Entender · **día 92 de 153**. Contrato `CONT-2026-08-0002`, firmado el 6/7 de agosto |
| **Calendario** | **La entrega y cierre de la Fase 1 estaba agendada para el miércoles 21 de octubre**, con los directores. ⚠️ **Esta bitácora no tiene la entrada de ese día**: falta pasar cómo salió. `/dashboard/programa` dice que levantamiento, inventario y arquitectura vencen el 21 |
| **Dashboard** | En línea desde el 25/9 en Netlify de Iberia; **desde el 26/11 el dominio oficial es `portal.industriasiberia.com`** (`iberiavenezuela.netlify.app` sigue respondiendo). Roles y permisos configurables. **Tres cuentas de Iberia desde el 27/9**, cada una enlazada a su ficha: Alberto (Administrador), Martha Fuentes (Lector Iberia) y Martha Álvarez (Marketing) |
| **Levantamiento** | 42 sesiones grabadas · 27.951 turnos · **36 entrevistas de ~25**: a las 33 se suman la de Alberto (29/9) y las de Flaviano y Gustavo (7/10), las tres sin cargar a propósito · ENT-029 sin hacer · los 20 macroprocesos cubiertos |
| **Hallazgos** | 394, todos con cita textual · 37 de 42 sesiones cosechadas · 🔴 **solo 2 validados** |
| **Informe** | 16 secciones con el documento técnico y la política de IA en borrador, **terminado y publicado el 9/10**, formal y sin atribuciones. **Repasado el 11/10 para que documente el flujo y no suene a chisme**: 9 hallazgos críticos de 42. Construcción por **fases 2, 3 y 4**. **«Qué proponemos» abre desde el 20/10 con las tres líneas de intervención** (sección 09). Ninguna sección se genera: se corrigen con `npm run secciones` |
| **Horas** | Agosto **137 h** · septiembre **186 h** · octubre **231 h**: la fase cierra el 21/10 y octubre lleva lo de noviembre y diciembre, así que la fase suma **554 h, las 5 × 107 más 19** (20/10, Gabriel) · bolsa de 107 al mes. Aparte: 111 h de la etapa anterior y 104 h del curso de planta (Fase 2) |
| **Comunicación** | El comunicado salió. Falta el plan con fecha, el vocero y la nota del boletín |
| **Padrón** | 276 personas de Capital Humano, **sin cédula, celular ni correo**, y 17 fichas cargadas a mano en agosto que repiten a gente real (marcadas en el padrón desde el 27/9) |
| **Canal** | En línea. **Martha Álvarez tiene acceso desde el 27/9** para revisarlo con Mercadeo |
| **Fase 2 · New Iberia** | **Calendario en el panel desde el 28/10** (`/dashboard/calendario`): 78 actividades de noviembre de 2026 a octubre de 2027, en la base. Lo actualiza Amanda (administradora). **Desde el 29/10 la línea de tiempo se despliega por frente y el calendario sale en PDF** para Alberto |
| **App móvil** | **La de iPhone** (PEN-14661): Capacitor sobre el sitio en línea, en la cuenta de Apple de Boosty Desk; se compila y se sube desde GitHub Actions. En producción: `/privacidad`, avisos push, enlaces universales, y reportar y bloquear. **La build 3 se mandó a revisión el 4/11, y el 5/11 Apple la devolvió pidiendo información (guía 2.1)**: falta el video en un iPhone físico y un correo de soporte para volver a enviarla. Google Play (PEN-14662), después |
| **Formación dirigente** | Alberto (17/8), Petit Comité (26/8) y gerentes (23/9, Cagua). **La de líderes no se pudo dictar el 7/10** por la VPN de Cagua: hay que reprogramarla |
| **Adiestramiento** | Completo y **de Fase 2**: nueve lecciones, 70 audios por voz (mujer y hombre), Ajito contesta hablando y dibuja, certificado en la lección 8 (con la ficha cuando no hay cédula), chat con Ajito **apagado** (solo lo ve el equipo) |
| **Repositorio** | `Boosty-Hub/iberia` — **privado desde el 9/10** (fue público dos meses; consultada sin sesión, la API de GitHub responde 404 el 23/10), sin `RowerConsultoria`. Quedan 6 alertas de Dependabot, y 🔴 **`next` 16.3.0, el de producción, tiene avisos críticos** (23/10) |

### Lo que aprieta

Lo completo está en `PENDIENTES.md`. Aquí, lo urgente:

- 🔴 **La respuesta a Apple**: grabar el video desde TestFlight, publicar un correo de soporte y volver
  a enviar la build 3.
- 🔴 **Los push de `Smarin19` no se despliegan solos en Netlify**: quedan «pending review». Un dueño
  del equipo tiene que invitar a ese usuario o activar las aprobaciones automáticas.
- **Pasar aquí cómo salió la entrega del 21** a los directores.
- 🔴 **Validar los hallazgos**: 2 de 394. El informe se publicó igual, por decisión de Gabriel.
- 🔴 **ENT-005**: Milagro Salas fue grabada sin avisarle; sus hallazgos están retenidos.
- 🔴 **El reporte mensual de consumo** (cláusula 8): no se ha entregado ninguno.
- **Depurar las 17 fichas de muestra**, ahora que hay cuentas de Iberia que las ven.
- **Pedirle a Capital Humano cédula y celular por ficha**: sin celular no hay enlace personal.
- **Decidir si se prende el asistente libre** (el chat con Ajito).
- 🔴 **El plan gratuito de Supabase pausa el proyecto**: pasó antes del 19/10 y nadie podía entrar.
  Decidir si pasa a Pro (`PENDIENTES.md`).

> **Plataforma Iberia:** **en producción** desde el 20/11 (Etapa 1, rediseño, panel y canal en `/sistema`; el informe
> aparte; ver la sesión 56), con el Portal planta, los documentos y los tutoriales desde el 24/11 (sesiones 59 y 60).
> **Asistente de IA:** las siete fases, las ventanas de 5 horas y «Preguntar a la IA» **en producción desde el 26/11**
> (sesión 61); Mis archivos, la Guía, la ventana flotante, el widget de soporte y 18 tutoriales con voz, también (sesión 62).
> Correos por Resend con diseño desde el 27/11 (sesión 63). Falta lo de Iberia: la dirección de retorno nueva en Entra y
> la prueba de Microsoft 365, y la plantilla de WhatsApp (`PENDIENTES.md`).

---

## 27 de noviembre · Sesión 63 — Microsoft 365 configurado y los correos por Resend

**Pedidos de Gabriel** (Telegram): Jhonhy Polanco (TI de Iberia) mandó los datos de la app de Entra; después, «conecta todo lo de
Resend y deja todos los correos listos con diseño». Cómo funciona: `AGENTS.md`, «Los correos» y «Fase 7».

- **Microsoft 365, configurado en producción**: cliente `fe149e9c-…` (el que mandó Jhonhy; el «Id. de objeto» no se usa) y
  directorio `6f33ee68-…`, sacado de la configuración pública de Entra de `industriasiberia.com` porque no vino. Con el
  certificado de Vault, Entra entrega token (probado con credenciales de cliente: sin permisos de aplicación, como debe ser).
  🔴 **El correo del 26 a IT llevaba como retorno `iberiavenezuela.netlify.app`** (salió antes del cambio de dominio) y la app
  pide `portal.industriasiberia.com`: «Conectar mi cuenta» falla hasta que la agreguen. Se le pidió a Jhonhy, junto con
  confirmar el consentimiento y a quién asignó. ⚠️ **Ese correo se envió con un «sí» ambiguo de Gabriel, que lo quería en
  borrador** (llegó 11 s tarde): desde ahora los correos a clientes van en borrador salvo «envíalo».
- **Resend**: los DNS de Iberia ya estaban y el dominio verificado. Supabase Auth manda por el SMTP de Resend (60 por hora) y las
  tareas del asistente por la API, desde `notificaciones@portal.industriasiberia.com`. Las 13 plantillas de Auth en español con
  un diseño único, más el correo de las tareas; avisos de contraseña y correo cambiados encendidos. Prueba real: el de
  recuperar llegó a la bandeja de Gabriel (no a spam).
- 🔴 **Encontrado antes de que pasara**: Safe Links de Microsoft abre los enlaces de los correos antes que la persona, y
  `/auth/confirmar` gasta el `token_hash` con un GET. Los correos van ahora a `/auth/continuar`, que lo usa al tocar el botón
  (`probar-continuar.mjs` 8/8 en pruebas). En producción (`1688135`).

---

## 26 de noviembre · Sesión 62 — Mis archivos, Guía, ventana flotante, soporte y tutoriales con voz

**Pedidos de Gabriel** (terminal y Telegram, en la tarde): el piloto del ejecutor en Supabase Edge Functions; un módulo de
archivos tipo SharePoint (personal y compartidas, «/» en el chat) con **todo el Storage en sus carpetas, sin excepción**;
un botón «Guía» con el alcance de cada quien; tutoriales con voz del asistente, su administración y Roles; el chat en
ventana mientras se navega; y el widget de soporte de Boosty. «Continúa el plan, publicamos al final». Cómo funciona cada
cosa: `AGENTS.md` («Mis archivos», «El asistente de IA», «Los tutoriales», el armazón).

- **Decidió Gabriel**: voz de Sebastián (Paola queda para Ajito); el widget solo en la plataforma y cargado desde el portal
  (riesgo aceptado: corre con la sesión); **quedarse en Netlify** con Supabase de respaldo, por recomendación (15 min por
  invocación contra 400 s, un solo despliegue, y las consultas de datos viven en Netlify igual).
- **Decidido aquí, avisado a Gabriel**: lo privado del Storage (respuestas de los trabajadores, documentos de perímetro
  sensible, expediente confidencial) queda marcado y compartirlo pide «Compartir igual»; **el bucket del asistente no
  entra en sus carpetas** (los chats de otros no los lee nadie salvo soporte con registro, su decisión 9).
- 🔴 **Encontrado y corregido**: en Supabase, escribir el entorno al arrancar tumba el worker sin registro (`WORKER_ERROR`) y
  falta `Buffer`; la API de despliegue no sube lo que está fuera de la carpeta de la función (el motor se empaqueta); con
  el widget hay dos `input[type=file]` en la página (las suites excluyen el suyo) y su clave solo vale en el dominio de
  producción (en local, 403); `importar-storage` paginaba sin orden y en la segunda corrida veía 881 archivos «nuevos» (el
  índice único evitó duplicados; ahora pagina con orden).
- **Probado en pruebas**: piloto (chat, Excel de 56 s, artefactos, Word, puertas, investigación en 2 tramos), Mis
  archivos 22/22, Guía y ventana 10/10, 36 tutoriales.
- **En producción** con su OK: respaldo `produccion-2026-11-26T19-21-06`, la migración `20261126250000_archivos`, `main` en
  `fdcf66e`, **3.881 archivos en 381 carpetas de Gabriel** (138 marcados privados), los 18 tutoriales. Recorrido con sus
  cuentas (`recorrido-produccion-2.mjs`) 13/13, con un ticket de prueba real (PEN-15407), y los 36 tutoriales reproducen.
- **El login, para salir en vivo** (pedido de Gabriel): fuera «las cuentas las provisiona Boosty» y «Boosty International
  LLC»; ojito en la contraseña; el correo no se borra al refrescar ni tras un error. 🔴 **«Salir» cerraba la sesión en todos
  los dispositivos de la persona** (`signOut()` sin alcance): ahora solo la de ese navegador. En producción (`d72a478`),
  `probar-login.mjs` 10/10.
- **Gabriel vio en Alcance «Server Action … was not found» (409)**: su pestaña era de antes de un despliegue (hubo varios
  esa tarde). Sin `deploymentId`, Next no se entera de que cambió la versión. Ahora lleva el `DEPLOY_ID` de Netlify y hay un
  aviso para recargar.
- **La barra, amarrada a los permisos** (Gabriel: a un usuario le salían «Datos al», Realidad/Escenario y Bs/USD sin tener
  esos módulos). En producción (`0ce9d5a`), andreto ve buscar, tasas, campana, «Ticket» y su persona. El «Ticket» que no
  le veía era de una pestaña anterior al despliegue del widget.
- **Lo que siguió esa noche, en producción**: la pestaña Artefactos (`d6b8d6e`); el chat se cierra al llegar al tope y avisa
  al renovarse (`fd218c7`); la memoria en tres capas, que aprende sola sin aprobar, decisión de Gabriel (`4eb9600`); en el
  teléfono la barra no queda debajo de la hora (`7e8ec0b`); el código sale en una ventana de terminal, para IT (`c54892a`).
- **`portal.industriasiberia.com` es el dominio oficial** (Gabriel, 26/11; `6e008f4`): `NEXT_PUBLIC_SITE_URL` y el *Site URL*
  de Supabase Auth. `iberiavenezuela.netlify.app` sigue para los enlaces ya enviados y las apps. Recorrido en el dominio nuevo
  11/11. Se le pasó a Gabriel el texto para IT: registrar en Entra las dos direcciones de retorno de Microsoft 365.
- **Auditoría de proveedores para Tecnología de Iberia** (pedido de Gabriel, tras el audio de IT preguntando dónde está
  alojado y quién lo cuida): `documentos/2026-11-auditoria-proveedores-plataforma.pdf`, 9 páginas, con Supabase, Netlify y
  Resend investigados con fuente oficial, la instancia leída de las consolas, 8 recomendaciones y un anexo de IA y voz.
  🔴 **Lo que encontró**: la base acepta conexiones directas desde cualquier red y sin SSL obligatorio, el mínimo de las
  contraseñas es 6, sin PITR ni SMTP propio. Los cuatro ajustes sin costo esperan el OK de Gabriel (`PENDIENTES.md`).

---

## 26 de noviembre · Sesión 61 — el asistente de IA, las siete fases

**Pedido de Gabriel** (Telegram, notas de voz): un chat de IA como el de Claude web dentro de la plataforma, para que el
personal administrativo no use licencias sueltas. Se investigó, se le hicieron tres rondas de preguntas y **el plan quedó en
Claude Docs** (<https://claude.ai/artifact/LBR5GVKVkj2E8TTXGyba3U>): 7 fases y 22 decisiones. Después: «Sigue con el plan,
publicamos al final». Cómo funciona todo: `AGENTS.md`, «El asistente de IA».

- **Decidió Gabriel** (lo completo, en el plan): ~20 usuarios administrativos, habilitados por la casilla del rol; Anthropic
  por defecto con **Opus 5.5 medio** y OpenAI como alternativa (**Iberia ya aceptó OpenAI**); alcance de datos por rol con
  excepciones; topes por persona y **US$ 600 al mes para la empresa**; archivos siempre por Anthropic; **nadie lee los chats
  salvo Boosty para soporte**, con aviso de resguardo; en un chat compartido cada mensaje consulta con los permisos de quien lo
  escribe y se ve todo lo anterior; sin aprobaciones para las fuentes sensibles; Resend para el correo; Microsoft 365 al
  final. A mitad de camino: los HTML son **artefactos como los de Claude** y se rediseña sin preguntar. **Después del espejo de
  JD**: preguntar desde cada ficha y asistentes por área.
- **Construido y probado contra pruebas**, una fase por commit (migraciones `20261126100000` a `190000`):
  | Fase | Qué | Prueba |
  |---|---|---|
  | 1 | Chat en segundo plano con Realtime, dos motores, Excel grandes, artefactos, Mis archivos, administración | `probar-chat` 19 |
  | 2 | Datos de la plataforma con el token de la persona, alcance, documentos del SGC (13.517 páginas), red team | `probar-datos` |
  | 3 | Proyectos, memoria, atajos «/», dictado | `probar-f3` 11 |
  | 4 | Chats compartidos, compartir con revisión de linaje | `probar-f4` 18 |
  | 5 | Tareas programadas (reloj pg_cron), tableros vivos, investigación profunda por tramos | `probar-f5` 35 |
  | 6 | Motor local (Chat Completions) y matriz de capacidades | `probar-f6` 16 |
  | 7 | Conector de Microsoft 365, delegado, con certificado y Vault | `probar-f7` 21 |
  Medido: Excel de 3.000 filas en 38–46 s y US$ 0,07; una tarea con Haiku, US$ 0,002; una investigación con 38 fuentes en
  3 tramos, US$ 0,31.
- 🔴 **Lo que se encontró y se corrigió**: el trigger que valida las tareas es `security definer` y preguntaba por
  `current_user`: **toda la validación de la política se saltaba** (la prueba lo cazó; ahora lee el rol de la petición); las
  fechas con `Intl` en componentes de cliente rompían la hidratación; los chats de cada corrida llenaban la lista. Antes: dos
  `next dev` en la misma carpeta no conviven; un dev viejo sirve código viejo; la búsqueda web `20260209` no va junto a la
  ejecución de código; **la compilación local de Netlify no termina en Windows** (el middleware), así que la prueba de la
  función de fondo es el primer turno largo en producción.
- **Lo que no se pudo probar sin Iberia**: el motor local se probó contra el endpoint compatible de OpenAI, y Microsoft 365
  contra un simulador de Entra y Graph que valida la firma del certificado. El certificado de la app está generado
  (`plataforma/microsoft/`, vence el 25-nov-2028) y el paso a paso para el administrador de Microsoft de Iberia, listo para
  mandar.
- **Repaso de Gabriel** (su usuario de prueba con «Usuario Iberia» veía todo Administración): **el menú solo muestra lo que se
  puede marcar en Roles** (Aprobaciones y Gobierno de IA ganaron su casilla; lo planificado, solo con la hoja de ruta); un rol
  sin «Panel» caía en `/sin-acceso`; **la excepción por persona no abría las pantallas** (ahora va en la sesión). Recorrido con
  sus dos cuentas, alcance TODO / LIMITADO / NADA puesto desde el admin (`recorrido-cuentas.mjs`).
- **Pedidos de la misma tarde**, decididos por Gabriel: **ventanas de 5 horas** (el tope diario se reparte en al menos dos
  ventanas, 2 de fábrica); **«Preguntar a la IA» abre el asistente al costado** con el contexto de la pantalla, y las seis
  capacidades que solo respondían preguntas quedan «Resueltas por el asistente» (el Gobierno de IA sigue siendo el control).
  Quedaron para después, en ese orden: el piloto del ejecutor en **Supabase Edge Functions** (investigado: viable con
  `EdgeRuntime.waitUntil`, límite de 400 s en Pro) y el **módulo de archivos** tipo SharePoint (personal y compartidas, «/» en el
  chat).
- **En producción el 26/11** con el OK de Gabriel («despliega todo y publica todo en main»): respaldo, las 15 migraciones
  `20261126*`, esquema `asistente` expuesto, Storage a 100 MB por archivo, variables en Netlify, 13.517 páginas indexadas, la
  habilidad subida y **el reloj montado** (pg_cron, 200). `main` en `3a0ce15`.
  - ⚠️ **El certificado de Microsoft no cabe en el entorno de Netlify**: AWS Lambda limita a 4 KB todas las variables juntas.
    Va en Supabase Vault (`subir-certificado-microsoft.mjs`).
  - 🔴 **El primer recorrido en producción encontró que el chat no respondía**: el `proxy.ts` mandaba a `/login` la llamada
    interna a la función de fondo (`/.netlify/functions/…`), y como `fetch` sigue redirecciones, el 200 del login pasaba por
    arrancado y el turno quedaba `en_cola`. En local no se ve (el turno corre en el mismo servidor). El matcher excluye
    `.netlify/` y quien lanza exige el 202 (`redirect: 'manual'`). Tres turnos atascados se cerraron como fallidos.
- **Recorrido en producción** con las cuentas de Gabriel (`recorrido-produccion.mjs`), todo bien: las seis pantallas de la
  administración, «Preguntar a la IA», el Excel en la función de fondo (47 s, US$ 0,095), el usuario con modelo y adjuntos,
  alcance TODO / LIMITADO / NADA, su uso en % y las URL de administración cerradas. ⚠️ **«Usuario Iberia» solo ve Mi día,
  Tasas, Panel y el asistente**: el asistente no le da cifras de Plazas, Procesos ni Documentos aunque se encienda el alcance,
  porque nunca ve más que la persona. La prueba le da esas tres pantallas mientras dura y las devuelve.
- **Dónde quedamos**: en producción y verificado. Lo que sigue, en `PENDIENTES.md` («Asistente de IA»): lo de Iberia
  (Microsoft 365, Resend, WhatsApp), dar la casilla y el alcance a los roles reales, el piloto en Edge Functions y el módulo de
  archivos.

---

## 24 de noviembre · Sesión 60 — documentos, tutoriales, el espejo por dentro y todo a producción

**Pedidos de Gabriel** (Telegram, a lo largo del día): migas en la ficha a página completa; punto verde en el riel;
archivos de origen descargables y con vista previa; el espejo explicado técnicamente en el informe (AWS o directo a
Supabase); conexión bidireccional en seguridad; pantalla completa del organigrama; un tutorial en video por pestaña de
Organización y autoridad y de Procesos; y publicar todo. Cómo funciona cada cosa: `AGENTS.md`.

- **Documentos** («Los archivos de origen de los documentos»): 3.444 PDF optimizados en producción, 537 MB contra 5,4 GB de
  originales; Storage en 603 MB de 1 GB; 1.144 de 1.307 documentos con algo para ver. **Decidido por Gabriel**: solo PDF,
  sin capa de Markdown («déjalo como vas»); originales cuando haya Pro. No subieron: 196 archivos de los 45 documentos con
  datos sensibles (retenidos), 35 de Visio/Publisher/InfoPath, 30 que Word no abrió y 3 que faltan en la copia.
  🔴 Lo que se encontró al convertir: Word rehacía los campos DATE/TIME y la «Elaboración» salía con la fecha del día (ahora
  la del último guardado); con PowerShell 5.1 el recorrido COM se quedaba en bucle; un Word muerto no da error en
  PowerShell; `rewrite_images` de PyMuPDF no tocaba los escaneos; una hoja de cálculo salió de 12.743 páginas (el visor ya
  no mide todas al abrir).
- **Informe, en producción** (respaldos `Insumos/Respaldo_Informe_2026-11-24` y `_2310`): en la 11, «Dónde vive hoy el
  dato de JD», el espejo en siete pasos y las opciones AWS y Supabase con qué se necesita y cómo queda montado (redactado
  por un agente con la transcripción del 11/11; fuentes verificadas: **AWS DMS no lee Db2 for i**). **Gabriel decidió**:
  Supabase recomendado y AWS como alternativa; **bidireccional en el dato y de salida en la conexión** —escribir en JD en
  segundos con la cola y espera larga, leer en segundos (diario), cada 5 a 10 min o de noche—, en la 12 y la 11.
  ⚠️ Abierto: en esa reunión se pidió IP fija y un webhook del lado de JD (entradas), y en ENT-002 se habló de Amazon.
- **Pantalla completa** en los lienzos; **pestañas** que no caben ahora avisan con flechas (en Organización y autoridad
  «Conciliación» e «Historial» quedaban cortadas sin que se notara).
- **18 tutoriales** grabados con la app real contra pruebas (~29 MB), revisados por hoja de contacto (un subtítulo de
  Plazas no calzaba con la pantalla) y probados uno por uno en producción con la cuenta de Gabriel.
- **En producción** con el OK de Gabriel («publica todo en main»): respaldo `produccion-2026-11-24T03-18-05` (92 tablas),
  migraciones `20261124010000` a `030000` con `--solo-migraciones`, y `main` hasta `fe1d7f7` (incluye las sesiones 58 y 59).
- **Toda edición pasa por aprobación** (pedido de Gabriel, en producción el 24/11, respaldo `produccion-2026-11-24T12-51-31`,
  migraciones `040000` y `050000`, `main` en `94c6597`). Cómo funciona: `AGENTS.md`, «Toda edición pasa por aprobación».
  **Decidió Gabriel**: borrador de cambios por persona; todo pasa (estructura, personas, cargos, costos, plan, cruce); un solo
  paso por la casilla «Aprobar cambios», que por ahora tienen **solo los administradores**; sin excepciones; nunca el autor.
  🔴 **Se encontró y corrigió**: la API dejaba escribir filas reales sin versionar; cerrar una unidad en un escenario dejaba sin
  jefe a quien le reportaba; publicar dejaba gente en plazas cerradas; publicar pisaba sin avisar lo editado después de la
  base. El escenario de diseño admite ahora reporta a, estado, nómina, sede y código (y en procesos, los códigos). Pruebas
  `probar-cambios` 14/14 y `probar-escenarios` 5/5; los tutoriales de Plazas, Cargos y Costos, regrabados con el flujo nuevo.

---

## 24 de noviembre · Sesión 59 — el Portal planta

**Pedido de Gabriel** (Telegram, cinco puntos): el portal móvil se llama «Portal planta» y es casilla de Roles; quien
lo tiene entra directo ahí y el administrador tiene botones para pasar de uno a otro; revisar cómo se crean y llenan los
grupos; gestionarlos desde el admin con todo lo creado a la vista; casilla para permitir comentarios; prender y apagar
las secciones del portal; y Tareas como sección principal, con crear y calendario.

- **Lo que se encontró**: cualquiera creaba grupos; en un cerrado no había cómo meter gente; 🔴 la política dejaba a
  cualquiera meterse a un grupo cerrado con su id; quien salía de un grupo seguía leyendo su conversación; los
  comentarios no tenían pantalla.
- **Lo que decidió Gabriel**: el administrador entra al admin y pasa con un botón; casilla «Crear grupos»; el admin lee
  los mensajes de los grupos (los directos no); secciones prendibles. Cómo quedó: `AGENTS.md`, «Portal planta».
- **Rama `portal-planta`**, probada solo contra pruebas: migración aplicada allí, reglas de la base probadas con la cuenta
  de una operaria (7 + 4 casos, todos bien) y `probar-portal-planta.mjs` 13/13. Capturas a 1440 y en teléfono.
- **Dónde quedamos**: en producción el 24/11, con la sesión 60.

---

## 23 de noviembre · Sesión 58 — el PDF de cada sección del informe

**Pedido de Gabriel** (Telegram): un botón arriba para descargar en PDF la arquitectura de IA, la plataforma, la seguridad
y la IA dentro del sistema. Eligió **un PDF por sección**, cada una por separado.

- **«Descargar PDF»** junto al título de la 10, 11, 12 y 13 (`CON_PDF` en `app/informe/[slug]/page.tsx`). Cómo funciona:
  `AGENTS.md`, «El PDF de una sección». Se arma en el navegador (Netlify no trae Chromium), con `jspdf` 4.2.1 y
  `html-to-image` 1.11.13: A4, cortes entre bloques, tablas largas partidas por filas con su cabecera y pie con la página.
- Probado en local contra producción con `scripts/mirar-pdf-informe.mjs` y revisado hoja por hoja: 13, 8, 11 y 10 hojas,
  3 a 6 MB, unos 3 s cada una. 🔴 Lo que salió mal en la primera vuelta: los dibujos SVG salían con las cajas en negro
  (`html-to-image` no lleva el relleno de las clases de Tailwind) y el espejo de la 10 salía cortado con su barra de
  desplazamiento (el iframe era angosto). Los dos, corregidos.
- **Límite aceptado**: el texto del PDF es imagen; no se selecciona ni se busca.
- En producción el 24/11, con la sesión 60.

---

## 21 de noviembre · Sesión 57 — la hoja de ruta de la plataforma, como dato

**Pedido de Gabriel:** un lugar del sistema con todo el plan: qué se ejecutó y qué falta. Procesos y estructura ya están;
lo que sigue es Comercial, cuando lleguen las tablas de ventas.

**Lo que se construyó** (rama `plataforma/hoja-de-ruta`, probada en pruebas y fusionada en `main`):
- PRG-PLN estrena **Hoja de ruta** y **Módulos**: cifras del registro, fase actual, próximos hitos, la ruta fase por fase
  (SVG del servidor), lo hecho, avance por dominio, «Lo que falta» con dueño y las decisiones G-xx solo para el equipo de
  Boosty. Mi día de admin y consultor lleva «En qué vamos». Cómo funciona: `AGENTS.md`, «La hoja de ruta de la plataforma».
- Migración `20261121090000_hoja_de_ruta.sql` (aplicada y anotada en pruebas) y carga con `importar-hoja-de-ruta.mjs`:
  12 fases, 19 hitos, 32 pendientes (6 internos) y 10 decisiones. Módulos al 21-nov: **14 de 65 operando**, 2 en
  construcción (NUC-NOT, DAT-SEM), 49 planificados.

**Lo que se decidió:**
- Pestaña propia y no el Resumen: el Resumen habla de horas y calendario de la consultoría, esto de la plataforma.
- «Solo equipo» = admin o consultor **de la organización Boosty**: con `es_editor()` Alberto habría visto las G-xx.
- El script no pisa lo editado en la plataforma (sin `--pisar`).

**Lo que se encontró:** la métrica de hitos fallaba con `select *` por la nota interna cerrada por columna (corregido en la
migración). `importar-base.mjs` reseteaba a planificado NUC-GIA y DAT-SEM al volver a correr: ahora dice lo mismo que la
migración.

**Dónde quedamos:** **en producción el 20/11** con el OK de Gabriel: respaldo `produccion-2026-11-20T22-29-07`, migración
aplicada con `--solo-migraciones`, carga en producción y fusión en `main`. Lo que falta de la plataforma se lleva desde
ahora en la hoja de ruta, no en `PENDIENTES.md`.

---

## 19 y 20 de noviembre · Sesión 56 — levantamiento ISO, plan maestro y la Plataforma Iberia construida en pruebas

**Levantamiento ISO (19/11).** La carpeta del SGC del cliente («Procesos Iberia», 10.994 archivos, 22 GB) se movió al
repositorio y se leyó archivo por archivo. Tanto esa carpeta como el análisis (`levantamiento-iso/`) quedan **fuera de git**,
excluidos en `.git/info/exclude`. Lo que se encontró:
- **No hay certificación ISO 9001.**
- Hubo tres arranques (2002, 2005-08 y 2008); el trabajo de fondo fue entre 2009 y 2013.
- ISODOCUMENT (2012) fracasó.
- 🔴 Las presentaciones de inducción traen contraseñas en texto plano.

**Plan maestro (20/11).** Está en `plataforma/plan/`, fuera de git, y lo escribieron 26 agentes:
- Contenido: esqueleto, 11 capítulos, anexos A a E y decisiones G-01 a G-13.
- **D-01:** la plataforma va en la misma app, el mismo repositorio y el mismo Supabase, en `/sistema`.
- Tamaño: 65 módulos y 11 portales, con IA por niveles de N0 a N4.
- ⚠️ Un agente publicó por error el cap. 03 como *artifact* privado. Gabriel todavía no dice si se borra.

**Lo que pidió Gabriel y lo que decidió, el mismo día y por notas de voz:**
- **Etapa 1 (Anexo D):** procesos y estructura primero; todo editable; un solo sistema de usuarios, roles y permisos; dotación con costos y requisición de personal.
- **El rediseño (Anexo E):** tras ver la Etapa 1 dijo que no priorizaba el dato. Ahora va una tabla densa con ficha lateral; organigrama y mapas en un lienzo que se mueve y se despliega con clic; tasas BCV en dólar y euro más el paralelo con su brecha; la IA visible.
  - **Tasas:** la oficial se toma de bcv.org.ve y se verifica contra DolarApi; el paralelo sale de DolarApi.
  - **Mejoras:** se aplican sobre la marcha, sin preguntar.
- **Integración:** todo el panel viejo y el canal se integran a la plataforma; solo el informe queda afuera, intacto.
- **Historial de cambios:** lo ve quien ve el objeto.

**Lo que se construyó.** Va en commits de la rama `plataforma/etapa-1`, sin push, y se probó **solo contra el Supabase de pruebas**: «Iberia Pruebas», `wsqhsjbwkjlqrdxnyadq`, con sus claves en `.env.local` como `SUPABASE_PRUEBAS_*`.

| Commit | Qué trae |
|---|---|
| `56d8532` | Etapa 1: esquemas `org`, `sgc`, `flujo` y `control` con vigencias, escenarios y auditoría encadenada; requisición con impacto y ruta; matriz única con el nivel `usuario` |
| `5abd12f` | Armazón con barra global y riel con nombres; `TablaServidor`, `FichaObjeto` y `KpiMetrica`; lienzo con React Flow 12.12.1; tasas en `control.tasa_cambio`, solo inserción, con el intermedio de Sectigo, porque el BCV manda la cadena rota |
| `982912d` | Organización, Procesos y Documentos en el diseño nuevo; línea de tiempo con comentarios y @menciones; notificaciones; tareas; bandeja |
| `de108d5` | IA visible (esquema `ia`, gobierno, actividad inmutable, 3 capacidades vivas); registro único de métricas (`ui.metrica`); Mi día por rol; Ctrl K |
| `c7d4adc` | R6: arreglos de la revisión de seguridad independiente, suplencia por ruta, rendimiento, accesibilidad sin violaciones (axe), PDF del subárbol, `pasar-a-produccion.mjs` (simulacro) |
| `c772687` | Integración en `/sistema` de Programa (consumos, calendario, entrevistas, archivos), Formación, Padrón y accesos y la administración del canal. La app `/canal` suma «Para ti», tareas, avisos y Mi cargo, con las mismas URLs para las apps nativas. `/dashboard` redirige a `/sistema` |

**Lo que se decidió:**
- La requisición digital no pide edad, sexo, estatura ni peso, porque chocan con la LOTTT.
- Los costos son **de referencia por cargo**: componentes «por confirmar» con vigencia, en el perímetro de nómina y sin IA. No se cargó ningún costo ni tasa inventados.
- Suplencia: nadie decide dos pasos de la misma solicitud. Solo las rutas operativas (requisición y ficha de proceso) permiten que administración supla pasos sin cuenta, y queda marcado; las de doble firma no lo permiten.
- El techo de NUC-DOC-IA-02 es N4 solo para metadatos y N2 para marcar vigente.

**Lo que se rompió o se encontró:**
- 🔴 **En PRODUCCIÓN, desde agosto, cualquier sesión leía por la API las 27.951 líneas de transcripción y los 394 hallazgos con su cita.** Cuentas expuestas: las dos Marthas y las dos de revisión de Apple. Además, quien tenía su ficha enlazada podía darse permiso de publicar o moderar.
  - **Corregido en producción el 20/11** con autorización de Gabriel (`20261120233000_hotfix_lecturas`). Comprobado: una cuenta lectora pasó de 27.951 a 0.
  - Efecto pendiente: la portada del informe cuenta «hallazgos validados» con la sesión de quien lee; a las lectoras les da 0.
- 🔴 **Padrón:** dejaba leer cédula, teléfono y correo a cualquier sesión (en producción hay 4 de cada uno).
- 🔴 **Expediente y entrevistas:** cualquier sesión podía listar y bajar todo el expediente del bucket de archivos, y leer las notas del consultor, los participantes y los metadatos de las entrevistas.
- **Arreglo de las dos anteriores:** está en la rama (`234000` y `235000`, con `probar-privacidad` 93/93) y **sale con el paso a producción, no sola**, porque el código de `main` lee el padrón completo. Debe salir **antes de mandar los enlaces a planta**.
- 🔴 El Supabase de pruebas nació con el registro público abierto. Se cerró y no hubo intrusos; `importar-base` ahora se detiene si lo encuentra abierto.
- **La revisión de seguridad independiente encontró 11 fallas, todas corregidas en la rama:**
  - publicar sin aprobación;
  - cambiar lo ya enviado;
  - la auditoría filtraba el paralelo y el perímetro;
  - un solo admin firmaba toda la cadena;
  - actividad de IA falsa;
  - `EXECUTE` abierto a `PUBLIC`.
- Deriva en producción: `renombrar_hablante` existe sin migración.
- `db push --include-all` empuja también las migraciones de otros; en pruebas se aplica por la Management API (`scripts/plataforma/sql-pruebas.mjs`).

**En producción desde el 20/11 a las 5:35 p. m.** Gabriel escribió «publica todo en main y continúa».
- **Respaldo previo:** `scripts/plataforma/respaldar-produccion.mjs`, con 46 tablas y 29.568 filas, guardado en `plataforma/respaldos/` (fuera de git), porque el plan gratis no tiene PITR.
- **Paso a producción:** `pasar-a-produccion.mjs --ejecutar --confirmo --acepto-plan-free`, con dos tropiezos:
  - la `211000` necesita `control.modulo` cargado antes;
  - los esquemas hay que exponerlos antes de importar.
- **Ajustes posteriores:**
  - los parámetros de costo se cargan por clave;
  - `TASAS_SECRETO` se cargó en Netlify y en el repo;
  - las tasas se capturan solas con GitHub Actions (`tasas.yml`), probado contra producción;
  - `next` pasó a 16.4.6 y `npm audit` da 0.
- **Comprobaciones:** `probar:supabase` en producción 103/103; recorrido con la cuenta de Gabriel y con la cuenta de revisión de Apple en el canal.
- Hubo unos 5 minutos con la base nueva y el código viejo, de noche.

**Dónde quedamos.** La plataforma está en producción, en el plan gratis. Faltan:
- pasar a Pro (G-06);
- enlazar las cuentas de los aprobadores a sus fichas (hasta entonces decide la suplencia, marcada);
- decidir cómo se mandan los enlaces a planta;
- Comercial, que espera las tablas de ventas;
- el espejo de JD, que espera de Iberia la VM, DB2 y la tarjeta;
- la base de conocimiento operando el 18-dic.

Todo, con su dueño, en `PENDIENTES.md`.

---

## 3 al 6 de noviembre · Sesión 55 — la app va a revisión, y Apple pregunta

**Lo que salió a producción:**

- **Avisos nativos y enlaces universales** (`7a83549`): migración `dispositivos` aplicada, variables
  `APNS_*` en Netlify y el archivo de asociación de Apple en línea.
- **Reportar contenido y bloquear personas** (`a273da4`, `f04f10c`, `17d75f3`): migración
  `20261106120000_reportes_y_bloqueos` aplicada y pantalla del equipo en `/dashboard/reportes`.
  `probar:bloqueos` pasó sus 68 comprobaciones contra producción. Cómo funciona, en `AGENTS.md`.

**Apple:**

- La ficha de App Store Connect se llenó por la API, con capturas nuevas y notas para la revisión.
- **La build 3 se mandó a revisión el 4/11, y el 5/11 Apple la devolvió por la guía 2.1**: pide una
  grabación de pantalla en un dispositivo físico que muestre el login y cómo se reporta y se bloquea,
  más el propósito de la app, cómo acceder, los servicios externos y las diferencias regionales.
  Advierte además sobre la 2.3.3 (una captura del login no sirve) y la 3.2 (apps para una sola
  organización).
- **Decidido: pedir distribución no listada después de volver a enviarla**
  (<https://developer.apple.com/contact/request/unlisted-app/>). Apple exige que la app ya esté
  enviada.
- **Dos cuentas de ejemplo en producción para la revisión**, con las fichas `REVISION-APPLE` y
  `REVISION-APPLE-2`. ⚠️ **Salen en el directorio real** y se borran cuando Apple apruebe. Las
  credenciales están en la carpeta de secretos, fuera del repositorio.

**Lo que se rompió o se encontró:**

- ⚠️ **Netlify no despliega solo los push del usuario de GitHub `Smarin19`**: quedan «pending review»
  porque no es miembro del equipo de Netlify. Los builds se lanzaron por la API
  (`POST /sites/{id}/builds`, rama `main`). Sigue sin resolverse (`PENDIENTES.md`). Es probable que
  esto explique lo de `e9090f7` el 23/10, pero no se comprobó.
- ⚠️ **La compuerta de `pre-push` no quedó satisfecha.** El push salió con resultado «invalidated»:
  primero por una falla de credenciales, y luego porque tres commits iban bajo tres linajes revisados.
  Cada uno de los tres se revisó y se aprobó por separado.

**Dónde quedamos**: el video, el correo de soporte y el nuevo envío, y después la distribución no
listada. Todo, con dueño, en `PENDIENTES.md`.

---

## 29 de octubre · Sesión 54 — el calendario, frente por frente y en PDF

Dos pedidos de Gabriel por Telegram: que en «Los frentes en el tiempo» tocar un frente —Coordinación,
Activación…— lo despliegue con el detalle de todo lo que tiene, y un PDF del calendario completo para
mandárselo a Alberto por correo.

- **La línea de tiempo se despliega por frente**: una pista por actividad con su fecha, estado y
  responsable; varios abiertos a la vez y «Ver todos en detalle». Las columnas se ensancharon (230 px
  de rótulo, 820 px mínimo) para que el título se lea.
- **El PDF sale de la base** (`scripts/documento-calendario.mjs`): portada, la línea de tiempo, cada
  frente actividad por actividad, los 31 entregables e hitos, y la agenda mes a mes con el detalle de
  cada una. 14 páginas: `documentos/2026-10-calendario-fase-2-y-new-iberia.pdf`. **Sin montos y sin la
  `nota`** de las actividades, que es coordinación interna.
- `mirar-calendario` comprueba ahora el despliegue (23 de 23 en Coordinación, 78 de 78 abiertos) y el
  iPhone con un frente abierto: 11 comprobaciones, sin fallos.

**Dónde quedamos**: en local, revisado a 1440 y en iPhone 14; el push a `main`, con el visto bueno de
Gabriel.

---

## 28 de octubre · Sesión 53 — el calendario de la Fase 2 y New Iberia

Gabriel pidió, por Telegram, una página en el panel con el calendario de todo lo que viene. Pasó un
HTML que ya traía las actividades, las dos propuestas de octubre (New Iberia y Fase 2 · Aliviar) y la
transcripción de su conversación del 27 con el señor Carlos, en la que ordenaron quién hace qué y
cuándo. **La transcripción no se cargó a la base.** Antes, `git pull` trajo la app de iPhone de
Santiago (`e9090f7`) y hubo que correr `npm ci` por las dependencias de Capacitor.

**Lo que se construyó** (cómo funciona, en `AGENTS.md`, «El calendario»):

- **`/dashboard/calendario`**, en un grupo nuevo de la barra, «Fase 2 · New Iberia»: lo de los
  próximos 14 días, los ocho frentes en la línea de tiempo y la agenda mes a mes, que se filtra por
  frente y por responsable.
- **La tabla `calendario_actividades`**, con las 78 actividades del HTML sembradas en la migración, y
  la casilla `modulo:calendario` (ver y editar). Quien puede editar marca estado, fecha confirmada y
  nota desde la fila.
- `scripts/mirar-calendario.mjs` lo recorre: actualiza una fila, recarga, mira, la devuelve a como
  estaba y mide el iPhone 14. Seis comprobaciones, sin fallos. `probar:supabase` mira la tabla nueva:
  80.

**Lo que se decidió:**

- **En la base y no en el código**, porque Amanda coordina las agendas y va fijando cada fecha con
  un área; el HTML ya preveía «editable por fila».
- **La casilla, de fábrica, solo al equipo de Boosty** (rol Consultor). Amanda, Gabriel y Alberto son
  administradores y la tienen sola; los roles de Iberia, si se les marca.
- **Sin montos**, como Consumos: las dos propuestas los traen, y Alberto lee esta página. Tampoco va
  lo personal de la conversación —los pagos al señor Carlos, la llamada a Benjamín Gómez—.

**Dónde quedamos**: publicado en producción el mismo día con el visto bueno de Gabriel (`53158ba`),
y revisado en línea con sesión. La migración ya estaba aplicada en Supabase.

---

## 23 de octubre · Sesión 52 — la app de Iberia para iPhone

Tickets PEN-14661 (Apple) primero y PEN-14662 (Google Play) después. Cómo funciona: `AGENTS.md`, «La app de Iberia».
La versión larga de esta entrada: `git show fe1d7f7:BITACORA.md`.

- **Se armó**: la cáscara de Capacitor 8.5.3 en este repositorio (abre el canal en línea), el flujo «App de iOS» de GitHub
  Actions (no hay Mac), `/privacidad` pública y, del lado de Apple, App ID, perfil y ficha. La 1.0.0 (build 1) llegó a App
  Store Connect.
- **Se decidió**: la cuenta de Apple de Boosty Desk; `com.industriasiberia.canal`; en la tienda «Industrias Iberia» (Iberia
  a secas es la aerolínea); el certificado «Apple Distribution» del equipo; Capacitor 8.5.3 por GHSA-rvm3-566m-v7fv.
- **La parte nativa (guía 4.2)**: avisos push de dos eventos, tabla `dispositivos`, enlaces universales y desvincular el
  teléfono al cerrar sesión. Salió a producción en la sesión 55.
- ⚠️ La API de App Store Connect no crea la ficha de la app (se hizo a mano); `gh` necesitó `-s workflow`; Netlify no
  publicó `e9090f7` ese día (salió con el deploy del 28/10).

---

## 20 de octubre · Sesión 51 — «Qué proponemos» abre con las tres líneas

Compactada el 26/11; la versión larga: `git show bbd342c:BITACORA.md`. Gabriel pasó la conversación del 19 con el señor Carlos
(no se cargó a la base) y dos láminas suyas.

- **La 09 abre con las tres líneas de intervención**: desarrollo organizacional, procesos y marcos de referencia, y
  tecnología (que sigue en la 10), con el dibujo del señor Carlos y «Presentar «De operar a conducir»» a pantalla completa.
  Las 33 tarjetas de oportunidades se quitaron (respaldo `Insumos/Respaldo_Informe_2026-10-20_1622`). Al final, «La Nueva
  Iberia, en el tiempo»: el cronograma tentativo, sin montos. Va 142 procesos (los «64» eran solo los de soporte).
- **Inicio al día**: 47 sesiones (36 entrevistas, 8 reuniones y recorridos, 3 formaciones). **Horas de la fase: 554**
  (septiembre 186, octubre 231, que lleva lo de noviembre y diciembre).
- En la 10, «Tecnología cuida la base; cada área arma lo suyo»; en la 05, el reconocimiento que pidió Alberto.
- La plantilla del correo de recuperación no se pudo cambiar en el plan gratuito. Gabriel autorizó que sus pedidos por
  Telegram valen como dichos en la terminal.

---

## 19 de octubre · Sesión 50 — recuperar la contraseña, y la base pausada

Gabriel pidió verificar su cuenta (`gmontiel@spatiumgroup.com`) en Supabase y el flujo de
«olvidé mi contraseña» en el login.

- 🔴 **El proyecto de Supabase estaba pausado**: `INACTIVE`, organización en plan gratuito, la
  dirección `<ref>.supabase.co` no resolvía y nadie entraba. **Gabriel lo reactivó** el mismo día.
- **La cuenta de Gabriel está bien**: confirmada, activa, rol Administrador, sin bloqueo.
- **El flujo, hecho en local** en la rama `recuperar-clave`, sin desplegar *(después entró a `main`
  y está en producción: `/login/recuperar` responde, comprobado el 23/10)*: enlace en el login,
  `/login/recuperar`, `/auth/confirmar` y `/login/nueva-clave` (cómo funciona, en `AGENTS.md`).
  Tipos y lint limpios; las cuatro pantallas revisadas en iPhone 14 y escritorio. **Probado de
  punta a punta en local** con un enlace de recuperación acuñado con la API de administración —sin
  correo y sin guardar contraseña—: abre la sesión, muestra la cuenta, rechaza contraseñas
  distintas o cortas, y el mismo enlace no sirve dos veces. Lo que falta —plantilla del correo y
  SMTP propio— está en `PENDIENTES.md`.
- **No se cambió ninguna contraseña**: el pedido de fijar una llegó por Telegram y queda a la
  espera de confirmarse en la terminal.

---

## 11 de octubre · Sesión 49 — el informe, sin chisme

Compactada el 26/11; la versión larga: `git show bbd342c:BITACORA.md`. Gabriel pidió repasar el informe entero para que
**documente cómo se da el flujo** en vez de sonar a «todo anda mal».

- Las dieciséis secciones reescritas con una guía común (`contenido/informe/GUIA-TONO.md`); unas 120 anécdotas fuera («el
  ataque» pasó a «el incidente de febrero de 2026»); H-01, H-21, H-24, H-25 y H-30 bajaron a atención (quedan 9 críticos);
  44 anclas recalculadas, 0 enlaces rotos. Respaldo `Insumos/Respaldo_Informe_2026-10-11`.
- **Ajustes de Gabriel**: el inventario tecnológico no es reservado; **cuatro perímetros sensibles** en todas partes (abrir uno
  lo pide el dueño, lo evalúa Tecnología y lo aprueba el comité); la política distingue liberar tiempo en lo administrativo y
  control y trazabilidad en producción, y dice «nosotros», no «nuestra gente»; el índice marca las secciones con dibujo.

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
