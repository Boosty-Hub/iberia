import { NextResponse, type NextRequest } from 'next/server'
import { huella, pareceToken } from '@/lib/accesos'
import { createAdminClient, createClient } from '@/lib/supabase/server'

/**
 * Entrar con el enlace personal.
 *
 * Es la puerta del canal y del curso para las ~200 personas de planta, que no
 * tienen correo corporativo. Tocan el enlace que les llegó por WhatsApp y están
 * dentro: sin usuario, sin clave y sin recordar nada.
 *
 * ── Cómo se convierte un token en una sesión ─────────────────────────────────
 *
 * El token es nuestro y vive en `accesos` como hash. Supabase no lo conoce. Así
 * que el paso es: comprobar el hash, y si cuadra, pedirle a Supabase un enlace
 * mágico para esa cuenta con la clave de servicio y consumirlo aquí mismo. La
 * persona nunca ve ese segundo enlace — se gasta dentro de esta petición.
 *
 * `createAdminClient()` aquí es exactamente el caso que la regla permite:
 * provisionar y autenticar, no leer datos por cuenta de nadie. La comprobación
 * del token ocurre **antes**, y si falla no se acuña nada.
 *
 * ── Lo que no hace, a propósito ──────────────────────────────────────────────
 *
 * No dice por qué falló. Un enlace caducado, uno inventado y uno de alguien que
 * ya no está en el padrón devuelven todos lo mismo: la pantalla de entrar con un
 * aviso. Distinguirlos por fuera convierte esta ruta en una forma de averiguar
 * qué tokens existen.
 */
export async function GET(
  _peticion: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  const alCanal = (motivo?: string) =>
    NextResponse.redirect(
      new URL(`/canal/entrar${motivo ? `?aviso=${motivo}` : ''}`, process.env.NEXT_PUBLIC_SITE_URL)
    )

  // La forma se mira antes de tocar la base: un token mal formado no es un
  // intento legítimo y no merece una consulta.
  if (!pareceToken(token)) return alCanal('enlace')

  const admin = createAdminClient()

  const { data: acceso } = await admin
    .from('accesos')
    .select('id, empleado_id, expira_en, usos, motivo')
    .eq('token_hash', huella(token))
    .maybeSingle()

  if (!acceso || new Date(acceso.expira_en) < new Date()) return alCanal('enlace')

  const { data: empleado } = await admin
    .from('empleados')
    .select('id, activo, perfil_id, profiles(email)')
    .eq('id', acceso.empleado_id)
    .maybeSingle()

  if (!empleado?.activo || !empleado.perfil_id) return alCanal('enlace')

  const correo = (empleado.profiles as { email: string | null } | null)?.email
  if (!correo) return alCanal('enlace')

  // El enlace mágico se acuña y se consume aquí dentro; nunca sale al navegador.
  const { data: magico, error: errEnlace } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email: correo,
  })
  if (errEnlace || !magico?.properties?.hashed_token) return alCanal('enlace')

  const supabase = await createClient()
  const { error: errSesion } = await supabase.auth.verifyOtp({
    token_hash: magico.properties.hashed_token,
    type: 'magiclink',
  })
  if (errSesion) return alCanal('enlace')

  // Se apunta el uso después de que la sesión exista: un contador que sube
  // cuando la entrada falló miente sobre quién está entrando de verdad.
  const ahora = new Date().toISOString()
  await admin
    .from('accesos')
    .update({
      usos: acceso.usos + 1,
      ultimo_uso: ahora,
      usado_en: acceso.usos === 0 ? ahora : undefined,
    })
    .eq('id', acceso.id)

  return NextResponse.redirect(
    new URL(
      acceso.motivo === 'curso' ? '/canal/adiestramiento' : '/canal',
      process.env.NEXT_PUBLIC_SITE_URL
    )
  )
}
