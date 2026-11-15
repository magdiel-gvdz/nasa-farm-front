import { motion, type HTMLMotionProps } from 'motion/react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { fadeUp, stagger } from './motion'

export function Card({ className, children, ...props }: HTMLMotionProps<'div'>) {
  return (
    <motion.div variants={fadeUp} className={cn('card p-5', className)} {...props}>
      {children}
    </motion.div>
  )
}

export function CardHeader({ title, subtitle, icon, action }: { title: ReactNode; subtitle?: ReactNode; icon?: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-4 flex items-start gap-3">
      {icon && <div className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-surface-2 text-ink-2">{icon}</div>}
      <div className="min-w-0 flex-1">
        <h3 className="text-[15px] leading-tight font-semibold text-ink">{title}</h3>
        {subtitle && <p className="mt-1 text-sm text-ink-2">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}

export function Stagger({ className, children, step }: { className?: string; children: ReactNode; step?: number }) {
  return (
    <motion.div className={className} variants={stagger(step)} initial="hidden" animate="show">
      {children}
    </motion.div>
  )
}
