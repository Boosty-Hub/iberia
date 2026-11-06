import type { Metadata } from 'next'
import Image from 'next/image'

export const metadata: Metadata = {
  title: { absolute: 'Política de privacidad · Iberia' },
  description: 'Qué datos usa la app de Iberia, para qué, quién los ve y cómo pedir que se corrijan o se borren.',
}

/**
 * La política de privacidad de la app de iOS. Pública a propósito
 * (`RUTAS_PUBLICAS` en `lib/supabase/sesion.ts`): Apple exige una dirección que
 * cualquiera pueda abrir sin cuenta, y quien la lea antes de instalar la app
 * todavía no tiene sesión.
 *
 * Lo que dice tiene que coincidir con lo que la app hace de verdad: al cambiar
 * quién lee una tabla, qué se le manda a un proveedor o qué permiso del teléfono
 * se pide, se cambia aquí el mismo día y la fecha de vigencia.
 */
export default function PrivacidadPage() {
  return (
    <main className="canal flex min-h-full flex-1 flex-col px-4 py-10 sm:py-14">
      <div className="mx-auto w-full max-w-2xl">
        <Image
          src="/marca/iberia.png"
          alt="Industrias Iberia"
          width={1400}
          height={362}
          priority
          style={{ height: 34, width: 'auto' }}
        />

        <p className="rotulo mt-10">Política de privacidad</p>
        <h1 className="mt-3 text-[26px] leading-tight font-bold tracking-tight text-balance text-marca-900 sm:text-3xl">
          Tus datos en la app de Iberia
        </h1>
        <p className="mt-3 text-sm text-marca-500">Vigente desde el 6 de noviembre de 2026</p>

        <p className="mt-6 text-[15px] leading-relaxed text-marca-700 sm:text-base">
          La app de Iberia es la herramienta de comunicación interna de Industrias Iberia: trae
          los comunicados y las noticias de la empresa, los mensajes entre compañeros y el
          curso de inteligencia artificial que dicta Ajito. Es solo para el personal de Iberia.
          Aquí te contamos qué datos usa, para qué, quién los ve y cómo pedir que se corrijan o
          se borren.
        </p>

        <section className="tarjeta-canal mt-8 px-5 py-6 sm:px-8" aria-labelledby="en-corto">
          <h2 id="en-corto" className="text-lg font-bold text-marca-900">
            En corto
          </h2>
          <ul className="mt-4 space-y-3 text-[15px] leading-relaxed text-marca-700">
            <li className="flex gap-3">
              <Punto />
              Los datos son de Industrias Iberia. No se venden ni se usan para publicidad.
            </li>
            <li className="flex gap-3">
              <Punto />
              La app no te sigue fuera de ella, no usa tu ubicación y no lee tus contactos.
            </li>
            <li className="flex gap-3">
              <Punto />
              Lo que le respondes a Ajito no lo ven tu supervisor ni tus compañeros.
            </li>
            <li className="flex gap-3">
              <Punto />
              Puedes reportar lo que te incomode y bloquear a quien quieras. A la otra persona no
              se le dice quién la reportó ni que la bloqueaste.
            </li>
            <li className="flex gap-3">
              <Punto />
              Puedes pedir que se corrija o se borre lo tuyo.
            </li>
          </ul>
        </section>

        <article className="tarjeta-canal prosa mt-4 px-5 py-6 sm:px-8 sm:py-8">
          <h2>Quién es responsable</h2>
          <p>
            Los datos son de <strong>Industrias Iberia</strong>. <strong>Boosty Digital</strong>{' '}
            desarrolla y opera la app por encargo de Iberia, como parte del programa de adopción
            de inteligencia artificial, y solo usa los datos para eso.
          </p>

          <h2>Qué datos usa la app</h2>
          <h3>Los que vienen de Capital Humano</h3>
          <p>
            Tu nombre, tu número de ficha, tu cargo, tu área, tu sede y tu oficio, y, cuando
            Capital Humano los tiene, tu cédula y tu número de teléfono. No los escribes tú:
            salen del listado de personal de la empresa. Si algo está mal, se corrige allá.
          </p>

          <h3>Lo que haces en el canal</h3>
          <p>
            Las publicaciones, los comentarios y las reacciones que dejas; los mensajes que
            mandas en conversaciones y grupos; las conexiones que solicitas o aceptas, y qué
            comunicados abriste.
          </p>

          <h3>Reportes y bloqueos</h3>
          <p>
            Cuando reportas una publicación, un comentario o un mensaje, se guarda el reporte:
            qué reportaste, quién lo escribió, quién lo reportó, el motivo que escogiste, lo que
            hayas querido añadir, la fecha y una copia del texto reportado tal como estaba. Y
            cuando bloqueas a una persona, se guarda a quién bloqueaste.
          </p>

          <h3>Lo que haces en el curso de Ajito</h3>
          <p>
            Tus respuestas a los ejercicios —escritas, en notas de voz o en fotos—, los dibujos
            que le pides a Ajito, tus conversaciones con Ajito, el nombre con el que prefieres
            que te llame, tu avance en las lecciones y tu certificado. Si avisas que tu nombre o
            tu área están mal, también se guarda ese aviso, para que Capital Humano lo corrija.
          </p>

          <h3>Para entrar</h3>
          <p>
            Tu cuenta y el enlace personal que te llega por WhatsApp. Del enlace no se guarda el
            texto, sino una huella que permite reconocerlo; también se anota cuántas veces lo
            usaste. Mientras tienes la sesión abierta, el teléfono guarda una cookie que la
            mantiene: no hay cookies de publicidad ni de medición.
          </p>

          <h3>Para las notificaciones</h3>
          <p>
            Si aceptas recibir notificaciones, se guarda el identificador que Apple le asigna a
            tu teléfono para hacértelas llegar. Solo sirve para eso.
          </p>

          <h2>Los permisos del teléfono</h2>
          <ul>
            <li>
              <strong>Micrófono</strong>: solo cuando tocas para grabar una nota de voz.
            </li>
            <li>
              <strong>Cámara y fotos</strong>: solo cuando escoges tomar o mandar una foto.
            </li>
            <li>
              <strong>Guardar en tus fotos</strong>: solo cuando decides guardar una imagen,
              como tu certificado.
            </li>
            <li>
              <strong>Notificaciones</strong>: solo si las aceptas.
            </li>
          </ul>
          <p>
            Puedes quitar cualquiera de estos permisos cuando quieras, en los Ajustes del
            teléfono, en el apartado de Iberia.
          </p>

          <h2>Para qué se usan</h2>
          <ul>
            <li>
              Para que el canal y el curso funcionen: mostrarte los comunicados, entregar tus
              mensajes, guardar tu avance y emitir tu certificado.
            </li>
            <li>
              Para que Ajito te conteste: tu respuesta, el nombre con el que te llama y tu oficio
              se procesan con servicios de inteligencia artificial y de voz, que transcriben lo
              que grabas, preparan la respuesta y la leen en voz alta.
            </li>
            <li>
              Para que la empresa sepa cómo avanza el curso: la dirección de Iberia ve cifras por
              área y por oficio, sin nombres.
            </li>
            <li>
              Para recordarte el curso por WhatsApp y, si las aceptas, mandarte notificaciones.
            </li>
            <li>
              Para cuidar el canal: revisar lo que la gente reporta y, si hace falta, ocultarlo.
              Y para que lo que bloqueas deje de aparecerte y de avisarte.
            </li>
          </ul>

          <h2>Quién ve qué</h2>
          <ul>
            <li>
              <strong>Tu nombre, tu cargo y tu área</strong>: las demás personas del canal. Es lo
              que permite encontrarte y escribirte.
            </li>
            <li>
              <strong>Lo que publicas, comentas o reaccionas</strong>: quienes pueden ver esa
              publicación.
            </li>
            <li>
              <strong>Tus mensajes</strong>: solo quienes participan en esa conversación o en ese
              grupo.
            </li>
            <li>
              <strong>Qué comunicados abriste</strong>: el equipo que publica los comunicados,
              para saber si llegaron.
            </li>
            <li>
              <strong>Tus reportes</strong>: quienes administran el programa, que son el equipo de
              Boosty Digital y la persona que lo administra por Iberia, y nadie más. La persona
              que reportaste no sabe que fuiste tú. De un mensaje privado que reportes, el equipo
              solo lee ese mensaje, no el resto de la conversación.
            </li>
            <li>
              <strong>A quién bloqueaste</strong>: solo tú. La persona bloqueada no lo ve ni se
              entera; lo único que nota es que ya no puede escribirte. Los comunicados oficiales
              de la empresa se siguen viendo aunque hayas bloqueado a quien los firma.
            </li>
            <li>
              <strong>Tus respuestas del curso, tus notas de voz, tus fotos, tus dibujos y tus
              conversaciones con Ajito</strong>: tú y quienes administran el programa, que son el
              equipo de Boosty Digital y la persona que lo administra por Iberia. Tu supervisor y
              el resto de la empresa no las ven.
            </li>
            <li>
              <strong>Tu avance en el curso</strong>: quienes administran el programa. La
              dirección de Iberia solo ve las cifras por área y por oficio.
            </li>
            <li>
              <strong>Tu certificado</strong>: tú, quienes administran el programa y las personas
              de Iberia que lo registran y te lo entregan.
            </li>
            <li>
              <strong>Lo que decidas publicar en el canal</strong>, como tu certificado o el
              escudo que hiciste con Ajito: tus compañeros. El certificado que se publica no
              lleva tu cédula.
            </li>
          </ul>

          <h2>Quién más trata los datos</h2>
          <p>
            Para funcionar, la app se apoya en proveedores que tratan los datos por encargo y
            solo reciben lo que necesitan para hacer su parte:
          </p>
          <ul>
            <li>los servicios en la nube donde viven la app, sus datos y sus archivos;</li>
            <li>
              los servicios de inteligencia artificial y de voz que transcriben tus notas de voz,
              preparan las respuestas de Ajito, las leen en voz alta y hacen los dibujos;
            </li>
            <li>Apple, para hacer llegar las notificaciones;</li>
            <li>WhatsApp, por donde te llegan tu enlace personal y los recordatorios.</li>
          </ul>
          <p>
            A cada uno se le exige el mismo cuidado con los datos que describe esta política.
            Ninguno los recibe para usarlos en algo propio.
          </p>

          <h2>Cómo se cuidan</h2>
          <p>
            La información viaja cifrada. Cada persona solo puede ver lo que esta política dice,
            y esa regla la aplica la base de datos, no solo la pantalla. Las notas de voz y las
            fotos se guardan en un almacenamiento privado y se abren con enlaces que vencen en
            segundos.
          </p>

          <h2>Cuánto tiempo se guardan</h2>
          <p>
            Mientras dure el programa y estés en el listado de personal de Iberia. El enlace
            personal deja de funcionar a los 120 días o cuando sales del listado. Un bloqueo dura
            hasta que lo deshaces, en Mi perfil, en «Personas bloqueadas». Los reportes se
            conservan mientras dure el programa, para poder revisarlos. El certificado
            se conserva, porque queda registrado en Capital Humano. Al cierre del programa,
            Industrias Iberia decide qué se archiva y qué se borra.
          </p>

          <h2>Tus derechos</h2>
          <p>
            Puedes pedir una copia de tus datos, que se corrijan o que se borre lo que dejaste en
            el canal o en el curso. Pídeselo a Capital Humano de Industrias Iberia. Lo que viene
            del listado de personal se corrige ahí mismo, y borrar el avance del curso borra
            también tu certificado.
          </p>

          <h2>Menores de edad</h2>
          <p>La app es para el personal de Industrias Iberia y no está dirigida a menores de edad.</p>

          <h2>Cambios a esta política</h2>
          <p>
            Si esta política cambia, se avisará en el canal y se actualizará la fecha de
            vigencia de arriba.
          </p>
        </article>

        <p className="mt-8 text-center text-xs leading-relaxed text-marca-400">
          Industrias Iberia · App operada por Boosty Digital
        </p>
      </div>
    </main>
  )
}

/** La viñeta roja de los rótulos, en grande: marca cada punto del resumen. */
function Punto() {
  return <span aria-hidden className="mt-2 h-2 w-2 shrink-0 rounded-full bg-acento-500" />
}
