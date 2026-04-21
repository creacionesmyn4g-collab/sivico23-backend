Miguel — Asistente para pruebas y comprobaciones del proyecto SIVICO23

Descripción
- `miguel` es un pequeño CLI que ejecuta las comprobaciones principales del proyecto:
  - Ejecuta los tests del backend (`npm test` en `backend`).
  - Verifica el endpoint de salud desplegado en Render (`https://sivico23-backend.onrender.com/api/health`).
  - Intenta conectar a la base de datos (usa `backend/.env` o `DATABASE_URL`).
  - Busca `API_BASE_URL` en `frontend/src/utils/constants.js` y verifica el endpoint.

Instalación rápida

1. Abrir una terminal en la raíz del proyecto.
2. Instalar dependencias del asistente:

```bash
cd tools/miguel
npm install
```

Uso

```bash
# Ejecutar comprobaciones
npm run check
# o
node miguel.js
```

Notas
- El script asume Node.js >= 18.
- Si el proyecto no tiene `backend/.env` con `DATABASE_URL`, puede usar la variable de entorno `DATABASE_URL`.
- Para ampliar `miguel` (p. ej. e2e, comprobaciones de frontend con Playwright), añadir dependencias y nuevas funciones en `miguel.js`.

Configuración extra

Coloca un `config.json` en `tools/miguel` con la estructura:

```json
{
  "endpoints": [ { "name": "Health", "url": "https://.../api/health" } ],
  "commands": [ { "name": "Backend tests", "cmd": "npm test", "cwd": "backend" } ]
}
```

`miguel` ejecutará esos checks adicionales y los mostrará en el resumen.

CI — GitHub Actions

He añadido un workflow en `.github/workflows/miguel.yml` que ejecuta `tools/miguel` en cada push y pull-request sobre `main`/`master`.

Secrets requeridos para el workflow:
- `DATABASE_URL` — URL de conexión Postgres (Supabase). Ej: `postgresql://...`.
- `SUPABASE_SERVICE_ROLE_KEY` — (opcional) service_role key para checks avanzados en Supabase.

Cómo añadir los secrets en GitHub:
1. En GitHub: Settings → Secrets and variables → Actions → New repository secret.
2. Crear `DATABASE_URL` y, si deseas, `SUPABASE_SERVICE_ROLE_KEY`.

El workflow fallará si las comprobaciones de `miguel` devuelven errores; revisa los logs en la pestaña `Actions` del repo.
