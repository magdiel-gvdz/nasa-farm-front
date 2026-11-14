import { Slider as RS } from 'radix-ui'
import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

export function Slider({
  label,
  icon,
  value,
  min,
  max,
  step = 1,
  onChange,
  format,
  hint,
  className,
}: {
  label: ReactNode
  icon?: ReactNode
  value: number
  min: number
  max: number
  step?: number
  onChange: (v: number) => void
  format?: (v: number) => ReactNode
  hint?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('space-y-2.5', className)}>
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="flex items-center gap-2 font-medium text-ink">
          {icon && <span className="text-ink-2">{icon}</span>}
          {label}
        </span>
        <span className="tabular text-ink-2">{format ? format(value) : value}</span>
      </div>
      <RS.Root className="relative flex h-5 w-full touch-none items-center select-none" value={[value]} min={min} max={max} step={step} onValueChange={([v]) => onChange(v)}>
        <RS.Track className="relative h-1.5 grow overflow-hidden rounded-full bg-surface-3">
          <RS.Range className="absolute h-full rounded-full bg-accent" />
        </RS.Track>
        <RS.Thumb
          aria-label={typeof label === 'string' ? label : undefined}
          className="block h-5 w-5 cursor-grab rounded-full border-2 border-accent bg-surface shadow-md transition-transform hover:scale-110 active:cursor-grabbing active:scale-95"
        />
      </RS.Root>
      {hint && <p className="text-xs text-muted">{hint}</p>}
    </div>
  )
}
