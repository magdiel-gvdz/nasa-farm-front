import { Area, Bar, CartesianGrid, Cell, ComposedChart, Line, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { ClimateProfile, GreenhouseReport, WaterProfile } from '@/api/types'
import { monthName, monthShort, num } from '@/lib/format'
import type { ReactNode } from 'react'
import { AXIS, BAR_RADIUS, GRID } from './config'
import { Legend, TooltipCard } from './common'

type TipArgs = { active?: boolean; payload?: readonly { payload?: unknown }[] }

/** Extrae la fila de datos del tooltip de recharts y la pasa tipada a `render`. */
function tip<T>(p: TipArgs, render: (d: T) => ReactNode) {
  const d = p.active ? (p.payload?.[0]?.payload as T | undefined) : undefined
  return d ? render(d) : null
}

export function TemperatureChart({ climate }: { climate: ClimateProfile }) {
  const data = climate.heat.by_month.map((h, i) => ({
    m: monthShort(h.month),
    month: h.month,
    tmax: h.mean_tmax_c,
    tmin: h.mean_tmin_c,
    band: [h.mean_tmin_c, h.mean_tmax_c],
    frost: climate.frost.by_month[i].prob_any_frost ?? 0,
    hot: h.mean_days_over_35c ?? 0,
  }))
  return (
    <div>
      <div className="h-64">
        <ResponsiveContainer>
          <ComposedChart data={data} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
            <CartesianGrid {...GRID} />
            <XAxis dataKey="m" {...AXIS} />
            <YAxis {...AXIS} axisLine={false} unit="°" width={48} />
            <ReferenceLine y={0} stroke="var(--s-7)" strokeOpacity={0.6} label={{ value: 'Frost 0 °C', position: 'insideBottomRight', fill: 'var(--muted)', fontSize: 11 }} />
            <Area dataKey="band" stroke="none" fill="var(--s-2)" fillOpacity={0.1} isAnimationActive animationDuration={900} />
            <Line dataKey="tmax" stroke="var(--s-2)" strokeWidth={2} dot={false} activeDot={{ r: 5, strokeWidth: 2, stroke: 'var(--surface)' }} animationDuration={900} />
            <Line dataKey="tmin" stroke="var(--s-7)" strokeWidth={2} dot={false} activeDot={{ r: 5, strokeWidth: 2, stroke: 'var(--surface)' }} animationDuration={900} />
            <Tooltip
              cursor={{ stroke: 'var(--axis)' }}
              content={(p: TipArgs) => tip(p, (d: (typeof data)[number]) => (
                  <TooltipCard
                    title={monthName(d.month)}
                    rows={[
                      { label: 'Average High', value: `${num(d.tmax, 1)} °C`, color: 'var(--s-2)' },
                      { label: 'Average Minimum', value: `${num(d.tmin, 1)} °C`, color: 'var(--s-7)' },
                      { label: 'Years with frost', value: `${Math.round(d.frost * 100)} %` },
                      { label: 'Days > 35 °C', value: num(d.hot, 1) },
                    ]}
                  />
                ))}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <Legend
        items={[
          { label: 'High of the day', color: 'var(--s-2)', kind: 'line' },
          { label: 'Low of the day', color: 'var(--s-7)', kind: 'line' },
        ]}
      />
    </div>
  )
}

export function RainChart({ climate }: { climate: ClimateProfile }) {
  const rainy = new Set(climate.rain.rainy_months)
  const data = climate.rain.by_month.map((b) => ({ m: monthShort(b.month), ...b, rainy: rainy.has(b.month) }))
  return (
    <div>
      <div className="h-64">
        <ResponsiveContainer>
          <ComposedChart data={data} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
            <CartesianGrid {...GRID} />
            <XAxis dataKey="m" {...AXIS} />
            <YAxis {...AXIS} axisLine={false} width={44} />
            <Bar dataKey="mean_mm" radius={BAR_RADIUS} maxBarSize={24} animationDuration={800}>
              {data.map((d) => (
                <Cell key={d.month} fill="var(--s-1)" fillOpacity={d.rainy ? 1 : 0.35} />
              ))}
            </Bar>
            <Tooltip
              cursor={{ fill: 'var(--surface-2)' }}
              content={(p: TipArgs) => tip(p, (d: (typeof data)[number]) => (
                  <TooltipCard
                    title={monthName(d.month)}
                    rows={[
                      { label: 'Average rainfall', value: `${num(d.mean_mm)} mm`, color: 'var(--s-1)' },
                      { label: 'Dry year (2 of 10)', value: `${num(d.p20_mm)} mm` },
                      { label: 'Wet year (8 of 10)', value: `${num(d.p80_mm)} mm` },
                    ]}
                  />
                ))}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <Legend
        items={[
          { label: 'Rainy season', color: 'var(--s-1)' },
          { label: 'Rest of the year', color: 'color-mix(in srgb, var(--s-1) 35%, transparent)' },
        ]}
      />
    </div>
  )
}

export function WaterBalanceChart({ water }: { water: WaterProfile }) {
  const data = water.water_balance_by_month.map((b, i) => ({
    m: monthShort(b.month),
    month: b.month,
    v: b.p_minus_et0_mm,
    pos: Math.max(0, b.p_minus_et0_mm),
    neg: Math.min(0, b.p_minus_et0_mm),
    et0: water.et?.by_month[i]?.et0_mm,
  }))
  return (
    <div>
      <div className="h-60">
        <ResponsiveContainer>
          <ComposedChart data={data} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
            <CartesianGrid {...GRID} />
            <XAxis dataKey="m" {...AXIS} />
            <YAxis {...AXIS} axisLine={false} width={44} />
            <ReferenceLine y={0} stroke="var(--axis)" />
            <Bar dataKey="pos" stackId="b" fill="var(--s-1)" radius={BAR_RADIUS} maxBarSize={24} animationDuration={800} />
            <Bar dataKey="neg" stackId="b" fill="var(--s-8)" radius={[0, 0, 4, 4]} maxBarSize={24} animationDuration={800} />
            <Tooltip
              cursor={{ fill: 'var(--surface-2)' }}
              content={(p: TipArgs) => tip(p, (d: (typeof data)[number]) => (
                  <TooltipCard
                    title={monthName(d.month)}
                    rows={[
                      { label: d.v >= 0 ? 'Too much water' : 'Water deficit', value: `${num(Math.abs(d.v))} mm`, color: d.v >= 0 ? 'var(--s-1)' : 'var(--s-8)' },
                      { label: 'Potential evaporation', value: `${num(d.et0)} mm` },
                    ]}
                  />
                ))}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <Legend
        items={[
          { label: 'Excess water (rain > evaporation)', color: 'var(--s-1)' },
          { label: 'Water deficit', color: 'var(--s-8)' },
        ]}
      />
    </div>
  )
}

export function LightChart({ light }: { light: NonNullable<GreenhouseReport['light']> }) {
  const data = light.by_month.map((b) => ({ m: monthShort(b.month), ...b }))
  return (
    <div>
      <div className="h-60">
        <ResponsiveContainer>
          <ComposedChart data={data} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
            <CartesianGrid {...GRID} />
            <XAxis dataKey="m" {...AXIS} />
            <YAxis {...AXIS} axisLine={false} width={44} />
            <ReferenceArea y1={20} y2={30} fill="var(--good)" fillOpacity={0.08} label={{ value: 'Ideal tomate', position: 'insideTopLeft', fill: 'var(--muted)', fontSize: 11 }} />
            <Line dataKey="outdoor_dli" stroke="var(--s-4)" strokeWidth={2} dot={false} animationDuration={900} />
            <Line dataKey="indoor_dli_est" stroke="var(--s-3)" strokeWidth={2} dot={{ r: 3, fill: 'var(--s-3)', stroke: 'var(--surface)', strokeWidth: 2 }} animationDuration={900} />
            <Tooltip
              cursor={{ stroke: 'var(--axis)' }}
              content={(p: TipArgs) => tip(p, (d: (typeof data)[number]) => (
                  <TooltipCard
                    title={monthName(d.month)}
                    rows={[
                      { label: 'Outside', value: `${num(d.outdoor_dli, 1)} mol/m²·day`, color: 'var(--s-4)' },
                      { label: 'Inside (estimated)', value: `${num(d.indoor_dli_est, 1)} mol/m²·day`, color: 'var(--s-3)' },
                    ]}
                  />
                ))}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <Legend
        items={[
          { label: 'Light outside', color: 'var(--s-4)', kind: 'line' },
          { label: 'Light inside the greenhouse', color: 'var(--s-3)', kind: 'line' },
        ]}
      />
    </div>
  )
}

export function HeatingChart({ temperature }: { temperature: NonNullable<GreenhouseReport['temperature']> }) {
  const data = temperature.by_month.map((b) => ({ m: monthShort(b.month), ...b }))
  return (
    <div className="h-52">
      <ResponsiveContainer>
        <ComposedChart data={data} margin={{ top: 8, right: 8, left: -10, bottom: 0 }}>
          <CartesianGrid {...GRID} />
          <XAxis dataKey="m" {...AXIS} />
          <YAxis {...AXIS} axisLine={false} width={52} tickFormatter={(v: number) => (v >= 1000 ? `${(v / 1000).toFixed(1).replace('.0', '')}K` : String(v))} />
          <Bar dataKey="heating_degree_hours_base12" fill="var(--s-7)" radius={BAR_RADIUS} maxBarSize={24} animationDuration={800} />
          <Tooltip
            cursor={{ fill: 'var(--surface-2)' }}
            content={(p: TipArgs) => tip(p, (d: (typeof data)[number]) => (
                <TooltipCard title={monthName(d.month)} rows={[{ label: 'Degree-hours below 12 °C', value: num(d.heating_degree_hours_base12) }]} />
              ))}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
