import 'server-only'
import { puede, type Sesion } from '@/lib/auth'
import { FAMILIAS_OFICIO, type FamiliaOficio } from '@/lib/adiestramiento'
import { NIVELES_EMPLEADO } from '@/lib/canal'
import { legible } from '@/lib/certificado'
import { cruzarPadron } from '@/lib/padron-cuentas'
import {
  acunarEnlacesDe,
  enlazarCuentaPropuesta,
  marcarEnlacesMandadosDe,
  mandarEnlacesDe,
  matricularFichas,
  resolverCorreccionPadron,
} from '@/lib/padron-acciones'
import type { AccionFicha, ResultadoAccionFicha, SeccionFicha, TonoFicha } from '@/lib/plataforma/ficha-tipos'
import type { EntradaAccionFicha } from '@/lib/plataforma/fichas/acciones'
import { fechaHora, fechaLarga, numero } from '@/lib/plataforma/formato'
import { createClient } from '@/lib/supabase/server'
import { comoSeLee } from '@/lib/telefono'
import { estaLista, type Conexion } from '@/lib/whatsapp'

/**
 * Las pestañas del padrón en la ficha de la persona: **Padrón** (lo que dice
 * Capital Humano y sus correcciones), **Accesos** (su cuenta y su enlace
 * personal) y **Formación** (su matrícula, lección por lección, y su
 * certificado). Solo existen para quien tiene `modulo:empleados` · editar —las
 * vistas que leen solo le responden al equipo—: sin el permiso, la pestaña no
 * se esconde, no llega.
 *
 * Del enlace sale el estado, nunca el token, su huella ni el mensaje que lo
 * lleva en claro.
 */

type Cliente = Awaited<ReturnType<typeof createClient>>

export function veePadron(sesion: Sesion): boolean {
  return puede(sesion, 'modulo:empleados', 'editar')
}

const ESTADO_CURSO: Record<string, { etiqueta: string; tono: TonoFicha }> = {
  pendiente: { etiqueta: 'Sin empezar', tono: 'azul' },
  en_curso: { etiqueta: 'En curso', tono: 'ambar' },
  completado: { etiqueta: 'Terminó', tono: 'verde' },
}

export async function seccionesPadron(supabase: Cliente, sesion: Sesion, id: string): Promise<SeccionFicha[]> {
  if (!veePadron(sesion)) return []
  const [{ data: p }, { data: accesos }, { data: correcciones }, { data: conexion }, cruces] = await Promise.all([
    supabase.from('padron_estado').select('*').eq('id', id).maybeSingle(),
    // Columnas elegidas a mano: ni la huella ni `mensaje`, que lleva el enlace en claro.
    supabase.from('accesos_estado').select('id, motivo, canal, enviado_en, expira_en, usado_en, ultimo_uso, usos, created_at, vigente').eq('empleado_id', id).order('created_at', { ascending: false }).range(0, 19),
    supabase.from('correcciones_padron').select('id, nombre, area, nombre_padron, cargo_padron, area_padron, created_at, resuelta_en').eq('empleado_id', id).order('created_at', { ascending: false }).range(0, 19),
    supabase.from('ajustes_whatsapp').select('activo, id_numero, plantilla, token').eq('id', true).maybeSingle(),
    cruzarPadron(supabase),
  ])
  if (!p) return []
  const whatsapp = estaLista(conexion as Conexion | null) && Boolean(conexion?.activo)
  const duplicada = cruces.duplicadas.get(id) ?? null
  const propuesta = !p.cuenta_email ? (cruces.propuestas.get(id) ?? null) : null
  const activa = Boolean(p.activo)
  const marcable = activa && !duplicada
  const familia = (p.familia_oficio ?? 'generico') as FamiliaOficio
  const pendientes = (correcciones ?? []).filter((c) => !c.resuelta_en)

  // ── Padrón ─────────────────────────────────────────────────────────────────
  const padron: SeccionFicha = {
    clave: 'padron',
    etiqueta: 'Padrón',
    n: pendientes.length || undefined,
    bloques: [
      ...(duplicada
        ? [{ tipo: 'texto' as const, tono: 'ambar' as const, texto: `Ficha de muestra repetida: la de Capital Humano es «${duplicada.nombre}», ficha ${duplicada.ficha}. No se matricula ni se le acuña enlace: se usa aquella.` }]
        : []),
      {
        tipo: 'datos',
        titulo: 'Lo que dice el padrón de Capital Humano',
        filas: [
          { etiqueta: 'Ficha', valor: p.ficha ?? 'Cargada a mano (sin número)', mono: Boolean(p.ficha) },
          { etiqueta: 'Cédula', valor: p.cedula ?? 'No la trae el listado' },
          { etiqueta: 'Cargo', valor: p.cargo ? legible(p.cargo) : '—' },
          { etiqueta: 'Área', valor: p.area_nombre ?? 'Sin área asignada' },
          { etiqueta: 'Nivel', valor: (NIVELES_EMPLEADO as Record<string, string>)[p.nivel ?? ''] ?? p.nivel ?? '—' },
          { etiqueta: 'Oficio (para el curso)', valor: FAMILIAS_OFICIO[familia] ?? familia },
          { etiqueta: 'Nómina', valor: p.tipo_nomina === 'diaria' ? 'Diaria' : p.tipo_nomina === 'mensual' ? 'Mensual' : '—' },
          { etiqueta: 'Sede', valor: p.sede ?? '—' },
          { etiqueta: 'Teléfono', valor: comoSeLee(p.telefono) ?? p.telefono ?? 'Falta: sin número no hay por dónde mandarle el enlace' },
          { etiqueta: 'Estado', valor: activa ? 'Activa' : 'Inactiva' },
        ],
      },
      {
        tipo: 'pasos',
        titulo: 'Correcciones de «No soy yo»',
        pasos: (correcciones ?? []).map((c, i) => ({
          orden: (correcciones ?? []).length - i,
          nombre: `Escribió: ${[c.nombre, c.area].filter(Boolean).join(' · ')}`,
          quien: `En el padrón: ${[c.nombre_padron, c.cargo_padron, c.area_padron].filter(Boolean).join(' · ')}`,
          estado: c.resuelta_en ? 'Pasada a Capital Humano' : 'Por pasar',
          tono: (c.resuelta_en ? 'neutro' : 'ambar') as TonoFicha,
          en: c.created_at,
          acciones: c.resuelta_en ? [] : [{ accion: 'padron.correccion', param: c.id, etiqueta: 'Ya se le pasó', confirmar: 'Sale de la lista. El padrón no cambia aquí: lo corrige Capital Humano y vuelve con importar:padron.' }],
        })),
      },
    ],
  }
  if (!(correcciones ?? []).length) padron.bloques.pop()

  // ── Accesos ────────────────────────────────────────────────────────────────
  const vivo = (accesos ?? []).find((a) => a.vigente)
  const sinMandar = (accesos ?? []).some((a) => a.vigente && !a.enviado_en && a.motivo === 'curso')
  const cuentaTexto = p.cuenta_email
    ? p.cuenta_email.endsWith('@iberia.local')
      ? 'La de su enlace (nació al acuñarlo)'
      : `Con su correo: ${p.cuenta_email}`
    : propuesta
      ? `Sin enlazar. Ya tiene una cuenta que coincide: ${propuesta.email}`
      : 'Sin cuenta: acuñar el enlace se la crea'
  const accionesAcceso: AccionFicha[] = [
    ...(marcable && propuesta
      ? [{ accion: 'padron.enlazar', etiqueta: `Enlazar con ${propuesta.email}`, tono: 'principal' as const, confirmar: `La ficha queda enlazada a la cuenta ${propuesta.email}: esa persona verá su canal y su curso con ella. Confírmalo solo si es la misma persona.` }]
      : []),
    ...(marcable && !propuesta && !vivo && p.cedula ? [{ accion: 'padron.acunar', etiqueta: 'Acuñar su enlace', tono: 'principal' as const, confirmar: 'El enlace es su credencial: vale 120 días y entra sin clave. Se guarda solo su huella.' }] : []),
    ...(marcable && sinMandar
      ? whatsapp
        ? [{ accion: 'padron.mandar', etiqueta: 'Mandárselo por WhatsApp', confirmar: '¿Mandarle ahora su enlace por WhatsApp?' }]
        : [{ accion: 'padron.marcar', etiqueta: 'Ya se lo mandé a mano' }]
      : []),
  ]
  const accesosSeccion: SeccionFicha = {
    clave: 'accesos',
    etiqueta: 'Accesos',
    bloques: [
      {
        tipo: 'datos',
        titulo: 'Su cuenta',
        filas: [{ etiqueta: 'Cuenta', valor: cuentaTexto }],
      },
      {
        tipo: 'cifras',
        titulo: 'Su enlace personal',
        cifras: vivo
          ? [
              { etiqueta: 'Estado', valor: !vivo.enviado_en ? 'Acuñado, sin mandar' : (vivo.usos ?? 0) === 0 ? 'Mandado · no ha entrado' : 'Ya entró', tono: !vivo.enviado_en ? 'azul' : (vivo.usos ?? 0) === 0 ? 'rojo' : 'verde' },
              { etiqueta: 'Entradas', valor: numero(vivo.usos ?? 0), detalle: vivo.ultimo_uso ? `la última, ${fechaHora(vivo.ultimo_uso)}` : null },
              { etiqueta: 'Mandado', valor: vivo.enviado_en ? fechaLarga(diaCaracas(vivo.enviado_en)) : '—', detalle: vivo.enviado_en ? (vivo.canal === 'manual' ? 'a mano' : 'por WhatsApp') : null },
              { etiqueta: 'Caduca', valor: fechaLarga(diaCaracas(vivo.expira_en)), detalle: '120 días desde que se acuñó' },
            ]
          : [{ etiqueta: 'Estado', valor: (accesos ?? []).length ? 'Caducado' : 'Sin acuñar', tono: (accesos ?? []).length ? 'ambar' : 'neutro', detalle: !p.cedula ? 'sin cédula no se acuña' : null }],
        sello: 'El enlace es la credencial: aquí se ve su estado, nunca el enlace.',
      },
      ...(accionesAcceso.length ? [{ tipo: 'acciones' as const, acciones: accionesAcceso }] : []),
      ...((accesos ?? []).length > 1
        ? [
            {
              tipo: 'pasos' as const,
              titulo: 'Enlaces acuñados',
              pasos: (accesos ?? []).map((a, i) => ({
                orden: (accesos ?? []).length - i,
                nombre: `Acuñado el ${fechaLarga(diaCaracas(a.created_at))}`,
                quien: `${numero(a.usos ?? 0)} entrada${a.usos === 1 ? '' : 's'} · caduca el ${fechaLarga(diaCaracas(a.expira_en))}`,
                estado: a.vigente ? 'Vigente' : 'Caducado',
                tono: (a.vigente ? 'verde' : 'neutro') as TonoFicha,
              })),
            },
          ]
        : []),
    ],
  }

  // ── Formación ──────────────────────────────────────────────────────────────
  let formacion: SeccionFicha
  if (!p.matricula_id) {
    formacion = {
      clave: 'formacion',
      etiqueta: 'Formación',
      bloques: [
        { tipo: 'texto', texto: 'Sin matrícula en el curso de Ajito.' },
        ...(marcable ? [{ tipo: 'acciones' as const, acciones: [{ accion: 'padron.matricular', etiqueta: 'Matricularla', tono: 'principal' as const }] }] : []),
      ],
    }
  } else {
    const [{ data: avances }, { data: lecciones }, { data: certificado }] = await Promise.all([
      supabase.from('avances').select('leccion_id, estado, completada_en, iniciada_en').eq('matricula_id', p.matricula_id).range(0, 49),
      supabase.from('lecciones').select('id, numero, titulo, activa').order('numero').range(0, 49),
      supabase.from('certificados').select('codigo, emitido_en, entregado_en').eq('matricula_id', p.matricula_id).maybeSingle(),
    ])
    const deLeccion = new Map((avances ?? []).map((a) => [a.leccion_id, a]))
    const estado = ESTADO_CURSO[p.estado_matricula ?? 'pendiente'] ?? ESTADO_CURSO.pendiente
    formacion = {
      clave: 'formacion',
      etiqueta: 'Formación',
      n: Number(p.lecciones_hechas ?? 0),
      bloques: [
        {
          tipo: 'cifras',
          cifras: [
            { etiqueta: 'Curso', valor: estado.etiqueta, tono: estado.tono },
            { etiqueta: 'Lecciones', valor: `${numero(Number(p.lecciones_hechas ?? 0))} de ${numero((lecciones ?? []).filter((l) => l.activa).length)}` },
            { etiqueta: 'Último toque', valor: p.ultimo_toque ? fechaLarga(diaCaracas(p.ultimo_toque)) : 'Nunca' },
            { etiqueta: 'Certificado', valor: certificado?.codigo ?? '—', detalle: certificado ? (certificado.entregado_en ? `entregado el ${fechaLarga(diaCaracas(certificado.entregado_en))}` : 'por entregar en mano') : null },
          ],
        },
        {
          tipo: 'pasos',
          titulo: 'Lección por lección',
          pasos: (lecciones ?? [])
            .filter((l) => l.activa)
            .map((l) => {
              const a = deLeccion.get(l.id)
              return {
                orden: l.numero,
                nombre: l.titulo,
                estado: !a ? 'Sin empezar' : a.estado === 'completada' ? 'Terminada' : 'Empezada',
                tono: (!a ? 'neutro' : a.estado === 'completada' ? 'verde' : 'ambar') as TonoFicha,
                en: a?.completada_en ?? a?.iniciada_en ?? null,
              }
            }),
        },
        { tipo: 'texto', texto: 'Lo que respondió a Ajito no sale aquí: lo leen su autor y el equipo de Boosty, nadie de su trabajo.' },
      ],
    }
  }

  return [padron, accesosSeccion, formacion]
}

const diaCaracas = (iso: string | null | undefined) =>
  iso ? new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Caracas', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso)) : null

/** Las acciones `padron.*` de la ficha de la persona. Cada una pide su permiso otra vez. */
export async function manejarPadron(sesion: Sesion, id: string, accion: string, e: EntradaAccionFicha): Promise<ResultadoAccionFicha> {
  if (!veePadron(sesion)) return { error: 'Tu rol no trabaja el padrón.' }
  switch (accion) {
    case 'padron.matricular':
      return matricularFichas([id])
    case 'padron.acunar':
      return acunarEnlacesDe([id])
    case 'padron.mandar':
      return mandarEnlacesDe([id])
    case 'padron.marcar':
      return marcarEnlacesMandadosDe([id])
    case 'padron.enlazar':
      return enlazarCuentaPropuesta(id)
    case 'padron.correccion': {
      if (!e.param) return { error: 'Falta la corrección.' }
      // La corrección tiene que ser de esta persona.
      const supabase = await createClient()
      const { data } = await supabase.from('correcciones_padron').select('id').eq('id', e.param).eq('empleado_id', id).maybeSingle()
      if (!data) return { error: 'Esa corrección no es de esta persona.' }
      return resolverCorreccionPadron(e.param)
    }
  }
  return { error: 'Acción no válida.' }
}
