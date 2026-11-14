import type {
  ChatEvent,
  Crop,
  Field,
  FieldInput,
  FutureClimate,
  GreenhouseReport,
  ProfileResponse,
  RotationRequest,
  RotationResponse,
  Scenario,
  SuitabilityDetail,
  SoilLab,
  SoilReportExtraction,
  SuitabilityMatrix,
  WaterQualityReport,
  YieldPrediction,
} from './types'

/** Interfaz común del backend real y del modo demostración. */
export interface Api {
  mode: 'live' | 'demo'
  listFields(): Promise<Field[]>
  getField(id: string): Promise<Field>
  createField(input: FieldInput): Promise<Field>
  updateField(id: string, patch: Partial<FieldInput>): Promise<Field>
  deleteField(id: string): Promise<void>
  getProfile(id: string): Promise<ProfileResponse>
  refreshProfile(id: string): Promise<void>
  getCrops(): Promise<Crop[]>
  getSuitabilityMatrix(id: string, scenario: Scenario): Promise<SuitabilityMatrix>
  getSuitability(id: string, cropId: string, month: number, scenario: Scenario): Promise<SuitabilityDetail>
  getRotations(id: string, req: RotationRequest): Promise<RotationResponse>
  getGreenhouse(id: string): Promise<GreenhouseReport>
  getWaterQuality(id: string): Promise<WaterQualityReport | null>
  predictYield(id: string, body: { crop_id: string; planting_month: number; irrigated: boolean; scenario: Scenario }): Promise<YieldPrediction>
  /** Lee un PDF/foto de análisis de laboratorio. NO guarda: el usuario revisa y luego llama saveSoilLab. */
  extractSoilReport(id: string, file: File): Promise<SoilReportExtraction>
  /** Guarda (o con null, borra) el análisis confirmado; el perfil pasa a confianza alta. */
  saveSoilLab(id: string, lab: SoilLab | null): Promise<void>
  /** Cambio proyectado del clima (2031–2050 vs 1991–2020) para esta parcela. */
  getFutureClimate(id: string): Promise<FutureClimate>
  chat(fieldId: string | null, content: string, onEvent: (e: ChatEvent) => void, signal?: AbortSignal): Promise<void>
}

export const NO_SCENARIO: Scenario = { delta_t_c: 0, delta_p_pct: 0 }

const apiUrl = import.meta.env.VITE_API_URL as string | undefined

let instance: Promise<Api> | null = null

/** Con VITE_API_URL usa el backend; sin él, el modo demostración (NASA POWER real + motores locales). */
export function getApi(): Promise<Api> {
  instance ??= apiUrl ? import('./http').then((m) => m.createHttpApi(apiUrl)) : import('./mock').then((m) => m.createMockApi())
  return instance
}

export const isDemoMode = !apiUrl
