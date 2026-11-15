import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { capabilities, getApi } from '@/api/client'
import type { FieldInput, FieldProfile, RotationRequest, Scenario, SoilLab } from '@/api/types'

const api = () => getApi()

export function useFields() {
  return useQuery({ queryKey: ['fields'], queryFn: async () => (await api()).listFields() })
}

export function useField(id: string) {
  return useQuery({ queryKey: ['field', id], queryFn: async () => (await api()).getField(id) })
}

export function useProfile(id: string) {
  return useQuery({
    queryKey: ['profile', id],
    queryFn: async () => (await api()).getProfile(id),
    refetchInterval: (q) => (q.state.data?.status === 'processing' ? 700 : false),
    retry: 1,
  })
}

export const isReady = (p: unknown): p is FieldProfile => (p as FieldProfile | undefined)?.status === 'ready'

export function useCrops() {
  return useQuery({ queryKey: ['crops'], queryFn: async () => (await api()).getCrops(), staleTime: Infinity })
}

export function useSuitabilityMatrix(id: string, scenario: Scenario, enabled: boolean) {
  return useQuery({
    queryKey: ['suitability', id, scenario],
    queryFn: async () => (await api()).getSuitabilityMatrix(id, scenario),
    enabled,
    placeholderData: keepPreviousData,
  })
}

export function useSuitability(id: string, cropId: string | null, month: number | null, scenario: Scenario) {
  return useQuery({
    queryKey: ['suitability', id, cropId, month, scenario],
    queryFn: async () => (await api()).getSuitability(id, cropId!, month!, scenario),
    enabled: !!cropId && !!month,
  })
}

export function useYield(id: string, cropId: string | null, month: number | null, irrigated: boolean, scenario: Scenario) {
  return useQuery({
    queryKey: ['yield', id, cropId, month, irrigated, scenario],
    queryFn: async () => (await api()).predictYield(id, { crop_id: cropId!, planting_month: month!, irrigated, scenario }),
    enabled: capabilities.yield && !!cropId && !!month,
  })
}

export function useRotations(id: string, req: RotationRequest, enabled: boolean) {
  return useQuery({
    queryKey: ['rotations', id, req],
    queryFn: async () => (await api()).getRotations(id, req),
    enabled,
    placeholderData: keepPreviousData,
  })
}

export function useGreenhouse(id: string, enabled: boolean) {
  return useQuery({ queryKey: ['greenhouse', id], queryFn: async () => (await api()).getGreenhouse(id), enabled })
}

export function useWaterQuality(id: string, enabled: boolean) {
  return useQuery({ queryKey: ['water', id], queryFn: async () => (await api()).getWaterQuality(id), enabled: enabled && capabilities.waterQuality })
}

export function useCreateField() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: FieldInput) => (await api()).createField(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['fields'] }),
  })
}

export function useDeleteField() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => (await api()).deleteField(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['fields'] }),
  })
}

export function useFutureClimate(id: string, enabled = true) {
  return useQuery({ queryKey: ['future', id], queryFn: async () => (await api()).getFutureClimate(id), enabled: enabled && capabilities.futureClimate, staleTime: Infinity, retry: 1 })
}

export function useExtractSoilReport(id: string) {
  const qc = useQueryClient()
  return useMutation({ mutationFn: async (file: File) => (await api()).extractSoilReport(id, file),
    onSuccess: (result) => result.applied ? Promise.all(['field', 'profile', 'suitability', 'rotations'].map((k) => qc.invalidateQueries({ queryKey: [k, id] }))) : undefined,
  })
}

/** Guarda o borra el análisis de laboratorio y recalcula todo lo que depende del suelo. */
export function useSaveSoilLab(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (lab: SoilLab | null) => (await api()).saveSoilLab(id, lab),
    onSuccess: () => Promise.all(['profile', 'suitability', 'rotations', 'yield'].map((k) => qc.invalidateQueries({ queryKey: [k, id] }))),
  })
}

export function useUpdateField(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (patch: Partial<Omit<FieldInput, 'kind'>>) => (await api()).updateField(id, patch),
    onSuccess: () => Promise.all(['fields', 'field', 'profile', 'suitability', 'rotations', 'greenhouse'].map((k) => qc.invalidateQueries({ queryKey: k === 'fields' ? [k] : [k, id] }))),
  })
}

export function useSources() {
  return useQuery({ queryKey: ['sources'], queryFn: async () => (await api()).getSources(), staleTime: 60 * 60 * 1000 })
}
