import { correoIberia, DOMINIO_PUBLICO } from './diseno.ts'

/**
 * Las plantillas de correo de Supabase Auth, en español y con el diseño de la
 * plataforma. Las aplica `scripts/correo/plantillas-auth.mjs` por la Management API
 * (no viven en el panel de Supabase: lo que se cambia allá a mano se pisa aquí).
 *
 * Las variables `{{ .X }}` son de las plantillas de Go de Supabase y se dejan tal cual.
 *
 * 🔴 **Los enlaces van a `/auth/continuar`, no a `/auth/confirmar` ni a
 * `{{ .ConfirmationURL }}`.** Microsoft 365 (Safe Links / Defender) abre los enlaces de
 * un correo antes que la persona para revisarlos, y un enlace de un solo uso que se
 * consume con un GET llega gastado: «el enlace venció» sin haberlo tocado nadie.
 * `/auth/continuar` solo muestra un botón; el enlace se usa al tocarlo (POST).
 * Con `token_hash` sirve además en otro equipo que el que pidió el correo.
 *
 * El vencimiento que dicen los textos es `mailer_otp_exp` (3.600 s): si cambia allá,
 * cambia aquí.
 */

const VENCE = 'vence en 1 hora y sirve una sola vez'

const enlace = (tipo: string, siguiente: string) =>
  `{{ .SiteURL }}/auth/continuar?token_hash={{ .TokenHash }}&amp;type=${tipo}&amp;siguiente=${encodeURIComponent(siguiente)}`

const SI_NO_FUISTE =
  'Si no fuiste tú, cambia tu contraseña de inmediato desde «¿Olvidaste tu contraseña?» y avísale a la Gerencia de Tecnología.'

const recuperar = { texto: 'Recuperar mi cuenta', url: `${DOMINIO_PUBLICO}/login/recuperar` }

export type PlantillaAuth = { asunto: string; html: string }

/** Clave = el sufijo de `mailer_subjects_<clave>` y `mailer_templates_<clave>_content`. */
export const PLANTILLAS_AUTH: Record<string, PlantillaAuth> = {
  invite: {
    asunto: 'Tu acceso a la Plataforma Iberia',
    html: correoIberia({
      preencabezado: 'Crea tu contraseña para entrar a la Plataforma Iberia.',
      rotulo: 'Plataforma Iberia',
      titulo: 'Te damos la bienvenida',
      parrafos: [
        'Se creó tu cuenta en la Plataforma Iberia con el correo <strong>{{ .Email }}</strong>.',
        'Para entrar por primera vez, crea tu contraseña con el botón de abajo. Después entras siempre con tu correo y esa contraseña.',
      ],
      boton: { texto: 'Crear mi contraseña', url: enlace('invite', '/login/nueva-clave') },
      enlaceVisible: true,
      nota: `El enlace ${VENCE}. Si ya venció, entra a la plataforma, toca «¿Olvidaste tu contraseña?» y te llega uno nuevo.`,
    }),
  },

  recovery: {
    asunto: 'Cambia tu contraseña de la Plataforma Iberia',
    html: correoIberia({
      preencabezado: 'Tu enlace para crear una contraseña nueva.',
      rotulo: 'Plataforma Iberia',
      titulo: 'Crea tu contraseña nueva',
      parrafos: [
        'Recibimos una solicitud para cambiar la contraseña de tu cuenta <strong>{{ .Email }}</strong>.',
        'Toca el botón para crear una nueva. Al guardarla entras directo a la plataforma.',
      ],
      boton: { texto: 'Crear contraseña nueva', url: enlace('recovery', '/login/nueva-clave') },
      enlaceVisible: true,
      nota: `El enlace ${VENCE}. Si no pediste el cambio, ignora este correo: tu contraseña sigue igual.`,
    }),
  },

  magic_link: {
    asunto: 'Tu enlace para entrar a la Plataforma Iberia',
    html: correoIberia({
      preencabezado: 'Entra a la plataforma sin contraseña con este enlace.',
      rotulo: 'Plataforma Iberia',
      titulo: 'Tu enlace para entrar',
      parrafos: ['Toca el botón para entrar a la Plataforma Iberia con tu cuenta <strong>{{ .Email }}</strong>, sin escribir la contraseña.'],
      boton: { texto: 'Entrar a la plataforma', url: enlace('magiclink', '/') },
      enlaceVisible: true,
      nota: `El enlace ${VENCE}. Si no lo pediste, ignora este correo: nadie entra sin abrirlo.`,
    }),
  },

  confirmation: {
    asunto: 'Confirma tu correo en la Plataforma Iberia',
    html: correoIberia({
      preencabezado: 'Confirma tu correo para terminar de activar tu cuenta.',
      rotulo: 'Plataforma Iberia',
      titulo: 'Confirma tu correo',
      parrafos: ['Para terminar de activar tu cuenta en la Plataforma Iberia, confirma que <strong>{{ .Email }}</strong> es tu correo.'],
      boton: { texto: 'Confirmar mi correo', url: enlace('email', '/') },
      enlaceVisible: true,
      nota: `El enlace ${VENCE}. Si no reconoces esta cuenta, ignora este correo.`,
    }),
  },

  email_change: {
    asunto: 'Confirma el cambio de correo de tu cuenta',
    html: correoIberia({
      preencabezado: 'Confirma el cambio de correo de tu cuenta de la Plataforma Iberia.',
      rotulo: 'Plataforma Iberia · Seguridad',
      titulo: 'Confirma el cambio de correo',
      parrafos: [
        'Se pidió cambiar el correo de tu cuenta de <strong>{{ .Email }}</strong> a <strong>{{ .NewEmail }}</strong>.',
        'Para que el cambio se haga, confírmalo con el botón. Este correo les llega a las dos direcciones, y el cambio pide la confirmación de ambas.',
      ],
      boton: { texto: 'Confirmar el cambio', url: enlace('email_change', '/') },
      enlaceVisible: true,
      nota: `El enlace ${VENCE}. Si no pediste el cambio, ignora este correo: tu cuenta sigue con el correo de siempre.`,
    }),
  },

  reauthentication: {
    asunto: '{{ .Token }} es tu código de verificación',
    html: correoIberia({
      preencabezado: 'Tu código para confirmar que eres tú.',
      rotulo: 'Plataforma Iberia · Seguridad',
      titulo: 'Tu código de verificación',
      parrafos: ['Escribe este código en la plataforma para confirmar que eres tú:'],
      codigo: '{{ .Token }}',
      nota: `El código ${VENCE}. No se lo compartas a nadie: nadie de Industrias Iberia ni de soporte te lo va a pedir. Si no lo pediste, ignora este correo.`,
    }),
  },

  password_changed_notification: {
    asunto: 'Tu contraseña de la Plataforma Iberia se cambió',
    html: correoIberia({
      preencabezado: 'Aviso de seguridad: la contraseña de tu cuenta cambió.',
      rotulo: 'Plataforma Iberia · Seguridad',
      titulo: 'Tu contraseña se cambió',
      parrafos: ['La contraseña de tu cuenta <strong>{{ .Email }}</strong> se acaba de cambiar.', 'Si fuiste tú, no tienes que hacer nada.'],
      boton: recuperar,
      nota: SI_NO_FUISTE,
    }),
  },

  email_changed_notification: {
    asunto: 'El correo de tu cuenta de la Plataforma Iberia cambió',
    html: correoIberia({
      preencabezado: 'Aviso de seguridad: el correo de tu cuenta cambió.',
      rotulo: 'Plataforma Iberia · Seguridad',
      titulo: 'El correo de tu cuenta cambió',
      parrafos: ['El correo de tu cuenta pasó de <strong>{{ .OldEmail }}</strong> a <strong>{{ .Email }}</strong>.', 'Si fuiste tú, no tienes que hacer nada.'],
      nota: 'Si no fuiste tú, avísale de inmediato a la Gerencia de Tecnología.',
    }),
  },

  phone_changed_notification: {
    asunto: 'El teléfono de tu cuenta de la Plataforma Iberia cambió',
    html: correoIberia({
      preencabezado: 'Aviso de seguridad: el teléfono de tu cuenta cambió.',
      rotulo: 'Plataforma Iberia · Seguridad',
      titulo: 'El teléfono de tu cuenta cambió',
      parrafos: ['El teléfono de tu cuenta pasó de <strong>{{ .OldPhone }}</strong> a <strong>{{ .Phone }}</strong>.', 'Si fuiste tú, no tienes que hacer nada.'],
      boton: recuperar,
      nota: SI_NO_FUISTE,
    }),
  },

  mfa_factor_enrolled_notification: {
    asunto: 'Se agregó una verificación en dos pasos a tu cuenta',
    html: correoIberia({
      preencabezado: 'Aviso de seguridad: tu cuenta tiene un método de verificación nuevo.',
      rotulo: 'Plataforma Iberia · Seguridad',
      titulo: 'Nuevo método de verificación',
      parrafos: ['Se agregó a tu cuenta un método de verificación en dos pasos (<strong>{{ .FactorType }}</strong>).', 'Si fuiste tú, no tienes que hacer nada.'],
      boton: recuperar,
      nota: SI_NO_FUISTE,
    }),
  },

  mfa_factor_unenrolled_notification: {
    asunto: 'Se quitó una verificación en dos pasos de tu cuenta',
    html: correoIberia({
      preencabezado: 'Aviso de seguridad: se quitó un método de verificación de tu cuenta.',
      rotulo: 'Plataforma Iberia · Seguridad',
      titulo: 'Se quitó un método de verificación',
      parrafos: ['Se quitó de tu cuenta un método de verificación en dos pasos (<strong>{{ .FactorType }}</strong>).', 'Si fuiste tú, no tienes que hacer nada.'],
      boton: recuperar,
      nota: SI_NO_FUISTE,
    }),
  },

  identity_linked_notification: {
    asunto: 'Se vinculó una forma nueva de entrar a tu cuenta',
    html: correoIberia({
      preencabezado: 'Aviso de seguridad: tu cuenta tiene una forma nueva de entrar.',
      rotulo: 'Plataforma Iberia · Seguridad',
      titulo: 'Nueva forma de entrar',
      parrafos: ['Tu cuenta <strong>{{ .Email }}</strong> ahora también entra con <strong>{{ .Provider }}</strong>.', 'Si fuiste tú, no tienes que hacer nada.'],
      boton: recuperar,
      nota: SI_NO_FUISTE,
    }),
  },

  identity_unlinked_notification: {
    asunto: 'Se quitó una forma de entrar a tu cuenta',
    html: correoIberia({
      preencabezado: 'Aviso de seguridad: se quitó una forma de entrar a tu cuenta.',
      rotulo: 'Plataforma Iberia · Seguridad',
      titulo: 'Se quitó una forma de entrar',
      parrafos: ['Tu cuenta <strong>{{ .Email }}</strong> ya no entra con <strong>{{ .Provider }}</strong>.', 'Si fuiste tú, no tienes que hacer nada.'],
      boton: recuperar,
      nota: SI_NO_FUISTE,
    }),
  },
}

/** Los avisos de seguridad que se encienden. Los de teléfono, MFA e identidades no aplican hoy (no se usan), pero quedan diseñados. */
export const AVISOS_ENCENDIDOS = ['password_changed', 'email_changed']
