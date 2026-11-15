import * as maplibregl from 'maplibre-gl'
import { AnimatePresence, motion } from 'motion/react'
import { ArrowLeft, Check, Crosshair, Loader2, LocateFixed, Search, Trash2, TriangleAlert, Undo2 } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import type { Crop, FieldInput, FieldKind, GreenhouseInfo, Geometry } from '@/api/types'
import { CROP_BY_ID, CROPS, searchCrops } from '@/api/mock/engine/crops'
import { type Basemap, drawField, drawFieldCollection, useMap } from '@/components/map/use-map'
import { Button } from '@/components/ui/button'
import { Segmented } from '@/components/ui/segmented'
import { Slider } from '@/components/ui/slider'
import { useCreateField, useFields } from '@/hooks/api'
import { cn } from '@/lib/cn'
import { num } from '@/lib/format'
import { areaHa, type Place, searchPlaces, selfIntersects } from '@/lib/geo'
import { KIND } from '@/lib/kinds'

type Step = 'draw' | 'details'
type Pt = [number, number]

const SUMMER = ['maiz', 'frijol', 'sorgo', 'alfalfa', 'chile', 'melon', 'algodon']
const WINTER = ['avena', 'trigo', 'cebada', 'veza', 'garbanzo', 'ajo']
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
        placeholder="Busca tu pueblo, rancho o ciudad"
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
  noneLabel = 'Nada / descanso',
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
  const quick = value && !options.includes(value) ? [...options, value] : options
  const results = open ? searchCrops(q, pool).slice(0, 14) : []
  const chip = (id: string | null) => {
    const crop = id ? CROP_BY_ID.get(id) : null
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
            <span aria-hidden>{crop.emoji}</span> {crop.name.es}
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
          <Search className="h-3.5 w-3.5" /> {open ? 'Cerrar' : 'Otro…'}
        </button>
      </div>
      {open && (
        <div className="mt-2 rounded-2xl bg-surface-2 p-2">
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={`Busca entre ${pool.length} cultivos`}
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
                <span aria-hidden>{c.emoji}</span> {c.name.es}
              </button>
            ))}
            {!results.length && <span className="px-2 py-1 text-sm text-muted">Sin resultados</span>}
          </div>
        </div>
      )}
    </div>
  )
}

const ANNUALS = CROPS.filter((c) => !c.perennial)
const PERENNIALS = CROPS.filter((c) => c.perennial && c.category !== 'vegetable')
const GH = CROPS.filter((c) => c.greenhouse_ok)

export function NewFieldPage() {
  const navigate = useNavigate()
  const create = useCreateField()
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
  const [name, setName] = useState('Mi parcela')
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
        el.title = 'Cerrar figura'
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
            el.title = 'Agregar un vértice aquí (toca o arrastra)'
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
      name: name.trim() || 'Mi parcela',
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
      irrigation: { available: irrigation || kind === 'greenhouse', source: 'well', max_mm_per_year: irrigation ? irrMm : 0 },
      livestock: livestock ? { species: 'bovino', head } : null,
      ...(kind === 'greenhouse' ? { greenhouse: { structure: 'multitunel', cover, rated_wind_kmh: rated, heated: false, co2_enrichment: false } } : {}),
    }
    const f = await create.mutateAsync(input)
    navigate(`/parcela/${f.id}`)
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
            { value: 'satellite', label: 'Satélite' },
            { value: 'map', label: 'Mapa' },
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
        <AnimatePresence mode="wait" initial={false}>
          {step === 'draw' ? (
            <motion.div key="draw" initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} className="space-y-5 max-sm:space-y-3">
              {/* En celular, al empezar a dibujar se ocultan textos y buscador para dejar libre el mapa. */}
              <div className={cn(compact && 'max-sm:hidden')}>
                <div className="text-xs font-medium text-muted">Paso 1 de 2</div>
                <h1 className="mt-1 text-xl font-semibold tracking-tight text-ink">Marca tu terreno</h1>
                <p className="mt-1 text-sm text-ink-2">Toca el mapa siguiendo el borde: pon todos los puntos que necesites para que la forma quede igual a tu terreno.</p>
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
                <Button variant="outline" size="icon" onClick={locate} aria-label="Usar mi ubicación" title="Usar mi ubicación">
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
                      {points.length === 0 ? 'Toca el primer punto del borde' : points.length < 3 ? `${points.length} punto${points.length > 1 ? 's' : ''} · mínimo 3` : `${points.length} puntos`}
                    </div>
                    <div className="tabular text-sm text-ink-2">{crossing ? 'Las líneas se cruzan: mueve un punto' : area > 0 ? `${num(area, area < 10 ? 2 : 1)} hectáreas` : 'Puedes arrastrar los puntos para ajustar'}</div>
                  </div>
                </div>
                {points.length >= 3 && (
                  <p className="mt-3 text-xs text-ink-2 max-sm:hidden">
                    ¿Le faltan esquinas? Sigue tocando el mapa, o toca un <b className="rounded bg-white px-1 text-[#14532d] shadow-sm">+</b> en una orilla para agregar un punto ahí. Toca el primer punto para cerrar.
                  </p>
                )}
                {points.length >= 3 && (
                  <p className="mt-2 text-xs text-ink-2 sm:hidden">
                    Sigue tocando para más esquinas, o toca un <b className="rounded bg-white px-1 text-[#14532d] shadow-sm">+</b>.
                  </p>
                )}
                <div className="mt-3 flex gap-2 max-sm:mt-2">
                  <Button variant="soft" size="sm" onClick={undo} disabled={history.length <= 1}>
                    <Undo2 className="h-4 w-4" /> Deshacer
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setPoints([])} disabled={!points.length}>
                    <Trash2 className="h-4 w-4" /> Borrar
                  </Button>
                </div>
              </div>

              <Button variant="accent" size="lg" className="w-full justify-center" disabled={!canContinue} onClick={() => setStep('details')}>
                Continuar
              </Button>
            </motion.div>
          ) : (
            <motion.div key="details" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 12 }} className="space-y-5">
              <div>
                <button onClick={() => setStep('draw')} className="inline-flex cursor-pointer items-center gap-1 text-xs font-medium text-muted hover:text-ink">
                  <ArrowLeft className="h-3.5 w-3.5" /> Paso 2 de 2 · Editar dibujo
                </button>
                <h1 className="mt-1 text-xl font-semibold tracking-tight text-ink">Cuéntanos un poco</h1>
                <p className="mt-1 text-sm text-ink-2">
                  {KIND[kind].label} de {num(area, area < 10 ? 2 : 1)} hectáreas. Todo es opcional; puedes cambiarlo después.
                </p>
              </div>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-ink">Nombre</span>
                <input value={name} onChange={(e) => setName(e.target.value)} className="h-11 w-full rounded-xl border border-line-strong bg-surface px-3.5 text-sm text-ink outline-none focus:border-accent" />
              </label>

              {kind === 'field' && (
                <CropPicker label="¿Tienes huerta, viñedo o nogalera?" options={ORCHARD} pool={PERENNIALS} value={orchard} onChange={setOrchard} noneLabel="No" />
              )}
              {kind === 'field' && orchard ? (
                <p className="rounded-xl bg-surface-2 p-3 text-sm text-ink-2">
                  Los frutales ocupan el terreno todo el año. Revisaremos horas frío, heladas en floración y agua. Entre hileras puedes sembrar una cobertura.
                </p>
              ) : (
                <>
                  <CropPicker label="¿Qué siembras en primavera–verano?" options={kind === 'greenhouse' ? ['tomate', 'pimiento', 'pepino', 'chile'] : SUMMER} pool={kind === 'greenhouse' ? GH : ANNUALS} value={summer} onChange={setSummer} />
                  <CropPicker label="¿Y en otoño–invierno?" options={kind === 'greenhouse' ? ['lechuga', 'fresa', 'espinaca'] : WINTER} pool={kind === 'greenhouse' ? GH : ANNUALS} value={winter} onChange={setWinter} />
                </>
              )}

              {kind === 'greenhouse' ? (
                <>
                  <div>
                    <span className="mb-2 block text-sm font-medium text-ink">Cubierta</span>
                    <Segmented
                      size="sm"
                      value={cover}
                      onChange={setCover}
                      options={[
                        { value: 'polietileno', label: 'Plástico' },
                        { value: 'policarbonato', label: 'Policarbonato' },
                        { value: 'vidrio', label: 'Vidrio' },
                        { value: 'malla', label: 'Malla' },
                      ]}
                    />
                  </div>
                  <div>
                    <Slider label="Viento que resiste la estructura" value={rated ?? 90} min={40} max={160} step={5} onChange={setRated} format={(v) => (rated == null ? 'No sé' : `${v} km/h`)} />
                    <button onClick={() => setRated(rated == null ? 90 : null)} className="mt-2 cursor-pointer text-xs text-muted underline-offset-2 hover:text-ink hover:underline">
                      {rated == null ? 'Sí lo sé' : 'No lo sé'}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-ink">¿Tienes riego?</span>
                      <Segmented size="sm" value={irrigation ? 'si' : 'no'} onChange={(v) => setIrrigation(v === 'si')} options={[{ value: 'si', label: 'Sí' }, { value: 'no', label: 'No, de temporal' }]} />
                    </div>
                    {irrigation && <Slider label="Agua de riego al año (aprox.)" value={irrMm} min={100} max={1200} step={50} onChange={setIrrMm} format={(v) => `${v} mm`} hint="Si no sabes, déjalo así." />}
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-ink">¿Tienes ganado?</span>
                      <Segmented size="sm" value={livestock ? 'si' : 'no'} onChange={(v) => setLivestock(v === 'si')} options={[{ value: 'si', label: 'Sí' }, { value: 'no', label: 'No' }]} />
                    </div>
                    {livestock && <Slider label="Cabezas de ganado" value={head} min={1} max={300} onChange={setHead} />}
                  </div>
                </>
              )}

              <Button variant="accent" size="lg" className="w-full justify-center" onClick={submit} disabled={create.isPending}>
                {create.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Check className="h-5 w-5" />}
                Analizar mi parcela
              </Button>
              {create.error && <p className="text-sm text-bad">{(create.error as Error).message}</p>}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.aside>
    </div>
  )
}
