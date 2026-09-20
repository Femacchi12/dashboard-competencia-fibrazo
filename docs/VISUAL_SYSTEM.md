# Sistema Visual FIBRAZO — Dashboard de Competencia

**Versión:** 2026-09-19  
**Objetivo:** mantener un lenguaje visual único, sobrio, sólido y ejecutivo mientras el dashboard crece en profundidad.

## 1. Principios

1. **La información manda.** El diseño debe reducir tiempo de lectura, no decorar.
2. **FIBRAZO tiene un lenguaje único.** Negro, carbón, blanco, grises y verde FIBRAZO forman la base.
3. **El morado identifica acciones de despliegue.** Si un control abre, cierra o revela información adicional, usa morado.
4. **El verde tiene significado.** Se reserva para FIBRAZO, selección, foco y dato ejecutivo que merece énfasis.
5. **El rojo es excepcional.** Solo aparece ante una alerta crítica o amenaza competitiva directa. No se usa para precio, velocidad, decoración o datos pendientes rutinarios.
6. **Lo desplegado debe parecer desplegado.** Cualquier capa abierta debe diferenciarse del contenido permanente por fondo, borde y acento.
7. **Una interacción, un patrón.** “Ver resumen”, detalle de operador, lectura por troncal, menús y “Ver más” deben compartir lógica de estado cerrado/abierto.
8. **Sin efectos decorativos.** No usar gradientes, brillos, glows ni sombras llamativas.

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
| Morado acción desplegable | `--fz-action` | `#9d78c6` |
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

### Morado
Usar exclusivamente para **acciones que revelan, despliegan, contraen o amplían información**, por ejemplo:
- Ver resumen / Ocultar resumen;
- Ver más / Ver menos;
- Desplegar / Contraer lectura por troncal;
- nombre de operador cuando abre su ficha;
- enlaces internos que abren detalle adicional.

El morado comunica **“puedes ejecutar una acción de ampliación aquí”**. No representa un estado positivo, negativo ni una métrica.

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

### Amarillo
Usar para **atención operativa pendiente** que requiere seguimiento pero no representa una alerta crítica. El patrón principal es el botón ⚠️ de Pendientes importantes y sus elementos asociados.

No usar amarillo para métricas ordinarias, precios o decoración.

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
| Acción de despliegue | Morado oscuro / morado | Morado | Morado / carbón |
| Hover de despliegue | Morado más claro | Morado | Morado claro |
| Seleccionado | Control activo | Verde tenue | Verde |
| Acción principal no desplegable | Verde | Verde | Carbón |
| Abierto / desplegado | Fondo expandido | Verde oscuro | Verde + blanco |
| Crítico | Rojo muy oscuro | Rojo | Rojo/blanco |

## 6. Patrones obligatorios

### Ver resumen
**Cerrado:** botón morado visible, panel neutro.  
**Abierto:** botón morado oscuro con borde/texto morado + flecha hacia arriba; el contenido abierto mantiene fondo expandido y acento estructural verde.

### Resumen ejecutivo abierto — Opción B
Cuando `Ver resumen` está abierto, todo el contenido debe leerse como **un único bloque**:

- fondo verde-carbón uniforme en toda la superficie;
- cabecera ligeramente más intensa;
- subtítulos y secciones internas separados por espaciado y divisores;
- no usar diferentes fondos para Lectura gerencial, Resumen por troncal y Lectura por troncal;
- el morado permanece únicamente en controles de desplegar/contraer;
- el verde intenso se mantiene constante en etiquetas y datos destacados de arriba a abajo.

El objetivo es que el usuario distinga inmediatamente **qué pertenece al contenido desplegado** y **qué vuelve a ser parte del dashboard normal**.

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
Cerrado y abierto usan morado como señal de acción. El estado se diferencia por etiqueta, flecha/semántica y `aria-expanded=true`; el pie de expansión adopta superficie expandida.

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
3. usar morado únicamente cuando el control revela/oculta información;
4. evitar un color nuevo salvo necesidad funcional;
5. incorporar estado hover/focus/open si es interactivo;
6. incorporar `aria-expanded` o `aria-pressed` cuando corresponda;
7. reservar rojo para criticidad explícita.

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
