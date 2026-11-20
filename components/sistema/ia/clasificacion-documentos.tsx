import { createClient } from '@/lib/supabase/server'
import { COLUMNAS_PROPUESTA, estadoIa } from '@/lib/ia/servidor'
import { capacidadViva, instanteHace, type PropuestaVista } from '@/lib/ia/niveles'
import { NivelIA } from '@/components/sistema/ia/nivel-ia'
import { PropuestaIA } from '@/components/sistema/ia/propuesta-ia'
import { BotonAccionIa } from '@/components/sistema/ia/gobierno'
import { clasificarDocumentosIa } from '@/components/sistema/ia/acciones'

/**
 * NUC-DOC-IA-02 en la cola de conciliación de documentos: el botón para que la
 * IA lea los metadatos de los «sin determinar» y lo último que propuso o
 * aplicó, con Aceptar / Rechazar o Deshacer ahí mismo. En N2 enseña cómo se
 * vería en N4, para que el comité vea lo que aprobaría.
 */
export async function ClasificacionDocumentosIa({ puedeEditar }: { puedeEditar: boolean }) {
  const estado = await estadoIa()
  if (!capacidadViva(estado, 'NUC-DOC-IA-02')) return null
  const nivel = estado!.capacidades['NUC-DOC-IA-02'].nivel
  const supabase = await createClient()
  const { data } = await supabase
    .schema('ia')
    .from('propuesta')
    .select(COLUMNAS_PROPUESTA)
    .eq('capacidad', 'NUC-DOC-IA-02')
    .in('estado', ['pendiente', 'aceptada'])
    .gte('creado_en', instanteHace(2 * 86_400_000))
    .order('creado_en', { ascending: false })
    .range(0, 5)
  const recientes = (data ?? []) as unknown as PropuestaVista[]

  return (
    <section data-clasificacion-ia className="mb-3 rounded-xl border border-[#e6dff7] bg-gradient-to-b from-white to-[#fbf8ff] p-3">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-[13px] font-semibold text-marca-900">
          <span aria-hidden className="text-[#5a3f9e]">✦</span> La IA clasifica la cola
        </h2>
        <NivelIA nivel={nivel} />
        <span className="font-mono text-[10.5px] text-marca-400">NUC-DOC-IA-02</span>
        <span className="flex-1" />
        {puedeEditar && <BotonAccionIa etiqueta="Clasificar con la IA" accion={clasificarDocumentosIa} ayuda="Lee solo metadatos de hasta 8 documentos sin determinar (nunca perímetros ni datos sensibles)" />}
      </div>
      <p className="mt-1 max-w-3xl text-[12px] text-marca-600">
        Lee solo los metadatos de los documentos con estado sin determinar —nunca el archivo, ni un perímetro, ni los que traen datos sensibles— y propone estado, familia
        y proceso.{' '}
        {nivel === 'N4'
          ? 'En N4 aplica sola la familia y el proceso (metadatos internos) y deja 12 horas para deshacer; el estado de vigencia siempre lo decides tú.'
          : 'Hoy está en ' + nivel + ': todo queda como propuesta y lo decides tú, una por una.'}
      </p>

      {nivel !== 'N4' && (
        <div className="mt-2 rounded-lg border border-dashed border-[#b9bfc8] bg-white p-2 text-[12px] text-marca-600" aria-label="Vista previa de N4">
          <p className="mb-1 text-[11px] font-semibold tracking-[0.06em] text-marca-400 uppercase">Así se vería en N4 (vista previa, no aplica nada)</p>
          <p className="flex flex-wrap items-center gap-1.5">
            <NivelIA nivel="N4" /> <span className="text-marca-800">Clasificó II-21-40-001 · familia FAM-05 (metadatos internos)</span>
          </p>
          <p className="mt-1 inline-flex items-center gap-2 rounded-lg bg-[#f4f5f7] px-2 py-1">
            <span aria-hidden>↶</span> Se puede deshacer por 11 h 59 min
            <span className="inline-flex h-6 items-center rounded-md border border-[#b9bfc8] bg-white px-2 font-semibold text-marca-400">↶ Deshacer</span>
          </p>
        </div>
      )}

      {recientes.length > 0 && (
        <div className="mt-2 grid gap-2 lg:grid-cols-2">
          {recientes.map((p) => (
            <PropuestaIA key={p.id} p={p} puedeDecidir={puedeEditar} compacta />
          ))}
        </div>
      )}
    </section>
  )
}
