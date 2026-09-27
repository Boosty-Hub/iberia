-- =============================================================================
-- Ajito dibuja: el dibujo que hizo para cada respuesta de la lección 4
-- =============================================================================
--
-- 27 de septiembre de 2026, con Gabriel. Hasta aquí Ajito decía «todavía no
-- puedo hacer imágenes» y contaba en voz alta el dibujo que habría salido. Ahora
-- lo dibuja de verdad (OpenAI, `gpt-image-2.5-flare`; ver `lib/dibujar.ts`).
--
-- El dibujo es de Ajito, pero habla de lo que la persona pidió, así que va en su
-- fila de `respuestas` y en su carpeta del bucket privado —`respuestas/{id}/…`—,
-- con las mismas políticas que su foto o su nota de voz: la lee ella y el equipo.
--
-- `dibujo_veredicto` dice qué decidió el filtro antes de dibujar: `va`, `persona`
-- (pidió dibujar a alguien de verdad) o `no_va`. Con `persona` o `no_va` no hay
-- dibujo, la devolución es el texto fijo del guion y la persona puede pedir otro.
-- -----------------------------------------------------------------------------

alter table public.respuestas
  add column if not exists dibujo text,
  add column if not exists dibujo_veredicto text
    check (dibujo_veredicto is null or dibujo_veredicto in ('va', 'persona', 'no_va'));

comment on column public.respuestas.dibujo is
  'Ruta en el bucket de respuestas del dibujo que Ajito hizo con lo que la persona pidió (lección 4).';
comment on column public.respuestas.dibujo_veredicto is
  'Qué decidió el filtro antes de dibujar: va, persona (alguien de verdad) o no_va.';
