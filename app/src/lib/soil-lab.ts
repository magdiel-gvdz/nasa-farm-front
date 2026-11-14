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
    name: 'Materia orgánica',
    unit: '%',
    step: 0.1,
    hint: 'MO o M.O.',
    bands: [
      { max: 1, level: 'bad', label: 'Muy baja' },
      { max: 2, level: 'warn', label: 'Baja' },
      { max: 4, level: 'ok', label: 'Media' },
      { max: Infinity, level: 'ok', label: 'Alta' },
    ],
    advice: { bad: 'Prioriza coberturas, leguminosas, estiércol composteado y dejar rastrojo.', warn: 'Coberturas y rastrojo la suben poco a poco (≈0.1 % por año).' },
  },
  {
    key: 'ph',
    name: 'pH',
    unit: '',
    step: 0.1,
    hint: 'pH en agua 1:2',
    bands: [
      { max: 5.5, level: 'bad', label: 'Muy ácido' },
      { max: 6, level: 'warn', label: 'Ácido' },
      { max: 7.6, level: 'ok', label: 'Adecuado' },
      { max: 8.4, level: 'warn', label: 'Alcalino' },
      { max: Infinity, level: 'bad', label: 'Muy alcalino' },
    ],
    advice: { warn: 'Elige cultivos tolerantes; en suelos alcalinos el fósforo, hierro y zinc se bloquean.', bad: 'Revisa encalado (ácido) o yeso agrícola si hay sodio (alcalino) con tu agrónomo.' },
  },
  {
    key: 'ec_ds_m',
    name: 'Salinidad (CE)',
    unit: 'dS/m',
    step: 0.1,
    hint: 'Conductividad eléctrica',
    bands: [
      { max: 2, level: 'ok', label: 'Sin problema' },
      { max: 4, level: 'warn', label: 'Ligeramente salino' },
      { max: Infinity, level: 'bad', label: 'Salino' },
    ],
    advice: { warn: 'Cultivos sensibles (frijol, cebolla) pueden rendir menos; aplica láminas de lavado.', bad: 'Solo cultivos tolerantes (cebada, sorgo, algodón) y lavado de sales.' },
  },
  {
    key: 'n_ppm',
    name: 'Nitrógeno (N-NO₃)',
    unit: 'ppm',
    step: 1,
    hint: 'Nitratos',
    bands: [
      { max: 10, level: 'bad', label: 'Bajo' },
      { max: 20, level: 'warn', label: 'Medio' },
      { max: Infinity, level: 'ok', label: 'Adecuado' },
    ],
    advice: { bad: 'Una leguminosa en la rotación aporta 50–150 kg N/ha.', warn: 'Ajusta la dosis según el cultivo y el rendimiento esperado.' },
  },
  {
    key: 'p_ppm',
    name: 'Fósforo (Olsen)',
    unit: 'ppm',
    step: 1,
    hint: 'P Olsen o Bray',
    bands: [
      { max: 10, level: 'bad', label: 'Bajo' },
      { max: 20, level: 'warn', label: 'Medio' },
      { max: 40, level: 'ok', label: 'Adecuado' },
      { max: Infinity, level: 'warn', label: 'Muy alto' },
    ],
    advice: { bad: 'Fertiliza fósforo en banda al sembrar.', warn: 'Mantenimiento según extracción del cultivo.' },
  },
  {
    key: 'k_ppm',
    name: 'Potasio',
    unit: 'ppm',
    step: 1,
    hint: 'K intercambiable',
    bands: [
      { max: 120, level: 'bad', label: 'Bajo' },
      { max: 200, level: 'warn', label: 'Medio' },
      { max: Infinity, level: 'ok', label: 'Adecuado' },
    ],
    advice: { bad: 'Hortalizas y alfalfa extraen mucho potasio: fertiliza.' },
  },
  { key: 'ca_ppm', name: 'Calcio', unit: 'ppm', step: 10, hint: 'Ca intercambiable' },
  { key: 'mg_ppm', name: 'Magnesio', unit: 'ppm', step: 1, hint: 'Mg intercambiable' },
  {
    key: 'cec_cmol_kg',
    name: 'CIC',
    unit: 'cmol/kg',
    step: 1,
    hint: 'Capacidad de intercambio catiónico',
    bands: [
      { max: 10, level: 'warn', label: 'Baja' },
      { max: 25, level: 'ok', label: 'Media' },
      { max: Infinity, level: 'ok', label: 'Alta' },
    ],
    advice: { warn: 'El suelo retiene pocos nutrientes: fracciona la fertilización.' },
  },
]

export function interpret(p: LabParam, v: number | null | undefined): Band | null {
  if (v == null || !p.bands) return null
  return p.bands.find((b) => v < b.max) ?? null
}

export const hasLabValues = (lab: SoilLab | null | undefined) => !!lab && LAB_PARAMS.some((p) => lab[p.key] != null)
