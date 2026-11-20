import 'server-only'
import { FAMILIAS_OFICIO } from '@/lib/adiestramiento'
import { CUENTA_PADRON, CURSO_PADRON, ENLACE_PADRON, ORIGEN_PADRON, leerPadron } from '@/lib/plataforma/padron'
import type { FuenteTabla } from '@/lib/plataforma/tabla-servidor'

/**
 * Las fuentes de `TablaDatos` de Formación (NUC-FOR) y del padrón. Cada una lee
 * con la sesión de quien mira:
 *
 * - Avance por área y oficio: `ui.formacion_avance()`, cuentas sin nombres, con
 *   la puerta del tablero (el equipo o la casilla de Adiestramiento).
 * - Avance por persona: `ui.formacion_personas()`, con la RLS de `matriculas`
 *   (solo el equipo ve a los demás). La página la pide con el padrón
 *   (`modulo:empleados` · editar): son nombres y avances, como el padrón.
 * - Certificados: `ui.formacion_certificados()`, con la RLS de `certificados`.
 * - Padrón: `padron_estado` (solo responde al equipo) cruzado en el servidor.
 */

const FORMACION = '/sistema/nucleo/formacion'
const opcCount = (o?: { count?: 'exact' }) => (o?.count ? { count: o.count } : undefined)
const familias = Object.fromEntries(Object.entries(FAMILIAS_OFICIO)) as Record<string, string>
const LECCION = { hecha: '✓', va: 'va' }
const TONO_LECCION = { hecha: 'verde', va: 'ambar' } as const

export const TABLA_FORMACION_AVANCE: FuenteTabla = {
  id: 'formacion-avance',
  titulo: 'Avance por área y oficio',
  enMemoria: true,
  modulo: 'NUC-FOR',
  recurso: 'modulo:adiestramiento',
  ruta: `${FORMACION}/avance`,
  claveFila: 'id',
  busqueda: 'busqueda',
  orden: { columna: 'matriculados', dir: 'desc' },
  columnas: [
    { clave: 'area', etiqueta: 'Área', filtrable: true, agrupable: true, ancho: 200 },
    { clave: 'familia', etiqueta: 'Oficio', filtrable: true, agrupable: true, etiquetas: familias, ayuda: 'Es como bifurcan los ejercicios; «General» recibe el ejercicio genérico' },
    { clave: 'matriculados', etiqueta: 'Matriculados', tipo: 'entero', total: true },
    { clave: 'sin_empezar', etiqueta: 'Sin empezar', tipo: 'entero', total: true },
    { clave: 'en_curso', etiqueta: 'En curso', tipo: 'entero', total: true },
    { clave: 'completados', etiqueta: 'Terminaron', tipo: 'entero', total: true },
    { clave: 'lecciones_promedio', etiqueta: 'Lecciones (promedio)', tipo: 'decimal', ayuda: 'Lecciones completadas por persona, en promedio' },
    { clave: 'avance', etiqueta: 'Avance', tipo: 'porcentaje', ayuda: 'Lecciones completadas sobre las que faltan para que todos terminen' },
  ],
  consulta: (supabase, _ctx, select, o) => supabase.schema('ui').rpc('formacion_avance', undefined, opcCount(o)).select(select),
}

export const TABLA_FORMACION_PERSONAS: FuenteTabla = {
  id: 'formacion-personas',
  titulo: 'Avance por persona',
  enMemoria: true,
  modulo: 'NUC-FOR',
  // Nombres y avances: lo mismo que el padrón, con su misma casilla.
  recurso: 'modulo:empleados',
  accion: 'editar',
  ruta: `${FORMACION}/avance/personas`,
  claveFila: 'id',
  ficha: { tipo: 'persona', columna: 'empleado_id' },
  busqueda: 'busqueda',
  orden: { columna: 'nombre', dir: 'asc' },
  columnas: [
    { clave: 'nombre', etiqueta: 'Persona', ancho: 190 },
    { clave: 'ficha', etiqueta: 'Ficha', tipo: 'codigo' },
    { clave: 'area', etiqueta: 'Área', filtrable: true, agrupable: true, ancho: 160 },
    { clave: 'familia', etiqueta: 'Oficio', filtrable: true, agrupable: true, etiquetas: familias, oculta: true },
    {
      clave: 'estado',
      etiqueta: 'Curso',
      tipo: 'insignia',
      filtrable: true,
      agrupable: true,
      etiquetas: { pendiente: 'Sin empezar', en_curso: 'En curso', completado: 'Terminó' },
      tonos: { pendiente: 'neutro', en_curso: 'ambar', completado: 'verde' },
    },
    { clave: 'lecciones_hechas', etiqueta: 'Hechas', tipo: 'entero', ayuda: 'Lecciones completadas, de 9' },
    ...Array.from({ length: 9 }, (_, n) => ({
      clave: `l${n}`,
      etiqueta: `L${n}`,
      tipo: 'insignia' as const,
      ordenable: false,
      filtrable: n === 0 || n === 8,
      etiquetas: LECCION,
      tonos: TONO_LECCION,
      ayuda: `Lección ${n}: ✓ terminada, «va» empezada`,
    })),
    { clave: 'dias_callado', etiqueta: 'Días sin volver', tipo: 'entero', ayuda: 'Desde que tocó el curso por última vez (o desde la matrícula). Es lo que mira el empujón' },
    { clave: 'certificado', etiqueta: 'Certificado', tipo: 'codigo', oculta: true },
  ],
  consulta: (supabase, _ctx, select, o) => supabase.schema('ui').rpc('formacion_personas', undefined, opcCount(o)).select(select),
}

export const TABLA_CERTIFICADOS: FuenteTabla = {
  id: 'formacion-certificados',
  titulo: 'Certificados',
  enMemoria: true,
  modulo: 'NUC-FOR',
  recurso: 'modulo:certificados',
  ruta: `${FORMACION}/certificados`,
  claveFila: 'id',
  busqueda: 'busqueda',
  orden: { columna: 'emitido_en', dir: 'desc' },
  columnas: [
    { clave: 'codigo', etiqueta: 'Código', tipo: 'codigo', ayuda: 'Legible a propósito: Capital Humano lo teclea copiándolo del impreso' },
    { clave: 'nombre', etiqueta: 'Persona', ancho: 190 },
    { clave: 'ficha', etiqueta: 'Ficha', tipo: 'codigo' },
    { clave: 'cargo', etiqueta: 'Cargo', ancho: 160 },
    { clave: 'area', etiqueta: 'Área', filtrable: true, agrupable: true, ancho: 160 },
    { clave: 'emitido_en', etiqueta: 'Emitido', tipo: 'fechaHora' },
    {
      clave: 'entregado',
      etiqueta: 'Entregado en mano',
      tipo: 'insignia',
      filtrable: true,
      agrupable: true,
      etiquetas: { si: 'Entregado', no: 'Por entregar' },
      tonos: { si: 'verde', no: 'ambar' },
    },
    { clave: 'entregado_en', etiqueta: 'Entregado el', tipo: 'fechaHora', oculta: true },
  ],
  consulta: (supabase, _ctx, select, o) => supabase.schema('ui').rpc('formacion_certificados', undefined, opcCount(o)).select(select),
}

export const TABLA_PADRON: FuenteTabla = {
  id: 'padron',
  titulo: 'Padrón y accesos',
  enMemoria: true,
  // Las vistas guardadas cuelgan de un módulo del plan: el maestro de persona y
  // el enlace personal son de Identidad y acceso (05-nucleo §6.1, §7.1).
  modulo: 'NUC-IDN',
  recurso: 'modulo:empleados',
  accion: 'editar',
  ruta: '/sistema/personas/padron',
  claveFila: 'id',
  ficha: { tipo: 'persona', columna: 'id' },
  busqueda: 'busqueda',
  orden: { columna: 'nombre', dir: 'asc' },
  columnas: [
    { clave: 'nombre', etiqueta: 'Persona', ancho: 200 },
    { clave: 'ficha', etiqueta: 'Ficha', tipo: 'codigo', ayuda: 'Número de ficha de Capital Humano; sin número, se cargó a mano' },
    {
      clave: 'origen',
      etiqueta: 'Origen',
      tipo: 'insignia',
      filtrable: true,
      agrupable: true,
      etiquetas: ORIGEN_PADRON,
      tonos: { capital_humano: 'neutro', a_mano: 'azul', muestra_repetida: 'ambar' },
      ayuda: '«Muestra repetida»: una ficha cargada a mano que repite a una de Capital Humano. No se matricula ni se le acuña enlace: se usa la otra',
    },
    { clave: 'cargo', etiqueta: 'Cargo', agrupable: true, ancho: 170 },
    { clave: 'area', etiqueta: 'Área', filtrable: true, agrupable: true, ancho: 160 },
    { clave: 'plaza', etiqueta: 'Plaza', ancho: 200, ayuda: 'La plaza que ocupa hoy en la estructura (org.ocupacion)' },
    { clave: 'ver_plaza', etiqueta: 'Su plaza', tipo: 'acciones', ordenable: false, acciones: [{ clave: 'plaza', etiqueta: 'Ver plaza', titulo: 'Abre la ficha de su plaza', abre: 'plaza:{plaza_ref}' }] },
    { clave: 'nivel', etiqueta: 'Nivel', filtrable: true, agrupable: true, oculta: true },
    { clave: 'familia', etiqueta: 'Oficio', filtrable: true, agrupable: true, etiquetaDe: 'familia_nombre', oculta: true },
    { clave: 'telefono', etiqueta: 'Teléfono', ayuda: 'Sin número no hay por dónde mandarle el enlace' },
    { clave: 'con_telefono', etiqueta: 'Con teléfono', filtrable: true, etiquetas: { si: 'Sí', no: 'Falta' }, oculta: true },
    {
      clave: 'cuenta',
      etiqueta: 'Cuenta',
      tipo: 'insignia',
      filtrable: true,
      agrupable: true,
      etiquetas: CUENTA_PADRON,
      tonos: { enlace: 'verde', correo: 'verde', por_enlazar: 'ambar', sin_cuenta: 'neutro' },
      ayuda: '«Por enlazar»: ya tiene una cuenta (la de su correo) que coincide por el nombre; se enlaza desde su ficha en vez de acuñarle otra',
    },
    { clave: 'cuenta_email', etiqueta: 'Correo de la cuenta', oculta: true },
    {
      clave: 'curso',
      etiqueta: 'Matrícula',
      tipo: 'insignia',
      filtrable: true,
      agrupable: true,
      etiquetas: CURSO_PADRON,
      tonos: { sin_matricula: 'neutro', pendiente: 'azul', en_curso: 'ambar', completado: 'verde' },
    },
    { clave: 'lecciones_hechas', etiqueta: 'Lecciones', tipo: 'entero', ayuda: 'Completadas, de 9' },
    {
      clave: 'enlace',
      etiqueta: 'Enlace',
      tipo: 'insignia',
      filtrable: true,
      agrupable: true,
      etiquetas: ENLACE_PADRON,
      tonos: { sin_acunar: 'neutro', acunado: 'azul', sin_entrar: 'rojo', entro: 'verde', caducado: 'ambar' },
      ayuda: '«Mandado · no ha entrado» es el dato que más dice: significa que no le llegó, no que no quiera',
    },
    { clave: 'entradas', etiqueta: 'Entradas', tipo: 'entero', ayuda: 'Veces que entró con su enlace' },
    { clave: 'mandado_el', etiqueta: 'Mandado el', tipo: 'fecha', oculta: true },
    { clave: 'caduca_el', etiqueta: 'Caduca el', tipo: 'fecha', ayuda: 'El enlace vale 120 días desde que se acuña' },
    { clave: 'correcciones', etiqueta: 'Correcciones', tipo: 'entero', total: true, ayuda: '«No soy yo» en la lección 0, sin pasar todavía a Capital Humano' },
    { clave: 'con_correccion', etiqueta: 'Con corrección', filtrable: true, etiquetas: { si: 'Sí', no: 'No' }, oculta: true },
    { clave: 'activo', etiqueta: 'Activa', filtrable: true, etiquetas: { si: 'Activa', no: 'Inactiva' }, oculta: true },
  ],
  leer: () => leerPadron(),
  // No se usa (la fuente se arma en `leer`), pero describe de dónde sale.
  consulta: (supabase, _ctx, select, o) => supabase.from('padron_estado').select(select, opcCount(o)),
}

export const FUENTES_FORMACION: Record<string, FuenteTabla> = {
  [TABLA_FORMACION_AVANCE.id]: TABLA_FORMACION_AVANCE,
  [TABLA_FORMACION_PERSONAS.id]: TABLA_FORMACION_PERSONAS,
  [TABLA_CERTIFICADOS.id]: TABLA_CERTIFICADOS,
  [TABLA_PADRON.id]: TABLA_PADRON,
}
