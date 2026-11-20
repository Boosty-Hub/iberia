import 'server-only'
import { FAMILIAS } from '@/components/sistema/procesos/comun'
import type { Database } from '@/lib/database.types'
import { fechaHora, fechaLarga } from '@/lib/plataforma/formato'

/**
 * El PDF del subárbol (Anexo E §5, «PDF por subárbol generado en el servidor
 * con cajetín»): la rama que se ve en el lienzo —desde la caja elegida y solo
 * lo desplegado—, leída otra vez en la base con la RLS de quien la pide. El
 * navegador manda qué caja y qué está abierto; nunca el contenido. Sin costos.
 */

type FilaOrg = Database['org']['Functions']['lienzo']['Returns'][number]
type FilaSgc = Database['sgc']['Functions']['lienzo']['Returns'][number]

export type NodoPdf = { id: string; padre: string | null; titulo: string; detalle: string; codigo: string | null; orden: number; marca: string | null }

const NIVEL = ['Macroproceso', 'Proceso', 'Subproceso', 'Actividad']
const SALUD: Record<string, string> = { vigente: 'Vigente', revision: 'En revisión', en_revision: 'En revisión', sin: 'Sin documentar', sin_documentar: 'Sin documentar' }
const DIFF: Record<string, string> = { nuevo: 'Nuevo', movido: 'Movido', cambiado: 'Cambia', quitado: 'Se quita' }

/** Los nodos del organigrama, con los mismos ids del lienzo. */
export function nodosOrganigrama(filas: FilaOrg[], tipos: Map<string, string>): NodoPdf[] {
  return filas.map((f) => {
    const unidad = f.clase === 'unidad'
    const vac = Math.max(0, (f.aprob ?? 0) - (f.ocu ?? 0))
    const cifras = `dotación ${f.aprob ?? 0} · ocupadas ${f.ocu ?? 0}${vac ? ` · vacantes ${vac}` : ''}${f.excede ? ` · por encima ${f.excede}` : ''}`
    const personas = !unidad && f.personas?.length ? ` · ${f.personas.slice(0, 4).join(', ')}${f.personas.length > 4 ? ` y ${f.personas.length - 4} más` : ''}` : ''
    return {
      id: f.id,
      padre: f.padre,
      titulo: f.nombre,
      codigo: unidad ? f.codigo : null,
      detalle: unidad ? `${tipos.get(f.tipo) ?? f.tipo ?? 'Unidad'} · ${cifras}` : `Plaza · ${cifras}${personas}`,
      orden: unidad ? f.orden : 100000,
      marca: f.diff ? (DIFF[f.diff] ?? f.diff) : f.inferido ? 'Inferido' : null,
    }
  })
}

/** Los nodos del mapa de procesos, con la raíz y los grupos del lienzo (`mapa`, `g:<tipo>`). */
export function nodosMapa(filas: FilaSgc[]): NodoPdf[] {
  const ids = new Set(filas.map((f) => f.id))
  const macros = filas.filter((f) => f.nivel === 0 && (!f.padre || !ids.has(f.padre)))
  const nodos: NodoPdf[] = [{ id: 'mapa', padre: null, titulo: 'Mapa de procesos', detalle: `${filas.length} procesos`, codigo: null, orden: 0, marca: null }]
  FAMILIAS.forEach((fam, i) => {
    if (macros.some((m) => m.tipo === fam.tipo)) nodos.push({ id: `g:${fam.tipo}`, padre: 'mapa', titulo: fam.titulo, detalle: fam.rotulo, codigo: null, orden: i, marca: null })
  })
  if (macros.some((m) => !FAMILIAS.some((f) => f.tipo === m.tipo))) nodos.push({ id: 'g:otro', padre: 'mapa', titulo: 'Sin tipo', detalle: 'Macroprocesos sin clasificar', codigo: null, orden: 9, marca: null })
  for (const f of filas) {
    let padre = f.padre && ids.has(f.padre) ? f.padre : null
    if (!padre && f.nivel === 0) padre = FAMILIAS.some((x) => x.tipo === f.tipo) ? `g:${f.tipo}` : 'g:otro'
    const docs = f.docs_total ? ` · documentos ${f.docs_vigentes ?? 0}/${f.docs_total} vigentes` : ''
    nodos.push({
      id: f.id,
      padre,
      titulo: f.nombre,
      codigo: [f.codigo_sgc, f.codigo_informe].filter(Boolean).join(' · ') || null,
      detalle: `${NIVEL[f.nivel] ?? 'Proceso'} · ${SALUD[f.salud] ?? f.salud ?? '—'} · dueño: ${f.dueno ?? 'sin dueño'}${docs}${f.version ? ` · v${f.version}` : ''}`,
      orden: f.orden,
      marca: f.diff ? (DIFF[f.diff] ?? f.diff) : null,
    })
  }
  return nodos
}

/**
 * La rama visible: desde `raiz` (o desde las raíces), bajando solo por lo
 * desplegado (`abiertos`; sin la lista, todo). Devuelve [nodo, profundidad].
 */
export function rama(nodos: NodoPdf[], raiz: string | null, abiertos: Set<string> | null): [NodoPdf, number][] {
  const hijos = new Map<string | null, NodoPdf[]>()
  const porId = new Map(nodos.map((n) => [n.id, n]))
  for (const n of nodos) {
    const p = n.padre && porId.has(n.padre) ? n.padre : null
    ;(hijos.get(p) ?? hijos.set(p, []).get(p)!).push(n)
  }
  for (const l of hijos.values()) l.sort((a, b) => a.orden - b.orden || a.titulo.localeCompare(b.titulo, 'es'))
  const salida: [NodoPdf, number][] = []
  const bajar = (n: NodoPdf, d: number) => {
    salida.push([n, d])
    if (abiertos && !abiertos.has(n.id) && d > 0) return
    for (const h of hijos.get(n.id) ?? []) bajar(h, d + 1)
  }
  const inicio = raiz && porId.has(raiz) ? [porId.get(raiz)!] : (hijos.get(null) ?? [])
  for (const n of inicio) bajar(n, 0)
  return salida
}

const esc = (s: string | null | undefined) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

export type Cajetin = {
  modulo: 'NUC-ORG' | 'NUC-PRO'
  titulo: string
  codigo: string | null
  version: string
  al: string
  escenario: string | null
  generadoPor: string
  generadoEn: Date
}

/** El HTML que se imprime: cajetín arriba, la rama en esquema, y «Uso interno» en cada página. */
export function htmlSubarbol(c: Cajetin, filas: [NodoPdf, number][], paraNavegador: boolean): string {
  const lineas = filas
    .map(
      ([n, d]) => `<li style="margin-left:${Math.min(d, 8) * 16}px" class="${d === 0 ? 'raiz' : ''}">
  <span class="t">${esc(n.titulo)}</span>${n.codigo ? ` <span class="c">${esc(n.codigo)}</span>` : ''}${n.marca ? ` <span class="m">${esc(n.marca)}</span>` : ''}
  <span class="d">${esc(n.detalle)}</span></li>`
    )
    .join('\n')
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${esc(c.titulo)} · ${esc(c.modulo)}</title>
<style>
  @page { size: A4; margin: 16mm 14mm 18mm; }
  * { box-sizing: border-box; }
  body { font-family: 'DM Sans', system-ui, sans-serif; color: #1e1c1b; font-size: 11px; margin: 0; }
  .cajetin { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
  .cajetin td, .cajetin th { border: 1px solid #b8b3b1; padding: 4px 6px; text-align: left; vertical-align: top; }
  .cajetin th { background: #f6f7f9; font-weight: 600; width: 16%; color: #474342; }
  .cajetin .marca { font-weight: 800; letter-spacing: .04em; }
  .cajetin .marca b { background: #D4332C; color: #fff; border-radius: 4px; padding: 1px 4px; margin-right: 6px; }
  .uso { color: #a3241f; font-weight: 700; text-transform: uppercase; letter-spacing: .08em; }
  ul { list-style: none; padding: 0; margin: 0; }
  li { padding: 3px 0 3px 8px; border-left: 2px solid #dbd8d7; margin-bottom: 2px; break-inside: avoid; }
  li.raiz { border-left-color: #D4332C; }
  .t { font-weight: 600; }
  .c { font-family: ui-monospace, monospace; font-size: 10px; color: #575251; }
  .m { font-size: 9.5px; font-weight: 700; color: #6b4fb3; background: #f1edfa; border-radius: 4px; padding: 0 4px; }
  .d { display: block; color: #575251; font-size: 10px; }
  .pie { margin-top: 10px; color: #575251; font-size: 9.5px; }
  .imprimir { position: fixed; top: 10px; right: 10px; }
  @media print { .imprimir { display: none; } }
</style></head><body>
${paraNavegador ? '<p class="imprimir"><button onclick="print()">Imprimir o guardar en PDF</button></p>' : ''}
<table class="cajetin">
  <tr><td colspan="2" class="marca"><b>IB</b>Industrias Iberia · Plataforma Iberia</td><td colspan="2" class="uso">Uso interno</td></tr>
  <tr><th>Código</th><td>${esc(c.modulo)}${c.codigo ? ` · ${esc(c.codigo)}` : ''}</td><th>Versión</th><td>${esc(c.version)}</td></tr>
  <tr><th>Rama</th><td>${esc(c.titulo)}</td><th>Datos al</th><td>${esc(fechaLarga(c.al))}${c.escenario ? ` · escenario «${esc(c.escenario)}»` : ' · realidad'}</td></tr>
  <tr><th>Fecha</th><td>${esc(fechaHora(c.generadoEn.toISOString()))}</td><th>Generado por</th><td>${esc(c.generadoPor)}</td></tr>
</table>
<ul>
${lineas}
</ul>
<p class="pie">${filas.length} ${filas.length === 1 ? 'caja' : 'cajas'}: la rama como se veía en el lienzo (lo desplegado). Leído en la base con los permisos de quien lo generó. Sin costos. No es un documento controlado del SGC.</p>
</body></html>`
}
