import { motion } from 'motion/react'
import { CloudSun, Droplets, Telescope, Thermometer } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { Scenario } from '@/api/types'
import { Slider } from '@/components/ui/slider'
import { useFutureClimate } from '@/hooks/api'
import { cn } from '@/lib/cn'
import { signed } from '@/lib/format'

const PRESETS: { label: string; s: Scenario }[] = [
  { label: 'Current climate', s: { delta_t_c: 0, delta_p_pct: 0 } },
  { label: 'Warmer', s: { delta_t_c: 2, delta_p_pct: 0 } },
  { label: 'Drier', s: { delta_t_c: 0, delta_p_pct: -20 } },
  { label: 'Heat and drought', s: { delta_t_c: 2, delta_p_pct: -20 } },
]

/** "What if the climate changes?" — sliders con rebote (debounce) para no saturar al servidor. */
export function ScenarioControl({ value, onChange, compact, fieldId }: { value: Scenario; onChange: (s: Scenario) => void; compact?: boolean; fieldId?: string }) {
  const [local, setLocal] = useState(value)
  const future = useFutureClimate(fieldId ?? '', !!fieldId).data
  // Si el escenario cambia desde fuera (otra pestaña), se sincroniza al renderizar.
  const [prev, setPrev] = useState(value)
  if (prev !== value) {
    setPrev(value)
    setLocal(value)
  }
  useEffect(() => {
    if (local.delta_t_c === value.delta_t_c && local.delta_p_pct === value.delta_p_pct) return
    const t = setTimeout(() => onChange(local), 220)
    return () => clearTimeout(t)
  }, [local, value, onChange])

  const active = local.delta_t_c !== 0 || local.delta_p_pct !== 0
  return (
    <div className={cn('card p-5', active && 'ring-2 ring-accent/50')}>
      <div className="flex flex-wrap items-center gap-3">
        <div className="grid h-9 w-9 place-items-center rounded-xl bg-surface-2 text-ink-2">
          <CloudSun className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-[15px] font-semibold text-ink">What if the climate changes?</h3>
          <p className="text-sm text-ink-2">Adjust the sliders and watch the recommendations change.</p>
        </div>
        {active && (
          <motion.span initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="rounded-full bg-accent-soft px-2.5 py-1 text-xs font-medium text-ink">
            Active scenario
          </motion.span>
        )}
      </div>
      <div className="mt-4 flex flex-wrap gap-1.5">
        {future && (
          <button
            onClick={() => setLocal(future.scenario)}
            title={`Median ${future.models.length} CMIP6 climate models for ${future.period.join('–')}`}
            className={cn(
              'inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1 text-sm transition-colors',
              future.scenario.delta_t_c === local.delta_t_c && future.scenario.delta_p_pct === local.delta_p_pct ? 'border-accent bg-accent-soft text-ink' : 'border-line text-ink-2 hover:bg-surface-2',
            )}
          >
            <Telescope className="h-3.5 w-3.5" /> Projection {future.period[0]}–{future.period[1]}
          </button>
        )}
        {PRESETS.map((p) => {
          const on = p.s.delta_t_c === local.delta_t_c && p.s.delta_p_pct === local.delta_p_pct
          return (
            <button
              key={p.label}
              onClick={() => setLocal(p.s)}
              className={cn('cursor-pointer rounded-full border px-3 py-1 text-sm transition-colors', on ? 'border-accent bg-accent-soft text-ink' : 'border-line text-ink-2 hover:bg-surface-2')}
            >
              {p.label}
            </button>
          )
        })}
      </div>
      <p className="mt-3 text-xs text-muted">Hypothetical sensitivity scenario. It is not a weather forecast.</p>
      <div className={cn('mt-5 grid gap-5', !compact && 'sm:grid-cols-2')}>
        <Slider label="Temperature" icon={<Thermometer className="h-4 w-4" />} value={local.delta_t_c} min={-2} max={5} step={0.5} onChange={(v) => setLocal((s) => ({ ...s, delta_t_c: v }))} format={(v) => `${signed(v, 1)} °C`} />
        <Slider label="Rain" icon={<Droplets className="h-4 w-4" />} value={local.delta_p_pct} min={-50} max={50} step={5} onChange={(v) => setLocal((s) => ({ ...s, delta_p_pct: v }))} format={(v) => `${signed(v)} %`} />
      </div>
    </div>
  )
}
