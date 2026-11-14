import * as maplibregl from 'maplibre-gl'
import type { StyleSpecification } from 'maplibre-gl'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url'
import { useEffect, useRef, useState } from 'react'

// MapLibre 6 busca su worker junto a su propio módulo; con el pre-empaquetado
// de Vite esa ruta no existe, así que se le pasa explícitamente como asset.
maplibregl.setWorkerUrl(workerUrl)
import type { Field, Geometry } from '@/api/types'
import { bbox } from '@/lib/geo'
import { KIND } from '@/lib/kinds'
import { useTheme } from '@/lib/theme'

export type Basemap = 'satellite' | 'map'

// Fondos sin API key. Las capas se alternan por visibilidad (sin recargar el estilo).
const STYLE: StyleSpecification = {
  version: 8,
  sources: {
    sat: {
      type: 'raster',
      tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
      tileSize: 256,
      maxzoom: 19,
      attribution: 'Imágenes © Esri, Maxar, Earthstar Geographics',
    },
    labels: {
      type: 'raster',
      tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}'],
      tileSize: 256,
      maxzoom: 19,
    },
    light: {
      type: 'raster',
      tiles: ['a', 'b', 'c', 'd'].map((s) => `https://${s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png`),
      tileSize: 256,
      attribution: '© OpenStreetMap © CARTO',
    },
    dark: {
      type: 'raster',
      tiles: ['a', 'b', 'c', 'd'].map((s) => `https://${s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png`),
      tileSize: 256,
      attribution: '© OpenStreetMap © CARTO',
    },
  },
  layers: [
    { id: 'light', type: 'raster', source: 'light', layout: { visibility: 'none' } },
    { id: 'dark', type: 'raster', source: 'dark', layout: { visibility: 'none' } },
    { id: 'sat', type: 'raster', source: 'sat' },
    { id: 'labels', type: 'raster', source: 'labels', paint: { 'raster-opacity': 0.9 } },
  ],
}

function setBase(map: maplibregl.Map, base: Basemap, theme: 'light' | 'dark') {
  const vis = (id: string, on: boolean) => map.getLayer(id) && map.setLayoutProperty(id, 'visibility', on ? 'visible' : 'none')
  vis('sat', base === 'satellite')
  vis('labels', base === 'satellite')
  vis('light', base === 'map' && theme === 'light')
  vis('dark', base === 'map' && theme === 'dark')
}

export function useMap(opts: { center?: [number, number]; zoom?: number; interactive?: boolean; basemap?: Basemap } = {}) {
  const container = useRef<HTMLDivElement>(null)
  const [map, setMap] = useState<maplibregl.Map | null>(null)
  const theme = useTheme((s) => s.resolved)
  const basemap = opts.basemap ?? 'satellite'

  useEffect(() => {
    if (!container.current) return
    const m = new maplibregl.Map({
      container: container.current,
      style: STYLE,
      center: opts.center ?? [-101.0, 25.42],
      zoom: opts.zoom ?? 11,
      interactive: opts.interactive ?? true,
      attributionControl: { compact: true },
      fadeDuration: 150,
    })
    // 'load' espera a que bajen las teselas satelitales: con internet lento se
    // perdían los primeros clics al dibujar. 'style.load' basta para agregar capas.
    const ready = () => setMap(m)
    m.once('style.load', ready)
    m.once('load', ready)
    return () => {
      setMap(null)
      m.remove()
    }
    // El mapa se crea una sola vez.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (map) setBase(map, basemap, theme)
  }, [map, basemap, theme])

  return { container, map }
}

export const FIELD_COLOR = KIND.field.color

/** Dibuja (o actualiza) un polígono de parcela con relleno y borde. */
export function drawField(map: maplibregl.Map, id: string, geometry: Geometry | null, opts: { fit?: boolean; padding?: number; color?: string } = {}) {
  const color = opts.color ?? FIELD_COLOR
  const data = { type: 'Feature' as const, properties: {}, geometry: geometry ?? { type: 'Polygon' as const, coordinates: [] } }
  const src = map.getSource(id) as maplibregl.GeoJSONSource | undefined
  if (src) src.setData(data)
  else {
    map.addSource(id, { type: 'geojson', data })
    if (!map.getLayer(`${id}-fill`)) map.addLayer({ id: `${id}-fill`, type: 'fill', source: id, paint: { 'fill-color': color, 'fill-opacity': 0.22 } })
    if (!map.getLayer(`${id}-line`)) map.addLayer({ id: `${id}-line`, type: 'line', source: id, paint: { 'line-color': color, 'line-width': 2.5 } })
  }
  if (map.getLayer(`${id}-fill`)) map.setPaintProperty(`${id}-fill`, 'fill-color', color)
  if (map.getLayer(`${id}-line`)) map.setPaintProperty(`${id}-line`, 'line-color', color)
  if (geometry && opts.fit) {
    const [w, s, e, n] = bbox(geometry)
    map.fitBounds([w, s, e, n], { padding: opts.padding ?? 48, duration: 0, maxZoom: 17 })
  }
}

const kindColor: maplibregl.ExpressionSpecification = ['match', ['get', 'kind'], 'greenhouse', KIND.greenhouse.color, KIND.field.color]

/**
 * Todas las geocercas en una sola fuente, coloreadas por tipo.
 * `selected` resalta una; `dim` las pinta tenues (contexto al dibujar una nueva).
 */
export function drawFieldCollection(map: maplibregl.Map, id: string, fields: Pick<Field, 'id' | 'kind' | 'geometry' | 'name'>[], opts: { selected?: string | null; dim?: boolean } = {}) {
  const data: GeoJSON.FeatureCollection = {
    type: 'FeatureCollection',
    features: fields.map((f) => ({ type: 'Feature', properties: { id: f.id, kind: f.kind, name: f.name, selected: f.id === opts.selected }, geometry: f.geometry })),
  }
  const src = map.getSource(id) as maplibregl.GeoJSONSource | undefined
  if (src) src.setData(data)
  else {
    map.addSource(id, { type: 'geojson', data })
    map.addLayer({ id: `${id}-fill`, type: 'fill', source: id, paint: { 'fill-color': kindColor, 'fill-opacity': opts.dim ? 0.12 : ['case', ['get', 'selected'], 0.38, 0.22] } })
    map.addLayer({
      id: `${id}-line`,
      type: 'line',
      source: id,
      paint: { 'line-color': kindColor, 'line-width': opts.dim ? 1.5 : ['case', ['get', 'selected'], 4, 2.5], 'line-opacity': opts.dim ? 0.7 : 1, ...(opts.dim ? { 'line-dasharray': [2, 2] } : {}) },
    })
  }
}

export function fitAll(map: maplibregl.Map, geometries: Geometry[], opts: { padding?: number | maplibregl.PaddingOptions; duration?: number; maxZoom?: number } = {}) {
  if (!geometries.length) return
  const boxes = geometries.map(bbox)
  const b: [number, number, number, number] = [Math.min(...boxes.map((x) => x[0])), Math.min(...boxes.map((x) => x[1])), Math.max(...boxes.map((x) => x[2])), Math.max(...boxes.map((x) => x[3]))]
  map.fitBounds(b, { padding: opts.padding ?? 60, duration: opts.duration ?? 0, maxZoom: opts.maxZoom ?? 16 })
}
