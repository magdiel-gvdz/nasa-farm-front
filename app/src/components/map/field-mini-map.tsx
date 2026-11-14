import { useEffect } from 'react'
import type { FieldKind, Geometry } from '@/api/types'
import { cn } from '@/lib/cn'
import { KIND } from '@/lib/kinds'
import { drawField, useMap } from './use-map'

export function FieldMiniMap({ geometry, kind = 'field', className }: { geometry: Geometry; kind?: FieldKind; className?: string }) {
  const { container, map } = useMap({ interactive: false })
  useEffect(() => {
    if (map) drawField(map, 'field', geometry, { fit: true, padding: 36, color: KIND[kind].color })
  }, [map, geometry, kind])
  return (
    <div className={cn('relative overflow-hidden rounded-[1.25rem] bg-surface-2', className)}>
      <div className="absolute inset-0">
        <div ref={container} className="h-full w-full" />
      </div>
      {!map && <div className="skeleton absolute inset-0 rounded-none" />}
    </div>
  )
}

/** Silueta SVG de la parcela (sin teselas), para tarjetas. */
export function FieldShape({ geometry, kind = 'field', className }: { geometry: Geometry; kind?: FieldKind; className?: string }) {
  const ring = (geometry.type === 'Polygon' ? geometry.coordinates[0] : geometry.coordinates[0][0]) as [number, number][]
  const xs = ring.map((p) => p[0])
  const ys = ring.map((p) => p[1])
  const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)]
  const k = Math.cos(((minY + maxY) / 2) * (Math.PI / 180))
  const w = (maxX - minX) * k || 1e-6
  const h = maxY - minY || 1e-6
  const s = 80 / Math.max(w, h)
  const pts = ring.map(([x, y]) => `${(10 + ((x - minX) * k * s) + (80 - w * s) / 2).toFixed(1)},${(10 + (maxY - y) * s + (80 - h * s) / 2).toFixed(1)}`).join(' ')
  const color = `var(--kind-${kind})`
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden>
      <polygon points={pts} fill={color} fillOpacity={0.18} stroke={color} strokeWidth={2.5} strokeLinejoin="round" />
    </svg>
  )
}
