import type { Level, SuitStatus } from '@/api/types'

export const suitToLevel = (s: SuitStatus): Level => (s === 'suitable' ? 'ok' : s === 'marginal' ? 'warn' : 'bad')
export const suitLabel = (s: SuitStatus) => (s === 'suitable' ? 'Apto' : s === 'marginal' ? 'Con riesgos' : 'No recomendable')
