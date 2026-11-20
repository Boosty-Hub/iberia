import { CORREO_SOPORTE } from '@/lib/normas'

/**
 * El texto de las normas de uso del canal. Uno solo para `/normas` —pública,
 * para quien la abre desde la tienda o el login— y para la pantalla que las pide
 * aceptar al entrar al canal: si fueran dos, dirían cosas distintas.
 *
 * Lo que promete tiene que ser verdad: el reporte con los tres puntos, el
 * bloqueo y la revisión del equipo en `/sistema/nucleo/canal/moderacion`. Si cambia algo que
 * obligue a aceptarlas otra vez, se sube `VERSION_NORMAS` en `lib/normas.ts`.
 */
export function NormasDeUso() {
  return (
    <div className="prosa">
      <p>
        El canal es para que el personal de Industrias Iberia se comunique con respeto. Al
        usarlo, aceptas estas normas.
      </p>

      <h2>Tolerancia cero</h2>
      <p>No se permite publicar, comentar ni mandar por mensaje:</p>
      <ul>
        <li>acoso, insultos o burlas contra una persona;</li>
        <li>contenido que promueva el odio o la discriminación por cualquier motivo;</li>
        <li>contenido sexual;</li>
        <li>violencia o amenazas;</li>
        <li>spam, cadenas o publicidad;</li>
        <li>datos personales de otra persona sin su permiso.</li>
      </ul>
      <p>
        Tampoco se tolera a quien use el canal para molestar a otros, aunque cada mensaje por
        separado parezca menor.
      </p>

      <h2>Reportar y bloquear</h2>
      <p>
        Cualquier persona puede <strong>reportar</strong> una publicación, un comentario o un
        mensaje desde el menú de los tres puntos (⋯) que lleva al lado. Y puede{' '}
        <strong>bloquear</strong> a quien la moleste: desde ese mismo menú, desde su
        conversación o desde el directorio. A la otra persona no se le dice quién la reportó
        ni que la bloquearon.
      </p>

      <h2>Qué hace el equipo</h2>
      <p>
        El equipo que administra el canal revisa los reportes <strong>en menos de 24 horas</strong>.
        Retira el contenido que rompe estas normas y <strong>suspende la cuenta</strong> de
        quien las rompe.
      </p>

      <h2>Contacto</h2>
      <p>
        Si algo te preocupa o necesitas ayuda, escríbenos a{' '}
        <a href={`mailto:${CORREO_SOPORTE}`}>{CORREO_SOPORTE}</a>.
      </p>
    </div>
  )
}
