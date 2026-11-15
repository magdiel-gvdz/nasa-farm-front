import { MapPinned, Warehouse, type LucideIcon } from 'lucide-react'
import type { FieldKind } from '@/api/types'

/** Color e ícono por tipo de terreno. Mismos colores en mapa, tarjetas y leyendas. */
export const KIND: Record<FieldKind, { label: string; plural: string; color: string; icon: LucideIcon }> = {
  field: { label: 'Parcela', plural: 'Parcelas', color: '#4ade80', icon: MapPinned },
  greenhouse: { label: 'Invernadero', plural: 'Invernaderos', color: '#38bdf8', icon: Warehouse },
}
