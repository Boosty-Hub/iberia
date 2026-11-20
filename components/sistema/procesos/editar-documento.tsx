'use client'

import { useActionState } from 'react'
import { actualizarDocumento, type EstadoDocumento } from '@/app/sistema/nucleo/documentos/acciones'
import { DESTINOS_DOCUMENTO, ESTADOS_DOCUMENTO } from './comun'
import { Enviar, Mensaje, type OpcionSimple } from './formularios'

/** Corrección trazada de los metadatos de un documento. */
export function EditarDocumento({
  doc,
  procesos,
  familias,
}: {
  doc: { id: string; estado: string; proceso_ref: string | null; familia: string | null; destino: string | null; nota: string | null; alias: string[] }
  procesos: OpcionSimple[]
  familias: string[]
}) {
  const [estado, accion] = useActionState<EstadoDocumento, FormData>(actualizarDocumento, {})
  return (
    <form action={accion} className="space-y-4">
      <input type="hidden" name="id" value={doc.id} />
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="etiqueta" htmlFor="d-estado">Estado</label>
          <select id="d-estado" name="estado" defaultValue={doc.estado} className="campo">
            {Object.entries(ESTADOS_DOCUMENTO).map(([v, e]) => (
              <option key={v} value={v}>
                {e}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="etiqueta" htmlFor="d-destino">Destino en la plataforma</label>
          <select id="d-destino" name="destino" defaultValue={doc.destino ?? ''} className="campo">
            <option value="">Sin decidir</option>
            {Object.entries(DESTINOS_DOCUMENTO).map(([v, e]) => (
              <option key={v} value={v}>
                {e}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label className="etiqueta" htmlFor="d-proceso">Proceso al que pertenece</label>
        <select id="d-proceso" name="proceso_ref" defaultValue={doc.proceso_ref ?? ''} className="campo">
          <option value="">Sin proceso</option>
          {doc.proceso_ref && !procesos.some((p) => p.valor === doc.proceso_ref) && <option value={doc.proceso_ref}>El actual (no vigente)</option>}
          {procesos.map((p) => (
            <option key={p.valor} value={p.valor}>
              {p.etiqueta}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="etiqueta" htmlFor="d-familia">Familia</label>
        <input id="d-familia" name="familia" defaultValue={doc.familia ?? ''} list="familias-documento" className="campo" />
        <datalist id="familias-documento">
          {familias.map((f) => (
            <option key={f} value={f} />
          ))}
        </datalist>
      </div>
      <div>
        <label className="etiqueta" htmlFor="d-alias">Alias (códigos anteriores u otros nombres, uno por línea)</label>
        <textarea id="d-alias" name="alias" defaultValue={doc.alias.join('\n')} rows={3} className="campo font-mono text-sm" />
      </div>
      <div>
        <label className="etiqueta" htmlFor="d-nota">Nota</label>
        <textarea id="d-nota" name="nota" defaultValue={doc.nota ?? ''} rows={3} className="campo" />
      </div>
      <Enviar texto="Guardar corrección" pendiente="Guardando…" />
      <Mensaje estado={estado} />
    </form>
  )
}
