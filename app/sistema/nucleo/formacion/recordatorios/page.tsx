import type { Metadata } from 'next'
import Link from 'next/link'
import { CopiarMensaje } from '@/components/copiar-mensaje'
import { CURSO } from '@/lib/adiestramiento'
import { esAdmin, requerirPermiso } from '@/lib/auth'
import { escalera } from '@/lib/recordatorios'
import { createClient } from '@/lib/supabase/server'
import { fechaHora, numero } from '@/lib/plataforma/formato'
import { comoSeLee } from '@/lib/telefono'
import { estaLista, type Conexion } from '@/lib/whatsapp'
import { BOTON_CABECERA, CabeceraModulo } from '@/components/sistema/ui/cabecera-modulo'
import { cn } from '@/lib/utils'
import { guardarWhatsapp, mandarPorWhatsapp, marcarAMano, prepararRecordatorios, probarWhatsapp } from './acciones'

const ESTADO = 'inline-flex h-7 items-center rounded-full bg-[#eef0f3] px-2.5 text-[11.5px] font-semibold text-marca-600'

export const metadata: Metadata = { title: 'Recordatorios · Formación' }

const ESTADOS: Record<string, { etiqueta: string; clase: string }> = {
  preparado: { etiqueta: 'Listo para mandar', clase: 'bg-[#eaf2fb] text-[#2f5f9a]' },
  enviado: { etiqueta: 'Mandado', clase: 'bg-[#e7f5ee] text-[#1f6f4b]' },
  fallido: { etiqueta: 'Falló', clase: 'bg-[#fbeceb] text-[#a3241f]' },
}
const BOTON_PRINCIPAL = 'inline-flex h-8 items-center rounded-lg bg-[#D4332C] px-3 text-xs font-semibold text-white hover:bg-[#b92a24]'

/**
 * El empujón: a quién hay que insistirle para que termine el curso, y por dónde.
 * Funciona **sin WhatsApp** —la cuenta de Business está pedida y va a tardar—:
 * los mensajes se preparan con el nombre de cada quien, se copian y se mandan
 * desde un teléfono. Se manda el escalón más alto vencido, no todos. Preparar y
 * mandar son dos pasos, para leer el texto antes de que salga. Los textos están
 * en `contenido/adiestramiento/recordatorios.md`.
 *
 * La conexión con WhatsApp la configura administración desde aquí, y el token
 * **no se pinta nunca**, ni enmascarado: un token en pantalla es un token en
 * una captura.
 */
export default async function FormacionRecordatoriosPage({ searchParams }: PageProps<'/sistema/nucleo/formacion/recordatorios'>) {
  const [sesion, sp] = await Promise.all([requerirPermiso('modulo:recordatorios', 'editar'), searchParams])
  const puedeConfigurar = esAdmin(sesion.perfil)
  const filtro = typeof sp.estado === 'string' && sp.estado in ESTADOS ? sp.estado : null
  const supabase = await createClient()
  const { data: curso } = await supabase.from('cursos').select('id, abierto').eq('clave', CURSO).maybeSingle()

  const [{ data: conexion }, { data: pendientes }, { data: recordatorios }] = await Promise.all([
    supabase.from('ajustes_whatsapp').select('activo, id_numero, plantilla, numero_visible, token, probado_en, probado_ok, probado_detalle').eq('id', true).maybeSingle(),
    supabase.from('recordatorios_pendientes').select('matricula_id, dias').eq('curso_id', curso?.id ?? '00000000-0000-0000-0000-000000000000').range(0, 4999),
    supabase
      .from('recordatorios')
      .select('id, escalon, estado, mensaje, detalle, created_at, enviado_en, matriculas(nombre_corto, empleados(nombre_completo, telefono, cargo))')
      .order('created_at', { ascending: false })
      .range(0, 499),
  ])

  // Del token solo se sabe si existe: el valor no sale de aquí.
  const tieneToken = Boolean(conexion?.token)
  const lista = estaLista(conexion as Conexion | null)
  const encendida = lista && Boolean(conexion?.activo)
  const pasos = escalera()
  const filas = recordatorios ?? []
  const cuenta = (e: string) => filas.filter((r) => r.estado === e).length
  const preparados = cuenta('preparado')
  const visibles = filtro ? filas.filter((r) => r.estado === filtro) : filas
  const porEscalon = pasos.map((paso, i) => {
    const techo = pasos[i + 1]?.dias ?? Infinity
    return { dias: paso.dias, gente: (pendientes ?? []).filter((p) => (p.dias ?? 0) >= paso.dias && (p.dias ?? 0) < techo).length }
  })

  return (
    <>
      <CabeceraModulo
        sesion={sesion}
        codigo="NUC-FOR"
        migas={[{ etiqueta: 'Recordatorios' }]}
        acciones={<span className={ESTADO}>{encendida ? 'WhatsApp encendido' : 'WhatsApp sin conectar: se manda a mano'}</span>}
        descripcion={
          <>
            A quién insistirle para que termine el curso, y por dónde. Los textos están en <code>contenido/adiestramiento/recordatorios.md</code>: se cambian ahí, no aquí. Y no reclaman: nadie tiene que
            explicar por qué no ha vuelto.
          </>
        }
      />

      {!curso?.abierto && (
        <p className="mb-3 rounded-xl border border-[#ead9b8] bg-[#fffaf0] px-3.5 py-2.5 text-xs text-marca-700">
          El curso está cerrado, así que no hay a quién empujar. Se abre en{' '}
          <Link href="/sistema/nucleo/formacion" className="underline">
            Formación › Resumen
          </Link>
          .
        </p>
      )}

      <section className="mb-3 rounded-xl border border-[var(--borde)] bg-white p-3.5" aria-labelledby="titulo-escalera">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <h2 id="titulo-escalera" className="text-[13px] font-semibold text-marca-900">
              La escalera
            </h2>
            <p className="text-xs text-marca-500">
              Quién lleva días sin tocar el curso, por escalón. Se manda el más alto vencido, no todos: quien lleva veinte días callado recibe el de los {pasos[pasos.length - 1]?.dias ?? 13} y ya.
            </p>
          </div>
          <form action={prepararRecordatorios}>
            <button type="submit" className={BOTON_PRINCIPAL}>
              Preparar los de hoy
            </button>
          </form>
        </div>
        <ul className="mt-2.5 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {porEscalon.map((e) => (
            <li key={e.dias} className="rounded-lg border border-[var(--borde)] px-3 py-2">
              <p className="text-lg font-bold text-marca-900 tabular-nums">{numero(e.gente)}</p>
              <p className="text-xs text-marca-500">{e.dias}+ días sin volver</p>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-marca-500">
          {numero((pendientes ?? []).length)} sin terminar el curso. Preparar deja el texto escrito con el nombre de cada quien, para leerlo antes de que salga: doscientos mensajes con una errata no se recogen.
        </p>
      </section>

      <section className="mb-3 overflow-hidden rounded-xl border border-[var(--borde)] bg-white" aria-labelledby="titulo-mensajes">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--borde)] px-3.5 py-2.5">
          <div className="min-w-0">
            <h2 id="titulo-mensajes" className="text-[13px] font-semibold text-marca-900">
              Los mensajes
            </h2>
            <p className="text-xs text-marca-500">Copia el texto, mándalo desde tu teléfono y márcalo. Lo que se manda queda guardado tal cual salió.</p>
          </div>
          {encendida && preparados > 0 && (
            <form action={mandarPorWhatsapp}>
              <button type="submit" className={BOTON_PRINCIPAL}>
                Mandar los {numero(preparados)} por WhatsApp
              </button>
            </form>
          )}
        </div>
        <nav aria-label="Filtrar los mensajes" className="flex flex-wrap gap-1 border-b border-[var(--borde)] px-3.5 py-2">
          {[{ clave: null, etiqueta: 'Todos', n: filas.length }, ...Object.entries(ESTADOS).map(([clave, e]) => ({ clave, etiqueta: e.etiqueta, n: cuenta(clave) }))].map((o) => (
            <Link
              key={o.clave ?? 'todos'}
              href={o.clave ? `?estado=${o.clave}` : '?'}
              aria-current={filtro === o.clave ? 'page' : undefined}
              className={cn('inline-flex min-h-8 items-center gap-1 rounded-md px-2.5 text-xs', filtro === o.clave ? 'bg-[#2b2a28] font-semibold text-white' : 'text-marca-600 hover:bg-marca-50')}
            >
              {o.etiqueta} <span className="tabular-nums">{numero(o.n)}</span>
            </Link>
          ))}
        </nav>
        {visibles.length === 0 ? (
          <p className="px-3.5 py-8 text-center text-xs text-marca-500">
            {filas.length ? 'Ninguno en ese estado.' : 'Todavía no hay ninguno. Cuando alguien lleve dos días sin volver al curso, prepararlos lo trae aquí con su mensaje escrito.'}
          </p>
        ) : (
          <ul className="divide-y divide-[var(--borde)]">
            {visibles.map((fila) => {
              const persona = (fila.matriculas as { empleados: { nombre_completo: string; telefono: string | null; cargo: string | null } | null } | null)?.empleados
              const estado = ESTADOS[fila.estado] ?? { etiqueta: fila.estado, clase: 'bg-[#eef0f3] text-marca-600' }
              return (
                <li key={fila.id} className="px-3.5 py-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[13px] font-medium text-marca-900">{persona?.nombre_completo ?? 'Sin nombre'}</p>
                      <p className="text-xs text-marca-500">
                        {persona?.cargo ?? 'Sin cargo'} · {persona?.telefono ? (comoSeLee(persona.telefono) ?? persona.telefono) : 'sin teléfono'}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="rounded-full bg-[#eef0f3] px-2 py-0.5 text-[11px] font-semibold text-marca-600">Día {fila.escalon}</span>
                      <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-semibold', estado.clase)}>{estado.etiqueta}</span>
                    </div>
                  </div>
                  <p className="mt-2 rounded-lg bg-[#f6f7f9] px-3 py-2 text-[13px] leading-relaxed whitespace-pre-line text-marca-800">{fila.mensaje}</p>
                  {fila.detalle && <p className="mt-1.5 text-xs text-acento-700">{fila.detalle}</p>}
                  {fila.estado === 'enviado' ? (
                    <p className="mt-1.5 text-xs text-marca-500">Mandado el {fechaHora(fila.enviado_en)}</p>
                  ) : (
                    <div className="mt-2 flex flex-wrap items-center gap-2">
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

      {puedeConfigurar && (
        <section className="rounded-xl border border-[var(--borde)] bg-white p-3.5" aria-labelledby="titulo-whatsapp">
          <h2 id="titulo-whatsapp" className="text-[13px] font-semibold text-marca-900">
            La conexión con WhatsApp
          </h2>
          <p className="text-xs text-marca-500">
            De la cuenta de WhatsApp Business, en la consola de Meta. Mientras no esté, los mensajes se copian de la lista y se mandan a mano: el empujón no espera a la integración. Meta exige una plantilla
            aprobada para escribirle a quien lleva días callado.
          </p>
          <form action={guardarWhatsapp} className="mt-2.5 space-y-2.5">
            <div className="grid gap-2.5 sm:grid-cols-2">
              <Campo nombre="id_numero" rotulo="Identificador del número" ayuda="Phone Number ID, en la consola de Meta" valor={conexion?.id_numero ?? ''} />
              <Campo nombre="plantilla" rotulo="Plantilla aprobada" ayuda="Meta no deja escribir libre a quien lleva días callado" valor={conexion?.plantilla ?? ''} />
              <Campo nombre="numero_visible" rotulo="Número que ve la gente" ayuda="Solo para mostrarlo aquí" valor={conexion?.numero_visible ?? ''} />
              <div>
                <label htmlFor="token" className="mb-1 block text-xs font-semibold text-marca-700">
                  Token permanente
                </label>
                <input
                  id="token"
                  name="token"
                  type="password"
                  autoComplete="off"
                  className="h-9 w-full rounded-lg border border-[var(--borde)] px-2.5 text-[13px] outline-none focus:border-acento-400"
                  placeholder={tieneToken ? 'Guardado · escribe uno nuevo para cambiarlo' : ''}
                  aria-describedby="token-ayuda"
                />
                <p id="token-ayuda" className="mt-1 text-[11.5px] text-marca-500">
                  No se muestra nunca, ni enmascarado. Déjalo vacío para no cambiarlo.
                </p>
              </div>
            </div>
            <label className="flex items-start gap-2.5 border-t border-[var(--borde)] pt-2.5">
              <input type="checkbox" name="activo" value="si" defaultChecked={conexion?.activo ?? false} className="mt-0.5 h-4 w-4 accent-[#D4332C]" />
              <span>
                <span className="block text-[13px] font-medium text-marca-900">Mandar por WhatsApp</span>
                <span className="block text-xs text-marca-500">Apagado, los mensajes se preparan igual y se mandan a mano. Enciéndelo solo cuando la prueba salga bien.</span>
              </span>
            </label>
            <div className="flex flex-wrap items-center gap-2 border-t border-[var(--borde)] pt-2.5">
              <button type="submit" className={BOTON_PRINCIPAL}>
                Guardar
              </button>
              <button type="submit" formAction={probarWhatsapp} className={BOTON_CABECERA}>
                Probar la conexión
              </button>
              {conexion?.probado_en && (
                <span role="status" className="text-xs text-marca-600">
                  {conexion.probado_ok ? '✓' : '✖'} {conexion.probado_detalle} · {fechaHora(conexion.probado_en)}
                </span>
              )}
            </div>
          </form>
        </section>
      )}
    </>
  )
}

function Campo({ nombre, rotulo, ayuda, valor }: { nombre: string; rotulo: string; ayuda: string; valor: string }) {
  return (
    <div>
      <label htmlFor={nombre} className="mb-1 block text-xs font-semibold text-marca-700">
        {rotulo}
      </label>
      <input
        id={nombre}
        name={nombre}
        defaultValue={valor}
        autoComplete="off"
        aria-describedby={`${nombre}-ayuda`}
        className="h-9 w-full rounded-lg border border-[var(--borde)] px-2.5 text-[13px] outline-none focus:border-acento-400"
      />
      <p id={`${nombre}-ayuda`} className="mt-1 text-[11.5px] text-marca-500">
        {ayuda}
      </p>
    </div>
  )
}
