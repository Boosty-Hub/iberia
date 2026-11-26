import type { ReactNode } from 'react'
import type { Sesion } from '@/lib/auth'
import { puede } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { catalogoModelos, miPolitica } from '@/lib/asistente/servidor'
import { fuentesDePersona } from '@/lib/asistente/alcance'
import { ETIQUETA_ESFUERZO, bytesLegibles } from '@/lib/asistente/tipos'
import { BotonGuia } from './boton-guia'

/**
 * La «Guía» del asistente (26-nov-2026, pedido de Gabriel): un popup con lo que la persona puede hacer, punto a
 * punto, CON SU ALCANCE REAL. No es un texto fijo: sale de su política (`mi_politica`: modelos, topes, ventanas,
 * compartir, programar), de sus fuentes (`fuentesDePersona`, la misma regla de «Ver como»), de lo que puede el motor
 * (`capacidades`) y de su conexión de Microsoft 365. Si la administración le cambia algo, la guía lo dice.
 */
export async function GuiaAsistente({ sesion }: { sesion: Sesion }) {
  const supabase = await createClient()
  const [pol, modelos, fuentes, { data: capacidades }, { data: m365 }] = await Promise.all([
    miPolitica(),
    catalogoModelos(),
    fuentesDePersona(sesion.userId),
    supabase.schema('asistente').rpc('capacidades', {}),
    supabase.schema('asistente').from('conexion_microsoft').select('cuenta').maybeSingle(),
  ])
  if (!pol) return null
  const cap = (k: string) => ((capacidades ?? []) as { capacidad: string; disponible: boolean }[]).find((c) => c.capacidad === k)?.disponible ?? true
  const nombres = new Map(modelos.map((m) => [m.id, m.nombre]))
  const misModelos = pol.modelos.map((id) => nombres.get(id) ?? id)
  const si = fuentes.filter((f) => f.estado === 'si' && !f.clave.startsWith('m365:'))
  const sinPermiso = fuentes.filter((f) => f.estado === 'sin_permiso')
  const fuera = fuentes.filter((f) => f.estado === 'fuera_de_alcance' && !f.clave.startsWith('m365:'))
  const m365Si = fuentes.filter((f) => f.estado === 'si' && f.clave.startsWith('m365:'))
  const conArchivos = puede(sesion, 'sistema:archivos')
  const horas = Math.round(pol.frecuencia_min_min / 60)

  return (
    <BotonGuia>
      <p className="text-[13px] text-marca-600">
        Esto es lo que el asistente puede hacer <strong>contigo</strong>, con tu rol y tus permisos de hoy. Si la administración te cambia algo, esta guía lo dice.
      </p>

      <Seccion titulo="1 · Conversar y trabajar con archivos">
        <Item>Escríbele como a un colega: pide análisis, borradores, resúmenes, correos, tablas. Cada chat queda guardado en tu lista.</Item>
        {cap('archivos') ? (
          <Item>
            <strong>Adjuntar</strong> (📎, arrastrar o pegar): Excel, Word, PowerPoint, PDF, CSV e imágenes, hasta 100 MB cada uno. Un Excel grande lo procesa con código y te devuelve el resultado
            en Excel. Tu espacio: {bytesLegibles(pol.usado_bytes)} de {pol.cuota_mb} MB.
          </Item>
        ) : (
          <Item>Con el motor de hoy no se procesan archivos adjuntos.</Item>
        )}
        <Item>
          <strong>«/»</strong> al empezar a escribir: tus atajos (instrucciones guardadas){conArchivos ? ' y tus carpetas y archivos de «Mis archivos», que se adjuntan con un toque' : ''}.
        </Item>
        <Item>
          <strong>Artefactos</strong>: tableros, gráficos y documentos que se abren al costado, se actualizan por versiones y se descargan.
        </Item>
        <Item>
          <strong>Proyectos</strong> (instrucciones y archivos fijos para varios chats), <strong>Mi memoria</strong> (lo que recuerda de cómo trabajas; la puedes corregir o apagar) y{' '}
          <strong>Dictar</strong> (🎙, hablas y revisas el texto antes de enviar).
        </Item>
        {cap('investigacion') && (
          <Item>
            <strong>Investigación</strong>: un modo que busca en muchas fuentes de internet, planifica y entrega un informe con sus citas. Tarda más y gasta más de tu ventana.
          </Item>
        )}
        <Item>
          <strong>Abrir en ventana</strong>: el chat queda flotando mientras navegas por la plataforma, y el asistente sabe en qué pantalla estás.
        </Item>
      </Seccion>

      <Seccion titulo="2 · Tus modelos">
        <Item>
          Puedes usar: {misModelos.join(', ') || 'ninguno'}. De entrada: {nombres.get(pol.modelo_defecto) ?? pol.modelo_defecto}. Esfuerzo hasta «{ETIQUETA_ESFUERZO[pol.esfuerzo_max]}».
        </Item>
        <Item>Un modelo más grande razona mejor y gasta más de tu cupo; para algo rápido, el más chico basta.</Item>
      </Seccion>

      <Seccion titulo="3 · Tu cupo">
        <Item>
          Tu cupo del día se reparte en <strong>{pol.ventanas_por_dia} ventanas de 5 horas</strong>: la ventana arranca con tu primer mensaje y se renueva completa 5 horas después. Así el
          día no se gasta en una hora.
        </Item>
        <Item>Debajo de tus chats ves cuánto llevas, en porcentaje: la ventana, el día y el mes.</Item>
      </Seccion>

      <Seccion titulo="4 · Compartir y programar">
        <Item>
          {pol.puede_compartir
            ? 'Puedes compartir un chat (quien entra ve todo lo anterior, y cada quien pregunta con sus propios permisos) y compartir archivos o artefactos. Si algo trae datos que la otra persona no puede ver, no se comparte.'
            : 'Tu rol no comparte chats ni archivos del asistente.'}
        </Item>
        <Item>
          {pol.puede_programar
            ? `Puedes programar hasta ${pol.max_tareas} tareas que corren solas (cada ${horas >= 1 ? `${horas} h` : `${pol.frecuencia_min_min} min`} como mínimo, diarias, semanales o mensuales) y mantener tableros al día. Te avisan en la campana.`
            : 'Tu rol no programa tareas automáticas.'}
        </Item>
      </Seccion>

      <Seccion titulo="5 · Qué datos de la plataforma consulta por ti">
        {si.length ? (
          <>
            <Item>
              Consulta, con tus mismos permisos (nunca ve más que tú): <strong>{si.map((f) => f.titulo).join(' · ')}</strong>.
            </Item>
            <Item>Cada respuesta con datos dice de dónde salió la cifra.</Item>
          </>
        ) : (
          <Item>Hoy no consulta datos de la plataforma para ti: responde con lo que le escribes o adjuntas. Si lo necesitas, pídeselo a la administración.</Item>
        )}
        {(sinPermiso.length > 0 || fuera.length > 0) && (
          <details className="mt-1 text-[12.5px] text-marca-600">
            <summary className="cursor-pointer">Lo que no consulta, y por qué</summary>
            {sinPermiso.length > 0 && (
              <p className="mt-1">
                <strong>Tu rol no ve esa pantalla</strong> ({sinPermiso.length}): {sinPermiso.map((f) => f.titulo).join(' · ')}.
              </p>
            )}
            {fuera.length > 0 && (
              <p className="mt-1">
                <strong>No está habilitado para el asistente en tu rol</strong> ({fuera.length}): {fuera.map((f) => f.titulo).join(' · ')}.
              </p>
            )}
          </details>
        )}
      </Seccion>

      <Seccion titulo="6 · Microsoft 365">
        <Item>
          {m365?.cuenta
            ? `Conectaste ${m365.cuenta}.${m365Si.length ? ` Lee, solo lectura: ${m365Si.map((f) => f.titulo.replace('Microsoft 365 · ', '')).join(', ')}.` : ' La administración todavía no habilitó qué puede leer.'}`
            : m365Si.length
              ? 'Puedes conectar tu cuenta en «Conexiones» para que lea tu correo, calendario o archivos (solo lectura, solo lo que tú ves).'
              : 'Por ahora no está habilitado para tu rol.'}
        </Item>
      </Seccion>

      <Seccion titulo="7 · Lo que nunca hace">
        <Item>No cambia nada en la plataforma: solo lee y te propone. Tú decides.</Item>
        <Item>No ve más que tú: cada consulta pasa con tus permisos.</Item>
        <Item>Nadie lee tus chats. Solo el equipo de soporte de Boosty, si hace falta para resolver un problema, y queda registrado. La información queda en resguardo de Industrias Iberia.</Item>
      </Seccion>
    </BotonGuia>
  )
}

function Seccion({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="mt-4">
      <h3 className="mb-1.5 text-[13.5px] font-semibold text-marca-900">{titulo}</h3>
      <ul className="flex flex-col gap-1.5">{children}</ul>
    </section>
  )
}

function Item({ children }: { children: ReactNode }) {
  return <li className="relative pl-4 text-[13px] leading-relaxed text-marca-800 before:absolute before:top-[0.6em] before:left-1 before:h-1 before:w-1 before:rounded-full before:bg-marca-400">{children}</li>
}
