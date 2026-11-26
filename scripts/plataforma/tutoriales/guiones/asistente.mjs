// Tutoriales del asistente de IA (MI-ASI), con voz (Sebastián). Una pestaña, un capítulo. Se graban contra PRUEBAS con
// la cuenta de tutoriales (`preparar-cuenta.mjs`: datos ficticios y ordenados).
import { bloque, boton, cierre } from './comun.mjs'

export const modulo = 'MI-ASI'
export const conVoz = true
export const cuenta = 'tutorial.pruebas@plataforma.local'
const K = 'ASISTENTE DE IA · TUTORIAL'
const B = '/sistema/asistente'
const R = 'sistema:asistente'

export const capitulos = [
  {
    id: 'chats',
    titulo: 'Conversar con el asistente',
    descripcion: 'Cómo preguntarle, elegir el modelo, adjuntar archivos, dictar, investigar, ver tu cupo y abrir la guía.',
    ruta: B,
    recurso: R,
    async guion(page, a, { marcarInicio }) {
      marcarInicio()
      await a.portada(K, 'Conversar con el asistente', 'Tu chat de inteligencia artificial, dentro de la plataforma')
      await a.quitarPortada()
      await a.sub('Aquí conversas con el asistente: le pides análisis, borradores, resúmenes o tablas, como a un colega del equipo.')
      await a.resaltar(page.getByLabel('Mensaje para el asistente'), 600)
      await a.sub('Eliges el modelo y el esfuerzo. Un modelo más grande razona mejor; uno más chico responde más rápido y gasta menos de tu cupo.', 600)
      await a.resaltar(page.getByLabel('Modelo'), 1500)
      await page.getByLabel('Modelo').selectOption('claude-sonnet-5-5')
      await a.sub('Probemos una pregunta de trabajo.', 400)
      await a.escribir(page.getByLabel('Mensaje para el asistente'), 'Dame tres ideas concretas para reducir las mermas en una línea de envasado. En viñetas cortas.', 500)
      await a.clic(boton(page, 'Enviar'), 600)
      await a.sub('La respuesta llega en vivo. Puedes detenerla, copiarla o calificarla con el pulgar.', 600)
      await page.locator('[aria-label="Copiar la respuesta"]').first().waitFor({ timeout: 180_000 })
      await a.pausa(1500)
      await a.sub('Con Adjuntar subes Excel, Word, PowerPoint, PDF o imágenes, de hasta 100 MB. Un Excel grande lo procesa con código y te devuelve el resultado en Excel.', 600)
      await a.resaltar(page.getByText('📎 Adjuntar').first(), 2000)
      await a.sub('Dictar te deja hablarle: revisas el texto antes de enviarlo. E Investigación busca en muchas fuentes y te entrega un informe con sus citas.', 600)
      await a.resaltar(boton(page, 'Dictar'), 1500)
      await a.resaltar(boton(page, /Investigación/), 1500)
      await a.sub('Abajo ves tu uso en porcentaje: la ventana de cinco horas, el día y el mes. Tu cupo del día se reparte en ventanas, para que no se gaste en una hora.', 600)
      await a.resaltar(page.locator('[data-uso]').first(), 3000)
      await a.sub('La Guía te dice, con tus permisos de hoy, todo lo que el asistente puede hacer por ti y qué datos consulta.', 600)
      await a.clic(page.locator('[data-boton-guia]'), 3500)
      await a.tecla('Escape', 800)
      await a.sub('Y Abrir en ventana deja el chat flotando mientras navegas: el asistente sabe en qué pantalla estás.', 600)
      await a.resaltar(page.locator('[data-abrir-ventana]'), 2200)
      await cierre(a, 'Nadie lee tus chats. Solo el equipo de soporte, si hace falta para resolver un problema, y queda registrado.')
    },
  },
  {
    id: 'proyectos',
    titulo: 'Proyectos',
    descripcion: 'Instrucciones y archivos fijos para varios chats sobre un mismo tema.',
    ruta: `${B}/proyectos`,
    recurso: R,
    async guion(page, a, { marcarInicio }) {
      marcarInicio()
      await a.portada(K, 'Proyectos', 'Un tema de trabajo, con sus instrucciones y sus archivos')
      await a.quitarPortada()
      await a.sub('Un proyecto agrupa tus chats sobre un mismo tema, como el cierre de mes.')
      await a.resaltar(page.getByText('Cierre de mes · Administración').first(), 2200)
      await a.sub('Sus instrucciones y sus archivos los tiene el asistente en cada chat del proyecto: no hay que repetirlos.', 600)
      await a.clic(page.getByText('Cierre de mes · Administración').first(), 2600)
      await a.sub('Aquí defines cómo quieres que trabaje: el formato, la moneda, el orden de las conclusiones.', 2800)
      await a.arriba()
      await cierre(a, 'Las instrucciones de la empresa siempre mandan; las del proyecto van después.')
    },
  },
  {
    id: 'tareas',
    titulo: 'Tareas programadas',
    descripcion: 'Instrucciones que el asistente corre solo, a su hora, y te avisa.',
    ruta: `${B}/tareas`,
    recurso: R,
    async guion(page, a, { marcarInicio }) {
      marcarInicio()
      await a.portada(K, 'Tareas programadas', 'Lo que el asistente hace solo, a su hora')
      await a.quitarPortada()
      await a.sub('Una tarea es una instrucción que el asistente corre solo: cada día, cada semana o cada mes, a la hora de Caracas.')
      await a.resaltar(bloque(page, 'Nueva tarea programada'), 3000)
      await a.sub('Le dices qué hacer, con qué modelo y cada cuánto. El resultado te llega a la campana, y si quieres, por correo.', 600)
      await a.pausa(2500)
      await a.sub('Corre con tus permisos del día: si pierdes acceso a algo, la tarea te lo dice en vez de inventar.', 3500)
      await cierre(a, 'En el chat, el asistente te puede proponer una tarea. La IA propone; tú decides si se programa.')
    },
  },
  {
    id: 'atajos',
    titulo: 'Atajos',
    descripcion: 'Instrucciones guardadas que se usan escribiendo «/» en el chat.',
    ruta: `${B}/atajos`,
    recurso: R,
    async guion(page, a, { marcarInicio }) {
      marcarInicio()
      await a.portada(K, 'Atajos', 'Tus instrucciones de siempre, a un «/» de distancia')
      await a.quitarPortada()
      await a.sub('Un atajo guarda una instrucción que usas seguido, con su modelo y su esfuerzo.')
      await a.resaltar(bloque(page, 'Mis atajos'), 2600)
      await a.sub('Los de la empresa son iguales para todos; los tuyos, solo para ti.', 600)
      await a.resaltar(bloque(page, 'De la empresa'), 2200)
      await a.sub('En el chat escribes «/» y el comando, y la instrucción queda lista para enviar. El mismo «/» busca también en Mis archivos.', 3600)
      await cierre(a, 'Crea uno con «Crear atajo»: comando, título e instrucción.')
    },
  },
  {
    id: 'memoria',
    titulo: 'Mi memoria',
    descripcion: 'Lo que el asistente recuerda de cómo trabajas, entre chats.',
    ruta: `${B}/memoria`,
    recurso: R,
    async guion(page, a, { marcarInicio }) {
      marcarInicio()
      await a.portada(K, 'Mi memoria', 'Lo que el asistente recuerda de cómo trabajas')
      await a.quitarPortada()
      await a.sub('La memoria guarda tus preferencias de trabajo, para no repetirlas en cada chat.')
      await a.resaltar(page.locator('main li, main [data-memoria]').first(), 2600)
      await a.sub('Solo tú la ves. La puedes editar, olvidar un recuerdo o apagarla del todo.', 600)
      await a.resaltar(page.getByText(/Memoria encendida/).first(), 2400)
      await a.sub('El asistente nunca guarda cédulas, teléfonos, correos ni contraseñas, y la memoria no entra en un chat compartido.', 3800)
      await cierre(a, 'Cuando guarda algo nuevo, el chat te lo dice y lo puedes deshacer.')
    },
  },
  {
    id: 'archivos',
    titulo: 'Archivos del asistente',
    descripcion: 'Lo que subiste a los chats y lo que el asistente te generó.',
    ruta: `${B}/archivos`,
    recurso: R,
    async guion(page, a, { marcarInicio }) {
      marcarInicio()
      await a.portada(K, 'Archivos del asistente', 'Lo que subiste y lo que te generó')
      await a.quitarPortada()
      await a.sub('Aquí quedan los archivos de tus chats: los que subiste, los que generó el asistente y los artefactos.')
      await a.sub('Arriba a la derecha ves el espacio que usas de tu cupo. Se guarda hasta que lo borres.', 3200)
      await cierre(a, 'Para ordenar en carpetas y compartir, usa el módulo Mis archivos: el asistente lo cita con «/».')
    },
  },
  {
    id: 'conexiones',
    titulo: 'Conexiones',
    descripcion: 'Conectar tu cuenta de Microsoft 365 para que el asistente lea tu correo, calendario y archivos.',
    ruta: `${B}/conexiones`,
    recurso: R,
    async guion(page, a, { marcarInicio }) {
      marcarInicio()
      await a.portada(K, 'Conexiones', 'Tu Microsoft 365, solo lectura')
      await a.quitarPortada()
      await a.sub('Con tu cuenta de Microsoft 365 conectada, el asistente puede leer tu correo, tu calendario y tus archivos de OneDrive y Teams.')
      await a.resaltar(bloque(page, 'Microsoft 365'), 3000)
      await a.sub('Solo lectura, y solo lo que tú ya ves: nunca manda correos ni cambia nada. La conexión la quitas cuando quieras.', 3800)
      await cierre(a, 'La administración decide qué partes de Microsoft 365 puede leer el asistente en cada rol.')
    },
  },
]
