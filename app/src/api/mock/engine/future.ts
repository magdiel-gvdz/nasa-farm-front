// Clima futuro por "método delta": para cada modelo CMIP6 se compara su propio
// periodo histórico (1991–2020) con el futuro (2031–2050) en el mismo punto, y
// ese cambio (ΔT, ΔP %) se aplica a la climatología observada de NASA POWER
// con los motores de escenario. Así se cancela el sesgo propio de cada modelo.
//
// Modo demostración: proyecciones CMIP6 HighResMIP vía la Climate API de
// Open-Meteo. Backend: NASA NEX-GDDP-CMIP6 (Earth Engine `NASA/GDDP-CMIP6`).

import type { FutureClimate, FutureModelDelta } from '../types.ts'

export const FUTURE_MODELS = ['EC_Earth3P_HR', 'MRI_AGCM3_2_S', 'CMCC_CM2_VHR4', 'FGOALS_f3_H', 'HiRAM_SIT_HR', 'MPI_ESM1_2_XR', 'NICAM16_8S']
export const FUTURE_URL = 'https://climate-api.open-meteo.com/v1/climate'
export const BASELINE: [number, number] = [1991, 2020]
export const PERIOD: [number, number] = [2031, 2050]

/** En el navegador se piden 4 modelos (la API gratuita cobra por modelo × años); las demos traen los 7 precalculados. */
export const BROWSER_MODELS = ['EC_Earth3P_HR', 'MRI_AGCM3_2_S', 'CMCC_CM2_VHR4', 'MPI_ESM1_2_XR']

export function futureUrl(lat: number, lon: number, models: string[] = FUTURE_MODELS) {
  return `${FUTURE_URL}?latitude=${lat.toFixed(3)}&longitude=${lon.toFixed(3)}&start_date=${BASELINE[0]}-01-01&end_date=${PERIOD[1]}-12-31&models=${models.join(',')}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum`
}

interface OpenMeteoClimate {
  daily: Record<string, (number | null)[]> & { time: string[] }
}

function periodStats(time: string[], tmin: (number | null)[], tmax: (number | null)[], pr: (number | null)[], [y0, y1]: [number, number]) {
  let t = 0
  let n = 0
  let p = 0
  let frost = 0
  let hot = 0
  const years = new Set<number>()
  for (let i = 0; i < time.length; i++) {
    const y = +time[i].slice(0, 4)
    if (y < y0 || y > y1) continue
    const a = tmin[i]
    const b = tmax[i]
    if (a == null || b == null) continue
    years.add(y)
    t += (a + b) / 2
    n++
    p += pr[i] ?? 0
    if (a <= 0) frost++
    if (b >= 35) hot++
  }
  const ny = years.size || 1
  return { t: n ? t / n : NaN, p: p / ny, frost: frost / ny, hot: hot / ny }
}

const median = (a: number[]) => {
  const s = [...a].sort((x, y) => x - y)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}
const r1 = (x: number) => Math.round(x * 10) / 10
const roundTo = (x: number, step: number) => Math.round(x / step) * step

export function summarizeFuture(json: OpenMeteoClimate): FutureClimate {
  const d = json.daily
  const models: FutureModelDelta[] = []
  for (const m of FUTURE_MODELS) {
    const tmin = d[`temperature_2m_min_${m}`]
    const tmax = d[`temperature_2m_max_${m}`]
    const pr = d[`precipitation_sum_${m}`]
    if (!tmin || !tmax || !pr) continue
    const b = periodStats(d.time, tmin, tmax, pr, BASELINE)
    const f = periodStats(d.time, tmin, tmax, pr, PERIOD)
    if (!Number.isFinite(b.t) || !Number.isFinite(f.t) || b.p <= 0) continue
    models.push({
      model: m,
      delta_t_c: r1(f.t - b.t),
      delta_p_pct: Math.round((f.p / b.p - 1) * 100),
      delta_frost_days: Math.round(f.frost - b.frost),
      delta_days_over_35c: Math.round(f.hot - b.hot),
    })
  }
  if (!models.length) throw new Error('No projection data for this point')
  const med = {
    delta_t_c: r1(median(models.map((x) => x.delta_t_c))),
    delta_p_pct: Math.round(median(models.map((x) => x.delta_p_pct))),
    delta_frost_days: Math.round(median(models.map((x) => x.delta_frost_days))),
    delta_days_over_35c: Math.round(median(models.map((x) => x.delta_days_over_35c))),
  }
  const ts = models.map((x) => x.delta_t_c)
  const ps = models.map((x) => x.delta_p_pct)
  const pRange: [number, number] = [Math.min(...ps), Math.max(...ps)]
  const agree = pRange[0] >= 0 || pRange[1] <= 0
  return {
    source_id: 'cmip6_highresmip',
    dataset: 'CMIP6 HighResMIP (via Open-Meteo Climate API)',
    experiment: 'HighResMIP highres-future (high forcing, similar to SSP5-8.5)',
    baseline: BASELINE,
    period: PERIOD,
    models,
    median: med,
    range: { delta_t_c: [Math.min(...ts), Math.max(...ts)], delta_p_pct: pRange },
    scenario: { delta_t_c: Math.max(0, roundTo(med.delta_t_c, 0.5)), delta_p_pct: Math.max(-40, Math.min(20, roundTo(med.delta_p_pct, 5))) },
    note: agree
      ? ` ${models.length} models match ${pRange[1] <= 0 ? 'that it will rain less' : 'that it will rain more'}.`
      : 'The models do not agree on whether it will rain more or less; The warm-up is consistent in all of them.',
  }
}
