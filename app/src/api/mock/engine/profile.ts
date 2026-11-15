// Construye el FieldProfile en modo demostración. El clima es real (NASA
// POWER); suelo, terreno, agua y vegetación son estimaciones de ejemplo
// marcadas como tales en `gaps` hasta que el backend las traiga de
// SoilGrids / SRTM / SMAP / MODIS / GRACE.

import type { ClimateProfile, Field, FieldProfile, GreenhouseReport, Source, WaterQualityReport, YieldPrediction } from '../../types.ts'
import { buildClimateModel, cycleMonths, et0Hargreaves, MID_DOY } from './agro.ts'
import { AGRO, CROP_BY_ID } from './crops.ts'
import type { SuitabilityDetail } from '../../types.ts'

export const SOURCES: Record<string, Source> = {
  nasa_power: { id: 'nasa_power', dataset: 'NASA POWER Daily (AG)', provider: 'NASA Langley', resolution: '0.5° × 0.625° (~50 km)', url: 'https://power.larc.nasa.gov/' },
  soilgrids: { id: 'soilgrids', dataset: 'SoilGrids 250 m', provider: 'ISRIC', resolution: '250 m', url: 'https://soilgrids.org' },
  ssurgo: { id: 'ssurgo', dataset: 'SSURGO (Soil Data Access)', provider: 'USDA NRCS', resolution: '1:24,000', url: 'https://sdmdataaccess.sc.egov.usda.gov' },
  srtm: { id: 'srtm', dataset: 'SRTM 30 m', provider: 'NASA/USGS', resolution: '30 m', url: 'https://www.earthdata.nasa.gov/data/instruments/srtm' },
  smap: { id: 'smap', dataset: 'SMAP L4 soil moisture', provider: 'NASA', resolution: '9 km', url: 'https://www.earthdata.nasa.gov/data/platforms/space-based-platforms/smap' },
  modis_ndvi: { id: 'modis_ndvi', dataset: 'MODIS MOD13Q1 NDVI', provider: 'NASA LP DAAC', resolution: '250 m', url: 'https://lpdaac.usgs.gov/products/' },
  modis_mod16: { id: 'modis_mod16', dataset: 'MODIS MOD16 evapotranspiration', provider: 'NASA LP DAAC', resolution: '500 m' },
  grace_fo: { id: 'grace_fo', dataset: 'GRACE / GRACE-FO', provider: 'NASA/GFZ', resolution: '~300 km' },
  gpm_dpr_era5: { id: 'gpm_dpr_era5', dataset: 'Hail Proxy (GPM DPR + ERA5)', provider: 'NASA/ECMWF', resolution: '5–30 km' },
  era5: { id: 'era5', dataset: 'ERA5 wind gusts', provider: 'ECMWF Copernicus', resolution: '~31 km' },
  oco2: { id: 'oco2', dataset: 'OCO-2 XCO₂', provider: 'NASA JPL', resolution: '~2 km (strips)' },
  conagua_renameca: { id: 'conagua_renameca', dataset: 'CONAGUA – National Water Quality Measurement Network', provider: 'CONAGUA', resolution: 'stations' },
  usgs_nwis: { id: 'usgs_nwis', dataset: 'USGS NWIS / Water Quality Portal', provider: 'USGS', resolution: 'stations' },
  cdl: { id: 'cdl', dataset: 'Cropland Data Layer', provider: 'USDA NASS', resolution: '30 m', url: 'https://nassgeodata.gmu.edu/CropScape/' },
  siap: { id: 'siap', dataset: 'SIAP municipal agricultural production', provider: 'SADER', resolution: 'municipality' },
  nass: { id: 'nass', dataset: 'NASS QuickStats', provider: 'USDA', resolution: 'county' },
  lab_report: { id: 'lab_report', dataset: 'Producer Laboratory Analysis', provider: 'Soil Laboratory', resolution: 'Composite field sample' },
  cmip6_highresmip: { id: 'cmip6_highresmip', dataset: 'CMIP6 HighResMIP (Open-Meteo Climate API)', provider: 'WCRP CMIP6 / Open-Meteo', resolution: '~25–50 km', period: '2031–2050 vs 1991–2020', url: 'https://open-meteo.com/en/docs/climate-api' },
  nex_gddp_cmip6: { id: 'nex_gddp_cmip6', dataset: 'NASA NEX-GDDP-CMIP6', provider: 'NASA Ames', resolution: '0.25° (~25 km)', url: 'https://www.nccs.nasa.gov/services/data-collections/land-based-products/nex-gddp-cmip6' },
}

export interface FieldOverrides {
  soil?: Partial<FieldProfile['soil']> & { layer?: Partial<FieldProfile['soil']['layers'][number]> }
  terrain?: Partial<FieldProfile['terrain']>
  groundwater_trend_cm_per_year?: number
  land_use?: FieldProfile['land_use']
}

const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x))
const r1 = (x: number) => Math.round(x * 10) / 10
const r2 = (x: number) => Math.round(x * 100) / 100

export function buildProfile(field: Field, climate: ClimateProfile, overrides: FieldOverrides = {}): FieldProfile {
  const lat = field.centroid[1]
  const annual = climate.rain.annual_mean_mm ?? 400
  const us = field.country === 'US'

  // Suelo de ejemplo: más lluvia → más materia orgánica y suelos más ácidos.
  const om = r1(clamp(0.5 + annual / 450, 0.6, 5))
  const ph = r1(clamp(8.4 - annual / 650, 5.2, 8.4))
  const clay = Math.round(clamp(18 + annual / 40, 12, 45))
  const sand = Math.round(clamp(55 - annual / 30, 15, 65))
  const layer = {
    depth_cm: [0, 30] as [number, number],
    soc_g_kg: r1(om * 5.8),
    om_pct: om,
    n_total_g_kg: r2(om * 0.05 * 10),
    ph,
    cec_cmol_kg: Math.round(8 + clay * 0.5),
    clay_pct: clay,
    sand_pct: sand,
    silt_pct: 100 - clay - sand,
    bulk_density_g_cm3: 1.38,
    awc_mm_per_m: Math.round(90 + clay * 1.5),
    ...overrides.soil?.layer,
  }
  const texture = layer.clay_pct! >= 35 ? 'clay' : layer.sand_pct! >= 50 ? 'franco-arenosa' : layer.clay_pct! >= 27 ? 'franco-clay' : 'loam'

  // Agua: ET0 mensual (Hargreaves) y balance P − ET0.
  const et0 = climate.heat.by_month.map((h, i) => et0Hargreaves(lat, MID_DOY[i], h.mean_tmax_c ?? 20, h.mean_tmin_c ?? 8) * [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][i])
  const rainM = climate.rain.by_month.map((b) => b.mean_mm ?? 0)

  // Vegetación: meses sin cultivo según la rotación actual.
  const covered = new Set<number>()
  for (const step of field.current_rotation ?? []) {
    if (!step.crop_id) continue
    const crop = CROP_BY_ID.get(step.crop_id)
    if (!crop) continue
    const plant = step.season === 'spring_summer' ? (lat >= 0 ? 4 : 10) : lat >= 0 ? 10 : 4
    const cyc = crop.perennial || crop.id === 'alfalfa' ? 365 : (crop.cycle_days[0] + crop.cycle_days[1]) / 2
    cycleMonths(plant, cyc).forEach((m) => covered.add(m))
  }
  if (field.kind === 'greenhouse') for (let m = 1; m <= 12; m++) covered.add(m)
  const ndvi = rainM.map((p, i) => {
    const lag = rainM[(i + 11) % 12]
    const crop = covered.has(i + 1) ? 0.22 : 0
    const mean = clamp(0.14 + (p + lag) / 600 + crop, 0.1, 0.85)
    return { month: i + 1, mean: r2(mean), p10: r2(mean * 0.82), p90: r2(mean * 1.15) }
  })
  const bare = field.current_rotation?.length ? Array.from({ length: 12 }, (_, i) => i + 1).filter((m) => !covered.has(m)) : ndvi.filter((n) => n.mean < 0.25).map((n) => n.month)

  const elev = climate.elevation_m ?? 0
  const hailMonths = climate.rain.by_month
    .filter((b, i) => (b.mean_heavy_rain_days ?? 0) > 0.08 && (climate.heat.by_month[i].mean_tmax_c ?? 0) > 22)
    .map((b) => b.month)
    .slice(0, 3)
  const hailLevel: 'low' | 'medium' | 'high' = elev > 1500 && hailMonths.length ? 'medium' : hailMonths.length ? 'low' : 'low'

  // Inyecta el proxy de granizo en el calendario semanal.
  const calendar = climate.risk_calendar.map((w) => {
    const m = +w.starts.slice(0, 2)
    return { ...w, p_hail_proxy: hailMonths.includes(m) ? (hailLevel === 'medium' ? 0.12 : 0.05) : 0 }
  })

  const soilSource = us ? 'ssurgo' : 'soilgrids'
  const lab = overrides.soil?.lab ?? null
  const sourcesUsed = ['nasa_power', soilSource, ...(lab ? ['lab_report'] : []), 'srtm', 'smap', 'modis_ndvi', 'modis_mod16', 'grace_fo', 'gpm_dpr_era5', ...(overrides.land_use ? ['cdl'] : [])]

  return {
    status: 'ready',
    field_id: field.id,
    computed_at: new Date().toISOString(),
    pipeline_version: 'demo-1',
    climate: { ...climate, risk_calendar: calendar },
    soil: {
      source_id: lab ? 'lab_report' : soilSource,
      confidence: lab ? 'high' : 'medium',
      texture_class: lab?.texture || overrides.soil?.texture_class || texture,
      layers: [layer],
      lab,
      k_factor: overrides.soil?.k_factor ?? r2(0.02 + (layer.silt_pct ?? 30) / 1500),
    },
    terrain: {
      source_id: 'srtm',
      elevation_m: { mean: Math.round(elev), min: Math.round(elev - 8), max: Math.round(elev + 14) },
      slope_pct: { mean: 2.1, p90: 4.6 },
      aspect_dominant: 'NE',
      cold_air_pooling_share: 0.12,
      ...overrides.terrain,
    },
    water: {
      soil_moisture: { source_id: 'smap', years: [2015, 2025], by_month: rainM.map((p, i) => ({ month: i + 1, mean_m3_m3: r2(clamp(0.06 + (p + rainM[(i + 11) % 12] * 0.5) / 900, 0.05, 0.42)) })) },
      et: { source_id: 'modis_mod16', by_month: et0.map((e, i) => ({ month: i + 1, et_mm: Math.round(Math.min(e * 0.7, rainM[i] + 15)), et0_mm: Math.round(e) })) },
      water_balance_by_month: et0.map((e, i) => ({ month: i + 1, p_minus_et0_mm: Math.round(rainM[i] - e) })),
      groundwater: { source_id: 'grace_fo', trend_cm_per_year: overrides.groundwater_trend_cm_per_year ?? -0.5, years: [2002, 2025] },
    },
    vegetation: { source_id: 'modis_ndvi', ndvi_by_month: ndvi, bare_soil_months: bare, vigor_trend_per_decade: -0.01 },
    land_use: overrides.land_use ?? null,
    hazards: {
      hail: {
        source_id: 'gpm_dpr_era5',
        level: hailLevel,
        evidence: 'low',
        months_of_concern: hailMonths,
        note: 'There is no direct NASA hail product; It is an approximate indicator. Confirm it with producers in the area.',
      },
    },
    sources: sourcesUsed.map((id) => ({ ...SOURCES[id], ...(id === 'nasa_power' ? { period: `${climate.years[0]}–${climate.years[1]}` } : {}) })),
    gaps: [
      { code: 'demo_mode', severity: 'medium', message: 'Demo mode: Weather comes from real NASA POWER; Soil, water and vegetation are example estimates until connecting the server.' },
      { code: 'power_tmax_bias', severity: 'low', message: 'NASA POWER averages ~50 km: in areas with hills the maximums can be 2–3 °C higher than in your terrain (validated against ERA5-Land).' },
      ...(lab ? [] : [{ code: 'no_lab', severity: 'medium' as const, message: 'There is no laboratory analysis: nitrogen, phosphorus and potassium are estimates. Upload it to the Soil tab.' }]),
      { code: 'hail_no_direct_product', severity: 'medium', message: 'Hail is estimated with an indirect indicator (low evidence).' },
      { code: 'coarse_climate', severity: 'low', message: 'Climate averages ~50 km; Low-lying areas and slopes can be colder or hotter.' },
      { code: 'air_vs_ground_frost', severity: 'low', message: 'Frost is measured in air at 2 m; At ground level it can freeze at 2–3 °C.' },
    ],
  }
}

const COVER_T = { polietileno: 0.75, policarbonato: 0.8, vidrio: 0.88, malla: 0.6 }

export function greenhouseReport(field: Field, profile: FieldProfile): GreenhouseReport {
  const gh = field.greenhouse
  const c = profile.climate
  const rated = gh?.rated_wind_kmh ?? null
  const levels = c.wind.return_levels_kmh
  // Probabilidad anual de superar la resistencia: interpolación sobre los niveles de retorno.
  let exceed: number | null = null
  if (rated != null && levels.length) {
    const pts = levels.map((l) => ({ p: 1 / l.return_period_years, v: l.estimated_gust_kmh ?? 0 }))
    if (rated <= pts[0].v) exceed = Math.min(0.5, pts[0].p * Math.exp((pts[0].v - rated) / 10))
    else if (rated >= pts[pts.length - 1].v) exceed = pts[pts.length - 1].p * Math.exp(-(rated - pts[pts.length - 1].v) / 10)
    else {
      for (let i = 0; i < pts.length - 1; i++) {
        if (rated >= pts[i].v && rated <= pts[i + 1].v) {
          const f = (rated - pts[i].v) / (pts[i + 1].v - pts[i].v)
          exceed = pts[i].p + f * (pts[i + 1].p - pts[i].p)
        }
      }
    }
  }
  const status = exceed == null ? 'warn' : exceed > 0.05 ? 'bad' : exceed > 0.02 ? 'warn' : 'ok'
  const t = COVER_T[gh?.cover ?? 'polietileno']
  const windiest = [...c.wind.by_month].sort((a, b) => (b.mean_daily_max_kmh ?? 0) - (a.mean_daily_max_kmh ?? 0)).slice(0, 3).map((m) => m.month)
  const recs = [
    status !== 'ok' ? `Check anchors, turnbuckles and cover before the windiest months.` : 'The structure resists typical winds; Check anchors every season.',
    c.light.by_month.some((m) => (m.mean_dli_mol_m2_day ?? 0) * t > 30) ? 'In the sunniest months, consider shade mesh to not exceed ~30 mol/m²/day.' : 'The light is moderate; keep the cover clean to take advantage of it.',
    'To enrich with CO₂ (800–1000 ppm) install a sensor inside the greenhouse.',
  ]
  if (profile.hazards.hail.level !== 'low') recs.push('There is a risk of hail: consider anti-hail mesh in the indicated season.')
  return {
    wind: {
      structure_rated_kmh: rated,
      return_levels_kmh: levels.map((l) => ({ return_period_years: l.return_period_years, estimated_gust_kmh: l.estimated_gust_kmh })),
      annual_exceedance_probability: exceed == null ? null : Math.round(exceed * 1000) / 1000,
      status,
      riskiest_months: windiest,
      source_id: 'nasa_power',
      note: 'Gust estimated from the daily maximum wind (×1.4). The local relief can increase it.',
    },
    light: { by_month: c.light.by_month.map((m) => ({ month: m.month, outdoor_dli: m.mean_dli_mol_m2_day ?? 0, indoor_dli_est: r1((m.mean_dli_mol_m2_day ?? 0) * t) })), cover_transmission: t },
    temperature: {
      by_month: c.heat.by_month.map((h, i) => {
        const tmin = h.mean_tmin_c ?? 8
        const days = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][i]
        return { month: h.month, heating_degree_hours_base12: Math.round(Math.max(0, 12 - tmin) * 9 * days), hours_over_35c_outside: Math.round((h.mean_days_over_35c ?? 0) * 4) }
      }),
    },
    co2: { ambient_ppm: 427, source_id: 'oco2', typical_enrichment_target_ppm: [800, 1000], note: 'OCO-2 measures CO₂ in the atmosphere; inside the greenhouse a sensor is needed.' },
    hail: { level: profile.hazards.hail.level, evidence: 'low', months_of_concern: profile.hazards.hail.months_of_concern },
    recommendations: recs,
  }
}

interface Station {
  name: string
  lat: number
  lon: number
  source: 'conagua_renameca' | 'usgs_nwis'
  type: string
  last: string
  v: { hardness: number; tds: number; sulfate: number; nitrate: number; ec: number; sar: number; boron: number; fluoride: number }
}

// Muestras de ejemplo (formato de la red CONAGUA / NWIS); reemplazar por los datos reales del backend.
const STATIONS: Station[] = [
  { name: 'Saltillo–Ramos Arizpe agricultural well', lat: 25.47, lon: -100.98, source: 'conagua_renameca', type: 'underground', last: '2024-09-12', v: { hardness: 430, tds: 1150, sulfate: 390, nitrate: 18, ec: 1.8, sar: 2.1, boron: 0.6, fluoride: 1.1 } },
  { name: 'General Cepeda Well', lat: 25.38, lon: -101.47, source: 'conagua_renameca', type: 'underground', last: '2024-05-20', v: { hardness: 510, tds: 1480, sulfate: 620, nitrate: 12, ec: 2.3, sar: 2.8, boron: 0.8, fluoride: 1.4 } },
  { name: 'Arteaga Well', lat: 25.45, lon: -100.85, source: 'conagua_renameca', type: 'underground', last: '2024-08-02', v: { hardness: 310, tds: 720, sulfate: 160, nitrate: 9, ec: 1.1, sar: 0.9, boron: 0.3, fluoride: 0.7 } },
  { name: 'Carson River near Fallon, NV', lat: 39.46, lon: -118.77, source: 'usgs_nwis', type: 'surface', last: '2025-06-18', v: { hardness: 190, tds: 520, sulfate: 110, nitrate: 3, ec: 0.8, sar: 2.4, boron: 0.9, fluoride: 0.5 } },
]

const haversine = (a: [number, number], b: [number, number]) => {
  const R = 6371
  const dLat = ((b[1] - a[1]) * Math.PI) / 180
  const dLon = ((b[0] - a[0]) * Math.PI) / 180
  const h = Math.sin(dLat / 2) ** 2 + Math.cos((a[1] * Math.PI) / 180) * Math.cos((b[1] * Math.PI) / 180) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

export function waterQualityReport(field: Field): WaterQualityReport | null {
  const near = STATIONS.map((s) => ({ s, d: haversine(field.centroid, [s.lon, s.lat]) })).sort((a, b) => a.d - b.d)[0]
  if (!near || near.d > 80) return null
  const { s, d } = near
  const lv = (x: number, warn: number, bad: number) => (x >= bad ? 'bad' : x >= warn ? 'warn' : 'ok') as 'ok' | 'warn' | 'bad'
  const params = [
    { code: 'hardness_caco3', name: 'Total hardness', value: s.v.hardness, unit: 'mg/L CaCO₃', livestock: lv(s.v.hardness, 180, 800), irrigation: lv(s.v.hardness, 600, 1200) },
    { code: 'tds', name: 'Dissolved salts (SDT)', value: s.v.tds, unit: 'mg/L', livestock: lv(s.v.tds, 3000, 5000), irrigation: lv(s.v.tds, 450, 2000) },
    { code: 'sulfate', name: 'Sulfates', value: s.v.sulfate, unit: 'mg/L', livestock: lv(s.v.sulfate, 500, 1000), irrigation: lv(s.v.sulfate, 960, 2000) },
    { code: 'nitrate', name: 'Nitrates (N)', value: s.v.nitrate, unit: 'mg/L', livestock: lv(s.v.nitrate, 23, 45), irrigation: lv(s.v.nitrate, 30, 60) },
    { code: 'ec', name: 'Conductivity (salinity)', value: s.v.ec, unit: 'dS/m', livestock: lv(s.v.ec, 4.7, 7.8), irrigation: lv(s.v.ec, 0.7, 3) },
    { code: 'boron', name: 'Boronn', value: s.v.boron, unit: 'mg/L', livestock: lv(s.v.boron, 5, 10), irrigation: lv(s.v.boron, 0.7, 3) },
    { code: 'fluoride', name: 'Fluorine', value: s.v.fluoride, unit: 'mg/L', livestock: lv(s.v.fluoride, 2, 4), irrigation: lv(s.v.fluoride, 1, 2) },
  ]
  const worst = (k: 'livestock' | 'irrigation') => (params.some((p) => p[k] === 'bad') ? 'bad' : params.some((p) => p[k] === 'warn') ? 'warn' : 'ok')
  const live = worst('livestock')
  const irr = worst('irrigation')
  const hard = s.v.hardness > 180
  return {
    station: { name: s.name, source_id: s.source, distance_km: Math.round(d * 10) / 10, last_sample: s.last, type: s.type },
    parameters: params,
    livestock_summary: {
      status: live,
      message: hard ? 'Very hard water (a lot of calcium and magnesium): it forms scale in water troughs and pipes and can affect the consumption of livestock.' : 'Suitable for livestock in general.',
    },
    irrigation_summary: {
      status: irr,
      ec_ds_m: s.v.ec,
      sar: s.v.sar,
      message: s.v.ec > 3 ? 'High salinity: severe restriction for irrigation (FAO-29).' : s.v.ec > 0.7 ? 'Moderate salinity: choose tolerant crops and wash away salts with longer irrigations.' : 'No restriction for irrigation.',
    },
    recommendations: [
      ...(hard ? ['Clean waterers frequently and consider a softener or mixing with rainwater.'] : []),
      ...(s.v.sulfate > 300 ? ['Sulfates are approaching the limit for cattle: monitor diarrhea and low consumption.'] : []),
      ...(s.v.ec > 0.7 ? ['Prefers salt-tolerant crops (barley, sorghum, alfalfa) over beans or onions.'] : []),
      'Confirm with an analysis of your own well and with your veterinarian.',
    ],
    gaps: [
      { code: 'station_distance', severity: d > 20 ? 'medium' : 'low', message: `The nearest station is ${Math.round(d)} km; your well may be different.` },
      { code: 'demo_mode', severity: 'medium', message: 'Sample sample with official network format; the server will bring the last actual measurement.' },
    ],
  }
}

export function predictYield(cropId: string, detail: SuitabilityDetail, irrigated: boolean, country: string): YieldPrediction {
  const base = AGRO[cropId]?.yield_t_ha ?? 3
  const waterBad = detail.reasons.find((r) => r.factor === 'water' && r.status !== 'ok')
  const factor = (0.45 + 0.55 * (detail.score / 100)) * (waterBad && !irrigated ? 0.75 : 1)
  const p50 = base * factor
  const drivers: YieldPrediction['drivers'] = detail.reasons
    .filter((r) => r.status !== 'ok')
    .map((r, i) => ({ feature: r.detail, effect: 'negative', weight: Math.round(Math.max(0.05, 0.35 - i * 0.08) * 100) / 100 }))
  if (!drivers.length) drivers.push({ feature: 'Favorable climate throughout the cycle', effect: 'positive', weight: 0.3 })
  return {
    crop_id: cropId,
    unit: 't/ha',
    p10: r1(p50 * 0.68),
    p50: r1(p50),
    p90: r1(p50 * 1.24),
    regional_reference: { value: r1(base * 0.85), source_id: country === 'US' ? 'nass' : 'siap', level: country === 'US' ? 'county' : 'municipality', years: [2015, 2024] },
    drivers,
    model: { name: 'demo_reglas', version: '0', cv_mae: 0, interval_coverage: 0 },
    confidence: 'low',
  }
}

export { buildClimateModel }
