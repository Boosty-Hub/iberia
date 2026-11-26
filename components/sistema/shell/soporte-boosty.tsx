'use client'

import { useEffect } from 'react'

/**
 * El botón «Ticket» del soporte de Boosty (26-nov-2026, pedido de Gabriel): un script autocontenido de
 * portal.boosty.digital que pinta su botón (azul y amarillo de Boosty, fijos) dentro de `#soporte-boosty`, antes del
 * menú de la persona, y abre un popup para mandar tickets —con grabación de pantalla— al equipo de Boosty.
 *
 * Solo en la plataforma (`/sistema`): ni en el Portal planta ni en las apps (decisión de Gabriel). Se carga desde el
 * portal, como viene: ⚠️ corre con la sesión de quien está dentro (riesgo aceptado por Gabriel; ver AGENTS.md). Se
 * inyecta en tiempo de ejecución porque lleva el nombre y el correo de la sesión, para que el popup no los pida.
 */
// La clave del widget solo vale en el dominio de producción: desde otro (localhost, pruebas) el portal responde 403.
const DOMINIOS = ['iberiavenezuela.netlify.app']

export function SoporteBoosty({ nombre, email }: { nombre: string; email: string }) {
  useEffect(() => {
    if (!DOMINIOS.includes(location.hostname)) return
    if (document.querySelector('script[data-boosty-key]')) return
    const s = document.createElement('script')
    s.src = 'https://portal.boosty.digital/boosty-support.js'
    s.async = true
    s.dataset.boostyKey = 'bw_pk_ec46ae1d14aca5b1364c7f9cde1e2924'
    s.dataset.boostyMount = '#soporte-boosty'
    s.dataset.boostyUserName = nombre
    s.dataset.boostyUserEmail = email
    document.body.appendChild(s)
  }, [nombre, email])

  return <div id="soporte-boosty" className="flex shrink-0 items-center" />
}
