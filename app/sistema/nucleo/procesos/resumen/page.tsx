import type { Metadata } from 'next'
import { puede, requerirPermiso } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { fechaLarga, numero, porcentaje } from '@/lib/plataforma/formato'
import { leerContexto } from '@/lib/plataforma/servidor'
import { CabeceraModulo } from '@/components/sistema/ui/cabecera-modulo'
import { Kpi } from '@/components/sistema/ui/kpi'
import { BarrasApiladas, ListaAlertas } from '@/components/sistema/procesos/piezas-r2'
import type { Database } from '@/lib/database.types'

export const metadata: Metadata = { title: 'Resumen · Procesos' }

type Fila = Database['ui']['Functions']['procesos']['Returns'][number]

const CATALOGO = '/sistema/nucleo/procesos/catalogo'
const TRAMOS = [
  { clave: 'vigente', etiqueta: 'documentado', simbolo: '✓', color: '#1f8a5b' },
  { clave: 'revision', etiqueta: 'en revisión o parcial', simbolo: '◐', color: '#e3b25a' },
  { clave: 'sin_documentar', etiqueta: 'sin documentar', simbolo: '○', color: '#c4c9d0' },
]

/**
 * Resumen de Procesos (NUC-PRO): cuántos procesos hay por nivel, cuántos tienen
 * ficha PHVA, dueño casado con una plaza, revisión abierta o nada escrito; la
 * salud documental de cada macroproceso y las alertas de calidad del dato. Todo
 * sale de `ui.procesos(al)` con la RLS de quien mira, y cada cifra abre la
 * tabla filtrada que la origina.
 */
export default async function ResumenProcesosPage({ searchParams }: PageProps<'/sistema/nucleo/procesos/resumen'>) {
  const [sesion, sp] = await Promise.all([requerirPermiso('sistema:procesos'), searchParams])
  const ctx = await leerContexto(sp)
  const supabase = await createClient()
  const [{ data, error }, { data: ultimo }, validacion] = await Promise.all([
    supabase.schema('ui').rpc('procesos', { p_al: ctx.al, ...(ctx.esc ? { p_escenario: ctx.esc } : {}) }).range(0, 1999),
    supabase.schema('sgc').from('proceso').select('creado_en').is('escenario_id', null).order('creado_en', { ascending: false }).limit(1).maybeSingle(),
    supabase.schema('ui').rpc('validacion_procesos').range(0, 199),
  ])
  const filas: Fila[] = data ?? []
  const sello = { fuente: 'catálogo del SGC (sgc.proceso)', en: ultimo?.creado_en ?? null, estado: ctx.esHoy ? ('al_dia' as const) : ('manual' as const), detalle: `Datos al ${fechaLarga(ctx.al)}` }
  const conCtx = (href: string) => {
    const q = new URLSearchParams()
    if (ctx.esc) q.set('esc', ctx.esc)
    if (!ctx.esHoy) q.set('al', ctx.al)
    const s = q.toString()
    return s ? `${href}${href.includes('?') ? '&' : '?'}${s}` : href
  }
  const ficha = (ref: string) => conCtx(`/sistema/nucleo/procesos/resumen?ficha=proceso:${ref}`)

  const porNivel = [0, 1, 2, 3].map((n) => filas.filter((f) => f.nivel === n).length)
  const operativos = filas.filter((f) => f.nivel > 0)
  const conFicha = operativos.filter((f) => f.tiene_ficha).length
  const casados = filas.filter((f) => f.dueno_estado === 'asignado' || f.dueno_estado === 'vacante').length
  const enRevision = filas.filter((f) => f.ciclo === 'en_revision').length
  const borradores = filas.filter((f) => f.ciclo === 'borrador').length
  const sinDoc = filas.filter((f) => f.salud === 'sin_documentar').length
  const vacantes = filas.filter((f) => f.alerta_vacante)
  const sinInd = filas.filter((f) => f.alerta_sin_indicadores)
  const dudosos = filas.filter((f) => f.codigo_dudoso)
  const notas = filas.filter((f) => f.dueno_ficha_difiere)
  const val = validacion.data ?? []
  const validados = val.reduce((s, v) => s + v.validados, 0)
  const enValidacion = val.reduce((s, v) => s + v.procesos, 0)

  // La salud de cada macroproceso cuenta todo lo que tiene debajo.
  const macros = filas.filter((f) => f.nivel === 0)
  const salud = macros.map((m) => {
    const debajo = filas.filter((f) => f.macro_ref === m.ref && f.nivel > 0)
    const valores: Record<string, number> = { vigente: 0, revision: 0, sin_documentar: 0 }
    for (const f of debajo) valores[f.salud] = (valores[f.salud] ?? 0) + 1
    return { clave: m.ref, etiqueta: `${m.codigo ?? ''} ${m.nombre}`.trim(), href: conCtx(`${CATALOGO}?f.macro=${encodeURIComponent(m.nombre)}`), valores }
  })

  return (
    <>
      <CabeceraModulo
        sesion={sesion}
        codigo="NUC-PRO"
        titulo="Procesos"
        migas={[{ etiqueta: 'Resumen' }]}
        descripcion={`El catálogo de procesos al ${fechaLarga(ctx.al)}${ctx.esc ? ', con los cambios del escenario' : ''}: niveles, fichas, dueños y lo que falta documentar. Cada cifra abre la tabla que la origina.`}
      />
      {error && <p className="mb-3 rounded-lg bg-[#fbeceb] px-3 py-2 text-[12.5px] text-[#a3241f]">No se pudo leer el catálogo: {error.message}</p>}

      <div className="mb-3 grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        <Kpi
          titulo="Procesos en el catálogo"
          valor={numero(filas.length)}
          comparacion={{ texto: `${numero(porNivel[0])} macro · ${numero(porNivel[1])} proc. · ${numero(porNivel[2])} sub. · ${numero(porNivel[3])} act.` }}
          sello={sello}
          href={conCtx(CATALOGO)}
        />
        <Kpi
          titulo="Con ficha PHVA"
          valor={numero(conFicha)}
          unidad={`de ${numero(operativos.length)}`}
          comparacion={{ texto: `${porcentaje(operativos.length ? (conFicha / operativos.length) * 100 : 0)} de los niveles 1 a 3` }}
          sello={sello}
          href={conCtx(`${CATALOGO}?f.tiene_ficha=true`)}
        />
        <Kpi
          titulo="Con dueño casado"
          valor={numero(casados)}
          unidad={`de ${numero(filas.length)}`}
          comparacion={{ texto: `${numero(vacantes.length)} con la plaza dueña vacante` }}
          sello={sello}
          href={conCtx(`${CATALOGO}?f.dueno_estado=asignado&f.dueno_estado=vacante`)}
        />
        <Kpi
          titulo="En revisión"
          valor={numero(enRevision)}
          comparacion={{ texto: `${numero(borradores)} borrador${borradores === 1 ? '' : 'es'} abierto${borradores === 1 ? '' : 's'}` }}
          sello={sello}
          href={conCtx(`${CATALOGO}?f.ciclo=en_revision&f.ciclo=borrador`)}
        />
        <Kpi
          titulo="Sin documentar"
          valor={numero(sinDoc)}
          comparacion={{ texto: `${porcentaje(filas.length ? (sinDoc / filas.length) * 100 : 0)} del catálogo, sin ficha ni documento` }}
          sello={sello}
          href={conCtx(`${CATALOGO}?f.salud=sin_documentar`)}
        />
        <Kpi
          titulo="Validados en la plataforma"
          valor={numero(validados)}
          unidad={`de ${numero(enValidacion)}`}
          comparacion={{ texto: 'Vigentes que pasaron por la ruta de aprobación' }}
          sello={{ ...sello, fuente: 'sgc.proceso + flujo.solicitud' }}
          href="/sistema/nucleo/procesos/validacion"
        />
      </div>

      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_340px]">
        <section className="min-w-0 rounded-xl border border-[var(--borde)] bg-white p-3.5">
          <h2 className="text-[13px] font-semibold text-marca-900">Salud documental por macroproceso</h2>
          <p className="mb-3 text-[11.5px] text-marca-500">
            Procesos, subprocesos y actividades debajo de cada macroproceso. «Documentado»: tiene ficha PHVA o documentos vigentes; «en revisión»: hay un borrador abierto
            o sus documentos no están vigentes. Un clic abre sus filas en el catálogo.
          </p>
          {salud.length ? <BarrasApiladas filas={salud} tramos={TRAMOS} titulo="Salud documental por macroproceso" /> : <p className="py-6 text-center text-marca-400">Sin macroprocesos a esa fecha.</p>}
        </section>

        <div className="flex flex-col gap-3">
          <ListaAlertas
            titulo="Dueño vacante"
            icono="▲"
            total={vacantes.length}
            items={vacantes.slice(0, 6).map((f) => ({ clave: f.ref, titulo: f.nombre, detalle: f.dueno, href: ficha(f.ref) }))}
            hrefTodos={conCtx(`${CATALOGO}?f.alerta_vacante=true`)}
            vacio="Ninguna plaza dueña vacante."
          />
          <ListaAlertas
            titulo="Ficha sin indicadores"
            icono="◔"
            total={sinInd.length}
            items={sinInd.slice(0, 6).map((f) => ({ clave: f.ref, titulo: f.nombre, detalle: f.codigo ?? null, href: ficha(f.ref) }))}
            hrefTodos={conCtx(`${CATALOGO}?f.alerta_sin_indicadores=true`)}
            vacio="Todas las fichas tienen indicadores."
          />
          <ListaAlertas
            titulo="Códigos dudosos"
            icono="?"
            total={dudosos.length}
            items={dudosos.slice(0, 6).map((f) => ({ clave: f.ref, titulo: f.nombre, detalle: f.motivo_codigo, href: ficha(f.ref) }))}
            hrefTodos={conCtx(`${CATALOGO}?f.codigo_dudoso=true&cols=codigo_sgc,codigo_informe,nombre,nivel_nombre,motivo_codigo,dueno`)}
            vacio="Sin códigos dudosos."
          />
          <ListaAlertas
            titulo="La hoja PHVA nombra otro dueño"
            icono="≠"
            total={notas.length}
            items={notas.slice(0, 4).map((f) => ({ clave: f.ref, titulo: f.nombre, detalle: f.dueno ?? 'sin dueño en el catálogo', href: ficha(f.ref) }))}
            hrefTodos={conCtx(CATALOGO)}
            vacio="Sin diferencias de dueño."
          />
        </div>
      </div>
      {!puede(sesion, 'sistema:procesos', 'editar') && (
        <p className="mt-3 text-[11.5px] text-marca-500">Tu rol lee el catálogo: los cambios los proponen el custodio del SGC y los dueños de proceso, y los aprueba el comité.</p>
      )}
    </>
  )
}
