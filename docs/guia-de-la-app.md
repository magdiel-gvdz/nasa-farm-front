# Field Shift — Guía completa de la aplicación

> **Para quién es este documento:** para cualquier persona del equipo que tenga que **explicar, presentar, probar o conectar** la aplicación. Cuenta qué hace cada pantalla, qué dato se muestra, de dónde sale, cómo se calcula y qué tan confiable es, y qué necesita la API para que todo funcione.
>
> - App publicada: **https://d2t0xc94bclkum.cloudfront.net**
> - Contrato JSON detallado del backend (cada campo): [`backend-handoff.md`](./backend-handoff.md)
> - Cómo correr el frontend: [`../app/README.md`](../app/README.md)
>
> Reto: **NASA Space Apps Challenge 2026 — "Field Shift: Adapting Farms with NASA Data"**.

---

## Índice

1. [La idea en 30 segundos](#1-la-idea-en-30-segundos)
2. [Recorrido por la app, pantalla por pantalla](#2-recorrido-por-la-app-pantalla-por-pantalla)
3. [Todos los datos: de dónde salen y cómo se calculan](#3-todos-los-datos-de-dónde-salen-y-cómo-se-calculan)
4. [Los motores de decisión](#4-los-motores-de-decisión)
5. [Catálogo de cultivos (91)](#5-catálogo-de-cultivos-91)
6. [Cómo debe estar hecha la API para que la app funcione](#6-cómo-debe-estar-hecha-la-api-para-que-la-app-funcione)
7. [Qué tan confiables son los datos](#7-qué-tan-confiables-son-los-datos)
8. [Cómo explicarla: guion de demo y preguntas típicas](#8-cómo-explicarla-guion-de-demo-y-preguntas-típicas)
9. [Glosario](#9-glosario)
10. [Mapa del código](#10-mapa-del-código)

---

## 1. La idea en 30 segundos

Un productor **dibuja su terreno** (parcela o invernadero) en un mapa satelital. La app junta para ese polígono **35 años de clima de la NASA**, datos de suelo, agua y vegetación, y responde en lenguaje sencillo:

- **¿Qué puedo sembrar y cuándo?** 91 cultivos × 12 meses, con semáforo y el *porqué* de cada calificación.
- **¿Qué rotación me conviene?** La rotación actual contra al menos 3 alternativas, cada una con por qué, evidencia, beneficios, huecos de información y riesgos a revisar localmente (justo lo que pide el reto).
- **¿Cuándo hiela, cuándo llueve, cuándo hace demasiado calor?** Un calendario de riesgos de 52 semanas.
- **¿Aguanta mi invernadero el viento? ¿El agua le sirve a mis vacas?** Módulos específicos que pidió el agrónomo del equipo.
- **¿Y si el clima cambia?** Escenarios (+°C, −% de lluvia) y proyecciones de modelos climáticos para 2031–2050.
- **Un agrónomo virtual** (chat) que responde con esos mismos datos y cita la fuente de cada número.

Principio de diseño: **apoya, no reemplaza** el criterio local. Cada pantalla dice qué no sabemos y qué debe confirmar un agrónomo.

---

## 2. Recorrido por la app, pantalla por pantalla

No hay registro: los terrenos se guardan por dispositivo. En modo demostración viven en el navegador; con backend, se separan con un identificador anónimo (`X-Client-Id`). Arriba a la derecha está el **tema claro/oscuro**, que por defecto sigue al sistema.

### 2.1 Inicio (`/`)

| Elemento | Qué hace |
|---|---|
| Portada | Mensaje principal y botones **Dibujar mi parcela** y **Ver un ejemplo** |
| **Tus terrenos** | Tarjetas con la silueta de cada terreno: **verde = parcela**, **azul = invernadero** |
| **Explora un ejemplo** | Tres casos con clima real: *Rancho Derramadero* (Saltillo, maíz con agua dura y ganado), *Invernadero Arteaga* (tomate y lechuga, viento) y *Pivote de alfalfa, Fallon* (Nevada, como la foto del reto) |
| **Ver en el mapa** | Abre la vista de mapa con todos los terrenos |
| Cómo funciona | Tres pasos explicados |

### 2.2 Mapa de mis terrenos (`/mapa`)

- Mapa satelital (Esri) o de calles (CARTO) con **todos los terrenos dibujados** y su nombre. Colores: verde para parcelas y azul para invernaderos, con leyenda arriba a la derecha.
- Panel con la lista, filtros (Todos / Parcelas / Invernaderos) y la opción **Mostrar ejemplos**.
- **Al tocar un terreno**, en el mapa o en la lista, el mapa vuela hacia él y el panel muestra:
  - tipo, hectáreas, municipio y cultivos;
  - **sin helada desde** (fecha segura de siembra), **lluvia al año** y **mes más caliente**;
  - en invernaderos, la **ráfaga de viento cada 10 años** comparada con la resistencia de la estructura; en parcelas, la **materia orgánica** (estimada o del análisis);
  - los **3 mejores cultivos para sembrar este mes**;
  - botones **Ver análisis completo** y **Preguntar** (abre el chat con ese terreno como contexto).
- La selección queda en la URL (`/mapa?id=...`), así que se puede compartir.

### 2.3 Dibujar un terreno (`/nueva`)

**Paso 1: Marca tu terreno**
1. Elegir **Parcela** o **Invernadero**; el color del dibujo cambia en vivo.
2. Buscar el pueblo o rancho (búsqueda de OpenStreetMap / Photon) o usar **mi ubicación** (GPS).
3. **Tocar el mapa siguiendo el borde**, con todos los puntos que haga falta: cualquier polígono, no solo rectángulos.
4. Ajustar:
   - **arrastrar** un punto para moverlo;
   - tocar un **＋** en una orilla para insertar un punto ahí (o arrastrarlo);
   - **Deshacer** revierte el último cambio, sea agregar, mover o insertar;
   - **Borrar** empieza de nuevo;
   - tocar el **primer punto** cierra la figura y pasa al paso 2.
5. Si las líneas **se cruzan**, aparece un aviso y no se puede continuar.
6. Los otros terrenos se ven tenues de fondo para no encimarlos.
7. El área en hectáreas se calcula en vivo (Turf.js, área geodésica).
8. En celular, el panel se compacta al empezar a dibujar para dejar libre el mapa.

**Paso 2: Cuéntanos un poco** (todo opcional)

| Campo | Para qué se usa |
|---|---|
| Nombre | Identificar el terreno |
| **¿Tienes huerta, viñedo o nogalera?** (solo parcelas) | Si eliges un perenne (vid, nogal, manzana, durazno, membrillo, nopal… o cualquiera con **Otro…**), el terreno se trata como huerta todo el año |
| ¿Qué siembras en primavera–verano / otoño–invierno? | Es la **rotación actual**, la base contra la que se comparan las alternativas. **Otro…** abre un buscador con todo el catálogo |
| ¿Tienes riego? + mm al año | Agua disponible para los cálculos de aptitud y rotación |
| ¿Tienes ganado? + cabezas | Activa la prioridad de forraje y el semáforo de agua para ganado |
| Invernadero: cubierta y viento que resiste | Luz que entra (transmisión de la cubierta) y riesgo de que el viento supere la estructura |

Al guardar, la app ubica el municipio (geocodificación inversa) y empieza el análisis.

### 2.4 Analizando (pantalla de proceso)

Mientras se descargan y procesan los datos, se muestran los pasos (NASA POWER, GPM IMERG, SoilGrids, SRTM, MODIS NDVI, SMAP, GRACE-FO) con su estado. El front consulta el perfil cada 0.7 s hasta que está listo (ver §6.4).

### 2.5 Página del terreno (`/parcela/:id`), por pestañas

#### Resumen
| Tarjeta | Qué muestra |
|---|---|
| Mapa | El polígono sobre imagen satelital |
| **Siembra sin helada desde** | Fecha a partir de la cual 9 de cada 10 años ya no hiela (P90 de la última helada), y la última helada típica (P50) |
| **Lluvia al año** | Promedio anual en mm y meses de temporada de lluvias; etiqueta "Seco" si son menos de 400 mm |
| **Mes más caliente** | Mes, máxima promedio y días al año sobre 35 °C |
| **Agua subterránea** (parcela) / **Ráfaga cada 10 años** (invernadero) | Tendencia regional GRACE-FO en cm/año / ráfaga con periodo de retorno de 10 años contra tu estructura |
| **Lo más importante** | Hasta 5 avisos accionables (siembra segura, % de lluvia en temporada, meses sin cobertura, calor en floración, acuífero) con un botón a la pestaña que lo explica |
| **Tu suelo** | Textura, materia orgánica, pH, nitrógeno, arcilla/arena; invita a subir el análisis de laboratorio |
| **Tu clima hacia 2031–2050** | Cambio proyectado de temperatura, lluvia, días con helada y días sobre 35 °C, con el rango entre modelos; botón **Ver qué cultivos cambian** |
| Fuentes | Cada dataset usado, con su enlace |
| **Lo que no sabemos** | Huecos de información y limitaciones (por ejemplo: "el clima es un promedio de ~50 km") |

#### Calendario
- **El año de tu parcela:** 52 semanas × 5 riesgos (helada, riesgo de helada ≤ 2 °C, calor ≥ 35 °C, lluvia fuerte ≥ 25 mm, semana seca < 2 mm), con la probabilidad de cada uno y una marca de **Hoy**.
- **¿Cuándo hiela?:** franja visual con la última helada típica, la *siembra segura*, la helada temprana posible y la primera helada típica.
- Gráficas mensuales de **temperatura** (máx./mín.) y **lluvia** (promedio y rango de años secos a húmedos).

#### ¿Qué sembrar?
- **Para sembrar este mes / el próximo:** los 4 cultivos de temporada con mejor calificación.
- **¿Qué puedo sembrar y cuándo?:** matriz de cultivo × mes de siembra (en frutales, mes de plantación) con semáforo: ✔ apto (≥ 70), – con riesgos (40–69), vacío = no recomendable (< 40).
  - **Buscador** ("manzana", "uva", "nuez", "jitomate"…) que también acepta sinónimos.
  - **Grupos:** Granos, Forrajes, Leguminosas, Hortalizas, Frutales y vid, Nueces, Berries, Oleaginosas e industriales, Nopal/agave/aromáticas.
  - Muestra 20 y luego **Ver los restantes**.
- **Al tocar un cuadro** se abre la ficha:
  - calificación 0–100 y fechas de cosecha; en perennes, el año de la primera cosecha, los meses de cosecha y las horas frío de la zona;
  - **¿Por qué?:** cada factor con ✅/⚠️/⛔ y su fuente;
  - **Rendimiento esperado:** año malo / típico / bueno contra el promedio regional;
  - **Preguntar al agrónomo.**
- **¿Y si el clima cambia?:** escenarios (ver 2.7).
- En invernaderos solo se listan cultivos de agricultura protegida (17).

#### Rotaciones
- **Sliders de prioridades** (0–5): ahorrar agua, cuidar el suelo, ganar más, forraje para ganado, cortar plagas y menos trabajo. Horizonte de 3, 4 o 5 años.
- **Tarjetas de estrategias:** la **actual** y las alternativas, ordenadas por puntaje según tus prioridades (se reordenan con animación). Cada tarjeta trae:
  - **línea de tiempo** de temporadas con colores por rol (leguminosa, cobertura, forraje, raíz profunda, tolerante a sequía, comercial, suelo desnudo);
  - **métricas** contra la rotación actual: riego necesario, balance de nitrógeno, materia orgánica, erosión y días de suelo desnudo;
  - las secciones que pide el reto: **Por qué, Evidencia, Beneficios, Lo que no sabemos y Revisar con tu agrónomo**.
- Si el terreno es huerta, un aviso explica que los árboles no se rotan y que la comparación sirve si se piensa renovar o reconvertir.

#### Suelo
- **Tu análisis de laboratorio:** subir PDF o foto, o **capturar a mano**. El usuario **revisa** los valores (los que no se pudieron leer se marcan en amarillo) y guarda. Se pueden **corregir** o **quitar** después.
- **Cómo está tu suelo:** cada parámetro con su valor, nivel (bajo / medio / adecuado / alto) y un consejo, indicando si viene **de tu análisis** o es **estimado** (SoilGrids / SSURGO).
- Al guardar se recalculan la aptitud (pH y salinidad reales), las rotaciones y las respuestas del chat, y la confianza del suelo pasa a **alta**.

#### Agua
- **¿Sobra o falta agua cada mes?:** barras de lluvia menos evapotranspiración de referencia (P − ET0), en mm.
- **Humedad del suelo** por mes (SMAP).
- **Calidad del agua:** semáforo para **ganado** y para **riego** con la estación de monitoreo más cercana (CONAGUA / USGS): dureza, sales, sulfatos, nitratos, conductividad, boro y flúor, más recomendaciones (ablandador, mezclar fuentes, cultivos tolerantes a sales).

#### Invernadero (solo invernaderos)
- **¿Aguanta tu estructura el viento?:** ráfagas cada 10, 25 y 50 años contra la resistencia declarada, probabilidad anual de superarla y meses de más viento.
- **Luz:** integral de luz diaria (DLI) afuera y dentro según la cubierta.
- **Calefacción:** grados-hora bajo 12 °C por mes.
- **CO₂:** nivel ambiente de referencia contra el objetivo de enriquecimiento (800–1000 ppm).
- **Granizo:** temporada con riesgo (evidencia baja) y recomendaciones.

### 2.6 Agrónomo virtual (chat)

Botón **Pregúntale al agrónomo** en cada terreno. Abre una hoja con sugerencias y conversación en streaming: primero muestra qué herramientas está usando ("Revisando heladas y calor…"), luego escribe la respuesta, a veces con una **tarjeta** (aptitud o rotación) y al final las **fuentes**.

Preguntas que entiende hoy (modo demo, por reglas):

| Tipo de pregunta | Ejemplo | Qué responde |
|---|---|---|
| Cultivo anual | "¿Cuándo siembro frijol?", "¿puedo sembrar maíz en abril?" | Mejor mes, riesgos y **comparación con 2031–2050** |
| Perenne | "¿Se dan las manzanas aquí?", "¿me conviene un viñedo?" | Horas frío, helada en floración, agua anual, años a primera cosecha y **cuántas horas frío se perderían hacia 2050** |
| Clima futuro | "¿Cómo cambiará el clima hacia 2040?" | ΔT, ΔP, heladas y calor; cómo cambia lo que siembras hoy y si cambia la rotación recomendada |
| Heladas, lluvias, calor | "¿Qué tanto riesgo de helada hay?" | Fechas P10/P50/P90, meses de riesgo, temporada de lluvias, aguaceros, olas de calor |
| Viento / invernadero | "¿Aguanta mi invernadero el viento?" | Ráfagas por periodo de retorno contra la estructura |
| Agua y ganado | "¿El agua le sirve a mis vacas?" | Dureza, sulfatos, sales |
| Suelo | "¿Cómo está mi suelo?" | Con análisis: cada valor interpretado; sin análisis: estimación y por qué subir el análisis |
| Rotación | "¿Qué rotación me conviene?" | La mejor estrategia según prioridades típicas, con tarjeta |

Con el backend, el chat lo atiende **Claude (Amazon Bedrock)** con herramientas que leen exactamente los mismos datos (ver `backend-handoff.md` §9), así que puede responder preguntas abiertas.

### 2.7 Escenarios y clima futuro

En **¿Qué sembrar?** y **Rotaciones**:
- **Proyección 2031–2050:** aplica la mediana de los modelos climáticos para ese terreno.
- **Atajos:** Clima actual, Más calor (+2 °C), Más seco (−20 %), Calor y sequía.
- **Sliders:** temperatura de 0 a +3 °C y lluvia de −40 % a +20 %.

Al moverlos se recalculan al instante la matriz de cultivos y las rotaciones (ver §4.4).

### 2.8 Otros

- **Imprimir / PDF:** botón de impresora en la página del terreno (hoja limpia sin menús).
- **Modo demostración:** una etiqueta en el encabezado indica que no hay servidor conectado (ver §3.1).

---

## 3. Todos los datos: de dónde salen y cómo se calculan

### 3.1 Fuentes, y qué es real hoy

| Dataset | Proveedor | Resolución | Qué aporta | **Hoy (modo demo)** | Con backend |
|---|---|---|---|---|---|
| **NASA POWER** (diario, comunidad AG) | NASA Langley | 0.5° × 0.625° (~50 km) | Temperaturas, lluvia, viento, radiación 1991–2025 | **Real**, se descarga en el navegador (~3 s) | Igual, más corrección por altitud |
| **CMIP6 HighResMIP** (vía Open-Meteo Climate API) | WCRP / Open-Meteo | ~25–50 km | Clima 1991–2050 de 7 modelos | **Real** | Se sustituye por **NASA NEX-GDDP-CMIP6** |
| SoilGrids 250 m / USDA SSURGO | ISRIC / USDA | 250 m / 1:24,000 | MO, pH, textura, CIC, N total | *Ejemplo* (estimado a partir de la lluvia) | Real |
| Análisis de laboratorio del productor | — | Parcela | MO, pH, CE, N, P, K, Ca, Mg, CIC | **Real** (lo captura el usuario) | Real; Claude lee el PDF |
| SRTM 30 m | NASA / USGS | 30 m | Altitud, pendiente, bajíos fríos | *Ejemplo* | Real |
| SMAP L4 | NASA | 9 km | Humedad del suelo | *Ejemplo* | Real |
| MODIS MOD13Q1 NDVI | NASA | 250 m | Vigor y meses sin cobertura | *Ejemplo* | Real |
| MODIS MOD16 | NASA | 500 m | Evapotranspiración real | *Ejemplo* | Real |
| GRACE / GRACE-FO | NASA / GFZ | ~300 km | Tendencia del agua subterránea | *Ejemplo* | Real |
| GPM DPR + ERA5 | NASA / ECMWF | 5–30 km | Indicador de granizo | *Proxy simple* | Proxy completo |
| OCO-2 | NASA JPL | ~2 km | CO₂ ambiente | Valor de referencia (427 ppm) | Real |
| CONAGUA RENAMECA / USGS NWIS | CONAGUA / USGS | Estaciones | Calidad del agua | *4 estaciones de ejemplo* | Real |
| Cropland Data Layer | USDA NASS | 30 m | Rotación histórica en EE.UU. | *Ejemplo (Nevada)* | Real |
| SIAP / NASS QuickStats | SADER / USDA | Municipio / condado | Rendimientos de referencia | *Ejemplo* | Real (entrena el modelo de rendimiento) |
| Mapas base | Esri, CARTO, OpenStreetMap | — | Imagen satelital, calles, búsqueda | Real | Real |

> **En una frase:** hoy el **clima pasado y futuro son reales**, igual que el análisis de suelo que capture el usuario. Suelo estimado, agua, vegetación y calidad de agua son **valores de ejemplo con el formato real** hasta que el backend los traiga. La pestaña "Lo que no sabemos" lo dice explícitamente.

### 3.2 Clima (NASA POWER, 1991–2025, día por día)

Se descarga la serie diaria del punto central del terreno: T2M, T2M_MAX, T2M_MIN, PRECTOTCORR, WS10M_MAX y ALLSKY_SFC_SW_DWN, entre otras. Con ella se calcula:

| Indicador | Cómo se calcula |
|---|---|
| **Día con helada** | Mínima del aire a 2 m ≤ **0 °C**. "Riesgo de helada": ≤ 2 °C (a ras de suelo puede helar con 2–3 °C en el aire) |
| **Última helada de primavera / primera de otoño** | Por año: el último día con helada antes del 1 de julio y el primero después. En el hemisferio sur se corre medio año |
| **P10 / P50 / P90** | Percentiles entre los 35 años. **P90 de la última helada = "siembra segura"**: 9 de cada 10 años ya no heló después de esa fecha. P10 de la primera helada = "helada temprana posible" |
| Días libres de helada | Días entre la última y la primera helada (P10 y P50) |
| Probabilidad de helada por mes | % de años con al menos un día ≤ 0 °C en ese mes; también la mínima récord del mes |
| **Lluvia anual** | Suma por año; promedio, P20 (año seco), P80 (año húmedo), coeficiente de variación y tendencia por década (regresión lineal) |
| **Temporada de lluvias** | Meses con promedio ≥ 40 mm |
| Aguaceros | Días/año con ≥ 25 mm y ≥ 50 mm; P95 de los días con lluvia |
| **Calor** | Máximas y mínimas medias por mes, máxima récord, días/año sobre 30, 35 y 40 °C; tendencia de la media en °C por década |
| Grados-día (GDD) | Σ (Tmedia − 10 °C), con tope de 30 °C |
| **Viento** | Máximo diario (WS10M_MAX). Máximo de cada año → **distribución de Gumbel** → viento sostenido con periodo de retorno de 10, 25 y 50 años. **Ráfaga estimada = sostenido × 1.4** |
| **Luz (DLI)** | Radiación solar MJ/m²/día × 0.48 (fracción PAR) × 4.57 = mol/m²/día |

### 3.3 Calendario de riesgos (52 semanas)

Para cada semana del año y cada uno de los 35 años se anota si hubo helada, riesgo de helada, calor ≥ 35 °C, lluvia ≥ 25 mm en un día o semana seca (< 2 mm en total). **Probabilidad = % de años en que pasó.** Se agregan la lluvia media semanal, las temperaturas medias y el indicador de granizo.

### 3.4 Agua

| Dato | Cálculo |
|---|---|
| **ET0** (evapotranspiración de referencia) | **Hargreaves-Samani** (FAO-56): 0.0023 × Ra × (Tmedia + 17.8) × √(Tmáx − Tmín), con Ra = radiación extraterrestre según latitud y día. En mm por mes |
| **Balance mensual** | Lluvia − ET0. Negativo = mes en que falta agua |
| Demanda de un cultivo | Σ diaria de ET0 × **Kc** (inicial → medio → final, FAO-56) durante su ciclo |
| **Lluvia útil** | 75 % de la lluvia del ciclo |
| Riego necesario | Demanda − lluvia útil |
| Humedad del suelo, ET real, agua subterránea | SMAP, MODIS MOD16 y GRACE-FO (en demo, valores de ejemplo coherentes con la lluvia) |

### 3.5 Suelo

- **Estimado** (SoilGrids en México, SSURGO en EE.UU.): capa de 0–30 cm con materia orgánica, carbono orgánico, N total, pH, CIC, arcilla/arena/limo, densidad aparente y agua disponible. Con eso se calculan la textura y el factor K de erosión. En demo se aproxima con la lluvia: más lluvia → más MO y suelos más ácidos.
- **Análisis de laboratorio:** sobrescribe la estimación. Los rangos de interpretación (`app/src/lib/soil-lab.ts`) son:

| Parámetro | Bajo / problema | Medio | Adecuado | Nota |
|---|---|---|---|---|
| Materia orgánica | < 1 % muy baja, 1–2 % baja | 2–4 % | > 4 % alta | |
| pH | < 5.5 muy ácido, 5.5–6 ácido | — | 6.0–7.6 | 7.6–8.4 alcalino, > 8.4 muy alcalino |
| Salinidad (CE) | — | 2–4 dS/m ligeramente salino | < 2 | > 4 salino |
| N-NO₃ | < 10 ppm | 10–20 | > 20 | |
| P (Olsen) | < 10 ppm | 10–20 | 20–40 | > 40 muy alto |
| K | < 120 ppm | 120–200 | > 200 | |
| CIC | < 10 cmol/kg | 10–25 | > 25 | |

Además, el **pH** y la **CE** del análisis entran directo al motor de aptitud (pH ideal y tolerancia a sales de cada cultivo).

### 3.6 Vegetación y suelo desnudo

El NDVI mensual (MODIS) indica cuándo el terreno tiene cobertura. Los **meses sin cobertura** salen de la rotación declarada: los meses que no cubre ningún ciclo de cultivo, o los meses con NDVI < 0.25 si no se declaró rotación. Esos meses son la ventana para un cultivo de cobertura.

### 3.7 Granizo (indicador de evidencia baja)

No existe un producto NASA directo. Se usa un proxy: meses con días de lluvia intensa y máximas > 22 °C (convección). El nivel sube si el terreno está a más de 1,500 m de altitud. **Siempre se etiqueta "evidencia baja, validar con productores de la zona".** El backend usará GPM DPR (señal de hielo) y CAPE de ERA5.

### 3.8 Invernadero

| Dato | Cálculo |
|---|---|
| Probabilidad anual de que el viento supere la estructura | Se interpola la resistencia declarada entre las ráfagas de 10/25/50 años (probabilidad = 1/periodo). **> 5 % = riesgo**, 2–5 % = atención |
| Luz dentro | DLI afuera × transmisión de la cubierta: polietileno 0.75, policarbonato 0.80, vidrio 0.88, malla 0.60 |
| Calefacción | Grados-hora = max(0, 12 °C − mínima media) × 9 h × días del mes |
| CO₂ | Ambiente de OCO-2 (~427 ppm) contra el objetivo de 800–1000 ppm. Dentro del invernadero se necesita un sensor |

### 3.9 Calidad del agua (estación más cercana, hasta 80 km)

| Parámetro | Ganado: atención / riesgo | Riego: atención / riesgo |
|---|---|---|
| Dureza (mg/L CaCO₃) | 180 / 800 | 600 / 1200 |
| Sales disueltas (mg/L) | 3000 / 5000 | 450 / 2000 |
| Sulfatos (mg/L) | 500 / 1000 | 960 / 2000 |
| Nitratos-N (mg/L) | 23 / 45 | 30 / 60 |
| Conductividad (dS/m) | 4.7 / 7.8 | 0.7 / 3.0 (FAO-29) |
| Boro (mg/L) | 5 / 10 | 0.7 / 3 |
| Flúor (mg/L) | 2 / 4 | 1 / 2 |

Es el caso del "agua pesada" de Saltillo: la dureza alta (calcio y magnesio) no es tóxica, pero forma sarro y baja el consumo del ganado. **Los sulfatos y las sales son lo que más daña.**

### 3.10 Clima futuro (2031–2050)

**Método delta:** para cada modelo CMIP6 (7 en los ejemplos precalculados; 4 en terrenos nuevos, para no saturar la API gratuita) se compara **su propio** 1991–2020 contra 2031–2050 en el punto del terreno. Ese cambio (ΔT en °C, ΔP en %) se aplica a la climatología observada de NASA POWER. Así se cancela el sesgo de cada modelo.

Se muestran la **mediana** y el **rango** entre modelos de ΔT, ΔP, Δ días de helada y Δ días sobre 35 °C. También se dice si los modelos coinciden en la dirección del cambio de lluvia. La mediana redondea al escenario de los sliders (pasos de 0.5 °C y 5 %).

Resultados actuales: +1.5 °C en las tres parcelas de ejemplo; en Coahuila la lluvia va de −20 % a +6 % según el modelo (no hay acuerdo); en Nevada baja ~9 %.

---

## 4. Los motores de decisión

Todos son **reglas explicables**: cada calificación trae su lista de razones y su fuente. Hoy corren en el navegador (`app/src/api/mock/engine/`) y sirven de **implementación de referencia** para el backend.

### 4.1 Aptitud de cultivos anuales (cultivo × mes de siembra)

Se parte de **100 puntos** y se descuenta por cada factor. **≥ 70 = Apto, 40–69 = Con riesgos, < 40 = No recomendable.**

| Factor | Regla | Descuento |
|---|---|---|
| **Helada** (no tolerantes, campo abierto, hemisferio norte) | Siembra después de la "siembra segura" (P90) y cosecha antes de la helada temprana (P10) = ✅ · entre P50 y P90 = ⚠️ · antes de la P50 o el ciclo no termina antes de la primera helada típica = ⛔ | 15 / 60 |
| Helada (sin fechas o en invernadero) | Peor mes del ciclo: probabilidad ≤ 8 % ✅, ≤ 30 % ⚠️, > 30 % ⛔ | 15 / 60 |
| Helada (cultivos tolerantes) | Mínima media del mes más frío contra el límite que resiste | 15 / 40 |
| **Temperatura del ciclo** | Media del ciclo dentro del rango óptimo ✅, dentro de los límites ⚠️, fuera ⛔ | 20 / 50 |
| **Calor en floración** | Mes al 60 % del ciclo: días/año sobre la temperatura crítica del cultivo. > 4 ⚠️, > 12 ⛔ | 15 / 35 |
| **Agua** | Déficit = demanda (ET0 × Kc) − lluvia útil. ≤ 30 mm ✅; ≤ riego disponible ⚠️ (10); hasta 1.6× el riego ⚠️ (25); más ⛔ | 10–25 / 42 |
| **pH** | Dentro del rango ✅, a ±0.5 ⚠️, fuera ⛔ (usa el del laboratorio si existe) | 15 / 30 |
| **Salinidad** (solo con análisis) | CE ≤ umbral del cultivo ✅; pérdida ≤ 25 % ⚠️; más ⛔ (≈10 % de rendimiento por dS/m sobre el umbral) | 15 / 40 |
| Pendiente | Pendiente P90 > 8 % en cultivos que dejan el suelo expuesto | 15 |

En **invernadero** la mínima se sube +4 °C, la probabilidad de helada se reduce al 15 % y el riego no limita. Solo se evalúan cultivos de agricultura protegida.

### 4.2 Aptitud de perennes: frutales, vid, nueces, nopal, agave, aromáticas

Un árbol se planta una vez y vive décadas: **importa el clima de todo el año**. El "mes" es el **mes de plantación**.

| Factor | Regla | Descuento |
|---|---|---|
| **Frío del invierno** | Sensibles a helada (aguacate, cítricos, mango…): probabilidad de helada > 30 % o mínima récord muy baja = ⛔, heladas ocasionales = ⚠️. Tolerantes: mínima récord contra el límite que resiste | 25 / 45–55 |
| **Horas frío** (caducifolios) | Horas < 7.2 °C de nov a feb, estimadas a partir de máximas y mínimas mensuales con un ciclo diario senoidal. ≥ requerimiento de variedades tradicionales ✅; entre bajo requerimiento y tradicional ⚠️ ("solo variedades de bajo frío"); menos ⛔ | 18 / 45 |
| **Helada en floración** | Probabilidad de helada en el mes de floración o brotación. > 10 % ⚠️, > 30 % ⛔ | 15 / 35 |
| Temperatura de la temporada | Media de los 6 meses más cálidos contra el rango óptimo | 15 / 45 |
| Calor de verano | Días/año sobre la temperatura crítica en el mes más caliente | 15 / 30 |
| **Agua anual** | Σ ET0 × Kc (Kc medio en meses activos, reducido en reposo) − lluvia útil, contra el riego anual | 10–25 / 42 |
| pH y salinidad | Igual que en anuales | |
| Mes de plantación | Fuera de los meses recomendados (por ejemplo, frutales a raíz desnuda en dic–feb) | 12 |

La ficha agrega **años a la primera cosecha**, **meses de cosecha** y **horas frío estimadas** de la zona. Ejemplo real: Saltillo junta ~440 horas frío. Alcanza para la vid (150–400) pero no para un manzano tradicional (900): solo variedades de bajo requerimiento. Con +1.5 °C hacia 2050 bajaría a ~230 horas.

### 4.3 Rotaciones

1. **Candidatas:** la **rotación actual** más 5 plantillas.

   | Plantilla | Secuencia |
   |---|---|
   | Cobertura con leguminosa | maíz → veza / frijol → avena |
   | Ahorro de agua | sorgo → descanso / girasol → descanso |
   | Forraje para ganado | sorgo → avena / alfalfa (2 años) |
   | Raíces profundas y diversidad | girasol → triticale / frijol → cártamo |
   | Hortalizas de mayor valor | calabaza → cebolla / frijol → avena |

2. **Simulación** de 3 a 5 años. En cada temporada se elige el mejor mes de siembra con el motor de aptitud y se acumula:
   - **agua:** demanda y riego, en mm/año;
   - **nitrógeno:** las leguminosas suman 30–120 kg/ha y los cultivos exigentes restan;
   - **materia orgánica:** tendencia según residuos (mejora / estable / baja);
   - **erosión:** tipo RUSLE, a partir de lluvia, factor K, pendiente y cobertura (factor C) ponderada por días, con el suelo desnudo a C = 0.9;
   - **suelo desnudo:** días al año;
   - **ruptura de plagas:** diversidad de familias botánicas, con castigo si se repite la misma familia;
   - **valor:** índice de valor × aptitud;
   - **forraje** y **mano de obra**.
3. **Puntajes de 0 a 5:**
   - ahorro de agua = 5.5 − riego/180;
   - salud del suelo = promedio de MO, N, erosión y suelo desnudo;
   - ingreso, forraje y plagas.
4. **Puntaje global (0–100)** = promedio ponderado por los **sliders de prioridades** × √(aptitud promedio). Una rotación que encaja con las prioridades pero cuyos cultivos no se dan en la zona baja de puntaje.
5. **Textos** de cada estrategia: por qué, evidencia (con fuente), beneficios contra la actual, huecos de información y riesgos para revisión local.

### 4.4 Escenarios

ΔT se suma a máximas y mínimas, y ΔP multiplica la lluvia. Al recalcular:
- **días de calor:** cambia la proporción de días sobre 30 y 35 °C;
- **heladas:** la probabilidad baja ~30 % por °C y las fechas se mueven ~4 días por °C;
- **ET0 y horas frío:** se recalculan con las temperaturas nuevas.

Así, "más calor" cambia heladas, calor en floración, agua y horas frío al mismo tiempo.

### 4.5 Rendimiento esperado

- **Modo demo:** rendimiento de referencia del cultivo × (0.45 + 0.55 × calificación/100), × 0.75 si falta agua sin riego. El rango es P10 = 0.68× y P90 = 1.24× la mediana, y la referencia regional es 0.85× el valor del cultivo. **Es ilustrativo.**
- **Con backend:** modelo **LightGBM por cuantiles** entrenado con rendimientos municipales (SIAP) y por condado (NASS), con variables de clima, suelo y NDVI, intervalos calibrados y validación espacial (`backend-handoff.md` §8).

### 4.6 Chat

- **Modo demo:** detecta la intención (cultivo, perenne, futuro, helada, lluvia, calor, viento, agua, suelo, rotación) y el cultivo mencionado, por nombre o sinónimo: "jitomate", "nuez", "viñedo", "maguey". Llama a los mismos motores y emite los mismos eventos que el backend real.
- **Con backend:** Claude con herramientas (`get_field_profile`, `evaluate_crop`, `compare_rotations`, `get_future_climate`, `get_soil_lab`…), con la regla de **no inventar números** y citar la fuente de cada dato.

---

## 5. Catálogo de cultivos (91)

Valores aproximados de **FAO ECOCROP** (temperaturas, lluvia, pH, ciclo), **FAO-56** (Kc), **FAO-29 / Maas-Hoffman** (umbral de salinidad) y referencias regionales de **horas frío**. Varían por variedad; **todos deben validarse con el agrónomo** (Richard). Fuente en código: `app/src/api/mock/engine/crops.ts`.

Cómo leer las columnas:
- **Mín. que resiste:** temperatura absoluta. "(sin heladas)" = el cultivo no tolera heladas.
- **Salinidad:** CEe del suelo (dS/m) a partir de la cual baja el rendimiento.
- **Horas frío:** horas < 7.2 °C que necesita, desde variedades de bajo requerimiento hasta tradicionales.
- **Floración:** mes, en el hemisferio norte, en que una helada tardía hace más daño.

#### Granos y cereales (9)

| Cultivo | Ciclo (días) | T. óptima °C | Límites °C | Tolera helada | Calor crítico °C | Agua mm/ciclo | pH | Salinidad dS/m | Fija N | Invernadero |
|---|---|---|---|---|---|---|---|---|---|---|
| 🌽 Maíz | 110–150 | 18–33 | 10 a 40 | no | 38 | 500–800 | 5.5–8 | 1.7 | — | — |
| 🌾 Sorgo | 100–130 | 22–35 | 12 a 42 | no | 38 | 400–600 | 5.5–8.5 | 6.8 | — | — |
| 🌾 Trigo | 120–160 | 12–24 | -8 a 32 | sí | 32 | 400–600 | 6–8 | 6 | — | — |
| 🌾 Cebada | 100–130 | 12–24 | -6 a 32 | sí | 32 | 350–500 | 6–8.5 | 8 | — | — |
| 🌾 Centeno | 110–150 | 8–22 | -25 a 30 | sí | 30 | 300–450 | 5–7.5 | 6 | — | — |
| 🍚 Arroz | 120–150 | 22–32 | 12 a 38 | no | 35 | 900–1400 | 5–7.5 | 3 | — | — |
| 🌱 Amaranto | 90–120 | 20–32 | 10 a 40 | no | 38 | 300–500 | 6–8 | 4 | — | — |
| 🌱 Chía | 120–150 | 16–28 | 8 a 34 | no | 34 | 350–550 | 6–8 | 2 | — | — |
| 🌱 Quinoa | 100–150 | 12–25 | -4 a 35 | sí | 32 | 250–450 | 6–8.5 | 8 | — | — |

#### Forrajes y pastos (8)

| Cultivo | Ciclo | T. óptima °C | Mín. que resiste °C | Calor crítico °C | Agua mm/año | pH | Salinidad dS/m | Horas frío (bajo req.–tradicional) | Floración (riesgo helada) | 1.ª cosecha | Cosecha |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 🌽 Maíz forrajero (ensilaje) | 95–120 d | 18–32 | 10 (sin heladas) | 38 | 450–700 | 5.5–8 | 1.7 | — | — | — | — |
| 🌾 Sorgo forrajero | 80–110 d | 22–35 | 12 (sin heladas) | 40 | 350–550 | 5.5–8.5 | 6.8 | — | — | — | — |
| 🌾 Avena forrajera | 90–120 d | 10–22 | -6 | 30 | 300–450 | 5.5–8 | 5 | — | — | — | — |
| 🌾 Triticale | 110–140 d | 10–24 | -8 | 32 | 300–450 | 5.5–8 | 6 | — | — | — | — |
| ☘️ Alfalfa | 300–365 d | 10–30 | -10 | 38 | 800–1200 | 6.5–8.5 | 2 | — | — | — | — |
| 🌱 Ballico (ryegrass) | 150–240 d | 10–22 | -8 | 30 | 500–800 | 5.5–8 | 5.6 | — | — | — | — |
| 🌾 Pasto sudán | 80–120 d | 22–34 | 12 (sin heladas) | 40 | 350–600 | 5.5–8.5 | 2.8 | — | — | — | — |
| 🌾 Zacate buffel | perenne | 24–35 | -6 | 42 | 250–600 | 6–8.5 | 6 | — | — | año 1 | jul–oct |

#### Leguminosas (9)

| Cultivo | Ciclo (días) | T. óptima °C | Límites °C | Tolera helada | Calor crítico °C | Agua mm/ciclo | pH | Salinidad dS/m | Fija N | Invernadero |
|---|---|---|---|---|---|---|---|---|---|---|
| 🫘 Frijol | 85–110 | 16–28 | 10 a 32 | no | 32 | 300–500 | 5.5–7.8 | 1 | sí | — |
| 🫘 Garbanzo | 100–130 | 12–26 | -2 a 32 | sí | 32 | 250–400 | 6–8.5 | 1.5 | sí | — |
| 🫛 Haba | 120–160 | 10–22 | -6 a 30 | sí | 28 | 300–500 | 6–8 | 1.6 | sí | — |
| 🫘 Lenteja | 100–130 | 12–24 | -4 a 30 | sí | 30 | 250–400 | 6–8 | 1.5 | sí | — |
| 🫛 Chícharo | 80–110 | 12–20 | -2 a 28 | sí | 27 | 300–450 | 6–7.5 | 1.5 | sí | — |
| 🫘 Soya | 100–140 | 20–30 | 10 a 38 | no | 35 | 450–700 | 6–7.5 | 5 | sí | — |
| 🥜 Cacahuate | 120–150 | 22–30 | 14 a 38 | no | 34 | 450–700 | 5.5–7 | 3.2 | sí | — |
| ☘️ Veza (abono verde) | 100–130 | 8–22 | -8 a 30 | sí | 30 | 250–400 | 5.5–8 | 3 | sí | — |
| ☘️ Trébol (cobertura) | 120–200 | 10–24 | -10 a 30 | sí | 30 | 400–700 | 6–7.5 | 1.5 | sí | — |

#### Hortalizas (25)

| Cultivo | Ciclo | T. óptima °C | Mín. que resiste °C | Calor crítico °C | Agua mm/año | pH | Salinidad dS/m | Horas frío (bajo req.–tradicional) | Floración (riesgo helada) | 1.ª cosecha | Cosecha |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 🫛 Ejote | 60–80 d | 16–28 | 10 (sin heladas) | 32 | 250–400 | 5.5–7.5 | 1 | — | — | — | — |
| 🥔 Papa | 100–130 d | 14–24 | 5 (sin heladas) | 29 | 450–650 | 5–7 | 1.7 | — | — | — | — |
| 🍅 Tomate | 100–140 d | 18–28 | 10 (sin heladas) | 32 | 400–700 | 5.5–7.5 | 2.5 | — | — | — | — |
| 🍏 Tomate verde | 80–110 d | 18–28 | 10 (sin heladas) | 33 | 400–600 | 5.5–7.5 | 2 | — | — | — | — |
| 🌶️ Chile | 120–150 d | 18–30 | 12 (sin heladas) | 33 | 500–750 | 5.5–7.5 | 1.5 | — | — | — | — |
| 🫑 Pimiento morrón | 110–150 d | 18–28 | 12 (sin heladas) | 32 | 500–750 | 5.5–7 | 1.5 | — | — | — | — |
| 🍆 Berenjena | 110–150 d | 20–30 | 12 (sin heladas) | 35 | 500–750 | 5.5–7 | 1.1 | — | — | — | — |
| 🧅 Cebolla | 120–160 d | 12–25 | -2 | 32 | 350–550 | 6–7.5 | 1.2 | — | — | — | — |
| 🧄 Ajo | 150–210 d | 12–24 | -6 | 30 | 400–600 | 6–7.5 | 1.7 | — | — | — | — |
| 🎃 Calabaza | 90–120 d | 18–30 | 10 (sin heladas) | 34 | 350–550 | 5.5–7.5 | 3.2 | — | — | — | — |
| 🥒 Calabacita | 55–75 d | 18–30 | 10 (sin heladas) | 34 | 300–450 | 5.5–7.5 | 4.7 | — | — | — | — |
| 🥒 Pepino | 60–90 d | 18–30 | 12 (sin heladas) | 33 | 350–500 | 5.5–7.5 | 2.5 | — | — | — | — |
| 🍉 Sandía | 80–110 d | 22–32 | 12 (sin heladas) | 36 | 400–600 | 5.5–7.5 | 2 | — | — | — | — |
| 🍈 Melón | 85–120 d | 20–32 | 12 (sin heladas) | 36 | 400–600 | 6–7.5 | 2.2 | — | — | — | — |
| 🥬 Lechuga | 60–90 d | 12–22 | 2 | 27 | 200–350 | 6–7.5 | 1.3 | — | — | — | — |
| 🥦 Brócoli | 70–100 d | 15–22 | -2 | 27 | 350–500 | 6–7.5 | 2.8 | — | — | — | — |
| 🥦 Coliflor | 80–110 d | 15–22 | -1 | 27 | 350–500 | 6–7.5 | 2.8 | — | — | — | — |
| 🥬 Col (repollo) | 90–120 d | 13–24 | -4 | 28 | 380–500 | 6–7.5 | 1.8 | — | — | — | — |
| 🥕 Zanahoria | 90–120 d | 15–24 | 2 | 30 | 350–550 | 6–7.5 | 1 | — | — | — | — |
| 🟣 Betabel | 70–100 d | 15–24 | -2 | 30 | 350–500 | 6–7.5 | 4 | — | — | — | — |
| 🥬 Espinaca | 40–60 d | 10–20 | -6 | 26 | 200–300 | 6–7.5 | 2 | — | — | — | — |
| 🌿 Cilantro | 45–70 d | 15–25 | -2 | 30 | 250–400 | 6–7.5 | 1.5 | — | — | — | — |
| 🌱 Rábano | 25–45 d | 10–22 | -2 | 28 | 150–250 | 6–7.5 | 1.2 | — | — | — | — |
| 🍠 Camote | 120–150 d | 22–30 | 12 (sin heladas) | 35 | 400–650 | 5.5–7 | 1.5 | — | — | — | — |
| 🌱 Espárrago | perenne | 16–28 | -20 | 35 | 500–800 | 6.5–8 | 4.1 | — | — | año 2 | feb–abr |

#### Berries (4)

| Cultivo | Ciclo | T. óptima °C | Mín. que resiste °C | Calor crítico °C | Agua mm/año | pH | Salinidad dS/m | Horas frío (bajo req.–tradicional) | Floración (riesgo helada) | 1.ª cosecha | Cosecha |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 🍓 Fresa | 180–240 d | 15–25 | -6 | 30 | 500–800 | 5.5–6.8 | 1 | — | — | — | — |
| 🍓 Frambuesa | perenne | 15–25 | -20 | 30 | 500–800 | 5.5–7 | 1 | 200–800 | abr | año 1 | jun–oct |
| 🫐 Zarzamora | perenne | 16–28 | -15 | 32 | 500–800 | 5.5–7 | 1 | 200–600 | abr | año 1 | may–ago |
| 🫐 Arándano | perenne | 15–26 | -25 | 32 | 500–800 | 4.5–5.5 | 1 | 150–800 | mar | año 2 | abr–jul |

#### Oleaginosas (3)

| Cultivo | Ciclo (días) | T. óptima °C | Límites °C | Tolera helada | Calor crítico °C | Agua mm/ciclo | pH | Salinidad dS/m | Fija N | Invernadero |
|---|---|---|---|---|---|---|---|---|---|---|
| 🌻 Girasol | 100–130 | 18–30 | 8 a 38 | no | 36 | 350–550 | 6–8 | 4.8 | — | — |
| 🌼 Cártamo | 120–150 | 15–28 | -4 a 38 | sí | 36 | 250–450 | 6–8.5 | 7 | — | — |
| 🌼 Canola | 120–160 | 12–24 | -8 a 32 | sí | 30 | 350–500 | 5.5–8 | 6 | — | — |

#### Industriales (3)

| Cultivo | Ciclo (días) | T. óptima °C | Límites °C | Tolera helada | Calor crítico °C | Agua mm/ciclo | pH | Salinidad dS/m | Fija N | Invernadero |
|---|---|---|---|---|---|---|---|---|---|---|
| ☁️ Algodón | 150–180 | 22–32 | 14 a 40 | no | 38 | 600–900 | 5.5–8 | 7.7 | — | — |
| 🍠 Remolacha azucarera | 160–200 | 15–25 | -4 a 32 | sí | 32 | 550–750 | 6.5–8 | 7 | — | — |
| 🎋 Caña de azúcar | 330–365 | 24–34 | 12 a 42 | no | 40 | 1500–2500 | 5–8 | 1.7 | — | — |

#### Frutales (20)

| Cultivo | Ciclo | T. óptima °C | Mín. que resiste °C | Calor crítico °C | Agua mm/año | pH | Salinidad dS/m | Horas frío (bajo req.–tradicional) | Floración (riesgo helada) | 1.ª cosecha | Cosecha |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 🍎 Manzana | perenne | 12–24 | -30 | 35 | 600–900 | 5.5–8 | 1.7 | 400–900 | abr | año 4 | ago–oct |
| 🍐 Pera | perenne | 12–25 | -25 | 35 | 600–900 | 6–8.2 | 1.7 | 400–900 | mar | año 5 | jul–sep |
| 🍑 Durazno | perenne | 15–28 | -20 | 36 | 600–900 | 6–7.5 | 1.7 | 200–800 | feb | año 3 | may–ago |
| 🟣 Ciruela | perenne | 14–27 | -20 | 36 | 600–850 | 6–7.5 | 1.5 | 300–800 | mar | año 4 | jun–ago |
| 🍑 Chabacano | perenne | 14–28 | -20 | 36 | 550–800 | 6–8 | 1.6 | 300–700 | feb | año 4 | may–jun |
| 🍐 Membrillo | perenne | 14–28 | -20 | 36 | 500–800 | 5.5–8 | 1.7 | 100–300 | abr | año 4 | ago–oct |
| 🍒 Cereza | perenne | 12–24 | -25 | 32 | 600–900 | 6–7.5 | 1.5 | 600–1100 | abr | año 5 | may–jul |
| 🌳 Higo | perenne | 18–32 | -10 | 40 | 400–700 | 6–8.5 | 4 | 100–300 | — | año 3 | jun–sep |
| 🔴 Granada | perenne | 18–33 | -12 | 40 | 500–800 | 5.5–8.5 | 4 | 100–200 | abr | año 3 | sep–oct |
| 🥑 Aguacate | perenne | 16–28 | -2 (sin heladas) | 36 | 900–1300 | 5–7 | 1.3 | — | — | año 4 | oct–mar |
| 🍊 Naranja | perenne | 18–30 | -3 (sin heladas) | 38 | 900–1200 | 5.5–7.5 | 1.7 | — | — | año 4 | nov–mar |
| 🍋 Limón | perenne | 20–32 | -2 (sin heladas) | 38 | 900–1200 | 5.5–7.5 | 1.5 | — | — | año 3 | jun–oct |
| 🍊 Mandarina | perenne | 18–30 | -4 (sin heladas) | 38 | 900–1200 | 5.5–7.5 | 1.7 | — | — | año 4 | oct–ene |
| 🍊 Toronja | perenne | 20–32 | -3 (sin heladas) | 38 | 900–1200 | 5.5–7.5 | 1.8 | — | — | año 4 | nov–mar |
| 🥭 Mango | perenne | 24–33 | 1 (sin heladas) | 42 | 800–1200 | 5.5–7.5 | 1.5 | — | — | año 4 | may–ago |
| 🟠 Papaya | perenne | 22–32 | 5 (sin heladas) | 38 | 1200–1800 | 5.5–7 | 1.5 | — | — | año 1 | ene–dic |
| 🍌 Plátano | perenne | 24–32 | 10 (sin heladas) | 38 | 1500–2500 | 5.5–7.5 | 1 | — | — | año 1 | ene–dic |
| 🍈 Guayaba | perenne | 20–30 | -1 (sin heladas) | 40 | 800–1200 | 5–7.5 | 2 | — | — | año 3 | oct–feb |
| 🫒 Aceituna (olivo) | perenne | 15–30 | -10 | 40 | 500–800 | 6.5–8.5 | 4 | 150–400 | abr | año 4 | oct–dic |
| 🌴 Dátil (palma datilera) | perenne | 25–38 | -5 | 48 | 1200–1800 | 7–8.5 | 4 | — | — | año 5 | ago–oct |

#### Vid (1)

| Cultivo | Ciclo | T. óptima °C | Mín. que resiste °C | Calor crítico °C | Agua mm/año | pH | Salinidad dS/m | Horas frío (bajo req.–tradicional) | Floración (riesgo helada) | 1.ª cosecha | Cosecha |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 🍇 Uva (vid) | perenne | 15–30 | -18 | 38 | 500–800 | 5.5–8.5 | 1.5 | 150–400 | abr | año 3 | jul–sep |

#### Nueces (4)

| Cultivo | Ciclo | T. óptima °C | Mín. que resiste °C | Calor crítico °C | Agua mm/año | pH | Salinidad dS/m | Horas frío (bajo req.–tradicional) | Floración (riesgo helada) | 1.ª cosecha | Cosecha |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 🌰 Nuez pecanera (nogal) | perenne | 20–32 | -20 | 41 | 1000–1400 | 6–8 | 1.5 | 300–600 | abr | año 6 | oct–dic |
| 🌰 Nuez de Castilla | perenne | 14–28 | -25 | 38 | 700–1000 | 6–8 | 1.5 | 500–1000 | abr | año 6 | sep–oct |
| 🌰 Almendra | perenne | 15–30 | -15 | 40 | 600–1000 | 6–8.5 | 1.5 | 200–500 | feb | año 4 | ago–sep |
| 🥜 Pistache | perenne | 18–35 | -15 | 44 | 500–900 | 7–8.5 | 8 | 600–1000 | abr | año 6 | ago–sep |

#### Nopal y agave (2)

| Cultivo | Ciclo | T. óptima °C | Mín. que resiste °C | Calor crítico °C | Agua mm/año | pH | Salinidad dS/m | Horas frío (bajo req.–tradicional) | Floración (riesgo helada) | 1.ª cosecha | Cosecha |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 🌵 Nopal (verdura y tuna) | perenne | 16–32 | -10 | 45 | 200–500 | 6–8.5 | 6 | — | — | año 1 | mar–oct |
| 🌵 Agave (maguey) | perenne | 18–30 | -8 | 45 | 250–600 | 6–8.5 | 6 | — | — | año 6 | ene–dic |

#### Aromáticas (3)

| Cultivo | Ciclo | T. óptima °C | Mín. que resiste °C | Calor crítico °C | Agua mm/año | pH | Salinidad dS/m | Horas frío (bajo req.–tradicional) | Floración (riesgo helada) | 1.ª cosecha | Cosecha |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 🌿 Orégano | perenne | 15–30 | -8 | 40 | 300–600 | 6–8.5 | 3 | — | — | año 1 | jun–oct |
| 🪻 Lavanda | perenne | 15–28 | -15 | 36 | 300–550 | 6.5–8.5 | 2.5 | — | — | año 2 | jun–jul |
| 🌿 Romero | perenne | 15–28 | -10 | 38 | 300–550 | 6–8.5 | 3 | — | — | año 1 | abr–oct |

**Cultivos de invernadero** (los únicos que se evalúan en invernaderos): tomate, tomate verde, chile, pimiento, berenjena, pepino, melón, calabacita, lechuga, espinaca, cilantro, rábano, ejote, fresa, frambuesa, zarzamora y arándano.

> Si falta un cultivo, basta con agregar una línea en `crops.ts` (y en `/crops` del backend). La interfaz, el buscador, la matriz y el chat lo toman automáticamente.

---

## 6. Cómo debe estar hecha la API para que la app funcione

### 6.1 Dos modos

| | Sin `VITE_API_URL` (hoy) | Con `VITE_API_URL=https://...` |
|---|---|---|
| Quién responde | `app/src/api/mock/` (en el navegador) | El backend |
| Terrenos | `localStorage` del navegador | Base de datos, separados por `X-Client-Id` |
| Chat | Reglas | Claude en Bedrock |

Ambos implementan la **misma interfaz `Api`** (`app/src/api/client.ts`). Para conectar el backend:

```bash
VITE_API_URL=https://<backend> make deploy
```

### 6.2 Reglas generales (si alguna falla, la app no funciona)

1. **Base:** todas las rutas cuelgan de `{VITE_API_URL}/api/v1`.
2. **JSON en `snake_case`**, con los nombres y tipos exactos de `app/src/api/types.ts`, que es la fuente de verdad del front.
3. **Identidad:** leer el header `X-Client-Id` (UUID) y filtrar los terrenos por él. Sin login.
4. **CORS:** permitir el origen `https://d2t0xc94bclkum.cloudfront.net` y `http://localhost:5173`, los métodos GET/POST/PUT/PATCH/DELETE y los headers `Content-Type`, `X-Client-Id` y `Accept-Language`. Configurarlo en un solo lugar: duplicar los headers rompe el navegador.
5. **Errores:** status HTTP adecuado + `{"error": {"code": "...", "message": "texto para el usuario"}}`. El front muestra `message` tal cual.
6. **Idioma:** respetar `Accept-Language: es`; los textos (razones, riesgos, notas) se devuelven en español.
7. **Geometrías:** GeoJSON `Polygon` o `MultiPolygon` en `[lon, lat]`. El front ya calcula `area_ha` y `centroid`, pero el backend debe devolverlos en `Field`.
8. **Fechas día-mes** como `"MM-DD"`, meses 1–12, semanas 1–52.

### 6.3 Endpoints, qué pantalla los usa y qué espera

| Método y ruta | Pantalla | Qué espera el front (tipo en `types.ts`) |
|---|---|---|
| `GET /crops` | ¿Qué sembrar?, chat | `Crop[]` con **todos** los campos, incluidos `category`, `perennial`, `salt_threshold_ds_m`, `greenhouse_ok`, `chill_hours`, `sensitive_month`, `years_to_first_harvest`, `harvest_months`, `plant_months` y `aliases` |
| `GET /fields` | Inicio, Mapa, Nueva (otros terrenos de fondo) | `Field[]` del cliente (los ejemplos pueden venir con `is_demo: true`) |
| `POST /fields` | Nueva parcela | Recibe `FieldInput`; devuelve `Field` con `id`, `area_ha`, `centroid`, `country`, `admin` y `profile_status: "processing"`, y **arranca el cálculo del perfil en segundo plano** |
| `GET /fields/{id}` | Página del terreno, Mapa | `Field` |
| `PATCH /fields/{id}` · `DELETE /fields/{id}` | Borrar terreno | `Field` · 204 |
| `GET /fields/{id}/profile` | Todas las pestañas | **202** `{"status":"processing","steps":[{source_id,status}]}` mientras calcula; **200** `FieldProfile` con `status:"ready"` al terminar. Error = status 4xx/5xx con `error.message` |
| `POST /fields/{id}/profile:refresh` | Reintentar | 202 |
| `GET /fields/{id}/suitability?delta_t_c=&delta_p_pct=` | Matriz | `SuitabilityMatrix` (meses 1–12 × cultivos). **En invernaderos, solo cultivos con `greenhouse_ok`** |
| `GET /fields/{id}/suitability?crop_id=&planting_month=&delta_t_c=&delta_p_pct=` | Ficha del cultivo | `SuitabilityDetail`; con `perennial` lleno si el cultivo es perenne |
| `POST /fields/{id}/rotations` | Rotaciones | Recibe `RotationRequest`; devuelve `RotationResponse` (≥ 3 estrategias, una con `is_current: true`, más `recommended_id`) |
| `GET /fields/{id}/greenhouse` | Invernadero | `GreenhouseReport` |
| `GET /fields/{id}/water-quality` | Agua | `WaterQualityReport`, o `null` (200) si no hay estación cercana |
| `POST /fields/{id}/predict-yield` | Ficha del cultivo | `YieldPrediction` |
| `POST /fields/{id}/soil-report` (multipart `file`) | Suelo | `SoilReportExtraction` (**no guarda**) |
| `PUT /fields/{id}/soil-lab` · `DELETE /fields/{id}/soil-lab` | Suelo | 204. Después el perfil debe traer `soil.lab`, `soil.source_id: "lab_report"` y `confidence: "high"` |
| `GET /fields/{id}/future-climate` | Resumen, escenarios, chat | `FutureClimate` |
| `POST /chat/conversations` | Chat | `{"conversation_id": "..."}` |
| `POST /chat/conversations/{id}/messages` | Chat | **`text/event-stream`** (ver 6.4) |

### 6.4 Flujos con comportamiento especial

**Crear un terreno y esperar el análisis**
```
POST /fields ──▶ 201 Field(profile_status="processing")
GET  /fields/{id}/profile ──▶ 202 {status:"processing", steps:[...]}   (el front repite cada 0.7 s)
GET  /fields/{id}/profile ──▶ 200 FieldProfile {status:"ready", ...}  (deja de preguntar)
```
- Los `steps` alimentan la pantalla "Analizando"; `source_id` debe ser uno de los de `sources`.
- Tiempo objetivo: menos de 30 s, o instantáneo desde cache.

**Escenarios.** Cada movimiento de slider vuelve a pedir `suitability` y `rotations` con `delta_t_c` y `delta_p_pct`. **No se recalcula el perfil**, solo los motores sobre él, así que debe responder rápido (menos de 1 s).

**Análisis de suelo en dos pasos.** `POST soil-report` → el usuario corrige → `PUT soil-lab` → el front invalida `profile`, `suitability`, `rotations` y `yield`. Unidades: MO %, N/P/K/Ca/Mg en ppm, CE en dS/m, CIC en cmol/kg.

**Chat por SSE.** Cada evento lleva `event:` y `data:` con JSON, separados por una línea en blanco:
```
event: status    data: {"state":"thinking"}
event: tool      data: {"name":"evaluate_crop","state":"running","label":"Evaluando manzana"}
event: tool      data: {"name":"evaluate_crop","state":"done"}
event: text      data: {"delta":"Manzana en Rancho ..."}          (muchos, en orden)
event: card      data: {"type":"suitability","payload":{...SuitabilityDetail}}
event: citation  data: {"source_id":"nasa_power","label":"NASA POWER 1991–2025"}
event: done      data: {"message_id":"..."}
event: error     data: {"code":"llm_unavailable","message":"..."}
```
La petición lleva `{"content": "...", "active_field_id": "fld_..."}`, que es el terreno abierto en ese momento.

### 6.5 Lista de aceptación (antes de conectar el front)

- [ ] `curl -H "X-Client-Id: test" $API/api/v1/crops` devuelve 91+ cultivos con los campos nuevos.
- [ ] `POST /fields` con un polígono de Saltillo → `GET /profile` pasa de 202 a 200 en menos de 30 s.
- [ ] El `FieldProfile` trae `climate.frost.by_month[].record_tmin_c` (lo usan los perennes) y `climate.risk_calendar` con 52 semanas.
- [ ] `suitability` sin `crop_id` devuelve 12 columnas por cultivo; con `delta_t_c=2` cambian las calificaciones.
- [ ] `rotations` devuelve ≥ 3 estrategias + la actual, con `why`, `evidence`, `benefits`, `gaps` y `risks_local_review` no vacíos.
- [ ] El chat responde en streaming y termina siempre con `done` o `error`.
- [ ] La preflight de CORS (`OPTIONS`) desde el dominio de CloudFront responde 200 con los headers correctos.
- [ ] Un `X-Client-Id` distinto no ve los terrenos de otro.

### 6.6 Dónde hospedarlo

Con **App Runner** o, si la cuenta de AWS está en el plan gratuito, **Lambda + Function URL** con Lambda Web Adapter (la misma app FastAPI, con streaming para el chat y 15 min por petición). Detalle y costos en `backend-handoff.md` §5.

---

## 7. Qué tan confiables son los datos

| Dato | Confianza | Por qué |
|---|---|---|
| Heladas (mínimas) | **Buena** | NASA POWER contra ERA5-Land: menos de 1 °C de diferencia. Las fechas pueden variar 1–4 semanas donde casi no hiela |
| Máximas y calor | **Media** | En zonas con cerros, POWER sale 2.5–3 °C más caliente porque promedia ~50 km de terreno más bajo. El backend lo corregirá por altitud (SRTM, −6.5 °C/km) |
| Horas frío | **Media-baja** | Estimadas con temperaturas mensuales y afectadas por el sesgo anterior: en la sierra (Arteaga) probablemente hay **más** horas frío de las que muestra. El backend debe calcularlas con datos horarios |
| Lluvia | **Media-baja** | Las fuentes difieren ±30 %. El backend usará GPM IMERG y mostrará el rango |
| Clima futuro | **Tendencia** | Consistente en temperatura; en lluvia los modelos no coinciden en Coahuila. Es una tendencia de 20 años, no un pronóstico |
| Suelo estimado | **Media** (backend) / *ejemplo* (demo) | Mapas de 250 m; el análisis de laboratorio la sube a **alta** |
| Granizo | **Baja** | Proxy indirecto; siempre "validar localmente" |
| Calidad del agua | *Ejemplo* (demo) | Con backend, la última medición de la estación más cercana (puede estar lejos de tu pozo) |
| Rendimiento | *Ilustrativo* (demo) | Con backend, modelo validado con MAE e intervalos |
| Parámetros de cultivos | **A validar** | Rangos generales FAO; dependen de la variedad |

Validación completa con números: `backend-handoff.md`, Anexo C.

---

## 8. Cómo explicarla: guion de demo y preguntas típicas

### Guion de 4 minutos

1. **El problema (20 s):** "Los productores de Coahuila deciden qué sembrar con la costumbre, pero el clima ya cambió: heladas tardías, agua dura, acuíferos que bajan. Los datos de la NASA existen, pero nadie se los traduce."
2. **Dibujar (30 s):** abrir **Nueva parcela**, buscar "Derramadero", tocar las esquinas siguiendo el borde, mostrar el **＋** para agregar un punto y cerrar tocando el primero.
3. **Resumen (40 s):** en el ejemplo de Saltillo, "Siembra sin helada desde el 12 de marzo", 65 % de la lluvia en jun–sep, agua subterránea bajando y **clima 2050: +1.5 °C**.
4. **¿Qué sembrar? (40 s):** la matriz; tocar **maíz en abril**, ver por qué; buscar **"uva"**: apta, ~440 horas frío. Buscar **"manzana"**: solo variedades de bajo frío.
5. **Escenario (20 s):** botón **Proyección 2031–2050**: la matriz cambia en vivo.
6. **Rotaciones (40 s):** subir el slider "Ahorrar agua" y ver cómo se reordenan; abrir la tarjeta con **Por qué / Evidencia / Beneficios / Lo que no sabemos / Revisar con tu agrónomo** (el formato que pide el reto).
7. **Suelo + chat (40 s):** capturar pH 8.2 y CE 1.1 → todo se recalcula. En el chat: "¿Se dan las manzanas aquí?" → responde con horas frío y cuánto bajarían hacia 2050, con fuentes.
8. **Mapa e invernadero (20 s):** **Mapa** con parcelas en verde e invernaderos en azul; abrir el de Arteaga: "ráfaga de 79 km/h cada 10 años contra 90 km/h que resiste".
9. **Cierre (10 s):** "Datos NASA + criterio local. La app dice qué no sabe."

### Preguntas que pueden hacer los jueces

| Pregunta | Respuesta corta |
|---|---|
| ¿Qué datos de la NASA usan? | POWER (clima diario de 35 años), y en el backend GPM IMERG, SMAP, MODIS (NDVI, ET), ECOSTRESS, SRTM, GRACE-FO, OCO-2 y NEX-GDDP-CMIP6 para el futuro |
| ¿Cómo manejan la incertidumbre? | Percentiles (P10/P50/P90) en vez de promedios, rango entre modelos climáticos, nivel de confianza por dato y la sección "Lo que no sabemos" en cada terreno |
| ¿Es una caja negra? | No: cada calificación es una suma de reglas con su razón y su fuente; el código de los motores es abierto |
| ¿Funciona para frutales? | Sí: 91 cultivos, incluidos frutales, vid, nogal y cítricos, con horas frío, helada en floración y agua anual |
| ¿Validaron los datos? | Sí, contra ERA5-Land: las mínimas coinciden; las máximas tienen sesgo en zonas con cerros y ya está identificada la corrección |
| ¿Por qué no mide N-P-K por satélite? | Ningún satélite lo mide; por eso el análisis de laboratorio es parte del flujo |
| ¿Reemplaza al agrónomo? | No: cada estrategia trae "Revisar con tu agrónomo" y los umbrales los valida un agrónomo |

---

## 9. Glosario

| Término | Significado sencillo |
|---|---|
| **P10 / P50 / P90** | De 10 años, en 1 / 5 / 9 el valor fue menor o igual. "P90 de la última helada" = fecha después de la cual 9 de cada 10 años ya no heló |
| **ET0** | Agua que el sol y el viento sacarían de un pasto bien regado; base para calcular cuánta agua necesita cada cultivo |
| **Kc** | Multiplicador de ET0 según el cultivo y su etapa (FAO-56) |
| **Horas frío** | Horas del invierno bajo 7.2 °C. Los frutales de hoja caduca las necesitan para florear parejo |
| **NDVI** | Índice de verdor medido por satélite (0 = suelo desnudo, ~0.8 = vegetación densa) |
| **DLI** | Luz total que reciben las plantas en un día (mol/m²/día) |
| **Periodo de retorno** | "Ráfaga de 10 años" = la que se supera en promedio una vez cada 10 años (10 % de probabilidad al año) |
| **CE / salinidad** | Conductividad eléctrica: cuánta sal hay en el suelo o el agua (dS/m) |
| **CIC** | Capacidad del suelo para retener nutrientes |
| **Método delta** | Usar el *cambio* que proyecta un modelo climático en lugar de sus valores absolutos |
| **CMIP6 / NEX-GDDP** | Proyecciones de los modelos climáticos internacionales; NEX-GDDP es la versión de la NASA a ~25 km |
| **Rotación** | Orden en que se alternan cultivos en el mismo terreno a lo largo de los años |
| **Cultivo de cobertura** | Se siembra para proteger y alimentar el suelo, no para vender |

---

## 10. Mapa del código

```
app/src/
  api/
    types.ts                 ← contrato (fuente de verdad del JSON)
    client.ts / http.ts      ← interfaz Api y cliente del backend real (incluye SSE)
    mock/                    ← modo demostración
      engine/climate.ts      ← heladas, lluvia, calor, viento, luz, calendario (desde POWER diario)
      engine/agro.ts         ← ET0, modelo climático con escenario, horas frío
      engine/crops.ts        ← catálogo de 91 cultivos + búsqueda por nombre/sinónimo
      engine/suitability.ts  ← aptitud anual y perenne
      engine/rotations.ts    ← plantillas, simulación, puntajes y textos
      engine/future.ts       ← clima futuro por método delta (CMIP6)
      engine/profile.ts      ← FieldProfile de demo, invernadero, agua, rendimiento
      chat.ts                ← agrónomo por reglas (mismos eventos SSE)
      fixtures/              ← clima y futuro precalculados de los 3 ejemplos
  pages/                     ← home, map-page, new-field, field/* (pestañas)
  components/                ← mapa, gráficas, chat, UI
  lib/                       ← formato, tema, geo, colores por tipo, rangos de suelo
docs/
  guia-de-la-app.md          ← este documento
  backend-handoff.md         ← diseño, contrato JSON completo, motores, ML, infraestructura
```
