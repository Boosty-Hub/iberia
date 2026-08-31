/**
 * Genera las tres guías de entrevista adaptadas a Industrias Iberia.
 *
 *   npm run generar:guias
 *
 * Salen a `documentos/guias/` como HTML que se imprime y se marca en el
 * teléfono. No se editan a mano: se cambia acá y se vuelven a generar.
 *
 * ## Qué es esto y qué no
 *
 * Es la **hoja de ruta del entrevistador**, no un manual. Solo las preguntas,
 * escritas para leerse en voz alta tal como están, con su minuto asignado. El
 * porqué de cada una vive en `AGENTS.md` y en la bitácora; acá estorbaría.
 *
 * ## Por qué se rehicieron
 *
 * Las guías originales son buenas de estructura y de otro encargo de contexto:
 * hablan de Panamá y Costa Rica, de e-commerce, marketplaces y POS de retail, y
 * de la «casa matriz de una marca representada». Nada de eso existe en Cagua — y
 * la relación análoga va al revés, porque **Iberia es la casa matriz de sus
 * maquiladores**.
 *
 * ## Por qué caben en 60 minutos
 *
 * La guía original estima 90-150. Ninguna de las ocho entrevistas de la ronda 1
 * llegó a 90, y la más larga terminó con la entrevistada pidiendo cerrar dos
 * veces. Estas siete secciones vienen con su minuto y suman 60.
 *
 * ## Preguntas abiertas
 *
 * La regla del archivo: **si la pregunta se puede contestar con sí o con no, está
 * mal escrita**, salvo el consentimiento y la ficha de números, donde el dato es
 * el objetivo. Una abierta hace que la persona cuente el proceso; una cerrada
 * solo confirma el que ya trae el entrevistador en la cabeza.
 */

import { mkdirSync, writeFileSync } from 'node:fs'

const DESTINO = 'documentos/guias'

const ENCUADRE = `
<p><strong>Qué estamos construyendo, y qué no.</strong> El entregable de la Fase 1 es el
<strong>Documento de Arquitectura de IA</strong>: dónde interviene la IA, dónde no, en qué
orden y con qué conexiones al núcleo. <strong>No estamos entregando un manual de
procesos.</strong></p>
<p>Pero el mapa de macroprocesos y sus procesos N1 <em>es</em> la base sobre la que se
dibuja esa arquitectura. Y sirve doble: si más adelante la Junta Directiva quiere los
manuales de proceso, eso es otro proyecto —y llegaría con el levantamiento ya hecho.</p>`

// --- Las cuatro secciones que van iguales en las tres -------------------------

const apertura = (min = 3) => ({
  titulo: 'Apertura y consentimiento',
  min,
  critico: true,
  preguntas: [
    'Antes de empezar: esta conversación la vamos a grabar para no estar escribiendo y poder prestarte atención. El audio lo oímos nosotros y el equipo del proyecto, se usa solo para el levantamiento y no sale de ahí. ¿Estás de acuerdo?',
    'Cuéntame cómo te llamas y cuál es tu cargo exacto.',
  ],
})

const continuidad = (min = 7) => ({
  titulo: 'Riesgos y continuidad',
  min,
  critico: true,
  preguntas: [
    'En febrero hubo un incidente informático. Cuéntame ese día desde tu área: cuánto duró, cómo siguieron trabajando, qué información no volvió y qué cambió después.',
    'Si mañana se cae JD a las 8 de la mañana, ¿qué haces hasta las 5 de la tarde?',
    'Si mañana falta una persona de tu equipo por un mes, ¿cuál te complica más y por qué?',
  ],
})

const tobe = (min, extra = []) => ({
  titulo: 'Qué no tocar, qué cambiar',
  min,
  preguntas: [
    'Si viene alguien a rediseñar todo esto, ¿qué le dices de entrada que NO se toca?',
    '¿Qué te duele hoy y cambiarías si no tuvieras límite de tiempo ni de plata?',
    'Si una herramienta pudiera hacerte UNA sola tarea de tu día, ¿cuál te aliviaría más?',
    '¿Qué te preocupa de meter IA en tu proceso? ¿Qué decisión de las que tomas hoy no delegarías nunca?',
    ...extra,
  ],
})

const cierre = (min = 3) => ({
  titulo: 'Cierre',
  min,
  critico: true,
  preguntas: [
    '¿Qué documento me puedes pasar que nos ahorre una reunión? Anótalo en voz alta: nombre, quién lo manda y cuándo.',
    '¿Con quién más tenemos que hablar para entender bien esto? ¿Qué parte de tu proceso cuenta mejor otra persona?',
    '¿Qué se nos quedó por fuera?',
  ],
})

// --- Las tres guías -----------------------------------------------------------

const GUIAS = [
  {
    archivo: 'guia-operativos.html',
    clave: 'operativos',
    titulo: 'Macroprocesos operativos',
    para: 'Gerentes y jefes de la cadena de valor: compras, calidad, almacenes, producción, distribución y ventas.',
    enfoque:
      'Acá manda el <strong>flujo transaccional</strong>: qué dispara el proceso, qué pasa después, dónde se traba y qué pasa cuando algo sale mal.',
    secciones: [
      apertura(),
      {
        titulo: 'Quién eres en este proceso',
        min: 5,
        preguntas: [
          'Dentro de este proceso, ¿qué te toca hacer a ti?',
          'Si dibujaras un día normal tuyo, ¿qué te ocupa el bloque más grande de tiempo?',
          '¿Cómo está armado tu equipo y cómo se reparten el trabajo entre turnos?',
          'Cuando algo se traba, ¿a quién buscas primero fuera de tu área?',
        ],
      },
      {
        titulo: 'La ficha de números',
        min: 5,
        critico: true,
        preguntas: [
          'En un mes normal, ¿cuántas [órdenes / recepciones / despachos / facturas / lotes] mueves?',
          '¿Cuánto tarda el proceso completo, de punta a punta, cuando todo va bien?',
          '¿Cuántas veces al mes se sale de lo normal?',
          '¿Cuántos [SKU / proveedores / clientes / rutas / equipos] tocas?',
          '¿Cuál es el número que te mide, y cuánto marca hoy?',
        ],
        aviso:
          'Si contesta «son muchos»: **«sácamelo de JD y me lo mandas antes del viernes»**.',
      },
      {
        titulo: 'El flujo',
        min: 22,
        intro: 'Con la lista de procesos N1 del anexo impresa y sobre la mesa.',
        preguntas: [
          'Recórrelo como si se lo estuvieras enseñando a alguien que va a heredar tu trabajo la semana que viene. Párate en cada paso.',
          '¿Qué dispara el proceso? ¿Cómo te enteras de que hay que arrancar?',
          'En cada paso, ¿qué sistema tocas? ¿Y qué haces fuera del sistema?',
          '¿Quién aprueba qué, y a partir de qué monto o de qué caso?',
          '¿Qué se considera una excepción acá, y cómo la resuelves?',
          '¿Dónde queda registrada esa excepción?',
          'El último problema serio que recuerdas: ¿cómo se resolvió y qué aprendieron?',
          '¿En qué casos se hace distinto? Por cliente, por canal, o cuando es para una maquila.',
          'Cuando terminas, ¿quién está esperando para arrancar lo suyo, y en cuánto tiempo le llega?',
        ],
      },
      {
        titulo: 'Sistemas y rastro',
        min: 8,
        preguntas: [
          'Vamos sistema por sistema: ¿qué usas y para qué exactamente? Dime el nombre tal cual.',
          '¿Cómo pasa la información de un sistema a otro?',
          'Si mañana hay una auditoría de este proceso, ¿dónde buscas la evidencia?',
          '¿Qué esperarías que JD hiciera por ti y hoy no hace?',
        ],
      },
      continuidad(),
      tobe(7),
      cierre(),
    ],
  },

  {
    archivo: 'guia-soporte.html',
    clave: 'soporte',
    titulo: 'Macroprocesos de soporte',
    para: 'Finanzas, Tecnología de la Información, Capital Humano, Seguridad y Prevención de Pérdidas, Mantenimiento e Ingeniería.',
    enfoque:
      'Estas áreas trabajan <strong>a demanda de otras áreas de Iberia</strong>, mezclan rutina con proyecto y cargan con casi todo el cumplimiento externo. Suelen tener documentación escrita — <strong>hay que pedirla</strong>.',
    secciones: [
      apertura(),
      {
        titulo: 'Quién eres y a quién le sirves',
        min: 6,
        preguntas: [
          'Dentro de este proceso, ¿qué te toca hacer a ti?',
          '¿Cómo está armado tu equipo y cómo se reparten el trabajo?',
          '¿Qué áreas son tus clientes internos? Si el tiempo aprieta, ¿a cuáles atiendes primero y por qué?',
          '¿Cómo se reparte tu semana entre lo que se repite y lo que cae de imprevisto?',
          '¿Con quién de afuera de Iberia te toca lidiar?',
        ],
      },
      {
        titulo: 'La ficha de números',
        min: 5,
        critico: true,
        preguntas: [
          'En un mes normal, ¿cuántas [solicitudes / requisiciones / pagos / análisis / órdenes de trabajo / contrataciones] atiendes?',
          '¿Cuánto te toma responder una, desde que entra hasta que la cierras?',
          '¿Cuántas se te quedan atrás al mes, y cuál es la más vieja abierta hoy?',
          '¿Cuál es el número que te mide, y cuánto marca hoy?',
          '¿Cómo se financia lo que hace tu área?',
        ],
        aviso:
          'Si contesta «son muchos»: **«sácamelo del sistema y me lo mandas antes del viernes»**.',
      },
      {
        titulo: 'El flujo',
        min: 20,
        intro: 'Con la lista de procesos N1 del anexo impresa y sobre la mesa.',
        preguntas: [
          'Recórrelo como si se lo estuvieras enseñando a alguien que va a heredar tu trabajo. Párate en cada paso.',
          '¿Cómo te entra el trabajo?',
          'En cada paso, ¿qué sistema tocas? ¿Y qué haces fuera del sistema?',
          '¿Quién aprueba, en qué orden, y cuánto tarda cada firma?',
          '¿Qué te obliga a hacer alguien de afuera? Permisos, reportes, libros, inspecciones.',
          '¿Cada cuánto, con cuánta anticipación, y qué pasa si se pasa la fecha?',
          'Cuando le respondes a un área, ¿en cuánto tiempo esperan que respondas y dónde está escrito eso?',
        ],
      },
      {
        titulo: 'Sistemas y rastro',
        min: 7,
        preguntas: [
          'Vamos sistema por sistema: ¿qué usas y para qué exactamente? Dime el nombre tal cual.',
          '¿Cómo pasa la información de un sistema a otro?',
          'Si mañana hay una auditoría, ¿dónde está la evidencia y cuánto tiempo la guardan?',
          '¿Qué esperarías que el sistema hiciera por ti y hoy no hace?',
        ],
      },
      continuidad(),
      tobe(7),
      cierre(),
    ],
  },

  {
    archivo: 'guia-estrategicos.html',
    clave: 'estrategicos',
    titulo: 'Macroprocesos estratégicos',
    para: 'Dirección General, Direcciones de área y las gerencias que deciden el rumbo, no la transacción.',
    enfoque:
      'Acá no se levanta el flujo transaccional: se levanta <strong>cómo se decide</strong>. Con qué información, en qué foro y qué pasa cuando la información no llega a tiempo.',
    secciones: [
      apertura(),
      {
        titulo: 'Tu papel en las decisiones',
        min: 6,
        preguntas: [
          '¿Qué decisiones son tuyas y cuáles subes? ¿Dónde está la raya?',
          '¿En qué foros se decide esto, quién va y cada cuánto se reúnen de verdad?',
          '¿Dónde queda registro de lo que se decide?',
          'Cuando algo se traba y necesitas destrabarlo, ¿a quién buscas?',
        ],
      },
      {
        titulo: 'Con qué números decides',
        min: 8,
        critico: true,
        preguntas: [
          '¿Qué información miras para saber si esto va bien o va mal, y con qué frecuencia te llega?',
          '¿Quién te la prepara, y cuánto tarda en llegarte desde que ocurre el hecho?',
          '¿Qué pregunta te hacen —el dueño, la Junta, un cliente— que hoy te cuesta responder?',
          '¿Qué decisión has tomado este año con menos información de la que hubieras querido?',
          '¿Qué número no existe hoy y te cambiaría la forma de decidir?',
        ],
      },
      {
        titulo: 'El proceso de decisión',
        min: 16,
        intro: 'Con la lista de procesos N1 del anexo impresa y sobre la mesa.',
        preguntas: [
          'Llévame por una decisión real y reciente: cómo se planteó, con qué se decidió, quién opinó, cuánto tardó y cómo se comunicó.',
          '¿Cada cuánto se replantea?',
          '¿Qué se hace cuando la realidad se sale de lo planificado?',
          '¿Qué políticas escritas gobiernan esto, dónde viven y cuándo se actualizaron?',
          '¿Cómo baja esta decisión a la operación, y cómo sabes que llegó?',
          '¿Qué le pides a las otras direcciones para poder decidir, y qué tan a tiempo te llega?',
        ],
      },
      {
        titulo: 'Sistemas y visibilidad',
        min: 6,
        preguntas: [
          '¿Qué miras tú directamente en un sistema, y qué te llega ya masticado?',
          '¿De qué tienes visibilidad en el momento, y qué ves con días de retraso?',
          'Si quisieras un dato ahorita mismo, ¿a quién se lo pides y cuánto tarda?',
        ],
      },
      continuidad(6),
      tobe(8, [
        'De todo lo que hablamos, ¿por dónde empezarías tú si tuvieras que escoger una sola cosa para el año que viene?',
      ]),
      cierre(),
    ],
  },
]

// --- El anexo de procesos N1 · mapa v7 ----------------------------------------

const MAPA = {
  estrategicos: [
    ['Dirección y Gobierno Corporativo', ['Definición de Visión, Misión y Objetivos Corporativos', 'Toma de Decisiones de Alto Nivel / Gobierno Corporativo', 'Control y Supervisión General de la Organización']],
    ['Planificación Comercial y Desarrollo de Negocio', ['Planificación Estratégica de Ventas y Canales', 'Desarrollo de Nuevos Negocios y Clientes Clave', 'Definición de Estrategia Comercial y de Precios']],
    ['Gestión de Calidad y Desarrollo de Productos', ['Investigación y Desarrollo de Nuevos Productos', 'Diseño y Reformulación de Productos', 'Gestión del Sistema de Gestión de Calidad']],
  ],
  operativos: [
    ['Gestión de Compras y Abastecimiento', ['Compra de Materia Prima e Insumos', 'Negociación y Gestión de Proveedores']],
    ['Aseguramiento de la Calidad', ['Control de Calidad de Materia Prima, Proceso y Producto Terminado', 'Análisis de Laboratorio', 'Liberación de Lotes']],
    ['Almacenamiento de Materia Prima', ['Recepción y Control de Inventario de Insumos', 'Custodia y Despacho a Producción']],
    ['Producción / Manufactura', ['Molienda y Procesamiento', 'Transformación del Producto', 'Empaque', 'Control de la Producción']],
    ['Almacenamiento y Distribución de Producto Terminado', ['Almacenamiento de Producto Terminado', 'Despacho y Logística de Salida', 'Transporte y Entrega a Clientes']],
    ['Comercialización y Ventas', ['Venta Directa y Gestión de Cuentas Clave', 'Gestión de Canal Distribuidor', 'Trade Marketing', 'Publicidad, Mercadeo y Gestión de Marca']],
  ],
  soporte: [
    ['Gestión Financiera', ['Contabilidad General', 'Tesorería y Flujo de Caja', 'Crédito y Cobranza', 'Cuentas por Pagar', 'Gestión Tributaria', 'Presupuesto y Control de Gestión', 'Costeo']],
    ['Gestión de Tecnología de la Información', ['Soporte de Sistemas', 'Infraestructura y Redes', 'Seguridad de la Información']],
    ['Gestión de Capital Humano', ['Reclutamiento y Selección', 'Nómina', 'Desarrollo Organizacional y Capacitación', 'Relaciones Laborales']],
    ['Seguridad, Salud y Prevención de Pérdidas', ['Seguridad Industrial y Salud Ocupacional', 'Prevención y Control de Pérdidas / Mermas', 'Seguridad Patrimonial']],
    ['Mantenimiento e Ingeniería', ['Mantenimiento Preventivo y Correctivo de Equipos', 'Ingeniería de Planta', 'Servicios Generales (Infraestructura, Limpieza)']],
  ],
}

// -----------------------------------------------------------------------------

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const negrita = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')

function render(guia) {
  const total = guia.secciones.reduce((t, s) => t + s.min, 0)
  let acumulado = 0

  const secciones = guia.secciones
    .map((s, i) => {
      const desde = acumulado
      acumulado += s.min
      const preguntas = s.preguntas
        .map(
          (q) => `
        <li class="pregunta">
          <label><input type="checkbox"><span class="q">${negrita(q)}</span></label>
        </li>`
        )
        .join('')

      return `
    <section class="bloque${s.critico ? ' critico' : ''}">
      <header>
        <span class="num">${i + 1}</span>
        <h2>${esc(s.titulo)}</h2>
        <span class="reloj">${desde}–${acumulado} min</span>
      </header>
      ${s.critico ? '<p class="sello">No se salta</p>' : ''}
      ${s.intro ? `<p class="intro">${negrita(s.intro)}</p>` : ''}
      <ol class="preguntas">${preguntas}</ol>
      ${s.aviso ? `<p class="aviso">${negrita(s.aviso)}</p>` : ''}
    </section>`
    })
    .join('')

  const anexo = MAPA[guia.clave]
    .map(
      ([macro, n1]) => `
      <div class="macro">
        <h3>${esc(macro)} <span class="cuenta">${n1.length} procesos</span></h3>
        <ul>${n1.map((p) => `<li><input type="checkbox"> ${esc(p)}</li>`).join('')}</ul>
      </div>`
    )
    .join('')

  return `<!doctype html>
<html lang="es-VE">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Guía de entrevista · ${esc(guia.titulo)} · Industrias Iberia</title>
<style>
  :root { --acento:#D4332C; --tinta:#1A1F28; --gris:#5B6470; --linea:#e4e2df; --fondo:#f6f7f9; --papel:#fff; }
  * { box-sizing: border-box; }
  body {
    margin: 0 auto; padding: 0 1.25rem 4rem; background: var(--fondo); color: var(--tinta);
    font: 16px/1.6 "DM Sans", -apple-system, Segoe UI, system-ui, sans-serif; max-width: 44rem;
  }
  header.portada { padding: 2.5rem 0 1.25rem; }
  .rotulo { font-size:.72rem; letter-spacing:.12em; text-transform:uppercase; color:var(--acento); font-weight:600; margin:0 0 .5rem; }
  h1 { font-size: 1.9rem; line-height: 1.2; margin: 0 0 .5rem; letter-spacing: -.01em; }
  .para { color: var(--gris); margin: 0 0 1.25rem; }
  .caja { background:var(--papel); border:1px solid var(--linea); border-radius:1rem; padding:1.1rem 1.25rem; margin:0 0 1rem; }
  .caja p { margin: 0 0 .7rem; } .caja p:last-child { margin: 0; }
  .duracion { display:inline-block; background:var(--tinta); color:#fff; border-radius:999px; padding:.3rem .85rem; font-size:.82rem; font-weight:600; margin-bottom:1rem; }
  .bloque { background:var(--papel); border:1px solid var(--linea); border-radius:1rem; padding:1.1rem 1.25rem; margin:0 0 .8rem; }
  .bloque.critico { border-color: var(--acento); border-width: 2px; }
  .bloque header { display:flex; align-items:center; gap:.7rem; margin-bottom:.5rem; }
  .num { flex:none; width:1.7rem; height:1.7rem; border-radius:50%; background:var(--tinta); color:#fff; display:grid; place-items:center; font-size:.85rem; font-weight:700; }
  .critico .num { background: var(--acento); }
  .bloque h2 { font-size: 1.1rem; margin: 0; flex: 1; }
  .reloj { flex:none; font-size:.8rem; color:var(--gris); font-variant-numeric:tabular-nums; }
  .sello { display:inline-block; background:#fdecec; color:var(--acento); font-size:.7rem; font-weight:700; letter-spacing:.06em; text-transform:uppercase; padding:.16rem .55rem; border-radius:999px; margin:0 0 .5rem; }
  .intro { color: var(--gris); font-size: .9rem; margin: 0 0 .7rem; }
  .preguntas { list-style: none; margin: 0; padding: 0; }
  .pregunta { border-top: 1px solid var(--linea); }
  .pregunta:first-child { border-top: 0; }
  .pregunta label { display:flex; gap:.7rem; align-items:flex-start; cursor:pointer; padding:.62rem 0; }
  .pregunta input { margin-top:.34rem; width:1.05rem; height:1.05rem; flex:none; accent-color:var(--acento); }
  .q { font-weight: 500; }
  input:checked + .q { opacity: .4; text-decoration: line-through; }
  .aviso { margin:.8rem 0 0; background:#fff8e6; border:1px solid #f2e2b6; border-radius:.6rem; padding:.6rem .8rem; font-size:.87rem; }
  .anexo { margin-top: 2rem; }
  .anexo > h2 { font-size: 1.25rem; margin-bottom: .3rem; }
  .macro { background:var(--papel); border:1px solid var(--linea); border-radius:1rem; padding:.9rem 1.25rem; margin-bottom:.6rem; }
  .macro h3 { font-size: .96rem; margin: 0 0 .4rem; }
  .cuenta { font-weight: 400; color: var(--gris); font-size: .8rem; }
  .macro ul { list-style: none; margin: 0; padding: 0; font-size: .91rem; }
  .macro li { padding: .2rem 0; }
  .macro input { accent-color: var(--acento); margin-right: .4rem; }
  footer { color: var(--gris); font-size: .8rem; margin-top: 2rem; text-align: center; }
  @media print {
    body { background:#fff; max-width:none; font-size:10.5pt; padding:0; }
    .bloque, .macro, .caja { break-inside: avoid; border-color: #ccc; }
    .duracion { background: none; color: var(--tinta); border: 1px solid #ccc; }
  }
</style>
</head>
<body>

<header class="portada">
  <p class="rotulo">Industrias Iberia · Fase 1 · Levantamiento</p>
  <h1>${esc(guia.titulo)}</h1>
  <p class="para">${esc(guia.para)}</p>
  <p class="duracion">${total} minutos · ${guia.secciones.length} secciones</p>
</header>

<div class="caja">
  <p><strong>Cómo se usa.</strong> Las preguntas se leen en voz alta tal como están. Marca
  cada una al cubrirla. Los minutos son un presupuesto: si algo se estira, lo que se recorta
  es «el flujo», nunca las secciones marcadas <em>No se salta</em>.</p>
  <p>${guia.enfoque}</p>
</div>

<div class="caja">${ENCUADRE}</div>

${secciones}

<section class="anexo">
  <h2>Anexo · Los procesos de este nivel</h2>
  <p class="intro">Imprime esta página y tenla sobre la mesa durante la sección del flujo.
  Si dice que un proceso no existe o que se llama distinto, <strong>eso es hallazgo, no
  error</strong>.</p>
  ${anexo}
</section>

<footer>
  Boosty Digital para Industrias Iberia · Documento confidencial ·
  Se genera con <code>npm run generar:guias</code>
</footer>

</body>
</html>`
}

// -----------------------------------------------------------------------------

mkdirSync(DESTINO, { recursive: true })

/** Cazafallos: una pregunta que empieza por verbo conjugado admite sí o no. */
const CERRADA = /^¿(?:hay|existe|tiene|tienes|puede|puedes|es|está|están|se puede|los|las|el|la)\b/i

let sospechosas = 0
for (const guia of GUIAS) {
  const html = render(guia)
  writeFileSync(`${DESTINO}/${guia.archivo}`, html, 'utf8')

  const preguntas = guia.secciones.flatMap((s) =>
    s.critico && s.titulo.startsWith('Apertura') ? [] : s.preguntas
  )
  const cerradas = preguntas.filter((q) => CERRADA.test(q))
  sospechosas += cerradas.length

  const total = guia.secciones.reduce((t, s) => t + s.min, 0)
  console.log(
    `  + ${guia.archivo.padEnd(26)} ${total} min · ${guia.secciones.length} secciones · ${preguntas.length} preguntas`
  )
  for (const c of cerradas) console.log(`      ⚠ posible cerrada: ${c.slice(0, 70)}…`)
}

console.log(
  sospechosas
    ? `\n⚠️  ${sospechosas} preguntas que podrían contestarse con sí o no. Revísalas.\n`
    : `\nNinguna pregunta admite un sí o un no. En ${DESTINO}/.\n`
)
