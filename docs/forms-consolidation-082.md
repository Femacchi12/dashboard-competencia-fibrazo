# FO-CHG-082 · Forms → Competencia · 20/10/2026

Edu autoriza la consolidación automática de observaciones reales de Forms en Base General, aun sin precios. Confirma que los dos registros RODEO son visitas intencionales: no deduplicar por proximidad. El ID de respuesta, no la coordenada, identifica cada visita.

## Dueños de datos y alcance

- Forms conserva respuestas originales, coordenadas, fotos y marca Es_Prueba en `1E66QjQVPT61j-2MdyL3V6s9iXKaX15wBKOujga8p4SY`.
- Competencia recibe materializaciones trazables en `1v2sBVe_w-bTl438b8qWFmvw0gT66bj8TskcXbnY-gbU`: `01_OPERADORES`, `03_PRESENCIA`, `04_RELEVAMIENTOS`, `05_EVIDENCIAS`, `08_CONTROL_CALIDAD` y `20_CARGA_PROYECTOS_CIUDAD`.
- Las respuestas QA no participan. Nombres Sin ISP y Sin Identificar no crean empresas. No se inventan precios, velocidades, troncales, cobertura total ni estratos confirmados. CHURN no alimenta esta integración.

## Contrato de integración

Se normaliza por nombre exacto sin distinguir tildes, puntuación o mayúsculas, con preferencia por ciudad cuando hay varias coincidencias. Se reutiliza un maestro inequívoco; los tradicionales conservan su grupo. Los nombres desconocidos o ambiguos reciben ID OPF determinístico y estado «Observado · identidad por validar», con incidencia de calidad. No se aplica fusión difusa: TecnoRed/TecneRed y Llano Fiber/Llanos Fibra requieren evidencia humana para unificarse.

Cada respuesta genera un relevamiento EXF y una evidencia FZF. Cada operador/tecnología observado genera staging FZO con vínculo al ID de respuesta. La observación de campo con coordenada válida se considera validada para presencia, sin declarar confirmada la identidad legal del operador provisional. Esta regla, autorizada por Edu, amplía P-032 para la fuente Forms; no valida automáticamente otras investigaciones o staging heredado.

Presencia CVF agrega observaciones por mes + ciudad + barrio confirmado + operador + tecnología. Si el barrio está FUERA, el alcance es municipal. Varios puntos cercanos siguen siendo observaciones independientes en la evidencia. Una observación puntual no demuestra cobertura de todo el barrio o de una troncal. Una ficha sin GPS o municipio válido conserva evidencia y pendientes, pero no crea presencia geográfica confirmada.

## Automatización e integridad

`api/submissions.js` ejecuta la conciliación tras guardar, editar o recibir un reintento del mismo ID. `api/competition-sync.js` permite reejecución completa con sesión de administrador; botón «Conciliar competencia» en En línea. La lectura usa el ID de Forms configurado en producción. Se relee todo el origen, por lo que también se recuperan observaciones que fallaron antes y se reflejan reclasificaciones QA/ediciones.

Un bloqueo con ID único de developerMetadata en la hoja destino serializa escritores de esta integración; vence a los 180 s si el proceso se interrumpe. La liberación exige el valor del propietario. Se comprueba la posesión antes de escribir. Todo el cambio de tablas se envía en un único batch atómico. Identificadores estables permiten repetir sin append duplicado. Se respetan filas ajenas a los prefijos de integración. Derivados obsoletos se retiran; incidencias resueltas conservan su fila con estado Resuelto. No borrar manualmente filas OPF/FZO/CVF para «arreglar» un origen todavía vigente.

Si Competencia falla, Forms sigue recibido. La cola local conserva «Recibido · competencia pendiente» y reintenta el POST con el mismo ID, sin volver a crear respuesta ni subir fotos. La recuperación automática depende de la ejecución de la PWA; el administrador puede conciliar todo posteriormente. No se promete un cron servidor que no haya sido configurado.

## Presentación y fuentes territoriales

Los paneles En línea/Pendientes de desarrollo son mutuamente excluyentes. El contexto de apilamiento de la cabecera se eleva mientras el panel de sincronización está abierto; se añade cierre Escape y límites de alto/desplazamiento.

El dashboard de Competencia incorpora presencias CVF en resumen/contactos como «Relevado · sin oferta comercial». Precio y velocidad son null; no se agregan a `state.plans`, benchmarks ni KPIs de planes comerciales. El selector de corte incluye meses que solo tienen presencia. Sigue aplicando filtros y exclusiones de tecnologías alternativas.

Estrato canónico, referencia cercana y observado manual son conceptos separados. `readRows` ya no presenta el estrato cercano como confirmado: exige Estrato_Estado DENTRO. Se conservan campos separado de referencia, registrado y observado. No se promueve la geometría QA de Villavicencio/Neiva/Ibagué a oficial mediante este cambio.

Se añade validación servidor de coordenada para nuevos registros territoriales. Una edición de fotos de Inteligencia sin location no borra la coordenada previa válida. No se inventan coordenadas de las fichas históricas incompletas.

## Verificación y reversión

Regresiones Forms completas; suites de consolidación (QA, preservación de originales/manuales, IDs repetidos, actualización y segunda ejecución sin cambios), bloqueo entre procesos, escrituras nativas y resumen sin precios. La prueba de cola cubre recepción de Forms con Competencia pendiente y recuperación con el mismo ID.

La ejecución productiva y sus conteos se documentan en Manual Forms y en Documentación/Automatización-Competencia. Publicado y validado en navegador son hitos distintos. Reversión de código: Forms al commit 7d7bf0cf4ae38f5ad1684d243db6b9232591b235; Competencia al commit 96217b157a7623a67de89cd4428e19785a1b7c42. Los datos derivados quedan identificados por prefijo; preservar originales y cualquier corrección humana antes de retirar una materialización.
