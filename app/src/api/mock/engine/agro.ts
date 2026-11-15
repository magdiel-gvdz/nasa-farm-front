// Utilidades agronómicas: clima mensual, ET0 de Hargreaves, escenarios y
// ventanas de cultivo. Usadas por los motores de aptitud y rotación.

import type { ClimateProfile, Scenario } from '../types.ts'

export interface MonthClimate {
  month: number
  tmax: number
  tmin: number
  rain: number
  frostProb: number
  heat30: number
  heat35: number
  et0: number // mm/mes
  recordTmin: number | null // mínima récord del mes (°C), con el escenario aplicado
}

export interface ClimateModel {
  months: MonthClimate[]
  lastFrostP50: number | null // doy
  lastFrostP90: number | null
  firstFrostP10: number | null
  firstFrostP50: number | null
  lat: number
}

const DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
export const MID_DOY = [15, 46, 74, 105, 135, 166, 196, 227, 258, 288, 319, 349]

/** Radiación extraterrestre Ra (MJ/m²/día), FAO-56 ec. 21. */
function ra(latDeg: number, doy: number) {
  const phi = (latDeg * Math.PI) / 180
  const dr = 1 + 0.033 * Math.cos(((2 * Math.PI) / 365) * doy)
  const delta = 0.409 * Math.sin(((2 * Math.PI) / 365) * doy - 1.39)
  const ws = Math.acos(Math.max(-1, Math.min(1, -Math.tan(phi) * Math.tan(delta))))
  return ((24 * 60) / Math.PI) * 0.082 * dr * (ws * Math.sin(phi) * Math.sin(delta) + Math.cos(phi) * Math.cos(delta) * Math.sin(ws))
}

/** ET0 Hargreaves-Samani (mm/día). */
export function et0Hargreaves(latDeg: number, doy: number, tmax: number, tmin: number) {
  const tmean = (tmax + tmin) / 2
  return Math.max(0, 0.0023 * 0.408 * ra(latDeg, doy) * (tmean + 17.8) * Math.sqrt(Math.max(0, tmax - tmin)))
}

const phi = (z: number) => 0.5 * (1 + erf(z / Math.SQRT2))
function erf(x: number) {
  const s = Math.sign(x)
  const a = Math.abs(x)
  const t = 1 / (1 + 0.3275911 * a)
  const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-a * a)
  return s * y
}

/** Días por mes con tmax ≥ umbral, aproximando tmax diaria ~ N(media, 3.5 °C). */
function daysOver(meanTmax: number, thr: number, days: number) {
  return days * (1 - phi((thr - meanTmax) / 3.5))
}

export function buildClimateModel(c: ClimateProfile, lat: number, scenario?: Scenario): ClimateModel {
  const dT = scenario?.delta_t_c ?? 0
  const pf = 1 + (scenario?.delta_p_pct ?? 0) / 100
  const months: MonthClimate[] = c.heat.by_month.map((h, i) => {
    const tmax = (h.mean_tmax_c ?? 20) + dT
    const tmin = (h.mean_tmin_c ?? 8) + dT
    const baseTmax = h.mean_tmax_c ?? 20
    const ratio30 = daysOver(tmax, 30, DAYS[i]) / Math.max(daysOver(baseTmax, 30, DAYS[i]), 1e-6)
    const ratio35 = daysOver(tmax, 35, DAYS[i]) / Math.max(daysOver(baseTmax, 35, DAYS[i]), 1e-6)
    const base30 = h.mean_days_over_30c ?? 0
    const base35 = h.mean_days_over_35c ?? 0
    const frost = c.frost.by_month[i]?.prob_any_frost ?? 0
    return {
      month: i + 1,
      tmax,
      tmin,
      rain: (c.rain.by_month[i]?.mean_mm ?? 0) * pf,
      // Cada °C extra reduce la probabilidad de helada (~30 %/°C, aproximación).
      frostProb: Math.min(1, Math.max(0, frost * Math.exp(-0.35 * dT))),
      heat30: dT === 0 ? base30 : Math.min(DAYS[i], base30 > 0.05 ? base30 * ratio30 : daysOver(tmax, 30, DAYS[i])),
      heat35: dT === 0 ? base35 : Math.min(DAYS[i], base35 > 0.05 ? base35 * ratio35 : daysOver(tmax, 35, DAYS[i])),
      et0: et0Hargreaves(lat, MID_DOY[i], tmax, tmin) * DAYS[i],
      recordTmin: c.frost.by_month[i]?.record_tmin_c != null ? c.frost.by_month[i].record_tmin_c! + dT : null,
    }
  })
  // ~4 días por °C de adelanto/atraso de las heladas.
  const shift = (doy: number | undefined | null, sign: number) => (doy == null ? null : doy + sign * 4 * dT)
  return {
    months,
    lastFrostP50: shift(c.frost.last_spring_frost.p50?.doy, -1),
    lastFrostP90: shift(c.frost.last_spring_frost.p90?.doy, -1),
    firstFrostP10: shift(c.frost.first_fall_frost.p10?.doy, 1),
    firstFrostP50: shift(c.frost.first_fall_frost.p50?.doy, 1),
    lat,
  }
}

/** Meses (1-12) que cubre un ciclo que inicia a mitad de `plantMonth`. */
export function monthOfDoy(doy: number) {
  let acc = 0
  for (let i = 0; i < 12; i++) {
    acc += DAYS[i]
    if (doy <= acc) return i + 1
  }
  return 12
}

export function cycleMonths(plantMonth: number, cycleDays: number): number[] {
  const out: number[] = []
  const start = MID_DOY[plantMonth - 1]
  for (let d = 0; d < cycleDays; d += 5) {
    const m = monthOfDoy(((start + d - 1) % 365) + 1)
    if (!out.includes(m)) out.push(m)
  }
  return out
}

export function doyToLabel(doy: number) {
  const d = new Date(Date.UTC(2001, 0, 1) + ((((Math.round(doy) - 1) % 365) + 365) % 365) * 86400000)
  return `${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
}

/** Fracción de cada mes que ocupa el ciclo (para repartir Kc y lluvia). */
export function cycleDemand(model: ClimateModel, plantMonth: number, cycleDays: number, kc: { ini: number; mid: number; end: number }) {
  let demand = 0
  let rain = 0
  const start = MID_DOY[plantMonth - 1]
  for (let d = 0; d < cycleDays; d++) {
    const mi = monthOfDoy(((start + d - 1) % 365) + 1) - 1
    const f = d / cycleDays
    const k = f < 0.2 ? kc.ini : f < 0.4 ? kc.ini + (kc.mid - kc.ini) * ((f - 0.2) / 0.2) : f < 0.75 ? kc.mid : kc.mid + (kc.end - kc.mid) * ((f - 0.75) / 0.25)
    demand += (model.months[mi].et0 / DAYS[mi]) * k
    rain += model.months[mi].rain / DAYS[mi]
  }
  return { demand, rain, effectiveRain: rain * 0.75 }
}

/**
 * Horas frío (horas con temperatura < 7.2 °C) del invierno: nov–feb en el
 * hemisferio norte, may–ago en el sur. Estimación a partir de máximas y mínimas
 * medias mensuales con un ciclo diario senoidal y ±4 °C de variación entre días.
 * El backend debe calcularlas con datos horarios (modelo Utah o de porciones de frío).
 */
export function chillHours(model: ClimateModel, threshold = 7.2): number {
  const months = model.lat >= 0 ? [11, 12, 1, 2] : [5, 6, 7, 8]
  const offsets: [number, number][] = [[-4, 0.1], [-2, 0.2], [0, 0.4], [2, 0.2], [4, 0.1]]
  let total = 0
  for (const m of months) {
    const mc = model.months[m - 1]
    let frac = 0
    for (const [off, w] of offsets) {
      const tmax = mc.tmax + off
      const tmin = mc.tmin + off
      const mean = (tmax + tmin) / 2
      const amp = Math.max(0.5, (tmax - tmin) / 2)
      const c = Math.max(-1, Math.min(1, (threshold - mean) / amp))
      frac += w * (1 - Math.acos(c) / Math.PI)
    }
    total += frac * 24 * DAYS[m - 1]
  }
  return Math.round(total / 10) * 10
}
