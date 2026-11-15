import { motion } from 'motion/react'
import { Beef, Droplet, Droplets, MapPin, Waves } from 'lucide-react'
import { capabilities } from '@/api/client'
import type { Field, FieldProfile } from '@/api/types'
import { WaterBalanceChart } from '@/components/charts/monthly-charts'
import { AnimatedNumber } from '@/components/ui/animated-number'
import { Card, CardHeader, Stagger } from '@/components/ui/card'
import { fadeUp } from '@/components/ui/motion'
import { StatusIcon, StatusPill } from '@/components/ui/status'
import { useWaterQuality } from '@/hooks/api'
import { monthShort, num } from '@/lib/format'

const LEVEL_LABEL = { unknown: 'No data', ok: 'Good', warn: 'With care', bad: 'Not suitable' } as const
const SM_LABEL: Record<string, string> = { smap: 'SMAP, estimated', era5_land: 'ERA5-Land, 2015–2024', nasa_power: 'NASA POWER' }

export function WaterTab({ field, profile }: { field: Field; profile: FieldProfile }) {
  const wq = useWaterQuality(field.id, capabilities.waterQuality)
  const gw = profile.water.groundwater
  const balance = profile.water.water_balance_by_month
  const deficitMonths = balance.filter((b) => b.p_minus_et0_mm < 0).length
  const moisture = profile.water.soil_moisture
  // El backend da la humedad como percentil de la zona (0–100); el modo demostración en m³/m³.
  const percentile = !!moisture?.by_month.some((m) => m.percentile_p50 != null)
  const sm = (moisture?.by_month ?? []).map((m) => ({ month: m.month, v: (percentile ? m.percentile_p50 : m.mean_m3_m3) ?? null, p10: m.percentile_p10 ?? null, p90: m.percentile_p90 ?? null }))
  const smMax = percentile ? 100 : Math.max(0.01, ...sm.map((s) => s.v ?? 0))
  const smSource = moisture ? (SM_LABEL[moisture.source_id] ?? profile.sources.find((s) => s.id === moisture.source_id)?.dataset ?? moisture.source_id) : null

  return (
    <Stagger className="grid gap-4 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader
          title="Monthly water surplus or deficit"
          subtitle={`Millimeters: rain minus what the sun and wind evaporate. Water deficit in ${deficitMonths} out of 12 months.`}
          icon={<Droplets className="h-4 w-4" />}
        />
        {balance.length ? <WaterBalanceChart water={profile.water} /> : <p className="text-sm text-ink-2">No water balance available for this zone.</p>}
        {profile.water.et && <p className="mt-2 text-xs text-muted">Evaporation: {profile.sources.find((s) => s.id === profile.water.et?.source_id)?.dataset ?? profile.water.et.source_id}.</p>}
      </Card>

      <div className="grid gap-4">
        <motion.div variants={fadeUp} className="card p-5">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-sm text-ink-2">
              <Waves className="h-4 w-4" /> Groundwater
            </span>
            {gw ? <StatusPill level={gw.trend_cm_per_year < -1 ? 'bad' : gw.trend_cm_per_year < 0 ? 'warn' : 'ok'} label={gw.trend_cm_per_year < 0 ? 'Declining' : 'Stable'} /> : <StatusPill level="warn" label="No data" />}
          </div>
          {gw ? (
            <>
              <div className="mt-3 text-[28px] leading-none font-semibold text-ink">
                <AnimatedNumber value={gw.trend_cm_per_year} digits={1} /> <span className="text-lg font-medium text-ink-2">cm/year</span>
              </div>
              <p className="mt-2 text-sm text-ink-2">Change in water stored in the region since {gw.years[0]} (GRACE-FO satellites). It's a trend of ~300 km, not your well.</p>
            </>
          ) : (
            <p className="mt-3 text-sm text-ink-2">
              We don't show a number we can't measure: the satellite aquifer trend (GRACE-FO) is not available for this zone. Check the official availability of your aquifer with CONAGUA (Mexico) or USGS (USA).
            </p>
          )}
        </motion.div>
        <motion.div variants={fadeUp} className="card p-5">
          <span className="flex items-center gap-2 text-sm text-ink-2">
            <Droplet className="h-4 w-4" /> Soil moisture{smSource ? ` (${smSource})` : ''}
          </span>
          {!sm.length ? (
            <p className="mt-3 text-sm text-ink-2">No data for this point.</p>
          ) : (
            <>
              <div className="mt-4 flex h-24 items-end gap-1">
                {sm.map((s, i) => (
                  <div
                    key={s.month}
                    className="flex flex-1 flex-col items-center gap-1"
                    title={`${monthShort(s.month)}: ${s.v == null ? 'no data' : percentile ? `percentile ${num(s.v)}${s.p10 != null && s.p90 != null ? ` (${num(s.p10)}–${num(s.p90)})` : ''}` : `${s.v} m³/m³`}`}
                  >
                    <motion.div
                      className="w-full max-w-[18px] rounded-t-[4px] bg-s1"
                      initial={{ height: 0 }}
                      animate={{ height: `${((s.v ?? 0) / smMax) * 72}px` }}
                      transition={{ delay: i * 0.03, type: 'spring', stiffness: 200, damping: 22 }}
                    />
                    <span className="text-[10px] text-muted">{monthShort(s.month)[0].toUpperCase()}</span>
                  </div>
                ))}
              </div>
              {percentile && <p className="mt-2 text-xs text-muted">Percentile of this zone and season (0–100): higher = wetter than usual.</p>}
            </>
          )}
        </motion.div>
      </div>

      <Card className="lg:col-span-3">
        <CardHeader title="Water quality" subtitle="What the nearest monitoring station says. For livestock and to irrigate." icon={<Beef className="h-4 w-4" />} />
        {!capabilities.waterQuality ? (
          <p className="text-sm text-ink-2">There is no water quality station connected for this zone yet. An analysis of your well is the best source.</p>
        ) : wq.isLoading ? (
          <div className="skeleton h-48" />
        ) : wq.isError ? (
          <p role="alert" className="text-sm text-bad">{wq.error.message}</p>
        ) : !wq.data ? (
          <p className="text-sm text-ink-2">There is no water quality station within 80 km. An analysis of your well is the best source.</p>
        ) : (
          <div className="grid gap-5 lg:grid-cols-[1fr_1.4fr]">
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm text-ink-2">
                <MapPin className="h-4 w-4" /> {wq.data.station.name} · {num(wq.data.station.distance_km, 1)} km · {wq.data.station.type}
              </div>
              {[
                { title: 'For livestock', s: wq.data.livestock_summary },
                { title: 'For irrigation', s: wq.data.irrigation_summary },
              ].map(({ title, s }) => (
                <div key={title} className="rounded-2xl bg-surface-2 p-4">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-ink">{title}</span>
                    <StatusPill level={s.status} label={LEVEL_LABEL[s.status]} />
                  </div>
                  <p className="mt-1.5 text-sm text-ink-2">{s.message}</p>
                </div>
              ))}
              <ul className="space-y-1.5 pt-1">
                {wq.data.recommendations.map((r) => (
                  <li key={r} className="flex gap-2 text-sm text-ink-2">
                    <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-muted" /> {r}
                  </li>
                ))}
              </ul>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs text-muted">
                    <th className="py-2 font-medium">Parameter</th>
                    <th className="py-2 text-right font-medium">Value</th>
                    <th className="py-2 pl-4 font-medium">Cattle</th>
                    <th className="py-2 font-medium">Irrigation</th>
                  </tr>
                </thead>
                <tbody>
                  {wq.data.parameters.map((p, i) => (
                    <motion.tr key={p.code} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.04 }} className="border-b border-line last:border-0">
                      <td className="py-2.5 text-ink">{p.name}</td>
                      <td className="tabular py-2.5 text-right whitespace-nowrap text-ink">
                        {num(p.value, p.value < 10 ? 1 : 0)} <span className="text-xs text-muted">{p.unit}</span>
                      </td>
                      <td className="py-2.5 pl-4">
                        <span className="inline-flex items-center gap-1.5 text-ink-2">
                          <StatusIcon level={p.livestock} /> {LEVEL_LABEL[p.livestock]}
                        </span>
                      </td>
                      <td className="py-2.5">
                        <span className="inline-flex items-center gap-1.5 text-ink-2">
                          <StatusIcon level={p.irrigation} /> {LEVEL_LABEL[p.irrigation]}
                        </span>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
              <ul className="mt-3 space-y-1 text-xs text-muted">
                {wq.data.gaps.map((g) => (
                  <li key={g.code}>· {g.message}</li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </Card>
    </Stagger>
  )
}
