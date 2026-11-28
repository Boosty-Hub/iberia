-- Qué pasó con la transcripción de cada archivo de origen (28-nov-2026): cuando un archivo es copia de otro ya transcrito
-- (el .doc y el .pdf firmado de la misma política), aquí se dice a cuál equivale, para que «Archivo de origen» muestre que
-- su contenido sí está en la plataforma.
alter table sgc.documento_archivo add column if not exists transcripcion text;
