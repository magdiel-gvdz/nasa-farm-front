import type { Crop } from '@/api/types'

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
export function searchCrops(query: string, crops: Crop[]) {
  const q = norm(query.trim())
  return crops.filter((c) => [c.id, c.name.es, c.name.en, ...c.aliases].some((s) => norm(s).includes(q)))
}
