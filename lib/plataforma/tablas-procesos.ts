import type { FuenteTabla } from '@/lib/plataforma/tabla-servidor'
import type { Columna } from '@/lib/plataforma/tabla'

/**
 * Las fuentes de `TablaDatos` de Procesos (NUC-PRO) y Documentos (NUC-DOC),
 * R2 del rediseño. Todas leen funciones de `ui` (migración
 * `20261120201000_r2_procesos.sql`) con la RLS de quien mira: el perímetro de
 * los documentos no llega a quien no tiene `sistema:perimetros`.
 *
 * Se registran en `FUENTES` (`lib/plataforma/tablas.ts`), que es lo que leen la
 * exportación y las vistas guardadas.
 */

const SI_NO = { true: 'Sí', false: 'No' }

export const ETIQUETAS_CICLO: Record<string, string> = {
  vigente: 'Vigente',
  borrador: 'Borrador abierto',
  en_revision: 'En revisión',
  aprobada: 'Aprobada · espera su fecha',
  escenario: 'Escenario',
}

export const ETIQUETAS_DUENO: Record<string, string> = {
  asignado: 'Con titular',
  vacante: 'Plaza vacante',
  sin_plaza: 'Sin casar con plaza',
  sin_dueno: 'Sin dueño',
}

export const ETIQUETAS_SALUD: Record<string, string> = {
  vigente: 'Documentado',
  revision: 'En revisión o parcial',
  sin_documentar: 'Sin documentar',
}

export const ETIQUETAS_ESTADO_DOC: Record<string, string> = {
  vigente: 'Vigente',
  obsoleto: 'Obsoleto',
  borrador: 'Borrador',
  sin_determinar: 'Sin determinar',
  retirado: 'Retirado',
}

export const ETIQUETAS_MOTIVO: Record<string, string> = {
  datos_sensibles: 'Datos sensibles',
  codigo_reutilizado: 'Código reutilizado',
  sin_determinar: 'Estado sin determinar',
  obsoleto: 'Obsoleto por confirmar',
}

export const ETIQUETAS_ETAPA: Record<string, string> = {
  como_es: '1 · Cómo es',
  mejoras: '2 · Mejoras',
  revision: '3 · Revisión',
  optimizado: '4 · Optimizado',
}

export const ETIQUETAS_TIPO_CRUCE: Record<string, string> = {
  equivalente: 'Equivalente',
  contiene: 'Contiene',
  parcial: 'Parcial',
  sin_par: 'Sin par',
}

// ── Procesos ─────────────────────────────────────────────────────────────────

export const TABLA_CATALOGO_PROCESOS: FuenteTabla = {
  id: 'procesos-catalogo',
  titulo: 'Catálogo de procesos',
  modulo: 'NUC-PRO',
  recurso: 'sistema:procesos',
  ruta: '/sistema/nucleo/procesos/catalogo',
  claveFila: 'ref',
  ficha: { tipo: 'proceso', columna: 'ref' },
  busqueda: 'busqueda',
  orden: { columna: 'ruta', dir: 'asc' },
  tamano: 100,
  columnas: [
    { clave: 'ruta', etiqueta: 'Árbol', tipo: 'codigo', oculta: true, ayuda: 'El orden de lectura del árbol: macroproceso, proceso, subproceso, actividad' },
    { clave: 'codigo_sgc', etiqueta: 'SGC', tipo: 'codigo', ayuda: 'Código del SGC (II-XX…)' },
    { clave: 'codigo_informe', etiqueta: 'Informe', tipo: 'codigo', ayuda: 'Código del inventario de la Fase 1' },
    { clave: 'nombre', etiqueta: 'Proceso', etiquetaDe: 'nombre_arbol', ancho: 280 },
    { clave: 'nivel_nombre', etiqueta: 'Nivel', filtrable: true, agrupable: true },
    { clave: 'macro', etiqueta: 'Macroproceso', filtrable: true, agrupable: true, oculta: true },
    { clave: 'tipo', etiqueta: 'Tipo', etiquetaDe: 'tipo_nombre', filtrable: true, agrupable: true, oculta: true },
    {
      clave: 'estado_operativo',
      etiqueta: 'Estado operativo',
      tipo: 'insignia',
      etiquetaDe: 'estado_operativo_nombre',
      filtrable: true,
      agrupable: true,
      tonos: { vigente: 'verde', nuevo: 'ambar', propuesto: 'azul', no_se_ejecuta: 'neutro', sin_evidencia: 'ambar' },
    },
    {
      clave: 'ciclo',
      etiqueta: 'Ciclo',
      tipo: 'insignia',
      filtrable: true,
      agrupable: true,
      etiquetas: ETIQUETAS_CICLO,
      tonos: { vigente: 'verde', borrador: 'ambar', en_revision: 'azul', aprobada: 'azul', escenario: 'morado' },
      ayuda: 'Vigente, o la versión abierta que viene detrás (borrador, en revisión o aprobada)',
    },
    { clave: 'version', etiqueta: 'Versión', tipo: 'entero', oculta: true },
    { clave: 'dueno', etiqueta: 'Dueño (plaza)', ancho: 220 },
    {
      clave: 'dueno_estado',
      etiqueta: 'Dueño casado',
      tipo: 'insignia',
      filtrable: true,
      agrupable: true,
      etiquetas: ETIQUETAS_DUENO,
      tonos: { asignado: 'verde', vacante: 'rojo', sin_plaza: 'ambar', sin_dueno: 'neutro' },
    },
    { clave: 'docs_total', etiqueta: 'Documentos', tipo: 'entero', total: true },
    { clave: 'docs_vigentes', etiqueta: 'Docs. vigentes', tipo: 'entero', total: true, oculta: true },
    { clave: 'tiene_ficha', etiqueta: 'Ficha PHVA', tipo: 'insignia', filtrable: true, etiquetas: SI_NO, tonos: { true: 'verde', false: 'neutro' } },
    { clave: 'indicadores', etiqueta: 'Indicadores', tipo: 'entero', total: true, oculta: true },
    {
      clave: 'salud',
      etiqueta: 'Salud documental',
      tipo: 'insignia',
      filtrable: true,
      agrupable: true,
      oculta: true,
      etiquetas: ETIQUETAS_SALUD,
      tonos: { vigente: 'verde', revision: 'ambar', sin_documentar: 'neutro' },
    },
    { clave: 'codigo_dudoso', etiqueta: 'Código dudoso', tipo: 'insignia', filtrable: true, oculta: true, etiquetas: { true: 'Dudoso', false: 'No' }, tonos: { true: 'ambar', false: 'neutro' } },
    { clave: 'motivo_codigo', etiqueta: 'Por qué es dudoso', oculta: true, ancho: 220 },
    { clave: 'alerta_vacante', etiqueta: 'Dueño vacante', tipo: 'insignia', filtrable: true, oculta: true, etiquetas: SI_NO, tonos: { true: 'rojo', false: 'neutro' } },
    { clave: 'alerta_sin_indicadores', etiqueta: 'Ficha sin indicadores', tipo: 'insignia', filtrable: true, oculta: true, etiquetas: SI_NO, tonos: { true: 'ambar', false: 'neutro' } },
    { clave: 'area', etiqueta: 'Área según la fuente', oculta: true, ancho: 200 },
    {
      clave: 'acciones',
      etiqueta: 'Acciones',
      tipo: 'acciones',
      ordenable: false,
      acciones: [
        { clave: 'hijo', etiqueta: '＋ Hijo', titulo: 'Crea un proceso hijo en borrador', pide: 'Nombre del proceso hijo' },
        { clave: 'mover', etiqueta: 'Mover', titulo: 'Abre la ficha: cambia «Cuelga de» y queda en un borrador' },
        { clave: 'ficha', etiqueta: 'Ficha', titulo: 'Abre la ficha PHVA' },
      ],
    },
  ],
  consulta: (supabase, ctx, select, opciones) =>
    supabase
      .schema('ui')
      .rpc('procesos', { p_al: ctx.al, ...(ctx.esc ? { p_escenario: ctx.esc } : {}) }, opciones?.count ? { count: opciones.count } : undefined)
      .select(select),
}

export const TABLA_CRUCE_PROCESOS: FuenteTabla = {
  id: 'procesos-cruce',
  titulo: 'Cruce SGC ↔ informe',
  modulo: 'NUC-PRO',
  recurso: 'sistema:procesos',
  ruta: '/sistema/nucleo/procesos/cruce',
  claveFila: 'id',
  ficha: { tipo: 'proceso', columna: 'proceso_ref' },
  busqueda: 'busqueda',
  orden: { columna: 'codigo_sgc', dir: 'asc' },
  tamano: 100,
  columnas: [
    { clave: 'codigo_sgc', etiqueta: 'SGC', tipo: 'codigo' },
    { clave: 'proceso', etiqueta: 'Proceso del SGC', ancho: 240 },
    { clave: 'informe_codigo', etiqueta: 'Informe', tipo: 'codigo' },
    { clave: 'informe', etiqueta: 'Proceso del informe (Fase 1)', ancho: 240 },
    { clave: 'informe_macro', etiqueta: 'Macroproceso del informe', filtrable: true, agrupable: true, oculta: true },
    { clave: 'informe_estado', etiqueta: 'Estado en el informe', filtrable: true, oculta: true },
    {
      clave: 'tipo',
      etiqueta: 'Tipo de cruce',
      tipo: 'insignia',
      editable: true,
      filtrable: true,
      agrupable: true,
      etiquetas: ETIQUETAS_TIPO_CRUCE,
      tonos: { equivalente: 'verde', contiene: 'azul', parcial: 'ambar', sin_par: 'neutro' },
    },
    {
      clave: 'confirmado',
      etiqueta: 'Calidad lo confirmó',
      tipo: 'insignia',
      editable: true,
      filtrable: true,
      agrupable: true,
      etiquetas: { true: 'Confirmado', false: 'Por confirmar' },
      tonos: { true: 'verde', false: 'ambar' },
    },
    { clave: 'nota', etiqueta: 'Nota', editable: true, ancho: 260 },
  ],
  consulta: (supabase, _ctx, select, opciones) =>
    supabase
      .schema('ui')
      .rpc('cruce_procesos', undefined, opciones?.count ? { count: opciones.count } : undefined)
      .select(select),
}

export const TABLA_ESCENARIOS_PROCESOS: FuenteTabla = {
  id: 'procesos-escenarios',
  titulo: 'Escenarios de procesos',
  modulo: 'NUC-PRO',
  recurso: 'sistema:escenarios',
  ruta: '/sistema/nucleo/procesos/escenarios',
  claveFila: 'id',
  busqueda: 'busqueda',
  orden: { columna: 'creado_en', dir: 'desc' },
  tamano: 25,
  columnas: [
    { clave: 'nombre', etiqueta: 'Escenario', ancho: 220 },
    { clave: 'raiz', etiqueta: 'Copia de', ancho: 200 },
    {
      clave: 'estado',
      etiqueta: 'Estado',
      tipo: 'insignia',
      filtrable: true,
      agrupable: true,
      etiquetas: { borrador: 'En edición', en_aprobacion: 'En aprobación', aprobado: 'Aprobado', publicado: 'Publicado', descartado: 'Descartado' },
      tonos: { borrador: 'morado', en_aprobacion: 'ambar', aprobado: 'azul', publicado: 'verde', descartado: 'neutro' },
    },
    { clave: 'altas', etiqueta: 'Se agregan', tipo: 'entero', total: true, ayuda: 'Procesos nuevos frente a la realidad de hoy' },
    { clave: 'bajas', etiqueta: 'Se retiran', tipo: 'entero', total: true },
    { clave: 'cambios', etiqueta: 'Cambian', tipo: 'entero', total: true },
    { clave: 'borradores_abiertos', etiqueta: 'Choques', tipo: 'entero', ayuda: 'Procesos con un borrador abierto en la realidad: hay que cerrarlo antes de enviar' },
    { clave: 'fecha_base', etiqueta: 'Tomado el', tipo: 'fecha' },
    { clave: 'vigente_desde', etiqueta: 'Rige desde', tipo: 'fecha' },
    { clave: 'creado_en', etiqueta: 'Creado', tipo: 'fechaHora', oculta: true },
    { clave: 'publicado_en', etiqueta: 'Publicado', tipo: 'fechaHora', oculta: true },
    {
      clave: 'acciones',
      etiqueta: 'Abrir',
      tipo: 'acciones',
      ordenable: false,
      acciones: [
        { clave: 'abrir', etiqueta: 'Cambios', titulo: 'La lista de cambios, la comparación y el envío', href: '/sistema/nucleo/procesos/escenarios/{id}' },
        { clave: 'mapa', etiqueta: '◆ Mapa', titulo: 'Editar el escenario sobre el lienzo', href: '/sistema/nucleo/procesos?esc={id}' },
      ],
    },
  ],
  consulta: (supabase, _ctx, select, opciones) =>
    supabase
      .schema('ui')
      .rpc('escenarios_procesos', undefined, opciones?.count ? { count: opciones.count } : undefined)
      .select(select),
}

export const TABLA_VALIDACION_PROCESOS: FuenteTabla = {
  id: 'procesos-validacion',
  titulo: 'Validación por departamento',
  modulo: 'NUC-PRO',
  recurso: 'sistema:procesos',
  ruta: '/sistema/nucleo/procesos/validacion',
  claveFila: 'macro_ref',
  ficha: { tipo: 'proceso', columna: 'macro_ref' },
  busqueda: 'busqueda',
  orden: { columna: 'codigo', dir: 'asc' },
  tamano: 50,
  columnas: [
    { clave: 'codigo', etiqueta: 'Código', tipo: 'codigo' },
    { clave: 'macro', etiqueta: 'Macroproceso (área)', ancho: 230 },
    {
      clave: 'etapa',
      etiqueta: 'Etapa',
      tipo: 'insignia',
      filtrable: true,
      agrupable: true,
      etiquetas: ETIQUETAS_ETAPA,
      tonos: { como_es: 'neutro', mejoras: 'ambar', revision: 'azul', optimizado: 'verde' },
    },
    { clave: 'siguiente', etiqueta: 'Siguiente paso', ancho: 280 },
    { clave: 'tipo', etiqueta: 'Tipo', etiquetaDe: 'tipo_nombre', filtrable: true, agrupable: true, oculta: true },
    { clave: 'dueno', etiqueta: 'Dueño', oculta: true, ancho: 200 },
    { clave: 'procesos', etiqueta: 'Procesos', tipo: 'entero', total: true, ayuda: 'Procesos, subprocesos y actividades debajo del macroproceso' },
    { clave: 'sin_ficha', etiqueta: 'Sin ficha', tipo: 'entero', total: true, ayuda: '«Cómo es» por levantar' },
    { clave: 'con_ficha', etiqueta: 'Con ficha', tipo: 'entero', total: true, oculta: true },
    { clave: 'borradores', etiqueta: 'Borradores', tipo: 'entero', total: true, ayuda: 'Mejoras en redacción' },
    { clave: 'en_revision', etiqueta: 'En revisión', tipo: 'entero', total: true, ayuda: 'Esperan la decisión del comité en la bandeja' },
    { clave: 'aprobadas', etiqueta: 'Aprobadas', tipo: 'entero', total: true, oculta: true, ayuda: 'Aprobadas que esperan su fecha de vigencia' },
    { clave: 'validados', etiqueta: 'Validados', tipo: 'entero', total: true, ayuda: 'Vigentes que pasaron por la ruta de aprobación en la plataforma' },
    { clave: 'avance', etiqueta: 'Avance', tipo: 'porcentaje', ayuda: 'Validados sobre procesos' },
    { clave: 'solicitudes', etiqueta: 'Solicitudes en curso', tipo: 'entero', total: true, oculta: true },
    { clave: 'espera_dias', etiqueta: 'Espera (días)', tipo: 'entero', oculta: true },
  ],
  consulta: (supabase, _ctx, select, opciones) =>
    supabase
      .schema('ui')
      .rpc('validacion_procesos', undefined, opciones?.count ? { count: opciones.count } : undefined)
      .select(select),
}

const ETIQUETAS_ACCION_HISTORIAL = {
  creado: 'Creado',
  modificado: 'Modificado',
  estado: 'Cambio de estado',
  eliminado: 'Eliminado',
  conciliado: 'Conciliado',
  reabierto: 'Reabierto',
}
const TONOS_ACCION_HISTORIAL = { creado: 'verde', modificado: 'neutro', estado: 'azul', eliminado: 'rojo', conciliado: 'verde', reabierto: 'ambar' } as const

export const TABLA_HISTORIAL_PROCESOS: FuenteTabla = {
  id: 'procesos-historial',
  titulo: 'Historial de procesos',
  modulo: 'NUC-PRO',
  recurso: 'sistema:auditoria',
  ruta: '/sistema/nucleo/procesos/historial',
  claveFila: 'id',
  ficha: { tipo: 'proceso', columna: 'ref' },
  busqueda: 'busqueda',
  orden: { columna: 'en', dir: 'desc' },
  tamano: 50,
  columnas: [
    { clave: 'en', etiqueta: 'Cuándo', tipo: 'fechaHora' },
    { clave: 'accion', etiqueta: 'Qué pasó', tipo: 'insignia', filtrable: true, agrupable: true, etiquetas: ETIQUETAS_ACCION_HISTORIAL, tonos: TONOS_ACCION_HISTORIAL },
    { clave: 'objeto_tipo', etiqueta: 'Objeto', filtrable: true, agrupable: true },
    { clave: 'codigo', etiqueta: 'Código', tipo: 'codigo' },
    { clave: 'objeto', etiqueta: 'Proceso', ancho: 240 },
    { clave: 'version', etiqueta: 'Versión', tipo: 'entero' },
    { clave: 'estado', etiqueta: 'Estado' },
    { clave: 'cambios', etiqueta: 'Campos que cambiaron', ancho: 220 },
    { clave: 'quien', etiqueta: 'Quién', filtrable: true, agrupable: true },
  ],
  consulta: (supabase, _ctx, select, opciones) =>
    supabase
      .schema('ui')
      .rpc('historial_procesos', undefined, opciones?.count ? { count: opciones.count } : undefined)
      .select(select),
}

// ── Documentos ───────────────────────────────────────────────────────────────

const COLUMNAS_DOCUMENTOS: Columna[] = [
  { clave: 'codigo', etiqueta: 'Código', tipo: 'codigo' },
  { clave: 'titulo', etiqueta: 'Título', ancho: 280 },
  {
    clave: 'estado',
    etiqueta: 'Estado',
    tipo: 'insignia',
    filtrable: true,
    agrupable: true,
    etiquetas: ETIQUETAS_ESTADO_DOC,
    tonos: { vigente: 'verde', obsoleto: 'neutro', borrador: 'ambar', sin_determinar: 'ambar', retirado: 'neutro' },
  },
  { clave: 'tipo_yy', etiqueta: 'Tipo (YY)', etiquetaDe: 'tipo_etiqueta', filtrable: true, agrupable: true, ancho: 160 },
  { clave: 'proceso_xx', etiqueta: 'Proceso (XX)', etiquetaDe: 'proceso_xx_etiqueta', filtrable: true, agrupable: true, ancho: 160 },
  { clave: 'proceso', etiqueta: 'Proceso vinculado', ancho: 200 },
  { clave: 'proceso_ref', etiqueta: 'Proceso (filtro)', etiquetaDe: 'proceso', filtrable: true, agrupable: true, oculta: true },
  { clave: 'macro', etiqueta: 'Macroproceso', filtrable: true, agrupable: true, oculta: true },
  { clave: 'familia', etiqueta: 'Familia', filtrable: true, agrupable: true, oculta: true },
  {
    clave: 'perimetro',
    etiqueta: 'Perímetro',
    tipo: 'insignia',
    etiquetaDe: 'perimetro_nombre',
    filtrable: true,
    agrupable: true,
    candado: true,
    tonos: { general: 'neutro', nomina: 'morado', medico: 'morado', pcp: 'morado', formulas: 'morado' },
    ayuda: 'Los documentos de perímetro solo existen para quien tiene ese permiso',
  },
  {
    clave: 'datos_sensibles',
    etiqueta: 'Datos sensibles',
    tipo: 'insignia',
    filtrable: true,
    etiquetas: { true: '⚠ Sensibles', false: 'No' },
    tonos: { true: 'rojo', false: 'neutro' },
  },
  { clave: 'version', etiqueta: 'Versión' },
  { clave: 'fecha', etiqueta: 'Fecha', tipo: 'fecha' },
  { clave: 'alias_texto', etiqueta: 'Alias', oculta: true, ancho: 200 },
  { clave: 'n_archivos', etiqueta: 'Archivos de origen', tipo: 'entero', oculta: true },
  { clave: 'codigo_repetido', etiqueta: 'Código reutilizado', tipo: 'insignia', filtrable: true, oculta: true, etiquetas: SI_NO, tonos: { true: 'ambar', false: 'neutro' } },
  { clave: 'pendientes', etiqueta: 'En la cola', tipo: 'entero', total: true, oculta: true, ayuda: 'Motivos de conciliación sin decidir' },
]

const consultaDocumentos = (soloVigentes: boolean): FuenteTabla['consulta'] => (supabase, _ctx, select, opciones) => {
  const q = supabase.schema('ui').rpc('documentos', undefined, opciones?.count ? { count: opciones.count } : undefined).select(select)
  return soloVigentes ? q.eq('estado', 'vigente') : q
}

/** La biblioteca completa (todos los estados). */
export const TABLA_DOCUMENTOS: FuenteTabla = {
  id: 'documentos',
  titulo: 'Biblioteca de documentos',
  modulo: 'NUC-DOC',
  recurso: 'sistema:documentos',
  ruta: '/sistema/nucleo/documentos',
  claveFila: 'id',
  ficha: { tipo: 'documento', columna: 'id' },
  busqueda: 'busqueda',
  orden: { columna: 'codigo', dir: 'asc' },
  tamano: 50,
  columnas: COLUMNAS_DOCUMENTOS,
  consulta: consultaDocumentos(false),
}

/** La biblioteca por defecto: solo lo vigente (Anexo E · NUC-DOC «vigentes por defecto»). */
export const TABLA_DOCUMENTOS_VIGENTES: FuenteTabla = {
  ...TABLA_DOCUMENTOS,
  id: 'documentos-vigentes',
  titulo: 'Documentos vigentes',
  columnas: COLUMNAS_DOCUMENTOS.map((c) => (c.clave === 'estado' ? { ...c, oculta: true, filtrable: false, agrupable: false } : c)),
  consulta: consultaDocumentos(true),
}

const COLUMNAS_CONCILIACION: Columna[] = [
  {
    clave: 'motivo',
    etiqueta: 'Motivo',
    tipo: 'insignia',
    filtrable: true,
    agrupable: true,
    etiquetas: ETIQUETAS_MOTIVO,
    tonos: { datos_sensibles: 'rojo', codigo_reutilizado: 'ambar', sin_determinar: 'ambar', obsoleto: 'neutro' },
  },
  { clave: 'situacion', etiqueta: 'Situación', tipo: 'insignia', filtrable: true, etiquetas: { pendiente: 'Pendiente', decidido: 'Decidido' }, tonos: { pendiente: 'ambar', decidido: 'verde' } },
  { clave: 'codigo', etiqueta: 'Código', tipo: 'codigo' },
  { clave: 'titulo', etiqueta: 'Título', ancho: 240 },
  {
    clave: 'acciones',
    etiqueta: 'Acciones',
    tipo: 'acciones',
    ordenable: false,
    acciones: [
      { clave: 'resolver', etiqueta: 'Resolver', titulo: 'Deja constancia de la decisión y saca el punto de la cola', pide: 'Qué se decidió (queda en la auditoría)' },
      { clave: 'ficha', etiqueta: 'Ficha', titulo: 'Abre el documento para corregir sus metadatos' },
    ],
  },
  { clave: 'estado', etiqueta: 'Estado', tipo: 'insignia', filtrable: true, oculta: true, etiquetas: ETIQUETAS_ESTADO_DOC, tonos: { vigente: 'verde', obsoleto: 'neutro', borrador: 'ambar', sin_determinar: 'ambar', retirado: 'neutro' } },
  { clave: 'detalle', etiqueta: 'Qué hay que decidir', ancho: 300 },
  { clave: 'proceso', etiqueta: 'Proceso', oculta: true, ancho: 200 },
  { clave: 'perimetro', etiqueta: 'Perímetro', etiquetaDe: 'perimetro_nombre', filtrable: true, oculta: true, candado: true },
  { clave: 'prioridad', etiqueta: 'Prioridad', tipo: 'entero', oculta: true },
  { clave: 'resolucion', etiqueta: 'Resolución', ancho: 240 },
  { clave: 'decidido_por', etiqueta: 'Decidió', oculta: true },
  { clave: 'decidido_en', etiqueta: 'Decidido', tipo: 'fechaHora', oculta: true },
]

const consultaConciliacion = (soloPendientes: boolean): FuenteTabla['consulta'] => (supabase, _ctx, select, opciones) => {
  const q = supabase.schema('ui').rpc('conciliacion_documentos', undefined, opciones?.count ? { count: opciones.count } : undefined).select(select)
  return soloPendientes ? q.eq('situacion', 'pendiente') : q
}

export const TABLA_CONCILIACION_DOCUMENTOS: FuenteTabla = {
  id: 'documentos-conciliacion',
  titulo: 'Conciliación de documentos',
  modulo: 'NUC-DOC',
  recurso: 'sistema:documentos',
  ruta: '/sistema/nucleo/documentos/conciliacion',
  claveFila: 'clave',
  ficha: { tipo: 'documento', columna: 'id' },
  busqueda: 'busqueda',
  orden: { columna: 'prioridad', dir: 'asc' },
  tamano: 50,
  columnas: COLUMNAS_CONCILIACION.map((c) => (c.clave === 'situacion' || c.clave === 'resolucion' ? { ...c, oculta: true, filtrable: false } : c)),
  consulta: consultaConciliacion(true),
}

export const TABLA_CONCILIACION_DOCUMENTOS_TODO: FuenteTabla = {
  ...TABLA_CONCILIACION_DOCUMENTOS,
  id: 'documentos-conciliacion-todo',
  titulo: 'Conciliación de documentos (con lo decidido)',
  columnas: COLUMNAS_CONCILIACION,
  consulta: consultaConciliacion(false),
}

export const TABLA_HISTORIAL_DOCUMENTOS: FuenteTabla = {
  id: 'documentos-historial',
  titulo: 'Historial de documentos',
  modulo: 'NUC-DOC',
  recurso: 'sistema:auditoria',
  ruta: '/sistema/nucleo/documentos/historial',
  claveFila: 'id',
  ficha: { tipo: 'documento', columna: 'documento_id' },
  busqueda: 'busqueda',
  orden: { columna: 'en', dir: 'desc' },
  tamano: 50,
  columnas: [
    { clave: 'en', etiqueta: 'Cuándo', tipo: 'fechaHora' },
    { clave: 'accion', etiqueta: 'Qué pasó', tipo: 'insignia', filtrable: true, agrupable: true, etiquetas: ETIQUETAS_ACCION_HISTORIAL, tonos: TONOS_ACCION_HISTORIAL },
    { clave: 'objeto_tipo', etiqueta: 'Objeto', filtrable: true, agrupable: true },
    { clave: 'codigo', etiqueta: 'Código', tipo: 'codigo' },
    { clave: 'objeto', etiqueta: 'Documento', ancho: 240 },
    { clave: 'estado', etiqueta: 'Estado o decisión', ancho: 200 },
    { clave: 'cambios', etiqueta: 'Campos que cambiaron', ancho: 200 },
    { clave: 'quien', etiqueta: 'Quién', filtrable: true, agrupable: true },
  ],
  consulta: (supabase, _ctx, select, opciones) =>
    supabase
      .schema('ui')
      .rpc('historial_documentos', undefined, opciones?.count ? { count: opciones.count } : undefined)
      .select(select),
}

export const FUENTES_PROCESOS: Record<string, FuenteTabla> = Object.fromEntries(
  [
    TABLA_CATALOGO_PROCESOS,
    TABLA_CRUCE_PROCESOS,
    TABLA_ESCENARIOS_PROCESOS,
    TABLA_VALIDACION_PROCESOS,
    TABLA_HISTORIAL_PROCESOS,
    TABLA_DOCUMENTOS,
    TABLA_DOCUMENTOS_VIGENTES,
    TABLA_CONCILIACION_DOCUMENTOS,
    TABLA_CONCILIACION_DOCUMENTOS_TODO,
    TABLA_HISTORIAL_DOCUMENTOS,
  ].map((f) => [f.id, f])
)
