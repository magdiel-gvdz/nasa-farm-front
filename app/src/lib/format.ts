export const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
export const MONTHS_SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
export const MONTHS_INITIAL = ['E', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D']

/** "03-12" → "12 de marzo" */
export function dateLong(mmdd?: string | null) {
  if (!mmdd) return '—'
  const [m, d] = mmdd.split('-').map(Number)
  return `${d} de ${MONTHS[m - 1]}`
}

/** "03-12" → "12 mar" */
export function dateShort(mmdd?: string | null) {
  if (!mmdd) return '—'
  const [m, d] = mmdd.split('-').map(Number)
  return `${d} ${MONTHS_SHORT[m - 1]}`
}

export const monthName = (m: number) => MONTHS[m - 1]
export const monthShort = (m: number) => MONTHS_SHORT[m - 1]

/** [9,10,11,12,1,2,3] → "sep–mar"; [1,2,6,7] → "ene–feb, jun–jul". Entiende rachas que cruzan el año. */
export function monthRange(months: number[]) {
  const set = new Set(months)
  if (!set.size) return '—'
  if (set.size === 12) return 'todo el año'
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
  return x.toLocaleString('es-MX', { maximumFractionDigits: digits, minimumFractionDigits: digits })
}

export function signed(x: number, digits = 0) {
  const s = num(Math.abs(x), digits)
  return x > 0 ? `+${s}` : x < 0 ? `−${s}` : s
}

export function pct(p: number | null | undefined) {
  if (p == null) return '—'
  return `${Math.round(p * 100)} %`
}

/** 0.3 → "3 de cada 10 años" */
export function oneIn(p: number) {
  if (p <= 0) return 'nunca en 35 años'
  if (p >= 0.95) return 'casi todos los años'
  const n = Math.round(p * 10)
  if (n >= 1) return `${n} de cada 10 años`
  return `1 de cada ${Math.round(1 / p)} años`
}

/** Semana del año (1–52) de hoy. */
export function currentWeek(d = new Date()) {
  const start = Date.UTC(d.getFullYear(), 0, 1)
  const doy = Math.floor((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - start) / 86400000) + 1
  return Math.min(52, Math.floor((doy - 1) / 7) + 1)
}
