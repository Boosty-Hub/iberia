/**
 * Cambia la contraseña de un usuario del programa.
 *
 *   node --env-file=.env.local scripts/cambiar-clave.mjs \
 *     --email nombre@empresa.com --password "nueva clave"
 *
 * Verifica el cambio iniciando sesión con la clave nueva antes de dar el OK.
 */

import { createClient } from '@supabase/supabase-js'

const LARGO_MINIMO = 10

function morir(mensaje) {
  console.error(`\n✖ ${mensaje}\n`)
  process.exit(1)
}

const args = {}
for (let i = 2; i < process.argv.length; i++) {
  if (process.argv[i].startsWith('--')) args[process.argv[i].slice(2)] = process.argv[i + 1]
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const secreta = process.env.SUPABASE_SECRET_KEY
const publicable = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

if (!url || !secreta || !publicable) {
  morir('Faltan variables. Corre con: node --env-file=.env.local scripts/cambiar-clave.mjs …')
}

const email = (args.email ?? '').trim().toLowerCase()
const password = args.password ?? ''

if (!email.includes('@')) morir('Falta --email o no es válido.')
if (password.length < LARGO_MINIMO) {
  morir(`La contraseña debe tener al menos ${LARGO_MINIMO} caracteres.`)
}

const admin = createClient(url, secreta, {
  auth: { persistSession: false, autoRefreshToken: false },
})

// La Admin API no busca por correo: se localiza el id en profiles.
const { data: perfil, error: errorPerfil } = await admin
  .from('profiles')
  .select('id, email, nombre_completo, rol, activo')
  .eq('email', email)
  .maybeSingle()

if (errorPerfil) morir(`No se pudo buscar el usuario: ${errorPerfil.message}`)
if (!perfil) morir(`No existe ningún usuario con el correo ${email}.`)

const { error: errorUpdate } = await admin.auth.admin.updateUserById(perfil.id, { password })
if (errorUpdate) morir(`No se pudo cambiar la contraseña: ${errorUpdate.message}`)

// Comprobación real: si el login con la clave nueva falla, el cambio no sirvió.
const cliente = createClient(url, publicable, { auth: { persistSession: false } })
const { error: errorLogin } = await cliente.auth.signInWithPassword({ email, password })

if (errorLogin) {
  morir(`La contraseña se actualizó pero el login de prueba falló: ${errorLogin.message}`)
}

console.log('\n✔ Contraseña cambiada y verificada con un login real\n')
console.table([
  {
    correo: perfil.email,
    nombre: perfil.nombre_completo || '—',
    rol: perfil.rol,
    activo: perfil.activo,
  },
])
