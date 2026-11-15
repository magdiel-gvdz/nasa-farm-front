import { MapPinned, Warehouse, type LucideIcon } from 'lucide-react'
import type { FieldKind } from '@/api/types'

/** Color e ícono por tipo de terreno. Mismos colores en mapa, tarjetas y leyendas. */
export const KIND: Record<FieldKind, { label: string; plural: string; color: string; icon: LucideIcon }> = {
  field: { label: 'Field', plural: 'Fields', color: '#4ade80', icon: MapPinned },
  greenhouse: { label: 'Greenhouse', plural: 'Greenhouses', color: '#38bdf8', icon: Warehouse },
}
