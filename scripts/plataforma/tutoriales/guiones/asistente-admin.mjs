// Tutoriales de la administración del asistente (NUC-IA, Administración › Asistente de IA), con voz. Se graban contra
// PRUEBAS con la cuenta de tutoriales (nivel administrador).
import { bloque, cierre } from './comun.mjs'

export const modulo = 'NUC-IA'
export const conVoz = true
export const cuenta = 'tutorial.pruebas@plataforma.local'
const K = 'ADMINISTRAR EL ASISTENTE · TUTORIAL'
const B = '/sistema/administracion/asistente'
const R = 'sistema:asistente-admin'

export const capitulos = [
  {
    id: 'resumen',
    titulo: 'El consumo del asistente',
    descripcion: 'Cuánto se gasta, quién lo usa y cómo responde, por persona y por modelo. Nunca el contenido de los chats.',
    ruta: B,
    recurso: R,
    async guion(page, a, { marcarInicio }) {
      marcarInicio()
      await a.portada(K, 'El consumo del asistente', 'Cuánto se usa, quién lo usa y cuánto cuesta')
      await a.quitarPortada()
      await a.sub('El resumen muestra el gasto del mes, cuántas personas lo usan, cuántas respuestas dio y qué tan rápido empieza a responder.')
      await a.resaltar(bloque(page, 'Gasto del asistente en el mes'), 2000)
      await a.resaltar(bloque(page, 'Personas que lo usan'), 1800)
      await a.sub('Abajo, el consumo de cada persona: turnos, fallas, gasto y cómo califican las respuestas.', 600)
      await a.resaltar(bloque(page, 'Consumo del mes por persona'), 3000)
      await a.sub('Y el gasto por modelo, para decidir cuál conviene a cada rol.', 600)
      await a.resaltar(bloque(page, 'Por modelo, este mes'), 2400)
      await cierre(a, 'Aquí se ven cifras, nunca lo que cada quien escribe: los chats no los lee la administración.')
    },
  },
  {
    id: 'motor',
    titulo: 'Motor, topes y modelos',
    descripcion: 'El motor activo, los topes de la empresa y por persona, las ventanas de 5 horas y el catálogo de modelos.',
    ruta: `${B}/motor`,
    recurso: R,
    async guion(page, a, { marcarInicio }) {
      marcarInicio()
      await a.portada(K, 'Motor, topes y modelos', 'Las reglas del asistente para toda la empresa')
      await a.quitarPortada()
      await a.sub('Aquí se elige el motor —Anthropic u OpenAI— y se enciende o se apaga el asistente para toda la empresa.')
      await a.resaltar(bloque(page, 'Motor activo'), 2600)
      await a.sub('Los topes: el mensual de la empresa, el diario y el mensual de cada persona, y en cuántas ventanas de cinco horas se reparte el día.', 600)
      await a.resaltar(bloque(page, 'Topes y valores por defecto'), 3600)
      await a.sub('Las tareas programadas y la investigación profunda tienen sus propios límites.', 600)
      await a.resaltar(bloque(page, 'Tareas programadas e investigación'), 2600)
      await a.sub('Y el catálogo: qué modelos hay, cuánto cuesta cada uno y cuáles están encendidos.', 600)
      await a.resaltar(bloque(page, 'Catálogo de modelos'), 3000)
      await cierre(a, 'Lo que se fija aquí vale para todos, salvo lo que cada rol o persona tenga distinto.')
    },
  },
  {
    id: 'usuarios',
    titulo: 'Usuarios y roles del asistente',
    descripcion: 'La política por rol —modelos, topes, espacio, programar— y las excepciones por persona.',
    ruta: `${B}/usuarios`,
    recurso: R,
    async guion(page, a, { marcarInicio }) {
      marcarInicio()
      await a.portada(K, 'Usuarios y roles', 'Qué puede hacer cada rol con el asistente')
      await a.quitarPortada()
      await a.sub('Quién tiene el asistente se decide en Roles y permisos, con la casilla «Asistente de IA». Aquí se ajusta cómo lo usa cada rol.')
      await a.resaltar(bloque(page, 'Política por rol'), 3200)
      await a.sub('Por rol: qué modelos puede usar, su tope diario y mensual, las ventanas de cinco horas, su espacio y si programa tareas. Lo vacío hereda lo de la empresa.', 4200)
      await a.sub('Y para una persona puntual, una excepción: habilitarla sin tocar su rol, o darle otros topes.', 600)
      await a.resaltar(bloque(page, 'Excepciones por persona'), 3000)
      await cierre(a, 'La excepción manda sobre el rol, y el rol sobre lo de la empresa.')
    },
  },
  {
    id: 'alcance',
    titulo: 'Alcance: qué datos consulta',
    descripcion: 'Qué fuentes de la plataforma consulta el asistente para cada rol, las excepciones y «Ver como».',
    ruta: `${B}/alcance`,
    recurso: R,
    async guion(page, a, { marcarInicio }) {
      marcarInicio()
      await a.portada(K, 'Alcance', 'Qué datos de la plataforma consulta el asistente')
      await a.quitarPortada()
      await a.sub('Cada fuente es una pantalla de la plataforma, las métricas o los documentos. Nace apagada.')
      await a.resaltar(bloque(page, 'Fuentes por rol'), 3000)
      await a.sub('Se enciende la fuente y se marca para qué roles. Pero hay una regla que no cambia: el asistente nunca ve más que la persona.', 600)
      await a.resaltar(page.locator('thead').first(), 2600)
      await a.sub('Si el rol no ve la pantalla en Roles y permisos, el asistente tampoco la consulta, aunque aquí esté marcada.', 4200)
      await a.sub('«Ver como» calcula lo que tendría una persona, sin entrar con su cuenta.', 600)
      await a.resaltar(page.locator('main').getByRole('heading', { name: 'Ver como', exact: true }).locator("xpath=ancestor::*[self::section or contains(@class,'rounded-xl')][1]"), 2800)
      await cierre(a, 'Cada consulta queda registrada, con quién la pidió y qué fuente usó.')
    },
  },
  {
    id: 'microsoft',
    titulo: 'Microsoft 365',
    descripcion: 'La aplicación de Iberia en Microsoft Entra y lo que se le entrega a su administrador.',
    ruta: `${B}/microsoft`,
    recurso: R,
    async guion(page, a, { marcarInicio }) {
      marcarInicio()
      await a.portada(K, 'Microsoft 365', 'Conectar el correo, el calendario y los archivos de la empresa')
      await a.quitarPortada()
      await a.sub('Para que cada persona conecte su Microsoft 365, el administrador de Microsoft de Iberia registra una aplicación.')
      await a.resaltar(bloque(page, 'La aplicación de Iberia en Microsoft Entra'), 3200)
      await a.sub('Se le entrega la dirección de retorno y el certificado público; él devuelve dos identificadores, que se guardan aquí.', 600)
      await a.resaltar(bloque(page, 'Lo que se le entrega al administrador de Microsoft'), 3400)
      await cierre(a, 'Es solo lectura, y cada persona ve solo lo suyo. Lo que lee se habilita por rol en Alcance.')
    },
  },
  {
    id: 'instrucciones',
    titulo: 'Instrucciones de la empresa',
    descripcion: 'Lo que el asistente sabe de Iberia en todo chat.',
    ruta: `${B}/instrucciones`,
    recurso: R,
    async guion(page, a, { marcarInicio }) {
      marcarInicio()
      await a.portada(K, 'Instrucciones de la empresa', 'Lo que el asistente sabe de Iberia')
      await a.quitarPortada()
      await a.sub('Estas instrucciones van en todos los chats de todas las personas: quién es Iberia, su vocabulario y cómo se responde.')
      await a.resaltar(page.getByLabel('Lo que el asistente sabe de Iberia en todo chat'), 3600)
      await a.sub('Mandan sobre las de cada proyecto. Un cambio aquí se nota desde el siguiente mensaje.', 3200)
      await cierre(a, 'Conviene escribirlas cortas y concretas: el asistente las lee en cada respuesta.')
    },
  },
  {
    id: 'adopcion',
    titulo: 'Adopción',
    descripcion: 'Cuánta gente lo usa, para qué y en qué días.',
    ruta: `${B}/adopcion`,
    recurso: R,
    async guion(page, a, { marcarInicio }) {
      marcarInicio()
      await a.portada(K, 'Adopción', 'Quién lo usa y para qué')
      await a.quitarPortada()
      await a.sub('La adopción dice cuántas personas lo usan y cuántas respuestas da al mes.')
      await a.resaltar(bloque(page, 'Personas que lo usan'), 2200)
      await a.sub('Para qué lo usan: cada respuesta se clasifica por tema, sin guardar lo que se escribió.', 600)
      await a.resaltar(bloque(page, 'Para qué lo usan · este mes'), 3000)
      await a.resaltar(bloque(page, 'Turnos por día · este mes'), 2600)
      await cierre(a, 'Lo que no se mide se convierte en entusiasmo tecnológico: aquí se mide.')
    },
  },
]
