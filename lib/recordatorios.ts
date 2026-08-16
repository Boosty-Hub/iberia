import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * El empujón.
 *
 * El curso es a su ritmo y los gerentes piden que avancen. Entre esas dos cosas
 * hay un hueco: doscientas personas que empiezan la lección 0 un martes y no
 * vuelven. Esto es la escalera de recordatorios que lo tapa.
 *
 * **Los textos están en `contenido/adiestramiento/recordatorios.md`**, no aquí.
 * Es la misma regla que con los audios y las fichas: lo que Ajito dice se
 * escribe en el guion y el código lo presenta. Cambiar «epa» por «hola» no
 * debería exigir tocar un archivo `.ts`.
 *
 * La regla propia de estos mensajes, y la que separa un empujón de una
 * molestia: **no se reclama**. Nadie tiene que explicar por qué no ha vuelto.
 */

const ARCHIVO = join(process.cwd(), 'contenido/adiestramiento/recordatorios.md')

export type Escalon = {
  /** Días de silencio a partir de los cuales toca. */
  dias: number
  /** El texto con sus `{piezas}` sin rellenar. */
  plantilla: string
}

export type Relleno = {
  nombre: string
  hechas: number
  faltan: number
  siguiente: string
  enlace: string
}

/**
 * La escalera, leída del guion.
 *
 * Cada `## Escalón N · …` con su cita debajo. Se ordena por días porque el orden
 * del archivo es cosa de quien lo escribe, y de esto depende cuál se manda.
 */
export function escalera(markdown = leerArchivo()): Escalon[] {
  const lineas = markdown.replace(/\r\n?/g, '\n').split('\n')
  const escalones: Escalon[] = []

  for (let i = 0; i < lineas.length; i++) {
    const cabecera = lineas[i].match(/^##\s+Escalón\s+(\d+)\b/)
    if (!cabecera) continue

    // La primera cita después de la cabecera. Entre medias puede haber una
    // cursiva de producción, que no llega a nadie.
    let j = i + 1
    while (j < lineas.length && !lineas[j].startsWith('>') && !lineas[j].startsWith('##')) j++
    if (j >= lineas.length || !lineas[j].startsWith('>')) continue

    const cita: string[] = []
    while (j < lineas.length && lineas[j].startsWith('>')) {
      cita.push(lineas[j].replace(/^>\s?/, ''))
      j++
    }

    escalones.push({
      dias: Number(cabecera[1]),
      plantilla: cita.join('\n').trim(),
    })
  }

  return escalones.sort((a, b) => a.dias - b.dias)
}

/**
 * Qué escalón le toca a alguien, o `null` si ninguno.
 *
 * Se devuelve **el más alto ya vencido**, no todos los vencidos: quien lleva
 * veinte días callado recibe el de los 13 y ya. Despertarse un lunes con cuatro
 * mensajes seguidos de Ajito es la forma más rápida de que alguien silencie la
 * conversación.
 */
export function escalonQueToca(
  dias: number,
  ultimoEnviado: number | null,
  pasos = escalera()
): Escalon | null {
  const vencidos = pasos.filter((e) => dias >= e.dias)
  if (!vencidos.length) return null

  const alto = vencidos[vencidos.length - 1]
  // Ya se le mandó ese o uno más alto: no hay nada nuevo que decirle.
  if (ultimoEnviado !== null && ultimoEnviado >= alto.dias) return null

  return alto
}

/** Rellena las piezas. Lo que no venga se queda como está, y se ve. */
export function redactar(plantilla: string, relleno: Relleno): string {
  return plantilla
    .replaceAll('{nombre}', relleno.nombre)
    .replaceAll('{hechas}', String(relleno.hechas))
    .replaceAll('{faltan}', String(relleno.faltan))
    .replaceAll('{siguiente}', relleno.siguiente)
    .replaceAll('{enlace}', relleno.enlace)
}

/**
 * El guion se lee del disco en cada llamada a propósito.
 *
 * Son cuatro párrafos y se leen en microsegundos; a cambio, quien corrige una
 * coma la ve en el panel al recargar, sin reiniciar nada. Si algún día esto
 * pesa, se cachea — hoy sería optimizar lo que no duele.
 */
function leerArchivo(): string {
  return readFileSync(ARCHIVO, 'utf8')
}
