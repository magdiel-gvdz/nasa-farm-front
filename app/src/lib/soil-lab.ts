import type { Level, SoilLab } from '@/api/types'

// Rangos generales de interpretación de análisis de suelo (0–30 cm).
// Referencia, no receta: el agrónomo los ajusta por cultivo y método de extracción (Anexo B del handoff).

export type LabKey = 'om_pct' | 'ph' | 'ec_ds_m' | 'n_ppm' | 'p_ppm' | 'k_ppm' | 'ca_ppm' | 'mg_ppm' | 'cec_cmol_kg'

interface Band {
  max: number // límite superior (exclusivo); Infinity en la última
  level: Level
  label: string
}

export interface LabParam {
  key: LabKey
  name: string
  unit: string
  step: number
  hint: string
  bands?: Band[]
  advice?: Partial<Record<Level, string>>
}

export const LAB_PARAMS: LabParam[] = [
  {
    key: 'om_pct',
    name: 'Organic matter',
    unit: '%',
    step: 0.1,
    hint: 'MO or M.O.',
    bands: [
      { max: 1, level: 'bad', label: 'Very low' },
      { max: 2, level: 'warn', label: 'Low' },
      { max: 4, level: 'ok', label: 'Medium' },
      { max: Infinity, level: 'ok', label: 'High' },
    ],
    advice: { bad: 'Prioritize soil cover, legumes, composted manure and leaving stubble.', warn: 'Covers and stubble increase it little by little (≈0.1 % per year).' },
  },
  {
    key: 'ph',
    name: 'pH',
    unit: '',
    step: 0.1,
    hint: 'pH in water 1:2',
    bands: [
      { max: 5.5, level: 'bad', label: 'Very acidic' },
      { max: 6, level: 'warn', label: 'Acid' },
      { max: 7.6, level: 'ok', label: 'Suitable' },
      { max: 8.4, level: 'warn', label: 'Alkaline' },
      { max: Infinity, level: 'bad', label: 'Very alkaline' },
    ],
    advice: { warn: 'Choose tolerant crops; In alkaline soils, phosphorus, iron and zinc are blocked.', bad: 'Discuss liming for acidic soils or agricultural gypsum for sodium-affected alkaline soils with your agronomist.' },
  },
  {
    key: 'ec_ds_m',
    name: 'Salinity (EC)',
    unit: 'dS/m',
    step: 0.1,
    hint: 'Electrical conductivity',
    bands: [
      { max: 2, level: 'ok', label: 'No problem' },
      { max: 4, level: 'warn', label: 'Slightly saline' },
      { max: Infinity, level: 'bad', label: 'Saline' },
    ],
    advice: { warn: 'Sensitive crops (beans, onions) may yield less; apply extra irrigation to leach salts.', bad: 'Only tolerant crops (barley, sorghum, cotton) and salt leaching.' },
  },
  {
    key: 'n_ppm',
    name: 'Nitrogen (N-NO₃)',
    unit: 'ppm',
    step: 1,
    hint: 'Nitrates',
    bands: [
      { max: 10, level: 'bad', label: 'Low' },
      { max: 20, level: 'warn', label: 'Medium' },
      { max: Infinity, level: 'ok', label: 'Suitable' },
    ],
    advice: { bad: 'A legume in the rotation provides 50–150 kg N/ha.', warn: 'Adjust the dose according to the crop and expected yield.' },
  },
  {
    key: 'p_ppm',
    name: 'Phosphorus',
    unit: 'ppm',
    step: 1,
    hint: 'P Olsen or Bray',
    bands: [
      { max: 10, level: 'bad', label: 'Low' },
      { max: 20, level: 'warn', label: 'Medium' },
      { max: 40, level: 'ok', label: 'Suitable' },
      { max: Infinity, level: 'warn', label: 'Very high' },
    ],
    advice: { bad: 'Apply phosphorus in bands at planting.', warn: 'Maintain levels based on crop nutrient removal.' },
  },
  {
    key: 'k_ppm',
    name: 'Potassium',
    unit: 'ppm',
    step: 1,
    hint: 'Exchangeable K',
    bands: [
      { max: 120, level: 'bad', label: 'Low' },
      { max: 200, level: 'warn', label: 'Medium' },
      { max: Infinity, level: 'ok', label: 'Suitable' },
    ],
    advice: { bad: 'Vegetables and alfalfa extract a lot of potassium: fertilize.' },
  },
  { key: 'ca_ppm', name: 'Calcium', unit: 'ppm', step: 10, hint: 'Exchangeable Ca' },
  { key: 'mg_ppm', name: 'Magnesium', unit: 'ppm', step: 1, hint: 'Exchangeable Mg' },
  {
    key: 'cec_cmol_kg',
    name: 'CEC',
    unit: 'cmol/kg',
    step: 1,
    hint: 'Cation exchange capacity',
    bands: [
      { max: 10, level: 'warn', label: 'Low' },
      { max: 25, level: 'ok', label: 'Medium' },
      { max: Infinity, level: 'ok', label: 'High' },
    ],
    advice: { warn: 'The soil holds few nutrients: split fertilizer applications.' },
  },
]

export function interpret(p: LabParam, v: number | null | undefined): Band | null {
  if (v == null || !p.bands) return null
  return p.bands.find((b) => v < b.max) ?? null
}

export const hasLabValues = (lab: SoilLab | null | undefined) => !!lab && LAB_PARAMS.some((p) => lab[p.key] != null)
