'use client'

import { useEffect, useRef, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import { IconoCerrar } from '@/components/iconos'
import { cn } from '@/lib/utils'

/**
 * El cierre de la mañana del 21 de octubre: la Nueva Iberia en el tiempo, con sus tres
 * vías —tecnología, desarrollo organizacional y procesos— de la entrega de la arquitectura
 * a octubre de 2027. Va al final de «Qué proponemos» (sección 09), debajo de la tecnología.
 *
 * Lo pidió Gabriel el 20 de octubre de 2026, tras la reunión de coordinación con la
 * Gerencia General y el señor Carlos: la línea tecnológica primero y más detallada —los
 * primeros meses con TI en la conexión de JD, después los alivios—, y debajo lo demás. Las
 * fechas salen de las dos propuestas de octubre (Fase 2 · Aliviar y New Iberia); sin
 * montos, que esto lo lee el comité. Y se dice que es tentativo, como pidió el señor
 * Carlos: el orden y las dependencias mandan, las fechas se ajustan.
 *
 * ⚠️ No va en «La ruta de construcción» (sección 11): esa dice, a propósito, que la ruta
 * no lleva fechas.
 */

/** De octubre de 2026 a octubre de 2027. Una posición es «meses desde el 1 de octubre de 2026». */
const MESES = ['oct', 'nov', 'dic', 'ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct']
const ANIOS: Record<number, string> = { 0: '2026', 3: '2027' }
const TOTAL = MESES.length
/** El 21 de octubre, la entrega. */
const HOY = 0.65

type Tono = 'tecnologia' | 'desarrollo' | 'procesos'

type Fila = {
  nombre: string
  detalle: string
  desde: number
  hasta: number
  hito?: { en: number; texto: string }
}

const VIAS: { tono: Tono; nombre: string; filas: Fila[] }[] = [
  {
    tono: 'tecnologia',
    nombre: 'Tecnología · los alivios',
    filas: [
      {
        nombre: 'Paso 0 · La base, con TI',
        detalle: 'El conector en la planta, el espejo de JD y el gobierno del dato: quién ve qué',
        desde: 1,
        hasta: 3,
        hito: { en: 3, texto: 'El espejo cuadra con JD' },
      },
      {
        nombre: 'Canal de comunicación interna',
        detalle: 'Validado con Mercadeo y lanzado a toda la organización',
        desde: 1,
        hasta: 2,
      },
      {
        nombre: 'Compras con explosión continua',
        detalle: 'La sábana y las requisiciones salen de la explosión, que se recalcula con cada consumo',
        desde: 3,
        hasta: 7,
      },
      {
        nombre: 'Venta con cartera, ruta y sell-out',
        detalle: 'La cartera en el teléfono del vendedor y la venta del día en una sola versión',
        desde: 3,
        hasta: 7,
      },
      {
        nombre: 'Pagos que se aplican solos',
        detalle: 'Los dieciséis bancos cruzados con la deuda, y un solo flujo de caja',
        desde: 3,
        hasta: 7,
        hito: { en: 7, texto: 'Punto de control · los Excel se retiraron' },
      },
    ],
  },
  {
    tono: 'desarrollo',
    nombre: 'Desarrollo organizacional',
    filas: [
      {
        nombre: 'Activación de la dirección',
        detalle: 'Acuerdos de funcionamiento, reunión mensual y descarga de asuntos operativos',
        desde: HOY,
        hasta: 3,
        hito: { en: HOY, texto: 'Sesión de inicio · 21 de octubre' },
      },
      {
        nombre: 'Activación de la gerencia',
        detalle: 'Sesión de inicio, espacio periódico de gerentes y niveles de autoridad',
        desde: 3,
        hasta: 6,
      },
      {
        nombre: 'Gestión del desempeño',
        detalle: 'Vinculada al plan 2027, comunicada antes del segundo semestre',
        desde: 3,
        hasta: 6,
      },
      {
        nombre: 'Estructura y guía de responsabilidades',
        detalle: 'La estructura organizativa y las responsabilidades de cada cargo, en el aplicativo',
        desde: 6,
        hasta: 12,
      },
      {
        nombre: 'Acompañamiento a la dirección',
        detalle: 'Sesión semanal con la Gerencia General y con Gestión Organizacional',
        desde: 1,
        hasta: 13,
      },
    ],
  },
  {
    tono: 'procesos',
    nombre: 'Procesos y marcos de referencia',
    filas: [
      {
        nombre: 'Base de conocimiento',
        detalle: 'Con el levantamiento de la Fase 1 y los insumos de Calidad',
        desde: 1,
        hasta: 3,
      },
      {
        nombre: 'Marcos de referencia',
        detalle: 'La visión, la misión y los valores revisados, de donde salen las políticas',
        desde: 1,
        hasta: 6,
      },
      {
        nombre: 'Compras, comercial y finanzas',
        detalle: 'Sus procesos y políticas se validan primero, para que los módulos se apoyen en ellos',
        desde: 1,
        hasta: 6,
      },
      {
        nombre: 'El resto de la organización',
        detalle: 'Validado por comité: Calidad, el dueño del proceso y la dirección del área',
        desde: 6,
        hasta: 9,
        hito: { en: 13, texto: 'Base de conocimiento en manos de Calidad' },
      },
    ],
  },
]

const COLOR: Record<Tono, { barra: string; rotulo: string; punto: string }> = {
  tecnologia: { barra: 'bg-acento-500', rotulo: 'text-acento-600', punto: 'bg-acento-500' },
  desarrollo: { barra: 'bg-marca-700', rotulo: 'text-marca-800', punto: 'bg-marca-700' },
  procesos: { barra: 'bg-oro-400', rotulo: 'text-oro-700', punto: 'bg-oro-400' },
}

const pct = (m: number) => `${(m / TOTAL) * 100}%`

/** El cuadro. `grande` es la versión de la pantalla completa. */
function Cronograma({ grande = false }: { grande?: boolean }) {
  const columnas = grande ? 'grid-cols-[minmax(230px,300px)_1fr]' : 'grid-cols-[minmax(150px,200px)_1fr]'
  return (
    <div className={cn('min-w-[620px]', grande && 'min-w-0')}>
      {/* Los meses */}
      <div className={cn('grid items-end gap-x-3', columnas)}>
        <div />
        <div className="relative grid" style={{ gridTemplateColumns: `repeat(${TOTAL}, minmax(0, 1fr))` }}>
          {MESES.map((m, i) => (
            <div key={i} className="border-l border-marca-100 pl-1">
              <p className={cn('h-4 font-semibold text-marca-700', grande ? 'text-xs' : 'text-[10px]')}>{ANIOS[i] ?? ''}</p>
              <p className={cn('text-marca-500', grande ? 'text-sm' : 'text-xs')}>{m}</p>
            </div>
          ))}
        </div>
      </div>

      {VIAS.map((via) => (
        <div key={via.tono} className="mt-4">
          <p className={cn('rotulo mb-1.5', COLOR[via.tono].rotulo)}>{via.nombre}</p>
          {via.filas.map((f) => (
            <div key={f.nombre} className={cn('grid items-center gap-x-3 border-t border-marca-100', columnas, grande ? 'py-2' : 'py-1.5')}>
              <div className="min-w-0">
                <p className={cn('font-semibold leading-tight text-marca-900', grande ? 'text-base' : 'text-sm')}>{f.nombre}</p>
                <p className={cn('leading-snug text-marca-500', grande ? 'text-sm' : 'text-xs')}>{f.detalle}</p>
              </div>
              <div className={cn('relative', grande ? 'h-9' : 'h-7')}>
                {/* La cuadrícula de los meses y la línea del 21 de octubre */}
                <div className="absolute inset-0 grid" style={{ gridTemplateColumns: `repeat(${TOTAL}, minmax(0, 1fr))` }} aria-hidden>
                  {MESES.map((_, i) => (
                    <div key={i} className="border-l border-marca-100" />
                  ))}
                </div>
                <div className="absolute inset-y-0 border-l-2 border-dashed border-acento-300" style={{ left: pct(HOY) }} aria-hidden />
                <div
                  className={cn('absolute top-1/2 -translate-y-1/2 rounded-full', COLOR[via.tono].barra, grande ? 'h-5' : 'h-4')}
                  style={{ left: pct(f.desde), width: pct(f.hasta - f.desde) }}
                  title={`${f.nombre}: ${MESES[Math.floor(f.desde)]} a ${MESES[Math.ceil(f.hasta) - 1]}`}
                />
                {f.hito && (
                  <div className="absolute top-1/2 flex -translate-y-1/2 items-center" style={{ left: pct(f.hito.en) }}>
                    <span
                      className={cn('block -translate-x-1/2 rotate-45 border-2 border-white shadow', COLOR[via.tono].punto, grande ? 'h-4 w-4' : 'h-3 w-3')}
                      aria-hidden
                    />
                    <span
                      className={cn(
                        'absolute whitespace-nowrap rounded bg-white/90 px-1 font-medium text-marca-700',
                        grande ? 'text-xs' : 'text-[10px]',
                        f.hito.en > TOTAL - 3 ? 'right-2' : 'left-2',
                        '-top-4'
                      )}
                    >
                      {f.hito.texto}
                    </span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      ))}

      <div className={cn('mt-3 grid gap-x-3', columnas)}>
        <div />
        <p className={cn('text-marca-500', grande ? 'text-sm' : 'text-xs')}>
          <span className="mr-1 inline-block h-3 border-l-2 border-dashed border-acento-300 align-middle" aria-hidden />
          21 de octubre de 2026: entrega del Documento de Arquitectura
        </p>
      </div>
    </div>
  )
}

const sinSuscripcion = () => () => {}

export function GanttNuevaIberia() {
  const dialogo = useRef<HTMLDialogElement>(null)
  // El portal necesita el `body`, que en el servidor no existe.
  const enCliente = useSyncExternalStore(sinSuscripcion, () => true, () => false)

  const salirDePantallaCompleta = () => {
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {})
  }
  const cerrar = () => {
    salirDePantallaCompleta()
    dialogo.current?.close()
  }
  const pantallaCompleta = () => {
    if (document.fullscreenElement) salirDePantallaCompleta()
    else void dialogo.current?.requestFullscreen?.().catch(() => {})
  }

  useEffect(() => () => salirDePantallaCompleta(), [])

  return (
    <section className="not-prose mt-12" aria-labelledby="la-nueva-iberia-en-el-tiempo">
      <h2 id="la-nueva-iberia-en-el-tiempo" className="text-2xl font-semibold text-marca-900">
        La Nueva Iberia, en el tiempo
      </h2>
      <p className="mt-2 text-[17px] leading-[1.75] text-marca-700">
        Tres vías y un solo camino. La tecnología arranca con Tecnología de la Información, preparando la conexión
        con JD, y desde enero construye los alivios de compras, comercial y finanzas. En paralelo, el desarrollo
        organizacional empieza por la dirección, y los procesos de esas tres áreas se validan primero para que los
        módulos se apoyen en ellos.
      </p>

      <div className="tarjeta mt-6 overflow-x-auto p-4 sm:p-5">
        <Cronograma />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
        <button type="button" onClick={() => dialogo.current?.showModal()} className="btn-acento" aria-haspopup="dialog">
          Ver el cronograma en pantalla
        </button>
        <span className="text-sm text-marca-500">Para cerrar la presentación con él.</span>
      </div>

      <div className="prosa mt-6">
        <aside className="aviso-md aviso-clave">
        <p className="aviso-rotulo">Un cronograma tentativo</p>
        <p>
          Las fechas se ajustan; el orden y las dependencias, no. Los módulos arrancan cuando el espejo cuadra con JD
          todos los días: si la base está lista antes, se adelantan. Al cierre de abril de 2027, con los Excel de
          esas tres áreas retirados, la dirección decide la Fase 3.
        </p>
        </aside>
      </div>

      {enCliente &&
        createPortal(
          <dialog
            ref={dialogo}
            aria-label="Cronograma de la Nueva Iberia"
            className="m-0 h-dvh max-h-none w-screen max-w-none bg-[#f6f7f9] p-0 backdrop:bg-marca-950"
            onClose={salirDePantallaCompleta}
          >
            <div className="flex h-full flex-col">
              <div className="flex items-center gap-3 border-b border-marca-200 bg-white px-6 py-3">
                <div className="min-w-0 flex-1">
                  <p className="rotulo text-acento-600">La Nueva Iberia · tres vías</p>
                  <p className="text-xl font-semibold text-marca-900">Tecnología, desarrollo organizacional y procesos</p>
                </div>
                <button type="button" onClick={pantallaCompleta} className="btn-neutro hidden h-10 px-4 sm:inline-flex">
                  Pantalla completa
                </button>
                <button type="button" onClick={cerrar} className="btn-neutro h-10 w-10 p-0" aria-label="Cerrar el cronograma">
                  <IconoCerrar className="h-5 w-5" />
                </button>
              </div>
              <div className="flex-1 overflow-auto p-6">
                <div className="tarjeta mx-auto max-w-[1600px] overflow-x-auto p-6">
                  <Cronograma grande />
                </div>
                <p className="mx-auto mt-3 max-w-[1600px] text-sm text-marca-500">
                  Cronograma tentativo: las fechas se ajustan; el orden y las dependencias, no.
                </p>
              </div>
            </div>
          </dialog>,
          document.body
        )}
    </section>
  )
}
