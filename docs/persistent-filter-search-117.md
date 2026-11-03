# FO-CHG-117 — Conservar búsquedas al seleccionar filtros

Solicitud de Edu, 03/11/2026. Forms 0.8.169 y dashboard Competencia. El buscador conserva su texto y el listado de coincidencias al seleccionar/desseleccionar, quitar chips, salir/volver al campo, cerrar/reabrir y actualizar opciones. Se aplica a ciudades, tipos, operadores y usuarios del mapa. Estratos, barrios y troncales conservan sus campos; cambiar el modo de listado de barrios ya no borra la búsqueda. La biblioteca de operadores tampoco borra su búsqueda al seleccionar desde el análisis territorial. El texto se elimina solo por edición del usuario o acción explícita de limpiar/restablecer.

Competencia conserva texto, apertura y desplazamiento de cada filtro durante su reconstrucción, incluyendo Otros mercados. Limpiar y Restablecer vacían las búsquedas. Se conserva la lógica de selección, compatibilidad entre filtros y límite de un corte. No cambian datos, permisos ni sincronización.

Validación: prueba de eventos DOM con jsdom26 sobre scripts reales, cuatro selectores de mapa: selección múltiple/desmarcado, chips, Escape, salida/entrada al campo, opciones añadidas asíncronamente, sin coincidencias y limpiar. Competencia: seleccionar/desmarcar con búsqueda activa y reconstrucción, búsqueda de ciudades y limpieza explícita. Suite Forms completa aprobada; se actualizó la comprobación antigua que exigía borrar la búsqueda, según la nueva decisión de Edu. Tres controles existentes de Competencia aprobados. No se afirma prueba autenticada ni teléfono físico.

Reversión: restaurar archivos de UI y caché desde los commits previos (Forms c19152181469fecf7a8d6fdefc893512252d0a06; Competencia 38e0086), sin borrar IndexedDB ni colas. Publicación y cotejo de archivos se registran después del despliegue.
