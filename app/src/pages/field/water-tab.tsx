import { Droplets } from 'lucide-react'
import { capabilities } from '@/api/client'
import type { Field, FieldProfile } from '@/api/types'
import { WaterBalanceChart } from '@/components/charts/monthly-charts'
import { Card, CardHeader, Stagger } from '@/components/ui/card'
import { useWaterQuality } from '@/hooks/api'
import { monthShort, num } from '@/lib/format'

export function WaterTab({ field, profile }: { field: Field; profile: FieldProfile }) {
  const quality = useWaterQuality(field.id, capabilities.waterQuality)
  const moisture = profile.water.soil_moisture
  const percentile = moisture?.by_month.some((m) => m.percentile_p50 != null)
  const source = profile.sources.find((s) => s.id === moisture?.source_id)
  const groundwater = profile.water.groundwater
  return <Stagger className="grid gap-4 lg:grid-cols-2">
    <Card>
      <CardHeader title="Monthly water balance" subtitle="Rainfall minus reference evaporation, in mm." icon={<Droplets className="h-4 w-4" />} />
      {profile.water.water_balance_by_month.length ? <WaterBalanceChart water={profile.water} /> : <p>No water balance available.</p>}
      {profile.water.et && <p className="mt-2 text-xs text-muted">Evaporation source: {profile.water.et.source_id}</p>}
    </Card>
    <Card>
      <CardHeader title="Soil moisture" subtitle={source?.dataset ?? moisture?.source_id ?? 'No soil moisture source available'} />
      {moisture ? <>
        <p className="mb-3 text-xs text-muted">{percentile ? 'Percentile relative to this cell and season (0–100). P10–P90 is the published range.' : 'Volumetric moisture in m³/m³.'}</p>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">{moisture.by_month.map((m) => <div key={m.month} className="rounded-xl bg-surface-2 p-3 text-sm">
          <div className="text-xs text-muted">{monthShort(m.month)}</div><div className="font-semibold">{num(percentile ? m.percentile_p50 : m.mean_m3_m3, percentile ? 0 : 3)}</div>
          {percentile && <div className="text-xs text-muted">{num(m.percentile_p10)}–{num(m.percentile_p90)}</div>}
        </div>)}</div>
      </> : <p className="text-sm text-muted">No soil moisture data available.</p>}
    </Card>
    <Card><CardHeader title="Groundwater" /><p className="text-sm text-ink-2">{groundwater ? `${num(groundwater.trend_cm_per_year, 1)} cm/year (${groundwater.years.join('–')})` : 'No groundwater source available for this zone.'}</p></Card>
    {capabilities.waterQuality && <Card><CardHeader title="Water quality" />{quality.isError ? <p role="alert">{quality.error.message}</p> : quality.isLoading ? <div className="skeleton h-20" /> : quality.data ? <><p>{quality.data.station.name}</p><p className="mt-2 text-sm">{quality.data.irrigation_summary.message}</p><p className="mt-2 text-sm">{quality.data.livestock_summary.message}</p></> : <p className="text-sm text-muted">No nearby water quality station available.</p>}</Card>}
  </Stagger>
}
