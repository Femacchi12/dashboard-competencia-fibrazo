# Dashboard de Competencia FIBRAZO

Dashboard interno de Growth e Inteligencia Competitiva.

## Arquitectura activa

La aplicación está separada por responsabilidad:

- `js/core.js`: estado compartido, fuentes y utilidades.
- `js/data.js`: carga, normalización y salud de fuentes desde Google Sheets.
- `js/filters.js`: alcance por ciudad, corte, operador, tecnología y troncal.
- `js/charts.js`: KPIs y gráficos de mercado.
- `js/table.js`: tabla consolidada de planes y competencia.
- `js/table-enhancements.js`: orden, columnas sticky y mejoras visuales de tabla.
- `js/operator-details.js`: detalle interactivo de operadores.
- `js/territory.js`: métricas y detalle operativo FIBRAZO por troncal.
- `js/comparison.js`: Vs. FIBRAZO y Comparador.
- `js/mobile.js`: competencia móvil y filtros propios.
- `js/app.js`: orquestación, navegación, actualización automática y estado de fuentes.

La vista antigua **Territorio** y la comparación histórica duplicada de la vista general fueron retiradas. La comparación entre cortes se concentra en **Comparador**.

## Fuente maestra

El dashboard consume únicamente **Base General Competencia FIBRAZO**.

Tablas activas:

- `01_OPERADORES`: maestro, contactos y canales.
- `02_PLANES_HISTORICO`: planes hogar por corte.
- `03_PRESENCIA`: presencia competitiva y troncales.
- `07_CONFIG`: mercados, catálogo territorial y oferta FIBRAZO.
- `10_FIBRAZO_METRICAS`: HHPP, activos, penetración y estratos.
- `12_COMPETENCIA_MOVIL`: histórico y corte actual de competencia móvil.

Las hojas de investigación web de hogar y móvil funcionan como staging; la información debe consolidarse en Base General antes de impactar el dashboard.

## Reglas vigentes

- Corte general: selección única.
- Comparador: uno o dos cortes.
- Presencia 2026 heredada desde 2025 solo cuenta como competencia actual si el operador fue revalidado en 2026 para esa ciudad.
- Los operadores tradicionales se priorizan visualmente en el orden Tigo → Claro → Movistar, sin ocultar al resto.
- Precio se representa con amarillo; velocidad con azul; presencia/FIBRAZO con verde.
- Las troncales del Comparador solo se muestran cuando tienen HHPP > 0.
- En Vs. FIBRAZO, cuando hay varias ciudades, la referencia comercial seleccionada se busca en cada ciudad; si no existe, se usa la oferta base local.

## Cortes actuales

- Competencia histórica: **2025-06**.
- Competencia web actual: **2026-09**.
- Operación FIBRAZO / HHPP: **2026-06**.
- Zona horaria de Base General: **America/Bogota**.

## Actualización

La aplicación reconsulta las ocho fuentes activas cada 120 segundos mientras la pestaña está visible. La cabecera muestra la salud de carga como `Fuentes X/8`.

## Publicación

GitHub Pages:

https://femacchi12.github.io/dashboard-competencia-fibrazo/
