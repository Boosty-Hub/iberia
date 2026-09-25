<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Industrias Iberia · Programa de Adopción de IA

## Antes de empezar y antes de terminar

**Lee `BITACORA.md` al abrir la sesión** — dice en qué estado quedó todo y qué está
pendiente. **Añade una entrada al cerrarla**, arriba del todo: qué se construyó, qué se
decidió, qué se corrigió y dónde quedamos. Sin eso, cada sesión reconstruye contexto
desde cero.

⚠️ **Antes de escribir en la bitácora hay que leerla completa**, y al escribir:

- **Comprobar que lo nuevo no repita ni contradiga lo que ya está.** Una decisión que
  cambia no se añade abajo: se corrige donde estaba, con una nota de que cambió. Ya pasó
  —la voz quedó «cerrada» en una sección y «pendiente de elegir» tres párrafos después—
  y una bitácora que se contradice es peor que no tenerla.
- **Mantenerla corta y precisa.** Cuando es muy larga, el agente que la lee no llega al
  final, y lo que no se lee no es memoria de nada. Al añadir, mirar si hay que recortar.
- **Cómo funciona el sistema va aquí, en `AGENTS.md`, no en la bitácora.** Allá va lo que
  pasó, lo que se decidió y por qué, y lo que se rompió. Si algo se puede explicar una vez
  y consultarse, no se repite en cada entrada.
- **Lo que falta va en `PENDIENTES.md`**, no en la bitácora.

El contexto de fondo del encargo está en `CONTEXTO_IBERIA.md`, cargado en el módulo de
archivos del dashboard: contrato, mapa de personas con sus notas de manejo, vocabulario
obligatorio hacia el cliente y reglas de comunicación.

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
  pwsh scripts/generar-marca.ps1     # requiere Windows (GDI+)
  ```

  Produce `public/marca/iberia.png` (rojo), `iberia-blanco.png` (para el carbón),
  `iberia-onda-blanca.png` y `app/icon.png` (baldosa roja con "IB"). El script
  recorta al trazo, descarta la sombra gris del JPG y reconstruye el alfa.
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
npm run probar:canal   -- --password "<clave>"   # 21 comprobaciones de RLS reales
npm run capturar:canal -- --password "<clave>" --flujo   # iPhone 14 + flujo de mensaje
```

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
- **La voz vive en `lib/voz.ts`** — `es-VE-PaolaNeural` de Azure, venezolana de fábrica,
  a `+12%` porque de fábrica va lenta. Ahí está la perilla y ahí se cambia para todo el
  curso a la vez. El guion se escribe en crudo: `aSSML()` arma los párrafos y aplica
  velocidad, tono y pausas.
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
- **Se contesta hablando, con foto o escrito, y ninguna vía está cerrada.** El guion
  dice cuál sale por defecto; el resto está a un toque. La transcripción usa el endpoint
  clásico de Azure en `es-VE` —el rápido devuelve 429 en el recurso de Iberia— y por eso
  el navegador convierte a WAV 16 kHz en `lib/wav.ts` antes de subir. **Siempre se
  muestra lo que se entendió y se puede corregir antes de guardar**: una transcripción
  mala sin confirmar es una respuesta mala guardada para siempre.
- **Las notas de voz y las fotos van a otro bucket que los audios de Ajito.** Los audios
  del curso los oye cualquiera con matrícula; lo que manda una persona lo lee ella y los
  editores, nadie más. La política lo comprueba con el dueño metido en la ruta:
  `respuestas/{empleado_id}/…`.
- **La lección 8 tiene dos cierres** —`Audio 6-A` si Ajito se va, `6-B` si se queda— y
  suena el que diga `cursos.asistente_libre_activo`. Lo resuelve `segunInterruptor()`;
  por convención, sufijo `-A` es apagado y `-B` encendido.
- **Los audios se graban del guion, no de una lista aparte.** `generar:audios` lee los
  bloques `🔊 **Audio N**` de `contenido/adiestramiento/leccion-*.md` y deja los MP3 en
  `contenido/adiestramiento/audio/`. Es incremental: guarda un `.sha` con la huella del
  texto y de los ajustes de voz, así que cambiar una coma regraba un audio y cambiar la
  velocidad los regraba los 70. **Solo graba los audios numerados**, que son la clase;
  las devoluciones se generan en el momento.
- **Ajito no lleva género, y el trabajador tampoco.** El audio grabado es uno solo y lo
  oyen hombres y mujeres: nada de «estoy listo», «cuando estés lista». En lo generado sí
  se puede, que el padrón trae el nombre.
- **El ejercicio bifurca por oficio, no por nivel** (`empleados.familia_oficio`). Bajo
  `nivel = 'planta'` conviven la operadora de envasado, la cocinera de pruebas y el
  vigilante. **Ante la duda va a `generico`**, que no es el descarte: es el ejercicio
  general, escrito para funcionar con cualquiera.
- **No se fotografía el área productiva y el teléfono no se usa en las líneas.** Ningún
  ejercicio pide una foto de una máquina, una etiqueta de proceso o un documento de
  trabajo: solo a la persona, a un compañero con permiso, o cosas de su casa.
- **Lo que la gente responde no lo lee su supervisor** ni quien modera el canal — solo su
  autor y los editores de Boosty. Ajito lo promete en la lección 0 y la RLS lo cumple;
  `puede_publicar()` no alcanza para leer `respuestas`.
- **`asistente_libre_activo` viene apagado.** Encendido, aparece «pregúntale lo que sea»
  y la lección 8 se despide distinto. Por eso ese cierre está escrito en dos versiones.
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
npm run probar:adiestramiento                # 17 comprobaciones de RLS reales
npm run capturar:adiestramiento              # iPhone 14 + panel, con el flujo
npm run probar:voz                           # 7 muestras de voz para elegir de oído
npm run generar:guion                        # el guion → guion.json, y lo comprueba
npm run generar:audios                       # graba los 70 audios del guion
npm run generar:audios -- --revisar          # dice qué grabaría, sin llamar a Azure
npm run subir:audios                         # los sube al bucket privado
npm run capturar:oficios                     # el curso visto por los 8 oficios
npm run capturar:oficios -- --leccion 7      # otra lección
npm run probar:ajito                         # qué contesta Ajito, en 8 casos con filo
npm run probar:ajito -- --caso plata         # uno solo, para iterar el personaje
npm run generar:fichas                       # las 10 fichas de bolsillo, del guion
npm run subir:fichas                         # al bucket privado
npm run probar:certificado                   # 17 comprobaciones · guardas y vista
npm run probar:recordatorios                 # 38 comprobaciones · la escalera y los mensajes
```

## El empujón (`/dashboard/adiestramiento/recordatorios`)

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

## El padrón (`/dashboard/empleados`) y el enlace personal

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
- `/entrar` y `/canal/entrar` son las únicas rutas públicas nuevas en `lib/supabase/sesion.ts`.
  Tienen que serlo: quien llega con su enlace **todavía no tiene sesión**.

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

`terminarLeccion` lo emite al cerrar la novena y redirige al certificado, no al índice:
es lo que Ajito acaba de prometer en el audio. Si la emisión falla, la lección igual
queda terminada — perder el avance por no poder emitir un papel sería el peor de los
dos males.

**Una sola hoja para dos públicos.** `components/certificado-hoja.tsx` la ve el
trabajador en su teléfono y también sale en `/dashboard/adiestramiento/certificados`,
que es de donde Boosty imprime los doscientos para que el Gerente de Planta los entregue
en mano. Si fueran dos maquetas, el papel y la pantalla dirían cosas distintas del mismo
curso, y el papel es el que queda. Los estilos de impresión están al final de
`app/globals.css`.

**Los datos van congelados en la fila**, no leídos del padrón: si la persona cambia de
cargo en noviembre, el certificado sigue diciendo lo que era el día que lo hizo. Y el
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

**Ajito contesta desde `lib/ajito.ts`, y ahí vive el personaje.** Son las mismas reglas
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
la vacía.

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
  su trigger**: la RLS decide qué filas, no qué columnas.
- **`SUPABASE_SECRET_KEY` bypasea RLS.** Solo en `createAdminClient()`, y solo para
  provisionar usuarios. Nunca para leer datos por cuenta de un usuario.
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
- **Bucket privado**: se descarga por `app/dashboard/archivos/[id]/descargar/route.ts`,
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
- **Git Bash convierte en ruta de Windows cualquier argumento que empiece por `/`**:
  `/dashboard/roles` llega al script como `C:/Program Files/Git/dashboard/roles`. Para
  pasarle rutas de la app a un script, `MSYS_NO_PATHCONV=1`.
- Un módulo `'use server'` solo puede exportar funciones async. Las constantes
  compartidas van aparte — por eso existe `lib/storage.ts`.
- Los tipos de ruta (`PageProps<'/…'>`) se generan: tras añadir una ruta, correr
  `npx next typegen` antes de `tsc --noEmit`.
- Regenerar tipos de base tras cada migración:
  `supabase gen types typescript --project-id <ref> --schema public > lib/database.types.ts`

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
npm run capturar:canal      -- --password "<clave>" --flujo # el canal en teléfono
npm run crear:usuario       -- --email … --password … --rol …
npm run probar:adiestramiento               # RLS del curso de Ajito, sin clave
npm run capturar:adiestramiento             # el curso en teléfono y el panel
npm run sembrar:adiestramiento -- --abrir   # oficios, matrículas y apertura
npm run probar:voz                          # muestras de Paola y Sebastián
npm run generar:guion                       # el guion a datos, con su chequeo
npm run generar:audios                      # los audios de Ajito, del guion
npm run subir:audios                        # al bucket privado
npm run capturar:oficios                    # el curso visto por cada oficio
npm run probar:ajito                        # qué contesta Ajito · pide ANTHROPIC_API_KEY
npm run generar:fichas                      # las fichas de bolsillo, del guion
npm run subir:fichas                        # al bucket privado
npm run probar:certificado                  # guardas de emisión y vista, con capturas
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
npm run generar:guias                       # las 3 guías de entrevista adaptadas a Iberia
```

## El programa (`/dashboard/programa`)

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

## El panel (`/dashboard`)

La barra tiene tres grupos: **Levantamiento** (panel, entrevistas, archivos y «Consumos», que
es `/dashboard/programa`), **Cursos** (adiestramiento, el padrón y el curso de Ajito, que abre
en otra pestaña) y **Administración** (usuarios, roles). Cada destino sale solo si la sesión
tiene su permiso (`destinosPermitidos()` en `app/dashboard/layout.tsx`).

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
  procesos o la de las fichas, que marcan «Nuevo» con ellas) y de las lecciones, que es lo que
  se abre a gente que no es del equipo. En el resto de módulos la matriz la aplica
  el servidor de la app, con el nivel como techo en la base.
- **Cuatro roles de fábrica**, que reproducen el acceso de antes: Administrador, Consultor
  Boosty, Lector Iberia y **Personal de planta** —el canal y las nueve lecciones, nada
  más—, que es el que se le da a quien entra con su enlace (`rol_clave` en los metadatos
  del alta). No se borran ni cambian de nivel.
- **A dónde va cada quien al entrar** lo decide `destinoInicial()`: el panel si lo tiene,
  si no el canal, si no el informe, y si no `/sin-acceso`, que existe para que el panel
  no se redirija a sí mismo en bucle.

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
- Las anclas se corren lo que mide la cabecera fija (`scroll-margin-top` en `.prosa`), y
  las tablas avisan con una sombra en el borde cuando se deslizan.

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
- ⚠️ **Los 42 hallazgos conservan su número y su título**: `### H-NN · Título`. Las fichas de
  proceso los enlazan 64 veces por ancla, y la portada enlaza a los siete `##` de patrón.
  Cambiar un título rompe el enlace sin error visible.
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
- **La marca «Nuevo»** en los procesos y macroprocesos nuevos de las fichas y del mapa, que se
  pone al pintar con el dato de `macroprocesos.nuevo` y `procesos.estado` —el texto del
  generador no se toca— y en todo `**nuevo**` suelto.

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
- **«Inventario de trabas» se fundió en «Dónde se traba el trabajo»**, condensado: quedan el
  cuadro de carga por área y el reparto por tipo, y se fueron las 25 tablas con las 149 trabas
  una por una. El detalle ya vive en la ficha del proceso, que es donde se busca.
- ⚠️ **Quitar una sección renumera todas las de abajo.** Por eso las referencias van como
  `{cap:slug}` y el generador **avisa y falla** si una apunta a un capítulo que ya no existe —
  lo cazó tres veces ese mismo día.

- **Lo que está en `GENERADAS` se regenera siempre** desde el taller y la base: si alguien lo
  edita a mano, la próxima corrida lo pisa, y así debe ser. **Solo quedan ahí tres: inicio,
  mapa y fichas.** Las otras ocho se escriben en Supabase, en las sesiones de trabajo, y el
  script no las toca. *(Las oportunidades salieron el 25 de septiembre, reordenadas por ola y
  por módulo del sistema Iberia, con cada `H-NN` enlazado a su tarjeta en los hallazgos.)*
- **Todo entra sin publicar.** Un lector de Iberia solo ve lo publicado, y no se publica
  nada mientras los hallazgos que lo sostienen sigan en `propuesto`.
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
oportunidades → 10 La arquitectura de IA: el sistema Iberia → 11 La ruta de construcción.**
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
  documento la condición para pasar a Fase 2. La Fase 2 que se recomienda es **el paso 0 y la
  ola 1** (Compras, Comercial y Finanzas); la ruta va por olas y dependencias, sin fechas.
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

## El levantamiento (`/dashboard/entrevistas`)

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
flag—; que los tres buckets sean privados y tengan dentro los 70 audios y las 10 fichas;
y que no queden fichas ni cuentas de prueba en el padrón, que las verificaciones corren
contra producción.

Las migraciones se aplican con el CLI, que ya está enlazado al proyecto:

```
npx supabase db push
npx supabase gen types typescript --project-id <ref> --schema public > lib/database.types.ts
```
