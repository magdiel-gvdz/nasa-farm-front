import * as maplibregl from 'maplibre-gl'
import { AnimatePresence, motion } from 'motion/react'
import { ArrowLeft, Check, Crosshair, Loader2, LocateFixed, Search, Trash2, TriangleAlert, Undo2 } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import type { Crop, FieldInput, FieldKind, GreenhouseInfo, Geometry } from '@/api/types'
import { isDemoMode } from '@/api/client'
import { ApiError } from '@/api/errors'
import { searchCrops } from '@/lib/crops'
import { type Basemap, drawField, drawFieldCollection, useMap } from '@/components/map/use-map'
import { Button } from '@/components/ui/button'
import { Segmented } from '@/components/ui/segmented'
import { Slider } from '@/components/ui/slider'
import { useCreateField, useCrops, useFields } from '@/hooks/api'
import { cn } from '@/lib/cn'
import { num } from '@/lib/format'
import { areaHa, type Place, searchPlaces, selfIntersects } from '@/lib/geo'
import { KIND } from '@/lib/kinds'

type Step = 'draw' | 'details'
type Pt = [number, number]

const SUMMER = ['maiz', 'frijol', 'sorgo', 'alfalfa', 'chile', 'melon', 'algodon']
const WINTER = ['avena_forrajera', 'avena', 'trigo', 'cebada', 'veza', 'garbanzo', 'ajo']
const ORCHARD = ['uva', 'nogal', 'manzana', 'durazno', 'membrillo', 'nopal']

function PlaceSearch({ onPick }: { onPick: (p: Place) => void }) {
  const [q, setQ] = useState('')
  const [results, setResults] = useState<Place[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)

  const tooShort = q.trim().length < 3
  const shown = tooShort ? [] : results

  useEffect(() => {
    if (q.trim().length < 3) return
    const ctrl = new AbortController()
    const t = setTimeout(() => {
      setLoading(true)
      searchPlaces(q, ctrl.signal)
        .then(setResults)
        .catch(() => {})
        .finally(() => setLoading(false))
    }, 280)
    return () => {
      clearTimeout(t)
      ctrl.abort()
    }
  }, [q])

  return (
    <div className="relative">
      <Search className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-muted" />
      <input
        value={q}
        onChange={(e) => {
          setQ(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        placeholder="Search for your town, ranch or city"
        className="h-11 w-full rounded-full border border-line-strong bg-surface pr-10 pl-10 text-sm text-ink outline-none placeholder:text-muted focus:border-accent"
      />
      {loading && !tooShort && <Loader2 className="absolute top-1/2 right-3.5 h-4 w-4 -translate-y-1/2 animate-spin text-muted" />}
      <AnimatePresence>
        {open && shown.length > 0 && (
          <motion.ul
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="absolute top-12 right-0 left-0 z-10 overflow-hidden rounded-2xl border border-line bg-surface shadow-xl"
          >
            {shown.map((r, i) => (
              <li key={`${r.name}-${i}`}>
                <button
                  className="flex w-full cursor-pointer flex-col items-start px-4 py-2.5 text-left hover:bg-surface-2"
                  onClick={() => {
                    onPick(r)
                    setQ(r.name)
                    setOpen(false)
                  }}
                >
                  <span className="text-sm font-medium text-ink">{r.name}</span>
                  {r.detail && <span className="text-xs text-muted">{r.detail}</span>}
                </button>
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  )
}

function CropPicker({
  label,
  options,
  pool,
  value,
  onChange,
  noneLabel = 'None / fallow',
}: {
  label: string
  options: string[]
  pool: Crop[]
  value: string | null
  onChange: (v: string | null) => void
  noneLabel?: string
}) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const cropById = new Map(pool.map((c) => [c.id, c]))
  const quick = (value && !options.includes(value) ? [...options, value] : options).filter((id) => cropById.has(id))
  const results = open ? searchCrops(q, pool).slice(0, 14) : []
  const chip = (id: string | null) => {
    const crop = id ? cropById.get(id) : null
    const active = value === id
    return (
      <button
        key={id ?? 'none'}
        onClick={() => onChange(id)}
        className={cn(
          'inline-flex cursor-pointer items-center gap-1 rounded-full border px-3 py-1.5 text-sm transition-colors',
          active ? 'border-accent bg-accent-soft text-ink' : 'border-line bg-surface text-ink-2 hover:bg-surface-2',
        )}
      >
        {crop ? (
          <>
            <span aria-hidden>{crop.emoji}</span> {crop.name.en}
          </>
        ) : (
          noneLabel
        )}
      </button>
    )
  }
  return (
    <div>
      <div className="mb-2 text-sm font-medium text-ink">{label}</div>
      <div className="flex flex-wrap gap-1.5">
        {[null, ...quick].map(chip)}
        <button onClick={() => setOpen((o) => !o)} className="inline-flex cursor-pointer items-center gap-1 rounded-full border border-dashed border-line-strong px-3 py-1.5 text-sm text-ink-2 hover:bg-surface-2">
          <Search className="h-3.5 w-3.5" /> {open ? 'Close' : 'Other…'}
        </button>
      </div>
      {open && (
        <div className="mt-2 rounded-2xl bg-surface-2 p-2">
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={`Search among ${pool.length} cultivos`}
            className="h-9 w-full rounded-full border border-line-strong bg-surface px-3.5 text-sm text-ink outline-none placeholder:text-muted focus:border-accent"
          />
          <div className="mt-2 flex max-h-40 flex-wrap gap-1.5 overflow-y-auto">
            {results.map((c) => (
              <button
                key={c.id}
                onClick={() => {
                  onChange(c.id)
                  setOpen(false)
                  setQ('')
                }}
                className="inline-flex cursor-pointer items-center gap-1 rounded-full border border-line bg-surface px-3 py-1.5 text-sm text-ink-2 hover:bg-surface-3"
              >
                <span aria-hidden>{c.emoji}</span> {c.name.en}
              </button>
            ))}
            {!results.length && <span className="px-2 py-1 text-sm text-muted">No results</span>}
          </div>
        </div>
      )}
    </div>
  )
}

export function NewFieldPage() {
  const navigate = useNavigate()
  const create = useCreateField()
  const catalog = useCrops()
  const crops = catalog.data ?? []
  const ANNUALS = crops.filter((c) => !c.perennial)
  const PERENNIALS = crops.filter((c) => c.perennial && c.category !== 'vegetable')
  const GH = isDemoMode ? crops.filter((c) => c.greenhouse_ok) : crops
  const [basemap, setBasemap] = useState<Basemap>('satellite')
  const { container, map } = useMap({ center: [-101.27, 25.27], zoom: 13, basemap })
  const [history, setHistory] = useState<Pt[][]>([[]])
  const points = history[history.length - 1]
  const setPoints = (next: Pt[] | ((p: Pt[]) => Pt[])) => setHistory((h) => [...h, typeof next === 'function' ? next(h[h.length - 1]) : next])
  const undo = () => setHistory((h) => (h.length > 1 ? h.slice(0, -1) : h))
  const [step, setStep] = useState<Step>('draw')
  const markers = useRef<maplibregl.Marker[]>([])
  const { data: existing = [] } = useFields()
  const stepRef = useRef(step)
  useEffect(() => {
    stepRef.current = step
  }, [step])

  // Datos del formulario
  const [name, setName] = useState('My field')
  const [kind, setKind] = useState<FieldKind>('field')
  const [summer, setSummer] = useState<string | null>('maiz')
  const [winter, setWinter] = useState<string | null>(null)
  const [orchard, setOrchard] = useState<string | null>(null)
  const [irrigation, setIrrigation] = useState(true)
  const [irrMm, setIrrMm] = useState(450)
  const [livestock, setLivestock] = useState(false)
  const [head, setHead] = useState(20)
  const [cover, setCover] = useState<GreenhouseInfo['cover']>('polietileno')
  const [rated, setRated] = useState<number | null>(90)

  const geometry: Geometry | null = useMemo(() => (points.length >= 3 ? { type: 'Polygon', coordinates: [[...points, points[0]]] } : null), [points])
  const area = geometry ? areaHa(geometry) : 0
  const crossing = points.length >= 4 && selfIntersects(points)
  const color = KIND[kind].color
  const canContinue = points.length >= 3 && !crossing
  const compact = points.length > 0

  // Tus otros terrenos, tenues, como referencia para no encimar.
  useEffect(() => {
    if (map) drawFieldCollection(map, 'others', existing.filter((f) => !f.is_demo), { dim: true })
  }, [map, existing])

  // Clic en el mapa = nueva esquina
  useEffect(() => {
    if (!map) return
    const onClick = (e: maplibregl.MapMouseEvent) => {
      if (stepRef.current !== 'draw') return
      // Los clics sobre vértices o "+" (elementos HTML) no agregan puntos.
      if (e.originalEvent.target !== map.getCanvas()) return
      setHistory((h) => [...h, [...h[h.length - 1], [e.lngLat.lng, e.lngLat.lat]]])
    }
    map.on('click', onClick)
    map.getCanvas().style.cursor = 'crosshair'
    return () => {
      map.off('click', onClick)
    }
  }, [map])

  // Dibujo del polígono / línea, vértices arrastrables y "+" en cada arista para agregar vértices.
  useEffect(() => {
    if (!map) return
    drawField(map, 'draft', geometry, { color })
    const lineData = { type: 'Feature' as const, properties: {}, geometry: { type: 'LineString' as const, coordinates: points.length === 2 ? points : [] } }
    const src = map.getSource('draft-line') as maplibregl.GeoJSONSource | undefined
    if (src) src.setData(lineData)
    else {
      map.addSource('draft-line', { type: 'geojson', data: lineData })
      if (!map.getLayer('draft-line')) map.addLayer({ id: 'draft-line', type: 'line', source: 'draft-line', paint: { 'line-color': color, 'line-width': 2.5, 'line-dasharray': [2, 1.5] } })
    }
    map.setPaintProperty('draft-line', 'line-color', color)
    markers.current.forEach((m) => m.remove())
    const editable = step === 'draw'

    const vertices = points.map((p, i) => {
      const el = document.createElement('div')
      el.className = 'h-4 w-4 rounded-full border-[3px] border-white shadow-md ' + (editable ? 'cursor-grab' : '')
      el.style.background = color
      const closer = editable && i === 0 && points.length >= 3
      if (closer) {
        el.classList.add('ring-4', 'ring-white/50', 'cursor-pointer')
        el.title = 'Close figure'
      }
      const marker = new maplibregl.Marker({ element: el, draggable: editable }).setLngLat(p).addTo(map)
      let dragged = false
      marker.on('dragstart', () => (dragged = true))
      marker.on('dragend', () => {
        const ll = marker.getLngLat()
        setPoints((ps) => ps.map((q, j) => (j === i ? [ll.lng, ll.lat] : q)))
      })
      el.addEventListener('click', (e) => {
        e.stopPropagation()
        if (!dragged && closer && !selfIntersects(points)) setStep('details')
        dragged = false
      })
      return marker
    })

    const mids =
      editable && points.length >= 3
        ? points.map((p, i) => {
            const q = points[(i + 1) % points.length]
            const mid: Pt = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2]
            const el = document.createElement('div')
            el.className = 'grid h-5 w-5 place-items-center rounded-full bg-white/85 text-[13px] leading-none font-bold shadow cursor-copy select-none'
            el.style.color = '#14532d'
            el.textContent = '+'
            el.title = 'Add a vertex here (tap or drag)'
            const marker = new maplibregl.Marker({ element: el, draggable: true }).setLngLat(mid).addTo(map)
            let dragged = false
            marker.on('dragstart', () => (dragged = true))
            marker.on('dragend', () => {
              const ll = marker.getLngLat()
              setPoints((ps) => [...ps.slice(0, i + 1), [ll.lng, ll.lat], ...ps.slice(i + 1)])
            })
            el.addEventListener('click', (e) => {
              e.stopPropagation()
              if (!dragged) setPoints((ps) => [...ps.slice(0, i + 1), mid, ...ps.slice(i + 1)])
              dragged = false
            })
            return marker
          })
        : []
    markers.current = [...vertices, ...mids]
  }, [map, points, geometry, step, color])

  const flyTo = (p: Place) => {
    if (!map) return
    if (p.extent) map.fitBounds([[p.extent[0], p.extent[3]], [p.extent[2], p.extent[1]]], { padding: 40, maxZoom: 15 })
    else map.flyTo({ center: p.center, zoom: 14 })
  }

  const locate = () =>
    navigator.geolocation?.getCurrentPosition((pos) => map?.flyTo({ center: [pos.coords.longitude, pos.coords.latitude], zoom: 16 }))

  const submit = async () => {
    if (!geometry) return
    const input: FieldInput = {
      name: name.trim() || 'My field',
      kind,
      geometry,
      // Huerta / viñedo: el perenne ocupa el terreno todo el año.
      current_rotation:
        kind === 'field' && orchard
          ? [
              { year: 1, season: 'spring_summer', crop_id: orchard },
              { year: 1, season: 'fall_winter', crop_id: orchard },
            ]
          : [
              { year: 1, season: 'spring_summer', crop_id: summer },
              { year: 1, season: 'fall_winter', crop_id: winter },
            ],
      irrigation: { available: irrigation || kind === 'greenhouse', source: 'well', max_mm_per_year: irrigation || kind === 'greenhouse' ? irrMm : 0 },
      livestock: livestock ? { species: 'bovino', head } : null,
      ...(kind === 'greenhouse' ? { greenhouse: { structure: 'multitunel', cover, rated_wind_kmh: rated, heated: false, co2_enrichment: false } } : {}),
    }
    try {
      const f = await create.mutateAsync(input)
      navigate(`/parcela/${f.id}`)
    } catch { /* The mutation error is displayed below. */ }
  }

  return (
    <div className="relative min-h-[calc(100dvh-4rem)] flex-1">
      {/* MapLibre fuerza position:relative en su contenedor: se envuelve en un div posicionado. */}
      <div className="absolute inset-0">
        <div ref={container} className="h-full w-full" />
      </div>

      {/* Fondo del mapa */}
      <div className="absolute top-4 right-4 z-10">
        <Segmented
          size="sm"
          value={basemap}
          onChange={setBasemap}
          className="shadow-lg ring-1 ring-line"
          options={[
            { value: 'satellite', label: 'Satellite' },
            { value: 'map', label: 'Map' },
          ]}
        />
      </div>

      {/* Panel */}
      <motion.aside
        initial={{ opacity: 0, x: -16 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ type: 'spring', stiffness: 260, damping: 28, delay: 0.1 }}
        className="absolute inset-x-3 bottom-3 z-10 max-h-[70dvh] overflow-y-auto rounded-[1.5rem] border border-line bg-surface/95 p-5 shadow-2xl max-sm:p-4 backdrop-blur-xl sm:top-4 sm:right-auto sm:bottom-auto sm:left-4 sm:max-h-[calc(100%-2rem)] sm:w-[400px]"
      >
        {!isDemoMode && <p className="mb-3 rounded-xl bg-surface-2 p-3 text-xs text-ink-2">Pilot coverage: Sureste, La Laguna, Norte and Centro-Desierto in Coahuila. Results describe a 9 km cell.</p>}
        <AnimatePresence mode="wait" initial={false}>
          {step === 'draw' ? (
            <motion.div key="draw" initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} className="space-y-5 max-sm:space-y-3">
              {/* En celular, al empezar a dibujar se ocultan textos y buscador para dejar libre el mapa. */}
              <div className={cn(compact && 'max-sm:hidden')}>
                <div className="text-xs font-medium text-muted">Step 1 of 2</div>
                <h1 className="mt-1 text-xl font-semibold tracking-tight text-ink">Outline your field</h1>
                <p className="mt-1 text-sm text-ink-2">Touch the map along the edge: put all the points you need so that the shape matches your terrain.</p>
              </div>
              <Segmented
                value={kind}
                onChange={setKind}
                className={cn('w-full [&>button]:flex-1', compact && 'max-sm:hidden')}
                options={(['field', 'greenhouse'] as const).map((k) => ({
                  value: k,
                  label: KIND[k].label,
                  icon: <span className="h-2.5 w-2.5 rounded-full" style={{ background: KIND[k].color }} />,
                }))}
              />
              <div className={cn('flex gap-2', compact && 'max-sm:hidden')}>
                <div className="flex-1">
                  <PlaceSearch onPick={flyTo} />
                </div>
                <Button variant="outline" size="icon" onClick={locate} aria-label="Use my location" title="Use my location">
                  <LocateFixed className="h-4 w-4" />
                </Button>
              </div>

              <div className="rounded-2xl bg-surface-2 p-4 max-sm:p-3">
                <div className="flex items-center gap-3">
                  <motion.div
                    key={points.length}
                    initial={{ scale: 0.7 }}
                    animate={{ scale: 1 }}
                    className={cn('grid h-11 w-11 place-items-center rounded-xl', canContinue ? 'bg-accent text-accent-ink' : crossing ? 'bg-bad/15 text-bad' : 'bg-surface text-ink-2')}
                  >
                    {canContinue ? <Check className="h-5 w-5" /> : crossing ? <TriangleAlert className="h-5 w-5" /> : <Crosshair className="h-5 w-5" />}
                  </motion.div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-ink">
                      {points.length === 0 ? 'Touch the first edge point' : points.length < 3 ? `${points.length} point${points.length > 1 ? 's' : ''} · minimum 3` : `${points.length} points`}
                    </div>
                    <div className="tabular text-sm text-ink-2">{crossing ? 'Lines intersect: move a point' : area > 0 ? `${num(area, area < 10 ? 2 : 1)} hectares` : 'You can drag the points to adjust'}</div>
                  </div>
                </div>
                {points.length >= 3 && (
                  <p className="mt-3 text-xs text-ink-2 max-sm:hidden">
                    Missing corners? Keep tapping the map, or tap a <b className="rounded bg-white px-1 text-[#14532d] shadow-sm">+</b> on one edge to add a point there. Tap the first point to close.
                  </p>
                )}
                {points.length >= 3 && (
                  <p className="mt-2 text-xs text-ink-2 sm:hidden">
                    Keep tapping for more corners, or tap a <b className="rounded bg-white px-1 text-[#14532d] shadow-sm">+</b>.
                  </p>
                )}
                <div className="mt-3 flex gap-2 max-sm:mt-2">
                  <Button variant="soft" size="sm" onClick={undo} disabled={history.length <= 1}>
                    <Undo2 className="h-4 w-4" /> Undo
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setPoints([])} disabled={!points.length}>
                    <Trash2 className="h-4 w-4" /> Delete
                  </Button>
                </div>
              </div>

              <Button variant="accent" size="lg" className="w-full justify-center" disabled={!canContinue} onClick={() => setStep('details')}>
                Continue
              </Button>
            </motion.div>
          ) : (
            <motion.div key="details" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 12 }} className="space-y-5">
              <div>
                <button onClick={() => setStep('draw')} className="inline-flex cursor-pointer items-center gap-1 text-xs font-medium text-muted hover:text-ink">
                  <ArrowLeft className="h-3.5 w-3.5" /> Step 2 of 2 · Edit drawing
                </button>
                <h1 className="mt-1 text-xl font-semibold tracking-tight text-ink">Tell us a little</h1>
                <p className="mt-1 text-sm text-ink-2">
                  {KIND[kind].label} of {num(area, area < 10 ? 2 : 1)} hectares. You can edit these details later.
                </p>
              </div>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-ink">Name</span>
                <input value={name} onChange={(e) => setName(e.target.value)} className="h-11 w-full rounded-xl border border-line-strong bg-surface px-3.5 text-sm text-ink outline-none focus:border-accent" />
              </label>

              {kind === 'field' && PERENNIALS.length > 0 && (
                <CropPicker label="Do you have an orchard, vineyard, or pecan grove?" options={ORCHARD} pool={PERENNIALS} value={orchard} onChange={setOrchard} noneLabel="No" />
              )}
              {kind === 'field' && orchard ? (
                <p className="rounded-xl bg-surface-2 p-3 text-sm text-ink-2">
                  Fruit trees occupy the land all year round. We will review chill hours, frost in flowering and water. Between rows you can plant a cover crop.
                </p>
              ) : (
                <>
                  <CropPicker label="What do you plant in spring-summer?" options={kind === 'greenhouse' ? ['tomate', 'pimiento', 'pepino', 'chile'] : SUMMER} pool={kind === 'greenhouse' ? GH : ANNUALS} value={summer} onChange={setSummer} />
                  <CropPicker label="And in autumn-winter?" options={kind === 'greenhouse' ? ['lechuga', 'fresa', 'espinaca'] : WINTER} pool={kind === 'greenhouse' ? GH : ANNUALS} value={winter} onChange={setWinter} />
                </>
              )}

              {kind === 'greenhouse' ? (
                <>
                  <div>
                    <span className="mb-2 block text-sm font-medium text-ink">Cover</span>
                    <Segmented
                      size="sm"
                      value={cover}
                      onChange={setCover}
                      options={[
                        { value: 'polietileno', label: 'Plastic' },
                        { value: 'policarbonato', label: 'Polycarbonate' },
                        { value: 'vidrio', label: 'Glass' },
                        { value: 'malla', label: 'Mesh' },
                      ]}
                    />
                  </div>
                  <div>
                    <Slider label="Structure wind rating" value={rated ?? 90} min={40} max={160} step={5} onChange={setRated} format={(v) => (rated == null ? 'I don\'t know' : `${v} km/h`)} />
                    <button onClick={() => setRated(rated == null ? 90 : null)} className="mt-2 cursor-pointer text-xs text-muted underline-offset-2 hover:text-ink hover:underline">
                      {rated == null ? 'Yes I know' : 'I don\'t know'}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-ink">Do you have irrigation?</span>
                      <Segmented size="sm" value={irrigation ? 'si' : 'no'} onChange={(v) => setIrrigation(v === 'si')} options={[{ value: 'si', label: 'Yes' }, { value: 'no', label: 'No, rainfed' }]} />
                    </div>
                    {irrigation && <Slider label="Irrigation water per year (approx.)" value={irrMm} min={100} max={1200} step={50} onChange={setIrrMm} format={(v) => `${v} mm`} hint="If you don't know, leave it at that." />}
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-ink">Do you have livestock?</span>
                      <Segmented size="sm" value={livestock ? 'si' : 'no'} onChange={(v) => setLivestock(v === 'si')} options={[{ value: 'si', label: 'Yes' }, { value: 'no', label: 'No' }]} />
                    </div>
                    {livestock && <Slider label="Head of cattle" value={head} min={1} max={300} onChange={setHead} />}
                  </div>
                </>
              )}

              <Button variant="accent" size="lg" className="w-full justify-center" onClick={submit} disabled={create.isPending || catalog.isLoading || catalog.isError}>
                {create.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Check className="h-5 w-5" />}
                Analyze my field
              </Button>
              {catalog.isError && <p className="text-sm text-bad">Could not load the crop catalog. Reload to try again.</p>}
              {create.error instanceof ApiError && create.error.code === 'out_of_region' && <p className="text-sm text-ink-2">Coverage: Sureste, La Laguna, Norte and Centro-Desierto in Coahuila. The centroid must fall in a published 9 km cell.</p>}
              {create.error && <p className="text-sm text-bad">{(create.error as Error).message}</p>}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.aside>
    </div>
  )
}
