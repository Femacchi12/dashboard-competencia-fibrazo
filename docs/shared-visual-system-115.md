# VIS-115 — Diseño complementario de Forms y Competencia

31/10/2026. Base de reversión: 366719b. Capa de presentación executive-shell.css; inicialización idempotente js/executive-shell.js llamada desde auth.js. No cambia reglas ni carga de datos.

Cabecera compacta sin marco, título Competencia, navegación Forms/Mapa/Competencia. Mi cuenta reúne correo, última consulta, salud de fuentes, actualizar, pendientes y cierre de sesión. Se mueven los nodos originales: los IDs y listeners se conservan. Cierra con clic exterior/Escape; devuelve foco al cerrar con Escape. Pendientes abre el panel existente y cierra el menú de cuenta.

Superficies neutras #181818 / #242424 / #282828, fondo negro, bordes #58595B y acento #43FFA5. El morado funcional y los colores semánticos de datos/gráficos se conservan. Resúmenes abiertos usan superficie gris continua y acento existente. Las reglas con scope body.executive-shell prevalecen sobre hojas dinámicas sin cambiar su orden ni su lógica.

Validación: node --check auth.js y js/executive-shell.js; check-city-access-082, check-forms-presence-082 y check-territorial-links-108 PASS. Revisión de escritorio y 390×844 con fixture sintética externa al repo, sin sesión ni datos reales. Cuenta, filtros, navegación y superficies comprobados; pendiente prueba del usuario con sesión real. Publicación se registra al verificarse.
