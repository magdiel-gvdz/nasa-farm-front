import { motion } from 'motion/react'
import { Beef, Droplet, Droplets, MapPin, Waves } from 'lucide-react'
import type { Field, FieldProfile } from '@/api/types'
import { WaterBalanceChart } from '@/components/charts/monthly-charts'
import { AnimatedNumber } from '@/components/ui/animated-number'
import { Card, CardHeader, Stagger } from '@/components/ui/card'
import { fadeUp } from '@/components/ui/motion'
import { StatusIcon, StatusPill } from '@/components/ui/status'
import { useWaterQuality } from '@/hooks/api'
import { monthShort, num } from '@/lib/format'

const LEVEL_LABEL = { ok: 'Good', warn: 'With care', bad: 'Not suitable' } as const

export function WaterTab({ field, profile }: { field: Field; profile: FieldProfile }) {
  const wq = useWaterQuality(field.id, true)
  const gw = profile.water.groundwater
  const deficitMonths = profile.water.water_balance_by_month.filter((b) => b.p_minus_et0_mm < 0).length
  const sm = profile.water.soil_moisture.by_month
  const smMax = Math.max(...sm.map((s) => s.mean_m3_m3))

  return (
    <Stagger className="grid gap-4 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader title="Monthly water surplus or deficit" subtitle={`Millimeters: rain minus what the sun and wind evaporate. Water deficit in ${deficitMonths} out of 12 months.`} icon={<Droplets className="h-4 w-4" />} />
        <WaterBalanceChart water={profile.water} />
      </Card>

      <div className="grid gap-4">
        <motion.div variants={fadeUp} className="card p-5">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-sm text-ink-2">
              <Waves className="h-4 w-4" /> Groundwater
            </span>
            <StatusPill level={gw.trend_cm_per_year < -1 ? 'bad' : gw.trend_cm_per_year < 0 ? 'warn' : 'ok'} label={gw.trend_cm_per_year < 0 ? 'Declining' : 'Stable'} />
          </div>
          <div className="mt-3 text-[28px] leading-none font-semibold text-ink">
            <AnimatedNumber value={gw.trend_cm_per_year} digits={1} /> <span className="text-lg font-medium text-ink-2">cm/year</span>
          </div>
          <p className="mt-2 text-sm text-ink-2">
            Change in water stored in the region since {gw.years[0]} (GRACE-FO satellites). It's a trend of ~300 km, not your well.
          </p>
        </motion.div>
        <motion.div variants={fadeUp} className="card p-5">
          <span className="flex items-center gap-2 text-sm text-ink-2">
            <Droplet className="h-4 w-4" /> Soil moisture (SMAP)
          </span>
          <div className="mt-4 flex h-24 items-end gap-1">
            {sm.map((s, i) => (
              <div key={s.month} className="flex flex-1 flex-col items-center gap-1" title={`${monthShort(s.month)}: ${s.mean_m3_m3} m³/m³`}>
                <motion.div
                  className="w-full max-w-[18px] rounded-t-[4px] bg-s1"
                  initial={{ height: 0 }}
                  animate={{ height: `${(s.mean_m3_m3 / smMax) * 72}px` }}
                  transition={{ delay: i * 0.03, type: 'spring', stiffness: 200, damping: 22 }}
                />
                <span className="text-[10px] text-muted">{monthShort(s.month)[0].toUpperCase()}</span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      <Card className="lg:col-span-3">
        <CardHeader title="Water quality" subtitle="What the nearest monitoring station says. For livestock and to irrigate." icon={<Beef className="h-4 w-4" />} />
        {wq.isLoading ? (
          <div className="skeleton h-48" />
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
