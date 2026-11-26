/**
 * El mapa de la plataforma: 12 dominios en el riel, sus módulos (que salen de
 * `control.modulo`: **el plan es dato**) y las pestañas de cada módulo.
 *
 * Sin `'use client'` ni `'use server'`: lo usan el riel (navegador) y las
 * páginas (servidor). Un módulo nuevo en la base aparece solo, en el dominio que
 * diga su campo `dominio`; aquí solo se declara lo que es interfaz: el icono, el
 * orden de los dominios y las pestañas de los módulos que ya tienen pantallas.
 */

export type EstadoModulo = 'operando' | 'en_construccion' | 'planificado' | 'pausado'

export type ModuloPlan = {
  codigo: string
  nombre: string
  dominio: string
  fase: string | null
  estado: EstadoModulo
  ruta: string | null
  recurso: string | null
  descripcion: string | null
  orden: number
  /** Lo que exige `recurso` para salir en el menú (por defecto, ver). */
  accion?: 'ver' | 'crear' | 'editar'
}

export type ClaveDominio =
  | 'inicio'
  | 'direccion'
  | 'comercial'
  | 'finanzas'
  | 'abastecimiento'
  | 'logistica'
  | 'planta'
  | 'personas'
  | 'organizacion'
  | 'programa'
  | 'datos'
  | 'administracion'

export type Dominio = { clave: ClaveDominio; nombre: string; corto: string; separadoAntes?: boolean }

/** El orden del riel. «Datos» y «Administración» van aparte, abajo de una línea. */
export const DOMINIOS: Dominio[] = [
  { clave: 'inicio', nombre: 'Mi día', corto: 'Mi día' },
  { clave: 'direccion', nombre: 'Dirección', corto: 'Dirección' },
  { clave: 'comercial', nombre: 'Comercial', corto: 'Comercial' },
  { clave: 'finanzas', nombre: 'Finanzas', corto: 'Finanzas' },
  { clave: 'abastecimiento', nombre: 'Abastecimiento', corto: 'Abastec.' },
  { clave: 'logistica', nombre: 'Logística', corto: 'Logística' },
  { clave: 'planta', nombre: 'Planta', corto: 'Planta' },
  { clave: 'personas', nombre: 'Personas', corto: 'Personas' },
  { clave: 'organizacion', nombre: 'Organización y procesos', corto: 'Organización' },
  { clave: 'programa', nombre: 'Programa', corto: 'Programa' },
  { clave: 'datos', nombre: 'Datos', corto: 'Datos', separadoAntes: true },
  { clave: 'administracion', nombre: 'Administración', corto: 'Admin.' },
]

/** El campo `dominio` de la base → el dominio del riel. */
const POR_DOMINIO: Record<string, ClaveDominio> = {
  'Dirección': 'direccion',
  'Comercial': 'comercial',
  'Finanzas': 'finanzas',
  'Abastecimiento': 'abastecimiento',
  'Logística de salida': 'logistica',
  'Operaciones de planta': 'planta',
  'Calidad e inocuidad': 'planta',
  'Personas y seguridad': 'personas',
  'Núcleo transversal': 'organizacion',
  'Programa': 'programa',
  'Datos y espejo de JD': 'datos',
  'Gestión y soporte': 'administracion',
}

/** Los del núcleo que son de administrar la plataforma, o de la gente. */
const POR_CODIGO: Record<string, ClaveDominio> = {
  'NUC-IDN': 'administracion',
  'NUC-FLU': 'administracion',
  'NUC-CFG': 'administracion',
  'NUC-AUD': 'administracion',
  'NUC-GIA': 'administracion',
  'NUC-IA': 'administracion',
  'NUC-NOT': 'administracion',
  'NUC-CAN': 'personas',
  'NUC-FOR': 'personas',
}

/** Si un dominio nuevo aparece en la base sin estar arriba, decide el prefijo. */
const POR_PREFIJO: Record<string, ClaveDominio> = {
  DIR: 'direccion',
  COM: 'comercial',
  FIN: 'finanzas',
  ABA: 'abastecimiento',
  LOG: 'logistica',
  OPE: 'planta',
  CAL: 'planta',
  PER: 'personas',
  NUC: 'organizacion',
  PRG: 'programa',
  DAT: 'datos',
  GES: 'administracion',
}

export function dominioDe(m: Pick<ModuloPlan, 'codigo' | 'dominio'>): ClaveDominio {
  return POR_CODIGO[m.codigo] ?? POR_DOMINIO[m.dominio] ?? POR_PREFIJO[m.codigo.slice(0, 3)] ?? 'organizacion'
}

/** El subgrupo dentro de la columna, cuando un dominio junta dos de la base. */
export function grupoDe(m: Pick<ModuloPlan, 'codigo' | 'dominio'>): string {
  if (POR_CODIGO[m.codigo] === 'administracion') return 'Plataforma'
  if (POR_CODIGO[m.codigo] === 'personas') return 'Comunicación y formación'
  return m.dominio
}

/**
 * «Mi día» no es un módulo del plan: es la portada de cada quien. Va con dos
 * entradas propias para que el riel lo trate igual que a los demás.
 */
export const MODULOS_MI_DIA: ModuloPlan[] = [
  { codigo: 'MI-DIA', nombre: 'Mi día', dominio: 'Mi día', fase: null, estado: 'operando', ruta: '/sistema', recurso: null, descripcion: null, orden: -2 },
  {
    codigo: 'MI-APR',
    nombre: 'Bandeja',
    dominio: 'Mi día',
    fase: null,
    estado: 'operando',
    ruta: '/sistema/bandeja',
    recurso: null,
    descripcion: null,
    orden: -1,
  },
]

/**
 * «Padrón y accesos» tampoco es un módulo del plan: es una vista del maestro de
 * persona (NUC-IDN) para quien trabaja el padrón —ficha, plaza, cuenta,
 * matrícula y enlace personal—. Va en Personas, junto a Formación, porque es
 * donde Capital Humano lo busca. Se abre con `modulo:empleados` · editar: su
 * vista solo le responde al equipo.
 */
export const MODULO_PADRON: ModuloPlan = {
  codigo: 'PER-PAD',
  nombre: 'Padrón y accesos',
  dominio: 'Personas y seguridad',
  fase: null,
  estado: 'operando',
  ruta: '/sistema/personas/padron',
  recurso: 'modulo:empleados',
  accion: 'editar',
  descripcion: 'Las fichas del padrón con su plaza, su cuenta, su matrícula y su enlace personal.',
  orden: 57,
}

/**
 * Módulos que reúnen pantallas con casillas distintas: salen en el menú si la
 * sesión tiene su `recurso` **o** alguna de estas (ver). PRG-PLN junta Consumos
 * (`modulo:programa`) y el Calendario (`modulo:calendario`); PRG-LEV, las
 * entrevistas y el expediente (`modulo:archivos`). La raíz de cada uno manda a
 * la primera pestaña que la sesión puede abrir.
 */
export const RECURSOS_ALTERNOS: Record<string, string[]> = {
  'PRG-PLN': ['modulo:calendario'],
  'PRG-LEV': ['modulo:archivos'],
  // La Biblioteca: el programa, el calendario, el expediente o alguna sección del informe («informe:*»).
  'PRG-BIB': ['modulo:calendario', 'modulo:archivos', 'informe:*'],
}

/**
 * El asistente de IA de cada quien (plan del 26-nov-2026): va en Mi día, porque
 * es personal y se usa todos los días. Sale con `sistema:asistente` · ver. Su
 * administración es NUC-IA, en Administración.
 */
export const MODULO_ASISTENTE: ModuloPlan = {
  codigo: 'MI-ASI',
  nombre: 'Asistente de IA',
  dominio: 'Mi día',
  fase: null,
  estado: 'operando',
  ruta: '/sistema/asistente',
  recurso: 'sistema:asistente',
  descripcion: 'Tu chat de IA dentro de la plataforma: conversa, analiza Excel, genera documentos y tableros.',
  orden: 0,
}

/**
 * Mis archivos (26-nov-2026, pedido de Gabriel): las carpetas de cada quien, personales y compartidas, como un
 * SharePoint chico. Va en Mi día, junto al asistente, que las cita con «/». Sale con `sistema:archivos` · ver.
 */
export const MODULO_ARCHIVOS: ModuloPlan = {
  codigo: 'MI-ARC',
  nombre: 'Mis archivos',
  dominio: 'Mi día',
  fase: null,
  estado: 'operando',
  ruta: '/sistema/archivos',
  recurso: 'sistema:archivos',
  descripcion: 'Tus carpetas y archivos, y lo que otros te compartieron. El asistente los usa con «/».',
  orden: 1,
}

/** Los módulos que declara la interfaz y no la base: se suman a los del plan. */
export const MODULOS_INTERFAZ: ModuloPlan[] = [...MODULOS_MI_DIA, MODULO_ASISTENTE, MODULO_ARCHIVOS, MODULO_PADRON]

export const ESTADO_MODULO: Record<EstadoModulo, { etiqueta: string; color: string }> = {
  operando: { etiqueta: 'Operando', color: '#1f8a5b' },
  en_construccion: { etiqueta: 'En construcción', color: '#b7791f' },
  planificado: { etiqueta: 'Planificado', color: '#c4c9d0' },
  pausado: { etiqueta: 'En pausa', color: '#8d8785' },
}

/** Pestaña de un módulo: una ruta de verdad. `recurso` = lo que exige su página. */
export type Pestana = { etiqueta: string; href: string; recurso?: string; accion?: 'ver' | 'crear' | 'editar' }

/**
 * Las pestañas de los módulos que ya tienen pantallas. La anatomía común
 * (Resumen · Explorar · Ficha · Lienzo · Bandeja · Configuración · Historial · IA)
 * se va llenando por bloques; aquí solo va lo que existe.
 */
export const PESTANAS: Record<string, Pestana[]> = {
  'MI-DIA': [
    { etiqueta: 'Mi día', href: '/sistema' },
    { etiqueta: 'Bandeja', href: '/sistema/bandeja' },
    { etiqueta: 'Tareas', href: '/sistema/tareas' },
    { etiqueta: 'Notificaciones', href: '/sistema/notificaciones' },
  ],
  'NUC-ORG': [
    { etiqueta: 'Resumen', href: '/sistema/nucleo/organizacion/resumen', recurso: 'sistema:estructura' },
    { etiqueta: 'Organigrama', href: '/sistema/nucleo/organizacion', recurso: 'sistema:estructura' },
    { etiqueta: 'Plazas', href: '/sistema/nucleo/organizacion/plazas', recurso: 'sistema:estructura' },
    { etiqueta: 'Personas', href: '/sistema/nucleo/organizacion/personas', recurso: 'sistema:estructura' },
    { etiqueta: 'Cargos', href: '/sistema/nucleo/organizacion/cargos', recurso: 'sistema:estructura' },
    { etiqueta: 'Dotación', href: '/sistema/nucleo/organizacion/dotacion', recurso: 'sistema:dotacion' },
    { etiqueta: 'Costos 🔒', href: '/sistema/nucleo/organizacion/costos', recurso: 'sistema:costos' },
    { etiqueta: 'Requisiciones', href: '/sistema/nucleo/organizacion/requisiciones', recurso: 'sistema:requisiciones', accion: 'crear' },
    { etiqueta: 'Escenarios', href: '/sistema/nucleo/escenarios', recurso: 'sistema:escenarios' },
    { etiqueta: 'Conciliación', href: '/sistema/nucleo/conciliacion', recurso: 'sistema:estructura' },
    { etiqueta: 'Historial', href: '/sistema/nucleo/organizacion/historial', recurso: 'sistema:auditoria' },
  ],
  'NUC-PRO': [
    { etiqueta: 'Resumen', href: '/sistema/nucleo/procesos/resumen', recurso: 'sistema:procesos' },
    { etiqueta: 'Mapa', href: '/sistema/nucleo/procesos', recurso: 'sistema:procesos' },
    { etiqueta: 'Catálogo', href: '/sistema/nucleo/procesos/catalogo', recurso: 'sistema:procesos' },
    { etiqueta: 'Cruce SGC ↔ informe', href: '/sistema/nucleo/procesos/cruce', recurso: 'sistema:procesos' },
    { etiqueta: 'Escenarios', href: '/sistema/nucleo/procesos/escenarios', recurso: 'sistema:escenarios' },
    { etiqueta: 'Validación', href: '/sistema/nucleo/procesos/validacion', recurso: 'sistema:procesos' },
    { etiqueta: 'Historial', href: '/sistema/nucleo/procesos/historial', recurso: 'sistema:auditoria' },
  ],
  'NUC-DOC': [
    { etiqueta: 'Resumen', href: '/sistema/nucleo/documentos/resumen', recurso: 'sistema:documentos' },
    { etiqueta: 'Biblioteca', href: '/sistema/nucleo/documentos', recurso: 'sistema:documentos' },
    { etiqueta: 'Por proceso', href: '/sistema/nucleo/documentos/por-proceso', recurso: 'sistema:documentos' },
    { etiqueta: 'Conciliación', href: '/sistema/nucleo/documentos/conciliacion', recurso: 'sistema:documentos' },
    { etiqueta: 'Historial', href: '/sistema/nucleo/documentos/historial', recurso: 'sistema:auditoria' },
  ],
  'NUC-IDN': [
    { etiqueta: 'Usuarios', href: '/sistema/administracion/usuarios', recurso: 'modulo:usuarios' },
    { etiqueta: 'Roles y permisos', href: '/sistema/administracion/roles', recurso: 'modulo:roles' },
    { etiqueta: 'Portadas de Mi día', href: '/sistema/administracion/portadas', recurso: 'modulo:roles', accion: 'editar' },
  ],
  // Integración del panel viejo: el curso de Ajito y el padrón.
  'NUC-FOR': [
    { etiqueta: 'Resumen', href: '/sistema/nucleo/formacion', recurso: 'modulo:adiestramiento' },
    { etiqueta: 'Avance', href: '/sistema/nucleo/formacion/avance', recurso: 'modulo:adiestramiento' },
    { etiqueta: 'Certificados', href: '/sistema/nucleo/formacion/certificados', recurso: 'modulo:certificados' },
    { etiqueta: 'Recordatorios', href: '/sistema/nucleo/formacion/recordatorios', recurso: 'modulo:recordatorios', accion: 'editar' },
  ],
  'PER-PAD': [{ etiqueta: 'Padrón', href: '/sistema/personas/padron', recurso: 'modulo:empleados', accion: 'editar' }],
  // El canal (la app de la planta): su administración. Las cifras y listas son
  // cuentas; ningún camino de aquí lee el texto de un mensaje privado.
  'NUC-CAN': [
    { etiqueta: 'Resumen', href: '/sistema/nucleo/canal', recurso: 'modulo:reportes' },
    { etiqueta: 'Publicaciones', href: '/sistema/nucleo/canal/publicaciones', recurso: 'modulo:reportes' },
    { etiqueta: 'Grupos', href: '/sistema/nucleo/canal/grupos', recurso: 'modulo:reportes' },
    { etiqueta: 'Comentarios', href: '/sistema/nucleo/canal/comentarios', recurso: 'modulo:reportes' },
    { etiqueta: 'Moderación', href: '/sistema/nucleo/canal/moderacion', recurso: 'modulo:reportes' },
    { etiqueta: 'Uso', href: '/sistema/nucleo/canal/uso', recurso: 'modulo:reportes' },
    { etiqueta: 'Secciones', href: '/sistema/nucleo/canal/secciones', recurso: 'modulo:reportes' },
  ],
  // El programa (PRG): lo que era el panel viejo, con las casillas de siempre.
  'PRG-PLN': [
    // La hoja de ruta de la plataforma: el plan como dato (fases, hitos, lo que falta y los 65 módulos).
    { etiqueta: 'Hoja de ruta', href: '/sistema/programa/hoja-de-ruta', recurso: 'modulo:programa' },
    { etiqueta: 'Módulos', href: '/sistema/programa/hoja-de-ruta/modulos', recurso: 'modulo:programa' },
    { etiqueta: 'Resumen', href: '/sistema/programa', recurso: 'modulo:programa' },
    { etiqueta: 'Consumos', href: '/sistema/programa/consumos', recurso: 'modulo:programa' },
    { etiqueta: 'Línea de tiempo', href: '/sistema/programa/linea', recurso: 'modulo:programa' },
    { etiqueta: 'Calendario', href: '/sistema/programa/calendario', recurso: 'modulo:calendario' },
    { etiqueta: 'IA', href: '/sistema/programa/ia' },
  ],
  'PRG-LEV': [
    { etiqueta: 'Resumen', href: '/sistema/programa/levantamiento', recurso: 'modulo:entrevistas' },
    { etiqueta: 'Entrevistas', href: '/sistema/programa/levantamiento/entrevistas', recurso: 'modulo:entrevistas' },
    { etiqueta: 'Archivos', href: '/sistema/programa/levantamiento/archivos', recurso: 'modulo:archivos' },
    { etiqueta: 'IA', href: '/sistema/programa/levantamiento/ia' },
  ],
  'DAT-SEM': [{ etiqueta: 'Métricas', href: '/sistema/datos/metricas', recurso: 'sistema:inicio' }],
  'FIN-TAS': [{ etiqueta: 'Tasas', href: '/sistema/finanzas/tasas', recurso: 'sistema:tasas' }],
  'MI-ARC': [
    { etiqueta: 'Mis carpetas', href: '/sistema/archivos', recurso: 'sistema:archivos' },
    { etiqueta: 'Compartido conmigo', href: '/sistema/archivos/compartido', recurso: 'sistema:archivos' },
  ],
  // Asistente de IA (26-nov-2026)
  'MI-ASI': [
    { etiqueta: 'Chats', href: '/sistema/asistente', recurso: 'sistema:asistente' },
    { etiqueta: 'Artefactos', href: '/sistema/asistente/artefactos', recurso: 'sistema:asistente' },
    { etiqueta: 'Proyectos', href: '/sistema/asistente/proyectos', recurso: 'sistema:asistente' },
    { etiqueta: 'Tareas', href: '/sistema/asistente/tareas', recurso: 'sistema:asistente' },
    { etiqueta: 'Atajos', href: '/sistema/asistente/atajos', recurso: 'sistema:asistente' },
    { etiqueta: 'Mi memoria', href: '/sistema/asistente/memoria', recurso: 'sistema:asistente' },
    { etiqueta: 'Archivos de chats', href: '/sistema/asistente/archivos', recurso: 'sistema:asistente' },
    { etiqueta: 'Conexiones', href: '/sistema/asistente/conexiones', recurso: 'sistema:asistente' },
  ],
  'NUC-IA': [
    { etiqueta: 'Resumen', href: '/sistema/administracion/asistente', recurso: 'sistema:asistente-admin' },
    { etiqueta: 'Motor y modelos', href: '/sistema/administracion/asistente/motor', recurso: 'sistema:asistente-admin' },
    { etiqueta: 'Usuarios y roles', href: '/sistema/administracion/asistente/usuarios', recurso: 'sistema:asistente-admin' },
    { etiqueta: 'Alcance', href: '/sistema/administracion/asistente/alcance', recurso: 'sistema:asistente-admin' },
    { etiqueta: 'Microsoft 365', href: '/sistema/administracion/asistente/microsoft', recurso: 'sistema:asistente-admin' },
    { etiqueta: 'Instrucciones', href: '/sistema/administracion/asistente/instrucciones', recurso: 'sistema:asistente-admin' },
    { etiqueta: 'Adopción', href: '/sistema/administracion/asistente/adopcion', recurso: 'sistema:asistente-admin' },
  ],
  // R4 · IA visible
  'NUC-GIA': [
    { etiqueta: 'Capacidades', href: '/sistema/administracion/ia', recurso: 'sistema:ia' },
    { etiqueta: 'Actividad de la IA', href: '/sistema/administracion/ia/actividad', recurso: 'sistema:ia-actividad' },
  ],
}

/** La anatomía común, para la página de un módulo planificado. */
export const ANATOMIA: { etiqueta: string; para: string }[] = [
  { etiqueta: 'Resumen', para: 'Indicadores con su fuente y su tendencia' },
  { etiqueta: 'Explorar', para: 'La tabla: filtros, agrupar, totales y vistas' },
  { etiqueta: 'Ficha', para: 'El objeto, en el panel lateral o a página completa' },
  { etiqueta: 'Bandeja', para: 'Lo que te toca decidir en este módulo' },
  { etiqueta: 'Configuración', para: 'Lo editable sin código' },
  { etiqueta: 'Historial', para: 'Quién cambió qué y cuándo' },
  { etiqueta: 'IA', para: 'Capacidades, nivel, propuestas y su actividad' },
]

/** A dónde lleva un módulo: su ruta si ya tiene pantalla, si no su anatomía. */
export function hrefModulo(m: Pick<ModuloPlan, 'codigo' | 'ruta' | 'estado'>): string {
  return m.ruta && m.estado !== 'planificado' ? m.ruta : `/sistema/modulo/${m.codigo}`
}

/** ¿Sale de la plataforma (el panel, el canal, el informe)? */
export function esExterno(href: string): boolean {
  return !href.startsWith('/sistema')
}

/**
 * El módulo activo para una ruta: la ruta o pestaña más larga que calce. Así
 * `/sistema/nucleo/escenarios/…` es de Organización aunque no viva debajo de ella.
 */
export function moduloDeRuta(ruta: string, modulos: ModuloPlan[]): ModuloPlan | null {
  const candidatos: [string, ModuloPlan][] = []
  for (const m of modulos) {
    const propias = [hrefModulo(m), ...(PESTANAS[m.codigo] ?? []).map((p) => p.href)]
    for (const h of propias) if (h.startsWith('/sistema')) candidatos.push([h, m])
  }
  const calza = candidatos
    .filter(([h]) => ruta === h || (h !== '/sistema' && ruta.startsWith(h + '/')))
    .sort((a, b) => b[0].length - a[0].length)[0]
  return calza?.[1] ?? null
}

/** La pestaña activa de un módulo para una ruta (la más larga que calce). */
export function pestanaDeRuta(ruta: string, pestanas: Pestana[]): Pestana | null {
  return (
    pestanas
      .filter((p) => ruta === p.href || (p.href !== '/sistema' && ruta.startsWith(p.href + '/')))
      .sort((a, b) => b.href.length - a.href.length)[0] ?? null
  )
}
