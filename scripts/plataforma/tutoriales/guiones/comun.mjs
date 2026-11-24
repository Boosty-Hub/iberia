// Piezas comunes de los guiones: cómo encontrar una tarjeta, una fila o la ficha, y las escenas que se repiten.

/** La caja (tarjeta, panel, sección) que contiene un título. */
export const bloque = (page, texto, exacto = true) =>
  page
    .getByText(texto, { exact: exacto })
    .first()
    .locator("xpath=ancestor::*[self::section or self::article or contains(@class,'rounded-xl') or contains(@class,'rounded-2xl')][1]")

/** Una fila de la tabla que contiene un texto. */
export const fila = (page, texto) => page.locator('tbody tr').filter({ hasText: texto }).first()
export const primeraFila = (page) => page.locator('tbody tr').first()

export const boton = (page, nombre) => page.getByRole('button', { name: nombre }).or(page.getByRole('link', { name: nombre })).first()
export const panelFicha = (page) => page.locator('[data-ficha-objeto]').first()

/** Abre la ficha de una fila y la explica; deja la ficha abierta. */
export async function abrirFicha(page, a, filaLoc, texto) {
  await a.clic(filaLoc, 1600)
  await panelFicha(page).waitFor({ state: 'visible', timeout: 15000 })
  if (texto) await a.sub(texto)
}

/** Toca una pestaña dentro de la ficha abierta. */
export async function pestanaFicha(page, a, nombre, texto) {
  const p = panelFicha(page)
  const t = p.getByRole('tab', { name: nombre }).or(p.getByRole('button', { name: nombre })).first()
  await a.clic(t, 1200)
  if (texto) await a.sub(texto)
}

export async function cerrarFicha(page, a) {
  const cerrar = page.getByRole('button', { name: 'Cerrar la ficha (Esc)' }).first()
  if (await cerrar.isVisible().catch(() => false)) await a.clic(cerrar, 900)
}

/** La barra de la tabla: buscar, filtros, agrupar, columnas, vistas y CSV. */
export async function escenaTabla(page, a, { buscar, textoBuscar, corto = false } = {}) {
  const caja = page.getByRole('textbox', { name: 'Buscar en la tabla' }).first()
  if (buscar) {
    await a.sub(textoBuscar ?? 'Escribe en el buscador y la tabla se filtra al instante.', 800)
    await a.escribir(caja, buscar, 1800)
  }
  if (!corto) {
    await a.sub('Con «+ Filtro» acotas por cualquier columna; con «Agrupar», la tabla se ordena en grupos con sus totales.', 600)
    await a.resaltar(boton(page, /Filtro/), 1800)
    await a.resaltar(boton(page, /^Agrupar/), 1800)
    await a.sub('«Columnas» elige qué ver, «Vista» guarda esa combinación para volver a ella, y «CSV» la exporta tal cual.', 600)
    await a.resaltar(boton(page, /^Columnas/), 1500)
    await a.resaltar(boton(page, /^Vista/), 1500)
    await a.resaltar(boton(page, /CSV/), 1500)
  }
  if (buscar) {
    await a.escribir(caja, '', 700)
  }
}

/** Fin de capítulo: subtítulo de cierre y pausa. */
export async function cierre(a, texto) {
  await a.sub(texto, 3200)
  await a.sub('', 600)
}
