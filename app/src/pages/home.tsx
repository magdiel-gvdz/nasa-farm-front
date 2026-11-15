import { motion } from 'motion/react'
import { ArrowRight, CloudRain, Droplets, Layers, Map as MapIcon, MapPinned, MessageCircle, Satellite, Snowflake, Sprout, Sun } from 'lucide-react'
import { Link } from 'react-router'
import { isDemoMode } from '@/api/client'
import type { Field } from '@/api/types'
import { DEMOS } from '@/api/mock/demos'
import { FieldShape } from '@/components/map/field-mini-map'
import { Button } from '@/components/ui/button'
import { fadeUp, stagger } from '@/components/ui/motion'
import { useFields, useSources } from '@/hooks/api'
import { num } from '@/lib/format'
import { KIND } from '@/lib/kinds'

const ORBIT_CHIPS = [
  { icon: Snowflake, label: 'Frost', angle: -40 },
  { icon: CloudRain, label: 'Rainfall', angle: 50 },
  { icon: Sun, label: 'Heat', angle: 140 },
  { icon: Droplets, label: 'Water', angle: 230 },
]

function Orbit() {
  return (
    <div className="relative mx-auto aspect-square w-full max-w-[420px]" aria-hidden>
      {/* Planeta */}
      <motion.div
        className="absolute inset-[22%] rounded-full bg-gradient-to-br from-accent/30 via-accent/10 to-transparent ring-1 ring-line"
        animate={{ scale: [1, 1.03, 1] }}
        transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
      />
      <div className="absolute inset-[30%] grid place-items-center rounded-full bg-surface ring-1 ring-line">
        <Sprout className="h-14 w-14 text-accent" strokeWidth={1.6} />
      </div>
      {/* Órbita y satélite */}
      <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full">
        <ellipse cx="50" cy="50" rx="46" ry="46" className="fill-none stroke-line-strong" strokeWidth="0.3" strokeDasharray="0.8 1.6" />
        <ellipse cx="50" cy="50" rx="36" ry="36" className="fill-none stroke-line" strokeWidth="0.3" />
      </svg>
      <motion.div className="absolute inset-0" animate={{ rotate: 360 }} transition={{ duration: 24, repeat: Infinity, ease: 'linear' }}>
        <div className="absolute top-[2%] left-1/2 -translate-x-1/2">
          <div className="relative grid h-9 w-9 place-items-center rounded-xl bg-ink text-page shadow-lg">
            <span className="absolute inset-0 animate-pulse-ring rounded-xl bg-accent/40" />
            <Satellite className="relative h-5 w-5" strokeWidth={1.8} />
          </div>
        </div>
      </motion.div>
      {ORBIT_CHIPS.map((c, i) => {
        const rad = (c.angle * Math.PI) / 180
        return (
          <motion.div
            key={c.label}
            className="absolute"
            style={{ left: `${50 + 36 * Math.cos(rad)}%`, top: `${50 + 36 * Math.sin(rad)}%` }}
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1, y: [0, -4, 0] }}
            transition={{ opacity: { delay: 0.4 + i * 0.15 }, scale: { delay: 0.4 + i * 0.15, type: 'spring' }, y: { duration: 4, repeat: Infinity, delay: i * 0.6, ease: 'easeInOut' } }}
          >
            <div className="-translate-x-1/2 -translate-y-1/2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1.5 text-xs font-medium text-ink shadow-sm">
                <c.icon className="h-3.5 w-3.5 text-ink-2" />
                {c.label}
              </span>
            </div>
          </motion.div>
        )
      })}
    </div>
  )
}

function FieldCard({ field, story }: { field: Field; story?: string }) {
  const k = KIND[field.kind]
  return (
    <motion.div variants={fadeUp} whileHover={{ y: -3 }} transition={{ type: 'spring', stiffness: 300, damping: 22 }}>
      <Link to={`/parcela/${field.id}`} className="card group flex h-full items-center gap-4 p-4 transition-shadow hover:shadow-lg hover:shadow-black/5">
        <div className="grid h-20 w-20 shrink-0 place-items-center rounded-2xl bg-surface-2">
          <FieldShape geometry={field.geometry} kind={field.kind} className="h-16 w-16" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 text-xs text-muted">
            <k.icon className="h-3.5 w-3.5" style={{ color: `var(--kind-${field.kind})` }} />
            {k.label} · {num(field.area_ha, 1)} ha
          </div>
          <div className="mt-0.5 truncate font-semibold text-ink">{field.name}</div>
          <div className="line-clamp-2 text-sm text-ink-2">{story ?? [field.admin.municipality, field.admin.state].filter(Boolean).join(', ')}</div>
        </div>
        <ArrowRight className="h-4 w-4 shrink-0 text-muted transition-transform group-hover:translate-x-1 group-hover:text-ink" />
      </Link>
    </motion.div>
  )
}

function MapLink() {
  return (
    <Link to="/mapa">
      <Button size="sm" variant="outline">
        <MapIcon className="h-4 w-4" /> See on map
      </Button>
    </Link>
  )
}

const STEPS = [
  { icon: MapPinned, title: 'Outline your field', text: 'Tap the corners of your field or greenhouse on the satellite map.' },
  { icon: Layers, title: 'We analyze it with NASA', text: '35 years of frost, rainfall, heat, and wind data, plus soil, water, and vegetation insights.' },
  { icon: MessageCircle, title: 'Decide with confidence', text: 'What to plant and when, what rotation is best for you and an agronomist for your questions.' },
]

export function HomePage() {
  const fieldsQuery = useFields()
  const fields = fieldsQuery.data
  const sources = useSources()
  const mine = fields?.filter((f) => !f.is_demo) ?? []

  return (
    <div className="mx-auto w-full max-w-7xl px-4 pb-20 sm:px-6">
      {fieldsQuery.isError && <div role="alert" className="card mt-5 p-4 text-sm text-bad">{fieldsQuery.error.message}<Button variant="outline" className="ml-3" onClick={() => fieldsQuery.refetch()}>Retry</Button></div>}
      {/* Hero */}
      <section className="grid items-center gap-10 py-12 md:grid-cols-[1.1fr_1fr] md:py-20">
        <motion.div variants={stagger(0.08)} initial="hidden" animate="show">
          <motion.p variants={fadeUp} className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 text-xs font-medium text-ink-2">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" /> NASA Space Apps 2026 · Field Shift
          </motion.p>
          <motion.h1 variants={fadeUp} className="mt-5 text-4xl leading-[1.05] font-semibold tracking-tight text-balance text-ink sm:text-6xl">
            Know your land <span className="text-accent">before you plant.</span>
          </motion.h1>
          <motion.p variants={fadeUp} className="mt-5 max-w-xl text-lg text-pretty text-ink-2">
            Draw your field and we will tell you what to plant, when to do it and how to take care of your soil and water, with NASA satellite data explained in simple words.
          </motion.p>
          <motion.div variants={fadeUp} className="mt-8 flex flex-wrap gap-3">
            <Link to="/nueva">
              <Button size="lg" variant="accent">
                <MapPinned className="h-5 w-5" /> Draw my field
              </Button>
            </Link>
            {isDemoMode && <Link to={`/parcela/${DEMOS[0].field.id}`}>
              <Button size="lg" variant="outline">
                See an example <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>}
          </motion.div>
          <motion.p variants={fadeUp} className="mt-4 text-sm text-muted">
            No registration. Free. Your fields are linked to this browser.
          </motion.p>
        </motion.div>
        <motion.div initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}>
          <Orbit />
        </motion.div>
      </section>

      {/* Mis parcelas */}
      {mine.length > 0 && (
        <section className="mb-12">
          <div className="mb-4 flex items-center justify-between gap-4">
            <h2 className="text-lg font-semibold text-ink">Your fields</h2>
            <MapLink />
          </div>
          <motion.div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" variants={stagger()} initial="hidden" animate="show">
            {mine.map((f) => (
              <FieldCard key={f.id} field={f} />
            ))}
          </motion.div>
        </section>
      )}

      {/* Examples */}
      {isDemoMode && <section className="mb-16">
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-ink">Explore an example</h2>
            <p className="text-sm text-ink-2">Three examples with NASA POWER climate data from 1991–2025.</p>
          </div>
          {mine.length === 0 && <MapLink />}
        </div>
        <motion.div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" variants={stagger()} initial="hidden" whileInView="show" viewport={{ once: true, margin: '-60px' }}>
          {DEMOS.map((d) => (
            <FieldCard key={d.field.id} field={d.field} story={d.story} />
          ))}
        </motion.div>
      </section>}

      {/* Cómo funciona */}
      <section>
        <h2 className="mb-4 text-lg font-semibold text-ink">How it works</h2>
        <motion.ol className="grid gap-3 md:grid-cols-3" variants={stagger(0.1)} initial="hidden" whileInView="show" viewport={{ once: true, margin: '-60px' }}>
          {STEPS.map((s, i) => (
            <motion.li key={s.title} variants={fadeUp} className="card p-6">
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-accent-soft text-accent">
                  <s.icon className="h-5 w-5" />
                </span>
                <span className="text-sm font-medium text-muted">Step {i + 1}</span>
              </div>
              <h3 className="mt-4 font-semibold text-ink">{s.title}</h3>
              <p className="mt-1 text-sm text-ink-2">{s.text}</p>
            </motion.li>
          ))}
        </motion.ol>
        <p className="mt-10 text-center text-xs text-pretty text-muted">
          Sources: {sources.data?.map((s) => s.dataset).join(' / ') ?? 'listed in each zonal profile'}. Data gaps are listed with each assessment. Review decisions with your agronomist.
        </p>
      </section>
    </div>
  )
}
