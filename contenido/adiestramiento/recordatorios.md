# Los recordatorios · el empujón

Lo que Ajito escribe por WhatsApp a quien lleva días sin volver al curso. **Es lo
único del curso que se lee en vez de oírse**, porque llega a WhatsApp y ahí no hay
reproductor de Ajito: es un mensaje como el de un compañero.

Se rigen por `00-reglas-del-guion.md` igual que todo lo demás — tuteo venezolano,
frases cortas, sin género para Ajito ni para quien lo recibe, sin adular, cero
inglés, y nada de las palabras prohibidas.

Y una regla propia, que es la que hace la diferencia entre un empujón y una
molestia:

> **No se reclama.** Nadie tiene que explicar por qué no ha vuelto. El mensaje
> dice qué le falta y cuánto le toma, y se calla.

Lo lee `lib/recordatorios.ts`, que lo convierte en la escalera. Cambiar un texto
es cambiar esto y volver a mirar el panel — nunca al revés.

---

## Cómo se cuentan los días

Desde el último toque al curso. Si nunca tocó nada, desde que se matriculó.

**Se manda el escalón más alto vencido, no todos.** Quien lleva veinte días
callado recibe el de los 13 y ya; despertarse un lunes con cuatro mensajes
seguidos de Ajito es exactamente la forma de que alguien silencie la
conversación.

**Al que terminó no se le escribe más.** Obvio, y por eso hay que dejarlo escrito.

---

## Escalón 2 · a los dos días

*El más suave. Mucha gente se queda a mitad de la lección 0 porque le sonó el
teléfono, no porque no quiera.*

> Epa {nombre}, soy Ajito. Dejaste el curso empezado y te espero donde te
> quedaste. Son tres minutos, y lo puedes hacer en el comedor. {enlace}

---

## Escalón 5 · a los cinco días

*Aparece el dato: cuánto lleva hecho. Ver «una de nueve» mueve más que cualquier
adjetivo.*

> {nombre}, llevas {hechas} de nueve. La que sigue es {siguiente} y son tres
> minutos. Aquí te espero. {enlace}

---

## Escalón 8 · a los ocho días

*Se nombra el certificado. Es lo primero concreto que se pone sobre la mesa, y no
antes: sacarlo en el día dos suena a amenaza.*

> {nombre}, te quedan {faltan} clases para tu certificado, y son tres minutos
> cada una. Puedes hacer dos hoy y quedas de {hechas} en nueve. {enlace}

---

## Escalón 13 · a los trece días

*El último. Después de este no se escribe más: si a los trece días no volvió, el
problema no es que se le haya olvidado, y seguir insistiendo por mensaje no lo
resuelve — lo resuelve alguien hablándole en persona.*

> {nombre}, esta es la última vez que te escribo por aquí, que tampoco es plan de
> fastidiar. El curso te queda abierto y no se vence. Cuando puedas, sigues donde
> lo dejaste. {enlace}

---

## Las piezas que se rellenan

| | |
|---|---|
| `{nombre}` | Cómo pidió que le dijeran en la lección 0. Si no lo pidió, el primer nombre del padrón. |
| `{hechas}` | Cuántas lecciones lleva completadas. |
| `{faltan}` | Cuántas le quedan. |
| `{siguiente}` | El título de la próxima lección — «Ajito ve», «Ajito saca cuentas». |
| `{enlace}` | El del curso, por ahora. ⚠️ Tendría que ser **su enlace personal** —el token de `accesos`, que es la credencial de quien no tiene correo—, pero esa mitad no está construida: la tabla existe y no hay ruta que consuma el token. Hasta entonces la persona entra con lo suyo y cae donde se quedó. |

---

## Lo que este archivo no decide

**Cuándo se manda.** Hoy los dispara una persona desde el panel. Cuando haya
cuenta de WhatsApp Business y valga la pena, se automatizan — y ahí habrá que
decidir a qué hora salen. No de madrugada: la planta corre a un solo turno, de
seis a dos, y un mensaje a las once de la noche despierta a alguien que se levanta
a las cuatro y media.

**A quién se le avisa aparte.** Los gerentes empujan, y el tablero por área ya
existe en `/dashboard/adiestramiento`. Que se les mande un resumen —y cada
cuánto— está sin decidir. ⚠️ Preguntarlo antes de abrir el curso.
