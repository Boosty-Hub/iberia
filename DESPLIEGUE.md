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
| **Dominio** | Todavía el de Netlify. ⚠️ **Los ~200 enlaces personales llevan el dominio dentro**: cambiarlo después obliga a volver a acuñarlos y mandarlos. Elegir el definitivo antes del primer envío, y al cambiarlo, cambiar `NEXT_PUBLIC_SITE_URL` y las URLs de Supabase |

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
| `AZURE_SPEECH_KEY` | — | 🔴 **No está subida.** La de `.env.local` devuelve 401 porque **la prueba gratuita de Azure venció y los servicios están en pausa** (26 de septiembre; la cuenta se borra el 15 de octubre si no se reactiva con pago por uso). Además quedó visible en una captura. Hay que regenerarla en Azure (Keys and Endpoint → Regenerate Key 1), pegarla en `.env.local` y en Netlify como secreta de producción, y volver a desplegar. Sin ella, la devolución de Ajito sale escrita y las notas de voz no se transcriben |

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
