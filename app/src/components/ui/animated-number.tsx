import { animate, useInView, useReducedMotion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'

/** Número que cuenta hasta su valor al aparecer o cambiar. */
export function AnimatedNumber({ value, digits = 0, className }: { value: number; digits?: number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true })
  const reduce = useReducedMotion()
  const [shown, setShown] = useState(0)
  const [settled, setSettled] = useState(false)
  const from = useRef(0)

  useEffect(() => {
    if (reduce) return
    if (!inView) {
      // Fuera de pantalla (o al imprimir): mostrar el valor real sin esperar al scroll.
      const t = setTimeout(() => setSettled(true), 1500)
      return () => clearTimeout(t)
    }
    const controls = animate(from.current, value, {
      duration: 0.9,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => setShown(v),
      onComplete: () => (from.current = value),
    })
    return () => controls.stop()
  }, [value, inView, reduce])

  const display = reduce || (settled && !inView) ? value : shown
  return (
    <span ref={ref} className={className}>
      {display.toLocaleString('es-MX', { maximumFractionDigits: digits, minimumFractionDigits: digits })}
    </span>
  )
}
