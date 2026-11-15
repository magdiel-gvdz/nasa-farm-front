// Precalcula el clima (NASA POWER 1991–2025) de los campos de demostración
// para que las demos carguen al instante y funcionen sin internet.
// Uso: npm run fixtures   (Node >= 22.18, type stripping nativo)

import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { DEMOS } from '../src/api/mock/demos.ts'
import { parsePower, summarizeClimate } from '../src/api/mock/engine/climate.ts'
import { POWER_PARAMS, POWER_URL } from '../src/api/mock/power-params.ts'

const outDir = join(dirname(fileURLToPath(import.meta.url)), '../src/api/mock/fixtures')
mkdirSync(outDir, { recursive: true })

for (const { field } of DEMOS) {
  const [lon, lat] = field.centroid
  const url = `${POWER_URL}?parameters=${POWER_PARAMS}&community=AG&longitude=${lon}&latitude=${lat}&start=19910101&end=20251231&format=JSON`
  process.stdout.write(`${field.id} … `)
  const res = await fetch(url)
  if (!res.ok) throw new Error(`POWER ${res.status} para ${field.id}`)
  const climate = summarizeClimate(parsePower(await res.json()), lat)
  writeFileSync(join(outDir, `${field.id}.json`), JSON.stringify(climate))
  console.log(`ok (${climate.years.join('–')}, helada P90 ${climate.frost.last_spring_frost.p90?.date}, lluvia ${climate.rain.annual_mean_mm} mm)`)
}
