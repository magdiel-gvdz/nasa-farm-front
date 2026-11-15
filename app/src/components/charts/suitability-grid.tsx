import { motion } from 'motion/react'
import { Check, Minus } from 'lucide-react'
import type { Crop, SuitabilityMatrix } from '@/api/types'
import { suitLabel } from '@/lib/status'
import { MONTHS, MONTHS_INITIAL } from '@/lib/format'

export function SuitabilityGrid({ matrix, crops, onPick }: { matrix: SuitabilityMatrix; crops: Crop[]; onPick: (cropId: string, month: number) => void }) {
  const byId = new Map(crops.map((c) => [c.id, c]))
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[520px] border-separate border-spacing-[3px]">
        <thead>
          <tr>
            <th className="w-[170px]" />
            {MONTHS_INITIAL.map((m, i) => (
              <th key={i} className="pb-1 text-center text-[11px] font-medium text-muted" title={MONTHS[i]}>
                <span className="hidden sm:inline">{MONTHS[i].slice(0, 3)}</span>
                <span className="sm:hidden">{m}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {matrix.crops.map((row, ri) => {
            const crop = byId.get(row.crop_id)
            if (!crop) return null
            return (
              <tr key={row.crop_id}>
                <td className="pr-2 text-sm whitespace-nowrap text-ink">
                  <span className="mr-1.5" aria-hidden>
                    {crop.emoji}
                  </span>
                  {crop.name.en}
                </td>
                {row.scores.map((s, mi) => {
                  const st = row.status[mi]
                  const bg =
                    st === 'suitable'
                      ? `color-mix(in srgb, var(--good) ${Math.round(45 + (s - 70) * 1.6)}%, transparent)`
                      : st === 'marginal'
                        ? `color-mix(in srgb, var(--warn) ${Math.round(25 + (s - 40) * 1.2)}%, transparent)`
                        : 'var(--surface-2)'
                  return (
                    <td key={mi} className="p-0">
                      <motion.button
                        initial={{ opacity: 0, scale: 0.6 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: Math.min(ri, 12) * 0.025 + mi * 0.012, type: 'spring', stiffness: 380, damping: 26 }}
                        whileHover={{ scale: 1.12 }}
                        onClick={() => onPick(row.crop_id, mi + 1)}
                        aria-label={`${crop.name.en} planted in ${MONTHS[mi]}: ${suitLabel(st)} (${s}/100)`}
                        className="grid h-8 w-full min-w-7 cursor-pointer place-items-center rounded-[6px] text-ink transition-shadow hover:shadow-md"
                        style={{ background: bg }}
                      >
                        {st === 'suitable' ? <Check className="h-3.5 w-3.5 opacity-80" strokeWidth={3} /> : st === 'marginal' ? <Minus className="h-3.5 w-3.5 opacity-60" strokeWidth={3} /> : null}
                      </motion.button>
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
