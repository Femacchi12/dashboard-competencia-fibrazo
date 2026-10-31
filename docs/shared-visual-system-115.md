# VIS-115 — Diseño complementario de Forms y Competencia

31/10/2026. Base de reversión: 366719b. Capa de presentación executive-shell.css; inicialización idempotente js/executive-shell.js llamada desde auth.js. No cambia reglas ni carga de datos.

Cabecera compacta sin marco, título Competencia, navegación Forms/Mapa/Competencia. Mi cuenta reúne correo, última consulta, salud de fuentes, actualizar, pendientes y cierre de sesión. Se mueven los nodos originales: los IDs y listeners se conservan. Cierra con clic exterior/Escape; devuelve foco al cerrar con Escape. Pendientes abre el panel existente y cierra el menú de cuenta.

Superficies neutras #181818 / #242424 / #282828, fondo negro, bordes #58595B y acento #43FFA5. El morado funcional y los colores semánticos de datos/gráficos se conservan. Resúmenes abiertos usan superficie gris continua y acento existente. Las reglas con scope body.executive-shell prevalecen sobre hojas dinámicas sin cambiar su orden ni su lógica.

Validación: node --check auth.js y js/executive-shell.js; check-city-access-082, check-forms-presence-082 y check-territorial-links-108 PASS. Revisión de escritorio y 390×844 con fixture sintética externa al repo, sin sesión ni datos reales. Cuenta, filtros, navegación y superficies comprobados; pendiente prueba del usuario con sesión real. Publicación se registra al verificarse.

Publicación verificada 31/10/2026: cambios de shell da4d72758c828b4ff12a8cfb6592f081c9bad166 y cierre de resumen/caché 6d43818687929c0f449ddd5fd5eb59c5a92c0f88 en main. GitHub Pages sirve index.html, executive-shell.css, js/executive-shell.js, auth.js y visual-system.css idénticos al código probado. Puerta Google comprobada. Forms 0.8.167 READY en dominio habitual. Manuales corporativos Forms/Exploración/Competencia actualizados; pendiente sesión real y teléfono físico. Revisión adicional de resumen abierto confirma RGB 36/36/36 y cabecera 43/43/43; 320/390/430 px revisados.
