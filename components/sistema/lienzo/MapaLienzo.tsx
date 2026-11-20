'use client'

import { useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { agregarNodo, moverNodo, renombrarNodo, retirarEnEscenario } from '@/app/sistema/nucleo/procesos/escenarios/acciones'
import { FAMILIAS } from '@/components/sistema/procesos/comun'
import type { Database } from '@/lib/database.types'
import { Lienzo } from './Lienzo'
import { COLOR_TONO, type AccionMenu, type Capa, type Marca, type NodoLienzo, type Tono } from './tipos'

/**
 * El mapa de procesos sobre el lienzo: los cuatro niveles de `sgc.lienzo`,
 * colgados de tres grupos (estratégicos, cadena de valor, soporte) que salen
 * del tipo del macroproceso. Arranca en los macroprocesos. En modo escenario,
 * arrastrar cambia el padre (siempre un nivel arriba) y «⋯» agrega, renombra
 * o retira, con las acciones del editor de escenarios de procesos.
 */

export type FilaProcesoLienzo = Database['sgc']['Functions']['lienzo']['Returns'][number]

const NIVEL = ['macroproceso', 'proceso', 'subproceso', 'actividad'] as const
const NIVEL_TITULO = ['Macroproceso', 'Proceso', 'Subproceso', 'Actividad']

type Salud = { vigente: number; revision: number; sin: number; total: number }

const SALUD: Record<string, Marca> = {
  vigente: { tono: 'verde', icono: '✓', etiqueta: 'documentado y vigente', corta: 'vigente' },
  revision: { tono: 'ambar', icono: '◐', etiqueta: 'en revisión o parcial', corta: 'en revisión' },
  sin_documentar: { tono: 'gris', icono: '○', etiqueta: 'sin documentar', corta: 'sin documentar' },
}
const DUENO: Record<string, Marca> = {
  asignado: { tono: 'verde', icono: '●', etiqueta: 'dueño con titular', corta: 'con dueño' },
  vacante: { tono: 'rojo', icono: '▲', etiqueta: 'plaza dueña vacante', corta: 'dueño vacante' },
  sin_plaza: { tono: 'ambar', icono: '◌', etiqueta: 'dueño sin plaza asignada', corta: 'sin plaza' },
  sin_dueno: { tono: 'gris', icono: '–', etiqueta: 'sin dueño', corta: 'sin dueño' },
}
const TONO_ESTADO: Record<string, { tono: Tono; icono: string }> = {
  vigente: { tono: 'verde', icono: '●' },
  nuevo: { tono: 'ambar', icono: '◐' },
  propuesto: { tono: 'azul', icono: '◇' },
  no_se_ejecuta: { tono: 'rojo', icono: '✕' },
  sin_evidencia: { tono: 'gris', icono: '?' },
}

export function MapaLienzo({
  filas,
  estados,
  escenario,
}: {
  filas: FilaProcesoLienzo[]
  estados: Record<string, string>
  escenario: { id: string; nombre: string; editable: boolean } | null
}) {
  const router = useRouter()
  const editable = !!escenario?.editable

  const { nodos, salud, abiertos } = useMemo(() => {
    const ids = new Set(filas.map((f) => f.id))
    const nodos: NodoLienzo[] = []
    const macros = filas.filter((f) => f.nivel === 0 && (!f.padre || !ids.has(f.padre)))
    // Un escenario sobre un subárbol no necesita la raíz ni los grupos: arranca en su macroproceso.
    const conGrupos = macros.length > (escenario ? 3 : 0)
    if (conGrupos) {
      nodos.push({
        id: 'mapa',
        padre: null,
        clase: 'raiz',
        titulo: escenario ? `Escenario · ${escenario.nombre}` : 'Mapa de procesos',
        subtitulo: `${filas.filter((f) => f.diff !== 'quitado').length} procesos · ${new Set(filas.map((f) => f.nivel)).size} niveles`,
        orden: 0,
      })
      FAMILIAS.forEach((fam, i) => {
        const n = macros.filter((m) => m.tipo === fam.tipo).length
        if (!n) return
        nodos.push({
          id: `g:${fam.tipo}`,
          padre: 'mapa',
          clase: 'grupo',
          titulo: fam.titulo,
          subtitulo: `${n} ${n === 1 ? 'macroproceso' : 'macroprocesos'} · ${fam.rotulo.toLowerCase()}`,
          orden: i,
        })
      })
      if (macros.some((m) => !FAMILIAS.some((f) => f.tipo === m.tipo)))
        nodos.push({ id: 'g:otro', padre: 'mapa', clase: 'grupo', titulo: 'Sin tipo', subtitulo: 'macroprocesos sin clasificar', orden: 9 })
    }

    for (const f of filas) {
      const antes = (f.antes ?? null) as Record<string, unknown> | null
      const codigos = [f.codigo_sgc, f.codigo_informe].filter(Boolean).join(' · ')
      let padre: string | null = f.padre && ids.has(f.padre) ? f.padre : null
      if (!padre && f.nivel === 0 && conGrupos) padre = FAMILIAS.some((x) => x.tipo === f.tipo) ? `g:${f.tipo}` : 'g:otro'
      let diffTexto: string | null = null
      if (f.diff === 'movido') diffTexto = `antes en «${antes?.padre ?? '—'}»`
      else if (f.diff === 'cambiado') diffTexto = antes?.nombre && antes.nombre !== f.nombre ? `antes «${antes.nombre}»` : 'cambia el dueño, el estado o la ficha'
      else if (f.diff === 'nuevo') diffTexto = `${NIVEL[f.nivel] ?? 'proceso'} nuevo`
      else if (f.diff === 'quitado') diffTexto = 'se retira con lo que tiene debajo'
      nodos.push({
        id: f.id,
        padre,
        clase: 'proceso',
        titulo: f.nombre,
        subtitulo: `${codigos || 'sin código'} · ${NIVEL_TITULO[f.nivel] ?? 'Proceso'}`,
        busqueda: [f.codigo_sgc, f.codigo_informe, f.dueno].filter(Boolean).join(' '),
        orden: f.orden,
        diff: (f.diff as NodoLienzo['diff']) ?? null,
        diffTexto,
        ficha: f.diff === 'nuevo' ? null : { tipo: 'proceso', id: f.ref, href: `/sistema/nucleo/procesos/${f.ref}` },
        arrastrable: editable && f.nivel > 0 && f.diff !== 'quitado',
        datos: { fila: f },
      })
    }

    // La salud del subárbol: la barra de cada caja cuenta todo lo que tiene debajo.
    const hijos = new Map<string, string[]>()
    for (const n of nodos) if (n.padre) (hijos.get(n.padre) ?? hijos.set(n.padre, []).get(n.padre)!).push(n.id)
    const porId = new Map(nodos.map((n) => [n.id, n]))
    const salud = new Map<string, Salud>()
    const contar = (id: string): Salud => {
      const memo = salud.get(id)
      if (memo) return memo
      const s: Salud = { vigente: 0, revision: 0, sin: 0, total: 0 }
      const f = porId.get(id)?.datos?.fila as FilaProcesoLienzo | undefined
      if (f && f.diff !== 'quitado') {
        s.total++
        if (f.salud === 'vigente') s.vigente++
        else if (f.salud === 'revision') s.revision++
        else s.sin++
      }
      for (const h of hijos.get(id) ?? []) {
        if (porId.get(h)?.diff === 'quitado') continue
        const x = contar(h)
        s.vigente += x.vigente
        s.revision += x.revision
        s.sin += x.sin
        s.total += x.total
      }
      salud.set(id, s)
      return s
    }
    nodos.forEach((n) => contar(n.id))

    const abiertos = conGrupos ? ['mapa', ...nodos.filter((n) => n.clase === 'grupo').map((n) => n.id)] : nodos.filter((n) => !n.padre).map((n) => n.id)
    return { nodos, salud, abiertos }
  }, [filas, escenario, editable])

  const fila = (n: NodoLienzo) => n.datos?.fila as FilaProcesoLienzo | undefined

  const capas = useMemo<Capa[]>(
    () => [
      {
        clave: 'salud',
        etiqueta: 'Salud documental',
        leyenda: [SALUD.vigente, SALUD.revision, SALUD.sin_documentar],
        marca: (n) => {
          const f = fila(n)
          return f ? (SALUD[f.salud] ?? SALUD.sin_documentar) : null
        },
      },
      {
        clave: 'dueno',
        etiqueta: 'Dueño del proceso',
        leyenda: [DUENO.asignado, DUENO.vacante, DUENO.sin_plaza, DUENO.sin_dueno],
        marca: (n) => {
          const f = fila(n)
          return f ? (DUENO[f.dueno_estado] ?? DUENO.sin_dueno) : null
        },
      },
      {
        clave: 'ficha',
        etiqueta: 'Ficha PHVA',
        leyenda: [
          { tono: 'verde', icono: '✓', etiqueta: 'con ficha PHVA' },
          { tono: 'gris', icono: '∅', etiqueta: 'sin ficha' },
        ],
        marca: (n) => {
          const f = fila(n)
          if (!f) return null
          return f.tiene_ficha ? { tono: 'verde', icono: '✓', etiqueta: 'con ficha PHVA', corta: 'con ficha' } : { tono: 'gris', icono: '∅', etiqueta: 'sin ficha', corta: 'sin ficha' }
        },
      },
      {
        clave: 'estado',
        etiqueta: 'Estado operativo',
        leyenda: Object.entries(TONO_ESTADO).map(([k, v]) => ({ ...v, etiqueta: estados[k] ?? k })),
        marca: (n) => {
          const f = fila(n)
          if (!f) return null
          const v = TONO_ESTADO[f.estado_operativo] ?? TONO_ESTADO.sin_evidencia
          return { ...v, etiqueta: estados[f.estado_operativo] ?? f.estado_operativo }
        },
      },
    ],
    [estados],
  )

  const cuerpo = (n: NodoLienzo, capa: string) => {
    const f = fila(n)
    const s = salud.get(n.id)
    if (capa === 'dueno' && f) return <span className="truncate" title={f.dueno ?? 'sin dueño'}>{f.dueno ?? 'sin dueño'}</span>
    if (!s || !s.total) return null
    const pct = (x: number) => `${(x / s.total) * 100}%`
    return (
      <>
        <span className="lz-salud" title={`${s.vigente} vigentes · ${s.revision} en revisión · ${s.sin} sin documentar`} aria-hidden>
          <i style={{ width: pct(s.vigente), background: COLOR_TONO.verde }} />
          <i style={{ width: pct(s.revision), background: '#e3b25a' }} />
          <i style={{ width: pct(s.sin), background: '#d6d3d1' }} />
        </span>
        {f && f.docs_total > 0 ? (
          <span className="num" title={`${f.docs_vigentes} documentos vigentes de ${f.docs_total}`}>
            {f.docs_vigentes}/{f.docs_total} doc.
          </span>
        ) : !f ? (
          <span className="num">{Math.round((s.vigente / s.total) * 100)} % vigente</span>
        ) : null}
      </>
    )
  }

  // --- Modo escenario ---
  const esc = escenario?.id ?? ''
  const llamar = async (accion: (a: { error?: string; ok?: string }, fd: FormData) => Promise<{ error?: string; ok?: string }>, datos: Record<string, string>) => {
    const fd = new FormData()
    fd.set('escenario', esc)
    for (const [k, v] of Object.entries(datos)) fd.set(k, v)
    const r = await accion({}, fd)
    if (r.error) return r.error
    router.refresh()
    return null
  }

  const menu = (n: NodoLienzo): AccionMenu[] => {
    const f = fila(n)
    if (!f) return []
    if (f.diff === 'quitado')
      return [
        {
          clave: 'restaurar',
          etiqueta: 'Restaurar en el escenario',
          confirmar: 'Vuelve con todo lo que tenía debajo.',
          ejecutar: () => llamar(retirarEnEscenario, { ref: f.ref, restaurar: 'si' }),
          hecho: 'Restaurado en el escenario.',
        },
      ]
    const lista: AccionMenu[] = [
      {
        clave: 'renombrar',
        etiqueta: 'Renombrar',
        campos: [{ nombre: 'nombre', etiqueta: 'Nombre', tipo: 'texto', inicial: f.nombre, requerido: true }],
        ejecutar: (v) => llamar(renombrarNodo, { ref: f.ref, nombre: v.nombre }),
        hecho: 'Renombrado en el escenario.',
      },
    ]
    if (f.nivel < 3)
      lista.push({
        clave: 'agregar',
        etiqueta: `Agregar un ${NIVEL[f.nivel + 1]} debajo`,
        campos: [{ nombre: 'nombre', etiqueta: 'Nombre', tipo: 'texto', requerido: true }],
        ejecutar: (v) => llamar(agregarNodo, { padre_ref: f.ref, nombre: v.nombre }),
        hecho: 'Agregado al escenario.',
      })
    lista.push({
      clave: 'retirar',
      etiqueta: 'Retirar en el escenario',
      peligro: true,
      confirmar: 'Sale con todo lo que tiene debajo. Se puede restaurar mientras el escenario esté en borrador.',
      ejecutar: () => llamar(retirarEnEscenario, { ref: f.ref }),
      hecho: 'Retirado del escenario.',
    })
    return lista
  }

  const cambios = filas.filter((f) => f.diff)
  const resumenCambios = escenario ? (
    <div className="mb-3 rounded-xl bg-[#f1edfa] px-3 py-2.5 text-[12.5px] text-[#4b3787]">
      <p className="font-semibold">{escenario.nombre}</p>
      <p className="mt-1">
        {cambios.filter((f) => f.diff === 'nuevo').length} nuevos · {cambios.filter((f) => f.diff === 'movido').length} movidos ·{' '}
        {cambios.filter((f) => f.diff === 'cambiado').length} cambiados · {cambios.filter((f) => f.diff === 'quitado').length} retirados
      </p>
      {!escenario.editable && <p className="mt-1 text-[11.5px]">Solo lectura: el escenario ya no está en borrador o tu rol no lo edita.</p>}
    </div>
  ) : undefined

  return (
    <Lienzo
      nodos={nodos}
      capas={capas}
      cuerpo={cuerpo}
      abiertosIniciales={abiertos}
      nombre={escenario ? `Mapa de procesos · ${escenario.nombre}` : 'Mapa de procesos'}
      claveMemoria={`sgc:${esc || 'real'}`}
      editable={editable}
      validarSoltar={(o, d) => {
        const fo = fila(o)
        const fd = fila(d)
        if (!fo || !fd) return 'Solo se cuelga de un proceso.'
        if (fo.diff === 'quitado' || fd.diff === 'quitado') return 'Lo retirado no se mueve.'
        if (fo.nivel === 0) return 'Un macroproceso no cuelga de otro proceso.'
        if (fd.nivel !== fo.nivel - 1) return `Un ${NIVEL[fo.nivel]} cuelga de un ${NIVEL[fo.nivel - 1]}.`
        return null
      }}
      alSoltar={(o, d) => llamar(moverNodo, { ref: fila(o)!.ref, padre_ref: fila(d)!.ref })}
      menu={menu}
      resumenCambios={resumenCambios}
      ayuda={
        editable
          ? 'Arrastra un proceso sobre otro del nivel de arriba para cambiarle el padre · «⋯» para agregar, renombrar o retirar'
          : 'Clic: desplegar o plegar · «Ficha ›» o doble clic: ficha PHVA · arrastra el fondo para moverte · rueda: zoom'
      }
    />
  )
}
