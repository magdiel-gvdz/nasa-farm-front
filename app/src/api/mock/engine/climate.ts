// Motor de clima (port del prototipo en Python, ver docs/backend-handoff.md §7.1).
// Entrada: serie diaria de NASA POWER. Salida: ClimateProfile del contrato.
// Las importaciones llevan extensión .ts para poder correrlo con Node
// (scripts/build-demo-fixtures.ts) además de en el navegador.

import type {
  ClimateProfile,
  DayOfYear,
  FrostMonth,
  HeatMonth,
  RainMonth,
  RiskWeek,
} from '../../types.ts'

export interface DailySeries {
  dates: Date[] // UTC, ordenadas
  tmin: number[]
  tmax: number[]
  tmean: number[]
  prec: number[]
  wind_max: number[] // m/s
  solar: number[] // MJ/m²/día
  elevation_m: number | null
}

const FROST_C = 0
const FROST_RISK_C = 2
const HEAVY_MM = 25
const RAINY_MONTH_MIN_MM = 40
const GDD_BASE = 10
const GDD_CAP = 30
const DLI_PER_MJ = 0.48 * 4.57
const GUST_FACTOR = 1.4
const KMH = 3.6
const SEASON_SHIFT = 182
const PIVOT_DOY = 182

const r = (x: number | null | undefined, n = 1): number | null => {
  if (x === null || x === undefined || Number.isNaN(x) || !Number.isFinite(x)) return null
  const f = 10 ** n
  return Math.round(x * f) / f
}

const mean = (xs: number[]) => {
  const v = xs.filter((x) => !Number.isNaN(x))
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : NaN
}

const std = (xs: number[]) => {
  const m = mean(xs)
  const v = xs.filter((x) => !Number.isNaN(x))
  return v.length > 1 ? Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / (v.length - 1)) : NaN
}

export function percentile(xs: number[], q: number): number {
  const v = xs.filter((x) => !Number.isNaN(x)).sort((a, b) => a - b)
  if (!v.length) return NaN
  const pos = ((v.length - 1) * q) / 100
  const lo = Math.floor(pos)
  const hi = Math.ceil(pos)
  return v[lo] + (v[hi] - v[lo]) * (pos - lo)
}

const doyOf = (d: Date) => {
  const start = Date.UTC(d.getUTCFullYear(), 0, 1)
  return Math.floor((d.getTime() - start) / 86400000) + 1
}

function doyLabel(doy: number | null, shift = 0): DayOfYear | null {
  if (doy === null || Number.isNaN(doy)) return null
  const d = Math.round(doy)
  const real = new Date(Date.UTC(2001, 0, 1) + (((d - 1 - shift) % 365) + 365) % 365 * 86400000)
  const mm = String(real.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(real.getUTCDate()).padStart(2, '0')
  return { doy: doyOf(real), date: `${mm}-${dd}` }
}

function trendPerDecade(byYear: Map<number, number>): number | null {
  const pts = [...byYear.entries()].filter(([, v]) => !Number.isNaN(v))
  if (pts.length < 10) return null
  const mx = mean(pts.map(([x]) => x))
  const my = mean(pts.map(([, y]) => y))
  let num = 0
  let den = 0
  for (const [x, y] of pts) {
    num += (x - mx) * (y - my)
    den += (x - mx) ** 2
  }
  return r((num / den) * 10, 2)
}

/** Parseo de la respuesta JSON de POWER daily point. */
export function parsePower(payload: {
  geometry?: { coordinates?: number[] }
  header?: { fill_value?: number }
  properties: { parameter: Record<string, Record<string, number>> }
}): DailySeries {
  const fill = payload.header?.fill_value ?? -999
  const p = payload.properties.parameter
  const keys = Object.keys(p.T2M_MIN).sort()
  const get = (name: string, k: string) => {
    const v = p[name]?.[k]
    return v === undefined || v === fill ? NaN : v
  }
  const dates = keys.map((k) => new Date(Date.UTC(+k.slice(0, 4), +k.slice(4, 6) - 1, +k.slice(6, 8))))
  const tmin = keys.map((k) => get('T2M_MIN', k))
  const tmax = keys.map((k) => get('T2M_MAX', k))
  const tmean = keys.map((k, i) => {
    const t = get('T2M', k)
    return Number.isNaN(t) ? (tmin[i] + tmax[i]) / 2 : t
  })
  return {
    dates,
    tmin,
    tmax,
    tmean,
    prec: keys.map((k) => get('PRECTOTCORR', k)),
    wind_max: keys.map((k) => get('WS10M_MAX', k)),
    solar: keys.map((k) => get('ALLSKY_SFC_SW_DWN', k)),
    elevation_m: payload.geometry?.coordinates?.[2] ?? null,
  }
}

interface Day {
  date: Date
  year: number
  month: number
  doy: number
  tmin: number
  tmax: number
  tmean: number
  prec: number
  wind: number
  solar: number
}

function toDays(s: DailySeries): Day[] {
  const days: Day[] = s.dates.map((d, i) => ({
    date: d,
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    doy: doyOf(d),
    tmin: s.tmin[i],
    tmax: s.tmax[i],
    tmean: s.tmean[i],
    prec: s.prec[i],
    wind: s.wind_max[i],
    solar: s.solar[i],
  }))
  const perYear = new Map<number, number>()
  for (const d of days) perYear.set(d.year, (perYear.get(d.year) ?? 0) + 1)
  return days.filter((d) => (perYear.get(d.year) ?? 0) >= 360)
}

function groupBy<K, T>(xs: T[], key: (x: T) => K): Map<K, T[]> {
  const m = new Map<K, T[]>()
  for (const x of xs) {
    const k = key(x)
    const arr = m.get(k)
    if (arr) arr.push(x)
    else m.set(k, [x])
  }
  return m
}

function frostSummary(days: Day[], lat: number) {
  const shift = lat >= 0 ? 0 : SEASON_SHIFT
  const shifted = days.map((d) => {
    const nd = new Date(d.date.getTime() + shift * 86400000)
    return { year: nd.getUTCFullYear(), doy: doyOf(nd), tmin: d.tmin }
  })
  const lastSpring: (number | null)[] = []
  const firstFall: (number | null)[] = []
  const freeDays: number[] = []
  for (const [, ds] of groupBy(shifted, (d) => d.year)) {
    if (ds.length < 360) continue
    const frost = ds.filter((d) => d.tmin <= FROST_C).map((d) => d.doy)
    const spring = frost.filter((x) => x < PIVOT_DOY)
    const fall = frost.filter((x) => x >= PIVOT_DOY)
    const ls = spring.length ? Math.max(...spring) : null
    const ff = fall.length ? Math.min(...fall) : null
    lastSpring.push(ls)
    firstFall.push(ff)
    freeDays.push((ff ?? 366) - (ls ?? 0) - 1)
  }
  const pct = (xs: (number | null)[], q: number) => {
    const v = xs.filter((x): x is number => x !== null)
    return v.length ? percentile(v, q) : null
  }

  const byYearMonth = groupBy(days, (d) => `${d.year}-${d.month}`)
  const byMonth: FrostMonth[] = []
  for (let m = 1; m <= 12; m++) {
    const frostDays: number[] = []
    const riskDays: number[] = []
    const mins: number[] = []
    for (const [k, ds] of byYearMonth) {
      if (+k.split('-')[1] !== m) continue
      frostDays.push(ds.filter((d) => d.tmin <= FROST_C).length)
      riskDays.push(ds.filter((d) => d.tmin <= FROST_RISK_C).length)
      mins.push(Math.min(...ds.map((d) => d.tmin)))
    }
    byMonth.push({
      month: m,
      prob_any_frost: r(frostDays.filter((x) => x > 0).length / frostDays.length, 2),
      mean_frost_days: r(mean(frostDays), 1),
      mean_frost_risk_days: r(mean(riskDays), 1),
      record_tmin_c: r(Math.min(...mins), 1),
    })
  }
  const n = lastSpring.length
  const noFrost = lastSpring.filter((ls, i) => ls === null && firstFall[i] === null).length
  return {
    threshold_c: FROST_C,
    risk_threshold_c: FROST_RISK_C,
    years_analyzed: n,
    last_spring_frost: {
      p10: doyLabel(pct(lastSpring, 10), shift),
      p50: doyLabel(pct(lastSpring, 50), shift),
      p90: doyLabel(pct(lastSpring, 90), shift),
    },
    first_fall_frost: {
      p10: doyLabel(pct(firstFall, 10), shift),
      p50: doyLabel(pct(firstFall, 50), shift),
      p90: doyLabel(pct(firstFall, 90), shift),
    },
    frost_free_days: { p10: r(percentile(freeDays, 10), 0), p50: r(percentile(freeDays, 50), 0) },
    share_years_without_frost: n ? r(noFrost / n, 2) : null,
    by_month: byMonth,
  }
}

function rainSummary(days: Day[]) {
  const annual = new Map<number, number>()
  for (const d of days) annual.set(d.year, (annual.get(d.year) ?? 0) + (Number.isNaN(d.prec) ? 0 : d.prec))
  const annualVals = [...annual.values()]
  const annualMean = mean(annualVals)
  const wet = days.filter((d) => d.prec >= 1).map((d) => d.prec)

  const byYearMonth = groupBy(days, (d) => `${d.year}-${d.month}`)
  const byMonth: RainMonth[] = []
  for (let m = 1; m <= 12; m++) {
    const totals: number[] = []
    const heavy: number[] = []
    for (const [k, ds] of byYearMonth) {
      if (+k.split('-')[1] !== m) continue
      totals.push(ds.reduce((a, d) => a + (Number.isNaN(d.prec) ? 0 : d.prec), 0))
      heavy.push(ds.filter((d) => d.prec >= HEAVY_MM).length)
    }
    byMonth.push({
      month: m,
      mean_mm: r(mean(totals)),
      p20_mm: r(percentile(totals, 20)),
      p80_mm: r(percentile(totals, 80)),
      mean_heavy_rain_days: r(mean(heavy), 2),
    })
  }
  const threshold = Math.max(RAINY_MONTH_MIN_MM, annualMean / 12)
  const perYear = (pred: (d: Day) => boolean) => {
    const m = new Map<number, number>()
    for (const d of days) if (pred(d)) m.set(d.year, (m.get(d.year) ?? 0) + 1)
    return mean([...annual.keys()].map((y) => m.get(y) ?? 0))
  }
  return {
    source_id: 'nasa_power',
    annual_mean_mm: r(annualMean, 0),
    annual_p20_mm: r(percentile(annualVals, 20), 0),
    annual_p80_mm: r(percentile(annualVals, 80), 0),
    annual_cv: r(std(annualVals) / annualMean, 2),
    trend_mm_per_decade: trendPerDecade(annual),
    rainy_months: byMonth.filter((b) => (b.mean_mm ?? 0) >= threshold).map((b) => b.month),
    rainy_month_threshold_mm: r(threshold),
    wet_day_p95_mm: r(percentile(wet, 95)),
    days_per_year_over_25mm: r(perYear((d) => d.prec >= 25), 1),
    days_per_year_over_50mm: r(perYear((d) => d.prec >= 50), 1),
    by_month: byMonth,
  }
}

function heatSummary(days: Day[]) {
  const gdd = (d: Day) => Math.max(0, (Math.min(d.tmax, GDD_CAP) + Math.min(d.tmin, GDD_CAP)) / 2 - GDD_BASE)
  const byYearMonth = groupBy(days, (d) => `${d.year}-${d.month}`)
  const byMonth: HeatMonth[] = []
  for (let m = 1; m <= 12; m++) {
    const sel = days.filter((d) => d.month === m)
    const perYear = (f: (ds: Day[]) => number) => {
      const vals: number[] = []
      for (const [k, ds] of byYearMonth) if (+k.split('-')[1] === m) vals.push(f(ds))
      return mean(vals)
    }
    byMonth.push({
      month: m,
      mean_tmax_c: r(mean(sel.map((d) => d.tmax))),
      mean_tmin_c: r(mean(sel.map((d) => d.tmin))),
      record_tmax_c: r(Math.max(...sel.map((d) => d.tmax))),
      mean_gdd_base10: r(perYear((ds) => ds.reduce((a, d) => a + gdd(d), 0)), 0),
      mean_days_over_30c: r(perYear((ds) => ds.filter((d) => d.tmax >= 30).length), 1),
      mean_days_over_35c: r(perYear((ds) => ds.filter((d) => d.tmax >= 35).length), 1),
      mean_days_over_40c: r(perYear((ds) => ds.filter((d) => d.tmax >= 40).length), 1),
    })
  }
  const annualMean = new Map<number, number>()
  const annualGdd = new Map<number, number>()
  for (const [y, ds] of groupBy(days, (d) => d.year)) {
    annualMean.set(y, mean(ds.map((d) => d.tmean)))
    annualGdd.set(y, ds.reduce((a, d) => a + gdd(d), 0))
  }
  const hottest = byMonth.reduce((a, b) => ((b.mean_tmax_c ?? -99) > (a.mean_tmax_c ?? -99) ? b : a))
  return {
    annual_mean_c: r(mean(days.map((d) => d.tmean))),
    trend_c_per_decade: trendPerDecade(annualMean),
    hottest_month: hottest.month,
    annual_gdd_base10: r(mean([...annualGdd.values()]), 0),
    by_month: byMonth,
  }
}

export function gumbelReturnLevels(annualMax: number[], periods = [10, 25, 50]) {
  const x = annualMax.filter((v) => !Number.isNaN(v))
  if (x.length < 10) return [] as { t: number; v: number }[]
  const beta = (Math.sqrt(6) * std(x)) / Math.PI
  const mu = mean(x) - 0.5772 * beta
  return periods.map((t) => ({ t, v: mu - beta * Math.log(-Math.log(1 - 1 / t)) }))
}

function windSummary(days: Day[]) {
  const annualMax = [...groupBy(days, (d) => d.year).values()].map((ds) => Math.max(...ds.map((d) => d.wind).filter((v) => !Number.isNaN(v))))
  const byMonth = Array.from({ length: 12 }, (_, i) => {
    const sel = days.filter((d) => d.month === i + 1).map((d) => d.wind)
    return { month: i + 1, mean_daily_max_kmh: r(mean(sel) * KMH), record_kmh: r(Math.max(...sel) * KMH) }
  })
  const windiest = byMonth.reduce((a, b) => ((b.mean_daily_max_kmh ?? 0) > (a.mean_daily_max_kmh ?? 0) ? b : a))
  return {
    annual_max_mean_kmh: r(mean(annualMax) * KMH),
    record_kmh: r(Math.max(...annualMax) * KMH),
    windiest_month: windiest.month,
    gust_factor_assumed: GUST_FACTOR,
    return_levels_kmh: gumbelReturnLevels(annualMax).map(({ t, v }) => ({
      return_period_years: t,
      sustained_kmh: r(v * KMH),
      estimated_gust_kmh: r(v * KMH * GUST_FACTOR),
    })),
    by_month: byMonth,
  }
}

function lightSummary(days: Day[]) {
  const all = days.map((d) => d.solar)
  return {
    annual_mean_dli_mol_m2_day: r(mean(all) * DLI_PER_MJ),
    by_month: Array.from({ length: 12 }, (_, i) => {
      const sel = days.filter((d) => d.month === i + 1).map((d) => d.solar)
      return { month: i + 1, mean_solar_mj_m2_day: r(mean(sel)), mean_dli_mol_m2_day: r(mean(sel) * DLI_PER_MJ) }
    }),
  }
}

function riskCalendar(days: Day[]): RiskWeek[] {
  type Acc = { frost: boolean; risk: boolean; heat: boolean; heavy: boolean; prec: number; tmin: number[]; tmax: number[] }
  const perYearWeek = new Map<string, Acc>()
  for (const d of days) {
    const w = Math.min(Math.floor((d.doy - 1) / 7), 51)
    const k = `${d.year}-${w}`
    let a = perYearWeek.get(k)
    if (!a) {
      a = { frost: false, risk: false, heat: false, heavy: false, prec: 0, tmin: [], tmax: [] }
      perYearWeek.set(k, a)
    }
    a.frost ||= d.tmin <= FROST_C
    a.risk ||= d.tmin <= FROST_RISK_C
    a.heat ||= d.tmax >= 35
    a.heavy ||= d.prec >= HEAVY_MM
    a.prec += Number.isNaN(d.prec) ? 0 : d.prec
    a.tmin.push(d.tmin)
    a.tmax.push(d.tmax)
  }
  const out: RiskWeek[] = []
  for (let w = 0; w < 52; w++) {
    const accs = [...perYearWeek.entries()].filter(([k]) => +k.split('-')[1] === w).map(([, a]) => a)
    const share = (f: (a: Acc) => boolean) => r(accs.filter(f).length / accs.length, 2)
    const start = new Date(Date.UTC(2001, 0, 1) + w * 7 * 86400000)
    out.push({
      week: w + 1,
      starts: `${String(start.getUTCMonth() + 1).padStart(2, '0')}-${String(start.getUTCDate()).padStart(2, '0')}`,
      p_frost: share((a) => a.frost),
      p_frost_risk: share((a) => a.risk),
      p_heat_35c: share((a) => a.heat),
      p_heavy_rain: share((a) => a.heavy),
      p_dry_week: share((a) => a.prec < 2),
      mean_prec_mm: r(mean(accs.map((a) => a.prec))),
      mean_tmin_c: r(mean(accs.flatMap((a) => a.tmin))),
      mean_tmax_c: r(mean(accs.flatMap((a) => a.tmax))),
    })
  }
  return out
}

export function summarizeClimate(series: DailySeries, lat: number): ClimateProfile {
  const days = toDays(series)
  const years = days.map((d) => d.year)
  return {
    source_id: 'nasa_power',
    years: [Math.min(...years), Math.max(...years)],
    elevation_m: series.elevation_m,
    frost: frostSummary(days, lat),
    rain: rainSummary(days),
    heat: heatSummary(days),
    wind: windSummary(days),
    light: lightSummary(days),
    risk_calendar: riskCalendar(days),
  }
}
