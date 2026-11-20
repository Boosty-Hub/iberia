import type { Metadata } from 'next'
import Link from 'next/link'
import { requerirPermiso } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { fechaCorta, numero } from '@/lib/plataforma/formato'
import { leerPadron } from '@/lib/plataforma/padron'
import { leerContexto } from '@/lib/plataforma/servidor'
import { TABLA_PADRON } from '@/lib/plataforma/tablas-formacion'
import type { LoteTabla } from '@/lib/plataforma/tabla'
import { estaLista, type Conexion } from '@/lib/whatsapp'
import { BOTON_CABECERA, CabeceraModulo } from '@/components/sistema/ui/cabecera-modulo'
import { TablaServidor } from '@/components/sistema/ui/tabla-servidor'
import { acunar, mandarPorWhatsapp, marcarMandados, matricular, yaSeLePaso } from './acciones'

const ESTADO = 'inline-flex h-7 items-center rounded-full bg-[#eef0f3] px-2.5 text-[11.5px] font-semibold text-marca-600'

export const metadata: Metadata = { title: 'Padrón y accesos · Personas' }

/**
 * El padrón de trabajo: las fichas de Capital Humano (y las cargadas a mano, con
 * la de muestra repetida marcada) con su plaza de hoy, su cuenta, su matrícula y
 * el estado de su enlace personal. Desde aquí se matricula, se acuña el enlace y
 * se manda, en lote; la fila abre la ficha de la persona (Padrón · Accesos ·
 * Formación), donde se enlaza la cuenta que ya tiene y se pasan sus correcciones.
 *
 * Se abre con `modulo:empleados` · editar: su vista (`padron_estado`) solo le
 * responde al equipo. **El enlace es la credencial**: aquí se ve su estado,
 * nunca el token ni su huella.
 */
export default async function PadronPage({ searchParams }: PageProps<'/sistema/personas/padron'>) {
  const [sesion, sp] = await Promise.all([requerirPermiso('modulo:empleados', 'editar'), searchParams])
  const ctx = await leerContexto(sp)
  const supabase = await createClient()
  const [filas, { data: conexion }, { data: correcciones }] = await Promise.all([
    leerPadron(),
    supabase.from('ajustes_whatsapp').select('activo, id_numero, plantilla, token').eq('id', true).maybeSingle(),
    supabase
      .from('correcciones_padron')
      .select('id, empleado_id, nombre, area, nombre_padron, cargo_padron, area_padron, created_at')
      .is('resuelta_en', null)
      .order('created_at')
      .range(0, 199),
  ])
  // Solo se pregunta si está lista; el token no sale de aquí.
  const whatsapp = estaLista(conexion as Conexion | null) && Boolean(conexion?.activo)

  const activas = filas.filter((f) => f.activo === 'si')
  const cuenta = (pred: (f: (typeof filas)[number]) => boolean) => activas.filter(pred).length
  const atajos = [
    { etiqueta: 'De Capital Humano', n: cuenta((f) => f.origen === 'capital_humano'), href: '?f.origen=capital_humano' },
    { etiqueta: 'Cargadas a mano', n: cuenta((f) => f.origen !== 'capital_humano'), href: '?f.origen=a_mano&f.origen=muestra_repetida' },
    { etiqueta: 'Sin teléfono', n: cuenta((f) => f.con_telefono === 'no'), href: '?f.con_telefono=no' },
    { etiqueta: 'Sin matrícula', n: cuenta((f) => f.curso === 'sin_matricula'), href: '?f.curso=sin_matricula' },
    { etiqueta: 'Cuenta por enlazar', n: cuenta((f) => f.cuenta === 'por_enlazar'), href: '?f.cuenta=por_enlazar' },
    { etiqueta: 'Mandado, no ha entrado', n: cuenta((f) => f.enlace === 'sin_entrar'), href: '?f.enlace=sin_entrar' },
    { etiqueta: 'Ya entraron', n: cuenta((f) => f.enlace === 'entro'), href: '?f.enlace=entro' },
  ]

  const lote: LoteTabla = {
    nombre: 'nombre',
    bloqueo: 'bloqueo',
    acciones: [
      { clave: 'matricular', etiqueta: 'Matricular', principal: true, aplica: 'puede_matricular', ejecutar: matricular },
      { clave: 'acunar', etiqueta: 'Acuñar enlace', aplica: 'puede_acunar', ejecutar: acunar },
      whatsapp
        ? { clave: 'mandar', etiqueta: 'Mandar por WhatsApp', aplica: 'puede_mandar', ejecutar: mandarPorWhatsapp, confirmar: 'Cada enlace es la credencial de esa persona. ¿Mandarlos ahora por WhatsApp?' }
        : { clave: 'mandar', etiqueta: 'Marcar mandados a mano', aplica: 'puede_mandar', ejecutar: marcarMandados },
    ],
    avisos: [
      { columna: 'por_enlazar', texto: 'Con cuenta por enlazar: {n}. A esas no se les acuña enlace; se enlazan desde su ficha (abre la fila).' },
      { columna: 'sin_cedula', texto: 'Sin cédula en el padrón: {n}. No se les acuña el enlace hasta que Capital Humano la mande (no se inventa una).' },
      { columna: 'sin_telefono', texto: 'Sin teléfono: {n}. Se pueden matricular y acuñar, pero no hay por dónde mandarles el enlace.', tono: 'rojo' },
    ],
  }

  return (
    <>
      <CabeceraModulo
        sesion={sesion}
        codigo="PER-PAD"
        acciones={
          <>
            <span className={ESTADO} title="La conexión se configura en Formación › Recordatorios">
              {whatsapp ? 'WhatsApp encendido' : 'WhatsApp sin conectar: se manda a mano'}
            </span>
            <Link href="/sistema/nucleo/formacion/recordatorios" className={BOTON_CABECERA}>
              El empujón
            </Link>
          </>
        }
        descripcion={
          <>
            Las personas de Industrias Iberia, su plaza, su cuenta, su matrícula y su enlace personal. <strong className="font-semibold text-marca-700">El enlace es la credencial</strong>: quien lo recibe
            entra sin usuario ni clave, así que no se comparte. Marca filas para matricular, acuñar o mandar en lote; la fila abre la ficha.
          </>
        }
      />

      <nav aria-label="Atajos del padrón" className="mb-3 flex flex-wrap gap-1.5">
        {atajos.map((a) => (
          <Link key={a.etiqueta} href={a.href} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[var(--borde)] bg-white px-2.5 text-xs text-marca-700 hover:bg-marca-50">
            {a.etiqueta}
            <b className="font-semibold text-marca-900 tabular-nums">{numero(a.n)}</b>
          </Link>
        ))}
        <span className="inline-flex h-8 items-center px-1 text-xs text-marca-500">de {numero(activas.length)} activas</span>
      </nav>

      {(correcciones ?? []).length > 0 && (
        <section className="mb-3 rounded-xl border border-[#ead9b8] bg-[#fffaf0] px-3.5 py-3" data-correcciones-padron aria-labelledby="titulo-correcciones">
          <h2 id="titulo-correcciones" className="text-[13px] font-semibold text-marca-900">
            Para Capital Humano · {numero(correcciones!.length)} {correcciones!.length === 1 ? 'ficha corregida' : 'fichas corregidas'}
          </h2>
          <p className="mt-0.5 text-xs text-marca-600">
            Dijeron «No soy yo» en la lección 0 y escribieron cómo se llaman. El padrón no cambia solo: se le pasa a Capital Humano y, cuando lo corrija, vuelve con <code>importar:padron</code>.
          </p>
          <ul className="mt-2 divide-y divide-[#ead9b8]">
            {correcciones!.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-x-4 gap-y-1.5 py-2">
                <div className="min-w-56 flex-1 text-xs">
                  <p className="text-marca-600">
                    En el padrón: <span className="text-marca-800">{[c.nombre_padron, c.cargo_padron, c.area_padron].filter(Boolean).join(' · ')}</span>
                  </p>
                  <p className="text-marca-600">
                    Escribió: <strong className="text-marca-900">{[c.nombre, c.area].filter(Boolean).join(' · ')}</strong>
                  </p>
                </div>
                <span className="text-[11px] text-marca-500 tabular-nums">{fechaCorta(new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Caracas' }).format(new Date(c.created_at)))}</span>
                <Link href={`?ficha=persona:${c.empleado_id}`} scroll={false} className={BOTON_CABECERA}>
                  Ver ficha
                </Link>
                <form action={yaSeLePaso}>
                  <input type="hidden" name="id" value={c.id} />
                  <button type="submit" className={BOTON_CABECERA}>
                    Ya se le pasó
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </section>
      )}

      <TablaServidor fuente={TABLA_PADRON} sp={sp} sesion={sesion} ctx={ctx} lote={lote} vacio="Nadie con estos filtros. Prueba a quitarlos, o revisa que el padrón esté cargado." />
    </>
  )
}
