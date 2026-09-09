# Dashboard de Competencia FIBRAZO

Dashboard interno de Growth e Inteligencia Competitiva.

## Arquitectura

La aplicación está separada por responsabilidad para facilitar iteraciones rápidas y reducir el riesgo de cambios cruzados:

- `js/core.js`: estado compartido, fuentes y utilidades.
- `js/data.js`: carga y normalización de Google Sheets.
- `js/filters.js`: filtros, ciudades y alcance territorial.
- `js/charts.js`: KPIs, evolución y gráficos.
- `js/table.js`: tabla consolidada de planes y competencia.
- `js/operator-details.js`: detalle interactivo de operadores.
- `js/territory.js`: presencia territorial y vista FIBRAZO.
- `js/comparison.js`: Vs. FIBRAZO y comparador.
- `js/app.js`: orquestación, eventos y actualización automática.

Los archivos antiguos `app.js`, `hotfix.js` y `operator-details.js` se conservan temporalmente como respaldo, pero ya no forman parte del flujo activo.

## Datos principales

La Base General Competencia incluye:

- operadores;
- histórico de planes;
- presencia territorial;
- zonas y troncales FIBRAZO;
- oferta FIBRAZO;
- `10_FIBRAZO_METRICAS`: HHPP, clientes activos y penetración por troncal.

El corte operativo actual de HHPP/penetración consolidado es **2026-06**.

## Publicación

GitHub Pages:
https://femacchi12.github.io/dashboard-competencia-fibrazo/
