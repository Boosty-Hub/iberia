import 'server-only'
import { cache } from 'react'
import { FAMILIAS_OFICIO, type FamiliaOficio } from '@/lib/adiestramiento'
import { legible } from '@/lib/certificado'
import { cruzarPadron } from '@/lib/padron-cuentas'
import { plano } from '@/lib/plataforma/formato'
import { createClient } from '@/lib/supabase/server'
import { comoSeLee } from '@/lib/telefono'

/**
 * El padrón de trabajo (`/sistema/personas/padron`): una fila por ficha de
 * `padron_estado` —la vista que corre como su dueña para poder mirar `accesos`
 * y se cierra con `es_editor()`— cruzada con la plaza que ocupa hoy
 * (`ui.personas`, con la RLS de la estructura) y con las cuentas por el nombre
 * (`cruzarPadron`: la ficha de muestra repetida y la cuenta que coincide).
 *
 * Todo con la sesión de quien mira. Del enlace sale el estado —acuñado,
 * mandado, entradas, caducidad—, nunca el token ni su huella.
 */

export type FilaPadron = Record<string, string | number | boolean | null>

const ZONA = 'America/Caracas'
/** Un instante como fecha de Caracas (`AAAA-MM-DD`): `slice(0, 10)` de un ISO en UTC se corre un día de noche. */
const diaCaracas = (iso: string | null | undefined) =>
  iso ? new Intl.DateTimeFormat('en-CA', { timeZone: ZONA, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso)) : null

export const ORIGEN_PADRON: Record<string, string> = {
  capital_humano: 'Capital Humano',
  a_mano: 'Cargada a mano',
  muestra_repetida: 'Muestra repetida',
}
export const CUENTA_PADRON: Record<string, string> = {
  enlace: 'La de su enlace',
  correo: 'Con su correo',
  por_enlazar: 'Por enlazar',
  sin_cuenta: 'Sin cuenta',
}
export const CURSO_PADRON: Record<string, string> = {
  sin_matricula: 'Sin matrícula',
  pendiente: 'Sin empezar',
  en_curso: 'En curso',
  completado: 'Terminó',
}
export const ENLACE_PADRON: Record<string, string> = {
  sin_acunar: 'Sin acuñar',
  acunado: 'Acuñado, sin mandar',
  sin_entrar: 'Mandado · no ha entrado',
  entro: 'Ya entró',
  caducado: 'Caducado',
}

/** Las filas del padrón, leídas una vez por petición. */
export const leerPadron = cache(async (): Promise<FilaPadron[]> => {
  const supabase = await createClient()
  const hoy = diaCaracas(new Date().toISOString())!
  const [{ data: padron }, { data: plazas }, { data: correcciones }, cruces] = await Promise.all([
    supabase.from('padron_estado').select('*').order('nombre_completo').range(0, 4999),
    // La plaza de hoy: con la RLS de la estructura (sin ese permiso, la columna sale vacía).
    supabase.schema('ui').rpc('personas', { p_al: hoy }).select('empleado_id, plaza_ref, cargo, unidad, tipo').range(0, 4999),
    supabase.from('correcciones_padron').select('empleado_id').is('resuelta_en', null).range(0, 4999),
    cruzarPadron(supabase),
  ])

  const plazaDe = new Map<string, { plaza_ref: string; cargo: string | null; unidad: string | null; tipo: string }>()
  for (const p of (plazas ?? []) as { empleado_id: string; plaza_ref: string; cargo: string | null; unidad: string | null; tipo: string }[]) {
    const ya = plazaDe.get(p.empleado_id)
    if (!ya || (ya.tipo !== 'titular' && p.tipo === 'titular')) plazaDe.set(p.empleado_id, p)
  }
  const pendientes = new Map<string, number>()
  for (const c of correcciones ?? []) pendientes.set(c.empleado_id, (pendientes.get(c.empleado_id) ?? 0) + 1)

  return (padron ?? []).map((p) => {
    const id = p.id ?? ''
    const duplicada = cruces.duplicadas.get(id) ?? null
    const propuesta = cruces.propuestas.get(id) ?? null
    const activo = Boolean(p.activo)
    const plaza = plazaDe.get(id)
    const cuenta = p.cuenta_email
      ? p.cuenta_email.endsWith('@iberia.local')
        ? 'enlace'
        : 'correo'
      : propuesta
        ? 'por_enlazar'
        : 'sin_cuenta'
    const vigente = Boolean(p.acceso_expira && new Date(p.acceso_expira) > new Date())
    const usos = Number(p.acceso_usos ?? 0)
    const enlace = !p.acceso_expira
      ? 'sin_acunar'
      : !vigente
        ? 'caducado'
        : !p.acceso_enviado
          ? 'acunado'
          : usos === 0
            ? 'sin_entrar'
            : 'entro'
    const hechas = Number(p.lecciones_hechas ?? 0)
    const curso = p.matricula_id ? (p.estado_matricula ?? 'pendiente') : 'sin_matricula'
    const familia = (p.familia_oficio ?? 'generico') as FamiliaOficio
    const telefono = comoSeLee(p.telefono) ?? p.telefono
    const muestra = !p.ficha
    // Lo que no se hace en lote, y por qué (la casilla sale apagada con este motivo).
    const bloqueo = !activo
      ? 'Inactiva en el padrón'
      : duplicada
        ? `Ficha de muestra repetida: la de Capital Humano es «${duplicada.nombre}», ficha ${duplicada.ficha}`
        : null
    const marcable = !bloqueo
    return {
      id,
      nombre: p.nombre_completo ?? '',
      ficha: p.ficha,
      origen: duplicada ? 'muestra_repetida' : muestra ? 'a_mano' : 'capital_humano',
      repite_a: duplicada ? `${duplicada.nombre} · ficha ${duplicada.ficha}` : null,
      // Como se lee en el canal: el listado de Capital Humano llega en mayúsculas.
      cargo: p.cargo ? legible(p.cargo) : null,
      area: p.area_nombre ?? null,
      nivel: p.nivel,
      familia,
      familia_nombre: FAMILIAS_OFICIO[familia] ?? familia,
      telefono,
      con_telefono: telefono ? 'si' : 'no',
      activo: activo ? 'si' : 'no',
      plaza_ref: plaza?.plaza_ref ?? null,
      plaza: plaza ? [plaza.cargo, plaza.unidad].filter(Boolean).join(' · ') : null,
      ver_plaza: plaza ? 'plaza' : '',
      cuenta,
      cuenta_email: cuenta === 'correo' ? p.cuenta_email : cuenta === 'por_enlazar' ? (propuesta?.email ?? null) : null,
      curso,
      lecciones_hechas: p.matricula_id ? hechas : null,
      enlace,
      entradas: p.acceso_expira ? usos : null,
      mandado_el: diaCaracas(p.acceso_enviado),
      caduca_el: diaCaracas(p.acceso_expira),
      correcciones: pendientes.get(id) ?? 0,
      con_correccion: pendientes.has(id) ? 'si' : 'no',
      // ── Para la barra de lo marcado ──
      bloqueo,
      puede_matricular: marcable && !p.matricula_id,
      // Acuñar crea la cuenta con la cédula: sin cédula no se acuña (no se inventa
      // una). A quien ya tiene una cuenta que coincide se le enlaza, no se le acuña.
      puede_acunar: marcable && !vigente && Boolean(p.cedula) && cuenta !== 'por_enlazar',
      puede_mandar: marcable && vigente && !p.acceso_enviado,
      sin_cedula: marcable && !vigente && !p.cedula,
      sin_telefono: marcable && !telefono,
      por_enlazar: marcable && cuenta === 'por_enlazar',
      busqueda: plano([p.nombre_completo, p.ficha, p.cargo, p.area_nombre, plaza?.unidad].filter(Boolean).join(' ')),
    }
  })
})
