import { useState } from 'react'
import type { FieldProfile, RiskPeriod } from '@/api/types'
import { dateShort, MONTHS_SHORT, pct } from '@/lib/format'
import { cn } from '@/lib/cn'

export function RiskCalendar({ profile }: { profile: FieldProfile }) {
  const periods = profile.climate.risk_calendar
  const decadal = periods[0]?.decade != null
  const now = new Date()
  const today = decadal ? now.getMonth() * 3 + Math.min(2, Math.floor((now.getDate() - 1) / 10)) : Math.min(51, Math.floor((Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) - Date.UTC(now.getFullYear(), 0, 1)) / 604800000))
  const [selection, setSelection] = useState<number | null>(null)
  const [heatThreshold, setHeatThreshold] = useState<30 | 32 | 35 | 38>(35)
  const hover = selection ?? today
  const selected = periods[hover] ?? periods[0]
  const bare = new Set(profile.vegetation?.bare_soil_months ?? [])
  const rows: { label: string; color: string; value: (p: RiskPeriod) => number | null }[] = [
    { label: 'Frost', color: 'var(--s-7)', value: (p) => p.p_frost },
    { label: 'Severe frost', color: 'var(--s-7)', value: (p) => p.p_frost_severe ?? null },
    { label: `Heat > ${heatThreshold} °C`, color: 'var(--s-2)', value: (p) => p[`p_heat_${heatThreshold}c`] ?? null },
    { label: 'Heavy rain', color: 'var(--s-1)', value: (p) => p.p_heavy_rain },
    { label: 'Water stress', color: 'var(--s-8)', value: (p) => p.p_water_stress ?? null },
    { label: 'Bare soil', color: 'var(--ink-2)', value: (p) => p.p_bare_soil ?? (profile.vegetation ? (bare.has(Number(p.starts.slice(0, 2))) ? 1 : 0) : null) },
    { label: 'Strong wind', color: 'var(--s-4)', value: (p) => p.p_strong_wind ?? null },
  ]
  if (!selected) return <p className="text-sm text-muted">No risk calendar available.</p>
  const columns = { gridTemplateColumns: `repeat(${periods.length}, minmax(0, 1fr))` }
  return (
    <div>
      {decadal && <label className="mb-4 flex items-center gap-2 text-xs text-muted">Heat threshold<select className="rounded-lg border border-line bg-surface p-1 text-ink" value={heatThreshold} onChange={(e) => setHeatThreshold(Number(e.target.value) as typeof heatThreshold)}>{[30, 32, 35, 38].map((v) => <option key={v} value={v}>{v} °C</option>)}</select></label>}
      <div className="overflow-x-auto pb-2">
        <div className="min-w-[640px]">
          <div className="ml-[120px] grid text-[11px] text-muted" style={columns}>
            {MONTHS_SHORT.map((m, i) => {
              const start = periods.findIndex((p) => Number(p.starts.slice(0, 2)) === i + 1)
              const next = periods.findIndex((p) => Number(p.starts.slice(0, 2)) === i + 2)
              return start < 0 ? null : <span key={m} className="border-l border-line pl-1" style={{ gridColumn: `${start + 1} / ${(next < 0 ? periods.length : next) + 1}` }}>{m}</span>
            })}
          </div>
          <div className="mt-3 space-y-2">
            {rows.map((row) => <div key={row.label} className="flex gap-2">
              <span className="w-28 shrink-0 text-xs text-ink-2">{row.label}</span>
              <div className="grid flex-1 gap-[2px]" style={columns}>
                {periods.map((period, i) => {
                  const value = row.value(period)
                  return <button key={period.decade ?? period.week ?? i} onClick={() => setSelection(i)} onMouseEnter={() => setSelection(i)} onFocus={() => setSelection(i)}
                    aria-label={`${decadal ? '10-day period' : 'Week'} of ${dateShort(period.starts)}: ${row.label} ${value == null ? 'no data' : pct(value)}`}
                    className={cn('h-7 cursor-pointer rounded-sm', i === hover && 'ring-1 ring-ink', value == null && 'border border-dashed border-line-strong')}
                    style={{ background: value == null ? 'transparent' : `color-mix(in srgb, ${row.color} ${Math.round(10 + value * 90)}%, transparent)` }} />
                })}
              </div>
            </div>)}
          </div>
        </div>
      </div>
      <div className="mt-4 rounded-xl bg-surface-2 p-4">
        <p className="text-sm font-semibold text-ink">{decadal ? '10-day period' : 'Week'} starting {dateShort(selected.starts)} {hover === today && '(current period)'}</p>
        <dl className="mt-2 grid gap-2 text-sm sm:grid-cols-2">{rows.map((row) => <div key={row.label} className="flex justify-between gap-2"><dt>{row.label}</dt><dd>{row.value(selected) == null ? 'No data' : pct(row.value(selected))}</dd></div>)}</dl>
        {selected.vulnerable && <p className="mt-3 text-sm text-bad">Vulnerable period: {selected.vulnerable_reasons?.join(', ')}</p>}
        {decadal && <p className="mt-2 text-xs text-muted">Median precipitation: {selected.precip_p50_mm ?? '—'} mm · Reference evaporation: {selected.et0_p50_mm ?? '—'} mm</p>}
      </div>
      <p className="mt-3 text-xs text-muted">{decadal ? '36 periods per year: days 1–10, 11–20 and 21 to month end.' : 'Weekly demo calendar.'} Darker cells mean greater probability. Dashed cells have no data. Record: {profile.climate.years.join('–')}.</p>
    </div>
  )
}
