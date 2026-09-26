import type { Metadata } from 'next'
import Link from 'next/link'
import { EncabezadoPagina, EstadoVacio, Insignia, Metrica } from '@/components/ui'
import { TablaPadron } from '@/components/padron/tabla-padron'
import { FAMILIAS_OFICIO, type FamiliaOficio } from '@/lib/adiestramiento'
import { requerirPermiso } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { estaLista, type Conexion } from '@/lib/whatsapp'
import { comoSeLee } from '@/lib/telefono'
import { resolverCorreccion } from './acciones'

export const metadata: Metadata = { title: 'Empleados' }

/**
 * El padrón, y desde aquí se enrola y se manda el enlace.
 *
 * Es la mesa de trabajo de las doscientas personas: quién está, quién tiene
 * teléfono, quién está matriculado, quién recibió su enlace y quién ha entrado
 * con él. Y las tres cosas que se hacen en lote, que son las que convierten un
 * listado en una herramienta:
 *
 *  1. **Matricular** a los seleccionados en el curso.
 *  2. **Acuñar el enlace personal** — que de paso les crea la cuenta a quienes
 *     no la tienen, porque el padrón de planta llega sin correo.
 *  3. **Mandarlo**: por WhatsApp si la conexión está encendida, y si no,
 *     copiándolo y marcándolo como mandado a mano. Que es lo de hoy.
 *
 * El filtro por «sin teléfono» no es un adorno: es la lista de a quién hay que
 * pedirle el número antes de poder empujarlo, y de eso depende que el curso
 * llegue al último eslabón.
 */
export default async function EmpleadosPage({
  searchParams,
}: PageProps<'/dashboard/empleados'>) {
  // La tabla es el padrón de trabajo —teléfonos, enlaces, matrícula— y su vista
  // solo responde a editores: se abre con «editar», que es lo que se hace aquí.
  await requerirPermiso('modulo:empleados', 'editar')
  const filtros = await searchParams
  const supabase = await createClient()

  const buscar = String(filtros.q ?? '').trim()
  const nivel = String(filtros.nivel ?? '')
  const falta = String(filtros.falta ?? '')

  let consulta = supabase.from('padron_estado').select('*').order('nombre_completo')

  if (buscar) consulta = consulta.ilike('nombre_completo', `%${buscar}%`)
  if (nivel) consulta = consulta.eq('nivel', nivel)

  const [{ data: padron }, { data: conexion }, { data: correcciones }] = await Promise.all([
    consulta,
    supabase.from('ajustes_whatsapp').select('*').eq('id', true).maybeSingle(),
    // Lo que la gente corrigió de su ficha con «No soy yo» en la lección 0.
    supabase
      .from('correcciones_padron')
      .select('id, nombre, area, nombre_padron, cargo_padron, area_padron, created_at')
      .is('resuelta_en', null)
      .order('created_at'),
  ])

  const todos = padron ?? []

  // Los filtros de «qué le falta» se aplican aquí y no en la consulta porque son
  // combinaciones de columnas calculadas de la vista, y en SQL quedarían menos
  // legibles que esto. Doscientas filas caben de sobra en memoria.
  const gente = todos.filter((p) => {
    if (falta === 'matricula') return !p.matricula_id
    if (falta === 'telefono') return !p.telefono
    if (falta === 'enlace') return !p.acceso_expira
    if (falta === 'envio') return Boolean(p.acceso_expira) && !p.acceso_enviado
    if (falta === 'sin-entrar') return Boolean(p.acceso_enviado) && (p.acceso_usos ?? 0) === 0
    return true
  })

  const activos = todos.filter((p) => p.activo)
  const conTelefono = activos.filter((p) => p.telefono).length
  const matriculados = activos.filter((p) => p.matricula_id).length
  const conEnlace = activos.filter((p) => p.acceso_enviado).length

  const whatsappListo = estaLista(conexion as Conexion | null) && Boolean(conexion?.activo)

  return (
    <>
      <EncabezadoPagina
        rotulo="Padrón"
        titulo="Empleados"
        descripcion={
          <>
            Las personas de Industrias Iberia, y desde aquí se les abre el curso y se
            les manda su enlace. <strong>El enlace es la credencial</strong>: quien lo
            recibe entra sin usuario y sin clave, así que no se comparte.
          </>
        }
        acciones={
          <div className="flex items-center gap-2">
            <Insignia tono={whatsappListo ? 'acento' : 'neutro'}>
              {whatsappListo ? 'WhatsApp encendido' : 'WhatsApp sin conectar'}
            </Insignia>
            <Link href="/dashboard/adiestramiento/recordatorios" className="btn-neutro">
              El empujón
            </Link>
          </div>
        }
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-4">
        <Metrica valor={activos.length} etiqueta="En el padrón" />
        <Metrica valor={conTelefono} etiqueta="Con teléfono" />
        <Metrica valor={matriculados} etiqueta="Matriculados" />
        <Metrica valor={conEnlace} etiqueta="Con su enlace mandado" />
      </div>

      {conTelefono < activos.length && (
        <p className="tarjeta mb-6 px-5 py-4 text-sm text-marca-600">
          Hay <strong>{activos.length - conTelefono}</strong> persona
          {activos.length - conTelefono === 1 ? '' : 's'} sin teléfono en el padrón. Sin
          número no hay por dónde mandarles el enlace —
          <Link href="?falta=telefono" className="underline">
            {' '}
            ver quiénes son
          </Link>
          .
        </p>
      )}

      {(correcciones ?? []).length > 0 && (
        <section className="tarjeta mb-6 px-5 py-4" data-correcciones-padron>
          <h2 className="text-sm font-semibold text-marca-900">
            Para Capital Humano · {correcciones!.length}{' '}
            {correcciones!.length === 1 ? 'ficha corregida' : 'fichas corregidas'}
          </h2>
          <p className="mt-1 text-sm text-marca-500">
            Dijeron «No soy yo» en la lección 0 y escribieron cómo se llaman. El padrón no
            cambia solo: se le pasa a Capital Humano y, cuando lo corrija, vuelve con{' '}
            <code>importar:padron</code>.
          </p>
          <ul className="mt-3 divide-y divide-marca-100">
            {correcciones!.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-x-6 gap-y-2 py-3">
                <div className="min-w-56 flex-1 text-sm">
                  <p className="text-marca-500">
                    En el padrón:{' '}
                    <span className="text-marca-800">
                      {[c.nombre_padron, c.cargo_padron, c.area_padron].filter(Boolean).join(' · ')}
                    </span>
                  </p>
                  <p className="text-marca-500">
                    Escribió:{' '}
                    <strong className="text-marca-900">
                      {[c.nombre, c.area].filter(Boolean).join(' · ')}
                    </strong>
                  </p>
                </div>
                <span className="text-xs text-marca-400">
                  {new Date(c.created_at).toLocaleDateString('es-VE', {
                    day: 'numeric',
                    month: 'short',
                    timeZone: 'America/Caracas',
                  })}
                </span>
                <form action={resolverCorreccion}>
                  <input type="hidden" name="id" value={c.id} />
                  <button type="submit" className="btn-neutro">
                    Ya se le pasó
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ------------------------------------------------------------------ */}
      <form method="get" className="tarjeta mb-4 flex flex-wrap items-end gap-3 p-4">
        <div className="min-w-48 flex-1">
          <label htmlFor="q" className="rotulo">
            Buscar
          </label>
          <input id="q" name="q" defaultValue={buscar} className="campo w-full" placeholder="Nombre" />
        </div>
        <div>
          <label htmlFor="nivel" className="rotulo">
            Nivel
          </label>
          <select id="nivel" name="nivel" defaultValue={nivel} className="campo">
            <option value="">Todos</option>
            {['planta', 'administrativo', 'jefatura', 'gerencia', 'direccion'].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="falta" className="rotulo">
            Le falta
          </label>
          <select id="falta" name="falta" defaultValue={falta} className="campo">
            <option value="">Nada en particular</option>
            <option value="telefono">Teléfono</option>
            <option value="matricula">Matrícula</option>
            <option value="enlace">Enlace acuñado</option>
            <option value="envio">Mandarle el enlace</option>
            <option value="sin-entrar">No ha entrado nunca</option>
          </select>
        </div>
        <button type="submit" className="btn-neutro">
          Filtrar
        </button>
        {(buscar || nivel || falta) && (
          <Link href="/dashboard/empleados" className="text-sm text-marca-500 underline">
            Quitar filtros
          </Link>
        )}
      </form>

      {/* ------------------------------------------------------------------ */}
      {gente.length === 0 ? (
        <EstadoVacio
          titulo="No hay nadie con esos filtros"
          descripcion="Prueba a quitarlos, o revisa que el padrón esté cargado."
        />
      ) : (
        <TablaPadron
          gente={gente.map((p) => ({
            id: p.id ?? '',
            nombre: p.nombre_completo ?? '',
            cedula: p.cedula ?? '',
            cargo: p.cargo,
            area: p.area_nombre,
            nivel: p.nivel ?? '',
            telefono: comoSeLee(p.telefono) ?? p.telefono,
            activo: p.activo ?? false,
            familia: FAMILIAS_OFICIO[(p.familia_oficio ?? 'generico') as FamiliaOficio],
            matriculado: Boolean(p.matricula_id),
            leccionesHechas: p.lecciones_hechas ?? 0,
            tieneEnlace: Boolean(p.acceso_expira && new Date(p.acceso_expira) > new Date()),
            enlaceMandado: Boolean(p.acceso_enviado),
            entradas: p.acceso_usos ?? 0,
          }))}
          whatsappListo={whatsappListo}
        />
      )}
    </>
  )
}
