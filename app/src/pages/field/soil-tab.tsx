import { AnimatePresence, motion } from 'motion/react'
import { FileText, FlaskConical, Info, Loader2, Pencil, Trash2, Upload } from 'lucide-react'
import { useRef, useState } from 'react'
import { isDemoMode } from '@/api/client'
import type { Field, FieldProfile, SoilLab, SoilReportExtraction } from '@/api/types'
import { Button } from '@/components/ui/button'
import { Card, CardHeader } from '@/components/ui/card'
import { StatusPill } from '@/components/ui/status'
import { useExtractSoilReport, useSaveSoilLab } from '@/hooks/api'
import { cn } from '@/lib/cn'
import { num } from '@/lib/format'
import { hasLabValues, interpret, LAB_PARAMS, type LabKey } from '@/lib/soil-lab'

const ACCEPT = 'application/pdf,image/jpeg,image/png,image/heic,image/webp'

export function SoilTab({ field, profile }: { field: Field; profile: FieldProfile }) {
  const lab = profile.soil.lab
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
                  title="Tu análisis de laboratorio"
                  subtitle={lab ? [lab.lab_name, lab.sample_date].filter(Boolean).join(' · ') || 'Guardado' : 'Lo más confiable para saber qué nutrientes tiene tu suelo.'}
                  icon={<FlaskConical className="h-4 w-4" />}
                  action={<StatusPill level={lab ? 'ok' : 'warn'} label={lab ? 'Confianza alta' : 'Sin análisis'} />}
                />
                {lab ? (
                  <div className="space-y-3">
                    {lab.file_name && (
                      <p className="flex items-center gap-2 text-sm text-ink-2">
                        <FileText className="h-4 w-4 text-muted" /> {lab.file_name}
                      </p>
                    )}
                    <p className="text-sm text-ink-2">Ya usamos estos valores para la aptitud de cultivos, las rotaciones y las respuestas del agrónomo.</p>
                    <div className="flex flex-wrap gap-2">
                      <Button variant="outline" size="sm" onClick={() => setDraft({ lab })}>
                        <Pencil className="h-4 w-4" /> Corregir valores
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={save.isPending}
                        onClick={() => confirm('¿Quitar el análisis? Volveremos a usar las estimaciones.') && save.mutate(null)}
                      >
                        <Trash2 className="h-4 w-4" /> Quitar
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
          <CardHeader title="Para qué sirve" icon={<Info className="h-4 w-4" />} />
          <ul className="space-y-2 text-sm text-ink-2">
            <li>• Ningún satélite mide nitrógeno, fósforo ni potasio: sin análisis solo podemos estimar materia orgánica, pH y textura con mapas de suelo de 250 m.</li>
            <li>• Con tu análisis, el pH y la salinidad reales cambian qué cultivos salen aptos, y la rotación toma en cuenta tus nutrientes.</li>
            <li>• Toma la muestra en zigzag (15–20 puntos, 0–30 cm), mézclala y manda ~1 kg al laboratorio. Repite cada 2–3 años.</li>
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
        <span className="font-medium text-ink">{busy ? 'Leyendo tu análisis…' : 'Sube el PDF o una foto de tu análisis'}</span>
        <span className="text-sm text-ink-2">{isDemoMode ? 'Arrástralo aquí o toca para elegir. PDF, JPG o PNG.' : 'La IA lee los valores y tú solo los revisas. PDF, JPG o PNG.'}</span>
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
        No tengo el archivo, prefiero escribir los valores
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
      <CardHeader title="Revisa los valores" subtitle={lab.file_name ?? 'Captura manual'} icon={<FlaskConical className="h-4 w-4" />} />
      {extraction?.note && <p className="mb-4 rounded-xl bg-warn/12 p-3 text-sm text-ink-2">{extraction.note}</p>}
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-xs text-muted">Laboratorio</span>
          <input value={lab.lab_name ?? ''} onChange={(e) => setLab({ ...lab, lab_name: e.target.value })} className="h-10 w-full rounded-xl border border-line-strong bg-surface px-3 text-sm text-ink outline-none focus:border-accent" />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs text-muted">Fecha de muestreo</span>
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
        <span className="mb-1 block text-xs text-muted">Textura (si viene en el análisis)</span>
        <input value={lab.texture ?? ''} placeholder="p. ej. franco-arcillosa" onChange={(e) => setLab({ ...lab, texture: e.target.value || null })} className="h-10 w-full rounded-xl border border-line-strong bg-surface px-3 text-sm text-ink outline-none focus:border-accent" />
      </label>
      <div className="mt-5 flex flex-wrap gap-2">
        <Button variant="accent" disabled={!valid || saving} onClick={() => onSave(lab)}>
          {saving && <Loader2 className="h-4 w-4 animate-spin" />} Guardar y recalcular
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
      </div>
      {!valid && <p className="mt-2 text-xs text-muted">Escribe al menos un valor.</p>}
    </Card>
  )
}

function Interpretation({ profile, lab }: { profile: FieldProfile; lab: SoilLab | null }) {
  const est = profile.soil.layers[0]
  const estimated: Partial<Record<LabKey, number | null>> = { om_pct: est?.om_pct, ph: est?.ph, cec_cmol_kg: est?.cec_cmol_kg }
  const estSource = profile.sources.some((s) => s.id === 'ssurgo') ? 'USDA SSURGO' : 'SoilGrids'
  const withLab = hasLabValues(lab)
  return (
    <Card>
      <CardHeader title="Cómo está tu suelo" subtitle={`${profile.soil.texture_class} · ${withLab ? 'según tu análisis' : `estimado con ${estSource}`}`} />
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
                    {v == null ? <span className="font-normal text-muted">Solo con análisis</span> : `${num(v, p.step < 1 ? 1 : 0)} ${p.unit}`}
                  </span>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  {band && <StatusPill level={band.level} label={band.label} />}
                  {v != null && <span className="text-xs text-muted">{fromLab != null ? 'Tu análisis' : `Estimado (${estSource})`}</span>}
                </div>
                {band && p.advice?.[band.level] && <p className="mt-1.5 text-xs text-ink-2">{p.advice[band.level]}</p>}
              </div>
            </li>
          )
        })}
      </ul>
      <p className="mt-4 text-xs text-muted">Rangos generales para 0–30 cm. Tu agrónomo los ajusta según el cultivo y el método del laboratorio.</p>
    </Card>
  )
}
