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
    nombre: 'Mis aprobaciones',
    dominio: 'Mi día',
    fase: null,
    estado: 'en_construccion',
    ruta: '/sistema/bandeja',
    recurso: null,
    descripcion: null,
    orden: -1,
  },
]

export const ESTADO_MODULO: Record<EstadoModulo, { etiqueta: string; color: string }> = {
  operando: { etiqueta: 'Operando', color: '#1f8a5b' },
  en_construccion: { etiqueta: 'En construcción', color: '#b7791f' },
  planificado: { etiqueta: 'Planificado', color: '#c4c9d0' },
  pausado: { etiqueta: 'En pausa', color: '#8d8785' },
}

/** Pestaña de un módulo: una ruta de verdad. `recurso` = lo que exige su página. */
export type Pestana = { etiqueta: string; href: string; recurso?: string; accion?: 'ver' | 'crear' }

/**
 * Las pestañas de los módulos que ya tienen pantallas. La anatomía común
 * (Resumen · Explorar · Ficha · Lienzo · Bandeja · Configuración · Historial · IA)
 * se va llenando por bloques; aquí solo va lo que existe.
 */
export const PESTANAS: Record<string, Pestana[]> = {
  'MI-DIA': [
    { etiqueta: 'Mi día', href: '/sistema' },
    { etiqueta: 'Mis aprobaciones', href: '/sistema/bandeja' },
  ],
  'NUC-ORG': [
    { etiqueta: 'Organigrama', href: '/sistema/nucleo/organizacion', recurso: 'sistema:estructura' },
    { etiqueta: 'Plazas', href: '/sistema/nucleo/organizacion/plazas', recurso: 'sistema:estructura' },
    { etiqueta: 'Cargos', href: '/sistema/nucleo/organizacion/cargos', recurso: 'sistema:estructura' },
    { etiqueta: 'Dotación', href: '/sistema/nucleo/organizacion/dotacion', recurso: 'sistema:dotacion' },
    { etiqueta: 'Requisiciones', href: '/sistema/nucleo/organizacion/requisiciones', recurso: 'sistema:requisiciones', accion: 'crear' },
    { etiqueta: 'Escenarios', href: '/sistema/nucleo/escenarios', recurso: 'sistema:escenarios' },
    { etiqueta: 'Conciliación', href: '/sistema/nucleo/conciliacion' },
  ],
  'NUC-PRO': [
    { etiqueta: 'Mapa', href: '/sistema/nucleo/procesos', recurso: 'sistema:procesos' },
    { etiqueta: 'Árbol', href: '/sistema/nucleo/procesos/arbol', recurso: 'sistema:procesos' },
    { etiqueta: 'Cruce con el informe', href: '/sistema/nucleo/procesos/cruce', recurso: 'sistema:procesos' },
    { etiqueta: 'Escenarios', href: '/sistema/nucleo/procesos/escenarios', recurso: 'sistema:procesos' },
  ],
  'NUC-DOC': [{ etiqueta: 'Biblioteca', href: '/sistema/nucleo/documentos', recurso: 'sistema:documentos' }],
  'NUC-IDN': [
    { etiqueta: 'Usuarios', href: '/sistema/administracion/usuarios', recurso: 'modulo:usuarios' },
    { etiqueta: 'Roles y permisos', href: '/sistema/administracion/roles', recurso: 'modulo:roles' },
  ],
  'FIN-TAS': [{ etiqueta: 'Tasas', href: '/sistema/finanzas/tasas', recurso: 'sistema:tasas' }],
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
