import 'server-only'
import { revalidatePath } from 'next/cache'
import { CURSO } from '@/lib/adiestramiento'
import { acunarToken, cuandoCaduca, enlaceDe, huella } from '@/lib/accesos'
import { requerirPermiso } from '@/lib/auth'
import { cruzarPadron, enlazarCuentaConFicha } from '@/lib/padron-cuentas'
import { createAdminClient, createClient } from '@/lib/supabase/server'
import { aInternacional } from '@/lib/telefono'
import { estaLista, mandarPlantilla, type Conexion } from '@/lib/whatsapp'

/**
 * Lo que se hace con el padrón: matricular, acuñar el enlace personal, mandarlo,
 * enlazar la cuenta que ya existe y dar por pasada una corrección. Lo usan la
 * barra del padrón (`/sistema/personas/padron`, en lote) y la ficha de la
 * persona (de a una). Cada función vuelve a pedir `modulo:empleados` · editar:
 * la barra y la ficha no deciden nada.
 *
 * **El enlace es la credencial** (AGENTS.md, «El padrón y el enlace personal»):
 * se guarda la huella, nunca el token; caduca a los 120 días; acuñar no revoca
 * el anterior; y lo provisiona la clave de servicio, que es el caso que la regla
 * permite.
 */

export type Resultado = { ok?: string; error?: string }
const UUID = /^[0-9a-f-]{36}$/i
const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`

function limpiar(ids: string[]): string[] {
  return [...new Set(ids.map(String).filter((v) => UUID.test(v)))].slice(0, 1000)
}

function refrescar() {
  revalidatePath('/sistema/personas/padron')
  revalidatePath('/sistema/nucleo/formacion', 'layout')
}

/**
 * Matricula en el curso a las fichas dadas. Idempotente por la restricción única
 * de `matriculas`. La familia de oficio se copia del padrón al matricular: si
 * mañana Capital Humano corrige un cargo, la matrícula conserva el oficio con el
 * que se armaron sus ejercicios. Una ficha de muestra repetida no se matricula.
 */
export async function matricularFichas(entrada: string[]): Promise<Resultado> {
  await requerirPermiso('modulo:empleados', 'editar')
  const ids = limpiar(entrada)
  if (!ids.length) return { error: 'No hay a quién matricular.' }
  const supabase = await createClient()
  const { data: curso } = await supabase.from('cursos').select('id').eq('clave', CURSO).maybeSingle()
  if (!curso) return { error: 'El curso no está sembrado.' }

  const [{ data: gente }, { duplicadas }, { data: ya }] = await Promise.all([
    supabase.from('empleados').select('id, nombre_completo, familia_oficio, activo').in('id', ids),
    cruzarPadron(supabase),
    supabase.from('matriculas').select('empleado_id').eq('curso_id', curso.id).in('empleado_id', ids),
  ])
  const matriculadas = new Set((ya ?? []).map((m) => m.empleado_id))
  const filas = (gente ?? [])
    .filter((e) => e.activo && !duplicadas.has(e.id) && !matriculadas.has(e.id))
    .map((e) => ({
      curso_id: curso.id,
      empleado_id: e.id,
      familia_oficio: e.familia_oficio,
      nombre_corto: e.nombre_completo.split(' ')[0],
    }))
  if (!filas.length) return { ok: 'Ya tenían matrícula: no hubo nada que hacer.' }

  const { error } = await supabase.from('matriculas').upsert(filas, { onConflict: 'curso_id,empleado_id', ignoreDuplicates: true })
  if (error) return { error: `No se pudo matricular: ${error.message}` }
  refrescar()
  return { ok: `${plural(filas.length, 'persona matriculada', 'personas matriculadas')}.` }
}

/**
 * Acuña el enlace personal. Crea la cuenta a quien no la tiene (con un correo
 * interno derivado de la cédula, que nadie usa para entrar) y guarda la huella
 * del token; el texto en claro va solo dentro del mensaje. Se salta, y lo dice:
 * la ficha inactiva, la de muestra repetida, la que tiene una cuenta por enlazar
 * (le crearía una segunda) y la que no tiene cédula (no se le inventa una).
 */
export async function acunarEnlacesDe(entrada: string[]): Promise<Resultado> {
  await requerirPermiso('modulo:empleados', 'editar')
  const ids = limpiar(entrada)
  if (!ids.length) return { error: 'No hay a quién acuñarle el enlace.' }

  const admin = createAdminClient()
  const { data: gente } = await admin.from('empleados').select('id, cedula, nombre_completo, cargo, perfil_id, activo').in('id', ids)
  const { duplicadas, propuestas } = await cruzarPadron(await createClient())

  let acunados = 0
  const saltados = { cedula: 0, cuenta: 0, otros: 0 }
  for (const persona of gente ?? []) {
    if (!persona.activo || duplicadas.has(persona.id)) {
      saltados.otros++
      continue
    }
    // ⚠️ A quien ya tiene una cuenta que coincide no se le acuña: se enlaza.
    if (!persona.perfil_id && propuestas.has(persona.id)) {
      saltados.cuenta++
      continue
    }
    if (!persona.cedula) {
      saltados.cedula++
      continue
    }

    let perfil = persona.perfil_id
    if (!perfil) {
      const correo = `${persona.cedula.replace(/[^0-9a-zA-Z]/g, '').toLowerCase()}@iberia.local`
      const { data: creado, error } = await admin.auth.admin.createUser({
        email: correo,
        email_confirm: true,
        user_metadata: {
          nombre_completo: persona.nombre_completo,
          cargo: persona.cargo,
          organizacion: 'iberia',
          rol: 'lector',
          // Su rol propio: el canal y el curso, sin el panel ni el informe.
          rol_clave: 'personal-planta',
        },
      })
      if (error || !creado?.user) {
        console.error(`[accesos] no se pudo crear la cuenta de la ficha ${persona.id}:`, error?.message)
        saltados.otros++
        continue
      }
      perfil = creado.user.id
      await admin.from('empleados').update({ perfil_id: perfil }).eq('id', persona.id)
    }

    const token = acunarToken()
    const { error } = await admin.from('accesos').insert({
      empleado_id: persona.id,
      token_hash: huella(token),
      motivo: 'curso',
      canal: 'whatsapp',
      expira_en: cuandoCaduca(),
      // El texto en claro va aquí y no vuelve a existir: es lo que sale por WhatsApp.
      mensaje: mensajeDeBienvenida(persona.nombre_completo, enlaceDe(token)),
    })
    if (error) saltados.otros++
    else acunados++
  }

  refrescar()
  const notas = [
    saltados.cedula && `${plural(saltados.cedula, 'sin cédula', 'sin cédula')} (no se le inventa una)`,
    saltados.cuenta && `${plural(saltados.cuenta, 'con cuenta por enlazar', 'con cuenta por enlazar')}`,
    saltados.otros && `${plural(saltados.otros, 'que no se pudo', 'que no se pudieron')}`,
  ].filter(Boolean)
  if (!acunados) return { error: `No se acuñó ningún enlace${notas.length ? `: ${notas.join(' · ')}` : ''}.` }
  return { ok: `${plural(acunados, 'enlace acuñado', 'enlaces acuñados')}.${notas.length ? ` Se saltaron: ${notas.join(' · ')}.` : ''}` }
}

/**
 * Manda por WhatsApp los enlaces acuñados y sin mandar. Uno a uno, guardando el
 * resultado de cada uno: si el 40 falla, los 39 de antes ya salieron y quedan
 * marcados.
 */
export async function mandarEnlacesDe(entrada: string[]): Promise<Resultado> {
  await requerirPermiso('modulo:empleados', 'editar')
  const ids = limpiar(entrada)
  if (!ids.length) return { error: 'No hay enlaces que mandar.' }
  const supabase = await createClient()
  const admin = createAdminClient()

  const { data: conexion } = await supabase.from('ajustes_whatsapp').select('*').eq('id', true).maybeSingle()
  if (!estaLista(conexion as Conexion | null) || !conexion?.activo) return { error: 'WhatsApp no está conectado: márcalos como mandados a mano.' }

  const { data: pendientes } = await admin
    .from('accesos')
    .select('id, mensaje, empleado_id, empleados(telefono)')
    .in('empleado_id', ids)
    .eq('motivo', 'curso')
    .is('enviado_en', null)

  let salieron = 0
  let fallaron = 0
  for (const acceso of pendientes ?? []) {
    const telefono = (acceso.empleados as { telefono: string | null } | null)?.telefono ?? null
    if (!aInternacional(telefono)) {
      fallaron++
      continue
    }
    const envio = await mandarPlantilla(conexion as Conexion, telefono, [acceso.mensaje ?? ''])
    if (envio.ok) {
      await admin.from('accesos').update({ enviado_en: new Date().toISOString() }).eq('id', acceso.id)
      salieron++
    } else {
      fallaron++
      console.error(`[accesos] no salió el de ${acceso.empleado_id}:`, envio.motivo, envio.detalle)
    }
  }
  refrescar()
  if (!salieron) return { error: `No salió ninguno${fallaron ? ` (${fallaron} sin teléfono válido o rechazados)` : ''}.` }
  return { ok: `${plural(salieron, 'enlace mandado', 'enlaces mandados')} por WhatsApp.${fallaron ? ` ${fallaron} no salieron.` : ''}` }
}

/**
 * Marca como mandados a mano los enlaces acuñados y sin mandar. Es el camino de
 * hoy, y no un apaño: una supervisora con el teléfono en la mano va a seguir
 * siendo la mejor vía para quien no abre mensajes de un número desconocido.
 */
export async function marcarEnlacesMandadosDe(entrada: string[]): Promise<Resultado> {
  await requerirPermiso('modulo:empleados', 'editar')
  const ids = limpiar(entrada)
  if (!ids.length) return { error: 'No hay enlaces que marcar.' }
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('accesos')
    .update({ enviado_en: new Date().toISOString(), canal: 'manual' })
    .in('empleado_id', ids)
    .eq('motivo', 'curso')
    .is('enviado_en', null)
    .select('id')
  if (error) return { error: `No se pudo marcar: ${error.message}` }
  refrescar()
  return data?.length ? { ok: `${plural(data.length, 'enlace marcado', 'enlaces marcados')} como mandado a mano.` } : { ok: 'No había enlaces sin mandar.' }
}

/**
 * Enlaza la ficha con la cuenta que ya tiene la persona —la de su correo—. La
 * cuenta no la manda el navegador: se vuelve a cruzar aquí, y solo se enlaza la
 * que el cruce propone para esa ficha.
 */
export async function enlazarCuentaPropuesta(empleadoId: string): Promise<Resultado> {
  await requerirPermiso('modulo:empleados', 'editar')
  if (!UUID.test(empleadoId)) return { error: 'Ficha no válida.' }
  const supabase = await createClient()
  const { propuestas } = await cruzarPadron(supabase)
  const cuenta = propuestas.get(empleadoId)
  if (!cuenta) return { error: 'Esa ficha no tiene una cuenta que coincida (o ya está enlazada).' }
  const error = await enlazarCuentaConFicha(cuenta.id, empleadoId, cuenta.email)
  if (error) return { error }
  refrescar()
  revalidatePath('/sistema/administracion/usuarios')
  return { ok: `Enlazada con ${cuenta.email}.` }
}

/**
 * Da por pasada a Capital Humano una corrección de «No soy yo». El padrón no se
 * toca aquí —lo corrige Capital Humano y vuelve con `importar:padron`—: esto
 * solo saca el aviso de la lista.
 */
export async function resolverCorreccionPadron(id: string): Promise<Resultado> {
  await requerirPermiso('modulo:empleados', 'editar')
  if (!UUID.test(id)) return { error: 'Corrección no válida.' }
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const { data, error } = await supabase
    .from('correcciones_padron')
    .update({ resuelta_en: new Date().toISOString(), resuelta_por: user?.id ?? null })
    .eq('id', id)
    .is('resuelta_en', null)
    .select('id')
  if (error) return { error: `No se pudo marcar: ${error.message}` }
  refrescar()
  return data?.length ? { ok: 'Marcada como pasada a Capital Humano.' } : { error: 'Esa corrección ya estaba resuelta.' }
}

/**
 * El mensaje con el que llega el enlace. Corto: es lo primero que esta persona
 * lee del programa, y le llega de un número que no tiene agendado.
 */
function mensajeDeBienvenida(nombreCompleto: string, enlace: string): string {
  const nombre = nombreCompleto.split(' ')[0]
  return (
    `Epa ${nombre}, soy Ajito, de Industrias Iberia. ` +
    `Te toca un curso corto por el teléfono: nueve clases de tres minutos, ` +
    `a tu ritmo y cuando puedas.\n\n` +
    `Este enlace es tuyo, no lo compartas. Con él entras directo, sin clave:\n${enlace}`
  )
}
