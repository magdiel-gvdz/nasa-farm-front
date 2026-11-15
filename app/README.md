# Field Shift — frontend

React, Vite, TypeScript, React Query y MapLibre. La interfaz se mantiene en inglés.

## Desarrollo

```bash
npm ci
npm run dev
```

`app/.env` configura la API persistente de **dev**:
`https://na-80276c48174345cab83857032d88d2ac.ecs.us-east-1.on.aws`.
Vite carga esa URL tanto al desarrollar como al compilar; se puede sustituir mediante
`VITE_API_URL` en el entorno o `app/.env.local`. Usar el origen de la API; el cliente añade
`/api/v1`. El origen del frontend debe estar permitido por CORS en el backend.

```bash
npm run dev:demo      # Demostración explícita, sin backend
npm run build        # Compilación conectada a dev por defecto
npm run build:demo   # Compilación de demostración
```

Las variables `VITE_*` se resuelven al compilar. Cambiar la URL después de publicar requiere
volver a compilar. No colocar credenciales en estas variables.

## Contrato e integración

La fuente de verdad es [`../contracts/openapi.json`](../contracts/openapi.json), copiada del
repositorio `nasa-farm-back`. `src/api/backend.d.ts` se genera desde ese contrato:

```bash
npm run api:generate
npm run api:check
```

Para actualizarlo, copiar `contracts/openapi.json` desde el backend y regenerar los tipos.
`src/api/adapters.ts` convierte los modelos del servidor a modelos de presentación. Los nombres,
IDs y parámetros agronómicos vienen de `/crops`; solo categorías e iconos son de presentación.
Los modelos antiguos y motores de demostración quedan separados en `src/api/mock/`.

El modo real usa geocercas CRUD, fuentes, catálogo, perfil síncrono, aptitud, rotaciones,
escenarios, evaluación de viento de invernadero, subida de suelo y chat con historial/SSE.
Las secciones sin datos conservan `null`. Los riesgos se presentan en **36 decenas**, con
probabilidades desconocidas diferenciadas de cero. Los resultados son zonales (celdas de 9 km)
y la cobertura del piloto se limita a cuatro zonas de Coahuila.

La subida de suelo acepta PDF/JPG/PNG de hasta 10 MB y **guarda inmediatamente** los valores
aceptados. No hay un segundo paso de guardado, edición manual o borrado del análisis en la API
actual. El front invalida perfil, geocerca, aptitud y rotaciones tras una aplicación exitosa.
`n_mg_kg`, `p_mg_kg` y `k_mg_kg` se muestran como ppm (numéricamente equivalentes).

Rendimiento, calidad de agua y proyecciones CMIP6 están disponibles solo en demostración:
el backend actual no ofrece esos endpoints. Los escenarios manuales sí están conectados;
son hipotéticos, no pronósticos. Chat y extracción requieren Bedrock habilitado en el entorno.

`X-Client-Id` es un UUID persistente por navegador, no autenticación. El historial de chat se
recupera del servidor mediante el ID de conversación guardado por API, cliente y geocerca.

## Validación

```bash
npm run build
npm run lint
npm run api:check
npm test
npx playwright install chromium
npm run test:e2e
```

Las pruebas de navegador usan respuestas reales anonimizadas de dev como fixtures y cubren
perfiles incompletos, calendario, catálogo, restricciones, edición, suelo y chat. Para incluir
una prueba contra dev que crea y elimina su propia geocerca:

```powershell
$env:LIVE_API_TEST = '1'
npm run test:e2e
```

Los archivos de `test-results/` no se versionan. Las pruebas de integración no publican el
frontend ni modifican geocercas de otros clientes.
