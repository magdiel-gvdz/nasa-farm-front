import type { ClimateProfile } from '../types'
import { parsePower, summarizeClimate } from './engine/climate'
import { POWER_PARAMS, POWER_URL } from './power-params'

const KEY = 'fs-climate-v1:'

function cacheKey(lat: number, lon: number) {
  return `${KEY}${lat.toFixed(2)},${lon.toFixed(2)}`
}

export function cachedClimate(lat: number, lon: number): ClimateProfile | null {
  try {
    const raw = localStorage.getItem(cacheKey(lat, lon))
    return raw ? (JSON.parse(raw) as ClimateProfile) : null
  } catch {
    return null
  }
}

/** Descarga 35 años de NASA POWER (≈3 s) y calcula el resumen climático en el navegador. */
export async function fetchClimate(lat: number, lon: number, signal?: AbortSignal): Promise<ClimateProfile> {
  const hit = cachedClimate(lat, lon)
  if (hit) return hit
  const url = `${POWER_URL}?parameters=${POWER_PARAMS}&community=AG&longitude=${lon.toFixed(4)}&latitude=${lat.toFixed(4)}&start=19910101&end=20251231&format=JSON`
  const res = await fetch(url, { signal })
  if (!res.ok) throw new Error(`NASA POWER respondió ${res.status}`)
  const climate = summarizeClimate(parsePower(await res.json()), lat)
  try {
    localStorage.setItem(cacheKey(lat, lon), JSON.stringify(climate))
  } catch {
    /* sin espacio: se recalcula la próxima vez */
  }
  return climate
}
