/**
 * Constantes de Supabase Storage.
 *
 * Vive aparte de las server actions a propósito: un módulo `'use server'` solo
 * puede exportar funciones async, así que una constante compartida lo rompería.
 */

/** Bucket privado del módulo de archivos. */
export const BUCKET_ARCHIVOS = 'archivos'
