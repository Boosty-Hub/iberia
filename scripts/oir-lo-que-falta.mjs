/**
 * Oye lo que el turno actual pide oír antes de dejar seguir.
 *
 * Desde el 27 de septiembre de 2026 el turno se abre a medida que se oye
 * (`TurnoProgresivo`): lo siguiente aparece al sonar la mitad del audio de antes.
 * Las verificaciones que recorren una lección tocando botones se quedaban sin
 * botón que tocar, así que antes de buscarlo llaman a esto.
 *
 * Busca el audio con la manito —el que toca oír—, lo pone a sonar **a 4×** y
 * espera a que marque `data-mitad="si"`. A 4× la mitad se sigue contando: el
 * reproductor suma lo que avanza entre dos `timeupdate`, y descarta los saltos
 * de más de un segundo y medio, que es como reconoce un arrastre de la barra.
 * Más rápido, lo tomaría por saltos y no abriría nada.
 */
export async function oirLoQueFalta(pagina, { maximo = 12 } = {}) {
  // Justo después de «Empezar» el turno todavía se está pintando: sin esperar,
  // no hay manito que encontrar y se sigue de largo sin oír nada.
  await pagina.locator('[data-estado]').first().waitFor({ timeout: 15000 }).catch(() => {})
  await pagina.waitForTimeout(400)

  for (let vuelta = 0; vuelta < maximo; vuelta++) {
    const n = await pagina
      .locator('[data-estado]')
      .evaluateAll((tarjetas) => tarjetas.findIndex((t) => t.querySelector('[data-manito]')))
    if (n < 0) return

    const tarjeta = pagina.locator('[data-estado]').nth(n)
    await tarjeta.locator('button').first().click()
    await pagina.waitForFunction(
      (i) => {
        const audio = document.querySelectorAll('[data-estado]')[i]?.querySelector('audio')
        return audio && !audio.paused && audio.currentTime > 0
      },
      n,
      { timeout: 30000 }
    )
    await tarjeta.evaluate((t) => {
      t.querySelector('audio').playbackRate = 4
    })
    await pagina.waitForFunction(
      (i) => document.querySelectorAll('[data-estado]')[i]?.getAttribute('data-mitad') === 'si',
      n,
      { timeout: 60000 }
    )
    await tarjeta.evaluate((t) => t.querySelector('audio').pause())
    await pagina.waitForTimeout(300)
  }
}
