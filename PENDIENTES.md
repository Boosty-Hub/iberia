# Qué falta

Todo lo que está sin cerrar, en un solo sitio.

**Ordenado por los siete entregables que el contrato compromete**, no por quién lo pidió
ni por qué tan avanzado está. Esa es la única lista contra la que nos van a medir: la
tabla de la página 7 de la Propuesta Técnica y Económica, recogida en la **cláusula 5**
del contrato **CONT-2026-08-0002**. Los dos documentos están en el módulo de archivos.

> **Cómo leer esto.** Cada entregable tiene una fecha de vencimiento real, contada desde
> la firma del **6 de agosto de 2026**. Lo que no aparezca aquí abajo no lo estamos
> entregando — por bueno que sea.

**Hoy es 31 de agosto: día 25 de 153.** Mes 1 se cierra en 6 días.

| | Entregable | Vence | Cómo va |
|---|---|---|---|
| 1 | Plan de comunicación y comunicado oficial | **6 sep** | 🟡 **El comunicado salió**; falta el plan con fecha y el vocero |
| 2 | App de comunicación interna (v1) **desplegada** | 30 sep | 🟡 Construida, sin revisar y sin desplegar |
| 3 | Las tres formaciones y el chat de Claude andando | 31 oct | 🟡 **La primera dictada el 26 de agosto**; faltan dos y sus fechas |
| 4 | Entrevistas y levantamiento (informes por área) | 7 nov | 🟡 **19 de ~25** · 28 hallazgos redactados · **0 informes por área** |
| 5 | Inventario de sistemas, datos, equipos y conectividad | 14 nov | 🟠 Sale de las entrevistas y ya está saliendo |
| 6 | Programa de formación de planta **diseñado** | 30 nov | ✅ Hecho, y muy por encima |
| 7 | **Documento de Arquitectura de IA** + plan fases 2–4 | **6 dic** | 🟠 28 secciones · 15 con contenido · **los hallazgos de la ronda 2 sin cosechar** |

---

## ⚠️ Por qué el calendario se adelantó un mes

**El aviso de no renovación vence antes que el entregable que sirve para decidir.**

El plazo mínimo son 5 meses desde la firma: se cumple alrededor del **6 de enero de
2027**. El aviso de no renovación es de **30 días** (cláusula 8), así que Iberia tiene
que decidir si sigue **alrededor del 6 de diciembre**. Y la propuesta calendariza el
Documento de Arquitectura para el **Mes 5**, es decir, un mes *después*.

Tal como estaba, le pedíamos a Iberia que decidiera a ciegas o que se saltara su propio
plazo.

**Decidido: nada se entrega después del 6 de diciembre.** Todas las fechas de arriba se
corrieron para que el comité apruebe con el documento en la mano. Eso adelanta un mes
todo lo que lo alimenta —las 16 entrevistas que faltan, sus informes y el inventario— y
no deja holgura que gastar. El calendario vive en `lib/programa.ts` y se ve en
`/dashboard/programa`.

*Detalle fino: la cláusula 8 no define qué es «el período en curso» para el aviso de
renovación. Conviene fijarlo por escrito antes de diciembre, no durante.*

---

## 1 · Plan de comunicación y comunicado oficial · **vence 6 de septiembre**

Lo de Boosty **está entregado**: el 31 de julio salieron a la Gerencia General los
`Insumos para el comunicado` y el `Mapa narrativo por fases`, y Alberto acusó recibo
—«ya lo comparto con la gente de comunicaciones»—. El correo está en archivos.
**El plan lo redacta Fuguet Comunicación y Cambio**, no nosotros.

✅ **El comunicado salió.** Consta en `SES-006`, la reunión de comunicaciones del 27 de
agosto: «tomando en cuenta que ya salió el comunicado (…) queremos ahora que salga algo
dentro del boletín». Ese era el 🔴 más viejo de esta lista y ya no lo es.

🆕 **Y salió una propuesta de gobierno de esa reunión**: un **comité de comunicaciones a
tres patas** —Iberia, Fuguet y Boosty— para acompasar lo que se cuenta con lo que va
saliendo. Carlos Quintana lo planteó, Amado Fuguet lo respaldó y quedó como acuerdo de la
reunión. **Alberto y Martha Fuentes no estaban en la llamada**, así que falta que lo
aprueben. De paso resuelve la cadencia de gobierno que pide la cláusula 10 y que sigue sin
estar acordada.

| Qué falta | De quién |
|---|---|
| **Confirmar el comunicado: qué día salió, por qué vía y a quién llegó.** Lo sabemos por una frase de tercero en una llamada; no hay copia en el expediente ni acuse. Sin eso no se puede dar por entregado en el reporte | Gabriel con Martha E. Álvarez |
| **La nota del boletín.** Marcela Ojeda la estaba redactando el 27 y quería sacarla «mañana… el lunes». Fuguet la escribe, pero **Alberto y Martha Fuentes la aprueban** y ese día no estaban | Fuguet · aprueban Alberto y Martha Fuentes |
| **Aprobar el comité de comunicaciones** y fijarle cadencia. Es la vía más corta para cerrar también lo de la cláusula 10 | Alberto García-Ramos |
| **Fecha de publicación del plan de comunicación**, aunque sea tentativa. Sin fecha no es un plan | Fuguet |
| **Quién es el vocero del proyecto.** La propuesta lo pide dentro de este entregable y no consta que se haya designado | Alberto García-Ramos |
| **Corregir «Bootsy» → «Boosty Digital»** en el comunicado y en lo que salga de la convocatoria. Se pidió el 31 de julio y no hay acuse — y ahora el comunicado ya salió, así que hay que revisar cómo salió | Iberia |
| **Confirmar que Ajito es el personaje aprobado.** La propuesta describe «un frasco de salsa con paticas», nombre tentativo *Ibérico*, bautizado por la organización en un concurso. Lo que existe es Ajito, de la agencia. O el concurso se hace, o se retira de la narrativa | Alberto / Martha E. Álvarez |
| ⚠️ **Y hay que decidirlo pronto, porque Fuguet ya lo da por nombre.** En `SES-006` Carlos Quintana dice «entendemos que ese va a ser el nombre (…) cuando nos reunimos con ellos allá en Cagua, ese fue el nombre que utilizaron todo el tiempo». Y avisa de algo que conviene oír: «eso en la planta se va a transformar en *carajito* más rápido; todo va a ser pregúntale al carajito» | Alberto / Martha E. Álvarez |

---

## 2 · App de comunicación interna desplegada · **vence 30 de septiembre**

Construida y funcionando en local, con RLS verificada: feed, gente, mensajes, grupos,
avisos, perfil y consola de publicación con segmentación. Anunciada a la Gerencia General
el 12 de agosto —«el primer entregable que se puede tocar»—.

| Qué falta | De quién | Por qué bloquea |
|---|---|---|
| **Refijar la revisión con mercadeo y Fuguet.** Se acordó el jueves 20 a las 11 AM en remoto y se cayó porque ese día eran las entrevistas en Cagua. **El hilo cerró sin fecha nueva** | Gabriel lo pide, Alberto lo agenda | Es el paso que Gabriel puso por delante de conectar datos reales y salir al aire. Sin él, el entregable no avanza |
| ⚠️ **Dejar por escrito que las encuestas de pulso las hace Iberia.** Están nombradas como componente de la v1 en la página 8 de la propuesta, y el contrato la incorpora por referencia. Si no las construimos nosotros, hay que decirlo en el acta de la revisión con mercadeo | Gabriel, en la revisión | No bloquea nada hoy. Bloquea en diciembre, cuando alguien lea la propuesta al lado del entregable |
| **En qué cuenta y plataforma vive**, y **con qué dominio** | **Boosty** | El dominio va dentro de los enlaces personales: cambiarlo después obliga a volver a acuñarlos. Detalle completo en `DESPLIEGUE.md` |
| **Métricas de alcance** en el panel de administración. Es componente de la v1; hay marcas de lectura, falta el tablero | **Boosty** | |
| **Quién modera y quién responde los comentarios** | Iberia | Un comentario crítico sin respuesta hace más daño que el comentario |
| **Criterio de privacidad sobre los registros de uso** | Martha Fuentes / Milagro Salas | |
| **Integración con el directorio de personal existente** | Gustavo Carballo | |
| 🔴 **El padrón está cargado, pero sin teléfonos.** Las **276 personas** ya están en `/dashboard/empleados` con su ficha, cargo, departamento, nivel y familia de oficio. Pero el archivo **no trae cédula, ni celular, ni correo, ni sede**: sin celular no hay enlace personal y sin cédula no hay correo interno derivado. Hace falta un segundo archivo con **ficha + cédula + celular** | Gustavo Carballo | Bloquea el enlace personal y el empujón, que son de Fase 2 |
| **Depurar las 17 fichas de muestra.** Son las que se sembraron en agosto para poder ver el canal, y ahora **duplican a gente real** —«Alberto García-Ramos» aparece dos veces— y llevan cédulas inventadas tipo `PADRON-002`. No las borré: de ellas cuelgan las 5 publicaciones del feed y 6 matrículas de prueba, y el canal todavía no se ha revisado con mercadeo. **Hay que limpiarlas antes de desplegar** | **Boosty** | |
| **Confirmar la sede de cada quien.** El archivo no la trae. Por centro de costo se intuye ~163 en planta y ~69 en administración, pero hay **35 en territorios de venta** repartidos por todo el país que no son ni Caracas ni Cagua | Gustavo Carballo | |
| **Avatares de planta** — operadora de envasado, montacarguista, técnico, despachador. Los 18 que mandaron son de oficina | Martha E. Álvarez y la agencia | |

---

## 3 · Las tres formaciones y el chat de Claude · **vence 31 de octubre**

**El «chat organizacional» de la propuesta no es software que haya que construir.** Son
las **licencias de Claude Team a nombre de Iberia** más las **tres formaciones
presenciales** para que la gente las use. Es un entregable de adopción, no de desarrollo.

Las tres, en orden:

| | Para quién | Cuándo |
|---|---|---|
| 1 | **La directiva** — Sesión IA Petit Comité, sala de reuniones en Caracas | ✅ **dictada el miércoles 26 de agosto** · `FOR-002` |
| 2 | **Los gerentes** | Sin fecha |
| 3 | **Los líderes que decidan los gerentes** | Sin fecha, y sin padrón |

Aparte, y fuera de agenda: la **formación uno a uno con Alberto García-Ramos** del lunes
17 de agosto, en su oficina. Se pidió hora y media y quedaron grabadas **3 h 05 min**.
Va contra la bolsa de horas y ya está cargada en `/dashboard/programa`.

### La primera, dictada · qué salió de la sala

**Cuatro horas grabadas** —`FOR-002`, 2.723 turnos— y cada participante salió con su
cuenta y trabajando sobre un archivo suyo: listas de precio y venta, proyecciones y
analítica, márgenes por SKU, el esquema variable de comisiones, e ingresos en bolívares y
dólares contra nómina diaria. **Eso es el arranque de los «artefactos por área»** que
promete la propuesta y que no existían.

⚠️ **Pero 48 de los 240 minutos se fueron en que la gente lograra entrar.** La clase
empieza en el minuto 48; antes de eso son cuentas, contraseñas de administrador,
descargas y VPN. Con seis personas se absorbe; con la cohorte de gerentes, no.

| Qué falta | De quién |
|---|---|
| 🔴 **Cerrar el acceso antes de la segunda formación**, y no en la sala. En la primera: Alberto entró un día y al siguiente no; *«algunos sí pudieron entrar con la VPN de Iberia»* y a los demás hubo que **instalarles un Proton VPN en el momento**. Eso no escala a una cohorte de gerentes. Hace falta una vía probada, la misma para todos, ensayada en una máquina limpia el día antes | Martha Fuentes · lo empuja Gabriel |
| 🔴 **Aclarar el estado de las licencias de Claude Team.** Hay licencia corporativa andando —Gabriel lo dice en la sala: *«el pago de la cuenta y lo que tú manejas está a nombre de Iberia»*—, pero también consta que al arrancar faltaban asientos por pagar: *«me falta pagar las otras»*. Falta saber **quién las contrató, cuántos asientos son, si la tarjeta de Dora ya pasó** y cuántas hacen falta para las dos cohortes que vienen. La cláusula 8 es clara: las contrata y paga el cliente | **Boosty** aclara · **Iberia** contrata |
| **El padrón de las tres capas altas**: quién entra en cada una de las tres formaciones. La tercera ni siquiera tiene criterio todavía —«los que decidan los gerentes»— | Martha Fuentes con los gerentes |
| **Fecha de la segunda y la tercera.** Sin ellas, el entregable de octubre no cierra. Y ahora hay argumento para pedirla: la primera funcionó | Martha Fuentes · lo empuja Gabriel |
| **Empaquetar los artefactos por área** de lo que cada quien montó el 26. Salieron vivos en la sesión; hay que dejarlos como material reutilizable para las dos cohortes que faltan | **Boosty** |
| ⚠️ **Resolver el acceso desde la planta.** Salió en la entrevista al Gerente de Planta: hace falta VPN y ya pasó una vez que el tráfico saliera por Países Bajos y se quedaran sin comunicación. Distinto del punto de arriba: eso es Caracas y esto es el piso de Cagua | Martha Fuentes |
| ⚠️ **Qué se le dice a quien ya usa IA en cuentas personales.** Hay al menos tres casos identificados en las entrevistas —Gemini y NotebookLM, desde la casa— y ninguno malintencionado. Todo el material es de Iberia bajo NDA | Milagro Salas / Martha Fuentes |

> **Por qué esto es lo más urgente después del comunicado.** Es lo único de toda la Fase 1
> que pone IA funcionando en las manos de alguien. Es la respuesta directa a lo que Alberto
> mismo levantó: que pasen cinco o seis meses y la conclusión sea «yo no he visto nada».

---

## 4 · Entrevistas y levantamiento · **vence 7 de noviembre**

**19 de ~25 hechas.** Dos rodajes en Cagua, los dos en dos pistas:

- **Ronda 1 · 20 de agosto** — nueve: cinco Gabriel, cuatro Ruth Velázquez.
- **Ronda 2 · 27 de agosto** — diez: cuatro Jesús Planas (el dinero y la gente) y seis
  Ruth Velázquez (la planta por debajo). **11 h 22 min grabadas en una jornada.**

Con las sesiones previas, las dos formaciones y la reunión de comunicaciones, la base
tiene **27 sesiones y 20.011 turnos**. Los **236 hallazgos propuestos** siguen siendo solo
de la ronda 1: **los de la ronda 2 están sin cosechar**, y son 6.605 turnos de las áreas
que la ronda 1 no tocó.

### 🔴 Primero esto: la grabación de ENT-005

**Milagro Salas fue grabada sin avisarle y pidió expresamente que se borrara.** Al cerrar
la entrevista preguntó cómo se había documentado, se enteró de que estaba grabada y dijo
«bórrala, sí, por favor». La consultora reconoció en el momento que fue la única persona a
la que no se le informó.

Hoy esa grabación está transcrita en la base y sus **38 hallazgos están retenidos** en
`contenido/hallazgos/tanda-3-ent005-en-espera.json`, sin cargar. Nada de esa entrevista
puede citarse en ningún entregable hasta que se resuelva.

| Qué hay que hacer | De quién |
|---|---|
| **Hablar con Milagro Salas** y acordar qué se hace: borrar y volver a levantar con su consentimiento, o que autorice por escrito lo que ya está | Gabriel |
| **Decidir si se borra la transcripción de la base.** Es una decisión suya, no del repositorio | Gabriel |
| **Poner el aviso de grabación al inicio del guion** de las ~16 que faltan, y que quede dicho en el audio | Gabriel y Ruth |

### Qué falta, medido contra el mapa de macroprocesos

Jesús levantó el **mapa v7: 14 macroprocesos y 47 procesos N1**, en tres niveles. Medido
contra ese mapa, lo que queda se lee de un vistazo:

| | Macroproceso | N1 | Ronda 1 · 20 ago | Ronda 2 · 27 ago |
|---|---|---|---|---|
| **E1** | Dirección y Gobierno Corporativo | 3 | — | — 🔴 **falta** |
| **E2** | Planificación Comercial y Desarrollo de Negocio | 3 | — | — 🔴 **falta** |
| E3 | Gestión de Calidad y Desarrollo de Productos | 3 | 🟡 Maury Armas | ✅ **cerrado** · Paola Mansilla |
| O1 | Gestión de Compras y Abastecimiento | 2 | ✅ Katty Peña | ✅ Josgleisy Ascanio · José Acevedo |
| O2 | Aseguramiento de la Calidad | 3 | ✅ Andreína Castro | ✅ Merquidia Coss |
| O3 | Almacenamiento de Materia Prima | 2 | ✅ Rafael Acosta | |
| O4 | Producción / Manufactura | 4 | ✅ Manuel de Macedo · Carlos Martínez | ✅ Beatriz Vieira |
| O5 | Almacenamiento y Distribución de PT | 3 | ✅ Uslar Valor | |
| **O6** | Comercialización y Ventas | 4 | — | — 🔴 **falta** |
| S1 | **Gestión Financiera** | **7** | — | 🟡 Dora Luciche · Ana Karina Vargas · María Criselia Briceño · Edgardo Quevedo · Jorge Rodríguez · **falta Crédito y Cobranza** |
| **S2** | Gestión de Tecnología de la Información | 3 | — | — 🔴 **falta** |
| S3 | Gestión de Capital Humano | 4 | — | ✅ Luz Marina Sanz · Liseth Yánez |
| S4 | Seguridad, Salud y Prevención de Pérdidas | 3 | — | ✅ **cerrado** · Juan Pablo Yépez · Mary Carmen Torres |
| S5 | Mantenimiento e Ingeniería | 3 | 🟡 Luis Cáceres y Jesús Acosta | ✅ **cerrado** · Pedro Méndez |

**10 de 14 macroprocesos tocados; 33 de los 47 procesos N1.** Sin tocar quedan los 13 N1
de E1, E2, O6 y S2, más Crédito y Cobranza dentro de S1.

**Y las cuatro que faltan son exactamente Caracas.** La ronda 1 recorrió la cadena física
y remitía siempre a las mismas puertas —Crédito y Cobranza libera tarde, Contabilidad
tranca el cierre, Comercial no corrige el pronóstico, Sistemas sabe si el ERP reserva—. La
ronda 2 abrió tres de esas cuatro puertas. Lo que queda es **la cabeza y la venta**:
Dirección, Planificación Comercial, Comercialización y Ventas, y Tecnología de la
Información. Cabe en una jornada y media en Caracas.

*De paso, el mapa calza con el contrato: 14 macroprocesos a una o dos sesiones cada uno son
las ~25 entrevistas que compromete la cláusula 5. No es casualidad y conviene decirlo.*

### La ronda 2 · hecha el 27 de agosto

Diez sesiones en una jornada, dos pistas simultáneas. **Salió casi tal como se propuso a
Martha**, con dos cambios:

- 🔴 **Yelitza Pérez, de Crédito y Cobranza, no vino.** Jesús lo deja dicho al cerrar
  Contabilidad: «como no está Yaylitza, no tengo la presión…». Es **la puerta que más veces
  nombra la ronda 1** —la liberación que comprime el despacho— y sigue sin levantar.
- La fila de **S4** se dio en dos sesiones en vez de una, así que la cuenta cerró en diez.

| Pista | Código | Quién | Duración |
|---|---|---|---|
| **A ·** Jesús Planas | `ENT-010` | **Dora Luciche** · Dirección de Finanzas | 86 min |
| | `ENT-011` | **Ana Karina Vargas** (Gerente de Contabilidad) + **María Criselia Briceño** (Jefa de Costos) | 85 min |
| | `ENT-012` | **Edgardo Quevedo** (Tesorería) + **Jorge Rodríguez** (Impuestos y CxP) | 77 min |
| | `ENT-013` | **Luz Marina Sanz** (RRHH) + **Liseth Yánez** (Administración de Personal) | 62 min |
| **B ·** Ruth Velázquez | `ENT-014` | **Beatriz Vieira** · Analista de Operaciones | 38 min |
| | `ENT-015` | **Josgleisy Ascanio** + **José Acevedo** · Compras | 83 min |
| | `ENT-016` | **Juan Pablo Yépez** · Prevención y Control de Pérdidas | 63 min |
| | `ENT-017` | **Mary Carmen Torres** · Seguridad y Salud en el Trabajo | 36 min |
| | `ENT-018` | **Paola Mansilla** (Sistema de Gestión) + **Merquidia Coss** (Laboratorio) | 83 min |
| | `ENT-019` | **Pedro Méndez** · Servicios Generales | 38 min |

**Las guías nuevas midieron bien**: seis de las diez cayeron entre 62 y 86 minutos contra
los 60 planificados, y ninguna se quedó a medias. Las cuatro cortas —38, 36, 38 y 63— son
áreas de proceso más chico, no sesiones truncas.

### Lo que queda del levantamiento · Caracas y Crédito y Cobranza

| | Quién | Qué cierra |
|---|---|---|
| 1 | **Alberto García-Ramos** · Gerencia General | **E1 · Dirección y Gobierno** |
| 2 | **Antonio Sorrentino** · Dirección de Comercialización | **E2 · Planificación Comercial** |
| 3 | **Arianna González** y **Martha E. Álvarez** | **O6 · Comercialización y Ventas** |
| 4 | **Martha Fuentes** · Tecnología de la Información | **S2**, y con él el **inventario de sistemas**. Va de última, para validar lo que dijeron los demás |
| 5 | **Yelitza Pérez** · Crédito y Cobranza | Lo que falta de **S1** |

⚠️ **Falta agendarlas.** Cuatro son en Caracas y una en Cagua; con el mismo formato de dos
pistas cabe en una jornada y media. **Es lo que hay que pedir esta semana**: el
levantamiento vence el 7 de noviembre pero alimenta el Documento de Arquitectura, que
vence el 6 de diciembre y del que depende que haya Fase 2.

⚠️ **Y hay dos personas de la lista original que conviene no perder de vista**: Vasco De
Freitas, que el padrón registra como **Director Gerente** (ficha 5001) y que en `ENT-013`
Jesús describe como «el director general, el accionista mayoritario», y **Flaviano Tucci**,
Director de Operaciones. Ninguno de los dos está en ninguna ronda todavía.

⚠️ **Nombrar siempre a quién se le pregunta** cuando la sesión junta a dos personas de
rangos distintos. En la ronda 2 pasó cuatro veces y funcionó —en `ENT-011` y `ENT-012` los
dos hablaron parejo—, pero en `ENT-013` la gerente aportó cuatro veces más palabras que la
jefa. Si el de más rango contesta por el otro, rescatar con «perfecto; y tú, que lo ves
desde adentro, ¿coincide?».

### Las guías · ✅ rehechas

Están en `documentos/guias/`, se generan con `npm run generar:guias`. Siete secciones con su
minuto asignado que suman 60, solo las preguntas —sin explicación al lado, que es guía de
entrevistador y no manual—, y cuatro secciones marcadas «No se salta» que son justo los
cuatro huecos de la ronda 1. Adaptadas: fuera lo multi-país, el e-commerce y la casa matriz
de marca representada; dentro las maquilas, el cumplimiento sanitario venezolano y el turno
único. El generador **avisa si alguna pregunta se puede contestar con sí o con no**.

Lo que se podó y por qué queda registrado abajo, por si alguien vuelve a las originales:

| Qué | Por qué |
|---|---|
| **Quitar todo lo multi-país** — distribución del equipo por país, coordinación entre países, business partners, la sonda del «cliente panameño», reportería regional consolidada | Iberia es una planta en Cagua |
| **Quitar los canales digitales** — e-commerce, marketplaces, POS de retail, sell-in/sell-out, Black Friday, clasificación de RMA, chatbot de atención | No existen |
| **Quitar «casa matriz de marca representada»** y la distinción entre marca representada y marca propia | Iberia es marca propia. Y la relación análoga va al revés: **Iberia es la casa matriz de sus maquiladores**, y eso la guía no lo contempla |
| **Corregir el voseo** — «¿en qué te apoyás?», «¿qué le decís de entrada?» | Es rioplatense y choca con el registro del proyecto |
| **Añadir cumplimiento sanitario y ambiental venezolano** — permiso sanitario anual, sustancias controladas con representante nominal y cuaderno físico, aguas residuales trimestrales, INSAI | Salió en dos entrevistas y la guía solo tiene una línea genérica |
| **Añadir la interfaz con maquiladores** como proceso con entidad propia | Iberia les surte materiales y les destaca una inspectora. Es una cadena completa fuera de planta sin casilla |
| **Añadir sobretiempo y doble turno** como variable transversal | Tiene circuito administrativo propio con RRHH y solo salió por accidente |
| **Recalibrar la duración** | La guía estima 90–150 min; la más larga de la ronda 1 fue de 61 y la entrevistada pidió cerrar dos veces. O se parte en dos sesiones por macroproceso, o se recorta a lo que cabe en 60 minutos con prioridades explícitas |
| 🔴 **Hacer obligatorio el consentimiento de grabación** del bloque A.1, con la frase de qué se hace con el audio y quién lo oye | Solo una de las cuatro de la ronda 1 lo pidió, y la que no lo pidió terminó con la entrevistada pidiendo que se borrara |

⚠️ **Y una pregunta de alcance que conviene cerrar con Jesús antes de agendar.** Las guías
dicen «Fase 2» y apuntan a construir **manuales de proceso** —alimentan secciones 4.x.1,
4.x.2, 5.1 y 5.2 de un manual—. Nuestro entregable contratado es el **Documento de
Arquitectura de IA** más los informes de levantamiento por área. Son dos productos
distintos del mismo insumo, y el manual de macroprocesos no está en la propuesta de Iberia.

### El resto

| Qué falta | De quién |
|---|---|
| 🔴 **Cosechar los hallazgos de la ronda 2.** Son 6.605 turnos de las áreas que la ronda 1 no tocó —el dinero, la gente, las compras por dentro, el laboratorio, la seguridad y los servicios generales— y **no hay ni un hallazgo cargado de ellas**. El informe está construido sobre 236 observaciones que son todas de la cadena física | **Boosty** |
| 🔴 **Agendar lo que falta**: las cuatro de Caracas y Crédito y Cobranza. Con dos pistas cabe en una jornada y media | Martha Fuentes agenda · Gabriel, Jesús y Ruth ejecutan |
| ✅ ~~Agendar la ronda 2~~ **Hecha el 27 de agosto**, diez sesiones en una jornada | |
| 🟡 **El consentimiento de grabación.** En la ronda 1 se pidió en 1 de 8. En la ronda 2 la pista B ya abre diciendo «el proceso es todo confidencial, esto es solamente para nosotros» —`ENT-018`— y en `ENT-017` la entrevistada misma lo confirma. **Falta que quede en las diez y con la frase completa**: qué se graba, para qué y quién lo oye | Gabriel, Jesús y Ruth |
| 🔴 **Cero documentos pedidos en 8 entrevistas.** Hay nueve artefactos nombrados y no recogidos —el Excel de explosión de Rafael, el maestro de fórmulas de Maury, el listado de 430 equipos, el tabulador de fletes, el plano del almacén—. Se pueden recuperar con un correo esta semana | Gabriel y Ruth |
| **La pregunta de continuidad no se hizo ni una vez**: «¿qué haces si JD se cae 24 horas?». Y el incidente de febrero lo trajeron tres personas solas y nadie lo abrió | Gabriel y Ruth |
| **La bola de nieve tampoco**: «¿con quién más hablamos?» — distinta de «¿a quién entrenamos?», que sí se preguntó | Gabriel y Ruth |
| **Imprimir la lista de procesos N1 antes de cada sesión.** Es lo que la guía pedía en su primera línea y no se hizo ninguna vez; va en el anexo de las guías nuevas | Quien prepare la sesión |
| La evaluación completa de la ronda 1 está en `documentos/2026-08-evaluacion-entrevistas-ronda-1.md` | |
| 🔴 **El informe de levantamiento por área.** El contrato lo pide por partida doble —cláusula 5 y tabla de la propuesta—. El formato ya está propuesto y sale de los hallazgos validados; falta acordarlo y sacar los primeros | **Boosty** |
| **Leer los 28 hallazgos redactados** en el informe y validar en el panel los crudos que los sostienen. La redacción ya escogió: de 236 quedaron 28, y solo los que se sostienen sin las entrevistas que faltaban | Gabriel y Ruth |
| ~~¿Las citas van con nombre o con cargo?~~ **Con nombre**, decidido | ✅ |
| **Identificar 9 hablantes.** De la ronda 1: `ENT-001·speaker 3`, `ENT-002·speaker 2`, `ENT-008·speaker 1`, `ENT-009·speaker 3`, y los de SES-002 y SES-005. De la ronda 2: `ENT-010·speaker 3` y `ENT-016·speaker 3` —la misma persona en las dos, quien llevaba la agenda del día; dice «mi jefa Dora»—. Y **`FOR-002·speakers 5, 6 y 7`, que son de la directiva**: entre ellos están Antonio Sorrentino y Gustavo Carballo, pero la diarización de cuatro horas con siete voces no permite cerrarlo desde el texto | Gabriel reconoce las voces |
| **El apellido de Jesús**, Gerente de Mantenimiento. En `ENT-004` solo se le nombra por el nombre de pila; en `ENT-015`, Compras lo llama «el gerente de mantenimiento, Jesús» y dice que **entró hace dos meses y bajó las hojas de emergencia un 40%** | Ruth |
| ⚠️ **Revisar los minutos 5–6 de ENT-004 antes de citarlos.** Rafael Acosta se coló por un cambio de agenda y la diarización lo metió dentro de la etiqueta de Jesús | Ruth |
| ⚠️ **Y el primer turno de `ENT-017`** es de la conductora aunque la diarización lo cuelgue de la entrevistada. Cuidado si se cita el arranque | Ruth |
| **Confirmar las dos fechas de rodaje**, que las dos se dedujeron y no vienen en el archivo de Fireflies: el **20 de agosto** por el correo del 17, y el **27 de agosto** por tres cosas que coinciden —el documento a Martha proponía ese jueves, Fireflies dejó una copia rotulada `Aug-27-11-48-AM` idéntica a `ENT-016`, y en `SES-006` de ese mismo día se dice «hoy fue la tercera ronda de entrevistas»— | Gabriel |
| **Familiarización operativa**: cómo entra un pedido, cómo se planifica, se produce, se despacha y se cobra. Con la ronda 2 la cadena ya llega hasta el cobro, salvo la liberación de crédito | **Boosty** |
| ⚠️ **Limpiar el campo «entrevistador» de `SES-001` a `SES-005`.** Quedó con la etiqueta cruda de Fireflies —«speaker 1», «speaker 4»— del importador de la interfaz, y eso se pinta en el panel. Tampoco tienen duración | **Boosty** |

---

## 5 · Inventario de sistemas, datos, equipos y conectividad · **vence 14 de noviembre**

**No se sale a buscarlo: sale de las entrevistas, y ya está saliendo.** Cada sistema que
alguien nombra se guarda como un hallazgo de tipo `sistema`, con la cita de quien lo usa
al lado. El inventario es la cosecha de esos hallazgos, no un levantamiento aparte.

De las nueve primeras entrevistas ya salieron, entre otros: **JD Edwards** sobre IBM
Power, **XL** (la toma de pedidos de la fuerza de venta, el único enlace automático que
apareció), **StarQuality** —las especificaciones de producto terminado, hoy
deshabilitado y sin enlace con el ERP—, **Power BI**, **SharePoint**, y una veintena de
Excel con nombre propio que en esta empresa funcionan como sistemas: la Biblia, la
explosión de materiales, la sábana de compras, el maestro de fórmulas.

**La ronda 2 trajo el lado administrativo, y está sin cosechar**: el sistema documental de
todas las áreas sobre SharePoint, el control de acceso y las casetas de vigilancia, los
portales fiscales, la reportería de flujo de caja que se arma fuera del ERP, y la
reportería de producción que se lleva a mano porque JD no tiene dónde cargar la línea.
Cada uno de esos es un hallazgo de tipo `sistema` que todavía no existe en la base.

| Qué falta | De quién |
|---|---|
| **La entrevista con Tecnología de la Información.** Es la que cierra el inventario: hasta que Martha Fuentes no cuente qué hay debajo, lo que tenemos es el sistema visto por quien lo usa, no por quien lo mantiene | Martha Fuentes · lo agenda Gabriel |
| **Armar el inventario con los hallazgos `sistema`** y darle una vista. Alimenta las secciones «Sistemas, datos y conectividad» y el anexo del informe | **Boosty** |
| **Equipos y conectividad por área.** Ya se sabe que no hay señal en el piso, que el salón Toronjil tiene wifi con 8 computadoras, que los supervisores de Distribución no tienen computadora y que el almacén no tiene escáner. Falta el resto | **Boosty** con Martha Fuentes |
| **La decisión de stack**, que depende de este inventario y hoy está en el aire | **Boosty** |

---

## 6 · Programa de formación de planta diseñado · **vence 30 de noviembre** · ✅

**Hecho, y muy por encima de lo que pide el contrato.** La cláusula 5 solo pide que quede
*diseñado*; el despliegue y su facturación de **USD 60 por persona** son de la **Fase 2**.

Lo que existe: el guion de las nueve lecciones, 70 audios grabados, 10 fichas de bolsillo,
el certificado, el padrón con enlace personal por WhatsApp, los recordatorios y Ajito
contestando los ejercicios.

**Es un avance para mostrar, no para abrir.** Lo que sigue faltando para desplegarlo es
todo de Fase 2 y no bloquea nada de la Fase 1:

- ~~Saldo en la cuenta de Anthropic para que Ajito conteste~~ ✅ **Resuelto el 31 de agosto.**
  La clave con saldo entró como `ANTHROPIC_API_KEY_SALDO` y `probar:ajito` devolvió las ocho
  devoluciones dentro de las reglas. Es la primera vez que se lee una.
- Cuenta de WhatsApp Business y plantilla aprobada — Martha Fuentes
- Lista completa de nombres y cargos, que cierra las familias de oficio
- Aprobación de la lista de confidencialidad de la lección 7 — Milagro Salas
- Decidir la retención de las fotos, antes de regrabar la lección 0 — Milagro Salas
- Las 11 fotos autorizadas del audio 5 de la lección 3, tomadas en Cagua con permiso de Calidad
- Probar la transcripción con audio real de planta, con ruido y acento de verdad
- Que los recordatorios lleven el enlace personal y no el general
- «Guardarlo» y «mandárselo a alguien» bajo el certificado — es una decisión, no un olvido

---

## 7 · Documento de Arquitectura de IA · **vence 6 de diciembre**

**13 secciones, todas en blanco y ninguna publicada.** El 16 de septiembre Jesús mandó
vaciar el documento entero —los 155.232 caracteres eran relleno anterior al procesamiento de
las entrevistas— y rehacer el armazón: tres partes, sin anexos, con el índice a la izquierda.
Está respaldado en `Insumos/Respaldo_Informe_2026-09-16_antes-de-vaciar` y la restauración
está probada. **Ninguna sección se autogenera**: las generadoras quedaron desconectadas a
propósito.

🔴 **Y lo que hoy le falta al documento no es estructura: es la mitad administrativa de la
empresa.** Los 28 hallazgos redactados salen todos de la cadena física, porque son los
únicos que había cuando se redactaron. La ronda 2 levantó el dinero, la gente, las compras
por dentro, el laboratorio, la seguridad y los servicios generales —6.605 turnos— y **eso
no está cosechado**. Un Documento de Arquitectura que hable de producción y despacho y
calle sobre finanzas y capital humano no se sostiene delante del comité.

Es el único entregable en firme de la Fase 1, y la **cláusula 7** lo convierte en
condición para pasar a la siguiente: *«aprobación del Documento de Arquitectura de IA por
el comité antes de continuar con las fases siguientes»*.

| Qué falta | De quién |
|---|---|
| ~~Cerrar la estructura~~ **Rehecha el 16 de septiembre: 13 secciones en blanco.** Sin anexos; lo que era anexo se volvió sección, pegado al argumento que sostiene. El informe por área lo absorbe «Las fichas de proceso» | ✅ |
| **Escribir las trece.** Empezando por las cinco que salen del dato y hoy están desconectadas —mapa de procesos, fichas, cifras, inventario de sistemas y hallazgos—: reconectarlas es devolver su entrada a `GENERADAS` en `estructura-informe.mjs` | **Boosty** |
| ⚠️ **Decidir dónde vive «qué aprueba el comité».** La sección «La decisión» se eliminó a petición de Jesús, y con ella el único sitio donde eso estaba escrito | Gabriel decide |
| 🔴 **Cosechar la ronda 2 y volver a redactar.** Es el paso que desbloquea todo lo demás: sin los hallazgos de finanzas, capital humano, compras, laboratorio y seguridad, la mitad del documento no se puede escribir | **Boosty** |
| **Nada publicado, y así se queda** hasta que los hallazgos que lo sostienen estén validados. Un lector de Iberia hoy no ve el informe; un editor ve el armazón con su marca «Por escribir» | **Boosty** |
| **Fijar la fecha del comité de aprobación** — primera semana de diciembre, por lo del aviso de renovación | Gabriel con Alberto |
| ⚠️ **Decidir si el entregable lleva partida de horas propia.** Hoy marca **cero** en `/dashboard/programa` con 28 secciones escritas: al revisar el registro con Gabriel, esas horas no fueron a `arquitectura`. Es honesto —no hay ninguna cargada ahí— pero el entregable principal aparece en blanco para el cliente, y en diciembre alguien va a preguntar cuántas horas costó el documento que sostiene la Fase 2 | Gabriel decide · **Boosty** carga |

> ⚠️ **Lo que más va a costar defender.** De los 236 hallazgos, buena parte no se arregla
> con IA: se arregla parametrizando JD Edwards, dando un permiso o capturando un dato que
> hoy nadie captura. Si el documento vende todo eso como inteligencia artificial, el
> primero que lo lea con cuidado nos lo tumba. Por eso la sección de «dónde no va la IA»
> no es un gesto de honestidad: es lo que sostiene el resto del documento.

---

## El dashboard — lo que hay que arreglar

- ⚠️ **`/dashboard/hallazgos` da un error de hidratación** («some attributes of the server
  rendered HTML didn't match»). Lo caza `npm run capturar` y es la única página que lo da.
  No rompe nada visible, pero es la página desde la que se validan los hallazgos, que es el
  paso que desbloquea el informe. Detectado el 16 de septiembre; **no lo causó el armazón**
  —esa página no renderiza markdown— y no se persiguió para no mezclarlo con el informe.

---

## Lo transversal — obligaciones que no cuelgan de un entregable

| Qué | De quién | Cuándo |
|---|---|---|
| 🔴 **Revisar el registro de horas y corregirlo.** Ya está cargado y itemizado en `/dashboard/programa`: **38 partidas**, cada una con la base de su número. Revisadas con Gabriel el 31 de agosto: el mes 1 cierra en **137 h contra 107**. Lo que falta es la última pasada antes del corte, que es en seis días | Gabriel | **Primer corte: 6 de septiembre** |
| 🔴 **Redactar el reporte mensual de consumo**, que es obligación de la cláusula 8 y nunca se ha entregado uno. **`/dashboard/programa` ya está escrito para que lo lea Iberia** —qué horas, quién las dedicó y cómo va el calendario—, así que el reporte se apoya en la página en vez de repetirla: lo que aporta es la lectura, no la tabla | **Boosty** | **6 de septiembre** |
| **Dar de alta a Iberia en el dashboard.** El módulo del programa ya se puede leer con rol `lector`, pero no consta que exista ninguna cuenta de Iberia. Sin eso, la decisión de abrirlo no cambia nada | **Boosty** crea · Alberto decide quiénes | |
| ⚠️ **La barra lateral le ofrece al lector páginas que no puede abrir.** «Adiestramiento», «Empleados» y «Editor del informe» exigen editor y lo devuelven al panel con un aviso. Con el programa abierto a Iberia eso deja de ser teórico: hay que gatear `PRINCIPALES` en `components/nav-lateral.tsx` por rol, como ya se hace con «Usuarios» | **Boosty** | |
| ~~¿El dashboard del levantamiento consume bolsa?~~ **Sí**, decidido. Sus 40 h quedan dentro | ✅ |
| **Cadencia de las reuniones de seguimiento y gobierno.** La cláusula 10 nos obliga a asistir «a las acordadas» y a entregar «la reportería pactada». No consta que estén acordadas — pero el **comité de comunicaciones** propuesto el 27 de agosto es la vía más corta para cerrarlo: ya tiene las tres patas y solo le falta cadencia | Gabriel con Alberto | |
| **Designación del liderazgo interno del proyecto** (cláusula 7). Martha Fuentes fue nombrada «coordinadora»; hay que verificar si eso lo cierra o si falta la figura transversal | Alberto García-Ramos | |
| **Responsable interno de comunicación** (cláusula 10) | Alberto García-Ramos | |
| **Regenerar `AZURE_SPEECH_KEY`**, que quedó visible en una captura | **Boosty** | |
| **Apagar los JWT legacy en Supabase.** El código no los usa; falta apagarlos en el panel. Antes, comprobar que nada fuera de este repositorio los use | **Boosty** | |
| **Registrar los certificados en Capital Humano** cuando llegue la Fase 2 | Gustavo Carballo | |

### El mes 1 cierra en 137 horas contra una bolsa de 107

*Revisado con Gabriel el 31 de agosto: las estimaciones de desarrollo estaban infladas y las
horas de Carlos Quintana y de dirección se ajustaron a lo que de verdad se dedicó.*

| Perfil | Consumido | Cuota | |
|---|---|---|---|
| Consultores de procesos | **70 h** | 36 h | +34 |
| Desarrolladores de IA | 36 h | 45 h | −9 |
| Director de proyecto | 27 h | 20 h | +7 |
| Consultor senior | 4 h | 6 h | −2 |
| **Total** | **137 h** | **107 h** | **+30** |

Fuera de esa cuenta quedan **111 h de la etapa anterior** —el comité del 9 de julio, la
memoria, la propuesta, el deck de la sesión de lanzamiento y la negociación del contrato, ya
cobradas dentro de los USD 4.700— y **104 h del curso de planta**, que se factura por
licenciamiento en la Fase 2 y por eso no descuenta.

**Lo que esto dice:**

1. ✅ **La mezcla es la que promete la propuesta.** Ahí dice que «en la Fase 1 pesan los
   consultores y la estrategia; en las fases 2 y 3 pesan los desarrolladores». Con el
   registro revisado, el único perfil por encima de su cuota es **consultores de procesos
   (+34)** —los dos rodajes de entrevistas— y **desarrollo cerró por debajo (−9)**. Es
   exactamente el reparto que corresponde a esta fase, y conviene decirlo en el reporte.
2. **El exceso son 30 horas sobre 107, no un desborde.** La cláusula 8 administra las horas
   como promedio dentro de la fase: para cerrar los cinco meses dentro de la bolsa, los
   cuatro que quedan tienen que promediar **99,5 h al mes**. Es holgura, no alarma —pero es
   holgura que ya no está.
3. ⚠️ **Y hay que vigilar noviembre.** El levantamiento, los informes por área y el Documento
   de Arquitectura caen todos en el último tramo, y son de consultoría y redacción. Si un mes
   se va por encima, va a ser ese.

### Del contrato, para vigilar

- **Dos fechas de firma**: el cuerpo dice 6 de agosto, el sello electrónico dice 7. Como
  el plazo mínimo se cuenta «desde la firma», conviene fijar internamente cuál rige.
- **La cláusula 5 dice «código fuente propiedad de EL CLIENTE» sin condición**, y la 11
  condiciona la transferencia al pago de los cinco meses. La 11 es la específica y manda,
  pero la 5 le da munición a quien quiera discutirlo.
- **No hay derogatoria expresa de `CONT-2026-07-0005`.** Si existe un ejemplar firmado del
  anterior, conviene un acta que lo deje sin efecto.
- **La inversión publicitaria fuera del fee** no quedó aclarada en ninguna cláusula.

---

## Lo que ya está resuelto y no hay que volver a preguntar

- ~~¿Quién firma por Boosty?~~ **Gabriel Andrés Montiel Toro**, y comparece y firma la
  misma persona. `CONT-2026-08-0002`, firmado el 7 de agosto de 2026.
- ~~¿Chocan el aviso de ajuste de fee y el de no renovación?~~ **No.** 45 días contra 30,
  y el ajuste solo aplica a renovaciones posteriores a las cuatro fases.
- ~~¿Quedaron las 107 horas y el licenciamiento de USD 60 en el contrato?~~ **Sí**, los dos,
  en la cláusula 8.
- ~~¿El curso de planta se abre en Fase 1?~~ **No.** Es un avance para mostrar; el
  despliegue y su facturación son Fase 2.
- ~~¿Quién redacta el plan de comunicación?~~ **Fuguet.** Lo de Boosty era pasar los
  insumos, y se pasaron el 31 de julio.
- ~~¿Se pueden tomar fotos en la línea?~~ **No.** La restricción es al teléfono en las
  líneas de producción; en el salón y el comedor se usa.
- ~~¿Qué voz?~~ **`es-VE-PaolaNeural` de Azure, a +12%** — que son las mismas 192 palabras
  por minuto de siempre, medidas ahora sobre el audio y no sobre el texto.
- ~~¿Qué modelo?~~ **Claude Opus 5, por la API.** Las licencias de asiento no sirven para
  el curso — pero **sí** son lo que hace falta para el chat organizacional, que es otra cosa.
- ~~¿Usamos claves legacy de Supabase?~~ **No.** `probar:supabase` falla si alguien mete una.
- ~~¿Salió el comunicado oficial?~~ **Sí**, y consta en `SES-006` del 27 de agosto. Falta el
  dato duro —día, vía y acuse— pero deja de ser el pendiente que bloqueaba el entregable 1.
- ~~¿Se hizo la ronda 2?~~ **Sí**, el 27 de agosto: diez sesiones en una jornada, dos
  pistas. Van 19 entrevistas de ~25.
- ~~¿Se dictó la primera formación?~~ **Sí**, el 26 de agosto en Caracas: cuatro horas y
  cada participante salió con su cuenta y trabajando sobre un archivo suyo.
- ~~¿Quién condujo cada pista de la ronda 2?~~ **Jesús Planas** la A y **Ruth Velázquez** la
  B. Está en el mapa de hablantes de `scripts/importar-transcripciones.mjs`, con la
  evidencia al lado.
