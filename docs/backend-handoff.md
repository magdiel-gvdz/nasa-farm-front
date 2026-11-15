# Field Shift — Documento de diseño y handoff del backend

> NASA Space Apps Challenge 2026 · Reto **"Field Shift: Adapting Farms with NASA Data"**
> Este documento explica **qué vamos a construir, por qué, con qué datos y cómo se comunican el frontend y el backend**.
> El frontend (React + Vite) vive en el repo `nasa-farm-front`; el backend (Python FastAPI) vive en un repo aparte.
> La sección 6 (contrato de API) es el acuerdo entre ambos: si algo cambia ahí, avisar al otro lado.

---

## Índice

1. [El reto: qué pide y qué van a evaluar](#1-el-reto-qué-pide-y-qué-van-a-evaluar)
2. [Nuestra propuesta](#2-nuestra-propuesta)
3. [Requisitos del agrónomo](#3-requisitos-del-agrónomo)
4. [Mapa de datos: necesidad → dataset → uso](#4-mapa-de-datos-necesidad--dataset--uso)
5. [Arquitectura](#5-arquitectura)
6. [Contrato de API (frontend ↔ backend)](#6-contrato-de-api-frontend--backend)
7. [Motores de cálculo](#7-motores-de-cálculo)
8. [Modelo predictivo (ML)](#8-modelo-predictivo-ml)
9. [Chatbot agrónomo: Claude en Amazon Bedrock](#9-chatbot-agrónomo-claude-en-amazon-bedrock)
10. [Infraestructura y despliegue del backend](#10-infraestructura-y-despliegue-del-backend)
11. [Fases, reparto y MVP](#11-fases-reparto-y-mvp)
12. [Verificación](#12-verificación)
13. [Riesgos y mitigación](#13-riesgos-y-mitigación)
14. [Anexo A: NASA POWER, ya probado](#anexo-a-nasa-power-ya-probado)
15. [Anexo B: umbrales de referencia (validar con el agrónomo)](#anexo-b-umbrales-de-referencia-validar-con-el-agrónomo)
16. [Anexo C: qué tan precisos son los datos](#anexo-c-qué-tan-precisos-son-los-datos-validación-del-2026-11-14)

---

## 1. El reto: qué pide y qué van a evaluar

**Página del reto:** https://www.spaceappschallenge.org/2026/challenges/adapting-farms-with-nasa-data/ (nivel Intermedio/Avanzado).

**Resumen:** crear una **herramienta de apoyo a decisiones** que use observaciones de la NASA junto con información local de suelo, características de cultivos y prioridades del agricultor, para **explorar estrategias de rotación de cultivos** que mejoren la salud del suelo y la resiliencia ante cambios de temperatura, lluvia y disponibilidad de agua.

**Lo que el reto pide explícitamente** (es lo que los jueces van a buscar):

- Comparar **al menos 3 estrategias de rotación, incluida la actual del agricultor**. Para cada una hay que explicar:
  - **por qué** se sugiere,
  - **qué evidencia** la respalda,
  - qué **beneficios** puede dar,
  - dónde hay **huecos de información**,
  - qué **riesgos** necesitan revisión local de agricultores o agrónomos.
- Resaltar **periodos en que el campo suele estar desnudo**, **temporadas en que el cultivo actual es más vulnerable** y oportunidades de rotación: romper ciclos de plagas, bajar demanda de agua, mejorar infiltración o generar ingreso extra.
- Explicar la **incertidumbre** del modelo y dónde hace falta un experto local para validar.
- Explicar términos como evapotranspiración, anomalías de humedad del suelo, NDVI, riesgo de helada y balance hídrico.
- **Armonizar** datasets de distinta resolución espacial y temporal a una grilla común (por remuestreo o agregación).
- Mapas interactivos, timelines, capas comparativas y **sliders de escenarios** (ajustar lluvia o temperatura).
- Zonas de vulnerabilidad **dentro de la parcela** (erosión, estrés hídrico, áreas propensas a helada).
- Diseño **centrado en el agricultor**: fácil de interpretar, con entrada de prioridades y restricciones (agua disponible, equipo, mercado), y con recordatorios de que la herramienta **apoya y no reemplaza** el juicio local.

**Datasets sugeridos por el reto:**
- **NASA:** SMAP, GPM/IMERG, Landsat, MODIS/VIIRS, NASA POWER, SRTM, ECOSTRESS, GRACE/GRACE-FO, NLDAS/GLDAS, GEDI.
- **USDA y otros:** Ag Data Commons, Web Soil Survey, SSURGO/STATSGO2, CDL/CropScape, PRISM, NAIP, NLCD, FAO GAEZ, CoCoRaHS, USGS NWIS, USDA AMS Market News, NASS QuickStats, OpenET, LANDFIRE.
- **Agencias socias:** ESA Sentinel-2 y ERA5 (ECMWF).

---

## 2. Nuestra propuesta

Una app web donde el agricultor:

1. **Dibuja una geocerca** (su parcela) o registra un **invernadero** en el mapa.
2. Recibe un **perfil de la parcela** construido con datos de la NASA y fuentes complementarias: clima histórico, heladas, lluvias, calor, viento, suelo, agua y vegetación.
3. Ve un **calendario de 12 meses** con riesgos y ventanas de siembra.
4. Pregunta **"¿puedo sembrar el cultivo X en el mes Y?"** y obtiene un semáforo con razones y fuentes.
5. Compara **3 o más rotaciones** (la actual más las sugeridas), ponderadas por sus prioridades.
6. Mueve **sliders de escenarios** ("¿y si sube 2 °C?", "¿y si llueve 20 % menos?").
7. Obtiene una **predicción de rendimiento con rango de incertidumbre**.
8. Habla con un **chatbot agrónomo** (Claude en Bedrock) que consulta todos estos datos con herramientas y **cita la fuente de cada número**.
9. Exporta un **"Plan de siembra" en PDF**.

**Dos demos narradas:**
- **México:** un rancho en Saltillo, Coahuila. Agua dura, heladas tardías, clima semiárido y acuífero en descenso.
- **EE.UU.:** una parcela de alfalfa en Nevada (como la foto del reto), con la rotación actual detectada automáticamente con CDL.

**Limitaciones que vamos a mostrar abiertamente** (suman puntos de validez):
1. Ningún satélite de la NASA mide **N, P y K** directamente. Los nutrientes salen de SoilGrids/SSURGO y del **análisis de laboratorio que suba el agricultor**.
2. **Granizo:** no hay producto NASA directo. Se usa un proxy y se marca como **"evidencia baja"**.
3. **CO₂ dentro del invernadero:** no se ve desde el espacio. OCO-2 da el CO₂ ambiente; el interior necesita sensor.

---

## 3. Requisitos del agrónomo

Requisitos de un amigo agrónomo que nos asesora; cada uno se mapea a un módulo:

| Lo que dijo | Módulo |
|---|---|
| "Lo más importante es saber la materia orgánica, qué nutrientes y cuánto hay en el suelo" | Perfil de suelo (SoilGrids / SSURGO) + subida del análisis de laboratorio |
| "Ahí ya se puede hacer un plan de siembra, qué cultivar y qué cultivo usar para rotación" | Motor de aptitud + motor de rotaciones |
| "Heladas, temporadas de lluvias, granizo, etapas de calor más alto" | Motor de clima + calendario de riesgos |
| "En invernaderos se deben saber las velocidades del viento por riesgo de daño en las estructuras, y la concentración de CO₂" | Módulo invernadero |
| "La calidad del agua en ciertas regiones es horrible. En Saltillo el agua es muy pesada, tiene mucho calcio y magnesio; no es tóxico para nosotros, pero al ganado le puede traer complicaciones" | Módulo de calidad de agua (ganado y riego) |

Él también valida los **umbrales y reglas** del Anexo B.

---

## 4. Mapa de datos: necesidad → dataset → uso

| Necesidad | Dataset principal | Respaldo / solo EE.UU. | Uso concreto |
|---|---|---|---|
| Materia orgánica, N, pH, CIC, textura | **SoilGrids 250 m** (ISRIC, global; SOC, N total, pH, CIC, arcilla/arena/limo, densidad aparente, de 0 a 200 cm) | **SSURGO** vía USDA Soil Data Access (consulta SQL por polígono) | Perfil de suelo; factor K de erosión; agua disponible para la planta |
| Nutrientes reales (N-P-K, MO, pH, CE) | **PDF o foto del análisis de laboratorio** → Claude extrae los valores | — | Reemplaza las estimaciones y sube la confianza a "alta" |
| Heladas | **NASA POWER** T2M_MIN diario desde 1981 (REST, sin key) | PRISM (EE.UU.), SMAP freeze/thaw, ERA5-Land | Probabilidad de helada por semana y mes; fechas de última y primera helada (P10/P50/P90); bajíos fríos con SRTM |
| Temporada de lluvias, extremos | **GPM IMERG** (0.1°, diario, desde 2000) | POWER PRECTOTCORR; CoCoRaHS y estaciones SMN para validar | Meses lluviosos, confiabilidad, días de lluvia intensa, factor R de erosión |
| Calor / estrés térmico | POWER T2M_MAX; **ECOSTRESS** LST a 70 m | MODIS LST 1 km | Días por encima del umbral del cultivo; puntos calientes dentro de la parcela |
| Granizo (brecha) | GPM DPR (señales de hielo y convección intensa) + ERA5 CAPE | NOAA SPC Storm Reports (EE.UU.); atlas de CENAPRED (México) | Índice proxy con la etiqueta "evidencia baja, validar localmente" |
| Viento (invernaderos) | POWER WS10M / WS10M_MAX | **ERA5 ráfagas (i10fg)** horarias | Ajuste Gumbel → viento con periodo de retorno de 10, 25 y 50 años vs la resistencia de la estructura |
| CO₂ y luz (invernaderos) | **OCO-2 / OCO-3** XCO₂ (ambiente); POWER ALLSKY_SFC_SW_DWN | — | CO₂ base (~425 ppm) vs objetivo de enriquecimiento; integral de luz diaria (DLI); grados-hora de calefacción |
| Humedad del suelo | **SMAP** L3/L4 (9 km) | NLDAS/GLDAS | Anomalías, inicio de sequía, ventanas de siembra |
| Evapotranspiración (ET) | **ECOSTRESS ET**, MODIS MOD16; ET0 FAO-56 con variables de POWER | **OpenET** (oeste de EE.UU.) | Demanda hídrica por cultivo y rotación (Kc × ET0 − lluvia efectiva) |
| Vegetación, suelo desnudo, fenología | **MODIS NDVI** MOD13Q1 250 m (desde 2000) | **Sentinel-2** 10 m, Landsat 30 m, NAIP 1 m (EE.UU.) | Meses de suelo desnudo, vigor histórico, zonas dentro de la parcela |
| Agua subterránea | **GRACE / GRACE-FO** | USGS NWIS (niveles de pozo) | Tendencia del almacenamiento de agua (cm/año) |
| Calidad del agua | **CONAGUA – Red Nacional de Medición de Calidad del Agua** (datos abiertos: dureza, SDT, conductividad, As, F, etc.) | USGS NWIS / Water Quality Portal | Semáforo para ganado y para riego |
| Pendiente, escurrimiento, erosión | **SRTM 30 m** | NASA DEM / USGS 3DEP | Pendiente y orientación; RUSLE = R × K × LS × C |
| Rotación actual | Captura del usuario | **CDL / CropScape** (historial de ~15 años por píxel en EE.UU.) | Escenario base "rotación actual" |
| Aptitud de cultivos | **FAO ECOCROP** (rangos de temperatura, lluvia, pH y ciclo por cultivo) + **FAO GAEZ** | — | Catálogo de cultivos del motor de reglas |
| Rendimientos y mercado | **SIAP** (rendimiento municipal) + **SNIIM** (precios), en México | **USDA NASS QuickStats**, AMS Market News | Etiquetas para el modelo de rendimiento; puntaje de mercado |

### Estrategia de acceso recomendada

- **Google Earth Engine** (`earthengine-api`, cuenta no comercial o de investigación) como motor raster principal. MODIS, SMAP, IMERG, SRTM, Sentinel-2, Landsat, ERA5-Land, GRACE y SoilGrids (catálogo comunitario) se reducen por polígono del lado de Google, así no hay que descargar rasters.
- **APIs directas:**
  - NASA POWER (REST, ya probado: ver Anexo A).
  - USDA Soil Data Access (`https://sdmdataaccess.sc.egov.usda.gov`, consultas SQL por polígono WKT).
  - **NASA AppEEARS** (requiere Earthdata Login) para ECOSTRESS y OCO-2 por polígono; es asíncrono.
  - CropScape `GetCDLStat` / WMS.
- **Datos pre-cargados** en el repo del backend (`data/`): CSV de CONAGUA, catálogo de cultivos ECOCROP, rendimientos SIAP/NASS y documentos de la base de conocimiento.

### Armonización

- **Espacial:** cada variable se reduce a (a) **estadísticas zonales del polígono** (media, p10, p90) y (b) opcionalmente una **grilla de 30 m dentro de la parcela** para las capas de zonas.
- **Temporal:** todo se lleva a climatología **diaria, semanal (52 semanas) y mensual** sobre un periodo común (**1991–2025**; en datasets más cortos, su periodo disponible, por ejemplo IMERG desde 2000 o SMAP desde 2015).
- **Procedencia:** cada valor lleva `source_id`, `resolution`, `period` y `confidence`. Esto alimenta el panel de "Fuentes" y permite que el chatbot cite.

---

## 5. Arquitectura

```
┌──────────────── Frontend (repo nasa-farm-front) ────────────────┐
│ React 19 + Vite + TS · S3 + CloudFront (Terraform ya existente)  │
│  • Mapa (MapLibre GL + Terra Draw): dibujar geocercas            │
│  • Panel de perfil de parcela                                    │
│  • Calendario de riesgos (52 semanas)                            │
│  • Matriz de aptitud cultivo × mes                               │
│  • Comparador de rotaciones (≥3) + radar de prioridades          │
│  • Sliders de escenario (ΔT, ΔP)                                 │
│  • Modo invernadero · modo agua y ganado                         │
│  • Chat agrónomo (SSE) · subida de análisis de suelo             │
│  • Export PDF "Plan de siembra" · i18n es/en                     │
└──────────────────────────────┬───────────────────────────────────┘
                               │ HTTPS JSON + SSE  (VITE_API_URL)
┌──────────────────────────────▼──── Backend (repo aparte) ────────┐
│ Python 3.12+ · FastAPI · contenedor en AWS App Runner            │
│  fieldshift/                                                     │
│   ├─ api/          rutas FastAPI (sección 6)                     │
│   ├─ datasources/  power.py, gee.py, sda.py, appeears.py,        │
│   │                conagua.py, cdl.py, soilgrids.py ...          │
│   ├─ profile/      arma y cachea el FieldProfile                 │
│   ├─ engines/      climate, suitability, rotation, scenario,     │
│   │                greenhouse, water, zones                      │
│   ├─ ml/           entrenamiento e inferencia de rendimiento     │
│   └─ agent/        cliente Bedrock, tools, prompts, RAG          │
│  Persistencia: DynamoDB (campos, conversaciones, jobs)           │
│  Cache: S3 (FieldProfile por hash de geometría, capas PNG)       │
│  Secretos: Secrets Manager (GEE service account, Earthdata)      │
│  LLM: Amazon Bedrock → Claude Opus 5.5                           │
└──────────────────────────────────────────────────────────────────┘
```

### Principio central: el FieldProfile

Por cada geocerca se calcula **un solo objeto `FieldProfile`** con clima, suelo, terreno, agua, vegetación y riesgos, más la procedencia de cada dato.
- **Llave de cache:** hash de la geometría normalizada más la versión del pipeline.
- **Consumidores:** todos los motores (aptitud, rotaciones, invernadero, agua, ML) **y el chatbot**. Así el bot nunca inventa números, solo lee lo que el perfil tiene.
- Si cambian las prioridades o el escenario, **no se recalcula el perfil**; solo se vuelven a correr los motores sobre él (rápido).

### ¿Dónde corre el backend? (App Runner o Lambda)

El frontend no cambia en ningún caso: solo necesita una URL HTTPS que cumpla la sección 6 (`VITE_API_URL`).

| | **A. App Runner** (contenedor) | **B. Lambda + Function URL** (recomendada si la cuenta está en el plan gratuito) |
|---|---|---|
| Cómo | Imagen Docker en ECR → servicio App Runner | La **misma app FastAPI** empaquetada con [AWS Lambda Web Adapter](https://github.com/awslabs/aws-lambda-web-adapter) (imagen en ECR o zip) |
| Costo en reposo | Cobra por instancia aprovisionada aunque no haya tráfico | **$0**: 1 M de invocaciones y 400,000 GB-s al mes entran en la capa gratuita permanente |
| Tiempo máximo | Sin límite práctico | **15 min** por invocación. La Function URL **no** tiene el límite de 29 s de API Gateway |
| Streaming del chat (SSE) | Nativo | Function URL con `InvokeMode: RESPONSE_STREAM` + `AWS_LWA_INVOKE_MODE=response_stream` en el adapter |
| Perfil de parcela (GEE puede tardar) | En segundo plano dentro del contenedor | `POST /fields` responde 202 de inmediato y lanza el cálculo con una **invocación asíncrona** de la misma función (o un mensaje a SQS). El front ya hace polling de `/profile` (6.3) |
| Arranque en frío | No | 1–3 s la primera petición tras un rato sin uso. Aceptable; `earthengine-api` y `anthropic` se importan dentro de los handlers que los usan |

**Si App Runner no está disponible en la cuenta (plan gratuito) → opción B.** Notas:
- Memoria sugerida 1,024–2,048 MB (pandas/numpy). Con ~10,000 peticiones al mes de 2 s a 1 GB se usan ~20,000 GB-s: muy por debajo de la capa gratuita.
- **CORS:** configurarlo en FastAPI **o** en la Function URL, no en ambos (duplicar el header rompe el navegador).
- **Opcional, sin CORS:** agregar la Function URL como segundo *origin* de la distribución CloudFront del front (`/api/*`, con OAC para Lambda). Así el front llama a `/api/v1/...` en su mismo dominio y `VITE_API_URL` queda vacío o igual al dominio de CloudFront.
- **Lo que no cubre la capa gratuita:** **Bedrock** (se paga por token; los créditos de AWS del plan gratuito sí aplican). DynamoDB (25 GB) y S3 (5 GB) sí entran. **Verificar el día 1** que la cuenta puede invocar el modelo de Anthropic en Bedrock: el primer uso pide un formulario de caso de uso y algunas restricciones de cuenta lo bloquean. Si falla, usar la API de Anthropic directa con el mismo SDK `anthropic` como plan B.
- **Earth Engine en Lambda:** autenticar con la cuenta de servicio (JSON en Secrets Manager); las reducciones por polígono pequeño tardan 2–20 s, dentro de los 15 min.

---

## 6. Contrato de API (frontend ↔ backend)

**Convenciones**
- Base: `{VITE_API_URL}/api/v1`
- Llaves JSON en **`snake_case`** (lo natural en Python; el front se adapta).
- **Identidad:** sin login para el hackathon. El front genera un UUID, lo guarda en `localStorage` y lo manda en el header **`X-Client-Id`**. El backend separa los datos por ese id.
- **CORS:** permitir `http://localhost:5173` y el dominio `https://*.cloudfront.net` del front (se pasará el exacto).
- **Errores:** `{"error": {"code": "string", "message": "string", "details": {}}}` con un status HTTP adecuado.
- **Idioma:** header `Accept-Language: es|en`. Los textos explicativos (razones, riesgos, notas) se devuelven en ese idioma.
- **Geometrías:** GeoJSON en WGS84 (`[lon, lat]`), `Polygon` o `MultiPolygon`. Límite sugerido: 10,000 ha.
- **Meses:** 1–12. **Fechas día-mes:** `"MM-DD"`. **Semanas:** 1–52.
- **Procedencia:** cualquier valor derivado de datos puede llevar `source_id`, que apunta a `sources[]` del perfil.

### Objetos compartidos

```jsonc
// Source: catálogo de procedencia
{
  "id": "nasa_power",
  "dataset": "NASA POWER Daily (community=AG)",
  "provider": "NASA LaRC",
  "resolution": "0.5° x 0.625° (~50 km)",
  "period": "1991-2025",
  "url": "https://power.larc.nasa.gov/"
}

// Gap: hueco de información (para el panel "Qué no sabemos")
{ "code": "hail_no_direct_product", "severity": "medium",
  "message": "No existe un producto NASA directo de granizo; usamos un proxy." }

// Confidence: "alta" | "media" | "baja"  → en JSON: "high" | "medium" | "low"
```

### 6.1 Salud y catálogos

| Método | Ruta | Respuesta |
|---|---|---|
| GET | `/health` | `{"status": "ok", "version": "x.y.z"}` |
| GET | `/crops` | Lista del catálogo de cultivos (ver abajo) |
| GET | `/sources` | Lista de `Source` usados por el sistema (panel "Fuentes") |

```jsonc
// GET /crops
[{
  "id": "maiz", "name": {"es": "Maíz", "en": "Maize"},
  "family": "poaceae",              // para romper ciclos de plagas
  "roles": ["cash"],                // cash | legume | cover | forage | deep_root | drought_tolerant
  "cycle_days": [100, 150],
  "temp_opt_c": [18, 33], "temp_abs_c": [10, 40],
  "frost_tolerant": false,
  "water_need_mm": [500, 800],
  "ph": [5.5, 7.5],
  "kc": {"ini": 0.3, "mid": 1.2, "end": 0.6},
  "n_fixing": false,
  "heat_critical_c": 38,              // temperatura que daña la floración
  "emoji": "🌽",
  "category": "grain",                // grain | legume | forage | vegetable | oilseed | industrial | fruit | vine | nut | berry | cactus | aromatic
  "perennial": false,                 // true: frutales, vid, nueces, nopal, agave, espárrago… (se evalúan con otro motor, ver guía §4.2)
  "salt_threshold_ds_m": 1.7,         // CEe donde empieza a bajar el rendimiento (Maas-Hoffman / FAO-29)
  "greenhouse_ok": false,             // solo estos se evalúan en invernaderos
  "chill_hours": null,                // perennes caducifolios: [bajo requerimiento, tradicional], p. ej. manzana [400, 900]
  "sensitive_month": null,            // mes (hemisferio N) de floración/brotación: riesgo de helada tardía
  "years_to_first_harvest": null,
  "harvest_months": null,             // perennes: [desde, hasta], puede cruzar el año ([10, 3])
  "plant_months": null,               // perennes: meses recomendados para plantar
  "aliases": ["maiz grano", "elote"]  // sinónimos para buscador y chat
}]
```

El catálogo completo (91 cultivos con sus valores) está en `app/src/api/mock/engine/crops.ts` y en la tabla de [`guia-de-la-app.md`](./guia-de-la-app.md) §5. El backend puede servir exactamente esa lista como punto de partida.

`SuitabilityDetail` agrega, solo para perennes: `"perennial": {"years_to_first_harvest": 4, "harvest_months": [8, 10], "chill_hours_est": 440}`. Los factores (`reasons[].factor`) ahora incluyen `chill`, `bloom`, `salinity` y `planting`. Las horas frío se calculan con datos horarios o con el ciclo diario a partir de T2M_MAX/T2M_MIN (modelo Utah o de porciones de frío), después de la corrección por altitud.

### 6.2 Geocercas e invernaderos

| Método | Ruta | Descripción |
|---|---|---|
| POST | `/fields` | Crear una geocerca o un invernadero |
| GET | `/fields` | Listar las del `X-Client-Id` |
| GET | `/fields/{id}` | Detalle |
| PATCH | `/fields/{id}` | Editar (nombre, rotación actual, datos de invernadero, etc.) |
| DELETE | `/fields/{id}` | Borrar |

```jsonc
// POST /fields  (request)
{
  "name": "Rancho Los Nogales - Parcela 1",
  "kind": "field",                       // "field" | "greenhouse"
  "geometry": { "type": "Polygon", "coordinates": [[[-101.02,25.41],[-101.00,25.41],[-101.00,25.43],[-101.02,25.43],[-101.02,25.41]]] },
  "current_rotation": [                  // opcional; en EE.UU. se puede autollenar con CDL
    {"year": 1, "season": "spring_summer", "crop_id": "maiz"},
    {"year": 1, "season": "fall_winter",  "crop_id": null}   // null = suelo desnudo
  ],
  "irrigation": {"available": true, "source": "well", "max_mm_per_year": 400},  // opcional
  "livestock": {"species": "bovino", "head": 40},                                  // opcional
  "greenhouse": {                         // solo si kind = "greenhouse"
    "structure": "multitunel",            // multitunel | capilla | macrotunel | casa_sombra | otro
    "cover": "polietileno",               // polietileno | policarbonato | vidrio | malla
    "rated_wind_kmh": 100,                // resistencia declarada por el fabricante, si se sabe
    "heated": false,
    "co2_enrichment": false
  }
}

// POST /fields  (response 201)
{
  "id": "fld_01J...",
  "name": "...", "kind": "field",
  "geometry": { ... },
  "area_ha": 48.7,
  "centroid": [-101.01, 25.42],
  "country": "MX",                        // "MX" | "US" | otro → decide qué fuentes usar
  "admin": {"state": "Coahuila", "municipality": "Saltillo"},
  "created_at": "2026-11-14T20:00:00Z",
  "profile_status": "processing"          // dispara el cálculo del perfil en segundo plano
}
```

### 6.3 Perfil de parcela (asíncrono)

El cálculo inicial puede tardar entre 10 y 60 s. Flujo:
1. `POST /fields` dispara el job.
2. El front hace polling a `GET /fields/{id}/profile` cada ~2 s y muestra el progreso por fuente.
3. Si está en cache, la respuesta es inmediata.

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/fields/{id}/profile` | `202` mientras se calcula, `200` con el perfil cuando está listo |
| POST | `/fields/{id}/profile:refresh` | Forzar el recálculo |

```jsonc
// 202 Accepted
{ "status": "processing",
  "steps": [
    {"source_id": "nasa_power", "status": "done"},
    {"source_id": "gpm_imerg",  "status": "running"},
    {"source_id": "soilgrids",  "status": "pending"},
    {"source_id": "smap",       "status": "failed", "message": "timeout; se reintentará"}
  ] }

// 200 OK → FieldProfile
{
  "status": "ready",
  "field_id": "fld_01J...",
  "computed_at": "2026-11-14T20:01:10Z",
  "pipeline_version": "1",

  "climate": {
    "source_id": "nasa_power", "years": [1991, 2025], "elevation_m": 1611,
    "frost": {
      "threshold_c": 0, "risk_threshold_c": 2, "years_analyzed": 35,
      "last_spring_frost": {"p10": {"doy": 45, "date": "02-14"}, "p50": {"doy": 62, "date": "03-03"}, "p90": {"doy": 85, "date": "03-26"}},
      "first_fall_frost":  {"p10": {"doy": 312, "date": "11-08"}, "p50": {"doy": 330, "date": "11-26"}, "p90": {"doy": 350, "date": "12-16"}},
      "frost_free_days": {"p10": 225, "p50": 262},
      "share_years_without_frost": 0.0,
      "by_month": [{"month": 1, "prob_any_frost": 0.86, "mean_frost_days": 6.2, "mean_frost_risk_days": 11.4, "record_tmin_c": -9.1}]
    },
    "rain": {
      "source_id": "gpm_imerg",            // IMERG para lluvia; POWER como respaldo
      "annual_mean_mm": 420, "annual_p20_mm": 310, "annual_p80_mm": 520, "annual_cv": 0.28,
      "trend_mm_per_decade": -6.5,
      "rainy_months": [6, 7, 8, 9],
      "wet_day_p95_mm": 24.3,
      "days_per_year_over_25mm": 3.1, "days_per_year_over_50mm": 0.4,
      "by_month": [{"month": 1, "mean_mm": 14, "p20_mm": 2, "p80_mm": 22, "mean_heavy_rain_days": 0.05}]
    },
    "heat": {
      "annual_mean_c": 17.9, "trend_c_per_decade": 0.31, "hottest_month": 6, "annual_gdd_base10": 2950,
      "by_month": [{"month": 1, "mean_tmax_c": 20.1, "mean_tmin_c": 3.9, "record_tmax_c": 31.0, "mean_gdd_base10": 95,
                    "mean_days_over_30c": 0.4, "mean_days_over_35c": 0.0, "mean_days_over_40c": 0.0}]
    },
    "wind": {
      "annual_max_mean_kmh": 45, "record_kmh": 62, "windiest_month": 3, "gust_factor_assumed": 1.4,
      "return_levels_kmh": [{"return_period_years": 10, "sustained_kmh": 55, "estimated_gust_kmh": 77}],
      "by_month": [{"month": 1, "mean_daily_max_kmh": 22, "record_kmh": 55}]
    },
    "light": {
      "annual_mean_dli_mol_m2_day": 41,
      "by_month": [{"month": 1, "mean_solar_mj_m2_day": 14.2, "mean_dli_mol_m2_day": 31.2}]
    },
    "risk_calendar": [   // 52 semanas → alimenta el "Calendario de la parcela"
      {"week": 1, "starts": "01-01", "p_frost": 0.63, "p_frost_risk": 0.86, "p_heat_35c": 0.0,
       "p_heavy_rain": 0.0, "p_dry_week": 0.91, "mean_prec_mm": 1.8, "mean_tmin_c": 3.1, "mean_tmax_c": 19.4,
       "p_hail_proxy": 0.0}
    ]
  },

  "soil": {
    "source_id": "soilgrids",             // "ssurgo" en EE.UU.; "lab_report" si el usuario subió análisis
    "confidence": "medium",
    "texture_class": "franco-arcillosa",
    "layers": [
      {"depth_cm": [0, 30], "soc_g_kg": 9.8, "om_pct": 1.7, "n_total_g_kg": 0.9, "ph": 7.9,
       "cec_cmol_kg": 22, "clay_pct": 31, "sand_pct": 32, "silt_pct": 37, "bulk_density_g_cm3": 1.38,
       "awc_mm_per_m": 140}
    ],
    "lab": null,                            // valores del laboratorio si existen (ver 6.9)
    "k_factor": 0.032
  },

  "terrain": {
    "source_id": "srtm",
    "elevation_m": {"mean": 1611, "min": 1598, "max": 1630},
    "slope_pct": {"mean": 2.1, "p90": 4.8},
    "aspect_dominant": "NE",
    "cold_air_pooling_share": 0.12          // fracción de la parcela en bajíos fríos
  },

  "water": {
    "soil_moisture": {"source_id": "smap", "years": [2015, 2025],
                      "by_month": [{"month": 1, "mean_m3_m3": 0.12, "anomaly_last_12m": [-0.02]}]},
    "et": {"source_id": "modis_mod16", "by_month": [{"month": 1, "et_mm": 35, "et0_mm": 85}]},
    "water_balance_by_month": [{"month": 1, "p_minus_et0_mm": -71}],
    "groundwater": {"source_id": "grace_fo", "trend_cm_per_year": -1.4, "years": [2002, 2025]}
  },

  "vegetation": {
    "source_id": "modis_ndvi",
    "ndvi_by_month": [{"month": 1, "mean": 0.21, "p10": 0.17, "p90": 0.26}],
    "bare_soil_months": [12, 1, 2, 3],      // meses típicamente sin cobertura
    "vigor_trend_per_decade": -0.01
  },

  "land_use": {                              // solo EE.UU. (CDL); null en otros países
    "source_id": "cdl",
    "history": [{"year": 2024, "crop": "alfalfa", "share": 0.93}],
    "detected_rotation": ["alfalfa", "alfalfa", "alfalfa", "trigo"]
  },

  "hazards": {
    "hail": {"source_id": "gpm_dpr_era5", "level": "medium", "evidence": "low",
             "months_of_concern": [5, 6], "note": "Proxy; validar con productores locales."}
  },

  "sources": [ /* Source[] usados en este perfil */ ],
  "gaps":    [ /* Gap[] */ ]
}
```

### 6.4 Aptitud de cultivos ("¿puedo sembrar X en el mes Y?")

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/fields/{id}/suitability` | Matriz completa: cultivos × meses de siembra |
| GET | `/fields/{id}/suitability?crop_id=maiz&planting_month=4` | Detalle de un caso |

Parámetros opcionales de escenario en ambas: `delta_t_c` (ej. `2`) y `delta_p_pct` (ej. `-20`).

```jsonc
// detalle
{
  "crop_id": "maiz", "planting_month": 4,
  "status": "marginal",                    // "suitable" | "marginal" | "unsuitable"
  "score": 58,                              // 0-100
  "harvest_window": {"from": "08-10", "to": "09-05"},
  "reasons": [
    {"factor": "frost", "status": "ok",   "detail": "Siembra después de la última helada P90 (26-mar).", "source_id": "nasa_power"},
    {"factor": "heat",  "status": "warn", "detail": "Floración cae en junio: 4.2 días/año > 35 °C.",     "source_id": "nasa_power"},
    {"factor": "water", "status": "bad",  "detail": "Demanda 620 mm vs 240 mm de lluvia efectiva; requiere 380 mm de riego.", "source_id": "gpm_imerg"},
    {"factor": "soil",  "status": "ok",   "detail": "pH 7.9 dentro del rango tolerable.", "source_id": "soilgrids"}
  ],
  "confidence": "medium"
}

// matriz (sin crop_id): para el heatmap del front
{ "months": [1,2,...,12],
  "crops": [{"crop_id": "maiz", "scores": [0,0,35,58,62,40,10,0,0,0,0,0], "status": ["unsuitable", "..."]}] }
```

### 6.5 Rotaciones (resultado central del reto)

| Método | Ruta |
|---|---|
| POST | `/fields/{id}/rotations` |

```jsonc
// request
{
  "priorities": {           // pesos 0-5 que el agricultor mueve con sliders
    "save_water": 5, "income": 3, "soil_health": 4, "forage": 2, "pest_break": 3, "low_labor": 1
  },
  "constraints": {
    "irrigation_mm_per_year": 400,
    "equipment": ["tractor", "sembradora_grano"],   // para descartar cultivos sin equipo
    "exclude_crops": ["algodon"],
    "horizon_years": 4
  },
  "scenario": {"delta_t_c": 0, "delta_p_pct": 0},
  "max_strategies": 4                     // siempre incluye la actual + ≥2 alternativas
}

// response
{
  "scenario": {"delta_t_c": 0, "delta_p_pct": 0},
  "strategies": [
    {
      "id": "current",
      "name": "Rotación actual: maíz – barbecho",
      "is_current": true,
      "sequence": [
        {"year": 1, "season": "spring_summer", "crop_id": "maiz", "role": "cash",
         "plant": "04-01", "harvest": "08-30"},
        {"year": 1, "season": "fall_winter", "crop_id": null, "role": "bare"}
      ],
      "metrics": {
        "water_demand_mm_per_year": 620, "irrigation_need_mm_per_year": 380,
        "n_balance_kg_ha_per_year": -45, "om_trend": "declining",
        "erosion_t_ha_per_year": 6.8, "bare_soil_days_per_year": 150,
        "pest_break_score": 1, "gross_margin_index": 0.7
      },
      "scores": {"save_water": 2, "income": 3, "soil_health": 1, "forage": 1, "pest_break": 1, "overall": 38},
      "why":       ["Es la rotación actual; sirve como línea base."],
      "evidence":  [{"claim": "150 días/año de suelo desnudo (dic–abr)", "source_id": "modis_ndvi"}],
      "benefits":  ["Mercado conocido y equipo disponible."],
      "gaps":      ["No hay análisis de laboratorio de N y P."],
      "risks_local_review": ["Erosión eólica en primavera; validar con el productor."],
      "confidence": "medium"
    },
    {
      "id": "legume_cover",
      "name": "Maíz – avena/veza (cobertura) – frijol",
      "is_current": false,
      "sequence": [ /* ... */ ],
      "metrics": { /* ... */ },
      "scores": { /* ... */ },
      "why": ["La veza fija N y cubre el suelo en la ventana dic–mar."],
      "evidence": [{"claim": "Helada P50 03-mar compatible con avena/veza", "source_id": "nasa_power"}],
      "benefits": ["+N para el siguiente cultivo", "−60 % días de suelo desnudo"],
      "gaps": ["Precio local de la semilla de veza no verificado."],
      "risks_local_review": ["Demanda de riego en invierno si las lluvias fallan."],
      "confidence": "medium"
    }
  ],
  "recommended_id": "legume_cover",
  "disclaimer": "Herramienta de apoyo; valide con su agrónomo local."
}
```

### 6.6 Invernadero

| Método | Ruta |
|---|---|
| GET | `/fields/{id}/greenhouse` (solo `kind = "greenhouse"`) |

```jsonc
{
  "wind": {
    "structure_rated_kmh": 100,
    "return_levels_kmh": [{"return_period_years": 10, "estimated_gust_kmh": 77}, {"return_period_years": 50, "estimated_gust_kmh": 95}],
    "annual_exceedance_probability": 0.03,   // prob. anual de superar la resistencia
    "status": "warn",                         // "ok" | "warn" | "bad"
    "riskiest_months": [2, 3, 4],
    "source_id": "era5", "note": "Ráfaga estimada; la topografía local puede aumentarla."
  },
  "light": {"by_month": [{"month": 1, "outdoor_dli": 31.2, "indoor_dli_est": 21.8}], "cover_transmission": 0.7},
  "temperature": {"by_month": [{"month": 1, "heating_degree_hours_base12": 410, "hours_over_35c_outside": 0}]},
  "co2": {"ambient_ppm": 424, "source_id": "oco2", "typical_enrichment_target_ppm": [800, 1000],
          "note": "OCO-2 mide la columna atmosférica; el interior requiere sensor."},
  "hail": {"level": "medium", "evidence": "low", "months_of_concern": [5, 6]},
  "recommendations": ["Revisar anclajes antes de febrero-abril.", "..."]
}
```

### 6.7 Calidad del agua (ganado y riego)

| Método | Ruta |
|---|---|
| GET | `/fields/{id}/water-quality?radius_km=30` |

```jsonc
{
  "station": {"name": "Pozo Saltillo XX", "source_id": "conagua_renameca", "distance_km": 8.4,
              "last_sample": "2024-09-12", "type": "subterranea"},
  "parameters": [
    {"code": "hardness_caco3", "name": "Dureza total", "value": 420, "unit": "mg/L CaCO3",
     "livestock": "warn", "irrigation": "ok"},
    {"code": "tds", "name": "Sólidos disueltos totales", "value": 1150, "unit": "mg/L",
     "livestock": "ok", "irrigation": "warn"},
    {"code": "sulfate", "name": "Sulfatos", "value": 380, "unit": "mg/L", "livestock": "warn", "irrigation": "ok"}
  ],
  "livestock_summary": {"status": "warn", "message": "Agua muy dura: sarro en bebederos y tuberías; revisar sulfatos."},
  "irrigation_summary": {"status": "warn", "ec_ds_m": 1.8, "sar": 2.1, "message": "Restricción ligera a moderada (FAO-29)."},
  "recommendations": ["Considerar ablandamiento o mezcla de fuentes.", "Validar con un veterinario."],
  "gaps": [{"code": "station_far", "severity": "low", "message": "La estación más cercana está a 8 km."}]
}
```

### 6.8 Predicción de rendimiento

| Método | Ruta |
|---|---|
| POST | `/fields/{id}/predict-yield` |

```jsonc
// request
{"crop_id": "maiz", "planting_month": 4, "irrigated": true, "scenario": {"delta_t_c": 0, "delta_p_pct": 0}}
// response
{
  "crop_id": "maiz", "unit": "t/ha",
  "p10": 3.1, "p50": 4.6, "p90": 5.9,
  "regional_reference": {"value": 4.2, "source_id": "siap", "level": "municipio", "years": [2015, 2024]},
  "drivers": [                              // importancia de variables, en lenguaje simple
    {"feature": "dias_mayores_35c_floracion", "effect": "negative", "weight": 0.31},
    {"feature": "humedad_suelo_junio", "effect": "positive", "weight": 0.22}
  ],
  "model": {"name": "lightgbm_quantile", "version": "1", "cv_mae": 0.8, "interval_coverage": 0.79},
  "confidence": "medium"
}
```

### 6.9 Análisis de suelo (subida de PDF o foto) — en dos pasos

El front ya tiene la pestaña **Suelo**: el usuario sube el archivo, **revisa** los valores leídos y confirma. Nada se guarda sin su confirmación (un 8.1 leído como 81 cambiaría todas las recomendaciones).

| Método | Ruta | Qué hace |
|---|---|---|
| POST | `/fields/{id}/soil-report` (multipart: `file` = PDF/JPG/PNG/HEIC, máx. 10 MB) | Claude lee el archivo y devuelve los valores. **No guarda.** Guardar el archivo original en S3 (`uploads/{client_id}/{field_id}/...`) |
| PUT | `/fields/{id}/soil-lab` (body = objeto `extracted` corregido por el usuario) | Guarda en `soil.lab`, pone `soil.source_id = "lab_report"` y `soil.confidence = "high"`, quita el gap `no_lab`. Responde 204 |
| DELETE | `/fields/{id}/soil-lab` | Vuelve a las estimaciones de SoilGrids/SSURGO. 204 |

```jsonc
// response de POST /soil-report
{
  "extracted": {"lab_name": "...", "sample_date": "2026-03-10", "depth_cm": [0, 30],
                "om_pct": 1.9, "n_ppm": 12, "p_ppm": 18, "k_ppm": 410, "ca_ppm": 4200, "mg_ppm": 380,
                "ph": 8.1, "ec_ds_m": 1.1, "cec_cmol_kg": 24, "texture": "franco-arcillosa",
                "file_name": "analisis-2026.pdf"},
  "unreadable_fields": ["zn_ppm"],          // el front los marca en amarillo para que el usuario los revise
  "confidence": "high",                     // qué tan legible estaba el documento
  "note": null                              // texto opcional para el usuario
}
```

Unidades que espera el front: MO en %, N (N-NO₃), P (Olsen o Bray), K, Ca, Mg en ppm (mg/kg), CE en dS/m, CIC en cmol/kg. Si el laboratorio reporta en otras unidades (meq/100 g, kg/ha), convertir en el backend. Los rangos de interpretación que muestra el front están en `app/src/lib/soil-lab.ts` (Anexo B).

### 6.10 Capas de zonas dentro de la parcela (mapa)

| Método | Ruta |
|---|---|
| GET | `/fields/{id}/zones?layer=slope\|ndvi\|lst\|frost_pooling\|erosion` |

```jsonc
{ "layer": "erosion",
  "image_url": "https://.../zones/fld_01J/erosion.png",   // PNG con transparencia, para la "image source" de MapLibre
  "bounds": [[-101.02, 25.41], [-101.00, 25.43]],           // [suroeste, noreste]
  "legend": [{"color": "#2e7d32", "label": "bajo", "range": [0, 2]}, {"color": "#c62828", "label": "alto", "range": [10, null]}],
  "source_id": "srtm" }
```

### 6.11-bis Clima futuro (proyecciones)

| Método | Ruta |
|---|---|
| GET | `/fields/{id}/future-climate` |

Método delta: para cada modelo se compara **su propio** 1991–2020 contra 2031–2050 en el punto de la parcela, y el cambio (ΔT, ΔP %) se aplica a la climatología observada de NASA POWER con los motores de escenario (7.4). Así se cancela el sesgo de cada modelo.

- **Backend:** NASA **NEX-GDDP-CMIP6** (Earth Engine `NASA/GDDP-CMIP6`, 0.25°, diario), variables `tasmin`, `tasmax`, `pr`; experimentos `historical` + `ssp245` (y `ssp585` como escenario pesimista); ~8–10 modelos. Cachear por celda de 0.25°.
- **Modo demostración (ya funciona):** CMIP6 HighResMIP vía la Climate API de Open-Meteo, mismo cálculo (`app/src/api/mock/engine/future.ts`).

```jsonc
{
  "source_id": "nex_gddp_cmip6",
  "dataset": "NASA NEX-GDDP-CMIP6",
  "experiment": "SSP2-4.5",
  "baseline": [1991, 2020], "period": [2031, 2050],
  "models": [{"model": "ACCESS-CM2", "delta_t_c": 1.4, "delta_p_pct": -6, "delta_frost_days": -4, "delta_days_over_35c": 3}],
  "median": {"delta_t_c": 1.5, "delta_p_pct": -1, "delta_frost_days": -4, "delta_days_over_35c": 2},
  "range": {"delta_t_c": [1.1, 1.8], "delta_p_pct": [-20, 6]},
  "scenario": {"delta_t_c": 1.5, "delta_p_pct": 0},   // mediana redondeada a los pasos del front (0.5 °C, 5 %)
  "note": "Los modelos no coinciden en si lloverá más o menos; el calentamiento sí es consistente en todos."
}
```

El front lo muestra en el Resumen ("Tu clima hacia 2031–2050"), como botón "Proyección 2031–2050" en los escenarios y en el chat.

### 6.11 Chat agrónomo (SSE)

| Método | Ruta | Descripción |
|---|---|---|
| POST | `/chat/conversations` | Crea una conversación `{"field_id": "fld_..." \| null}` → `{"conversation_id": "conv_..."}` |
| POST | `/chat/conversations/{id}/messages` | Envía un mensaje; la respuesta es `text/event-stream` |
| GET | `/chat/conversations/{id}` | Historial visible (para recargar la página) |

```jsonc
// request
{ "content": "¿Cuándo me conviene sembrar avena forrajera?",
  "active_field_id": "fld_01J...",          // lo que está seleccionado en el mapa (puede cambiar)
  "attachments": [] }                        // opcional: ids de archivos subidos
```

Eventos SSE (cada uno con `event:` y `data:` en JSON):

```
event: status     data: {"state": "thinking"}
event: tool       data: {"name": "get_risk_calendar", "state": "running", "label": "Consultando calendario de heladas"}
event: tool       data: {"name": "get_risk_calendar", "state": "done"}
event: text       data: {"delta": "Para tu parcela en Saltillo, la última helada..."}
event: citation   data: {"source_id": "nasa_power", "label": "NASA POWER 1991–2025"}
event: card       data: {"type": "suitability", "payload": { ...objeto de 6.4... }}   // opcional: el front lo pinta como tarjeta
event: done       data: {"message_id": "msg_...", "usage": {"input_tokens": 0, "output_tokens": 0}}
event: error      data: {"code": "llm_unavailable", "message": "..."}
```

El historial completo (incluidos los bloques de herramientas y de razonamiento) **se guarda en el backend**. El front solo manda el mensaje nuevo.

---

## 7. Motores de cálculo

Todos son **deterministas y explicables**: cada resultado trae razones con `source_id`. El agrónomo valida umbrales y reglas (Anexo B).

### 7.1 Motor de clima (ya prototipado con NASA POWER)

Entrada: una serie diaria de 35 años (`tmin`, `tmax`, `tmean`, `prec`, `wind_max`, `solar`, `rh`). Se usan solo años completos (≥ 360 días).

- **Heladas:**
  - Helada = `tmin ≤ 0 °C`; riesgo de helada = `tmin ≤ 2 °C`. La temperatura del aire a 2 m subestima la helada a nivel de planta.
  - Por año: **última helada de primavera** = último día con helada antes del 1 de julio; **primera de otoño** = primer día con helada después del 1 de julio.
  - En el hemisferio sur se desplazan las fechas 182 días y se aplica la misma lógica.
  - Se reportan percentiles P10/P50/P90:
    - **P90 de la última helada** = fecha después de la cual 9 de cada 10 años ya no heló. Es la fecha segura de siembra.
    - **P10 de la primera helada** = helada temprana que ocurre 1 de cada 10 años. Es el límite de cosecha.
  - Días libres de helada: P10 y P50. Por mes: probabilidad de al menos una helada, días promedio con helada y mínima récord.
- **Lluvia:**
  - Por mes: media, P20 y P80 del total mensual.
  - **Meses lluviosos** = media ≥ max(40 mm, anual/12).
  - Total anual (P20/P80), coeficiente de variación y tendencia (mm/década, regresión lineal).
  - P95 de días húmedos (≥ 1 mm); días/año > 25 mm y > 50 mm.
- **Calor:**
  - Por mes: días con `tmax ≥ 30/35/40 °C` y Tmax/Tmin medias.
  - **GDD base 10 °C, tope 30 °C** por mes y año. Tendencia en °C por década.
- **Viento:**
  - Máximo anual del viento máximo diario → ajuste **Gumbel por momentos**:
    - `β = √6·σ/π`, `μ = x̄ − 0.5772·β`
    - Nivel de retorno a T años: `x_T = μ − β·ln(−ln(1 − 1/T))`
    - T = 10, 25 y 50 años.
  - Ráfaga estimada = sostenido × 1.4 (aproximado; mejor usar ERA5 `i10fg` cuando esté).
- **Luz:** `DLI (mol/m²/día) ≈ SW (MJ/m²/día) × 0.48 × 4.57`. Para el interior del invernadero se multiplica por la transmisión de la cubierta (~0.6–0.9).
- **Calendario de 52 semanas:** por semana, la fracción de años con helada, riesgo de helada, calor > 35 °C, lluvia > 25 mm y semana seca (< 2 mm), más medias de lluvia y temperatura. Se suma `p_hail_proxy` cuando exista.

> El borrador en Python de este motor y del adaptador de POWER ya existe. Se puede pasar al repo del backend como punto de partida; pedirlo.

### 7.2 Motor de aptitud (cultivo × mes de siembra)

Para cada cultivo del catálogo (ECOCROP más ajustes del agrónomo; meta: ~30 cultivos relevantes para Coahuila y para la demo de EE.UU.):

1. **Ventana térmica:** el ciclo completo (siembra + `cycle_days`) debe caer entre la última helada P90 y la primera P10, salvo cultivos tolerantes a helada.
2. **Calor en etapa sensible:** días > umbral del cultivo durante la floración (aprox. 55–65 % del ciclo).
3. **Agua:** demanda = Σ(Kc × ET0) del ciclo vs lluvia efectiva (USDA-SCS o 80 % de la lluvia) + riego disponible.
4. **Suelo:** pH, textura y profundidad; salinidad del agua de riego si hay dato.
5. **Terreno:** pendiente (penaliza cultivos que dejan suelo expuesto en pendientes altas).
6. **Score 0–100** = combinación ponderada; `status` según los cortes (≥ 70 apto, 40–69 marginal, < 40 no apto). Cada factor devuelve `ok | warn | bad` con un texto y su `source_id`.

### 7.3 Motor de rotaciones

1. **Candidatos:** la rotación actual + plantillas filtradas por aptitud y restricciones:
   - leguminosa fijadora de N (frijol, garbanzo, veza, alfalfa);
   - **cultivo de cobertura** en la ventana de suelo desnudo (`vegetation.bare_soil_months`);
   - cultivo de raíz profunda (cártamo, girasol, alfalfa);
   - cultivo tolerante a sequía (sorgo, cebada, triticale);
   - forraje si hay ganado (avena, sorgo forrajero, alfalfa).
2. **Simulación de 3–5 años** por estrategia:
   - **Agua:** demanda Kc × ET0, necesidad de riego y comparación contra el límite.
   - **Nitrógeno:** balance simple (aporte de leguminosas, extracción del cultivo, fertilización típica).
   - **Materia orgánica:** tendencia según los residuos y raíces de cada cultivo (`improving | stable | declining`).
   - **Erosión RUSLE:** R (IMERG) × K (suelo) × LS (SRTM) × C (por fase; el suelo desnudo tiene la C más alta).
   - **Plagas:** penaliza la misma familia botánica en años consecutivos.
   - **Ingreso:** índice con rendimiento esperado × precio (SIAP/SNIIM o NASS/AMS) − costo aproximado.
3. **Puntaje** ponderado por las prioridades del agricultor → `overall`.
4. **Textos:** `why`, `evidence`, `benefits`, `gaps` y `risks_local_review` se generan con **plantillas a partir de las métricas** (deterministas). El LLM no se necesita aquí, aunque el chat puede explicarlos mejor.

### 7.4 Escenarios

`delta_t_c` se suma a `tmin`/`tmax`/`tmean` diarios y `delta_p_pct` escala `prec` diaria. Luego se vuelven a correr los motores de clima, aptitud y rotación **sobre el perfil cacheado**. La meta es menos de 1–2 s para que los sliders se sientan inmediatos.

### 7.5 Motor de invernadero

- Resistencia declarada vs niveles de retorno de ráfaga. La probabilidad anual de excedencia sale de la distribución Gumbel ajustada.
- DLI interior, grados-hora de calefacción (base 12 °C) y horas de calor exterior.
- CO₂ ambiente de OCO-2 (o el valor global actual si no hay retrieval cercano) vs el objetivo de enriquecimiento.
- Granizo (proxy) contra el material de la cubierta.

### 7.6 Motor de calidad de agua

- Busca la estación más cercana dentro del radio (CONAGUA en México, NWIS/WQP en EE.UU.).
- Toma la última muestra y la mediana histórica.
- Clasifica cada parámetro para ganado y para riego (Anexo B) y genera recomendaciones con plantillas.

---

## 8. Modelo predictivo (ML)

- **Objetivo:** rendimiento (t/ha) por cultivo y año, con intervalos.
- **Etiquetas:**
  - EE.UU.: **NASS QuickStats** por condado (maíz, soya, trigo, alfalfa).
  - México: **SIAP** por municipio (maíz, frijol, sorgo, avena forrajera, nogal).
- **Variables por temporada** (ventanas del ciclo del cultivo):
  - GDD y días > 35 °C en floración (POWER);
  - lluvia acumulada y número de días secos (IMERG);
  - anomalía de humedad del suelo (SMAP, desde 2015; antes GLDAS);
  - NDVI máximo e integral (MODIS);
  - suelo (SOC, AWC, pH) y riego (sí/no).
- **Modelo:** LightGBM con **regresión por cuantiles** (P10/P50/P90) o un modelo puntual con **conformal prediction**.
- **Validación:** **validación cruzada espacial** (dejar estados o regiones completas fuera). Reportar MAE e interval coverage, y mostrarlos en la presentación.
- **Explicabilidad:** importancia SHAP por predicción → `drivers` en lenguaje simple.
- **Calendario probabilístico:** las probabilidades de la sección 7.1 ya son un "modelo" empírico de 35 años. Opcional: ajustar distribuciones para eventos raros.

---

## 9. Chatbot agrónomo: Claude en Amazon Bedrock

### Cliente y modelo

- SDK oficial `anthropic` de Python con el cliente de Bedrock:
  ```python
  from anthropic import AnthropicBedrockMantle
  client = AnthropicBedrockMantle(aws_region="us-east-1")
  MODEL = "anthropic.claude-opus-5-5"
  ```
- **Antes de nada:** solicitar acceso al modelo en la consola de Bedrock de la región elegida. El rol de App Runner necesita permisos `bedrock:InvokeModel*`.
- **Streaming** siempre (`client.messages.stream(...)`), reenviado al front como SSE (sección 6.11).
- **Razonamiento:** thinking adaptativo (`thinking: {type: "adaptive"}`). En Opus 5.5 el thinking no se puede desactivar; se controla con `output_config.effort`. Su default es `medium`, así que conviene fijarlo explícito: `low` o `medium` para el chat normal, `high` para "armar un plan de siembra completo".
- **Negativas (`stop_reason: "refusal"`):** en Bedrock no existe el parámetro `fallbacks` del servidor. Se registra el middleware del SDK del lado del cliente (`BetaRefusalFallbackMiddleware`) y siempre se revisa `stop_reason` antes de leer el contenido.
- **No usar** prefill de asistente ni `tool_choice` forzado (`any`/`tool`); ambos dan 400 en este modelo. Usar `tool_choice: auto` y `strict: true` en las herramientas.
- **Prompt caching:** el system prompt y la lista de herramientas son estables; dejar ahí el punto de cache y poner el contexto variable (parcela activa, fecha) al final.
- **Historial:** guardar en DynamoDB el `response.content` **completo** de cada turno (incluidos los bloques de herramientas y de thinking) y reenviarlo sin modificar. Si se edita o recorta el historial, se rompen los bloques de razonamiento.
- Verificar los detalles exactos del SDK (nombres de clases y parámetros) contra la documentación oficial de Anthropic y Bedrock al implementar.

### Herramientas (tool use)

Todas leen del FieldProfile o llaman a los motores. **El modelo no debe inventar datos.**

| Tool | Entrada | Devuelve |
|---|---|---|
| `list_user_fields` | — | Geocercas e invernaderos del usuario |
| `get_field_profile` | `field_id`, `sections[]` | Partes del FieldProfile (clima, suelo, agua…) |
| `get_risk_calendar` | `field_id`, `from_week`, `to_week` | Semanas del calendario |
| `get_climate_stat` | `field_id`, `variable`, `month?` | Una estadística puntual con su fuente |
| `evaluate_crop` | `field_id`, `crop_id`, `planting_month`, `scenario?` | Objeto de 6.4 |
| `suitability_matrix` | `field_id`, `scenario?` | Matriz de 6.4 |
| `compare_rotations` | `field_id`, `priorities`, `constraints`, `scenario?` | Objeto de 6.5 |
| `predict_yield` | `field_id`, `crop_id`, `planting_month`, `irrigated` | Objeto de 6.8 |
| `get_greenhouse_risk` | `field_id` | Objeto de 6.6 |
| `get_water_quality` | `field_id`, `radius_km?` | Objeto de 6.7 |
| `search_agronomy_kb` | `query` | Fragmentos de la base de conocimiento con su referencia |
| `list_crops` | `filter?` | Catálogo de cultivos |
| `get_future_climate` | `field_id` | Objeto de 6.11-bis. El agente luego llama `evaluate_crop` / `compare_rotations` con su `scenario` para comparar hoy vs 2031–2050 |
| `get_soil_lab` | `field_id` | `soil.lab` si el usuario subió su análisis |

Cuando una herramienta devuelve un objeto que el front sabe pintar (aptitud, rotaciones, invernadero), el backend emite además un evento `card` para mostrarlo como tarjeta en el chat.

### Base de conocimiento (RAG ligero)

FAO-56 (evapotranspiración), FAO-29 (calidad de agua de riego), fichas ECOCROP, guías de rotación y cultivos de cobertura, guías de calidad de agua para ganado y la documentación de los datasets NASA (para explicar NDVI, ET y anomalías). Para empezar basta con BM25 local en fragmentos; si alcanza el tiempo, embeddings.

### Lineamientos del system prompt

- **Clima futuro:** en recomendaciones de largo plazo (cultivos perennes, inversión en riego, cambiar de cultivo), comparar siempre el clima actual con `get_future_climate`, y aclarar que es una tendencia de 20 años y no un pronóstico.
- Persona: **agrónomo de confianza que habla claro**, en el idioma del usuario (es/en) y sin jerga, salvo que la explique.
- **Cada número viene de una herramienta** y se cita con fuente y periodo (ej. "NASA POWER 1991–2025").
- Si no hay dato, decirlo y sugerir cómo obtenerlo (análisis de laboratorio, sensor, estación).
- Recordar siempre qué tiene que **validar un agrónomo o productor local**, sobre todo en granizo, plagas, mercado y calidad de agua para el ganado.
- Usar la parcela activa (`active_field_id`) por defecto; si el usuario pregunta por otra, usar `list_user_fields`.
- Respuestas cortas y accionables; una tabla o lista cuando compare opciones.

### Extracción del análisis de suelo (6.9)

El PDF va como bloque `document` (o la foto como `image`) en una llamada aparte, con **salida estructurada** (`output_config.format` con el esquema JSON de `extracted`). Los valores se validan por rangos plausibles (pH 3–11, MO 0–20 %, CE 0–30 dS/m…); lo que caiga fuera va a `unreadable_fields`. **No se guarda**: el usuario confirma con `PUT /soil-lab`.

---

## 10. Infraestructura y despliegue del backend

El frontend ya tiene Terraform para S3 + CloudFront en su repo. Para el backend (en su repo) se sugiere:

- **ECR** para la imagen + **App Runner** (o ECS Fargate) con health check en `/api/v1/health`. **En cuenta de plan gratuito: Lambda + Function URL** con Lambda Web Adapter (ver sección 5, opción B).
- **DynamoDB:** tablas `fields` (PK `client_id`, SK `field_id`), `conversations`, `jobs`.
- **S3:** bucket de cache (`profiles/{hash}.json`, `zones/{field_id}/{layer}.png`) y de uploads (análisis de suelo).
- **Secrets Manager:** cuenta de servicio de GEE y credenciales de Earthdata.
- **IAM** del servicio: `bedrock:InvokeModel` y `bedrock:InvokeModelWithResponseStream`, acceso a las tablas, buckets y secretos.
- **Variables de entorno:** `AWS_REGION`, `BEDROCK_MODEL_ID=anthropic.claude-opus-5-5`, `CORS_ORIGINS`, `CACHE_BUCKET`, `GEE_SECRET_ARN`, `EARTHDATA_SECRET_ARN`, `CLIMATE_START=1991`, `CLIMATE_END=2025`.
- Región sugerida: `us-east-1`, la misma del front. Confirmar disponibilidad del modelo en Bedrock.
- Al tener la URL del backend, el front la configura como `VITE_API_URL` en el build.

---

## 11. Fases, reparto y MVP

| Fase | Backend | Frontend |
|---|---|---|
| **F0 Cimientos** | Repo, FastAPI, Docker, `/health`, CORS, infra. **Día 1: solicitar acceso a Bedrock y crear cuentas de GEE y Earthdata** | Router, layout, i18n, cliente HTTP con `X-Client-Id` |
| **F1 Geocercas** | CRUD `/fields`, área, centroide, país | Mapa + dibujo de polígonos + formulario de invernadero |
| **F2 FieldProfile** | POWER → IMERG, SoilGrids, SRTM, MODIS NDVI, SMAP, GRACE; jobs y cache. **Pre-calcular las dos demos** | Panel de perfil + progreso por fuente |
| **F3 Motores** | Aptitud, rotaciones, escenarios, catálogo de cultivos (con el agrónomo) | Calendario de 52 semanas, heatmap de aptitud, comparador de rotaciones, sliders |
| **F4 Agente** | Bedrock + tools + SSE + historial + subida de análisis de suelo | UI de chat con eventos `tool`, `citation` y `card` |
| **F5 ML** | Dataset NASS/SIAP, LightGBM por cuantiles, validación espacial | Tarjeta de rendimiento con rango |
| **F6 Invernadero y agua** | Motores de 7.5 y 7.6, datos de CONAGUA y NWIS | Modo invernadero, modo agua y ganado |
| **F7 Pulido** | Capas de zonas (PNG), "gaps", performance | Capas en el mapa, panel "Qué no sabemos", PDF, video y presentación |

**MVP presentable = F0–F4.** F5–F7 suman puntos.

**Para trabajar en paralelo:** el backend puede publicar primero **respuestas mock** con exactamente los JSON de la sección 6 (por ejemplo, un `?mock=1` o un archivo fijo por demo). Así el front avanza sin esperar los datos reales.

---

## 12. Verificación

- **Pruebas unitarias de motores** (pytest) con series sintéticas:
  - un año con helada el 20 de marzo debe dar última helada = `03-20`;
  - un lugar sin heladas debe dar `share_years_without_frost = 1`;
  - meter una leguminosa en la rotación debe subir el balance de N;
  - la Gumbel debe recuperar parámetros conocidos de una muestra simulada.
- **Validación de datos:**
  - POWER vs una estación SMN de Saltillo (temperaturas);
  - IMERG vs CoCoRaHS en la demo de EE.UU.;
  - SoilGrids vs SSURGO en el mismo polígono de EE.UU.
  - Documentar los sesgos en `gaps`.
- **ML:** validación cruzada espacial; publicar MAE e interval coverage.
- **Agente:** un set de ~20 preguntas reales del agrónomo. Revisar que llame a las herramientas correctas, cite la fuente, no invente números y recuerde validar localmente. Ejemplos:
  - "¿Cuándo siembro avena forrajera?"
  - "¿Aguanta mi invernadero los vientos de marzo?"
  - "¿El agua del pozo le sirve a mis vacas?"
  - "Si llueve 20 % menos, ¿qué rotación me conviene?"
- **De punta a punta:** dibujar un polígono en Saltillo → perfil listo en menos de 60 s (o al instante desde cache) → calendario → aptitud → 3 rotaciones → slider de escenario → pregunta al chat → exportar el PDF.

---

## 13. Riesgos y mitigación

| Riesgo | Mitigación |
|---|---|
| Latencia de GEE y AppEEARS | Jobs asíncronos con progreso; cache S3; pre-cálculo de las demos |
| Cuentas y cuotas (GEE, Earthdata, acceso a Bedrock) | Tramitar el día 1. Respaldo: POWER + SoilGrids REST + SRTM sin GEE |
| Datasets solo de EE.UU. | Lógica por país (`country`): SSURGO/CDL/PRISM en EE.UU.; SoilGrids/CONAGUA/SIAP en México y el resto |
| Granizo y CO₂ interior sin dato directo | Proxy + `evidence: "low"` + recomendación de validar o poner sensor |
| Resolución gruesa (POWER ~50 km, SMAP 9 km) | Combinar con datos de 30 m (SRTM, Landsat/Sentinel) para las zonas; explicar en `gaps` |
| Sobre-alcance | MVP = F0–F4; lo demás es incremental |

---

## Anexo A: NASA POWER, ya probado

**Request probado** (Saltillo, 35 años, 8 variables):

```
GET https://power.larc.nasa.gov/api/temporal/daily/point
    ?parameters=T2M,T2M_MAX,T2M_MIN,PRECTOTCORR,WS10M,WS10M_MAX,RH2M,ALLSKY_SFC_SW_DWN
    &community=AG&longitude=-101.0&latitude=25.42
    &start=19910101&end=20251231&format=JSON
```

- **Desempeño:** ~3 s y ~1.7 MB. Sin API key. Conviene cachear por `(lat, lon)` redondeado a 2 decimales y el periodo.
- **Respuesta:** GeoJSON `Feature`; `geometry.coordinates = [lon, lat, elevación_m]` (Saltillo: 1611 m). Los datos vienen en `properties.parameter.{VAR}.{YYYYMMDD}`.
- **Valor faltante:** `header.fill_value = -999` → convertir a `NaN`.
- **Fuentes internas:** MERRA-2 (meteorología) y CERES SYN1deg / SRB (radiación). Resolución nativa 0.5° × 0.625°.
- **Unidades (community=AG):**

| Variable | Unidad |
|---|---|
| T2M, T2M_MAX, T2M_MIN | °C |
| PRECTOTCORR | mm/día |
| WS10M, WS10M_MAX | m/s (×3.6 para km/h) |
| RH2M | % |
| ALLSKY_SFC_SW_DWN | MJ/m²/día |

- `WS10M_MAX` es el **máximo del viento medio horario**, no la ráfaga instantánea. De ahí el factor 1.4 y la recomendación de usar ERA5 `i10fg` para invernaderos.

---

## Anexo B: umbrales de referencia (validar con el agrónomo)

Valores iniciales para arrancar. **Todos deben revisarse con el agrónomo** y quedar en configuración, no en el código.

**Heladas y calor**
- Helada: Tmin(2 m) ≤ 0 °C · riesgo: ≤ 2 °C.
- Calor: días con Tmax ≥ 30 / 35 / 40 °C. El umbral crítico por cultivo va en el catálogo.

**Agua de riego (FAO-29, Ayers & Westcot)**

| Parámetro | Sin restricción | Ligera–moderada | Severa |
|---|---|---|---|
| CE (dS/m) | < 0.7 | 0.7 – 3.0 | > 3.0 |
| Boro (mg/L) | < 0.7 | 0.7 – 3.0 | > 3.0 |

El SAR se evalúa en combinación con la CE (tabla FAO-29).

**Agua para ganado (referencias tipo NRC, a confirmar)**

| SDT (mg/L) | Clasificación |
|---|---|
| < 1,000 | Excelente |
| 1,000 – 3,000 | Satisfactoria |
| 3,000 – 5,000 | Precaución |
| 5,000 – 7,000 | Riesgo |
| > 7,000 | No apta |

- **Sulfatos:** precaución por encima de ~500 mg/L en bovinos.
- **Dureza (CaCO₃):** > 180 mg/L se considera "muy dura". El problema principal es sarro en bebederos, tuberías y equipo; se combina con sulfatos y SDT para el diagnóstico. Validar con el agrónomo o un veterinario (es el caso de Saltillo).

**Puntajes de aptitud:** ≥ 70 apto · 40–69 marginal · < 40 no apto.

---

## Anexo C: qué tan precisos son los datos (validación del 2026-11-14)

Comparamos NASA POWER (lo que usa la app hoy) contra **ERA5-Land** (reanálisis europeo independiente, ~9 km) en las tres parcelas de ejemplo, 1991–2024:

| Parcela | Lluvia anual POWER / ERA5 | Tmin media POWER / ERA5-Land | Tmax media POWER / ERA5-Land | Días con helada/año POWER / ERA5-Land | Última helada P50 POWER / ERA5-Land |
|---|---|---|---|---|---|
| Saltillo (Derramadero) | 329 mm / — | 11.7 / 12.2 °C | **27.2 / 24.3 °C** | 7 / 2 | 12-feb / 14-ene |
| Arteaga (invernadero) | 481 / 720 mm | 11.1 / 11.4 °C | **25.8 / 23.4 °C** | 9 / 6 | 15-feb / 5-feb |
| Fallon, Nevada | 211 / 160 mm | 6.5 / 7.3 °C | 20.4 / 20.4 °C | 99 / 93 | 19-abr / 13-abr |

Conclusiones:
- **Mínimas (heladas): bien**, menos de 1 °C de diferencia. Las fechas de helada varían 1–4 semanas entre fuentes en zonas donde casi no hiela (Saltillo), porque ahí 1–2 noches cambian la estadística.
- **Máximas en zonas con relieve: POWER sale 2.5–3 °C más caliente.** La celda de ~50 km promedia una altitud de ~1,610 m, y el terreno real está a ~1,800 m. **Corrección obligatoria en el backend:** ajustar T2M/T2M_MAX/T2M_MIN por altitud con SRTM (−6.5 °C por km de diferencia entre la altitud de la parcela y `elevation` de la celda POWER). En Nevada (valle plano) no hay sesgo.
- **Lluvia: la más incierta.** Las fuentes difieren ±30 %. En la Sierra de Arteaga ERA5 sobreestima; en Fallon la normal NOAA de la estación de Fallon ronda 130–140 mm, más cerca de ERA5 que de POWER. **Backend:** usar GPM IMERG (0.1°) como fuente principal de lluvia y mostrar el rango entre fuentes.
- **Clima futuro (7 modelos CMIP6, 2031–2050 vs 1991–2020):** +1.5 °C en los tres sitios (rango +1.1 a +1.9); la lluvia no tiene una dirección clara en Coahuila (−20 % a +6 %) y baja ~9 % en Nevada; −4 a −5 días de helada por año en Coahuila y −16 en Nevada.

Lo que falta validar con datos de campo: **estaciones SMN/CONAGUA** de Saltillo y Arteaga (heladas y lluvia), un **análisis de suelo real** de una parcela demo contra SoilGrids, y los **umbrales de cultivos** (Anexo B) con el agrónomo. La calidad de agua y el suelo en modo demo son valores de ejemplo hasta que el backend traiga CONAGUA y SoilGrids.
