import type { FuenteTabla } from '@/lib/plataforma/tabla-servidor'

/**
 * Las fuentes de `TablaDatos` del módulo de Organización (R1). Cada una lee una
 * función `ui.*` de la migración R1 con la sesión de quien mira: la RLS y el
 * permiso que la función pide por dentro deciden qué filas existen. Las de
 * costos (`sistema:costos`) solo las consulta una página que ya pidió el
 * permiso: sin él, ni se preguntan.
 */

const BASE = '/sistema/nucleo/organizacion'
const opcCount = (o?: { count?: 'exact' }) => (o?.count ? { count: o.count } : undefined)

export const TABLA_PERSONAS: FuenteTabla = {
  id: 'personas',
  titulo: 'Personas',
  modulo: 'NUC-ORG',
  recurso: 'sistema:estructura',
  ruta: `${BASE}/personas`,
  claveFila: 'id',
  ficha: { tipo: 'persona', columna: 'empleado_id' },
  busqueda: 'busqueda',
  orden: { columna: 'nombre', dir: 'asc' },
  columnas: [
    { clave: 'nombre', etiqueta: 'Nombre', ancho: 200 },
    { clave: 'ficha', etiqueta: 'Ficha', tipo: 'codigo', ayuda: 'Número de ficha de Capital Humano' },
    { clave: 'cargo', etiqueta: 'Cargo', agrupable: true, ancho: 180 },
    { clave: 'unidad', etiqueta: 'Unidad', agrupable: true, ancho: 180 },
    { clave: 'direccion', etiqueta: 'Dirección', filtrable: true, agrupable: true },
    {
      clave: 'tipo',
      etiqueta: 'Ocupación',
      tipo: 'insignia',
      filtrable: true,
      agrupable: true,
      etiquetaDe: 'tipo_nombre',
      tonos: { titular: 'verde', interino: 'azul', encargado: 'azul', pasante: 'neutro', aprendiz_inces: 'neutro' },
    },
    { clave: 'desde', etiqueta: 'Desde', tipo: 'fecha' },
    {
      clave: 'certeza',
      etiqueta: 'Certeza',
      tipo: 'insignia',
      filtrable: true,
      etiquetas: { exacta: 'Exacta', por_nombre_de_cargo: 'Por nombre del cargo', manual: 'Registrada a mano' },
      tonos: { exacta: 'verde', por_nombre_de_cargo: 'ambar', manual: 'azul' },
      ayuda: '«Por nombre del cargo»: la carga casó a la persona con la plaza por el texto del cargo; conviene confirmarlo',
    },
    {
      clave: 'excede',
      etiqueta: 'Sobre la dotación',
      tipo: 'insignia',
      filtrable: true,
      etiquetas: { si: 'Por encima', no: 'Dentro' },
      tonos: { si: 'ambar', no: 'neutro' },
      oculta: true,
    },
  ],
  consulta: (supabase, ctx, select, o) => supabase.schema('ui').rpc('personas', { p_al: ctx.al }, opcCount(o)).select(select),
}

export const TABLA_CARGOS: FuenteTabla = {
  id: 'cargos',
  titulo: 'Cargos',
  modulo: 'NUC-ORG',
  recurso: 'sistema:estructura',
  ruta: `${BASE}/cargos`,
  claveFila: 'id',
  ficha: { tipo: 'cargo', columna: 'id' },
  busqueda: 'busqueda',
  orden: { columna: 'nombre', dir: 'asc' },
  columnas: [
    { clave: 'nombre', etiqueta: 'Cargo', ancho: 220, ayudaEdicion: 'Renombrar (queda en la auditoría)' },
    { clave: 'familia', etiqueta: 'Familia', filtrable: true, agrupable: true, etiquetaDe: 'familia_nombre' },
    { clave: 'nivel', etiqueta: 'Nivel', tipo: 'entero', filtrable: true },
    { clave: 'sinonimos', etiqueta: 'Sinónimos', ancho: 220, ayuda: 'Otros nombres del mismo cargo, separados por «;»' },
    { clave: 'plazas', etiqueta: 'Plazas', tipo: 'entero', total: true },
    { clave: 'dotacion', etiqueta: 'Dotación', tipo: 'entero', total: true },
    { clave: 'ocupantes', etiqueta: 'Ocupantes', tipo: 'entero', total: true, ayuda: 'Titulares al día de los datos' },
    { clave: 'vacantes', etiqueta: 'Vacantes', tipo: 'entero', total: true },
    {
      clave: 'activo',
      etiqueta: 'Estado',
      tipo: 'insignia',
      filtrable: true,
      etiquetas: { activo: 'Activo', inactivo: 'Inactivo' },
      tonos: { activo: 'verde', inactivo: 'neutro' },
    },
    { clave: 'clave', etiqueta: 'Clave', tipo: 'codigo', oculta: true },
  ],
  consulta: (supabase, ctx, select, o) => supabase.schema('ui').rpc('cargos', { p_al: ctx.al }, opcCount(o)).select(select),
}

export const ESTADO_PLAN: Record<string, string> = { sin_plan: 'Sin plan', sobre_plan: 'Sobre el plan', bajo_plan: 'Bajo el plan', en_plan: 'En el plan' }

export const TABLA_DOTACION: FuenteTabla = {
  id: 'dotacion',
  titulo: 'Dotación por unidad y cargo',
  modulo: 'NUC-ORG',
  recurso: 'sistema:dotacion',
  ruta: `${BASE}/dotacion`,
  claveFila: 'clave',
  ficha: { tipo: 'unidad', columna: 'unidad_ref' },
  busqueda: 'busqueda',
  orden: { columna: 'direccion', dir: 'asc' },
  columnas: [
    { clave: 'direccion', etiqueta: 'Dirección', filtrable: true, agrupable: true, oculta: true },
    { clave: 'unidad', etiqueta: 'Unidad', agrupable: true, ancho: 170 },
    { clave: 'cargo', etiqueta: 'Cargo', agrupable: true, ancho: 170 },
    { clave: 'familia', etiqueta: 'Familia', filtrable: true, agrupable: true, oculta: true },
    { clave: 'aprobada', etiqueta: 'Aprobada', tipo: 'entero', total: true, ayuda: 'Dotación de las plazas vigentes' },
    { clave: 'ocupada', etiqueta: 'Ocupada', tipo: 'entero', total: true, ayuda: 'Titulares al día de los datos' },
    { clave: 'vacantes', etiqueta: 'Vacantes', tipo: 'entero', total: true },
    { clave: 'por_encima', etiqueta: 'Por encima', tipo: 'entero', total: true },
    { clave: 'en_requisicion', etiqueta: 'En requisición', tipo: 'entero', total: true, ayuda: 'Personas pedidas en requisiciones en ruta, aprobadas o en selección' },
    { clave: 'plan', etiqueta: 'Plan aprobado', tipo: 'entero', total: true, ayuda: 'La versión aprobada del plan del año' },
    { clave: 'plan_borrador', etiqueta: 'Plan en borrador', tipo: 'entero', total: true, ayuda: 'La versión en borrador: se edita en la celda' },
    { clave: 'diferencia', etiqueta: 'Aprobada − plan', tipo: 'entero', total: true },
    {
      clave: 'estado_plan',
      etiqueta: 'Contra el plan',
      tipo: 'insignia',
      filtrable: true,
      etiquetas: ESTADO_PLAN,
      tonos: { sin_plan: 'neutro', sobre_plan: 'ambar', bajo_plan: 'azul', en_plan: 'verde' },
    },
  ],
  consulta: (supabase, ctx, select, o) =>
    supabase.schema('ui').rpc('dotacion', { p_al: ctx.al, p_anio: Number(ctx.al.slice(0, 4)) }, opcCount(o)).select(select),
}

export const ESTADOS_REQUISICION: Record<string, string> = {
  borrador: 'Borrador',
  en_aprobacion: 'En aprobación',
  devuelta: 'Devuelta',
  aprobada: 'Aprobada',
  rechazada: 'Rechazada',
  en_seleccion: 'En selección',
  cubierta: 'Cubierta',
  cancelada: 'Cancelada',
}

export const TABLA_REQUISICIONES: FuenteTabla = {
  id: 'requisiciones',
  titulo: 'Requisiciones',
  modulo: 'NUC-ORG',
  recurso: 'sistema:requisiciones',
  accion: 'crear',
  ruta: `${BASE}/requisiciones`,
  claveFila: 'id',
  ficha: { tipo: 'requisicion', columna: 'id' },
  busqueda: 'busqueda',
  orden: { columna: 'creado_en', dir: 'desc' },
  columnas: [
    { clave: 'numero', etiqueta: 'N.º', tipo: 'entero' },
    { clave: 'cargo', etiqueta: 'Cargo', ancho: 180 },
    { clave: 'unidad', etiqueta: 'Unidad', agrupable: true, ancho: 180 },
    { clave: 'origen', etiqueta: 'Origen', filtrable: true, agrupable: true, etiquetaDe: 'origen_nombre' },
    { clave: 'cantidad', etiqueta: 'Personas', tipo: 'entero', total: true },
    {
      clave: 'estado',
      etiqueta: 'Estado',
      tipo: 'insignia',
      filtrable: true,
      agrupable: true,
      etiquetas: ESTADOS_REQUISICION,
      tonos: { borrador: 'neutro', en_aprobacion: 'ambar', devuelta: 'ambar', aprobada: 'verde', rechazada: 'rojo', en_seleccion: 'azul', cubierta: 'verde', cancelada: 'neutro' },
    },
    { clave: 'paso', etiqueta: 'Paso actual', ancho: 160 },
    { clave: 'quien', etiqueta: 'La tiene', ancho: 160, ayuda: 'Quien debe firmar el paso actual' },
    { clave: 'dias', etiqueta: 'Días', tipo: 'entero', ayuda: 'Días en el paso actual (o desde que se creó)' },
    { clave: 'pedida_por', etiqueta: 'Pedida por', filtrable: true },
    {
      clave: 'fuera_de_plan',
      etiqueta: 'Plan',
      tipo: 'insignia',
      filtrable: true,
      etiquetas: { si: 'Fuera del plan', no: 'Dentro del plan' },
      tonos: { si: 'ambar', no: 'neutro' },
    },
    { clave: 'mia', etiqueta: 'Mías', tipo: 'insignia', filtrable: true, etiquetas: { si: 'Mía', no: 'De otros' }, tonos: { si: 'azul', no: 'neutro' }, oculta: true },
    { clave: 'creado_en', etiqueta: 'Pedida', tipo: 'fecha' },
    { clave: 'fecha_deseada', etiqueta: 'Fecha deseada', tipo: 'fecha', oculta: true },
  ],
  consulta: (supabase, _ctx, select, o) => supabase.schema('ui').rpc('requisiciones', undefined, opcCount(o)).select(select),
}

export const ESTADOS_ESCENARIO: Record<string, string> = {
  borrador: 'Borrador',
  en_aprobacion: 'En aprobación',
  aprobado: 'Aprobado',
  publicado: 'Publicado',
  descartado: 'Descartado',
}

export const TABLA_ESCENARIOS: FuenteTabla = {
  id: 'escenarios',
  titulo: 'Escenarios de estructura',
  modulo: 'NUC-ORG',
  recurso: 'sistema:escenarios',
  ruta: '/sistema/nucleo/escenarios',
  claveFila: 'id',
  ficha: { tipo: 'escenario', columna: 'id' },
  busqueda: 'busqueda',
  orden: { columna: 'creado_en', dir: 'desc' },
  tamano: 25,
  columnas: [
    { clave: 'nombre', etiqueta: 'Escenario', ancho: 220 },
    {
      clave: 'estado',
      etiqueta: 'Estado',
      tipo: 'insignia',
      filtrable: true,
      etiquetas: ESTADOS_ESCENARIO,
      tonos: { borrador: 'morado', en_aprobacion: 'ambar', aprobado: 'verde', publicado: 'verde', descartado: 'neutro' },
    },
    { clave: 'altas', etiqueta: 'Altas', tipo: 'entero', ayuda: 'Unidades y plazas nuevas contra la realidad de su fecha base' },
    { clave: 'bajas', etiqueta: 'Cierres', tipo: 'entero' },
    { clave: 'cambios', etiqueta: 'Cambios', tipo: 'entero', ayuda: 'Movimientos, renombres y cambios de dotación' },
    { clave: 'delta_dotacion', etiqueta: 'Δ dotación', tipo: 'entero', ayuda: 'Puestos de más (o de menos) que la realidad' },
    { clave: 'fecha_base', etiqueta: 'Fecha base', tipo: 'fecha' },
    { clave: 'vigente_desde', etiqueta: 'Rige desde', tipo: 'fecha' },
    { clave: 'creado_por', etiqueta: 'Creado por', filtrable: true },
    { clave: 'creado_en', etiqueta: 'Creado', tipo: 'fechaHora', oculta: true },
    { clave: 'descripcion', etiqueta: 'Para qué', oculta: true, ancho: 240 },
  ],
  consulta: (supabase, _ctx, select, o) => supabase.schema('ui').rpc('escenarios', undefined, opcCount(o)).select(select),
}

export const TIPOS_CONCILIACION: Record<string, string> = {
  contradiccion: 'Contradicción',
  faltante: 'Faltante',
  sin_casar: 'Sin casar',
  inferencia: 'Inferencia',
  decision: 'Decisión pendiente',
}

export const TABLA_CONCILIACION: FuenteTabla = {
  id: 'conciliacion',
  titulo: 'Conciliación del dato',
  modulo: 'NUC-ORG',
  recurso: 'sistema:estructura',
  ruta: '/sistema/nucleo/conciliacion',
  claveFila: 'id',
  ficha: { tipo: 'conciliacion', columna: 'id' },
  busqueda: 'busqueda',
  orden: { columna: 'creado_en', dir: 'asc' },
  columnas: [
    {
      clave: 'estado',
      etiqueta: 'Estado',
      tipo: 'insignia',
      filtrable: true,
      etiquetas: { abierto: 'Abierto', resuelto: 'Resuelto', descartado: 'Descartado' },
      tonos: { abierto: 'ambar', resuelto: 'verde', descartado: 'neutro' },
    },
    {
      clave: 'tipo',
      etiqueta: 'Tipo',
      tipo: 'insignia',
      filtrable: true,
      agrupable: true,
      etiquetas: TIPOS_CONCILIACION,
      tonos: { contradiccion: 'rojo', faltante: 'ambar', sin_casar: 'ambar', inferencia: 'azul', decision: 'morado' },
    },
    { clave: 'descripcion', etiqueta: 'Qué hay que decidir', ancho: 340 },
    { clave: 'objeto', etiqueta: 'Objeto', ancho: 160 },
    { clave: 'responsable', etiqueta: 'Lo resuelve', filtrable: true, agrupable: true },
    {
      clave: 'modulo',
      etiqueta: 'Módulo',
      filtrable: true,
      agrupable: true,
      etiquetas: { 'NUC-ORG': 'Organización', 'NUC-PRO': 'Procesos', 'NUC-DOC': 'Documentos' },
    },
    { clave: 'dias', etiqueta: 'Días', tipo: 'entero', ayuda: 'Días desde que entró a la cola' },
    { clave: 'fuente', etiqueta: 'Fuente', oculta: true, ancho: 240 },
    { clave: 'resuelto_por', etiqueta: 'Resolvió', oculta: true },
    { clave: 'resuelto_en', etiqueta: 'Resuelto', tipo: 'fechaHora', oculta: true },
    { clave: 'creado_en', etiqueta: 'Entró', tipo: 'fecha', oculta: true },
  ],
  consulta: (supabase, _ctx, select, o) => supabase.schema('ui').rpc('conciliacion', undefined, opcCount(o)).select(select),
}

export const TABLA_HISTORIAL_ORG: FuenteTabla = {
  id: 'historial-org',
  titulo: 'Historial de la estructura',
  modulo: 'NUC-ORG',
  recurso: 'sistema:auditoria',
  ruta: `${BASE}/historial`,
  claveFila: 'id',
  busqueda: 'busqueda',
  orden: { columna: 'en', dir: 'desc' },
  columnas: [
    { clave: 'en', etiqueta: 'Cuándo', tipo: 'fechaHora' },
    { clave: 'actor', etiqueta: 'Quién', filtrable: true, agrupable: true },
    { clave: 'tabla', etiqueta: 'Qué', tipo: 'insignia', filtrable: true, agrupable: true, etiquetaDe: 'tabla_nombre' },
    {
      clave: 'accion',
      etiqueta: 'Acción',
      tipo: 'insignia',
      filtrable: true,
      etiquetas: { INSERT: 'Alta', UPDATE: 'Cambio', DELETE: 'Baja' },
      tonos: { INSERT: 'verde', UPDATE: 'azul', DELETE: 'rojo' },
    },
    { clave: 'objeto', etiqueta: 'Objeto', ancho: 200 },
    { clave: 'cambios', etiqueta: 'Cambio', ancho: 380, ordenable: false },
    { clave: 'perimetro', etiqueta: 'Perímetro', filtrable: true, etiquetas: { si: '🔒 Nómina', no: 'General' }, oculta: true },
  ],
  consulta: (supabase, _ctx, select, o) => supabase.schema('ui').rpc('historial_org', undefined, opcCount(o)).select(select),
}

// -----------------------------------------------------------------------------
// Costos · perímetro de nómina (`sistema:costos`)
// -----------------------------------------------------------------------------

export const TABLA_COSTOS_CARGO: FuenteTabla = {
  id: 'costos-cargo',
  titulo: 'Costo de referencia por cargo',
  modulo: 'NUC-ORG',
  recurso: 'sistema:costos',
  ruta: `${BASE}/costos`,
  claveFila: 'cargo_id',
  ficha: { tipo: 'cargo', columna: 'cargo_id' },
  busqueda: 'busqueda',
  orden: { columna: 'dotacion', dir: 'desc' },
  tamano: 25,
  columnas: [
    { clave: 'cargo', etiqueta: 'Cargo', ancho: 200 },
    { clave: 'familia', etiqueta: 'Familia', filtrable: true, agrupable: true },
    { clave: 'dotacion', etiqueta: 'Dotación', tipo: 'entero', total: true },
    {
      clave: 'estado',
      etiqueta: 'Referencia',
      tipo: 'insignia',
      filtrable: true,
      etiquetas: { falta: 'Falta costo de referencia', con_costo: 'Con costo' },
      tonos: { falta: 'ambar', con_costo: 'verde' },
    },
    { clave: 'salario', etiqueta: 'Salario mensual', tipo: 'decimal', candado: true, ayudaEdicion: 'Nuevo salario de referencia: rige desde hoy' },
    {
      clave: 'moneda',
      etiqueta: 'Moneda',
      candado: true,
      opciones: [
        { valor: 'VES', etiqueta: 'Bs' },
        { valor: 'USD', etiqueta: 'USD' },
      ],
      etiquetas: { VES: 'Bs', USD: 'USD' },
    },
    { clave: 'bonos_usd', etiqueta: 'Bonos (USD)', tipo: 'decimal', candado: true },
    { clave: 'desde', etiqueta: 'Rige desde', tipo: 'fecha' },
    { clave: 'total_ves', etiqueta: 'Costo mensual por puesto (Bs)', tipo: 'decimal', candado: true },
    { clave: 'total_usd', etiqueta: 'Costo mensual por puesto (USD)', tipo: 'decimal', candado: true },
    {
      clave: 'por_confirmar',
      etiqueta: 'Componentes',
      tipo: 'insignia',
      filtrable: true,
      etiquetas: { si: 'Por confirmar', no: 'Confirmados' },
      tonos: { si: 'ambar', no: 'verde' },
    },
    { clave: 'fuente', etiqueta: 'Fuente', oculta: true },
  ],
  consulta: (supabase, ctx, select, o) => supabase.schema('ui').rpc('costos_cargo', { p_fecha: ctx.al }, opcCount(o)).select(select),
}

export const FORMA_COMPONENTE: Record<string, string> = { porcentaje: '% de la base', dias_anuales: 'Días de salario al año', monto_mensual: 'Monto mensual' }
export const BASE_COMPONENTE: Record<string, string> = {
  salario_normal: 'Salario normal',
  salario_integral: 'Salario integral',
  salario_y_bonos: 'Salario y bonos',
  ninguna: 'Ninguna',
}

export const TABLA_COMPONENTES: FuenteTabla = {
  id: 'componentes-costo',
  titulo: 'Componentes de costo',
  modulo: 'NUC-ORG',
  recurso: 'sistema:costos',
  ruta: `${BASE}/costos`,
  claveFila: 'id',
  orden: { columna: 'orden', dir: 'asc' },
  tamano: 25,
  columnas: [
    { clave: 'nombre', etiqueta: 'Componente', ancho: 220 },
    { clave: 'forma', etiqueta: 'Forma', etiquetas: FORMA_COMPONENTE },
    { clave: 'valor', etiqueta: 'Valor', tipo: 'decimal', ayudaEdicion: 'Nuevo valor: rige desde hoy (la versión anterior queda cerrada)' },
    { clave: 'base', etiqueta: 'Base', etiquetas: BASE_COMPONENTE },
    { clave: 'tope', etiqueta: 'Tope (salarios mínimos)', tipo: 'decimal' },
    { clave: 'moneda', etiqueta: 'Moneda', etiquetas: { VES: 'Bs', USD: 'USD' } },
    { clave: 'base_legal', etiqueta: 'Base legal', ancho: 260 },
    {
      clave: 'por_confirmar',
      etiqueta: 'Estado',
      tipo: 'insignia',
      filtrable: true,
      etiquetas: { si: 'Por confirmar con Capital Humano', no: 'Confirmado' },
      tonos: { si: 'ambar', no: 'verde' },
      opciones: [
        { valor: 'si', etiqueta: 'Por confirmar' },
        { valor: 'no', etiqueta: 'Confirmado' },
      ],
    },
    { clave: 'desde', etiqueta: 'Rige desde', tipo: 'fecha' },
    { clave: 'orden', etiqueta: 'Orden', tipo: 'entero', oculta: true },
    { clave: 'fuente', etiqueta: 'Fuente', oculta: true },
  ],
  consulta: (supabase, ctx, select, o) => supabase.schema('ui').rpc('componentes_costo', { p_fecha: ctx.al }, opcCount(o)).select(select),
}

export const TABLA_COSTO_UNIDADES: FuenteTabla = {
  id: 'costo-unidades',
  titulo: 'Costo por unidad',
  modulo: 'NUC-ORG',
  recurso: 'sistema:costos',
  ruta: `${BASE}/costos`,
  claveFila: 'unidad_ref',
  ficha: { tipo: 'unidad', columna: 'unidad_ref' },
  busqueda: 'busqueda',
  orden: { columna: 'costo_ves', dir: 'desc' },
  tamano: 25,
  columnas: [
    { clave: 'direccion', etiqueta: 'Dirección', filtrable: true, agrupable: true },
    { clave: 'unidad', etiqueta: 'Unidad', ancho: 220 },
    { clave: 'plazas', etiqueta: 'Plazas', tipo: 'entero', total: true },
    { clave: 'dotacion', etiqueta: 'Dotación', tipo: 'entero', total: true },
    { clave: 'dotacion_sin_costo', etiqueta: 'Sin costo de referencia', tipo: 'entero', total: true, ayuda: 'Puestos cuyo cargo no tiene costo de referencia: no suman (no son cero)' },
    { clave: 'costo_ves', etiqueta: 'Costo mensual (Bs)', tipo: 'decimal', total: true, candado: true },
    { clave: 'costo_usd', etiqueta: 'Costo mensual (USD)', tipo: 'decimal', total: true, candado: true },
  ],
  consulta: (supabase, ctx, select, o) => supabase.schema('ui').rpc('costo_unidades', { p_fecha: ctx.al }, opcCount(o)).select(select),
}

export const FUENTES_ORGANIZACION: Record<string, FuenteTabla> = Object.fromEntries(
  [
    TABLA_PERSONAS,
    TABLA_CARGOS,
    TABLA_DOTACION,
    TABLA_REQUISICIONES,
    TABLA_ESCENARIOS,
    TABLA_CONCILIACION,
    TABLA_HISTORIAL_ORG,
    TABLA_COSTOS_CARGO,
    TABLA_COMPONENTES,
    TABLA_COSTO_UNIDADES,
  ].map((f) => [f.id, f])
)
