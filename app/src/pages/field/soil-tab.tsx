import { AnimatePresence, motion } from 'motion/react'
import { FileText, FlaskConical, Info, Loader2, Pencil, Trash2, Upload } from 'lucide-react'
import { useRef, useState } from 'react'
import { capabilities, isDemoMode } from '@/api/client'
import type { Field, FieldProfile, SoilLab, SoilReportExtraction } from '@/api/types'
import { Button } from '@/components/ui/button'
import { Card, CardHeader } from '@/components/ui/card'
import { StatusPill } from '@/components/ui/status'
import { useExtractSoilReport, useSaveSoilLab } from '@/hooks/api'
import { cn } from '@/lib/cn'
import { num } from '@/lib/format'
import { hasLabValues, interpret, LAB_PARAMS, type LabKey } from '@/lib/soil-lab'

const ACCEPT = 'application/pdf,image/jpeg,image/png,image/heic,image/webp'

export function SoilTab(props: { field: Field; profile: FieldProfile }) {
  return capabilities.manualSoilLab ? <DemoSoilTab {...props} /> : <LiveSoilTab {...props} />
}

function DemoSoilTab({ field, profile }: { field: Field; profile: FieldProfile }) {
  const lab = profile.soil?.lab ?? null
  const [draft, setDraft] = useState<{ lab: SoilLab; extraction?: SoilReportExtraction } | null>(null)
  const extract = useExtractSoilReport(field.id)
  const save = useSaveSoilLab(field.id)

  const onFile = async (file: File) => {
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
                  subtitle={lab ? [lab.lab_name, lab.sample_date].filter(Boolean).join(' · ') || 'Guardado' : 'The most reliable way to know what nutrients your soil has.'}
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
                    <div className="flex flex-wrap gap-2">
                      <Button variant="outline" size="sm" onClick={() => setDraft({ lab })}>
                        <Pencil className="h-4 w-4" /> Correct values
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={save.isPending}
                        onClick={() => confirm('Remove analysis? We will use estimates again.') && save.mutate(null)}
                      >
                        <Trash2 className="h-4 w-4" /> Remove
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Dropzone busy={extract.isPending} error={extract.error as Error | null} onFile={onFile} onManual={() => setDraft({ lab: { depth_cm: [0, 30] } })} />
                )}
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

      <Interpretation profile={profile} lab={lab} />
    </div>
  )
}

function Dropzone({ busy, error, onFile, onManual }: { busy: boolean; error: Error | null; onFile: (f: File) => void; onManual: () => void }) {
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
        <span className="text-sm text-ink-2">{isDemoMode ? 'Drag it here or tap to choose. PDF, JPG or PNG.' : 'The AI ​​reads the values ​​and you only review them. PDF, JPG or PNG.'}</span>
      </button>
      <input
        ref={input}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) onFile(f)
          e.target.value = ''
        }}
      />
      {error && <p className="text-sm text-bad">{error.message}</p>}
      <button onClick={onManual} className="cursor-pointer text-sm text-muted underline-offset-2 hover:text-ink hover:underline">
        I don't have the file, I prefer to write the values
      </button>
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

function Interpretation({ profile, lab }: { profile: FieldProfile; lab: SoilLab | null }) {
  const est = profile.soil?.layers[0]
  const estimated: Partial<Record<LabKey, number | null>> = { om_pct: est?.om_pct, ph: est?.ph, cec_cmol_kg: est?.cec_cmol_kg }
  const estSource = profile.sources.some((s) => s.id === 'ssurgo') ? 'USDA SSURGO' : 'SoilGrids'
  const withLab = hasLabValues(lab)
  return (
    <Card>
      <CardHeader title="How is your soil?" subtitle={`${profile.soil?.texture_class ?? 'Texture unavailable'} · ${withLab ? 'according to your analysis' : `estimated with ${estSource}`}`} />
      <ul className="divide-y divide-line">
        {LAB_PARAMS.map((p) => {
          const fromLab = lab?.[p.key]
          const v = fromLab ?? estimated[p.key] ?? null
          const band = interpret(p, v)
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
                </div>
                {band && p.advice?.[band.level] && <p className="mt-1.5 text-xs text-ink-2">{p.advice[band.level]}</p>}
              </div>
            </li>
          )
        })}
      </ul>
      <p className="mt-4 text-xs text-muted">General ranges for 0–30 cm. Your agronomist adjusts them according to the crop and the laboratory method.</p>
    </Card>
  )
}

function LiveSoilTab({ field, profile }: { field: Field; profile: FieldProfile }) {
  const upload = useExtractSoilReport(field.id)
  const input = useRef<HTMLInputElement>(null)
  const lab = profile.soil?.lab ?? null
  return <div className="grid gap-4 lg:grid-cols-2">
    <div className="space-y-4">
      <Card>
        <CardHeader title="Laboratory soil report" subtitle={lab ? [lab.lab_name, lab.sample_date, lab.depth_label].filter(Boolean).join(' / ') : 'Upload your soil report to improve the zonal assessment.'} />
        <p className="mb-4 text-sm text-ink-2">PDF, JPG or PNG, up to 10 MB. Accepted values are saved immediately. The crop assessment uses laboratory pH when available.</p>
        <p className="mb-4 text-xs text-muted">Remove names, addresses and tax identifiers before uploading.</p>
        <input ref={input} type="file" accept="application/pdf,image/jpeg,image/png" className="hidden" aria-label="Soil report file" onChange={async (e) => {
          const file = e.target.files?.[0]
          if (!file) return
          try { await upload.mutateAsync(file) } catch { /* Mutation error shown below. */ }
          e.target.value = ''
        }} />
        <Button disabled={upload.isPending} onClick={() => input.current?.click()}><Upload className="h-4 w-4" />{upload.isPending ? 'Reading report...' : lab ? 'Upload replacement report' : 'Upload soil report'}</Button>
        {upload.isError && <p role="alert" className="mt-3 text-sm text-bad">{upload.error.message}</p>}
        {upload.data && <div role="status" className="mt-4 text-sm">
          <p>{upload.data.applied ? 'Accepted values were saved and the assessment was updated.' : 'No usable values were found. The previous analysis was kept.'}</p>
          {!!upload.data.unreadable_reasons?.length && <details className="mt-3"><summary className="cursor-pointer">Values not read or outside the accepted range</summary><ul className="mt-2 space-y-1 text-xs text-muted">{upload.data.unreadable_reasons.map((v) => <li key={v.field}>{v.field}: {v.reason}</li>)}</ul></details>}
        </div>}
      </Card>
      <Card><CardHeader title="Model uncertainty" /><p className="text-sm text-ink-2">SoilGrids describes the analysis zone. Its uncertainty range belongs to the model; it does not measure variation within your field.</p></Card>
    </div>
    <div className="space-y-4"><Interpretation profile={profile} lab={lab} />
      {profile.soil?.layers.map((layer, i) => <Card key={i}><CardHeader title={`Soil depth ${layer.depth_cm.join('-')} cm`} subtitle="SoilGrids model uncertainty (P05-P95)" />
        <dl className="space-y-2 text-xs">{Object.entries(layer.uncertainty ?? {}).map(([name, range]) => <div key={name} className="flex justify-between gap-2"><dt>{name}</dt><dd>{num(range.p05, 2)} - {num(range.p95, 2)}</dd></div>)}</dl>
      </Card>)}
    </div>
  </div>
}
