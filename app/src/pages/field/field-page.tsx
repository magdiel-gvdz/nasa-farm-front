import { AnimatePresence, motion } from 'motion/react'
import { ArrowLeft, CalendarDays, Droplets, FlaskConical, LayoutGrid, MapPinned, Printer, RefreshCw, Sprout, Trash2, Warehouse, Repeat } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { NO_SCENARIO } from '@/api/client'
import type { Scenario } from '@/api/types'
import { ChatLauncher } from '@/components/chat/chat-sheet'
import { Button } from '@/components/ui/button'
import { isReady, useDeleteField, useField, useProfile } from '@/hooks/api'
import { cn } from '@/lib/cn'
import { num } from '@/lib/format'
import { CalendarTab } from './calendar-tab'
import { CropsTab } from './crops-tab'
import { GreenhouseTab } from './greenhouse-tab'
import { Processing } from './processing'
import { RotationsTab } from './rotations-tab'
import { SoilTab } from './soil-tab'
import { SummaryTab } from './summary-tab'
import { WaterTab } from './water-tab'

const TABS = [
  { id: 'resumen', label: 'Summary', icon: LayoutGrid },
  { id: 'calendario', label: 'Calendar', icon: CalendarDays },
  { id: 'sembrar', label: 'What to plant?', icon: Sprout },
  { id: 'rotaciones', label: 'Rotations', icon: Repeat },
  { id: 'suelo', label: 'Soil', icon: FlaskConical },
  { id: 'agua', label: 'Water', icon: Droplets },
  { id: 'invernadero', label: 'Greenhouse', icon: Warehouse },
] as const
type TabId = (typeof TABS)[number]['id']

export function FieldPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const field = useField(id)
  const profile = useProfile(id)
  const del = useDeleteField()
  const [scenario, setScenario] = useState<Scenario>(NO_SCENARIO)

  const f = field.data
  const tabs = TABS.filter((t) => t.id !== 'invernadero' || f?.kind === 'greenhouse')
  const tab = (tabs.find((t) => t.id === params.get('tab'))?.id ?? 'resumen') as TabId
  const setTab = (t: TabId) => setParams({ tab: t }, { replace: true })

  if (field.isError) {
    return (
      <div className="mx-auto max-w-md px-4 py-24 text-center">
        <h1 className="text-xl font-semibold text-ink">We did not find this field</h1>
        <p className="mt-2 text-ink-2">It may have been deleted from this device.</p>
        <Link to="/" className="mt-6 inline-block">
          <Button variant="outline">Back to home</Button>
        </Link>
      </div>
    )
  }

  const p = profile.data
  const ready = isReady(p)

  return (
    <div className="mx-auto w-full max-w-7xl px-4 pb-28 sm:px-6">
      {/* Encabezado */}
      <div className="flex flex-wrap items-end gap-4 pt-6 pb-5">
        <div className="min-w-0 flex-1">
          <Link to="/" className="no-print inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
            <ArrowLeft className="h-4 w-4" /> My fields
          </Link>
          {f ? (
            <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
              <h1 className="mt-2 truncate text-2xl font-semibold tracking-tight text-ink sm:text-3xl">{f.name}</h1>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-2">
                <span className="inline-flex items-center gap-1.5">
                  {f.kind === 'greenhouse' ? <Warehouse className="h-4 w-4" style={{ color: 'var(--kind-greenhouse)' }} /> : <MapPinned className="h-4 w-4" style={{ color: 'var(--kind-field)' }} />}
                  {f.kind === 'greenhouse' ? 'Greenhouse' : 'Field'}
                </span>
                <span>{num(f.area_ha, 1)} ha</span>
                {(f.admin.municipality || f.admin.state) && <span>{[f.admin.municipality, f.admin.state].filter(Boolean).join(', ')}</span>}
                {f.is_demo && <span className="rounded-full bg-accent-soft px-2 py-0.5 text-xs font-medium text-ink">Example</span>}
              </div>
            </motion.div>
          ) : (
            <div className="mt-2 space-y-2">
              <div className="skeleton h-8 w-64" />
              <div className="skeleton h-4 w-40" />
            </div>
          )}
        </div>
        {ready && (
          <div className="no-print flex gap-1">
            <Button variant="ghost" size="icon" onClick={() => window.print()} aria-label="Print plan" title="Print or save as PDF">
              <Printer className="h-4 w-4" />
            </Button>
            {f && !f.is_demo && (
              <Button
                variant="ghost"
                size="icon"
                aria-label="Delete field"
                title="Delete field"
                onClick={async () => {
                  if (!confirm(`Delete "${f.name}" from this device?`)) return
                  await del.mutateAsync(f.id)
                  navigate('/')
                }}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        )}
      </div>

      {profile.isError ? (
        <div className="card mx-auto max-w-lg p-8 text-center">
          <h2 className="font-semibold text-ink">We could not analyze the field</h2>
          <p className="mt-2 text-sm text-ink-2">{(profile.error as Error).message}</p>
          <Button className="mt-5" variant="outline" onClick={() => profile.refetch()}>
            <RefreshCw className="h-4 w-4" /> Retry
          </Button>
        </div>
      ) : !ready || !f ? (
        <Processing steps={p && p.status === 'processing' ? p.steps : []} />
      ) : (
        <>
          {/* Pestañas */}
          <nav className="no-print sticky top-16 z-30 -mx-4 mb-6 overflow-x-auto bg-page/80 px-4 py-2 backdrop-blur-xl sm:-mx-6 sm:px-6">
            <div className="inline-flex gap-1 rounded-full bg-surface-2 p-1">
              {tabs.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={cn('relative inline-flex h-9 cursor-pointer items-center gap-2 rounded-full px-4 text-sm font-medium whitespace-nowrap transition-colors', tab === t.id ? 'text-ink' : 'text-muted hover:text-ink-2')}
                >
                  {tab === t.id && <motion.span layoutId="field-tab" className="absolute inset-0 rounded-full bg-surface shadow-sm ring-1 ring-line" transition={{ type: 'spring', stiffness: 420, damping: 34 }} />}
                  <t.icon className="relative h-4 w-4" />
                  <span className="relative">{t.label}</span>
                </button>
              ))}
            </div>
          </nav>

          <AnimatePresence mode="wait">
            <motion.div key={tab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.2 }}>
              {tab === 'resumen' && <SummaryTab field={f} profile={p} onNavigate={setTab} onScenario={setScenario} />}
              {tab === 'calendario' && <CalendarTab profile={p} />}
              {tab === 'sembrar' && <CropsTab field={f} scenario={scenario} onScenario={setScenario} />}
              {tab === 'rotaciones' && <RotationsTab field={f} profile={p} scenario={scenario} onScenario={setScenario} />}
              {tab === 'suelo' && <SoilTab field={f} profile={p} />}
              {tab === 'agua' && <WaterTab field={f} profile={p} />}
              {tab === 'invernadero' && <GreenhouseTab field={f} />}
            </motion.div>
          </AnimatePresence>
        </>
      )}

      {f && <ChatLauncher field={f} ready={ready} />}
    </div>
  )
}

export type { TabId }
