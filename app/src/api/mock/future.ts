import type { FutureClimate } from '../types'
import { BROWSER_MODELS, futureUrl, summarizeFuture } from './engine/future'
import demoFuture from './fixtures/future.json'

const KEY = 'fs-future-v1:'
const FIXTURES = demoFuture as unknown as Record<string, FutureClimate>
const inflight = new Map<string, Promise<FutureClimate>>()

/** Proyección CMIP6 del punto: fixture para las demos, descarga + cache local para el resto. */
export function fetchFuture(fieldId: string, lat: number, lon: number): Promise<FutureClimate> {
  if (FIXTURES[fieldId]) return Promise.resolve(FIXTURES[fieldId])
  const key = `${KEY}${lat.toFixed(2)},${lon.toFixed(2)}`
  try {
    const hit = localStorage.getItem(key)
    if (hit) return Promise.resolve(JSON.parse(hit) as FutureClimate)
  } catch {
    /* sin almacenamiento */
  }
  let p = inflight.get(key)
  if (!p) {
    p = fetch(futureUrl(lat, lon, BROWSER_MODELS))
      .then(async (res) => {
        if (res.status === 429) throw new Error('The screening service is saturated; try in a minute.')
        if (!res.ok) throw new Error(`Climate projections: error ${res.status}`)
        const f = summarizeFuture(await res.json())
        try {
          localStorage.setItem(key, JSON.stringify(f))
        } catch {
          /* sin espacio */
        }
        return f
      })
      .finally(() => inflight.delete(key))
    inflight.set(key, p)
  }
  return p
}
