import { CircleCheck, CircleAlert, OctagonAlert, type LucideIcon } from 'lucide-react'
import type { Level } from '@/api/types'
import { cn } from '@/lib/cn'

// El color de estado nunca va solo: siempre lleva ícono y texto.
const LEVEL: Record<Level, { icon: LucideIcon; dot: string; bg: string; label: string }> = {
  ok: { icon: CircleCheck, dot: 'text-good', bg: 'bg-good/12', label: 'Bien' },
  warn: { icon: CircleAlert, dot: 'text-warn', bg: 'bg-warn/15', label: 'Atención' },
  bad: { icon: OctagonAlert, dot: 'text-bad', bg: 'bg-bad/12', label: 'Riesgo' },
}


export function StatusIcon({ level, className }: { level: Level; className?: string }) {
  const { icon: Icon, dot } = LEVEL[level]
  return <Icon className={cn('h-4 w-4 shrink-0', dot, className)} aria-hidden />
}

export function StatusPill({ level, label, className }: { level: Level; label?: string; className?: string }) {
  const s = LEVEL[level]
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium text-ink', s.bg, className)}>
      <StatusIcon level={level} className="h-3.5 w-3.5" />
      {label ?? s.label}
    </span>
  )
}

export function Chip({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={cn('inline-flex items-center gap-1 rounded-full border border-line bg-surface-2 px-2.5 py-0.5 text-xs text-ink-2', className)}>{children}</span>
}
