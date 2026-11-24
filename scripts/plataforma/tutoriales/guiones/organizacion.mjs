// Tutoriales de «Organización y autoridad» (NUC-ORG): una pestaña, un capítulo. Se graban contra PRUEBAS.
import { abrirFicha, bloque, boton, cerrarFicha, cierre, escenaTabla, fila, pestanaFicha, primeraFila } from './comun.mjs'

export const modulo = 'NUC-ORG'
const K = 'ORGANIZACIÓN Y AUTORIDAD · TUTORIAL'
const B = '/sistema/nucleo/organizacion'

export const capitulos = [
  {
    id: 'resumen',
    titulo: 'Resumen de la organización',
    descripcion: 'La dotación de un vistazo: aprobado, ocupado, vacantes y lo que pide atención.',
    ruta: `${B}/resumen`,
    recurso: 'sistema:estructura',
    async guion(page, a, { marcarInicio }) {
      marcarInicio()
      await a.portada(K, 'Resumen de la organización', 'La dotación de Iberia de un vistazo, cada cifra con su fuente')
      await a.quitarPortada()
      await a.sub('El Resumen muestra la dotación a la fecha que elijas: lo aprobado, lo ocupado y lo que falta o sobra.')
      await a.resaltar(bloque(page, 'Dotación aprobada'), 2400)
      await a.sub('Cada cifra dice de dónde sale y cuándo se calculó. La ⓘ explica exactamente cómo se cuenta.')
      await a.resaltar(bloque(page, 'Ocupada'), 2000)
      await a.resaltar(bloque(page, 'Por encima'), 1600)
      await a.sub('«Por encima» es gente registrada de más sobre la dotación aprobada: es un hallazgo, no un error de carga.')
      await a.sub('Debajo, cada dirección contra el plan: la barra clara es lo aprobado y la oscura, lo ocupado.', 600)
      await a.resaltar(bloque(page, 'Dotación por dirección, contra el plan'), 3200)
      await a.sub('A la derecha, lo que pide atención: plazas sin titular, personas sin plaza, puntos por conciliar.', 600)
      await a.resaltar(bloque(page, 'Lo que pide atención'), 3200)
      await a.arriba()
      await a.sub('Con «Datos al», en la barra de arriba, ves la organización como estaba en cualquier fecha.', 600)
      await a.resaltar(page.locator('input[type=date]:visible').first(), 2400)
      await a.sub('Y cada línea de «Lo que pide atención» te lleva a su tabla, ya filtrada.', 600)
      await a.clic(bloque(page, 'Lo que pide atención').locator('a').first(), 2600)
      await cierre(a, 'Así pasas del resumen al detalle sin buscar nada a mano.')
    },
  },
  {
    id: 'organigrama',
    titulo: 'El organigrama',
    descripcion: 'La estructura en un lienzo: desplegar, buscar, abrir la ficha y verlo en pantalla completa.',
    ruta: B,
    recurso: 'sistema:estructura',
    async guion(page, a, { marcarInicio }) {
      marcarInicio()
      await page.locator('.react-flow__node').first().waitFor({ timeout: 20000 })
      await a.portada(K, 'El organigrama', 'La estructura de Iberia en un lienzo que se despliega')
      await a.quitarPortada()
      await a.sub('El organigrama dibuja unidades y plazas. Cada caja dice cuánta gente tiene contra su dotación aprobada.')
      await a.resaltar(page.locator('.react-flow__node').filter({ hasText: 'Junta Directiva' }), 2400)
      await a.sub('El color del borde lo dice de un vistazo: en dotación, con vacantes o por encima. La leyenda está arriba.', 600)
      await a.resaltar(page.locator('.lz-leyenda').first(), 2400)
      await a.sub('Un clic en una caja la despliega o la pliega.', 600)
      await a.clic(page.locator('.react-flow__node').filter({ hasText: 'Dirección de Finanzas' }).first(), 2200)
      await a.sub('Para ir directo a una unidad, búscala: el lienzo la enfoca.', 600)
      await a.escribir(page.getByPlaceholder('Buscar y enfocar…'), 'Compras', 1200)
      await a.clic(page.locator('#lz-resultados [role=option]').first(), 2000)
      await a.sub('Doble clic, o «Ficha ›», abre su ficha al lado, sin perder el dibujo.', 600)
      await a.clic(page.locator('.react-flow__node.selected, .react-flow__node').filter({ hasText: 'Gerencia de Compras' }).first(), 1800, { doble: true })
      await a.pausa(1200)
      await pestanaFicha(page, a, /Dotación/, 'En la ficha están su dotación, sus plazas, de quién depende y su historia.')
      await cerrarFicha(page, a)
      await a.sub('«Pantalla completa» deja solo el lienzo, para ver todo mejor. Esc o el mismo botón para salir.', 600)
      await a.clic(boton(page, /Pantalla completa/), 2400)
      await a.clic(boton(page, /Desplegar todo/), 2600)
      await a.clic(boton(page, /Salir de pantalla completa/), 1500)
      await a.sub('Con «Color» cambias lo que se mira; también puedes bajar el dibujo en PNG o el PDF de la rama elegida.', 600)
      await a.resaltar(page.locator('.lz-herramientas select').first(), 1800)
      await a.resaltar(boton(page, /PDF del subárbol/), 1800)
      await a.sub('Arriba eliges el lienzo o el esquema, la fecha, y la realidad o un escenario para ensayar cambios.', 600)
      await a.resaltar(page.getByRole('button', { name: 'Esquema' }).first(), 1600)
      await cierre(a, 'El organigrama siempre sale de las plazas vigentes: lo que cambies en una ficha se ve aquí.')
    },
  },
  {
    id: 'plazas',
    titulo: 'Plazas',
    descripcion: 'Cada puesto aprobado, con su dotación, sus titulares, vacantes y lo que sobra.',
    ruta: `${B}/plazas`,
    recurso: 'sistema:estructura',
    async guion(page, a, { marcarInicio }) {
      marcarInicio()
      await a.portada(K, 'Plazas', 'Cada puesto aprobado, con quién lo ocupa')
      await a.quitarPortada()
      await a.sub('Plazas es la tabla de cada puesto vigente: unidad, cargo, dotación aprobada, titulares, vacantes y lo que sobra.')
      await escenaTabla(page, a, { buscar: 'Compras' })
      await a.sub('Las plazas con una sugerencia de la IA llevan la marca IA. Este botón las muestra todas: la IA propone, tú decides.', 600)
      await a.resaltar(boton(page, /Con propuestas de la IA/), 2600)
      await a.sub('La dotación y la nómina se editan en la misma celda. Mira: le subo la dotación a esta plaza.', 600)
      const col = await page.locator('thead th').evaluateAll((ths) => ths.findIndex((t) => /Dotación/.test(t.textContent || '')))
      const celda = page.locator('tbody tr').first().locator('td').nth(col)
      const antes = Number(((await celda.textContent()) || '1').replace(/\D/g, '') || '1')
      await a.clic(celda.locator('button').first(), 600)
      await a.escribir(celda.locator('input').first(), String(antes + 1), 300)
      await a.tecla('Enter', 1800)
      await a.sub('No entra de una vez: queda en «Mis cambios», tu borrador. La celda sigue mostrando lo vigente hasta que se apruebe.', 600)
      await a.resaltar(page.getByRole('link', { name: /Mis cambios/ }).first(), 2800)
      await a.sub('Desde «Mis cambios» lo envías con su fecha, y lo aprueba alguien con «Aprobar cambios»: nunca quien lo hizo.', 3400)
      await abrirFicha(page, a, fila(page, 'Gerente de Compras'), 'Una fila abre la ficha de la plaza: sus ocupantes, de quién depende, su costo y su historia.')
      await pestanaFicha(page, a, /Ocupantes/, 'En «Ocupantes» está quién la tiene y desde cuándo.')
      await pestanaFicha(page, a, /Dependencias/, '«Dependencias» muestra lo que cuelga de esta plaza: los procesos que dirige y las rutas de firma donde aparece.')
      await cerrarFicha(page, a)
      await cierre(a, 'Desde Plazas se ve y se corrige la estructura puesto por puesto.')
    },
  },
  {
    id: 'personas',
    titulo: 'Personas',
    descripcion: 'Quién ocupa cada plaza: nombre, ficha, cargo y unidad.',
    ruta: `${B}/personas`,
    recurso: 'sistema:estructura',
    async guion(page, a, { marcarInicio }) {
      marcarInicio()
      await a.portada(K, 'Personas', 'Quién ocupa cada plaza')
      await a.quitarPortada()
      await a.sub('Personas lista a quienes ocupan una plaza: nombre, número de ficha, cargo, unidad y dirección.')
      await a.sub('«Por nombre del cargo» marca lo que la carga casó solo por el texto del cargo: conviene confirmarlo.', 600)
      await escenaTabla(page, a, { buscar: 'Analista', textoBuscar: 'Busca por nombre, ficha, cargo o unidad.', corto: true })
      await abrirFicha(page, a, primeraFila(page), 'Una fila abre la ficha de la persona: su plaza, su unidad y su historia en la estructura.')
      await cerrarFicha(page, a)
      await a.sub('Los datos personales —cédula, teléfono, correo— no están aquí: los lleva Capital Humano en el padrón.', 3400)
      await cierre(a, 'Personas responde rápido a «¿quién está en ese puesto?».')
    },
  },
  {
    id: 'cargos',
    titulo: 'Cargos',
    descripcion: 'El catálogo de cargos: nombre, familia, nivel, sinónimos y estado.',
    ruta: `${B}/cargos`,
    recurso: 'sistema:estructura',
    async guion(page, a, { marcarInicio }) {
      marcarInicio()
      await a.portada(K, 'Cargos', 'El catálogo de cargos de Iberia')
      await a.quitarPortada()
      await a.sub('Cargos es el catálogo con lo que pesa cada uno en la estructura: familia, nivel y sinónimos.')
      await a.sub('Los sinónimos son los otros nombres con que aparece el cargo en nómina o en los organigramas: así la carga los reconoce.', 600)
      await a.resaltar(page.locator('thead th').filter({ hasText: 'Sinónimos' }).first(), 2600)
      await escenaTabla(page, a, { buscar: 'Analista', corto: true })
      await a.sub('Nombre, familia, nivel, sinónimos y estado se editan en la celda; el cambio queda en «Mis cambios» hasta que se aprueba. Un cargo no se borra: se desactiva.', 600)
      await a.resaltar(page.locator('tbody tr').first(), 2600)
      await a.sub('Para un cargo que no existe, «+ Nuevo cargo»: también entra al catálogo cuando se aprueba.', 600)
      await a.resaltar(boton(page, /Nuevo cargo/), 2200)
      await cierre(a, 'Un catálogo limpio hace que plazas, nómina y organigrama hablen del mismo cargo.')
    },
  },
  {
    id: 'dotacion',
    titulo: 'Dotación',
    descripcion: 'La dotación contra el plan del año, por dirección y por unidad y cargo, y las versiones del plan.',
    ruta: `${B}/dotacion`,
    recurso: 'sistema:dotacion',
    async guion(page, a, { marcarInicio }) {
      marcarInicio()
      await a.portada(K, 'Dotación', 'Lo aprobado, lo ocupado y el plan del año')
      await a.quitarPortada()
      await a.sub('Dotación compara lo aprobado y lo ocupado contra el plan del año. Sin costos: esos están en Costos 🔒.')
      await a.resaltar(bloque(page, 'Plan 2026'), 2400)
      await a.sub('Debajo, el plan contra lo real por dirección. Una fila filtra la tabla de abajo por esa dirección.', 600)
      await a.resaltar(bloque(page, 'Plan contra real, por dirección'), 3000)
      await a.sub('El plan se guarda en versiones: una versión aprobada no se toca, y el cambio es una versión nueva.', 600)
      await a.resaltar(bloque(page, /Plan de dotación \d{4}: versiones/, false), 3000)
      await a.sub('Para proponer cambios, se abre una versión en borrador con una nota de qué cambia y por qué, y va a aprobación.', 600)
      await a.resaltar(boton(page, /Abrir versión en borrador/), 2400)
      await a.sub('Y la tabla, por unidad y cargo: aprobada, ocupada, vacantes y lo que sobra, con sus filtros y su CSV.', 600)
      await a.resaltar(page.locator('table').last(), 2600)
      await cierre(a, 'Dotación es la base para pedir personal: una requisición se mide contra esto.')
    },
  },
  {
    id: 'costos',
    titulo: 'Costos 🔒',
    descripcion: 'El costo de referencia de la dotación, solo para quien tiene el perímetro de nómina.',
    ruta: `${B}/costos`,
    recurso: 'sistema:costos',
    async guion(page, a, { marcarInicio }) {
      marcarInicio()
      await a.portada(K, 'Costos 🔒', 'El costo de referencia de la dotación')
      await a.quitarPortada()
      await a.sub('Costos es perímetro de nómina: lo ve solo quien tiene ese permiso, y la IA no entra aquí.')
      await a.sub('Es el costo de referencia del cargo multiplicado por la dotación, no el salario de nadie.', 600)
      await a.resaltar(bloque(page, 'Costo mensual de la dotación'), 3000)
      await a.sub('Las cifras van en bolívares con la tasa BCV del día; cambias a dólares con Bs/USD en la barra de arriba.', 600)
      await a.resaltar(bloque(page, 'Tasa BCV usada'), 2400)
      await a.sub('Cuatro vistas: por unidad, el costo de referencia de cada cargo, sus componentes y los parámetros.', 600)
      await a.clic(boton(page, 'Costo de referencia por cargo'), 2200)
      await a.clic(boton(page, 'Componentes'), 2200)
      await a.clic(boton(page, 'Parámetros'), 2200)
      await a.clic(boton(page, 'Por unidad'), 1500)
      await a.sub('Cambiar un costo, un componente o un parámetro también pasa por aprobación: queda en «Mis cambios» hasta que lo firman.', 3400)
      await cierre(a, 'Un cargo sin costo de referencia sale contado aparte, para completarlo.')
    },
  },
  {
    id: 'requisiciones',
    titulo: 'Requisiciones de personal',
    descripcion: 'Pedir personal y seguir la requisición por su ruta de aprobación.',
    ruta: `${B}/requisiciones`,
    recurso: 'sistema:requisiciones',
    async guion(page, a, { marcarInicio }) {
      marcarInicio()
      await a.portada(K, 'Requisiciones de personal', 'Pedir personal y seguirlo paso a paso')
      await a.quitarPortada()
      await a.sub('Aquí están todas las requisiciones: el paso en que van, quién la tiene y cuántos días lleva ahí.')
      await a.resaltar(bloque(page, 'En aprobación'), 2000)
      await a.resaltar(bloque(page, 'Más de 5 días en un paso'), 2200)
      await a.sub('«Solo las mías» deja las que pediste tú.', 600)
      await a.resaltar(boton(page, 'Solo las mías'), 1800)
      await a.sub('Para pedir personal, «+ Nueva requisición»: el cargo, la unidad, cuántas personas y el motivo.', 600)
      await a.clic(boton(page, /Nueva requisición/), 2400)
      await a.sub('Se guarda como borrador: antes de enviarla ves cómo cambia la dotación de la unidad y la ruta de firmas que va a recorrer.', 600)
      await a.resaltar(page.getByText('Justificación', { exact: false }).first(), 2600)
      await a.clic(page.getByRole('navigation', { name: 'Pestañas del módulo' }).getByRole('link', { name: 'Requisiciones' }), 2200)
      await abrirFicha(page, a, fila(page, 'En selección'), 'Una fila abre la requisición: su impacto en la dotación y su ruta de aprobación, firma por firma.')
      await a.pausa(1500)
      await cerrarFicha(page, a)
      await cierre(a, 'Cada firma queda registrada con quién y cuándo; nada se aprueba fuera de la ruta.')
    },
  },
  {
    id: 'escenarios',
    titulo: 'Escenarios de la estructura',
    descripcion: 'Ensayar la estructura sin tocar la de hoy, compararla y mandarla a aprobar.',
    ruta: '/sistema/nucleo/escenarios',
    recurso: 'sistema:escenarios',
    async guion(page, a, { marcarInicio }) {
      marcarInicio()
      await a.portada(K, 'Escenarios', 'Ensayar la estructura sin tocar la de hoy')
      await a.quitarPortada()
      await a.sub('Un escenario es una copia de la estructura para diseñar cómo debería ser, sin tocar la realidad.')
      await a.sub('Cada uno dice sus altas, cierres, cambios y cuánto mueve la dotación, contra la realidad de su fecha base.', 600)
      await a.resaltar(page.locator('table').first(), 2600)
      await a.sub('«+ Nuevo escenario» arranca uno desde hoy.', 600)
      await a.resaltar(boton(page, /Nuevo escenario/), 2000)
      await abrirFicha(page, a, fila(page, 'Publicado'), 'Una fila abre su ficha; desde ahí, el lienzo en modo escenario, la comparación y el envío a aprobación.')
      await a.pausa(1500)
      await cerrarFicha(page, a)
      await a.sub('Cuando se aprueba, se publica con su fecha y pasa a ser la realidad desde ese día. Lo anterior queda en el historial.', 3600)
      await cierre(a, 'Así se discute una reestructuración con números, antes de hacerla.')
    },
  },
  {
    id: 'conciliacion',
    titulo: 'Conciliación de la estructura',
    descripcion: 'Lo que la carga no pudo decidir sola: se resuelve diciendo qué se corrigió.',
    ruta: '/sistema/nucleo/conciliacion',
    recurso: 'sistema:estructura',
    async guion(page, a, { marcarInicio }) {
      marcarInicio()
      await a.portada(K, 'Conciliación', 'Lo que la carga no pudo decidir sola')
      await a.quitarPortada()
      await a.sub('Al cargar la estructura, lo que no cuadraba quedó aquí: contradicciones entre fuentes, faltantes e inferencias.')
      await a.resaltar(bloque(page, 'Contradicciones'), 2200)
      await a.resaltar(bloque(page, 'Inferencias por confirmar'), 2000)
      await a.sub('Cada punto dice qué hay que decidir, y espera a Capital Humano o a Calidad.', 600)
      await escenaTabla(page, a, { buscar: 'dotación', textoBuscar: 'Busca un tema o una unidad.', corto: true })
      await abrirFicha(page, a, primeraFila(page), 'Una fila abre el punto. Se resuelve diciendo qué se corrigió, o se descarta con su motivo; todo queda registrado.')
      await a.pausa(1500)
      await cerrarFicha(page, a)
      await cierre(a, '«Más de 30 días abiertos» avisa lo que se está quedando sin atender.')
    },
  },
  {
    id: 'historial',
    titulo: 'Historial de la estructura',
    descripcion: 'Quién cambió qué y cuándo: nada se borra.',
    ruta: `${B}/historial`,
    recurso: 'sistema:auditoria',
    async guion(page, a, { marcarInicio }) {
      marcarInicio()
      await a.portada(K, 'Historial', 'Quién cambió qué y cuándo')
      await a.quitarPortada()
      await a.sub('El historial registra cada cambio en la estructura, el plan, las requisiciones y los escenarios.')
      await a.sub('Nada se borra: un cambio cierra la versión anterior y abre otra. Aquí ves cuándo, quién, qué y sobre qué objeto.', 600)
      await a.resaltar(page.locator('table').first(), 2800)
      await escenaTabla(page, a, { buscar: 'Requisición', textoBuscar: 'Filtra por objeto, persona o tipo de cambio.', corto: true })
      await a.sub('La columna «Cambio» dice qué pasó: el estado de antes y el de después, o lo que se dio de alta.', 600)
      await a.resaltar(page.locator('thead th').filter({ hasText: 'Cambio' }).first(), 2600)
      await cierre(a, 'Lo del perímetro de nómina aparece con su candado 🔒, solo para quien tiene el permiso.')
    },
  },
]
