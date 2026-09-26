'use client'

import { useState, useTransition } from 'react'
import { avanzarPaso, corregirPadron } from '@/app/canal/(dentro)/adiestramiento/acciones'
import { BotonSigue, Girando } from '@/components/canal/boton-sigue'

/**
 * «¿Eres tú?», debajo de la tarjeta del padrón de la lección 0.
 *
 * «Sí, soy yo» sigue como cualquier botón del curso. «No soy yo» abre ahí mismo
 * dos campos —cómo se llama y en qué área trabaja— y al mandarlos queda la marca
 * para Capital Humano (`correcciones_padron`) y la lección sigue igual, que es
 * lo que dice el guion. Hasta el 26 de septiembre el botón solo avanzaba: quien
 * decía que no, no tenía dónde decir quién era.
 *
 * Solo el nombre es obligatorio. Quien tiene bien el área y mal escrito el
 * apellido no tiene por qué inventarse qué poner en el segundo campo.
 */
export function QuienEres({
  numero,
  turno,
  si,
  no,
}: {
  numero: number
  turno: number
  /** Los rótulos salen del guion: «Sí, soy yo» y «No soy yo». */
  si: string
  no: string
}) {
  const [abierto, setAbierto] = useState(false)
  const [nombre, setNombre] = useState('')
  const [area, setArea] = useState('')
  const [fallo, setFallo] = useState(false)
  const [mandando, iniciar] = useTransition()

  function mandar() {
    const datos = new FormData()
    datos.set('numero', String(numero))
    datos.set('turno', String(turno))
    datos.set('nombre', nombre)
    datos.set('area', area)
    setFallo(false)
    iniciar(async () => {
      const { ok } = await corregirPadron(datos)
      if (!ok) setFallo(true)
    })
  }

  if (!abierto) {
    return (
      <div className="flex flex-wrap gap-2">
        <form action={avanzarPaso} className="min-w-[45%] flex-1">
          <input type="hidden" name="numero" value={numero} />
          <input type="hidden" name="turno" value={turno} />
          <BotonSigue>{si}</BotonSigue>
        </form>
        <button
          type="button"
          onClick={() => setAbierto(true)}
          className="btn-canal btn-canal-rojo btn-canal-sigue min-w-[45%] flex-1"
        >
          {no}
        </button>
      </div>
    )
  }

  const listo = nombre.trim().length >= 2

  return (
    <form
      data-corregir-padron
      className="tarjeta-canal space-y-3 px-5 py-4"
      onSubmit={(evento) => {
        evento.preventDefault()
        if (listo && !mandando) mandar()
      }}
    >
      <p className="text-[11px] font-bold tracking-[0.12em] text-marca-400 uppercase">
        Corrígelo aquí
      </p>

      <div className="space-y-1.5">
        <label htmlFor="padron-nombre" className="block text-[14px] font-semibold text-marca-800">
          ¿Cómo te llamas?
        </label>
        <input
          id="padron-nombre"
          value={nombre}
          onChange={(evento) => setNombre(evento.target.value)}
          autoComplete="name"
          autoCapitalize="words"
          maxLength={120}
          placeholder="Tu nombre y tu apellido"
          className="campo min-h-11 w-full text-[15px]"
          autoFocus
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="padron-area" className="block text-[14px] font-semibold text-marca-800">
          ¿En qué área trabajas?
        </label>
        <input
          id="padron-area"
          value={area}
          onChange={(evento) => setArea(evento.target.value)}
          maxLength={120}
          placeholder="Si también está mal. Por ejemplo: envasado"
          className="campo min-h-11 w-full text-[15px]"
        />
      </div>

      <p className="text-[13px] leading-relaxed text-marca-500">
        Se le avisa a Capital Humano para que lo corrija. El curso sigue igual.
      </p>

      {fallo && (
        <p className="rounded-xl bg-acento-50 px-3 py-2 text-[14px] text-acento-700">
          No se pudo mandar. Revisa el nombre e intenta otra vez.
        </p>
      )}

      <button
        type="submit"
        disabled={!listo || mandando}
        aria-busy={mandando}
        className="btn-canal btn-canal-rojo btn-canal-sigue w-full"
      >
        {mandando && <Girando />}
        Mandar y seguir
      </button>
      <button
        type="button"
        disabled={mandando}
        onClick={() => setAbierto(false)}
        className="toque w-full text-[14px] font-medium text-marca-500 underline underline-offset-4 active:text-marca-800"
      >
        Mejor sí soy yo
      </button>
    </form>
  )
}
