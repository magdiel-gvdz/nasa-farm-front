# Integración con el backend actual

Validado el 15 de noviembre de 2026 sobre la API persistente de dev:
`https://na-80276c48174345cab83857032d88d2ac.ecs.us-east-1.on.aws`.
`/ready` respondió `environment=dev`, `data_version=2026111508`.

El contrato vigente está en [`../contracts/openapi.json`](../contracts/openapi.json).
Las instrucciones de configuración, regeneración y pruebas están en
[`../app/README.md`](../app/README.md). El handoff original describe también funciones
previstas que todavía no publica el backend; no debe usarse como contrato operativo.

## Cambios visibles

- El modo normal usa dev; `dev:demo` y `build:demo` seleccionan la demostración.
- Todas las selecciones de cultivos y los nombres en mapa, chat y rotaciones usan el catálogo
  del servidor, incluidos IDs como `avena_forrajera`.
- El perfil síncrono conserva secciones sin datos en `null`, su procedencia y sus vacíos.
  Se identifica la celda zonal y su versión de datos.
- El calendario muestra 36 decenas, heladas, heladas severas, calor seleccionable, lluvia
  intensa, estrés hídrico, suelo descubierto, viento y periodos vulnerables.
- Las rotaciones usan el índice de exposición a erosión, sin atribuirle toneladas/ha.
  Incluyen mano de obra, ingreso desconocido, equipo, exclusiones, riego, horizonte 1–6 años
  y comparación de 3–6 estrategias.
- Los escenarios manuales usan los rangos del contrato y se presentan como hipotéticos.
- Se pueden editar nombre, límite GeoJSON, rotación, riego, ganado y estructura de invernadero.
- La subida de suelo aplica valores inmediatamente; no llama a rutas de guardado inexistentes.
- El chat envía `text` y `field_id`, procesa SSE y restaura historial, citas y tarjetas.
- Rendimiento, calidad de agua y CMIP6 quedan limitados al modo demostración.

## Pruebas de API contra dev

Se ejecutaron dos planes con la guía `curl-api-endpoint-tester`: **19 casos correctos**.
Cada plan generó un UUID de cliente y recursos temporales propios. Las geocercas se borraron
al terminar. No se usaron geocercas del usuario ni credenciales de autenticación.

| Casos | Resultado |
|---|---|
| Salud y disponibilidad de datos | 200; entorno dev |
| Catálogo y fuentes | 200; datos JSON |
| Preflight CORS desde localhost | 200; origen y encabezados admitidos |
| Crear geocerca | 201; celda, zona y perfil listo |
| Perfil | 200; exactamente 36 decenas y procedencia |
| Aptitud con escenario +2 °C / −20 % | 200; escenario aplicado |
| Comparación de rotaciones | 200; cuatro estrategias y recomendación |
| Editar geocerca | 200; nombre actualizado |
| Contrato de chat inválido | 422 |
| Borrar geocerca y consultar después | 204, seguido de 404 |
| Crear invernadero y evaluar viento | 201 y 200; secciones fuera de alcance en null |
| Crear conversación y enviar mensaje | 201 y SSE 200 con text y done |
| Recuperar historial | 200; mensajes del usuario y asistente |
| Borrar invernadero temporal | 204 |

Ejemplos equivalentes a las solicitudes ejecutadas; `CID`, `FID` y `CONV` representan solo
los identificadores temporales generados por los planes:

```powershell
$api = 'https://na-80276c48174345cab83857032d88d2ac.ecs.us-east-1.on.aws'
curl.exe "$api/ready"
curl.exe "$api/api/v1/crops" -H 'Accept-Language: en'
curl.exe "$api/api/v1/fields/$FID/profile" -H "X-Client-Id: $CID"
curl.exe "$api/api/v1/fields/$FID/suitability?crop_id=maiz&planting_month=4&delta_t_c=2&delta_p_pct=-20" -H "X-Client-Id: $CID"
curl.exe "$api/api/v1/fields/$FID/greenhouse" -H "X-Client-Id: $CID"
curl.exe "$api/api/v1/chat/conversations/$CONV" -H "X-Client-Id: $CID"
```

La extracción de archivos se valida en pruebas del cliente y de navegador con una respuesta
controlada; esta validación no envía informes a Bedrock. El chat y la evaluación de viento sí
se comprobaron contra los servicios desplegados.
