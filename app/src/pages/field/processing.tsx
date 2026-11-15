import { AnimatePresence, motion } from 'motion/react'
import { Check, Circle, Loader2, X } from 'lucide-react'
import type { ProfileStep } from '@/api/types'
import { cn } from '@/lib/cn'

const LABELS: Record<string, { title: string; detail: string }> = {
  nasa_power: { title: '35 year climate', detail: 'NASA POWER · frost, heat, wind and light' },
  gpm_imerg: { title: 'Rains', detail: 'GPM IMERG · season and downpours' },
  soilgrids: { title: 'Soil', detail: 'SoilGrids / SSURGO · organic matter, pH, texture' },
  srtm: { title: 'Land', detail: 'SRTM slope and cold shoals' },
  modis_ndvi: { title: 'Vegetation', detail: 'MODIS · months with bare soil' },
  smap: { title: 'Soil moisture', detail: 'SMAP · anomalies and drought' },
  grace_fo: { title: 'Groundwater', detail: 'GRACE-FO aquifer trend' },
}

export function Processing({ steps }: { steps: ProfileStep[] }) {
  const done = steps.filter((s) => s.status === 'done').length
  const progress = steps.length ? done / steps.length : 0.05
  return (
    <div className="mx-auto grid max-w-3xl items-center gap-10 py-6 md:grid-cols-[1fr_1.2fr]">
      <div className="relative mx-auto aspect-square w-56">
        {/* Radar animado */}
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="absolute inset-0 rounded-full border border-accent/40"
            initial={{ scale: 0.3, opacity: 0.8 }}
            animate={{ scale: 1, opacity: 0 }}
            transition={{ duration: 2.4, repeat: Infinity, delay: i * 0.8, ease: 'easeOut' }}
          />
        ))}
        <motion.div
          className="absolute inset-4 rounded-full"
          style={{ background: 'conic-gradient(from 0deg, color-mix(in srgb, var(--accent) 40%, transparent), transparent 30%)' }}
          animate={{ rotate: 360 }}
          transition={{ duration: 2.6, repeat: Infinity, ease: 'linear' }}
        />
        <div className="absolute inset-[30%] grid place-items-center rounded-full bg-surface ring-1 ring-line">
          <span className="tabular text-2xl font-semibold text-ink">{Math.round(progress * 100)}%</span>
        </div>
      </div>
      <div>
        <h2 className="text-xl font-semibold tracking-tight text-ink">Analyzing your field…</h2>
        <p className="mt-1 text-sm text-ink-2">We are consulting NASA satellites. It takes a few seconds.</p>
        <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-surface-3">
          <motion.div className="h-full rounded-full bg-accent" animate={{ width: `${Math.max(6, progress * 100)}%` }} transition={{ type: 'spring', stiffness: 120, damping: 20 }} />
        </div>
        <ul className="mt-5 space-y-2.5">
          <AnimatePresence initial={false}>
            {(steps.length ? steps : [{ source_id: 'nasa_power', status: 'running' } as ProfileStep]).map((s, i) => {
              const l = LABELS[s.source_id] ?? { title: s.source_id, detail: '' }
              return (
                <motion.li key={s.source_id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }} className="flex items-center gap-3">
                  <span
                    className={cn(
                      'grid h-7 w-7 shrink-0 place-items-center rounded-full',
                      s.status === 'done' ? 'bg-accent text-accent-ink' : s.status === 'failed' ? 'bg-bad/15 text-bad' : 'bg-surface-2 text-muted',
                    )}
                  >
                    {s.status === 'done' ? (
                      <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }}>
                        <Check className="h-4 w-4" strokeWidth={3} />
                      </motion.span>
                    ) : s.status === 'running' ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : s.status === 'failed' ? (
                      <X className="h-4 w-4" />
                    ) : (
                      <Circle className="h-2 w-2 fill-current" />
                    )}
                  </span>
                  <div className="min-w-0">
                    <div className={cn('text-sm font-medium', s.status === 'pending' ? 'text-muted' : 'text-ink')}>{l.title}</div>
                    <div className="truncate text-xs text-muted">{s.message ?? l.detail}</div>
                  </div>
                </motion.li>
              )
            })}
          </AnimatePresence>
        </ul>
      </div>
    </div>
  )
}
