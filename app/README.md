# Field Shift — frontend

SPA (React 19 + Vite + TypeScript + Tailwind 4) del reto **Field Shift: Adapting Farms with NASA Data** (NASA Space Apps 2026).
Guía completa (qué hace cada pantalla, cómo se calcula cada dato, cómo debe ser la API): [`../docs/guia-de-la-app.md`](../docs/guia-de-la-app.md).
Diseño, datos y contrato JSON con el backend: [`../docs/backend-handoff.md`](../docs/backend-handoff.md).

## Correr

```bash
nvm use 22          # Node >= 22.18
npm install
npm run dev         # http://localhost:5173
npm run build && npm run lint
```

## Modo demostración vs backend

| | Sin `VITE_API_URL` (demo) | Con `VITE_API_URL=https://…` |
|---|---|---|
| Datos | Clima **real** de NASA POWER y proyecciones CMIP6 reales (Open-Meteo Climate API), ambos desde el navegador; suelo, agua y vegetación de ejemplo | Lo que devuelva el backend (NEX-GDDP-CMIP6 para el futuro) |
| Análisis de suelo | Se capturan los valores a mano (no se lee el PDF) | Claude lee el PDF/foto y el usuario confirma |
| Motores | `src/api/mock/engine/*` (aptitud, rotaciones, invernadero, agua) | Backend |
| Chat | Reglas sobre los datos, mismos eventos SSE | Claude en Bedrock vía SSE |
| Parcelas | `localStorage` del navegador | Backend, separadas por `X-Client-Id` |

Ambos implementan la interfaz `Api` (`src/api/client.ts`); los tipos del contrato están en `src/api/types.ts`.
Los motores de demostración sirven de **implementación de referencia** para el backend.

`npm run fixtures` vuelve a descargar de NASA POWER el clima 1991–2025 de las tres parcelas de ejemplo
(`src/api/mock/fixtures/`), para que carguen al instante y sin internet. `npm run fixtures:future` hace lo mismo
con las proyecciones CMIP6 (espera ~1 min entre parcelas por el límite de la API).

## Estructura

```
src/
  api/            contrato (types), cliente HTTP, modo demo (mock/)
  components/     ui/ (botones, sheet, sliders…), charts/, map/, chat/
  pages/          home, map-page (todos los terrenos), new-field (dibujar geocerca), field/ (pestañas)
  hooks/api.ts    React Query
  lib/            formato, tema claro/oscuro, geo (área, búsqueda Photon)
```

Mapas: MapLibre GL con satélite de Esri y mapas de CARTO (sin API key). Búsqueda de lugares: Photon (OpenStreetMap).
