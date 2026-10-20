'use client'

import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import Image from 'next/image'
import { IconoCerrar } from '@/components/iconos'

/**
 * «De operar a conducir», la presentación del señor Carlos para la entrega del 21 de
 * octubre, para mostrarla desde el informe con el diseño de Iberia (pedido de Gabriel, 20 de
 * octubre de 2026, sobre su «IBERIA De operar a conducir.pptx»). Ocho láminas con el texto
 * tal cual; la paleta del original pasa a la de Iberia: el naranja al rojo, el verde azulado
 * al dorado y el azul marino al carbón.
 *
 * Un botón abre un `<dialog>` modal a pantalla completa: el navegador encierra el foco y
 * cierra con Escape. Se pasa con las flechas, la barra espaciadora, un toque en la mitad
 * derecha o izquierda de la lámina, o deslizando en el teléfono. Las láminas son 16:9 y el
 * texto se mide en `cqw`, así que se ven igual en un proyector y en un teléfono.
 *
 * ⚠️ El diálogo va por portal al `body`: el botón vive dentro de `.prosa`, y sus reglas
 * (`.prosa p`, `.prosa ol`) pintaban de gris el texto blanco de las tarjetas oscuras.
 */

const sinSuscripcion = () => () => {}

const t = (cqw: number): CSSProperties => ({ fontSize: `${cqw}cqw` })
const caja = (radio = 1.4): CSSProperties => ({ borderRadius: `${radio}cqw` })

function Encabezado() {
  return (
    <div className="flex items-center justify-between" style={{ gap: '2cqw' }}>
      <Image src="/marca/iberia.png" alt="Industrias Iberia" width={1400} height={362} style={{ height: '3.2cqw', width: 'auto' }} />
      <span className="font-semibold tracking-[0.14em] text-marca-400 uppercase" style={t(1.05)}>
        Desarrollo organizacional · De operar a conducir
      </span>
    </div>
  )
}

function Marco({ titulo, numero, total, children }: { titulo: string; numero: number; total: number; children: ReactNode }) {
  return (
    <div className="flex h-full flex-col bg-white" style={{ padding: '3cqw 4.4cqw 2.4cqw' }}>
      <Encabezado />
      <h2 className="font-bold tracking-tight text-marca-900" style={{ ...t(3.4), marginTop: '2.2cqw', lineHeight: 1.1 }}>
        {titulo}
      </h2>
      <div className="min-h-0 flex-1" style={{ marginTop: '2.2cqw' }}>
        {children}
      </div>
      <div
        className="flex items-center justify-between border-t-2 border-acento-500 text-marca-400"
        style={{ ...t(1.05), paddingTop: '1cqw', marginTop: '1.6cqw' }}
      >
        <span>Industrias Iberia · Entrega de la Fase 1 · 21 de octubre de 2026</span>
        <span className="font-mono">
          {numero} / {total}
        </span>
      </div>
    </div>
  )
}

/** La brújula de la dirección y el grupo de capital humano, como los íconos del original. */
function IconoBrujula() {
  return (
    <svg viewBox="0 0 24 24" className="h-full w-full" aria-hidden>
      <circle cx="12" cy="12" r="11" className="fill-white" />
      <path d="M16.6 6.4 13.4 13.4 6.4 16.6 9.6 9.6z" className="fill-acento-500" />
      <circle cx="12" cy="12" r="1.4" className="fill-white" />
    </svg>
  )
}

function IconoGente() {
  return (
    <svg viewBox="0 0 24 24" className="h-full w-full" aria-hidden>
      <circle cx="12" cy="8" r="3.4" className="fill-white" />
      <path d="M5.8 19.5c0-3.6 2.8-5.8 6.2-5.8s6.2 2.2 6.2 5.8z" className="fill-white" />
      <circle cx="5.4" cy="9.6" r="2.2" className="fill-white/70" />
      <circle cx="18.6" cy="9.6" r="2.2" className="fill-white/70" />
    </svg>
  )
}

function Lista({ items, tono }: { items: ReactNode[]; tono: 'rojo' | 'oro' }) {
  return (
    <ol className="grid h-full" style={{ gap: '1cqw', gridTemplateRows: `repeat(${items.length}, minmax(0, 1fr))` }}>
      {items.map((item, i) => (
        <li key={i} className="flex items-center border border-marca-200 bg-[#f6f7f9] text-marca-800" style={{ ...caja(1.1), padding: '0 2.2cqw', gap: '1.8cqw' }}>
          <span
            className={`flex shrink-0 items-center justify-center font-bold ${tono === 'rojo' ? 'bg-acento-500 text-white' : 'bg-oro-300 text-marca-900'}`}
            style={{ ...t(1.6), width: '3.2cqw', height: '3.2cqw', borderRadius: '0.8cqw' }}
          >
            {i + 1}
          </span>
          <span style={{ ...t(1.9), lineHeight: 1.25 }}>{item}</span>
        </li>
      ))}
    </ol>
  )
}

/* ------------------------------ Las láminas ------------------------------ */

function Portada() {
  return (
    <div className="relative flex h-full flex-col bg-white" style={{ padding: '4cqw 6cqw' }}>
      <Image
        src="/marca/iberia.png"
        alt="Industrias Iberia"
        width={1400}
        height={362}
        className="self-start"
        style={{ height: '4.6cqw', width: 'auto' }}
      />
      <div className="flex flex-1 flex-col justify-center">
        <span className="block bg-acento-500" style={{ width: '6cqw', height: '0.7cqw', borderRadius: '0.4cqw' }} />
        <h2 className="font-bold tracking-tight text-marca-900" style={{ ...t(6.4), marginTop: '2.4cqw', lineHeight: 1.05 }}>
          De operar a conducir
        </h2>
        <p className="text-marca-600" style={{ ...t(2.2), marginTop: '1.8cqw', maxWidth: '70cqw', lineHeight: 1.35 }}>
          El rol de la dirección: conducción estratégica, integración y acompañamiento
        </p>
      </div>
      <div className="flex items-end justify-between text-marca-400" style={t(1.2)}>
        <span>Programa de adopción de IA · Desarrollo organizacional</span>
        <span>Entrega de la Fase 1 · 21 de octubre de 2026</span>
      </div>
      <span className="absolute inset-x-0 bottom-0 bg-acento-500" style={{ height: '0.6cqw' }} />
    </div>
  )
}

function TresLineas({ numero, total }: { numero: number; total: number }) {
  const lineas = [
    { nombre: 'Desarrollo organizacional', puntos: ['Desarrollo humano', 'Clima organizacional'] },
    { nombre: 'Procesos y marcos de referencia', puntos: ['Documentación y difusión', 'Políticas, normas y procedimientos'] },
    { nombre: 'Tecnología', puntos: ['Implementación de la IA'], acento: true },
  ]
  return (
    <Marco titulo="Las tres líneas de intervención" numero={numero} total={total}>
      <div className="grid h-full" style={{ gap: '1.4cqw', gridTemplateRows: 'repeat(3, minmax(0, 1fr))' }}>
        {lineas.map((l, i) => (
          <div key={l.nombre} className="grid overflow-hidden border border-marca-200" style={{ ...caja(), gridTemplateColumns: '32% 1fr' }}>
            <div className={`flex flex-col justify-center text-white ${l.acento ? 'bg-acento-500' : 'bg-marca-800'}`} style={{ padding: '0 2.2cqw' }}>
              <span className="font-mono opacity-70" style={t(1.1)}>
                Línea {i + 1}
              </span>
              <span className="font-bold" style={{ ...t(2.1), lineHeight: 1.15 }}>
                {l.nombre}
              </span>
            </div>
            <ul className="flex flex-col justify-center bg-[#f6f7f9] text-marca-800" style={{ padding: '0 2.6cqw', gap: '0.6cqw' }}>
              {l.puntos.map((p) => (
                <li key={p} className="flex items-center" style={{ ...t(2), gap: '1.2cqw' }}>
                  <span className={`shrink-0 rounded-full ${l.acento ? 'bg-acento-500' : 'bg-marca-400'}`} style={{ width: '0.8cqw', height: '0.8cqw' }} />
                  {p}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </Marco>
  )
}

function Desarrollo({ numero, total }: { numero: number; total: number }) {
  const tarjetas = [
    {
      icono: <IconoBrujula />,
      fondo: 'bg-marca-800',
      rotulo: 'La dirección',
      texto: (
        <>
          El rol de dirección debe evolucionar hacia la formulación de planes estratégicos, definición de marcos de
          referencia <strong className="font-semibold text-marca-900">«vivos»</strong>, para la gestión empresarial y
          apoyo y facilitación de la gestión operativa de los gerentes.
        </>
      ),
    },
    {
      icono: <IconoGente />,
      fondo: 'bg-acento-500',
      rotulo: 'Capital Humano',
      texto: (
        <>
          La función de Capital Humano debe evolucionar a{' '}
          <strong className="font-semibold text-marca-900">Gestión Organizacional</strong>, responsable de facilitar los
          procesos humanos para alinearlos con las finalidades del negocio.
        </>
      ),
    },
  ]
  return (
    <Marco titulo="Desarrollo organizacional" numero={numero} total={total}>
      <div className="grid h-full" style={{ gap: '1.6cqw', gridTemplateRows: '1fr 1fr' }}>
        {tarjetas.map((c) => (
          <div key={c.rotulo} className="flex items-center border border-marca-200 bg-[#f6f7f9]" style={{ ...caja(1.6), padding: '0 3cqw', gap: '3cqw' }}>
            <div className={`flex shrink-0 items-center justify-center rounded-full ${c.fondo}`} style={{ width: '9cqw', height: '9cqw', padding: '2.2cqw' }}>
              {c.icono}
            </div>
            <div>
              <span className="block font-semibold tracking-[0.12em] text-acento-600 uppercase" style={t(1.15)}>
                {c.rotulo}
              </span>
              <p className="text-marca-700" style={{ ...t(2), lineHeight: 1.4, marginTop: '0.6cqw' }}>
                {c.texto}
              </p>
            </div>
          </div>
        ))}
      </div>
    </Marco>
  )
}

function CambioDeEnfoque({ numero, total }: { numero: number; total: number }) {
  const pilares = [
    { texto: 'Integración interfuncional', color: 'bg-acento-500' },
    { texto: 'Cooperación interna', color: 'bg-oro-300' },
    { texto: 'Dirección como facilitadora del nivel gerencial', color: 'bg-marca-800' },
  ]
  return (
    <Marco titulo="Un cambio de enfoque en el rol" numero={numero} total={total}>
      <div className="flex h-full flex-col" style={{ gap: '3cqw' }}>
        <div className="grid" style={{ gridTemplateColumns: '1fr auto 1fr', gap: '1.6cqw', alignItems: 'stretch' }}>
          <div className="border border-marca-200 bg-white" style={{ ...caja(1.6), padding: '2.4cqw 2.8cqw' }}>
            <span className="block font-semibold tracking-[0.12em] text-marca-400 uppercase" style={t(1.3)}>
              De
            </span>
            <p className="text-marca-900" style={{ ...t(2.3), lineHeight: 1.3, marginTop: '0.8cqw' }}>
              Predominio de lo operacional: resolver, supervisar y hacer.
            </p>
          </div>
          <div className="flex items-center text-acento-500" style={t(3.6)} aria-hidden>
            →
          </div>
          <div className="bg-marca-800" style={{ ...caja(1.6), padding: '2.4cqw 2.8cqw' }}>
            <span className="block font-semibold tracking-[0.12em] text-oro-300 uppercase" style={t(1.3)}>
              A
            </span>
            <p className="text-white" style={{ ...t(2.3), lineHeight: 1.3, marginTop: '0.8cqw' }}>
              Predominio de la conducción estratégica: orientar, acompañar y facilitar.
            </p>
          </div>
        </div>
        <div className="grid" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '2cqw' }}>
          {pilares.map((p) => (
            <div key={p.texto}>
              <span className={`block ${p.color}`} style={{ height: '0.5cqw', borderRadius: '0.3cqw' }} />
              <p className="font-semibold text-marca-900" style={{ ...t(2), lineHeight: 1.25, marginTop: '1.2cqw' }}>
                {p.texto}
              </p>
            </div>
          ))}
        </div>
      </div>
    </Marco>
  )
}

function ResponsabilidadesDireccion({ numero, total }: { numero: number; total: number }) {
  return (
    <Marco titulo="Responsabilidades de la dirección" numero={numero} total={total}>
      <Lista
        tono="rojo"
        items={[
          'Definir lo que se quiere lograr',
          'Establecer las reglas del juego',
          'Disponer los recursos necesarios',
          'Hacer seguimiento y acompañamiento, sin operar directamente',
          'Realizar los ajustes de rumbo',
        ]}
      />
    </Marco>
  )
}

function ResponsabilidadesGerencia({ numero, total }: { numero: number; total: number }) {
  return (
    <Marco titulo="Responsabilidades de la gerencia" numero={numero} total={total}>
      <Lista
        tono="oro"
        items={[
          'Definir y proponer el cómo, dentro de las reglas aprobadas y con los recursos disponibles',
          'Coordinar las acciones operativas',
          'Gestionar los recursos según el flujo de actividades y los planes aprobados',
          'Retroalimentar a la dirección sobre la marcha de los procesos',
        ]}
      />
    </Marco>
  )
}

function Ciclo({ numero, total }: { numero: number; total: number }) {
  const pasos = [
    { titulo: 'La Dirección define', texto: 'Qué se logra, reglas y recursos.', color: 'bg-acento-500', oscuro: false },
    { titulo: 'La Gerencia propone', texto: 'El cómo y la coordinación operativa.', color: 'bg-oro-300', oscuro: false },
    { titulo: 'Se ejecuta', texto: 'Gestión de recursos según los planes aprobados.', color: 'bg-oro-300', oscuro: false },
    { titulo: 'La Dirección ajusta', texto: 'Seguimiento, retroalimentación y rumbo.', color: 'bg-acento-500', oscuro: true },
  ]
  return (
    <Marco titulo="Dos niveles, un mismo ciclo" numero={numero} total={total}>
      <div className="flex h-full flex-col justify-center" style={{ gap: '3cqw' }}>
        <div className="flex items-stretch" style={{ gap: '0.8cqw' }}>
          {pasos.map((p, i) => (
            <div key={p.titulo} className="flex flex-1 items-stretch" style={{ gap: '0.8cqw' }}>
              <div
                className={`flex flex-1 flex-col overflow-hidden border ${p.oscuro ? 'border-marca-800 bg-marca-800' : 'border-marca-200 bg-[#f6f7f9]'}`}
                style={caja(1.4)}
              >
                <span className={`block ${p.color}`} style={{ height: '0.7cqw' }} />
                <div style={{ padding: '1.8cqw 1.8cqw 2.2cqw' }}>
                  <p className={`font-bold ${p.oscuro ? 'text-white' : 'text-marca-900'}`} style={{ ...t(1.9), lineHeight: 1.2 }}>
                    {p.titulo}
                  </p>
                  <p className={p.oscuro ? 'text-marca-200' : 'text-marca-600'} style={{ ...t(1.6), lineHeight: 1.35, marginTop: '1cqw' }}>
                    {p.texto}
                  </p>
                </div>
              </div>
              {i < pasos.length - 1 && (
                <span className="flex items-center text-acento-500" style={t(2.6)} aria-hidden>
                  →
                </span>
              )}
            </div>
          ))}
        </div>
        <p className="text-center text-marca-600" style={{ ...t(1.9), lineHeight: 1.35 }}>
          Cada nivel asume su parte, y la cooperación entre áreas sostiene el ciclo completo.
        </p>
      </div>
    </Marco>
  )
}

function AspectosClave({ numero, total }: { numero: number; total: number }) {
  const items = [
    ['Cooperación interna.', 'Las áreas se apoyan en lugar de competir entre sí.'],
    ['Integración interfuncional.', 'Procesos y decisiones pensados para toda la empresa.'],
    ['Acompañamiento y facilitación de procesos.', 'La dirección habilita, no reemplaza.'],
    ['Comunicación efectiva.', 'Claridad en lo esperado e información en ambos sentidos.'],
    ['Gestión del desempeño.', 'Metas claras, seguimiento y retroalimentación.'],
  ]
  return (
    <Marco titulo="Aspectos clave a considerar" numero={numero} total={total}>
      <Lista
        tono="rojo"
        items={items.map(([a, b]) => (
          <>
            <strong className="font-semibold text-marca-900">{a}</strong> {b}
          </>
        ))}
      />
    </Marco>
  )
}

const LAMINAS: Array<(p: { numero: number; total: number }) => ReactNode> = [
  () => <Portada />,
  TresLineas,
  Desarrollo,
  CambioDeEnfoque,
  ResponsabilidadesDireccion,
  ResponsabilidadesGerencia,
  Ciclo,
  AspectosClave,
]

export function PresentacionOperarConducir() {
  const dialogo = useRef<HTMLDialogElement>(null)
  const [actual, setActual] = useState(0)
  const inicioToque = useRef<number | null>(null)
  const total = LAMINAS.length

  const ir = useCallback(
    (paso: number) => setActual((a) => Math.min(total - 1, Math.max(0, a + paso))),
    [total]
  )

  // El portal necesita el `body`, que en el servidor no existe.
  const enCliente = useSyncExternalStore(sinSuscripcion, () => true, () => false)

  useEffect(() => {
    const el = dialogo.current
    if (!el) return
    const tecla = (ev: KeyboardEvent) => {
      if (!el.open) return
      if (['ArrowRight', 'PageDown', ' ', 'Enter'].includes(ev.key)) {
        ev.preventDefault()
        ir(1)
      } else if (['ArrowLeft', 'PageUp', 'Backspace'].includes(ev.key)) {
        ev.preventDefault()
        ir(-1)
      } else if (ev.key === 'Home') setActual(0)
      else if (ev.key === 'End') setActual(total - 1)
    }
    el.addEventListener('keydown', tecla)
    return () => el.removeEventListener('keydown', tecla)
  }, [ir, total, enCliente])

  const abrir = () => {
    setActual(0)
    dialogo.current?.showModal()
  }
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

  const Lamina = LAMINAS[actual]

  return (
    <>
      <button type="button" onClick={abrir} className="btn-acento" aria-haspopup="dialog">
        Presentar «De operar a conducir»
      </button>

      {enCliente &&
        createPortal(
      <dialog
        ref={dialogo}
        aria-label="Presentación: De operar a conducir"
        className="m-0 h-dvh max-h-none w-screen max-w-none bg-marca-950 p-0 text-white backdrop:bg-marca-950"
        onClose={salirDePantallaCompleta}
      >
        <div className="flex h-full flex-col items-center justify-center gap-4 p-4">
          <div
            className="relative w-full overflow-hidden rounded-xl shadow-2xl select-none"
            style={{ containerType: 'inline-size', maxWidth: 'min(1600px, calc((100dvh - 120px) * 16 / 9))', aspectRatio: '16 / 9' }}
            onPointerDown={(ev) => {
              inicioToque.current = ev.clientX
            }}
            onPointerUp={(ev) => {
              const desde = inicioToque.current
              inicioToque.current = null
              if (desde === null) return
              const delta = ev.clientX - desde
              if (Math.abs(delta) > 40) return ir(delta < 0 ? 1 : -1)
              const marco = ev.currentTarget.getBoundingClientRect()
              ir(ev.clientX - marco.left > marco.width / 2 ? 1 : -1)
            }}
          >
            <Lamina numero={actual + 1} total={total} />
          </div>

          <div className="flex items-center gap-2 text-sm">
            <button type="button" onClick={() => ir(-1)} disabled={actual === 0} className="btn-neutro h-10 px-4 disabled:opacity-40">
              ← Anterior
            </button>
            <span className="min-w-14 text-center font-mono text-marca-300" aria-live="polite">
              {actual + 1} / {total}
            </span>
            <button type="button" onClick={() => ir(1)} disabled={actual === total - 1} className="btn-neutro h-10 px-4 disabled:opacity-40">
              Siguiente →
            </button>
            <button type="button" onClick={pantallaCompleta} className="btn-neutro ml-2 hidden h-10 px-4 sm:inline-flex">
              Pantalla completa
            </button>
            <button type="button" onClick={cerrar} className="btn-neutro h-10 w-10 p-0" aria-label="Cerrar la presentación">
              <IconoCerrar className="h-5 w-5" />
            </button>
          </div>
        </div>
      </dialog>,
          document.body
        )}
    </>
  )
}
