// Cliente del backend real (contrato en docs/backend-handoff.md §6).

import type { Api } from './client'
import type { ChatEvent, Scenario } from './types'
import { clientId } from '@/lib/client-id'

class ApiError extends Error {
  status: number
  code: string
  constructor(status: number, code: string, message: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

export function createHttpApi(baseUrl: string): Api {
  const base = `${baseUrl.replace(/\/$/, '')}/api/v1`
  const headers = () => ({ 'Content-Type': 'application/json', 'X-Client-Id': clientId(), 'Accept-Language': 'es' })

  async function req<T>(path: string, init: RequestInit = {}): Promise<T> {
    const res = await fetch(`${base}${path}`, { ...init, headers: { ...headers(), ...init.headers } })
    if (res.status === 204) return undefined as T
    const body = await res.json().catch(() => ({}))
    if (!res.ok && res.status !== 202) throw new ApiError(res.status, body?.error?.code ?? 'http_error', body?.error?.message ?? res.statusText)
    return body as T
  }

  const sc = (s: Scenario) => `delta_t_c=${s.delta_t_c}&delta_p_pct=${s.delta_p_pct}`
  const conversations = new Map<string, string>()

  return {
    mode: 'live',
    listFields: () => req('/fields'),
    getField: (id) => req(`/fields/${id}`),
    createField: (input) => req('/fields', { method: 'POST', body: JSON.stringify(input) }),
    updateField: (id, patch) => req(`/fields/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
    deleteField: (id) => req(`/fields/${id}`, { method: 'DELETE' }),
    getProfile: (id) => req(`/fields/${id}/profile`),
    refreshProfile: (id) => req(`/fields/${id}/profile:refresh`, { method: 'POST' }),
    getCrops: () => req('/crops'),
    getSuitabilityMatrix: (id, s) => req(`/fields/${id}/suitability?${sc(s)}`),
    getSuitability: (id, crop, month, s) => req(`/fields/${id}/suitability?crop_id=${crop}&planting_month=${month}&${sc(s)}`),
    getRotations: (id, body) => req(`/fields/${id}/rotations`, { method: 'POST', body: JSON.stringify(body) }),
    getGreenhouse: (id) => req(`/fields/${id}/greenhouse`),
    // 204 o null = no hay estación cercana; React Query no acepta undefined.
    getWaterQuality: (id) => req<import('./types').WaterQualityReport | null>(`/fields/${id}/water-quality`).then((r) => r ?? null),
    predictYield: (id, body) => req(`/fields/${id}/predict-yield`, { method: 'POST', body: JSON.stringify(body) }),
    async extractSoilReport(id, file) {
      const form = new FormData()
      form.append('file', file)
      // Sin Content-Type: el navegador pone el boundary del multipart.
      const res = await fetch(`${base}/fields/${id}/soil-report`, { method: 'POST', body: form, headers: { 'X-Client-Id': clientId(), 'Accept-Language': 'es' } })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new ApiError(res.status, body?.error?.code ?? 'http_error', body?.error?.message ?? 'No se pudo leer el archivo')
      return body
    },
    saveSoilLab: (id, lab) => (lab ? req(`/fields/${id}/soil-lab`, { method: 'PUT', body: JSON.stringify(lab) }) : req(`/fields/${id}/soil-lab`, { method: 'DELETE' })),
    getFutureClimate: (id) => req(`/fields/${id}/future-climate`),

    async chat(fieldId, content, onEvent, signal) {
      const key = fieldId ?? '_'
      let conv = conversations.get(key)
      if (!conv) {
        const created = await req<{ conversation_id: string }>('/chat/conversations', { method: 'POST', body: JSON.stringify({ field_id: fieldId }) })
        conv = created.conversation_id
        conversations.set(key, conv)
      }
      const res = await fetch(`${base}/chat/conversations/${conv}/messages`, {
        method: 'POST',
        headers: { ...headers(), Accept: 'text/event-stream' },
        body: JSON.stringify({ content, active_field_id: fieldId }),
        signal,
      })
      if (!res.ok || !res.body) throw new ApiError(res.status, 'chat_error', 'No se pudo conectar con el agrónomo')
      const reader = res.body.pipeThrough(new TextDecoderStream()).getReader()
      let buffer = ''
      for (;;) {
        const { value, done } = await reader.read()
        if (done) break
        buffer += value
        let idx: number
        while ((idx = buffer.indexOf('\n\n')) >= 0) {
          const chunk = buffer.slice(0, idx)
          buffer = buffer.slice(idx + 2)
          const event = /^event: (.*)$/m.exec(chunk)?.[1]?.trim()
          const data = /^data: (.*)$/m.exec(chunk)?.[1]
          if (!event || !data) continue
          const payload = JSON.parse(data)
          if (event === 'card') onEvent({ type: 'card', card: payload.type, payload: payload.payload })
          else onEvent({ type: event, ...payload } as ChatEvent)
        }
      }
    },
  }
}
