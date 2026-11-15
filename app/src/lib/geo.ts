import turfArea from '@turf/area'
import turfBbox from '@turf/bbox'
import turfCentroid from '@turf/centroid'
import type { Geometry } from '@/api/types'

export function areaHa(g: Geometry) {
  return Math.round((turfArea(g) / 10_000) * 10) / 10
}

export function centroid(g: Geometry): [number, number] {
  const c = turfCentroid(g).geometry.coordinates
  return [Math.round(c[0] * 1e5) / 1e5, Math.round(c[1] * 1e5) / 1e5]
}

export function bbox(g: Geometry): [number, number, number, number] {
  return turfBbox(g) as [number, number, number, number]
}

export interface Place {
  name: string
  detail: string
  center: [number, number]
  extent?: [number, number, number, number]
}

interface PhotonFeature {
  geometry: { coordinates: [number, number] }
  properties: { name?: string; city?: string; county?: string; state?: string; country?: string; countrycode?: string; extent?: [number, number, number, number] }
}

/** Búsqueda de lugares (Photon / OpenStreetMap, sin API key). */
export async function searchPlaces(q: string, signal?: AbortSignal): Promise<Place[]> {
  if (q.trim().length < 3) return []
  const res = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=6&lang=en`, { signal })
  if (!res.ok) return []
  const json = (await res.json()) as { features: PhotonFeature[] }
  return json.features.map((f) => ({
    name: f.properties.name ?? f.properties.city ?? q,
    detail: [f.properties.city, f.properties.state, f.properties.country].filter((x, i, a) => x && x !== f.properties.name && a.indexOf(x) === i).join(', '),
    center: f.geometry.coordinates,
    extent: f.properties.extent,
  }))
}

export async function reverseGeocode(lon: number, lat: number): Promise<{ country: string; state?: string; municipality?: string }> {
  try {
    const res = await fetch(`https://photon.komoot.io/reverse?lang=en&lon=${lon}&lat=${lat}&limit=1`)
    const json = (await res.json()) as { features: PhotonFeature[] }
    const p = json.features[0]?.properties
    if (p) return { country: (p.countrycode ?? 'XX').toUpperCase(), state: p.state, municipality: p.county ?? p.city }
  } catch {
    /* sin red */
  }
  return { country: lat > 32.7 && lon < -95 ? 'US' : 'MX' }
}

/** ¿El anillo (sin cerrar) tiene aristas que se cruzan? Prueba O(n²), suficiente para polígonos dibujados a mano. */
export function selfIntersects(ring: [number, number][]): boolean {
  const n = ring.length
  if (n < 4) return false
  const cross = (o: number[], a: number[], b: number[]) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
  const hit = (p1: number[], p2: number[], p3: number[], p4: number[]) => {
    const d1 = cross(p3, p4, p1)
    const d2 = cross(p3, p4, p2)
    const d3 = cross(p1, p2, p3)
    const d4 = cross(p1, p2, p4)
    return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))
  }
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (j === i + 1 || (i === 0 && j === n - 1)) continue // aristas vecinas
      if (hit(ring[i], ring[(i + 1) % n], ring[j], ring[(j + 1) % n])) return true
    }
  }
  return false
}
