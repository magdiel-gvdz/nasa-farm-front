import { motion } from 'motion/react'
import { CalendarDays, CloudRain, Snowflake, Thermometer } from 'lucide-react'
import type { FieldProfile } from '@/api/types'
import { RainChart, TemperatureChart } from '@/components/charts/monthly-charts'
import { RiskCalendar } from '@/components/charts/risk-calendar'
import { Card, CardHeader, Stagger } from '@/components/ui/card'
import { dateLong, dateShort, MONTHS_SHORT, num } from '@/lib/format'

function FrostWindow({ profile }: { profile: FieldProfile }) {
  const f = profile.climate.frost
  const ls50 = f.last_spring_frost.p50?.doy
  const ls90 = f.last_spring_frost.p90?.doy
  const ff10 = f.first_fall_frost.p10?.doy
  const ff50 = f.first_fall_frost.p50?.doy
  if (!ls50 || !ff50 || !ls90 || !ff10) {
    return <p className="text-sm text-ink-2">En 35 años casi no se registraron heladas en esta zona.</p>
  }
  const x = (doy: number) => `${((doy - 1) / 365) * 100}%`
  const seg = (a: number, b: number, cls: string, delay: number) =>
    a <= b ? (
      <motion.div key={`${a}-${b}-${cls}`} className={`absolute inset-y-0 ${cls}`} style={{ left: x(a), width: `${((b - a) / 365) * 100}%`, transformOrigin: 'left' }} initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ delay, duration: 0.7, ease: [0.16, 1, 0.3, 1] }} />
    ) : null
  const wraps = ls50 < ff50 // hemisferio norte: la temporada fría cruza el año
  const marks = [
    { doy: ls50, label: 'Última helada típica', date: f.last_spring_frost.p50?.date },
    { doy: ls90, label: 'Siembra segura', date: f.last_spring_frost.p90?.date, strong: true },
    { doy: ff10, label: 'Helada temprana posible', date: f.first_fall_frost.p10?.date },
    { doy: ff50, label: 'Primera helada típica', date: f.first_fall_frost.p50?.date },
  ]
  return (
    <div>
      <div className="relative mt-8 mb-10 h-10 overflow-visible rounded-xl bg-surface-2">
        <div className="absolute inset-0 overflow-hidden rounded-xl">
          {wraps ? (
            <>
              {seg(1, ls50, 'bg-s7/70', 0.1)}
              {seg(ls50, ls90, 'bg-s7/25', 0.3)}
              {seg(ff10, ff50, 'bg-s7/25', 0.3)}
              {seg(ff50, 366, 'bg-s7/70', 0.1)}
            </>
          ) : (
            <>
              {seg(ff10, ff50, 'bg-s7/25', 0.3)}
              {seg(ff50, ls50, 'bg-s7/70', 0.1)}
              {seg(ls50, ls90, 'bg-s7/25', 0.3)}
            </>
          )}
        </div>
        {MONTHS_SHORT.map((m, i) => (
          <span key={m} className="absolute -top-5 text-[11px] text-muted" style={{ left: `${(i / 12) * 100}%` }}>
            {m}
          </span>
        ))}
        {marks.map((m, i) => (
          <div key={m.label} className="absolute inset-y-[-4px]" style={{ left: x(m.doy) }}>
            <div className={`h-full w-[2px] -translate-x-1/2 rounded-full ${m.strong ? 'bg-accent' : 'bg-ink/50'}`} />
            <div className={`absolute top-full ${i % 2 ? 'mt-6' : 'mt-1.5'} -translate-x-1/2 text-[11px] font-medium whitespace-nowrap ${m.strong ? 'text-ink' : 'text-ink-2'}`}>{dateShort(m.date)}</div>
          </div>
        ))}
      </div>
      <div className="mt-12 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl bg-surface-2 p-3">
          <div className="text-xs text-muted">Siembra segura desde</div>
          <div className="mt-0.5 font-semibold text-ink">{dateLong(f.last_spring_frost.p90?.date)}</div>
          <div className="text-xs text-ink-2">9 de cada 10 años ya no hiela</div>
        </div>
        <div className="rounded-xl bg-surface-2 p-3">
          <div className="text-xs text-muted">Cosecha antes del</div>
          <div className="mt-0.5 font-semibold text-ink">{dateLong(f.first_fall_frost.p10?.date)}</div>
          <div className="text-xs text-ink-2">Helada temprana 1 de cada 10 años</div>
        </div>
        <div className="rounded-xl bg-surface-2 p-3">
          <div className="text-xs text-muted">Días sin helada (año típico)</div>
          <div className="mt-0.5 font-semibold text-ink">{num(f.frost_free_days.p50)} días</div>
          <div className="text-xs text-ink-2">En un año malo: {num(f.frost_free_days.p10)}</div>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-4 text-xs text-ink-2">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-4 rounded-sm bg-s7/70" /> Temporada de heladas (año típico)
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-4 rounded-sm bg-s7/25" /> Puede helar algunos años
        </span>
      </div>
    </div>
  )
}

export function CalendarTab({ profile }: { profile: FieldProfile }) {
  const c = profile.climate
  return (
    <Stagger className="grid gap-4 lg:grid-cols-2">
      <Card className="lg:col-span-2">
        <CardHeader title="El año de tu parcela" subtitle={`Riesgos semana por semana según ${c.years[1] - c.years[0] + 1} años de datos.`} icon={<CalendarDays className="h-4 w-4" />} />
        <RiskCalendar profile={profile} />
      </Card>
      <Card className="lg:col-span-2">
        <CardHeader title="¿Cuándo hiela?" subtitle="Fechas clave para sembrar y cosechar sin perder la cosecha por frío." icon={<Snowflake className="h-4 w-4" />} />
        <FrostWindow profile={profile} />
      </Card>
      <Card>
        <CardHeader title="Temperatura" subtitle="Grados °C · promedio de máximas y mínimas diarias por mes." icon={<Thermometer className="h-4 w-4" />} />
        <TemperatureChart climate={c} />
      </Card>
      <Card>
        <CardHeader title="Lluvia" subtitle={`Milímetros por mes · ${num(c.rain.annual_mean_mm)} mm al año en promedio.`} icon={<CloudRain className="h-4 w-4" />} />
        <RainChart climate={c} />
      </Card>
    </Stagger>
  )
}
