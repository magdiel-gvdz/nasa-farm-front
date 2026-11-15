// Motor de rotaciones (§7.3): candidatos + simulación simple de 3–5 años +
// puntaje según prioridades del agricultor + textos explicativos.

import type { CropRole, Field, FieldProfile, Priorities, RotationRequest, RotationResponse, Season, Strategy, StrategyStep } from '../types.ts'
import { cycleDemand, doyToLabel, MID_DOY } from './agro.ts'
import { AGRO, CROP_BY_ID } from './crops.ts'
import { evaluateCrop, type SuitContext } from './suitability.ts'

type YearPlan = [string | null, string | null] // [primavera-verano, otoño-invierno]

interface Template {
  id: string
  name: string
  years: YearPlan[]
  why: string
}

const TEMPLATES: Template[] = [
  { id: 'legume_cover', name: 'Legume cover crop', years: [['maiz', 'veza'], ['frijol', 'avena']], why: 'Cover the soil in winter with vetch, which also provides nitrogen to the next crop.' },
  { id: 'water_saver', name: 'Water saving', years: [['sorgo', null], ['girasol', null]], why: 'Change corn for drought-tolerant crops and let it rest in winter: less irrigation, although the soil remains uncovered for longer.' },
  { id: 'forage', name: 'Forage for livestock', years: [['sorgo', 'avena'], ['alfalfa', 'alfalfa'], ['alfalfa', 'alfalfa']], why: 'Produces forage all year round and alfalfa improves the soil for several years.' },
  { id: 'deep_root', name: 'Deep roots and diversity', years: [['girasol', 'triticale'], ['frijol', 'cartamo']], why: 'Deep roots that break compaction and distinct families that cut the pest cycle.' },
  { id: 'high_value', name: 'Higher value vegetables', years: [['calabaza', 'cebolla'], ['frijol', 'avena']], why: 'Look for more income per hectare with vegetables, alternating with crops that rest the soil.' },
]

const ROLE_ORDER: CropRole[] = ['legume', 'cover', 'forage', 'deep_root', 'drought_tolerant', 'cash']

function seasonMonths(season: Season, lat: number) {
  const north = season === 'spring_summer' ? [3, 4, 5, 6] : [9, 10, 11, 12]
  return lat >= 0 ? north : north.map((m) => ((m + 5) % 12) + 1)
}

function bestMonth(cropId: string, season: Season, ctx: SuitContext) {
  const crop = CROP_BY_ID.get(cropId)!
  const months = crop.perennial
    ? [ctx.model.lat >= 0 ? (crop.plant_months?.[0] ?? 2) : (((crop.plant_months?.[0] ?? 2) + 5) % 12) + 1]
    : cropId === 'alfalfa'
      ? [season === 'spring_summer' ? (ctx.model.lat >= 0 ? 3 : 9) : 10]
      : seasonMonths(season, ctx.model.lat)
  return months.map((m) => evaluateCrop(crop, m, ctx)).reduce((a, b) => (b.score > a.score ? b : a))
}

function buildSequence(years: YearPlan[], horizon: number): { year: number; season: Season; crop_id: string | null }[] {
  const out: { year: number; season: Season; crop_id: string | null }[] = []
  for (let y = 0; y < horizon; y++) {
    const plan = years[y % years.length]
    out.push({ year: y + 1, season: 'spring_summer', crop_id: plan[0] })
    out.push({ year: y + 1, season: 'fall_winter', crop_id: plan[1] })
  }
  return out
}

function primaryRole(cropId: string | null): CropRole | 'bare' {
  if (!cropId) return 'bare'
  const roles = CROP_BY_ID.get(cropId)!.roles
  return ROLE_ORDER.find((r) => roles.includes(r)) ?? 'cash'
}

interface Sim {
  strategy: Omit<Strategy, 'scores' | 'why' | 'evidence' | 'benefits' | 'gaps' | 'risks_local_review' | 'confidence' | 'name' | 'id' | 'is_current'>
  suitAvg: number
  warnings: string[]
  forage: number
  labor: number
}

function simulate(seq: ReturnType<typeof buildSequence>, ctx: SuitContext, profile: FieldProfile, horizon: number): Sim {
  let demand = 0
  let irrigation = 0
  let nBal = 0
  let residue = 0
  let cropDays = 0
  let cWeighted = 0
  let value = 0
  let forage = 0
  let labor = 0
  let suit = 0
  let nCrops = 0
  const warnings: string[] = []
  const steps: StrategyStep[] = []

  for (let i = 0; i < seq.length; i++) {
    const s = seq[i]
    const prev = seq[i - 1]
    // Alfalfa en ambas temporadas del mismo año se modela como un ciclo anual.
    // Igual para perennes (huerta, viñedo): un solo ciclo de 365 días por año.
    const longCrop = s.crop_id === 'alfalfa' || !!(s.crop_id && CROP_BY_ID.get(s.crop_id)?.perennial)
    const isAlfalfaContinuation = longCrop && s.season === 'fall_winter' && prev?.crop_id === s.crop_id && prev.year === s.year
    if (!s.crop_id) {
      nBal -= 10
      residue -= 2
      steps.push({ ...s, role: 'bare' })
      continue
    }
    const crop = CROP_BY_ID.get(s.crop_id)!
    const agro = AGRO[crop.id]
    const best = bestMonth(crop.id, s.season, ctx)
    steps.push({ ...s, role: primaryRole(crop.id), plant: doyToLabel(MID_DOY[best.planting_month - 1]), harvest: best.harvest_window.to })
    if (isAlfalfaContinuation) continue
    const cycle = crop.perennial || (crop.id === 'alfalfa' && prev?.crop_id !== 'alfalfa' && seq[i + 1]?.crop_id === 'alfalfa') ? 365 : (crop.cycle_days[0] + crop.cycle_days[1]) / 2
    const w = cycleDemand(ctx.model, best.planting_month, cycle, crop.kc)
    demand += w.demand
    irrigation += Math.max(0, w.demand - w.effectiveRain)
    nBal += cycle >= 365 ? agro.n_kg_ha * 1.5 : agro.n_kg_ha
    residue += cycle >= 365 ? agro.residue * 1.5 : agro.residue
    cropDays += Math.min(cycle, 365)
    cWeighted += agro.c_factor * Math.min(cycle, 365)
    value += agro.value_index * (best.score / 100)
    forage += agro.forage
    labor += agro.labor
    suit += best.score
    nCrops++
    for (const r of best.reasons) if (r.status !== 'ok') warnings.push(`${crop.name.en}: ${r.detail}`)
  }

  const years = horizon
  const bareDays = Math.max(0, 365 - cropDays / years)
  const cAvg = (cWeighted / years + 0.9 * bareDays) / 365
  const annualRain = profile.climate.rain.annual_mean_mm ?? 400
  const k = profile.soil.k_factor ?? 0.03
  const slope = profile.terrain.slope_pct.mean
  const erosion = 0.6 * (annualRain / 400) * (k / 0.03) * (1 + slope / 2) * cAvg * 10
  const families = seq.filter((s) => s.crop_id).map((s) => CROP_BY_ID.get(s.crop_id!)!.family)
  let repeats = 0
  for (let i = 1; i < families.length; i++) if (families[i] === families[i - 1] && families[i] !== 'fabaceae') repeats++
  const pestBreak = Math.max(0, Math.min(5, (new Set(families).size / Math.max(1, families.length)) * 6 - repeats))
  const residuePerYear = residue / years

  return {
    strategy: {
      sequence: steps,
      metrics: {
        water_demand_mm_per_year: Math.round(demand / years),
        irrigation_need_mm_per_year: Math.round(irrigation / years),
        n_balance_kg_ha_per_year: Math.round(nBal / years),
        om_trend: residuePerYear > 1 ? 'improving' : residuePerYear < -0.5 ? 'declining' : 'stable',
        erosion_t_ha_per_year: Math.round(erosion * 10) / 10,
        bare_soil_days_per_year: Math.round(bareDays),
        pest_break_score: Math.round(pestBreak * 10) / 10,
        gross_margin_index: Math.round((value / Math.max(1, nCrops)) * 100) / 100,
      },
    },
    suitAvg: suit / Math.max(1, nCrops),
    warnings,
    forage: forage / Math.max(1, nCrops),
    labor: labor / Math.max(1, nCrops),
  }
}

const clamp5 = (x: number) => Math.round(Math.max(0, Math.min(5, x)) * 10) / 10

function score(sim: Sim, pri: Priorities) {
  const m = sim.strategy.metrics
  const residueScore = m.om_trend === 'improving' ? 5 : m.om_trend === 'stable' ? 3 : 1
  const soil = clamp5((residueScore + clamp5((m.n_balance_kg_ha_per_year + 120) / 45) + clamp5(5 - m.erosion_t_ha_per_year / 2) + clamp5(5 - m.bare_soil_days_per_year / 70)) / 4)
  const scores = {
    save_water: clamp5(5.5 - m.irrigation_need_mm_per_year / 180),
    income: clamp5((m.gross_margin_index / 0.75) * 5),
    soil_health: soil,
    forage: clamp5(sim.forage * 5),
    pest_break: clamp5(m.pest_break_score),
    overall: 0,
  }
  const lowLabor = clamp5((1 - sim.labor) * 6)
  const weights: [number, number][] = [
    [pri.save_water, scores.save_water],
    [pri.income, scores.income],
    [pri.soil_health, scores.soil_health],
    [pri.forage, scores.forage],
    [pri.pest_break, scores.pest_break],
    [pri.low_labor, lowLabor],
  ]
  const wsum = weights.reduce((a, [w]) => a + w, 0) || 1
  const weighted = weights.reduce((a, [w, s]) => a + w * s, 0) / wsum
  scores.overall = Math.round((weighted / 5) * 100 * Math.sqrt(Math.max(0.2, sim.suitAvg / 100)))
  return scores
}

const MONTH_ES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const dateEs = (mmdd?: string | null) => {
  if (!mmdd) return '—'
  const [m, d] = mmdd.split('-').map(Number)
  return `${d} ${MONTH_ES[m - 1]}`
}

export function compareRotations(field: Field, profile: FieldProfile, req: RotationRequest, ctx: SuitContext): RotationResponse {
  const horizon = req.constraints.horizon_years || 4
  const exclude = new Set(req.constraints.exclude_crops ?? [])
  const current = field.current_rotation?.length ? field.current_rotation : [{ year: 1, season: 'spring_summer' as Season, crop_id: 'maiz' }, { year: 1, season: 'fall_winter' as Season, crop_id: null }]
  const currentYears: YearPlan[] = []
  const nYears = Math.max(...current.map((s) => s.year))
  for (let y = 1; y <= nYears; y++) {
    currentYears.push([current.find((s) => s.year === y && s.season === 'spring_summer')?.crop_id ?? null, current.find((s) => s.year === y && s.season === 'fall_winter')?.crop_id ?? null])
  }

  const base = simulate(buildSequence(currentYears, horizon), ctx, profile, horizon)
  const fr = profile.climate.frost
  const rain = profile.climate.rain
  const rainyMonths = rain.rainy_months.map((m) => MONTH_ES[m - 1]).join(', ')
  const bare = profile.vegetation.bare_soil_months.map((m) => MONTH_ES[m - 1]).join(', ')

  const make = (id: string, name: string, isCurrent: boolean, sim: Sim, why: string): Strategy => {
    const m = sim.strategy.metrics
    const b = base.strategy.metrics
    const benefits: string[] = []
    const evidence: Strategy['evidence'] = [
      { claim: `Typical last frost: ${dateEs(fr.last_spring_frost.p50?.date)} (9 out of 10 years before ${dateEs(fr.last_spring_frost.p90?.date)})`, source_id: 'nasa_power' },
      { claim: `Average rain ${rain.annual_mean_mm} mm/year, concentrated in ${rainyMonths || 'a few months'}`, source_id: 'nasa_power' },
    ]
    if (bare) evidence.push({ claim: `The field is usually left without soil cover in ${bare}`, source_id: profile.vegetation.source_id })
    if (!isCurrent) {
      if (m.bare_soil_days_per_year < b.bare_soil_days_per_year - 20) benefits.push(`${b.bare_soil_days_per_year - m.bare_soil_days_per_year} fewer days of bare soil per year`)
      if (m.irrigation_need_mm_per_year < b.irrigation_need_mm_per_year - 30) benefits.push(`~${b.irrigation_need_mm_per_year - m.irrigation_need_mm_per_year} mm less irrigation per year`)
      if (m.n_balance_kg_ha_per_year > b.n_balance_kg_ha_per_year + 15) benefits.push(`+${m.n_balance_kg_ha_per_year - b.n_balance_kg_ha_per_year} kg/ha of nitrogen per year (less fertilizer)`)
      if (m.erosion_t_ha_per_year < b.erosion_t_ha_per_year - 0.5) benefits.push(`Erosion ${Math.round((1 - m.erosion_t_ha_per_year / Math.max(0.1, b.erosion_t_ha_per_year)) * 100)} % lower`)
      if (m.pest_break_score > b.pest_break_score + 0.5) benefits.push('Alternate crop families and cut the pest cycle')
      if (m.om_trend === 'improving' && b.om_trend !== 'improving') benefits.push('Soil organic matter tends to rise')
      if (m.gross_margin_index > b.gross_margin_index + 0.05) benefits.push('Higher expected income per hectare')
    } else {
      benefits.push('Crops, market and equipment you already know')
    }
    const gaps = [
      profile.soil.lab ? null : 'Without laboratory analysis of nitrogen, phosphorus and potassium',
      'Local prices and market access unverified',
      'Yields based on regional benchmarks, not your history',
    ].filter(Boolean) as string[]
    const risks = [...new Set(sim.warnings)].slice(0, 3)
    if (m.irrigation_need_mm_per_year > 250) risks.push(`Depends on ~${m.irrigation_need_mm_per_year} mm of irrigation per year if the rains fail`)
    if (!risks.length) risks.push('Validate sowing dates and varieties with your agronomist')
    return {
      id,
      name,
      is_current: isCurrent,
      ...sim.strategy,
      scores: score(sim, req.priorities),
      why: [why],
      evidence,
      benefits: benefits.length ? benefits : ['Similar to your current rotation on most indicators'],
      gaps,
      risks_local_review: risks,
      confidence: profile.soil.lab ? 'high' : 'medium',
    }
  }

  const currentName = currentYears
    .flat()
    .map((c) => (c ? CROP_BY_ID.get(c)?.name.en : 'fallow'))
    .filter((v, i, a) => a.indexOf(v) === i)
    .join(' – ')
  const strategies: Strategy[] = [make('current', `Your rotation: ${currentName}`, true, base, 'It is what you sow today; serves as a point of comparison.')]

  const candidates = TEMPLATES.filter((t) => !t.years.flat().some((c) => c && exclude.has(c)))
    .map((t) => ({ t, sim: simulate(buildSequence(t.years, horizon), ctx, profile, horizon) }))
    .filter(({ sim }) => sim.suitAvg >= 45)
    .map(({ t, sim }) => make(t.id, t.name, false, sim, t.why))
    .sort((a, b) => b.scores.overall - a.scores.overall)

  strategies.push(...candidates.slice(0, Math.max(2, (req.max_strategies ?? 4) - 1)))
  const recommended = strategies.reduce((a, b) => (b.scores.overall > a.scores.overall ? b : a))
  return {
    scenario: req.scenario,
    strategies,
    recommended_id: recommended.id,
    disclaimer: 'Support tool: validate dates, varieties and market with your local agronomist.',
  }
}
