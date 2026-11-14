import * as maplibregl from 'maplibre-gl'
import { AnimatePresence, motion } from 'motion/react'
import { ArrowLeft, ArrowRight, CloudRain, Layers, Loader2, MessageCircle, Plus, Snowflake, Sun, Wind } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router'
import { NO_SCENARIO } from '@/api/client'
import type { Field, FieldKind, FieldProfile } from '@/api/types'
import { CROP_BY_ID } from '@/api/mock/engine/crops'
import { ChatLauncher } from '@/components/chat/chat-sheet'
import { useChat } from '@/components/chat/chat-store'
import { FieldShape } from '@/components/map/field-mini-map'
import { type Basemap, drawFieldCollection, fitAll, useMap } from '@/components/map/use-map'
import { Button } from '@/components/ui/button'
import { Segmented } from '@/components/ui/segmented'
import { StatusPill } from '@/components/ui/status'
import { isReady, useFields, useProfile, useSuitabilityMatrix } from '@/hooks/api'
import { cn } from '@/lib/cn'
import { dateLong, monthName, num } from '@/lib/format'
import { KIND } from '@/lib/kinds'
import { suitLabel, suitToLevel } from '@/lib/status'

type Filter = 'all' | FieldKind

/** Vista de mapa con todas las geocercas; clic = resumen rápido de lo que sabemos de ese terreno. */
export function MapPage() {
  const [params, setParams] = useSearchParams()
  const [basemap, setBasemap] = useState<Basemap>('satellite')
  const { container, map } = useMap({ center: [-101.0, 25.4], zoom: 5, basemap })
  const { data: fields = [], isLoading } = useFields()
  const [filter, setFilter] = useState<Filter>('all')
  const [showDemos, setShowDemos] = useState(true)
  const selectedId = params.get('id')
  const pills = useRef<maplibregl.Marker[]>([])
  const fitted = useRef(false)

  const mine = fields.filter((f) => !f.is_demo)
  const visible = useMemo(() => fields.filter((f) => (filter === 'all' || f.kind === filter) && (showDemos || !f.is_demo)), [fields, filter, showDemos])
  const selected = fields.find((f) => f.id === selectedId) ?? null
  const select = (id: string | null) => setParams(id ? { id } : {}, { replace: true })

  // Polígonos + etiquetas con el nombre.
  useEffect(() => {
    if (!map) return
    drawFieldCollection(map, 'all-fields', visible, { selected: selectedId })
    pills.current.forEach((m) => m.remove())
    pills.current = visible.map((f) => {
      const el = document.createElement('button')
      el.type = 'button'
      el.className = cn(
        'flex cursor-pointer items-center gap-1.5 rounded-full border border-white/20 bg-black/65 px-2.5 py-1 text-xs font-medium whitespace-nowrap text-white shadow-lg backdrop-blur transition-transform hover:scale-105',
        f.id === selectedId && 'ring-2 ring-white',
      )
      const dot = document.createElement('span')
      dot.className = 'h-2 w-2 rounded-full'
      dot.style.background = KIND[f.kind].color
      el.append(dot, document.createTextNode(f.name))
      el.addEventListener('click', (e) => {
        e.stopPropagation()
        select(f.id)
      })
      return new maplibregl.Marker({ element: el, anchor: 'bottom', offset: [0, -6] }).setLngLat(f.centroid).addTo(map)
    })
    // `select` cambia en cada render; las etiquetas se rehacen cuando cambian los datos.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, visible, selectedId])

  useEffect(() => () => pills.current.forEach((m) => m.remove()), [])

  // Clic en un polígono = seleccionar.
  useEffect(() => {
    if (!map) return
    const onClick = (e: maplibregl.MapMouseEvent) => {
      if (e.originalEvent.target !== map.getCanvas()) return // clic en una etiqueta HTML
      const hit = map.queryRenderedFeatures(e.point, { layers: ['all-fields-fill'] })[0]
      setParams(hit ? { id: String(hit.properties.id) } : {}, { replace: true })
    }
    const enter = () => (map.getCanvas().style.cursor = 'pointer')
    const leave = () => (map.getCanvas().style.cursor = '')
    map.on('click', onClick)
    map.on('mouseenter', 'all-fields-fill', enter)
    map.on('mouseleave', 'all-fields-fill', leave)
    return () => {
      map.off('click', onClick)
      map.off('mouseenter', 'all-fields-fill', enter)
      map.off('mouseleave', 'all-fields-fill', leave)
    }
  }, [map, setParams])

  // Encuadre inicial: tus terrenos (o los ejemplos si aún no tienes).
  useEffect(() => {
    if (!map || isLoading || fitted.current) return
    fitted.current = true
    const target = selected ? [selected] : mine.length ? mine : fields
    fitAll(map, target.map((f) => f.geometry), { padding: panelPadding(), maxZoom: 15 })
  }, [map, isLoading, fields, mine, selected])

  // Al seleccionar, vuela al terreno.
  useEffect(() => {
    if (!map || !selected || !fitted.current) return
    fitAll(map, [selected.geometry], { padding: panelPadding(), duration: 900, maxZoom: 16 })
  }, [map, selected])

  const counts = { field: fields.filter((f) => f.kind === 'field').length, greenhouse: fields.filter((f) => f.kind === 'greenhouse').length }

  return (
    <div className="relative min-h-[calc(100dvh-4rem)] flex-1">
      <div className="absolute inset-0">
        <div ref={container} className="h-full w-full" />
      </div>

      <div className="absolute top-4 right-4 z-10 flex flex-col items-end gap-2">
        <Segmented
          size="sm"
          value={basemap}
          onChange={setBasemap}
          className="shadow-lg ring-1 ring-line"
          options={[
            { value: 'satellite', label: 'Satélite' },
            { value: 'map', label: 'Mapa' },
          ]}
        />
        <div className="hidden rounded-2xl bg-surface/90 px-3 py-2 text-xs text-ink-2 shadow-lg ring-1 ring-line backdrop-blur sm:block">
          {(['field', 'greenhouse'] as const).map((k) => (
            <div key={k} className="flex items-center gap-2 py-0.5">
              <span className="h-3 w-3 rounded-[4px] border-2" style={{ borderColor: KIND[k].color, background: `${KIND[k].color}55` }} />
              {KIND[k].plural}
            </div>
          ))}
        </div>
      </div>

      <motion.aside
        initial={{ opacity: 0, x: -16 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ type: 'spring', stiffness: 260, damping: 28, delay: 0.1 }}
        className="absolute inset-x-3 bottom-3 z-10 max-h-[52dvh] overflow-y-auto rounded-[1.5rem] border border-line bg-surface/95 p-5 shadow-2xl backdrop-blur-xl sm:top-4 sm:right-auto sm:bottom-auto sm:left-4 sm:max-h-[calc(100%-2rem)] sm:w-[380px]"
      >
        <AnimatePresence mode="wait" initial={false}>
          {selected ? (
            <motion.div key={selected.id} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }}>
              <FieldDetail field={selected} onBack={() => select(null)} />
            </motion.div>
          ) : (
            <motion.div key="list" initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 12 }} className="space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h1 className="text-xl font-semibold tracking-tight text-ink">Tus terrenos</h1>
                  <p className="mt-0.5 text-sm text-ink-2">Toca uno en el mapa o en la lista para ver lo que sabemos.</p>
                </div>
                <Link to="/nueva">
                  <Button size="icon" variant="accent" aria-label="Nuevo terreno" title="Nuevo terreno">
                    <Plus className="h-4 w-4" />
                  </Button>
                </Link>
              </div>
              <Segmented
                size="sm"
                value={filter}
                onChange={setFilter}
                className="w-full [&>button]:flex-1"
                options={[
                  { value: 'all', label: `Todos (${fields.length})` },
                  { value: 'field', label: `${KIND.field.plural} (${counts.field})` },
                  { value: 'greenhouse', label: `${KIND.greenhouse.plural} (${counts.greenhouse})` },
                ]}
              />
              <ul className="space-y-1.5">
                {isLoading && <li className="skeleton h-16" />}
                {visible.map((f) => (
                  <li key={f.id}>
                    <button onClick={() => select(f.id)} className="group flex w-full cursor-pointer items-center gap-3 rounded-2xl p-2 text-left transition-colors hover:bg-surface-2">
                      <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-surface-2 group-hover:bg-surface">
                        <FieldShape geometry={f.geometry} kind={f.kind} className="h-10 w-10" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-ink">{f.name}</span>
                        <span className="block truncate text-xs text-muted">
                          {KIND[f.kind].label} · {num(f.area_ha, 1)} ha{f.is_demo ? ' · ejemplo' : ''}
                        </span>
                      </span>
                      <ArrowRight className="h-4 w-4 shrink-0 text-muted transition-transform group-hover:translate-x-0.5" />
                    </button>
                  </li>
                ))}
                {!isLoading && visible.length === 0 && <li className="rounded-2xl bg-surface-2 p-4 text-sm text-ink-2">No hay terrenos con este filtro.</li>}
              </ul>
              <label className="flex cursor-pointer items-center gap-2 text-sm text-ink-2">
                <input type="checkbox" checked={showDemos} onChange={(e) => setShowDemos(e.target.checked)} className="h-4 w-4 accent-[var(--accent)]" />
                Mostrar ejemplos
              </label>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.aside>

      {selected && <ChatLauncher field={selected} ready fab={false} />}
    </div>
  )
}

/** Deja libre el espacio del panel al encuadrar. */
function panelPadding(): maplibregl.PaddingOptions {
  const wide = window.matchMedia('(min-width: 640px)').matches
  return wide ? { top: 60, bottom: 60, left: 420, right: 60 } : { top: 40, bottom: Math.round(window.innerHeight * 0.55), left: 30, right: 30 }
}

function Stat({ icon, label, value, children }: { icon: ReactNode; label: string; value: ReactNode; children?: ReactNode }) {
  return (
    <div className="rounded-xl bg-surface-2 p-3">
      <div className="flex items-center gap-1.5 text-xs text-muted">
        {icon}
        {label}
      </div>
      <div className="tabular mt-1 text-[15px] font-semibold text-ink">{value}</div>
      {children}
    </div>
  )
}

function FieldDetail({ field, onBack }: { field: Field; onBack: () => void }) {
  const profile = useProfile(field.id)
  const p = profile.data
  const ready = isReady(p)
  const k = KIND[field.kind]
  const crops = [...new Set((field.current_rotation ?? []).map((s) => s.crop_id))].map((id) => (id ? CROP_BY_ID.get(id) : null)).filter((c) => !!c)
  const openChat = useChat((s) => s.setOpen)

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="inline-flex cursor-pointer items-center gap-1 text-xs font-medium text-muted hover:text-ink">
        <ArrowLeft className="h-3.5 w-3.5" /> Todos los terrenos
      </button>
      <div>
        <div className="flex items-center gap-1.5 text-xs font-medium" style={{ color: `var(--kind-${field.kind})` }}>
          <k.icon className="h-3.5 w-3.5" /> {k.label}
          {field.is_demo && <span className="ml-1 rounded-full bg-surface-2 px-2 py-0.5 text-ink-2">Ejemplo</span>}
        </div>
        <h2 className="mt-1 text-xl font-semibold tracking-tight text-ink">{field.name}</h2>
        <p className="text-sm text-ink-2">
          {num(field.area_ha, 1)} ha{field.admin.municipality || field.admin.state ? ` · ${[field.admin.municipality, field.admin.state].filter(Boolean).join(', ')}` : ''}
        </p>
        {crops.length > 0 && (
          <p className="mt-2 text-sm text-ink-2">
            Siembra: {crops.map((c) => `${c.emoji} ${c.name.es}`).join(' · ')}
          </p>
        )}
      </div>

      {profile.isError ? (
        <p className="rounded-2xl bg-surface-2 p-4 text-sm text-ink-2">{(profile.error as Error).message}</p>
      ) : !ready ? (
        <div className="flex items-center gap-3 rounded-2xl bg-surface-2 p-4 text-sm text-ink-2">
          <Loader2 className="h-4 w-4 animate-spin" /> Analizando con datos de la NASA…
        </div>
      ) : (
        <QuickFacts field={field} profile={p} />
      )}

      <div className="flex flex-wrap gap-2">
        <Link to={`/parcela/${field.id}`} className="flex-1">
          <Button variant="accent" className="w-full justify-center">
            Ver análisis completo <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
        <Button variant="outline" onClick={() => openChat(true)} disabled={!ready}>
          <MessageCircle className="h-4 w-4" /> Preguntar
        </Button>
      </div>
    </div>
  )
}

function QuickFacts({ field, profile }: { field: Field; profile: FieldProfile }) {
  const c = profile.climate
  const month = new Date().getMonth() + 1
  const matrix = useSuitabilityMatrix(field.id, NO_SCENARIO, true)
  const top = useMemo(() => {
    const m = matrix.data
    if (!m) return []
    const i = m.months.indexOf(month)
    return m.crops
      .filter((c) => !CROP_BY_ID.get(c.crop_id)?.perennial)
      .map((c) => ({ id: c.crop_id, score: c.scores[i], status: c.status[i] }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
  }, [matrix.data, month])
  const frostFree = (c.frost.share_years_without_frost ?? 0) >= 0.9
  const hot = c.heat.by_month[c.heat.hottest_month - 1]
  const gust10 = c.wind.return_levels_kmh[0]?.estimated_gust_kmh ?? null
  const rated = field.greenhouse?.rated_wind_kmh ?? null
  const om = profile.soil.lab?.om_pct ?? profile.soil.layers[0]?.om_pct

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <Stat icon={<Snowflake className="h-3.5 w-3.5" />} label="Sin helada desde" value={frostFree ? 'Todo el año' : dateLong(c.frost.last_spring_frost.p90?.date)} />
        <Stat icon={<CloudRain className="h-3.5 w-3.5" />} label="Lluvia al año" value={`${num(c.rain.annual_mean_mm)} mm`} />
        <Stat icon={<Sun className="h-3.5 w-3.5" />} label="Mes más caliente" value={<span className="capitalize">{monthName(c.heat.hottest_month)} · {num(hot.mean_tmax_c)} °C</span>} />
        {field.kind === 'greenhouse' ? (
          <Stat icon={<Wind className="h-3.5 w-3.5" />} label="Ráfaga cada 10 años" value={`${num(gust10)} km/h`}>
            {rated != null && gust10 != null && <StatusPill className="mt-1.5" level={rated < gust10 ? 'bad' : 'ok'} label={rated < gust10 ? `Supera ${rated} km/h` : 'Tu estructura aguanta'} />}
          </Stat>
        ) : (
          <Stat icon={<Layers className="h-3.5 w-3.5" />} label="Materia orgánica" value={`${num(om, 1)} %`}>
            <span className="mt-0.5 block text-[11px] text-muted">{profile.soil.lab ? 'De tu análisis' : 'Estimada'}</span>
          </Stat>
        )}
      </div>
      <div>
        <div className="mb-1.5 text-xs font-medium text-muted">Mejor para sembrar en {monthName(month)}</div>
        {matrix.isLoading ? (
          <div className="skeleton h-20" />
        ) : (
          <ul className="space-y-1">
            {top.map((t) => {
              const crop = CROP_BY_ID.get(t.id)
              return (
                <li key={t.id} className="flex items-center gap-2 text-sm text-ink">
                  <span aria-hidden>{crop?.emoji}</span>
                  <span className="flex-1">{crop?.name.es}</span>
                  <StatusPill level={suitToLevel(t.status)} label={`${suitLabel(t.status)} · ${t.score}`} />
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
