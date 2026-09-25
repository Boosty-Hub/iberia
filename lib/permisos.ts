/**
 * Roles y permisos: el inventario de lo que se puede permitir y la regla que
 * decide si se permite.
 *
 * Un **recurso** es `modulo:<clave>`, `informe:<slug>` o `leccion:<numero>`.
 * Los módulos están escritos aquí porque son código: una página nueva del panel
 * se añade a `MODULOS` el mismo día que se crea. Las secciones del informe y las
 * lecciones del curso salen de la base, así que una sección nueva aparece sola
 * en la matriz.
 *
 * ⚠️ **El nivel del rol es el techo y la matriz afina por debajo**, igual que en
 * la migración `roles_y_permisos`: un rol de nivel lectura solo puede ver, uno de
 * nivel consultor no administra usuarios ni roles, y el nivel administrador lo
 * puede todo. `permite()` aplica el techo antes de mirar la matriz, así que una
 * casilla marcada por encima del techo no da nada — y la base, además, no deja
 * guardarla.
 *
 * Este archivo no importa nada del servidor: lo usan también la matriz y la barra
 * lateral, que corren en el navegador.
 */

export type Accion = 'ver' | 'crear' | 'editar' | 'eliminar'
export const ACCIONES: Accion[] = ['ver', 'crear', 'editar', 'eliminar']

export const ETIQUETA_ACCION: Record<Accion, string> = {
  ver: 'Ver',
  crear: 'Crear',
  editar: 'Editar',
  eliminar: 'Eliminar',
}

export type Nivel = 'admin' | 'consultor' | 'lector'

export const NIVELES: Record<Nivel, string> = {
  admin: 'Administrador',
  consultor: 'Equipo consultor',
  lector: 'Solo lectura',
}

export const NIVEL_DESCRIPCION: Record<Nivel, string> = {
  admin: 'Lo puede todo, incluidos usuarios, roles y permisos. Su matriz no se edita.',
  consultor: 'Puede ver, crear, editar y eliminar lo que la matriz le marque. No administra usuarios ni roles.',
  lector: 'Solo puede ver lo que la matriz le marque. Nada de crear, editar ni eliminar.',
}

export type Grupo = 'panel' | 'informe' | 'curso' | 'administracion'

export const GRUPOS: { clave: Grupo; titulo: string; descripcion: string }[] = [
  { clave: 'panel', titulo: 'Módulos del panel', descripcion: 'Cada pantalla del dashboard y el canal.' },
  {
    clave: 'informe',
    titulo: 'Secciones del informe',
    descripcion:
      'Se escriben en las sesiones de trabajo, no desde el panel: aquí solo se decide quién ve cada una. Quien no puede ver una sección no la encuentra ni en el índice, y el lector solo ve lo publicado.',
  },
  { clave: 'curso', titulo: 'Curso de Ajito', descripcion: 'Qué lecciones le aparecen a cada rol en el teléfono.' },
  {
    clave: 'administracion',
    titulo: 'Administración',
    descripcion: 'Solo para roles de nivel administrador, que ya lo tienen todo.',
  },
]

export type Recurso = {
  clave: string
  nombre: string
  grupo: Grupo
  /** Las acciones que tienen sentido. Las demás salen como «no aplica». */
  acciones: Accion[]
  /** Qué significa cada casilla aquí, cuando no es obvio. */
  detalle?: Partial<Record<Accion, string>>
  /** Solo el nivel administrador. */
  soloAdmin?: boolean
  subtitulo?: string
}

export const MODULOS: Recurso[] = [
  { clave: 'modulo:panel', nombre: 'Panel', grupo: 'panel', acciones: ['ver'], subtitulo: 'La portada del dashboard' },
  {
    clave: 'modulo:entrevistas',
    nombre: 'Entrevistas',
    grupo: 'panel',
    acciones: ['ver', 'crear', 'editar', 'eliminar'],
    detalle: { crear: 'Nueva sesión e importar', editar: 'Datos y transcripción', eliminar: 'Borrar la sesión' },
  },
  {
    clave: 'modulo:archivos',
    nombre: 'Archivos',
    grupo: 'panel',
    acciones: ['ver', 'crear', 'eliminar'],
    detalle: { crear: 'Subir al expediente', eliminar: 'Borrar del expediente' },
  },
  // Sin «Hallazgos» ni «Editor del informe» desde el 25 de septiembre: los
  // hallazgos se leen en el informe, en su circuito, y el informe se escribe en
  // las sesiones de trabajo. Ver la migración `informe_de_lectura`.
  {
    clave: 'modulo:programa',
    nombre: 'Consumos y línea de tiempo',
    grupo: 'panel',
    acciones: ['ver', 'crear', 'eliminar'],
    detalle: { crear: 'Cargar horas e hitos', eliminar: 'Borrar horas' },
  },
  {
    clave: 'modulo:adiestramiento',
    nombre: 'Adiestramiento',
    grupo: 'panel',
    acciones: ['ver', 'editar'],
    detalle: { editar: 'Configurar el curso y matricular' },
  },
  // ⚠️ Recordatorios y empleados no tienen «ver» a secas: leen vistas que solo
  // le responden al equipo (`padron_estado`, `recordatorios_pendientes`), así
  // que una casilla de ver abriría una pantalla vacía. Se abren con «editar».
  {
    clave: 'modulo:recordatorios',
    nombre: 'Recordatorios del curso',
    grupo: 'panel',
    acciones: ['editar'],
    detalle: { editar: 'Abrir, preparar y mandar los mensajes' },
  },
  { clave: 'modulo:certificados', nombre: 'Certificados del curso', grupo: 'panel', acciones: ['ver'] },
  {
    clave: 'modulo:empleados',
    nombre: 'Empleados · el padrón',
    grupo: 'panel',
    acciones: ['editar'],
    detalle: { editar: 'Abrir, matricular, acuñar y mandar enlaces' },
  },
  {
    clave: 'modulo:canal',
    nombre: 'Canal de comunicación',
    grupo: 'panel',
    acciones: ['ver'],
    subtitulo: 'La app del teléfono; sin esto tampoco se abre el curso',
  },
  {
    clave: 'modulo:usuarios',
    nombre: 'Usuarios',
    grupo: 'administracion',
    acciones: ['ver', 'crear', 'editar', 'eliminar'],
    soloAdmin: true,
  },
  {
    clave: 'modulo:roles',
    nombre: 'Roles y permisos',
    grupo: 'administracion',
    acciones: ['ver', 'crear', 'editar', 'eliminar'],
    soloAdmin: true,
  },
]

/** El inventario completo: los módulos, las secciones del informe y las lecciones. */
export function construirInventario(
  secciones: { slug: string; numero: string | null; titulo: string }[],
  lecciones: { numero: number; titulo: string }[]
): Recurso[] {
  return [
    ...MODULOS.filter((m) => m.grupo === 'panel'),
    ...secciones.map<Recurso>((s) => ({
      clave: `informe:${s.slug}`,
      nombre: s.titulo,
      subtitulo: s.numero ? `Sección ${s.numero}` : undefined,
      grupo: 'informe',
      // Solo «ver»: el mapa interactivo es la sección del mapa de procesos y se
      // ve con su casilla.
      acciones: ['ver'],
    })),
    ...lecciones.map<Recurso>((l) => ({
      clave: `leccion:${l.numero}`,
      nombre: l.titulo,
      subtitulo: `Lección ${l.numero}`,
      grupo: 'curso',
      acciones: ['ver'],
    })),
    ...MODULOS.filter((m) => m.grupo === 'administracion'),
  ]
}

export type Permiso = Record<Accion, boolean>
export type MapaPermisos = Record<string, Permiso>

export const SIN_PERMISO: Permiso = { ver: false, crear: false, editar: false, eliminar: false }

const SOLO_ADMIN = new Set(MODULOS.filter((m) => m.soloAdmin).map((m) => m.clave))

/** ¿El nivel deja siquiera marcar esta casilla? Es lo que apaga la celda en la matriz. */
export function techoPermite(nivel: Nivel, recurso: Pick<Recurso, 'clave' | 'acciones'>, accion: Accion): boolean {
  if (!recurso.acciones.includes(accion)) return false
  if (nivel === 'admin') return true
  if (SOLO_ADMIN.has(recurso.clave)) return false
  if (nivel === 'lector') return accion === 'ver'
  return true
}

/**
 * La regla, igual que `public.puede()` en la base: el nivel administrador puede
 * todo; lo solo-admin no lo puede nadie más; un lector solo ve; el resto, lo que
 * marque la matriz.
 */
export function permite(nivel: Nivel, mapa: MapaPermisos, recurso: string, accion: Accion = 'ver'): boolean {
  if (nivel === 'admin') return true
  if (SOLO_ADMIN.has(recurso)) return false
  if (nivel === 'lector' && accion !== 'ver') return false
  return Boolean(mapa[recurso]?.[accion])
}
