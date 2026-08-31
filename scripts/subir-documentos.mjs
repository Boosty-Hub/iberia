/**
 * Sube al módulo de archivos los documentos del expediente del programa.
 *
 *   node --env-file=.env.local scripts/subir-documentos.mjs
 *
 * Los documentos que gobiernan el encargo —la propuesta, el contrato, los
 * correos donde queda constancia de lo entregado— no pueden vivir solo en la
 * carpeta de descargas de alguien. El módulo de archivos es el expediente, y lo
 * que no esté ahí no existe cuando haga falta demostrarlo.
 *
 * Idempotente por `storage_path`: volver a correrlo reemplaza el binario y
 * actualiza la ficha, no duplica.
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'node:fs'
import { basename } from 'node:path'

const BUCKET = 'archivos'

/** Ruta local → ficha en el expediente. */
const DOCUMENTOS = [
  {
    ruta: 'C:/Users/gabri/Downloads/Boosty_Propuesta_Programa_IA_Iberia (3).pdf',
    nombre: 'Propuesta Técnica y Económica · Programa de Adopción de IA.pdf',
    descripcion:
      'Propuesta aprobada (julio 2026, 13 págs.). Define el alcance de las cuatro fases, ' +
      'las cuatro corrientes de la Fase 1, la tabla de entregables por mes, el modelo de ' +
      '107 horas y el licenciamiento de USD 60 por despliegue. Es el documento contra el ' +
      'que se mide lo que hay que entregar.',
    categoria: 'referencia',
    fase: 1,
  },
  {
    ruta: 'C:/Users/gabri/Downloads/Contrato_CONT-2026-08-0002_Industrias-Iberia.pdf',
    nombre: 'Contrato CONT-2026-08-0002 · Acuerdo de Partnership (firmado).pdf',
    descripcion:
      'Versión final y firmada el 7 de agosto de 2026. Sustituye a CONT-2026-07-0005. ' +
      'Firman Gabriel Andrés Montiel Toro por Boosty y Alberto García-Ramos Cortiñas por ' +
      'Iberia. La cláusula 5 nombra los entregables de cada fase; la 7, lo que Iberia debe ' +
      'aportar; la 8, la bolsa de 107 horas con reporte mensual de consumo.',
    categoria: 'referencia',
    fase: 1,
  },
  {
    ruta: 'C:/Users/gabri/Downloads/Correo de SPATIUM GROUP - Iberia — insumos para el comunicado y mapa narrativo de la campaña.pdf',
    nombre: 'Correo · Insumos para el comunicado y mapa narrativo.pdf',
    descripcion:
      'Constancia de la entrega de los insumos del comunicado oficial y del mapa narrativo ' +
      'a Fuguet Comunicación y Cambio. El plan de comunicación lo redacta Fuguet; lo de ' +
      'Boosty era pasar los insumos, y este correo es la prueba de que se pasaron.',
    categoria: 'comunicacion',
    fase: 1,
  },
  {
    ruta: 'C:/Users/gabri/Downloads/Correo de SPATIUM GROUP - El canal interno ya tiene diseño.pdf',
    nombre: 'Correo · El canal interno ya tiene diseño.pdf',
    descripcion:
      'Anuncio del canal de comunicación interna a la Gerencia General, con la propuesta de ' +
      'revisarlo junto a mercadeo antes de conectarlo a datos reales. Queda anunciado; ' +
      'todavía sin revisar y sin desplegar.',
    categoria: 'comunicacion',
    fase: 1,
  },
  {
    ruta: 'C:/Users/gabri/Downloads/LISTADO DE PERSONAL A JULIO 2026-SS  para enviar.xlsx',
    nombre: 'Listado de personal activo · julio 2026.xlsx',
    descripcion:
      'Padrón completo de Capital Humano: 276 personas (no ~280), una hoja, sin vacíos y con ' +
      'ficha única. Trae nombre, ficha, sexo, centro de costo, departamento, dirección, cargo ' +
      'y fecha de ingreso. ⚠️ NO trae cédula, teléfono, correo, sede ni turno — sin celular no ' +
      'hay enlace personal, así que hay que pedirle a Capital Humano un segundo archivo con ' +
      'cédula y celular por ficha. Reparto: 109 nómina diaria, 101 mensual, 38 ventas, 28 ' +
      'confidencial; 99 cargos distintos y 67 departamentos.',
    categoria: 'referencia',
    fase: 1,
    tipo: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  },
  {
    ruta: 'C:/Users/gabri/Downloads/Correo de SPATIUM GROUP - Sesión IA Petit Comité.pdf',
    nombre: 'Correo · Sesión IA Petit Comité (formación dirigente 1 de 3).pdf',
    descripcion:
      'Convocatoria de la primera de las tres formaciones presenciales, la del equipo ' +
      'directivo. Es el arranque de la Corriente C de la Fase 1.',
    categoria: 'formacion',
    fase: 1,
  },
]

// -----------------------------------------------------------------------------

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY,
  { auth: { persistSession: false } }
)

/** Nombre seguro para Storage: sin acentos, espacios ni signos. */
function ruta(categoria, nombre) {
  const limpio = nombre
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, '-')
    .replace(/^-|-$/g, '')
  return `${categoria}/${limpio}`
}

let subidos = 0

for (const d of DOCUMENTOS) {
  if (!existsSync(d.ruta)) {
    console.error(`\n✖ No se encontró: ${d.ruta}\n`)
    process.exit(1)
  }

  const binario = readFileSync(d.ruta)
  const destino = ruta(d.categoria, d.nombre)

  const { error: errorSubida } = await admin.storage
    .from(BUCKET)
    .upload(destino, binario, { contentType: d.tipo ?? 'application/pdf', upsert: true })

  if (errorSubida) {
    console.error(`\n✖ ${basename(d.ruta)}: ${errorSubida.message}\n`)
    process.exit(1)
  }

  const fila = {
    nombre: d.nombre,
    descripcion: d.descripcion,
    storage_path: destino,
    mime_type: d.tipo ?? 'application/pdf',
    tamano_bytes: binario.length,
    categoria: d.categoria,
    fase: d.fase,
    confidencial: true,
  }

  const { data: existente } = await admin
    .from('archivos')
    .select('id')
    .eq('storage_path', destino)
    .maybeSingle()

  const { error } = existente
    ? await admin.from('archivos').update(fila).eq('id', existente.id)
    : await admin.from('archivos').insert(fila)

  if (error) {
    console.error(`\n✖ ficha de ${d.nombre}: ${error.message}\n`)
    process.exit(1)
  }

  const kb = Math.round(binario.length / 1024)
  console.log(`  ${existente ? '~' : '+'} ${d.nombre}  (${kb} KB)`)
  subidos++
}

console.log(`\n${subidos} documentos en el expediente.\n`)
