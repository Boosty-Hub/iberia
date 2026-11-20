'use client'

import { useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  agregarPlaza,
  agregarUnidad,
  cambiarDotacion,
  cerrarPlaza,
  cerrarUnidad,
  moverPlaza,
  moverUnidad,
  renombrarUnidad,
} from '@/app/sistema/nucleo/escenarios/acciones'
import type { Database } from '@/lib/database.types'
import { Lienzo } from './Lienzo'
import type { AccionMenu, Capa, Marca, NodoLienzo } from './tipos'

/**
 * El organigrama sobre el lienzo: unidades y plazas de `org.lienzo`, con las
 * cifras de cada unidad sumadas sobre todo lo que tiene debajo (sin lo que un
 * escenario quita). En modo escenario, arrastrar y el menú «⋯» llaman a las
 * acciones del editor de escenarios, que solo escriben filas del escenario.
 */

export type FilaOrg = Database['org']['Functions']['lienzo']['Returns'][number]

type Totales = { aprob: number; ocu: number; vac: number; excede: number; costo: number | null; plazas: number; inferidas: number; directos: number }

const ENTERO = new Intl.NumberFormat('es-VE', { maximumFractionDigits: 0 })
const fmtBs = (n: number) => `Bs ${ENTERO.format(Math.round(n))}`

function resumirPersonas(personas: string[] | null, ocu: number): string {
  if (!ocu || !personas?.length) return 'Sin titular'
  if (personas.length === 1) return personas[0]
  return `${personas[0]} y ${personas.length - 1} más`
}

export function OrganigramaLienzo({
  filas,
  tiposUnidad,
  verCostos,
  escenario,
  cargos,
}: {
  filas: FilaOrg[]
  tiposUnidad: { clave: string; etiqueta: string }[]
  verCostos: boolean
  escenario: { id: string; nombre: string; editable: boolean } | null
  cargos: { id: string; nombre: string }[]
}) {
  const router = useRouter()
  const etiquetaTipo = useMemo(() => new Map(tiposUnidad.map((t) => [t.clave, t.etiqueta])), [tiposUnidad])

  const { nodos, totales, abiertos, resumen } = useMemo(() => {
    const hijos = new Map<string, FilaOrg[]>()
    for (const f of filas) if (f.padre) (hijos.get(f.padre) ?? hijos.set(f.padre, []).get(f.padre)!).push(f)
    const totales = new Map<string, Totales>()
    const sumar = (f: FilaOrg): Totales => {
      const memo = totales.get(f.id)
      if (memo) return memo
      const t: Totales = { aprob: 0, ocu: 0, vac: 0, excede: 0, costo: null, plazas: 0, inferidas: 0, directos: 0 }
      if (f.clase === 'plaza' && f.diff !== 'quitado') {
        t.aprob = f.aprob
        t.ocu = f.ocu
        t.vac = f.vacantes
        t.excede = f.excede
        t.costo = f.costo_ves ?? null
        t.plazas = 1
      }
      const debajo = hijos.get(f.id) ?? []
      t.directos = debajo.filter((h) => h.diff !== 'quitado').length
      for (const h of debajo) {
        if (h.diff === 'quitado') continue
        const x = sumar(h)
        t.aprob += x.aprob
        t.ocu += x.ocu
        t.vac += x.vac
        t.excede += x.excede
        t.plazas += x.plazas
        t.inferidas += x.inferidas + (h.inferido ? 1 : 0)
        if (x.costo != null) t.costo = (t.costo ?? 0) + x.costo
      }
      totales.set(f.id, t)
      return t
    }
    filas.forEach(sumar)

    const editable = !!escenario?.editable
    const nodos: NodoLienzo[] = filas.map((f) => {
      const unidad = f.clase === 'unidad'
      const ref = f.ref
      const antes = (f.antes ?? null) as Record<string, unknown> | null
      let diffTexto: string | null = null
      if (f.diff === 'movido') diffTexto = unidad ? `antes en «${antes?.padre ?? '—'}»` : `antes en «${antes?.unidad ?? '—'}»`
      else if (f.diff === 'cambiado' && unidad && antes?.nombre !== f.nombre) diffTexto = `antes «${antes?.nombre}»`
      else if (f.diff === 'cambiado' && !unidad) {
        const partes: string[] = []
        if (antes?.dotacion != null && antes.dotacion !== f.aprob) partes.push(`dotación ${antes.dotacion} → ${f.aprob}`)
        if (antes?.cargo && antes.cargo !== f.nombre) partes.push(`antes «${antes.cargo}»`)
        diffTexto = partes.join(' · ') || 'cambia la plaza'
      } else if (f.diff === 'cambiado') diffTexto = 'cambia el tipo o la sede'
      else if (f.diff === 'nuevo') diffTexto = unidad ? 'unidad nueva' : `plaza nueva · dotación ${f.aprob}`
      else if (f.diff === 'quitado') diffTexto = unidad ? 'se cierra la unidad' : `se cierra · dotación ${f.aprob}`
      return {
        id: f.id,
        padre: f.padre,
        clase: unidad ? 'unidad' : 'plaza',
        titulo: f.nombre,
        subtitulo: unidad
          ? [etiquetaTipo.get(f.tipo) ?? f.tipo, f.codigo].filter(Boolean).join(' · ')
          : resumirPersonas(f.personas, f.ocu),
        busqueda: [f.codigo, ...(f.personas ?? []), unidad ? '' : 'plaza'].filter(Boolean).join(' '),
        orden: unidad ? f.orden : 100000,
        diff: (f.diff as NodoLienzo['diff']) ?? null,
        diffTexto,
        ficha:
          f.diff === 'nuevo'
            ? null
            : unidad
              ? { tipo: 'unidad', id: ref, href: `/sistema/nucleo/organizacion/unidades/${ref}` }
              : { tipo: 'plaza', id: ref, href: `/sistema/nucleo/organizacion/unidades/${f.padre?.slice(2)}#plaza-${ref}` },
        arrastrable: editable && f.diff !== 'quitado',
        datos: { fila: f },
      }
    })

    // Arranca mostrando las direcciones: se abre todo lo que está por encima de ellas.
    const porId = new Map(filas.map((f) => [f.id, f]))
    const abiertos = new Set<string>()
    for (const f of filas) {
      if (f.clase !== 'unidad' || f.tipo !== 'direccion') continue
      for (let p: string | null = f.padre, i = 0; p && i < 20; p = porId.get(p)?.padre ?? null, i++) abiertos.add(p)
    }
    if (!abiertos.size) for (const f of filas) if (!f.padre && f.clase === 'unidad') abiertos.add(f.id)

    // El escenario contra la realidad, en una línea.
    let resumen = null as null | { unidades: number; plazas: number; dotacion: number; costo: number | null; cambios: number }
    if (escenario) {
      const r = { unidades: 0, plazas: 0, dotacion: 0, costo: verCostos ? 0 : null, cambios: 0 }
      for (const f of filas) {
        if (!f.diff) continue
        r.cambios++
        const antes = (f.antes ?? {}) as { dotacion?: number; costo_ves?: number }
        if (f.clase === 'unidad') {
          if (f.diff === 'nuevo') r.unidades++
          if (f.diff === 'quitado') r.unidades--
          continue
        }
        if (f.diff === 'nuevo') {
          r.plazas++
          r.dotacion += f.aprob
          if (r.costo != null) r.costo += f.costo_ves ?? 0
        } else if (f.diff === 'quitado') {
          r.plazas--
          r.dotacion -= f.aprob
          if (r.costo != null) r.costo -= f.costo_ves ?? 0
        } else if (antes.dotacion != null) {
          r.dotacion += f.aprob - antes.dotacion
          if (r.costo != null) r.costo += (f.costo_ves ?? 0) - (antes.costo_ves ?? 0)
        }
      }
      resumen = r
    }
    return { nodos, totales, abiertos: [...abiertos], resumen }
  }, [filas, escenario, etiquetaTipo, verCostos])

  const t = (n: NodoLienzo) => totales.get(n.id)!

  const capas = useMemo<Capa[]>(() => {
    const uso: Marca[] = [
      { tono: 'verde', icono: '✓', etiqueta: 'en dotación' },
      { tono: 'ambar', icono: '○', etiqueta: 'con vacantes' },
      { tono: 'rojo', icono: '▲', etiqueta: 'por encima' },
      { tono: 'gris', icono: '–', etiqueta: 'sin dotación' },
    ]
    const lista: Capa[] = [
      {
        clave: 'uso',
        etiqueta: 'Uso de la dotación',
        leyenda: uso,
        marca: (n) => {
          const x = t(n)
          if (x.excede > 0) return { ...uso[2], corta: `+${x.excede}` }
          if (x.vac > 0) return { ...uso[1], corta: `${x.vac} vac.` }
          if (x.aprob === 0) return n.clase === 'plaza' ? uso[3] : null
          return { ...uso[0], corta: 'completa' }
        },
      },
      {
        clave: 'vacantes',
        etiqueta: 'Vacantes',
        leyenda: [
          { tono: 'ambar', icono: '○', etiqueta: 'tiene vacantes' },
          { tono: 'gris', icono: '·', etiqueta: 'sin vacantes' },
        ],
        marca: (n) => {
          const x = t(n)
          return x.vac > 0
            ? { tono: 'ambar', icono: '○', etiqueta: 'tiene vacantes', corta: `${x.vac} ${x.vac === 1 ? 'vacante' : 'vacantes'}` }
            : { tono: 'gris', icono: '·', etiqueta: 'sin vacantes', corta: 'sin vacantes' }
        },
      },
      {
        clave: 'encima',
        etiqueta: 'Por encima de la dotación',
        leyenda: [
          { tono: 'rojo', icono: '▲', etiqueta: 'gente por encima de lo aprobado' },
          { tono: 'gris', icono: '·', etiqueta: 'dentro de lo aprobado' },
        ],
        marca: (n) => {
          const x = t(n)
          return x.excede > 0
            ? { tono: 'rojo', icono: '▲', etiqueta: 'gente por encima de lo aprobado', corta: `+${x.excede} por encima` }
            : { tono: 'gris', icono: '·', etiqueta: 'dentro de lo aprobado', corta: 'dentro' }
        },
      },
      {
        clave: 'inferido',
        etiqueta: 'Inferido de los organigramas',
        leyenda: [
          { tono: 'ambar', icono: '≈', etiqueta: 'inferido, sin confirmar' },
          { tono: 'verde', icono: '✓', etiqueta: 'confirmado' },
        ],
        marca: (n) => {
          const f = n.datos?.fila as FilaOrg | undefined
          if (f?.inferido) return { tono: 'ambar', icono: '≈', etiqueta: 'inferido, sin confirmar', corta: 'inferido' }
          const x = t(n)
          if (x.inferidas > 0) return { tono: 'ambar', icono: '≈', etiqueta: 'inferido, sin confirmar', corta: `${x.inferidas} debajo` }
          return { tono: 'verde', icono: '✓', etiqueta: 'confirmado', corta: 'confirmado' }
        },
      },
      {
        clave: 'tramo',
        etiqueta: 'Tramo de control',
        leyenda: [
          { tono: 'ambar', icono: '≡', etiqueta: 'más de 8 dependencias directas' },
          { tono: 'verde', icono: '≡', etiqueta: 'hasta 8' },
        ],
        marca: (n) => {
          if (n.clase !== 'unidad') return null
          const d = t(n).directos
          if (!d) return null
          return d > 8
            ? { tono: 'ambar', icono: '≡', etiqueta: 'más de 8 dependencias directas', corta: `${d} directas` }
            : { tono: 'verde', icono: '≡', etiqueta: 'hasta 8', corta: `${d} directas` }
        },
      },
    ]
    if (verCostos) {
      const costos = nodos.map((n) => t(n).costo ?? 0).filter((x) => x > 0).sort((a, b) => a - b)
      const corte = (q: number) => costos[Math.floor(q * (costos.length - 1))] ?? 0
      const [c1, c2] = [corte(0.5), corte(0.85)]
      lista.push({
        clave: 'costo',
        etiqueta: 'Costo mensual 🔒',
        leyenda: [
          { tono: 'carbon', icono: '$$$', etiqueta: 'de los más altos' },
          { tono: 'gris', icono: '$$', etiqueta: 'medio' },
          { tono: 'gris', icono: '$', etiqueta: 'bajo o sin referencia' },
        ],
        marca: (n) => {
          const c = t(n).costo
          if (c == null || c <= 0) return { tono: 'gris', icono: '$', etiqueta: 'bajo o sin referencia', corta: 'sin referencia' }
          if (c >= c2) return { tono: 'carbon', icono: '$$$', etiqueta: 'de los más altos', corta: '$$$' }
          if (c >= c1) return { tono: 'gris', icono: '$$', etiqueta: 'medio', corta: '$$' }
          return { tono: 'gris', icono: '$', etiqueta: 'bajo o sin referencia', corta: '$' }
        },
      })
    }
    return lista
    // `t` lee `totales`, que es lo que cambia.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totales, verCostos, nodos])

  const cuerpo = (n: NodoLienzo, capa: string) => {
    const x = t(n)
    if (capa === 'costo') {
      return x.costo != null && x.costo > 0 ? (
        <span className="num">
          <b>{fmtBs(x.costo)}</b>/mes
        </span>
      ) : (
        <span>sin costo de referencia</span>
      )
    }
    if (!x.plazas) return <span>sin plazas</span>
    return (
      <>
        <span className="num" title={`${x.ocu} ocupadas de ${x.aprob} aprobadas`}>
          <b>{ENTERO.format(x.ocu)}</b>/{ENTERO.format(x.aprob)}
        </span>
        <span className="lz-barra" aria-hidden>
          <i className={x.ocu > x.aprob ? 'x' : undefined} style={{ width: `${x.aprob ? Math.min(100, (x.ocu / x.aprob) * 100) : 0}%` }} />
        </span>
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
  const opcionesTipo = tiposUnidad.map((x) => ({ valor: x.clave, etiqueta: x.etiqueta }))
  const opcionesCargo = cargos.map((x) => ({ valor: x.id, etiqueta: x.nombre }))

  const menu = (n: NodoLienzo): AccionMenu[] => {
    const f = n.datos?.fila as FilaOrg | undefined
    if (!f || f.diff === 'quitado') return []
    if (n.clase === 'unidad') {
      return [
        {
          clave: 'renombrar',
          etiqueta: 'Renombrar o cambiar tipo',
          campos: [
            { nombre: 'nombre', etiqueta: 'Nombre', tipo: 'texto', inicial: f.nombre, requerido: true },
            { nombre: 'tipo', etiqueta: 'Tipo', tipo: 'opciones', opciones: opcionesTipo, inicial: f.tipo },
          ],
          ejecutar: (v) => llamar(renombrarUnidad, { ref: f.ref, nombre: v.nombre, tipo: v.tipo }),
          hecho: 'Unidad actualizada en el escenario.',
        },
        {
          clave: 'unidad',
          etiqueta: 'Agregar una unidad debajo',
          campos: [
            { nombre: 'nombre', etiqueta: 'Nombre', tipo: 'texto', requerido: true },
            { nombre: 'tipo', etiqueta: 'Tipo', tipo: 'opciones', opciones: opcionesTipo, inicial: 'gerencia' },
          ],
          ejecutar: (v) => llamar(agregarUnidad, { padre_ref: f.ref, nombre: v.nombre, tipo: v.tipo }),
          hecho: 'Unidad agregada al escenario.',
        },
        {
          clave: 'plaza',
          etiqueta: 'Agregar una plaza',
          campos: [
            { nombre: 'cargo_id', etiqueta: 'Cargo', tipo: 'opciones', opciones: opcionesCargo, requerido: true },
            { nombre: 'dotacion', etiqueta: 'Dotación', tipo: 'numero', inicial: '1', requerido: true },
          ],
          ejecutar: (v) => llamar(agregarPlaza, { unidad_ref: f.ref, cargo_id: v.cargo_id, dotacion: v.dotacion }),
          hecho: 'Plaza agregada al escenario.',
        },
        {
          clave: 'cerrar',
          etiqueta: 'Cerrar la unidad en el escenario',
          peligro: true,
          confirmar: 'Sale con sus plazas. Las unidades que tenga debajo hay que moverlas o cerrarlas antes.',
          ejecutar: () => llamar(cerrarUnidad, { ref: f.ref }),
          hecho: 'Unidad cerrada en el escenario.',
        },
      ]
    }
    return [
      {
        clave: 'dotacion',
        etiqueta: 'Cambiar la dotación',
        campos: [{ nombre: 'dotacion', etiqueta: 'Dotación aprobada', tipo: 'numero', inicial: String(f.aprob), requerido: true }],
        ejecutar: (v) => llamar(cambiarDotacion, { ref: f.ref, dotacion: v.dotacion }),
        hecho: 'Dotación cambiada en el escenario.',
      },
      {
        clave: 'cerrar',
        etiqueta: 'Cerrar la plaza en el escenario',
        peligro: true,
        confirmar: 'Lo que le reportaba pasa a reportar a quien ella reportaba.',
        ejecutar: () => llamar(cerrarPlaza, { ref: f.ref }),
        hecho: 'Plaza cerrada en el escenario.',
      },
    ]
  }

  const resumenCambios = resumen ? (
    <div className="mb-3 rounded-xl bg-[#f1edfa] px-3 py-2.5 text-[12.5px] text-[#4b3787]">
      <p className="font-semibold">{escenario?.nombre}</p>
      <p className="mt-1">
        {resumen.unidades >= 0 ? '+' : '−'}
        {Math.abs(resumen.unidades)} {Math.abs(resumen.unidades) === 1 ? 'unidad' : 'unidades'} · {resumen.plazas >= 0 ? '+' : '−'}
        {Math.abs(resumen.plazas)} {Math.abs(resumen.plazas) === 1 ? 'plaza' : 'plazas'} · dotación {resumen.dotacion >= 0 ? '+' : '−'}
        {Math.abs(resumen.dotacion)}
        {resumen.costo != null && (
          <>
            {' · '}
            {resumen.costo >= 0 ? '+' : '−'}
            {fmtBs(Math.abs(resumen.costo))}/mes 🔒
          </>
        )}
      </p>
      {!escenario?.editable && <p className="mt-1 text-[11.5px]">Solo lectura: el escenario ya no está en borrador o tu rol no lo edita.</p>}
    </div>
  ) : undefined

  return (
    <Lienzo
      pdf="organizacion"
      nodos={nodos}
      capas={capas}
      cuerpo={cuerpo}
      abiertosIniciales={abiertos}
      nombre={escenario ? `Organigrama · ${escenario.nombre}` : 'Organigrama'}
      claveMemoria={`org:${esc || 'real'}`}
      editable={!!escenario?.editable}
      validarSoltar={(o, d) => {
        if (d.clase !== 'unidad') return 'Solo se cuelga de una unidad.'
        if (d.diff === 'quitado' || o.diff === 'quitado') return 'Lo que el escenario cierra no se mueve.'
        return null
      }}
      alSoltar={(o, d) => {
        const ref = (o.datos?.fila as FilaOrg).ref
        const destino = (d.datos?.fila as FilaOrg).ref
        return o.clase === 'unidad' ? llamar(moverUnidad, { ref, padre_ref: destino }) : llamar(moverPlaza, { ref, unidad_ref: destino })
      }}
      menu={menu}
      resumenCambios={resumenCambios}
      ayuda={
        escenario?.editable
          ? 'Arrastra una caja sobre otra para cambiarle la dependencia · «⋯» para agregar, renombrar o cerrar · clic: desplegar'
          : undefined
      }
    />
  )
}
