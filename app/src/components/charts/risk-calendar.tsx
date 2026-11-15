import { motion } from 'motion/react'
import { CloudHail, CloudRain, Shovel, Snowflake, Sun, type LucideIcon } from 'lucide-react'
import { useState } from 'react'
import type { FieldProfile, RiskWeek } from '@/api/types'
import { cn } from '@/lib/cn'
import { currentWeek, dateShort, MONTHS_SHORT } from '@/lib/format'

interface Row {
  key: string
  label: string
  icon: LucideIcon
  color: string
  value: (w: RiskWeek, month: number) => number // 0..1
  describe: (w: RiskWeek, month: number) => string
}

export function RiskCalendar({ profile }: { profile: FieldProfile }) {
  const weeks = profile.climate.risk_calendar
  const bare = new Set(profile.vegetation.bare_soil_months)
  const today = currentWeek()
  const [hover, setHover] = useState<number>(today - 1)

  const rows: Row[] = [
    { key: 'frost', label: 'Frost', icon: Snowflake, color: 'var(--s-7)', value: (w) => w.p_frost ?? 0, describe: (w) => `Frost ${Math.round((w.p_frost ?? 0) * 100)} % of years` },
    { key: 'rain', label: 'Rainfall', icon: CloudRain, color: 'var(--s-1)', value: (w) => 1 - (w.p_dry_week ?? 1), describe: (w) => `It's raining ${Math.round((1 - (w.p_dry_week ?? 1)) * 100)} % of years · ${w.mean_prec_mm ?? 0} mm` },
    { key: 'heat', label: 'Heat > 35 °C', icon: Sun, color: 'var(--s-2)', value: (w) => w.p_heat_35c ?? 0, describe: (w) => `Extreme heat ${Math.round((w.p_heat_35c ?? 0) * 100)} % of years` },
    { key: 'hail', label: 'Hail (approx.)', icon: CloudHail, color: 'var(--s-4)', value: (w) => Math.min(1, (w.p_hail_proxy ?? 0) * 4), describe: (w) => ((w.p_hail_proxy ?? 0) > 0 ? 'Season with risk of hail (low evidence)' : 'No hail sign') },
    { key: 'bare', label: 'Bare soil', icon: Shovel, color: 'var(--ink-2)', value: (_w, m) => (bare.has(m) ? 0.55 : 0), describe: (_w, m) => (bare.has(m) ? 'The field is usually left without cultivation' : 'With cultivation or soil cover') },
  ]
  const monthOf = (w: RiskWeek) => +w.starts.slice(0, 2)
  const hw = weeks[hover] ?? weeks[0]

  // Semana de inicio de cada mes para las etiquetas
  const monthStarts = MONTHS_SHORT.map((_, i) => weeks.findIndex((w) => monthOf(w) === i + 1))

  return (
    <div>
      <div className="overflow-x-auto pb-2">
        <div className="min-w-[640px]">
          {/* Meses */}
          <div className="ml-[132px] grid grid-cols-[repeat(52,minmax(0,1fr))] text-[11px] text-muted">
            {monthStarts.map((s, i) => (
              <div key={i} style={{ gridColumnStart: s + 1, gridColumnEnd: (monthStarts[i + 1] ?? 52) + 1 }} className="border-l border-line pl-1">
                {MONTHS_SHORT[i]}
              </div>
            ))}
          </div>
          <motion.div
            className="relative mt-6 space-y-1.5"
            initial={{ clipPath: 'inset(-32px 100% -12px 0)' }}
            animate={{ clipPath: 'inset(-32px 0% -12px 0)' }}
            transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
            onMouseLeave={() => setHover(today - 1)}
          >
            {rows.map((r) => (
              <div key={r.key} className="flex items-center gap-2">
                <div className="flex w-[124px] shrink-0 items-center gap-2 text-xs font-medium text-ink-2">
                  <r.icon className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{r.label}</span>
                </div>
                <div className="grid flex-1 grid-cols-[repeat(52,minmax(0,1fr))] gap-[2px]">
                  {weeks.map((w, i) => {
                    const v = r.value(w, monthOf(w))
                    return (
                      <button
                        key={w.week}
                        onMouseEnter={() => setHover(i)}
                        onFocus={() => setHover(i)}
                        onClick={() => setHover(i)}
                        aria-label={`Week of ${dateShort(w.starts)}: ${r.describe(w, monthOf(w))}`}
                        className={cn('h-7 cursor-pointer rounded-[4px] transition-transform hover:scale-y-110', i === hover && 'ring-1 ring-ink/40')}
                        style={{ background: v > 0.02 ? `color-mix(in srgb, ${r.color} ${Math.round(12 + v * 88)}%, transparent)` : 'var(--surface-2)' }}
                      />
                    )
                  })}
                </div>
              </div>
            ))}
            {/* Hoy */}
            <div className="pointer-events-none absolute inset-y-[-6px] left-[132px] right-0">
              <div className="relative h-full" style={{ marginLeft: `${((today - 0.5) / 52) * 100}%` }}>
                <div className="absolute inset-y-0 w-[2px] -translate-x-1/2 rounded-full bg-ink" />
                <div className="absolute -top-5 -translate-x-1/2 rounded-full bg-ink px-1.5 py-0.5 text-[10px] font-semibold text-page">Today</div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
      {/* Detalle de la semana */}
      <motion.div key={hover} initial={{ opacity: 0.4, y: 4 }} animate={{ opacity: 1, y: 0 }} className="mt-4 rounded-2xl bg-surface-2 p-4">
        <div className="text-sm font-semibold text-ink">
          Week of {dateShort(hw.starts)} {hover === today - 1 && <span className="ml-1 font-normal text-muted">(this week)</span>}
        </div>
        <div className="mt-2 grid gap-x-6 gap-y-1.5 text-sm text-ink-2 sm:grid-cols-2">
          {rows.map((r) => (
            <div key={r.key} className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: r.color }} />
              {r.describe(hw, monthOf(hw))}
            </div>
          ))}
          <div className="flex items-center gap-2 sm:col-span-2">
            <span className="h-2.5 w-2.5 shrink-0" />
            Typical temperature: {hw.mean_tmin_c} °C to {hw.mean_tmax_c} °C
          </div>
        </div>
      </motion.div>
      <p className="mt-3 text-xs text-muted">More intense = more years with that event in that week (1991–2025). Tap a week to see the details.</p>
    </div>
  )
}
