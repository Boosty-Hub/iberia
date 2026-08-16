import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { EncabezadoPagina, EstadoVacio, Insignia, Metrica } from '@/components/ui'
import {
  CURSO,
  FAMILIA_DESCRIPCION,
  FAMILIAS_OFICIO,
  FAMILIAS_ORDEN,
  type FamiliaOficio,
} from '@/lib/adiestramiento'
import { esEditor, requerirSesion } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { guardarConfiguracion, matricularPendientes } from './acciones'

export const metadata: Metadata = { title: 'Adiestramiento' }

export default async function AdiestramientoAdminPage() {
  const { perfil } = await requerirSesion()
  const puedeEditar = esEditor(perfil)
  const supabase = await createClient()

  const { data: curso } = await supabase
    .from('cursos')
    .select('*')
    .eq('clave', CURSO)
    .maybeSingle()

  if (!curso) {
    return (
      <EstadoVacio
        titulo="El curso no está sembrado"
        descripcion="Falta aplicar la migración 20260816120000_adiestramiento.sql."
      />
    )
  }

  const [{ data: avance }, { data: lecciones }, { count: elegibles }] = await Promise.all([
    supabase.from('adiestramiento_avance').select('*').eq('curso_id', curso.id),
    supabase
      .from('lecciones')
      .select('numero, titulo, activa')
      .eq('curso_id', curso.id)
      .order('numero'),
    supabase
      .from('empleados')
      .select('id', { count: 'exact', head: true })
      .eq('activo', true)
      .in('nivel', ['planta', 'administrativo']),
  ])

  const filas = avance ?? []
  const suma = (campo: 'matriculados' | 'completados' | 'en_curso' | 'sin_empezar') =>
    filas.reduce((t, f) => t + (f[campo] ?? 0), 0)

  const matriculados = suma('matriculados')
  const completados = suma('completados')
  const sinMatricular = (elegibles ?? 0) - matriculados

  // Por oficio, que es como bifurcan los ejercicios. `generico` arriba a
  // propósito: es la cola que hay que ir vaciando conforme llegue la lista de
  // cargos de Capital Humano.
  const porFamilia = FAMILIAS_ORDEN.map((familia) => {
    const suyas = filas.filter((f) => f.familia_oficio === familia)
    return {
      familia,
      matriculados: suyas.reduce((t, f) => t + (f.matriculados ?? 0), 0),
      completados: suyas.reduce((t, f) => t + (f.completados ?? 0), 0),
      enCurso: suyas.reduce((t, f) => t + (f.en_curso ?? 0), 0),
    }
  }).filter((f) => f.matriculados > 0)

  const porArea = [...filas]
    .reduce<Map<string, { nombre: string; matriculados: number; completados: number }>>(
      (mapa, f) => {
        const clave = f.area_id ?? 'sin-area'
        const actual = mapa.get(clave) ?? {
          nombre: f.area_nombre ?? 'Sin área asignada',
          matriculados: 0,
          completados: 0,
        }
        actual.matriculados += f.matriculados ?? 0
        actual.completados += f.completados ?? 0
        mapa.set(clave, actual)
        return mapa
      },
      new Map()
    )
    .values()

  const areas = [...porArea].sort((a, b) => b.matriculados - a.matriculados)

  return (
    <>
      <EncabezadoPagina
        rotulo="Nuevo Sabor"
        titulo="Adiestramiento en IA"
        descripcion={
          <>
            El curso de Ajito por el teléfono, para el personal que no va a las
            tres formaciones presenciales. El guion completo vive en{' '}
            <code className="rounded bg-marca-100 px-1.5 py-0.5 text-[13px]">
              contenido/adiestramiento/
            </code>
            .
          </>
        }
        acciones={
          <div className="flex items-center gap-2">
            <Insignia tono={curso.abierto ? 'acento' : 'neutro'}>
              {curso.abierto ? 'Abierto' : 'Cerrado'}
            </Insignia>
            <Insignia tono="neutro">
              {curso.asistente_libre_activo
                ? 'Asistente libre encendido'
                : 'Asistente libre apagado'}
            </Insignia>
            <Link href="/dashboard/adiestramiento/recordatorios" className="btn-neutro">
              El empujón
            </Link>
            <Link href="/dashboard/adiestramiento/certificados" className="btn-neutro">
              Certificados
            </Link>
          </div>
        }
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-4">
        <Metrica valor={elegibles ?? 0} etiqueta="Personas que le tocan" />
        <Metrica valor={matriculados} etiqueta="Con matrícula" />
        <Metrica valor={suma('en_curso')} etiqueta="Avanzando" />
        <Metrica valor={completados} etiqueta="Terminaron" />
      </div>

      {/* ------------------------------------------------------------------ */}
      {puedeEditar && (
        <section className="tarjeta mb-6 p-5">
          <h2 className="text-base font-semibold text-marca-900">Configuración</h2>

          <form action={guardarConfiguracion} className="mt-4 space-y-4">
            <Interruptor
              nombre="abierto"
              activo={curso.abierto}
              titulo="El curso está abierto"
              detalle="Mientras esté cerrado nadie entra, aunque tenga matrícula. Sirve para dejar todo listo y abrir el mismo día para todos."
            />

            <Interruptor
              nombre="asistente_libre"
              activo={curso.asistente_libre_activo}
              titulo="Ajito se queda después del curso"
              detalle="Encendido, aparece el botón de «pregúntale lo que sea» y la última lección se despide distinto: Ajito se queda en vez de irse. Apagado, el curso son las nueve lecciones y cierra con el certificado. No es un detalle de configuración — cambia lo que el curso promete."
            />

            <div className="flex flex-wrap gap-2 border-t border-[var(--borde)] pt-4">
              <button type="submit" className="btn-acento">
                Guardar
              </button>
              <button
                type="submit"
                formAction={matricularPendientes}
                className="btn-neutro"
              >
                Matricular a los que faltan
                {sinMatricular > 0 && ` (${sinMatricular})`}
              </button>
            </div>
          </form>

          {sinMatricular > 0 && (
            <p className="mt-3 text-[13px] text-marca-500">
              Hay {sinMatricular} persona{sinMatricular > 1 ? 's' : ''} de planta
              o administración en el padrón sin matrícula. Matricular es
              idempotente: se puede correr cada vez que Capital Humano complete
              el padrón.
            </p>
          )}
        </section>
      )}

      {/* ------------------------------------------------------------------ */}
      {matriculados === 0 ? (
        <EstadoVacio
          titulo="Todavía no hay nadie matriculado"
          descripcion="Cuando llegue el padrón real de Capital Humano, matricular abre el cupo a todo el personal de planta y administrativo."
        />
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <section className="tarjeta overflow-hidden">
            <div className="border-b border-[var(--borde)] px-5 py-4">
              <h2 className="text-base font-semibold text-marca-900">Por oficio</h2>
              <p className="mt-1 text-[13px] text-marca-500">
                Es como bifurcan los ejercicios. Lo que caiga en «General» recibe
                el ejercicio genérico — que no es el descarte, pero conviene ir
                vaciando esa cola.
              </p>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-marca-50 text-left text-[12px] text-marca-500 uppercase">
                <tr>
                  <th className="px-5 py-2.5 font-semibold">Oficio</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Son</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Van</th>
                  <th className="px-5 py-2.5 text-right font-semibold">Listos</th>
                </tr>
              </thead>
              <tbody>
                {porFamilia.map((f) => (
                  <tr key={f.familia} className="border-t border-[var(--borde)]">
                    <td className="px-5 py-3">
                      <p className="font-medium text-marca-900">
                        {FAMILIAS_OFICIO[f.familia as FamiliaOficio]}
                      </p>
                      <p className="mt-0.5 text-[12px] leading-snug text-marca-500">
                        {FAMILIA_DESCRIPCION[f.familia as FamiliaOficio]}
                      </p>
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">{f.matriculados}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{f.enCurso}</td>
                    <td className="px-5 py-3 text-right font-semibold tabular-nums">
                      {f.completados}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="tarjeta overflow-hidden">
            <div className="border-b border-[var(--borde)] px-5 py-4">
              <h2 className="text-base font-semibold text-marca-900">Por área</h2>
              <p className="mt-1 text-[13px] text-marca-500">
                Avance, sin una sola respuesta. Es lo que puede ver una gerencia
                para empujar a su gente sin leer lo que su gente contestó.
              </p>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-marca-50 text-left text-[12px] text-marca-500 uppercase">
                <tr>
                  <th className="px-5 py-2.5 font-semibold">Área</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Son</th>
                  <th className="px-5 py-2.5 text-right font-semibold">Listos</th>
                </tr>
              </thead>
              <tbody>
                {areas.map((a) => (
                  <tr key={a.nombre} className="border-t border-[var(--borde)]">
                    <td className="px-5 py-3 text-marca-900">{a.nombre}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{a.matriculados}</td>
                    <td className="px-5 py-3 text-right font-semibold tabular-nums">
                      {a.completados}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      <section className="tarjeta mt-6 p-5">
        <div className="flex items-start gap-4">
          <Image
            src="/marca/ajito.png"
            alt="Ajito"
            width={200}
            height={200}
            className="h-16 w-16 shrink-0 object-contain"
          />
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-marca-900">
              Las nueve lecciones
            </h2>
            <p className="mt-1 text-[13px] text-marca-500">
              Cada una es una forma distinta en que la IA puede actuar.
            </p>
            <ol className="mt-3 grid gap-x-6 gap-y-1 text-sm text-marca-700 sm:grid-cols-2">
              {(lecciones ?? []).map((l) => (
                <li key={l.numero} className="flex gap-2">
                  <span className="w-4 shrink-0 text-right tabular-nums text-marca-400">
                    {l.numero}
                  </span>
                  <span className={l.activa ? '' : 'text-marca-400 line-through'}>
                    {l.titulo}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      <p className="mt-6 text-[13px] leading-relaxed text-marca-500">
        Lo que la gente le responde a Ajito no lo ve su supervisor ni quien
        modera el canal: la RLS solo deja leerlo a su autor y a los editores de
        Boosty. Ajito lo promete en la lección 0 y el esquema lo cumple.
      </p>
    </>
  )
}

function Interruptor({
  nombre,
  activo,
  titulo,
  detalle,
}: {
  nombre: string
  activo: boolean
  titulo: string
  detalle: string
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-[var(--borde)] p-4 transition-colors hover:bg-marca-50">
      <input
        type="checkbox"
        name={nombre}
        value="si"
        defaultChecked={activo}
        className="mt-0.5 h-5 w-5 shrink-0 rounded accent-[var(--acento-600,#c0281f)]"
      />
      <span className="min-w-0">
        <span className="block text-sm font-medium text-marca-900">{titulo}</span>
        <span className="mt-1 block text-[13px] leading-relaxed text-marca-500">
          {detalle}
        </span>
      </span>
    </label>
  )
}
