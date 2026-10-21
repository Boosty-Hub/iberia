import type { Encabezado } from '@/lib/encabezados'

/**
 * El `##` del cronograma de la Nueva Iberia (`components/gantt-nueva-iberia.tsx`), para el
 * índice «En esta sección» de la 09. Vive aparte porque el cronograma es un componente de
 * cliente, y lo que exporta un módulo `'use client'` le llega a la página del servidor como
 * referencia, no como el arreglo: el índice se rompía al iterarlo.
 */
export const ENCABEZADOS_GANTT: Encabezado[] = [{ id: 'la-nueva-iberia-en-el-tiempo', texto: 'La Nueva Iberia, en el tiempo' }]
