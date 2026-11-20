'use client'

import { useCallback, useEffect, useState, useTransition } from 'react'
import { cargarIaObjeto, type IaDeObjeto } from '@/components/sistema/ia/acciones'
import { NivelIA } from '@/components/sistema/ia/nivel-ia'
import { PropuestaIA } from '@/components/sistema/ia/propuesta-ia'
import { abrirPreguntaIa } from '@/components/sistema/ia/abrir'

/**
 * La pestaña «IA» de `FichaObjeto` (Anexo E §7, «Ficha del objeto»): arriba
 * las propuestas de la IA sobre este objeto (pendientes primero), y abajo las
 * capacidades que aplican a este tipo con su nivel; una en N0 sale «apagada».
 * Con el interruptor general apagado no se pinta ninguna propuesta.
 */
export function PestanaIa({ tipo, id, titulo }: { tipo: string; id: string; titulo?: string }) {
  const [datos, setDatos] = useState<IaDeObjeto | null>(null)
  const [cargando, iniciar] = useTransition()
  const [vuelta, setVuelta] = useState(0)
  const recargar = useCallback(() => setVuelta((n) => n + 1), [])

  useEffect(() => {
    iniciar(async () => setDatos(await cargarIaObjeto(tipo, id).catch(() => null)))
  }, [tipo, id, vuelta])

  if (!datos) return <p className="py-4 text-center text-marca-400">{cargando ? 'Cargando lo de la IA…' : 'No se pudo leer lo de la IA.'}</p>

  const general = Boolean(datos.estado?.general)
  const pendientes = datos.propuestas.filter((p) => p.estado === 'pendiente')
  const decididas = datos.propuestas.filter((p) => p.estado !== 'pendiente')
  const preguntaViva = datos.capacidades.some((c) => c.codigo === 'NUC-PRO-IA-01' && c.viva) || Boolean(datos.estado?.capacidades['NUC-PRO-IA-01']?.encendida && general)

  return (
    <div className="flex flex-col gap-3" data-pestana-ia>
      {!general && (
        <p className="rounded-lg border border-[var(--borde)] bg-[#f4f5f7] p-2.5 text-[12.5px] text-marca-600">
          <strong className="font-semibold">La IA está apagada en toda la plataforma</strong> (interruptor general). Todo funciona por el camino manual; lo que
          había propuesto queda guardado y vuelve a verse al encenderla.
        </p>
      )}

      {general && (
        <section>
          <h3 className="mb-1.5 text-[11px] font-semibold tracking-[0.08em] text-marca-400 uppercase">Propuestas sobre este objeto</h3>
          {pendientes.length ? (
            <div className="flex flex-col gap-2">
              {pendientes.map((p) => (
                <PropuestaIA key={p.id} p={p} puedeDecidir={datos.puedeDecidir} alCambiar={recargar} />
              ))}
            </div>
          ) : (
            <p className="text-[12.5px] text-marca-400">Ninguna pendiente.</p>
          )}
          {decididas.length > 0 && (
            <details className="mt-2">
              <summary className="cursor-pointer text-[12px] text-marca-500 select-none">Decididas y aplicadas ({decididas.length})</summary>
              <div className="mt-1.5 flex flex-col gap-2">
                {decididas.map((p) => (
                  <PropuestaIA key={p.id} p={p} puedeDecidir={datos.puedeDecidir} decidioNombre={p.decidido_por_nombre} alCambiar={recargar} />
                ))}
              </div>
            </details>
          )}
        </section>
      )}

      {general && preguntaViva && (
        <button
          type="button"
          onClick={() => abrirPreguntaIa(titulo ? `Explícame «${titulo}»: qué es, de qué depende y qué documentos lo rigen.` : '')}
          className="inline-flex h-8 w-fit items-center gap-1.5 rounded-lg border border-dashed border-[#9d93bd] bg-white px-2.5 text-xs font-medium text-[#4f4577] hover:bg-[#fbfaff]"
        >
          ✦ Preguntar a la IA sobre esto
        </button>
      )}

      <section>
        <h3 className="mb-1.5 text-[11px] font-semibold tracking-[0.08em] text-marca-400 uppercase">Capacidades que aplican aquí</h3>
        {datos.capacidades.length ? (
          <ul className="flex flex-col gap-1.5">
            {datos.capacidades.map((c) => (
              <li key={c.codigo} className="rounded-lg border border-[var(--borde)] px-2.5 py-1.5">
                <p className="flex flex-wrap items-center gap-1.5">
                  <NivelIA nivel={c.encendida && general ? c.nivel : 'N0'} />
                  <span className="font-mono text-[10.5px] text-marca-400">{c.codigo}</span>
                  <span className="text-[11px] text-marca-400">techo {c.techo}</span>
                </p>
                <p className="mt-0.5 text-[12.5px] font-medium text-marca-800">{c.nombre}</p>
                <p className="text-[12px] text-marca-500">{c.que_hace}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[12.5px] text-marca-400">Ninguna capacidad de IA aplica a este tipo de objeto.</p>
        )}
      </section>
    </div>
  )
}
