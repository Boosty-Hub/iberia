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
| **Fase** | 1 · Entender · **día 25 de 153**. Contrato `CONT-2026-08-0002`, firmado el 6/7 de agosto de 2026 |
| **Calendario** | Adelantado: **nada se entrega después del 6 de diciembre**, porque el aviso de no renovación vence antes que el entregable que sirve para decidir |
| **Dashboard** | Operativo en local. **Sin desplegar** |
| **Levantamiento** | **42 sesiones · 27.951 turnos**. **34 entrevistas de ~25 (136%)** · los 20 macroprocesos cubiertos |
| **Hallazgos** | **394, todos con cita textual verificada** · 37 de 42 sesiones cosechadas · 🔴 **solo 2 validados** |
| **Informe** | **13 secciones · 4 escritas** · 90.706 caracteres. Ninguna publicada |
| **Horas** | **137 h en el mes 1 contra una bolsa de 107**, ya revisadas con Gabriel. Aparte: 111 h de la etapa anterior y 104 h del curso de planta, que se factura en Fase 2 |
| **Comunicación** | **El comunicado salió.** Falta el plan con fecha, el vocero y la nota del boletín |
| **Padrón** | **276 personas cargadas** con ficha, cargo, nivel y familia de oficio. ⚠️ Sin cédula, sin celular y sin correo |
| **Canal** | Funciona en local. Anunciado el 12 de agosto; **la revisión con mercadeo se cayó y no tiene fecha** |
| **Formación dirigente** | Uno a uno con Alberto el 17 de agosto y **Petit Comité dictado el 26**. Faltan dos formaciones, sus fechas y aclarar las licencias |
| **Adiestramiento de planta** | Completo: guion, **70 audios (20 min 02 s)**, 10 fichas, certificado, padrón, recordatorios. **Ajito ya contesta** con la clave que tiene saldo. **Es de Fase 2** — avance para mostrar, no para abrir |
| **Repositorio** | `Boosty-Hub/iberia` — privado |

### Lo que aprieta

**La lista completa está en `PENDIENTES.md`**, ordenada por los siete entregables de la
cláusula 5. Aquí solo lo urgente:

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
- **Agendar lo que falta del levantamiento**: Alberto (E1), Antonio Sorrentino (E2), Arianna
  González y Martha E. Álvarez (O6), Martha Fuentes (TI, va de última) y **Yelitza Pérez**,
  que se cayó de la ronda 2 y es la puerta que más veces nombra la ronda 1.
- **Confirmar el comunicado** —día, vía y acuse— y sacar la nota del boletín. Y **aprobar el
  comité de comunicaciones** propuesto el 27, que de paso cierra la cadencia de gobierno.
- **Cerrar el acceso antes de la segunda formación**, no en la sala: en la primera se fueron
  48 de los 240 minutos en que la gente lograra entrar.
- **Aclarar el estado de las licencias de Claude Team** y fechar la segunda y la tercera.
- **Refijar la revisión del canal con mercadeo** — Alberto la agenda. Bloquea el despliegue.
- **Leer los 28 hallazgos redactados** del informe y validar los que los sostienen.
- **Pedirle a Capital Humano cédula y celular por ficha.** El padrón llegó sin ellos.

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

🔴 **Yelitza Pérez, de Crédito y Cobranza, no vino.** Es la puerta que más veces nombra la
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
  **La voz quedó cerrada aquí; no queda prueba a ciegas pendiente.**
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
