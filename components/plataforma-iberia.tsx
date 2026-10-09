/**
 * La plataforma del sistema Iberia, en un dibujo: el triángulo de la aplicación, el
 * espejo y el código, con los servicios alrededor y el conector dentro de la planta.
 *
 * Lo pidió Gabriel el 9 de octubre de 2026, sobre el triángulo de otro proyecto,
 * adaptado a Iberia: sin Odoo, con JD Edwards reflejado en el espejo, y **todo en la
 * nube** salvo el conector, que es lo único que se instala en la red de la planta y
 * solo abre conexiones hacia afuera. Es estático y va por slug, como los circuitos.
 */

const NODO = 'fill-white stroke-marca-300'
const CENTRAL = 'fill-white stroke-marca-500'
const SATELITE = 'fill-[#f6f7f9] stroke-marca-200'
const TITULO = 'fill-marca-900 text-[15px] font-semibold'
const SUB = 'fill-marca-500 text-[11.5px]'
const ETIQUETA = 'fill-marca-500 text-[11px]'

function Caja({
  x, y, w, h, titulo, sub, clase = NODO, ancho = 1.5, tituloClase = TITULO, subClase = SUB,
}: {
  x: number; y: number; w: number; h: number; titulo: string; sub?: string[]
  clase?: string; ancho?: number; tituloClase?: string; subClase?: string
}) {
  const cx = x + w / 2
  const lineas = sub ?? []
  const alto = 18 + lineas.length * 15
  const y0 = y + h / 2 - alto / 2 + 13
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={12} className={clase} strokeWidth={ancho} />
      <text x={cx} y={y0} textAnchor="middle" className={tituloClase}>{titulo}</text>
      {lineas.map((l, i) => (
        <text key={l} x={cx} y={y0 + 18 + i * 15} textAnchor="middle" className={subClase}>{l}</text>
      ))}
    </g>
  )
}

function Satelite(p: { x: number; y: number; w?: number; titulo: string; sub: string }) {
  return (
    <Caja
      x={p.x} y={p.y} w={p.w ?? 150} h={46} titulo={p.titulo} sub={[p.sub]}
      clase={SATELITE} ancho={1} tituloClase="fill-marca-800 text-[13px] font-semibold"
    />
  )
}

function Punteada({ d }: { d: string }) {
  return <path d={d} className="fill-none stroke-marca-300" strokeWidth={1.3} strokeDasharray="5 5" />
}

function Fina({ d }: { d: string }) {
  return <path d={d} className="fill-none stroke-marca-300" strokeWidth={1} strokeDasharray="2 4" />
}

export function PlataformaIberia() {
  return (
    <figure className="mt-8">
      <div className="rounded-2xl border border-[var(--borde)] bg-white p-3 sm:p-5">
        <svg
          viewBox="0 0 820 640"
          role="img"
          aria-labelledby="plataforma-titulo plataforma-desc"
          className="h-auto w-full"
        >
          <title id="plataforma-titulo">La plataforma del sistema Iberia</title>
          <desc id="plataforma-desc">
            La aplicación, el espejo y el código forman un triángulo en la nube. Alrededor, los
            servicios: IA, voz, identidad, mapas, bancos, avisos y tableros. Dentro de la red de la
            planta solo está el conector, que lee JD Edwards y escribe en él, y solo abre
            conexiones hacia el espejo.
          </desc>

          <defs>
            <marker id="flecha-salida" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M0,0 L10,5 L0,10 z" className="fill-acento-500" />
            </marker>
          </defs>

          {/* --- La nube --------------------------------------------------- */}
          <text x={20} y={22} className="fill-marca-400 text-[11px] font-semibold tracking-[0.18em]">EN LA NUBE · A NOMBRE DE IBERIA</text>

          {/* El triángulo */}
          <Punteada d="M410,104 L320,270" />
          <Punteada d="M410,104 L660,278" />
          <Punteada d="M440,310 L560,310" />
          <text x={318} y={182} textAnchor="end" className={ETIQUETA}>datos y permisos</text>
          <text x={318} y={196} textAnchor="end" className={ETIQUETA}>por rol</text>
          <text x={548} y={182} className={ETIQUETA}>cada cambio, probado</text>
          <text x={548} y={196} className={ETIQUETA}>y con su vista previa</text>
          <text x={500} y={300} textAnchor="middle" className={ETIQUETA}>migraciones</text>
          <text x={500} y={328} textAnchor="middle" className={ETIQUETA}>y pruebas</text>

          <text x={468} y={228} textAnchor="middle" className="fill-acento-600 text-[16px] font-semibold">El sistema Iberia</text>
          <text x={468} y={246} textAnchor="middle" className={SUB}>con el espejo de JD en su núcleo</text>

          <Caja x={300} y={40} w={220} h={64} titulo="La aplicación" sub={['Next.js · Netlify', 'oficina, calle y distribuidores']} />
          <Caja
            x={200} y={268} w={240} h={84} titulo="Supabase · el espejo"
            sub={['base de datos · funciones', 'colas · archivos · permisos por fila']}
            clase="fill-[#fff8dc] stroke-oro-300" ancho={2.5}
          />
          <Caja x={560} y={278} w={200} h={64} titulo="GitHub de Iberia" sub={['código, pruebas y despliegue']} />

          {/* Los servicios */}
          <Fina d="M170,63 L300,68" />
          <Satelite x={20} y={40} titulo="Microsoft 365" sub="identidad y correo" />
          <Fina d="M520,68 L640,63" />
          <Satelite x={640} y={40} titulo="Mapbox" sub="rutas de venta y despacho" />
          <Fina d="M170,214 L210,268" />
          <Satelite x={20} y={190} titulo="Anthropic · Claude" sub="toda la IA" />
          <Fina d="M170,306 L200,306" />
          <Satelite x={20} y={283} titulo="Azure AI Speech" sub="voz venezolana" />
          <Fina d="M440,332 L620,403" />
          <Satelite x={620} y={380} titulo="Tesote" sub="los dieciséis bancos" />
          <Fina d="M440,342 L620,463" />
          <Satelite x={620} y={440} titulo="WhatsApp Business" sub="avisos sin correo" />
          <Fina d="M440,350 L620,523" />
          <Satelite x={620} y={500} titulo="Power BI" sub="lee el espejo" />

          {/* --- La planta ------------------------------------------------- */}
          <rect x={20} y={430} width={420} height={190} rx={16} className="fill-[#fbfbfc] stroke-marca-400" strokeWidth={1.3} strokeDasharray="7 5" />
          <text x={424} y={454} textAnchor="end" className="fill-marca-500 text-[11px] font-semibold tracking-[0.18em]">RED DE LA PLANTA · CAGUA</text>

          <Caja
            x={44} y={482} w={170} h={86} titulo="El conector Iberia"
            sub={['lee DB2 por JTOpen', 'y captura de cambios']}
            clase="fill-white stroke-acento-500" ancho={2}
          />
          <Caja
            x={258} y={474} w={160} h={102} titulo="JD Edwards E1"
            sub={['IBM Power · DB2', 'Orchestrator · AIS', 'el registro contable']}
            clase="fill-marca-800 stroke-marca-800" tituloClase="fill-white text-[15px] font-semibold" subClase="fill-marca-200 text-[11.5px]"
          />
          <path d="M214,525 L258,525" className="fill-none stroke-marca-500" strokeWidth={1.5} />
          <text x={236} y={596} textAnchor="middle" className={ETIQUETA}>lee y postea, dentro de la planta</text>

          {/* La única conexión entre los dos mundos, y va hacia afuera. */}
          <path d="M130,482 C130,420 230,400 262,352" className="fill-none stroke-acento-500" strokeWidth={2.2} markerEnd="url(#flecha-salida)" />
          <text x={24} y={362} className="fill-acento-600 text-[12px] font-semibold">solo salida</text>
          <text x={24} y={377} className={ETIQUETA}>empuja lo que lee</text>
          <text x={24} y={391} className={ETIQUETA}>y recoge lo que</text>
          <text x={24} y={405} className={ETIQUETA}>hay que postear en JD</text>
        </svg>
      </div>
      <figcaption className="mt-3 text-center text-xs text-marca-400">
        Todo vive en la nube, a nombre de Iberia, salvo el conector: es lo único que se instala en la
        planta, y nada entra a la red de JD.
      </figcaption>
    </figure>
  )
}
