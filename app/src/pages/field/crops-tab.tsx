import { motion } from 'motion/react'
import { CalendarCheck, Check, ChevronLeft, ChevronRight, MessageCircle, Minus, Search, Sprout, TreeDeciduous, Wheat } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { Crop, CropCategory, Field, Scenario } from '@/api/types'
import { searchCrops } from '@/api/mock/engine/crops'
import { SuitabilityGrid } from '@/components/charts/suitability-grid'
import { useChat } from '@/components/chat/chat-store'
import { ScenarioControl } from '@/components/scenario-control'
import { ScoreRing } from '@/components/score-ring'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, Stagger } from '@/components/ui/card'
import { fadeUp } from '@/components/ui/motion'
import { Sheet } from '@/components/ui/sheet'
import { Chip, StatusIcon, StatusPill } from '@/components/ui/status'
import { suitLabel, suitToLevel } from '@/lib/status'
import { useCrops, useSuitability, useSuitabilityMatrix, useYield } from '@/hooks/api'
import { cn } from '@/lib/cn'
import { dateLong, monthName, num } from '@/lib/format'

const GROUPS: { id: string; label: string; cats?: CropCategory[] }[] = [
  { id: 'all', label: 'Todos' },
  { id: 'grains', label: 'Granos', cats: ['grain'] },
  { id: 'forage', label: 'Forrajes', cats: ['forage'] },
  { id: 'legume', label: 'Leguminosas', cats: ['legume'] },
  { id: 'veg', label: 'Hortalizas', cats: ['vegetable'] },
  { id: 'fruit', label: 'Frutales y vid', cats: ['fruit', 'vine'] },
  { id: 'nut', label: 'Nueces', cats: ['nut'] },
  { id: 'berry', label: 'Berries', cats: ['berry'] },
  { id: 'oil', label: 'Oleaginosas e industriales', cats: ['oilseed', 'industrial'] },
  { id: 'other', label: 'Nopal, agave y aromáticas', cats: ['cactus', 'aromatic'] },
]
const PAGE = 20

const SOURCE_LABEL: Record<string, string> = { nasa_power: 'NASA POWER', soilgrids: 'SoilGrids', ssurgo: 'SSURGO', srtm: 'SRTM', lab_report: 'Tu análisis' }

function CropDetail({ field, crop, month, scenario, onMonth }: { field: Field; crop: Crop; month: number; scenario: Scenario; onMonth: (m: number) => void }) {
  const det = useSuitability(field.id, crop.id, month, scenario)
  const yld = useYield(field.id, crop.id, month, !!field.irrigation?.available, scenario)
  const ask = useChat((s) => s.ask)
  const d = det.data
  const y = yld.data
  return (
    <div className="space-y-6 p-5">
      <div className="flex items-center justify-between rounded-full bg-surface-2 p-1">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onMonth(month === 1 ? 12 : month - 1)} aria-label="Mes anterior">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-sm font-medium text-ink">
          {crop.perennial ? 'Plantar' : 'Sembrar'} en <span className="capitalize">{monthName(month)}</span>
        </span>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onMonth(month === 12 ? 1 : month + 1)} aria-label="Mes siguiente">
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {!d ? (
        <div className="skeleton h-40" />
      ) : (
        <motion.div key={`${month}-${d.score}`} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          <div className="flex items-center gap-5">
            <ScoreRing score={d.score} level={suitToLevel(d.status)} />
            <div>
              <StatusPill level={suitToLevel(d.status)} label={suitLabel(d.status)} />
              {d.perennial ? (
                <p className="mt-2 text-sm text-ink-2">
                  Perenne: primera cosecha al <b className="text-ink">año {d.perennial.years_to_first_harvest}</b>; después se cosecha cada año de{' '}
                  <b className="text-ink">{monthName(d.perennial.harvest_months[0])}</b> a <b className="text-ink">{monthName(d.perennial.harvest_months[1])}</b>.
                  {d.perennial.chill_hours_est != null && <> Tu zona junta ~{num(d.perennial.chill_hours_est)} horas frío por invierno.</>}
                </p>
              ) : (
                <p className="mt-2 text-sm text-ink-2">
                  Cosecha entre el <b className="text-ink">{dateLong(d.harvest_window.from)}</b> y el <b className="text-ink">{dateLong(d.harvest_window.to)}</b>.
                </p>
              )}
            </div>
          </div>

          <div>
            <h4 className="mb-2 text-sm font-semibold text-ink">¿Por qué?</h4>
            <ul className="space-y-2">
              {d.reasons.map((r, i) => (
                <motion.li key={`${r.factor}-${i}`} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }} className="flex items-start gap-2.5 rounded-xl bg-surface-2 p-3 text-sm text-ink-2">
                  <StatusIcon level={r.status} className="mt-0.5" />
                  <span className="flex-1">{r.detail}</span>
                  <Chip className="shrink-0 bg-surface">{SOURCE_LABEL[r.source_id] ?? r.source_id}</Chip>
                </motion.li>
              ))}
            </ul>
          </div>

          {y && (
            <div>
              <h4 className="mb-1 text-sm font-semibold text-ink">Rendimiento esperado{crop.perennial ? ' (huerta adulta)' : ''}</h4>
              <p className="mb-3 text-xs text-muted">Rango probable (8 de cada 10 años). {y.model.name.startsWith('demo') ? 'Estimación de demostración.' : ''}</p>
              <YieldBar p10={y.p10} p50={y.p50} p90={y.p90} reference={y.regional_reference?.value} unit={y.unit} />
            </div>
          )}

          <Button variant="outline" className="w-full justify-center" onClick={() => ask(crop.perennial ? `¿Se da ${crop.name.es.toLowerCase()} en mi terreno?` : `¿Puedo sembrar ${crop.name.es.toLowerCase()} en ${monthName(month)}?`)}>
            <MessageCircle className="h-4 w-4" /> Preguntar al agrónomo
          </Button>
        </motion.div>
      )}
    </div>
  )
}

function YieldBar({ p10, p50, p90, reference, unit }: { p10: number; p50: number; p90: number; reference?: number; unit: string }) {
  const max = Math.max(p90, reference ?? 0) * 1.15
  const x = (v: number) => `${(v / max) * 100}%`
  return (
    <div>
      <div className="relative h-10">
        <div className="absolute top-1/2 h-2 w-full -translate-y-1/2 rounded-full bg-surface-3" />
        <motion.div
          className="absolute top-1/2 h-2 -translate-y-1/2 rounded-full bg-accent/50"
          style={{ left: x(p10), width: `${((p90 - p10) / max) * 100}%`, transformOrigin: 'left' }}
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        />
        <motion.div className="absolute top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-surface bg-accent shadow" style={{ left: x(p50) }} initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.5, type: 'spring' }} />
        {reference != null && (
          <div className="absolute top-0 bottom-0 w-[2px] -translate-x-1/2 bg-ink/40" style={{ left: x(reference) }} title="Promedio regional" />
        )}
      </div>
      <div className="tabular flex justify-between text-xs text-ink-2">
        <span>Año malo: {num(p10, 1)}</span>
        <span className="font-semibold text-ink">
          Típico: {num(p50, 1)} {unit}
        </span>
        <span>Año bueno: {num(p90, 1)}</span>
      </div>
      {reference != null && <p className="mt-1 text-xs text-muted">La línea gris es el promedio de la región ({num(reference, 1)} {unit}).</p>}
    </div>
  )
}

export function CropsTab({ field, scenario, onScenario }: { field: Field; scenario: Scenario; onScenario: (s: Scenario) => void }) {
  const crops = useCrops()
  const matrix = useSuitabilityMatrix(field.id, scenario, true)
  const [group, setGroup] = useState('all')
  const [query, setQuery] = useState('')
  const [showAll, setShowAll] = useState(false)
  const [pick, setPick] = useState<{ crop: string; month: number } | null>(null)
  const now = new Date().getMonth() + 1
  const next = (now % 12) + 1

  const cropById = new Map((crops.data ?? []).map((c) => [c.id, c]))
  const sorted = useMemo(() => {
    if (!matrix.data || !crops.data) return null
    const g = GROUPS.find((x) => x.id === group)
    const allowed = new Set(searchCrops(query, crops.data).filter((c) => !g?.cats || g.cats.includes(c.category)).map((c) => c.id))
    const rows = matrix.data.crops.filter((r) => allowed.has(r.crop_id)).sort((a, b) => Math.max(...b.scores) - Math.max(...a.scores))
    return { matrix: { ...matrix.data, crops: rows }, total: rows.length }
  }, [matrix.data, crops.data, group, query])
  const visibleMatrix = sorted && (showAll || query || sorted.total <= PAGE + 5 ? sorted.matrix : { ...sorted.matrix, crops: sorted.matrix.crops.slice(0, PAGE) })

  // "Para sembrar este mes": solo cultivos de temporada; los perennes van en su grupo.
  const topFor = (m: number) =>
    matrix.data?.crops
      .filter((r) => !cropById.get(r.crop_id)?.perennial)
      .map((r) => ({ id: r.crop_id, score: r.scores[m - 1], status: r.status[m - 1] }))
      .filter((r) => r.status !== 'unsuitable')
      .sort((a, b) => b.score - a.score)
      .slice(0, 4) ?? []

  const picked = pick ? cropById.get(pick.crop) : null

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
      <Stagger className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          {[now, next].map((m, i) => (
            <Card key={m}>
              <CardHeader title={<>Para sembrar en <span className="capitalize">{monthName(m)}</span></>} subtitle={i === 0 ? 'Este mes' : 'El próximo mes'} icon={<CalendarCheck className="h-4 w-4" />} />
              {matrix.data ? (
                topFor(m).length ? (
                  <ul className="space-y-1.5">
                    {topFor(m).map((r) => {
                      const c = cropById.get(r.id)
                      return (
                        <li key={r.id}>
                          <button onClick={() => setPick({ crop: r.id, month: m })} className="flex w-full cursor-pointer items-center gap-3 rounded-xl px-2 py-1.5 text-left hover:bg-surface-2">
                            <span className="text-lg" aria-hidden>
                              {c?.emoji}
                            </span>
                            <span className="flex-1 text-sm font-medium text-ink">{c?.name.es}</span>
                            <StatusPill level={suitToLevel(r.status)} label={`${r.score}`} />
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                ) : (
                  <p className="text-sm text-ink-2">Ningún cultivo del catálogo es buena idea este mes. Es temporada de descanso o de cobertura.</p>
                )
              ) : (
                <div className="skeleton h-28" />
              )}
            </Card>
          ))}
        </div>

        <motion.div variants={fadeUp} className="card p-5">
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-surface-2 text-ink-2">
              <Wheat className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-[15px] font-semibold text-ink">¿Qué puedo sembrar y cuándo?</h3>
              <p className="text-sm text-ink-2">Cada cuadro es un mes de siembra (en frutales, de plantación). Tócalo para ver por qué.</p>
            </div>
          </div>
          <div className="relative mb-3">
            <Search className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-muted" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Busca entre ${crops.data?.length ?? ''} cultivos: manzana, uva, nogal, chile…`}
              className="h-10 w-full rounded-full border border-line-strong bg-surface pr-4 pl-10 text-sm text-ink outline-none placeholder:text-muted focus:border-accent"
            />
          </div>
          <div className="mb-4 flex flex-wrap gap-1.5">
            {GROUPS.map((g) => (
              <button
                key={g.id}
                onClick={() => {
                  setGroup(g.id)
                  setShowAll(false)
                }}
                className={cn('cursor-pointer rounded-full border px-3 py-1 text-sm transition-colors', group === g.id ? 'border-ink bg-ink text-page' : 'border-line text-ink-2 hover:bg-surface-2')}
              >
                {g.label}
              </button>
            ))}
          </div>
          {visibleMatrix && sorted && crops.data ? (
            <motion.div key={group} initial={{ opacity: 0 }} animate={{ opacity: matrix.isFetching ? 0.55 : 1 }}>
              {sorted.total ? (
                <SuitabilityGrid matrix={visibleMatrix} crops={crops.data} onPick={(crop, month) => setPick({ crop, month })} />
              ) : (
                <p className="rounded-2xl bg-surface-2 p-4 text-sm text-ink-2">No encontramos ese cultivo{field.kind === 'greenhouse' ? ' entre los de invernadero' : ''}. Prueba con otro nombre.</p>
              )}
              {!showAll && !query && sorted.total > PAGE + 5 && (
                <Button variant="soft" size="sm" className="mt-3" onClick={() => setShowAll(true)}>
                  Ver los {sorted.total - PAGE} cultivos restantes
                </Button>
              )}
            </motion.div>
          ) : (
            <div className="skeleton h-96" />
          )}
          <div className="mt-4 flex flex-wrap gap-4 text-xs text-ink-2">
            <span className="inline-flex items-center gap-1.5">
              <span className="grid h-4 w-4 place-items-center rounded bg-good/60">
                <Check className="h-3 w-3" strokeWidth={3} />
              </span>
              Apto
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="grid h-4 w-4 place-items-center rounded bg-warn/50">
                <Minus className="h-3 w-3" strokeWidth={3} />
              </span>
              Con riesgos
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-4 w-4 rounded bg-surface-2 ring-1 ring-line" />
              No recomendable
            </span>
          </div>
        </motion.div>
      </Stagger>

      <div className="space-y-4 lg:sticky lg:top-32 lg:self-start">
        <ScenarioControl value={scenario} onChange={onScenario} compact fieldId={field.id} />
        <div className="card flex items-start gap-3 p-4 text-sm text-ink-2">
          <Sprout className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
          Revisamos heladas, calor en floración, agua, suelo, salinidad y pendiente para cada cultivo y mes. Confirma variedades con tu agrónomo.
        </div>
        <div className="card flex items-start gap-3 p-4 text-sm text-ink-2">
          <TreeDeciduous className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
          En frutales, vid y nueces también revisamos las horas frío del invierno y las heladas en floración.
        </div>
      </div>

      <Sheet
        open={!!pick && !!picked}
        onOpenChange={(o) => !o && setPick(null)}
        title={
          picked && (
            <span className="inline-flex items-center gap-2">
              <span aria-hidden>{picked.emoji}</span> {picked.name.es}
            </span>
          )
        }
        description={
          picked
            ? picked.perennial
              ? `Perenne · primera cosecha en ${picked.years_to_first_harvest} año${picked.years_to_first_harvest === 1 ? '' : 's'}${picked.chill_hours ? ` · necesita ${picked.chill_hours[0]}–${picked.chill_hours[1]} horas frío según variedad` : ''}`
              : `Ciclo de ${picked.cycle_days[0]}–${picked.cycle_days[1]} días${picked.n_fixing ? ' · fija nitrógeno' : ''}`
            : undefined
        }
      >
        {pick && picked && <CropDetail field={field} crop={picked} month={pick.month} scenario={scenario} onMonth={(m) => setPick({ ...pick, month: m })} />}
      </Sheet>
    </div>
  )
}
