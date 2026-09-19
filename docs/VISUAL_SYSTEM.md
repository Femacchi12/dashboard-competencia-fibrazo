# Sistema Visual FIBRAZO — Dashboard de Competencia

**Versión:** 2026-09-19  
**Objetivo:** mantener un lenguaje visual único, sobrio, sólido y ejecutivo mientras el dashboard crece en profundidad.

## 1. Principios

1. **La información manda.** El diseño debe reducir tiempo de lectura, no decorar.
2. **FIBRAZO tiene un lenguaje único.** Negro, carbón, blanco, grises y verde FIBRAZO forman la base.
3. **El verde tiene significado.** Se usa para acción principal, selección, foco y dato ejecutivo que merece énfasis.
4. **El rojo es excepcional.** Solo aparece ante una alerta crítica o amenaza competitiva directa. No se usa para precio, velocidad, decoración o datos pendientes rutinarios.
5. **Lo desplegado debe parecer desplegado.** Cualquier capa abierta debe diferenciarse del contenido permanente por fondo, borde y acento.
6. **Una interacción, un patrón.** “Ver resumen”, detalle de operador, lectura por troncal, menús y “Ver más” deben compartir lógica de estado cerrado/abierto.
7. **Sin efectos decorativos.** No usar gradientes, brillos, glows ni sombras llamativas.

## 2. Paleta

| Uso | Token | Color |
|---|---|---|
| Fondo general | `--fz-page-bg` | `#000000` |
| Superficie estructural | `--fz-surface-bg` | `#101412` |
| Superficie elevada | `--fz-surface-raised` | `#141a17` |
| Superficie interior | `--fz-surface-inner` | `#171d1a` |
| Control neutro | `--fz-control-bg` | `#1d2320` |
| Hover neutro | `--fz-control-hover` | `#272e2a` |
| Control activo | `--fz-control-active` | `#222a26` |
| Borde estructural | `--fz-surface-border` | `#414d47` |
| Borde de control | `--fz-control-border` | `#56635d` |
| Verde FIBRAZO | `--fz-green` | `#00f29a` |
| Fondo expandido | `--fz-expanded-bg` | `#0c1712` |
| Cabecera expandida | `--fz-expanded-head` | `#101d17` |
| Borde expandido | `--fz-expanded-border` | `#315849` |
| Alerta crítica | `--fz-danger` | `#ff5f6d` |
| Fondo alerta crítica | `--fz-danger-bg` | `#1a0d10` |

## 3. Jerarquía de superficies

### Nivel 0 — Canvas
Fondo negro. Nunca se usa como tarjeta.

### Nivel 1 — Sección
Paneles permanentes: filtros, gráficos, base detallada, comparador.

### Nivel 2 — Contenido elevado
KPIs, tarjetas internas, filas gerenciales y bloques contenidos.

### Nivel 3 — Control
Botones, filtros, selects y búsquedas.

### Nivel 4 — Información desplegada
Resumen abierto, detalle de operador, detalle de troncal, menú flotante o tabla expandida.

**Regla:** el Nivel 4 debe usar `--fz-expanded-bg`, borde `--fz-expanded-border` y, cuando sea una ampliación relevante, una línea verde lateral o superior.

## 4. Semántica de color

### Verde
Usar para:
- acción primaria;
- opción seleccionada;
- estado abierto/foco;
- KPI o dato ejecutivo prioritario;
- acento de una capa desplegada.

No usar como fondo masivo de paneles.

### Blanco
Usar para:
- títulos;
- nombres de operadores;
- valores secundarios que necesitan alta legibilidad.

### Gris
Usar para:
- contexto;
- notas;
- estados neutrales;
- incertidumbre no crítica.

### Rojo
Usar únicamente para:
- error real;
- alerta crítica;
- amenaza competitiva directa confirmada.

No usar rojo para:
- “por validar”;
- precio alto/bajo;
- velocidad;
- falta de dato ordinaria;
- elementos decorativos.

## 5. Estados de interacción

| Estado | Fondo | Borde | Texto/acento |
|---|---|---|---|
| Cerrado / neutro | Control neutro | Gris | Blanco/gris |
| Hover | Gris más claro | Gris fuerte | Blanco |
| Seleccionado | Control activo | Verde tenue | Verde |
| Acción principal | Verde | Verde | Carbón |
| Abierto / desplegado | Fondo expandido | Verde oscuro | Verde + blanco |
| Crítico | Rojo muy oscuro | Rojo | Rojo/blanco |

## 6. Patrones obligatorios

### Ver resumen
**Cerrado:** botón verde visible, panel neutro.  
**Abierto:** botón neutro con borde verde + flecha hacia arriba; contenido con fondo expandido y borde/acento verde.

### Lectura por troncal
Usar `<details>`:
- cerrado: fila neutra con indicación “Desplegar detalle”;
- abierto: superficie expandida con borde izquierdo verde y “Contraer detalle”.

### Detalle de operador
Debe mostrar:
- cabecera claramente separada;
- línea izquierda verde;
- botón de cierre neutro;
- KPIs y tabla sobre superficie expandida.

El trigger del operador cambia de estado visual cuando el detalle está abierto.

### Ver más / Ver menos
Cerrado: botón neutro.  
Abierto: borde verde, texto verde y estado `aria-expanded=true`. La tabla permanece estructural; el pie de expansión adopta superficie expandida.

### Menús
Filtros, columnas y “Más ciudades”:
- fondo expandido;
- borde definido;
- línea superior verde;
- sin glow.

## 7. Tablas

- Encabezado siempre más oscuro/definido que el cuerpo.
- Hover neutral; nunca verde sólido.
- Datos de precio y velocidad no requieren colores diferentes por defecto.
- El verde marca prioridad, selección o referencia FIBRAZO.
- El rojo solo puede aparecer en una fila si existe una señal crítica explícita.

## 8. Alertas

Tres niveles conceptuales:

### Informativo
Gris. Ejemplo: “por validar”.

### Relevante
Blanco + borde más definido. Ejemplo: “sin precio comparable”.

### Crítico
Rojo. Ejemplo: competidor más barato **y** con velocidad igual/superior a FIBRAZO cuando se clasifica como amenaza directa.

## 9. Reglas para nuevos componentes

Antes de crear un nuevo estilo:
1. determinar si es sección, contenido elevado, control o capa desplegada;
2. reutilizar los tokens existentes;
3. evitar un color nuevo salvo necesidad funcional;
4. incorporar estado hover/focus/open si es interactivo;
5. incorporar `aria-expanded` o `aria-pressed` cuando corresponda;
6. reservar rojo para criticidad explícita.

## 10. Implementación

- `theme-uniform.css`: tema base y superficies permanentes.
- `executive-summary.css`: estructura del resumen ejecutivo.
- `executive-summary-refinement.css`: estructura específica de lectura gerencial/troncales.
- `visual-system.css`: **capa final de consistencia visual y estados interactivos**.

`visual-system.css` debe cargarse después de las demás capas visuales para actuar como contrato final de presentación.

## 11. Criterio de revisión

Cada cambio visual futuro debe responder tres preguntas:

1. ¿Se entiende en menos de 3 segundos si el elemento está cerrado, seleccionado o abierto?
2. ¿El color utilizado comunica una función real?
3. ¿Se parece al resto del dashboard o introduce un lenguaje nuevo innecesario?

Si la respuesta a cualquiera es “no”, el componente debe ajustarse antes de publicarse.
