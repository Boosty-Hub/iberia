-- =============================================================================
-- PLATAFORMA IBERIA · R4 · IA visible (Anexo E §7; cap. 04 §4–§6, NUC-GIA)
--
-- El esquema `ia`: el catálogo de capacidades con su nivel (N0–N4), su techo y
-- su interruptor; las propuestas de la IA sobre cada objeto; la actividad de la
-- IA (solo inserción); el interruptor general; y las solicitudes de cambio de
-- nivel, que suben por una ruta de aprobación (`nivel_ia`).
--
-- Reglas que la base hace cumplir:
--  · Toda capacidad nace en N0 y apagada; las que se construyen en R4 nacen en
--    el nivel que de verdad tienen (N1 la pregunta con cita, N2 la vigilancia de
--    plazas y la clasificación de documentos).
--  · Los perímetros (nómina, servicio médico, PCP, fórmulas) no tienen filas:
--    la capacidad no existe, no está «apagada».
--  · La IA consulta con la identidad de quien pregunta: las funciones de aquí
--    exigen sesión, recortan por `nucleo.puede_ver_objeto` y nunca leen un
--    documento de perímetro ni uno con datos sensibles.
--  · La IA no decide: aceptar, editar, rechazar (con motivo) y deshacer los hace
--    una persona; la IA solo aplica sola (N4) metadatos internos y reversibles,
--    con 12 horas para deshacer.
--  · Subir un nivel es configuración sensible: queda quién y por qué en
--    `ia.cambio_nivel` y pasa por la ruta «nivel_ia» (Gerente de TI revisa →
--    Gerente General aprueba), un nivel a la vez y nunca por encima del techo.
--    Bajar y apagar es inmediato, con una sola firma (cap. 04 §5.3).
--  · En la Fase 2 se encienden 10 capacidades como máximo (D-13).
--  · Cada llamada al modelo y cada acción quedan en `ia.actividad`, que no se
--    corrige ni se borra; se refleja en la línea de tiempo del objeto
--    (`nucleo.evento`) y en `control.auditoria` con `actor_es_ia`.
--  · Tope diario de gasto: `control.parametro` «ia_tope_diario_usd».
-- =============================================================================

create schema if not exists ia;
grant usage on schema ia to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 0) LA AUDITORÍA DISTINGUE PERSONA E IA
-- -----------------------------------------------------------------------------
alter table control.auditoria add column if not exists actor_es_ia boolean not null default false;

-- La misma función de siempre (cadena de hashes intacta), más la marca de IA:
-- la pone la actividad de la IA o una función que actúa por la IA dentro de su
-- transacción (`set_config('ia.actor', 'on', true)`).
create or replace function control.auditar()
returns trigger
language plpgsql
security definer
set search_path = control, public, extensions
as $$
declare
  v_previo text;
  v_antes jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end;
  v_despues jsonb := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end;
  v_fila jsonb := coalesce(v_despues, v_antes);
  v_id text := coalesce(
    v_fila ->> 'id',
    v_fila ->> 'codigo',
    v_fila ->> 'requisicion_id',
    case when v_fila ? 'rol_id' then (v_fila ->> 'rol_id') || ':' || (v_fila ->> 'recurso') end,
    case when v_fila ? 'tipo' and v_fila ? 'clave' then (v_fila ->> 'tipo') || ':' || (v_fila ->> 'clave') end,
    md5(v_fila::text));
  v_ia boolean := coalesce(current_setting('ia.actor', true), '') = 'on'
                  or (tg_table_schema = 'ia' and tg_table_name = 'actividad' and coalesce((v_fila ->> 'actor_es_ia')::boolean, false));
begin
  perform pg_advisory_xact_lock(hashtext('control.auditoria'));
  select hash into v_previo from control.auditoria order by id desc limit 1;
  insert into control.auditoria (esquema, tabla, registro_id, accion, antes, despues, hash_previo, hash, actor_es_ia)
  values (tg_table_schema, tg_table_name, v_id, tg_op, v_antes, v_despues, v_previo,
          encode(extensions.digest(coalesce(v_previo, '') || tg_table_schema || tg_table_name || v_id || tg_op
                 || coalesce(v_antes::text, '') || coalesce(v_despues::text, '') || clock_timestamp()::text, 'sha256'), 'hex'),
          v_ia);
  return coalesce(new, old);
end;
$$;

-- -----------------------------------------------------------------------------
-- 1) TABLAS
-- -----------------------------------------------------------------------------

-- El orden de los niveles (N0 < N1 < … < N4).
create or replace function ia.n(p text) returns integer language sql immutable as $$
  select case p when 'N0' then 0 when 'N1' then 1 when 'N2' then 2 when 'N3' then 3 when 'N4' then 4 end;
$$;

create table if not exists ia.capacidad (
  codigo        text primary key check (codigo ~ '^[A-Z]{3}-[A-Z]{2,4}-IA-[0-9]{2}$'),
  modulo        text not null,
  nombre        text not null,
  que_hace      text not null,
  uso           text not null check (uso in ('L', 'E', 'P', 'A')),
  nivel_actual  text not null default 'N0' check (nivel_actual in ('N0', 'N1', 'N2', 'N3', 'N4')),
  techo         text not null check (techo in ('N1', 'N2', 'N3', 'N4')),
  dueno_cargo   text not null,
  -- ¿Lee un perímetro? Siempre no: en un perímetro la capacidad no existe.
  perimetro     boolean not null default false,
  encendida     boolean not null default false,
  evidencia_para_subir text,
  -- Las fichas donde se ve (pestaña IA): unidad, plaza, proceso, documento…
  objeto_tipos  text[] not null default '{}',
  nota          text,
  creado_en     timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  constraint capacidad_sin_perimetro check (not perimetro and codigo !~ '^PER-(ADM|MED|PCP)-'),
  constraint capacidad_bajo_techo check (ia.n(nivel_actual) <= ia.n(techo)),
  constraint capacidad_encendida_con_nivel check (not encendida or nivel_actual <> 'N0')
);
alter table ia.capacidad enable row level security;

create table if not exists ia.interruptor_general (
  id          boolean primary key default true check (id),
  encendido   boolean not null default true,
  motivo      text,
  cambiado_por uuid references public.profiles (id),
  cambiado_en timestamptz not null default now()
);
alter table ia.interruptor_general enable row level security;
insert into ia.interruptor_general (id, encendido, motivo) values (true, true, 'Estado inicial de R4') on conflict do nothing;

create table if not exists ia.propuesta (
  id            uuid primary key default gen_random_uuid(),
  capacidad     text not null references ia.capacidad (codigo),
  regla         text not null,                       -- qué la disparó (exceso, sin_titular, inferida, clasificacion, estado)
  objeto_tipo   text not null check (objeto_tipo in ('unidad', 'plaza', 'cargo', 'persona', 'requisicion', 'escenario', 'proceso', 'documento')),
  objeto_id     uuid not null,
  nivel         text not null check (nivel in ('N1', 'N2', 'N3', 'N4')),
  titulo        text not null check (length(titulo) <= 300),
  cuerpo        text not null check (length(cuerpo) <= 2000),     -- lo que dice la regla (dato, no modelo)
  explicacion   text check (explicacion is null or length(explicacion) <= 1200), -- lo que redactó el modelo
  -- Las citas: [{tipo, id, campo, valor, fuente}]
  evidencia     jsonb not null default '[]'::jsonb,
  -- El cambio propuesto: {accion, …, cambios: {…}, antes: {…}}
  payload       jsonb not null default '{}'::jsonb,
  estado        text not null default 'pendiente' check (estado in ('pendiente', 'aceptada', 'editada', 'rechazada', 'revertida', 'expirada')),
  pedido_por    uuid references public.profiles (id) default auth.uid(),
  creado_en     timestamptz not null default now(),
  decidido_por  uuid references public.profiles (id),
  decidido_en   timestamptz,
  motivo        text check (motivo is null or length(motivo) <= 1000),
  deshacer_hasta timestamptz,
  constraint propuesta_rechazo_con_motivo check (estado <> 'rechazada' or coalesce(trim(motivo), '') <> '')
);
create index if not exists propuesta_objeto_idx on ia.propuesta (objeto_tipo, objeto_id, estado);
create index if not exists propuesta_capacidad_idx on ia.propuesta (capacidad, estado, creado_en desc);
create unique index if not exists propuesta_una_pendiente on ia.propuesta (capacidad, regla, objeto_id) where estado = 'pendiente';
alter table ia.propuesta enable row level security;

-- La actividad de la IA: solo inserción.
create table if not exists ia.actividad (
  id            uuid primary key default gen_random_uuid(),
  capacidad     text references ia.capacidad (codigo),
  nivel         text check (nivel in ('N0', 'N1', 'N2', 'N3', 'N4')),
  accion        text not null check (accion in ('respondio', 'propuso', 'explico', 'aplico', 'decidio', 'deshizo',
                                                'pidio_nivel', 'cambio_nivel', 'encendio', 'apago', 'interruptor', 'tope', 'bloqueo', 'error')),
  objeto_tipo   text check (objeto_tipo is null or objeto_tipo in ('unidad', 'plaza', 'cargo', 'persona', 'requisicion', 'escenario', 'proceso', 'documento')),
  objeto_id     uuid,
  propuesta_id  uuid references ia.propuesta (id),
  resumen       text not null check (length(resumen) <= 1000),
  evidencia     jsonb not null default '[]'::jsonb,
  actor_es_ia   boolean not null default true,
  pedido_por    uuid references public.profiles (id),
  aprobado_por  uuid references public.profiles (id),
  tokens_entrada integer not null default 0 check (tokens_entrada >= 0),
  tokens_salida  integer not null default 0 check (tokens_salida >= 0),
  costo_tokens  integer generated always as (tokens_entrada + tokens_salida) stored,
  costo_usd     numeric(10, 5) not null default 0 check (costo_usd >= 0),
  latencia_ms   integer check (latencia_ms is null or latencia_ms >= 0),
  modelo        text,
  creado_en     timestamptz not null default now(),
  constraint actividad_objeto_completo check ((objeto_tipo is null) = (objeto_id is null))
);
create index if not exists actividad_creado_idx on ia.actividad (creado_en desc);
create index if not exists actividad_capacidad_idx on ia.actividad (capacidad, creado_en desc);
create index if not exists actividad_objeto_idx on ia.actividad (objeto_tipo, objeto_id);
alter table ia.actividad enable row level security;

create table if not exists ia.cambio_nivel (
  id          uuid primary key default gen_random_uuid(),
  capacidad   text not null references ia.capacidad (codigo),
  de          text not null,
  a           text not null,
  motivo      text not null check (length(trim(motivo)) >= 5),
  evidencia   text,
  estado      text not null default 'pendiente' check (estado in ('pendiente', 'aplicado', 'rechazado', 'cancelado')),
  solicitud_id uuid references flujo.solicitud (id),
  pedido_por  uuid not null default auth.uid() references public.profiles (id),
  pedido_en   timestamptz not null default now(),
  cerrado_en  timestamptz
);
create unique index if not exists cambio_nivel_uno_pendiente on ia.cambio_nivel (capacidad) where estado = 'pendiente';
alter table ia.cambio_nivel enable row level security;

-- La actividad no se corrige ni se borra (ni con la clave de servicio: el
-- trigger corre igual).
create or replace function ia.actividad_inmutable()
returns trigger language plpgsql as $$
begin
  raise exception 'La actividad de la IA no se modifica ni se borra' using errcode = 'insufficient_privilege';
end;
$$;
drop trigger if exists actividad_inmutable on ia.actividad;
create trigger actividad_inmutable before update or delete on ia.actividad
  for each row execute function ia.actividad_inmutable();

-- Auditoría de todo lo de `ia` (la de la actividad sale marcada como IA).
do $$
declare t text;
begin
  foreach t in array array['capacidad', 'interruptor_general', 'propuesta', 'actividad', 'cambio_nivel'] loop
    execute format('drop trigger if exists auditar on ia.%I', t);
    execute format('create trigger auditar after insert or update or delete on ia.%I for each row execute function control.auditar()', t);
  end loop;
end;
$$;

-- La actividad sobre un objeto entra a su línea de tiempo (R3): la IA con su
-- capacidad y su nivel; la decisión de una persona, como evento del sistema.
create or replace function ia.reflejar_en_linea()
returns trigger language plpgsql security definer set search_path = nucleo, public as $$
begin
  if new.objeto_id is null or new.objeto_tipo is null then return null; end if;
  if new.actor_es_ia and new.nivel in ('N1', 'N2', 'N3', 'N4') and new.capacidad is not null then
    insert into nucleo.evento (objeto_tipo, objeto_id, tipo, autor, actor_es_ia, capacidad_ia, nivel_ia, texto, datos, creado_en)
    values (new.objeto_tipo, new.objeto_id, 'ia', null, true, new.capacidad, new.nivel, left(new.resumen, 4000),
            jsonb_build_object('accion', new.accion, 'actividad_id', new.id, 'propuesta_id', new.propuesta_id, 'pedido_por', new.pedido_por),
            new.creado_en);
  elsif not new.actor_es_ia and new.accion in ('decidio', 'deshizo') then
    insert into nucleo.evento (objeto_tipo, objeto_id, tipo, autor, texto, datos, creado_en)
    values (new.objeto_tipo, new.objeto_id, 'sistema', coalesce(new.aprobado_por, new.pedido_por), left(new.resumen, 4000),
            jsonb_build_object('accion', new.accion, 'actividad_id', new.id, 'propuesta_id', new.propuesta_id, 'capacidad', new.capacidad,
                               'resumen', new.resumen),
            new.creado_en);
  end if;
  return null;
exception when others then
  -- La línea de tiempo no tumba el registro de la IA.
  raise warning 'ia.reflejar_en_linea: %', sqlerrm;
  return null;
end;
$$;
drop trigger if exists reflejar_en_linea on ia.actividad;
create trigger reflejar_en_linea after insert on ia.actividad
  for each row execute function ia.reflejar_en_linea();

-- -----------------------------------------------------------------------------
-- 2) RLS: la IA se lee con los permisos de quien mira
-- -----------------------------------------------------------------------------
grant select on ia.capacidad, ia.interruptor_general, ia.propuesta, ia.actividad, ia.cambio_nivel to authenticated;
grant all on all tables in schema ia to service_role;

-- El catálogo y el interruptor no son secretos: cualquier sesión los lee (la
-- interfaz los necesita para saber qué pintar).
create policy "ver catálogo" on ia.capacidad for select to authenticated using (true);
create policy "ver interruptor" on ia.interruptor_general for select to authenticated using (true);
-- Una propuesta la lee quien puede leer su objeto.
create policy "ver propuestas del objeto" on ia.propuesta for select to authenticated
  using (nucleo.puede_ver_objeto(objeto_tipo, objeto_id));
-- La actividad: la de un objeto, quien puede leer el objeto; la que no tiene
-- objeto (una pregunta, un cambio de nivel), quien la pidió o quien gobierna.
create policy "ver actividad" on ia.actividad for select to authenticated
  using (case when objeto_id is not null then nucleo.puede_ver_objeto(objeto_tipo, objeto_id)
              else pedido_por = auth.uid() or public.puede('sistema:ia-actividad', 'ver') end);
create policy "ver cambios de nivel" on ia.cambio_nivel for select to authenticated
  using (pedido_por = auth.uid() or public.puede('sistema:ia', 'ver'));
-- Nada se escribe desde la API: todo pasa por las funciones de abajo.

-- -----------------------------------------------------------------------------
-- 3) PARÁMETROS, PERMISOS, MÓDULO Y RUTA
-- -----------------------------------------------------------------------------
insert into control.parametro (clave, nombre, valor, unidad, vigencia, fuente, por_confirmar)
select x.clave, x.nombre, x.valor, x.unidad, daterange(date '2026-11-20', null), 'R4 · propuesta inicial del equipo', true
  from (values ('ia_tope_diario_usd', 'Tope diario de gasto de la IA', 2.0000::numeric, 'USD'),
               ('ia_dias_plaza_sin_titular', 'Días sin titular para que la IA marque una plaza', 90.0000::numeric, 'días')) as x(clave, nombre, valor, unidad)
 where not exists (select 1 from control.parametro p where p.clave = x.clave);

-- Los recursos nuevos de la matriz (`lib/permisos.ts`): el equipo consultor
-- gobierna y lee la actividad; los demás roles entran apagados.
insert into public.rol_permisos (rol_id, recurso, ver, crear, editar, eliminar)
select r.id, x.recurso, true, false, x.editar, false
  from public.roles r
 cross join (values ('sistema:ia', true), ('sistema:ia-actividad', false)) as x(recurso, editar)
 where r.clave = 'consultor'
on conflict do nothing;

update control.modulo
   set estado = 'en_construccion', ruta = '/sistema/administracion/ia', recurso = 'sistema:ia',
       descripcion = coalesce(descripcion, 'Capacidades de IA con su nivel, techo, dueño e interruptor; la actividad de la IA, que no se borra.')
 where codigo = 'NUC-GIA';

-- La ruta para subir un nivel: Tecnología revisa, la Gerencia General aprueba.
insert into flujo.ruta (tipo_objeto, nombre, descripcion, vigencia)
select 'nivel_ia', 'Subir el nivel de una capacidad de IA',
       'Configuración sensible (cap. 04 §5.2): revisa el Gerente de Tecnología de la Información y aprueba el Gerente General. Un nivel a la vez y nunca por encima del techo.',
       daterange(date '2026-01-01', null)
 where not exists (select 1 from flujo.ruta where tipo_objeto = 'nivel_ia');

insert into flujo.ruta_paso (ruta_id, orden, nombre, resolutor, cargo_id, accion, hito)
select r.id, x.orden, x.nombre, 'cargo', (select id from org.cargo where clave = x.cargo), 'aprobar', x.hito
  from flujo.ruta r
 cross join (values
   (1, 'Gerente de Tecnología de la Información · revisa', 'gerente-tecnologia', false),
   (2, 'Gerente General · aprueba', 'gerente-general', true)
 ) as x(orden, nombre, cargo, hito)
 where r.tipo_objeto = 'nivel_ia'
   and not exists (select 1 from flujo.ruta_paso p where p.ruta_id = r.id);

-- -----------------------------------------------------------------------------
-- 4) EL CATÁLOGO (cap. 04 §6.1, módulos de la Etapa 1)
-- -----------------------------------------------------------------------------
insert into ia.capacidad (codigo, modulo, nombre, que_hace, uso, nivel_actual, techo, dueno_cargo, encendida, evidencia_para_subir, objeto_tipos, nota) values
  ('NUC-ORG-IA-01', 'NUC-ORG', 'Responder sobre estructura y autoridad',
   'Responde sobre estructura y autoridad con cita a la versión vigente («¿quién aprueba una requisición de mantenimiento si el director está de viaje?»).',
   'E', 'N0', 'N1', 'Director de Capital Humano', false,
   'Estructura cargada con fecha efectiva; juego de 20 a 50 preguntas con su respuesta citada; dos firmas (dueño y Tecnología).',
   '{unidad,plaza,cargo}', null),
  ('NUC-ORG-IA-02', 'NUC-ORG', 'Carga y saneamiento de descripciones de cargo',
   'Lee las descripciones de cargo y los organigramas y propone fichas estructuradas; marca «reporta a» distinto del organigrama y textos copiados entre cargos.',
   'L', 'N0', 'N2', 'Director de Capital Humano', false,
   'Acierto por campo contra una muestra revisada por Capital Humano; aprobación lote por lote.',
   '{cargo}', null),
  ('NUC-ORG-IA-03', 'NUC-ORG', 'Redacción asistida de descripciones de cargo',
   'Borrador de descripciones de cargo y RACI a partir de los procesos documentados. El dueño publica; la IA no publica.',
   'P', 'N0', 'N2', 'Director de Capital Humano', false,
   'Procesos documentados en NUC-PRO; rúbrica calibrada con el dueño.',
   '{cargo}', null),
  ('NUC-ORG-IA-04', 'NUC-ORG', 'Explicar el impacto de un cambio de estructura',
   'Explica el impacto que el sistema ya calculó (procesos sin dueño, firmantes inexistentes, permisos que se pierden) y lo ordena por riesgo.',
   'E', 'N0', 'N1', 'Director de Capital Humano', false,
   'Rúbrica de explicación con 100 % de respuestas con fuente.',
   '{escenario,unidad}', null),
  ('NUC-ORG-IA-05', 'NUC-ORG', 'Vigilancia de coherencia de plazas',
   'Señala plazas por encima de la dotación, sin titular por más de los días que fije Capital Humano o inferidas sin validar; explica el caso y propone el ajuste con fecha o el escenario.',
   'A', 'N2', 'N4', 'Director de Capital Humano', true,
   'Precisión de las marcas (aceptadas sobre propuestas) estable un ciclo; techo N4 solo para crear la tarea, nunca para cambiar la estructura.',
   '{plaza}', 'R4: reglas en SQL + explicación breve del modelo. N2: la persona decide cada una.'),
  ('NUC-PRO-IA-01', 'NUC-PRO', 'Preguntar a la IA sobre procesos, estructura y documentos',
   'Explica un proceso, la estructura o un documento solo con lo que quien pregunta puede leer, con cita al registro, su versión y su fecha; si no está en los datos, lo dice.',
   'E', 'N1', 'N1', 'Gerente de Calidad y Desarrollo', true,
   'Juego «RAG con cita» del patrón N1 (D-13); techo N1: explicar no sube de nivel.',
   '{proceso,documento,unidad,cargo}', 'R4: panel «Preguntar a la IA» y Ctrl K.'),
  ('NUC-PRO-IA-02', 'NUC-PRO', 'Proponer la ficha PHVA de un proceso',
   'Propone la ficha PHVA o SIPOC a partir de lo documentado en el SGC y de los hallazgos validados de la Fase 1.',
   'P', 'N0', 'N2', 'Gerente de Calidad y Desarrollo', false,
   'Hallazgos validados (2 de 394 hoy); rúbrica del líder de procesos.',
   '{proceso}', null),
  ('NUC-PRO-IA-03', 'NUC-PRO', 'Detectar incoherencias en el mapa de procesos',
   'Proceso sin dueño, formato sin proceso, salida que nadie recibe, códigos con sentidos invertidos; crea la tarea.',
   'A', 'N0', 'N4', 'Gerente de Calidad y Desarrollo', false,
   'Precisión del aviso y tasa de avisos atendidos; techo N4 solo para crear la tarea.',
   '{proceso}', null),
  ('NUC-DOC-IA-01', 'NUC-DOC', 'Búsqueda en el SGC con respuesta citada',
   'Responde con cita al código, la versión y la vigencia («¿cómo se libera un lote de vinagre?»).',
   'E', 'N0', 'N1', 'Gerente de Calidad y Desarrollo', false,
   'SGC depurado e indexado (§3.9); juego de recuperación aprobado por el dueño.',
   '{documento}', null),
  ('NUC-DOC-IA-02', 'NUC-DOC', 'Clasificar documentos en la conciliación',
   'Propone estado, proceso y familia de los documentos de la cola de conciliación a partir de sus metadatos. En N4 aplica sola solo la familia y el proceso (metadatos internos), con 12 horas para deshacer; el estado de vigencia siempre lo decide una persona.',
   'L', 'N2', 'N4', 'Gerente de Calidad y Desarrollo', true,
   'Acierto por campo contra lo que resolvió el Coordinador del SGC; N3 y N4 con el comité (Q-03).',
   '{documento}', 'Techo N4 solo para metadatos internos (Anexo E §7); el plan 04 §6.1 le ponía N3 por lote.'),
  ('NUC-DOC-IA-03', 'NUC-DOC', 'Etiquetado continuo de borradores',
   'Proceso sugerido, palabras clave y documentos relacionados de cada borrador nuevo.',
   'L', 'N0', 'N4', 'Gerente de Calidad y Desarrollo', false,
   'Muestreo del dueño; deshacer probado.',
   '{documento}', null),
  ('NUC-DOC-IA-04', 'NUC-DOC', 'Detectar duplicados, obsoletos y revisiones vencidas',
   'Duplicados, referencias a códigos viejos, descriptor con versión distinta de su formato, revisión vencida; crea la tarea.',
   'A', 'N0', 'N4', 'Gerente de Calidad y Desarrollo', false,
   'Precisión del aviso; techo N4 solo para crear la tarea.',
   '{documento}', null),
  ('NUC-DOC-IA-05', 'NUC-DOC', 'Borrador de procedimiento o instructivo',
   'Borrador con la plantilla de la casa a partir de la ficha del proceso. La IA no publica.',
   'P', 'N0', 'N2', 'Gerente de Calidad y Desarrollo', false,
   'Rúbrica del dueño del documento.',
   '{documento,proceso}', null),
  ('NUC-DOC-IA-06', 'NUC-DOC', 'Resumir cambios entre versiones',
   'Resume los cambios entre dos versiones y la solicitud de cambio para quien revisa.',
   'E', 'N0', 'N1', 'Gerente de Calidad y Desarrollo', false,
   'Juego del patrón «explicar».',
   '{documento}', null),
  ('FIN-TAS-IA-01', 'FIN-TAS', 'Explicar la brecha cambiaria del día',
   'Explica la variación de la tasa BCV y, solo a quien ve el paralelo, la brecha del día con sus fuentes. Nunca para facturar ni para precios.',
   'E', 'N0', 'N1', 'Gerente de Finanzas', false,
   'G-11 decidida (de dónde sale el paralelo); validación del asesor tributario.',
   '{}', 'El paralelo es referencia interna: la capacidad respeta `sistema:tasas-paralelo`.')
on conflict (codigo) do nothing;

-- -----------------------------------------------------------------------------
-- 5) ESTADO Y TOPES
-- -----------------------------------------------------------------------------

-- Lo gastado hoy (Caracas).
create or replace function ia.gastado_hoy()
returns numeric language sql stable security definer set search_path = ia, public as $$
  select coalesce(sum(costo_usd), 0) from ia.actividad
   where creado_en >= ((now() at time zone 'America/Caracas')::date)::timestamp at time zone 'America/Caracas';
$$;

create or replace function ia.tope_diario()
returns numeric language sql stable security definer set search_path = control, public as $$
  select coalesce((select valor from control.parametro where clave = 'ia_tope_diario_usd'
                     and vigencia @> (now() at time zone 'America/Caracas')::date limit 1), 2);
$$;

-- ¿Se puede usar esta capacidad ahora? null = sí; si no, el motivo legible.
create or replace function ia.motivo_bloqueo(p_codigo text)
returns text language plpgsql stable security definer set search_path = ia, public as $$
declare
  c ia.capacidad;
begin
  if auth.uid() is null then return 'Sin sesión'; end if;
  if not coalesce((select encendido from ia.interruptor_general), false) then
    return 'La IA está apagada en toda la plataforma (interruptor general).';
  end if;
  select * into c from ia.capacidad where codigo = p_codigo;
  if not found then return 'Esa capacidad no existe.'; end if;
  if not c.encendida or c.nivel_actual = 'N0' then return format('La capacidad %s está apagada.', c.codigo); end if;
  if ia.gastado_hoy() >= ia.tope_diario() then
    return format('Se alcanzó el tope diario de gasto de la IA (US$ %s). Sigue por el camino manual; mañana vuelve.', to_char(ia.tope_diario(), 'FM990.00'));
  end if;
  return null;
end;
$$;

-- Lo que la interfaz necesita para decidir qué pintar. El gasto solo lo ve
-- quien gobierna la IA.
create or replace function ia.estado()
returns jsonb language sql stable security definer set search_path = ia, public as $$
  select jsonb_build_object(
    'general', coalesce((select encendido from ia.interruptor_general), false),
    'tope_diario_usd', case when public.puede('sistema:ia', 'ver') then ia.tope_diario() end,
    'gastado_hoy_usd', case when public.puede('sistema:ia', 'ver') then ia.gastado_hoy() end,
    'sin_presupuesto', ia.gastado_hoy() >= ia.tope_diario(),
    'capacidades', coalesce((select jsonb_object_agg(codigo, jsonb_build_object('nivel', nivel_actual, 'techo', techo, 'encendida', encendida))
                               from ia.capacidad), '{}'::jsonb))
  where auth.uid() is not null;
$$;

-- -----------------------------------------------------------------------------
-- 6) REGISTRAR UNA LLAMADA AL MODELO (la hace el servidor, con la sesión de
--    quien pidió). Exige que la capacidad esté usable: no se registra lo que
--    no se pudo pedir.
-- -----------------------------------------------------------------------------
create or replace function ia.registrar_llamada(
  p_capacidad text, p_accion text, p_resumen text, p_evidencia jsonb,
  p_tokens_entrada integer, p_tokens_salida integer, p_costo_usd numeric, p_latencia_ms integer, p_modelo text,
  p_objeto_tipo text default null, p_objeto_id uuid default null)
returns uuid language plpgsql security definer set search_path = ia, public as $$
declare
  v_id uuid;
  v_nivel text;
  v_motivo text;
begin
  if auth.uid() is null then raise exception 'Sin sesión' using errcode = 'insufficient_privilege'; end if;
  if p_accion not in ('respondio', 'explico', 'bloqueo', 'error') then
    raise exception 'Acción no válida para una llamada' using errcode = 'check_violation';
  end if;
  -- Un bloqueo o un error se registran aunque la capacidad no esté usable;
  -- una respuesta no.
  v_motivo := ia.motivo_bloqueo(p_capacidad);
  if p_accion in ('respondio', 'explico') and v_motivo is not null and v_motivo not like 'Se alcanzó el tope%' then
    raise exception '%', v_motivo using errcode = 'insufficient_privilege';
  end if;
  if p_objeto_id is not null and not nucleo.puede_ver_objeto(p_objeto_tipo, p_objeto_id) then
    raise exception 'Ese objeto no está a tu alcance' using errcode = 'insufficient_privilege';
  end if;
  select nivel_actual into v_nivel from ia.capacidad where codigo = p_capacidad;
  insert into ia.actividad (capacidad, nivel, accion, objeto_tipo, objeto_id, resumen, evidencia, actor_es_ia, pedido_por,
                            tokens_entrada, tokens_salida, costo_usd, latencia_ms, modelo)
  values (p_capacidad, case when v_nivel = 'N0' then null else v_nivel end, p_accion, p_objeto_tipo, p_objeto_id,
          left(coalesce(nullif(trim(p_resumen), ''), '—'), 1000), coalesce(p_evidencia, '[]'::jsonb),
          p_accion in ('respondio', 'explico'), auth.uid(),
          greatest(coalesce(p_tokens_entrada, 0), 0), greatest(coalesce(p_tokens_salida, 0), 0),
          greatest(coalesce(p_costo_usd, 0), 0), p_latencia_ms, left(p_modelo, 60))
  returning id into v_id;
  return v_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- 7) NUC-ORG-IA-05 · VIGILANCIA DE PLAZAS (reglas en SQL)
-- -----------------------------------------------------------------------------
-- Corre con la sesión de quien lo pide: exige leer la estructura. Crea una
-- propuesta N2 por plaza y regla (no repite una pendiente ni una que alguien
-- rechazó en los últimos 30 días) y vence las que ya no aplican. Devuelve las
-- nuevas, para que el modelo las explique.
create or replace function ia.revisar_plazas()
returns table (id uuid, regla text, objeto_id uuid, titulo text, cuerpo text, evidencia jsonb)
language plpgsql security definer set search_path = ia, org, ui, public as $$
#variable_conflict use_column
declare
  v_hoy date := org.hoy();
  v_dias integer := coalesce((select valor::int from control.parametro where clave = 'ia_dias_plaza_sin_titular' and vigencia @> org.hoy() limit 1), 90);
  v_motivo text := ia.motivo_bloqueo('NUC-ORG-IA-05');
  v_nivel text;
begin
  if v_motivo is not null then raise exception '%', v_motivo using errcode = 'insufficient_privilege'; end if;
  if not public.puede('sistema:estructura', 'ver') then
    raise exception 'Tu rol no lee la estructura' using errcode = 'insufficient_privilege';
  end if;
  select nivel_actual into v_nivel from ia.capacidad where codigo = 'NUC-ORG-IA-05';

  create temporary table if not exists pg_temp.cand (regla text, ref uuid, titulo text, cuerpo text, evidencia jsonb, payload jsonb) on commit drop;
  truncate pg_temp.cand;

  insert into pg_temp.cand
  with p as (
    select x.*, (select lower(v.vigencia) from org.plaza v where v.ref = x.ref and v.escenario_id is null and v.vigencia @> v_hoy limit 1) as version_desde,
                (select min(lower(v.vigencia)) from org.plaza v where v.ref = x.ref and v.escenario_id is null) as primera
      from ui.plazas(v_hoy) x
  ),
  tit as (
    select o.plaza_ref, lower(o.vigencia) as ini, row_number() over (partition by o.plaza_ref order by lower(o.vigencia), o.id) as n
      from org.ocupacion o where o.tipo = 'titular' and o.vigencia @> v_hoy
  ),
  exceso as (
    select p.*, greatest(p.version_desde, (select t.ini from tit t where t.plaza_ref = p.ref and t.n = p.dotacion + 1)) as desde
      from p where p.exceso > 0
  ),
  vacia as (
    select p.*, coalesce((select max(upper(o.vigencia)) from org.ocupacion o where o.plaza_ref = p.ref and o.tipo = 'titular' and upper(o.vigencia) <= v_hoy), p.primera) as desde
      from p where p.ocupadas = 0 and p.dotacion > 0 and p.estado = 'aprobada'
  )
  select 'exceso', e.ref,
         format('Por encima de la dotación desde el %s', to_char(e.desde, 'DD/MM/YYYY')),
         format('%s · %s tiene %s titular(es) para una dotación aprobada de %s: %s por encima desde el %s. Se ajusta la dotación con fecha o se revisa en un escenario.',
                e.cargo, coalesce(e.unidad, 'sin unidad'), e.ocupadas, e.dotacion, e.exceso, to_char(e.desde, 'DD/MM/YYYY')),
         jsonb_build_array(
           jsonb_build_object('tipo', 'plaza', 'id', e.ref, 'campo', 'dotacion', 'valor', e.dotacion, 'fuente', format('org.plaza · versión vigente desde %s', to_char(e.version_desde, 'DD/MM/YYYY'))),
           jsonb_build_object('tipo', 'plaza', 'id', e.ref, 'campo', 'titulares', 'valor', e.ocupadas, 'fuente', 'org.ocupacion · titulares vigentes')),
         jsonb_build_object('accion', 'editar_dotacion', 'dotacion_actual', e.dotacion, 'dotacion_propuesta', e.ocupadas, 'desde', e.desde)
    from exceso e
  union all
  select 'sin_titular', v.ref,
         format('Sin titular hace %s días', v_hoy - v.desde),
         format('%s · %s (dotación %s) no tiene titular desde el %s: %s días, más de los %s que fija el parámetro. Se pide la requisición o se cierra la plaza con fecha.',
                v.cargo, coalesce(v.unidad, 'sin unidad'), v.dotacion, to_char(v.desde, 'DD/MM/YYYY'), v_hoy - v.desde, v_dias),
         jsonb_build_array(
           jsonb_build_object('tipo', 'plaza', 'id', v.ref, 'campo', 'titulares', 'valor', 0, 'fuente', 'org.ocupacion · titulares vigentes'),
           jsonb_build_object('tipo', 'plaza', 'id', v.ref, 'campo', 'sin titular desde', 'valor', v.desde, 'fuente', 'org.ocupacion / org.plaza'),
           jsonb_build_object('tipo', 'parametro', 'id', null, 'campo', 'ia_dias_plaza_sin_titular', 'valor', v_dias, 'fuente', 'control.parametro')),
         jsonb_build_object('accion', 'revisar_vacante', 'dias', v_hoy - v.desde, 'desde', v.desde)
    from vacia v where v_hoy - v.desde > v_dias
  union all
  select 'inferida', p.ref,
         'Inferida, sin validar',
         format('%s · %s se cargó por inferencia (no figura así en el organigrama fuente). Capital Humano la confirma con fecha o la corrige.',
                p.cargo, coalesce(p.unidad, 'sin unidad')),
         jsonb_build_array(jsonb_build_object('tipo', 'plaza', 'id', p.ref, 'campo', 'certeza', 'valor', p.certeza, 'fuente', 'org.plaza · carga inicial')),
         jsonb_build_object('accion', 'confirmar')
    from p where p.certeza = 'inferencia';

  -- Vencen las pendientes cuya regla ya no se cumple.
  update ia.propuesta pr set estado = 'expirada', decidido_en = now(), motivo = 'La regla ya no se cumple'
   where pr.capacidad = 'NUC-ORG-IA-05' and pr.estado = 'pendiente'
     and not exists (select 1 from pg_temp.cand c where c.regla = pr.regla and c.ref = pr.objeto_id);

  return query
  with nuevas as (
    insert into ia.propuesta (capacidad, regla, objeto_tipo, objeto_id, nivel, titulo, cuerpo, evidencia, payload, pedido_por)
    select 'NUC-ORG-IA-05', c.regla, 'plaza', c.ref, v_nivel, c.titulo, c.cuerpo, c.evidencia, c.payload, auth.uid()
      from pg_temp.cand c
     where not exists (select 1 from ia.propuesta x where x.capacidad = 'NUC-ORG-IA-05' and x.regla = c.regla and x.objeto_id = c.ref
                         and (x.estado = 'pendiente' or (x.estado = 'rechazada' and x.decidido_en > now() - interval '30 days')))
    returning ia.propuesta.id, ia.propuesta.regla, ia.propuesta.objeto_id, ia.propuesta.titulo, ia.propuesta.cuerpo, ia.propuesta.evidencia
  ), act as (
    insert into ia.actividad (capacidad, nivel, accion, objeto_tipo, objeto_id, propuesta_id, resumen, evidencia, actor_es_ia, pedido_por)
    select 'NUC-ORG-IA-05', v_nivel, 'propuso', 'plaza', n.objeto_id, n.id, n.titulo, n.evidencia, true, auth.uid() from nuevas n
    returning 1
  )
  select n.id, n.regla, n.objeto_id, n.titulo, n.cuerpo, n.evidencia from nuevas n;
end;
$$;

-- La explicación breve del modelo sobre propuestas recién creadas por quien
-- llama (10 minutos). Es texto aparte del de la regla: se pinta como «Generado
-- con IA · verifícalo».
create or replace function ia.explicar_propuestas(p_items jsonb)
returns integer language plpgsql security definer set search_path = ia, public as $$
declare
  v_n integer;
begin
  if auth.uid() is null then raise exception 'Sin sesión' using errcode = 'insufficient_privilege'; end if;
  with x as (
    select (e ->> 'id')::uuid as id, left(trim(e ->> 'texto'), 1200) as texto
      from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) e
     where e ->> 'id' ~ '^[0-9a-f-]{36}$' and coalesce(trim(e ->> 'texto'), '') <> ''
  ), u as (
    update ia.propuesta p set explicacion = x.texto
      from x
     where p.id = x.id and p.pedido_por = auth.uid() and p.estado in ('pendiente', 'aceptada')
       and p.creado_en > now() - interval '10 minutes' and p.explicacion is null
    returning 1
  )
  select count(*) into v_n from u;
  return v_n;
end;
$$;

-- -----------------------------------------------------------------------------
-- 8) NUC-DOC-IA-02 · CLASIFICAR DOCUMENTOS DE LA CONCILIACIÓN
-- -----------------------------------------------------------------------------
-- Los candidatos: documentos generales, sin datos sensibles, con estado sin
-- determinar, sin una propuesta pendiente. Solo metadatos (nunca el archivo).
create or replace function ia.candidatos_clasificacion(p_limite integer default 12)
returns table (id uuid, codigo text, titulo text, tipo_yy text, proceso_xx text, proceso_ref uuid, proceso text,
               version text, fecha date, estado text, familia text, evidencia_estado text)
language plpgsql stable security definer set search_path = ia, sgc, public as $$
#variable_conflict use_column
begin
  if ia.motivo_bloqueo('NUC-DOC-IA-02') is not null or not public.puede('sistema:documentos', 'editar') then return; end if;
  return query
  select d.id, d.codigo, d.titulo, d.tipo_yy, d.proceso_xx, d.proceso_ref,
         (select p.nombre from sgc.proceso p where p.ref = d.proceso_ref and p.escenario_id is null and p.estado = 'vigente' limit 1),
         d.version, d.fecha, d.estado, d.familia, left(d.evidencia_estado, 400)
    from sgc.documento d
   where d.perimetro = 'general' and not d.datos_sensibles and d.estado = 'sin_determinar'
     and not exists (select 1 from sgc.documento_conciliacion c where c.documento_id = d.id and c.motivo = 'sin_determinar')
     and not exists (select 1 from ia.propuesta x where x.capacidad = 'NUC-DOC-IA-02' and x.objeto_id = d.id
                       and (x.estado in ('pendiente', 'aceptada', 'editada') or (x.estado in ('rechazada', 'revertida') and x.decidido_en > now() - interval '30 days')))
   order by d.codigo
   limit least(greatest(coalesce(p_limite, 12), 1), 30);
end;
$$;

-- Aplica un cambio de metadatos a un documento, solo los campos permitidos.
create or replace function ia.aplicar_metadatos(p_doc uuid, p_cambios jsonb)
returns void language plpgsql security definer set search_path = sgc, public as $$
begin
  update sgc.documento d set
    familia = case when p_cambios ? 'familia' then nullif(p_cambios ->> 'familia', '') else d.familia end,
    proceso_ref = case when p_cambios ? 'proceso_ref' then nullif(p_cambios ->> 'proceso_ref', '')::uuid else d.proceso_ref end,
    estado = case when p_cambios ? 'estado' then p_cambios ->> 'estado' else d.estado end
   where d.id = p_doc and d.perimetro = 'general' and not d.datos_sensibles;
  if not found then raise exception 'Ese documento no se puede tocar desde la IA' using errcode = 'insufficient_privilege'; end if;
end;
$$;

-- Lo que propuso el modelo, validado aquí: valores de catálogo, documento a
-- alcance. N2/N3: queda pendiente. N4: la familia y el proceso se aplican solos
-- (metadatos internos) con 12 horas para deshacer; el estado de vigencia queda
-- siempre como propuesta para una persona (techo N2 de la publicación, §4.2).
create or replace function ia.proponer_clasificacion(p_items jsonb)
returns table (id uuid, documento uuid, nivel text, estado text, titulo text)
language plpgsql security definer set search_path = ia, sgc, public as $$
#variable_conflict use_column
declare
  v_motivo text := ia.motivo_bloqueo('NUC-DOC-IA-02');
  v_nivel text;
  e jsonb;
  d sgc.documento;
  v_cambios jsonb;
  v_antes jsonb;
  v_estado text;
  v_familia text;
  v_proceso uuid;
  v_razon text;
  v_id uuid;
  v_evid jsonb;
  v_fam_ok boolean;
begin
  if v_motivo is not null then raise exception '%', v_motivo using errcode = 'insufficient_privilege'; end if;
  if not public.puede('sistema:documentos', 'editar') then
    raise exception 'Clasificar documentos pide editar documentos' using errcode = 'insufficient_privilege';
  end if;
  select nivel_actual into v_nivel from ia.capacidad where codigo = 'NUC-DOC-IA-02';

  for e in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) loop
    continue when coalesce(e ->> 'documento_id', '') !~ '^[0-9a-f-]{36}$';
    select * into d from sgc.documento x where x.id = (e ->> 'documento_id')::uuid;
    continue when not found or d.perimetro <> 'general' or d.datos_sensibles or d.estado <> 'sin_determinar';
    continue when exists (select 1 from ia.propuesta x where x.capacidad = 'NUC-DOC-IA-02' and x.objeto_id = d.id and x.estado = 'pendiente');

    v_estado := nullif(e ->> 'estado', '');
    if v_estado not in ('vigente', 'obsoleto', 'borrador') then v_estado := null; end if;
    v_familia := nullif(upper(e ->> 'familia'), '');
    v_fam_ok := v_familia ~ '^FAM-(0[1-9]|10)$' and d.tipo_yy = '40';
    v_proceso := case when coalesce(e ->> 'proceso_ref', '') ~ '^[0-9a-f-]{36}$'
                       and exists (select 1 from sgc.proceso p where p.ref = (e ->> 'proceso_ref')::uuid and p.escenario_id is null and p.estado = 'vigente')
                      then (e ->> 'proceso_ref')::uuid end;
    v_razon := left(coalesce(nullif(trim(e ->> 'razon'), ''), 'Según el código, el tipo y la evidencia de la carga.'), 600);
    v_evid := jsonb_build_array(
      jsonb_build_object('tipo', 'documento', 'id', d.id, 'campo', 'codigo', 'valor', d.codigo, 'fuente', 'sgc.documento'),
      jsonb_build_object('tipo', 'documento', 'id', d.id, 'campo', 'evidencia de la carga', 'valor', left(coalesce(d.evidencia_estado, 'sin evidencia'), 300), 'fuente', 'conciliación inicial'));

    -- (a) Metadatos internos: familia (solo formatos, tipo 40) y proceso (si falta).
    v_cambios := '{}'::jsonb;
    v_antes := '{}'::jsonb;
    if v_fam_ok and d.familia is distinct from v_familia then
      v_cambios := v_cambios || jsonb_build_object('familia', v_familia);
      v_antes := v_antes || jsonb_build_object('familia', d.familia);
    end if;
    if v_proceso is not null and d.proceso_ref is null then
      v_cambios := v_cambios || jsonb_build_object('proceso_ref', v_proceso);
      v_antes := v_antes || jsonb_build_object('proceso_ref', d.proceso_ref);
    end if;
    if v_cambios <> '{}'::jsonb then
      v_id := gen_random_uuid();
      if v_nivel = 'N4' then
        perform set_config('ia.actor', 'on', true);
        perform ia.aplicar_metadatos(d.id, v_cambios);
        perform set_config('ia.actor', 'off', true);
      end if;
      insert into ia.propuesta (id, capacidad, regla, objeto_tipo, objeto_id, nivel, titulo, cuerpo, evidencia, payload, estado, pedido_por,
                                decidido_en, deshacer_hasta)
      values (v_id, 'NUC-DOC-IA-02', 'clasificacion', 'documento', d.id, v_nivel,
              format('Clasificar %s: %s', d.codigo,
                     concat_ws(' · ', case when v_cambios ? 'familia' then 'familia ' || (v_cambios ->> 'familia') end,
                                      case when v_cambios ? 'proceso_ref' then 'proceso vinculado' end)),
              v_razon, v_evid,
              jsonb_build_object('accion', 'metadatos', 'cambios', v_cambios, 'antes', v_antes),
              case when v_nivel = 'N4' then 'aceptada' else 'pendiente' end, auth.uid(),
              case when v_nivel = 'N4' then now() end,
              case when v_nivel = 'N4' then now() + interval '12 hours' end);
      insert into ia.actividad (capacidad, nivel, accion, objeto_tipo, objeto_id, propuesta_id, resumen, evidencia, actor_es_ia, pedido_por)
      values ('NUC-DOC-IA-02', v_nivel, case when v_nivel = 'N4' then 'aplico' else 'propuso' end, 'documento', d.id, v_id,
              case when v_nivel = 'N4' then format('Clasificó %s (metadatos internos); se puede deshacer hasta %s', d.codigo,
                                                   to_char((now() + interval '12 hours') at time zone 'America/Caracas', 'DD/MM HH24:MI'))
                   else format('Propone clasificar %s', d.codigo) end,
              v_evid, true, auth.uid());
      id := v_id; documento := d.id; nivel := v_nivel; estado := case when v_nivel = 'N4' then 'aceptada' else 'pendiente' end;
      titulo := format('Clasificar %s', d.codigo);
      return next;
    end if;

    -- (b) El estado de vigencia: siempre una propuesta (N2 como máximo).
    if v_estado is not null then
      v_id := gen_random_uuid();
      insert into ia.propuesta (id, capacidad, regla, objeto_tipo, objeto_id, nivel, titulo, cuerpo, evidencia, payload, pedido_por)
      values (v_id, 'NUC-DOC-IA-02', 'estado', 'documento', d.id, case when ia.n(v_nivel) > 2 then 'N2' else v_nivel end,
              format('Marcar %s como %s', d.codigo, v_estado), v_razon, v_evid,
              jsonb_build_object('accion', 'metadatos', 'cambios', jsonb_build_object('estado', v_estado), 'antes', jsonb_build_object('estado', d.estado)),
              auth.uid());
      insert into ia.actividad (capacidad, nivel, accion, objeto_tipo, objeto_id, propuesta_id, resumen, evidencia, actor_es_ia, pedido_por)
      values ('NUC-DOC-IA-02', case when ia.n(v_nivel) > 2 then 'N2' else v_nivel end, 'propuso', 'documento', d.id, v_id,
              format('Propone marcar %s como %s', d.codigo, v_estado), v_evid, true, auth.uid());
      id := v_id; documento := d.id; nivel := case when ia.n(v_nivel) > 2 then 'N2' else v_nivel end; estado := 'pendiente';
      titulo := format('Marcar %s como %s', d.codigo, v_estado);
      return next;
    end if;
  end loop;
end;
$$;

-- -----------------------------------------------------------------------------
-- 9) DECIDIR, DESHACER
-- -----------------------------------------------------------------------------
create or replace function ia.puede_decidir_tipo(p_tipo text)
returns boolean language sql stable security definer set search_path = public as $$
  select case p_tipo
    when 'plaza' then public.puede('sistema:estructura', 'editar')
    when 'unidad' then public.puede('sistema:estructura', 'editar')
    when 'cargo' then public.puede('sistema:estructura', 'editar')
    when 'documento' then public.puede('sistema:documentos', 'editar')
    when 'proceso' then public.puede('sistema:procesos', 'editar')
    else false end;
$$;

-- Aceptar, aceptar con cambios («editada») o rechazar (con motivo). En los
-- documentos, aceptar aplica el cambio aquí mismo (como persona, no como IA).
-- En las plazas, el ajuste con fecha lo hace antes la acción de la ficha; aquí
-- queda la decisión.
create or replace function ia.decidir_propuesta(p_id uuid, p_decision text, p_motivo text default null, p_cambios jsonb default null)
returns text language plpgsql security definer set search_path = ia, public as $$
declare
  p ia.propuesta;
  v_cambios jsonb;
begin
  if auth.uid() is null then raise exception 'Sin sesión' using errcode = 'insufficient_privilege'; end if;
  if p_decision not in ('aceptada', 'editada', 'rechazada') then raise exception 'Decisión no válida' using errcode = 'check_violation'; end if;
  select * into p from ia.propuesta where id = p_id for update;
  if not found or not nucleo.puede_ver_objeto(p.objeto_tipo, p.objeto_id) then
    raise exception 'Esa propuesta no está a tu alcance' using errcode = 'insufficient_privilege';
  end if;
  if p.estado <> 'pendiente' then raise exception 'Esa propuesta ya se decidió (%)', p.estado using errcode = 'check_violation'; end if;
  if not ia.puede_decidir_tipo(p.objeto_tipo) then
    raise exception 'Tu rol no edita este tipo de objeto: la propuesta la decide quien sí' using errcode = 'insufficient_privilege';
  end if;
  if p_decision = 'rechazada' and coalesce(trim(p_motivo), '') = '' then
    raise exception 'Rechazar pide un motivo' using errcode = 'check_violation';
  end if;

  if p_decision in ('aceptada', 'editada') and p.objeto_tipo = 'documento' and p.payload ->> 'accion' = 'metadatos' then
    v_cambios := case when p_decision = 'editada' and p_cambios is not null then p_cambios else p.payload -> 'cambios' end;
    -- Solo los campos que la propuesta tocaba.
    v_cambios := (select coalesce(jsonb_object_agg(k, v), '{}'::jsonb) from jsonb_each(v_cambios) x(k, v) where (p.payload -> 'cambios') ? k);
    if v_cambios ? 'estado' and (v_cambios ->> 'estado') not in ('vigente', 'obsoleto', 'borrador', 'sin_determinar', 'retirado') then
      raise exception 'Estado no válido' using errcode = 'check_violation';
    end if;
    perform ia.aplicar_metadatos(p.objeto_id, v_cambios);
    p.payload := p.payload || jsonb_build_object('aplicado', v_cambios);
  elsif p_decision in ('aceptada', 'editada') and p_cambios is not null then
    p.payload := p.payload || jsonb_build_object('aplicado', p_cambios);
  end if;

  update ia.propuesta set estado = p_decision, decidido_por = auth.uid(), decidido_en = now(),
         motivo = nullif(trim(p_motivo), ''), payload = p.payload
   where id = p.id;

  insert into ia.actividad (capacidad, nivel, accion, objeto_tipo, objeto_id, propuesta_id, resumen, evidencia, actor_es_ia, pedido_por, aprobado_por)
  values (p.capacidad, p.nivel, 'decidio', p.objeto_tipo, p.objeto_id, p.id,
          left(case p_decision when 'rechazada' then format('Rechazó la propuesta de la IA «%s»: %s', p.titulo, trim(p_motivo))
                               when 'editada' then format('Aceptó con cambios la propuesta de la IA «%s»', p.titulo)
                               else format('Aceptó la propuesta de la IA «%s»', p.titulo) end, 1000),
          p.evidencia, false, auth.uid(), auth.uid());
  return p_decision;
end;
$$;

-- Deshacer lo que la IA aplicó sola (N4), dentro de la ventana y si nadie lo
-- cambió después.
create or replace function ia.deshacer(p_id uuid, p_motivo text default null)
returns text language plpgsql security definer set search_path = ia, sgc, public as $$
declare
  p ia.propuesta;
  d sgc.documento;
  k text;
begin
  if auth.uid() is null then raise exception 'Sin sesión' using errcode = 'insufficient_privilege'; end if;
  select * into p from ia.propuesta where id = p_id for update;
  if not found or not nucleo.puede_ver_objeto(p.objeto_tipo, p.objeto_id) then
    raise exception 'Esa propuesta no está a tu alcance' using errcode = 'insufficient_privilege';
  end if;
  if p.estado <> 'aceptada' or p.nivel <> 'N4' or p.deshacer_hasta is null then
    raise exception 'Solo se deshace lo que la IA aplicó sola' using errcode = 'check_violation';
  end if;
  if now() > p.deshacer_hasta then raise exception 'Pasó la ventana para deshacer (12 horas)' using errcode = 'check_violation'; end if;
  if not ia.puede_decidir_tipo(p.objeto_tipo) then raise exception 'Tu rol no edita este tipo de objeto' using errcode = 'insufficient_privilege'; end if;

  select * into d from sgc.documento where id = p.objeto_id;
  for k in select jsonb_object_keys(p.payload -> 'cambios') loop
    if (to_jsonb(d) -> k) is distinct from (p.payload -> 'cambios' -> k) then
      raise exception 'El campo «%» cambió después: corrígelo en la ficha', k using errcode = 'check_violation';
    end if;
  end loop;
  perform ia.aplicar_metadatos(p.objeto_id, p.payload -> 'antes');

  update ia.propuesta set estado = 'revertida', decidido_por = auth.uid(), decidido_en = now(),
         motivo = coalesce(nullif(trim(p_motivo), ''), 'Deshecho por una persona')
   where id = p.id;
  insert into ia.actividad (capacidad, nivel, accion, objeto_tipo, objeto_id, propuesta_id, resumen, evidencia, actor_es_ia, pedido_por, aprobado_por)
  values (p.capacidad, p.nivel, 'deshizo', p.objeto_tipo, p.objeto_id, p.id,
          left(format('Deshizo lo que la IA aplicó: «%s»%s', p.titulo, coalesce(': ' || nullif(trim(p_motivo), ''), '')), 1000),
          p.evidencia, false, auth.uid(), auth.uid());
  return 'revertida';
end;
$$;

-- -----------------------------------------------------------------------------
-- 10) GOBIERNO: interruptores, tope y niveles
-- -----------------------------------------------------------------------------
create or replace function ia.fijar_interruptor(p_encendido boolean, p_motivo text default null)
returns boolean language plpgsql security definer set search_path = ia, public as $$
begin
  if not public.puede('sistema:ia', 'editar') then raise exception 'Apagar o encender la IA pide «Gobierno de IA · editar»' using errcode = 'insufficient_privilege'; end if;
  -- Apagar no espera explicación; encender sí.
  if p_encendido and coalesce(trim(p_motivo), '') = '' then raise exception 'Encender la IA pide un motivo' using errcode = 'check_violation'; end if;
  update ia.interruptor_general set encendido = p_encendido, motivo = nullif(trim(p_motivo), ''), cambiado_por = auth.uid(), cambiado_en = now()
   where id;  -- pg_safeupdate: PostgREST rechaza un UPDATE sin WHERE
  insert into ia.actividad (accion, resumen, actor_es_ia, pedido_por, aprobado_por)
  values ('interruptor', left(format('%s la IA en toda la plataforma%s', case when p_encendido then 'Encendió' else 'Apagó' end,
                                     coalesce(': ' || nullif(trim(p_motivo), ''), '')), 1000), false, auth.uid(), auth.uid());
  return p_encendido;
end;
$$;

create or replace function ia.encender(p_codigo text, p_encendida boolean, p_motivo text default null)
returns boolean language plpgsql security definer set search_path = ia, public as $$
declare
  c ia.capacidad;
begin
  if not public.puede('sistema:ia', 'editar') then raise exception 'Pide «Gobierno de IA · editar»' using errcode = 'insufficient_privilege'; end if;
  select * into c from ia.capacidad where codigo = p_codigo for update;
  if not found then raise exception 'Esa capacidad no existe' using errcode = 'no_data_found'; end if;
  if p_encendida then
    if c.nivel_actual = 'N0' then raise exception 'Una capacidad en N0 no se enciende: primero se pide subirla a N1 con su evidencia' using errcode = 'check_violation'; end if;
    if coalesce(trim(p_motivo), '') = '' then raise exception 'Encender pide un motivo' using errcode = 'check_violation'; end if;
    if not c.encendida and (select count(*) from ia.capacidad where encendida) >= 10 then
      raise exception 'Ya hay 10 capacidades encendidas: es el tope de la Fase 2 (D-13). Apaga otra antes.' using errcode = 'check_violation';
    end if;
  end if;
  update ia.capacidad set encendida = p_encendida, actualizado_en = now() where codigo = p_codigo;
  insert into ia.actividad (capacidad, nivel, accion, resumen, actor_es_ia, pedido_por, aprobado_por)
  values (p_codigo, c.nivel_actual, case when p_encendida then 'encendio' else 'apago' end,
          left(format('%s %s%s', case when p_encendida then 'Encendió' else 'Apagó' end, p_codigo, coalesce(': ' || nullif(trim(p_motivo), ''), '')), 1000),
          false, auth.uid(), auth.uid());
  return p_encendida;
end;
$$;

create or replace function ia.fijar_tope(p_usd numeric, p_motivo text)
returns numeric language plpgsql security definer set search_path = ia, control, public as $$
declare
  v_hoy date := (now() at time zone 'America/Caracas')::date;
  v_par control.parametro;
begin
  if not public.puede('sistema:ia', 'editar') then raise exception 'Pide «Gobierno de IA · editar»' using errcode = 'insufficient_privilege'; end if;
  if p_usd is null or p_usd < 0 or p_usd > 500 then raise exception 'El tope va de 0 a 500 USD al día' using errcode = 'check_violation'; end if;
  if coalesce(trim(p_motivo), '') = '' then raise exception 'Cambiar el tope pide un motivo' using errcode = 'check_violation'; end if;
  select * into v_par from control.parametro where clave = 'ia_tope_diario_usd' and vigencia @> v_hoy;
  if found and lower(v_par.vigencia) = v_hoy then
    update control.parametro set valor = p_usd, fuente = left(trim(p_motivo), 200), por_confirmar = false where id = v_par.id;
  else
    if found then update control.parametro set vigencia = daterange(lower(vigencia), v_hoy) where id = v_par.id; end if;
    insert into control.parametro (clave, nombre, valor, unidad, vigencia, fuente, por_confirmar)
    values ('ia_tope_diario_usd', 'Tope diario de gasto de la IA', p_usd, 'USD', daterange(v_hoy, null), left(trim(p_motivo), 200), false);
  end if;
  insert into ia.actividad (accion, resumen, actor_es_ia, pedido_por, aprobado_por)
  values ('tope', left(format('Fijó el tope diario de la IA en US$ %s: %s', to_char(p_usd, 'FM990.00'), trim(p_motivo)), 1000), false, auth.uid(), auth.uid());
  return p_usd;
end;
$$;

-- Bajar es inmediato (una firma). Subir: un nivel, bajo el techo, con motivo y
-- evidencia, por la ruta «nivel_ia» (doble aprobación).
create or replace function ia.pedir_cambio_nivel(p_codigo text, p_nivel text, p_motivo text, p_evidencia text default null)
returns uuid language plpgsql security definer set search_path = ia, flujo, public as $$
declare
  c ia.capacidad;
  v_id uuid := gen_random_uuid();
  v_sol uuid;
begin
  if not public.puede('sistema:ia', 'editar') then raise exception 'Pide «Gobierno de IA · editar»' using errcode = 'insufficient_privilege'; end if;
  if p_nivel not in ('N0', 'N1', 'N2', 'N3', 'N4') then raise exception 'Nivel no válido' using errcode = 'check_violation'; end if;
  if coalesce(length(trim(p_motivo)), 0) < 5 then raise exception 'Explica el motivo del cambio' using errcode = 'check_violation'; end if;
  select * into c from ia.capacidad where codigo = p_codigo for update;
  if not found then raise exception 'Esa capacidad no existe' using errcode = 'no_data_found'; end if;
  if ia.n(p_nivel) = ia.n(c.nivel_actual) then raise exception 'Ya está en %', p_nivel using errcode = 'check_violation'; end if;

  if ia.n(p_nivel) < ia.n(c.nivel_actual) then
    update ia.capacidad set nivel_actual = p_nivel, encendida = encendida and p_nivel <> 'N0', actualizado_en = now() where codigo = p_codigo;
    insert into ia.cambio_nivel (id, capacidad, de, a, motivo, evidencia, estado, cerrado_en)
    values (v_id, p_codigo, c.nivel_actual, p_nivel, trim(p_motivo), p_evidencia, 'aplicado', now());
    insert into ia.actividad (capacidad, nivel, accion, resumen, actor_es_ia, pedido_por, aprobado_por)
    values (p_codigo, p_nivel, 'cambio_nivel', left(format('Bajó %s de %s a %s: %s', p_codigo, c.nivel_actual, p_nivel, trim(p_motivo)), 1000), false, auth.uid(), auth.uid());
    return v_id;
  end if;

  if ia.n(p_nivel) > ia.n(c.nivel_actual) + 1 then raise exception 'Se sube un nivel a la vez' using errcode = 'check_violation'; end if;
  if ia.n(p_nivel) > ia.n(c.techo) then raise exception 'El techo de %s es %s: ninguna evidencia lo mueve', p_codigo, c.techo using errcode = 'check_violation'; end if;
  if exists (select 1 from ia.cambio_nivel where capacidad = p_codigo and estado = 'pendiente') then
    raise exception 'Ya hay una solicitud de cambio de nivel en curso para %', p_codigo using errcode = 'check_violation';
  end if;
  insert into ia.cambio_nivel (id, capacidad, de, a, motivo, evidencia) values (v_id, p_codigo, c.nivel_actual, p_nivel, trim(p_motivo), p_evidencia);
  v_sol := flujo.iniciar('nivel_ia', v_id, format('Subir %s de %s a %s', p_codigo, c.nivel_actual, p_nivel), null::uuid, '{}'::jsonb);
  update ia.cambio_nivel set solicitud_id = v_sol where id = v_id;
  insert into ia.actividad (capacidad, nivel, accion, resumen, actor_es_ia, pedido_por)
  values (p_codigo, c.nivel_actual, 'pidio_nivel', left(format('Pidió subir %s de %s a %s: %s', p_codigo, c.nivel_actual, p_nivel, trim(p_motivo)), 1000), false, auth.uid());
  return v_id;
end;
$$;

-- Lo que hace la ruta al cerrarse.
create or replace function ia.al_decidir_nivel(p_cambio uuid, p_decision text, p_estado_solicitud text)
returns void language plpgsql security definer set search_path = ia, public as $$
declare
  k ia.cambio_nivel;
begin
  select * into k from ia.cambio_nivel where id = p_cambio and estado = 'pendiente' for update;
  if not found then return; end if;
  if p_decision in ('rechazado', 'devuelto') then
    update ia.cambio_nivel set estado = 'rechazado', cerrado_en = now() where id = k.id;
    insert into ia.actividad (capacidad, nivel, accion, resumen, actor_es_ia, pedido_por, aprobado_por)
    values (k.capacidad, k.de, 'cambio_nivel', format('No se aprobó subir %s a %s', k.capacidad, k.a), false, k.pedido_por, auth.uid());
  elsif p_estado_solicitud = 'aprobada' then
    update ia.capacidad set nivel_actual = k.a, actualizado_en = now() where codigo = k.capacidad and ia.n(k.a) <= ia.n(techo);
    update ia.cambio_nivel set estado = 'aplicado', cerrado_en = now() where id = k.id;
    insert into ia.actividad (capacidad, nivel, accion, resumen, actor_es_ia, pedido_por, aprobado_por)
    values (k.capacidad, k.a, 'cambio_nivel', format('Subió %s de %s a %s con doble aprobación', k.capacidad, k.de, k.a), false, k.pedido_por, auth.uid());
  end if;
end;
$$;

-- La versión de siempre de `flujo.al_decidir` (20261120160000), más la rama «nivel_ia».
create or replace function flujo.al_decidir(p_tipo text, p_objeto uuid, p_accion text, p_hito boolean, p_decision text, p_estado_solicitud text)
returns void
language plpgsql security definer set search_path = flujo, org, sgc, public as $$
begin
  if p_tipo = 'requisicion_personal' then
    if p_decision = 'rechazado' then
      update org.requisicion set estado = 'rechazada' where id = p_objeto;
    elsif p_decision = 'devuelto' then
      update org.requisicion set estado = 'devuelta' where id = p_objeto;
    elsif p_hito then
      update org.requisicion set estado = 'aprobada' where id = p_objeto;
      perform org.aplicar_requisicion(p_objeto);
    elsif p_accion = 'recibir' then
      update org.requisicion set estado = 'en_seleccion' where id = p_objeto;
    end if;
  elsif p_tipo = 'proceso' then
    if p_decision = 'rechazado' or p_decision = 'devuelto' then
      update sgc.proceso set estado = 'borrador' where id = p_objeto and estado = 'en_revision';
    elsif p_estado_solicitud = 'aprobada' then
      perform sgc.publicar_proceso(p_objeto);
    end if;
  elsif p_tipo = 'escenario_estructura' then
    if p_decision in ('rechazado', 'devuelto') then
      update org.escenario set estado = 'borrador' where id = p_objeto;
    elsif p_estado_solicitud = 'aprobada' then
      update org.escenario set estado = 'aprobado' where id = p_objeto;
      perform org.publicar_escenario(p_objeto);
    end if;
  elsif p_tipo = 'escenario_procesos' then
    if p_decision in ('rechazado', 'devuelto') then
      update org.escenario set estado = 'borrador' where id = p_objeto;
    elsif p_estado_solicitud = 'aprobada' then
      update org.escenario set estado = 'aprobado' where id = p_objeto;
      perform sgc.publicar_escenario_procesos(p_objeto);
    end if;
  elsif p_tipo = 'nivel_ia' then
    perform ia.al_decidir_nivel(p_objeto, p_decision, p_estado_solicitud);
  end if;
end;
$$;
revoke execute on function flujo.al_decidir(text, uuid, text, boolean, text, text) from authenticated, public;

-- -----------------------------------------------------------------------------
-- 11) EL TABLERO DEL GOBIERNO (agregados; solo quien gobierna)
-- -----------------------------------------------------------------------------
create or replace function ia.tablero()
returns jsonb language plpgsql stable security definer set search_path = ia, public as $$
declare
  v_mes timestamptz := date_trunc('month', now() at time zone 'America/Caracas') at time zone 'America/Caracas';
  v_semana timestamptz := now() - interval '7 days';
begin
  if not public.puede('sistema:ia', 'ver') then return null; end if;
  return jsonb_build_object(
    'encendidas', (select count(*) from ia.capacidad where encendida),
    'registradas', (select count(*) from ia.capacidad),
    'tope_encendidas', 10,
    'propuestas_semana', (select count(*) from ia.propuesta where creado_en >= v_semana),
    'decididas_30', (select count(*) from ia.propuesta where decidido_en >= now() - interval '30 days' and estado in ('aceptada', 'editada', 'rechazada', 'revertida') and decidido_por is not null),
    'aceptadas_30', (select count(*) from ia.propuesta where decidido_en >= now() - interval '30 days' and estado in ('aceptada', 'editada') and decidido_por is not null),
    'aplicadas_n4_30', (select count(*) from ia.propuesta where creado_en >= now() - interval '30 days' and nivel = 'N4'),
    'revertidas_30', (select count(*) from ia.propuesta where decidido_en >= now() - interval '30 days' and estado = 'revertida'),
    'costo_mes_usd', (select coalesce(sum(costo_usd), 0) from ia.actividad where creado_en >= v_mes),
    'costo_hoy_usd', ia.gastado_hoy(),
    'tope_diario_usd', ia.tope_diario(),
    'tope_mes_usd', ia.tope_diario() * extract(day from (date_trunc('month', now() at time zone 'America/Caracas') + interval '1 month - 1 day')),
    'llamadas_mes', (select count(*) from ia.actividad where creado_en >= v_mes and costo_tokens > 0),
    'general', (select to_jsonb(g) from (select encendido, motivo, cambiado_en, privado.nombre_perfil(cambiado_por) as por from ia.interruptor_general) g),
    'por_capacidad', coalesce((select jsonb_object_agg(c.codigo, jsonb_build_object(
        'propuestas', (select count(*) from ia.propuesta p where p.capacidad = c.codigo and p.creado_en >= now() - interval '30 days'),
        'pendientes', (select count(*) from ia.propuesta p where p.capacidad = c.codigo and p.estado = 'pendiente'),
        'aceptadas', (select count(*) from ia.propuesta p where p.capacidad = c.codigo and p.estado in ('aceptada', 'editada') and p.decidido_por is not null and p.decidido_en >= now() - interval '30 days'),
        'rechazadas', (select count(*) from ia.propuesta p where p.capacidad = c.codigo and p.estado = 'rechazada' and p.decidido_en >= now() - interval '30 days'),
        'revertidas', (select count(*) from ia.propuesta p where p.capacidad = c.codigo and p.estado = 'revertida' and p.decidido_en >= now() - interval '30 days'),
        'llamadas', (select count(*) from ia.actividad a where a.capacidad = c.codigo and a.costo_tokens > 0 and a.creado_en >= v_mes),
        'costo_mes_usd', (select coalesce(sum(a.costo_usd), 0) from ia.actividad a where a.capacidad = c.codigo and a.creado_en >= v_mes),
        'latencia_ms', (select round(avg(a.latencia_ms)) from ia.actividad a where a.capacidad = c.codigo and a.latencia_ms is not null and a.creado_en >= now() - interval '30 days'),
        'errores', (select count(*) from ia.actividad a where a.capacidad = c.codigo and a.accion = 'error' and a.creado_en >= now() - interval '30 days'),
        'solicitud', (select jsonb_build_object('a', k.a, 'motivo', k.motivo, 'solicitud_id', k.solicitud_id, 'pedido_en', k.pedido_en, 'por', privado.nombre_perfil(k.pedido_por))
                        from ia.cambio_nivel k where k.capacidad = c.codigo and k.estado = 'pendiente')
      )) from ia.capacidad c), '{}'::jsonb));
end;
$$;

-- Lo que espera una decisión mía (Mi día): propuestas pendientes de objetos que
-- puedo ver y decidir.
create or replace function ia.mis_propuestas(p_limite integer default 6)
returns table (id uuid, capacidad text, nivel text, objeto_tipo text, objeto_id uuid, titulo text, objeto text, creado_en timestamptz, total bigint)
language sql stable security definer set search_path = ia, public as $$
  with x as (
    select p.* from ia.propuesta p
     where auth.uid() is not null and p.estado = 'pendiente'
       and coalesce((select encendido from ia.interruptor_general), false)
       and ia.puede_decidir_tipo(p.objeto_tipo) and nucleo.puede_ver_objeto(p.objeto_tipo, p.objeto_id)
  )
  select x.id, x.capacidad, x.nivel, x.objeto_tipo, x.objeto_id, x.titulo, privado.titulo_objeto(x.objeto_tipo, x.objeto_id), x.creado_en,
         (select count(*) from x)
    from x order by ia.n(x.nivel) desc, x.creado_en desc
   limit least(greatest(coalesce(p_limite, 6), 1), 20);
$$;

-- -----------------------------------------------------------------------------
-- 12) PERMISOS DE EJECUCIÓN
-- -----------------------------------------------------------------------------
revoke execute on all functions in schema ia from public, anon;
grant execute on function ia.n(text), ia.estado(), ia.motivo_bloqueo(text), ia.registrar_llamada(text, text, text, jsonb, integer, integer, numeric, integer, text, text, uuid),
  ia.revisar_plazas(), ia.explicar_propuestas(jsonb), ia.candidatos_clasificacion(integer), ia.proponer_clasificacion(jsonb),
  ia.decidir_propuesta(uuid, text, text, jsonb), ia.deshacer(uuid, text), ia.fijar_interruptor(boolean, text), ia.encender(text, boolean, text),
  ia.fijar_tope(numeric, text), ia.pedir_cambio_nivel(text, text, text, text), ia.tablero(), ia.mis_propuestas(integer),
  ia.puede_decidir_tipo(text)
  to authenticated;
-- Internas: solo desde otras funciones.
revoke execute on function ia.aplicar_metadatos(uuid, jsonb), ia.al_decidir_nivel(uuid, text, text), ia.gastado_hoy(), ia.tope_diario()
  from authenticated;
grant execute on all functions in schema ia to service_role;

comment on schema ia is 'R4 · IA visible: capacidades (N0–N4), propuestas, actividad inmutable, interruptores y cambios de nivel.';
