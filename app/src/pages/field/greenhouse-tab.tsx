import { motion } from 'motion/react'
import { CircleAlert, CloudHail, Flame, Leaf, RefreshCw, Sun, Wind } from 'lucide-react'
import type { Field } from '@/api/types'
import { HeatingChart, LightChart } from '@/components/charts/monthly-charts'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, Stagger } from '@/components/ui/card'
import { fadeUp } from '@/components/ui/motion'
import { StatusIcon, StatusPill } from '@/components/ui/status'
import { useGreenhouse } from '@/hooks/api'
import { monthRange, num, oneIn } from '@/lib/format'

function WindScale({ rated, levels }: { rated: number | null; levels: { return_period_years: number; estimated_gust_kmh: number | null }[] }) {
  const max = Math.max(rated ?? 0, ...levels.map((l) => l.estimated_gust_kmh ?? 0)) * 1.2 || 1
  const x = (v: number) => `${(v / max) * 100}%`
  return (
    <div className="pt-8 pb-2">
      <div className="relative h-3 rounded-full" style={{ background: 'linear-gradient(90deg, color-mix(in srgb, var(--good) 35%, transparent), color-mix(in srgb, var(--warn) 45%, transparent), color-mix(in srgb, var(--bad) 45%, transparent))' }}>
        {levels.map((l, i) => (
          <motion.div key={l.return_period_years} className="absolute top-1/2" style={{ left: x(l.estimated_gust_kmh ?? 0) }} initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 + i * 0.12 }}>
            <div className="grid h-5 w-5 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 border-surface bg-ink text-[9px] font-bold text-page shadow">{i + 1}</div>
          </motion.div>
        ))}
        {rated != null && (
          <motion.div className="absolute -top-7 bottom-[-6px]" style={{ left: x(rated) }} initial={{ scaleY: 0 }} animate={{ scaleY: 1 }} transition={{ delay: 0.6 }}>
            <div className="h-full w-[3px] -translate-x-1/2 rounded-full bg-accent" />
            <div className="absolute -top-1 left-2 rounded-full bg-accent px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap text-accent-ink">Your structure: {rated} km/h</div>
          </motion.div>
        )}
      </div>
      <div className="mt-6 flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-ink-2">
        {levels.map((l, i) => (
          <span key={l.return_period_years} className="inline-flex items-center gap-2">
            <span className="grid h-4 w-4 place-items-center rounded-full bg-ink text-[9px] font-bold text-page">{i + 1}</span>
            <b className="tabular font-semibold text-ink">{num(l.estimated_gust_kmh)} km/h</b> once every {l.return_period_years} years
          </span>
        ))}
      </div>
    </div>
  )
}

export function GreenhouseTab({ field }: { field: Field }) {
  const gh = useGreenhouse(field.id, true)
  if (gh.isError)
    return (
      <div className="card mx-auto max-w-lg p-8 text-center">
        <h2 className="font-semibold text-ink">We could not evaluate the greenhouse</h2>
        <p role="alert" className="mt-2 text-sm text-ink-2">{gh.error.message}</p>
        <Button className="mt-5" variant="outline" onClick={() => gh.refetch()}>
          <RefreshCw className="h-4 w-4" /> Retry
        </Button>
      </div>
    )
  if (!gh.data) return <div className="skeleton h-96" />
  const g = gh.data
  const exceed = g.wind.annual_exceedance_probability
  const status = g.wind.status ?? 'unknown'
  return (
    <Stagger className="grid gap-4 lg:grid-cols-2">
      <Card className="lg:col-span-2">
        <CardHeader
          title="Can your structure withstand the wind?"
          subtitle={`Expected maximum gusts.${g.wind.riskiest_months.length ? ` Windiest months: ${monthRange(g.wind.riskiest_months.slice().sort((a, b) => a - b))}.` : ''}`}
          icon={<Wind className="h-4 w-4" />}
          action={<StatusPill level={status} label={status === 'ok' ? 'Resists' : status === 'warn' ? 'Near its limit' : status === 'bad' ? 'At risk' : 'No rating'} />}
        />
        {g.wind.return_levels_kmh?.length ? <WindScale rated={g.wind.structure_rated_kmh} levels={g.wind.return_levels_kmh} /> : <p className="py-4 text-sm text-muted">The wind record is too short to estimate return levels.</p>}
        <p className="text-sm text-ink-2">
          {exceed == null ? 'Enter the wind speed your structure is rated for to calculate risk.' : <>Wind could exceed your structure’s rating <b className="text-ink">{oneIn(exceed)}</b>.</>} {g.wind.note}
        </p>
        {g.wind.years_used != null && (
          <p className="mt-2 text-xs text-muted">
            {g.wind.years_used} complete years · gust factor {g.wind.gust_factor_assumed}
            {g.wind.daily_origin ? ` · ${g.wind.daily_origin}` : ''}
          </p>
        )}
      </Card>

      {g.light && (
        <Card>
          <CardHeader title="Light for your plants" subtitle={`Daily light integral. The cover lets through ~${Math.round(g.light.cover_transmission * 100)} %.`} icon={<Sun className="h-4 w-4" />} />
          <LightChart light={g.light} />
        </Card>
      )}

      {g.temperature && (
        <Card>
          <CardHeader title="Heating requirement" subtitle="Degree-hours below 12°C each month: higher = colder at night." icon={<Flame className="h-4 w-4" />} />
          <HeatingChart temperature={g.temperature} />
        </Card>
      )}

      {g.co2 && (
        <motion.div variants={fadeUp} className="card p-5">
          <CardHeader title="CO₂" subtitle={g.co2.note} icon={<Leaf className="h-4 w-4" />} />
          <div className="relative mt-2 h-3 rounded-full bg-surface-3">
            <motion.div className="absolute inset-y-0 left-0 rounded-full bg-s3" initial={{ width: 0 }} animate={{ width: `${(g.co2.ambient_ppm / 1200) * 100}%` }} transition={{ duration: 0.9 }} />
            <div className="absolute inset-y-[-4px] rounded-full bg-good/25 ring-1 ring-good/50" style={{ left: `${(800 / 1200) * 100}%`, width: `${(200 / 1200) * 100}%` }} />
          </div>
          <div className="mt-2 flex justify-between text-xs text-ink-2">
            <span>
              Outside: <b className="text-ink">{g.co2.ambient_ppm} ppm</b>
            </span>
            <span>
              Ideal for enriching: {g.co2.typical_enrichment_target_ppm[0]}–{g.co2.typical_enrichment_target_ppm[1]} ppm
            </span>
          </div>
        </motion.div>
      )}

      <motion.div variants={fadeUp} className="card p-5">
        <CardHeader
          title={g.hail ? 'Hail' : 'Recommendations'}
          subtitle={g.hail ? (g.hail.months_of_concern.length ? `Season with risk: ${monthRange(g.hail.months_of_concern)}. Low evidence.` : 'No clear sign of hail.') : g.confidence ? `Confidence: ${g.confidence}` : undefined}
          icon={g.hail ? <CloudHail className="h-4 w-4" /> : <Leaf className="h-4 w-4" />}
          action={g.hail ? <StatusPill level={g.hail.level === 'high' ? 'bad' : g.hail.level === 'medium' ? 'warn' : 'ok'} label={g.hail.level === 'low' ? 'Low' : g.hail.level === 'medium' ? 'Medium' : 'High'} /> : undefined}
        />
        <ul className="space-y-2">
          {g.recommendations.map((r) => (
            <li key={r} className="flex items-start gap-2 text-sm text-ink-2">
              <StatusIcon level="ok" className="mt-0.5" /> {r}
            </li>
          ))}
        </ul>
      </motion.div>

      {!!g.gaps?.length && (
        <motion.div variants={fadeUp} className="card p-5">
          <CardHeader title="What we could not measure" icon={<CircleAlert className="h-4 w-4" />} />
          <ul className="space-y-2">
            {g.gaps.map((gap) => (
              <li key={gap.code} className="flex items-start gap-2 text-sm text-ink-2">
                <StatusIcon level={gap.severity === 'high' ? 'bad' : 'warn'} className="mt-0.5" /> {gap.message}
              </li>
            ))}
          </ul>
        </motion.div>
      )}
    </Stagger>
  )
}
