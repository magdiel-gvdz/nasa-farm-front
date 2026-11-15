import { motion } from 'motion/react'
import { ArrowRight, CloudRain, Database, Droplets, Layers, Shovel, Snowflake, Sun, Telescope, Wind, type LucideIcon } from 'lucide-react'
import { capabilities } from '@/api/client'
import type { ReactNode } from 'react'
import type { Field, FieldProfile, Level, Scenario } from '@/api/types'
import { FieldMiniMap } from '@/components/map/field-mini-map'
import { AnimatedNumber } from '@/components/ui/animated-number'
import { Card, CardHeader, Stagger } from '@/components/ui/card'
import { fadeUp } from '@/components/ui/motion'
import { Chip, StatusIcon, StatusPill } from '@/components/ui/status'
import { dateLong, monthName, monthRange, num, signed } from '@/lib/format'
import { useFutureClimate } from '@/hooks/api'
import { Button } from '@/components/ui/button'
import type { TabId } from './field-page'

function Kpi({ icon: Icon, label, value, sub, status, delay = 0 }: { icon: LucideIcon; label: string; value: ReactNode; sub: ReactNode; status?: { level: Level; label: string }; delay?: number }) {
  return (
    <motion.div variants={fadeUp} transition={{ delay }} className="card flex flex-col p-5">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-sm text-ink-2">
          <Icon className="h-4 w-4" /> {label}
        </span>
        {status && <StatusPill level={status.level} label={status.label} />}
      </div>
      <div className="mt-3 text-[28px] leading-none font-semibold tracking-tight text-ink">{value}</div>
      <div className="mt-2 text-sm text-ink-2">{sub}</div>
    </motion.div>
  )
}

interface Insight {
  level: Level
  text: ReactNode
  tab?: TabId
  cta?: string
}

function insights(field: Field, p: FieldProfile): Insight[] {
  const c = p.climate
  const out: Insight[] = []
  const frostFree = (c.frost.share_years_without_frost ?? 0) >= 0.9
  if (!frostFree && c.frost.last_spring_frost?.p90) {
    out.push({
      level: 'warn',
      text: (
        <>
          Plant cold-sensitive crops <b>after {dateLong(c.frost.last_spring_frost?.p90.date)}</b>. Before, 1 in 10 years it still freezes.
        </>
      ),
      tab: 'calendario',
      cta: 'View calendar',
    })
  }
  const total = c.rain.by_month.reduce((a, b) => a + (b.mean_mm ?? 0), 0)
  const rainy = c.rain.by_month.filter((b) => c.rain.rainy_months.includes(b.month)).reduce((a, b) => a + (b.mean_mm ?? 0), 0)
  if (c.rain.rainy_months.length && total > 0) {
    out.push({
      level: total < 500 ? 'warn' : 'ok',
      text: (
        <>
           <b>{Math.round((rainy / total) * 100)} % of rainfall</b> falls during {monthRange(c.rain.rainy_months)}. Outside of those months you depend on irrigation.
        </>
      ),
      tab: 'agua',
      cta: 'See water',
    })
  }
  if ((p.vegetation?.bare_soil_months.length ?? 0) >= 3 && field.kind !== 'greenhouse') {
    out.push({
      level: 'warn',
      text: (
        <>
          Your field is <b>uncovered {p.vegetation!.bare_soil_months.length} months</b> ({monthRange(p.vegetation!.bare_soil_months)}). It's a good window for a cover crop to protect the soil.
        </>
      ),
      tab: 'rotaciones',
      cta: 'View rotations',
    })
  }
  const hot = c.heat.by_month[c.heat.hottest_month - 1]
  if ((hot.mean_days_over_35c ?? 0) >= 2) {
    out.push({
      level: 'warn',
      text: (
        <>
          In <b>{monthName(c.heat.hottest_month)}</b> there are ~{num(hot.mean_days_over_35c)} days above 35 °C: avoid flowering during this period.
        </>
      ),
      tab: 'sembrar',
      cta: 'See crops',
    })
  }
  if (p.water.groundwater && p.water.groundwater.trend_cm_per_year < -0.5) {
    out.push({
      level: 'bad',
      text: (
        <>
          Groundwater in the region <b>declines by {num(Math.abs(p.water.groundwater.trend_cm_per_year), 1)} cm per year</b>. It is advisable to prefer crops that save water.
        </>
      ),
      tab: 'rotaciones',
      cta: 'Compare options',
    })
  }
  if (field.kind === 'greenhouse') {
    out.push({ level: 'warn', text: <>Check how often the wind could exceed what your structure can withstand.</>, tab: 'invernadero', cta: 'See greenhouse' })
  }
  return out.slice(0, 5)
}

function FutureCard({ field, onUse }: { field: Field; onUse: (s: Scenario) => void }) {
  const q = useFutureClimate(field.id)
  const f = q.data
  return (
    <Card className="lg:col-span-2">
      <CardHeader
        title={f ? `Your climate in ${f.period[0]}–${f.period[1]}` : 'Your climate in the future'}
        subtitle={f ? `Median of ${f.models.length} climate models (CMIP6) compared with ${f.baseline[0]}–${f.baseline[1]}` : 'CMIP6 climate model projections'}
        icon={<Telescope className="h-4 w-4" />}
      />
      {q.isError ? (
        <p className="text-sm text-ink-2">{(q.error as Error).message}</p>
      ) : !f ? (
        <div className="skeleton h-28" />
      ) : (
        <>
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ['Temperature', `${signed(f.median.delta_t_c, 1)} °C`, `${signed(f.range.delta_t_c[0], 1)} to ${signed(f.range.delta_t_c[1], 1)}`],
              ['Rain', `${signed(f.median.delta_p_pct)} %`, `${signed(f.range.delta_p_pct[0])} to ${signed(f.range.delta_p_pct[1])} %`],
              ['Days with frost', `${signed(f.median.delta_frost_days)}`, 'per year'],
              ['Days above 35 °C', `${signed(f.median.delta_days_over_35c)}`, 'per year'],
            ].map(([k, v, sub]) => (
              <div key={k} className="rounded-xl bg-surface-2 p-3">
                <dt className="text-xs text-muted">{k}</dt>
                <dd className="tabular mt-0.5 text-lg font-semibold text-ink">{v}</dd>
                <dd className="tabular text-[11px] text-muted">{sub}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 text-sm text-ink-2">{f.note} It's a 20-year trend, not a forecast for next year.</p>
          <Button className="no-print mt-4" variant="outline" size="sm" onClick={() => onUse(f.scenario)}>
            See which crops change <ArrowRight className="h-4 w-4" />
          </Button>
        </>
      )}
    </Card>
  )
}

export function SummaryTab({ field, profile, onNavigate, onScenario }: { field: Field; profile: FieldProfile; onNavigate: (t: TabId) => void; onScenario: (s: Scenario) => void }) {
  const c = profile.climate
  const soil = profile.soil?.layers[0]
  const om = profile.soil?.lab?.om_pct ?? soil?.om_pct ?? null
  const gw = profile.water.groundwater?.trend_cm_per_year ?? null
  const hot = c.heat.by_month[c.heat.hottest_month - 1]
  const frostFree = (c.frost.share_years_without_frost ?? 0) >= 0.9
  const items = insights(field, profile)

  return (
    <Stagger className="grid gap-4 lg:grid-cols-3" step={0.05}>
      <motion.div variants={fadeUp} className="card overflow-hidden p-2 lg:row-span-2">
        <FieldMiniMap geometry={field.geometry} kind={field.kind} className="h-64 lg:h-full lg:min-h-[340px]" />
      </motion.div>

      <div className="grid gap-4 sm:grid-cols-2 lg:col-span-2">
        <Kpi
          icon={Snowflake}
          label="Frost-safe planting from"
          value={frostFree ? 'All year round' : dateLong(c.frost.last_spring_frost?.p90?.date)}
          sub={frostFree ? 'It almost never freezes here' : <>Typical last frost: {dateLong(c.frost.last_spring_frost?.p50?.date)}</>}
        />
        <Kpi
          icon={CloudRain}
          label="Rainfall per year"
          value={
            <>
              <AnimatedNumber value={c.rain.annual_mean_mm ?? 0} /> <span className="text-lg font-medium text-ink-2">mm</span>
            </>
          }
          sub={<>Season: {monthRange(c.rain.rainy_months)}</>}
          status={(c.rain.annual_mean_mm ?? 0) < 400 ? { level: 'warn', label: 'Dry' } : undefined}
        />
        <Kpi
          icon={Sun}
          label="Hottest month"
          value={
            <>
              <span className="capitalize">{monthName(c.heat.hottest_month)}</span> <span className="text-lg font-medium text-ink-2">{num(hot.mean_tmax_c)} °C</span>
            </>
          }
          sub={<>~{num(c.heat.by_month.reduce((a, b) => a + (b.mean_days_over_35c ?? 0), 0))} days a year above 35 °C</>}
        />
        {field.kind === 'greenhouse' ? (
          <Kpi
            icon={Wind}
            label="10-year wind gust"
            value={
              <>
                {c.wind ? <AnimatedNumber value={c.wind.return_levels_kmh[0]?.estimated_gust_kmh ?? 0} /> : '—'} <span className="text-lg font-medium text-ink-2">km/h</span>
              </>
            }
            sub={c.wind ? <>More wind in {monthName(c.wind.windiest_month)}</> : 'No wind data available'}
            status={field.greenhouse?.rated_wind_kmh && field.greenhouse.rated_wind_kmh < (c.wind?.return_levels_kmh[0]?.estimated_gust_kmh ?? 0) ? { level: 'bad', label: 'Exceeds structure rating' } : undefined}
          />
        ) : (
          <Kpi
            icon={Droplets}
            label="Groundwater"
            value={
              <>
                {gw == null ? '—' : <AnimatedNumber value={gw} digits={1} />} <span className="text-lg font-medium text-ink-2">cm/year</span>
              </>
            }
            sub={gw == null ? 'No groundwater source available' : 'Regional groundwater trend'}
            status={gw == null ? undefined : gw < -1 ? { level: 'bad', label: 'Declining rapidly' } : gw < 0 ? { level: 'warn', label: 'Declining' } : { level: 'ok', label: 'Stable' }}
          />
        )}
      </div>

      <Card className="lg:col-span-2">
        <CardHeader title="Key insights" subtitle={`Zonal climate record: ${c.years[0]}?${c.years[1]}.`} />
        <ul className="divide-y divide-line">
          {items.map((it, i) => (
            <motion.li key={i} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 + i * 0.07 }} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
              <StatusIcon level={it.level} className="mt-0.5 h-5 w-5" />
              <p className="flex-1 text-[15px] text-ink-2 [&_b]:font-semibold [&_b]:text-ink">{it.text}</p>
              {it.tab && (
                <button onClick={() => onNavigate(it.tab!)} className="no-print inline-flex shrink-0 cursor-pointer items-center gap-1 text-sm font-medium text-ink hover:text-accent">
                  <span className="hidden sm:inline">{it.cta}</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              )}
            </motion.li>
          ))}
        </ul>
      </Card>

      <Card>
        <CardHeader
          title="Your soil"
          subtitle={profile.soil?.texture_class ?? 'No soil data available'}
          icon={<Layers className="h-4 w-4" />}
          action={om == null ? undefined : <StatusPill level={om < 1.5 ? 'bad' : om < 3 ? 'warn' : 'ok'} label={om < 1.5 ? 'Low OM' : om < 3 ? 'Moderate OM' : 'Good OM'} />}
        />
        <dl className="grid grid-cols-2 gap-3">
          {[
            ['Organic matter', `${num(om, 1)} %`],
            ['pH', num(profile.soil?.lab?.ph ?? soil?.ph, 1)],
            ['Total Nitrogen', `${num(soil?.n_total_g_kg, 2)} g/kg`],
            ['Clay/sand', `${num(soil?.clay_pct)} / ${num(soil?.sand_pct)} %`],
          ].map(([k, v]) => (
            <div key={k} className="rounded-xl bg-surface-2 p-3">
              <dt className="text-xs text-muted">{k}</dt>
              <dd className="tabular mt-0.5 font-semibold text-ink">{v}</dd>
            </div>
          ))}
        </dl>
        {profile.soil?.lab ? (
          <p className="mt-3 flex items-start gap-2 text-xs text-muted">
            <Shovel className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            With your laboratory analysis{profile.soil?.lab.sample_date ? ` (${profile.soil?.lab.sample_date})` : ''}.
          </p>
        ) : (
          <button onClick={() => onNavigate('suelo')} className="no-print mt-3 flex w-full cursor-pointer items-center gap-2 rounded-xl border border-dashed border-line-strong p-3 text-left text-sm text-ink-2 hover:border-accent hover:text-ink">
            <Shovel className="h-4 w-4 shrink-0 text-accent" />
            <span className="flex-1">Upload your laboratory analysis to know nitrogen, phosphorus and potassium.</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        )}
      </Card>

      {capabilities.futureClimate && <FutureCard
        field={field}
        onUse={(sc) => {
          onScenario(sc)
          onNavigate('sembrar')
        }}
      />}

      <Card>
        <CardHeader title="Sources" icon={<Database className="h-4 w-4" />} />
        <div className="flex flex-wrap gap-1.5">
          {profile.sources.map((s) => (
            <a key={s.id} href={s.url} target="_blank" rel="noreferrer" title={`${s.data_class ?? 'demo'} / ${s.license ?? ''} / ${s.provider} · ${s.resolution}${s.period ? ` · ${s.period}` : ''}`}>
              <Chip className="hover:text-ink">{s.dataset}{s.data_class ? ` (${s.data_class})` : ''}</Chip>
            </a>
          ))}
        </div>
      </Card>
      <Card className="lg:col-span-2">
        <CardHeader title="What we don't know" subtitle="Data that must be confirmed in the field." />
        <ul className="space-y-2.5">
          {profile.gaps.map((g) => (
            <li key={g.code} className="flex items-start gap-2.5 text-sm text-ink-2">
              <StatusIcon level={g.severity === 'high' ? 'bad' : g.severity === 'medium' ? 'warn' : 'ok'} className="mt-0.5" />
              {g.message}
            </li>
          ))}
        </ul>
      </Card>

    </Stagger>
  )
}
