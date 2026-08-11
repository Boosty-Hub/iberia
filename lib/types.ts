import type { Database as GeneratedDatabase } from '@/lib/database.types'

export type Database = GeneratedDatabase

type Tables = Database['public']['Tables']
export type Row<T extends keyof Tables> = Tables[T]['Row']
export type Insert<T extends keyof Tables> = Tables[T]['Insert']
export type Update<T extends keyof Tables> = Tables[T]['Update']

export type Profile = Row<'profiles'>
export type Area = Row<'areas'>
export type Persona = Row<'personas'>
export type Entrevista = Row<'entrevistas'>
export type Participante = Row<'sesion_participantes'>
export type Segmento = Row<'transcripcion_segmentos'>
export type Hallazgo = Row<'hallazgos'>
export type Archivo = Row<'archivos'>
export type InformeSeccion = Row<'informe_secciones'>

// -----------------------------------------------------------------------------
// Vocabulario del dominio. Las claves espejan los CHECK constraints del schema;
// los valores son las etiquetas que ve el usuario.
// -----------------------------------------------------------------------------

export type Rol = 'admin' | 'consultor' | 'lector'

export const ROLES: Record<Rol, string> = {
  admin: 'Administrador',
  consultor: 'Consultor',
  lector: 'Lector',
}

export const ROL_DESCRIPCION: Record<Rol, string> = {
  admin: 'Control total, incluida la gestión de usuarios',
  consultor: 'Edita entrevistas, archivos, hallazgos e informe',
  lector: 'Solo lectura del levantamiento y del informe publicado',
}

export type Organizacion = 'boosty' | 'iberia'

export const ORGANIZACIONES: Record<Organizacion, string> = {
  boosty: 'Boosty Digital',
  iberia: 'Industrias Iberia',
}

/**
 * Una sesión del levantamiento. No todo es una entrevista 1:1: el material de
 * arranque son reuniones de comité y recorridos de planta con hasta 12
 * participantes.
 */
export type TipoSesion = 'entrevista' | 'reunion' | 'visita' | 'taller' | 'formacion'

export const TIPOS_SESION: Record<TipoSesion, string> = {
  entrevista: 'Entrevista',
  reunion: 'Reunión',
  visita: 'Visita',
  taller: 'Taller',
  formacion: 'Formación',
}

export const TIPOS_SESION_ORDEN: TipoSesion[] = [
  'entrevista',
  'reunion',
  'visita',
  'taller',
  'formacion',
]

/** Prefijo del código consecutivo. Las entrevistas del diagnóstico llevan
 *  su propia serie ENT- para poder medirlas contra la meta de ~25. */
export const PREFIJO_CODIGO: Record<TipoSesion, string> = {
  entrevista: 'ENT',
  reunion: 'SES',
  visita: 'SES',
  taller: 'SES',
  formacion: 'SES',
}

export type RolParticipante = 'entrevistado' | 'entrevistador' | 'participante' | 'anfitrion'

export const ROLES_PARTICIPANTE: Record<RolParticipante, string> = {
  entrevistado: 'Entrevistado',
  entrevistador: 'Entrevistador',
  participante: 'Participante',
  anfitrion: 'Anfitrión',
}

export type TipoArea =
  | 'direccion_general'
  | 'direccion'
  | 'gerencia'
  | 'jefatura'
  | 'externo'

export const TIPOS_AREA: Record<TipoArea, string> = {
  direccion_general: 'Dirección General',
  direccion: 'Dirección',
  gerencia: 'Gerencia',
  jefatura: 'Jefatura',
  externo: 'Externo',
}

/** Sangría del selector de áreas, para que se lea como el organigrama. */
export const NIVEL_AREA: Record<TipoArea, number> = {
  direccion_general: 0,
  direccion: 1,
  gerencia: 2,
  jefatura: 3,
  externo: 0,
}

export type EstadoEntrevista = 'programada' | 'realizada' | 'transcrita' | 'analizada'

export const ESTADOS_ENTREVISTA: Record<EstadoEntrevista, string> = {
  programada: 'Programada',
  realizada: 'Realizada',
  transcrita: 'Transcrita',
  analizada: 'Analizada',
}

export const ESTADO_ENTREVISTA_ORDEN: EstadoEntrevista[] = [
  'programada',
  'realizada',
  'transcrita',
  'analizada',
]

export type Sede = 'caracas' | 'cagua' | 'remoto'

export const SEDES: Record<Sede, string> = {
  caracas: 'Caracas',
  cagua: 'Planta Cagua',
  remoto: 'Remoto',
}

export type TipoHallazgo =
  | 'cuello_botella'
  | 'trabajo_manual'
  | 'dato_disponible'
  | 'oportunidad_ia'
  | 'riesgo'
  | 'sistema'
  | 'supuesto'

export const TIPOS_HALLAZGO: Record<TipoHallazgo, string> = {
  cuello_botella: 'Cuello de botella',
  trabajo_manual: 'Trabajo manual repetitivo',
  dato_disponible: 'Dato disponible',
  oportunidad_ia: 'Oportunidad de IA',
  riesgo: 'Riesgo',
  sistema: 'Sistema',
  supuesto: 'Supuesto por validar',
}

export type EstadoHallazgo = 'propuesto' | 'validado' | 'descartado'

export const ESTADOS_HALLAZGO: Record<EstadoHallazgo, string> = {
  propuesto: 'Propuesto',
  validado: 'Validado',
  descartado: 'Descartado',
}

export type Nivel = 'alto' | 'medio' | 'bajo'

export const NIVELES: Record<Nivel, string> = {
  alto: 'Alto',
  medio: 'Medio',
  bajo: 'Bajo',
}

export type CategoriaArchivo =
  | 'entrevista'
  | 'proceso'
  | 'sistema'
  | 'dato'
  | 'politica'
  | 'comunicacion'
  | 'formacion'
  | 'referencia'
  | 'otro'

export const CATEGORIAS_ARCHIVO: Record<CategoriaArchivo, string> = {
  entrevista: 'Entrevista',
  proceso: 'Proceso',
  sistema: 'Sistema / ERP',
  dato: 'Datos',
  politica: 'Política',
  comunicacion: 'Comunicación',
  formacion: 'Formación',
  referencia: 'Referencia',
  otro: 'Otro',
}

export type ParteInforme = 'portada' | 'levantamiento' | 'arquitectura' | 'anexos'

export const PARTES_INFORME: Record<ParteInforme, string> = {
  portada: 'Apertura',
  levantamiento: 'Levantamiento',
  arquitectura: 'Arquitectura de IA',
  anexos: 'Anexos',
}

export const PARTES_INFORME_ORDEN: ParteInforme[] = [
  'portada',
  'levantamiento',
  'arquitectura',
  'anexos',
]

/** Entrevista con sus relaciones resueltas, como la devuelven los listados. */
export type EntrevistaConArea = Entrevista & {
  areas: Pick<Area, 'id' | 'nombre' | 'slug'> | null
}
