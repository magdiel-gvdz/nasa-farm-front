import { motion } from 'motion/react'
import type { Level } from '@/api/types'
import { AnimatedNumber } from '@/components/ui/animated-number'

const COLOR: Record<Level, string> = { ok: 'var(--good)', warn: 'var(--warn)', bad: 'var(--bad)' }

export function ScoreRing({ score, level, size = 88 }: { score: number; level: Level; size?: number }) {
  const r = 42
  const c = 2 * Math.PI * r
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
        <circle cx="50" cy="50" r={r} fill="none" stroke="var(--surface-3)" strokeWidth="8" />
        <motion.circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          stroke={COLOR[level]}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - score / 100) }}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center">
        <span className="text-2xl font-semibold text-ink">
          <AnimatedNumber value={score} />
        </span>
      </div>
    </div>
  )
}
