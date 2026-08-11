/**
 * Provisiona un usuario del programa. El signup abierto no existe: las cuentas
 * se crean desde aquí (o desde el módulo de usuarios del dashboard).
 *
 * Uso:
 *   node --env-file=.env.local scripts/crear-usuario.mjs \
 *     --email alberto@iberia.com --password "..." \
 *     --nombre "Alberto García-Ramos" --cargo "Gerente General" \
 *     --rol lector --org iberia
 *
 * Roles: admin | consultor | lector      Organizaciones: boosty | iberia
 */

import { createClient } from '@supabase/supabase-js'

const ROLES = ['admin', 'consultor', 'lector']
const ORGS = ['boosty', 'iberia']

function parsearArgs(argv) {
  const args = {}
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (!a.startsWith('--')) continue
    const clave = a.slice(2)
    const siguiente = argv[i + 1]
    if (siguiente && !siguiente.startsWith('--')) {
      args[clave] = siguiente
      i++
    } else {
      args[clave] = 'true'
    }
  }
  return args
}

function morir(mensaje) {
  console.error(`\n✖ ${mensaje}\n`)
  process.exit(1)
}

const args = parsearArgs(process.argv.slice(2))

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const secret = process.env.SUPABASE_SECRET_KEY

if (!url || !secret) {
  morir(
    'Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SECRET_KEY.\n' +
      '  Corre el script con: node --env-file=.env.local scripts/crear-usuario.mjs …'
  )
}

const email = (args.email ?? '').trim().toLowerCase()
const password = args.password ?? ''
const nombre = args.nombre ?? ''
const cargo = args.cargo ?? ''
const rol = args.rol ?? 'consultor'
const organizacion = args.org ?? (rol === 'lector' ? 'iberia' : 'boosty')

if (!email || !email.includes('@')) morir('Falta --email o no es válido.')
if (password.length < 10)
  morir('La contraseña (--password) debe tener al menos 10 caracteres.')
if (!ROLES.includes(rol)) morir(`--rol debe ser uno de: ${ROLES.join(', ')}`)
if (!ORGS.includes(organizacion)) morir(`--org debe ser uno de: ${ORGS.join(', ')}`)

const supabase = createClient(url, secret, {
  auth: { persistSession: false, autoRefreshToken: false },
})

// email_confirm: true evita el correo de verificación — el acceso lo entrega
// el equipo del programa junto con la contraseña.
const { data, error } = await supabase.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
  user_metadata: { nombre_completo: nombre, cargo, rol, organizacion },
})

if (error) {
  if (/already been registered|already exists/i.test(error.message)) {
    morir(`Ya existe un usuario con el correo ${email}.`)
  }
  morir(`No se pudo crear el usuario: ${error.message}`)
}

// El trigger on_auth_user_created ya insertó el perfil leyendo user_metadata.
// Se confirma aquí para que un fallo del trigger no pase inadvertido.
const { data: perfil, error: errorPerfil } = await supabase
  .from('profiles')
  .select('id, email, nombre_completo, cargo, rol, organizacion, activo')
  .eq('id', data.user.id)
  .maybeSingle()

if (errorPerfil) morir(`Usuario creado, pero falló la lectura del perfil: ${errorPerfil.message}`)

if (!perfil) {
  morir(
    `Usuario creado (${data.user.id}) pero el perfil no se generó.\n` +
      '  Revisa el trigger public.handle_new_user en la base de datos.'
  )
}

console.log('\n✔ Usuario creado\n')
console.table([
  {
    correo: perfil.email,
    nombre: perfil.nombre_completo || '—',
    cargo: perfil.cargo || '—',
    rol: perfil.rol,
    organización: perfil.organizacion,
    activo: perfil.activo,
  },
])
console.log('Ya puede entrar en /login con ese correo y contraseña.\n')
