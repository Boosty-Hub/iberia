# Desplegar

**Desplegado desde el 25 de septiembre de 2026** en Netlify:
**https://iberiavenezuela.netlify.app**. La base es el proyecto real de Supabase, con las
migraciones aplicadas y los buckets con los audios y las fichas.

| | |
|---|---|
| **Cuenta** | **Industrias Iberia** en Netlify, plan Pro — no una personal ni de Boosty. El token está en `.env.local` como `TOKEN_ACCESS_NETLIFY` |
| **Sitio** | `iberiavenezuela`, conectado a `Boosty-Hub/iberia`, rama `main`. **Cada push a `main` despliega solo**, con `@netlify/plugin-nextjs` |
| **Región de las funciones** | **`us-east-1`, la misma de Supabase.** Venía en `us-east-2`. Cada página encadena de 4 a 8 consultas a la base; en otra región la app es lenta por geografía y no por código |
| **Acceso** | **Público.** El sitio tenía el login de equipo de Netlify activo y respondía 401 a cualquiera que no fuera miembro de la cuenta; se quitó. La app pide su propio inicio de sesión y la RLS cierra la base. ⚠️ La cuenta sigue con ese login como valor de fábrica para los sitios **nuevos** |
| **Dominio** | Todavía el de Netlify. ⚠️ **Los ~200 enlaces personales llevan el dominio dentro**: cambiarlo después obliga a volver a acuñarlos y mandarlos. Elegir el definitivo antes del primer envío, y al cambiarlo, cambiar `NEXT_PUBLIC_SITE_URL` y las URLs de Supabase. ⚠️ **Y la app de iPhone lo lleva compilado** (`server.url` de `capacitor.config.ts`, desde el 23 de octubre de 2026): cambiarlo es publicar otra versión de la app |

---

## Las variables de entorno

Cargadas en Netlify el 25 de septiembre. **Las secretas van marcadas como secretas y solo en
el contexto de producción**: el repositorio es público, y una vista previa la puede disparar
un PR de afuera.

| Variable | Contexto | Para qué |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | todos | La base |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | todos | La clave pública |
| `NEXT_PUBLIC_SITE_URL` | todos | `https://iberiavenezuela.netlify.app`. **No es cosmética**: con ella se arman los enlaces personales y el del curso en los recordatorios. *(Los redirects de `/entrar` no dependen de ella: van al origen de la petición.)* |
| `SUPABASE_SECRET_KEY` | producción · secreta | Bypasea RLS; solo provisiona usuarios y acuña sesiones desde `/entrar/[token]` |
| `ANTHROPIC_API_KEY_SALDO` | producción · secreta | Las devoluciones de Ajito. `lib/clave-anthropic.ts` la prefiere; la otra, `ANTHROPIC_API_KEY`, no se subió |
| `AZURE_SPEECH_REGION` | todos | `westus3` |
| `OPENAI_API_KEY` | producción · secreta | Los dibujos de Ajito en la lección 4 (`gpt-image-2.5-flare`) y los ejemplos que dibuja `generar:ejemplos`. De la cuenta de OpenAI de Iberia, con la organización verificada —sin eso los modelos de imagen no responden—. Subida el 27 de septiembre. Sin ella, los dos ejercicios de dibujo no dibujan y sale el botón de reintentar |
| `AZURE_SPEECH_KEY` | producción · secreta | La voz de Ajito, las devoluciones habladas y la transcripción de las notas de voz. Subida el 26 de septiembre, cuando la suscripción de Azure pasó a pago por uso: devolvía 401 porque la prueba gratuita había vencido, no por la clave. Quedó visible en una captura: regenerarla es opcional, y si se hace, va en `.env.local` y en Netlify y se vuelve a desplegar |

### El asistente de IA — ⚠️ todavía sin cargar (rama `asistente/fase-1`)

| Variable | Contexto | Para qué |
|---|---|---|
| `ASISTENTE_SECRETO` | producción · secreta | El secreto entre la acción que dispara un turno y la función de fondo `asistente-turno-background`. 32 bytes al azar, en hexadecimal; el de `.env.local` sirve para local |
| `ASISTENTE_EJECUTOR` | producción | `netlify`: los turnos van a la función de fondo (hasta 15 min). Sin ella, `lanzarTurno()` lo deduce de las variables de Netlify |
| `MICROSOFT_CLAVE_PRIVADA` | producción · secreta | La llave privada del certificado con que la plataforma se autentica ante la app de Iberia en Entra (fase 7). En `.env.local` la dejó `certificado-microsoft.mjs`; vence el 25-nov-2028 |
| `MICROSOFT_CERTIFICADO` | producción | El certificado público (.cer en base64), para la huella. No es secreto |
| `ASISTENTE_LOCAL_CLAVE` | producción · secreta, opcional | La clave del servidor de modelos de Iberia (fase 6), si la pide |
| `ASISTENTE_MS_LOGIN_URL`, `ASISTENTE_GRAPH_URL` | — (🔴 nunca en Netlify) | Solo para la prueba de la fase 7 (el simulador local) |
| `ASISTENTE_TRAMO_MS` | — (no se carga) | Solo para probar: el tramo tras el que un turno largo guarda su estado y sigue en otra invocación. En Netlify vale 12 min sin la variable |
| `ASISTENTE_CORREO_DESVIO` | — (🔴 nunca en Netlify) | Solo para el dev de pruebas: manda todo correo de las tareas a esa dirección (`delivered@resend.dev`, la casilla de prueba de Resend) |

Usa además `ANTHROPIC_API_KEY_SALDO`, `OPENAI_API_KEY`, `RESEND_API_KEY` y `SUPABASE_SECRET_KEY`, que ya están.
**El reloj de las tareas programadas (fase 5)** no es una variable: es un trabajo de pg_cron que se monta una vez con
`node --env-file=.env.local scripts/asistente/montar-programador.mjs --destino produccion --confirmo` (guarda
`ASISTENTE_SECRETO` en Vault y llama cada minuto a `/api/asistente/programador`; tiene que ser **el mismo** secreto que el de
Netlify). El remitente del correo se pone en Administración › Asistente de IA › Motor cuando Resend verifique el dominio de Iberia. ⚠️ El límite global por
archivo de Storage del proyecto tiene que subir a 100 MB (hoy 50 MB): el bucket `asistente` admite 100 MB.

### Los avisos de la app de iOS — ⚠️ todavía sin cargar

Las cuatro van **solo en producción**: una vista previa usa la misma base, y con ellas les
mandaría avisos de verdad a los teléfonos de verdad. Sin ellas la app funciona igual y no avisa:
el registro dice una vez cuáles faltan. Cómo funcionan los avisos, en `AGENTS.md` («Lo nativo:
avisos y enlaces»).

| Variable | Contexto | Para qué |
|---|---|---|
| `APNS_KEY_P8` | producción · secreta | La clave de APNs del equipo de Apple, `AuthKey_9QWXFT269C.p8` (en la máquina de Santiago), **en base64 y en una sola línea**. En PowerShell: `[Convert]::ToBase64String([IO.File]::ReadAllBytes('<ruta>\AuthKey_9QWXFT269C.p8'))` |
| `APNS_KEY_ID` | producción | `9QWXFT269C`, el id de esa clave |
| `APNS_TEAM_ID` | producción | `45TRWF6998` |
| `APNS_BUNDLE_ID` | producción | `com.industriasiberia.canal`. ⚠️ Si no es el de la app, Apple contesta `DeviceTokenNotForTopic` y no llega nada |

Antes de cargarlas, `npm run probar:apns -- <ruta>\AuthKey_9QWXFT269C.p8` comprueba la clave
contra Apple sin avisarle a nadie: tiene que contestar **400 `BadDeviceToken`**. El 23 de octubre
contestó eso.

**Lo que no se sube**: `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`, `SUPABASE_ORG_ID`,
`SUPABASE_PROJECT_REF`, `AZURE_SPEECH_RESOURCE` y `TOKEN_ACCESS_NETLIFY` son de las
herramientas, no de la app.

⚠️ **Las `NEXT_PUBLIC_` se meten en el código al compilar.** Cambiar una en Netlify no hace
nada hasta el próximo despliegue.

---

## Supabase

- **Authentication → URL Configuration**: *Site URL* es el dominio de Netlify, y las
  *Redirect URLs* lo incluyen junto con `localhost:3000` y `localhost:3001` para trabajar en
  local. Si cambia el dominio, se cambia aquí.
- 🔴 **El registro público está cerrado** (`disable_signup`). Estaba abierto, y
  `handle_new_user` toma el rol de los metadatos del alta: con la clave pública —que va en el
  JavaScript del sitio— cualquiera se creaba una cuenta de administrador. Se cerró antes de
  abrir el sitio; no había ninguna cuenta ajena. Las altas del código pasan todas por la API
  de administrador, que no depende del registro. `probar:supabase` falla si se vuelve a abrir.
- ⚠️ **La migración `20261103120000_dispositivos.sql` está sin aplicar** (23 de octubre): la
  tabla de los teléfonos y las funciones de los avisos de la app. Se aplica con
  `npx supabase db push` desde una máquina con el CLI enlazado, y después se regeneran los tipos
  (`lib/database.types.ts` se escribió a mano para que cuadre). El código desplegado antes de
  aplicarla no se rompe: el alta del teléfono falla en silencio y no sale ningún aviso.
  `probar:supabase` la busca.

---

## Lo que falta, en este orden

1. **Comprobar `/entrar` de punta a punta** con una persona de prueba: acuñar su enlace desde
   `/dashboard/empleados`, abrirlo en un teléfono de verdad y ver que entra sin clave. Es la
   puerta de las 200 personas; si falla, no falla para una.
2. **Las verificaciones contra producción**, apuntando `BASE_URL` al dominio. `capturar` ya
   pasó el 25 de septiembre: 14 páginas, cero errores de consola.

   ```
   BASE_URL=https://iberiavenezuela.netlify.app npm run capturar
   BASE_URL=https://iberiavenezuela.netlify.app npm run probar:padron
   BASE_URL=https://iberiavenezuela.netlify.app npm run capturar:adiestramiento
   ```

3. **La clave de Azure**, ver arriba.
4. **Abrir el curso** desde `/dashboard/adiestramiento` — viene cerrado a propósito, y es de
   Fase 2.

---

## Lo que **no** hay que subir al despliegue

Los audios y las fichas **no viven en el repositorio**: se generan y se suben al bucket
privado, que ya está en producción.

```
npm run generar:audios && npm run subir:audios
npm run generar:fichas && npm run subir:fichas
```

Se corren desde una máquina con las claves, no desde el servidor.

---

## Lo que sigue sin estar listo

Ninguna impide usar el panel y el informe; las dos impiden **abrir el curso**:

- ~~Saldo en la cuenta de Anthropic~~ ✅ **Resuelto el 31 de agosto** con
  `ANTHROPIC_API_KEY_SALDO`: Ajito contesta.
- 🔴 **Una clave de Azure que funcione.** Ver la tabla de variables.
- **La cuenta de WhatsApp Business y su plantilla aprobada.** Sin ella los enlaces y los
  recordatorios se copian del panel y se mandan a mano, que funciona pero no escala a
  doscientos.
