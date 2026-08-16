# Lección 5 · Ajito habla

**Duración:** 3 minutos y medio · **Audios:** 7 · **Ejercicios:** 2

**Qué tiene que quedar:** que la voz que han oído todo el curso está hecha por
computadora; que puede leer en voz alta cualquier cosa que le manden; y que eso
sirve para el papel que uno no tiene ganas o tiempo de leer.

**La regla de dignidad de esta lección.** Es la que más le sirve a quien lee con
dificultad, y por eso **en ninguna parte se menciona leer con dificultad.** Los
motivos que se dan son otros y son todos verdaderos: las manos ocupadas, la letra
chiquita, la luz mala, que uno va caminando. Quien lo necesite lo va a usar sin
tener que admitir nada, y quien no lo necesite también lo va a usar.

Notación y reglas en `00-reglas-del-guion.md`.

---

## 5.1 · Portada

🖼 Tarjeta cuadrada — `Lección 5 · Ajito habla`, avance 5 de 9.

---

## 5.2 · El secreto

*Se abre con la confesión. Es el mejor momento del curso para enseñar qué es la
IA, porque la prueba lleva cinco lecciones sonando en su oído.*

🔊 **Audio 1** · 34 s

> Te tengo que confesar algo, y te lo digo hoy porque hoy toca.
>
> Esta voz que has estado oyendo desde el primer día no es de nadie. No hay una
> persona sentada grabando esto. **La hizo una computadora**, palabra por palabra.
>
> Lo mismo que hago con los dibujos, lo hago con la voz.
>
> Y ya que lo sabes: ¿te sonaba a persona? Porque de eso se trata la lección de
> hoy.

⌨️ `No lo sabía` · `Me lo imaginaba`

**`No lo sabía` →** 🔊 «La mayoría no. Y eso también es bueno saberlo: una voz
puede estar hecha, igual que una foto.»

**`Me lo imaginaba` →** 🔊 «Buen oído. Pero fíjate que cada vez cuesta más
distinguirlo.»

---

## 5.3 · Pídemelo tú

🔊 **Audio 2** · 20 s

> Pídeme que te diga algo con la voz. Lo que sea: un chiste, un refrán, el
> nombre de tus hijos, algo en otro idioma.
>
> Yo te lo digo.

💬 `¿Qué quieres que te diga?`

🎯 **Ejercicio 1** `dime-algo` — voz o texto → responde en audio

---

## 5.4 · Para qué sirve de verdad

🔊 **Audio 3** · 32 s

> Ahora lo que te va a servir.
>
> Yo te leo en voz alta lo que tú me mandes. Cualquier cosa escrita: un mensaje
> largo que te llegó, una hoja, un instructivo, la carta del colegio del
> muchacho, un contrato.
>
> Me lo mandas escrito o me mandas la foto, y yo te lo leo. Y si es muy largo, me
> dices «cuéntamelo corto» y te digo nada más lo importante.
>
> Sirve cuando andas con las manos ocupadas, cuando la letra está muy chiquita, o
> cuando sencillamente no tienes cabeza para ponerte a leer.

⌨️ `Probemos`

---

## 5.5 · El ejercicio

🔊 **Audio 4** · 22 s

> Búscate algo escrito que tengas por ahí y que no hayas terminado de leer. Un
> mensaje largo, un papel, una hoja de instrucciones, lo que sea. **Que no sea del
> trabajo**, que ya sabes la norma.
>
> Mándamelo escrito o en foto, y yo te lo leo.

💬 `Mándame algo escrito y te lo leo.`

🎯 **Ejercicio 2** `leeme-esto` — texto o foto → responde en audio

↩️ **Ajito lo lee en voz alta.** Si pasa de un minuto, lo resume primero y ofrece
leerlo completo:

💬 `¿Te lo leo completo?`
⌨️ `Sí, completo` · `Así está bien`

---

## 5.6 · La pregunta de campo

🔊 **Audio 5** · 20 s

> La pregunta de hoy, hablando.
>
> ¿Qué papel te toca leer en tu trabajo que sea largo, o que tenga la letra muy
> chiquita, o que cueste entender?

💬 `Mándame un audio.`

🎯 `campo` — voz o texto

↩️ 🔊 · 8 s — «Anotado. Gracias.»

*Doscientas respuestas a esto es el inventario de todo el papeleo ilegible de la
planta, hecho por quien lo sufre. Alberto lo pidió con otras palabras en comité:
«nosotros generamos diez mil PDF diarios». Aquí sale por dónde empezar a
cortarlos.*

---

## 5.7 · Cierre

🔊 **Audio 6** · 22 s

> Recogiendo:
>
> Esta voz está hecha por computadora. No es de nadie.
>
> Yo te leo en voz alta lo que me mandes, escrito o en foto.
>
> Y si es muy largo, me dices «cuéntamelo corto».
>
> En la próxima vamos a sacar cuentas. Trae números.

🔊 **Audio 7** · 14 s — *se manda suelto, unos segundos después*

> Ah, y algo que se me quedaba: lo de leerte cosas en voz alta no es solo para
> hoy. Cuando quieras, me mandas un papel y te lo leo. No hay que pedir permiso.

*Ese audio suelto al final existe para que quien lo necesite sepa que la puerta
queda abierta, sin que nadie tenga que preguntar.*

🖼 **Ficha de bolsillo**

> **AJITO HABLA**
> Mándame algo escrito o una foto y te lo leo en voz alta.
> Si es largo: *cuéntamelo corto*.
> Esta voz la hace una computadora.

⌨️ `Sigo ahora` · `Sigo después`

---

## Producción

| Pieza | Estado |
|---|---|
| Portada | Por generar |
| 7 audios de Ajito | ✅ Grabados · `npm run generar:audios` |
| Ficha «Ajito habla» | ✅ Generada · `npm run generar:fichas` |

**Requisito técnico.** El ejercicio 2 mezcla lectura de foto y voz: hay que leer
un documento fotografiado y devolverlo hablado. Es la cadena más larga del curso
—visión, modelo, voz— y hay que medirle el tiempo. Si tarda más de diez segundos,
Ajito tiene que decir algo mientras tanto.
