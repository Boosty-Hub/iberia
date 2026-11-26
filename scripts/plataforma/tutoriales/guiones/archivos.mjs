// Tutoriales de Mis archivos (MI-ARC), con voz. Se graban contra PRUEBAS con la cuenta de tutoriales.
import { boton, cierre } from './comun.mjs'

export const modulo = 'MI-ARC'
export const conVoz = true
export const cuenta = 'tutorial.pruebas@plataforma.local'
const K = 'MIS ARCHIVOS · TUTORIAL'
const R = 'sistema:archivos'

export const capitulos = [
  {
    id: 'carpetas',
    titulo: 'Mis carpetas',
    descripcion: 'Carpetas y archivos personales: subir, ordenar, ver, compartir y usarlos en el asistente con «/».',
    ruta: '/sistema/archivos',
    recurso: R,
    async guion(page, a, { marcarInicio }) {
      marcarInicio()
      await a.portada(K, 'Mis carpetas', 'Tus archivos, ordenados y a mano del asistente')
      await a.quitarPortada()
      await a.sub('Mis archivos es tu espacio de carpetas, como un SharePoint. Solo tú lo ves, salvo lo que compartas.')
      await a.sub('Los documentos de la empresa llegan con las carpetas de origen. Por ejemplo, los del sistema de gestión de calidad.', 600)
      await a.clic(page.locator('[data-explorador]').getByRole('link', { name: 'Documentos del SGC' }), 2000)
      await a.sub('Cada carpeta respeta el orden que ya tenían los archivos, y las migas de arriba te devuelven.', 600)
      await a.resaltar(page.locator('nav[aria-label="Migas"]'), 2200)
      await a.clic(page.locator('nav[aria-label="Migas"]').getByRole('link', { name: 'Mis carpetas' }), 1600)
      await a.sub('Tus propias carpetas las creas y las ordenas tú.', 600)
      await a.clic(page.locator('[data-explorador]').getByRole('link', { name: 'Finanzas' }), 1400)
      await a.clic(page.locator('[data-explorador]').getByRole('link', { name: 'Cierre de noviembre' }), 1600)
      await a.sub('Subes archivos con el botón o arrastrándolos a la pantalla. Cada uno se puede renombrar, mover o borrar.', 600)
      await a.resaltar(boton(page, /Subir archivos/), 1800)
      await a.resaltar(page.locator('[data-explorador] tbody tr').first(), 2200)
      await a.sub('Compartir le da acceso a otra persona. Una carpeta compartida incluye todo lo de adentro, también lo que agregues después.', 600)
      await a.clic(page.locator('[data-explorador] tbody tr').first().getByRole('button', { name: 'Compartir' }), 3200)
      await a.sub('Si lo que compartes es privado, como un documento de perímetro sensible, te pide confirmarlo.', 3400)
      await a.tecla('Escape', 800)
      await a.sub('Y en el asistente, escribe «/» y el nombre: el archivo o la carpeta se adjunta al chat con un toque.', 600)
      await page.goto(page.url().replace(/\/sistema\/archivos.*$/, '/sistema/asistente'), { waitUntil: 'networkidle' })
      await a.escribir(page.getByLabel('Mensaje para el asistente'), '/Ventas', 600)
      await page.locator('[data-menu-biblioteca]').waitFor({ timeout: 20_000 })
      await a.resaltar(page.locator('[data-menu-biblioteca]'), 2600)
      await cierre(a, 'Así el asistente trabaja con tus archivos sin que los subas otra vez.')
    },
  },
  {
    id: 'compartido',
    titulo: 'Compartido conmigo',
    descripcion: 'Lo que otras personas te compartieron: verlo, descargarlo y usarlo en el asistente.',
    ruta: '/sistema/archivos/compartido',
    recurso: R,
    async guion(page, a, { marcarInicio }) {
      marcarInicio()
      await a.portada(K, 'Compartido conmigo', 'Lo que otras personas te compartieron')
      await a.quitarPortada()
      await a.sub('Aquí llega lo que otras personas comparten contigo, con quién te lo compartió.')
      await a.resaltar(page.locator('[data-explorador]'), 2400)
      await a.clic(page.locator('[data-explorador] tbody a').first(), 1800)
      await a.sub('Lo puedes ver y descargar, y usar en el asistente con «/». Cambiarlo, solo su dueño.', 3600)
      await cierre(a, 'Si te retiran el acceso, deja de aparecer aquí.')
    },
  },
]
