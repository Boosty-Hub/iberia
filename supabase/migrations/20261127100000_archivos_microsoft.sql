-- =============================================================================
-- Los archivos de Microsoft 365 se quedan en Mis archivos (pedido de Gabriel, 27-nov-2026)
-- =============================================================================
--
-- «Cada vez que llame a un archivo, que ya se quede en la plataforma.» Lo que la
-- persona trae de OneDrive o SharePoint (desde la pestaña Microsoft 365 del «/» o
-- pidiéndoselo al asistente) queda como archivo suyo en la carpeta «Microsoft 365»
-- de Mis archivos, con `origen = 'microsoft'`. Volver a traerlo no lo duplica: si
-- cambió en Microsoft se actualiza la copia, y si no, se usa la que ya está.
--
--   · `ms_item`: el elemento en Microsoft (`<driveId>:<itemId>`).
--   · `ms_modificado`: la última modificación en Microsoft de la copia guardada.
--   · `ms_enlace`: dónde está en Microsoft (para abrirlo allá).
-- =============================================================================

alter table asistente.archivo add column if not exists ms_item text check (ms_item is null or length(ms_item) <= 400);
alter table asistente.archivo add column if not exists ms_modificado timestamptz;
alter table asistente.archivo add column if not exists ms_enlace text check (ms_enlace is null or length(ms_enlace) <= 2000);

-- Una copia de biblioteca por persona y elemento (las del chat, de antes de esto, llevan chat_id y no cuentan).
create unique index if not exists archivo_microsoft_unico
  on asistente.archivo (dueno, ms_item)
  where origen = 'microsoft' and chat_id is null and ms_item is not null;
