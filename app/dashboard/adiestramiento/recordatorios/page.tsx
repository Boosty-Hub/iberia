import type { Metadata } from 'next'
import Link from 'next/link'
import { EncabezadoPagina, EstadoVacio, Insignia, Metrica } from '@/components/ui'
import { CopiarMensaje } from '@/components/copiar-mensaje'
import { CURSO } from '@/lib/adiestramiento'
import { esAdmin, requerirEditor } from '@/lib/auth'
import { escalera } from '@/lib/recordatorios'
import { createClient } from '@/lib/supabase/server'
import { estaLista, type Conexion } from '@/lib/whatsapp'
import {
  guardarWhatsapp,
  mandarPorWhatsapp,
  marcarAMano,
  prepararRecordatorios,
  probarWhatsapp,
} from './acciones'

export const metadata: Metadata = { title: 'Recordatorios' }

/**
 * El empujón, y la conexión con WhatsApp.
 *
 * Están en la misma página porque son la misma decisión: a quién hay que
 * insistirle y por dónde. Y porque hoy la segunda mitad no existe —la cuenta de
 * WhatsApp Business está pedida y va a tardar—, así que hay que ver de un
 * vistazo que **el empujón funciona igual sin ella**: los mensajes se preparan,
 * se copian y alguien los manda desde su teléfono.
 */
export default async function RecordatoriosPage() {
  const { perfil } = await requerirEditor()
  const puedeConfigurar = esAdmin(perfil)
  const supabase = await createClient()

  const { data: curso } = await supabase
    .from('cursos')
    .select('id, abierto')
    .eq('clave', CURSO)
    .maybeSingle()

  const [{ data: conexion }, { data: pendientes }, { data: recordatorios }] = await Promise.all([
    supabase.from('ajustes_whatsapp').select('*').eq('id', true).maybeSingle(),
    supabase
      .from('recordatorios_pendientes')
      .select('*')
      .eq('curso_id', curso?.id ?? '')
      .order('dias', { ascending: false }),
    supabase
      .from('recordatorios')
      .select('*, matriculas(nombre_corto, empleados(nombre_completo, telefono, cargo))')
      .order('created_at', { ascending: false })
      .limit(200),
  ])

  const pasos = escalera()
  const filas = recordatorios ?? []
  const preparados = filas.filter((r) => r.estado === 'preparado')
  const enviados = filas.filter((r) => r.estado === 'enviado')
  const fallidos = filas.filter((r) => r.estado === 'fallido')

  const lista = estaLista(conexion as Conexion | null)
  const encendida = lista && Boolean(conexion?.activo)

  // Cuánta gente lleva días callada, por escalón. Es la foto que dice si el
  // curso está corriendo o parado.
  const porEscalon = pasos.map((paso, i) => {
    const techo = pasos[i + 1]?.dias ?? Infinity
    return {
      dias: paso.dias,
      gente: (pendientes ?? []).filter((p) => (p.dias ?? 0) >= paso.dias && (p.dias ?? 0) < techo)
        .length,
    }
  })

  return (
    <>
      <EncabezadoPagina
        rotulo="Nuevo Sabor"
        titulo="El empujón"
        descripcion={
          <>
            A quién hay que insistirle para que termine el curso, y por dónde. Los
            textos están en{' '}
            <code className="rounded bg-marca-100 px-1.5 py-0.5 text-[13px]">
              contenido/adiestramiento/recordatorios.md
            </code>{' '}
            — se cambian ahí, no aquí.
          </>
        }
        acciones={
          <div className="flex items-center gap-2">
            <Insignia tono={encendida ? 'acento' : 'neutro'}>
              {encendida ? 'WhatsApp encendido' : 'WhatsApp sin conectar'}
            </Insignia>
            <Link href="/dashboard/adiestramiento" className="btn-neutro">
              El adiestramiento
            </Link>
          </div>
        }
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-4">
        <Metrica valor={pendientes?.length ?? 0} etiqueta="Sin terminar el curso" />
        <Metrica valor={preparados.length} etiqueta="Mensajes listos" />
        <Metrica valor={enviados.length} etiqueta="Ya mandados" />
        <Metrica valor={fallidos.length} etiqueta="Fallaron" />
      </div>

      {!curso?.abierto && (
        <p className="tarjeta mb-6 px-5 py-4 text-sm text-marca-600">
          El curso está cerrado, así que no hay a quién empujar. Ábrelo desde{' '}
          <Link href="/dashboard/adiestramiento" className="underline">
            el adiestramiento
          </Link>
          .
        </p>
      )}

      {/* ------------------------------------------------------------------ */}
      <section className="tarjeta mb-6 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-marca-900">La escalera</h2>
            <p className="mt-1 text-[13px] text-marca-500">
              Se manda el escalón más alto vencido, no todos. Quien lleva veinte días
              callado recibe el de los {pasos[pasos.length - 1]?.dias ?? 13} y ya.
            </p>
          </div>
          <form action={prepararRecordatorios}>
            <button type="submit" className="btn-acento">
              Preparar los de hoy
            </button>
          </form>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-4">
          {porEscalon.map((e) => (
            <div key={e.dias} className="rounded-xl border border-[var(--borde)] px-4 py-3">
              <p className="text-2xl font-bold text-marca-900 tabular-nums">{e.gente}</p>
              <p className="text-[13px] text-marca-500">
                {e.dias}+ días callado{e.gente === 1 ? '' : 's'}
              </p>
            </div>
          ))}
        </div>

        <p className="mt-3 text-[13px] text-marca-500">
          Preparar deja el texto escrito con el nombre de cada quien, para poder leerlo
          antes de que salga. Doscientos mensajes con una errata no se recogen.
        </p>
      </section>

      {/* ------------------------------------------------------------------ */}
      {puedeConfigurar && (
        <section className="tarjeta mb-6 p-5">
          <h2 className="text-base font-semibold text-marca-900">La conexión con WhatsApp</h2>
          <p className="mt-1 text-[13px] text-marca-500">
            De la cuenta de WhatsApp Business, en la consola de Meta. Mientras no esté,
            los mensajes se copian de la lista de abajo y se mandan a mano — el empujón
            no espera a la integración.
          </p>

          <form action={guardarWhatsapp} className="mt-4 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Campo
                nombre="id_numero"
                rotulo="Identificador del número"
                ayuda="Phone Number ID, en la consola de Meta"
                valor={conexion?.id_numero ?? ''}
              />
              <Campo
                nombre="plantilla"
                rotulo="Plantilla aprobada"
                ayuda="Meta no deja escribir libre a quien lleva días callado"
                valor={conexion?.plantilla ?? ''}
              />
              <Campo
                nombre="numero_visible"
                rotulo="Número que ve la gente"
                ayuda="Solo para mostrarlo aquí"
                valor={conexion?.numero_visible ?? ''}
              />
              <div>
                <label htmlFor="token" className="rotulo">
                  Token permanente
                </label>
                <input
                  id="token"
                  name="token"
                  type="password"
                  autoComplete="off"
                  className="campo w-full"
                  placeholder={conexion?.token ? 'Guardado · escribe uno nuevo para cambiarlo' : ''}
                />
                <p className="mt-1 text-[12px] text-marca-400">
                  {/* No se pinta de vuelta ni enmascarado: un token en pantalla es un
                      token en una captura de pantalla. */}
                  No se muestra nunca. Déjalo vacío para no cambiarlo.
                </p>
              </div>
            </div>

            <label className="flex items-start gap-3 border-t border-[var(--borde)] pt-4">
              <input
                type="checkbox"
                name="activo"
                value="si"
                defaultChecked={conexion?.activo ?? false}
                className="mt-1 h-4 w-4"
              />
              <span>
                <span className="block text-sm font-medium text-marca-900">
                  Mandar por WhatsApp
                </span>
                <span className="block text-[13px] text-marca-500">
                  Apagado, los mensajes se preparan igual y se mandan a mano. Enciéndelo
                  solo cuando la prueba de aquí abajo salga bien.
                </span>
              </span>
            </label>

            <div className="flex flex-wrap items-center gap-2 border-t border-[var(--borde)] pt-4">
              <button type="submit" className="btn-acento">
                Guardar
              </button>
              <button type="submit" formAction={probarWhatsapp} className="btn-neutro">
                Probar la conexión
              </button>
              {conexion?.probado_en && (
                <span className="text-[13px] text-marca-500">
                  {conexion.probado_ok ? '✓' : '✖'} {conexion.probado_detalle}
                </span>
              )}
            </div>
          </form>
        </section>
      )}

      {/* ------------------------------------------------------------------ */}
      <section className="tarjeta overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--borde)] px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-marca-900">Los mensajes</h2>
            <p className="mt-1 text-[13px] text-marca-500">
              Copia el texto, mándalo desde tu teléfono y márcalo. Lo que se manda queda
              guardado tal cual salió.
            </p>
          </div>
          {encendida && preparados.length > 0 && (
            <form action={mandarPorWhatsapp}>
              <button type="submit" className="btn-acento">
                Mandar los {preparados.length} por WhatsApp
              </button>
            </form>
          )}
        </div>

        {filas.length === 0 ? (
          <EstadoVacio
            titulo="Todavía no hay ninguno"
            descripcion="Cuando alguien lleve dos días sin volver al curso, prepararlos lo trae aquí con su mensaje escrito."
          />
        ) : (
          <ul className="divide-y divide-[var(--borde)]">
            {filas.map((fila) => {
              const matricula = fila.matriculas as {
                nombre_corto: string | null
                empleados: {
                  nombre_completo: string
                  telefono: string | null
                  cargo: string | null
                } | null
              } | null
              const persona = matricula?.empleados

              return (
                <li key={fila.id} className="px-5 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-marca-900">
                        {persona?.nombre_completo ?? 'Sin nombre'}
                      </p>
                      <p className="text-[13px] text-marca-500">
                        {persona?.cargo ?? 'Sin cargo'}
                        {persona?.telefono ? ` · ${persona.telefono}` : ' · sin teléfono'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Insignia tono="neutro">Día {fila.escalon}</Insignia>
                      <Insignia tono={fila.estado === 'fallido' ? 'acento' : 'neutro'}>
                        {ETIQUETA_ESTADO[fila.estado] ?? fila.estado}
                      </Insignia>
                    </div>
                  </div>

                  <p className="mt-3 rounded-xl bg-marca-50 px-3 py-2 text-[14px] leading-relaxed whitespace-pre-line text-marca-700">
                    {fila.mensaje}
                  </p>

                  {fila.detalle && (
                    <p className="mt-2 text-[13px] text-acento-700">{fila.detalle}</p>
                  )}

                  {fila.estado !== 'enviado' && (
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <CopiarMensaje texto={fila.mensaje} />
                      <form action={marcarAMano}>
                        <input type="hidden" name="id" value={fila.id} />
                        <button type="submit" className="btn-neutro">
                          Ya lo mandé
                        </button>
                      </form>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </>
  )
}

const ETIQUETA_ESTADO: Record<string, string> = {
  preparado: 'Listo para mandar',
  enviado: 'Mandado',
  fallido: 'Falló',
}

function Campo({
  nombre,
  rotulo,
  ayuda,
  valor,
}: {
  nombre: string
  rotulo: string
  ayuda: string
  valor: string
}) {
  return (
    <div>
      <label htmlFor={nombre} className="rotulo">
        {rotulo}
      </label>
      <input
        id={nombre}
        name={nombre}
        defaultValue={valor}
        autoComplete="off"
        className="campo w-full"
      />
      <p className="mt-1 text-[12px] text-marca-400">{ayuda}</p>
    </div>
  )
}
