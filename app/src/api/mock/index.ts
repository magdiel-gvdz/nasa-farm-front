// Modo demostración: implementa el contrato de API en el navegador.
// Clima real de NASA POWER (precalculado para las demos), motores locales
// para aptitud, rotaciones, invernadero, agua y rendimiento.

import type { Api } from '../client'
import type { ClimateProfile, Field, FieldInput, FieldProfile, ProfileStep, Scenario, SoilLab } from './types'
import { areaHa, centroid, reverseGeocode } from '@/lib/geo'
import { mockChat } from './chat'
import { DEMO_BY_ID, DEMOS } from './demos'
import { buildClimateModel } from './engine/agro'
import { CROP_BY_ID, CROPS } from './engine/crops'
import { SOURCES, buildProfile, greenhouseReport, predictYield, waterQualityReport } from './engine/profile'
import { compareRotations } from './engine/rotations'
import { evaluateCrop, type SuitContext, suitabilityMatrix } from './engine/suitability'
import { fetchFuture } from './future'
import { cachedClimate, fetchClimate } from './power'
import arteaga from './fixtures/demo-arteaga.json'
import nevada from './fixtures/demo-nevada.json'
import saltillo from './fixtures/demo-saltillo.json'

const FIXTURES: Record<string, ClimateProfile> = {
  'demo-saltillo': saltillo as unknown as ClimateProfile,
  'demo-arteaga': arteaga as unknown as ClimateProfile,
  'demo-nevada': nevada as unknown as ClimateProfile,
}

const STORE = 'fs-fields-v1'
const LABS = 'fs-soil-labs-v1'
const PIPELINE: { source_id: string; at: number }[] = [
  { source_id: 'nasa_power', at: 0 },
  { source_id: 'gpm_imerg', at: 900 },
  { source_id: 'soilgrids', at: 1500 },
  { source_id: 'srtm', at: 2000 },
  { source_id: 'modis_ndvi', at: 2600 },
  { source_id: 'smap', at: 3100 },
  { source_id: 'grace_fo', at: 3500 },
]
const MIN_JOB_MS = 3800

function loadUserFields(): Field[] {
  try {
    return JSON.parse(localStorage.getItem(STORE) ?? '[]') as Field[]
  } catch {
    return []
  }
}

function saveUserFields(fields: Field[]) {
  localStorage.setItem(STORE, JSON.stringify(fields))
}

function loadLabs(): Record<string, SoilLab> {
  try {
    return JSON.parse(localStorage.getItem(LABS) ?? '{}') as Record<string, SoilLab>
  } catch {
    return {}
  }
}

const delay = (ms = 120) => new Promise((r) => setTimeout(r, ms))

export function createMockApi(): Api {
  const jobs = new Map<string, { started: number; climate?: ClimateProfile; error?: string }>()

  const allFields = () => [...loadUserFields(), ...DEMOS.map((d) => d.field)]

  async function field(id: string) {
    const f = allFields().find((x) => x.id === id)
    if (!f) throw new Error('Field not found')
    return f
  }

  function profileOf(f: Field, climate: ClimateProfile) {
    const o = DEMO_BY_ID.get(f.id)?.overrides ?? {}
    const lab = loadLabs()[f.id] ?? o.soil?.lab ?? null
    return buildProfile(f, climate, { ...o, soil: { ...o.soil, lab } })
  }

  function climateFor(f: Field): ClimateProfile | null {
    return FIXTURES[f.id] ?? cachedClimate(f.centroid[1], f.centroid[0]) ?? jobs.get(f.id)?.climate ?? null
  }

  async function readyProfile(id: string): Promise<{ f: Field; p: FieldProfile }> {
    const f = await field(id)
    const climate = climateFor(f)
    if (!climate) throw new Error('Profile is still being calculated')
    return { f, p: profileOf(f, climate) }
  }

  function ctx(f: Field, p: FieldProfile, scenario?: Scenario): SuitContext {
    const model = buildClimateModel(p.climate, f.centroid[1], scenario)
    if (f.kind === 'greenhouse') {
      // Dentro del invernadero: menos helada, noches más templadas, riego controlado.
      model.months = model.months.map((m) => ({ ...m, tmin: m.tmin + 4, frostProb: m.frostProb * 0.15 }))
    }
    const irr = f.irrigation?.available ? (f.irrigation.max_mm_per_year ?? 500) / 2 : 0
    return { model, profile: p, irrigationMm: f.kind === 'greenhouse' ? 2000 : irr, protectedCrop: f.kind === 'greenhouse' }
  }

  function startJob(f: Field) {
    if (jobs.has(f.id)) return
    const job: { started: number; climate?: ClimateProfile; error?: string } = { started: Date.now() }
    jobs.set(f.id, job)
    fetchClimate(f.centroid[1], f.centroid[0])
      .then((c) => (job.climate = c))
      .catch((e: Error) => (job.error = e.message))
  }

  return {
    mode: 'demo',
    getSources: async () => Object.values(SOURCES),

    async listFields() {
      await delay()
      return allFields()
    },

    async getField(id) {
      await delay(60)
      return field(id)
    },

    async createField(input: FieldInput) {
      const c = centroid(input.geometry)
      const admin = await reverseGeocode(c[0], c[1])
      const f: Field = {
        ...input,
        id: `fld_${crypto.randomUUID().slice(0, 8)}`,
        area_ha: areaHa(input.geometry),
        centroid: c,
        country: admin.country,
        admin: { state: admin.state, municipality: admin.municipality },
        created_at: new Date().toISOString(),
        profile_status: 'processing',
        current_rotation: input.current_rotation ?? [
          { year: 1, season: 'spring_summer', crop_id: input.kind === 'greenhouse' ? 'tomate' : 'maiz' },
          { year: 1, season: 'fall_winter', crop_id: null },
        ],
      }
      saveUserFields([f, ...loadUserFields()])
      startJob(f)
      return f
    },

    async updateField(id, patch) {
      const fields = loadUserFields()
      const i = fields.findIndex((f) => f.id === id)
      if (i < 0) throw new Error('Example fields cannot be edited')
      fields[i] = { ...fields[i], ...patch }
      if (patch.geometry) {
        fields[i].area_ha = areaHa(patch.geometry)
        fields[i].centroid = centroid(patch.geometry)
      }
      saveUserFields(fields)
      return fields[i]
    },

    async deleteField(id) {
      saveUserFields(loadUserFields().filter((f) => f.id !== id))
      const labs = loadLabs()
      delete labs[id]
      localStorage.setItem(LABS, JSON.stringify(labs))
    },

    async extractSoilReport(_id, file) {
      // Sin servidor no hay quien lea el PDF: se devuelve un formulario vacío para capturar a mano.
      await delay(700)
      return {
        extracted: { file_name: file.name, depth_cm: [0, 30] },
        unreadable_fields: ['om_pct', 'ph', 'ec_ds_m', 'n_ppm', 'p_ppm', 'k_ppm'],
        confidence: 'low',
        note: 'In demo mode we do not read the file: write the values of your analysis. With the server connected, the AI ​​fills them in for you and you only review them.',
      }
    },

    async saveSoilLab(id, lab) {
      await field(id)
      const labs = loadLabs()
      if (lab) labs[id] = lab
      else delete labs[id]
      localStorage.setItem(LABS, JSON.stringify(labs))
    },

    async getFutureClimate(id) {
      const f = await field(id)
      return fetchFuture(f.id, f.centroid[1], f.centroid[0])
    },

    async getProfile(id) {
      const f = await field(id)
      const climate = climateFor(f)
      const job = jobs.get(f.id)
      const elapsed = job ? Date.now() - job.started : Infinity
      if (climate && elapsed >= MIN_JOB_MS) return profileOf(f, climate)
      if (!job) startJob(f)
      const j = jobs.get(f.id)!
      const t = Date.now() - j.started
      const steps: ProfileStep[] = PIPELINE.map((s) => {
        if (s.source_id === 'nasa_power') {
          return { source_id: s.source_id, status: j.error ? 'failed' : j.climate ? 'done' : 'running', message: j.error }
        }
        return { source_id: s.source_id, status: t >= s.at + 700 ? 'done' : t >= s.at ? 'running' : 'pending' }
      })
      if (j.error) throw new Error(`Could not download NASA POWER weather: ${j.error}`)
      return { status: 'processing', steps }
    },

    async getCrops() {
      return CROPS
    },

    async getSuitabilityMatrix(id, scenario) {
      const { f, p } = await readyProfile(id)
      // En invernadero solo tienen sentido hortalizas y berries de cultivo protegido.
      return suitabilityMatrix(ctx(f, p, scenario), f.kind === 'greenhouse' ? CROPS.filter((c) => c.greenhouse_ok) : CROPS)
    },

    async getSuitability(id, cropId, month, scenario) {
      const { f, p } = await readyProfile(id)
      return evaluateCrop(CROP_BY_ID.get(cropId)!, month, ctx(f, p, scenario))
    },

    async getRotations(id, req) {
      const { f, p } = await readyProfile(id)
      const c = ctx(f, p, req.scenario)
      return compareRotations(f, p, req, c)
    },

    async getGreenhouse(id) {
      const { f, p } = await readyProfile(id)
      return greenhouseReport(f, p)
    },

    async getWaterQuality(id) {
      return waterQualityReport(await field(id))
    },

    async predictYield(id, body) {
      const { f, p } = await readyProfile(id)
      const det = evaluateCrop(CROP_BY_ID.get(body.crop_id)!, body.planting_month, ctx(f, p, body.scenario))
      return predictYield(body.crop_id, det, body.irrigated, f.country)
    },

    async chat(fieldId, content, onEvent, signal) {
      const none = () => {
        throw new Error('without parcel')
      }
      let deps: Parameters<typeof mockChat>[1] = { field: null, profile: null, evaluate: none, rotations: none, future: none }
      if (fieldId) {
        try {
          const { f, p } = await readyProfile(fieldId)
          const base = ctx(f, p)
          const at = (s?: Scenario) => (s && (s.delta_t_c || s.delta_p_pct) ? ctx(f, p, s) : base)
          const priorities = { save_water: 3, income: 3, soil_health: 3, forage: f.livestock ? 3 : 1, pest_break: 2, low_labor: 1 }
          deps = {
            field: f,
            profile: p,
            evaluate: (cropId, month, s) => evaluateCrop(CROP_BY_ID.get(cropId)!, month, at(s)),
            rotations: (s) => compareRotations(f, p, { priorities, constraints: { horizon_years: 4 }, scenario: s ?? { delta_t_c: 0, delta_p_pct: 0 } }, at(s)),
            future: () => fetchFuture(f.id, f.centroid[1], f.centroid[0]),
          }
        } catch {
          /* sin perfil todavía */
        }
      }
      await mockChat(content, deps, onEvent, signal)
    },
  }
}
