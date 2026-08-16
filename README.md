# Dashboard Competencia FIBRAZO

Dashboard independiente de inteligencia competitiva de FIBRAZO.

## Fuente única de datos

Google Sheet **Base General Competencia FIBRAZO** (`1v2sBVe_w-bTl438b8qWFmvw0gT66bj8TskcXbnY-gbU`).

El frontend consume exclusivamente estas hojas de salida:
- `10_DASH_PLANES` (`gid=790372285`)
- `11_DASH_COBERTURA` (`gid=2010490009`)
- `12_DASH_COMPETENCIA` (`gid=970350613`)

No contiene semillas estáticas de planes ni conexión al antiguo Sheet `Competencia`.

## Acceso

Autenticación Google/Firebase. Se autoriza `@fibrazo.com` y la excepción ya definida para el propietario del dashboard.

## Publicación

Pensado para GitHub Pages desde la rama `main`, raíz `/`.
