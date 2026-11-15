// UI view models. Wire models are generated in backend.d.ts from contracts/openapi.json.
// Demo-specific models live in mock/types.ts.

import type { Polygon, MultiPolygon } from 'geojson'

export type Geometry = Polygon | MultiPolygon
export type Confidence = 'high' | 'medium' | 'low'
export type Level = 'ok' | 'warn' | 'bad' | 'unknown'
export type SuitStatus = 'suitable' | 'marginal' | 'unsuitable'

export interface Source {
  id: string
  data_class?: 'observation' | 'model' | 'derived' | 'estimate' | 'synthetic'
  product?: string
  license?: string
  dataset: string
  provider: string
  resolution: string
  period?: string
  url?: string
}

export interface Gap {
  code: string
  severity: 'low' | 'medium' | 'high'
  message: string
}

export interface DayOfYear {
  doy: number
  date: string // MM-DD
}

// ---------- Catálogo de cultivos ----------
export type CropRole = 'cash' | 'legume' | 'cover' | 'forage' | 'deep_root' | 'drought_tolerant'
export type CropCategory = 'grain' | 'legume' | 'forage' | 'vegetable' | 'oilseed' | 'industrial' | 'fruit' | 'vine' | 'nut' | 'berry' | 'cactus' | 'aromatic'

export interface Crop {
  id: string
  name: { es: string; en: string }
  family: string
  roles: CropRole[]
  cycle_days: [number, number]
  temp_opt_c: [number, number]
  temp_abs_c: [number, number]
  frost_tolerant: boolean
  heat_critical_c: number
  water_need_mm: [number, number]
  ph: [number, number]
  kc: { ini: number; mid: number; end: number }
  n_fixing: boolean
  emoji: string
  category: CropCategory
  /** Árboles, vid, nopal, agave, espárrago…: se plantan una vez y producen varios años. */
  perennial: boolean
  /** Salinidad del suelo (CEe, dS/m) a partir de la cual baja el rendimiento (Maas-Hoffman / FAO-29). */
  salt_threshold_ds_m: number | null
  /** Se cultiva comúnmente bajo invernadero o macrotúnel. */
  greenhouse_ok: boolean
  /** Horas frío (< 7.2 °C) que necesita: [variedades de bajo requerimiento, variedades tradicionales]. */
  chill_hours: [number, number] | null
  /** Mes (hemisferio norte) de floración o brotación: cuando una helada tardía hace más daño. */
  sensitive_month: number | null
  years_to_first_harvest: number | null
  /** Meses de cosecha (hemisferio norte) para perennes. Puede cruzar el año: [10, 3] = oct–mar. */
  harvest_months: [number, number] | null
  /** Meses recomendados para plantar perennes (hemisferio norte). */
  plant_months: number[] | null
  /** Otros nombres con los que la gente lo busca o lo menciona en el chat. */
  aliases: string[]
  n_balance_kg_ha?: number
  residue?: string
  root_depth?: string
  margin_index?: number | null
  reviewed?: boolean
  source_id?: string
  equipment?: string[]
}

// ---------- Geocercas ----------
export type FieldKind = 'field' | 'greenhouse'
export type Season = 'spring_summer' | 'fall_winter'

export interface RotationStep {
  year: number
  season: Season
  crop_id: string | null
}

export interface GreenhouseInfo {
  structure: 'multitunel' | 'capilla' | 'macrotunel' | 'casa_sombra' | 'otro'
  cover: 'polietileno' | 'policarbonato' | 'vidrio' | 'malla'
  rated_wind_kmh: number | null
  heated: boolean
  co2_enrichment: boolean
}

export interface FieldInput {
  name: string
  kind: FieldKind
  geometry: Geometry
  current_rotation?: RotationStep[]
  irrigation?: { available: boolean; source?: string; max_mm_per_year?: number }
  livestock?: { species: string; head: number } | null
  greenhouse?: GreenhouseInfo
}

export interface Field extends FieldInput {
  id: string
  area_ha: number
  centroid: [number, number]
  country: string
  admin: { state?: string; municipality?: string | null }
  created_at: string
  profile_status: 'processing' | 'ready' | 'failed'
  is_demo?: boolean
  cell_id?: string
  zone_id?: string
  cell_assignment?: 'centroid'
}

// ---------- Perfil ----------
export interface FrostMonth {
  month: number
  prob_any_frost: number | null
  mean_frost_days: number | null
  mean_frost_risk_days: number | null
  record_tmin_c: number | null
}

export interface Percentiles<T> {
  p10: T | null
  p50: T | null
  p90: T | null
}

export interface FrostSummary {
  threshold_c: number
  risk_threshold_c: number
  years_analyzed: number
  last_spring_frost: Percentiles<DayOfYear> | null
  first_fall_frost: Percentiles<DayOfYear> | null
  frost_free_days: { p10: number | null; p50: number | null } | null
  share_years_without_frost: number | null
  by_month: FrostMonth[]
}

export interface RainMonth {
  month: number
  mean_mm: number | null
  p20_mm: number | null
  p80_mm: number | null
  mean_heavy_rain_days: number | null
}

export interface RainSummary {
  source_id?: string
  annual_mean_mm: number | null
  annual_p20_mm: number | null
  annual_p80_mm: number | null
  annual_cv: number | null
  trend_mm_per_decade: number | null
  rainy_months: number[]
  rainy_month_threshold_mm?: number | null
  wet_day_p95_mm: number | null
  days_per_year_over_25mm: number | null
  days_per_year_over_50mm: number | null
  by_month: RainMonth[]
}

export interface HeatMonth {
  month: number
  mean_tmax_c: number | null
  mean_tmin_c: number | null
  record_tmax_c: number | null
  mean_gdd_base10: number | null
  mean_days_over_30c: number | null
  mean_days_over_35c: number | null
  mean_days_over_40c: number | null
}

export interface HeatSummary {
  annual_mean_c: number | null
  trend_c_per_decade: number | null
  hottest_month: number
  annual_gdd_base10: number | null
  by_month: HeatMonth[]
}

export interface WindSummary {
  annual_max_mean_kmh: number | null
  record_kmh: number | null
  windiest_month: number
  gust_factor_assumed: number
  return_levels_kmh: { return_period_years: number; sustained_kmh: number | null; estimated_gust_kmh: number | null }[]
  by_month: { month: number; mean_daily_max_kmh: number | null; record_kmh: number | null }[]
}

export interface LightSummary {
  annual_mean_dli_mol_m2_day: number | null
  by_month: { month: number; mean_solar_mj_m2_day: number | null; mean_dli_mol_m2_day: number | null }[]
}

export interface RiskPeriod {
  week?: number
  decade?: number
  month?: number
  p_frost_severe?: number | null
  p_heat_30c?: number | null
  p_heat_32c?: number | null
  p_heat_38c?: number | null
  p_water_stress?: number | null
  p_bare_soil?: number | null
  p_strong_wind?: number | null
  precip_p50_mm?: number | null
  et0_p50_mm?: number | null
  vulnerable?: boolean
  vulnerable_reasons?: string[]
  starts: string
  p_frost: number | null
  p_frost_risk?: number | null
  p_heat_35c: number | null
  p_heavy_rain: number | null
  p_dry_week?: number | null
  mean_prec_mm?: number | null
  mean_tmin_c?: number | null
  mean_tmax_c?: number | null
  p_hail_proxy?: number | null
}

export interface ClimateProfile {
  source_id: string
  years: [number, number]
  elevation_m?: number | null
  frost: FrostSummary
  rain: RainSummary
  heat: HeatSummary
  wind: WindSummary | null
  light: LightSummary | null
  risk_calendar: RiskPeriod[]
}

export interface SoilLayer {
  depth_cm: [number, number]
  soc_g_kg: number | null
  om_pct: number | null
  n_total_g_kg: number | null
  ph: number | null
  cec_cmol_kg: number | null
  clay_pct: number | null
  sand_pct: number | null
  silt_pct: number | null
  bulk_density_g_cm3: number | null
  awc_mm_per_m: number | null
  uncertainty?: Record<string, { p05: number; p95: number }>
}

export interface SoilLab {
  lab_name?: string
  sample_date?: string
  depth_cm?: [number, number]
  om_pct?: number | null
  n_ppm?: number | null // Presentation alias for n_mg_kg, without inferring extraction method.
  p_ppm?: number | null // Presentation alias for p_mg_kg.
  k_ppm?: number | null
  ca_ppm?: number | null
  mg_ppm?: number | null
  ph?: number | null
  ec_ds_m?: number | null
  cec_cmol_kg?: number | null
  texture?: string | null
  file_name?: string | null
  depth_label?: string | null
  source_id?: string
}

/** Upload result: applied indicates whether the live server saved the accepted values. */
export interface SoilReportExtraction {
  extracted: SoilLab
  unreadable_fields: string[]
  confidence?: Confidence
  applied?: boolean
  unreadable_reasons?: { field: string; reason: string }[]
  note?: string
}

export interface SoilProfile {
  source_id: string
  confidence: Confidence
  texture_class: string | null
  layers: SoilLayer[]
  lab: SoilLab | null
  k_factor: number | null
}

export interface TerrainProfile {
  source_id: string
  elevation_m: { mean: number; min: number | null; max: number | null }
  slope_pct: { mean: number; p90: number } | null
  aspect_dominant: string | null
  cold_air_pooling_share: number | null
}

export interface WaterProfile {
  soil_moisture: { source_id: string; years: [number, number]; by_month: { month: number; mean_m3_m3: number | null; percentile_p10?: number | null; percentile_p50?: number | null; percentile_p90?: number | null }[] } | null
  et: { source_id: string; by_month: { month: number; et_mm: number | null; et0_mm: number }[] } | null
  water_balance_by_month: { month: number; p_minus_et0_mm: number }[]
  groundwater: { source_id: string; trend_cm_per_year: number; years: [number, number] } | null
}

export interface VegetationProfile {
  source_id: string
  ndvi_by_month: { month: number; mean: number; p10: number | null; p90: number | null }[]
  bare_soil_months: number[]
  vigor_trend_per_decade: number | null
}

export interface Hazard {
  source_id: string
  level: 'low' | 'medium' | 'high'
  evidence: Confidence
  months_of_concern: number[]
  note: string
}

export interface FieldProfile {
  status: 'ready'
  field_id: string
  computed_at: string
  pipeline_version: string
  cell_id?: string
  zone_id?: string
  resolution_m?: number
  data_version?: string
  climate: ClimateProfile
  soil: SoilProfile | null
  terrain: TerrainProfile | null
  water: WaterProfile
  vegetation: VegetationProfile | null
  land_use: { source_id: string; history: { year: number; crop: string; share: number }[]; detected_rotation: string[] } | null
  hazards: { hail: Hazard | null }
  sources: Source[]
  gaps: Gap[]
}

export interface ProfileStep {
  source_id: string
  status: 'pending' | 'running' | 'done' | 'failed'
  message?: string
}

export type ProfileResponse = FieldProfile | { status: 'processing'; steps: ProfileStep[] }

// ---------- Clima futuro (proyecciones CMIP6) ----------
export interface FutureModelDelta {
  model: string
  delta_t_c: number
  delta_p_pct: number
  delta_frost_days: number
  delta_days_over_35c: number
}

export interface FutureClimate {
  source_id: string // "nex_gddp_cmip6" en el backend; "cmip6_highresmip" en modo demostración
  dataset: string
  experiment: string // p. ej. "SSP2-4.5" o "HighResMIP (forzamiento alto)"
  baseline: [number, number]
  period: [number, number]
  models: FutureModelDelta[]
  median: Omit<FutureModelDelta, 'model'>
  range: { delta_t_c: [number, number]; delta_p_pct: [number, number] }
  scenario: Scenario // escenario listo para los motores (mediana redondeada)
  note: string
}

// ---------- Escenario ----------
export interface Scenario {
  delta_t_c: number
  delta_p_pct: number
}

// ---------- Aptitud ----------
export interface SuitabilityReason {
  factor: string
  status: Level
  detail: string
  source_id: string | null
}

export interface ScenarioApplied extends Scenario {
  daily_origin: string | null
  not_recomputed: string[]
  note: string | null
}

export interface SuitabilityDetail {
  scenario?: ScenarioApplied
  crop_id: string
  planting_month: number
  status: SuitStatus
  score: number
  harvest_window: { from: string; to: string } | null
  reasons: SuitabilityReason[]
  confidence: Confidence
  /** Solo para perennes: el mes es de plantación y la cosecha se repite cada año. */
  perennial?: { years_to_first_harvest: number; harvest_months: [number, number]; chill_hours_est: number | null } | null
}

export interface SuitabilityMatrix {
  scenario?: ScenarioApplied
  months: number[]
  crops: { crop_id: string; scores: number[]; status: SuitStatus[] }[]
}

// ---------- Rotaciones ----------
export interface Priorities {
  save_water: number
  income: number
  soil_health: number
  forage: number
  pest_break: number
  low_labor: number
}

export interface RotationRequest {
  priorities: Priorities
  constraints: {
    irrigation_mm_per_year?: number
    equipment?: string[]
    exclude_crops?: string[]
    horizon_years: number
  }
  scenario: Scenario
  max_strategies?: number
}

export interface StrategyStep {
  year: number
  season: Season
  crop_id: string | null
  role: string
  plant?: string | null
  harvest?: string | null
}

export interface Strategy {
  id: string
  name: string
  is_current: boolean
  sequence: StrategyStep[]
  metrics: {
    water_demand_mm_per_year: number
    irrigation_need_mm_per_year: number
    n_balance_kg_ha_per_year: number
    om_trend: 'improving' | 'stable' | 'declining'
    erosion_t_ha_per_year?: number
    erosion_exposure_index?: number
    bare_soil_days_per_year: number
    pest_break_score: number
    gross_margin_index: number | null
  }
  scores: { low_labor?: number; save_water: number; income: number | null; soil_health: number; forage: number; pest_break: number; overall: number }
  why: string[]
  evidence: { claim: string; source_id: string | null }[]
  benefits: string[]
  gaps: string[]
  risks_local_review: string[]
  confidence: Confidence
}

export interface RotationResponse {
  scenario: Scenario & Partial<ScenarioApplied>
  strategies: Strategy[]
  recommended_id: string
  disclaimer: string
}

// ---------- Invernadero ----------
export interface GreenhouseReport {
  confidence?: Confidence
  gaps?: Gap[]
  wind: {
    structure_rated_kmh: number | null
    years_used?: number
    daily_origin?: string | null
    gust_factor_assumed?: number
    return_levels_kmh: { return_period_years: number; estimated_gust_kmh: number | null }[] | null
    annual_exceedance_probability: number | null
    status: Level | null
    riskiest_months: number[]
    source_id: string
    note: string
  }
  light: { by_month: { month: number; outdoor_dli: number; indoor_dli_est: number }[]; cover_transmission: number } | null
  temperature: { by_month: { month: number; heating_degree_hours_base12: number; hours_over_35c_outside: number }[] } | null
  co2: { ambient_ppm: number; source_id: string; typical_enrichment_target_ppm: [number, number]; note: string } | null
  hail: { level: 'low' | 'medium' | 'high'; evidence: Confidence; months_of_concern: number[] } | null
  recommendations: string[]
}

// ---------- Calidad de agua ----------
export interface WaterParam {
  code: string
  name: string
  value: number
  unit: string
  livestock: Level
  irrigation: Level
}

export interface WaterQualityReport {
  station: { name: string; source_id: string; distance_km: number; last_sample: string; type: string }
  parameters: WaterParam[]
  livestock_summary: { status: Level; message: string }
  irrigation_summary: { status: Level; ec_ds_m: number; sar: number; message: string }
  recommendations: string[]
  gaps: Gap[]
}

// ---------- Rendimiento ----------
export interface YieldPrediction {
  crop_id: string
  unit: string
  p10: number
  p50: number
  p90: number
  regional_reference: { value: number; source_id: string; level: string; years: [number, number] } | null
  drivers: { feature: string; effect: 'positive' | 'negative'; weight: number }[]
  model: { name: string; version: string; cv_mae: number; interval_coverage: number }
  confidence: Confidence
}

// ---------- Chat ----------
export type ChatEvent =
  | { type: 'status'; state: 'thinking'; label?: string }
  | { type: 'tool'; name: string; state: 'running' | 'done' | 'failed'; label?: string }
  | { type: 'text'; delta: string }
  | { type: 'citation'; source_id: string; label: string }
  | { type: 'card'; card: 'suitability' | 'suitability_matrix' | 'rotations' | 'greenhouse' | 'water'; payload: unknown }
  | { type: 'done'; message_id: string; usage?: { input_tokens: number; output_tokens: number } }
  | { type: 'error'; code: string; message: string }

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  tools?: { name: string; label?: string; state: 'running' | 'done' | 'failed' }[]
  citations?: { source_id: string; label: string }[]
}

export interface ConversationHistory {
  conversation_id: string
  field_id: string | null
  messages: { role: string; text: string; cards: { type: string; payload: unknown }[]; citations: { source_id: string; label: string }[]; status: string | null; message_id: string | null; created_at: string }[]
}
