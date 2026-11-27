/**
 * El diseño de todos los correos de la plataforma: los de Supabase (invitación,
 * contraseña, enlace de acceso, avisos de seguridad) y los del asistente (tareas
 * programadas). Una sola maqueta, para que todos se vean de la misma casa.
 *
 * Es HTML de correo, no de web: tablas, estilos en línea, sin CSS externo ni
 * fuentes que dependan de la red (DM Sans si el cliente la tiene; si no, Arial).
 * Modo claro siempre: Outlook y Gmail invierten colores a su manera y el rojo de
 * Iberia sobre blanco es lo único que se lee igual en todos.
 *
 * 🔴 Sin imports y solo sintaxis que se borra: lo carga también Node directo
 * (`scripts/correo/plantillas-auth.mjs`) con la eliminación de tipos de Node 22.
 */

export const COLOR = {
  rojo: '#D4332C',
  rojoOscuro: '#A82620',
  texto: '#2b2a28',
  tenue: '#706a67',
  borde: '#e6e4e1',
  linea: '#efedea',
  fondo: '#f6f7f9',
  suave: '#faf9f8',
}

/** El dominio público desde donde se sirve el logo. No cambia por entorno: el correo se abre fuera de la app. */
export const DOMINIO_PUBLICO = 'https://portal.industriasiberia.com'

const FUENTE = "'DM Sans',Arial,Helvetica,sans-serif"

export const escaparHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

export type Correo = {
  /** Lo que se ve en la bandeja junto al asunto (texto oculto al abrirlo). */
  preencabezado: string
  /** Rótulo chico sobre el título: «Plataforma Iberia», «Asistente de IA»… */
  rotulo: string
  titulo: string
  /** Párrafos en HTML ya escapado (se permiten <strong> y enlaces). */
  parrafos: string[]
  boton?: { texto: string; url: string }
  /** Un código para copiar (el de verificación). */
  codigo?: string
  /** Bloque gris de cierre: vencimiento, «si no fuiste tú»… En HTML ya escapado. */
  nota?: string
  /** Muestra la dirección del botón en texto, por si el botón no abre. */
  enlaceVisible?: boolean
  /** Pie propio (si no, el de la plataforma). En HTML ya escapado. */
  pie?: string
}

function boton(b: { texto: string; url: string }): string {
  // Tabla con fondo en la celda: así se ve el botón entero también en Outlook de escritorio.
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 0">
<tr><td align="center" bgcolor="${COLOR.rojo}" style="border-radius:10px;background:${COLOR.rojo}">
<a href="${b.url}" target="_blank" style="display:inline-block;padding:13px 26px;font-family:${FUENTE};font-size:15px;font-weight:bold;line-height:1.2;color:#ffffff;text-decoration:none;border-radius:10px">${escaparHtml(b.texto)}</a>
</td></tr></table>`
}

/** El correo entero, listo para mandar. Las URL van tal cual (pueden traer variables de plantilla de Supabase). */
export function correoIberia(c: Correo): string {
  const parrafos = c.parrafos
    .map((p) => `<p style="margin:0 0 14px;font-family:${FUENTE};font-size:15px;line-height:1.6;color:${COLOR.texto}">${p}</p>`)
    .join('\n')
  const codigo = c.codigo
    ? `<div style="margin:6px 0 18px;padding:16px 0;background:${COLOR.suave};border:1px solid ${COLOR.borde};border-radius:12px;text-align:center;font-family:'Courier New',Courier,monospace;font-size:30px;font-weight:bold;letter-spacing:6px;color:${COLOR.texto}">${c.codigo}</div>`
    : ''
  const enlace =
    c.boton && c.enlaceVisible
      ? `<p style="margin:16px 0 0;font-family:${FUENTE};font-size:12px;line-height:1.5;color:${COLOR.tenue}">Si el botón no abre, copia esta dirección en el navegador:<br><a href="${c.boton.url}" style="color:${COLOR.rojoOscuro};word-break:break-all">${c.boton.url}</a></p>`
      : ''
  const nota = c.nota
    ? `<tr><td style="padding:0 32px 26px"><div style="padding:12px 14px;background:${COLOR.suave};border-radius:10px;font-family:${FUENTE};font-size:13px;line-height:1.5;color:${COLOR.tenue}">${c.nota}</div></td></tr>`
    : ''
  const pie =
    c.pie ??
    `Este correo lo envía la Plataforma Iberia de Industrias Iberia, C.A. Es automático: si lo respondes, nadie lo va a leer.`

  return `<!doctype html>
<html lang="es" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${escaparHtml(c.titulo)}</title>
</head>
<body style="margin:0;padding:0;background:${COLOR.fondo};-webkit-text-size-adjust:100%">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:${COLOR.fondo}">${escaparHtml(c.preencabezado)}&#8199;&#65279;&#847;&#8199;&#65279;&#847;&#8199;&#65279;&#847;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${COLOR.fondo}">
<tr><td align="center" style="padding:28px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px">
<tr><td style="padding:0 4px 18px">
<img src="${DOMINIO_PUBLICO}/marca/iberia.png" width="132" height="34" alt="Industrias Iberia" style="display:block;border:0;width:132px;height:34px">
</td></tr>
<tr><td style="background:#ffffff;border:1px solid ${COLOR.borde};border-radius:16px;overflow:hidden">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr><td style="height:4px;line-height:4px;font-size:0;background:${COLOR.rojo};border-radius:16px 16px 0 0">&nbsp;</td></tr>
<tr><td style="padding:28px 32px 6px">
<div style="font-family:${FUENTE};font-size:12px;font-weight:bold;letter-spacing:.06em;text-transform:uppercase;color:${COLOR.rojo}">${escaparHtml(c.rotulo)}</div>
<h1 style="margin:8px 0 16px;font-family:${FUENTE};font-size:22px;line-height:1.3;font-weight:bold;color:${COLOR.texto}">${escaparHtml(c.titulo)}</h1>
${parrafos}
${codigo}
${c.boton ? boton(c.boton) : ''}
${enlace}
</td></tr>
<tr><td style="height:22px;line-height:22px;font-size:0">&nbsp;</td></tr>
${nota}
</table>
</td></tr>
<tr><td style="padding:18px 8px 0;font-family:${FUENTE};font-size:12px;line-height:1.5;color:${COLOR.tenue};text-align:center">${pie}</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`
}
