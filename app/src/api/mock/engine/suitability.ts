// Motor de aptitud cultivo × mes de siembra (reglas explicables, §7.2).

import type { Crop, FieldProfile, Level, SuitabilityDetail, SuitabilityMatrix, SuitabilityReason, SuitStatus } from '../types.ts'
import { type ClimateModel, MID_DOY, chillHours, cycleDemand, cycleMonths, doyToLabel } from './agro.ts'
import { AGRO, CROPS } from './crops.ts'

export interface SuitContext {
  model: ClimateModel
  profile: Pick<FieldProfile, 'soil' | 'terrain'>
  irrigationMm: number // riego disponible por temporada
  protectedCrop?: boolean // invernadero
}

const MONTHS_ES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const mName = (m: number) => MONTHS_ES[m - 1]
const fmt = (x: number) => Math.round(x).toLocaleString('en-US')

export const statusFor = (score: number): SuitStatus => (score >= 70 ? 'suitable' : score >= 40 ? 'marginal' : 'unsuitable')

/** Días/año por encima de la temperatura crítica, interpolando entre >30 °C y >35 °C. */
function daysAbove(m: ClimateModel['months'][number], crit: number) {
  return crit <= 30 ? m.heat30 : crit >= 35 ? m.heat35 * Math.max(0.2, 1 - (crit - 35) * 0.25) : m.heat30 + (m.heat35 - m.heat30) * ((crit - 30) / 5)
}

/** Salinidad (análisis con CE, o mapa SSURGO en EE.UU.): pérdida de rendimiento tipo Maas-Hoffman (~10 % por dS/m sobre el umbral). */
function salinity(crop: Crop, ctx: SuitContext, add: (f: SuitabilityReason['factor'], s: Level, d: string, src: string, bad?: number, warn?: number) => void) {
  const labEc = ctx.profile.soil.lab?.ec_ds_m
  const mapEc = ctx.profile.soil.layers[0]?.ec_ds_m
  const ec = labEc ?? mapEc
  if (ec == null) return
  const thr = crop.salt_threshold_ds_m
  const loss = Math.max(0, Math.round((ec - thr) * 10))
  if (labEc == null) {
    // El mapa de suelos describe la condición natural; años de riego pueden haber lavado sales.
    if (ec <= thr) add('salinity', 'ok', `The soil map shows salinity of ${ec.toFixed(1)} dS/m, below what it tolerates (${thr} dS/m).`, ctx.profile.soil.source_id)
    else add('salinity', 'warn', `The soil map shows saline soil (${ec.toFixed(1)} dS/m vs ${thr} it tolerates). It is the natural condition: confirm it with an analysis, irrigation may have leached salts.`, ctx.profile.soil.source_id, 30, 15)
    return
  }
  if (ec <= thr) add('salinity', 'ok', `Soil salinity ${ec.toFixed(1)} dS/m, below what is tolerated (${thr} dS/m).`, 'lab_report')
  else if (loss <= 25) add('salinity', 'warn', `Salinity ${ec.toFixed(1)} dS/m above its limit (${thr}): loses ~${loss} % yield.`, 'lab_report', 30, 15)
  else add('salinity', 'bad', `Saline soil for this crop (${ec.toFixed(1)} vs ${thr} dS/m): loss of ~${Math.min(100, loss)} %.`, 'lab_report', 40)
}

function soilPh(crop: Crop, ctx: SuitContext, add: (f: SuitabilityReason['factor'], s: Level, d: string, src: string, bad?: number, warn?: number) => void) {
  const { profile } = ctx
  const ph = profile.soil.lab?.ph ?? profile.soil.layers[0]?.ph
  if (ph == null) return
  if (ph >= crop.ph[0] && ph <= crop.ph[1]) add('soil', 'ok', `soil pH ${ph.toFixed(1)}, suitable for cultivation.`, profile.soil.source_id)
  else if (ph >= crop.ph[0] - 0.5 && ph <= crop.ph[1] + 0.5) add('soil', 'warn', `pH ${ph.toFixed(1)} on the limit (ideal ${crop.ph[0]}–${crop.ph[1]}).`, profile.soil.source_id)
  else add('soil', 'bad', `pH ${ph.toFixed(1)} out of range (ideal ${crop.ph[0]}–${crop.ph[1]}).`, profile.soil.source_id, 30)
}

const shiftMonth = (m: number, lat: number) => (lat >= 0 ? m : ((m + 5) % 12) + 1)

/**
 * Perennes (frutales, vid, nueces, nopal, agave…): el mes es de PLANTACIÓN y
 * lo que importa es si el clima de todo el año les sirve: frío invernal extremo,
 * horas frío para florear, heladas en floración, calor de verano y agua anual.
 */
function evaluatePerennial(crop: Crop, plantMonth: number, ctx: SuitContext): SuitabilityDetail {
  const { model } = ctx
  const lat = model.lat
  const reasons: SuitabilityReason[] = []
  let score = 100
  const add = (factor: SuitabilityReason['factor'], status: Level, detail: string, source_id: string, bad = 40, warn = 15) => {
    reasons.push({ factor, status, detail, source_id })
    score -= status === 'bad' ? bad : status === 'warn' ? warn : 0
  }

  // 1. Frío del invierno
  const record = Math.min(...model.months.map((m) => m.recordTmin ?? m.tmin - 8))
  if (!crop.frost_tolerant) {
    const worst = model.months.reduce((a, b) => (b.frostProb > a.frostProb ? b : a))
    if (worst.frostProb > 0.3 || record < crop.temp_abs_c[0] - 2) add('frost', 'bad', `Does not tolerate frost and in ${mName(worst.month)} freezes ${yrs(worst.frostProb)} (record low ${record.toFixed(0)} °C).`, 'nasa_power', 55)
    else if (worst.frostProb > 0.05 || record < crop.temp_abs_c[0]) add('frost', 'warn', `Occasional frost (record low ${record.toFixed(0)} °C): The young tree needs protection.`, 'nasa_power', 55, 25)
    else add('frost', 'ok', 'Winters without harmful frosts.', 'nasa_power')
  } else if (record < crop.temp_abs_c[0]) add('frost', 'bad', `Record low ${record.toFixed(0)} °C, colder than it can withstand (${crop.temp_abs_c[0]} °C).`, 'nasa_power', 45)
  else add('frost', 'ok', `Resist the winter: the record low is ${record.toFixed(0)} °C (holds up to ${crop.temp_abs_c[0]} °C).`, 'nasa_power')

  // 2. Horas frío (caducifolios)
  let chill: number | null = null
  if (crop.chill_hours) {
    chill = chillHours(model)
    const [low, trad] = crop.chill_hours
    if (chill >= trad) add('chill', 'ok', `~${fmt(chill)} winter chill hours: enough for traditional varieties (≥${fmt(trad)}).`, 'nasa_power')
    else if (chill >= low) add('chill', 'warn', `~${fmt(chill)} chill hours: only low requirement varieties (${fmt(low)}–${fmt(trad)} h).`, 'nasa_power', 45, 18)
    else add('chill', 'bad', `~${fmt(chill)} chill hours; even low-chill varieties cannot (≥${fmt(low)} h) complete their rest: irregular budding and flowering.`, 'nasa_power', 45)
  }

  // 3. Helada en floración / brotación
  if (crop.sensitive_month && !ctx.protectedCrop) {
    const bm = shiftMonth(crop.sensitive_month, lat)
    const p = model.months[bm - 1].frostProb
    if (p > 0.3) add('bloom', 'bad', `Flowering falls on ${mName(bm)} and frost occurs ${yrs(p)}: The harvest may be lost.`, 'nasa_power', 35)
    else if (p > 0.1) add('bloom', 'warn', `Late frost in flowering (${mName(bm)}) ${yrs(p)}: consider late varieties or protection.`, 'nasa_power', 35, 15)
    else add('bloom', 'ok', `Flowering in ${mName(bm)} with little risk of frost.`, 'nasa_power')
  }

  // 4. Temperatura de la temporada de crecimiento
  // Temporada de crecimiento = los 6 meses más cálidos.
  const growing = [...model.months].sort((a, b) => b.tmax + b.tmin - (a.tmax + a.tmin)).slice(0, 6)
  const tGrow = growing.reduce((a, b) => a + (b.tmax + b.tmin) / 2, 0) / growing.length
  if (tGrow >= crop.temp_opt_c[0] && tGrow <= crop.temp_opt_c[1]) add('season', 'ok', `Average growing season temperature: ${tGrow.toFixed(0)} °C, within its ideal range.`, 'nasa_power')
  else if (tGrow >= crop.temp_opt_c[0] - 4 && tGrow <= crop.temp_opt_c[1] + 4) add('season', 'warn', `Season of ${tGrow.toFixed(0)} °C, outside its ideal range (${crop.temp_opt_c[0]}–${crop.temp_opt_c[1]} °C).`, 'nasa_power', 30, 15)
  else add('season', 'bad', `Season of ${tGrow.toFixed(0)} °C: too far from its range (${crop.temp_opt_c[0]}–${crop.temp_opt_c[1]} °C).`, 'nasa_power', 45)

  // 5. Calor de verano
  const hottest = model.months.reduce((a, b) => (daysAbove(b, crop.heat_critical_c) > daysAbove(a, crop.heat_critical_c) ? b : a))
  const hot = daysAbove(hottest, crop.heat_critical_c)
  if (hot > 12) add('heat', 'bad', `~${hot.toFixed(0)} days in ${mName(hottest.month)} above ${crop.heat_critical_c} °C: sunburn on fruit and tree stress.`, 'nasa_power', 30)
  else if (hot > 4) add('heat', 'warn', `~${hot.toFixed(0)} days in ${mName(hottest.month)} above ${crop.heat_critical_c} °C: can burn fruit or lower quality.`, 'nasa_power')
  else add('heat', 'ok', 'Summers without excessive heat for cultivation.', 'nasa_power')

  // 6. Agua del año completo
  let demand = 0
  let rain = 0
  for (const m of model.months) {
    const active = (m.tmax + m.tmin) / 2 >= (crop.chill_hours ? 10 : 6)
    demand += m.et0 * (active ? crop.kc.mid : crop.kc.ini * 0.6)
    rain += m.rain
  }
  const eff = rain * 0.75
  const deficit = demand - eff
  const irr = ctx.irrigationMm * 2
  if (deficit <= 50) add('water', 'ok', `The rain (${fmt(rain)} mm/year) covers almost all of its demand (${fmt(demand)} mm/year).`, 'nasa_power')
  else if (deficit <= irr) add('water', 'warn', `Need ~${fmt(deficit)} mm/year of irrigation (demand ${fmt(demand)} mm vs ${fmt(eff)} mm of useful rain).`, 'nasa_power', 30, 10)
  else if (irr > 0 && deficit <= irr * 1.5) add('water', 'warn', `Limited irrigation: needs ~${fmt(deficit)} mm/year and you have ~${fmt(irr)} mm.`, 'nasa_power', 30, 25)
  else add('water', 'bad', irr > 0 ? `Missing ~${fmt(deficit)} mm/year of water and the available irrigation is ${fmt(irr)} mm.` : `Without irrigation, the water deficit is ~${fmt(deficit)} mm/year: not viable under rainfed conditions.`, 'nasa_power', 42)

  // 7. Suelo, salinidad y terreno
  soilPh(crop, ctx, add)
  salinity(crop, ctx, add)

  // 8. Mes de plantación
  const plantOk = (crop.plant_months ?? []).map((m) => shiftMonth(m, lat))
  if (plantOk.length && !plantOk.includes(plantMonth)) add('planting', 'warn', `Best to plant in ${plantOk.map(mName).join(', ')}${crop.chill_hours ? ' (dormant tree, bare root)' : ''}.`, 'nasa_power', 15, 12)
  else if (plantOk.length) add('planting', 'ok', `Good time to plant${crop.chill_hours ? ': The tree is at rest' : ''}.`, 'nasa_power')

  score = Math.max(0, Math.min(100, Math.round(score)))
  const hm = (crop.harvest_months ?? [1, 12]).map((m) => shiftMonth(m, lat)) as [number, number]
  return {
    crop_id: crop.id,
    planting_month: plantMonth,
    status: statusFor(score),
    score,
    harvest_window: { from: `${String(hm[0]).padStart(2, '0')}-01`, to: `${String(hm[1]).padStart(2, '0')}-28` },
    reasons,
    confidence: ctx.profile.soil.lab ? 'medium' : 'low',
    perennial: { years_to_first_harvest: crop.years_to_first_harvest ?? 1, harvest_months: hm, chill_hours_est: chill },
  }
}

export function evaluateCrop(crop: Crop, plantMonth: number, ctx: SuitContext): SuitabilityDetail {
  if (crop.perennial) return evaluatePerennial(crop, plantMonth, ctx)
  const { model, profile } = ctx
  const cycle = (crop.cycle_days[0] + crop.cycle_days[1]) / 2
  const months = cycleMonths(plantMonth, cycle)
  const mc = months.map((m) => model.months[m - 1])
  const reasons: SuitabilityReason[] = []
  let score = 100
  const add = (factor: SuitabilityReason['factor'], status: Level, detail: string, source_id: string, bad = 40, warn = 15) => {
    reasons.push({ factor, status, detail, source_id })
    score -= status === 'bad' ? bad : status === 'warn' ? warn : 0
  }

  // Heladas: con fechas de última/primera helada (hemisferio norte, campo abierto);
  // si no, con la probabilidad mensual.
  const plantDoy = MID_DOY[plantMonth - 1]
  const harvestDoy = plantDoy + cycle
  const { lastFrostP50: l50, lastFrostP90: l90, firstFrostP10: f10, firstFrostP50: f50 } = model
  const useDates = !crop.frost_tolerant && !ctx.protectedCrop && model.lat >= 0 && l50 != null && l90 != null && f10 != null && f50 != null
  if (useDates) {
    if (plantDoy >= l90! && harvestDoy <= f10!) add('frost', 'ok', `Planting in mid-${mName(plantMonth)} the cycle avoids frost in 9 out of 10 years (last: ${label(l90!)}, first: ${label(f10!)}).`, 'nasa_power')
    else if (plantDoy >= l50! && harvestDoy <= f50!)
      add('frost', 'warn', plantDoy < l90! ? `Sowing before ${label(l90!)}: 1 to 5 out of every 10 years it still freezes afterwards.` : `The harvest arrives close to the first frost (${label(f10!)} in early years).`, 'nasa_power', 55)
    else add('frost', 'bad', plantDoy < l50! ? `It is planted before the last typical frost (${label(l50!)}): high risk of losing the crop.` : `The cycle does not end before the autumn frosts (${label(f50!)}).`, 'nasa_power', 60)
  } else if (!crop.frost_tolerant) {
    const worst = mc.reduce((a, b) => (b.frostProb > a.frostProb ? b : a))
    if (worst.frostProb <= 0.08) {
      const lf = model.lastFrostP90
      add('frost', 'ok', lf && model.lat >= 0 ? `The cycle avoids frost: the last one usually falls before ${label(lf)} (9 out of 10 years).` : 'No probable frost during the cycle.', 'nasa_power')
    } else if (worst.frostProb <= 0.3) {
      add('frost', 'warn', `In ${mName(worst.month)} there is frost ${yrs(worst.frostProb)}; the crop does not tolerate it.`, 'nasa_power', 55)
    } else {
      add('frost', 'bad', `Frost in ${mName(worst.month)} ${yrs(worst.frostProb)}: high risk of losing the crop.`, 'nasa_power', 60)
    }
  } else {
    const coldest = mc.reduce((a, b) => (b.tmin < a.tmin ? b : a))
    if (coldest.tmin < crop.temp_abs_c[0]) add('frost', 'bad', `Minimum ${coldest.tmin.toFixed(1)} °C in ${mName(coldest.month)}, below what resists.`, 'nasa_power')
    else if (coldest.tmin < crop.temp_abs_c[0] + 4) add('frost', 'warn', `Intense cold in ${mName(coldest.month)} (${coldest.tmin.toFixed(1)} °C); It tolerates frost but can be delayed.`, 'nasa_power')
    else add('frost', 'ok', 'Resists the typical frosts of the area.', 'nasa_power')
  }

  // Temperatura del ciclo
  const tCycle = mc.reduce((a, b) => a + (b.tmax + b.tmin) / 2, 0) / mc.length
  if (tCycle >= crop.temp_opt_c[0] && tCycle <= crop.temp_opt_c[1]) add('season', 'ok', `Average temperature of the cycle ${tCycle.toFixed(0)} °C, within its ideal range.`, 'nasa_power')
  else if (tCycle >= crop.temp_abs_c[0] && tCycle <= crop.temp_abs_c[1]) add('season', 'warn', `Average temperature of ${tCycle.toFixed(0)} °C, outside its ideal range (${crop.temp_opt_c[0]}–${crop.temp_opt_c[1]} °C).`, 'nasa_power', 30, 20)
  else add('season', 'bad', `Average temperature of ${tCycle.toFixed(0)} °C: the crop does not prosper.`, 'nasa_power', 50)

  // Calor en floración
  const flower = model.months[cycleMonths(plantMonth, cycle * 0.6).at(-1)! - 1]
  const crit = crop.heat_critical_c
  const hotDays = daysAbove(flower, crit)
  if (hotDays > 12) add('heat', 'bad', `Flowering falls on ${mName(flower.month)}, with ~${hotDays.toFixed(0)} days/year above ${crit} °C.`, 'nasa_power', 35)
  else if (hotDays > 4) add('heat', 'warn', `Flowering in ${mName(flower.month)}: ~${hotDays.toFixed(0)} days/year above ${crit} °C, which may affect fruit or grain set.`, 'nasa_power')
  else add('heat', 'ok', `Flowering in ${mName(flower.month)} without frequent heat waves.`, 'nasa_power')

  // Agua
  const w = cycleDemand(model, plantMonth, cycle, crop.kc)
  const deficit = w.demand - w.effectiveRain
  // Cultivos de ciclo largo (alfalfa) reciben el riego de más de una temporada.
  const irr = ctx.irrigationMm * Math.max(1, cycle / 182)
  if (deficit <= 30) add('water', 'ok', `The rain (${fmt(w.rain)} mm) covers almost all the crop demand (${fmt(w.demand)} mm).`, 'nasa_power')
  else if (deficit <= irr) add('water', 'warn', `Need ~${fmt(deficit)} mm irrigation: demand ${fmt(w.demand)} mm vs ${fmt(w.effectiveRain)} mm of useful rain.`, 'nasa_power', 30, 10)
  else if (irr > 0 && deficit <= irr * 1.6) add('water', 'warn', `Limited irrigation: needs ~${fmt(deficit)} mm and you have ~${fmt(irr)} mm for this cycle.`, 'nasa_power', 30, 25)
  else add('water', 'bad', irr > 0 ? `Missing ~${fmt(deficit)} mm of water and irrigation available is ${fmt(irr)} mm.` : `Without irrigation, the water deficit is ~${fmt(deficit)} mm of water: very risky under rainfed conditions.`, 'nasa_power', 42)

  // Suelo
  soilPh(crop, ctx, add)
  salinity(crop, ctx, add)

  // Terreno
  const slope = profile.terrain.slope_pct.p90
  if (slope > 8 && (AGRO[crop.id]?.c_factor ?? 0.3) >= 0.4) add('terrain', 'warn', `Earrings up to ${slope.toFixed(0)} %: the soil is exposed to erosion with this crop.`, profile.terrain.source_id)

  score = Math.max(0, Math.min(100, Math.round(score)))
  return {
    crop_id: crop.id,
    planting_month: plantMonth,
    status: statusFor(score),
    score,
    harvest_window: { from: doyToLabel(plantDoy + crop.cycle_days[0]), to: doyToLabel(plantDoy + crop.cycle_days[1]) },
    reasons,
    confidence: profile.soil.lab ? 'high' : 'medium',
  }
}

export function suitabilityMatrix(ctx: SuitContext, crops: Crop[] = CROPS): SuitabilityMatrix {
  const months = Array.from({ length: 12 }, (_, i) => i + 1)
  return {
    months,
    crops: crops.map((c) => {
      const det = months.map((m) => evaluateCrop(c, m, ctx))
      return { crop_id: c.id, scores: det.map((d) => d.score), status: det.map((d) => d.status) }
    }),
  }
}

function label(doy: number) {
  const [mm, dd] = doyToLabel(doy).split('-').map(Number)
  return `${dd} of ${['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][mm - 1]}`
}

/** "3 out of 10 years" / "almost every year". */
function yrs(p: number) {
  const n = Math.round(p * 10)
  return n >= 10 ? 'almost every year' : n <= 0 ? 'very few years' : `${n} out of 10 years`
}
