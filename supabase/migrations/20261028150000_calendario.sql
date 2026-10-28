-- =============================================================================
-- El calendario de la Fase 2 y de New Iberia
-- =============================================================================
--
-- 28 de octubre de 2026. Gabriel pidió una página en el panel con el calendario
-- de todo lo que viene: la Fase 2 · Aliviar (la línea tecnológica, noviembre de
-- 2026 a abril de 2027) y New Iberia (desarrollo organizacional y procesos, con
-- el señor Carlos, noviembre de 2026 a octubre de 2027). Las actividades salen de
-- las dos propuestas de octubre y de la conversación del 27 con el señor Carlos,
-- en la que se ordenó quién hace qué y cuándo; Gabriel las pasó en un HTML.
--
-- Va en la base y no en el código porque **Amanda coordina las agendas**: cada
-- fecha «por confirmar» se fija con un área, y quien tiene la casilla de editar
-- la marca agendada, en curso o hecha, con su fecha confirmada y una nota, sin
-- pasar por un despliegue.
--
-- La puerta es la casilla `modulo:calendario`: el nivel administrador la tiene
-- sola; el resto de los roles, si se la marcan en «Roles y permisos».
-- -----------------------------------------------------------------------------

create table if not exists public.calendario_actividades (
  id               text primary key check (id ~ '^[a-z0-9-]+$'),
  titulo           text not null check (length(titulo) between 3 and 200),
  detalle          text not null default '',
  frente           text not null check (frente in (
                     'coordinacion', 'activacion', 'acompanamiento', 'procesos',
                     'desempeno', 'gestion_organizacional', 'estructura', 'tecnologia')),
  tipo             text not null default 'actividad'
                     check (tipo in ('actividad', 'reunion', 'entregable', 'hito')),
  estado           text not null default 'por_agendar'
                     check (estado in ('por_agendar', 'por_confirmar', 'agendado', 'en_curso', 'hecho')),
  inicio           date not null,
  fin              date check (fin is null or fin >= inicio),
  -- El día que el área confirmó. Puede caer fuera de la ventana prevista.
  fecha_confirmada date,
  responsable      text not null default '',
  participantes    text not null default '',
  nota             text not null default '' check (length(nota) <= 500),
  orden            integer not null default 0,
  updated_at       timestamptz not null default now(),
  updated_by       uuid references auth.users (id) on delete set null
);

comment on table public.calendario_actividades is
  'El calendario de la Fase 2 y de New Iberia: qué se hace, cuándo y con quién. Lo '
  've quien tiene la casilla modulo:calendario y lo actualiza quien puede editarla.';

create index if not exists calendario_actividades_inicio_idx
  on public.calendario_actividades (inicio, orden);

create trigger calendario_actividades_updated_at
  before update on public.calendario_actividades
  for each row execute function public.set_updated_at();

alter table public.calendario_actividades enable row level security;

create policy "calendario: ver con la casilla"
  on public.calendario_actividades for select to authenticated
  using (public.puede('modulo:calendario', 'ver'));

create policy "calendario: actualizar con la casilla"
  on public.calendario_actividades for update to authenticated
  using (public.puede('modulo:calendario', 'editar'))
  with check (public.puede('modulo:calendario', 'editar'));

revoke all on public.calendario_actividades from anon;
grant select, update on public.calendario_actividades to authenticated;

-- El equipo de Boosty lo ve y lo actualiza. Los roles de Iberia, solo si se les
-- marca la casilla.
insert into public.rol_permisos (rol_id, recurso, ver, editar)
select r.id, 'modulo:calendario', true, true
  from public.roles r
 where r.clave = 'consultor'
on conflict (rol_id, recurso) do nothing;

-- --- Las actividades, tal como quedaron el 28 de octubre de 2026 ----------------

insert into public.calendario_actividades
  (id, titulo, detalle, frente, tipo, estado, inicio, fin, responsable, participantes, orden)
values
  ('adendum-firma', 'Firma del Adendum N.º 1', 'Formaliza el cierre de la Fase 1, la Fase 2 y New Iberia.', 'coordinacion', 'hito', 'por_confirmar', '2026-10-28', '2026-10-30', 'Alberto García-Ramos', 'Gabriel', 0),
  ('martha-alvarez-app', 'Escribir a Martha Álvarez sobre sus comentarios a la app de comunicaciones', 'Recoger sus observaciones antes de alinear con Alberto y agendar la revisión con Fuguet.', 'tecnologia', 'actividad', 'por_agendar', '2026-10-28', '2026-10-29', 'Gabriel', 'Martha Álvarez (Mercadeo)', 1),
  ('confirmar-planta', 'Confirmar con Alberto el día en planta del miércoles 4 de noviembre', 'Confirmar también traslado a Cagua y salas para la presentación y las reuniones de la tarde.', 'coordinacion', 'actividad', 'por_confirmar', '2026-10-28', '2026-10-30', 'Amanda', 'Alberto García-Ramos', 2),
  ('presentacion-gerentes-prep', 'Preparar la presentación filtrada para gerentes', 'Carlos: desarrollo organizacional. Gabriel: tecnología. Versión resumida de hallazgos, el rol de los gerentes y el anuncio del plan 2027.', 'activacion', 'entregable', 'por_agendar', '2026-10-29', '2026-11-03', 'Carlos y Gabriel', '', 4),
  ('plan2027-antonio', 'Alberto revisa el plan 2027 con Antonio Sorrentino', 'Revisión previa a la reunión con directores.', 'activacion', 'actividad', 'por_confirmar', '2026-10-30', '2026-11-02', 'Alberto García-Ramos', 'Antonio Sorrentino', 3),
  ('comp-variable-diseno', 'Diseño de la compensación variable de directores', '', 'desempeno', 'actividad', 'por_agendar', '2026-11-02', '2026-11-27', 'Carlos', 'Alberto García-Ramos', 12),
  ('acomp-individual', 'Acompañamiento individual a directores y gerentes', 'Continuo, según lo pida cada persona.', 'acompanamiento', 'actividad', 'por_agendar', '2026-11-02', '2027-10-29', 'Carlos', 'Directores y gerentes, a demanda', 29),
  ('tarjeta', 'Iberia habilita la tarjeta de pago para servicios de terceros', 'Dependencia de la Fase 2: sin la tarjeta no se pueden activar los servicios de terceros.', 'tecnologia', 'hito', 'por_agendar', '2026-11-02', '2026-11-13', 'Gerencia General Iberia', 'Gabriel', 64),
  ('dueno-roadmap', 'Designar al dueño interno del roadmap', '', 'tecnologia', 'hito', 'por_agendar', '2026-11-02', '2026-11-13', 'Gerencia General Iberia', 'Gabriel', 65),
  ('planta-presentacion', 'Presentación a gerentes (9:00 a 11:00)', 'En planta Cagua. Resumen de hallazgos, su rol en el proceso y el plan 2027 que viene. Regreso previsto hacia las 15:00.', 'activacion', 'reunion', 'por_confirmar', '2026-11-04', '2026-11-04', 'Carlos y Gabriel', 'Alberto García-Ramos, gerentes', 5),
  ('planta-milagro', 'Hoja de ruta de procesos con Milagro Salas', 'Noviembre y diciembre: documentación. Milagro entrega los documentos de 2013. Las validaciones arrancan en enero.', 'procesos', 'reunion', 'por_confirmar', '2026-11-04', '2026-11-04', 'Carlos', 'Milagro Salas (Calidad)', 6),
  ('planta-directores', 'Primeras conversaciones de acompañamiento con directores', '', 'acompanamiento', 'reunion', 'por_confirmar', '2026-11-04', '2026-11-04', 'Carlos', 'Directores', 7),
  ('planta-jde', 'Plan de conexión a JD Edwards con Martha Fuentes y TI', 'En la tarde.', 'tecnologia', 'reunion', 'por_confirmar', '2026-11-04', '2026-11-04', 'Gabriel', 'Martha Fuentes (TI), equipo de TI', 8),
  ('milagro-docs-2013', 'Milagro entrega la documentación de procesos de 2013', '', 'procesos', 'hito', 'por_agendar', '2026-11-04', '2026-11-13', 'Milagro Salas', 'Carlos, Gabriel', 50),
  ('conector-plan', 'Plan del conector a JD Edwards acordado con TI', '', 'tecnologia', 'actividad', 'por_agendar', '2026-11-04', '2026-11-27', 'Gabriel', 'Martha Fuentes (TI)', 66),
  ('dir-plan2027', 'Reunión con directores sobre el plan 2027', 'Después de la revisión de Alberto con Antonio. Semana objetivo: 9 al 13 de noviembre.', 'activacion', 'reunion', 'por_agendar', '2026-11-09', '2026-11-13', 'Carlos', 'Alberto García-Ramos, Antonio Sorrentino, Dora, Flaviano, Gustavo Carballo, Gabriel', 9),
  ('dir-sesiones', 'Sesiones de dirección (unas 3)', 'Carlos manda notas de voz después de cada sesión y Gabriel las documenta.', 'activacion', 'actividad', 'por_agendar', '2026-11-09', '2026-11-27', 'Carlos', 'Directores, Alberto García-Ramos, Gabriel (documenta)', 10),
  ('app-revision-fuguet', 'Revisión de la app de comunicaciones con Fuguet', 'Después de los comentarios de Martha Álvarez y de alinear con Alberto. La app quedó como pendiente de Fase 1 bajo soporte, sin costo.', 'tecnologia', 'reunion', 'por_agendar', '2026-11-09', '2026-11-20', 'Gabriel', 'Amado Fuguet, Marcela Ojeda, Carlos, Martha Álvarez', 15),
  ('base-conocimiento', 'Base de conocimiento «cómo es hoy»', '', 'procesos', 'actividad', 'por_agendar', '2026-11-09', '2026-12-18', 'Gabriel', 'Milagro Salas', 51),
  ('ruth-entrevistas', 'Entrevistas complementarias si aparecen vacíos', '', 'procesos', 'actividad', 'por_agendar', '2026-11-16', '2026-12-11', 'Ruth', 'Dueños de proceso', 52),
  ('licencia-formacion', 'Licencia de formación en planta', 'Fecha por definir con Iberia.', 'tecnologia', 'actividad', 'por_agendar', '2026-11-16', '2026-12-18', 'Amanda', 'Gabriel, Martha Fuentes (TI)', 68),
  ('alberto-1', 'Reunión de seguimiento con Alberto', 'Cadencia mensual o cada 6 semanas: confirmar con Alberto cuál prefiere.', 'coordinacion', 'reunion', 'por_agendar', '2026-11-23', '2026-11-27', 'Gabriel y Carlos', 'Alberto García-Ramos', 30),
  ('informe-2026-11', 'Informe mensual de avance · noviembre 2026', '', 'coordinacion', 'entregable', 'por_agendar', '2026-11-26', '2026-11-30', 'Gabriel', 'Carlos', 38),
  ('dir-acuerdos', 'Acuerdos de funcionamiento y mapa de asuntos operativos', '', 'activacion', 'entregable', 'por_agendar', '2026-11-30', '2026-11-30', 'Carlos y Gabriel', 'Directores', 11),
  ('luz-llegada', 'Llega Luz a Gestión Organizacional', '', 'gestion_organizacional', 'hito', 'por_confirmar', '2026-11-30', '2026-11-30', 'Alberto García-Ramos', 'Luz', 18),
  ('espejo', 'Espejo de JD Edwards conciliando (Paso 0)', '', 'tecnologia', 'hito', 'por_agendar', '2026-11-30', '2026-12-18', 'Gabriel', 'Martha Fuentes (TI)', 67),
  ('comp-variable-entrega', 'Entrega de la compensación variable de directores', '', 'desempeno', 'entregable', 'por_agendar', '2026-12-01', '2026-12-18', 'Carlos', 'Alberto García-Ramos', 13),
  ('luz-sesion', 'Sesión de arranque con Luz', '', 'gestion_organizacional', 'reunion', 'por_agendar', '2026-12-01', '2026-12-11', 'Carlos', 'Luz, Gabriel', 19),
  ('roadmap-1', 'Reunión mensual de roadmap · diciembre', 'Primera semana del mes.', 'tecnologia', 'reunion', 'por_agendar', '2026-12-01', '2026-12-04', 'Gabriel', 'Dueño del roadmap, Martha Fuentes (TI)', 69),
  ('dir-diciembre', 'Reunión de dirección de diciembre', '', 'activacion', 'reunion', 'por_agendar', '2026-12-07', '2026-12-11', 'Carlos', 'Directores, Alberto García-Ramos, Gabriel', 14),
  ('milagro-diciembre', 'Sesión de diciembre con Milagro', '', 'procesos', 'reunion', 'por_agendar', '2026-12-07', '2026-12-11', 'Carlos', 'Milagro Salas, Gabriel', 53),
  ('gerentes-inicio', 'Sesión de inicio con gerentes: plan 2027 y mapa de asuntos', 'Antes de las vacaciones colectivas. Arranque de New Iberia desde el desarrollo organizacional.', 'activacion', 'hito', 'por_agendar', '2026-12-09', '2026-12-16', 'Carlos y Gabriel', 'Alberto García-Ramos, directores, gerentes', 16),
  ('base-operando', 'Base de conocimiento operando', '', 'procesos', 'entregable', 'por_agendar', '2026-12-18', '2026-12-18', 'Gabriel', 'Milagro Salas', 54),
  ('vacaciones', 'Vacaciones colectivas de Iberia', 'Fechas por confirmar con Iberia. No agendar sesiones en este rango.', 'coordinacion', 'actividad', 'por_confirmar', '2026-12-21', '2027-01-08', 'Amanda', '', 17),
  ('informe-2026-12', 'Informe mensual de avance · diciembre 2026', '', 'coordinacion', 'entregable', 'por_agendar', '2026-12-27', '2026-12-31', 'Gabriel', 'Carlos', 39),
  ('roadmap-2', 'Reunión mensual de roadmap · enero', 'Primera semana del mes.', 'tecnologia', 'reunion', 'por_agendar', '2027-01-04', '2027-01-08', 'Gabriel', 'Dueño del roadmap, Martha Fuentes (TI)', 70),
  ('go-hoja-ruta', 'Hoja de ruta de Gestión Organizacional', 'Incluye la línea nueva de fortalecimiento del rol supervisorio (encuesta de Amado Fuguet), el empoderamiento de gerentes y la gestión del desempeño.', 'gestion_organizacional', 'entregable', 'por_agendar', '2027-01-11', '2027-02-26', 'Carlos', 'Luz', 20),
  ('niveles-autoridad', 'Niveles de autoridad y decisión: definición y notificación a gerentes', 'Se definen con directores, atados al plan y al presupuesto, y se notifican a gerentes.', 'activacion', 'entregable', 'por_agendar', '2027-01-11', '2027-02-26', 'Carlos', 'Directores, Alberto García-Ramos', 21),
  ('desempeno', 'Gestión del desempeño atada a los indicadores del plan', '', 'desempeno', 'actividad', 'por_agendar', '2027-01-11', '2027-03-31', 'Carlos', 'Luz', 22),
  ('alberto-2', 'Reunión de seguimiento con Alberto', 'Cadencia mensual o cada 6 semanas: confirmar con Alberto cuál prefiere.', 'coordinacion', 'reunion', 'por_agendar', '2027-01-11', '2027-01-15', 'Gabriel y Carlos', 'Alberto García-Ramos', 31),
  ('validacion-deptos', 'Validación de procesos departamento por departamento', 'Secuencia por área: cómo es → mejoras → revisión con IA (equipo de Gabriel) → proceso optimizado y proceso meta. Jesús apoya de enero a marzo.', 'procesos', 'actividad', 'por_agendar', '2027-01-11', '2027-03-26', 'Ruth y Milagro Salas', 'Dueño de cada proceso, Jesús, equipo de Gabriel', 55),
  ('modulo-comercial', 'Módulo comercial y formación del equipo comercial', 'Primero en la secuencia.', 'tecnologia', 'actividad', 'por_agendar', '2027-01-11', '2027-02-12', 'Gabriel', 'Gerencia Comercial, dueño del roadmap', 74),
  ('gerentes-dia-1', 'Día de gerentes en planta · enero', 'Un día completo: reunión de gerentes, sesión con Luz (desarrollo organizacional) y sesión presencial con Milagro (procesos). Día exacto por fijar dentro de la semana.', 'acompanamiento', 'reunion', 'por_agendar', '2027-01-18', '2027-01-22', 'Carlos', 'Gerentes, Luz, Milagro Salas', 23),
  ('informe-2027-01', 'Informe mensual de avance · enero 2027', '', 'coordinacion', 'entregable', 'por_agendar', '2027-01-27', '2027-01-31', 'Gabriel', 'Carlos', 40),
  ('estructura-interno', 'Trabajo interno de estructura', 'Borradores desde marzo.', 'estructura', 'actividad', 'por_agendar', '2027-02-01', '2027-04-30', 'Josué', 'Carlos', 59),
  ('roadmap-3', 'Reunión mensual de roadmap · febrero', 'Primera semana del mes.', 'tecnologia', 'reunion', 'por_agendar', '2027-02-01', '2027-02-05', 'Gabriel', 'Dueño del roadmap, Martha Fuentes (TI)', 71),
  ('gerentes-dia-2', 'Día de gerentes en planta · febrero', 'Un día completo: reunión de gerentes, sesión con Luz (desarrollo organizacional) y sesión presencial con Milagro (procesos). Día exacto por fijar dentro de la semana.', 'acompanamiento', 'reunion', 'por_agendar', '2027-02-15', '2027-02-19', 'Carlos', 'Gerentes, Luz, Milagro Salas', 24),
  ('modulo-2', 'Segundo módulo (compras o finanzas, por confirmar)', '', 'tecnologia', 'actividad', 'por_agendar', '2027-02-15', '2027-03-12', 'Gabriel', 'Dueño del roadmap', 75),
  ('alberto-3', 'Reunión de seguimiento con Alberto', 'Cadencia mensual o cada 6 semanas: confirmar con Alberto cuál prefiere.', 'coordinacion', 'reunion', 'por_agendar', '2027-02-22', '2027-02-26', 'Gabriel y Carlos', 'Alberto García-Ramos', 32),
  ('informe-2027-02', 'Informe mensual de avance · febrero 2027', '', 'coordinacion', 'entregable', 'por_agendar', '2027-02-24', '2027-02-28', 'Gabriel', 'Carlos', 41),
  ('estructura-diseno', 'Diseño de estructura con comité de Luz y Milagro', 'Se valida con dirección.', 'estructura', 'actividad', 'por_agendar', '2027-03-01', '2027-06-18', 'Josué y Carlos', 'Luz, Milagro Salas, directores', 61),
  ('roadmap-4', 'Reunión mensual de roadmap · marzo', 'Primera semana del mes.', 'tecnologia', 'reunion', 'por_agendar', '2027-03-01', '2027-03-05', 'Gabriel', 'Dueño del roadmap, Martha Fuentes (TI)', 72),
  ('estructura-hito-marzo', 'Avance de estructura con dirección', 'Antes de Semana Santa (22 al 28 de marzo).', 'estructura', 'hito', 'por_agendar', '2027-03-08', '2027-03-12', 'Josué', 'Carlos, Alberto García-Ramos, directores', 60),
  ('gerentes-dia-3', 'Día de gerentes en planta · marzo', 'Un día completo: reunión de gerentes, sesión con Luz (desarrollo organizacional) y sesión presencial con Milagro (procesos). Día exacto por fijar dentro de la semana.', 'acompanamiento', 'reunion', 'por_agendar', '2027-03-15', '2027-03-19', 'Carlos', 'Gerentes, Luz, Milagro Salas', 25),
  ('modulo-3', 'Tercer módulo', 'Semana Santa del 22 al 28 de marzo en el medio.', 'tecnologia', 'actividad', 'por_agendar', '2027-03-15', '2027-04-16', 'Gabriel', 'Dueño del roadmap', 76),
  ('informe-2027-03', 'Informe mensual de avance · marzo 2027', '', 'coordinacion', 'entregable', 'por_agendar', '2027-03-27', '2027-03-31', 'Gabriel', 'Carlos', 42),
  ('manual-tres-areas', 'Manual de procesos y políticas: compras, comercial y finanzas', '', 'procesos', 'entregable', 'por_agendar', '2027-03-31', '2027-03-31', 'Ruth', 'Milagro Salas, Jesús, Gabriel', 56),
  ('alberto-4', 'Reunión de seguimiento con Alberto', 'Cadencia mensual o cada 6 semanas: confirmar con Alberto cuál prefiere.', 'coordinacion', 'reunion', 'por_agendar', '2027-04-05', '2027-04-09', 'Gabriel y Carlos', 'Alberto García-Ramos', 33),
  ('procesos-resto', 'Documentación y validación del resto de la organización', '', 'procesos', 'actividad', 'por_agendar', '2027-04-05', '2027-06-25', 'Ruth y Milagro Salas', 'Dueños de proceso, Gabriel', 57),
  ('roadmap-5', 'Reunión mensual de roadmap · abril', 'Primera semana del mes.', 'tecnologia', 'reunion', 'por_agendar', '2027-04-05', '2027-04-09', 'Gabriel', 'Dueño del roadmap, Martha Fuentes (TI)', 73),
  ('gerentes-dia-4', 'Día de gerentes en planta · abril', 'Un día completo: reunión de gerentes, sesión con Luz (desarrollo organizacional) y sesión presencial con Milagro (procesos). Día exacto por fijar dentro de la semana.', 'acompanamiento', 'reunion', 'por_agendar', '2027-04-12', '2027-04-16', 'Carlos', 'Gerentes, Luz, Milagro Salas', 26),
  ('informe-2027-04', 'Informe mensual de avance · abril 2027', '', 'coordinacion', 'entregable', 'por_agendar', '2027-04-26', '2027-04-30', 'Gabriel', 'Carlos', 43),
  ('checkpoint-f2', 'Punto de control de la Fase 2', '', 'tecnologia', 'hito', 'por_agendar', '2027-04-26', '2027-04-30', 'Gabriel', 'Alberto García-Ramos, dueño del roadmap', 77),
  ('gerentes-dia-5', 'Día de gerentes en planta · mayo', 'Un día completo: reunión de gerentes, sesión con Luz (desarrollo organizacional) y sesión presencial con Milagro (procesos). Día exacto por fijar dentro de la semana.', 'acompanamiento', 'reunion', 'por_agendar', '2027-05-17', '2027-05-21', 'Carlos', 'Gerentes, Luz, Milagro Salas', 27),
  ('alberto-5', 'Reunión de seguimiento con Alberto', 'Cadencia mensual o cada 6 semanas: confirmar con Alberto cuál prefiere.', 'coordinacion', 'reunion', 'por_agendar', '2027-05-17', '2027-05-21', 'Gabriel y Carlos', 'Alberto García-Ramos', 34),
  ('informe-2027-05', 'Informe mensual de avance · mayo 2027', '', 'coordinacion', 'entregable', 'por_agendar', '2027-05-27', '2027-05-31', 'Gabriel', 'Carlos', 44),
  ('gerentes-dia-6', 'Día de gerentes en planta · junio', 'Un día completo: reunión de gerentes, sesión con Luz (desarrollo organizacional) y sesión presencial con Milagro (procesos). Día exacto por fijar dentro de la semana.', 'acompanamiento', 'reunion', 'por_agendar', '2027-06-14', '2027-06-18', 'Carlos', 'Gerentes, Luz, Milagro Salas', 28),
  ('estructura-presentacion', 'Presentación de la estructura a Alberto y directores', '', 'estructura', 'hito', 'por_agendar', '2027-06-21', '2027-06-25', 'Josué y Carlos', 'Alberto García-Ramos, directores', 62),
  ('informe-2027-06', 'Informe mensual de avance · junio 2027', '', 'coordinacion', 'entregable', 'por_agendar', '2027-06-26', '2027-06-30', 'Gabriel', 'Carlos', 45),
  ('alberto-6', 'Reunión de seguimiento con Alberto', 'Cadencia mensual o cada 6 semanas: confirmar con Alberto cuál prefiere.', 'coordinacion', 'reunion', 'por_agendar', '2027-06-28', '2027-07-02', 'Gabriel y Carlos', 'Alberto García-Ramos', 35),
  ('manual-org', 'Manual de procesos y políticas de toda la organización', 'Fecha del adendum.', 'procesos', 'entregable', 'por_agendar', '2027-06-30', '2027-06-30', 'Ruth', 'Milagro Salas, Gabriel', 58),
  ('guia-resp', 'Guía de responsabilidades', '', 'estructura', 'entregable', 'por_agendar', '2027-07-01', '2027-08-31', 'Josué y Carlos', 'Luz', 63),
  ('informe-2027-07', 'Informe mensual de avance · julio 2027', '', 'coordinacion', 'entregable', 'por_agendar', '2027-07-27', '2027-07-31', 'Gabriel', 'Carlos', 46),
  ('alberto-7', 'Reunión de seguimiento con Alberto', 'Cadencia mensual o cada 6 semanas: confirmar con Alberto cuál prefiere.', 'coordinacion', 'reunion', 'por_agendar', '2027-08-09', '2027-08-13', 'Gabriel y Carlos', 'Alberto García-Ramos', 36),
  ('informe-2027-08', 'Informe mensual de avance · agosto 2027', '', 'coordinacion', 'entregable', 'por_agendar', '2027-08-27', '2027-08-31', 'Gabriel', 'Carlos', 47),
  ('alberto-8', 'Reunión de seguimiento con Alberto', 'Cadencia mensual o cada 6 semanas: confirmar con Alberto cuál prefiere.', 'coordinacion', 'reunion', 'por_agendar', '2027-09-20', '2027-09-24', 'Gabriel y Carlos', 'Alberto García-Ramos', 37),
  ('informe-2027-09', 'Informe mensual de avance · septiembre 2027', '', 'coordinacion', 'entregable', 'por_agendar', '2027-09-26', '2027-09-30', 'Gabriel', 'Carlos', 48),
  ('cierre', 'Informe final y transferencia de la base de conocimiento a Calidad', '', 'coordinacion', 'hito', 'por_agendar', '2027-10-18', '2027-10-29', 'Gabriel y Carlos', 'Milagro Salas, Alberto García-Ramos', 49)
on conflict (id) do nothing;
