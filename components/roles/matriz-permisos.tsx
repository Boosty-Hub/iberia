'use client'

import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { guardarMatriz, type FilaMatriz } from '@/app/dashboard/roles/acciones'
import { IconoAlerta, IconoBuscar, IconoCandado, IconoCheck } from '@/components/iconos'
import {
  ACCIONES,
  ETIQUETA_ACCION,
  GRUPOS,
  NIVELES,
  SIN_PERMISO,
  techoPermite,
  type Accion,
  type MapaPermisos,
  type Nivel,
  type Permiso,
  type Recurso,
} from '@/lib/permisos'
import { cn } from '@/lib/utils'

/**
 * La matriz de permisos de un rol: filas por recurso, columnas por acción.
 *
 * Tres clases de casilla, y cada una se ve distinta:
 *   · **marcable** — la acción existe en ese recurso y el nivel la permite;
 *   · **no aplica** — la acción no existe ahí (un certificado no se «crea» desde
 *     aquí): un guion, sin casilla, para no ofrecer algo que no hace nada;
 *   · **bloqueada por el nivel** — existe, pero el nivel del rol no la deja
 *     (un rol de solo lectura no edita): un candado con la razón.
 *
 * Marcar crear, editar o eliminar marca también ver, igual que en la base: una
 * pantalla que se puede editar pero no abrir no existe. Y desmarcar ver apaga el
 * resto de la fila.
 *
 * Nada se guarda hasta pulsar «Guardar cambios»; mientras tanto la barra de
 * abajo cuenta los cambios, y salir de la página con cambios pendientes avisa.
 */
export function MatrizPermisos({
  rolId,
  nivel,
  inventario,
  inicial,
}: {
  rolId: string
  nivel: Nivel
  inventario: Recurso[]
  inicial: MapaPermisos
}) {
  const soloLectura = nivel === 'admin'
  const base = useMemo(() => normalizar(inventario, nivel, inicial, soloLectura), [inventario, nivel, inicial, soloLectura])
  const [matriz, setMatriz] = useState<MapaPermisos>(base)
  const [filtro, setFiltro] = useState('')
  const [estado, setEstado] = useState<{ ok?: string; error?: string }>({})
  const [guardando, iniciar] = useTransition()

  const cambios = useMemo(
    () => inventario.reduce((n, r) => n + ACCIONES.filter((a) => matriz[r.clave]?.[a] !== base[r.clave]?.[a]).length, 0),
    [inventario, matriz, base]
  )

  // Salir con cambios sin guardar pregunta antes. Es la pérdida más tonta: un
  // rato marcando casillas y un clic en el menú.
  const pendientes = useRef(cambios)
  useEffect(() => {
    pendientes.current = cambios
  }, [cambios])
  useEffect(() => {
    const aviso = (ev: BeforeUnloadEvent) => {
      if (pendientes.current > 0) ev.preventDefault()
    }
    window.addEventListener('beforeunload', aviso)
    return () => window.removeEventListener('beforeunload', aviso)
  }, [])

  const puedeMarcar = (r: Recurso, a: Accion) => !soloLectura && techoPermite(nivel, r, a)

  const poner = (clave: string, a: Accion, valor: boolean, r: Recurso) => {
    setEstado({})
    setMatriz((m) => {
      const fila = { ...(m[clave] ?? SIN_PERMISO) }
      fila[a] = valor
      if (a !== 'ver' && valor) fila.ver = true
      if (a === 'ver' && !valor) for (const otra of ACCIONES) fila[otra] = false
      // Solo lo que el techo permite: al apagar ver no se prenden candados.
      for (const otra of ACCIONES) if (!techoPermite(nivel, r, otra)) fila[otra] = false
      return { ...m, [clave]: fila }
    })
  }

  /** Marca o desmarca una columna entera dentro de un grupo. */
  const ponerColumna = (recursos: Recurso[], a: Accion, valor: boolean) => {
    setEstado({})
    setMatriz((m) => {
      const nueva = { ...m }
      for (const r of recursos) {
        if (!puedeMarcar(r, a)) continue
        const fila = { ...(nueva[r.clave] ?? SIN_PERMISO) }
        fila[a] = valor
        if (a !== 'ver' && valor) fila.ver = true
        if (a === 'ver' && !valor) for (const otra of ACCIONES) fila[otra] = false
        nueva[r.clave] = fila
      }
      return nueva
    })
  }

  const guardar = () =>
    iniciar(async () => {
      const filas: FilaMatriz[] = inventario.map((r) => ({ recurso: r.clave, ...(matriz[r.clave] ?? SIN_PERMISO) }))
      const r = await guardarMatriz(rolId, filas)
      setEstado(r)
    })

  const q = filtro.trim().toLowerCase()
  const coincide = (r: Recurso) =>
    !q || `${r.nombre} ${r.subtitulo ?? ''} ${r.clave}`.toLowerCase().includes(q)

  const totales = ACCIONES.map((a) => ({
    a,
    n: inventario.filter((r) => matriz[r.clave]?.[a]).length,
  }))

  return (
    <div className="matriz">
      <div className="matriz-herramientas">
        <label className="relative block min-w-0 flex-1 sm:max-w-sm">
          <span className="sr-only">Buscar en la matriz</span>
          <IconoBuscar className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-marca-400" />
          <input
            type="search"
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
            placeholder="Buscar módulo, sección o lección"
            className="campo h-10 pl-9"
          />
        </label>
        <dl className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-marca-500">
          {totales.map(({ a, n }) => (
            <div key={a} className="flex gap-1">
              <dt>{ETIQUETA_ACCION[a]}</dt>
              <dd className="font-semibold tabular-nums text-marca-800">{n}</dd>
            </div>
          ))}
        </dl>
      </div>

      {soloLectura && (
        <p className="matriz-aviso">
          <IconoCandado className="h-4 w-4 shrink-0" />
          Este rol es de nivel {NIVELES.admin}: lo puede todo, incluidos usuarios y roles. Por eso su matriz se
          muestra completa y no se edita — así nadie deja al programa sin quien lo administre.
        </p>
      )}
      {nivel === 'lector' && (
        <p className="matriz-aviso">
          <IconoCandado className="h-4 w-4 shrink-0" />
          Nivel {NIVELES.lector}: solo se puede marcar «Ver». Para dejar crear, editar o eliminar, cambia el nivel
          del rol a {NIVELES.consultor}.
        </p>
      )}

      {GRUPOS.map((g) => {
        const recursos = inventario.filter((r) => r.grupo === g.clave)
        const visibles = recursos.filter(coincide)
        if (visibles.length === 0) return null
        return (
          <section key={g.clave} className="matriz-grupo" aria-labelledby={`grupo-${g.clave}`}>
            <div className="tabla-scroll">
              <table className="matriz-tabla">
                <caption className="sr-only">{g.titulo}</caption>
                <thead>
                  <tr>
                    <th scope="col" className="matriz-recurso-th">
                      <span id={`grupo-${g.clave}`} className="block text-sm font-semibold text-marca-900">
                        {g.titulo}
                      </span>
                      <span className="mt-0.5 block text-xs font-normal text-marca-500">{g.descripcion}</span>
                    </th>
                    {ACCIONES.map((a) => {
                      const marcables = recursos.filter((r) => puedeMarcar(r, a))
                      const marcadas = marcables.filter((r) => matriz[r.clave]?.[a]).length
                      return (
                        <th key={a} scope="col" className="matriz-accion-th">
                          <span className="block">{ETIQUETA_ACCION[a]}</span>
                          {marcables.length > 0 ? (
                            <input
                              type="checkbox"
                              className="matriz-check mt-1.5"
                              aria-label={`${ETIQUETA_ACCION[a]}: todo ${g.titulo.toLowerCase()}`}
                              title={`Marcar o desmarcar «${ETIQUETA_ACCION[a]}» en todo el grupo`}
                              checked={marcadas === marcables.length}
                              ref={(el) => {
                                if (el) el.indeterminate = marcadas > 0 && marcadas < marcables.length
                              }}
                              onChange={(e) => ponerColumna(recursos, a, e.target.checked)}
                            />
                          ) : (
                            <span className="mt-1.5 block h-[18px]" aria-hidden />
                          )}
                        </th>
                      )
                    })}
                  </tr>
                </thead>
                <tbody>
                  {visibles.map((r) => (
                    <tr key={r.clave}>
                      <th scope="row" className="matriz-recurso">
                        <span className="block font-medium text-marca-800">{r.nombre}</span>
                        {(r.subtitulo || r.detalle) && (
                          <span className="mt-0.5 block text-xs font-normal text-marca-400">
                            {[
                              r.subtitulo,
                              ...ACCIONES.filter((a) => r.detalle?.[a]).map(
                                (a) => `${ETIQUETA_ACCION[a]}: ${r.detalle![a]}`
                              ),
                            ]
                              .filter(Boolean)
                              .join(' · ')}
                          </span>
                        )}
                      </th>
                      {ACCIONES.map((a) => {
                        const aplica = r.acciones.includes(a)
                        const marcable = puedeMarcar(r, a)
                        const valor = soloLectura ? aplica : Boolean(matriz[r.clave]?.[a])
                        const cambio = !soloLectura && valor !== Boolean(base[r.clave]?.[a])
                        return (
                          <td key={a} className={cn('matriz-celda', cambio && 'cambiada')}>
                            {!aplica ? (
                              <span className="text-marca-300" title="No aplica en este recurso">
                                —<span className="sr-only">No aplica</span>
                              </span>
                            ) : marcable ? (
                              <label className="matriz-toque">
                                <input
                                  type="checkbox"
                                  className="matriz-check"
                                  checked={valor}
                                  onChange={(e) => poner(r.clave, a, e.target.checked, r)}
                                  aria-label={`${ETIQUETA_ACCION[a]} · ${r.nombre}`}
                                />
                              </label>
                            ) : soloLectura ? (
                              <>
                                <IconoCheck className="mx-auto h-4 w-4 text-acento-600" />
                                <span className="sr-only">Permitido</span>
                              </>
                            ) : (
                              <span
                                className="inline-flex text-marca-300"
                                title={
                                  r.soloAdmin
                                    ? 'Solo el nivel administrador'
                                    : `El nivel ${NIVELES[nivel]} no lo permite`
                                }
                              >
                                <IconoCandado className="h-4 w-4" />
                                <span className="sr-only">Bloqueado por el nivel</span>
                              </span>
                            )}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )
      })}

      {q && inventario.filter(coincide).length === 0 && (
        <p className="py-10 text-center text-sm text-marca-500">Nada coincide con «{filtro}».</p>
      )}

      {!soloLectura && (
        <div className={cn('matriz-barra', (cambios > 0 || estado.ok || estado.error) && 'visible')} role="region" aria-label="Guardar la matriz">
          <p className="min-w-0 flex-1 text-sm" aria-live="polite">
            {estado.error ? (
              <span className="flex items-start gap-2 text-acento-700">
                <IconoAlerta className="mt-0.5 h-4 w-4 shrink-0" />
                {estado.error}
              </span>
            ) : cambios > 0 ? (
              <span className="text-marca-700">
                <span className="font-semibold">{cambios}</span> cambio{cambios === 1 ? '' : 's'} sin guardar
              </span>
            ) : estado.ok ? (
              <span className="flex items-center gap-2 text-emerald-700">
                <IconoCheck className="h-4 w-4" />
                {estado.ok}
              </span>
            ) : null}
          </p>
          {cambios > 0 && (
            <div className="flex shrink-0 gap-2">
              <button type="button" className="btn-neutro h-10" onClick={() => setMatriz(base)} disabled={guardando}>
                Descartar
              </button>
              <button type="button" className="btn-acento h-10" onClick={guardar} disabled={guardando}>
                {guardando ? 'Guardando…' : 'Guardar cambios'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/** Cada recurso del inventario con su fila, aunque la base no tenga ninguna. */
function normalizar(inventario: Recurso[], nivel: Nivel, inicial: MapaPermisos, todo: boolean): MapaPermisos {
  const m: MapaPermisos = {}
  for (const r of inventario) {
    const fila: Permiso = { ...SIN_PERMISO }
    for (const a of ACCIONES) fila[a] = todo ? r.acciones.includes(a) : Boolean(inicial[r.clave]?.[a]) && techoPermite(nivel, r, a)
    m[r.clave] = fila
  }
  return m
}
