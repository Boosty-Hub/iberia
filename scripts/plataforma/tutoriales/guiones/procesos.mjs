// Tutoriales de «Procesos» (NUC-PRO): una pestaña, un capítulo. Se graban contra PRUEBAS.
import { abrirFicha, bloque, boton, cerrarFicha, cierre, escenaTabla, fila, primeraFila } from './comun.mjs'

export const modulo = 'NUC-PRO'
const K = 'PROCESOS · TUTORIAL'
const B = '/sistema/nucleo/procesos'

export const capitulos = [
  {
    id: 'resumen',
    titulo: 'Resumen de procesos',
    descripcion: 'El catálogo de procesos de un vistazo: niveles, fichas, dueños y lo que falta documentar.',
    ruta: `${B}/resumen`,
    recurso: 'sistema:procesos',
    async guion(page, a, { marcarInicio }) {
      marcarInicio()
      await a.portada(K, 'Resumen de procesos', 'El catálogo de procesos de Iberia de un vistazo')
      await a.quitarPortada()
      await a.sub('El Resumen cuenta los procesos del catálogo y cuánto de cada uno está documentado.')
      await a.resaltar(bloque(page, 'Procesos en el catálogo'), 2200)
      await a.sub('«Con ficha PHVA» son los que tienen su ficha de planificar, hacer, verificar y actuar; «Con dueño casado», los que tienen la plaza dueña identificada.', 600)
      await a.resaltar(bloque(page, 'Con ficha PHVA'), 2000)
      await a.resaltar(bloque(page, 'Con dueño casado'), 2000)
      await a.sub('«Sin documentar» es lo que todavía no tiene ficha ni documento vigente: el trabajo por delante.', 600)
      await a.resaltar(bloque(page, 'Sin documentar'), 2200)
      await a.sub('La salud documental, por macroproceso: verde documentado, ámbar en revisión o parcial, gris sin documentar. Una fila abre su catálogo.', 600)
      await a.resaltar(bloque(page, 'Salud documental por macroproceso'), 3400)
      await a.sub('A la derecha, lo que pide atención: dueños vacantes, fichas sin indicadores y códigos dudosos.', 600)
      await a.resaltar(bloque(page, 'Ficha sin indicadores', false), 2600)
      await cierre(a, 'Cada cifra lleva a la tabla que la origina.')
    },
  },
  {
    id: 'mapa',
    titulo: 'El mapa de procesos',
    descripcion: 'Los procesos en cuatro niveles, en un lienzo: desplegar, buscar y abrir la ficha PHVA.',
    ruta: B,
    recurso: 'sistema:procesos',
    async guion(page, a, { marcarInicio }) {
      marcarInicio()
      await page.locator('.react-flow__node').first().waitFor({ timeout: 20000 })
      await a.portada(K, 'El mapa de procesos', 'Los procesos de Iberia en cuatro niveles')
      await a.quitarPortada()
      await a.sub('El mapa dibuja los procesos en tres grupos —estratégicos, cadena de valor y soporte— y cuatro niveles.')
      await a.resaltar(page.locator('.react-flow__node').filter({ hasText: 'Cadena de valor' }).first(), 2400)
      await a.sub('El color dice la salud documental de cada caja: verde documentado y vigente, ámbar en revisión, gris sin documentar.', 600)
      await a.resaltar(page.locator('.lz-leyenda').first(), 2400)
      await a.sub('Un clic despliega un macroproceso en sus procesos.', 600)
      await a.clic(page.locator('.react-flow__node').filter({ hasText: 'Gestión de Compras' }).first(), 2400)
      await a.sub('Para ir directo a uno, búscalo: el lienzo lo enfoca.', 600)
      await a.escribir(page.getByPlaceholder('Buscar y enfocar…'), 'Nómina', 1200)
      await a.clic(page.locator('#lz-resultados [role=option]').first(), 2000)
      await a.sub('Doble clic, o «Ficha ›», abre su ficha PHVA al lado.', 600)
      await a.clic(page.locator('.react-flow__node').filter({ hasText: 'Nómina' }).first(), 2400, { doble: true })
      await a.sub('En la ficha: qué hace el proceso, quién es el dueño, sus documentos, sus indicadores y su historia.', 3200)
      await cerrarFicha(page, a)
      await a.sub('Igual que el organigrama: pantalla completa, PNG, PDF de la rama, y la realidad o un escenario.', 600)
      await a.clic(boton(page, /Pantalla completa/), 2200)
      await a.clic(boton(page, /Salir de pantalla completa/), 1200)
      await cierre(a, 'El mapa es la puerta de entrada a cada proceso.')
    },
  },
  {
    id: 'catalogo',
    titulo: 'El catálogo de procesos',
    descripcion: 'Macroproceso, proceso, subproceso y actividad, con su código, estado y dueño.',
    ruta: `${B}/catalogo`,
    recurso: 'sistema:procesos',
    async guion(page, a, { marcarInicio }) {
      marcarInicio()
      await a.portada(K, 'El catálogo', 'Cada proceso, con su código, su estado y su dueño')
      await a.quitarPortada()
      await a.sub('El catálogo es la lista completa: macroproceso, proceso, subproceso y actividad, con sangría por nivel.')
      await a.sub('Cada uno lleva su código del SGC y el del informe, su estado operativo, su ciclo y su dueño.', 600)
      await a.resaltar(page.locator('thead').first(), 2600)
      await a.sub('«Estado operativo» distingue lo que se ejecuta, lo que no está documentado y lo propuesto.', 600)
      await a.resaltar(page.locator('thead th').filter({ hasText: 'Estado operativo' }).first(), 2200)
      await escenaTabla(page, a, { buscar: 'Compras' })
      await abrirFicha(page, a, fila(page, 'Gestión de Compras y Abastecimiento'), 'Una fila abre su ficha PHVA. Los procesos nuevos nacen en borrador y pasan por revisión antes de quedar vigentes.')
      await a.pausa(1500)
      await cerrarFicha(page, a)
      await cierre(a, 'El catálogo y el mapa son el mismo dato visto de dos formas.')
    },
  },
  {
    id: 'cruce',
    titulo: 'Cruce SGC ↔ informe',
    descripcion: 'Cada proceso del SGC frente a su par en el inventario del levantamiento.',
    ruta: `${B}/cruce`,
    recurso: 'sistema:procesos',
    async guion(page, a, { marcarInicio }) {
      marcarInicio()
      await a.portada(K, 'Cruce SGC ↔ informe', 'Los procesos del SGC frente a los del levantamiento')
      await a.quitarPortada()
      await a.sub('El cruce pone cada proceso del SGC de Iberia al lado de su par en el inventario que levantamos en la Fase 1.')
      await a.resaltar(page.locator('thead').first(), 2400)
      await a.sub('Un proceso del SGC puede cubrir varios del inventario, o al revés: cada par dice qué tipo de relación es.', 600)
      await escenaTabla(page, a, { buscar: 'Nómina', textoBuscar: 'Busca por código o por nombre.', corto: true })
      await a.sub('El tipo, o «Por confirmar», se corrige tocando la celda. La corrección queda en el historial.', 600)
      await a.resaltar(primeraFila(page), 2600)
      await abrirFicha(page, a, primeraFila(page), 'Una fila abre la ficha del proceso.')
      await a.pausa(1200)
      await cerrarFicha(page, a)
      await cierre(a, 'Así el SGC y el informe hablan del mismo proceso con los mismos códigos.')
    },
  },
  {
    id: 'escenarios',
    titulo: 'Escenarios de procesos',
    descripcion: 'Ensayar cambios al catálogo en una copia aislada, compararlos y publicarlos con fecha.',
    ruta: `${B}/escenarios`,
    recurso: 'sistema:escenarios',
    async guion(page, a, { marcarInicio }) {
      marcarInicio()
      await a.portada(K, 'Escenarios de procesos', 'Ensayar cambios sin tocar lo vigente')
      await a.quitarPortada()
      await a.sub('Un escenario copia una parte del catálogo para ensayar cambios: agregar, retirar o modificar procesos.')
      await a.sub('Se arranca aquí, eligiendo qué macroproceso copiar.', 600)
      await a.clic(page.getByText('Nuevo escenario de procesos').first(), 2400)
      await a.sub('Le pones nombre, eliges qué parte del catálogo copia —todo o un macroproceso con lo que cuelga de él— y para qué es.', 600)
      await a.resaltar(page.getByText('Qué parte del catálogo copia').first().locator('xpath=..'), 2800)
      await a.resaltar(boton(page, 'Crear escenario'), 2000)
      await a.sub('Cada escenario dice cuántos procesos se agregan, se retiran, cambian, y si choca con otro escenario abierto.', 600)
      await a.resaltar(page.locator('table').first(), 3000)
      await a.sub('Dentro del escenario se edita el mapa en modo escenario, se compara contra lo vigente y se manda a aprobación.', 3400)
      await cierre(a, 'Lo aprobado se publica con fecha; lo de antes queda cerrado, no borrado.')
    },
  },
  {
    id: 'validacion',
    titulo: 'Validación de procesos',
    descripcion: 'La secuencia de New Iberia por área: cómo es, mejoras, revisión y proceso optimizado.',
    ruta: `${B}/validacion`,
    recurso: 'sistema:procesos',
    async guion(page, a, { marcarInicio }) {
      marcarInicio()
      await a.portada(K, 'Validación', 'La secuencia de New Iberia, área por área')
      await a.quitarPortada()
      await a.sub('Validación sigue la secuencia de New Iberia: cada área pasa por cuatro etapas.')
      await a.resaltar(bloque(page, 'Cómo es', false), 2200)
      await a.sub('Primero se levanta cómo se hace hoy; después el dueño propone mejoras; luego la revisión y la decisión del comité; y al final, el proceso optimizado.', 600)
      await a.resaltar(bloque(page, 'Proceso optimizado', false), 2400)
      await a.sub('Las cifras dicen cuánto falta: procesos por validar, «cómo es» por levantar, en revisión y validados.', 600)
      await a.resaltar(bloque(page, 'Procesos por validar'), 2400)
      await a.sub('La tabla, por macroproceso: en qué etapa está y cuál es el siguiente paso.', 600)
      await a.resaltar(page.locator('thead th').filter({ hasText: 'Siguiente paso' }).first(), 2400)
      await abrirFicha(page, a, primeraFila(page), 'Una fila abre la ficha del macroproceso.')
      await a.pausa(1200)
      await cerrarFicha(page, a)
      await cierre(a, 'Es el tablero para seguir el avance del rediseño de procesos.')
    },
  },
  {
    id: 'historial',
    titulo: 'Historial de procesos',
    descripcion: 'Cada versión creada, enviada, aprobada o reemplazada, con quién y cuándo.',
    ruta: `${B}/historial`,
    recurso: 'sistema:auditoria',
    async guion(page, a, { marcarInicio }) {
      marcarInicio()
      await a.portada(K, 'Historial de procesos', 'Cada versión, con quién y cuándo')
      await a.quitarPortada()
      await a.sub('El historial registra cada versión de un proceso: creada, modificada, enviada, aprobada o reemplazada.')
      await a.sub('También cada corrección del cruce con el informe. Nada se borra.', 600)
      await a.resaltar(page.locator('table').first(), 2800)
      await escenaTabla(page, a, { buscar: 'Compras', textoBuscar: 'Filtra por proceso, código o tipo de cambio.', corto: true })
      await abrirFicha(page, a, primeraFila(page), 'Una fila abre la ficha del proceso, con su línea de tiempo.')
      await a.pausa(1200)
      await cerrarFicha(page, a)
      await cierre(a, 'Si algo cambió, aquí está quién lo cambió y cuándo.')
    },
  },
]
