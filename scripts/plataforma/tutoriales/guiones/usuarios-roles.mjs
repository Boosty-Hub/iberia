// Tutoriales de Usuarios y Roles y permisos (NUC-IDN) enfocados en habilitar el asistente y Mis archivos, con voz. Se
// graban contra PRUEBAS con la cuenta de tutoriales. En la lista de cuentas de pruebas hay correos reales (copias de
// producción): el guion los oculta del video antes de grabar.
import { cierre } from './comun.mjs'

export const modulo = 'NUC-IDN'
export const conVoz = true
export const cuenta = 'tutorial.pruebas@plataforma.local'
const K = 'USUARIOS Y PERMISOS · TUTORIAL'

const ocultarCuentasReales = (page) =>
  page.evaluate(() => {
    // Cada cuenta es un <li> de la lista «Cuentas»: fuera las que no son de prueba (@plataforma.local).
    for (const li of document.querySelectorAll('main section ul > li')) {
      const t = li.textContent || ''
      if (/@/.test(t) && !/@plataforma\.local/.test(t)) li.style.display = 'none'
    }
  })

export const capitulos = [
  {
    id: 'usuarios',
    titulo: 'Usuarios: crear una cuenta y darle su rol',
    descripcion: 'Crear la cuenta, asignar el rol y enlazarla a su ficha del padrón.',
    ruta: '/sistema/administracion/usuarios',
    recurso: 'modulo:usuarios',
    async guion(page, a, { marcarInicio }) {
      await ocultarCuentasReales(page)
      marcarInicio()
      await a.portada(K, 'Usuarios', 'Crear una cuenta y darle su rol')
      await a.quitarPortada()
      await a.sub('Las cuentas se crean aquí: correo, contraseña inicial, nombre, cargo y rol. No hay registro abierto.')
      await a.resaltar(page.locator('form', { has: page.getByRole('heading', { name: 'Provisionar acceso' }) }), 3600)
      await a.sub('El rol decide qué ve la persona. Para usar el asistente, su rol necesita la casilla «Asistente de IA»; para sus carpetas, «Mis archivos».', 4000)
      await a.sub('En la lista se cambia el rol de cualquier cuenta, se enlaza con su ficha del padrón o se desactiva.', 600)
      await a.resaltar(page.locator('main section', { has: page.getByRole('heading', { name: /^Cuentas/ }) }).first(), 3200)
      await cierre(a, 'Si alguien necesita el asistente sin cambiarle el rol, se le da una excepción en Administración, Asistente de IA, Usuarios.')
    },
  },
  {
    id: 'roles',
    titulo: 'Roles y permisos: habilitar el asistente',
    descripcion: 'Las casillas del asistente, de Mis archivos y de las pantallas que el asistente puede consultar.',
    ruta: '/sistema/administracion/roles',
    recurso: 'modulo:roles',
    async guion(page, a, { marcarInicio }) {
      marcarInicio()
      await a.portada(K, 'Roles y permisos', 'Cómo habilitar el asistente para un rol')
      await a.quitarPortada()
      await a.sub('Cada rol es un conjunto de casillas: qué pantallas ve y qué puede hacer en cada una. Abramos el rol Usuario Iberia.')
      await a.clic(page.getByRole('link', { name: /Usuario Iberia/ }).first(), 2200)
      await a.sub('La matriz tiene un buscador. Busquemos el asistente.', 600)
      await a.escribir(page.getByPlaceholder('Buscar módulo, sección o lección'), 'asistente', 1500)
      await a.sub('«Asistente de IA» le da el chat al rol. «Administrar el asistente» es para quien gobierna los topes y el alcance.', 600)
      await a.resaltar(page.getByLabel('Ver · Asistente de IA', { exact: true }), 2600)
      await a.escribir(page.getByPlaceholder('Buscar módulo, sección o lección'), 'archivos', 1400)
      await a.sub('«Mis archivos» le da sus carpetas personales y compartidas.', 600)
      await a.resaltar(page.getByLabel('Ver · Mis archivos', { exact: true }), 2400)
      await a.sub('Ojo: el asistente solo consulta las pantallas que el rol ya ve. Si quieres que responda con plazas, procesos o documentos, el rol necesita esas casillas.', 600)
      await a.escribir(page.getByPlaceholder('Buscar módulo, sección o lección'), 'estructura', 1600)
      await a.pausa(2600)
      await a.sub('Cada casilla dice en qué parte del menú abre. Se guarda con la barra de abajo.', 3400)
      await a.escribir(page.getByPlaceholder('Buscar módulo, sección o lección'), '', 600)
      await cierre(a, 'Después, en Administración, Asistente de IA, Alcance, se marca qué fuentes consulta el asistente para ese rol.')
    },
  },
]
