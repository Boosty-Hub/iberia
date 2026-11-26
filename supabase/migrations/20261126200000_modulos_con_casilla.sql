-- =============================================================================
-- Cada módulo de Administración con su casilla de Roles (26-nov-2026)
-- =============================================================================
--
-- Pedido de Gabriel: con un usuario de prueba (rol Usuario Iberia) se veían
-- todos los módulos de Administración. Dos causas, las dos del menú (las
-- páginas sí pedían su permiso):
--   · un módulo operando SIN recurso salía para cualquiera (Flujos, Gobierno de IA);
--   · los planificados salían para todos, «porque son el plan».
-- Aquí, los dos operando quedan con su pantalla y su casilla; la regla del
-- menú (lib/plataforma/servidor.ts) deja el plan solo a quien lee la hoja de
-- ruta y un módulo con pantalla sin casilla, solo al nivel administrador.
-- =============================================================================

-- Flujos, aprobaciones y tareas: en Administración es la configuración de las
-- rutas de aprobación. La bandeja personal sigue en Mi día (MI-APR), para todos.
update control.modulo set ruta = '/sistema/administracion/aprobaciones', recurso = 'sistema:aprobaciones'
 where codigo = 'NUC-FLU';

-- Biblioteca del programa: junta el informe, el programa, el calendario y el
-- expediente; sale con cualquiera de esas casillas (RECURSOS_ALTERNOS, con
-- «informe:*» = alguna sección del informe).
update control.modulo set recurso = 'modulo:programa' where codigo = 'PRG-BIB';

-- Gobierno de IA: capacidades, niveles e interruptor general.
update control.modulo set ruta = '/sistema/administracion/ia', recurso = 'sistema:ia'
 where codigo = 'NUC-GIA';
