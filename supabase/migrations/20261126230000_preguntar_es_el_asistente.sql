-- =============================================================================
-- «Preguntar a la IA» es el asistente (26-nov-2026)
-- =============================================================================
--
-- Pedido de Gabriel: los botones «Preguntar a la IA» abren ahora el asistente
-- (panel lateral, con el contexto de la pantalla), y lo que solo respondía
-- preguntas queda resuelto por él: con alcance, citas y los permisos de quien
-- pregunta. Esas capacidades se apagan (bajar es inmediato) y quedan marcadas.
-- El Gobierno de IA sigue siendo la capa de control: interruptor general,
-- niveles con doble aprobación y las capacidades que cambian datos.
-- =============================================================================

alter table ia.capacidad add column if not exists absorbida_por text references ia.capacidad (codigo);

update ia.capacidad
   set absorbida_por = 'NUC-ASI-IA-01',
       encendida = false,
       nivel_actual = 'N0',
       nota = 'Resuelta por el asistente de IA desde el 26-nov-2026: «Preguntar a la IA» abre el asistente, que responde con alcance, citas y los permisos de quien pregunta.',
       actualizado_en = now()
 where codigo in ('NUC-PRO-IA-01', 'NUC-DOC-IA-01', 'NUC-ORG-IA-01', 'NUC-ORG-IA-04', 'NUC-DOC-IA-06', 'FIN-TAS-IA-01');

-- Queda en el registro de lo que hace la IA, que no se borra.
insert into ia.actividad (capacidad, nivel, accion, resumen, evidencia, actor_es_ia)
select codigo, 'N0', 'apago', 'Absorbida por el asistente de IA (NUC-ASI-IA-01): «Preguntar a la IA» abre el asistente.', '[]'::jsonb, false
  from ia.capacidad where absorbida_por = 'NUC-ASI-IA-01';
