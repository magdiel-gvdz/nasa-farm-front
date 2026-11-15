import { AnimatePresence, motion } from 'motion/react'
import { FileText, FlaskConical, Info, Loader2, Mountain, Pencil, Trash2, Upload } from 'lucide-react'
import { useRef, useState } from 'react'
import { capabilities } from '@/api/client'
import type { Field, FieldProfile, SoilLab, SoilProfile, SoilReportExtraction } from '@/api/types'
import { Button } from '@/components/ui/button'
import { Card, CardHeader } from '@/components/ui/card'
import { StatusPill } from '@/components/ui/status'
import { useExtractSoilReport, useSaveSoilLab } from '@/hooks/api'
import { cn } from '@/lib/cn'
import { num } from '@/lib/format'
import { hasLabValues, interpret, LAB_PARAMS, type LabKey } from '@/lib/soil-lab'

// Con el servidor el informe se lee y se guarda en un solo paso; en demostración se revisa antes de guardar.
const AUTO_SAVE = capabilities.soilReportAutoSaves
const ACCEPT = AUTO_SAVE ? 'application/pdf,image/jpeg,image/png' : 'application/pdf,image/jpeg,image/png,image/heic,image/webp'

export function SoilTab({ field, profile }: { field: Field; profile: FieldProfile }) {
  const lab = profile.soil?.lab ?? null
  const [draft, setDraft] = useState<{ lab: SoilLab; extraction?: SoilReportExtraction } | null>(null)
  const extract = useExtractSoilReport(field.id)
  const save = useSaveSoilLab(field.id)
  const replace = useRef<HTMLInputElement>(null)

  const onFile = async (file: File) => {
    if (AUTO_SAVE) {
      await extract.mutateAsync(file).catch(() => {
        /* The mutation error is shown below. */
      })
      return
    }
    const res = await extract.mutateAsync(file)
    setDraft({ lab: { ...res.extracted, file_name: file.name }, extraction: res })
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
      <div className="space-y-4">
        <AnimatePresence mode="wait" initial={false}>
          {draft ? (
            <motion.div key="form" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}>
              <LabForm
                initial={draft.lab}
                extraction={draft.extraction}
                saving={save.isPending}
                onCancel={() => setDraft(null)}
                onSave={async (l) => {
                  await save.mutateAsync(l)
                  setDraft(null)
                }}
              />
            </motion.div>
          ) : (
            <motion.div key="status" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}>
              <Card>
                <CardHeader
                  title="Your laboratory analysis"
                  subtitle={lab ? [lab.lab_name, lab.sample_date, lab.depth_label].filter(Boolean).join(' · ') || 'Saved' : 'The most reliable way to know what nutrients your soil has.'}
                  icon={<FlaskConical className="h-4 w-4" />}
                  action={<StatusPill level={lab ? 'ok' : 'warn'} label={lab ? 'High Confidence' : 'No analysis'} />}
                />
                {lab ? (
                  <div className="space-y-3">
                    {lab.file_name && (
                      <p className="flex items-center gap-2 text-sm text-ink-2">
                        <FileText className="h-4 w-4 text-muted" /> {lab.file_name}
                      </p>
                    )}
                    <p className="text-sm text-ink-2">We already use these values for crop suitability, rotations, and agronomist responses.</p>
                    {AUTO_SAVE ? (
                      <>
                        <input
                          ref={replace}
                          type="file"
                          accept={ACCEPT}
                          className="hidden"
                          aria-label="Soil report file"
                          onChange={(e) => {
                            const f = e.target.files?.[0]
                            if (f) void onFile(f)
                            e.target.value = ''
                          }}
                        />
                        <Button variant="outline" size="sm" disabled={extract.isPending} onClick={() => replace.current?.click()}>
                          {extract.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} {extract.isPending ? 'Reading your analysis…' : 'Upload a newer analysis'}
                        </Button>
                        {extract.error && <p className="text-sm text-bad">{(extract.error as Error).message}</p>}
                      </>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        <Button variant="outline" size="sm" onClick={() => setDraft({ lab })}>
                          <Pencil className="h-4 w-4" /> Correct values
                        </Button>
                        <Button variant="ghost" size="sm" disabled={save.isPending} onClick={() => confirm('Remove analysis? We will use estimates again.') && save.mutate(null)}>
                          <Trash2 className="h-4 w-4" /> Remove
                        </Button>
                      </div>
                    )}
                  </div>
                ) : (
                  <Dropzone busy={extract.isPending} error={extract.error as Error | null} onFile={onFile} onManual={AUTO_SAVE ? undefined : () => setDraft({ lab: { depth_cm: [0, 30] } })} />
                )}
                {AUTO_SAVE && extract.data && <UploadResult result={extract.data} />}
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        <Card>
          <CardHeader title="What is it for?" icon={<Info className="h-4 w-4" />} />
          <ul className="space-y-2 text-sm text-ink-2">
            <li>• No satellite measures nitrogen, phosphorus or potassium: without analysis we can only estimate organic matter, pH and texture with 250 m soil maps.</li>
            <li>• With your analysis, the actual pH and salinity change which crops are suitable, and the rotation takes your nutrients into account.</li>
            <li>• Take the sample in a zigzag pattern (15–20 points, 0–30 cm), mix it and send ~1 kg to the laboratory. Repeat every 2–3 years.</li>
          </ul>
        </Card>
      </div>

      <div className="space-y-4">
        <Interpretation profile={profile} lab={lab} />
        <TerrainCard profile={profile} />
      </div>
    </div>
  )
}

function UploadResult({ result }: { result: SoilReportExtraction }) {
  return (
    <div role="status" className={cn('mt-4 rounded-xl p-3 text-sm text-ink-2', result.applied ? 'bg-good/12' : 'bg-warn/12')}>
      <p>{result.applied ? 'We saved the values we could read and updated your field.' : 'We could not find usable values. Your previous data was kept.'}</p>
      {!!result.unreadable_reasons?.length && (
        <details className="mt-2">
          <summary className="cursor-pointer text-xs font-medium text-ink">Values not read or out of range ({result.unreadable_reasons.length})</summary>
          <ul className="mt-2 space-y-1 text-xs text-muted">
            {result.unreadable_reasons.map((v) => (
              <li key={v.field}>
                · {v.field}: {v.reason}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  )
}

function Dropzone({ busy, error, onFile, onManual }: { busy: boolean; error: Error | null; onFile: (f: File) => void; onManual?: () => void }) {
  const input = useRef<HTMLInputElement>(null)
  const [over, setOver] = useState(false)
  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={() => input.current?.click()}
        onDragOver={(e) => {
          e.preventDefault()
          setOver(true)
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setOver(false)
          const f = e.dataTransfer.files[0]
          if (f) onFile(f)
        }}
        disabled={busy}
        className={cn(
          'flex w-full cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 border-dashed px-4 py-8 text-center transition-colors',
          over ? 'border-accent bg-accent-soft' : 'border-line-strong hover:border-accent hover:bg-surface-2',
        )}
      >
        {busy ? <Loader2 className="h-7 w-7 animate-spin text-accent" /> : <Upload className="h-7 w-7 text-accent" />}
        <span className="font-medium text-ink">{busy ? 'Reading your analysis…' : 'Upload the PDF or a photo of your analysis'}</span>
        <span className="text-sm text-ink-2">{AUTO_SAVE ? 'The AI reads the values and saves them for your field. PDF, JPG or PNG, up to 10 MB.' : 'Drag it here or tap to choose. PDF, JPG or PNG.'}</span>
      </button>
      <input
        ref={input}
        type="file"
        accept={ACCEPT}
        className="hidden"
        aria-label="Soil report file"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) onFile(f)
          e.target.value = ''
        }}
      />
      {error && <p className="text-sm text-bad">{error.message}</p>}
      {AUTO_SAVE && <p className="text-xs text-muted">Remove names, addresses and tax identifiers before uploading.</p>}
      {onManual && (
        <button onClick={onManual} className="cursor-pointer text-sm text-muted underline-offset-2 hover:text-ink hover:underline">
          I don't have the file, I prefer to write the values
        </button>
      )}
    </div>
  )
}

function LabForm({ initial, extraction, saving, onSave, onCancel }: { initial: SoilLab; extraction?: SoilReportExtraction; saving: boolean; onSave: (l: SoilLab) => void; onCancel: () => void }) {
  const [lab, setLab] = useState<SoilLab>(initial)
  const unreadable = new Set(extraction?.unreadable_fields ?? [])
  const set = (k: LabKey, v: string) => setLab((l) => ({ ...l, [k]: v === '' ? null : Number(v) }))
  const valid = LAB_PARAMS.some((p) => lab[p.key] != null)

  return (
    <Card>
      <CardHeader title="Check the values" subtitle={lab.file_name ?? 'Captura manual'} icon={<FlaskConical className="h-4 w-4" />} />
      {extraction?.note && <p className="mb-4 rounded-xl bg-warn/12 p-3 text-sm text-ink-2">{extraction.note}</p>}
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-xs text-muted">Laboratory</span>
          <input value={lab.lab_name ?? ''} onChange={(e) => setLab({ ...lab, lab_name: e.target.value })} className="h-10 w-full rounded-xl border border-line-strong bg-surface px-3 text-sm text-ink outline-none focus:border-accent" />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs text-muted">Sampling date</span>
          <input type="date" value={lab.sample_date ?? ''} onChange={(e) => setLab({ ...lab, sample_date: e.target.value })} className="h-10 w-full rounded-xl border border-line-strong bg-surface px-3 text-sm text-ink outline-none focus:border-accent" />
        </label>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {LAB_PARAMS.map((p) => {
          const v = lab[p.key]
          const band = interpret(p, v)
          const flag = unreadable.has(p.key) && v == null
          return (
            <label key={p.key} className="block">
              <span className="mb-1 flex items-center justify-between gap-1 text-xs text-muted">
                <span className="truncate" title={p.hint}>
                  {p.name}
                </span>
                {band && <span className={cn('shrink-0 font-medium', band.level === 'ok' ? 'text-good-ink' : band.level === 'warn' ? 'text-ink' : 'text-bad')}>{band.label}</span>}
              </span>
              <div className={cn('flex h-10 items-center rounded-xl border bg-surface pr-3 focus-within:border-accent', flag ? 'border-warn' : 'border-line-strong')}>
                <input
                  type="number"
                  inputMode="decimal"
                  step={p.step}
                  min={0}
                  value={v ?? ''}
                  placeholder="—"
                  onChange={(e) => set(p.key, e.target.value)}
                  className="tabular h-full w-full min-w-0 rounded-xl bg-transparent px-3 text-sm text-ink outline-none"
                />
                <span className="shrink-0 text-xs text-muted">{p.unit}</span>
              </div>
            </label>
          )
        })}
      </div>
      <label className="mt-3 block">
        <span className="mb-1 block text-xs text-muted">Texture (if included in the analysis)</span>
        <input value={lab.texture ?? ''} placeholder="p. e.g. clay loam" onChange={(e) => setLab({ ...lab, texture: e.target.value || null })} className="h-10 w-full rounded-xl border border-line-strong bg-surface px-3 text-sm text-ink outline-none focus:border-accent" />
      </label>
      <div className="mt-5 flex flex-wrap gap-2">
        <Button variant="accent" disabled={!valid || saving} onClick={() => onSave(lab)}>
          {saving && <Loader2 className="h-4 w-4 animate-spin" />} Save and recalculate
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
      {!valid && <p className="mt-2 text-xs text-muted">Enter at least one value.</p>}
    </Card>
  )
}

type Range = [number | null, number | null]

/** Intervalo probable de cada valor estimado: `ranges` del servidor, o la incertidumbre P05–P95 de SoilGrids. */
function soilRanges(soil: SoilProfile | null): Partial<Record<LabKey, Range>> {
  if (!soil) return {}
  if (soil.ranges) return soil.ranges as Partial<Record<LabKey, Range>>
  const u = soil.layers[0]?.uncertainty ?? {}
  const r = (k: string, f = 1): Range | undefined => (u[k] ? [u[k].p05 * f, u[k].p95 * f] : undefined)
  // Materia orgánica ≈ carbono orgánico × 1.724 (g/kg → %).
  const out: Partial<Record<LabKey, Range>> = { ph: r('ph'), cec_cmol_kg: r('cec_cmol_kg'), om_pct: r('soc_g_kg', 0.1724) }
  return Object.fromEntries(Object.entries(out).filter(([, v]) => v)) as Partial<Record<LabKey, Range>>
}

function Interpretation({ profile, lab }: { profile: FieldProfile; lab: SoilLab | null }) {
  const est = profile.soil?.layers[0]
  const estimated: Partial<Record<LabKey, number | null>> = { om_pct: est?.om_pct, ph: est?.ph, cec_cmol_kg: est?.cec_cmol_kg, ec_ds_m: est?.ec_ds_m ?? null }
  const ranges = soilRanges(profile.soil)
  const estSource = profile.soil?.source_id === 'ssurgo' || profile.sources.some((s) => s.id === 'ssurgo') ? 'USDA SSURGO' : 'SoilGrids'
  const withLab = hasLabValues(lab)
  return (
    <Card>
      <CardHeader title="How is your soil?" subtitle={`${profile.soil?.texture_class ?? 'Texture unavailable'} · ${withLab ? 'according to your analysis' : `estimated with ${estSource}`}`} />
      <ul className="divide-y divide-line">
        {LAB_PARAMS.map((p) => {
          const fromLab = lab?.[p.key]
          const v = fromLab ?? estimated[p.key] ?? null
          const band = interpret(p, v)
          const r = ranges[p.key]
          return (
            <li key={p.key} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-sm font-medium text-ink">{p.name}</span>
                  <span className="tabular text-sm font-semibold text-ink">
                    {v == null ? <span className="font-normal text-muted">Analysis only</span> : `${num(v, p.step < 1 ? 1 : 0)} ${p.unit}`}
                  </span>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  {band && <StatusPill level={band.level} label={band.label} />}
                  {v != null && <span className="text-xs text-muted">{fromLab != null ? 'Your analysis' : `Estimated (${estSource})`}</span>}
                  {fromLab == null && v != null && r && r[0] != null && r[1] != null && (
                    <span className="tabular text-xs text-muted">
                      · likely {num(r[0], p.step < 1 ? 1 : 0)}–{num(r[1], p.step < 1 ? 1 : 0)}
                    </span>
                  )}
                </div>
                {band && p.advice?.[band.level] && <p className="mt-1.5 text-xs text-ink-2">{p.advice[band.level]}</p>}
              </div>
            </li>
          )
        })}
      </ul>
      <p className="mt-4 text-xs text-muted">
        General ranges for 0–30 cm. Your agronomist adjusts them according to the crop and the laboratory method.
        {!withLab &&
          (estSource === 'SoilGrids'
            ? ' "Likely" = 90 % interval of the SoilGrids model: it is wide because it is a 250 m prediction, not a sample of your land.'
            : ` "Likely" = low–high range of the USDA soil survey${profile.soil?.map_unit ? ` (${profile.soil.map_unit})` : ''}.`)}
      </p>
    </Card>
  )
}

const DEM_LABEL: Record<string, string> = {
  copernicus_dem: 'Copernicus elevation model, 90 m (error ±4 m).',
  copernicus_dem_glo90: 'Copernicus elevation model, 90 m (error ±4 m).',
  srtm: 'NASA SRTM elevation model, 30 m.',
}

function TerrainCard({ profile }: { profile: FieldProfile }) {
  const t = profile.terrain
  if (!t || t.source_id === 'none') return null
  const rel = t.relative_to_surroundings_m
  const items = [
    ['Elevation', `${num(t.elevation_m.mean)} m`, t.elevation_m.min != null && t.elevation_m.max != null ? `from ${num(t.elevation_m.min)} to ${num(t.elevation_m.max)} m` : 'average of the zone'],
    t.slope_pct && ['Slope', `${num(t.slope_pct.mean, 1)} %`, `steepest ~${num(t.slope_pct.p90, 1)} %`],
    t.aspect_dominant && ['Aspect', t.aspect_dominant, 'where the slope faces'],
    rel != null && ['Compared to surroundings', `${rel > 0 ? '+' : ''}${rel} m`, rel < -10 ? 'Lower: cold air pools here' : 'within 1 km'],
  ].filter(Boolean) as [string, string, string][]
  return (
    <Card>
      <CardHeader title="Your terrain" subtitle={DEM_LABEL[t.source_id] ?? profile.sources.find((s) => s.id === t.source_id)?.dataset ?? t.source_id} icon={<Mountain className="h-4 w-4" />} />
      <dl className="grid grid-cols-2 gap-3">
        {items.map(([k, v, sub]) => (
          <div key={k} className="rounded-xl bg-surface-2 p-3">
            <dt className="text-xs text-muted">{k}</dt>
            <dd className={cn('tabular mt-0.5 font-semibold text-ink', k === 'Aspect' && 'capitalize')}>{v}</dd>
            <dd className="text-[11px] text-muted">{sub}</dd>
          </div>
        ))}
      </dl>
      {(t.cold_air_pooling_share ?? 0) >= 0.3 && <p className="mt-3 text-sm text-ink-2">{Math.round((t.cold_air_pooling_share ?? 0) * 100)} % of your land is in a low spot: it may freeze more than the stations show.</p>}
    </Card>
  )
}
