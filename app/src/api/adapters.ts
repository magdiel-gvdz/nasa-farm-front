import type { BackendSchemas as B } from './backend'
import type { Crop, CropCategory, Field, FieldProfile, GreenhouseReport, SoilLab, SoilReportExtraction, Source } from './types'

// Presentation only. All agronomic values and available IDs come from /crops.
const PRESENTATION: Record<string, { emoji: string; category: CropCategory }> = {
  maiz: { emoji: '🌽', category: 'grain' }, sorgo: { emoji: '🌾', category: 'grain' },
  trigo: { emoji: '🌾', category: 'grain' }, cebada: { emoji: '🌾', category: 'grain' },
  avena_forrajera: { emoji: '🌾', category: 'forage' }, triticale: { emoji: '🌾', category: 'forage' },
  frijol: { emoji: '🫘', category: 'legume' }, garbanzo: { emoji: '🫘', category: 'legume' },
  veza: { emoji: '☘️', category: 'legume' }, algodon: { emoji: '🌱', category: 'industrial' },
  girasol: { emoji: '🌻', category: 'oilseed' }, melon: { emoji: '🍈', category: 'vegetable' },
  chile: { emoji: '🌶️', category: 'vegetable' }, papa: { emoji: '🥔', category: 'vegetable' },
}

export function cropFromBackend(c: B['Crop']): Crop {
  return { ...c, ...(PRESENTATION[c.id] ?? { emoji: '🌱', category: c.roles.includes('forage') ? 'forage' as const : c.roles.includes('legume') ? 'legume' as const : 'grain' as const }),
    aliases: [], perennial: false, greenhouse_ok: false, salt_threshold_ds_m: null,
    chill_hours: null, sensitive_month: null, years_to_first_harvest: null, harvest_months: null, plant_months: null }
}

export const sourceFromBackend = (s: B['Source']): Source => ({ ...s, dataset: s.name, provider: s.organization })
export function fieldFromBackend(f: B['Field']): Field {
  return { ...f, geometry: f.geometry as Field['geometry'], current_rotation: f.current_rotation ?? undefined,
    irrigation: f.irrigation ? { available: f.irrigation.available, source: f.irrigation.source ?? undefined, max_mm_per_year: f.irrigation.max_mm_per_year ?? undefined } : undefined,
    greenhouse: f.greenhouse ? { ...f.greenhouse, rated_wind_kmh: f.greenhouse.rated_wind_kmh ?? null, heated: f.greenhouse.heated ?? false, co2_enrichment: f.greenhouse.co2_enrichment ?? false } : undefined }
}

export function labFromBackend(raw: Record<string, unknown> | null): SoilLab | null {
  if (!raw) return null
  const number = (key: string) => typeof raw[key] === 'number' ? raw[key] as number : null
  return { lab_name: typeof raw.lab === 'string' ? raw.lab : undefined, sample_date: typeof raw.sample_date === 'string' ? raw.sample_date : undefined,
    depth_label: typeof raw.depth_cm === 'string' ? raw.depth_cm : null, texture: typeof raw.texture === 'string' ? raw.texture : null,
    source_id: 'lab_report', ph: number('ph'), om_pct: number('om_pct'), ec_ds_m: number('ec_ds_m'), cec_cmol_kg: number('cec_cmol_kg'),
    // mg/kg and ppm are numerically equivalent for these soil mass concentrations.
    n_ppm: number('n_mg_kg'), p_ppm: number('p_mg_kg'), k_ppm: number('k_mg_kg') }
}

export function profileFromBackend(p: B['FieldProfile']): FieldProfile {
  const c = p.climate
  return { ...p, sources: p.sources.map(sourceFromBackend), soil: p.soil ? { ...p.soil, lab: labFromBackend(p.soil.lab) } : null,
    climate: { ...c, frost: { ...c.frost, risk_threshold_c: c.frost.severe_threshold_c,
      by_month: c.frost.by_month.map((m) => ({ ...m, mean_frost_risk_days: m.mean_severe_frost_days })) },
      rain: { ...c.rain, wet_day_p95_mm: null, days_per_year_over_25mm: null, days_per_year_over_50mm: null },
      heat: { ...c.heat, by_month: c.heat.by_month.map((m) => ({ ...m, mean_days_over_40c: null })) },
      risk_calendar: c.risk_calendar },
  }
}

export function soilReportFromBackend(r: B['SoilReportResult']): SoilReportExtraction {
  return { extracted: labFromBackend(r.extracted) ?? {}, applied: r.applied,
    unreadable_fields: r.unreadable_fields.map((v) => v.field), unreadable_reasons: r.unreadable_fields }
}

export function greenhouseFromBackend(g: B['GreenhouseAssessment']): GreenhouseReport {
  return { ...g, wind: { ...g.wind, structure_rated_kmh: g.wind.rated_wind_kmh }, light: null, temperature: null, co2: null, hail: null }
}
