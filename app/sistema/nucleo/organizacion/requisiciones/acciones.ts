'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { puede, requerirPermiso, requerirSesion } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { campo, hoyCaracas, mensajeError, type EstadoAccion } from '@/components/sistema/flujo/formato'

const RUTA = '/sistema/nucleo/organizacion/requisiciones'

/**
 * Guarda una requisición en borrador (nueva o la propia que se está corrigiendo).
 * El formulario reproduce el II-21-40-001 **sin edad, sexo, estatura ni peso**
 * (decisión E1-04): un requisito físico solo entra descrito y con su justificación.
 */
export async function guardarRequisicion(_anterior: EstadoAccion, fd: FormData): Promise<EstadoAccion> {
  const sesion = await requerirPermiso('sistema:requisiciones', 'crear')
  const supabase = await createClient()
  const org = supabase.schema('org')
  const hoy = hoyCaracas()

  const id = campo(fd, 'id')
  const unidad = campo(fd, 'unidad_ref')
  const origen = campo(fd, 'origen')
  const cantidad = Number(campo(fd, 'cantidad') || '1')
  const justificacion = campo(fd, 'justificacion')
  const tipoNomina = campo(fd, 'tipo_nomina') || null

  if (!unidad) return { error: 'Elige la unidad que pide.' }
  const { data: cat } = await supabase.schema('control').from('catalogo').select('clave').eq('tipo', 'origen_requisicion').eq('activo', true)
  if (!(cat ?? []).some((c) => c.clave === origen)) return { error: 'Elige el origen de la requisición.' }
  if (!Number.isInteger(cantidad) || cantidad < 1 || cantidad > 50) return { error: 'La cantidad va de 1 a 50.' }
  if (justificacion.length < 10) return { error: 'La justificación necesita al menos una frase (10 letras).' }

  const esVacante = origen.startsWith('vacante')
  let cargoId = campo(fd, 'cargo_id')
  let plazaRef: string | null = null
  let reemplaza: string | null = null

  if (esVacante) {
    plazaRef = campo(fd, 'plaza_ref') || null
    if (!plazaRef) return { error: 'Elige la plaza vacante que se cubre.' }
    const { data: plaza } = await org
      .from('plaza')
      .select('cargo_id, unidad_ref')
      .eq('ref', plazaRef)
      .is('escenario_id', null)
      .filter('vigencia', 'cs', `[${hoy},${hoy}]`)
      .maybeSingle()
    if (!plaza) return { error: 'Esa plaza no está vigente hoy.' }
    if (plaza.unidad_ref !== unidad) return { error: 'La plaza vacante no es de la unidad elegida.' }
    cargoId = plaza.cargo_id
    reemplaza = campo(fd, 'reemplaza_empleado_id') || null
  } else if (campo(fd, 'cargo_modo') === 'nuevo') {
    // Un cargo que no está en el catálogo: lo crea solo quien edita la estructura.
    if (!puede(sesion, 'sistema:estructura', 'crear')) {
      return { error: 'Crear un cargo es de Desarrollo Organizacional. Elige uno del catálogo o pídeles que lo creen.' }
    }
    const nombre = campo(fd, 'cargo_nuevo_nombre')
    if (nombre.length < 3) return { error: 'Escribe el nombre del cargo nuevo.' }
    // Lo crea la base (`org.crear_cargo_de_requisicion`): la tabla de cargos ya no se escribe por la API, y el cargo entra
    // con la requisición a su ruta de aprobación.
    const { data: nuevo, error } = await org.rpc('crear_cargo_de_requisicion', { p_nombre: nombre, p_familia: campo(fd, 'cargo_nuevo_familia') || '' })
    if (error) return { error: `No se pudo crear el cargo: ${mensajeError(error)}` }
    cargoId = nuevo
  }
  if (!cargoId) return { error: 'Elige el cargo.' }

  let motivo: string | null = null
  let tiempo: string | null = null
  if (origen === 'tiempo_determinado') {
    motivo = campo(fd, 'motivo_contrato')
    tiempo = campo(fd, 'tiempo_contrato')
    if (!motivo || !tiempo) return { error: 'Un contrato a tiempo determinado lleva el motivo y el tiempo.' }
  }

  const requisitoFisico = campo(fd, 'requisito_fisico')
  const justificacionFisica = campo(fd, 'requisito_fisico_justificacion')
  if (requisitoFisico && justificacionFisica.length < 10) {
    return { error: 'Un requisito físico va con su justificación: por qué el puesto lo exige.' }
  }

  const fila = {
    unidad_ref: unidad,
    cargo_id: cargoId,
    plaza_ref: plazaRef,
    origen,
    reemplaza_empleado_id: reemplaza,
    motivo_contrato: motivo,
    tiempo_contrato: tiempo,
    cantidad,
    tipo_nomina: tipoNomina,
    justificacion,
    perfil: {
      nivel_educativo: campo(fd, 'nivel_educativo') || null,
      especialidad: campo(fd, 'especialidad') || null,
      conocimientos: campo(fd, 'conocimientos') || null,
      requisito_fisico: requisitoFisico || null,
      requisito_fisico_justificacion: requisitoFisico ? justificacionFisica : null,
    },
    condiciones: {
      turnos: campo(fd, 'turnos') || null,
      postura: campo(fd, 'postura') || null,
      carga: campo(fd, 'carga') || null,
    },
    fecha_deseada: campo(fd, 'fecha_deseada') || null,
  }

  let destino = id
  if (id) {
    const { data, error } = await org.from('requisicion').update(fila).eq('id', id).in('estado', ['borrador', 'devuelta']).select('id')
    if (error) return { error: mensajeError(error) }
    if (!data?.length) return { error: 'Ya no se puede corregir: se envió, se aprobó o no es tuya.' }
  } else {
    destino = crypto.randomUUID()
    const { error } = await org.from('requisicion').insert({ id: destino, ...fila, creado_por: sesion.userId })
    if (error) return { error: mensajeError(error) }
  }

  revalidatePath(RUTA)
  redirect(`${RUTA}/${destino}?guardada=1`)
}

/** Quién ocupa hoy las plazas de una unidad, para «a quién reemplaza». */
export async function ocupantesDeUnidad(unidad: string) {
  await requerirPermiso('sistema:requisiciones', 'crear')
  const supabase = await createClient()
  const { data } = await supabase.schema('org').rpc('ocupantes_de_unidad', { p_unidad: unidad })
  return (data ?? []).map((o) => ({ plaza_ref: o.plaza_ref, cargo: o.cargo, empleado_id: o.empleado_id, nombre: o.nombre }))
}

export async function enviarRequisicion(_anterior: EstadoAccion, fd: FormData): Promise<EstadoAccion> {
  await requerirPermiso('sistema:requisiciones', 'crear')
  const supabase = await createClient()
  const id = campo(fd, 'id')
  const { error } = await supabase.schema('org').rpc('enviar_requisicion', { p_req: id })
  if (error) return { error: mensajeError(error) }
  revalidatePath(RUTA, 'layout')
  revalidatePath('/sistema/bandeja')
  return { ok: 'Enviada. El impacto quedó congelado y la ruta de aprobación arrancó.' }
}

export async function cancelarRequisicion(_anterior: EstadoAccion, fd: FormData): Promise<EstadoAccion> {
  await requerirSesion()
  const supabase = await createClient()
  const { error } = await supabase
    .schema('org')
    .rpc('cancelar_requisicion', { p_req: campo(fd, 'id'), p_motivo: campo(fd, 'motivo') || undefined })
  if (error) return { error: mensajeError(error) }
  revalidatePath(RUTA, 'layout')
  revalidatePath('/sistema/bandeja')
  return { ok: 'Requisición cancelada.' }
}

/** El ingreso: crea la ocupación de la persona en la plaza. Recursos Humanos. */
export async function registrarIngreso(_anterior: EstadoAccion, fd: FormData): Promise<EstadoAccion> {
  await requerirPermiso('sistema:requisiciones', 'editar')
  const supabase = await createClient()
  const empleado = campo(fd, 'empleado_id')
  const fecha = campo(fd, 'fecha')
  if (!empleado) return { error: 'Elige a la persona del padrón.' }
  if (!fecha) return { error: 'Falta la fecha de ingreso.' }
  const { data, error } = await supabase
    .schema('org')
    .rpc('cubrir_requisicion', { p_req: campo(fd, 'id'), p_empleado: empleado, p_fecha: fecha })
  if (error) return { error: mensajeError(error) }
  revalidatePath(RUTA, 'layout')
  return { ok: data === 'cubierta' ? 'Ingreso registrado: la requisición quedó cubierta.' : 'Ingreso registrado. Faltan personas por entrar.' }
}

/** La propuesta salarial: perímetro de nómina, solo con `sistema:costos`. */
export async function guardarPropuestaSalarial(_anterior: EstadoAccion, fd: FormData): Promise<EstadoAccion> {
  await requerirPermiso('sistema:costos', 'editar')
  const supabase = await createClient()
  const id = campo(fd, 'id')
  const numero = (n: string) => {
    const v = campo(fd, n).replace(/\./g, '').replace(',', '.')
    return v ? Number(v) : null
  }
  const salario = numero('salario_propuesto')
  const bonos = numero('bonos_usd')
  if ((salario !== null && (Number.isNaN(salario) || salario < 0)) || (bonos !== null && (Number.isNaN(bonos) || bonos < 0))) {
    return { error: 'Los montos son números positivos.' }
  }
  const moneda = campo(fd, 'moneda') === 'USD' ? 'USD' : 'VES'
  const { error } = await supabase
    .schema('org')
    .from('requisicion_costo')
    .upsert({ requisicion_id: id, salario_propuesto: salario, moneda, bonos_usd: bonos, nota: campo(fd, 'nota') || null }, { onConflict: 'requisicion_id' })
  if (error) return { error: mensajeError(error) }
  revalidatePath(`${RUTA}/${id}`)
  return { ok: 'Propuesta salarial guardada.' }
}
