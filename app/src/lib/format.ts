export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
export const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
export const MONTHS_INITIAL = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D']

/** "03-12" → "12 de marzo" */
export function dateLong(mmdd?: string | null) {
  if (!mmdd) return '—'
  const [m, d] = mmdd.split('-').map(Number)
  return `${MONTHS[m - 1]} ${d}`
}

/** "03-12" → "12 mar" */
export function dateShort(mmdd?: string | null) {
  if (!mmdd) return '—'
  const [m, d] = mmdd.split('-').map(Number)
  return `${MONTHS_SHORT[m - 1]} ${d}`
}

export const monthName = (m: number) => MONTHS[m - 1]
export const monthShort = (m: number) => MONTHS_SHORT[m - 1]

/** [9,10,11,12,1,2,3] → "sep–mar"; [1,2,6,7] → "ene–feb, jun–jul". Entiende rachas que cruzan el año. */
export function monthRange(months: number[]) {
  const set = new Set(months)
  if (!set.size) return '—'
  if (set.size === 12) return 'all year round'
  // Empezar en un mes que no esté precedido por otro del conjunto.
  const starts = [...set].filter((m) => !set.has(m === 1 ? 12 : m - 1)).sort((a, b) => a - b)
  const runs = starts.map((s) => {
    let e = s
    while (set.has(e === 12 ? 1 : e + 1)) e = e === 12 ? 1 : e + 1
    return s === e ? monthShort(s) : `${monthShort(s)}–${monthShort(e)}`
  })
  return runs.length === 1 && set.size === 1 ? monthName(months[0]) : runs.join(', ')
}

export function num(x: number | null | undefined, digits = 0) {
  if (x == null || Number.isNaN(x)) return '—'
  return x.toLocaleString('en-US', { maximumFractionDigits: digits, minimumFractionDigits: digits })
}

export function signed(x: number, digits = 0) {
  const s = num(Math.abs(x), digits)
  return x > 0 ? `+${s}` : x < 0 ? `−${s}` : s
}

export function pct(p: number | null | undefined) {
  if (p == null) return '—'
  return `${Math.round(p * 100)} %`
}

/** 0.3 → "3 out of 10 years" */
export function oneIn(p: number) {
  if (p <= 0) return 'never in 35 years'
  if (p >= 0.95) return 'almost every year'
  const n = Math.round(p * 10)
  if (n >= 1) return `${n} out of 10 years`
  return `1 in ${Math.round(1 / p)} years`
}

/** Semana del año (1–52) de hoy. */
export function currentWeek(d = new Date()) {
  const start = Date.UTC(d.getFullYear(), 0, 1)
  const doy = Math.floor((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - start) / 86400000) + 1
  return Math.min(52, Math.floor((doy - 1) / 7) + 1)
}
