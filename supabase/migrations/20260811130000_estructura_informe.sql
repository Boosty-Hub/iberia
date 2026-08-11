-- =============================================================================
-- Estructura del informe.
--
-- No es un documento de arquitectura suelto: es un informe de levantamiento que
-- conduce al lector hasta la arquitectura. Primero cómo se hizo y qué se
-- encontró; después qué se propone, en qué orden y con qué riesgos.
--
-- Solo se reemplazan las secciones vacías: lo que ya tenga contenido se respeta.
-- =============================================================================

delete from public.informe_secciones where contenido_md is null;

insert into public.informe_secciones (slug, numero, parte, titulo, subtitulo, orden, publicado) values
  -- Apertura ------------------------------------------------------------------
  ('resumen-ejecutivo', '01', 'portada', 'Resumen ejecutivo',
   'Qué encontramos y qué proponemos, en dos páginas', 10, false),
  ('como-leer', '02', 'portada', 'Cómo leer este informe',
   'El recorrido: del levantamiento a la arquitectura', 20, false),

  -- Levantamiento · cómo llegamos hasta aquí -----------------------------------
  ('punto-de-partida', '03', 'levantamiento', 'El punto de partida',
   'La decisión del comité gerencial y el encargo', 30, false),
  ('metodo', '04', 'levantamiento', 'Cómo se hizo el levantamiento',
   'Sesiones, entrevistas, recorridos y fuentes consultadas', 40, false),
  ('la-empresa', '05', 'levantamiento', 'Industrias Iberia hoy',
   'El negocio, el portafolio y la planta de Cagua', 50, false),
  ('mapa-organizacion', '06', 'levantamiento', 'Mapa de la organización',
   'Direcciones, gerencias y quién decide qué', 60, false),
  ('procesos-clave', '07', 'levantamiento', 'Del pedido al cobro',
   'Los procesos que sostienen la operación', 70, false),
  ('sistemas-datos', '08', 'levantamiento', 'Sistemas, datos y conectividad',
   'Qué vive en el ERP, qué vive fuera y dónde nace cada dato', 80, false),
  ('cuellos-botella', '09', 'levantamiento', 'Cuellos de botella y trabajo manual',
   'Dónde se pierde tiempo, trazabilidad y margen', 90, false),
  ('madurez', '10', 'levantamiento', 'Madurez digital y disposición al cambio',
   'El punto de partida de las personas, no solo el de la tecnología', 100, false),
  ('restricciones', '11', 'levantamiento', 'Restricciones y condiciones de borde',
   'Lo que el contexto país, el ERP y la seguridad imponen', 110, false),

  -- Arquitectura · la pieza más completa ---------------------------------------
  ('principios', '12', 'arquitectura', 'Principios de arquitectura',
   'El núcleo protegido, las dos vías y la aprobación humana', 120, false),
  ('arquitectura-ia', '13', 'arquitectura', 'Arquitectura de IA propuesta',
   'El plano completo: capas, flujos de datos y conexiones al núcleo', 130, false),
  ('modulos', '14', 'arquitectura', 'Módulos priorizados',
   'Qué se construye, en qué orden y por qué ese orden', 140, false),
  ('gobierno-datos', '15', 'arquitectura', 'Gobierno de datos y seguridad',
   'Accesos, licenciamiento, trazabilidad y protección del núcleo', 150, false),
  ('hoja-de-ruta', '16', 'arquitectura', 'Hoja de ruta fases 2 a 4',
   'Secuencia, dependencias y puntos de control', 160, false),
  ('inversion-retorno', '17', 'arquitectura', 'Inversión y retorno estimado',
   'Costo por módulo y beneficio esperado', 170, false),
  ('supuestos-riesgos', '18', 'arquitectura', 'Supuestos y riesgos',
   'Qué debe validar la dirección antes de dimensionar la Fase 2', 180, false),

  -- Anexos ---------------------------------------------------------------------
  ('anexo-sesiones', '19', 'anexos', 'Anexo · Sesiones y entrevistas',
   'Registro de todo lo levantado, con fecha y participantes', 190, false),
  ('anexo-hallazgos', '20', 'anexos', 'Anexo · Catálogo de hallazgos',
   'Cada hallazgo con la cita que lo respalda', 200, false),
  ('anexo-inventario', '21', 'anexos', 'Anexo · Inventario de sistemas y archivos',
   'Fuentes documentales del levantamiento', 210, false)
on conflict (slug) do update
   set numero    = excluded.numero,
       parte     = excluded.parte,
       titulo    = excluded.titulo,
       subtitulo = excluded.subtitulo,
       orden     = excluded.orden;
