import type { Field } from './types.ts'
import type { FieldOverrides } from './engine/profile.ts'

function rect(lon: number, lat: number, wM: number, hM: number): Field['geometry'] {
  const dLat = hM / 2 / 111_320
  const dLon = wM / 2 / (111_320 * Math.cos((lat * Math.PI) / 180))
  return {
    type: 'Polygon',
    coordinates: [[[lon - dLon, lat - dLat], [lon + dLon, lat - dLat], [lon + dLon, lat + dLat], [lon - dLon, lat + dLat], [lon - dLon, lat - dLat]]],
  }
}

export function circle(lon: number, lat: number, rM: number, n = 48): Field['geometry'] {
  const ring: [number, number][] = []
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * 2 * Math.PI
    ring.push([lon + (rM * Math.cos(a)) / (111_320 * Math.cos((lat * Math.PI) / 180)), lat + (rM * Math.sin(a)) / 111_320])
  }
  return { type: 'Polygon', coordinates: [ring] }
}

export interface DemoField {
  field: Field
  overrides: FieldOverrides
  story: string
}

const created = '2026-11-14T18:00:00Z'

export const DEMOS: DemoField[] = [
  {
    story: 'Semi-arid ranch with hard water, late frosts and livestock.',
    field: {
      id: 'demo-saltillo',
      is_demo: true,
      name: 'Rancho Derramadero',
      kind: 'field',
      geometry: rect(-101.27, 25.27, 760, 640),
      area_ha: 48.6,
      centroid: [-101.27, 25.27],
      country: 'MX',
      admin: { state: 'Coahuila', municipality: 'Saltillo' },
      created_at: created,
      profile_status: 'ready',
      current_rotation: [
        { year: 1, season: 'spring_summer', crop_id: 'maiz' },
        { year: 1, season: 'fall_winter', crop_id: null },
      ],
      irrigation: { available: true, source: 'well', max_mm_per_year: 700 },
      livestock: { species: 'bovino', head: 40 },
    },
    overrides: {
      soil: { texture_class: 'clay loam (Calcisol)', k_factor: 0.034, layer: { om_pct: 1.6, soc_g_kg: 9.3, ph: 8.1, clay_pct: 31, sand_pct: 32, silt_pct: 37, cec_cmol_kg: 23, n_total_g_kg: 0.85, awc_mm_per_m: 135 } },
      terrain: { slope_pct: { mean: 1.8, p90: 3.9 }, aspect_dominant: 'N', cold_air_pooling_share: 0.18 },
      groundwater_trend_cm_per_year: -1.4,
    },
  },
  {
    story: 'Tomato greenhouse exposed to spring winds and hail.',
    field: {
      id: 'demo-arteaga',
      is_demo: true,
      name: 'Arteaga Greenhouse',
      kind: 'greenhouse',
      geometry: rect(-100.86, 25.44, 160, 70),
      area_ha: 1.1,
      centroid: [-100.86, 25.44],
      country: 'MX',
      admin: { state: 'Coahuila', municipality: 'Arteaga' },
      created_at: created,
      profile_status: 'ready',
      current_rotation: [
        { year: 1, season: 'spring_summer', crop_id: 'tomate' },
        { year: 1, season: 'fall_winter', crop_id: 'lechuga' },
      ],
      irrigation: { available: true, source: 'well', max_mm_per_year: 900 },
      greenhouse: { structure: 'multitunel', cover: 'polietileno', rated_wind_kmh: 90, heated: false, co2_enrichment: false },
    },
    overrides: {
      soil: { texture_class: 'loam', layer: { om_pct: 2.4, ph: 7.6 } },
      terrain: { slope_pct: { mean: 3.2, p90: 6.1 }, aspect_dominant: 'NO', cold_air_pooling_share: 0.05 },
      groundwater_trend_cm_per_year: -1.1,
    },
  },
  {
    // Location verified with real data: alfalfa in USDA CDL 2021–2025, summer NDVI 0.4–0.7 with dips
    // after each cutting (MODIS) and Dia loam soil pH 7 (SSURGO). 1.5 km from the Fallon Experiment
    // Station (NOAA GHCN USC00262780).
    story: 'Irrigated alfalfa in the Nevada desert, like the challenge photo.',
    field: {
      id: 'demo-nevada',
      is_demo: true,
      name: 'Irrigated alfalfa, Fallon',
      kind: 'field',
      geometry: rect(-118.77, 39.445, 300, 300),
      area_ha: 9,
      centroid: [-118.77, 39.445],
      country: 'US',
      admin: { state: 'Nevada', municipality: 'Churchill County' },
      created_at: created,
      profile_status: 'ready',
      current_rotation: [
        { year: 1, season: 'spring_summer', crop_id: 'alfalfa' },
        { year: 1, season: 'fall_winter', crop_id: 'alfalfa' },
        { year: 2, season: 'spring_summer', crop_id: 'alfalfa' },
        { year: 2, season: 'fall_winter', crop_id: 'alfalfa' },
        { year: 3, season: 'spring_summer', crop_id: 'alfalfa' },
        { year: 3, season: 'fall_winter', crop_id: 'alfalfa' },
        { year: 4, season: 'spring_summer', crop_id: 'maiz' },
        { year: 4, season: 'fall_winter', crop_id: 'trigo' },
      ],
      irrigation: { available: true, source: 'surface', max_mm_per_year: 1000 },
      livestock: null,
    },
    overrides: {
      soil: { texture_class: 'loam (Dia loam)', layer: { om_pct: 2, ph: 7, clay_pct: 20, sand_pct: 40, silt_pct: 40 } },
      terrain: { slope_pct: { mean: 0.4, p90: 1.0 }, aspect_dominant: 'plano', cold_air_pooling_share: 0.22 },
      groundwater_trend_cm_per_year: -0.8,
    },
  },
]

export const DEMO_BY_ID = new Map(DEMOS.map((d) => [d.field.id, d]))
