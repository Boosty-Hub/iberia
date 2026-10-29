/**
 * El calendario de la Fase 2 y New Iberia como documento para el cliente: lee
 * `calendario_actividades` y deja el HTML en `documentos/`, con la identidad de
 * Iberia. El PDF sale después con el generador de siempre:
 *
 *   node --env-file=.env.local scripts/documento-calendario.mjs
 *   npm run documento -- documentos/2026-10-calendario-fase-2-y-new-iberia.html --vista
 *
 * Pedido de Gabriel el 29 de octubre de 2026, para mandárselo a Alberto por correo.
 * Se genera, no se edita a mano: lo que cambie en el calendario cambia en la base, y
 * el documento se vuelve a sacar.
 *
 * ⚠️ Lo lee Alberto: las mismas reglas que la página. Nada de dinero, y la `nota` de
 * cada actividad —coordinación interna de Amanda— no sale.
 */
import { createClient } from '@supabase/supabase-js'
import { writeFile } from 'node:fs/promises'

const SALIDA = process.argv[2] ?? 'documentos/2026-10-calendario-fase-2-y-new-iberia.html'

// Espejo de `lib/calendario.ts`, que es TypeScript y no se importa desde un .mjs.
const FRENTES = [
  { clave: 'coordinacion', nombre: 'Coordinación', color: '#8A96A3' },
  { clave: 'activacion', nombre: 'Activación', color: '#2E8B85' },
  { clave: 'acompanamiento', nombre: 'Acompañamiento', color: '#2D4868' },
  { clave: 'procesos', nombre: 'Procesos', color: '#5BA9A3' },
  { clave: 'desempeno', nombre: 'Desempeño', color: '#7A6CC0' },
  { clave: 'gestion_organizacional', nombre: 'Gestión Organizacional', color: '#B5648A' },
  { clave: 'estructura', nombre: 'Estructura', color: '#9DB21F' },
  { clave: 'tecnologia', nombre: 'Tecnología', color: '#2F6FB3' },
]
const FRENTE = Object.fromEntries(FRENTES.map((f) => [f.clave, f]))
const TIPOS = { actividad: 'Actividad', reunion: 'Reunión', entregable: 'Entregable', hito: 'Hito' }
const ESTADOS = {
  por_agendar: { nombre: 'Por agendar', color: '#8A96A3' },
  por_confirmar: { nombre: 'Por confirmar', color: '#C98A12' },
  agendado: { nombre: 'Agendado', color: '#2F6FB3' },
  en_curso: { nombre: 'En curso', color: '#2E8B85' },
  hecho: { nombre: 'Hecho', color: '#3D8B4A' },
}
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
const CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const VENTANA = { desde: '2026-10-01', hasta: '2027-11-01' }

const dia = (iso) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) / 864e5
const DESDE = dia(VENTANA.desde)
const LARGO = dia(VENTANA.hasta) - DESDE
const pos = (d) => Math.max(0, Math.min(100, ((d - DESDE) / LARGO) * 100))
const corta = (iso, anio = false) => `${+iso.slice(8, 10)} ${CORTOS[+iso.slice(5, 7) - 1]}${anio ? ` ${iso.slice(2, 4)}` : ''}`
const rango = (a) => {
  const conAnio = Boolean(a.fin && a.fin.slice(0, 4) !== a.inicio.slice(0, 4))
  return a.fin && a.fin !== a.inicio ? `${corta(a.inicio, conAnio)} – ${corta(a.fin, conAnio)}` : corta(a.inicio)
}
const esHito = (t) => t === 'hito' || t === 'entregable'
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const MESES_VENTANA = Array.from({ length: 13 }, (_, i) => {
  const anio = 2026 + Math.floor((9 + i) / 12)
  const mes = (9 + i) % 12
  return { anio, mes, iso: `${anio}-${String(mes + 1).padStart(2, '0')}-01` }
})

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false },
})
const { data: actividades, error } = await supabase
  .from('calendario_actividades')
  .select('id, titulo, detalle, frente, tipo, estado, inicio, fin, fecha_confirmada, responsable, participantes, orden')
  .order('inicio')
  .order('orden')
if (error) throw new Error(`no se pudo leer el calendario: ${error.message}`)

// «Hoy» en Venezuela, como la página.
const hoy = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Caracas' }).format(new Date())
const tHoy = dia(hoy)
const hoyLargo = `${+hoy.slice(8, 10)} de ${MESES[+hoy.slice(5, 7) - 1]} de ${hoy.slice(0, 4)}`

// --- piezas del dibujo ---------------------------------------------------------------

const reglaMeses = `
  <div class="g-fila g-cabeza">
    <div></div>
    <div class="g-meses">
      ${MESES_VENTANA.map(
        (m, i) =>
          `<span style="left:${pos(dia(m.iso)).toFixed(2)}%">${CORTOS[m.mes]}${i === 0 || m.mes === 0 ? ` ${String(m.anio).slice(2)}` : ''}</span>`
      ).join('')}
    </div>
  </div>`

const fondoPista = () =>
  MESES_VENTANA.slice(1)
    .map((m) => `<i class="g-mes" style="left:${pos(dia(m.iso)).toFixed(2)}%"></i>`)
    .join('') + (tHoy >= DESDE && tHoy < DESDE + LARGO ? `<i class="g-hoy" style="left:${pos(tHoy).toFixed(2)}%"></i>` : '')

function marca(a, color) {
  const desde = dia(a.inicio)
  const hasta = dia(a.fin ?? a.inicio)
  if (esHito(a.tipo)) return `<b class="g-rombo" style="left:${pos(hasta).toFixed(2)}%;background:${color}"></b>`
  const ancho = Math.max(0.8, pos(hasta + 1) - pos(desde))
  return `<b class="g-barra" style="left:${pos(desde).toFixed(2)}%;width:${ancho.toFixed(2)}%;background:${color}"></b>`
}

const frentesConDatos = FRENTES.filter((f) => actividades.some((a) => a.frente === f.clave))
const delFrente = (f) => actividades.filter((a) => a.frente === f.clave)

const resumen = `
  <div class="gantt">
    ${reglaMeses}
    ${frentesConDatos
      .map(
        (f) => `
      <div class="g-fila">
        <div class="g-nombre"><span class="cuadro" style="background:${f.color}"></span>${esc(f.nombre)} <span class="cuenta">${delFrente(f).length}</span></div>
        <div class="g-pista">${fondoPista()}${delFrente(f).map((a) => marca(a, f.color)).join('')}</div>
      </div>`
      )
      .join('')}
  </div>`

const detallePorFrente = frentesConDatos
  .map((f) => {
    const filas = delFrente(f)
    const primera = filas.reduce((m, a) => (a.inicio < m ? a.inicio : m), filas[0].inicio)
    const ultima = filas.reduce((m, a) => ((a.fin ?? a.inicio) > m ? a.fin ?? a.inicio : m), filas[0].fin ?? filas[0].inicio)
    return `
    <div class="frente">
      <h3><span class="cuadro" style="background:${f.color}"></span>${esc(f.nombre)}
        <span class="h3-dato">${filas.length} ${filas.length === 1 ? 'actividad' : 'actividades'} · ${corta(primera, true)} a ${corta(ultima, true)}</span></h3>
      <div class="gantt detalle">
        ${reglaMeses}
        ${filas
          .map(
            (a) => `
        <div class="g-fila">
          <div class="g-nombre">
            <p class="g-titulo">${esc(a.titulo)}</p>
            <p class="g-meta">${esc(rango(a))} · ${esc(a.responsable || '—')}</p>
          </div>
          <div class="g-pista">${fondoPista()}${marca(a, f.color)}</div>
        </div>`
          )
          .join('')}
      </div>
    </div>`
  })
  .join('')

const hitos = actividades.filter((a) => esHito(a.tipo))
const tablaHitos = `
  <table>
    <thead><tr><th style="width:17%">Fecha</th><th>Entregable o hito</th><th style="width:19%">Frente</th><th style="width:22%">Responsable</th></tr></thead>
    <tbody>
      ${hitos
        .map(
          (a) => `<tr>
        <td class="fecha">${esc(rango(a))}</td>
        <td><strong>${esc(a.titulo)}</strong> <span class="tipo">${TIPOS[a.tipo]}</span></td>
        <td><span class="cuadro" style="background:${FRENTE[a.frente].color}"></span>${esc(FRENTE[a.frente].nombre)}</td>
        <td>${esc(a.responsable || '—')}</td>
      </tr>`
        )
        .join('')}
    </tbody>
  </table>`

const porMes = new Map()
for (const a of actividades) {
  const clave = a.inicio.slice(0, 7)
  porMes.set(clave, [...(porMes.get(clave) ?? []), a])
}
const agenda = [...porMes]
  .map(
    ([clave, filas]) => `
    <div class="mes">
      <h3 class="mes-titulo">${MESES[+clave.slice(5, 7) - 1]} ${clave.slice(0, 4)}<span class="h3-dato">${filas.length} ${filas.length === 1 ? 'actividad' : 'actividades'}</span></h3>
      <table>
        <thead><tr><th style="width:15%">Fecha</th><th>Actividad</th><th style="width:26%">Responsable y con quién</th><th style="width:13%">Estado</th></tr></thead>
        <tbody>
          ${filas
            .map(
              (a) => `<tr>
            <td class="fecha">${esc(rango(a))}${a.fecha_confirmada ? `<span class="confirmada">Confirmada: ${esc(corta(a.fecha_confirmada))}</span>` : ''}</td>
            <td>
              <span class="cuadro" style="background:${FRENTE[a.frente].color}"></span><strong>${esc(a.titulo)}</strong>${a.tipo !== 'actividad' ? ` <span class="tipo${esHito(a.tipo) ? ' tipo-hito' : ''}">${TIPOS[a.tipo]}</span>` : ''}
              ${a.detalle ? `<p class="detalle">${esc(a.detalle)}</p>` : ''}
            </td>
            <td><strong>${esc(a.responsable || '—')}</strong>${a.participantes ? `<p class="detalle">${esc(a.participantes)}</p>` : ''}</td>
            <td><span class="estado"><i style="background:${ESTADOS[a.estado].color}"></i>${ESTADOS[a.estado].nombre}</span></td>
          </tr>`
            )
            .join('')}
        </tbody>
      </table>
    </div>`
  )
  .join('')

const nHitos = hitos.length
const nPorConfirmar = actividades.filter((a) => a.estado === 'por_confirmar').length
const nHechas = actividades.filter((a) => a.estado === 'hecho').length

const html = `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <title>Calendario de la Fase 2 y New Iberia · Industrias Iberia</title>
    <style>
      :root {
        --rojo: #d4332c; --carbon: #1e1c1b; --carbon-medio: #474342; --gris: #6d6765;
        --gris-claro: #b8b3b1; --borde: #e4e1e0; --fondo-suave: #f8f7f7; --pista: #f1efee;
      }
      * { box-sizing: border-box; }
      body { margin: 0; font-family: 'Segoe UI', system-ui, -apple-system, sans-serif; font-size: 10pt;
             line-height: 1.5; color: var(--carbon-medio); }
      h1, h2, h3 { color: var(--carbon); margin: 0; }
      .portada { border-bottom: 3px solid var(--rojo); padding-bottom: 18px; margin-bottom: 18px; }
      .portada img { height: 34px; width: auto; display: block; margin-bottom: 22px; }
      .rotulo { font-size: 8pt; font-weight: 700; letter-spacing: 0.16em; text-transform: uppercase;
                color: var(--rojo); margin-bottom: 8px; }
      .portada h1 { font-size: 21pt; line-height: 1.2; letter-spacing: -0.01em; }
      .portada .bajada { font-size: 11pt; color: var(--gris); margin-top: 10px; }
      .cifras { display: flex; gap: 10px; margin: 0 0 24px; }
      .cifras div { flex: 1; border: 1px solid var(--borde); border-radius: 8px; padding: 9px 12px; }
      .cifras b { display: block; font-size: 16pt; color: var(--carbon); line-height: 1.1; }
      .cifras span { font-size: 8.5pt; color: var(--gris); }
      section { margin-bottom: 24px; }
      section > h2 { font-size: 13pt; margin-bottom: 4px; padding-bottom: 6px; border-bottom: 1px solid var(--borde); }
      .num { color: var(--rojo); font-family: ui-monospace, monospace; font-size: 10pt; margin-right: 8px; }
      section > .intro { color: var(--gris); margin: 10px 0 12px; }
      h3 { font-size: 10.5pt; margin: 16px 0 6px; display: flex; align-items: center; gap: 7px; }
      .h3-dato { font-weight: 400; font-size: 8.5pt; color: var(--gris); margin-left: auto; }
      p { margin: 0 0 8px; }
      strong { color: var(--carbon); font-weight: 600; }
      .cuadro { display: inline-block; width: 9px; height: 9px; border-radius: 2px; margin-right: 6px; flex-shrink: 0; vertical-align: 0; }
      .leyenda { display: flex; flex-wrap: wrap; gap: 4px 16px; font-size: 8.5pt; color: var(--gris); margin-top: 8px; }
      .leyenda span { display: inline-flex; align-items: center; gap: 5px; }
      .leyenda .l-hoy { width: 0; height: 11px; border-left: 2px dashed var(--rojo); }
      .leyenda .l-rombo { width: 8px; height: 8px; transform: rotate(45deg); background: var(--gris-claro); border-radius: 1px; }
      .leyenda i { width: 7px; height: 7px; border-radius: 50%; display: inline-block; }

      /* La línea de tiempo: la misma geometría que la del panel. */
      .gantt { font-size: 8.5pt; }
      .g-fila { display: grid; grid-template-columns: 168px 1fr; gap: 10px; align-items: center; padding: 3px 0; break-inside: avoid; }
      .g-cabeza { padding-bottom: 2px; }
      .g-meses { position: relative; height: 16px; border-bottom: 1px solid var(--borde); }
      .g-meses span { position: absolute; bottom: 2px; font-size: 7.5pt; color: var(--gris); }
      .g-nombre { display: flex; align-items: center; color: var(--carbon); font-weight: 600; min-width: 0; }
      .cuenta { color: var(--gris-claro); font-weight: 400; margin-left: 5px; }
      .g-pista { position: relative; height: 20px; background: var(--pista); border-radius: 4px; }
      .g-mes { position: absolute; top: 0; bottom: 0; width: 1px; background: #fff; }
      .g-hoy { position: absolute; top: -3px; bottom: -3px; border-left: 1.5px dashed var(--rojo); }
      .g-barra { position: absolute; top: 50%; height: 9px; margin-top: -4.5px; border-radius: 5px; opacity: 0.85; }
      .g-rombo { position: absolute; top: 50%; width: 9px; height: 9px; margin: -4.5px 0 0 -4.5px; transform: rotate(45deg);
                 border-radius: 1.5px; box-shadow: 0 0 0 1.5px #fff; }
      .detalle .g-fila { grid-template-columns: 215px 1fr; padding: 2px 0; }
      .detalle .g-pista { height: 15px; }
      .detalle .g-nombre { display: block; font-weight: 400; }
      .g-titulo { margin: 0; font-size: 8pt; font-weight: 600; line-height: 1.25; color: var(--carbon); }
      .g-meta { margin: 0; font-size: 7.3pt; color: var(--gris); line-height: 1.25; }
      .frente { break-inside: avoid; margin-bottom: 6px; }

      table { width: 100%; border-collapse: collapse; font-size: 8.8pt; margin: 6px 0 12px; }
      thead { background: var(--carbon); color: #fff; display: table-header-group; }
      th { text-align: left; padding: 6px 8px; font-weight: 600; font-size: 8.3pt; }
      td { padding: 6px 8px; border-bottom: 1px solid var(--borde); vertical-align: top; }
      tr { break-inside: avoid; }
      tbody tr:nth-child(even) { background: var(--fondo-suave); }
      .fecha { font-family: ui-monospace, monospace; font-size: 8pt; white-space: nowrap; color: var(--carbon); }
      .confirmada { display: block; font-family: 'Segoe UI', system-ui, sans-serif; color: #3d8b4a; font-weight: 600; margin-top: 2px; }
      .detalle { margin: 3px 0 0; font-size: 8.3pt; color: var(--gris); }
      td .detalle { display: block; }
      .tipo { display: inline-block; font-size: 7pt; font-weight: 700; padding: 0 5px; border-radius: 8px;
              background: #ece9e8; color: var(--carbon-medio); vertical-align: 1px; }
      .tipo-hito { background: #fdf3f2; color: #a8261f; }
      .estado { display: inline-flex; align-items: center; gap: 5px; white-space: nowrap; font-size: 8.3pt; }
      .estado i { width: 7px; height: 7px; border-radius: 50%; display: inline-block; }
      .mes { break-inside: auto; }
      .mes-titulo { text-transform: none; }
      .mes-titulo::first-letter { text-transform: uppercase; }
      .salto { break-before: page; }
      footer.cierre { margin-top: 24px; padding-top: 12px; border-top: 1px solid var(--borde); font-size: 8.5pt; color: var(--gris); }
    </style>
  </head>
  <body>
    <div class="portada">
      <img src="../public/marca/iberia.png" alt="Industrias Iberia" />
      <p class="rotulo">Fase 2 · Aliviar y New Iberia</p>
      <h1>Calendario de actividades<br />noviembre de 2026 a octubre de 2027</h1>
      <p class="bajada">
        Cómo se van a dar en el tiempo la línea tecnológica de la Fase 2 y el desarrollo organizacional
        y de procesos de New Iberia: qué se hace, cuándo y con quién. Estado al ${esc(hoyLargo)}.
      </p>
    </div>

    <div class="cifras">
      <div><b>${actividades.length}</b><span>actividades</span></div>
      <div><b>${frentesConDatos.length}</b><span>frentes de trabajo</span></div>
      <div><b>${nHitos}</b><span>entregables e hitos</span></div>
      <div><b>${nHechas}</b><span>ya hechas</span></div>
    </div>

    <section>
      <h2><span class="num">01</span>Los frentes en el tiempo</h2>
      <p class="intro">
        Cada franja es un frente de trabajo; cada barra, una actividad de inicio a fin, y cada rombo, un
        entregable o un hito. Las fechas «por agendar» son la semana o el rango previsto: el día exacto se
        fija con cada área. Amanda (Boosty) coordina las agendas con Martha Fuentes, Milagro Salas y Luz.
      </p>
      ${resumen}
      <div class="leyenda">
        <span><span class="l-hoy"></span>Hoy</span>
        <span><span class="l-rombo"></span>Entregable o hito</span>
        ${Object.values(ESTADOS)
          .map((e) => `<span><i style="background:${e.color}"></i>${e.nombre}</span>`)
          .join('')}
      </div>
    </section>

    <section class="salto">
      <h2><span class="num">02</span>Cada frente, actividad por actividad</h2>
      <p class="intro">El mismo calendario abierto frente por frente, con la fecha y el responsable de cada actividad.</p>
      ${detallePorFrente}
    </section>

    <section class="salto">
      <h2><span class="num">03</span>Los entregables y los hitos</h2>
      <p class="intro">Lo que se entrega o marca un antes y un después, en orden de fecha.</p>
      ${tablaHitos}
    </section>

    <section class="salto">
      <h2><span class="num">04</span>La agenda mes a mes</h2>
      <p class="intro">
        Todas las actividades por el mes en que arrancan, con el detalle de cada una.
        ${nPorConfirmar ? `${nPorConfirmar} ${nPorConfirmar === 1 ? 'está' : 'están'} por confirmar.` : ''}
      </p>
      ${agenda}
    </section>

    <footer class="cierre">
      Estado al ${esc(hoyLargo)}. Las fechas se van fijando con cada área y el calendario al día está en el
      panel del programa, en «Calendario». Programa de Adopción de IA · Industrias Iberia · Boosty Digital.
    </footer>
  </body>
</html>
`

await writeFile(SALIDA, html)
console.log(`✔ ${SALIDA} · ${actividades.length} actividades`)
