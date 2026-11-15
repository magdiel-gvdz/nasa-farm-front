import { useState } from 'react'
import type { Field, FieldInput, Geometry, RotationStep, GreenhouseInfo } from '@/api/types'
import { useCrops, useUpdateField } from '@/hooks/api'
import { Button } from '@/components/ui/button'

const inputClass = 'mt-1 w-full rounded-xl border border-line-strong bg-surface p-2 text-sm text-ink'

export function FieldSettings({ field, onSaved }: { field: Field; onSaved: () => void }) {
  const catalog = useCrops()
  const save = useUpdateField(field.id)
  const [name, setName] = useState(field.name)
  const [rotation, setRotation] = useState<RotationStep[]>(field.current_rotation ?? [])
  const [irrigated, setIrrigated] = useState(field.irrigation?.available ?? false)
  const [water, setWater] = useState(String(field.irrigation?.max_mm_per_year ?? ''))
  const [source, setSource] = useState(field.irrigation?.source ?? 'well')
  const [livestock, setLivestock] = useState(!!field.livestock)
  const [species, setSpecies] = useState(field.livestock?.species ?? 'cattle')
  const [head, setHead] = useState(field.livestock?.head ?? 0)
  const [greenhouse, setGreenhouse] = useState<GreenhouseInfo | undefined>(field.greenhouse)
  const [geometry, setGeometry] = useState(JSON.stringify(field.geometry, null, 2))
  const [error, setError] = useState<string | null>(null)
  function slot(index: number, patch: Partial<RotationStep>) {
    setRotation((steps) => steps.map((s, i) => i === index ? { ...s, ...patch } : s))
  }
  return <form className="space-y-5 p-5" onSubmit={async (e) => {
    e.preventDefault()
    setError(null)
    try {
      const parsed = JSON.parse(geometry) as Geometry
      if (!['Polygon', 'MultiPolygon'].includes(parsed?.type) || !Array.isArray(parsed.coordinates)) throw new Error('Use a GeoJSON Polygon or MultiPolygon with [longitude, latitude] coordinates.')
      const patch: Partial<Omit<FieldInput, 'kind'>> = { name: name.trim(), current_rotation: rotation,
        irrigation: { available: irrigated, source, ...(water === '' ? {} : { max_mm_per_year: Number(water) }) },
        livestock: livestock ? { species, head } : null,
        ...(greenhouse ? { greenhouse } : {}),
        ...(JSON.stringify(parsed) === JSON.stringify(field.geometry) ? {} : { geometry: parsed }),
      }
      await save.mutateAsync(patch)
      onSaved()
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not save this field.') }
  }}>
    <label className="block text-sm">Name<input required maxLength={120} value={name} onChange={(e) => setName(e.target.value)} className={inputClass} /></label>
    <fieldset className="space-y-3"><legend className="font-semibold">Current rotation</legend>
      {rotation.map((s, i) => <div key={i} className="grid grid-cols-[60px_1fr_1fr_auto] items-end gap-2">
        <label className="text-xs">Year<input type="number" min={1} max={10} required value={s.year} onChange={(e) => slot(i, { year: Number(e.target.value) })} className={inputClass} /></label>
        <label className="text-xs">Season<select value={s.season} onChange={(e) => slot(i, { season: e.target.value as RotationStep['season'] })} className={inputClass}><option value="spring_summer">Spring–summer</option><option value="fall_winter">Fall–winter</option></select></label>
        <label className="text-xs">Crop<select value={s.crop_id ?? ''} onChange={(e) => slot(i, { crop_id: e.target.value || null })} className={inputClass}><option value="">Bare soil / rest</option>{s.crop_id && !catalog.data?.some((c) => c.id === s.crop_id) && <option value={s.crop_id}>{s.crop_id}</option>}{catalog.data?.map((c) => <option key={c.id} value={c.id}>{c.name.en}</option>)}</select></label>
        <Button type="button" variant="ghost" onClick={() => setRotation((steps) => steps.filter((_, j) => j !== i))} aria-label={`Remove rotation step ${i + 1}`}>×</Button>
      </div>)}
      <Button type="button" variant="outline" disabled={rotation.length >= 40 || catalog.isLoading || catalog.isError} onClick={() => setRotation((steps) => [...steps, { year: 1, season: 'spring_summer', crop_id: null }])}>Add season</Button>
    </fieldset>
    <fieldset className="space-y-3"><legend className="font-semibold">Irrigation</legend>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={irrigated} onChange={(e) => setIrrigated(e.target.checked)} />Irrigation available</label>
      <label className="block text-sm">Source<input maxLength={60} value={source} onChange={(e) => setSource(e.target.value)} className={inputClass} /></label>
      <label className="block text-sm">Maximum mm/year (optional)<input type="number" min={0} value={water} onChange={(e) => setWater(e.target.value)} className={inputClass} /></label>
    </fieldset>
    <fieldset className="space-y-3"><legend className="font-semibold">Livestock</legend>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={livestock} onChange={(e) => setLivestock(e.target.checked)} />Livestock on this field</label>
      {livestock && <div className="grid grid-cols-2 gap-3"><label className="text-sm">Species<input required maxLength={60} value={species} onChange={(e) => setSpecies(e.target.value)} className={inputClass} /></label><label className="text-sm">Head<input required type="number" min={0} step={1} value={head} onChange={(e) => setHead(Number(e.target.value))} className={inputClass} /></label></div>}
    </fieldset>
    {greenhouse && <fieldset className="space-y-3"><legend className="font-semibold">Greenhouse structure</legend>
      <label className="block text-sm">Structure<select value={greenhouse.structure} onChange={(e) => setGreenhouse({ ...greenhouse, structure: e.target.value as GreenhouseInfo['structure'] })} className={inputClass}>{['multitunel', 'capilla', 'macrotunel', 'casa_sombra', 'otro'].map((s) => <option key={s}>{s}</option>)}</select></label>
      <label className="block text-sm">Cover<select value={greenhouse.cover} onChange={(e) => setGreenhouse({ ...greenhouse, cover: e.target.value as GreenhouseInfo['cover'] })} className={inputClass}>{['polietileno', 'policarbonato', 'vidrio', 'malla'].map((s) => <option key={s}>{s}</option>)}</select></label>
      <label className="block text-sm">Wind rating km/h (leave empty if unknown)<input type="number" min={1} value={greenhouse.rated_wind_kmh ?? ''} onChange={(e) => setGreenhouse({ ...greenhouse, rated_wind_kmh: e.target.value === '' ? null : Number(e.target.value) })} className={inputClass} /></label>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={greenhouse.heated} onChange={(e) => setGreenhouse({ ...greenhouse, heated: e.target.checked })} />Heated</label>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={greenhouse.co2_enrichment} onChange={(e) => setGreenhouse({ ...greenhouse, co2_enrichment: e.target.checked })} />CO₂ enrichment</label>
    </fieldset>}
    <details><summary className="cursor-pointer text-sm font-semibold">Edit boundary as GeoJSON</summary><p className="mt-2 text-xs text-muted">Polygon or MultiPolygon in WGS84. Coordinates use [longitude, latitude]. The server validates coverage and recalculates area and analysis cell.</p><textarea aria-label="Field boundary GeoJSON" rows={10} value={geometry} onChange={(e) => setGeometry(e.target.value)} className={`${inputClass} font-mono text-xs`} /></details>
    {error && <p role="alert" className="text-sm text-bad">{error}</p>}
    <Button type="submit" disabled={save.isPending || !name.trim()}>{save.isPending ? 'Saving…' : 'Save field'}</Button>
  </form>
}
