import type { Encabezado } from '@/lib/encabezados'
import { PresentacionOperarConducir } from '@/components/presentacion-operar-conducir'

/**
 * La apertura de «Qué proponemos»: las tres líneas de intervención, el desarrollo
 * organizacional y los procesos con sus marcos de referencia, con el dibujo del mismo
 * proceso hoy y con la IA. Debajo, en el markdown de la sección, va la tecnología, que
 * lleva a la arquitectura (sección 10).
 *
 * Lo pidió Gabriel el 20 de octubre de 2026, para la entrega del 21, sobre las láminas
 * del señor Carlos («Las tres líneas de intervención» y la de desarrollo organizacional)
 * y su explicación de procesos: insumos a un lado, las actividades en el medio
 * —devolviéndose y cruzándose hoy, avanzando derechas con la IA— y el producto final al
 * otro. Dos cosas que él pidió y que se cuidan aquí: no se habla de plan estratégico, y
 * los marcos de referencia van dentro del desarrollo organizacional. Es estático y va
 * por slug, como el triángulo de la plataforma.
 */

/** Los `##` del bloque, para el índice «En esta sección»: van antes que los del markdown. */
export const ENCABEZADOS_TRES_LINEAS: Encabezado[] = [
  { id: 'tres-lineas-de-intervencion', texto: 'Tres líneas de intervención' },
  { id: 'desarrollo-organizacional', texto: 'Desarrollo organizacional' },
  { id: 'procesos-y-marcos-de-referencia', texto: 'Procesos y marcos de referencia' },
]

const LINEAS = [
  { numero: 'Línea 1', nombre: 'Desarrollo organizacional', puntos: ['Desarrollo humano', 'Clima organizacional'] },
  {
    numero: 'Línea 2',
    nombre: 'Procesos y marcos de referencia',
    puntos: ['Documentación y difusión de los procesos', 'Políticas, normas y procedimientos'],
  },
  {
    numero: 'Línea 3',
    nombre: 'Tecnología',
    puntos: ['Implementación de la IA: los alivios, el sistema Iberia y sus módulos'],
    acento: true,
  },
]

const FRENTES = [
  ['Enfoque de la Dirección', 'Una visión compartida de hacia dónde va la transformación y del papel de cada director en ella.'],
  ['Activación de la Gerencia', 'Las gerencias conducen el cambio en sus áreas y bajan la información a sus equipos.'],
  ['Fortalecimiento del rol supervisorio', 'El supervisor acompaña la adopción en el día a día, en la planta y en la oficina.'],
  ['Gestión del desempeño', 'Lo que se espera de cada cargo, seguido con los datos que el sistema empieza a dar.'],
  ['Comunicaciones internas', 'Un mismo mensaje para cada nivel, por los canales que la organización ya tiene.'],
  [
    'Actualización y dinamización de los marcos de referencia',
    'Los enunciados corporativos, las políticas y las normas, al día y conocidos por todos.',
  ],
] as const

const PELDANOS = [
  [
    'Enunciados corporativos',
    'La visión, la misión y los valores: lo que la empresa quiere ser y en qué cree. Por ejemplo, la innovación.',
  ],
  [
    'Políticas',
    'Lo que se deriva de esos valores. Por la innovación, adoptar la IA como una nueva forma de trabajo, que es el borrador de la sección 16.',
  ],
  ['Normas', 'Las reglas que concretan cada política: qué se puede hacer y qué no.'],
  ['Procedimientos', 'El paso a paso para cumplir las normas en una tarea concreta.'],
] as const

const SANGRIA = ['', 'sm:ml-4', 'sm:ml-8', 'sm:ml-12']

function Extremo({ x, y, titulo, sub, final = false }: { x: number; y: number; titulo: string[]; sub?: string[]; final?: boolean }) {
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={130}
        height={176}
        rx={12}
        className={final ? 'fill-oro-100 stroke-oro-300' : 'fill-[#f6f7f9] stroke-marca-200'}
        strokeWidth={1.5}
      />
      {titulo.map((t, i) => (
        <text key={t} x={x + 65} y={y + 84 + i * 20} textAnchor="middle" className="fill-marca-900 text-[15px] font-bold">
          {t}
        </text>
      ))}
      {sub?.map((t, i) => (
        <text key={t} x={x + 65} y={y + 104 + i * 16} textAnchor="middle" className="fill-marca-500 text-[12.5px]">
          {t}
        </text>
      ))}
    </g>
  )
}

/** El mismo proceso dos veces: hoy se devuelve y se cruza; con la IA avanza derecho. */
function ProcesoHoyYConIA() {
  const hoy = 'fill-none stroke-marca-400'
  return (
    <figure className="mt-6">
      <div className="overflow-x-auto rounded-2xl border border-[var(--borde)] bg-white p-3 sm:p-4">
        <svg
          viewBox="0 0 900 520"
          role="img"
          aria-labelledby="proceso-t proceso-d"
          className="block h-auto w-full min-w-[620px]"
        >
          <title id="proceso-t">El mismo proceso, hoy y con la IA</title>
          <desc id="proceso-d">
            Arriba, hoy: de los insumos al producto final, las actividades avanzan, se devuelven y se cruzan. Abajo,
            con el proceso claro y la IA en el flujo: las mismas actividades avanzan sin devolverse hasta el producto
            final.
          </desc>
          <defs>
            <marker id="punta-roja" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M0 0 L10 5 L0 10 z" className="fill-acento-500" />
            </marker>
            <marker id="punta-carbon" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M0 0 L10 5 L0 10 z" className="fill-marca-700" />
            </marker>
          </defs>

          <text x="20" y="28" className="fill-acento-600 text-[12px] font-bold tracking-[0.12em]">HOY</text>
          <text x="62" y="28" className="fill-marca-500 text-[12.5px]">las actividades avanzan, se devuelven y se cruzan</text>
          <Extremo x={20} y={52} titulo={['Insumos']} sub={['materia prima,', 'pedidos, datos']} />
          <rect x={168} y={52} width={564} height={176} rx={12} className="fill-none stroke-marca-200" strokeDasharray="3 5" />
          <path className={hoy} strokeWidth={2.4} strokeLinecap="round" d="M150 80 C260 80 300 190 370 170 S300 70 430 92 C530 110 480 200 570 182 S650 70 750 112" />
          <path className={hoy} strokeWidth={2.4} strokeLinecap="round" d="M150 116 C230 56 330 56 330 126 S250 196 384 182 C480 172 520 62 604 92 S560 182 750 128" />
          <path className={hoy} strokeWidth={2.4} strokeLinecap="round" d="M150 152 C250 202 290 106 404 136 S474 208 524 138 C564 80 624 190 684 148 S724 140 750 142" />
          <path className={hoy} strokeWidth={2.4} strokeLinecap="round" d="M150 188 C220 222 300 222 290 152 S360 82 456 128 C540 172 484 214 606 170 S700 158 750 158" />
          <path d="M520 70 C470 60 420 60 380 74" className="fill-none stroke-acento-500" strokeWidth={2} strokeDasharray="5 5" markerEnd="url(#punta-roja)" />
          <path d="M650 214 C600 226 540 226 494 210" className="fill-none stroke-acento-500" strokeWidth={2} strokeDasharray="5 5" markerEnd="url(#punta-roja)" />
          <text x="450" y="58" textAnchor="middle" className="fill-acento-600 text-[12.5px]">se devuelve</text>
          <Extremo x={750} y={52} titulo={['Producto', 'final']} final />

          <text x="20" y="290" className="fill-acento-600 text-[12px] font-bold tracking-[0.12em]">CON EL PROCESO CLARO Y LA IA</text>
          <text x="282" y="290" className="fill-marca-500 text-[12.5px]">las mismas actividades avanzan sin devolverse</text>
          <Extremo x={20} y={314} titulo={['Insumos']} sub={['materia prima,', 'pedidos, datos']} />
          <rect x={168} y={314} width={564} height={176} rx={12} className="fill-none stroke-marca-200" strokeDasharray="3 5" />
          <path d="M150 342 C380 342 520 380 744 390" className="fill-none stroke-acento-500" strokeWidth={2.6} strokeLinecap="round" markerEnd="url(#punta-roja)" />
          <path d="M150 378 C380 378 520 396 744 400" className="fill-none stroke-marca-700" strokeWidth={2.6} strokeLinecap="round" markerEnd="url(#punta-carbon)" />
          <path d="M150 414 C380 414 520 412 744 410" className="fill-none stroke-acento-500" strokeWidth={2.6} strokeLinecap="round" markerEnd="url(#punta-roja)" />
          <path d="M150 450 C380 450 520 428 744 420" className="fill-none stroke-marca-700" strokeWidth={2.6} strokeLinecap="round" markerEnd="url(#punta-carbon)" />
          <Extremo x={750} y={314} titulo={['Producto', 'final']} final />
        </svg>
      </div>
      <figcaption className="mt-2 text-sm leading-relaxed text-marca-500">
        El mismo proceso dos veces. Hoy, la información vuelve atrás y se cruza entre áreas, como lo dibuja el
        circuito del negocio. Con el proceso documentado y la IA en el flujo, cada actividad entrega lo que la
        siguiente necesita y el trabajo avanza hacia el producto final sin devolverse.
      </figcaption>
    </figure>
  )
}

export function TresLineasIberia() {
  return (
    <div className="prosa">
      {/* El párrafo de la conclusión del levantamiento —357 traspasos, 55 de sistema a sistema—
          se quitó el 20 de octubre de 2026, por pedido de Gabriel. */}
      <p>
        Una herramienta nueva, por sí sola, no cambia la forma de trabajar. Para que la implementación de la IA funcione como tiene
        que funcionar, la propuesta avanza en tres líneas al mismo tiempo.
      </p>

      <h2 id="tres-lineas-de-intervencion">Tres líneas de intervención</h2>
      <div className="grid gap-3">
        {LINEAS.map((l) => (
          <div
            key={l.nombre}
            className="grid overflow-hidden rounded-2xl border border-[var(--borde)] sm:grid-cols-[220px_minmax(0,1fr)]"
          >
            <div className={l.acento ? 'bg-acento-500 px-5 py-4 text-white' : 'bg-marca-800 px-5 py-4 text-white'}>
              <span className="block font-mono text-xs opacity-75">{l.numero}</span>
              <span className="block leading-snug font-semibold">{l.nombre}</span>
            </div>
            <ul className="m-0 self-center py-3 pr-5 pl-10!">
              {l.puntos.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <PresentacionOperarConducir />
        <span className="text-sm text-marca-500">La presentación del desarrollo organizacional, para mostrarla en pantalla.</span>
      </div>
      <aside className="aviso-md aviso-clave">
        <p className="aviso-rotulo">Por qué las tres</p>
        <p>
          Ninguna se sostiene sola. La IA sobre procesos que no están claros hace más rápido lo mismo que hoy se
          devuelve; los procesos escritos sin la gente preparada para trabajar de otra forma se quedan en el papel.
        </p>
      </aside>

      <h2 id="desarrollo-organizacional">Desarrollo organizacional</h2>
      <div className="flex flex-wrap gap-2">
        <span className="rounded-full bg-oro-100 px-3.5 py-1 text-sm font-semibold text-marca-900">Desarrollo humano</span>
        <span className="rounded-full bg-oro-100 px-3.5 py-1 text-sm font-semibold text-marca-900">Clima organizacional</span>
      </div>
      <p>
        Cada persona va a trabajar con herramientas nuevas, y muchas por primera vez con un equipo propio. Esa
        adopción se conduce: necesita una dirección alineada, gerencias que la lleven a sus áreas y un lenguaje común
        para explicar qué cambia, por qué y cuándo. Esta línea trabaja seis frentes:
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {FRENTES.map(([titulo, texto]) => (
          <div key={titulo} className="rounded-xl border border-[var(--borde)] bg-white px-4 py-3">
            <p className="leading-snug font-semibold text-marca-900">{titulo}</p>
            <p className="mt-1 text-[15px] leading-relaxed text-marca-600">{texto}</p>
          </div>
        ))}
      </div>

      <h2 id="procesos-y-marcos-de-referencia">Procesos y marcos de referencia</h2>
      <p>Son dos cosas distintas que se suelen confundir, y la propuesta trabaja las dos.</p>
      <h3>Los marcos de referencia: las reglas del juego</h3>
      <p>Parten de lo que la empresa declara de sí misma y bajan hasta el detalle de cómo se trabaja:</p>
      <ol className="m-0 grid list-none gap-2 p-0">
        {PELDANOS.map(([titulo, texto], i) => (
          <li
            key={titulo}
            className={`grid gap-x-3 rounded-xl border border-[var(--borde)] bg-white px-4 py-2.5 sm:grid-cols-[28px_170px_minmax(0,1fr)] ${SANGRIA[i]}`}
          >
            <span className="font-mono text-acento-600">{i + 1}</span>
            <span className="font-semibold text-marca-900">{titulo}</span>
            <span className="text-[15px] leading-relaxed text-marca-600">{texto}</span>
          </li>
        ))}
      </ol>
      <h3>Los procesos: insumos que se transforman en productos</h3>
      <p>
        Un proceso es un conjunto de actividades, ordenadas de una manera determinada, que transforman unos insumos
        en unos productos: materia prima que sale como mayonesa, o una solicitud que sale como un pedido despachado.
        El proceso no es el procedimiento; se tocan en un punto:{' '}
        <strong>cada actividad del proceso se ejecuta cumpliendo los procedimientos y, por ellos, las reglas del juego.</strong>
      </p>
      <p>
        En esta fase se documentó cómo funciona hoy cada proceso, lo necesario para diseñar la arquitectura. El paso
        siguiente es documentarlo a fondo, validarlo con cada área y difundirlo. Al hacerlo, en cada proceso se propone también por dónde puede ir mejor con la IA dentro. Las
        decisiones las toma Iberia.
      </p>
      <ProcesoHoyYConIA />
    </div>
  )
}
