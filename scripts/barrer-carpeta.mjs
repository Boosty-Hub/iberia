/**
 * Borra los archivos de la carpeta de un empleado en el bucket de respuestas:
 * sus fotos, notas de voz, dibujos y los audios de las devoluciones.
 *
 * Lo llaman las verificaciones al borrar sus fichas de prueba. Borrar la ficha
 * se lleva en cascada las filas, pero no los archivos: hasta el 27 de septiembre
 * de 2026 se habían quedado 115 sueltos en 101 carpetas, sin nada que los
 * nombrara. `probar:supabase` avisa si vuelve a quedar alguna.
 */

export const BUCKET_RESPUESTAS = 'adiestramiento-respuestas'

export async function barrerCarpeta(admin, empleadoId) {
  const raiz = `respuestas/${empleadoId}`
  const { data: carpetas } = await admin.storage.from(BUCKET_RESPUESTAS).list(raiz, { limit: 100 })
  const rutas = []
  for (const carpeta of carpetas ?? []) {
    const { data: dentro } = await admin.storage
      .from(BUCKET_RESPUESTAS)
      .list(`${raiz}/${carpeta.name}`, { limit: 100 })
    for (const objeto of dentro ?? []) rutas.push(`${raiz}/${carpeta.name}/${objeto.name}`)
  }
  if (rutas.length) await admin.storage.from(BUCKET_RESPUESTAS).remove(rutas)
  return rutas.length
}
