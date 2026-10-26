# FO-CHG-108 / EX-CHG-MAP-108 / CO-CHG-MAP-108

Autorización: Edu, 26/10/2026. Versión prevista Forms 0.8.161. Estado: QA previo a producción.

## Fuente de verdad consultada

- Marca: registro `1vgYxAB-KhkhHMb-zd-eGJLk_UX6QcSjznZ2WnFRd9m8`; guía original `1HyHCByE0wOK5XONjUdiCrODUNKCT8vha`.
- Norma de interfaces: estándar transversal v1.4 `1prrIG6gikA7rfvadDz2xRF_PnnhtUtMZlJXOagflY_U`, VIS-018/019.
- Manual Forms `1aecxyjjAMQuZ-cGfnkFiZ3ECgB56vnnxY2Xh_pUog6M`, Exploración `1JZuypYYEUMA26m7_LYKNT_72x_zCzo3WUkmHnAiO3bc`, Competencia `1GezJZrYmAMzJNfJFecEECJILQAKWL8fkiQB8Qvs7TQY` y contrato de consolidación `1Bhe8pAQ8t6ZbhikqX6r0P4jLZezmol_jyHHn7xQjKOA`.
- Registros de cambios y matrices de automatización de los tres procesos. Conversaciones Dash_Work_1 / Dash_Compet/Expl_19 recuperadas mediante contexto conectado. El mapa de campo vigente vive en Forms; no se identificó otro repositorio territorial canónico que deba duplicarse.

## Implementación

1. Popup Leaflet existente ampliado: conserva metadatos, coordenada copiable, clasificación, evidencia, fotos y notas; muestra filas de operadores numeradas por clase y nombre original. Reutiliza la regla de incumbentes vigente de `operatorProfile`; los colores y métricas de marcadores no cambian. Cada fila conserva la tecnología capturada, sin alterar registros.
2. Catálogo de navegación autenticado en `GET /api/isps?competition=1`; datos de lectura de 01_OPERADORES, 03_PRESENCIA, 02_PLANES_HISTORICO y equivalencias BUC confirmadas. No añade funciones serverless ni modifica el catálogo compartido del formulario. Caché en servidor 120 s y verificación de acceso previa a cada respuesta.
3. Resolución estricta por nombre/marca/grupo y ciudad; alias Neiva Networ→Networks, Wirlet→Wirtel y Nov/Nob→NovaNet autorizados por Edu el 24/10. Sin coincidencia aproximada entre Alfa Visión y Alpavision. Ambigüedad, catálogo caído y ausencia en ciudad se informan. Nombres originales no se reemplazan.
4. Enlace a Competencia: `operatorId`, nombre observado, ciudad y tecnología HFC/FTTH cuando está explícita. Abre nueva pestaña con `noopener noreferrer`. El consumidor valida ID y ciudad después de la carga autenticada, selecciona un corte disponible y usa los filtros existentes una sola vez; la actualización posterior no sobrescribe filtros manuales.
5. «Solo mapa» reutiliza pantalla completa existente (viewport del navegador, sin exigir fullscreen nativo). URL `/?view=map&map=only`; botón Volver y Escape restauran dashboard. Iniciar sesión sigue siendo obligatorio. No hay token de acceso, correo, coordenadas, QA ni evidencias en la URL compartida.
6. «Compartir solo mapa» conserva selecciones de ciudad y, con una ciudad, operadores; copia al portapapeles y ofrece input seleccionable si el navegador lo impide. Los parámetros de presentación no cambian los permisos backend ni acceden a pendientes locales de otro teléfono.
7. Filtros compartidos se aplican antes de consultar y no son sustituidos por GPS automático. Filtros de operador inexistentes no se convierten silenciosamente en «Todos».

Identidad: se reutilizan los tokens existentes #43FFA5, #000000, #58595B, Montserrat y Poppins; superficies y colores semánticos actuales. Sin nueva paleta azul, fuentes del prototipo, logos, tiles ni rediseño de navegación.

## QA y reversión

Pruebas automatizadas nuevas de resolución, alias, ausencias, ambigüedad, XSS, URL y pantalla completa, y consumidor de filtros canónico. Suite completa Forms y checks de Competencia. Fixture exclusivamente de Preview `docs/qa-territorial-map-108.html`: datos inventados, sesión de prueba sin token válido y APIs interceptadas; nunca consulta datos reales. Se elimina del árbol de producción.

Validar Preview en navegador antes de publicar. Probar protección HTTP real por separado de la sesión simulada. No atribuir a la prueba sintética una sesión real de Edu, prueba de GPS físico, sincronización de Android ni acceso de otras cuentas.

Reversión: restaurar commits anteriores de ambos repositorios y release PWA. No hay migraciones, cambios de Sheets de datos, reglas de estratos, rutas de sincronización, fotos, IndexedDB ni automatizaciones. Los únicos escritos externos del alcance son registros de cambios y manuales.
