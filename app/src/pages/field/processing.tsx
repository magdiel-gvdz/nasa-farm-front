import { AnimatePresence, motion } from 'motion/react'
import { Check, Circle, Loader2, X } from 'lucide-react'
import type { ProfileStep } from '@/api/types'
import { cn } from '@/lib/cn'

const LABELS: Record<string, { title: string; detail: string }> = {
  locate: { title: 'Your field', detail: 'Boundary, area and analysis cell' },
  nasa_power: { title: '35 year climate', detail: 'NASA POWER · frost, heat, wind and light' },
  gpm_imerg: { title: 'Rains', detail: 'GPM IMERG · season and downpours' },
  risk_calendar: { title: 'Risk calendar', detail: 'Frost, heat, heavy rain and wind, period by period' },
  soilgrids: { title: 'Soil', detail: 'SoilGrids / SSURGO · organic matter, pH, texture' },
  srtm: { title: 'Land', detail: 'SRTM slope and cold shoals' },
  copernicus_dem: { title: 'Terrain', detail: 'Copernicus DEM 90 m · slope and cold hollows' },
  copernicus_dem_glo90: { title: 'Terrain', detail: 'Copernicus DEM 90 m · elevation and slope' },
  modis_ndvi: { title: 'Vegetation', detail: 'MODIS · months with bare soil' },
  smap: { title: 'Soil moisture', detail: 'SMAP · anomalies and drought' },
  grace_fo: { title: 'Groundwater', detail: 'GRACE-FO aquifer trend' },
  water_balance: { title: 'Water balance', detail: 'Rain minus reference evaporation (FAO-56)' },
  ghcn: { title: 'Weather stations', detail: 'NOAA GHCN · corrects frost and rain with measured data' },
  ssurgo: { title: 'Soil', detail: 'USDA SSURGO · field soil survey' },
  era5: { title: 'Evaporation, humidity and gusts', detail: 'ERA5 / ERA5-Land · FAO-56 ET₀ and wind' },
  cmip6_highresmip: { title: 'Future climate', detail: 'CMIP6 · 7 models, 2031–2050' },
  water_quality: { title: 'Water quality', detail: 'Nearest monitoring station' },
  cdl: { title: 'Past crops', detail: 'USDA Cropland Data Layer 2016–2025' },
  crops: { title: 'Crops and rotations', detail: 'Suitability by crop and planting month' },
}

export function Processing({ steps, subtitle = 'We are consulting NASA satellites, climate records and soil maps. It takes a few seconds.' }: { steps: ProfileStep[]; subtitle?: string }) {
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
        <p className="mt-1 text-sm text-ink-2">{subtitle}</p>
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
