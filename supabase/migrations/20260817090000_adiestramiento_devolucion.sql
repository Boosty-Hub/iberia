-- =============================================================================
-- LA DEVOLUCIÓN DE AJITO
--
-- `respuestas.devolucion` ya existía desde la migración del módulo: es el texto
-- que Ajito contesta. Faltaban dos cosas para que eso se pueda oír.
--
--  1. DÓNDE ESTÁ EL AUDIO. La devolución se dice, no se lee — es la regla del
--     guion: «Ajito responde en audio, nunca con viñetas». El mp3 se sintetiza
--     en el momento y se guarda en la carpeta de la persona dentro del bucket
--     `adiestramiento-respuestas`, que ya tiene la política de dueño-en-la-ruta.
--     Así la devolución hereda la misma promesa que la respuesta: la oye quien
--     la provocó, y nadie más.
--
--  2. CUÁNDO SE GENERÓ. Sirve para dos cosas distintas: reintentar las que se
--     quedaron a medias por un fallo del modelo, y medir cuánto se tarda de
--     verdad — que es lo que decide si la persona espera o abandona.
-- =============================================================================

alter table public.respuestas
  add column if not exists devolucion_audio text,
  add column if not exists devolucion_en    timestamptz;

comment on column public.respuestas.devolucion is
  'Lo que Ajito contestó, en texto. Se genera con el modelo a partir de la '
  'respuesta de la persona y las reglas de contenido/adiestramiento/'
  '00-reglas-del-guion.md. Se guarda aunque el audio falle.';

comment on column public.respuestas.devolucion_audio is
  'Ruta del mp3 de la devolución dentro del bucket adiestramiento-respuestas. '
  'Va bajo respuestas/<empleado_id>/ para que la política de dueño-en-la-ruta '
  'lo cubra sin escribir nada nuevo.';

comment on column public.respuestas.devolucion_en is
  'Cuándo se generó. Nulo mientras no exista: es lo que consulta la aplicación '
  'para saber si tiene que pedirla.';

-- Las que se quedaron sin contestar. La aplicación reintenta sola cuando la
-- persona vuelve a abrir la lección, pero esto permite barrerlas desde el panel
-- sin recorrer la tabla entera.
create index if not exists respuestas_sin_devolucion_idx
  on public.respuestas (matricula_id)
  where devolucion is null;
