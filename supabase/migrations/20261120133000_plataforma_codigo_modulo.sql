-- NUC-IA lleva dos letras después del guion: el patrón del código de módulo las admite.
alter table control.modulo drop constraint if exists modulo_codigo_check;
alter table control.modulo add constraint modulo_codigo_check check (codigo ~ '^[A-Z]{3}-[A-Z]{2,4}$');
