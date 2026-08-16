# Reglas del guion · Adiestramiento en IA para planta

Curso de nueve lecciones para las ~200 personas de Industrias Iberia que **no**
asisten a las tres formaciones presenciales. Capítulo del programa
**IBERIA · Nuevo Sabor**. Lo dicta **Ajito**.

---

## Quién es Ajito

Cabeza de ajo, cuerpo de ají rojo con el logo de Iberia en el pecho, ojos verdes
encendidos, bracitos blancos y **una ruedita en lugar de piernas**.

La ruedita es el recurso pedagógico más valioso que tenemos: dice sin explicar
que Ajito **no es una persona**. Se usa. El ajo y el ají dicen lo otro: es de la
casa, sale del negocio de condimentos.

**Cómo habla Ajito**

- Tutea siempre. Modismo venezolano, tono profesional.
- Frases cortas. Se escucha, no se lee.
- Nunca se pone por encima. No corrige, muestra.
- Nunca finge sentimientos: no se ofende, no se cansa, no se pone triste. Cuando
  el guion lo obliga a hablar de sí mismo, dice la verdad — es un programa.
- No adula. Un «vas bien» vale; un «¡excelente trabajo!» suena a máquina.

---

## La voz de Ajito

**Es sintética, y no por ahorro.** Las devoluciones de los ejercicios se generan
en el momento, distintas para cada persona. Si la clase la graba un locutor y la
devolución la dice una máquina, hay dos Ajitos y se nota en la primera lección.
Todo sale de la misma voz, de un proveedor con API.

**Ajito no tiene sexo, y no se declara.** El nombre es masculino, la voz que
buscamos suena femenina, y esa contradicción se disuelve sola si nunca se nombra:
Ajito es un programa, no tiene por qué tenerlo. En la práctica es una regla de
escritura que hay que sostener en las nueve lecciones —**nada de adjetivos con
género referidos a sí mismo**:

| No se escribe | Se escribe |
|---|---|
| Estoy listo / lista | Ya está · Aquí estoy |
| Estoy cansado | No me canso |
| Yo solo veo la foto | Yo no veo más que la foto |
| Encantado de conocerte | Qué bueno tenerte por aquí |

Si nadie lo declara, nadie lo pregunta.

**Y la misma regla vale para la persona.** El audio grabado es uno solo y lo
escuchan hombres y mujeres. En texto MAIA resuelve con «list@»; en voz eso no
existe. Así que en los audios grabados **el trabajador tampoco lleva género**:
nada de «vas adelantado», «cuando estés listo», «tú solo». Se dice «ya lo sabías»,
«cuando puedas», «tú por tu cuenta».

En lo generado sí se puede: el padrón trae el nombre y de ahí sale la concordancia.
La restricción es solo para lo que se graba una vez.

**La voz es `es-VE-PaolaNeural`, de Azure Speech.** Venezolana de fábrica, no
aproximada: Azure declara los 22 locales del español país por país, y es el único
proveedor grande que llega hasta Venezuela. Google solo tiene España y México;
ElevenLabs no tiene locale venezolano. El detalle y el costo —unos 40 dólares por
las 200 personas— están en `herramientas.md`.

**Paola va a `+16%`, y el número está medido.** De fábrica corre a 166 palabras
por minuto y Sebastián a 200 — un 20% más rápido, que es exactamente lo que se
oye al ponerlos uno detrás del otro y por qué Paola parecía lenta. A `+16%`
queda en 192: ágil sin ir de carrera.

No se subió a `+20%` —el paso exacto de Sebastián— a propósito. A 199 la voz
queda al nivel de un pódcast de oficina, y quien va a oír esto es alguien
entendiendo por primera vez qué es la IA, en el comedor y con ruido.

La perilla está en **`lib/voz.ts`**, en `PAOLA.velocidad`. Azure admite de 0,5× a
2×, pero pasado de +25% empieza a sonar atropellada.

**Ojo con qué arregla eso y qué no.** `rate` cambia la *velocidad*, no la
*cadencia*. `es-VE` se quedó en la generación estándar —sin las variantes HD que
Microsoft solo le dio a España y México— y esa prosodia más plana no se corrige
acelerando. Si lo que molesta es el ritmo y no el tempo, la respuesta es cambiar
de voz, no de porcentaje. Y ahí **Sebastián resuelve dos cosas a la vez**: trae
mejor paso de fábrica y le quita el nudo al nombre, que es masculino.

El guion no lleva SSML escrito a mano: se redacta en crudo y `aSSML()` convierte
los saltos de línea en párrafos y aplica velocidad, tono y pausas.

**Lo que sí controlamos siempre es el texto.** Con «epa», «dale pues»,
«rapidito», «te suelto» y «chévere», hasta una voz medio neutra aterriza cerca.
El guion hace la mitad del acento.

**Antes de grabar las nueve, hay que oírla en la escalera completa:**

```
npm run probar:voz     # necesita AZURE_SPEECH_KEY y AZURE_SPEECH_REGION
```

Sintetiza el arranque de la lección 0 con Paola a 0, +8, +12, +16 y +20%, y con
Sebastián a 0 y +5%. Siete MP3 en `capturas/voz/` para oírlos seguidos y decidir
de oído, no leyendo. Que lo escuche alguien de planta, no solo nosotros.

---

## Notación

| | |
|---|---|
| 🔊 | **Audio.** Lo que Ajito dice, tal cual se graba. |
| 💬 | **Texto.** Una línea. Nunca resume el audio: solo dice qué hacer. |
| 🖼 | **Pieza.** Imagen o video. |
| ⌨️ | **Botones.** Verbos. |
| 🎯 | **Ejercicio.** Entrada libre: voz o texto. |
| ↩️ | **Devolución.** Generada, siempre hablada. |
| 🔀 | **Bifurca por área.** |
| ⚠️ | **Pendiente de confirmar antes de grabar.** |

---

## Reglas de producción

**La clase es el audio.** No existe versión escrita de la clase. Quien no quiera
leer nada, no lee nada y termina el curso completo.

**Duración.** Cada audio entre 20 y 50 segundos. La lección completa entre tres y
cuatro minutos, contando lo que la persona tarda en responder. La lección 0 puede
llegar a cuatro y medio: es la única que se lo gana.

**El texto es una línea.** Y dice qué hacer, no qué se dijo. `Mándame una foto
tuya.` Nunca un párrafo, nunca negritas regadas.

**Los botones son verbos.** `Vamos` · `Ya lo hice` · `Explícamelo más fácil` ·
`Sigo después`. Nunca `¡Suena bien!` ni `¡Estoy list@!`.

**Peso.** Los audios de Ajito van bajo 1 MB. Video solo cuando haya que *mostrar*
algo: vertical, menos de 30 segundos, menos de 3 MB. Los datos los paga el
trabajador de su bolsillo — nueve videos de 15 MB son 135 MB de su plan.

**Fichas.** Una imagen vertical por lección, letra grande, tres líneas. **Nunca un
PDF.** Se guarda en la galería del teléfono, no en Descargas.

**Sin señal en el piso.** El curso se consume en el salón Toronjil, en el bus o en
la casa. Nada puede exigir conexión en el puesto de trabajo.

**El teléfono no se usa en las líneas de producción.** Se usa en el salón de
descanso, en el comedor y en los demás espacios libres. O sea que el curso entero
se consume fuera del puesto — igual que ya sabíamos por lo de la señal, pero
ahora por norma y no solo por cobertura. Ninguna lección puede pedir nada «ahora
mismo en tu máquina».

**No se fotografía el área productiva. Regla de todo el curso, no de una
lección.** Iberia no permite tomar fotos en planta. Ningún ejercicio pide
fotografiar una máquina, una etiqueta de proceso, una orden, un tablero ni un
documento de trabajo.

Lo que sí se puede fotografiar:

- **A la persona y a sus compañeros**, en los espacios libres — el salón
  Toronjil, el comedor, la entrada, el estacionamiento — o fuera de la planta.
  Siempre con permiso de quien sale.
- **Lo suyo, en su casa**: la etiqueta de un producto de Iberia en su cocina, la
  caja de una medicina, un recibo, la tarea del muchacho.

Cuando haya que mostrar una aplicación de trabajo, **la foto la pone Ajito**, de
material que Iberia nos autorice. El trabajador ve el uso sin romper la norma.

---

## Cómo se bifurca: familias de oficio, no niveles

**`nivel = 'planta'` no quiere decir «obrero de línea».** Bajo ese mismo nivel
está quien cocina las pruebas de desarrollo, quien maneja el montacargas, quien
analiza una muestra, quien vigila la entrada y quien anda en moto haciendo
diligencias. Si a la cocinera de pruebas le llega un ejercicio sobre el
codificador de frascos, el curso le está diciendo que la empresa no sabe qué hace
ella. Ese es exactamente el daño que no podemos causar.

Por eso el ejercicio **no bifurca por nivel ni por área del organigrama, sino por
familia de oficio**, que sale de cruzar cargo con área:

| Familia | Quiénes | Su mundo |
|---|---|---|
| `linea` | Operadores de máquinas, empacadores, embaladores, alimentadores | Envasado, molino, mezclas, sobres |
| `cocina` | Preparadores de pruebas, cocineros, desarrollo de producto | Recetas, catas, formulaciones, gramajes |
| `almacen` | Despachadores, montacarguistas, auxiliares y analistas de almacén | Sacos, racks, cámaras, picking, guías |
| `mantenimiento` | Técnicos, coordinadores, almacén de repuestos | Piezas, fallas, planes por horas |
| `laboratorio` | Analistas, inspectores, auxiliares de calidad | Muestras, sensorial, normas |
| `limpieza` | Limpiadores, servicios generales | Lavado, sanitización, productos |
| `seguridad` | Vigilantes, prevención, seguridad y salud | Accesos, rondas, riesgos, dotación |
| `oficina` | Administrativos, nómina, auxiliares, motorizado | Planillas, recibos, diligencias |
| `supervision` | Supervisores y coordinadores de cualquiera de las anteriores | Gente, turnos, reportes |

**Regla dura: cuando no estemos seguros del oficio de alguien, va al ejercicio
genérico.** El genérico no es el error ni el descarte: es el estado por defecto, y
está escrito para que funcione bien con cualquiera. Vale mil veces más un
ejercicio general bien hecho que uno específico equivocado.

⚠️ Las familias de arriba están armadas con el organigrama, que trae cargos pero
no personas. **Se confirman cuando llegue la lista completa de nombres y cargos
que pidió Gabriel.** Hasta entonces, todo lo que bifurca en los guiones queda
marcado y sujeto a cambio.

---

## Vocabulario

**Se usa lo de la casa:** bache · lote · merma · picking · paletizado · rack ·
cámara · molino · molienda · cuarentena · ticket amarillo · bata · gorro ·
adiestramiento (no «capacitación») · caciques.

**No se dice nunca, en ninguna pieza:** automatización · robots · sustituir ·
reemplazar · eliminar · vigilar · monitorear · controlar · optimizar. Tampoco
«eficiencia» a secas ni «medir» sin apellido.

**Cero inglés.** Ni *prompt*, ni *chatbot*, ni *play*. Se dice «lo que le pides» y
«el asistente».

---

## Reglas de la devolución hablada

Ajito responde en audio, nunca con viñetas. La forma es la de MAIA —lo mejor que
tiene— pero hablada y con mucho más reconocimiento que corrección:

1. **Qué hiciste.** Se nombra lo que la persona hizo bien, concreto.
2. **Qué le faltó.** Una sola cosa. Nunca dos, nunca «mal».
3. **Cómo se ve mejor.** Ajito lo hace, no lo explica.

**Al describir fotos de personas:**

- Nunca peso, edad, atractivo ni nada del cuerpo.
- Se describe lo que se ve: ropa, gesto, entorno, si está en la planta.
- Se cierra con lo que enseña: «me di cuenta por la bata que estás en producción».

**Al describir fotos de documentos o equipos:** se lee lo que dice, completo, y
se cierra con una línea de para qué sirve eso.

**Estas reglas están escritas dos veces, y a propósito.** Aquí, para quien redacta
los audios a mano; y en **`lib/ajito.ts`**, traducidas a instrucción para el
modelo que genera las devoluciones. Es un solo personaje: si una regla cambia
aquí, hay que cambiarla allá el mismo día. La persona que oye el curso no
distingue —ni tiene por qué— qué salió grabado y qué salió generado.

Allá está además lo que esta lista no puede tener: **qué hace Ajito en cada
ejercicio concreto**. Ordenar en pasos lo que en la lección 2 se contó revuelto,
sacar la cuenta del pasaje en la 6 sin opinar de la plata de nadie, y decir «no
sé» en la 7 — el único ejercicio del curso donde acertar sería el fracaso.

```
npm run probar:ajito     # imprime lo que contesta, y le pasa las reglas por encima
```

---

## El interruptor del asistente libre

`asistente_libre_activo` — **apagado de entrada**, se enciende desde el panel.

- **Apagado:** no existe el botón de «pregúntale lo que sea». El curso son las
  nueve lecciones y cierra con el certificado.
- **Encendido:** aparece el botón permanente y la lección 9 cierra distinto —
  *«Ajito se queda aquí contigo»*.

La lección 9 se escribe en dos versiones desde el principio.

---

## Pendientes antes de grabar

| ⚠️ | A quién |
|---|---|
| ~~¿Se pueden tomar fotos en línea?~~ **No.** Resuelto — regla arriba. | — |
| ~~¿La restricción es a la cámara o al teléfono?~~ **Al teléfono en las líneas.** Resuelto. | — |
| **`ANTHROPIC_API_KEY`** — está vacía, y sin ella Ajito no contesta nada | Boosty · va por API, no por las licencias de asiento |
| **Lista completa de nombres y cargos** — para cerrar las familias de oficio | Gabriel la pidió |
| Fotos autorizadas de etiquetas y equipos, para que las ponga Ajito | Milagro Salas / Delina Castro |
| Retención de las fotos de la gente: propuesta, borrar a las 24 h | Milagro Salas — hay que decidirlo antes de grabar la lección 0 |
| Padrón real con edad, antigüedad y escolaridad | Gustavo Carballo |
| Avatares de planta: operadora de envasado, montacarguista, técnico, despachador | Martha E. Álvarez y la agencia |
| Archivos fuente de Ajito y poses adicionales (señalando, con una foto, confundido) | La agencia |
| Cuenta de WhatsApp Business | Martha Fuentes |
| ~~Elegir la voz~~ **`es-VE-PaolaNeural`, de Azure.** Falta oírla con alguien de planta. | Boosty |
