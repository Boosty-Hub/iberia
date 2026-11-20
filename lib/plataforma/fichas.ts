import { puede, type Sesion } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { DECISION, ESTADO_REQUISICION, ESTADO_SOLICITUD, enlaceObjeto } from '@/components/sistema/flujo/formato'
import { TIPOS_FICHA, type Ficha, type TipoFicha, type TonoFicha } from '@/lib/plataforma/ficha-tipos'
import { fechaCorta, fechaHora, hoyCaracas, numero } from '@/lib/plataforma/formato'

/**
 * Arma la ficha de un objeto con la sesión de quien la pide: cada consulta pasa
 * por la RLS, y además se exige el permiso del módulo antes de preguntar. Si no
 * puede verlo, devuelve null (la pantalla dice «no está a tu alcance», sin
 * distinguir «no existe» de «no puedes»).
 */

type Cliente = Awaited<ReturnType<typeof createClient>>

const PERMISO: Record<TipoFicha, [string, 'ver' | 'crear']> = {
  unidad: ['sistema:estructura', 'ver'],
  plaza: ['sistema:estructura', 'ver'],
  cargo: ['sistema:estructura', 'ver'],
  proceso: ['sistema:procesos', 'ver'],
  documento: ['sistema:documentos', 'ver'],
  requisicion: ['sistema:requisiciones', 'crear'],
}

const TONO_INSIGNIA: Record<string, TonoFicha> = { neutro: 'neutro', marca: 'neutro', acento: 'rojo', rojo: 'rojo', ambar: 'ambar', verde: 'verde' }

function vacia(tipo: TipoFicha, id: string, titulo: string): Ficha {
  return {
    tipo,
    id,
    tipoEtiqueta: TIPOS_FICHA[tipo],
    titulo,
    datos: [],
    relaciones: [],
    linea: [],
    lineaVisible: false,
    documentos: [],
    aprobaciones: [],
    perimetro: false,
  }
}

const ACCION_AUDITORIA: Record<string, string> = { INSERT: 'Creado', UPDATE: 'Modificado', DELETE: 'Eliminado' }

/** La línea de tiempo: la auditoría de todas las versiones del objeto. */
async function lineaDe(supabase: Cliente, sesion: Sesion, esquema: string, tabla: string, ids: string[]) {
  if (!puede(sesion, 'sistema:auditoria') || !ids.length) return { linea: [], visible: puede(sesion, 'sistema:auditoria') }
  const { data } = await supabase
    .schema('control')
    .from('auditoria')
    .select('accion, en, actor, antes, despues')
    .eq('esquema', esquema)
    .eq('tabla', tabla)
    .in('registro_id', ids)
    .order('en', { ascending: false })
    .range(0, 29)
  const actores = [...new Set((data ?? []).map((a) => a.actor).filter(Boolean))] as string[]
  const { data: perfiles } = actores.length
    ? await supabase.from('profiles').select('id, nombre_completo, email').in('id', actores)
    : { data: [] as { id: string; nombre_completo: string | null; email: string }[] }
  const nombre = new Map((perfiles ?? []).map((p) => [p.id, p.nombre_completo || p.email]))
  return {
    visible: true,
    linea: (data ?? []).map((a) => {
      const antes = (a.antes ?? {}) as Record<string, unknown>
      const despues = (a.despues ?? {}) as Record<string, unknown>
      const cambios =
        a.accion === 'UPDATE'
          ? Object.keys(despues).filter((k) => !['busqueda', 'esc'].includes(k) && JSON.stringify(antes[k]) !== JSON.stringify(despues[k]))
          : []
      return {
        en: a.en,
        texto: `${ACCION_AUDITORIA[a.accion] ?? a.accion}${cambios.length ? ` · ${cambios.slice(0, 4).join(', ')}${cambios.length > 4 ? '…' : ''}` : ''}`,
        quien: a.actor ? (nombre.get(a.actor) ?? 'Alguien') : 'Sistema',
      }
    }),
  }
}

/** Las solicitudes de aprobación del objeto (todas sus versiones). */
async function aprobacionesDe(supabase: Cliente, ids: string[]): Promise<Ficha['aprobaciones']> {
  if (!ids.length) return []
  const { data } = await supabase
    .schema('flujo')
    .from('solicitud')
    .select('id, tipo_objeto, objeto_id, titulo, estado, creado_en, paso(orden, nombre, decision, decidido_en)')
    .in('objeto_id', ids)
    .order('creado_en', { ascending: false })
    .range(0, 9)
  return (data ?? []).map((s) => ({
    titulo: s.titulo,
    estado: ESTADO_SOLICITUD[s.estado]?.etiqueta ?? s.estado,
    creado_en: s.creado_en,
    href: enlaceObjeto(s.tipo_objeto, s.objeto_id),
    pasos: ((s.paso ?? []) as { orden: number; nombre: string; decision: string; decidido_en: string | null }[])
      .sort((a, b) => a.orden - b.orden)
      .map((p) => ({ ...p, decision: DECISION[p.decision]?.etiqueta ?? p.decision })),
  }))
}

const vigente = (d: string) => `[${d},${d}]`

export async function cargarFicha(sesion: Sesion, tipo: TipoFicha, id: string): Promise<Ficha | null> {
  const [recurso, accion] = PERMISO[tipo]
  const alcanza = puede(sesion, recurso, accion) || (tipo === 'requisicion' && puede(sesion, recurso))
  if (!alcanza) return null
  const supabase = await createClient()
  const hoy = hoyCaracas()
  const org = supabase.schema('org')
  const sgc = supabase.schema('sgc')

  switch (tipo) {
    case 'unidad': {
      const [{ data: versiones }, { data: plazas }, { data: hijas }] = await Promise.all([
        org.from('unidad').select('id, nombre, tipo, clave, codigo_organigrama, sede, padre_ref, certeza, fuente, nota, vigencia').eq('ref', id).is('escenario_id', null).order('vigencia', { ascending: false }),
        supabase.schema('ui').rpc('plazas', { p_al: hoy }).eq('unidad_ref', id).order('cargo').range(0, 199),
        org.from('unidad').select('ref, nombre, tipo').eq('padre_ref', id).is('escenario_id', null).filter('vigencia', 'cs', vigente(hoy)).order('orden').range(0, 49),
      ])
      const u = versiones?.[0]
      if (!u) return null
      const { data: padre } = u.padre_ref
        ? await org.from('unidad').select('ref, nombre').eq('ref', u.padre_ref).is('escenario_id', null).filter('vigencia', 'cs', vigente(hoy)).maybeSingle()
        : { data: null }
      const filas = plazas ?? []
      const dot = filas.reduce((s, p) => s + (p.dotacion ?? 0), 0)
      const ocu = filas.reduce((s, p) => s + (p.ocupadas ?? 0), 0)
      const f = vacia('unidad', id, u.nombre)
      const { linea, visible } = await lineaDe(supabase, sesion, 'org', 'unidad', (versiones ?? []).map((v) => v.id))
      return {
        ...f,
        subtitulo: [u.tipo, u.sede].filter(Boolean).join(' · '),
        codigo: u.codigo_organigrama,
        estado: u.certeza === 'inferencia' ? { etiqueta: 'Inferido', tono: 'ambar' } : { etiqueta: 'Vigente', tono: 'verde' },
        hrefModulo: `/sistema/nucleo/organizacion/unidades/${id}`,
        datos: [
          { etiqueta: 'Código', valor: u.codigo_organigrama ?? '—', mono: true },
          { etiqueta: 'Tipo', valor: u.tipo },
          { etiqueta: 'Sede', valor: u.sede ?? '—' },
          { etiqueta: 'Dotación', valor: `${numero(ocu)} ocupadas de ${numero(dot)} aprobadas` },
          { etiqueta: 'Plazas', valor: numero(filas.length) },
          { etiqueta: 'Certeza', valor: u.certeza === 'hecho' ? 'Hecho (con fuente)' : 'Inferencia' },
          { etiqueta: 'Fuente', valor: u.fuente ?? '—' },
          { etiqueta: 'Versiones', valor: numero(versiones?.length ?? 0) },
          ...(u.nota ? [{ etiqueta: 'Nota', valor: u.nota }] : []),
        ],
        relaciones: [
          ...(padre ? [{ tipo: 'Depende de', titulo: padre.nombre, ficha: `unidad:${padre.ref}` }] : []),
          ...(hijas ?? []).map((h) => ({ tipo: 'Unidad hija', titulo: h.nombre, detalle: h.tipo, ficha: `unidad:${h.ref}` })),
          ...filas.slice(0, 40).map((p) => ({
            tipo: 'Plaza',
            titulo: p.cargo ?? 'Cargo',
            detalle: `${numero(p.ocupadas)}/${numero(p.dotacion)}${p.exceso ? ` · ${p.exceso} por encima` : p.vacantes ? ` · ${p.vacantes} vacante${p.vacantes === 1 ? '' : 's'}` : ''}`,
            ficha: `plaza:${p.ref}`,
          })),
        ],
        linea,
        lineaVisible: visible,
      }
    }

    case 'plaza': {
      const [{ data: fila }, { data: versiones }, { data: ocupantes }] = await Promise.all([
        supabase.schema('ui').rpc('plazas', { p_al: hoy }).eq('ref', id).maybeSingle(),
        org.from('plaza').select('id, nota, fuente').eq('ref', id).is('escenario_id', null),
        org.from('ocupacion').select('tipo, vigencia, certeza, empleados(nombre_completo, ficha)').eq('plaza_ref', id).filter('vigencia', 'cs', vigente(hoy)).range(0, 49),
      ])
      if (!fila) return null
      const f = vacia('plaza', id, fila.cargo ?? 'Plaza')
      const { linea, visible } = await lineaDe(supabase, sesion, 'org', 'plaza', (versiones ?? []).map((v) => v.id))
      const estado: Ficha['estado'] =
        fila.exceso > 0
          ? { etiqueta: `${fila.exceso} por encima`, tono: 'rojo' }
          : fila.vacantes > 0
            ? { etiqueta: `${fila.vacantes} vacante${fila.vacantes === 1 ? '' : 's'}`, tono: 'ambar' }
            : { etiqueta: 'Completa', tono: 'verde' }
      return {
        ...f,
        subtitulo: fila.unidad,
        estado,
        hrefModulo: fila.unidad_ref ? `/sistema/nucleo/organizacion/unidades/${fila.unidad_ref}` : null,
        datos: [
          { etiqueta: 'Unidad', valor: fila.unidad ?? '—' },
          { etiqueta: 'Cargo', valor: fila.cargo ?? '—' },
          { etiqueta: 'Dotación', valor: numero(fila.dotacion) },
          { etiqueta: 'Ocupadas', valor: numero(fila.ocupadas) },
          { etiqueta: 'Nómina', valor: fila.nomina ?? '—' },
          { etiqueta: 'Sede', valor: fila.sede_nombre ?? '—' },
          { etiqueta: 'Certeza', valor: fila.certeza === 'hecho' ? 'Hecho (con fuente)' : 'Inferencia' },
          ...(versiones?.[0]?.fuente ? [{ etiqueta: 'Fuente', valor: versiones[0].fuente }] : []),
        ],
        relaciones: [
          ...(fila.unidad_ref ? [{ tipo: 'Unidad', titulo: fila.unidad ?? 'Unidad', ficha: `unidad:${fila.unidad_ref}` }] : []),
          ...(fila.cargo_id ? [{ tipo: 'Cargo', titulo: fila.cargo ?? 'Cargo', ficha: `cargo:${fila.cargo_id}` }] : []),
          ...(ocupantes ?? []).map((o) => {
            const e = o.empleados as unknown as { nombre_completo: string; ficha: string | null } | null
            return { tipo: o.tipo === 'titular' ? 'Ocupa' : `Ocupa (${o.tipo})`, titulo: e?.nombre_completo ?? 'Persona', detalle: e?.ficha ? `Ficha ${e.ficha}` : null }
          }),
        ],
        linea,
        lineaVisible: visible,
      }
    }

    case 'cargo': {
      const [{ data: c }, { data: plazas }] = await Promise.all([
        org.from('cargo').select('id, nombre, clave, familia, nivel, sinonimos, proposito, activo').eq('id', id).maybeSingle(),
        supabase.schema('ui').rpc('plazas', { p_al: hoy }).eq('cargo_id', id).order('unidad').range(0, 99),
      ])
      if (!c) return null
      const filas = plazas ?? []
      const { linea, visible } = await lineaDe(supabase, sesion, 'org', 'cargo', [id])
      return {
        ...vacia('cargo', id, c.nombre),
        subtitulo: c.familia,
        estado: c.activo ? { etiqueta: 'Activo', tono: 'verde' } : { etiqueta: 'Inactivo', tono: 'neutro' },
        hrefModulo: `/sistema/nucleo/organizacion/cargos/${id}`,
        datos: [
          { etiqueta: 'Clave', valor: c.clave, mono: true },
          { etiqueta: 'Familia', valor: c.familia ?? '—' },
          { etiqueta: 'Nivel', valor: c.nivel === null ? '—' : String(c.nivel) },
          { etiqueta: 'Sinónimos', valor: c.sinonimos?.length ? c.sinonimos.join(', ') : '—' },
          { etiqueta: 'Plazas', valor: `${numero(filas.length)} · dotación ${numero(filas.reduce((s, p) => s + (p.dotacion ?? 0), 0))}` },
          ...(c.proposito ? [{ etiqueta: 'Propósito', valor: c.proposito }] : []),
        ],
        relaciones: filas.map((p) => ({ tipo: 'Plaza', titulo: p.unidad ?? 'Unidad', detalle: `${numero(p.ocupadas)}/${numero(p.dotacion)}`, ficha: `plaza:${p.ref}` })),
        linea,
        lineaVisible: visible,
      }
    }

    case 'proceso': {
      const { data: versiones } = await sgc
        .from('proceso')
        .select('id, nombre, nivel, tipo, codigo_sgc, codigo_informe, estado, estado_operativo, version, padre_ref, dueno_texto, area_texto, vigencia')
        .eq('ref', id)
        .is('escenario_id', null)
        .order('version', { ascending: false })
      const p = versiones?.find((v) => v.estado === 'vigente') ?? versiones?.[0]
      if (!p) return null
      const [{ data: padre }, { data: hijos }, { data: docs }, aprob, hist] = await Promise.all([
        p.padre_ref ? sgc.from('proceso').select('ref, nombre, codigo_sgc').eq('ref', p.padre_ref).is('escenario_id', null).eq('estado', 'vigente').maybeSingle() : Promise.resolve({ data: null }),
        sgc.from('proceso').select('ref, nombre, codigo_sgc, nivel').eq('padre_ref', id).is('escenario_id', null).eq('estado', 'vigente').order('orden').range(0, 79),
        sgc.from('documento').select('id, codigo, titulo, estado').eq('proceso_ref', id).order('codigo').range(0, 99),
        aprobacionesDe(supabase, (versiones ?? []).map((v) => v.id)),
        lineaDe(supabase, sesion, 'sgc', 'proceso', (versiones ?? []).map((v) => v.id)),
      ])
      return {
        ...vacia('proceso', id, p.nombre),
        subtitulo: `Nivel ${p.nivel}${p.area_texto ? ` · ${p.area_texto}` : ''}`,
        codigo: p.codigo_sgc ?? p.codigo_informe,
        estado: p.estado === 'vigente' ? { etiqueta: `Vigente · v${p.version}`, tono: 'verde' } : { etiqueta: `${p.estado} · v${p.version}`, tono: 'ambar' },
        hrefModulo: `/sistema/nucleo/procesos/${id}`,
        datos: [
          { etiqueta: 'Código SGC', valor: p.codigo_sgc ?? '—', mono: true },
          { etiqueta: 'Código del informe', valor: p.codigo_informe ?? '—', mono: true },
          { etiqueta: 'Nivel', valor: String(p.nivel) },
          { etiqueta: 'Tipo', valor: p.tipo ?? '—' },
          { etiqueta: 'Operación', valor: p.estado_operativo },
          { etiqueta: 'Dueño', valor: p.dueno_texto ?? '—' },
          { etiqueta: 'Área', valor: p.area_texto ?? '—' },
          { etiqueta: 'Versión', valor: `${p.version} de ${versiones?.length ?? 1}` },
        ],
        relaciones: [
          ...(padre ? [{ tipo: 'Pertenece a', titulo: padre.nombre, detalle: padre.codigo_sgc, ficha: `proceso:${padre.ref}` }] : []),
          ...(hijos ?? []).map((h) => ({ tipo: `Nivel ${h.nivel}`, titulo: h.nombre, detalle: h.codigo_sgc, ficha: `proceso:${h.ref}` })),
        ],
        documentos: (docs ?? []).map((d) => ({ codigo: d.codigo, titulo: d.titulo, estado: d.estado, href: `/sistema/nucleo/documentos/${d.id}` })),
        aprobaciones: aprob,
        linea: hist.linea,
        lineaVisible: hist.visible,
      }
    }

    case 'documento': {
      const { data: d } = await sgc
        .from('documento')
        .select('id, codigo, titulo, version, fecha, estado, perimetro, datos_sensibles, familia, destino, alias, tipo_yy, proceso_xx, proceso_ref, nota')
        .eq('id', id)
        .maybeSingle()
      if (!d) return null
      const [{ data: proc }, hist] = await Promise.all([
        d.proceso_ref ? sgc.from('proceso').select('ref, nombre, codigo_sgc').eq('ref', d.proceso_ref).is('escenario_id', null).eq('estado', 'vigente').maybeSingle() : Promise.resolve({ data: null }),
        lineaDe(supabase, sesion, 'sgc', 'documento', [id]),
      ])
      const tono: TonoFicha = d.estado === 'vigente' ? 'verde' : d.estado === 'obsoleto' || d.estado === 'retirado' ? 'neutro' : 'ambar'
      return {
        ...vacia('documento', id, d.titulo),
        subtitulo: d.familia,
        codigo: d.codigo,
        estado: { etiqueta: d.estado.replace('_', ' '), tono },
        hrefModulo: `/sistema/nucleo/documentos/${id}`,
        datos: [
          { etiqueta: 'Código', valor: d.codigo, mono: true },
          { etiqueta: 'Versión', valor: d.version ?? '—' },
          { etiqueta: 'Fecha', valor: fechaCorta(d.fecha) },
          { etiqueta: 'Tipo (YY)', valor: d.tipo_yy ?? '—', mono: true },
          { etiqueta: 'Proceso (XX)', valor: d.proceso_xx ?? '—', mono: true },
          { etiqueta: 'Perímetro', valor: d.perimetro === 'general' ? 'General' : `🔒 ${d.perimetro}` },
          { etiqueta: 'Datos sensibles', valor: d.datos_sensibles ? 'Sí' : 'No' },
          { etiqueta: 'Destino', valor: d.destino ?? '—' },
          { etiqueta: 'Alias', valor: d.alias?.length ? d.alias.join(', ') : '—' },
          ...(d.nota ? [{ etiqueta: 'Nota', valor: d.nota }] : []),
        ],
        relaciones: proc ? [{ tipo: 'Proceso', titulo: proc.nombre, detalle: proc.codigo_sgc, ficha: `proceso:${proc.ref}` }] : [],
        linea: hist.linea,
        lineaVisible: hist.visible,
        perimetro: d.perimetro !== 'general' || d.datos_sensibles,
      }
    }

    case 'requisicion': {
      const { data: r } = await org
        .from('requisicion')
        .select('id, numero, unidad_ref, cargo_id, plaza_ref, origen, cantidad, tipo_nomina, justificacion, fecha_deseada, estado, candidato, fecha_ingreso, creado_en, cargo(nombre)')
        .eq('id', id)
        .maybeSingle()
      if (!r) return null
      const [{ data: unidad }, aprob, hist] = await Promise.all([
        org.from('unidad').select('ref, nombre').eq('ref', r.unidad_ref).is('escenario_id', null).filter('vigencia', 'cs', vigente(hoy)).maybeSingle(),
        aprobacionesDe(supabase, [id]),
        lineaDe(supabase, sesion, 'org', 'requisicion', [id]),
      ])
      const cargo = (r.cargo as unknown as { nombre: string } | null)?.nombre ?? 'Cargo'
      const est = ESTADO_REQUISICION[r.estado]
      return {
        ...vacia('requisicion', id, `Requisición N.º ${r.numero} · ${cargo}`),
        subtitulo: unidad?.nombre ?? null,
        codigo: `N.º ${r.numero}`,
        estado: est ? { etiqueta: est.etiqueta, tono: TONO_INSIGNIA[est.tono] ?? 'neutro' } : null,
        hrefModulo: `/sistema/nucleo/organizacion/requisiciones/${id}`,
        datos: [
          { etiqueta: 'Cargo', valor: cargo },
          { etiqueta: 'Unidad', valor: unidad?.nombre ?? '—' },
          { etiqueta: 'Cantidad', valor: numero(r.cantidad) },
          { etiqueta: 'Origen', valor: r.origen },
          { etiqueta: 'Nómina', valor: r.tipo_nomina ?? '—' },
          { etiqueta: 'Fecha deseada', valor: fechaCorta(r.fecha_deseada) },
          { etiqueta: 'Pedida', valor: fechaHora(r.creado_en) },
          ...(r.candidato ? [{ etiqueta: 'Candidato', valor: r.candidato }] : []),
          { etiqueta: 'Justificación', valor: r.justificacion },
        ],
        relaciones: [
          ...(unidad ? [{ tipo: 'Unidad', titulo: unidad.nombre, ficha: `unidad:${unidad.ref}` }] : []),
          { tipo: 'Cargo', titulo: cargo, ficha: `cargo:${r.cargo_id}` },
          ...(r.plaza_ref ? [{ tipo: 'Cubre la plaza', titulo: cargo, ficha: `plaza:${r.plaza_ref}` }] : []),
        ],
        aprobaciones: aprob,
        linea: hist.linea,
        lineaVisible: hist.visible,
        // Lo salarial vive aparte (`org.requisicion_costo`, perímetro de nómina) y
        // esta ficha no lo lee.
      }
    }
  }
}
