# Desplegar

La base ya está en producción: el proyecto de Supabase es el real, las migraciones
están aplicadas y los buckets tienen los audios y las fichas. **Lo que falta por
desplegar es la aplicación de Next**, que hoy solo corre en local.

No está desplegada porque hace falta una decisión que no es técnica: **en qué cuenta y
en qué plataforma vive material de Iberia bajo NDA.** Eso lo decide Boosty, no el
repositorio.

---

## Lo que hay que decidir primero

| | |
|---|---|
| **Dónde** | Vercel es lo natural — Next.js sin configuración, y el proyecto no usa nada que ate a un proveedor. Cualquier sitio que corra Node 22 sirve igual. |
| **En qué región** | ⚠️ **La misma que Supabase: East US, Virginia** — en Vercel, `iad1`. Cada página encadena de 4 a 8 consultas a la base y, medido desde Caracas, cada una cuesta de 90 a 140 ms: ese es casi todo el medio segundo que tarda hoy cualquier pantalla. Con el servidor al lado de la base, cada vuelta baja a milisegundos. En otra región, la app sería lenta por geografía y no por código. |
| **En qué cuenta** | Tiene que ser una de Boosty, no personal. Los enlaces de la gente de planta van a apuntar ahí durante los cinco meses de la Fase 1. |
| **Con qué dominio** | Los ~200 enlaces personales llevan el dominio dentro. Cambiarlo después obliga a volver a acuñarlos y a mandarlos otra vez. **Elegir el definitivo antes del primer envío.** |

---

## Las variables de entorno

Las siete que pide el código, tal cual están en `.env.local`:

| Variable | Para qué |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | La base |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | La clave pública |
| `SUPABASE_SECRET_KEY` | **Secreta.** Bypasea RLS; solo provisiona usuarios y acuña sesiones desde `/entrar/[token]` |
| `NEXT_PUBLIC_SITE_URL` | **La URL de producción.** No es cosmética: con ella se arman los enlaces personales y el del curso en los recordatorios. Si queda en `localhost`, los enlaces que se manden no llevan a ninguna parte. *(Los redirects de `/entrar` ya no dependen de ella desde el 24 de septiembre: van al origen de la petición, para que la sesión y la persona caigan en el mismo host.)* |
| `AZURE_SPEECH_KEY` | **Secreta.** Transcribir las notas de voz y hablar las devoluciones |
| `AZURE_SPEECH_REGION` | `westus3` |
| `ANTHROPIC_API_KEY` | **Secreta.** Las devoluciones de Ajito |

⚠️ **Regenerar `AZURE_SPEECH_KEY` antes de ponerla en producción**: quedó visible en una
captura de pantalla. Consola de Azure → Keys and Endpoint → Regenerate Key 1.
🔴 **Y la de `.env.local` ya no autentica** (24 de septiembre: 401 en todas las regiones).
Lo más probable es que ya se regeneró y no se pegó la nueva. Hay que copiarla de la consola.

---

## Después de desplegar, en este orden

1. **Supabase → Authentication → URL Configuration.** Añadir el dominio a *Site URL* y a
   *Redirect URLs*. Sin esto, `/entrar/[token]` acuña la sesión y no puede devolver a
   nadie a ninguna parte.
2. **Comprobar `/entrar` de punta a punta** con una persona de prueba: acuñar su enlace
   desde `/dashboard/empleados`, abrirlo en un teléfono de verdad y ver que entra sin
   clave. Es la puerta de las 200 personas; si falla, no falla para una.
3. **Las verificaciones contra producción**, apuntando `BASE_URL` al dominio:

   ```
   BASE_URL=https://… npm run probar:padron
   BASE_URL=https://… npm run capturar:adiestramiento
   ```

4. **Abrir el curso** desde `/dashboard/adiestramiento` — viene cerrado a propósito, para
   poder dejar todo listo y abrirlo el mismo día para todos.

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

Ninguna de las dos cosas impide desplegar; las dos impiden **abrir el curso**:

- ~~Saldo en la cuenta de Anthropic~~ ✅ **Resuelto el 31 de agosto** con
  `ANTHROPIC_API_KEY_SALDO`: Ajito contesta.
- 🔴 **Una clave de Azure que funcione.** Sin ella la devolución de Ajito sale solo escrita
  —sin la nota de voz— y **las notas de voz de la gente no se transcriben**: quien quiera
  contestar hablando tiene que escribir. Ver arriba.
- **La cuenta de WhatsApp Business y su plantilla aprobada.** Sin ella los enlaces y los
  recordatorios se copian del panel y se mandan a mano, que funciona pero no escala a
  doscientos.
