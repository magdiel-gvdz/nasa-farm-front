import { motion } from 'motion/react'
import { CloudHail, CloudRain, Droplets, Shovel, Snowflake, Sun, ThermometerSnowflake, Wind, type LucideIcon } from 'lucide-react'
import { useState } from 'react'
import type { FieldProfile, RiskPeriod } from '@/api/types'
import { Segmented } from '@/components/ui/segmented'
import { cn } from '@/lib/cn'
import { currentWeek, dateShort, MONTHS_SHORT } from '@/lib/format'

type HeatThreshold = 30 | 32 | 35 | 38

interface Row {
  key: string
  label: string
  icon: LucideIcon
  color: string
  value: (p: RiskPeriod, month: number) => number | null // 0..1, null = sin dato
  describe: (p: RiskPeriod, month: number) => string
}

const share = (v: number | null | undefined) => `${Math.round((v ?? 0) * 100)} %`

/** Periodo actual: decena (0–35) con el backend, semana (0–51) en modo demostración. */
function currentIndex(decadal: boolean, now = new Date()) {
  return decadal ? now.getMonth() * 3 + Math.min(2, Math.floor((now.getDate() - 1) / 10)) : currentWeek(now) - 1
}

export function RiskCalendar({ profile }: { profile: FieldProfile }) {
  const periods = profile.climate.risk_calendar
  const decadal = periods[0]?.decade != null
  const n = periods.length
  const bare = new Set(profile.vegetation?.bare_soil_months ?? [])
  const today = Math.min(n - 1, currentIndex(decadal))
  const [hover, setHover] = useState<number>(today)
  const [heat, setHeat] = useState<HeatThreshold>(35)
  const unit = decadal ? '10-day period' : 'Week'

  const heatValue = (p: RiskPeriod) => (heat === 35 ? p.p_heat_35c : p[`p_heat_${heat}c`]) ?? null
  const bareValue = (p: RiskPeriod, m: number) => p.p_bare_soil ?? (profile.vegetation ? (bare.has(m) ? 0.55 : 0) : null)

  const all: Row[] = [
    { key: 'frost', label: 'Frost', icon: Snowflake, color: 'var(--s-7)', value: (p) => p.p_frost, describe: (p) => `Frost ${share(p.p_frost)} of years` },
    { key: 'frost_severe', label: 'Severe frost', icon: ThermometerSnowflake, color: 'var(--s-7)', value: (p) => p.p_frost_severe ?? null, describe: (p) => `Severe frost ${share(p.p_frost_severe)} of years` },
    decadal
      ? { key: 'rain', label: 'Heavy rain', icon: CloudRain, color: 'var(--s-1)', value: (p) => p.p_heavy_rain, describe: (p) => `Heavy rain ${share(p.p_heavy_rain)} of years${p.precip_p50_mm != null ? ` · ${p.precip_p50_mm} mm typical` : ''}` }
      : { key: 'rain', label: 'Rainfall', icon: CloudRain, color: 'var(--s-1)', value: (p) => (p.p_dry_week == null ? null : 1 - p.p_dry_week), describe: (p) => `It rains ${share(1 - (p.p_dry_week ?? 1))} of years · ${p.mean_prec_mm ?? 0} mm` },
    { key: 'heat', label: `Heat > ${heat} °C`, icon: Sun, color: 'var(--s-2)', value: heatValue, describe: (p) => `Heat above ${heat} °C ${share(heatValue(p))} of years` },
    { key: 'water', label: 'Water stress', icon: Droplets, color: 'var(--s-8)', value: (p) => p.p_water_stress ?? null, describe: (p) => `Water stress ${share(p.p_water_stress)} of years${p.et0_p50_mm != null ? ` · ${p.et0_p50_mm} mm evaporation` : ''}` },
    { key: 'hail', label: 'Hail (approx.)', icon: CloudHail, color: 'var(--s-4)', value: (p) => (p.p_hail_proxy == null ? null : Math.min(1, p.p_hail_proxy * 4)), describe: (p) => ((p.p_hail_proxy ?? 0) > 0 ? 'Season with risk of hail (low evidence)' : 'No hail sign') },
    { key: 'wind', label: 'Strong wind', icon: Wind, color: 'var(--s-4)', value: (p) => p.p_strong_wind ?? null, describe: (p) => `Strong wind ${share(p.p_strong_wind)} of years` },
    { key: 'bare', label: 'Bare soil', icon: Shovel, color: 'var(--ink-2)', value: bareValue, describe: (p, m) => (bareValue(p, m) == null ? 'No vegetation data for this zone' : (bareValue(p, m) ?? 0) > 0.3 ? 'The field is usually left without cultivation' : 'With cultivation or soil cover') },
  ]
  const monthOf = (p: RiskPeriod) => p.month ?? +p.starts.slice(0, 2)
  // Solo las filas con al menos un dato: el backend y el modo demostración traen indicadores distintos.
  const rows = all.filter((r) => periods.some((p) => r.value(p, monthOf(p)) != null))
  const hasHeatLevels = periods.some((p) => p.p_heat_30c != null)

  if (!n) return <p className="text-sm text-muted">No risk calendar available for this zone.</p>
  const hw = periods[hover] ?? periods[0]
  const cols = { gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }
  // Primer periodo de cada mes para las etiquetas
  const monthStarts = MONTHS_SHORT.map((_, i) => periods.findIndex((p) => monthOf(p) === i + 1))

  return (
    <div>
      {hasHeatLevels && (
        <div className="mb-5 flex flex-wrap items-center gap-3 text-xs text-ink-2">
          <span className="inline-flex items-center gap-1.5">
            <Sun className="h-3.5 w-3.5" /> Heat threshold
          </span>
          <Segmented size="sm" ariaLabel="Heat threshold" value={heat} onChange={setHeat} options={([30, 32, 35, 38] as const).map((v) => ({ value: v, label: `${v} °C` }))} />
        </div>
      )}
      <div className="overflow-x-auto pb-2">
        <div className="min-w-[640px]">
          {/* Meses */}
          <div className="ml-[132px] grid text-[11px] text-muted" style={cols}>
            {monthStarts.map((s, i) =>
              s < 0 ? null : (
                <div key={i} style={{ gridColumnStart: s + 1, gridColumnEnd: (monthStarts.slice(i + 1).find((x) => x >= 0) ?? n) + 1 }} className="border-l border-line pl-1">
                  {MONTHS_SHORT[i]}
                </div>
              ),
            )}
          </div>
          <motion.div
            className="relative mt-6 space-y-1.5"
            initial={{ clipPath: 'inset(-32px 100% -12px 0)' }}
            animate={{ clipPath: 'inset(-32px 0% -12px 0)' }}
            transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
            onMouseLeave={() => setHover(today)}
          >
            {rows.map((r) => (
              <div key={r.key} className="flex items-center gap-2">
                <div className="flex w-[124px] shrink-0 items-center gap-2 text-xs font-medium text-ink-2">
                  <r.icon className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{r.label}</span>
                </div>
                <div className="grid flex-1 gap-[2px]" style={cols}>
                  {periods.map((p, i) => {
                    const v = r.value(p, monthOf(p))
                    return (
                      <button
                        key={p.decade ?? p.week ?? i}
                        onMouseEnter={() => setHover(i)}
                        onFocus={() => setHover(i)}
                        onClick={() => setHover(i)}
                        aria-label={`${unit} of ${dateShort(p.starts)}: ${v == null ? `${r.label}, no data` : r.describe(p, monthOf(p))}`}
                        className={cn('h-7 cursor-pointer rounded-[4px] transition-transform hover:scale-y-110', i === hover && 'ring-1 ring-ink/40', v == null && 'border border-dashed border-line-strong')}
                        style={{ background: v == null ? 'transparent' : v > 0.02 ? `color-mix(in srgb, ${r.color} ${Math.round(12 + v * 88)}%, transparent)` : 'var(--surface-2)' }}
                      />
                    )
                  })}
                </div>
              </div>
            ))}
            {/* Hoy */}
            <div className="pointer-events-none absolute inset-y-[-6px] left-[132px] right-0">
              <div className="relative h-full" style={{ marginLeft: `${((today + 0.5) / n) * 100}%` }}>
                <div className="absolute inset-y-0 w-[2px] -translate-x-1/2 rounded-full bg-ink" />
                <div className="absolute -top-5 -translate-x-1/2 rounded-full bg-ink px-1.5 py-0.5 text-[10px] font-semibold text-page">Today</div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
      {/* Detalle del periodo */}
      <motion.div key={hover} initial={{ opacity: 0.4, y: 4 }} animate={{ opacity: 1, y: 0 }} className="mt-4 rounded-2xl bg-surface-2 p-4">
        <div className="text-sm font-semibold text-ink">
          {unit} of {dateShort(hw.starts)} {hover === today && <span className="ml-1 font-normal text-muted">({decadal ? 'current period' : 'this week'})</span>}
        </div>
        <div className="mt-2 grid gap-x-6 gap-y-1.5 text-sm text-ink-2 sm:grid-cols-2">
          {rows.map((r) => {
            const v = r.value(hw, monthOf(hw))
            return (
              <div key={r.key} className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: r.color }} />
                {v == null ? `${r.label}: no data` : r.describe(hw, monthOf(hw))}
              </div>
            )
          })}
          {hw.mean_tmin_c != null && hw.mean_tmax_c != null && (
            <div className="flex items-center gap-2 sm:col-span-2">
              <span className="h-2.5 w-2.5 shrink-0" />
              Typical temperature: {hw.mean_tmin_c} °C to {hw.mean_tmax_c} °C
            </div>
          )}
        </div>
        {hw.vulnerable && !!hw.vulnerable_reasons?.length && <p className="mt-3 text-sm font-medium text-bad">Vulnerable period: {hw.vulnerable_reasons.map((r) => r.replaceAll('_', ' ')).join(', ')}</p>}
      </motion.div>
      <p className="mt-3 text-xs text-muted">
        More intense = more years with that event in that {decadal ? 'period' : 'week'} ({profile.climate.years.join('–')}). {decadal ? '36 periods per year: days 1–10, 11–20 and 21 to month end. ' : ''}Dashed cells have no data. Tap a {decadal ? 'period' : 'week'} to see the details.
      </p>
    </div>
  )
}
