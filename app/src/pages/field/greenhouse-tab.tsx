import type { Field } from '@/api/types'
import { HeatingChart, LightChart } from '@/components/charts/monthly-charts'
import { Card, CardHeader, Stagger } from '@/components/ui/card'
import { StatusPill } from '@/components/ui/status'
import { Button } from '@/components/ui/button'
import { useGreenhouse } from '@/hooks/api'
import { monthRange, num, pct } from '@/lib/format'

export function GreenhouseTab({ field }: { field: Field }) {
  const query = useGreenhouse(field.id, true)
  if (query.isError) return <div className="card p-5"><p role="alert" className="text-sm text-bad">{query.error.message}</p><Button onClick={() => query.refetch()} className="mt-3">Retry</Button></div>
  if (!query.data) return <div className="skeleton h-96" />
  const g = query.data
  return <Stagger className="grid gap-4 lg:grid-cols-2">
    <Card className="lg:col-span-2">
      <CardHeader title="Wind risk for your structure" subtitle={`Windiest months: ${monthRange(g.wind.riskiest_months)}`} action={<StatusPill level={g.wind.status ?? 'unknown'} />} />
      <p className="text-sm">Structure rating: {num(g.wind.structure_rated_kmh)} km/h · Annual exceedance probability: {pct(g.wind.annual_exceedance_probability)}</p>
      {g.wind.return_levels_kmh ? <div className="mt-4 grid gap-3 sm:grid-cols-3">{g.wind.return_levels_kmh.map((l) => <div key={l.return_period_years} className="rounded-xl bg-surface-2 p-4"><div className="text-xs text-muted">{l.return_period_years}-year return level</div><div className="mt-1 text-xl font-semibold">{num(l.estimated_gust_kmh)} km/h</div></div>)}</div> : <p className="mt-3 text-sm text-muted">The wind record is too short to estimate return levels.</p>}
      <p className="mt-4 text-sm text-ink-2">{g.wind.note}</p>
      {g.wind.years_used != null && <p className="mt-2 text-xs text-muted">Complete years: {g.wind.years_used} · Assumed gust factor: {g.wind.gust_factor_assumed} · Origin: {g.wind.daily_origin ?? 'unavailable'}</p>}
    </Card>
    <Card><CardHeader title="Recommendations" /><ul className="space-y-2 text-sm">{g.recommendations.map((r) => <li key={r}>{r}</li>)}</ul>{g.confidence && <p className="mt-3 text-xs text-muted">Confidence: {g.confidence}</p>}</Card>
    {g.gaps && <Card><CardHeader title="Data gaps" /><ul className="space-y-2 text-sm text-ink-2">{g.gaps.map((gap) => <li key={gap.code}>{gap.message}</li>)}</ul></Card>}
    {g.light && <Card><CardHeader title="Light" /><LightChart light={g.light} /></Card>}
    {g.temperature && <Card><CardHeader title="Heating" /><HeatingChart temperature={g.temperature} /></Card>}
    {g.co2 && <Card><CardHeader title="CO₂" /><p>{g.co2.note}</p></Card>}
    {g.hail && <Card><CardHeader title="Hail" /><p>{g.hail.level} · {monthRange(g.hail.months_of_concern)}</p></Card>}
  </Stagger>
}
