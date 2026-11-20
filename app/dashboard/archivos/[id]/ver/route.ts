import { NextResponse, type NextRequest } from 'next/server'

/** La previa del archivo se mudó a `/sistema/programa/levantamiento/archivos/[id]/ver` (20-nov-2026). Allá se exige la sesión y la casilla. */
export async function GET(peticion: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: 'Archivo no encontrado' }, { status: 404 })
  return NextResponse.redirect(new URL(`/sistema/programa/levantamiento/archivos/${id}/ver`, peticion.url), 307)
}
