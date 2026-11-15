import { motion, type HTMLMotionProps } from 'motion/react'
import { forwardRef } from 'react'
import { cn } from '@/lib/cn'

type Variant = 'primary' | 'accent' | 'outline' | 'ghost' | 'soft'
type Size = 'sm' | 'md' | 'lg' | 'icon'

const variants: Record<Variant, string> = {
  primary: 'bg-ink text-page hover:opacity-90 shadow-sm',
  accent: 'bg-accent text-accent-ink hover:brightness-110 shadow-sm',
  outline: 'border border-line-strong bg-surface text-ink hover:bg-surface-2',
  ghost: 'text-ink-2 hover:text-ink hover:bg-surface-2',
  soft: 'bg-surface-2 text-ink hover:bg-surface-3',
}

const sizes: Record<Size, string> = {
  sm: 'h-8 px-3 text-sm gap-1.5 rounded-full',
  md: 'h-10 px-4 text-sm gap-2 rounded-full',
  lg: 'h-12 px-6 text-base gap-2 rounded-full',
  icon: 'h-10 w-10 rounded-full justify-center',
}

export interface ButtonProps extends HTMLMotionProps<'button'> {
  variant?: Variant
  size?: Size
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(({ variant = 'primary', size = 'md', className, disabled, ...props }, ref) => (
  <motion.button
    ref={ref}
    whileTap={disabled ? undefined : { scale: 0.96 }}
    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
    disabled={disabled}
    className={cn(
      'inline-flex shrink-0 cursor-pointer items-center font-medium whitespace-nowrap transition-[background-color,color,opacity,filter] select-none disabled:cursor-not-allowed disabled:opacity-40',
      variants[variant],
      sizes[size],
      className,
    )}
    {...props}
  />
))
Button.displayName = 'Button'
