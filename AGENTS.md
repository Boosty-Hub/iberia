<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Industrias Iberia · Programa de Adopción de IA

## Antes de empezar y antes de terminar

**Lee `BITACORA.md` al abrir la sesión** — dice en qué estado quedó todo y qué está
pendiente. **Añade una entrada al cerrarla**, arriba del todo: qué se construyó, qué se
decidió, qué se corrigió y dónde quedamos. Sin eso, cada sesión reconstruye contexto
desde cero.

⚠️ **Antes de escribir en la bitácora hay que leerla completa** y revisar si ya tiene
contradicciones, duplicados o errores; solo después se escribe. Es una regla. Y al escribir:

- 🔴 **Nunca más de 800 líneas.** Si lo nuevo la pasa, se compacta lo viejo primero —las
  sesiones antiguas se resumen en lo decidido y lo roto—. La versión larga queda en git; la
  bitácora dice con qué comando se ve. El 27 de septiembre de 2026 tenía 3.308 líneas y se
  compactó a 243.
- **Comprobar que lo nuevo no repita ni contradiga lo que ya está.** Una decisión que
  cambia no se añade abajo: se corrige donde estaba, con una nota de que cambió. Ya pasó
  —la voz quedó «cerrada» en una sección y «pendiente de elegir» tres párrafos después—
  y una bitácora que se contradice es peor que no tenerla.
- **Mantenerla corta y precisa.** Cuando es muy larga, el agente que la lee no llega al
  final, y lo que no se lee no es memoria de nada. Al añadir, mirar si hay que recortar, y
  que el estado de arriba no se quede con fechas vencidas.
- **Cómo funciona el sistema va aquí, en `AGENTS.md`, no en la bitácora.** Allá va lo que
  pasó, lo que se decidió y por qué, y lo que se rompió. Si algo se puede explicar una vez
  y consultarse, no se repite en cada entrada.
- **Lo que falta va en `PENDIENTES.md`**, no en la bitácora.

El contexto de fondo del encargo está en `CONTEXTO_IBERIA.md`, cargado en el módulo de
archivos del dashboard: contrato, mapa de personas con sus notas de manejo, vocabulario
obligatorio hacia el cliente y reglas de comunicación.

⚠️ **Trabajan varias personas sobre el mismo repositorio.** `git pull` antes de empezar y
push al terminar la sesión, no al día siguiente: el 25 de septiembre dos personas trabajaron
sobre versiones distintas y hubo conflicto. Los talleres de `contenido/` no viajan por git —están
en la máquina de quien los escribe—: lo que dependa de un taller ajeno se corrige en la base y
se le deja dicho a su dueño en `PENDIENTES.md`.

**Lo que falta está en `PENDIENTES.md`** —ordenado por lo que bloquea y con el nombre de
quién tiene cada cosa— y cómo poner esto en línea, en `DESPLIEGUE.md`. Al cerrar algo, se
tacha ahí: si hay dos listas de pendientes, en dos semanas dicen cosas distintas.

Dashboard interno del programa de adopción de IA que **Boosty Digital** ejecuta para
**Industrias Iberia** (Fase 1 · Entender, 5 meses). Alimenta el entregable de cierre:
el **Documento de Arquitectura de IA**.

## Convenciones

- **Todo en español**: nombres de archivos, funciones, variables, rutas, tipos y
  comentarios. `entrevistas`, no `interviews`.
- **Registro de habla — modismo venezolano, siempre**: cualquier texto que se hable
  o escriba en este proyecto (correos, mensajes, textos de la app, este mismo
  documento) usa modismo venezolano, con **tuteo** — nunca voseo rioplatense ni
  otra variante— y **tono profesional** en todo momento. No es solo para el cliente:
  es el registro del proyecto completo.
- **Vocabulario del dominio en `lib/types.ts`**: las claves espejan los `CHECK`
  constraints del schema; los valores son las etiquetas que ve el usuario. Al añadir
  una opción, se cambia en la migración SQL *y* en el mapa correspondiente.
- **Estilos**: primitivas en `@layer components` de `app/globals.css` (`tarjeta`,
  `campo`, `btn-*`, `insignia`, `rotulo`, `prosa`). Tailwind 4 **no** permite
  `@apply` de una clase definida en el mismo layer — las variantes de botón heredan
  la base por selector agrupado.
- **Un solo lenguaje visual en todo el aplicativo.** El estilo salió del canal y se
  adoptó para el panel y el informe: **DM Sans** global, fondo `#f6f7f9`, superficies
  blancas con esquina `rounded-2xl`, borde tenue y una sola sombra
  (`--sombra-tarjeta`). Nada de superficies oscuras: la barra lateral, el login y el
  pie del informe son claros. El carbón (`marca-800`) queda para texto y para la
  acción secundaria de peso (`.btn-primario`).
## Marca

La app va con la identidad de **Industrias Iberia**, no la de Boosty.

- **Rojo Iberia `#D4332C`** — muestreado del máster del logo. Es `acento-500`.
- **Carbón cálido** — es `marca-*`. Un gris frío (el `slate` de Tailwind) apagaba el
  rojo; un azul competía con él. No usar `slate-*`.
- **El rojo es a la vez marca y peligro.** Se distingue por forma, no por tono:
  acción principal = rojo sólido (`.btn-acento`); acción destructiva = rojo
  perfilado sobre blanco (`.btn-peligro`) y siempre con icono. El resaltado de
  búsqueda usa **ámbar**, porque en rojo se leería como error.
- **Assets**: el máster vive en `assets/marca/` (el `.ai` vectorial y el `.jpg`).
  Los PNG que consume la web se generan — no se editan a mano:

  ```
  pwsh scripts/generar-marca.ps1            # requiere Windows (GDI+)
  pwsh scripts/generar-marca.ps1 -SoloIos       # solo el icono y el arranque de la app de iOS
  pwsh scripts/generar-marca.ps1 -SoloAndroid   # solo los iconos y el arranque de la de Android
  ```

  Produce `public/marca/iberia.png` (rojo), `iberia-blanco.png` (para el carbón),
  `iberia-onda-blanca.png` y `app/icon.png` (baldosa roja con "IB"), y el icono y la
  pantalla de arranque de la app de iOS (ver «La app de Iberia»). El script recorta al
  trazo, descarta la sombra gris del JPG y reconstruye el alfa.
- El favicon usa **"IB"**, no la onda: la onda tiene relación 8.7:1 y a 16 px se
  convierte en un borrón.

- **Cuidado con los reemplazos masivos de clases**: `translate-` contiene la
  cadena `slate`. Un `slate- → marca-` a ciegas lo rompe.

## El canal (`/canal`) — mobile first

La app de comunicación interna es **otra cosa que el dashboard**, aunque comparta
proyecto y sesión. Se diseña para el teléfono de un operador de planta, no para el
escritorio de un consultor.

- **Tipografía propia**: DM Sans (`--font-canal`), autoalojada por `next/font/google`.
- **Paleta clara**: fondo `#f6f7f9`, tarjetas blancas muy redondeadas, el rojo de Iberia
  para la acción y `oro-300` (`#FFD036`) para lo oficial.
- **44 px de objetivo táctil** en todo lo que se toca (`.toque`). El pulgar llega abajo:
  la navegación principal va al pie, no arriba.
- **Vocabulario y reglas en `lib/canal.ts`.** `requiereSolicitud(mío, otro)` es la regla
  de convivencia: entre niveles vecinos se solicita conexión; hacia arriba —dos niveles
  o más— se escribe directo. Es norma social, no límite de seguridad: se aplica en la
  aplicación, no en RLS.
- **El enlace de WhatsApp es la credencial** del personal sin correo. En `accesos` se
  guarda el hash, nunca el token en claro, y la tabla no se lee desde el cliente.

```
npm run probar:canal   -- --password "<clave>"   # 28 comprobaciones de RLS reales (también el contacto del padrón)
npm run capturar:canal -- --password "<clave>" --flujo   # iPhone 14 + flujo de mensaje
```

🔴 **Las tres suites del canal (`probar:canal`, `probar:bloqueos`, `capturar:canal`) apuntan a PRODUCCIÓN
por defecto** (leen `NEXT_PUBLIC_SUPABASE_URL`/`…_PUBLISHABLE_KEY`/`SUPABASE_SECRET_KEY`). Contra pruebas se
corren con esas tres variables sobrescritas con las `SUPABASE_PRUEBAS_*`, `BASE_URL=http://localhost:3005` y
las cuentas que siembra `node --env-file=.env.local scripts/plataforma/sembrar-canal-pruebas.mjs --clave "<x>"`
(`--email comunica.pruebas@plataforma.local`; contenido ficticio marcado «(demo)»; `--limpiar` lo borra todo).

### El canal dentro de la plataforma (NUC-CAN, desde el 20 de noviembre de 2026)

Migración `20261120232000_integracion_canal.sql`. Mismas URLs: la app nativa no se recompila.

- **La administración vive en `/sistema/nucleo/canal`** (recurso del módulo: `modulo:reportes`; las
  casillas `modulo:canal` y `modulo:reportes` no cambiaron): Resumen (cinco métricas del registro,
  `ui.m_canal_*`), Publicaciones (archivar, restaurar, fijar, oficial —`canal_moderar_publicacion()`— y quién
  publica o modera —`canal_autorizar()`—), Grupos y Uso (tablas `canal-grupos` y `canal-uso`), y Moderación.
  🔴 **Todo lo que ve el equipo son cuentas**: `ui.canal_*` y las métricas corren como dueñas, piden la casilla
  adentro y nunca devuelven el texto de un mensaje ni quién le escribe a quién. No se abre ningún camino nuevo
  a `mensajes`.
- **La app suma lo de la plataforma para el trabajador**: «Para ti» en Inicio (sus tareas de `nucleo.tarea` y
  sus avisos sin leer), la campana con los avisos de `nucleo.notificacion` en Avisos, **Mis tareas**
  (`/canal/tareas`) y **Mi cargo** (`/canal/yo/cargo`: plaza, unidad, a quién reporta, procesos de su cargo y de
  su unidad, documentos vigentes generales de esos procesos). Mi cargo sale de `nucleo.mi_cargo()`,
  `mis_procesos()` y `mis_documentos()`, que **solo responden por `mi_empleado()`**: no reciben a otra persona.
- **Tocar un aviso** es una acción (`abrirAviso`, POST: la precarga de un enlace no marca nada leído): lo marca
  leído y va a la ficha en `/sistema` si quien lo toca puede ver el objeto; una tarea, a Mis tareas; si no, a la
  vista de lectura `/canal/avisos/[id]`.
- **«Plataforma»** (antes «Panel») lleva a `/sistema` y sale con `tienePlataforma()` de `lib/canal.ts`.
- 🔴 **`empleados` tiene trigger de columnas** (`a_empleados_proteger_acceso`): «actualizo mi ficha» dejaba a
  cualquiera darse `puede_publicar`/`es_moderador` o cambiarse nivel y área por la API. Ahora quién publica o
  modera lo cambia `modulo:reportes` editar; identidad, nivel, área y cuenta, solo el equipo editor o la clave
  de servicio.
- 🔴 **El contacto del padrón no sale de `empleados` por la API** (desde el 20-nov-2026, migración
  `seguimiento_privacidad`): `authenticated` solo tiene SELECT sobre las columnas del directorio (nombre, cargo, área,
  foto, nivel, sede, ficha, oficio, banderas). Cédula, teléfono, correo, fecha de ingreso y tipo de nómina dan
  `42501` en un `select`, en `select=*`, en un filtro, en un orden y embebidas. **La única puerta es
  `contacto_empleados(p_ids)`** (`contactosDe()` de `lib/contacto.ts`): lo propio a cada quien; todo al equipo editor
  y a `modulo:empleados` · editar (Capital Humano); el teléfono también a `modulo:recordatorios` · editar. Escribir no
  cambió, ni la clave de servicio, ni `padron_estado` (corre como su dueña). ⚠️ Una consulta nueva a `empleados` con
  sesión nombra sus columnas (`COLUMNAS_EMPLEADO` de `lib/canal.ts`); `select('*')` falla. Y un `grant select on all
  tables in schema public` lo reabriría en silencio: `probar:canal` y `scripts/plataforma/probar-privacidad.mjs` lo cazan.
- El canal adopta el token de contraste de la plataforma (`marca-400` = `#706a67` dentro de `.canal`) y cada
  ruta del canal tiene su `loading.tsx` (`EsqueletoCanal`).

### Portal planta (desde el 24 de noviembre de 2026)

El canal se llama **«Portal planta»** en todo lo que se ve (Gabriel). Las rutas siguen en `/canal` porque van
compiladas en las apps. Migración `20261124010000_portal_planta.sql`.

- **A dónde entra cada quien** (`destinoInicial`): el nivel administrador, al admin (`/sistema`), con el botón
  «📱 Portal planta» en la barra (en el teléfono, en el menú de la persona); en el portal, «Admin» lo devuelve.
  Quien tiene `modulo:canal` y no es administrador entra directo al portal; el resto, al admin.
- **Secciones prendibles** (`canal_modulos`): Tareas, Grupos, Mensajes, Gente, Formación y Avisos se encienden y se
  apagan en Portal planta › Secciones. Apagada, sale de la barra (`NavInferior` recibe las activas) y su página
  vuelve al inicio (`requerirSeccion()` de `lib/canal.ts`). Una página nueva del portal llama a `requerirSeccion`
  con su sección. Inicio y Yo no se apagan. Sin la tabla o si falla la lectura, todas encendidas.
- **Tareas** va segunda en la barra: las mías de `nucleo.tarea` (asignadas o anotadas por mí), «Nueva tarea» y la
  vista de calendario del mes (`?vista=calendario&mes=AAAA-MM`).
- **Grupos**: crearlos pide la casilla `modulo:grupos` (acción «ver»: un rol de nivel lectura como Personal de planta
  no admite «crear»). Coordina quien lo creó o quien tiene rol `coordinador` (`coordino_grupo()`), y mete, saca y
  nombra coordinadores desde `/canal/grupos/[id]`. Uno se une solo **a un abierto** (`privado.grupo_abierto`): hasta
  el 24-nov la política dejaba meterse a cualquier grupo con su id. Quien sale de un grupo sale de su conversación
  (trigger `grupo_miembro_salida`).
- 🔒 **El admin lee los mensajes de los GRUPOS** (decisión de Gabriel, 24-nov-2026); los directos, no. Portal planta ›
  Grupos › Gestionar (`/sistema/nucleo/canal/grupos/[id]`, `ui.canal_grupo`): datos, archivar, miembros y «Ver los
  mensajes», que pide `modulo:reportes` · editar y **queda registrado** en `canal_grupo_lecturas`. Dentro de cada
  grupo, el portal avisa que la administración puede leerlo.
- **Comentarios**: «Permitir comentarios» al publicar (`permite_comentarios`); se comenta solo donde está abierto y
  publicado (`privado.permite_comentar` en la política «comento»). En la publicación, quien publica o modera oculta y
  muestra; los demás reportan. El admin los ve todos en Portal planta › Comentarios y abre o cierra los de cada
  publicación en Publicaciones.
- `node --env-file=.env.local scripts/plataforma/probar-portal-planta.mjs` recorre todo en pantalla contra pruebas
  (13 comprobaciones; necesita `sembrar-canal-pruebas.mjs`). `mirar.mjs` suma `--como planta` y `--como comunica`.

## La app de Iberia (`ios/`) — el canal en el App Store

El canal empaquetado para el iPhone (PEN-14661), desde el 23 de octubre de 2026. Va en la misma
cuenta de Apple que Boosty Desk y copia su configuración. La de Google Play (PEN-14662) es la misma
cáscara: ver «La app de Android», abajo. Lo que falta para publicarlas está en `PENDIENTES.md`.

- **Es una cáscara de Capacitor 8.5.3 en este mismo repositorio.** `capacitor.config.ts` (appId
  `com.industriasiberia.canal`, appName `Iberia`) pone `server.url` en
  `https://iberiavenezuela.netlify.app/canal`: la app carga el sitio en línea, así que **un cambio
  de la web llega a los teléfonos sin compilar otra versión**. Abre en el canal, que sin sesión
  manda al login, y nunca en una página de presentación. `movil/www/index.html` es solo la carpeta
  que Capacitor exige. `appendUserAgent: 'IberiaApp'` es la marca para el código web que necesite
  saber que corre dentro de la app.
  - 🔴 **`server.allowNavigation` lleva el dominio, y no se quita.** Capacitor solo da por propias las
    direcciones que empiezan por `server.url`, que termina en `/canal`; lo demás —el login, `/entrar`— lo
    abría en Safari. Le pasó al build 3, y solo se ve en un iPhone: Chromium no tiene esa regla.
  - ⚠️ **El dominio va compilado en la app.** Cambiarlo es publicar otra versión en la tienda,
    además de volver a acuñar los enlaces personales (`DESPLIEGUE.md`).
- **`ios/` se generó con `npx cap add ios` en Windows, sin Mac**, y se ajustó como el de Boosty
  Desk: `Info.plist` con los textos de permiso en español e `ITSAppUsesNonExemptEncryption` en
  `false`, `aps-environment = production` en los entitlements y los dos métodos de APNs en
  `AppDelegate`. Firma manual, equipo `45TRWF6998`.
- **El arranque no se ve negro** (10 de noviembre de 2026). `backgroundColor: '#f6f7f9'` en
  `capacitor.config.ts` (el fondo del canal; sin él la WebView usa el color del sistema, negro en
  modo oscuro) y el mismo color en `LaunchScreen.storyboard`. Con `@capacitor/splash-screen` 8.0.2
  el arranque **se queda hasta que la página pinta**: `PuenteNativo` llama `SplashScreen.hide()` (en
  el layout raíz, así que también en `/login`). `launchAutoHide: true` con `launchShowDuration: 10000`
  es solo el tope de seguridad —sin red, el arranque se quita a los 10 s—; un `hide()` antes lo
  quita en el acto. No se apaga el autoocultado: sin él el plugin no tiene tope, y
  `launchShowDuration: 0` no muestra el arranque. ⚠️ **Todo esto vive en el binario**:
  cambiarlo es compilar y publicar otra versión.
- **Se compila y se sube solo desde GitHub Actions**: el flujo «App de iOS»
  (`.github/workflows/ios.yml`), en un runner de macOS, se lanza a mano y trae un interruptor para
  subir o no a App Store Connect. Usa seis secretos, con los mismos nombres que en Boosty Desk:
  `IOS_CERT_P12`, `IOS_CERT_PASSWORD`, `IOS_PROVISIONING_PROFILE`, `ASC_API_KEY_P8`, `ASC_KEY_ID`
  y `ASC_ISSUER_ID`.
  - **De dónde sale cada secreto no está en el repositorio**: el mapa vive en
    `C:\Users\santi\Desktop\iberia-secretos\README.txt`, en la máquina de Santiago. En el
    repositorio no se escribe ningún valor.
- **Del lado de Apple**: el App ID `com.industriasiberia.canal`, con Push y Associated Domains; el
  perfil «Iberia App Store CI» (App Store, vence el 14 de octubre de 2027); y la ficha «Industrias
  Iberia» en App Store Connect (SKU `iberia-canal`, Español (México)). Debajo del icono dice
  «Iberia»; el nombre de la tienda es otro porque «Iberia» a secas es la aerolínea.
- ⚠️ **La identidad de firma es «Apple Distribution», no «iPhone Distribution».** El perfil usa el
  certificado Apple Distribution del equipo —el mismo que firma Guds Store, vence el 14 de octubre
  de 2027—. Boosty Desk dice «iPhone Distribution» porque su certificado es del otro tipo. Con la
  identidad que no corresponde, `codesign` falla. El certificado es del equipo; lo único de cada
  app es el perfil.
- ⚠️ **La API de App Store Connect registra identificadores y crea perfiles, pero no crea la ficha
  de la app**: responde «does not allow 'CREATE'». Eso se hace a mano.
- 🔴 **Nunca por debajo de `@capacitor/ios` 8.5.1.** La 8.5.0 tiene un aviso crítico,
  GHSA-rvm3-566m-v7fv: contenido remoto puede cargarse con el origen de la app a través del proxy
  interno.
- **El icono y el arranque se generan, no se editan a mano**: `pwsh scripts/generar-marca.ps1
  -SoloIos`. El icono es la misma baldosa «IB» del favicon, a 1024 px y **sin canal alfa**,
  porque Apple rechaza el alfa; el arranque, el logo sobre el fondo del canal.
- **`/privacidad` es pública** (`RUTAS_PUBLICAS` de `lib/supabase/sesion.ts`): Apple exige una
  política de privacidad que se abra sin cuenta.
- **El número de compilación es el de la corrida** (`github.run_number`, como
  `CURRENT_PROJECT_VERSION` del archivo); la versión, 1.0.0, sigue en `project.pbxproj`. La 1 se
  subió a mano. ⚠️ «Re-run» repite el número y App Store Connect lo rechaza: corrida nueva.

### Lo nativo: avisos y enlaces (la guía 4.2)

Desde el 23 de octubre de 2026. **Un sitio envuelto en una app se rechaza** (guía 4.2 de la App
Store): Boosty Desk pasó por sus funciones nativas de verdad, y estas son las de Iberia —avisos en
el teléfono y enlaces del sitio que abren la app—.

- **Avisan dos cosas, y nada más** (`lib/notificaciones.ts`):
  - **Un mensaje nuevo** del canal, a los demás participantes —nunca a quien escribe, ni a quien
    silenció la conversación—. Título: quien escribe; en un grupo, el grupo debajo; cuerpo: el
    comienzo del mensaje. El toque abre la conversación.
  - **Un recordatorio del empujón**, cuando se marca mandado a mano o sale por WhatsApp. Título
    «Ajito»; cuerpo: el texto del recordatorio —el de `recordatorios.md`— sin el enlace. El toque
    abre la primera lección que le falta, que retoma donde se quedó.
- 🔴 **Un aviso que falla no tumba ni demora lo que lo disparó.** Las acciones lo mandan dentro de
  `after()` de `next/server`, con la respuesta ya fuera, y `lib/notificaciones.ts` se traga sus
  errores: el mensaje sale igual con APNs caído o sin las variables. En Netlify, `after()` se
  sostiene con el `waitUntil` del adaptador de Next.
- **Los teléfonos están en `dispositivos`** (migración `20261103120000_dispositivos.sql`): el token
  de cada instalación con la cuenta que la usa. **Único por token, no por persona**: el token es
  del aparato, y si en ese teléfono entra otra cuenta, el token se pasa a ella —por eso el alta va
  por `registrar_dispositivo()`, `security definer`—. La RLS deja a cada quien solo lo suyo.
  - **Quien manda no lee la tabla**: pide los tokens a `dispositivos_de_conversacion()` —si
    participa— o a `dispositivos_de_recordatorios()` —si es del equipo y tiene la casilla—, con su
    sesión. La clave de servicio no entra en esto.
  - Lo que APNs contesta con 410, `Unregistered` o `BadDeviceToken` se borra con
    `descartar_dispositivo()`, que solo deja borrar lo que quien llama pudo recibir.
    `DeviceTokenNotForTopic` no borra: lo da también un `APNS_BUNDLE_ID` mal puesto, y borraría
    los de todo el mundo.
  - **Cerrar sesión desliga el teléfono**: el alta deja la cookie `iberia_dispositivo` y
    `cerrarSesion` borra esa fila antes de salir. En un teléfono compartido, los mensajes de uno le
    saldrían en la pantalla bloqueada al siguiente.
- **El permiso se pide dentro del canal, no en el login** (`NotificacionesNativas`, en el layout
  del canal): dos segundos después de entrar con sesión. Con el permiso dado, se registra en
  silencio cada vez que se entra; negado, no se insiste. Solo iOS: en Android `register()` cierra la
  app sin Firebase, y la de Android todavía no lo tiene.
- **El emisor es `lib/apns.ts`**: `node:http2` —APNs no habla HTTP/1.1, que es lo del `fetch` de
  Node— a `api.push.apple.com`, siempre producción (TestFlight y la tienda lo son), con un JWT ES256
  que se reusa 50 minutos y `apns-topic` = el bundle. No importa `server-only` para que
  `probar:apns` lo cargue: comprueba la clave contra Apple con el mismo código, mandando a un token
  inventado. **400 `BadDeviceToken` es el éxito** —la clave, el equipo y el topic autentican—; 403
  es que no.
- **Cuatro variables en Netlify** (`DESPLIEGUE.md`): `APNS_KEY_P8` (el `.p8` en base64, una
  línea), `APNS_KEY_ID`, `APNS_TEAM_ID` y `APNS_BUNDLE_ID`. Sin alguna, se avisa una vez en el
  registro y no se manda nada. **La clave es la de APNs del equipo `45TRWF6998`**
  —`AuthKey_9QWXFT269C.p8`, id `9QWXFT269C`, en la máquina de Santiago; nunca en el repositorio—:
  una clave de APNs sirve para todas las apps del equipo.
- **Universal Links**: `/.well-known/apple-app-site-association` (una ruta de Next, pública en
  `lib/supabase/sesion.ts`: Apple la baja sin sesión y no acepta redirecciones) declara `/entrar/*`,
  `/canal` y `/canal/*` para la app; `App.entitlements` lleva
  `applinks:iberiavenezuela.netlify.app`. **El enlace personal de WhatsApp abre la app**, y la
  sesión que acuña `/entrar/[token]` queda en su WebView; quien no tiene la app lo abre en Safari,
  igual que antes.
- **`PuenteNativo` (en el layout raíz) mueve la WebView**: el aviso tocado (`ruta` del aviso) y el
  enlace abierto (`appUrlOpen`). **Solo rutas del mismo origen**; lo demás se ignora. Va en la raíz
  y no en el canal porque las dos cosas llegan también sin sesión —el enlace de `/entrar` es la
  forma de entrar de quien no tiene clave— y la app arranca en el login. Capacitor guarda los dos
  eventos hasta que alguien los oye, así que lo que abrió la app en frío se atiende al montar.
  `/entrar` va con `location.assign`, no con el router: pone la cookie y redirige.
- **El flujo comprueba que el perfil traiga push y Associated Domains** antes de archivar: un perfil
  creado antes de activar alguno en el App ID hace fallar `codesign` a mitad del archivo.

## La app de Android (`android/`) — el canal en Google Play

La misma cáscara que la de iOS, para Google Play (PEN-14662), desde el 12 de noviembre de 2026. Lo
que falta para publicarla está en `PENDIENTES.md`.

- **`@capacitor/android` 8.5.3, fijo y a la par de `@capacitor/core`.** `android/` salió de
  `npx cap add android`: paquete `com.industriasiberia.canal`, nombre «Iberia», versión 1.0.0,
  `minSdk` 24 y `targetSdk`/`compileSdk` 36, los de Capacitor 8 (Google Play exige al menos 35).
  Lee el mismo `capacitor.config.ts`: `server.url`, `allowNavigation`, el agente de usuario y el
  arranque valen para las dos.
- **Las barras del sistema no tapan nada.** La página llega de borde a borde y se aparta con las
  `--seguro-*` de `globals.css`, como en el iPhone: el plugin SystemBars de Capacitor pasa a la
  WebView las medidas reales en `env(safe-area-inset-*)` (WebView 140 o más) o, con una más vieja,
  aparta la WebView de las barras y `env()` da 0. No hizo falta tocar el CSS. `MainActivity` deja la
  app siempre en modo claro —con el teléfono en modo oscuro, los iconos de la barra de estado salían
  blancos sobre el fondo claro— y activa el borde a borde también antes de Android 15.
  ⚠️ `SystemBars.style` en `capacitor.config.ts` no sirve para eso: también lo lee iOS.
- **El botón de «atrás»** lo atiende `PuenteNativo`, solo en Android: cierra la hoja o el menú
  abierto (`<dialog>`), si no retrocede, y en la primera página manda la app al fondo
  (`App.minimizeApp()`), sin cerrarla. Sin oyente, en la primera página no hacía nada.
- **Sin avisos al teléfono todavía**: `NotificacionesNativas` sigue siendo solo de iOS, porque en
  Android `register()` cierra la app si no hay Firebase.
- **App Links**: el `intent-filter` con `autoVerify` de `AndroidManifest.xml` declara `/entrar/*`,
  `/canal` y `/canal/*`, los mismos del archivo de Apple, y Android lo verifica contra
  `/.well-known/assetlinks.json` (una ruta de Next, pública en `lib/supabase/sesion.ts`). Ahí van
  el paquete y las huellas SHA-256 de los certificados, que son públicas. 🔴 **Falta la huella de
  Play App Signing**: Google vuelve a firmar lo que baja la gente con su clave, así que, después de
  la primera subida, se copia de Play Console y se agrega a `HUELLAS`; sin ella, los enlaces abren
  Chrome.
- **La clave de subida** es `iberia-subida` (RSA 4096, vence en 2059), en
  `C:\Users\santi\Desktop\iberia-secretos\android\`, con sus contraseñas en el `README.txt` de esa
  carpeta. Nunca en el repositorio: `.gitignore` excluye `*.jks` y `*.keystore`. Si se pierde, se
  pide en Play Console un reinicio de la clave de subida.
- **Se compila solo desde GitHub Actions**: el flujo «App de Android»
  (`.github/workflows/android.yml`), manual, en Ubuntu con JDK 21. Hace `cap sync`, decodifica el
  almacén, compila el `.aab` firmado (`bundleRelease`), comprueba la firma y lo deja como artefacto
  de la corrida. **No sube a Google Play**: el `.aab` se sube a mano en Play Console. Cuatro
  secretos: `ANDROID_KEYSTORE_B64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS` y
  `ANDROID_KEY_PASSWORD`.
  - `android/app/build.gradle` firma solo si están las cuatro variables (`ANDROID_KEYSTORE_PATH` y
    las tres de arriba): sin ellas, la compilación de depuración funciona igual.
  - **El `versionCode` es el número de la corrida** (`ANDROID_VERSION_CODE`, o `-PversionCode=N`;
    en local, 1). ⚠️ «Re-run» lo repite y Play lo rechaza: corrida nueva.
- **El icono y el arranque se generan**: `pwsh scripts/generar-marca.ps1 -SoloAndroid`. El icono es
  adaptativo —el rojo de fondo y «IB» en blanco al frente, que sirve también de icono temático—, con
  su versión clásica y redonda para Android 7. En Android 12+ el arranque lo dibuja el sistema: el
  fondo del canal con el icono al centro (`styles.xml`); `drawable/splash.xml` es el de respaldo, el
  logo sobre el fondo del canal. Se queda hasta que la página pinta, igual que en iOS.

## Reportar y bloquear (guía 1.2 de la App Store)

Desde el 6 de noviembre de 2026. La app deja que la gente se escriba, y Apple exige para eso poder
**reportar** lo que se lee, **bloquear** a quien molesta y que alguien reciba los reportes.
Migración `20261106120000_reportes_y_bloqueos.sql`.

- **Reportar** (`MenuModeracion`, los tres puntos de `components/canal/`): en una publicación (el
  feed y su página), en un mensaje —directo o de grupo— y en un comentario. Lo ajeno, nunca lo
  propio. Una hoja con siete motivos fijos (`MOTIVOS_REPORTE` en `lib/reportes.ts`, espejo del
  `CHECK`), unas líneas opcionales y la confirmación. ⚠️ **Los comentarios no tienen pantalla
  todavía** («se habilitan en la próxima versión»): el reporte y la ocultación ya los soportan en la
  base, pero hoy no hay dónde tocarlos. El día que se pinten, llevan `MenuModeracion` con
  `tipo: 'comentario'`.
- **Solo se escribe por `reportar_contenido()`**, `security definer`: comprueba que quien reporta
  puede leer lo reportado y que no es suyo, y **congela un extracto** en el reporte. Así el equipo lee
  el reporte sin entrar a las conversaciones —de un mensaje directo reportado solo se lee ese
  mensaje— y el reporte no cambia si el autor lo borra. Único por (quien reporta, qué reporta):
  reportar dos veces no abre dos y la respuesta es la misma.
- **Quien fue reportado no ve quién lo reportó**: `reportes` solo se lee con la casilla
  `modulo:reportes`, y el reporte no cambia nada visible para el autor. Quien reporta tampoco lee
  la tabla: se le confirma y ya.
- **El equipo los ve en Canal › Moderación** (`/sistema/nucleo/canal/moderacion`; `/dashboard/reportes`
  redirige desde el 20 de noviembre de 2026): `modulo:reportes` con ver y
  editar, de fábrica para Consultor. Por cada uno: qué decía, quién lo escribió, quién lo reportó,
  motivo y fecha. **Marcar revisado** y **Ocultar lo reportado**, que no destruye nada: mensaje y
  comentario pasan a `oculto`, una publicación a `archivado`, y «Restaurar» lo devuelve. Ocultar da
  por revisados todos los reportes de esa cosa. Las acciones van por `revisar_reporte()` y
  `ocultar_contenido_reportado()`, que piden la casilla otra vez en la base.
- **El directorio (`/canal/gente`) se abre de a 100** con «Ver N más» (`?ver=`), y dice el total real: hasta el
  20-nov-2026 cortaba en 200 y decía «200 personas». La búsqueda limpia comas, paréntesis y comodines antes del `or`.
- **Bloquear**, desde el directorio (`/canal/gente`), una conversación directa, un mensaje y una
  publicación; se deshace en `/canal/bloqueados` («Personas bloqueadas» en Mi perfil), en la fila del
  directorio y en el aviso de la conversación. Mientras A bloquea a B:
  - A no ve de B publicaciones, comentarios ni mensajes (en un grupo, los de B se ocultan **solo
    para A**: el grupo sigue). Ni el contador de no leídos los cuenta, y el hilo directo con B no
    se lista.
  - B no puede abrir un hilo directo con A, ni escribirle en el que ya había, ni pedirle conexión.
    En un grupo, B escribe igual y A no lo lee. **A tampoco escribe a B** mientras dure el bloqueo.
  - A no recibe el aviso al teléfono de lo que B escriba (`dispositivos_de_conversacion()`).
  - **A B no se le avisa.** `bloqueos` solo la lee quien bloqueó; lo único que B nota es que su
    mensaje no sale, y el aviso es genérico («No se pudo enviar…»). ⚠️ **Residual aceptado:** quien
    llame a la API a propósito puede sondear una escritura rechazada (escribirle a A y ver que la
    base dice que no, o ver que a A no le salen teléfonos en `dispositivos_de_conversacion`); es el
    precio de rechazar en vez de aceptar y descartar. Lo que sí está cerrado es preguntárselo a la
    base directamente.
- **Todo lo hace la base, no la pantalla.** Las preguntas viven en funciones `security definer` y no
  en la política: «¿A bloqueó a B?» lee una fila que B no puede leer, y una política que se
  pregunta por una tabla cerrada vuelve vacía en silencio (la misma salida que `participo_en`).
- 🔴 **Las que responden «¿esa persona me bloqueó?» viven en el esquema `privado`**
  (`privado.me_bloqueo`, `hay_bloqueo`, `conversacion_bloqueada`, `bloqueo_al_sumar`), no en `public`.
  Una función `security definer` con EXECUTE para `authenticated` en un esquema expuesto la llama
  cualquiera por PostgREST y, sin efectos, averigua quién lo bloqueó. Las políticas necesitan que el
  rol pueda ejecutarla, así que revocar no alcanza: se saca del esquema que la API sirve.
  **`privado` no puede añadirse a los esquemas expuestos de la API** (Settings > API; los de
  Supabase son `public` y `graphql_public`). Solo `he_bloqueado` («¿yo la bloqueé?») sigue en
  `public`: contesta sobre los bloqueos propios. La app no pregunta por el bloqueo ajeno: lo único
  que consulta es `he_bloqueado`, y lo demás lo rechaza la política. `probar:bloqueos` lo prueba
  con sesiones reales.
- ⚠️ **Los comunicados `oficial` se ven siempre**, hayas bloqueado a quien los firma o no: son la
  comunicación obligatoria de la empresa. En esas publicaciones el menú solo ofrece reportar. Lo
  demás del feed sí se oculta.
- ⚠️ **«publican los autorizados» era `for all`, y las políticas se suman con OR**: autorizaba
  también el SELECT de cualquier publicación a quien puede publicar, y filtrar solo «feed publicado»
  no habría escondido nada a esas personas. La migración la parte en insert, update y delete; el
  SELECT queda en una sola política. Al tocar la RLS de un recurso con una política `for all`,
  mirar qué lee de más.
- ⚠️ **Los mensajes ocultos dejaron de leerse a nivel de base**: «leo mis mensajes» pasó de
  `estado <> 'eliminado'` a `estado = 'visible'`. Antes solo la pantalla filtraba el `oculto`.
- `probar:supabase` comprueba que las dos tablas existan y estén cerradas sin sesión, y que las
  funciones existan y se nieguen sin ficha o sin permiso.

## El adiestramiento (`/canal/adiestramiento`) — el curso de Ajito

Nueve lecciones por el teléfono para las ~200 personas que **no** van a las tres
formaciones presenciales. Es un capítulo del programa **IBERIA · Nuevo Sabor**, y lo
dicta **Ajito**, el personaje de la agencia: cabeza de ajo, cuerpo de ají, ojos verdes
y una ruedita en vez de piernas.

- **El guion manda, no el código.** Todo lo que Ajito dice está escrito palabra por
  palabra en `contenido/adiestramiento/`, con `00-reglas-del-guion.md` como norma. El
  código presenta ese guion; no lo inventa. Antes de tocar un texto de la interfaz, se
  cambia el guion.
- **La clase es un audio.** Nada de párrafos: cada lección es una nota de voz de 40 a 90
  segundos y el texto que la acompaña es **una línea** que dice qué hacer. La voz es
  sintética por necesidad, no por ahorro: las devoluciones se generan en el momento y
  tienen que sonar igual que la clase.
- **El reproductor tiene cuatro estados y cada uno cambia el color de la tarjeta entera**,
  no un detalle. Quien oye esto está de pie en un comedor con ruido, mirando el teléfono a un
  brazo de distancia: el estado se lee de un vistazo o no se lee.

  | | Tarjeta | Botón | Rótulo |
  |---|---|---|---|
  | sin oír | blanca | rojo con ▶ | la etiqueta |
  | cargando | blanca, borde rojo | rojo con anillo girando | «Cargando…» |
  | sonando | **dorada** | dorado con ⏸ | la etiqueta |
  | ya oído | blanca | gris con ✓ | «Ya lo oíste» |

  El dorado es `oro-300`, el destacado del canal: en una lista de ocho audios, el que suena
  se encuentra sin buscarlo. **No se metió un verde para «ya oído»** — la paleta del canal
  son tres familias a propósito y una cuarta rompe el lenguaje visual del producto entero;
  lo que separa «ya oído» de «apagado» es el **✓**, que es forma y no tono.
- ⚠️ **El estado sale de los eventos del `<audio>`, no de la promesa de `play()`.** Esa
  promesa resuelve cuando el sonido ya arrancó, así que entre el toque y ella hay un hueco de
  segundos con `preload="none"` y una conexión de planta — y ese hueco era justamente lo que
  no se veía. `playing` enciende el dorado, `waiting` vuelve al cargando si el buffer se queda
  corto a mitad, `ended` pone el ✓. Y cargando **no se pinta avance en la barra**: un trozo a
  un tercio del ancho se lee como «va por el 33%», que es un número inventado.
  `capturar:adiestramiento` comprueba los tres colores con `getComputedStyle`, no por captura.
- **La barra se arrastra**, como la de una nota de voz de WhatsApp, para volver a oír una
  frase o saltarse lo oído (desde el 26 de septiembre de 2026). Es un `<input type="range">`
  de 44 px de alto, `.barra-audio` en `globals.css`, y va **fuera** del botón que alterna:
  un control dentro de otro no se toca. ⚠️ Con `preload="none"` el archivo no existe hasta el
  primer toque y mover `currentTime` no hace nada: el arrastre se guarda y se aplica en
  `loadedmetadata`. Y **cada audio de la clase dice cuál es** —«3 de 8»—, contando solo los
  que suenan (de los dos cierres de la lección 8 suena uno); las devoluciones no llevan.
- **El turno se abre a medida que se oye** (`TurnoProgresivo`, 27 de septiembre de 2026). Un turno
  puede traer dos o tres audios seguidos, y salían todos de una: se veía el segundo antes de oír
  el primero, y los botones antes de oír nada. Ahora, en el turno actual, cada cosa —el audio
  siguiente, lo que lo acompaña, y al final los botones o el ejercicio— aparece cuando **sonó al
  menos la mitad** del audio de antes. ⚠️ Cuenta el tiempo que sonó, no la barra: arrastrarla
  hasta el final no abre nada. Los turnos de arriba y un turno ya contestado salen enteros.
  «Terminar la lección» es parte del cierre del último turno por lo mismo.
  ⚠️ **Y lo que contesta Ajito también se oye antes de seguir.** Con la devolución ya escrita, el
  turno siguiente salía y la manito se iba a su audio sin haberla oído. La página retiene el turno
  que sigue al ejercicio recién contestado hasta que suena la mitad de su devolución —la manito
  va en «Ajito te contesta»— y `DevolucionAjito` refresca al llegar a la mitad. Solo en la
  frontera: una devolución vieja sin oír más arriba no cierra lo que ya se pasó. Sin audio, no
  retiene.
- **La manito**: el audio que toca oír lleva una mano que toca su play, y el play late como los
  botones que avanzan. Se va apenas suena y se queda quieta con `prefers-reduced-motion`.
  `scripts/mirar-progresivo.mjs` recorre las dos cosas.
- **El ✓ de «ya oído» se guarda** en `avances.oidos` (27 de septiembre de 2026) **al oír la
  mitad** —antes, al terminar—, que es lo mismo que abre el turno: al llegar a la mitad de un
  audio, `marcarOido` lo anota con `marcar_oido()` —una sola sentencia, para que dos audios que
  terminan juntos no se pisen— y la página arranca cada reproductor desde ahí. Antes vivía solo en
  la página, y al recargar la lección entera salía sin oír. Las devoluciones van como
  `devolucion-<clave>`. `scripts/mirar-oidos.mjs` lo recorre: oye, recarga y mira.
- **El botón que hace avanzar late** (`BotonSigue`, `.btn-canal-sigue`): un halo rojo que se
  abre y se apaga, apagado con `prefers-reduced-motion`. Al terminar un audio la pantalla se
  quedaba quieta y no decía qué tocar. Y **gira mientras la acción va y vuelve**: en una
  conexión de planta es un segundo o dos, y sin nada en pantalla la gente tocaba otra vez.
- **Las voces viven en `lib/voz.ts`, y son dos a elegir** (`VOCES`, desde el 26 de
  septiembre de 2026): `es-VE-PaolaNeural` —la de siempre, a `+12%` porque de fábrica va
  lenta— y `es-VE-SebastianNeural`, las dos venezolanas de Azure. Quien hace el curso escoge
  en el índice («Mujer» u «Hombre»); queda en `matriculas.voz` y vale para la clase grabada
  **y para las devoluciones**, que `hablar()` genera con esa misma voz: si la clase la dijera
  una y la devolución otra, habría dos Ajitos. El guion se escribe en crudo: `aSSML()` arma
  los párrafos y aplica velocidad, tono y pausas.
  - **Cada voz tiene su carpeta**: la de mujer, las rutas de siempre (`leccion-NN/`, en el
    disco y en el bucket); la de hombre, `hombre/leccion-NN/`. `generar:audios` graba las
    dos, cada una con su huella, y `subir:audios` sube las dos.
  - **Si a la voz elegida le falta un audio, la ruta sirve el de la de siempre**: un audio
    nuevo del guion que todavía no se grabó con las dos no deja a nadie en silencio.
  - **Las dos van a las mismas 192 palabras por minuto**, medidas sobre el audio con
    `medir:ritmo`, que arranca con Paola a `+12%` de testigo: si el testigo no da ~192, el
    que está mal es el método.
- ⚠️ **En SSML, un salto de línea del guion es una pausa, y las citas del markdown están
  ajustadas a 78 columnas.** O sea que Azure metía un silencio en mitad de cualquier frase
  partida —entre «Me» y «parece bien»—. `aSSML()` deshace los saltos sueltos: **la pausa la
  marca el renglón en blanco**, que abre `<p>`. Cuatro pausas falsas menos en el Audio 1 de
  la lección 0, y el curso pasó de 21 min 40 s a **20 min 02 s** diciendo lo mismo.
- ⚠️ **Y `mstts:silence type="Sentenceboundary"` se SUMA al silencio que Azure ya pone.**
  Con las frases cortas que Ajito habla por diseño, 180 ms sumados a cada punto lo
  convertían en una lista de frases sueltas. Va como **`Sentenceboundary-exact`**, que fija
  el valor. Y no se puede quitar del todo: sin la directiva, `es-VE` pone unos 900 ms.
- **El ritmo se mide sobre el audio, no con cronómetro sobre el texto.** El objetivo son
  **192 palabras por minuto** y se comprueba leyendo el WAV: RMS en marcos de 10 ms, las
  rachas por debajo del umbral son las pausas. Cronometrando el texto, el `+16%` de agosto
  parecía dar 192 y el audio real iba a 174. Con los dos arreglos de arriba, `+12%` da 192 y
  los 70 audios juntos miden 191.
- **El guion es datos, no solo prosa.** `lib/guion.ts` lo lee y `generar:guion` deja
  `contenido/adiestramiento/guion.json`, que es lo que recorre la página de la lección.
  El markdown sigue siendo la única fuente; el JSON es su sombra y se regenera. El mismo
  comando **comprueba que el guion y `lib/adiestramiento.ts` estén de acuerdo**: cada 🎯
  lleva su clave y esa clave existe en el catálogo de esa lección.
- **Dos fuentes a propósito.** El guion manda el orden y lo que Ajito dice;
  `lib/adiestramiento.ts` decide qué se le pide a un montacarguista y qué a una cocinera.
- **La lección se entrega turno a turno, no de una.** Un *turno* va desde donde se quedó
  hasta el próximo botón o ejercicio — donde Ajito se calla y espera. Los turnos salen de
  `turnosDe()`, y en cuál va cada quien vive en `avances.paso`: quien deje la lección por
  la mitad la retoma donde estaba, que es lo que Ajito promete en la lección 0. Los
  turnos anteriores quedan arriba, como en un chat.
- ⚠️ **Pero no se pasa de un ejercicio que Ajito no ha contestado.** Guardar la respuesta
  adelanta `avances.paso` en el acto —lo dicho es lo que no se puede perder— y la
  devolución llega segundos después; hasta el 26 de septiembre el audio siguiente salía
  debajo mientras Ajito seguía «viendo lo que le mandaste». La página corta en el primer
  ejercicio con respuesta y sin devolución; **la que ya falló no retiene** —tiene fecha sin
  texto y su botón de reintentar—, y por eso `DevolucionAjito` refresca también al fallar.
- **Lo grabado no dice el nombre de nadie.** El audio es uno solo para las doscientas
  personas; hasta el 26 de septiembre el Audio 2 de la lección 0 le decía a todo el mundo el
  nombre de una trabajadora de ejemplo, y el 1 de la lección 3 la llamaba por su apodo. El
  nombre, el cargo y el área van en la **tarjeta del padrón** (`🖼 **Tarjeta del padrón**` en
  el guion, clase `padron` en `lib/guion.ts`), y Ajito dice de dónde los sacó.
- **«No soy yo» abre dónde escribir quién es** (`QuienEres`): el nombre —obligatorio— y el
  área —solo si también está mal—. Queda en `correcciones_padron` como **aviso para Capital
  Humano, no como dato**: el padrón no se toca desde el teléfono, porque de ahí salen los
  certificados. El equipo lo ve arriba del padrón en `/sistema/personas/padron` (y en la pestaña Padrón de la
  ficha de la persona) y lo saca con «Ya se le pasó». Lo que decía el padrón lo congela un trigger —no lo manda el navegador—, y
  lo único que cambia en el acto es `matriculas.nombre_corto`: Ajito deja de llamarla por el
  nombre que estaba mal. `probar:adiestramiento` comprueba que solo su dueño la escribe, que
  no se la da por resuelta y que otra persona no la lee.
- **El apodo de la lección 0 se guarda** en `matriculas.nombre_corto`, que es lo que dicen
  todas las consignas y lo que Ajito recibe como «a quien le contestas se le dice…». Lo saca
  `sacarApodo()` con el modelo chico y salida estructurada, en paralelo con la devolución, y
  se guarda antes de responder: el refresco que sigue pinta la consigna siguiente. Si la
  persona no dio ninguno —«como quieras»— se queda el que había. `apodoValido()` solo deja
  pasar letras y espacios, hasta 30: eso entra en cada petición al modelo. Reiniciar el curso
  lo devuelve al primer nombre del padrón.
- **Se contesta hablando, con foto o escrito, y ninguna vía está cerrada.** El guion
  dice cuál sale por defecto; el resto está a un toque — **la nota de voz, siempre**, también
  debajo de la caja de los ejercicios que se proponen escritos. Al tocar «Mandárselo a
  Ajito», **Ajito sale pensando en el acto**: la caja pinta ya lo que se va a ver cuando
  vuelva la acción, y si no se guardó devuelve el texto con un aviso (`responder` dice si
  guardó). La transcripción usa el endpoint
  clásico de Azure en `es-VE` —el rápido devuelve 429 en el recurso de Iberia— y por eso
  el navegador convierte a WAV 16 kHz en `lib/wav.ts` antes de subir. **Siempre se
  muestra lo que se entendió y se puede corregir antes de guardar**: una transcripción
  mala sin confirmar es una respuesta mala guardada para siempre.
- **La foto se manda sola, sin nota** (27 de septiembre de 2026): al elegirla se sube y se
  guarda de una vez, con `texto` nulo. Antes había que escribir qué se le tomó, y era un paso de
  más para lo que el ejercicio pide. Por eso «hay respuesta» es texto **o** foto, en la página y
  en la ruta de la devolución, y la cita de lo que mandó es la foto misma, servida por
  `[numero]/foto/[clave]` con la misma regla que el audio de la devolución: la ruta se lee de
  la fila propia, no de la URL. `scripts/mirar-foto.mjs` lo recorre.
- ⚠️ **La nota de voz y la foto comparten `respuestas.media_url`** —el `.wav` o la imagen—, así
  que lo que decide si hay foto es `entrada = 'foto'`, nunca que haya archivo. Hasta el 27 de
  septiembre de 2026 la ruta de la devolución tomaba el `.wav` por una foto ilegible, contestaba
  sin guardar y ninguna respuesta hablada recibió devolución. **Toda salida de esa ruta que
  diga que sí tiene que dejar la devolución guardada**: la lección espera a que exista.
- **Las notas de voz y las fotos van a otro bucket que los audios de Ajito.** Los audios
  del curso los oye cualquiera con matrícula; lo que manda una persona lo lee ella y los
  editores, nadie más. La política lo comprueba con el dueño metido en la ruta:
  `respuestas/{empleado_id}/…`.
- **La lección 8 tiene dos cierres** —`Audio 6-A` si Ajito se va, `6-B` si se queda— y
  suena el que diga `cursos.asistente_libre_activo`. **Cada versión es su propio turno**
  (`Turno.version`, del «versión A/B» del título de la sección) y la página usa
  `turnosSegun()`, que deja el que toca y renumera: la despedida es el mismo turno con el
  interruptor en cualquier posición. ⚠️ Hasta el 27 de septiembre de 2026 las dos iban en un
  solo turno —la A no espera nada y se juntaba con la B hasta su botón— y con el interruptor
  apagado salían «Escríbeme cuando quieras» y «Preguntarle algo a Ajito» debajo del adiós:
  `segunInterruptor()` filtraba el audio y la ficha por sufijo, no el texto ni el botón.
- **Los audios se graban del guion, no de una lista aparte.** `generar:audios` lee los
  bloques `🔊 **Audio N**` de `contenido/adiestramiento/leccion-*.md` y deja los MP3 en
  `contenido/adiestramiento/audio/`. Es incremental: guarda un `.sha` con la huella del
  texto y de los ajustes de voz, así que cambiar una coma regraba un audio y cambiar la
  velocidad los regraba los 70. **Solo graba los audios numerados**, que son la clase;
  las devoluciones se generan en el momento.
- **Ajito no lleva género, y el trabajador tampoco.** El audio grabado lo oyen hombres y
  mujeres, y además **lo dicen dos voces**, una de mujer y una de hombre: nada de «estoy
  listo», «cuando estés lista». En lo generado sí se puede tratar a la persona según su
  nombre, que el padrón lo trae, pero Ajito sigue sin género.
- **El ejercicio bifurca por oficio, no por nivel** (`empleados.familia_oficio`). Bajo
  `nivel = 'planta'` conviven la operadora de envasado, la cocinera de pruebas y el
  vigilante. **Ante la duda va a `generico`**, que no es el descarte: es el ejercicio
  general, escrito para funcionar con cualquiera.
- **No se fotografía el área productiva y el teléfono no se usa en las líneas.** Ningún
  ejercicio pide una foto de una máquina, una etiqueta de proceso o un documento de
  trabajo: solo a la persona, a un compañero con permiso, o cosas de su casa.
- **Lo que la gente responde no lo lee su supervisor** ni quien modera el canal — solo su
  autor y los editores de Boosty. La RLS lo cumple; `puede_publicar()` no alcanza para leer
  `respuestas`. ⚠️ **Pero Ajito no lo anda diciendo** (27 de septiembre de 2026, pedido de
  Gabriel): se dice una vez, en la lección 0 —«se guarda, pero no le llega a nadie de tu
  trabajo»—, sin nombrar supervisores ni jefes, y ni los audios ni las devoluciones lo
  repiten. Un aviso en cada respuesta hacía que hablar con Ajito se sintiera vigilado. La
  regla está en `PERSONAJE` de `lib/ajito.ts`.
- **Ajito dibuja de verdad en la lección 4** (27 de septiembre de 2026), con OpenAI
  `gpt-image-2.5-flare`, elegido por Gabriel (`lib/dibujo.ts`; las mediciones, en
  `herramientas.md`). En los ejercicios `libre` y `escudo` la devolución va en **dos
  peticiones**, porque juntas rozaban lo que aguanta una función de Netlify:
  - **`[numero]/dibujar`** revisa primero el pedido con el modelo chico (`revisarPedido()`):
    `va`, `persona` —alguien de verdad— o `no_va`. Lo que no va no llega al generador: la
    devolución es **el texto fijo del guion** (`NO_VA` en `lib/dibujar.ts`, copia literal
    del guion: si cambia allá, cambia aquí) y la persona puede **pedir otro dibujo**, que es
    otra respuesta del mismo ejercicio. Si va, dibuja y guarda el WebP en su carpeta del bucket
    de respuestas (`respuestas.dibujo`). Sin poder revisar, no dibuja. El filtro de OpenAI
    queda detrás, de respaldo.
  - **`devolver`** encuentra el dibujo hecho, se lo pasa a Ajito como imagen
    (`imagenEsDibujo`) y Ajito lo comenta.
  - **En cada pedido se le dice que no agregue banderas, símbolos ni letreros** que no se
    pidan —`flare` los pone por su cuenta— y que, sin estilo pedido, haga ilustración: una
    imagen que parece foto es justo lo que la sección 4.6 enseña a desconfiar. Si se pide a
    Ajito, se dibuja a partir de su imagen (`referencias/ajito.png` en el bucket del curso)
    para que salga igualito, con el logo de su pechera.
  - ⚠️ **«Iberia» es la aerolínea para el generador.** A «una mayonesa voladora con el logo de
    Iberia» le pintó un avión con el logo de la aerolínea española. Cuando el pedido nombra a
    Iberia se le dice que es Industrias Iberia (`IBERIA_DE_VERDAD`) y se le pasa el logo
    verdadero como referencia (`referencias/iberia.png`, lo sube `generar:ejemplos`).
  - **WebP a 80**: 1024×1024 pesa unos 110 KB, contra 1,7 MB en PNG, y se baja con el plan de
    datos de un teléfono de planta.
  - **Los tres ejemplos de «Muéstrame»** salen del bloque `🖼 Tres ejemplos ya hechos` del
    guion (clase `ejemplos` en `lib/guion.ts`) y los dibuja `generar:ejemplos`, que es
    incremental y los sube al bucket. `scripts/mirar-dibujo.mjs` recorre la lección entera.
  - **La pregunta de campo de la lección 4 también se dibuja** (`dibujaEn()` en
    `lib/dibujo.ts`), pero ahí el dibujo es un extra: no se pidió un dibujo, se contestó qué
    cosa del trabajo sería más fácil de explicar con uno. El filtro tiene un cuarto veredicto,
    `nada` —no describe nada dibujable—, y con `nada`, `persona` o `no_va` Ajito contesta la
    pregunta **sin dibujo y sin la negativa**, que no tendría a qué responder. Con dibujo, la
    devolución es la de siempre de la pregunta de campo más una frase sobre el dibujo. El dibujo
    queda privado, como la respuesta: no se publica y no hay «Pedir otro dibujo».
  - **«Publicarlo en el canal», debajo del escudo, lo publica en el feed** —«Nuestra gente»,
    «Este es el escudo que construí con Ajito», firmado por quien lo hizo— y «Solo para mí»
    no publica. Publicar en el feed es de pocos (`puede_publicar()`) y el escudo vive en la
    carpeta privada de su dueño, así que `publicarEscudo` lo copia con la sesión de la
    persona al bucket `canal` —que lee cualquiera con sesión, y donde cada quien escribe solo
    en `escudos/<su empleado>/`— y `publicar_mi_escudo()`, `security definer` como el
    certificado, publica **solo el escudo propio**, solo si pasó el filtro, y una vez. La
    imagen la sirve `/canal/publicacion/[id]/imagen`, y en el feed va cuadrada y entera: en
    la franja de las fotos se cortaba el lema.
  - ⚠️ **`DevolucionAjito` lleva `key` por respuesta.** Tras un «no va» se reutilizaba el
    componente del pedido rechazado, que ya había pedido lo suyo, y el dibujo nuevo nunca se
    pedía.
- **`asistente_libre_activo` viene apagado.** Encendido, aparece «Pregúntale a Ajito» en
  el índice y la lección 8 se despide distinto. Por eso ese cierre está escrito en dos
  versiones. Ver «La conversación con Ajito», abajo.
- **Ajito se genera, no se edita a mano**, igual que la marca:

  ```
  pwsh scripts/generar-ajito.ps1     # assets/marca/ajito.png → public/marca/ajito.png
  ```

**Reiniciar el curso es solo de editores.** El botón vive en el índice de
`/canal/adiestramiento` y lo dibuja `esEditor(perfil)`: es herramienta de trabajo —para
volver a recorrer una lección hay que borrar el avance— y delante de las doscientas
personas de planta un botón que borra el avance es un accidente esperando. Borra de verdad:
avances, respuestas, los archivos de la carpeta del empleado en el bucket, y el certificado.
⚠️ **Sin política de DELETE, Postgres no se queja: filtra las filas y `delete()` devuelve
cero afectadas.** La primera versión decía «curso reiniciado» con los avances intactos, así
que la acción **mira el error de cada borrado y vuelve a contar antes de decir que sí**.

```
npm run sembrar:adiestramiento  -- --abrir   # clasifica oficios, matricula y abre
npm run probar:adiestramiento                # 25 comprobaciones de RLS reales
npm run capturar:adiestramiento              # iPhone 14 + panel, con el flujo
npm run probar:voz                           # 7 muestras de voz para elegir de oído
npm run generar:guion                        # el guion → guion.json, y lo comprueba
npm run generar:audios                       # graba los audios del guion con las dos voces
npm run generar:audios -- --voz hombre       # solo una voz
npm run generar:audios -- --revisar          # dice qué grabaría, sin llamar a Azure
npm run medir:ritmo                          # palabras por minuto sobre el audio, en escalera
npm run subir:audios                         # los sube al bucket privado
npm run capturar:oficios                     # el curso visto por los 8 oficios
npm run capturar:oficios -- --leccion 7      # otra lección
npm run probar:ajito                         # qué contesta Ajito, en 10 casos con filo
npm run probar:ajito -- --caso plata         # uno solo, para iterar el personaje
npm run generar:fichas                       # las 10 fichas de bolsillo, del guion
npm run subir:fichas                         # al bucket privado
npm run generar:ejemplos                     # los 3 dibujos de ejemplo de la lección 4, y los sube
npm run probar:certificado                   # 33 comprobaciones · guardas, lección 8, sin cédula, imagen y canal
npm run probar:recordatorios                 # 38 comprobaciones · la escalera y los mensajes
```

## La conversación con Ajito (`/canal/adiestramiento/ajito`)

«Preguntarle algo a Ajito», al final de la lección 8 con el interruptor encendido, y
«Pregúntale a Ajito» en el índice. Un chat como los de inteligencia artificial, con varias
conversaciones (`charlas_ajito`, `charla_mensajes`): se le escribe, se le habla o se le
manda una foto; contesta escrito y hablado, con la voz del curso, se acuerda de lo que se
habló, busca en internet y dibuja.

- **Quién entra** (`contextoCharla()` en `lib/charla.ts`): con matrícula, y el interruptor
  encendido —o, apagado, solo los editores, para probarlo—. Lo leído lo lee su autor y los
  editores, como las respuestas del curso.
- **Es el mismo Ajito.** El personaje de `lib/ajito.ts` va en piezas: `comoHablas()` y
  `REGLAS` son comunes; la devolución lleva `EN_EL_CURSO` y `FORMA_DEVOLUCION`, la
  conversación `EN_LA_CHARLA` y `FORMA_CHARLA`. Una regla nueva de Ajito va en `REGLAS`.
- **Cuatro pasos, como en los ejercicios**: `mandarAAjito` guarda lo que dijo la persona
  —primero y aparte—, `contestar` pide la respuesta, `dibujar` hace el dibujo si el modelo lo
  pidió con su herramienta, y `voz` la pone a hablar. `contestar` es idempotente. El dibujo
  pasa por el mismo filtro y el mismo generador de la lección 4, y lo que no va recibe el
  texto del guion.
- **Tope de 40 mensajes al día por persona** (`TOPE_DIARIO`): cada uno es una llamada al
  modelo grande, y a veces un dibujo.
- Todo lo suyo va a `respuestas/{empleado_id}/charla/` del bucket privado, así que
  `barrerCarpeta` lo recoge.

```
node --env-file=.env.local scripts/mirar-charla.mjs [--base http://localhost:3001]
```

Recorre el chat en un iPhone 14 con una cuenta de prueba del equipo: la entrada desde el
índice, la fecha, la voz, la memoria, un dibujo, recargar, «Nueva», y que otra persona no
lea ni escriba en la conversación ajena. Gasta unos centavos.

## El empujón (`/sistema/nucleo/formacion/recordatorios`)

El curso es a su ritmo y los gerentes piden que avancen. Entre esas dos cosas hay un
hueco: doscientas personas que empiezan la lección 0 un martes y no vuelven.

- **Está construido para funcionar sin WhatsApp**, y eso no es un apaño: la cuenta de
  WhatsApp Business está pedida y va a tardar meses. Apagado, el panel prepara los
  mensajes con el nombre de cada quien y alguien los copia y los manda desde su
  teléfono. Un empujón que solo empuja cuando la integración esté lista no empuja nada
  durante los meses que tarde la integración — que es justo cuando la gente hace el curso.
- **La conexión se configura desde el panel, no desde el `.env`**: la va a pegar quien
  tenga la consola de Meta delante, y esa persona no despliega. El token es un secreto:
  RLS de solo administradores, y **el panel nunca lo pinta de vuelta** —ni enmascarado—,
  porque un token en pantalla es un token en una captura. Dejar el campo vacío lo
  conserva; si no, cambiar el nombre de la plantilla borraría la conexión.
- **Los textos están en `contenido/adiestramiento/recordatorios.md`**, no en el código.
  Misma regla que los audios y las fichas. Y llevan una propia: **no se reclama** — nadie
  tiene que explicar por qué no ha vuelto.
- **Se manda el escalón más alto vencido, no todos.** Quien lleva veinte días callado
  recibe el de los 13 y ya; despertarse con cuatro mensajes seguidos de Ajito es la forma
  más rápida de que alguien silencie la conversación. La pareja `(matrícula, escalón)` es
  única en la base, así que darle diez veces al botón no prepara diez mensajes.
- **Preparar y mandar son dos pasos**, para poder leer el texto antes de que salga.
  Doscientos mensajes con una errata de Ajito no se recogen.
- **Meta exige plantilla aprobada** para escribirle a quien no te ha escrito en 24 horas,
  y un recordatorio cae siempre de ese lado. Por eso el texto viaja como parámetro de una
  plantilla registrada y su nombre se configura en el panel.
- **`{enlace}`** es el del curso. El personal —el de `accesos`— se manda desde el padrón
  al matricular; ver abajo.

## El padrón (`/sistema/personas/padron`) y el enlace personal

La mesa de trabajo de las ~200 personas: quién está, quién tiene teléfono, quién está
matriculado, a quién se le mandó su enlace y **quién ha entrado con él**. Desde ahí se
matricula en lote, se acuña el enlace y se manda.

**El enlace es la credencial.** Nadie de planta tiene correo corporativo, y pedirle a una
operadora de envasado que se invente una contraseña y la teclee con guantes es pedirle
que no entre. Toca el enlace que le llegó por WhatsApp y está dentro.

Eso obliga a tratarlo como lo que es —una contraseña—, y de ahí las reglas de
`lib/accesos.ts`:

- **El token no se guarda: se guarda su SHA-256.** Quien lea `accesos` —incluido quien
  tenga la clave de servicio— puede comprobar un token que le presenten, no suplantar a
  nadie. El texto en claro solo existe dentro del mensaje que se manda.
- **Caduca a los 120 días** (`DIAS_VIGENCIA`), que cubre la Fase 1. Un enlace en un chat
  de WhatsApp es reenviable y no puede quedar abierto para siempre.
- **Se puede volver a usar hasta entonces**, y cada uso se cuenta. El curso son semanas:
  un enlace de un solo uso obligaría a mandar uno nuevo cada vez. Y «mandado, cero
  entradas» es el dato que más dice — significa que no llegó, no que la persona no quiera.
- **Acuñar crea la cuenta a quien no la tiene**, con un correo interno derivado de la
  cédula (`v12345678@iberia.local`) que nadie va a usar nunca para entrar. Supabase
  necesita colgar la sesión de algo; la puerta es el enlace.
- `/entrar/[token]` comprueba el hash y **solo entonces** acuña un enlace mágico de
  Supabase con la clave de servicio y lo consume ahí mismo. Ese segundo enlace nunca sale
  al navegador. Y **no dice por qué falló**: caducado, inventado o de alguien que ya no
  está devuelven todos lo mismo, porque distinguirlos convierte la ruta en una forma de
  averiguar qué tokens existen.
- **`/entrar/[token]` redirige al origen de la petición, no a `NEXT_PUBLIC_SITE_URL`.** La
  cookie de sesión queda en el host que recibió el enlace; mandar a la persona a otro
  —una vista previa, `www` contra el dominio pelado— la deja sin sesión, en el login que el
  enlace viene a evitar. `NEXT_PUBLIC_SITE_URL` es para los enlaces que **salen** de la app:
  el del mensaje y el de los recordatorios.
- ⚠️ **Una cuenta creada desde Usuarios no nace enlazada a su ficha**, y el canal cuelga todo
  de la ficha (`empleados.perfil_id`): sin ella se entra al programa y se queda en «esa cuenta
  todavía no está asociada a una ficha del padrón». Le pasó el 27 de septiembre de 2026 a la
  primera cuenta de Iberia hecha para el canal. **Se enlaza en Usuarios** —al crear la cuenta,
  o después, en la cuenta de Iberia con canal que sale con el aviso ámbar—, y el panel propone la
  ficha que coincide con el nombre (`mejorFicha()` en `lib/coincidencia.ts`). Solo propone:
  con homónimos no elige nada. ⚠️ **Hay gente dos veces en el padrón** —las 17 fichas cargadas a
  mano en agosto, sin número de ficha, y la del listado de Capital Humano—; en un empate gana la
  que trae número. Las cuentas que se acuñan desde el padrón sí nacen enlazadas.
- **El padrón dice de quién es cada ficha** (27 de septiembre de 2026): su número de Capital
  Humano —sin número, «Cargada a mano»— y la cuenta que tiene enlazada. Y cruza dos cosas por
  el nombre (`cruzarPadron()` en `lib/padron-cuentas.ts`):
  - **La ficha de muestra repetida** —una cargada a mano que repite a una de Capital Humano—
    sale marcada, sin casilla, y ni se matricula ni se le acuña enlace: se usa la otra. Pasó con
    Martha Fuentes: se matriculó «Martha Fuentes», de muestra, en vez de la 4837.
  - **La cuenta que coincide**: la ficha sin cuenta cuya persona ya tiene una —la de su correo,
    creada en Usuarios— ofrece «Enlazar» en su fila, y **acuñar no le crea otra**: sin esa
    guarda, el enlace le hacía una cuenta nueva a la ficha y la de su correo seguía sin ficha.
  - Enlazar vive en `enlazarCuentaConFicha()`, que usan Usuarios y el padrón.
  - La búsqueda del padrón no distingue tildes: con `ilike`, «alvarez» no encontraba «Álvarez».
  `scripts/mirar-padron-cuentas.mjs` arma el caso con gente de prueba y lo recorre hasta la
  lección 0.
- **El cargo se escribe como se lee en el canal** (`legible()` de `lib/certificado.ts`): llega del
  listado de Capital Humano en mayúsculas, y el perfil, la gente, los mensajes y el feed decían
  «GERENTE GENERAL». Y el importador pone mayúscula también después de un guion: «García-ramos»
  salía así.
- **Para ver lo que ve alguien sin entrar con su cuenta**: `scripts/mirar-puertas.mjs --rol <clave>
  --como <ficha>` crea una cuenta de prueba con ese rol y los datos de esa ficha —nombre, cargo,
  nivel, área— y recorre el canal, el curso y el panel. Nunca se acuña sesión con la cuenta de un
  cliente.
- `/entrar` y `/canal/entrar` son las rutas públicas del enlace en `lib/supabase/sesion.ts`.
  Tienen que serlo: quien llega con su enlace **todavía no tiene sesión**. *(La otra pública
  nueva, desde el 23 de octubre de 2026, es `/privacidad`, para la app de iOS.)*

## El padrón real

`importar:padron` carga las 276 personas del listado de Capital Humano leyendo el `.xlsx`
**del bucket de archivos**, no de la carpeta de descargas de nadie: el expediente es la
fuente. Descomprime en un temporal y lo borra al salir, que es material bajo NDA.

- **La clave es la `ficha`**, no la cédula: es lo que usa Capital Humano y contra lo que va
  a venir el archivo con los datos de contacto.
- **`cedula` es opcional a propósito.** El listado de julio de 2026 no la trae, e
  inventarle una a 276 personas metería dato falso en la tabla de la que salen los
  certificados. Sin cédula no se acuña el enlace, y eso es correcto.
- **La sede no se deduce.** El archivo no la trae y adivinarla por centro de costo manda a
  alguien al ejercicio equivocado. `--sedes` enseña el reparto crudo, sin cargarlo.
- **Reimportar no pisa lo conseguido a mano**: teléfono, correo, cédula y sede se respetan.

⚠️ **Una suite de verificación que corre contra producción no puede escribir.** Pasó:
`probar:supabase` comprobaba que `matricular_pendientes` existiera llamándola con el curso
real, y matriculó a 201 personas. Se comprueba con una clave inexistente: la excepción
prueba que la función está sin tocar dato de nadie.

⚠️ **Una vista que mira `accesos` no puede ser `security_invoker = on`.** La política de
esa tabla niega el SELECT a todo el mundo, así que la subconsulta vuelve vacía en
silencio y el panel dice «sin acuñar» de enlaces que existen — lo que lleva a mandarlos
dos veces. `padron_estado` y `accesos_estado` corren como su dueña y se cierran con un
`where public.es_editor()` dentro.

**El certificado no se lo puede fabricar quien lo recibe.** Es lo contractual del
adiestramiento y va registrado en Capital Humano, así que la política de `certificados`
—correctamente— solo deja escribir a los editores. La emisión pasa por
`emitir_mi_certificado()`, `security definer`, que comprueba dos cosas antes de
insertar: que la matrícula sea de quien llama, y que **las nueve lecciones estén
completadas de verdad** —las cuenta, no se fía del estado de la matrícula—. Es
idempotente: emitirlo dos veces devuelve el mismo código.

**Se emite al abrirse el turno del certificado de la lección 8**, no al terminar la
lección: ese audio dice «terminaste las nueve» y el certificado sale ahí mismo, con sus
datos, debajo de «Tu certificado» (la pieza `certificado` del guion). Llegar a ese turno
da la lección por terminada; la despedida viene después. Lo hace `cerrarLeccion()`
(`lib/cerrar-curso.ts`), el mismo que usa `terminarLeccion`. Si la emisión falla, la
lección igual queda terminada — perder el avance por no poder emitir un papel sería el
peor de los dos males.

⚠️ **Next memoriza los GET idénticos dentro de un mismo render.** El `select` del
certificado repetido después de emitir devolvía la respuesta vacía del de antes, y la
lección decía «se está preparando» con el certificado ya emitido. `cerrarLeccion` devuelve
la fila que emitió, y esa es la que se pinta. Vale para cualquier página que escriba y
vuelva a leer lo mismo en el mismo render.

**Los botones del certificado hacen lo que dicen** (`CertificadoAcciones`), debajo de la
hoja en la lección y en `/canal/adiestramiento/certificado`: **Guardarlo** baja la
imagen; **Mandárselo a alguien** abre el compartir del teléfono con la imagen adentro —un
enlace no serviría: pide sesión—; **Publicarlo en el canal** lo pone en «Nuestra gente»
por `publicar_mi_certificado()`, `security definer` como la del escudo: solo el propio,
una vez.

**La imagen la dibuja `next/og`** (`lib/certificado-imagen.tsx`, 1080 × 1440) con DM Sans
de `assets/fuentes/` (OFL), el logo y Ajito. El texto sale de `lib/certificado.ts`, el
mismo de la hoja: son dos maquetas —`next/og` no entiende Tailwind— y un solo texto.
🔴 **La que va al canal no lleva la cédula**; la que se guarda o se manda, sí.
⚠️ En Netlify la función no ve `public/` ni `assets/` si no se le dice: van en
`outputFileTracingIncludes` de `next.config.ts`. Y `next/og` exige `display: flex` en
toda caja con más de un hijo —`C.I. {cedula}` son dos— y encoge lo que no quepa: todo va
con `flexShrink: 0` y un espaciador que absorbe.

**Una sola hoja para dos públicos.** `components/certificado-hoja.tsx` la ve el
trabajador en su teléfono y también sale en `/sistema/nucleo/formacion/certificados/imprimir`,
que es de donde Boosty imprime los doscientos para que el Gerente de Planta los entregue
en mano. Si fueran dos maquetas, el papel y la pantalla dirían cosas distintas del mismo
curso, y el papel es el que queda. Los estilos de impresión están al final de
`app/globals.css`.

**Los datos van congelados en la fila**, no leídos del padrón: si la persona cambia de
cargo en noviembre, el certificado sigue diciendo lo que era el día que lo hizo.
🔴 **`certificados.cedula` no sale por la API** (desde `privacidad_programa`): se pide con `cedulasDeCertificados()` /
`conCedula()` de `lib/contacto.ts`, y la función solo la da a su dueño, al equipo editor y a quien tiene
`modulo:certificados` · ver **y** `modulo:empleados` · editar. Con solo Certificados, el lote impreso sale con el número de
ficha (`identificacion()`).
⚠️ **La cédula es opcional y el número de ficha la sustituye** (`identificacion()` en
`lib/certificado.ts`): el listado de Capital Humano llegó sin cédulas, y hasta el 27 de
septiembre de 2026 `certificados.cedula` era `not null` —ninguna de las 276 personas del padrón
real podía recibir su certificado, y la lección 8 decía «se está preparando»—. Ahora la fila
congela también `ficha`, y el certificado dice «C.I. …» o, sin cédula, «Ficha …». En el que va al
canal no sale ninguno de los dos. Y el
código va legible —`IB-AJITO-2026-0042`— porque alguien de Capital Humano lo va a
teclear copiándolo del impreso.

**Las fichas de bolsillo salen del guion, como los audios.** El texto de cada una está
en su bloque `🖼 **Ficha de bolsillo**` de `contenido/adiestramiento/leccion-*.md`, en
la cita de debajo. Cambiar una línea es cambiar el guion y volver a generar; nunca al
revés. Se dibujan con **Playwright**, no con GDI+ como la marca: esto es tipografía —
cuatro líneas que tienen que caber y leerse a un brazo de distancia—, Chromium ya sabe
hacerlo, y los `.ps1` solo corren en Windows.

**El tamaño se mide, no se calcula.** `medir()` baja la escala de 5 en 5 por ciento hasta
que el contenido deja de rebosar la tarjeta, y avisa por debajo del 70% — ahí el arreglo
no es encoger más, es escribir menos en el guion. La primera versión tenía los tamaños a
mano y la ficha de la lección 8 salió con Ajito cortado por abajo.

**La ficha hereda el `-A`/`-B` del audio que acompaña.** La lección 8 se despide de dos
maneras según el interruptor y cada despedida lleva su ficha; sin el sufijo heredado se
oye una despedida y se ve la otra.

**Ajito contesta desde `lib/ajito.ts`, y ahí vive el personaje.** **Sabe qué día y qué
hora es en Venezuela** —se le dice en cada mensaje; sin eso, «¿qué día es hoy?» salía como
«no tengo forma de saberlo» en la primera lección— y **puede buscar en internet solo donde la
persona pregunta lo que quiera** (`PUEDE_BUSCAR`: el primer toque y la lección 1), para el
clima o un resultado. ⚠️ **Nunca en la lección 7**, que enseña que no sabe lo de adentro de
Iberia, y la búsqueda va **sin `country`**: «VE» no está soportado y tumbaba la devolución.
Si la API rechaza la búsqueda, contesta sin ella. Son las mismas reglas
de `contenido/adiestramiento/00-reglas-del-guion.md` traducidas a instrucción: si una
cambia allá, cambia aquí el mismo día — es un solo Ajito, y quien oye el curso no
distingue qué salió grabado y qué salió del modelo. Cada ejercicio lleva además su
propia instrucción en el mapa `INSTRUCCION`: ordenar en pasos lo que en la lección 2 se
contó revuelto, sacar la cuenta del pasaje en la 6 **sin opinar de la plata de nadie**,
y decir «no sé» en la 7 — el único ejercicio donde acertar sería el fracaso.

`probar:ajito` **imprime lo que contestó**; eso es la verificación. Las reglas que pasa
por encima —largo, vocabulario prohibido, inglés, género, Markdown— cazan la regresión,
no la calidad.

**La clave sale de `lib/clave-anthropic.ts`**, que prefiere
`ANTHROPIC_API_KEY_SALDO` y cae en `ANTHROPIC_API_KEY` si la primera no está. Hay dos
porque la original se quedó sin crédito, y la función **dice cuál eligió**: dos claves con
una precedencia invisible es lo que hizo perder una hora buscando en el código un fallo que
estaba en la consola de facturación. Se pasa explícita al SDK; dejándosela adivinar tomaba
la vacía. ⚠️ **Y la dirección de la API, también explícita**: en Netlify el entorno trae una
`ANTHROPIC_BASE_URL` de su pasarela de IA, el SDK la tomaba sola, y la clave nuestra volvía con
un 401 sin cuerpo —en local funcionaba—.

La devolución **se pide aparte de guardar la respuesta**, y ese orden importa: lo que la
persona dijo es lo que no se puede perder, así que se guarda primero y siempre. Si el
modelo se cae, la respuesta está a salvo y sale un botón de reintentar.

**Y sale hablada, no escrita.** `lib/hablar.ts` la sintetiza con la misma voz de la clase
—si la clase la dijera una voz y la devolución otra, habría dos Ajitos— y la guarda en el
bucket privado bajo `respuestas/{empleado_id}/`, que es donde la política de dueño-en-la-ruta
ya la cubre. El texto va debajo del reproductor con audio o sin él: vale para quien tiene el
teléfono en silencio o está en el comedor con ruido. ⚠️ **Si el audio falla, el siguiente
toque lo sintetiza sin volver a preguntarle al modelo**: antes el atajo de idempotencia
devolvía «ya está» y la devolución se quedaba escrita para siempre. Solo se pide una
a la vez —la primera de la lección a la que le falte—: abrir una lección con cuatro
respuestas viejas no puede disparar cuatro llamadas con sus cuatro fotos. Una que falla
queda marcada con `devolucion_en` sin texto y **sale de la cola**, para no congelar
detrás de sí el resto de la lección.

**`capturar:oficios` es la verificación que no se puede saltar cuando se toca un
ejercicio.** Crea un trabajador de prueba por familia —con su sesión, su cargo y su
matrícula—, recorre la lección entera con cada uno y compara la consigna que salió en
pantalla contra la que dice `lib/adiestramiento.ts`. Es lo único que caza que a la
cocinera de pruebas le llegue el ejercicio del codificador de frascos. Borra todo al
salir, y barre por prefijo: recoge también lo que quede de una corrida que se cayó.

Los audios viven en el bucket privado `adiestramiento` y se sirven por
`/canal/adiestramiento/[numero]/audio/[pieza]`, que exige sesión, **matrícula en el
curso** y firma un enlace de 60 segundos. Nada de audio por URL pública.

`probar:adiestramiento` y `capturar:adiestramiento` **no piden contraseña**: acuñan la
sesión con un enlace mágico emitido con la clave de servicio y la inyectan como cookie.
La verificación deja de depender de que alguien esté delante para escribirla, y no toca
ninguna credencial. `probar:voz` sí necesita `AZURE_SPEECH_KEY` y `AZURE_SPEECH_REGION`.

`capturar:canal` mide lo que una captura no muestra: desbordes horizontales y objetivos
táctiles menores de 44 px.

⚠️ **Toda verificación que crea fichas de prueba barre su carpeta del bucket al borrarlas**
(`scripts/barrer-carpeta.mjs`). Borrar la ficha se lleva en cascada las filas, no los
archivos: hasta el 27 de septiembre de 2026 habían quedado 115 sueltos —fotos, audios de
devoluciones— en 101 carpetas sin dueño. `probar:supabase` falla si vuelve a quedar alguna.

## Plataforma Iberia (`/sistema`)

El sistema que reemplaza al dashboard para operar a Iberia (Etapa 1 + rediseño R0–R6, rama
`plataforma/etapa-1`). Plan: `plataforma/plan/` (fuera de git; el Anexo E es el rediseño).

- **Armazón** (`app/sistema/layout.tsx`): barra carbón (Ctrl K, «Datos al», Realidad/Escenario, Bs/USD,
  tasas, punto de JD, «ver como», campana, persona), riel de dominios y columna de módulos (salen de
  `control.modulo`: el plan es dato), zona de trabajo y panel de la ficha. En teléfono (≤ 900 px) todo
  eso va en un `<dialog>` (`MenuTelefono`). El layout lee todo **en una sola tanda** (`Promise.all`): una
  lectura nueva del armazón entra ahí, nunca después.
- **Contexto en la URL**: `al` (fecha de los datos) y `esc` (escenario) los lee cada página con
  `leerContexto(sp)` y el menú los arrastra; la moneda, el riel y la columna van en cookies.
  `ficha=<tipo>:<id>` abre el panel **sin ir al servidor**: `fijar()` de `useContextoUrl` lo cambia con
  `history.pushState` (`SOLO_NAVEGADOR`), y lo mismo `abrirFicha` del lienzo y de los avisos. Con
  `router.push` la página entera se volvía a pintar en el servidor antes de traer la ficha (1,9 s → 0,9 s).
- **Las piezas, una sola vez**: `TablaServidor` + una **fuente** (`lib/plataforma/tablas*.ts`: consulta,
  columnas, permiso, ficha; `enMemoria` para las chicas) pinta `TablaDatos` con filtros en chips, orden,
  grupos, totales sobre lo filtrado, vistas (`ui.vista`) y exportación con la misma definición.
  `FichaObjeto`/`PanelFicha` (la arma `lib/plataforma/fichas.ts` con la RLS de quien mira; Esc cierra y
  devuelve el foco). `KpiMetrica` (sección de abajo). `Lienzo` (React Flow 12.12 + dagre) para el
  organigrama (`org.lienzo`) y el mapa (`sgc.lienzo`): la base hace las cuentas y el `diff` del escenario,
  el lienzo solo dibuja; en teléfono arranca en lista.
- **La ficha a página completa** (`/sistema/ficha/[tipo]/[id]`) lleva «← Volver» (`BotonVolver`: atrás si se vino de la app,
  si no al módulo) y las migas Mi día / dominio / módulo / tipo / objeto, con el módulo que calza con su `hrefModulo`
  (`moduloDeRuta`). La página se lo declara al menú con `RutaDeFicha`, y el riel marca ese dominio (24-nov-2026).
- **Esquemas**: `org` (estructura, escenarios), `sgc` (procesos, documentos), `flujo` (rutas y
  aprobaciones), `control` (módulos, catálogos, tasas, auditoría), `ui` (vistas, búsqueda, métricas),
  `nucleo` (línea de tiempo, avisos, tareas), `ia` (capacidades, propuestas, actividad). Las funciones que
  no se exponen van en `privado`.
- **Permisos**: recursos `sistema:*` de `lib/permisos.ts` (estructura, escenarios, procesos, documentos,
  perímetros, dotación, costos 🔒, requisiciones, aprobaciones, catálogos, auditoría, tasas,
  tasas-paralelo, ia, ia-actividad). La página pide su recurso con `requerirPermiso` y la RLS lo vuelve a
  preguntar con `puede()`; un aviso solo le llega a quien puede ver el objeto (`privado.puede_ver_objeto_de`;
  los de `nivel_ia`, que no tiene ficha, llevan a la bandeja — `tieneFicha()`).
- **Tasas**: `control.tasa_cambio` + `control.tasas_del_dia()` (el paralelo solo con
  `sistema:tasas-paralelo`, y su lectura queda registrada). Las captura `POST /api/tasas/capturar` con la
  cabecera `x-tasas-secreto` (`TASAS_SECRETO`); el programador se monta al pasar a producción.
- **IA**: toda capacidad nace en N0 y sube **un nivel a la vez** por la ruta `nivel_ia` (doble firma),
  nunca sobre su techo; bajar o apagar es inmediato. Interruptor general y tope diario en Administración ›
  Gobierno de IA; lo que hace la IA queda en `ia.actividad`, que no se borra. Techo de NUC-DOC-IA-02: N4
  solo para metadatos internos; el estado vigente, N2.
- **PDF del subárbol**: el botón de los dos lienzos manda a `POST /sistema/pdf/subarbol` solo ids (la caja
  elegida y lo desplegado); el servidor relee la rama con la RLS, arma el cajetín (código, versión, datos
  al, fecha, «Uso interno») y lo imprime con Chromium (Playwright). Sin Chromium (Netlify) responde la
  misma hoja en HTML para imprimir desde el navegador. Sin costos.
- **Accesibilidad (WCAG 2.2 AA, R6)**: dentro de `.plataforma` el gris tenue (`marca-400`) es `#706a67`
  (≥ 4,5:1); el texto de un tono va con `TEXTO_TONO`, no con `COLOR_TONO`. **El nombre de un botón empieza
  por lo que se ve** (2.5.3): `Desplegable` usa su texto y deja `etiqueta` de `title`; solo uno de icono
  lleva `soloIcono`. ⚠️ Un `sr-only` dentro de una tabla con desplazamiento necesita un padre `relative`:
  si no, se sale del contenedor y ensancha la página en el teléfono.
- **Formación y padrón (integración del panel viejo, 20-nov-2026)**: el curso de Ajito es NUC-FOR en
  `/sistema/nucleo/formacion` (Resumen con las métricas `formacion_*`; Avance por área y oficio —cuentas,
  `ui.formacion_avance()`, con la puerta del tablero— y por persona —`modulo:empleados` · editar—;
  Certificados, con el lote para imprimir en `/imprimir` y «entregado en mano»; Recordatorios). El padrón es
  «Padrón y accesos» (`/sistema/personas/padron`, módulo de interfaz `PER-PAD` de `dominios.ts`, no del plan):
  `TablaDatos` con selección y acciones en lote (`lote`), y la ficha `persona` suma Padrón · Accesos ·
  Formación con `modulo:empleados` · editar (`lib/plataforma/fichas/padron.ts`). Lo que se hace con el padrón
  vive una sola vez en `lib/padron-acciones.ts`. Las rutas viejas de `/dashboard` redirigen con sus parámetros.
  En pruebas, `scripts/plataforma/importar-formacion.mjs [--audios]` copia de producción (solo lectura) el
  estado del curso: sin el token de WhatsApp, sin respuestas y, de `accesos`, solo el estado (nunca el enlace).
- **Pruebas, siempre contra el proyecto de PRUEBAS** (`SUPABASE_PRUEBAS_*`, cuentas
  `<rol>.pruebas@plataforma.local`): `dev-pruebas.mjs` (dev en el 3005), `produccion-pruebas.mjs` (build de
  producción en el 3007), `sql-pruebas.mjs` (SQL por la Management API, solo al de pruebas; `--registrar`
  anota la migración), y las suites `probar-colaboracion`, `probar-r5`, `probar-ia`, `probar-lienzo`,
  `probar-r6` (teclado, teléfono, pellizco, PDF), `probar-privacidad` (contacto del padrón, sesiones, archivos y notas del
  programa, cédula del certificado y las cifras que se cuentan, con sesiones reales; la línea de tiempo del programa, Ctrl K y
  el directorio del canal), `mirar-armazon`, `medir-rendimiento` y
  `medir-accesibilidad` (axe-core). Producción: `pasar-a-produccion.mjs` hace un simulacro de solo lectura
  y dice qué falta; con `--ejecutar --confirmo`, y el OK de Gabriel, lo hace.

## Los archivos de origen de los documentos (NUC-DOC, desde el 24 de noviembre de 2026)

Pedido de Gabriel: que los archivos del levantamiento (`Procesos Iberia/`, fuera de git) se vean y se descarguen desde la
ficha del documento. Migración `20261124020000_documento_archivos.sql`.

- **Se sube un PDF optimizado, no el original**, mientras producción siga en el plan gratis (1 GB de Storage para todo):
  los 3.714 archivos pesan 5,4 GB y en PDF optimizado caben en unos pocos cientos de MB. Los originales se suben con el
  plan de pago (`cargar-documentos.mjs --originales`) y la ficha ofrece entonces «Original».
- **La cadena** (las herramientas en `scripts/plataforma/documentos-pdf/`, con su `LEEME.md`; los datos y los PDF en
  `plataforma/_trabajo/documentos-pdf/`, fuera de git): `manifiesto.json` (cada archivo con su
  huella SHA-256 y los documentos que lo citan) → `word-pdf.ps1` convierte Word, Excel y PowerPoint a PDF con Office
  (COM, «para pantalla»), en tres tandas paralelas con `vigilante.ps1`, que mata el Word de una tanda si un archivo
  pasa de 150 s → `comprimir-todo.py` (PyMuPDF) re-muestrea las imágenes a 110 ppp en JPEG 60 y deja `pdf-final/` y
  `final.json` → `scripts/plataforma/cargar-documentos.mjs` sube y anota.
  - ⚠️ **Las tandas corren con `pwsh` (PowerShell 7), no con `powershell.exe`**: con la 5.1 el recorrido de los
    campos por COM se quedaba en bucle.
  - ⚠️ **Word rehace los campos DATE/TIME al abrir**: una «Elaboración» con campo TIME salía con la fecha de la
    conversión. `word-pdf.ps1` les pone la fecha en que se guardó el archivo, con su formato, y los congela; los
    vínculos a la red de Iberia (LINK, INCLUDEPICTURE) se congelan para no esperar a un servidor que no se alcanza.
  - ⚠️ **En PowerShell, leer una propiedad de un objeto COM muerto no falla: devuelve nulo.** Tras un error se cierra
    Office y se levanta otro; lo que falló queda en el registro de la tanda y no se reintenta.
  - ⚠️ **`rewrite_images` de PyMuPDF no hacía nada con los escaneos** (una imagen JPEG de 1664×2160 por página):
    `comprimir.py` re-muestrea imagen por imagen. Un informe de 9,6 MB quedó en 3 MB y se lee.
- **Qué sube y qué no** (`cargar-documentos.mjs`): entra lo que cabe en `--presupuesto-mb` (850 por defecto, contando
  los demás buckets), primero lo de documentos vigentes y lo liviano; lo demás queda `pendiente_plan`. Un archivo de
  un documento con `datos_sensibles` queda `retenido` (se sanea antes). Visio, Publisher e InfoPath:
  `sin_conversion`. En el bucket el nombre es la huella (`pdf/<huella>.pdf`), nunca la ruta del repositorio.
  Idempotente: volver a correrlo sube lo que falte y actualiza las filas.
- **Quién ve**: la RLS de `sgc.documento_archivo` y la política del bucket `documentos` preguntan por el documento con
  la sesión de quien mira, así que los perímetros sensibles cierran igual que la ficha. Nadie escribe con su sesión.
- **La ficha**: pestaña «Archivos de origen» (bloque `archivos`, `components/sistema/ui/archivos-ficha.tsx`). «Ver» abre
  la vista previa dibujada con **pdf.js** (`visor-pdf.tsx`, página por página al desplazarse): un `iframe` no sirve
  porque Chrome en Android no muestra PDF dentro de una página y Safari en el iPhone solo pinta la primera hoja.
  `pdfjs-dist` es dependencia de producción por eso. Las rutas: `/sistema/nucleo/documentos/archivo/[id]/ver` (el PDF en
  línea, desde el mismo origen) y `/descargar` (enlace firmado de 60 s; `?original=1` para el original).
- `node --env-file=.env.local scripts/plataforma/probar-documentos-archivos.mjs` lo recorre en pruebas: la pestaña, la
  vista previa dibujada (píxeles del lienzo), las rutas, el teléfono y que sin `sistema:perimetros` no se alcanza la
  fila, el objeto ni la ruta de un documento de perímetro.

## Toda edición pasa por aprobación (desde el 24 de noviembre de 2026)

Pedido de Gabriel: «las ediciones son escenarios también que tienen que pasar por aprobación», en estructura y en
procesos. Migraciones `20261124040000_cambios_con_aprobacion.sql` y `20261124050000_escenarios_completos.sql`.

- **Nada entra a la realidad sin firma.** Las pantallas no llaman más a `org.editar_plaza` y compañía: **proponen**
  (`proponer()` de `lib/plataforma/cambios.ts` → `org.proponer_cambio`). El cambio va al **borrador de cambios** de quien lo
  hace —un `org.escenario` de tipo `cambios`, uno abierto por persona— como una fila de `org.cambio` con la función de siempre
  y sus argumentos. Para `editar_unidad` y `editar_plaza` se guarda solo lo que cambia (`parche`) y al ejecutar se completa
  con el estado del momento: dos cambios a la misma plaza no se pisan.
- **Al proponer, la base simula el lote entero** contra la realidad de hoy (`org.simular_cambios`) y lo deshace: el error de
  siempre sale en el acto. **Al aprobarse** (`org.publicar_cambios`), el lote se ejecuta en orden, en la fecha elegida y **a
  nombre del autor** (`request.jwt.claim.sub`): la auditoría dice quién lo hizo y la solicitud, quién lo aprobó. Si la
  realidad cambió y ya no cuadra, la firma falla y nada se aplica. Devuelto: vuelve al borrador (si el autor abrió otro, se
  suman); rechazado: se descarta.
- **Qué pasa por aquí**: unidades, plazas, dependencias, dotación, movimientos de personas, cargos, costos 🔒, la aprobación
  del plan de dotación y el cruce SGC ↔ informe. El borrador del plan (sus líneas) sigue siendo un borrador; lo que se propone
  es aprobarlo. El cargo nuevo de una requisición lo crea `org.crear_cargo_de_requisicion` y entra con la requisición.
- **Quién aprueba**: un solo paso, por **casilla** (`flujo.ruta_paso.resolutor = 'permiso'`, `permiso =
  'sistema:cambios:editar'`, «Aprobar cambios» en Roles); el nivel administrador siempre. La misma ruta para los lotes de
  cambios, los escenarios de estructura y de procesos y las versiones de proceso (decisión de Gabriel). **Quien hizo el cambio
  no lo aprueba**, aunque sea administrador (`privado.puede_decidir_de`).
- 🔴 **La realidad ya no se escribe por la API**: sin políticas de insert/update/delete en las filas reales de `org.unidad`,
  `plaza`, `ocupacion`, `cargo`, `costo_referencia`, `componente_costo`, `control.parametro` y `sgc.proceso_cruce`, y sin
  EXECUTE para `authenticated` en las funciones directas. Antes, quien tenía «editar» cambiaba filas sin versionar. Las filas
  de un escenario de diseño siguen con sus políticas «diseñar escenario». Una pantalla nueva que edite la estructura **propone**.
- **La experiencia**: tras proponer, la celda sigue mostrando la realidad; por eso `avisarPropuesto()` lanza un aviso con
  enlace y sube el contador **«Mis cambios»** de la barra (`components/sistema/shell/mis-cambios.tsx`). `/sistema/cambios`:
  el borrador (quitar, enviar con fecha y nota, descartar) y lo enviado; `/sistema/cambios/[id]`: el lote para quien aprueba
  (se decide en la Bandeja, donde el título lleva al lote).
- **El escenario de diseño** admite también, por plaza, «reporta a», estado, nómina y sede, y por unidad, sede y código; en
  procesos, los códigos SGC e informe. `org.comparar_escenario` los ve (antes la nómina, la sede y el código se perdían al
  publicar). **Enviar y publicar se niegan** (`org.choques_escenario`) si una plaza que cierra tiene gente vigente, o si algo
  que el escenario cambia se editó en la realidad después de su fecha base (publicar lo habría pisado). Al cerrar una unidad
  en el escenario, lo que le reportaba sube al jefe de afuera más cercano (antes quedaba sin jefe).
- **Límite conocido**: una plaza o unidad nueva no existe hasta que se aprueba, así que no se le asigna gente ni se le cuelgan
  plazas en el mismo lote. Para eso está el escenario de diseño.
- Pruebas, contra PRUEBAS y con sesiones reales: `scripts/plataforma/probar-cambios.mjs` (14) y `probar-escenarios.mjs` (5).

## Los tutoriales (desde el 24 de noviembre de 2026)

«Ver tutorial» en la cabecera del módulo abre un popup con el video de la pestaña activa (Gabriel: todas las de
Organización y autoridad y de Procesos; 18 videos de 30 a 60 s, ~29 MB). Migración `20261124030000_tutoriales.sql`.

- **El dato**: `ui.tutorial` (una fila por ruta de pestaña, con `recurso`) y el bucket privado `tutoriales`. Se ve con el
  permiso de la pestaña: el de Costos muestra cifras del perímetro de nómina. El video llega por
  `/sistema/tutoriales/video?ruta=…` (enlace firmado de una hora: el navegador pide trozos mientras se ve).
  `BotonTutorial` sale solo si la pestaña activa tiene video; una pestaña nueva no muestra nada hasta que se grabe.
- **Se graban, no se editan**: `scripts/plataforma/tutoriales/` (el método de los tutoriales de Security Solution). La app
  real contra PRUEBAS, en el build de producción del 3007 (`produccion-pruebas.mjs`: sin el indicador de Next), con
  cursor, subtítulos, portada y resaltado dibujados dentro de la página. Un guion por módulo en `guiones/`.
  ```
  node --env-file=.env.local scripts/plataforma/tutoriales/grabar.mjs organizacion [--solo plazas] [--subir]
  node --env-file=.env.local scripts/plataforma/tutoriales/grabar.mjs procesos --solo-subir --destino produccion --confirmo
  node --env-file=.env.local scripts/plataforma/tutoriales/probar.mjs [--produccion --email <cuenta del equipo>]
  ```
  Antes de subir se mira la hoja de contacto (`capturas/tutoriales/<modulo>/<capitulo>-hoja.jpg`): un subtítulo que no
  calza con lo que se ve (pasó con «Dependencias» en Plazas) solo se caza mirando.
- ⚠️ **Si cambia una pantalla, se regraba su capítulo**: el video no se actualiza solo.
- ⚠️ `addInitScript` corre antes de que exista `document.documentElement`: el estilo se monta con el `body`. Y el
  contexto lleva `bypassCSP`.

## Plataforma Iberia · el registro de métricas (`/sistema`, R5)

Desde el 20 de noviembre de 2026. **Cada cifra de la plataforma se define una sola vez**: «procesos con
ficha» decía 48/205 en Mi día y 46/185 en Procesos › Resumen porque cada página contaba a su manera.

- **El registro es `ui.metrica`** (clave, definición en palabras, unidad, módulo, permiso, dueño, fuente,
  tabla de origen) y **cada métrica es una función `ui.m_<clave>(p_al, p_escenario)`** que devuelve
  `(valor, total, detalle, calculado_en)`, con la RLS de quien mira. `ui.metrica(clave, al, esc)` y
  `ui.metricas(claves[], al, esc)` revisan el permiso y devuelven definición + cifra en un JSON.
  Es la semilla de DAT-SEM; se lista en `/sistema/datos/metricas`.
- **En la app, solo por `lib/plataforma/metricas.tsx`**: `<KpiMetrica clave ctx sesion />` pinta la cifra
  con su sello, la definición en la ⓘ y el clic a su tabla. `precargarMetricas()` trae las de una página en
  una vuelta. Una parte del detalle (`parte`) o el complemento (`complemento`) no son métricas nuevas.
  🔴 **Un Kpi con una cifra calculada en la página es el error que esto vino a quitar**: una cifra nueva
  es una función `ui.m_*` + su fila en `ui.metrica`, en una migración.
- **Las métricas se apoyan en la misma fuente que su tabla**: dotación sobre `ui.plazas` (= el pie de la
  tabla Plazas), procesos sobre `sgc.lienzo` (= el catálogo, sin los nuevos en borrador), conciliación
  sobre `ui.conciliacion_documentos`. Las que no tienen historia por fecha (`con_fecha = false`) lo dicen.
- **Mi día por rol**: `ui.portada_rol` (Administración › Portadas); sin fila, la del nivel
  (`PORTADA_POR_NIVEL`). Una cifra en la portada no da permiso: sin él, no sale.
- **La RLS de `org`, `sgc`, `flujo`, `control` y `nucleo` evalúa `puede()` y `auth.uid()` una vez por
  consulta** (`(select …)`, initPlan): `ui.procesos` bajó de ~380 a ~80 ms y `ui.plazas` de ~220 a ~45 ms
  en la base. ⚠️ Una política nueva se escribe así desde el principio.
- **Tablas en memoria**: una fuente con `enMemoria: true` (catálogo de procesos, plazas) se lee una vez
  por petición y se filtra, ordena y pagina en el servidor de Next.
- `node --env-file=.env.local scripts/plataforma/probar-r5.mjs [--como lector]` comprueba que la misma
  cifra diga lo mismo en Mi día y en su módulo, Ctrl K sin tildes → ficha, «?», «g p» y los tiempos.

## El asistente de IA (`/sistema/asistente`, desde el 26 de noviembre de 2026)

Pedido de Gabriel: un chat de IA como el de Claude web dentro de la plataforma, para que el personal administrativo
no use licencias sueltas. **El plan entero (7 fases, 22 decisiones de Gabriel, costos) está en Claude Docs**:
<https://claude.ai/artifact/LBR5GVKVkj2E8TTXGyba3U>. Fase 1 construida en la rama `asistente/fase-1`. Migraciones
`20261126100000_asistente`, `…110000_asistente_metricas` y `…120000_asistente_artefactos`.

- **Quién lo usa**: la casilla `sistema:asistente` (ver) del rol, con excepciones por persona en
  `asistente.politica_usuario`. **Topes, espacio, modelos y esfuerzo máximo** por rol (`politica_rol`) o persona; lo vacío
  hereda de `asistente.config`. `asistente.politica_de(perfil)` resuelve todo en un JSON (la usa el servidor) y
  `mi_politica()`, la sesión. Lo gobierna `sistema:asistente-admin` en Administración › Asistente de IA (NUC-IA).
- **Cada turno corre en segundo plano y la pantalla lo recibe en vivo.** La acción `enviarMensaje` guarda primero lo que
  escribió la persona y deja el turno `en_cola`; `lanzarTurno()` (`lib/asistente/servidor.ts`) lo dispara: en Netlify, a la
  **función de fondo** `netlify/functions/asistente-turno-background.mts` (hasta 15 min, responde 202 en el acto; el
  secreto `ASISTENTE_SECRETO` va en la cabecera); en local, dentro de `after()`. El ejecutor
  (`lib/asistente/motor/ejecutor.ts`) reserva el gasto (`asistente.reservar_turno`, bajo candado: dos turnos a la vez no
  pasan un tope), llama al motor y manda los eventos por **Realtime Broadcast** al canal privado `asistente:chat:<id>`
  (política sobre `realtime.messages` con `privado.participo_en_chat`). Lo que no se puede perder —mensaje, archivos,
  estado— va a la base; si se pierde un evento, la pantalla mira el turno cada 4 s.
  - 🔴 **`lib/asistente/motor/` no importa nada de Next ni `server-only`, y usa rutas relativas**: lo carga la función de
    fondo, que no es el servidor de Next (`server-only` lanza fuera de React Server).
  - ⚠️ **El canal se suscribe antes del primer turno**: para un chat nuevo se crea el chat (`crearChat`), se espera
    `SUBSCRIBED` y después se envía. El manejador del canal lee el chat y la función por `ref`: con el cierre de la primera
    versión, un chat recién creado no refrescaba su título.
- **Motores** (`ContextoMotor` en `motor/contrato.ts`): Anthropic (por defecto; Messages API en streaming, Opus 5.5
  medio, ejecución de código `code_execution_20260521` con las habilidades `xlsx`, `docx`, `pptx`, `pdf`, búsqueda web
  `web_search_20250305` —la `20260209` trae su propio entorno de código y no se declara junto al otro—, caché de prompt,
  `fallbacks: 'default'`) y OpenAI (Responses API con `store: false` e `include: ['reasoning.encrypted_content']`). Con
  OpenAI, **los archivos los procesa Anthropic** (herramienta `procesar_archivo`, decisión 19). El historial se guarda en
  formato propio y viaja como texto: sin bloques de pensamiento de turnos anteriores (quitarlos todos no rompe la
  comprobación de historial de Opus 5.5) y un chat sigue si cambia el motor.
- **Excel grandes**: el archivo nunca entra al contexto. Va a la Files API una sola vez (`archivo.anthropic_file_id`), se
  monta en el contenedor (`container_upload`) y el modelo lo procesa con código; lo que deja en `$OUTPUT_DIR` vuelve a
  Storage como archivo `generado`. El contenedor se reusa por chat (`chat.contenedor_id`, se renueva a los 25 días). Medido
  el 26-nov: 3.000 filas × 2 hojas con Sonnet, 38 s y US$ 0,07.
- **Artefactos** (como los de Claude; tabla `asistente.html`, `grupo` = las versiones de uno): herramientas `artefacto`
  (crear, o actualizar con su id → versión nueva) y `leer_artefacto`. Tipos `html`, `documento` (Markdown) y `svg`. Se
  abren solos en el panel. **Se sirven aislados** por `/sistema/asistente/html/[id]`: la política de contenido lleva
  `sandbox allow-scripts` (origen opaco: no lee la sesión aunque se abra suelto) y `connect-src 'none'` (no saca datos);
  librerías solo de cdn.jsdelivr.net y cdnjs. `?crudo=1` (documentos) y `?descargar=1`.
- **Archivos**: bucket privado `asistente`, ruta `{perfil}/{chat|sueltos}/…`, hasta 100 MB (el límite global de Storage
  del proyecto tiene que ser ≥ 100 MB). `prepararSubida` revisa la cuota y anota la fila; el navegador sube directo;
  `confirmarSubida` lee el tamaño real. Se guarda hasta que el dueño lo borra (decisión 13).
- **Lo que nadie lee**: el contenido de los chats. La administración ve cifras (`asistente.consumo`, métricas
  `asistente_*`); **Boosty lee para soporte solo por `asistente.leer_para_soporte(chat, motivo, ticket)`**, que exige
  `privado.es_equipo_boosty()` y deja la lectura en `asistente.lectura_soporte`. Al pie del chat va el aviso de resguardo
  (`AVISO_RESGUARDO`, decisión P5).
- **Gasto**: el del asistente vive en `asistente.turno` (tokens a precio del catálogo `asistente.modelo` + búsquedas a
  US$ 10 por 1.000), **no** en `ia.actividad`: el tope diario de la IA de la plataforma (US$ 2) es de las capacidades de
  los módulos. El interruptor general de IA y la capacidad `NUC-ASI-IA-01` sí apagan el asistente. Título y categoría de
  cada turno los pone Haiku 5.5 (`motor/titulo.ts`); se guarda la categoría, nunca el contenido.
- **Fase 2 · datos de la plataforma** (migración `20261126140000_asistente_fase2`). El asistente **nunca ve más que la
  persona**: el ejecutor recibe el token de su sesión (`tokenDeSesion()`, renovado si le quedan menos de 20 min; viaja de
  servidor a servidor y no se guarda) y cada consulta va a la ruta interna `/api/asistente/fuente` (pública en
  `sesion.ts`, pero exige `ASISTENTE_SECRETO`), que corre con un cliente de ese token (`clienteDeToken`): la RLS de
  siempre. Una **fuente** es una tabla de la plataforma (`tabla:<id>`, las mismas `FuenteTabla` de `lib/plataforma/tablas*.ts`
  vía `consultarPagina(…, cliente)`), las métricas del registro o los documentos del SGC. Se consulta si (1) la persona
  tiene el permiso de esa pantalla, (2) está en su **alcance** (`asistente.fuente` encendida + `alcance_rol` o la excepción
  de `alcance_usuario`; `asistente.mi_alcance()`) y (3) la RLS le deja las filas. Lo que no está en `asistente.fuente` está
  apagado. `FUERA` en `lib/asistente/fuentes.ts` deja fuera el padrón, el avance por persona, el canal y el historial.
  Cada consulta queda en `asistente.consulta_fuente` (sin contenido). Administración › Asistente de IA › Alcance: la matriz,
  las excepciones y «Ver como» (calcula sin acuñar sesión).
  - **Documentos**: `asistente.documento_pagina` (texto por página, `tsvector` en español sobre `asistente.plano()`), con
    RLS que pregunta por `sgc.documento_archivo` con la sesión de quien busca; `asistente.buscar_documentos()` es security
    invoker. Se llena con `scripts/asistente/extraer-paginas.py` (PyMuPDF, de los PDF locales, máx. 300 páginas por
    archivo) y `indexar-documentos.mjs` (enlaza por `pdf_ruta` o por la huella). En pruebas: 13.517 páginas, 46 MB.
  - Red team del 26-nov (`probar-datos.mjs --solo redteam`, informe en `capturas/asistente/red-team.json`): costos fuera de
    alcance, directo y con rodeo; inyección desde un CSV; pedido de contactos; artefacto que llama a la API. Ninguno pasó.
- **Fase 3 · proyectos, memoria, atajos y voz** (migración `20261126150000_asistente_fase3`). **Proyecto**
  (`asistente.proyecto`, de su dueño): sus instrucciones van al `system` después de las de la empresa (que mandan) y sus
  archivos (`archivo.proyecto_id`) se montan en el contenedor en cada turno (`archivosFijos`). Un chat solo cuelga de un
  proyecto propio (trigger `b_chat_proyecto`). **Memoria** (`asistente.memoria`, apagable en `asistente.preferencia`): va en
  el mensaje del turno, no en el `system` (cambia y rompería la caché); el modelo la escribe con `recordar` y la borra con
  `olvidar` (`motor/memoria.ts`), que rechaza lo que parece cédula, teléfono, correo o contraseña. **Nunca entra a un chat
  compartido.** El chat muestra «Guardé en tu memoria» con Deshacer. **Atajos** (`asistente.atajo`; `dueno` null = de la
  empresa, que crea `sistema:asistente-admin` · editar): «/» en la caja abre el menú y Enter usa el primero. **Dictado**:
  `MediaRecorder` → `aWavDe16k` → `/sistema/asistente/transcribir` (Azure, `lib/transcribir.ts`, máx. 60 s); el texto
  vuelve a la caja para revisarlo y el audio no se guarda.
- ⚠️ **Un `next dev` viejo sirve código viejo**: el 26-nov el Resumen mostraba cifras sin formato con el archivo ya
  corregido; reiniciar el dev lo arregló. Y **dos `next dev` en la misma carpeta no conviven** (el del 3001 impide el del
  3005, que muere sin escribir nada en su registro).

```
node --env-file=.env.local scripts/asistente/probar-chat.mjs [--solo simple|excel|html|puertas] [--excel <ruta.xlsx>]   # contra pruebas (:3005)
node --env-file=.env.local scripts/asistente/sonda-anthropic.mjs <archivo.xlsx> [--modelo claude-sonnet-5-5]           # el motor, sin la base
node --env-file=.env.local scripts/asistente/sonda-openai.mjs                                                         # la Responses API
node --env-file=.env.local scripts/asistente/probar-datos.mjs [--solo datos|redteam|sinpermiso]                         # fase 2 y red team
node --env-file=.env.local scripts/asistente/probar-f3.mjs [--solo proyecto|memoria|atajos|voz]                         # fase 3 (micrófono falso con voz de Azure)
python scripts/asistente/extraer-paginas.py && node --env-file=.env.local scripts/asistente/indexar-documentos.mjs [--destino produccion --confirmo]
node --env-file=.env.local scripts/asistente/subir-habilidad.mjs [carpeta] [--destino produccion --confirmo]
```

## Seguridad — no negociable

Todo el contenido es material de Iberia bajo NDA (sección 09 de la propuesta).

- **RLS activa en todas las tablas.** Nada es legible sin sesión. Al crear una tabla,
  habilitar RLS y escribir sus políticas en la misma migración.
- **Autorización en dos capas**: `lib/auth.ts` (`requerirPermiso`, `puede`,
  `requerirSesion`) en el servidor, y RLS en la base. Una página nunca confía solo en
  el `proxy.ts`, y una acción de servidor no confía en que el botón estuviera escondido.
- **Roles configurables, con un nivel como techo.** Ver «Roles y permisos», abajo.
  `profiles.rol` sigue existiendo —todas las políticas viejas lo leen— pero ya no se
  escribe a mano: sale del rol asignado.
- 🔴 **Nadie cambia su propio rol, estado u organización.** La política «actualizar
  perfil propio» deja escribir la fila entera —RLS no restringe columnas— y hasta el 25
  de septiembre de 2026 un lector se hacía administrador con una llamada a la API.
  Lo cierra el trigger `a_profiles_proteger_acceso`, y `probar:permisos` lo comprueba.
  **Cualquier política de «lo propio» sobre una tabla con columnas de acceso necesita
  su trigger**: la RLS decide qué filas, no qué columnas. **Y una columna que no se debe leer se cierra con
  privilegios de columna**, no con RLS (así está el contacto de `empleados`; ver «El canal dentro de la plataforma»).
- **`SUPABASE_SECRET_KEY` bypasea RLS.** Solo en `createAdminClient()`, y solo para
  provisionar usuarios. Nunca para leer datos por cuenta de un usuario.
- **Recuperar la contraseña** (19 de octubre de 2026): «¿Olvidaste tu contraseña?» en el login
  → `/login/recuperar` pide el correo y **contesta siempre lo mismo**, exista o no la cuenta →
  Supabase manda el enlace → `/auth/confirmar` abre la sesión de recuperación (acepta `code` de
  PKCE y `token_hash`) → `/login/nueva-clave` la cambia con `updateUser`. El enlace vuelve al
  origen de la petición, que tiene que estar en las URLs de redirección de Auth. ⚠️ **Sin SMTP
  propio el correo solo le llega al equipo de la organización de Supabase**, no a Iberia.
- **Sin registro abierto**: las cuentas se crean desde `/dashboard/usuarios`, desde el
  padrón al acuñar un enlace, o con `npm run crear:usuario` — las tres por la API de
  administrador. 🔴 **Y el registro de Supabase está cerrado (`disable_signup`)**, que es lo
  que de verdad lo cumple: `handle_new_user` toma el rol de los metadatos del alta, así que
  con el registro abierto cualquiera con la clave pública se creaba una cuenta de
  administrador. Estuvo abierto hasta el 25 de septiembre de 2026, sin que nadie lo usara;
  `probar:supabase` falla si se vuelve a abrir. La interfaz sin botón de registro no cerraba
  nada: la API de Supabase es pública.
- **Producción está en Netlify**, en la cuenta de Iberia, y cada push a `main` despliega.
  Cómo está configurado y qué variables lleva, en `DESPLIEGUE.md`.
- **Bucket privado**: se descarga por `app/sistema/programa/levantamiento/archivos/[id]/descargar/route.ts`
  (las rutas viejas de `/dashboard/archivos/…` redirigen ahí),
  que exige sesión y firma una URL de 60 s.
- **Y se previsualiza por `[id]/ver`**, que es otra ruta por una diferencia de una palabra:
  `descargar` firma con `{ download: nombre }`, lo que pone `Content-Disposition: attachment`
  y hace que el navegador guarde el archivo en vez de mostrarlo — dentro de un `iframe` eso
  no previsualiza, dispara una descarga. `ver` sirve los bytes **desde el mismo origen**, y es
  la única vez que el binario pasa por el servidor de Next: así el visor lee un `.md` con
  `fetch` sin pelear con CORS y mete un PDF en un `iframe` sin que la redirección se lo lleve
  a otro dominio. Son nueve archivos que mira el equipo consultor, no doscientos teléfonos.
- **Al subir**, el binario **no pasa por el servidor de Next**: el navegador escribe directo
  en Storage y luego una server action registra la metadata. *(Al previsualizar sí pasa, y es
  la excepción — ver la viñeta de arriba. La diferencia está en el tamaño y en quién: una
  subida puede ser un PDF de 20 MB desde cualquier conexión; una previa son nueve archivos
  que abre el equipo consultor.)*

## Trampas conocidas

- **Una política RLS que se pregunta por su propia tabla entra en recursión.**
  «Soy participante si existe una fila donde soy participante» → Postgres responde
  `infinite recursion detected in policy` y la operación falla **en silencio** desde el
  cliente. La salida es una función `security definer` que consulta sin volver a pasar
  por RLS: `participo_en`, `soy_miembro`, `coordino_grupo`, `cabe_otro_participante`.
- **`.insert().select()` bajo RLS falla si la política de SELECT aún no te alcanza.**
  Al crear una conversación todavía no participas en ella, así que el `RETURNING` vuelve
  vacío. Generar el id con `crypto.randomUUID()` antes de insertar.
- ⚠️ **Supabase corta cada consulta en 1.000 filas (`max_rows`) y no avisa**: devuelve
  las primeras mil como si fueran todas. Pasó con la transcripción —FOR-002 tiene 2.723
  turnos y la página enseñaba 1.000— y con los scripts que renombran hablantes, que leían
  los ids de una vez y dejaban el resto con el nombre viejo. Lo que pueda pasar de mil se
  pagina con `.range()`; un `update` masivo va en tandas hasta que no quede nada que
  coincida; y para contar, `count: 'exact', head: true`, nunca el largo del arreglo.
- ⚠️ **En una inserción de varias filas, supabase-js pone NULL en la columna que una fila
  no trae** —no el valor por defecto de la tabla—. Con columnas `not null` la inserción
  entera falla. Cada fila lleva todas las columnas.
- ⚠️ **Un `next dev` cuya terminal murió sigue vivo, y rompe todas las rutas con parámetro.**
  Cuando Claude Code corta una tarea en segundo plano por falta de memoria, en Windows cae la
  terminal y no el árbol de Node: el servidor sigue escuchando, pero su salida da `write EPIPE`,
  y el proceso hijo que Next lanza por cada ruta dinámica (`/informe/[slug]`,
  `/canal/adiestramiento/[numero]`) hereda esa salida rota y muere al arrancar. En el navegador
  sale un 500 con «Jest worker encountered 2 child process exceptions»; las rutas fijas cargan
  bien, y eso despista. Pasó dos veces el 27 de septiembre de 2026. ⚠️ **Redirigir la salida a un
  archivo desde la terminal de Claude Code no alcanza** —fue el primer arreglo, y volvió a pasar—:
  `npm` y `scripts/servidor.mjs` siguen colgando de esa terminal, el sistema los mata con ella, y
  Next queda escribiéndole a un proceso muerto. Se cierran los procesos de Node de Iberia y se
  levanta **desligado de la terminal**, como proceso propio de Windows que escribe directo a su
  archivo:

  ```
  Start-Process cmd.exe -ArgumentList '/c','npm run dev -- -p 3001 > capturas\servidor-3001.log 2>&1' -WindowStyle Hidden
  ```
- **Git Bash convierte en ruta de Windows cualquier argumento que empiece por `/`**:
  `/dashboard/roles` llega al script como `C:/Program Files/Git/dashboard/roles`. Para
  pasarle rutas de la app a un script, `MSYS_NO_PATHCONV=1`.
- Un módulo `'use server'` solo puede exportar funciones async. Las constantes
  compartidas van aparte — por eso existe `lib/storage.ts`.
- Los tipos de ruta (`PageProps<'/…'>`) se generan: tras añadir una ruta, correr
  `npx next typegen` antes de `tsc --noEmit`.
- Regenerar tipos de base tras cada migración:
  `supabase gen types typescript --project-id <ref> --schema public > lib/database.types.ts`

### Trampas al editar y al verificar

Salieron de romperse, una por una, y vivían en la bitácora. Cada una costó al menos una corrida.

- ⚠️ **En una plantilla de JavaScript, un escape que el lenguaje no reconoce pierde la barra**:
  `\d`, `\b` y `\p{L}` llegan al regex como `d`, `b` y `p{L}`, y fallan en silencio. En una
  plantilla, la barra se escribe doble o no está. Y **la terminal de esta máquina también se come
  barras** en heredocs y en `node -e`: un script con regex se escribe con la herramienta de
  escritura, no pegado en la terminal.
- **`\w` y la frontera `\b` son ASCII en JavaScript**: fallan en la primera tilde, y aquí todo
  lleva tildes. Se usa `\p{L}` con la bandera `u`.
- **No correr `npx prettier` sobre los archivos**: el repositorio no tiene configuración, y
  prettier aplica la suya —comillas dobles y punto y coma—, que es lo contrario del estilo.
- **En GNU sed, `` \` `` es el ancla de inicio del texto, no una comilla**: un `sed` sobre
  markdown con comillas invertidas le puso una a cada línea de la bitácora. Para markdown, la
  herramienta de edición o un script de Node.
- **Delimitar un reemplazo por «lo siguiente que reconozco» es frágil**: así se fueron 939 líneas
  del generador del informe. Se acota por el cierre real, y **se commitea antes de una cirugía
  grande**.
- **`Intl.DateTimeFormat` sin `timeZone`** lee el primero del mes a medianoche UTC como el mes
  anterior visto desde Venezuela. Siempre `America/Caracas`.
- **Las esperas fijas mienten** en las pruebas (`waitForTimeout`): una página lenta pasa por rota.
  Se espera a lo que se busca —`waitForURL`, un selector—.
- **Las suites apuntan al 3000 por defecto, y en esta máquina el 3000 es otra aplicación**: se les
  pasa `--base` o `BASE_URL`, o prueban la aplicación equivocada.
- **Una comprobación que se salta en silencio es peor que no tenerla**: `probar:adiestramiento`
  pasó de 16 a 9 comprobaciones y siguió diciendo «sin fallos». Si falta lo que la prueba
  necesita, la prueba lo crea o falla.

## Verificación visual — obligatoria

Si el cambio toca la interfaz, **hay que mirarla**. Que compile, que el asset devuelva
200 y que el HTML contenga los marcadores esperados **no** demuestra que se vea bien:
un logo deformado por `align-items: stretch` pasa las tres comprobaciones.

```
npm run capturar                                      # todas las páginas
npm run capturar -- --solo programa                   # iterar sobre una
npm run capturar -- --password "<clave>" --solo login # por el formulario de verdad
```

Levanta Chromium, recorre las 14 páginas, recorta los detalles que se juzgan de cerca (los
logos), reporta los errores de consola y deja todo en `capturas/` (ignorada por git). Luego
**abrir las imágenes**.

**No pide contraseña**: acuña la sesión con un enlace mágico emitido con la clave de
servicio y la inyecta como cookie, igual que `capturar:adiestramiento`. Una verificación
obligatoria que depende de que alguien esté delante para teclear una clave es una
verificación que se salta. Con `--password` sí pasa por el formulario, y eso es lo que hay
que usar cuando lo que se está mirando es el login.

## Comandos

```
npm run dev                 # servidor de desarrollo
npm run tipos               # tsc --noEmit
npm run probar:fireflies    # 50 verificaciones del parser (sin red)
npm run probar:acceso       -- --password "<clave admin>"   # políticas RLS reales
npm run probar:paginas      -- --password "<clave admin>"   # render con sesión real
npm run probar:canal        -- --password "<clave>"         # RLS del canal
npm run probar:bloqueos                                     # reportes y bloqueos con sesiones reales · sin clave
npm run capturar:canal      -- --password "<clave>" --flujo # el canal en teléfono
npm run crear:usuario       -- --email … --password … --rol …
npm run probar:apns         -- <ruta>\AuthKey_<id>.p8   # la clave de APNs contra Apple · 400 BadDeviceToken = bien
npm run probar:adiestramiento               # RLS del curso de Ajito, sin clave
npm run capturar:adiestramiento             # el curso en teléfono y el panel
npm run sembrar:adiestramiento -- --abrir   # oficios, matrículas y apertura
npm run probar:voz                          # muestras de Paola y Sebastián
npm run generar:guion                       # el guion a datos, con su chequeo
npm run generar:audios                      # los audios de Ajito, del guion, con las dos voces
npm run medir:ritmo                         # calibrar una voz a 192 palabras por minuto
npm run subir:audios                        # al bucket privado
npm run capturar:oficios                    # el curso visto por cada oficio
npm run probar:ajito                        # qué contesta Ajito · pide ANTHROPIC_API_KEY
npm run generar:fichas                      # las fichas de bolsillo, del guion
npm run subir:fichas                        # al bucket privado
npm run probar:certificado                  # guardas, la lección 8, la imagen y el canal
npm run probar:recordatorios                # la escalera del empujón y los mensajes
npm run probar:padron                       # el enlace como credencial · 25 comprobaciones
npm run probar:supabase                     # que todo exista de verdad en el proyecto
npm run probar:permisos                     # roles y permisos contra la RLS real · 34 comprobaciones
npm run importar:transcripciones            # el levantamiento, con los hablantes por nombre
npm run importar:transcripciones -- --revisar   # dice qué cargaría, sin escribir
npm run cargar:hallazgos                    # hallazgos propuestos desde contenido/hallazgos/
npm run subir:documentos                    # propuesta, contrato y correos al expediente
npm run capturar                            # las 14 páginas, sin clave
npm run sembrar:programa                    # la línea de tiempo del programa
npm run sembrar:programa -- --limpiar       # y borra los hitos que ya no están en el archivo
npm run sembrar:horas                       # el registro de horas, partida por partida
npm run sembrar:horas -- --limpiar          # y borra las que ya no están en el archivo
npm run importar:padron                     # las 276 personas de Capital Humano
npm run importar:padron -- --sedes          # el reparto crudo por centro de costo
npm run informe:estructura                  # las 12 secciones: genera las suyas y numera las demás
npm run expediente                          # el dossier de trazabilidad, a Insumos/ · SOLO consultores
npm run sembrar:procesos                    # el inventario del taller a la base, para el mapa
npm run sembrar:procesos -- --revisar       # dice qué sembraría, sin escribir
npm run sembrar:circuitos                   # los circuitos, el espejo y los hallazgos en su punto, del taller
npm run sembrar:circuitos -- --revisar      # dice qué sembraría, sin escribir
npm run respaldar:informe                   # el informe, sus talleres y los circuitos a disco
npm run secciones -- --bajar                # las secciones del informe a disco, para corregirlas
npm run secciones -- --subir                # y de vuelta a la base, solo las que cambiaron
npm run generar:guias                       # las 3 guías de entrevista adaptadas a Iberia
```

## El programa (`/sistema/programa`, PRG)

Desde el 20 de noviembre de 2026 (decisión de Gabriel) **todo lo del panel viejo vive en la plataforma**, en el dominio
Programa; solo el informe se queda afuera. Tres módulos de `control.modulo`: **PRG-PLN · Plan y seguimiento**
(`/sistema/programa`: Resumen · Consumos · Línea de tiempo · Calendario · IA), **PRG-LEV · Levantamiento**
(`/sistema/programa/levantamiento`: Resumen · Entrevistas · Archivos · IA) y **PRG-BIB · Biblioteca**
(`/sistema/programa/biblioteca`, con el enlace al informe). Las casillas son **las mismas de siempre**
(`modulo:panel`, `modulo:entrevistas`, `modulo:archivos`, `modulo:programa`, `modulo:calendario`); PRG-PLN sale en el
menú también con solo el calendario y PRG-LEV con solo el expediente (`RECURSOS_ALTERNOS` de `lib/plataforma/dominios.ts`).
Las cifras son del registro (`programa_horas_mes` —en horas, contra 107—, `programa_sesiones`, `programa_entregables`,
`levantamiento_entrevistas`, `levantamiento_archivos`; migración `integracion_programa`). Fichas `entrevista`, `archivo`
y `actividad` (esta por `calendario_actividades.ref`) en `lib/plataforma/fichas/programa.ts`. 🔒 **La transcripción, las
notas del consultor y los hallazgos sin validar son «solo Boosty»**: la app solo se los muestra al equipo (`esEditor`).
*(Desde el hotfix del 20-nov-2026 la RLS de `transcripcion_segmentos` y `hallazgos` es solo del equipo —`es_editor()`—; la
portada del informe cuenta los validados con `hallazgos_validados()`.)* 🔴 **Desde `privacidad_programa` (20-nov-2026)**
`entrevistas`, `sesion_participantes` y `personas` piden `modulo:entrevistas` · ver (o el equipo), y `archivos` —con su
bucket— `modulo:archivos` · ver. **`notas_consultor`, `fireflies_url` y `busqueda` (que indexa las notas) no salen de
`entrevistas` por la API** —ni al equipo—: se leen con `internasDeEntrevistas()` (`entrevistas_internas()`, solo editores),
y una consulta nueva nombra sus columnas (`COLUMNAS_ENTREVISTA` de `lib/contacto.ts`). `personas.email`, `telefono` y
`notas` no los lee ninguna pantalla y ya no salen. **Las cifras que leía quien no abre la tabla salen de funciones que
cuentan**: `cuenta_entrevistas()` (portada del informe), `hallazgos_por_estado()` (sesión y ficha), `sesiones_linea()`
(Línea de tiempo de Consumos), `ui.m_programa_sesiones` (corre como dueña y pide `modulo:programa`), y
`ui.programa_entrevistas`/`programa_archivos` corren como su dueña con la casilla en su `WHERE`. Las fichas `entrevista`, `archivo` y `actividad`
tienen línea de tiempo (comentarios, menciones, seguir, tareas, recientes) con la casilla de su módulo, y Ctrl K busca
sesiones —código, título, fecha; nunca la transcripción— con `modulo:entrevistas` · ver.
Cada ruta vieja de `/dashboard/**` redirige a la nueva con sus parámetros; `/dashboard` va a Mi día (o a la primera
pantalla de quien no tiene `modulo:panel`). El layout y la barra del panel viejo se retiraron.

### La hoja de ruta de la plataforma (`/sistema/programa/hoja-de-ruta`, desde el 21-nov-2026)

Pedido de Gabriel: «qué hemos ejecutado y qué es lo que falta». Pestañas **Hoja de ruta** y **Módulos** de PRG-PLN (las
primeras; el Resumen sigue siendo el del programa de consultoría: horas, sesiones, calendario). Migración
`20261121090000_hoja_de_ruta.sql`.

- **El plan es dato, nunca archivo del repo**: `control.fase_plataforma` (12 fases, una `actual` con su `situacion`),
  `control.hito_plataforma`, `control.pendiente_plataforma` (dueño `iberia`/`gabriel`/`boosty`, qué destraba, plazo) y
  `control.decision_plataforma` (las G-xx). `control.modulo` suma `ref` (su ficha `modulo:<ref>`), `en_plan` (FIN-TAS es de
  interfaz: no cuenta en los 65), `fase_clave`, `frontera`, `dueno` y `construido`. Se cargan con
  `scripts/plataforma/importar-hoja-de-ruta.mjs` desde `plataforma/plan/datos/*.csv` y `plataforma/semillas/hoja-de-ruta.json`
  (fuera de git): pruebas por defecto, `--destino produccion --confirmo` para producción, `--revisar` para ver qué haría.
  🔴 **Sin `--pisar` no reescribe lo que ya existe** (solo completa campos vacíos): lo que se marca en la plataforma manda.
- **Cifras del registro**: `plataforma_modulos` (con `por_dominio`, de donde salen las barras), `plataforma_hitos` y
  `plataforma_pendientes`. Mi día de admin y consultor lleva «En qué vamos» (`components/sistema/programa/en-que-vamos.tsx`).
- 🔒 **«Solo equipo» es `privado.es_equipo_boosty()`: admin o consultor y `profiles.organizacion = 'boosty'`.** No basta
  `es_editor()`: Alberto es administrador de Iberia. Lo usan las decisiones (todas `solo_equipo`), los pendientes internos y
  la nota de los hitos, que no sale por la API (privilegio por columna) sino por `control.notas_hitos()`. En la app,
  `esEquipoBoosty(sesion)` de `lib/plataforma/hoja-de-ruta.ts` (con «ver como», nada interno). ⚠️ Una consulta nueva a
  `hito_plataforma` nombra sus columnas: `select *` da `42501`.
- **Escribir pide `modulo:programa` · editar** (acción nueva de la matriz; de fábrica para Consultor; el nivel administrador
  ya lo puede todo) y va por columnas: estado de fase, estado y fecha de hito, resolver o reabrir un pendiente (la fecha la
  pone la base), la decisión de una G-xx y el **estado de un módulo** (de `control.modulo`, la API solo escribe `estado`:
  ruta y recurso deciden el menú). Todo con `control.auditar`.
- Lo lee Iberia: sin dinero (el script se detiene si un texto visible trae un monto), sin régimen contractual (P, P\*, E) y
  sin alarmas. `TablaDatos` acepta `envolver` en una columna de texto largo.
- `scripts/plataforma/mirar.mjs --como iberia` entra como administrador de la organización Iberia (como Alberto).

Lo de abajo sigue valiendo tal cual para Consumos (antes `/dashboard/programa`).

En el panel se llama **«Consumos y línea de tiempo»** («Consumos» en la barra) desde el 25 de
septiembre: «El programa» no decía qué había adentro.

La cláusula 8 del contrato obliga a dos cosas que no vivían en ninguna parte: una bolsa de
**107 horas al mes** administrada como promedio dentro de la fase, y un **reporte mensual
de consumo**. Este módulo es de donde sale ese reporte.

- **El calendario no es el de la propuesta, y es a propósito.** La propuesta pone el
  Documento de Arquitectura en el Mes 5 —enero—, pero el aviso de no renovación es de 30
  días sobre un plazo que vence el 6 de enero: **Iberia decide si sigue el 6 de diciembre**,
  un mes antes de recibir el instrumento para decidir. Todas las fechas de `VENCE` en
  `lib/programa.ts` están corridas para que el comité apruebe con el documento en la mano.
  **Y se corrieron otra vez: la entrega es el 21 de octubre de 2026**, acordada con Alberto.
  Levantamiento e inventario van dentro del documento y vencen con él. Al mover una fecha se
  cambian `VENCE` **y** el hito de `sembrar-programa.mjs`; como la idempotencia es por (fecha,
  título), la fila vieja queda viva y se borra con `sembrar:programa -- --limpiar`.
- **Los perfiles y las tarifas son términos firmados, no configuración.** Viven en
  `lib/programa.ts`, no en una tabla de ajustes. `BOLSA_MENSUAL` y `FEE_MENSUAL` se calculan
  de las cuotas: si cambia una, cambia el total, y nadie tiene que acordarse de dos sitios.
- **Se tarifa el perfil, no la persona.** La misma persona carga como perfiles distintos
  según lo que estuviera haciendo: conducir una entrevista es trabajo de consultor de
  procesos aunque la haga el director.
- **Las sesiones no se copian a `hitos`.** La vista `linea_de_tiempo` las lee de
  `entrevistas`, que ya tienen su fecha. Dos listas de lo mismo dicen cosas distintas en dos
  semanas. **Una formación sin grabación también va ahí**, como sesión `FOR-` en estado
  `realizada`: el entrenamiento de gerentes del 23 de septiembre es `FOR-003`.
- **«Lo que viene» es lo que no se ha hecho, no lo que tiene fecha futura.** Separando por
  fecha, una sesión programada que no ocurrió y un entregable vencido caían en «Lo hecho»
  —ENT-029 salía hecha con sus 60 minutos—. Lo vencido y sin hacer sale como «Pendiente»,
  en neutro. La vista da `previsto` a una sesión `programada`, y la página solo muestra la
  duración de lo que ocurrió.
- **El resumen de arriba es una línea por mes**, de `LO_QUE_TRAJO_EL_MES` en
  `lib/programa.ts`. **Al cargar las horas de un mes, se añade su línea.** Era un párrafo
  escrito en agosto que en septiembre seguía diciendo «el primer mes concentró el arranque».
- ⚠️ **Este módulo lo lee Iberia.** *(Cambió el 31 de agosto, por decisión de Gabriel. Antes
  decía «las horas son de editores»: `hitos` y `registros_horas` estaban cerrados a Boosty y
  el consumo se entregaba redactado en el reporte mensual. Un reporte llega una vez al mes;
  la pregunta «¿en qué están?» aparece cualquier martes.)* Escribir sigue siendo solo de
  editores: Iberia lee su programa, no lo carga.

  Que lo lea el cliente manda sobre cómo se escribe, y de ahí cuatro reglas:

  - **Nada de dinero en pantalla.** Ni tarifas, ni valor consumido, ni el fee. El precio está
    firmado; un contador de dólares corriendo no informa, negocia. `TARIFA` y `FEE_MENSUAL`
    viven en `lib/programa.ts` y se usan al escribir el reporte mensual.
  - **Nada de alarmas.** Las horas se promedian dentro de la fase (cláusula 8) y el riesgo de
    la implementación es de Boosty (cláusula 5): un mes por encima de la referencia es
    información, no un problema del cliente. Se muestra la cifra y se explica; no se pintan
    casillas en rojo ni se ponen múltiplos de la cuota. La marca «en riesgo» —que es juicio de
    seguimiento interno— solo la ve un editor.
  - **Lo interno va en `PENDIENTES.md`**, no en la descripción de un hito. Lo que falta por
    confirmar, quién debe qué y las estimaciones por revisar no se escriben ahí.
  - **El rótulo importa tanto como el dato.** `gestion` se llamaba «Dirección, gobierno y
    reportería» y con las 40 h del dashboard y las 16 del importador adentro el cliente leía
    90 horas de pura administración. Ahora es «Herramientas y dirección del programa» y lleva
    su nota. No se movió un solo registro.
- **Una partida no es una jornada.** Es un bloque de trabajo con la fecha en que se entregó:
  «el canal, 36 h» va en una sola fila. El tope de 160 h es cazafallos de tecleo, no un
  límite de negocio.
- **Lo que se cobra aparte no descuenta bolsa.** `imputacion` distingue `bolsa`, `fase_0`
  —la etapa anterior, cobrada en los USD 4.700—, `fase_2` —el curso de planta, que va por
  licenciamiento de USD 60— y `adicional`. Cargar en la bolsa algo que además se factura sería
  cobrarlo dos veces.
- ⚠️ **`fase_0` existe porque el corte por mes no alcanza.** El contrato se firmó el 6 de
  agosto, así que el deck de la sesión de lanzamiento y la negociación contractual —1.º y 3 de
  agosto— caen del lado de la Fase 1 por fecha aunque sean cierre de la etapa anterior. La
  imputación lo saca; la fecha no puede.
- **El cuadro de la pantalla es por mes *y por perfil*, con la cuota de cada uno.** Es el
  cuadro que define el contrato, y es lo que el cliente pidió ver: un total mensual solo no
  dice en qué mes se pasó un perfil y en cuál se quedó corto. La diferencia va **escrita** en
  la casilla —«+34», «−9»—, nunca pintada en rojo, y quien se pasa se distingue por
  seminegrita: forma, no tono.
- **Un solo registro de horas: `sembrar-horas.mjs`.** `sembrar-programa.mjs` siembra hitos y
  nada más. Los dos escribían en `registros_horas` con descripciones distintas para el mismo
  trabajo, así que la jornada del 20 de agosto entraba dos veces —5,42 h en uno y 10,5 h en
  el otro— y, con `--limpiar` de por medio, correrlos en un orden duplicaba y en el otro
  desaparecía.
- ⚠️ **La idempotencia va por (fecha, descripción) en las horas y por (fecha, título) en los
  hitos.** Cambiarle el texto **deja viva la fila vieja**: las horas se cuentan dos veces y
  el mismo hito sale dos veces con estados que se contradicen. Los dos scripts listan lo que
  está en la base y no en su archivo; `--limpiar` lo borra.
- 🔴 **Lo que se corrige en el panel hay que pasarlo al archivo antes de volver a correr
  `sembrar:horas`.** El 25 de septiembre la base tenía cuatro partidas de agosto corregidas
  desde el panel —el 26 partido en sala y traslado, tres con otra persona— que el archivo no
  conocía: correrlo habría metido 18 h de más y deshecho los cambios de persona. Ahora el
  script **no escribe si la base tiene partidas que él no conoce**; lista cuáles y pide
  pasarlas al archivo (o `--limpiar`, o `--forzar`).
- **En las formaciones, la sala va a `formacion` y la preparación y el traslado, a
  `gestion`.** Es como Gabriel partió el 26 de agosto, y así se cargó el 23 de septiembre.
- **Lo anterior a la firma no descuenta bolsa.** Es Fase 0, ya cobrada por USD 4.700 aparte.
  `consumeBolsa()` corta **por mes calendario**, no por día, porque el fee se factura así y
  una fila mensual que mezclara horas que cuentan con horas que no, no se podría leer.
  El script y la pantalla tienen que usar el mismo corte o el reporte dice dos cosas.

## El calendario (`/sistema/programa/calendario`)

Lo que viene después de la Fase 1, en un solo calendario: la **Fase 2 · Aliviar** (la línea
tecnológica, noviembre de 2026 a abril de 2027) y **New Iberia** (desarrollo organizacional y
procesos con el señor Carlos, hasta octubre de 2027). Desde el 28 de octubre de 2026.

- **Las actividades viven en `calendario_actividades`**, no en el código: Amanda coordina las
  agendas con cada área y las va marcando —estado, fecha confirmada y nota— sin pasar por un
  despliegue. El título, las fechas previstas y el responsable no se editan desde la página: son lo
  acordado con Iberia y con el señor Carlos, y se cambian en la base. Las 78 de partida salieron del
  HTML de Gabriel y están sembradas en la migración `calendario`.
- **El vocabulario está en `lib/calendario.ts`**: ocho frentes con su color —categorías, no la
  marca—, cuatro tipos y cinco estados. Las claves espejan los `CHECK` de la tabla. Los entregables y
  los hitos son los rombos de la línea de tiempo.
- **La casilla es `modulo:calendario`**, con ver y editar, y la RLS la oye: leer pide ver y
  actualizar pide editar. De fábrica la tiene el rol Consultor; los roles de Iberia, si se les marca.
- ⚠️ **Lo lee Alberto**, que es administrador: las reglas de Consumos valen aquí. Nada de dinero en
  pantalla, aunque las propuestas lo traigan, y lo interno va en `PENDIENTES.md`.
- «Hoy» se calcula en `America/Caracas` en el servidor y se le pasa a la vista.
- **La línea de tiempo se despliega por frente** (29 de octubre de 2026, Gabriel): tocar un frente abre
  debajo una pista por actividad, con su fecha, su estado y su responsable; pueden ir varios abiertos, y
  «Ver todos en detalle» los abre todos. La barra y el rombo son la misma pieza (`Marca`) en la fila del
  frente y en el detalle.
- **El calendario como documento para Iberia**: `npm run documento:calendario` lo lee de la base y deja
  el HTML en `documentos/`, y el PDF sale con `npm run documento -- <archivo> --vista`. Se genera, no se
  edita a mano: lo que cambie en el calendario cambia en la base y se vuelve a sacar. **La `nota` de cada
  actividad no sale**: es la coordinación interna de Amanda.

```
node --env-file=.env.local scripts/mirar-calendario.mjs --base http://localhost:3001
```

Actualiza una actividad desde la agenda, recarga y mira, la devuelve a como estaba —escribe en
producción, y la devuelve también si algo falla—, despliega la línea de tiempo por frente y entera, y
mide que en un iPhone 14 la página no se desborde, tampoco con un frente abierto.

## Los documentos para el cliente

Van en `documentos/`, en HTML con la identidad de Iberia, y el PDF sale con
`npm run documento -- <archivo.html> --vista`. La bandera deja además una vista previa en
PNG con los márgenes de impresión aplicados: **mirarla antes de entregar**, que Chromium en
headless no abre PDF y es la única forma de ver lo que el cliente va a ver.

⚠️ **Antes de escribir uno, leer los que ya se le mandaron.** Están en la misma carpeta. La
segunda versión del documento de la ronda 2 se rehízo entera porque la primera repetía el
contenido de la formación, los participantes y las condiciones del licenciamiento, que ya
estaban en el documento del 11 de agosto. Un documento que repite lo sabido entierra lo
nuevo.

## Las guías de entrevista

`npm run generar:guias` deja las tres en `documentos/guias/`. **No se editan a mano**: se
cambia `scripts/generar-guias.mjs` y se regeneran, igual que la marca y las fichas.

- **Caben en 60 minutos, y por eso llevan el minuto asignado a cada sección.** Las
  originales estimaban 90–150 y ninguna de las ocho entrevistas de la ronda 1 llegó a 90.
  Una guía que en la práctica se ejecuta al 40% no mide la entrevista, mide la guía.
- **Solo las preguntas, escritas para leerse en voz alta.** Sin explicación al lado: es la
  hoja de ruta del entrevistador, no un manual. El porqué de cada una vive acá y en la
  bitácora.
- **Si una pregunta se puede contestar con sí o con no, está mal escrita** — salvo el
  consentimiento y la ficha de números, donde el dato es el objetivo. El generador lo
  comprueba y avisa.
- **Cuatro secciones están marcadas «No se salta»** y son los cuatro huecos de la ronda 1:
  consentimiento de grabación (se pidió 1 de 8 veces), la ficha de números, la sonda de
  continuidad con el incidente de febrero, y el cierre con documentos y bola de nieve.
- **Adaptadas a Iberia**: fuera lo multi-país, el e-commerce y la «casa matriz de marca
  representada»; dentro las maquilas —Iberia *es* la casa matriz de las suyas—, el
  cumplimiento sanitario venezolano y el turno único.
- **No entregamos manual de procesos**, solo el Documento de Arquitectura. Pero el mapa de
  macroprocesos y sus N1 es su base, y si la Junta pide después los manuales, eso es otro
  proyecto con el levantamiento ya hecho. Va dicho dentro de las guías.

## El panel (`/dashboard`) — retirado el 20 de noviembre de 2026

Todo se mudó a la plataforma (ver «El programa»). Lo de abajo es historia: las reglas de cada módulo valen allá.

La barra tiene cinco grupos: **Levantamiento** (panel, entrevistas, archivos y «Consumos», que
es `/dashboard/programa`), **Fase 2 · New Iberia** (el calendario, desde el 28 de octubre de
2026), **Cursos** (adiestramiento, el padrón y el curso de Ajito, que abre en otra pestaña),
**El canal** (los reportes, desde el 6 de noviembre de 2026) y **Administración** (usuarios,
roles). Cada destino sale solo si la sesión
tiene su permiso (`destinosPermitidos()` en `app/dashboard/layout.tsx`).

- **«El canal» va en la cabecera**, a su izquierda, para quien tiene canal y ficha: ver «Roles y
  permisos».
- **«Ver el informe» va en la cabecera, no en la barra**: es el destino de todo el panel, y
  abajo del menú no se encontraba. Abre en otra pestaña, como el curso.
- ⚠️ **El panel no tiene módulo de hallazgos ni editor del informe** desde el 25 de septiembre
  de 2026 (decisión de Gabriel). Los hallazgos se leen en el informe, cada uno en su punto del
  circuito; el informe **se escribe en las sesiones de trabajo** y se carga con los scripts.
  Ver «El informe».

## Roles y permisos (`/dashboard/roles`)

Los roles se crean desde el panel, cada uno con una **matriz de ver, crear, editar y
eliminar** por módulo, por sección del informe y por lección del curso de Ajito, y se
asignan a cada usuario en `/dashboard/usuarios`. Tablas `roles` y `rol_permisos`;
`profiles.rol_id` dice cuál tiene cada quien.

- ⚠️ **El nivel es el techo y la matriz afina por debajo.** Cada rol tiene un `nivel`
  (`admin`, `consultor`, `lector`) que un trigger copia a `profiles.rol`, así que todas las
  políticas que ya preguntaban por `es_editor()` siguen valiendo. Un rol de nivel lectura
  solo puede ver; uno de nivel consultor no administra usuarios ni roles; **el nivel
  administrador lo puede todo y su matriz no se edita** — así nadie deja al programa sin
  quien lo administre desmarcando una casilla. La base rechaza guardar una casilla por
  encima del techo, y **nunca se queda sin un administrador activo** (trigger diferido).
- **Un recurso es `modulo:<clave>`, `informe:<slug>` o `leccion:<numero>`.** Los módulos
  están en `MODULOS` de `lib/permisos.ts` —una pantalla nueva del panel se añade ahí el
  mismo día—; las secciones y las lecciones salen de la base, así que una nueva aparece
  sola en la matriz. En los roles de fábrica entra con «ver» (triggers
  `informe_secciones_permisos` y `lecciones_permisos`); en uno creado desde el panel entra
  apagada. **Las secciones del informe solo tienen «ver»**: el panel no las edita.
- **Cada módulo declara solo las acciones que existen.** Una casilla que no hace nada es
  una mentira: sale como «no aplica». Empleados y Recordatorios **no tienen «ver» a
  secas**: leen vistas que solo le responden al equipo, así que se abren con «editar».
- **La regla vive dos veces y tiene que decir lo mismo**: `public.puede(recurso, accion)`
  en la base y `permite()` en `lib/permisos.ts`. En la app se pregunta con
  `puede(sesion, recurso, accion)` y se exige con `requerirPermiso(recurso, accion)`, que
  sirve igual en páginas y en acciones. `obtenerSesion()` trae el rol y la matriz de una
  vez (`mis_permisos()`) y va con `cache()`: layout y página la piden en la misma petición.
- **Dónde cierra la base y dónde la app.** La casilla entra en la RLS del informe
  (`informe_secciones`), del mapa (`macroprocesos` y `procesos`, con la casilla del mapa de
  procesos o la de las fichas, que marcan «No documentado» con ellas) y de las lecciones, que es lo que
  se abre a gente que no es del equipo. **Y en lo que Adiestramiento y Certificados leen**: el
  tablero `adiestramiento_avance` corre como su dueña y se cierra por dentro con la casilla de
  Adiestramiento —cuentas por área y por oficio, sin nombres ni respuestas—, y `certificados` se
  lee con la de Certificados. En el resto de módulos la matriz la aplica el servidor de la app,
  con el nivel como techo en la base.
- ⚠️ **Una casilla que la base no oye es una casilla que miente.** El 27 de septiembre de 2026
  el rol Marketing tenía Adiestramiento, Certificados y las nueve lecciones, y Martha Álvarez veía
  el tablero en cero, Certificados vacío y «este curso no es para tu nivel». El tablero corría con
  `security_invoker` —la RLS de `matriculas` solo le deja ver la suya a quien no es del
  equipo—, la política de certificados no miraba la casilla, y las lecciones pedían una matrícula
  que solo pone el equipo. **Al dar una casilla de lectura a un rol que no es del equipo, hay que
  comprobar con una cuenta de ese rol que la pantalla traiga datos**: `scripts/mirar-puertas.mjs
  --rol <clave>` lo hace con lo de Ajito.
- **Quien tiene lecciones en su rol se matricula solo**, con «Recorrer el curso» en el índice del
  curso (`matricularme()`, que comprueba la casilla en la base). La matrícula del padrón sigue
  siendo la de planta y administrativo; esta es para el resto —una gerente que revisa el curso—.
  El feed le muestra la tarjeta de Ajito, y el panel, «El curso de Ajito» en la barra.
- ⚠️ **Las pruebas crean a los trabajadores con el rol de un trabajador, Personal de planta**
  (`rol_clave: 'personal-planta'`). Con Lector Iberia —la dirección, que tiene Adiestramiento y
  Certificados— leen el tablero y los certificados de todos, y está bien que los lean.
- **Cuatro roles de fábrica**, que reproducen el acceso de antes: Administrador, Consultor
  Boosty, Lector Iberia y **Personal de planta** —el canal y las nueve lecciones, nada
  más—, que es el que se le da a quien entra con su enlace (`rol_clave` en los metadatos
  del alta). No se borran ni cambian de nivel.
- **A dónde va cada quien al entrar** lo decide `destinoInicial()`: el panel si lo tiene,
  si no el canal, si no su primera pantalla del panel, si no el informe, y si no
  `/sin-acceso`, que existe para que el panel no se redirija a sí mismo en bucle.
- ⚠️ **Tener módulos del panel no es tener su portada** (`modulo:panel`). El rol Marketing
  abre Adiestramiento y Certificados sin portada, y hasta el 27 de septiembre de 2026
  `/dashboard` lo devolvía al canal: sus módulos no se abrían desde ninguna parte.
  **`inicioDelPanel()`** da la primera pantalla que la sesión puede abrir —la lista
  `PANTALLAS_PANEL` de `lib/auth.ts`, con el mismo permiso que pide cada página: una pantalla
  nueva del panel se añade ahí el mismo día—; el canal lleva un botón «Panel» a ella, y
  `requerirPermiso` manda ahí a quien pide lo que no tiene. Del panel se vuelve con «El
  canal», en la cabecera, que sale a quien tiene canal y ficha del padrón. Los dos van en la
  misma pestaña: es una sola aplicación con dos caras. `scripts/mirar-puertas.mjs` recorre la
  ida y la vuelta con el rol que se le pida.

## El informe (`/informe`)

⚠️ **Se escribe en las sesiones de trabajo, no desde el panel.** El editor
(`/dashboard/informe`) se eliminó el 25 de septiembre de 2026, por decisión de Gabriel: la
prosa se redacta en el taller (`contenido/`), se revisa, y se carga en `informe_secciones` con
la clave de servicio. Publicar también es de sesión. Por eso la matriz solo le da «ver» a cada
sección, y la RLS de escritura queda de respaldo para el nivel administrador.

**La cáscara de lectura** (25 de septiembre de 2026). La hoja se centra con una medida de
lectura fija —840 px, texto a 16/17 px con 1,75 de interlineado— y a partir de 1400 px
sale a su lado el índice «En esta sección», pegado al hacer scroll y marcando dónde va el
lector; por debajo va plegado arriba del texto. En teléfono la hoja va de borde a borde y
el índice del documento se abre desde el botón de menú (`MenuMovil`, un `<dialog>`, el
mismo del panel). Antes la hoja iba pegada a la izquierda y a 1920 px dejaba 736 px vacíos.

- ⚠️ **Los ids del índice se calculan como los pinta `rehype-slug`**: un solo
  `GithubSlugger` para todo el documento y en orden (`lib/encabezados.ts`). Uno por
  encabezado da el mismo id a dos títulos iguales. La auditoría comprueba que cada enlace
  encuentre su destino: 750 revisados, 0 rotos.
- **Las partes del índice se pliegan** (9 de octubre de 2026): «Lo que encontramos», «Cómo
  funciona hoy» y «Qué proponemos»; la apertura, no. Arranca abierta la parte donde está el
  lector, y lo que se toque a mano manda (`IndiceInforme`).
- Las anclas se corren lo que mide la cabecera fija (`scroll-margin-top` en `.prosa`), y
  las tablas avisan con una sombra en el borde cuando se deslizan.
- **El índice marca con un icono las secciones con dibujo** (11 de octubre de 2026, Gabriel):
  `CON_DIBUJO` en `lib/informe-rutas.ts`. Una sección que estrene dibujo se añade ahí el mismo
  día; la página decide qué pinta con `CON_CIRCUITOS` y la plataforma aparte, y las dos listas
  tienen que decir lo mismo.

### El PDF de una sección (desde el 23 de noviembre de 2026)

«Descargar PDF», junto al título, en las secciones de `CON_PDF` (`app/informe/[slug]/page.tsx`: hoy la 10, 11, 12 y 13,
cada una con su propio PDF). Otra sección se suma agregando su slug ahí.

- **Lo arma el navegador, no el servidor**: Netlify no trae Chromium. El botón (`components/informe/descargar-pdf.tsx`)
  carga la misma sección en un iframe oculto de 1600 px con `?pdf=1`; ahí `GeneradorPdf` llama a `generarPdfSeccion()`
  (`lib/informe-pdf.ts`) y le devuelve el PDF por `postMessage`. Ancho a propósito: más angosto, el espejo de la 10
  (1080 px) sale con barra y cortado.
- **Se parte en bloques**: el encabezado, cada dibujo y cada pieza de la `.prosa`. Las tablas de más de 320 px van por
  filas y repiten su cabecera; un título no se queda al pie. Cada hoja toma el ancho de su bloque más ancho y se recorta
  a él, así que la prosa sale a su tamaño aunque el dibujo de arriba sea ancho.
- Lo que no va en el PDF lleva `data-pdf-omitir` (migas, índice plegado, flechas, el botón); un envoltorio que solo
  contiene bloques lleva `data-pdf-abrir`.
- ⚠️ **`html-to-image` no lleva el relleno de las clases de Tailwind en un SVG**: las cajas salían en negro.
  `fijarColoresSvg()` escribe en la copia los colores ya resueltos (`fill`, `stroke`, `stop-color`…). Un dibujo nuevo
  con otra propiedad visual se agrega a `PROPIEDADES_SVG`.
- El texto queda como imagen (no se selecciona); pesa de 3 a 6 MB por sección.
- Se verifica con `node --env-file=.env.local scripts/mirar-pdf-informe.mjs [--solo <slug>]`, que baja los PDF a
  `capturas/pdf-informe/`; las hojas se miran renderizándolas a PNG.

### El orden: primero lo que se encontró

**11 secciones en cuatro partes** (25 de septiembre de 2026, decisión de Gabriel):
**Apertura** (01 Inicio) → **Lo que encontramos** (02 Los hallazgos, en el circuito del
negocio) → **Cómo funciona hoy** (03 mapa, 04 fichas, 05 sistemas y estado del dato, 06
inventario, 07 riesgo, 08 trabas) → **Qué proponemos** (09 oportunidades, 10 arquitectura,
11 ruta). Un comité lee la conclusión primero y la evidencia después. «Los circuitos del
negocio» dejó de ser sección: su vista del flujo abre los hallazgos y la de sistemas abre
«Sistemas y estado del dato». La parte nueva es la clave `hallazgos` de
`informe_secciones.parte`; las otras conservan su clave y cambiaron de rótulo.

- **Los hallazgos van ubicados en el circuito**, no sueltos. La tabla `informe_hallazgos`
  dice de cada uno su patrón, su **nivel** (`critico`, `atencion`, `funciona`), el punto del
  flujo donde golpea (o ninguno, si es transversal) y el punto de sistemas relacionado. Se
  siembra con `sembrar:circuitos` desde el arreglo `hallazgos` del taller
  `contenido/circuitos/circuitos.json`. En el anillo cada punto lleva su cuenta —en rojo si
  alguno es crítico— y su ficha los lista con enlace a su tarjeta.
- ⚠️ **Los 42 hallazgos conservan su número**: `### H-NN · Título`. Las fichas de proceso los
  enlazan 64 veces por ancla, la portada enlaza a los siete `##` de patrón, y el circuito
  calcula el ancla de `informe_hallazgos.titulo`. **Cambiar un título rompe el enlace sin error
  visible**: se cambia en la sección, en el taller de los circuitos y en cada enlace que lo
  apunta, y se comprueba que ninguno quede roto. Los títulos y los patrones se reescribieron
  así el 11 de octubre de 2026.

### El tono: se documenta cómo se da el flujo

Desde el 11 de octubre de 2026, por pedido de Gabriel, **el informe se lee como la constancia
de un levantamiento, no como un relato de lo que anda mal**. Sin chisme. La guía completa, con
ejemplos, está en `contenido/informe/GUIA-TONO.md`. Lo esencial:

- **Se describe el flujo**: quién hace qué, con qué, en qué orden y qué efecto tiene en el
  paso siguiente. El efecto va como consecuencia observable, no como juicio. Los hallazgos
  se escriben con «Cómo se da», «En el circuito» y «Efecto».
- **Fuera los absolutos que no son un dato contado** («nunca», «nadie», «todo»), los remates
  y los coloquialismos («en la cabeza de», «a ojo»).
- **Anécdotas fuera**: un episodio que solo cuenta algo de personas —quién se fue, quién paga
  de su bolsillo, quién no se enteró, por qué se dio de baja algo— no va. La evidencia queda en
  el expediente. Lo de 2025 y 2026 es «el incidente de mayo de 2025» y «el de febrero de 2026»,
  con fecha y efecto, sin «entraron por donde avisó el primero».
- **Sin culpa**: se nombra el paso, no al área ni al proveedor responsable. Lo que Iberia ya
  tiene es base que se aprovecha, no un error.
- **`[Crítico]` es para pocos**: 9 de 42 desde el repaso; una historia o un riesgo de
  información sin efecto en la operación va en atención.
- **En la planta no se «quitan tareas repetitivas»**: para la nómina diaria su trabajo *es* la
  tarea repetitiva, y la frase se lee como amenaza (Carlos Quintana, `CONTEXTO_IBERIA.md` 13.2).
  Lo administrativo y de soporte libera tiempo; la producción gana **control y trazabilidad**.
- **El inventario tecnológico se nombra entero** —marcas, equipos, versiones—: no es reservado
  (Gabriel, 11 de octubre de 2026).
- ⚠️ **Seis secciones más salieron del generador** —hallazgos, sistemas y estado del dato,
  inventario, riesgo, trabas y oportunidades— y se escriben en Supabase, como la arquitectura y
  la ruta. Se
  reescribieron ordenadas y puntualizadas; la guía está en `contenido/informe-v2/GUIA.md`.

### Tarjetas, niveles y avisos

`lib/rehype-informe.ts` le enseña al markdown del informe cuatro cosas, con marcas que se
leen bien en el texto crudo:

- **`[Crítico]`, `[Atención]`, `[Funciona]`** al principio de un párrafo, una viñeta o una
  celda → una pastilla roja, ámbar o verde. El rojo se reserva para lo que frena el circuito
  o pone en riesgo la continuidad, el dinero o el cumplimiento: si todo va en rojo, nada lo es.
  Las oportunidades usan tres más, con los mismos colores y otro significado —**qué tan listo
  está el dato**—: `[Arranca ya]` en verde, `[Paso previo]` en ámbar, `[Falta el dato]` en rojo.
- **`> [!CLAVE]`, `> [!CRITICO]`, `> [!ATENCION]`** → un aviso con su rótulo. Uno por `##`
  como mucho.
- **Tarjetas**, en las secciones de `EN_TARJETAS` (las seis de arriba): cada `###` y lo que sigue hasta el próximo
  `###`, `##` o `---` va en una tarjeta con la barra del color de la etiqueta de su primera
  línea. ⚠️ Lo que se escribe después de la última tarjeta de un `##` cae **dentro** de ella:
  un cierre va tras un `---`.
- **La marca «No documentado»** en los procesos y macroprocesos que se hacen pero no figuraban
  en el inventario de partida, y **«Propuesto»** en lo que trae el programa. Se pone al pintar
  con el dato de `macroprocesos.nuevo` y `procesos.estado` (`NUEVO` y `PROPUESTO`) —el texto
  del generador no se toca— y en todo `**no documentado**` o `**propuesto**` suelto.
  ⚠️ **Decía «Nuevo» hasta el 25 de septiembre de 2026**, y el equipo lo cambió: un proceso que
  se hace desde hace años no es nuevo, es que nadie lo escribió, y «nuevo» le hacía creer a la
  dirección que el levantamiento lo había inventado. La base conserva `nuevo` y `NUEVO`; cambió
  el rótulo. `PROPUESTO` lo lleva hoy un solo proceso, la gestión de la transformación y adopción
  tecnológica; si `sembrar:procesos` corre con un taller que diga `NUEVO`, lo devuelve.

⚠️ **Va después de `rehype-slug`**: los ids ya están puestos cuando se envuelve en tarjetas,
así que las anclas no cambian.

### La carga visible

Cada ruta del panel y del informe tiene su `loading.tsx` con un esqueleto de su forma
(`components/esqueletos.tsx`): Next lo pinta al instante del clic, porque el layout queda y
solo cambia lo de adentro. Sin eso, un clic en el menú no hacía nada visible durante medio
segundo o más y parecía perdido. Además, `IndicadorEnlace` —con `useLinkStatus`— pone un giro
en el enlace pulsado mientras la ruta no se ha precargado. **Una pantalla nueva lleva su
`loading.tsx`**, o su clic vuelve a parecer muerto.

### Las fichas de proceso

- **Van a 1080 px, no a la medida de lectura**: son material de consulta —tablas y rótulos— y
  con tres niveles de plegado a 840 el texto quedaba en 650 px.
- **El subíndice de la barra arranca desplegado**, y el salto a una ficha **cae en su barra
  plegable**, no en el `###` de adentro, que la dejaba escondida arriba (`revelarAncla`).

Antes del 25 de septiembre eran **12 secciones**. El armazón se comprimió de 15 a 12 el 18 de
septiembre de 2026, y cada fusión tiene su razón:

- **«Inicio»** sustituye al resumen ejecutivo y absorbe «Cobertura del levantamiento». No es un
  resumen: es una portada —de qué va el encargo, cuánto se cubrió y cuál es el mapa—. Un
  documento que se resume a sí mismo en la primera página invita a no leer el resto, y la
  síntesis envejece cada vez que cambia un capítulo sin que nadie se acuerde.
- **«Las cifras del levantamiento» se disolvió.** Sus once grupos se reparten: nueve a la ficha
  del macroproceso que miden, el tamaño del negocio a «Inicio» y el incidente de febrero a
  «Riesgo y continuidad». **Las seis discrepancias van a «Sistemas y estado del dato»**, no a
  una ficha: comparan dos áreas dando números distintos, y la comparación *es* el hallazgo.
  ⚠️ El destino de cada grupo se **escribe** en el taller (`macro`, `sueltos`), no se deduce
  del texto: adivinarlo pondría cifras en la ficha equivocada.
- **«Inventario de trabas» se fundió en «Dónde se traba el trabajo»** —que desde el 11 de
  octubre de 2026 se llama «Dónde espera el flujo», con el slug `trabas` de siempre—, condensado: quedan el
  cuadro de carga por área y el reparto por tipo, y se fueron las 25 tablas con las 149 trabas
  una por una. El detalle ya vive en la ficha del proceso, que es donde se busca.
- ⚠️ **Quitar una sección renumera todas las de abajo.** Por eso las referencias van como
  `{cap:slug}` y el generador **avisa y falla** si una apunta a un capítulo que ya no existe —
  lo cazó tres veces ese mismo día.

- ⚠️ **Desde el 9 de octubre de 2026 ninguna sección se genera: las once se escriben en
  Supabase.** `GENERADAS` quedó vacío. Inicio, mapa y fichas salían del taller de Jesús Planas,
  que no quedó en esta máquina, y Gabriel decidió terminar el informe aquí. El generador solo
  pone título, número y orden. Para corregir una sección:

  ```
  npm run respaldar:informe              # antes de nada: subir pisa la base
  npm run secciones -- --bajar           # la base → contenido/informe/secciones/<slug>.md
  # editar el archivo
  npm run secciones -- --subir --revisar # cuáles cambiaron
  npm run secciones -- --subir
  ```

  `contenido/` está fuera de git: el texto del informe vive en la base y en sus respaldos.
- **El informe está publicado** desde el 9 de octubre de 2026, por decisión de Gabriel, para la
  entrega del 21. *(Hasta ese día la regla era no publicar nada mientras los hallazgos que lo
  sostienen siguieran en `propuesto`: se publicó con 2 de 394 validados.)* Lo ve quien tenga la
  casilla de cada sección: hoy, el nivel administrador y el equipo de Boosty.
- 🔴 **El informe va sin citas, sin códigos de sesión y sin nombres.** Decisión del cliente
  del 18 de septiembre de 2026, hablada con Gabriel. *(Sustituye a la norma anterior —«se cita
  por nombre, el informe nombra a quien lo dijo»—, que estuvo vigente hasta ese día.)* El
  documento se sostiene en la autoría del equipo consultor, no en un aparato de referencias.
  - El interruptor es **`SIN_CODIGOS` en `estructura-informe.mjs`**, y es un interruptor de
    verdad: los pares (sesión, hallazgo) siguen intactos en el taller y en la base, así que
    ponerlo en `false` y regenerar devuelve el informe con referencias. **Nada se borra en el
    origen.**
  - **La trazabilidad no se pierde, cambia de sitio.** `npm run expediente` deja en `Insumos/`
    —fuera de git— el dossier con cada hallazgo, su sesión, quién lo dijo, su cargo y la cita
    literal. ⚠️ **Ese archivo pasa a ser el único puente entre el informe y su evidencia**, así
    que va dentro del respaldo y **no se comparte con el cliente**.
  - ⚠️ «Sin cita textual no hay hallazgo» **sigue en pie**: la cita se exige al cosechar y se
    guarda en `hallazgos.cita_textual`. Lo que cambió es que no se imprime.
- **«El mapa de procesos» es el mapa interactivo** (`/informe/mapa-interactivo`). Hasta el
  25 de septiembre era una página de texto con un botón al mapa, y el texto decía lo mismo que
  las fichas. Ahora `/informe/mapa-procesos` redirige al mapa, y **todo enlace a una sección
  pasa por `rutaDeSeccion()`** (`lib/informe-rutas.ts`): el índice, la portada y las flechas.
  La página del mapa se viste de sección —miga con su parte y su número, anterior y
  siguiente— y se ve con la casilla de `informe:mapa-procesos`; el recurso aparte
  `informe:mapa-interactivo` se fue.
  - ⚠️ **La fila `mapa-procesos` sigue en la base y el generador le sigue escribiendo
    texto**, aunque ya no se pinte: sin contenido la sección no es visible para el lector, y
    con ella se iría el mapa. Conserva además el número y el sitio en el índice.

  Tres cosas del mapa que conviene no redescubrir:
  - **El inventario está en la base** —`macroprocesos` y `procesos`, con RLS—, sembrado
    desde el taller con `sembrar:procesos`. Tenía que estar: `contenido/*` está fuera de
    git por el NDA, así que leer el JSON del disco daría una página que funciona en local
    y sale vacía al desplegar; un módulo generado iría a un repositorio público; y
    `public/` se sirve sin sesión. **El taller sigue mandando**: cada siembra pisa.
  - **No hay ancla por proceso**, porque los procesos son filas de una tabla y
    `rehype-slug` solo trabaja sobre encabezados. El enlace va a la ficha del macroproceso
    **más `?proceso=`**, y la página de fichas busca la fila por texto y la resalta. Si no
    la encuentra no avisa: el lector se queda en la ficha, que es a donde iba igual.
  - **El ancla se calcula con el mismo `github-slugger` que el generador.** Construirla a
    mano dejaría los veinte enlaces apuntando a la nada, y sin error visible.
  - ⚠️ **Es el inventario entero de procesos**: se abre solo si la sección del mapa de
    procesos está al alcance de quien lo pide —su casilla y, para quien no escribe,
    publicada—. Hasta el 25 de septiembre lo abría cualquiera con sesión.

### La parte de arquitectura: el sistema Iberia

Rehecha el 24 de septiembre de 2026, con Gabriel, y desde el 25 es «Qué proponemos»: **09 Las
oportunidades → 10 La arquitectura de IA: el sistema Iberia → 11 La ruta de construcción.** Desde el
20 de octubre la 09 se llama «Lo que proponemos: tres líneas de intervención» y abre con
`TresLineasIberia` —desarrollo organizacional, procesos y marcos de referencia, y el dibujo del proceso
hoy y con la IA—; sus encabezados entran al índice antes que los del markdown
(`ENCABEZADOS_TRES_LINEAS`). El markdown solo trae «Tecnología», que lleva a la 10: las 33 tarjetas
de oportunidades se quitaron el mismo 20 de octubre (quedan en el respaldo de ese día). Y la 09 **cierra
con el cronograma de la Nueva Iberia** (`components/gantt-nueva-iberia.tsx`): las tres vías de octubre de
2026 a octubre de 2027, la tecnología primero, con un botón para verlo en pantalla. Sus fechas salen de
las propuestas de octubre (Fase 2 · Aliviar y New Iberia) y se dicen tentativas. ⚠️ No va en la 11, que
dice que la ruta no lleva fechas. Su encabezado para el índice vive en `lib/nueva-iberia.ts`: lo que
exporta un módulo `'use client'` le llega a la página del servidor como referencia, no como arreglo.
*(Hasta el 25 la abría «Los circuitos del negocio», que se fundió en los hallazgos y en
«Sistemas y estado del dato».)*

- **La arquitectura es una decisión, no un catálogo de capas.** JD se queda como **registro
  contable y fiscal**, y delante va el **sistema Iberia: un espejo de JD** que *obtiene* —una
  capa de actualización continua lee la base sin tocar el ERP—, donde se *trabaja* —captura,
  flujos, planificación, conciliación, tableros, IA— y que *postea* en JD lo que tiene
  consecuencia contable, **por el Orchestrator, como EXA**. La explosión de materiales corre en
  el espejo, leyendo fórmulas e inventario de JD. Si el espejo se cae, JD sigue facturando.
- **Es la recomendación de los consultores y nombra productos concretos**, con licencias a
  nombre de Iberia y **sin costos**. Tecnología confirma cada pieza en el paso 0.
- **«Dónde no va la IA» salió como sección.** Lo que prometía —decir dónde interviene la IA y
  dónde no— lo dice ahora cada módulo, capacidad por capacidad: **21 de 51 son IA**. *(Eran 17 de
  47 hasta que las cuatro oportunidades de IA que no cabían entraron a su módulo, el 25 de
  septiembre; las tres que esperan un dato lo dicen en la nota del módulo.)* Vender como
  IA un formulario bien hecho es lo que cuesta la credibilidad el día de la demostración.
- **Qué aprueba el comité** vive en «La ruta de construcción»: la cláusula 7 hace de este
  documento la condición para pasar a Fase 2. La Fase 2 que se recomienda es **el paso 0 y los
  módulos de Compras, Comercial y Finanzas**; la ruta va por fases y dependencias, sin fechas.
- ⚠️ **Se construye por fases, no por olas** (9 de octubre de 2026, Gabriel): lo que era la ola
  1 es la **Fase 2**, la ola 2 la **Fase 3** y la ola 3 la **Fase 4** —el plan de fases 2 a 4
  que pide el contrato—. El paso 0 es el primer paso de la Fase 2. **Las claves en la base
  siguen siendo las viejas** —`informe_modulos.ola` en `base/1/2/3` y
  `informe_circuito_puntos.fase` en `2/3/sin`, con planta en `3` y distribución en `sin`— porque
  las restringe un `check`; los rótulos que se ven salen de `FASE` y `OLA` en
  `components/circuitos-informe.tsx`.
- **El documento técnico va dentro del informe** (9 de octubre de 2026, Gabriel), en «Qué
  proponemos», entre la arquitectura y la ruta: `plataforma` (abre con el triángulo,
  `components/plataforma-iberia.tsx`, que la página pinta por slug), `seguridad-operacion`,
  `ia-en-el-sistema` y `fichas-tecnicas`. Al final va `politica-ia`, la política de adopción de
  IA en borrador, escrita desde Iberia. El brief con las decisiones está en
  `contenido/informe/BRIEF-TECNICO.md`.
  - **Los perímetros sensibles son cuatro**, y los mismos en «Seguridad», «La IA dentro del
    sistema», la arquitectura y la política: investigaciones de Prevención y Control de
    Pérdidas, servicio médico, nómina y fórmulas. Abrir uno lo pide su dueño, lo evalúa
    Tecnología y lo aprueba el comité. Los datos personales y las credenciales son restringidos
    en la política, pero no son perímetros. Hasta el 11 de octubre de 2026 eran tres, cinco o
    seis según la sección.
  - 🔴 **Todo vive en la nube.** El espejo es un proyecto de Supabase a nombre de Iberia; no se
    ofrece la variante en servidores de la planta. Dentro de la planta solo va **el conector**,
    que lee DB2, postea por el Orchestrator y **solo abre conexiones hacia afuera**: empuja lo
    leído y va a buscar la cola de posteo.
  - **El informe lo leen los directivos.** El rol «Dirección Iberia» (`direccion-iberia`, nivel
    lector) lee las dieciséis secciones y nada más; las cuentas se crean cuando Alberto diga
    quiénes. Una sección nueva le entra apagada: hay que marcarla en Roles y permisos.
- **«La Fase 2, por dentro»**, en la arquitectura: para Compras, Comercial y Finanzas, qué lee de
  JD (con los objetos estándar de JD Edwards, que Tecnología confirma en el paso 0), qué postea
  por el Orchestrator, dónde va la IA y los cinco documentos que deja cada módulo.
- ⚠️ **`arquitectura-ia` y `hoja-de-ruta` se escriben en Supabase, no en el
  generador.** No están en `GENERADAS`: el script solo les pone título, número y orden. Su
  prosa se redactó en `contenido/circuitos/secciones/*.md` y se cargó una vez; desde ahí se
  corrige en la base. **Todo lo que el informe documenta tiene que existir en la base**, no
  solo en el código ni en un archivo local.
- **Los dibujos salen de cuatro tablas**, con RLS: `informe_circuito_puntos` (12 puntos del
  flujo y 15 de sistemas), `informe_modulos` (los nueve módulos del espejo),
  `informe_circuito_textos` e `informe_hallazgos` (cada hallazgo en su punto). Se siembran desde `contenido/circuitos/circuitos.json` con
  **`sembrar:circuitos`**, que comprueba la coherencia del taller antes de escribir y borra lo
  que ya no está en él: **el taller manda**, como en `sembrar:procesos`.
  `components/circuitos-informe.tsx` solo guarda geometría, porque el repositorio es público.
- **Los dos dibujos se enlazan entre sí.** Un punto dice qué módulo lo atiende
  (`/informe/arquitectura-ia?modulo=M4#espejo`) y un módulo, qué puntos destapa
  (`/informe/hallazgos?punto=T2#circuitos` para el flujo, `/informe/sistemas-datos?punto=S3#circuitos`
  para los sistemas). La página los pinta por slug (`CON_CIRCUITOS`),
  por lo mismo que `PLEGABLES`, y **solo el dibujo va ancho**: a todo el ancho, la prosa salía
  a 150 caracteres por línea.
- ⚠️ **Un tipo de destape nuevo necesita su rótulo en `DESTAPE`**, o sale como etiqueta vacía
  sin error. `sembrar:circuitos` falla si falta.
- **Cada estación del flujo lleva el área que la ejecuta** (`textos.flujo.areas` del taller, en
  el orden de `EST_TOP` y `EST_BOT`). Son nombres de Iberia, así que van en la base y no en el
  código. Arriba del anillo el área va **encima** del nombre: debajo la tapaban las burbujas que
  cuentan los hallazgos de cada trombo. `mirar-reunion` mide que no se pisen.
- **La numeración de los trombos sigue el flujo**, y si un número queda fuera de orden se mueve
  el trombo, no el número: la tabla de puntos de «Los hallazgos» y la prosa citan los números.
- **La ficha de un punto o de un módulo se abre en un panel a la derecha** (`Cajon`, 25 de
  septiembre de 2026), no debajo del dibujo: debajo había que bajar a leerla y perder el
  circuito de vista. Tres decisiones:
  - **No es un modal.** No hay velo: tocar otro trombo cambia la ficha sin cerrarla, y las
    flechas recorren los puntos que deja ver el filtro. Arranca cerrado, salvo que se llegue
    con `?punto=` o `?modulo=`. Se cierra con la ✕ o con Esc.
  - ⚠️ **En pantalla ancha le hace sitio a la página, no la tapa.** Tapando, la mitad derecha
    del circuito —y sus trombos— quedaba debajo. Con el panel abierto, `html.con-cajon`
    retira el índice del informe a la izquierda, corre el contenido y le quita al dibujo su
    ancho mínimo, así que se encoge hasta caber entero. `mirar-cajon` mide que ningún trombo
    quede debajo del panel a 1440 y a 1920.
  - **Va por portal al `body`**, y por eso los colores del circuito están también en
    `.circ-vars`: fuera de `.circ` el panel perdía el rojo y el oro.
  - `Lienzo` mide su marco con `ResizeObserver`, no la ventana: al abrir el panel el marco
    se encoge sin que la ventana cambie, y el aviso de «desliza de lado» se quedaba puesto.
- **`respaldar:informe` guarda también las tablas y el taller de los circuitos**, que no
  está en git.

## Los hallazgos

Los siete tipos de `hallazgos.tipo` **no son una taxonomía cualquiera**: son el bloque
«bajo el capó» que la propuesta promete para el Documento de Arquitectura. `cuello_botella`,
`trabajo_manual` y `dato_disponible` son lo que la IA *lee*; `oportunidad_ia` es lo que
*decide*; `supuesto` es lo que *marca* para que lo valide la dirección. `sistema` alimenta
el inventario y `riesgo` la sección de supuestos y riesgos.

- **Todo entra como `propuesto`.** Un hallazgo propuesto no es un hallazgo: es un candidato
  con su cita, hasta que alguien que estuvo en la entrevista lo valida o lo descarta.
- **Sin cita textual no hay hallazgo.** Es lo que permite defenderlo delante del comité y lo
  que evita que el informe diga cosas que nadie dijo.
- **El área se hereda de la entrevista**, no se pide en el archivo.
- **Recargar no pisa el estado.** Si alguien ya validó o descartó, eso manda.
- ⚠️ **Una entrevista sin consentimiento de grabación no se cosecha.** Los archivos con
  `en-espera` en el nombre quedan fuera de la carga a propósito.
- **El catálogo no tiene pantalla** desde el 25 de septiembre de 2026: lo que se lee son los 42
  del informe, en su circuito (`informe_hallazgos`). La tabla `hallazgos` se queda —es la que
  guarda la cita de cada uno y de la que sale el expediente—, y validar o descartar pasa a ser
  trabajo de sesión, sobre el expediente.

## El levantamiento (`/sistema/programa/levantamiento`)

Las transcripciones se cargan con **`importar:transcripciones`**, no por la interfaz. El
importador de la interfaz sirve para una suelta, pero deja los hablantes como los nombró
Fireflies —«speaker 2»—, y **sin nombre lo que se dijo no se puede citar en el informe**.

- **El mapa de hablantes vive en el script, como datos**, con la evidencia anotada al
  lado: la frase donde alguien se presenta o donde lo llaman por su nombre. Eso es lo que
  permite revisarlo sin volver a oír hora y media de audio.
- **Fireflies renumera en cada grabación.** No se puede asumir que el primero es el
  entrevistador: en `ENT-006`, de las cuatro que hizo Ruth, es `speaker 2` quien se
  presenta. Se busca el nombre dentro del texto; no se deduce de quién habla más.
- **Al que no se identifica no se le inventa nombre**: se conserva la etiqueta cruda y el
  script la lista al terminar. `perfilar-hablantes.mjs` muestra los indicios de cada uno.
- ⚠️ **El rótulo del archivo no es el contenido: hay que leer el primer minuto antes de
  darle un código.** `Entrevista-Beatriz-Parte-2` no era la parte 2 de Beatriz, era la sesión
  de Compras con otras dos personas, y se daba por no hecha. Se cazó en la primera línea:
  «lo primero que necesito es que **ustedes** me digan sus nombres».
- **El padrón manda sobre cómo se escribe un nombre y cuál es el cargo.** Fireflies
  transcribe por sonido —«Paola Mancillo», «Glaciar Caño», «Juan Pablo Yepes»— y las 276
  fichas de Capital Humano son el dato. Se anota la ficha en las notas de la persona, que es
  lo que permite volver a comprobarlo. `corregir-nombre.mjs` arregla los que ya entraron mal:
  reatribuye los turnos, no solo la ficha.
- **Las series están separadas a propósito**: `ENT-` cuenta contra las ~25 que compromete
  la cláusula 5; `SES-` son reuniones y recorridos; `FOR-` son formaciones. Meter una
  formación como `ENT-` infla el avance contra la meta.
- Los archivos van a `contenido/transcripciones/`, que está fuera de git: es material bajo
  NDA.

**Las claves son las nuevas, nunca los JWT antiguos.** `sb_publishable_…` y `sb_secret_…`,
en `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` y `SUPABASE_SECRET_KEY`. Las de `anon` y
`service_role` que empiezan por `eyJ` están apagadas en el proyecto: una clave vieja
funciona perfectamente hasta el minuto en que la apagan, así que esto se comprueba por el
formato y no por que responda. `probar:supabase` falla si alguien vuelve a meter una.

**`probar:supabase` no comprueba que el código compile, sino que lo que el código da por
hecho existe en el proyecto real.** Son dos cosas distintas y se separan solas el día del
despliegue. Mira que las tablas, vistas, columnas y funciones estén; que **la RLS cierre
de verdad** —pidiendo cada tabla con la clave pública y sin sesión, no preguntando por el
flag—; que los tres buckets sean privados y tengan dentro los 70 audios de cada voz y las 10 fichas;
y que no queden fichas ni cuentas de prueba en el padrón, que las verificaciones corren
contra producción.

Las migraciones se aplican con el CLI, que ya está enlazado al proyecto:

```
npx supabase db push
npx supabase gen types typescript --project-id <ref> --schema public > lib/database.types.ts
```
