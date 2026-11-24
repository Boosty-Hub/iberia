/** El estado de un lote de cambios (`org.escenario` de tipo 'cambios'), con su color. */
export const ESTADO_LOTE: Record<string, { etiqueta: string; clase: string }> = {
  borrador: { etiqueta: 'Borrador', clase: 'bg-[#eef0f3] text-marca-600' },
  en_aprobacion: { etiqueta: 'Por aprobar', clase: 'bg-[#fdf4e3] text-[#8a5a12]' },
  aprobado: { etiqueta: 'Aprobado', clase: 'bg-[#e7f5ee] text-[#1f6f4b]' },
  publicado: { etiqueta: 'Aplicado', clase: 'bg-[#e7f5ee] text-[#1f6f4b]' },
  descartado: { etiqueta: 'Descartado o rechazado', clase: 'bg-[#fdecea] text-[#a3241f]' },
}
