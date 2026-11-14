import { AnimatePresence, LayoutGroup, motion } from 'motion/react'
import { ArrowDown, ArrowUp, Beef, Bug, ChevronDown, Coins, Droplets, Hand, Sparkles, Sprout, TreeDeciduous } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import type { CropRole, Field, FieldProfile, Priorities, RotationRequest, Scenario, Strategy } from '@/api/types'
import { CROP_BY_ID } from '@/api/mock/engine/crops'
import { ScenarioControl } from '@/components/scenario-control'
import { AnimatedNumber } from '@/components/ui/animated-number'
import { Segmented } from '@/components/ui/segmented'
import { Slider } from '@/components/ui/slider'
import { Chip, StatusIcon } from '@/components/ui/status'
import { useRotations } from '@/hooks/api'
import { cn } from '@/lib/cn'
import { num, signed } from '@/lib/format'

const ROLE: Record<CropRole | 'bare', { label: string; color: string }> = {
  cash: { label: 'Cultivo comercial', color: 'var(--s-1)' },
  legume: { label: 'Leguminosa (fija N)', color: 'var(--s-3)' },
  forage: { label: 'Forraje', color: 'var(--s-4)' },
  cover: { label: 'Cobertura', color: 'var(--s-6)' },
  deep_root: { label: 'Raíz profunda', color: 'var(--s-7)' },
  drought_tolerant: { label: 'Tolera sequía', color: 'var(--s-2)' },
  bare: { label: 'Suelo desnudo', color: 'transparent' },
}

const SOURCE: Record<string, string> = { nasa_power: 'NASA POWER', modis_ndvi: 'MODIS NDVI', soilgrids: 'SoilGrids', ssurgo: 'SSURGO', cdl: 'USDA CDL' }

function useDebounced<T>(value: T, ms = 220) {
  const [v, setV] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return v
}

function Timeline({ s, years }: { s: Strategy; years: number }) {
  return (
    <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${years}, minmax(0, 1fr))` }}>
      {Array.from({ length: years }, (_, y) => (
        <div key={y} className="space-y-1.5">
          <div className="text-center text-[11px] text-muted">Año {y + 1}</div>
          {(['spring_summer', 'fall_winter'] as const).map((season) => {
            const step = s.sequence.find((x) => x.year === y + 1 && x.season === season)
            const crop = step?.crop_id ? CROP_BY_ID.get(step.crop_id) : null
            const role = ROLE[step?.role ?? 'bare']
            return (
              <div
                key={season}
                title={`${season === 'spring_summer' ? 'Primavera–verano' : 'Otoño–invierno'}: ${crop?.name.es ?? 'descanso'}${step?.plant ? ` · siembra ${step.plant}` : ''}`}
                className={cn('relative flex h-9 items-center gap-1 overflow-hidden rounded-lg px-1.5 text-xs', crop ? 'bg-surface-2 text-ink' : 'border border-dashed border-line-strong text-muted')}
              >
                {crop && <span className="absolute inset-y-0 left-0 w-1" style={{ background: role.color }} />}
                <span className="pl-1" aria-hidden>
                  {crop?.emoji ?? '·'}
                </span>
                <span className="truncate">{crop?.name.es.split(' ')[0] ?? 'Descanso'}</span>
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}

function Delta({ value, base, unit, lowerIsBetter, digits = 0 }: { value: number; base: number; unit: string; lowerIsBetter?: boolean; digits?: number }) {
  const d = value - base
  if (Math.abs(d) < 0.5 * 10 ** -digits * 10) return <span className="text-xs text-muted">igual que hoy</span>
  const good = lowerIsBetter ? d < 0 : d > 0
  const Icon = d > 0 ? ArrowUp : ArrowDown
  return (
    <span className={cn('inline-flex items-center gap-0.5 text-xs font-medium', good ? 'text-good-ink' : 'text-bad')}>
      <Icon className="h-3 w-3" />
      {signed(d, digits)} {unit}
    </span>
  )
}

function Section({ title, items, icon, defaultOpen }: { title: string; items: React.ReactNode[]; icon?: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(!!defaultOpen)
  return (
    <div className="border-t border-line">
      <button onClick={() => setOpen(!open)} className="flex w-full cursor-pointer items-center gap-2 py-3 text-left text-sm font-medium text-ink">
        {icon}
        <span className="flex-1">{title}</span>
        <motion.span animate={{ rotate: open ? 180 : 0 }}>
          <ChevronDown className="h-4 w-4 text-muted" />
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.ul initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="space-y-1.5 overflow-hidden pb-3 text-sm text-ink-2">
            {items.map((it, i) => (
              <li key={i} className="flex gap-2">
                <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-muted" />
                <span>{it}</span>
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  )
}

function StrategyCard({ s, base, recommended, years }: { s: Strategy; base: Strategy; recommended: boolean; years: number }) {
  const m = s.metrics
  const b = base.metrics
  const scores: [string, number][] = [
    ['Ahorro de agua', s.scores.save_water],
    ['Salud del suelo', s.scores.soil_health],
    ['Ingreso', s.scores.income],
    ['Forraje', s.scores.forage],
    ['Corta plagas', s.scores.pest_break],
  ]
  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ type: 'spring', stiffness: 260, damping: 28 }}
      className={cn('card relative flex flex-col p-5', recommended && 'ring-2 ring-accent')}
    >
      {recommended && (
        <motion.div layoutId="recommended-badge" className="absolute -top-3 left-5 inline-flex items-center gap-1 rounded-full bg-accent px-2.5 py-1 text-xs font-semibold text-accent-ink shadow-lg shadow-accent/30">
          <Sparkles className="h-3.5 w-3.5" /> Recomendada para ti
        </motion.div>
      )}
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          {s.is_current && <div className="mb-1 text-xs font-medium text-muted">Lo que siembras hoy</div>}
          <h3 className="text-[17px] leading-snug font-semibold text-ink">{s.name}</h3>
          <p className="mt-1 text-sm text-ink-2">{s.why[0]}</p>
        </div>
        <div className="text-right">
          <div className="text-3xl leading-none font-semibold tracking-tight text-ink">
            <AnimatedNumber value={s.scores.overall} />
          </div>
          <div className="mt-1 text-[11px] text-muted">de 100</div>
        </div>
      </div>

      <div className="mt-4">
        <Timeline s={s} years={years} />
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-2">
        {[
          { k: 'Riego necesario', v: `${num(m.irrigation_need_mm_per_year)} mm/año`, d: <Delta value={m.irrigation_need_mm_per_year} base={b.irrigation_need_mm_per_year} unit="mm" lowerIsBetter /> },
          { k: 'Suelo desnudo', v: `${num(m.bare_soil_days_per_year)} días/año`, d: <Delta value={m.bare_soil_days_per_year} base={b.bare_soil_days_per_year} unit="días" lowerIsBetter /> },
          { k: 'Nitrógeno', v: `${signed(m.n_balance_kg_ha_per_year)} kg/ha`, d: <Delta value={m.n_balance_kg_ha_per_year} base={b.n_balance_kg_ha_per_year} unit="kg" /> },
          { k: 'Erosión', v: `${num(m.erosion_t_ha_per_year, 1)} t/ha`, d: <Delta value={m.erosion_t_ha_per_year} base={b.erosion_t_ha_per_year} unit="t" lowerIsBetter digits={1} /> },
        ].map((x) => (
          <div key={x.k} className="rounded-xl bg-surface-2 p-2.5">
            <dt className="text-[11px] text-muted">{x.k}</dt>
            <dd className="tabular text-sm font-semibold text-ink">{x.v}</dd>
            {!s.is_current && <dd>{x.d}</dd>}
          </div>
        ))}
      </dl>

      <div className="mt-4 space-y-1.5">
        {scores.map(([label, v]) => (
          <div key={label} className="flex items-center gap-3 text-xs">
            <span className="w-28 shrink-0 text-ink-2">{label}</span>
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-3">
              <motion.div className="h-full rounded-full bg-accent" initial={{ width: 0 }} animate={{ width: `${(v / 5) * 100}%` }} transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }} />
            </div>
            <span className="tabular w-6 text-right text-ink-2">{num(v, 1)}</span>
          </div>
        ))}
      </div>

      <div className="mt-4 flex-1">
        <Section title="Beneficios" defaultOpen={!s.is_current} items={s.benefits} icon={<StatusIcon level="ok" />} />
        <Section
          title="Evidencia"
          items={s.evidence.map((e) => (
            <span key={e.claim}>
              {e.claim} <Chip className="ml-1">{SOURCE[e.source_id] ?? e.source_id}</Chip>
            </span>
          ))}
        />
        <Section title="Lo que falta saber" items={s.gaps} icon={<StatusIcon level="warn" />} />
        <Section title="Revisar con tu agrónomo" items={s.risks_local_review} icon={<StatusIcon level="bad" />} />
      </div>
    </motion.article>
  )
}

export function RotationsTab({ field, profile, scenario, onScenario }: { field: Field; profile: FieldProfile; scenario: Scenario; onScenario: (s: Scenario) => void }) {
  const [pri, setPri] = useState<Priorities>({ save_water: 4, income: 3, soil_health: 4, forage: field.livestock ? 3 : 1, pest_break: 2, low_labor: 1 })
  const [years, setYears] = useState(4)
  const debounced = useDebounced(pri)
  const req: RotationRequest = useMemo(() => ({ priorities: debounced, constraints: { horizon_years: years, irrigation_mm_per_year: field.irrigation?.max_mm_per_year }, scenario, max_strategies: 4 }), [debounced, years, scenario, field.irrigation])
  const rot = useRotations(field.id, req, true)
  const orchard = (field.current_rotation ?? []).map((r) => (r.crop_id ? CROP_BY_ID.get(r.crop_id) : null)).find((c) => c?.perennial)
  const data = rot.data
  const base = data?.strategies.find((s) => s.is_current)
  const ordered = data ? [...data.strategies].sort((a, b) => b.scores.overall - a.scores.overall) : []

  const sliders: { key: keyof Priorities; label: string; icon: React.ReactNode }[] = [
    { key: 'save_water', label: 'Ahorrar agua', icon: <Droplets className="h-4 w-4" /> },
    { key: 'soil_health', label: 'Cuidar el suelo', icon: <Sprout className="h-4 w-4" /> },
    { key: 'income', label: 'Ganar más', icon: <Coins className="h-4 w-4" /> },
    { key: 'forage', label: 'Forraje para ganado', icon: <Beef className="h-4 w-4" /> },
    { key: 'pest_break', label: 'Cortar plagas', icon: <Bug className="h-4 w-4" /> },
    { key: 'low_labor', label: 'Menos trabajo', icon: <Hand className="h-4 w-4" /> },
  ]
  const LEVEL = ['Nada', 'Poco', 'Algo', 'Importa', 'Mucho', 'Lo más']

  return (
    <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
      <aside className="space-y-4 lg:sticky lg:top-32 lg:self-start">
        <div className="card p-5">
          <h3 className="text-[15px] font-semibold text-ink">¿Qué es lo más importante para ti?</h3>
          <p className="mt-1 text-sm text-ink-2">Ajusta y las opciones se reordenan solas.</p>
          <div className="mt-5 space-y-5">
            {sliders.map((s) => (
              <Slider key={s.key} label={s.label} icon={s.icon} value={pri[s.key]} min={0} max={5} onChange={(v) => setPri((p) => ({ ...p, [s.key]: v }))} format={(v) => LEVEL[v]} />
            ))}
          </div>
          <div className="mt-5 flex items-center justify-between">
            <span className="text-sm font-medium text-ink">Planear a</span>
            <Segmented size="sm" value={years} onChange={setYears} options={[3, 4, 5].map((y) => ({ value: y, label: `${y} años` }))} />
          </div>
        </div>
        <ScenarioControl value={scenario} onChange={onScenario} compact fieldId={field.id} />
      </aside>

      <div className="min-w-0">
        {orchard && (
          <div className="card mb-4 flex items-start gap-3 p-4 text-sm text-ink-2">
            <TreeDeciduous className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
            <span>
              Tu terreno es una huerta de <b className="text-ink">{orchard.name.es.toLowerCase()}</b>: los árboles no se rotan. Abajo comparamos la huerta tal como está contra
              alternativas para un terreno de cultivos anuales, por si piensas renovarla o reconvertirla. Para cuidar el suelo dentro de la huerta, usa una cobertura entre hileras.
            </span>
          </div>
        )}
        <div className="mb-4 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-ink-2">
          {(Object.keys(ROLE) as (keyof typeof ROLE)[]).map((r) => (
            <span key={r} className="inline-flex items-center gap-1.5">
              <span className={cn('h-3 w-1.5 rounded-full', r === 'bare' && 'border border-dashed border-line-strong')} style={{ background: ROLE[r].color }} />
              {ROLE[r].label}
            </span>
          ))}
        </div>
        {!data || !base ? (
          <div className="grid gap-4 xl:grid-cols-2">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="skeleton h-[520px]" />
            ))}
          </div>
        ) : (
          <LayoutGroup>
            <motion.div layout className={cn('grid gap-5 pt-3 xl:grid-cols-2', rot.isFetching && 'opacity-80')}>
              <AnimatePresence mode="popLayout">
                {ordered.map((s) => (
                  <StrategyCard key={s.id} s={s} base={base} recommended={s.id === data.recommended_id} years={years} />
                ))}
              </AnimatePresence>
            </motion.div>
          </LayoutGroup>
        )}
        {data && (
          <p className="mt-5 flex items-start gap-2 text-sm text-ink-2">
            <StatusIcon level="warn" className="mt-0.5" />
            {data.disclaimer} Datos: {profile.sources.slice(0, 4).map((s) => s.dataset).join(', ')}.
          </p>
        )}
      </div>
    </div>
  )
}
