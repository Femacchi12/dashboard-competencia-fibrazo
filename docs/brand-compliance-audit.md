# Auditoría de identidad visual FIBRAZO — 2026-10-10

## Fuente única y alcance
- [Guía de marca y registro maestro](https://docs.google.com/document/d/1vgYxAB-KhkhHMb-zd-eGJLk_UX6QcSjznZ2WnFRd9m8/edit).
- [Estándar visual de dashboards](https://docs.google.com/document/d/1prrIG6gikA7rfvadDz2xRF_PnnhtUtMZlJXOagflY_U/edit).
- [Gobierno y control de cambios](https://docs.google.com/document/d/1rH6nH6qsXolzkq04jCOmej8xeez0JJAJwnjiiiYS1Ps/edit).

Identidad principal documentada: verde `#43FFA5`, negro `#000000`, gris `#58595B`; fuente Montserrat para interfaz general (adaptada de guía documental), Poppins para tablas. Complementarios observados en recursos: morado `#E94CFF`, amarillo `#FFB600`, fucsia `#FF005C` y naranja `#FF5400`. No reemplazar colores de significado funcional en gráficas, prioridades o estados sin revisar accesibilidad.

## Regla de trabajo
Consultar las referencias y documentar propuesta antes de tocar componentes. El contrato de tokens versionado localmente NO sincroniza automáticamente con Drive. Probar diseño de escritorio/móvil y las funciones antes de declarar cierre.

## Estado de implementación
- Los archivos `design/fibrazo-brand.tokens.json` y `brand-alignment.css` se encontraron en el repositorio y la interfaz los referencia directa o indirectamente.
- En Forms y Competencia se agregó la capa «shared shell v1.2» para tipografías, tablas y tokens compatibles con estilos heredados.
- Impacto Social importa `brand-alignment.css` desde `theme-executive.css`; mantener esta ruta.
- Redmine incorpora directamente `brand-alignment.css` en `index.html`.
- Esta auditoría confirma el estado del código, **no una validación visual de despliegue o regresión autenticada**.

## Pendientes de verificación
1. Inspeccionar escritorio y móvil con sesión autorizada: inicio, navegación, filtros, KPI, tablas, gráficos, mapas donde existan.
2. Confirmar publicación del commit en el hosting asociado a cada repositorio.
3. Revisar HEX directos y estilos `Inter` remanentes que anulen tokens por especificidad o estilos inline.
4. Registrar evidencia de captura antes/después y contraste de estado: EN CÓDIGO / PUBLICADO / VERIFICADO.
5. Si cambia el registro de marca, crear cambio controlado y actualizar los cuatro snapshots; no confiar en sincronización automática.
