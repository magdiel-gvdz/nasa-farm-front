// Precalcula el clima futuro (CMIP6, 2031–2050 vs 1991–2020) de las parcelas
// de demostración. Uso: node scripts/build-future-fixtures.ts
// Con FUTURE_CACHE_DIR=<dir> lee <dir>/<field.id>.json en lugar de descargar
// (la Climate API limita las descargas grandes por minuto).

import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { DEMOS } from '../src/api/mock/demos.ts'
import { futureUrl, summarizeFuture } from '../src/api/mock/engine/future.ts'

const out = join(dirname(fileURLToPath(import.meta.url)), '../src/api/mock/fixtures/future.json')
const cacheDir = process.env.FUTURE_CACHE_DIR
const result: Record<string, unknown> = {}

for (const { field } of DEMOS) {
  const [lon, lat] = field.centroid
  const cached = cacheDir && join(cacheDir, `${field.id}.json`)
  let json
  if (cached && existsSync(cached)) json = JSON.parse(readFileSync(cached, 'utf8'))
  else {
    const res = await fetch(futureUrl(lat, lon))
    if (!res.ok) throw new Error(`Climate API ${res.status} para ${field.id}: ${await res.text()}`)
    json = await res.json()
    await new Promise((r) => setTimeout(r, 65_000)) // respeta el límite por minuto
  }
  const f = summarizeFuture(json)
  result[field.id] = f
  console.log(`${field.id}: ΔT ${f.median.delta_t_c} °C · ΔP ${f.median.delta_p_pct} % (${f.range.delta_p_pct.join('…')}) · heladas ${f.median.delta_frost_days} d/año`)
}
writeFileSync(out, JSON.stringify(result))
