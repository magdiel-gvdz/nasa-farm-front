// Motor de aptitud cultivo × mes de siembra (reglas explicables, §7.2).

import type { Crop, FieldProfile, Level, SuitabilityDetail, SuitabilityMatrix, SuitabilityReason, SuitStatus } from '../../types.ts'
import { type ClimateModel, MID_DOY, chillHours, cycleDemand, cycleMonths, doyToLabel } from './agro.ts'
import { AGRO, CROPS } from './crops.ts'

export interface SuitContext {
  model: ClimateModel
  profile: Pick<FieldProfile, 'soil' | 'terrain'>
  irrigationMm: number // riego disponible por temporada
  protectedCrop?: boolean // invernadero
}

const MONTHS_ES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const mName = (m: number) => MONTHS_ES[m - 1]
const fmt = (x: number) => Math.round(x).toLocaleString('es-MX')

export const statusFor = (score: number): SuitStatus => (score >= 70 ? 'suitable' : score >= 40 ? 'marginal' : 'unsuitable')

/** Días/año por encima de la temperatura crítica, interpolando entre >30 °C y >35 °C. */
function daysAbove(m: ClimateModel['months'][number], crit: number) {
  return crit <= 30 ? m.heat30 : crit >= 35 ? m.heat35 * Math.max(0.2, 1 - (crit - 35) * 0.25) : m.heat30 + (m.heat35 - m.heat30) * ((crit - 30) / 5)
}

/** Salinidad (solo si hay análisis con CE): pérdida de rendimiento tipo Maas-Hoffman (~10 % por dS/m sobre el umbral). */
function salinity(crop: Crop, ctx: SuitContext, add: (f: SuitabilityReason['factor'], s: Level, d: string, src: string, bad?: number, warn?: number) => void) {
  const ec = ctx.profile.soil.lab?.ec_ds_m
  if (ec == null) return
  const thr = crop.salt_threshold_ds_m
  const loss = Math.max(0, Math.round((ec - thr) * 10))
  if (ec <= thr) add('salinity', 'ok', `Salinidad del suelo ${ec.toFixed(1)} dS/m, debajo de lo que tolera (${thr} dS/m).`, 'lab_report')
  else if (loss <= 25) add('salinity', 'warn', `Salinidad ${ec.toFixed(1)} dS/m sobre su límite (${thr}): pierde ~${loss} % de rendimiento.`, 'lab_report', 30, 15)
  else add('salinity', 'bad', `Suelo salino para este cultivo (${ec.toFixed(1)} vs ${thr} dS/m): pérdida de ~${Math.min(100, loss)} %.`, 'lab_report', 40)
}

function soilPh(crop: Crop, ctx: SuitContext, add: (f: SuitabilityReason['factor'], s: Level, d: string, src: string, bad?: number, warn?: number) => void) {
  const { profile } = ctx
  const ph = profile.soil.lab?.ph ?? profile.soil.layers[0]?.ph
  if (ph == null) return
  if (ph >= crop.ph[0] && ph <= crop.ph[1]) add('soil', 'ok', `pH del suelo ${ph.toFixed(1)}, adecuado para el cultivo.`, profile.soil.source_id)
  else if (ph >= crop.ph[0] - 0.5 && ph <= crop.ph[1] + 0.5) add('soil', 'warn', `pH ${ph.toFixed(1)} en el límite (ideal ${crop.ph[0]}–${crop.ph[1]}).`, profile.soil.source_id)
  else add('soil', 'bad', `pH ${ph.toFixed(1)} fuera de rango (ideal ${crop.ph[0]}–${crop.ph[1]}).`, profile.soil.source_id, 30)
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
    if (worst.frostProb > 0.3 || record < crop.temp_abs_c[0] - 2) add('frost', 'bad', `No tolera heladas y en ${mName(worst.month)} hiela ${yrs(worst.frostProb)} (mínima récord ${record.toFixed(0)} °C).`, 'nasa_power', 55)
    else if (worst.frostProb > 0.05 || record < crop.temp_abs_c[0]) add('frost', 'warn', `Heladas ocasionales (mínima récord ${record.toFixed(0)} °C): el árbol joven necesita protección.`, 'nasa_power', 55, 25)
    else add('frost', 'ok', 'Inviernos sin heladas dañinas.', 'nasa_power')
  } else if (record < crop.temp_abs_c[0]) add('frost', 'bad', `Mínima récord de ${record.toFixed(0)} °C, más fría de lo que resiste (${crop.temp_abs_c[0]} °C).`, 'nasa_power', 45)
  else add('frost', 'ok', `Resiste el invierno: la mínima récord es ${record.toFixed(0)} °C (aguanta hasta ${crop.temp_abs_c[0]} °C).`, 'nasa_power')

  // 2. Horas frío (caducifolios)
  let chill: number | null = null
  if (crop.chill_hours) {
    chill = chillHours(model)
    const [low, trad] = crop.chill_hours
    if (chill >= trad) add('chill', 'ok', `~${fmt(chill)} horas frío por invierno: alcanzan para variedades tradicionales (≥${fmt(trad)}).`, 'nasa_power')
    else if (chill >= low) add('chill', 'warn', `~${fmt(chill)} horas frío: solo variedades de bajo requerimiento (${fmt(low)}–${fmt(trad)} h).`, 'nasa_power', 45, 18)
    else add('chill', 'bad', `~${fmt(chill)} horas frío; ni las variedades de bajo frío (≥${fmt(low)} h) completan su reposo: brotación y floración irregulares.`, 'nasa_power', 45)
  }

  // 3. Helada en floración / brotación
  if (crop.sensitive_month && !ctx.protectedCrop) {
    const bm = shiftMonth(crop.sensitive_month, lat)
    const p = model.months[bm - 1].frostProb
    if (p > 0.3) add('bloom', 'bad', `La floración cae en ${mName(bm)} y ahí hiela ${yrs(p)}: se puede perder la cosecha.`, 'nasa_power', 35)
    else if (p > 0.1) add('bloom', 'warn', `Helada tardía en floración (${mName(bm)}) ${yrs(p)}: considera variedades tardías o protección.`, 'nasa_power', 35, 15)
    else add('bloom', 'ok', `Floración en ${mName(bm)} con poco riesgo de helada.`, 'nasa_power')
  }

  // 4. Temperatura de la temporada de crecimiento
  // Temporada de crecimiento = los 6 meses más cálidos.
  const growing = [...model.months].sort((a, b) => b.tmax + b.tmin - (a.tmax + a.tmin)).slice(0, 6)
  const tGrow = growing.reduce((a, b) => a + (b.tmax + b.tmin) / 2, 0) / growing.length
  if (tGrow >= crop.temp_opt_c[0] && tGrow <= crop.temp_opt_c[1]) add('season', 'ok', `Temperatura media de la temporada de crecimiento: ${tGrow.toFixed(0)} °C, dentro de su rango ideal.`, 'nasa_power')
  else if (tGrow >= crop.temp_opt_c[0] - 4 && tGrow <= crop.temp_opt_c[1] + 4) add('season', 'warn', `Temporada de ${tGrow.toFixed(0)} °C, fuera de su rango ideal (${crop.temp_opt_c[0]}–${crop.temp_opt_c[1]} °C).`, 'nasa_power', 30, 15)
  else add('season', 'bad', `Temporada de ${tGrow.toFixed(0)} °C: muy lejos de su rango (${crop.temp_opt_c[0]}–${crop.temp_opt_c[1]} °C).`, 'nasa_power', 45)

  // 5. Calor de verano
  const hottest = model.months.reduce((a, b) => (daysAbove(b, crop.heat_critical_c) > daysAbove(a, crop.heat_critical_c) ? b : a))
  const hot = daysAbove(hottest, crop.heat_critical_c)
  if (hot > 12) add('heat', 'bad', `~${hot.toFixed(0)} días en ${mName(hottest.month)} sobre ${crop.heat_critical_c} °C: golpe de sol en fruta y estrés del árbol.`, 'nasa_power', 30)
  else if (hot > 4) add('heat', 'warn', `~${hot.toFixed(0)} días en ${mName(hottest.month)} sobre ${crop.heat_critical_c} °C: puede quemar fruta o bajar calidad.`, 'nasa_power')
  else add('heat', 'ok', 'Veranos sin calor excesivo para el cultivo.', 'nasa_power')

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
  if (deficit <= 50) add('water', 'ok', `La lluvia (${fmt(rain)} mm/año) cubre casi toda su demanda (${fmt(demand)} mm/año).`, 'nasa_power')
  else if (deficit <= irr) add('water', 'warn', `Necesita ~${fmt(deficit)} mm/año de riego (demanda ${fmt(demand)} mm vs ${fmt(eff)} mm de lluvia útil).`, 'nasa_power', 30, 10)
  else if (irr > 0 && deficit <= irr * 1.5) add('water', 'warn', `Riego justo: necesita ~${fmt(deficit)} mm/año y tienes ~${fmt(irr)} mm.`, 'nasa_power', 30, 25)
  else add('water', 'bad', irr > 0 ? `Faltan ~${fmt(deficit)} mm/año de agua y el riego disponible es de ${fmt(irr)} mm.` : `Sin riego faltan ~${fmt(deficit)} mm/año: no es viable de temporal.`, 'nasa_power', 42)

  // 7. Suelo, salinidad y terreno
  soilPh(crop, ctx, add)
  salinity(crop, ctx, add)

  // 8. Mes de plantación
  const plantOk = (crop.plant_months ?? []).map((m) => shiftMonth(m, lat))
  if (plantOk.length && !plantOk.includes(plantMonth)) add('planting', 'warn', `Mejor plantar en ${plantOk.map(mName).join(', ')}${crop.chill_hours ? ' (árbol en reposo, a raíz desnuda)' : ''}.`, 'nasa_power', 15, 12)
  else if (plantOk.length) add('planting', 'ok', `Buena época para plantar${crop.chill_hours ? ': el árbol está en reposo' : ''}.`, 'nasa_power')

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
    if (plantDoy >= l90! && harvestDoy <= f10!) add('frost', 'ok', `Sembrando a mediados de ${mName(plantMonth)} el ciclo evita las heladas en 9 de cada 10 años (última: ${label(l90!)}, primera: ${label(f10!)}).`, 'nasa_power')
    else if (plantDoy >= l50! && harvestDoy <= f50!)
      add('frost', 'warn', plantDoy < l90! ? `Siembra antes del ${label(l90!)}: 1 a 5 de cada 10 años aún hiela después.` : `La cosecha llega cerca de la primera helada (${label(f10!)} en años tempranos).`, 'nasa_power', 55)
    else add('frost', 'bad', plantDoy < l50! ? `Se siembra antes de la última helada típica (${label(l50!)}): alto riesgo de perder la siembra.` : `El ciclo no termina antes de las heladas de otoño (${label(f50!)}).`, 'nasa_power', 60)
  } else if (!crop.frost_tolerant) {
    const worst = mc.reduce((a, b) => (b.frostProb > a.frostProb ? b : a))
    if (worst.frostProb <= 0.08) {
      const lf = model.lastFrostP90
      add('frost', 'ok', lf && model.lat >= 0 ? `El ciclo evita las heladas: la última suele caer antes del ${label(lf)} (9 de cada 10 años).` : 'Sin heladas probables durante el ciclo.', 'nasa_power')
    } else if (worst.frostProb <= 0.3) {
      add('frost', 'warn', `En ${mName(worst.month)} hay helada ${yrs(worst.frostProb)}; el cultivo no la tolera.`, 'nasa_power', 55)
    } else {
      add('frost', 'bad', `Helada en ${mName(worst.month)} ${yrs(worst.frostProb)}: alto riesgo de perder la siembra.`, 'nasa_power', 60)
    }
  } else {
    const coldest = mc.reduce((a, b) => (b.tmin < a.tmin ? b : a))
    if (coldest.tmin < crop.temp_abs_c[0]) add('frost', 'bad', `Mínimas de ${coldest.tmin.toFixed(1)} °C en ${mName(coldest.month)}, debajo de lo que resiste.`, 'nasa_power')
    else if (coldest.tmin < crop.temp_abs_c[0] + 4) add('frost', 'warn', `Frío intenso en ${mName(coldest.month)} (${coldest.tmin.toFixed(1)} °C); tolera heladas pero puede retrasarse.`, 'nasa_power')
    else add('frost', 'ok', 'Resiste las heladas típicas de la zona.', 'nasa_power')
  }

  // Temperatura del ciclo
  const tCycle = mc.reduce((a, b) => a + (b.tmax + b.tmin) / 2, 0) / mc.length
  if (tCycle >= crop.temp_opt_c[0] && tCycle <= crop.temp_opt_c[1]) add('season', 'ok', `Temperatura media del ciclo de ${tCycle.toFixed(0)} °C, dentro de su rango ideal.`, 'nasa_power')
  else if (tCycle >= crop.temp_abs_c[0] && tCycle <= crop.temp_abs_c[1]) add('season', 'warn', `Temperatura media de ${tCycle.toFixed(0)} °C, fuera de su rango ideal (${crop.temp_opt_c[0]}–${crop.temp_opt_c[1]} °C).`, 'nasa_power', 30, 20)
  else add('season', 'bad', `Temperatura media de ${tCycle.toFixed(0)} °C: el cultivo no prospera.`, 'nasa_power', 50)

  // Calor en floración
  const flower = model.months[cycleMonths(plantMonth, cycle * 0.6).at(-1)! - 1]
  const crit = crop.heat_critical_c
  const hotDays = daysAbove(flower, crit)
  if (hotDays > 12) add('heat', 'bad', `La floración cae en ${mName(flower.month)}, con ~${hotDays.toFixed(0)} días/año por encima de ${crit} °C.`, 'nasa_power', 35)
  else if (hotDays > 4) add('heat', 'warn', `Floración en ${mName(flower.month)}: ~${hotDays.toFixed(0)} días/año sobre ${crit} °C, puede afectar el amarre.`, 'nasa_power')
  else add('heat', 'ok', `Floración en ${mName(flower.month)} sin olas de calor frecuentes.`, 'nasa_power')

  // Agua
  const w = cycleDemand(model, plantMonth, cycle, crop.kc)
  const deficit = w.demand - w.effectiveRain
  // Cultivos de ciclo largo (alfalfa) reciben el riego de más de una temporada.
  const irr = ctx.irrigationMm * Math.max(1, cycle / 182)
  if (deficit <= 30) add('water', 'ok', `La lluvia (${fmt(w.rain)} mm) cubre casi toda la demanda del cultivo (${fmt(w.demand)} mm).`, 'nasa_power')
  else if (deficit <= irr) add('water', 'warn', `Necesita ~${fmt(deficit)} mm de riego: demanda ${fmt(w.demand)} mm vs ${fmt(w.effectiveRain)} mm de lluvia útil.`, 'nasa_power', 30, 10)
  else if (irr > 0 && deficit <= irr * 1.6) add('water', 'warn', `Riego justo: necesita ~${fmt(deficit)} mm y tienes ~${fmt(irr)} mm para este ciclo.`, 'nasa_power', 30, 25)
  else add('water', 'bad', irr > 0 ? `Faltan ~${fmt(deficit)} mm de agua y el riego disponible es de ${fmt(irr)} mm.` : `Sin riego faltan ~${fmt(deficit)} mm de agua: muy arriesgado de temporal.`, 'nasa_power', 42)

  // Suelo
  soilPh(crop, ctx, add)
  salinity(crop, ctx, add)

  // Terreno
  const slope = profile.terrain.slope_pct.p90
  if (slope > 8 && (AGRO[crop.id]?.c_factor ?? 0.3) >= 0.4) add('terrain', 'warn', `Pendientes de hasta ${slope.toFixed(0)} %: el suelo queda expuesto a erosión con este cultivo.`, profile.terrain.source_id)

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
  return `${dd} de ${['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'][mm - 1]}`
}

/** "3 de cada 10 años" / "casi todos los años". */
function yrs(p: number) {
  const n = Math.round(p * 10)
  return n >= 10 ? 'casi todos los años' : n <= 0 ? 'muy pocos años' : `${n} de cada 10 años`
}
