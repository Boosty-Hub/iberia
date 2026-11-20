/**
 * Siembra contenido FICTICIO del canal en el PROYECTO DE PRUEBAS, para mirar y
 * probar la app y su administración (NUC-CAN) sin tocar producción. El proyecto
 * de pruebas tiene el padrón real copiado, pero no tiene publicaciones,
 * conversaciones ni grupos: esto los inventa, con gente de prueba.
 *
 *   node --env-file=.env.local scripts/plataforma/sembrar-canal-pruebas.mjs --clave "<clave de prueba>"
 *   node --env-file=.env.local scripts/plataforma/sembrar-canal-pruebas.mjs --limpiar
 *
 * Nunca copia nada de producción: todo el texto está escrito aquí y lleva
 * «(demo)». La gente es de prueba:
 *   · canal.pruebas@plataforma.local    — «Operaria Prueba», planta, rol Personal de planta,
 *                                          con plaza en la estructura (para «Mi cargo»).
 *   · comunica.pruebas@plataforma.local — «Comunicaciones Prueba», gerencia, rol Lector Iberia,
 *                                          publica y modera (para probar:canal y capturar:canal).
 *   · cuatro fichas sin cuenta (cédula PRUEBA-CANAL-*) que firman publicaciones y mensajes.
 * Las dos cuentas llevan la clave que se pase con --clave (solo existen aquí).
 *
 * `--limpiar` borra todo lo sembrado —fichas, cuentas, contenido, tareas, avisos y
 * la plaza ocupada— y barre por prefijo: recoge también una siembra a medias.
 */
import { createClient } from '@supabase/supabase-js'

const e = process.env
const URL_SUPA = e.SUPABASE_PRUEBAS_URL
const SECRETO = e.SUPABASE_PRUEBAS_SECRET_KEY
const REF = e.SUPABASE_PRUEBAS_REF
const TOKEN = e.SUPABASE_ACCESS_TOKEN
if (!URL_SUPA || !SECRETO || !REF || !TOKEN) throw new Error('Faltan SUPABASE_PRUEBAS_URL, SUPABASE_PRUEBAS_SECRET_KEY, SUPABASE_PRUEBAS_REF o SUPABASE_ACCESS_TOKEN')
if (REF === e.SUPABASE_PROJECT_REF || !URL_SUPA.includes(REF) || (e.SUPABASE_PROJECT_REF && URL_SUPA.includes(e.SUPABASE_PROJECT_REF)))
  throw new Error('Esto solo corre contra el proyecto de PRUEBAS')

const argv = process.argv.slice(2)
const LIMPIAR = argv.includes('--limpiar')
const CLAVE = argv.includes('--clave') ? argv[argv.indexOf('--clave') + 1] : e.CANAL_PRUEBAS_CLAVE
if (!LIMPIAR && (!CLAVE || CLAVE.length < 10)) throw new Error('Pasa --clave con al menos 10 caracteres (la de las dos cuentas de prueba)')

const admin = createClient(URL_SUPA, SECRETO, { auth: { persistSession: false } })

/** SQL por la Management API, solo al proyecto de pruebas. */
async function sql(q) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: q }),
  })
  const texto = await r.text()
  if (!r.ok) throw new Error(`SQL ${r.status}: ${texto.slice(0, 600)}`)
  return JSON.parse(texto)
}
const lit = (v) => (v === null || v === undefined ? 'null' : `'${String(v).replaceAll("'", "''")}'`)

const CUENTAS = {
  canal: { email: 'canal.pruebas@plataforma.local', nombre: 'Operaria Prueba', rol: 'personal-planta', cedula: 'PRUEBA-CANAL-OPERARIA', nivel: 'planta', cargo: 'INSPECTORA DE PROCESO (PRUEBA)', sede: 'cagua', publica: false },
  comunica: { email: 'comunica.pruebas@plataforma.local', nombre: 'Comunicaciones Prueba', rol: 'lector', cedula: 'PRUEBA-CANAL-COMUNICA', nivel: 'gerencia', cargo: 'GERENTE DE COMUNICACIONES (PRUEBA)', sede: 'caracas', publica: true },
}
const FICHAS = [
  { cedula: 'PRUEBA-CANAL-01', nombre: 'Ana Prueba', nivel: 'administrativo', cargo: 'ANALISTA DE CAPITAL HUMANO (PRUEBA)', sede: 'caracas' },
  { cedula: 'PRUEBA-CANAL-02', nombre: 'Luis Prueba', nivel: 'planta', cargo: 'OPERADOR DE ENVASADO (PRUEBA)', sede: 'cagua' },
  { cedula: 'PRUEBA-CANAL-03', nombre: 'Carmen Prueba', nivel: 'jefatura', cargo: 'JEFA DE TURNO (PRUEBA)', sede: 'cagua' },
  { cedula: 'PRUEBA-CANAL-04', nombre: 'Pedro Prueba', nivel: 'direccion', cargo: 'DIRECTOR DE OPERACIONES (PRUEBA)', sede: 'caracas' },
]

async function usuario(email) {
  for (let pagina = 1; pagina <= 20; pagina++) {
    const { data } = await admin.auth.admin.listUsers({ page: pagina, perPage: 200 })
    const u = data?.users?.find((x) => x.email === email)
    if (u) return u
    if ((data?.users?.length ?? 0) < 200) return null
  }
  return null
}

async function limpiar() {
  const perfiles = []
  for (const c of Object.values(CUENTAS)) {
    const u = await usuario(c.email)
    if (u) perfiles.push(u.id)
  }
  const enPerfiles = perfiles.length ? `(${perfiles.map(lit).join(',')})` : '(null)'
  await sql(`
    with fichas as (select id from public.empleados where cedula like 'PRUEBA-CANAL-%')
    delete from public.reportes where reportante_id in (select id from fichas) or autor_id in (select id from fichas);
  `)
  await sql(`delete from nucleo.notificacion where destinatario in ${enPerfiles};`)
  await sql(`delete from nucleo.tarea where asignada_a in ${enPerfiles} or creada_por in ${enPerfiles};`)
  await sql(`delete from org.ocupacion where empleado_id in (select id from public.empleados where cedula like 'PRUEBA-CANAL-%');`)
  await sql(`delete from public.publicaciones where autor_id in (select id from public.empleados where cedula like 'PRUEBA-CANAL-%') or (autor_id is null and titulo like '%(demo)%');`)
  await sql(`delete from public.grupos where creador_id in (select id from public.empleados where cedula like 'PRUEBA-CANAL-%') or nombre like '%(demo)%';`)
  await sql(`
    delete from public.conversaciones c
     where c.tipo = 'directa'
       and exists (select 1 from public.conversacion_participantes p join public.empleados e on e.id = p.empleado_id
                    where p.conversacion_id = c.id and e.cedula like 'PRUEBA-CANAL-%');
  `)
  await sql(`delete from public.dispositivos where perfil_id in ${enPerfiles};`).catch(() => {})
  await sql(`delete from public.empleados where cedula like 'PRUEBA-CANAL-%';`)
  for (const id of perfiles) await admin.auth.admin.deleteUser(id)
  const [{ n }] = await sql(`select count(*)::int as n from public.empleados where cedula like 'PRUEBA-CANAL-%'`)
  console.log(`Limpieza hecha: ${perfiles.length} cuenta(s) de prueba borradas, ${n} fichas de prueba quedan.`)
}

async function asegurarCuenta(c) {
  let u = await usuario(c.email)
  if (!u) {
    const { data, error } = await admin.auth.admin.createUser({
      email: c.email,
      password: CLAVE,
      email_confirm: true,
      user_metadata: { nombre_completo: c.nombre, rol_clave: c.rol, organizacion: 'iberia', normas_aceptadas_version: 1 },
    })
    if (error) throw new Error(`no se pudo crear ${c.email}: ${error.message}`)
    u = data.user
  } else {
    await admin.auth.admin.updateUserById(u.id, { password: CLAVE })
  }
  // Las normas del canal aceptadas, para que la app abra directo (la pantalla de
  // normas se prueba aparte).
  const { data: v } = await admin.auth.admin.getUserById(u.id)
  await admin.auth.admin.updateUserById(u.id, {
    user_metadata: { ...(v.user?.user_metadata ?? {}), normas_aceptadas_version: 1, normas_aceptadas_en: new Date().toISOString() },
  })
  const { data: rol } = await admin.from('roles').select('id').eq('clave', c.rol).single()
  await admin.from('profiles').update({ rol_id: rol.id, activo: true, nombre_completo: c.nombre }).eq('id', u.id)
  return u.id
}

async function sembrar() {
  await limpiar()
  const perfil = {}
  for (const [k, c] of Object.entries(CUENTAS)) perfil[k] = await asegurarCuenta(c)
  const adminPruebas = await usuario('admin.pruebas@plataforma.local')
  if (!adminPruebas) throw new Error('Falta la cuenta admin.pruebas (córrela una vez con mirar.mjs)')

  // Un área y una plaza vacante de la estructura para «Mi cargo»: la que tenga
  // documentos vigentes en los procesos de su unidad y un jefe con titular.
  const [area] = await sql(`select id, nombre from public.areas order by nombre limit 1`)
  const [plaza] = await sql(`
    with pl as (
      select p.ref, p.cargo_id, p.unidad_ref, p.reporta_a_ref, p.dotacion,
             (select count(*) from org.ocupacion o where o.plaza_ref = p.ref and o.tipo = 'titular' and o.vigencia @> org.hoy()) as tit
        from org.plaza p where p.escenario_id is null and p.vigencia @> org.hoy()
    ), duenos as (
      select pr.ref as proc, x.unidad_ref from sgc.proceso pr
        join org.plaza x on x.ref = pr.dueno_plaza_ref and x.escenario_id is null and x.vigencia @> org.hoy()
       where pr.escenario_id is null and pr.estado = 'vigente'
    )
    select pl.ref from pl
     where pl.tit < pl.dotacion and pl.reporta_a_ref is not null
       and exists (select 1 from org.ocupacion o where o.plaza_ref = pl.reporta_a_ref and o.tipo = 'titular' and o.vigencia @> org.hoy())
     order by (select count(*) from sgc.documento d join duenos u on u.proc = d.proceso_ref
                where u.unidad_ref = pl.unidad_ref and d.estado = 'vigente' and d.perimetro = 'general' and not d.datos_sensibles) desc
     limit 1`)

  // Fichas (las dos con cuenta y las cuatro sin cuenta).
  const filas = [
    ...Object.entries(CUENTAS).map(([k, c]) => ({ ...c, perfil: perfil[k] })),
    ...FICHAS.map((f) => ({ ...f, perfil: null, email: null, publica: false })),
  ]
  await sql(`
    insert into public.empleados (cedula, nombre_completo, cargo, area_id, sede, nivel, email, perfil_id, puede_publicar, es_moderador, activo)
    values ${filas
      .map((f) => `(${lit(f.cedula)}, ${lit(f.nombre)}, ${lit(f.cargo)}, ${lit(area?.id)}, ${lit(f.sede)}, ${lit(f.nivel)}, ${lit(f.email)}, ${lit(f.perfil)}, ${f.publica}, ${f.publica}, true)`)
      .join(',\n')};
  `)
  const fichas = Object.fromEntries((await sql(`select cedula, id from public.empleados where cedula like 'PRUEBA-CANAL-%'`)).map((r) => [r.cedula, r.id]))
  const [yo, comunica, ana, luis, carmen, pedro] = ['PRUEBA-CANAL-OPERARIA', 'PRUEBA-CANAL-COMUNICA', 'PRUEBA-CANAL-01', 'PRUEBA-CANAL-02', 'PRUEBA-CANAL-03', 'PRUEBA-CANAL-04'].map((c) => fichas[c])

  if (plaza) {
    await sql(`insert into org.ocupacion (plaza_ref, empleado_id, tipo, vigencia, motivo, certeza)
               values (${lit(plaza.ref)}, ${lit(yo)}, 'titular', daterange(org.hoy() - 90, null), 'Siembra de prueba del canal', 'manual')`)
  }

  // El feed: un comunicado oficial fijado, noticias, una historia, un evento,
  // una archivada y un borrador. Fechas en los últimos días.
  const pubs = [
    { tipo: 'comunicado', titulo: 'Jornada de vacunación en la planta de Cagua (demo)', bajada: 'El jueves de 8:00 a 12:00 en el comedor. Trae tu cédula.', autor: null, oficial: true, fijado: true, estado: 'publicado', dias: 1 },
    { tipo: 'noticia', titulo: 'La nueva línea de envasado arranca en diciembre (demo)', bajada: 'Tres semanas de pruebas antes de producir para la venta.', autor: carmen, oficial: false, fijado: false, estado: 'publicado', dias: 2 },
    { tipo: 'nuestra_gente', titulo: 'Diez años en el turno de la mañana (demo)', bajada: 'Luis cuenta cómo cambió la planta desde que llegó.', autor: luis, oficial: false, fijado: false, estado: 'publicado', dias: 3 },
    { tipo: 'evento', titulo: 'Torneo de dominó del viernes (demo)', bajada: 'Inscripciones con Ana hasta el miércoles.', autor: ana, oficial: false, fijado: false, estado: 'publicado', dias: 5 },
    { tipo: 'noticia', titulo: 'Aviso viejo que ya no aplica (demo)', bajada: 'Se archivó al terminar la actividad.', autor: comunica, oficial: false, fijado: false, estado: 'archivado', dias: 20 },
    { tipo: 'noticia', titulo: 'Borrador del boletín de diciembre (demo)', bajada: null, autor: comunica, oficial: false, fijado: false, estado: 'borrador', dias: 0 },
  ]
  await sql(`
    insert into public.publicaciones (tipo, titulo, bajada, audiencia, autor_id, estado, oficial, fijado, publicado_en)
    values ${pubs
      .map((p) => `(${lit(p.tipo)}, ${lit(p.titulo)}, ${lit(p.bajada)}, 'todos', ${lit(p.autor)}, ${lit(p.estado)}, ${p.oficial}, ${p.fijado}, ${p.estado === 'borrador' ? 'null' : `now() - interval '${p.dias} days'`})`)
      .join(',\n')};
  `)
  const pid = Object.fromEntries((await sql(`select titulo, id from public.publicaciones where titulo like '%(demo)%'`)).map((r) => [r.titulo, r.id]))
  const domino = pid['Torneo de dominó del viernes (demo)']
  const vacuna = pid['Jornada de vacunación en la planta de Cagua (demo)']
  const linea = pid['La nueva línea de envasado arranca en diciembre (demo)']
  await sql(`
    insert into public.publicacion_lecturas (publicacion_id, empleado_id, origen) values
      (${lit(vacuna)}, ${lit(ana)}, 'feed'), (${lit(vacuna)}, ${lit(luis)}, 'feed'), (${lit(vacuna)}, ${lit(carmen)}, 'feed'),
      (${lit(linea)}, ${lit(luis)}, 'feed'), (${lit(linea)}, ${lit(comunica)}, 'feed');
    insert into public.reacciones (publicacion_id, empleado_id, tipo) values
      (${lit(linea)}, ${lit(luis)}, 'celebro'), (${lit(domino)}, ${lit(carmen)}, 'me_gusta');
  `)

  // Grupos: uno cerrado del turno y uno abierto, con su conversación.
  const gTurno = crypto.randomUUID()
  const gFutbol = crypto.randomUUID()
  const cTurno = crypto.randomUUID()
  const cFutbol = crypto.randomUUID()
  const cDirecta = crypto.randomUUID()
  const cDirecta2 = crypto.randomUUID()
  await sql(`
    insert into public.grupos (id, nombre, proposito, tipo, creador_id, area_id) values
      (${lit(gTurno)}, 'Turno mañana · Cagua (demo)', 'Coordinación del turno de la mañana', 'cerrado', ${lit(carmen)}, ${lit(area?.id)}),
      (${lit(gFutbol)}, 'Fútbol de los sábados (demo)', 'Para cuadrar los partidos', 'abierto', ${lit(luis)}, null);
    insert into public.grupo_miembros (grupo_id, empleado_id, rol) values
      (${lit(gTurno)}, ${lit(carmen)}, 'coordinador'), (${lit(gTurno)}, ${lit(luis)}, 'miembro'), (${lit(gTurno)}, ${lit(yo)}, 'miembro'), (${lit(gTurno)}, ${lit(ana)}, 'miembro'),
      (${lit(gFutbol)}, ${lit(luis)}, 'coordinador'), (${lit(gFutbol)}, ${lit(yo)}, 'miembro'), (${lit(gFutbol)}, ${lit(pedro)}, 'miembro');
    insert into public.conversaciones (id, tipo, grupo_id) values
      (${lit(cTurno)}, 'grupo', ${lit(gTurno)}), (${lit(cFutbol)}, 'grupo', ${lit(gFutbol)}),
      (${lit(cDirecta)}, 'directa', null), (${lit(cDirecta2)}, 'directa', null);
    insert into public.conversacion_participantes (conversacion_id, empleado_id, visto_en) values
      (${lit(cTurno)}, ${lit(carmen)}, now()), (${lit(cTurno)}, ${lit(luis)}, now()), (${lit(cTurno)}, ${lit(yo)}, now() - interval '2 days'), (${lit(cTurno)}, ${lit(ana)}, null),
      (${lit(cFutbol)}, ${lit(luis)}, now()), (${lit(cFutbol)}, ${lit(yo)}, null), (${lit(cFutbol)}, ${lit(pedro)}, now()),
      (${lit(cDirecta)}, ${lit(yo)}, now() - interval '1 day'), (${lit(cDirecta)}, ${lit(luis)}, now()),
      (${lit(cDirecta2)}, ${lit(comunica)}, now()), (${lit(cDirecta2)}, ${lit(ana)}, now());
    insert into public.mensajes (conversacion_id, autor_id, texto, created_at) values
      (${lit(cTurno)}, ${lit(carmen)}, 'Buenos días. Mañana la reunión del turno es a las 6:45 (demo).', now() - interval '26 hours'),
      (${lit(cTurno)}, ${lit(luis)}, 'Listo, ahí estaré (demo).', now() - interval '25 hours'),
      (${lit(cTurno)}, ${lit(luis)}, 'Vendo rifa, número a 1 dólar, escríbanme (demo).', now() - interval '3 hours'),
      (${lit(cFutbol)}, ${lit(luis)}, '¿Quién juega este sábado? (demo)', now() - interval '2 days'),
      (${lit(cFutbol)}, ${lit(pedro)}, 'Cuenten conmigo (demo).', now() - interval '47 hours'),
      (${lit(cDirecta)}, ${lit(luis)}, 'Te dejé la planilla en el casillero (demo).', now() - interval '5 hours'),
      (${lit(cDirecta2)}, ${lit(ana)}, '¿Publicamos lo del dominó esta semana? (demo)', now() - interval '6 days');
    insert into public.conexiones (solicita_id, recibe_id, estado) values (${lit(ana)}, ${lit(yo)}, 'pendiente');
  `)

  // Dos reportes con el extracto congelado, como los deja reportar_contenido().
  await sql(`
    insert into public.reportes (tipo, contenido_id, reportante_id, autor_id, motivo, detalle, extracto, contexto)
    select 'mensaje', m.id, ${lit(yo)}, ${lit(luis)}, 'spam', 'Ventas en el grupo del turno (demo)', m.texto, 'Turno mañana · Cagua (demo)'
      from public.mensajes m where m.conversacion_id = ${lit(cTurno)} and m.texto like 'Vendo rifa%';
    insert into public.reportes (tipo, contenido_id, reportante_id, autor_id, motivo, extracto, contexto)
    values ('publicacion', ${lit(domino)}, ${lit(comunica)}, ${lit(ana)}, 'otro', 'Torneo de dominó del viernes (demo)' || E'\\n' || 'Inscripciones con Ana hasta el miércoles.', 'Evento');
  `)

  // Lo de la plataforma para la operaria: dos tareas (el trigger le avisa) y una
  // mención en un documento que su cuenta no abre (vista de lectura del aviso).
  await sql(`
    insert into nucleo.tarea (titulo, detalle, asignada_a, creada_por, vence) values
      ('Revisar el instructivo de limpieza de la línea 3 (demo)', 'Léelo antes del lunes y anota dudas para la reunión del turno.', ${lit(perfil.canal)}, ${lit(adminPruebas.id)}, org.hoy() + 2),
      ('Confirmar asistencia a la inducción de seguridad (demo)', null, ${lit(perfil.canal)}, ${lit(adminPruebas.id)}, org.hoy() - 1);
    insert into nucleo.notificacion (destinatario, tipo, objeto_tipo, objeto_id, actor, texto, detalle)
    select ${lit(perfil.canal)}, 'mencion', 'documento', d.id, ${lit(adminPruebas.id)},
           'Administración de pruebas te mencionó en ' || d.codigo || ' (demo)', 'Revisa la versión vigente antes del cambio de turno.'
      from sgc.documento d where d.estado = 'vigente' and d.perimetro = 'general' order by d.codigo limit 1;
    insert into nucleo.notificacion (destinatario, tipo, actor, texto, detalle, enlace)
    values (${lit(perfil.comunica)}, 'sistema', ${lit(adminPruebas.id)}, 'Hay un reporte nuevo en el canal (demo)', 'Revísalo en Moderación.', '/sistema/nucleo/canal/moderacion');
  `)

  const [cuentas] = await sql(`
    select (select count(*) from public.publicaciones where titulo like '%(demo)%')::int as publicaciones,
           (select count(*) from public.grupos where nombre like '%(demo)%')::int as grupos,
           (select count(*) from public.mensajes m join public.empleados e on e.id = m.autor_id where e.cedula like 'PRUEBA-CANAL-%')::int as mensajes,
           (select count(*) from public.reportes r join public.empleados e on e.id = r.reportante_id where e.cedula like 'PRUEBA-CANAL-%')::int as reportes,
           (select count(*) from nucleo.tarea where asignada_a = ${lit(perfil.canal)})::int as tareas,
           (select count(*) from nucleo.notificacion where destinatario in (${lit(perfil.canal)}, ${lit(perfil.comunica)}))::int as avisos`)
  console.log('Sembrado en PRUEBAS:', cuentas, plaza ? `· plaza ${plaza.ref}` : '· sin plaza vacante')
  console.log('Cuentas: canal.pruebas@plataforma.local (planta) y comunica.pruebas@plataforma.local (publica y modera), con la clave de --clave.')
}

if (LIMPIAR) await limpiar()
else await sembrar()
