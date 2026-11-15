import type { Api } from './client'
import type { BackendSchemas as B } from './backend'
import type { ChatEvent, ConversationHistory, Scenario } from './types'
import { cropFromBackend, fieldFromBackend, greenhouseFromBackend, profileFromBackend, soilReportFromBackend, sourceFromBackend } from './adapters'
import { ApiError, responseError } from './errors'
import { clientId } from '@/lib/client-id'

export async function readChatStream(body: ReadableStream<Uint8Array>, onEvent: (event: ChatEvent) => void) {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let ended = false
  function dispatch(chunk: string) {
    const lines = chunk.split(/\r?\n/)
    const event = lines.find((line) => line.startsWith('event:'))?.slice(6).trim()
    const data = lines.filter((line) => line.startsWith('data:')).map((line) => line.slice(5).trimStart()).join('\n')
    if (!event || !data) return
    const payload = JSON.parse(data)
    if (event === 'card') onEvent({ type: 'card', card: payload.type, payload: payload.payload })
    else onEvent({ ...payload, type: event } as ChatEvent)
    ended ||= event === 'done' || event === 'error'
  }
  try {
    while (!ended) {
      const { value, done } = await reader.read()
      buffer += done ? decoder.decode() : decoder.decode(value, { stream: true })
      let match: RegExpExecArray | null
      while ((match = /\r?\n\r?\n/.exec(buffer))) {
        dispatch(buffer.slice(0, match.index))
        buffer = buffer.slice(match.index + match[0].length)
        if (ended) break
      }
      if (done) { if (buffer.trim() && !ended) dispatch(buffer); break }
    }
    if (!ended) throw new ApiError(502, 'stream_interrupted', 'The response was interrupted. Please try again.')
  } finally {
    await reader.cancel().catch(() => {})
    reader.releaseLock()
  }
}

export function createHttpApi(baseUrl: string): Api {
  const base = `${baseUrl.trim().replace(/\/+$/, '').replace(/\/api\/v1$/, '')}/api/v1`
  const headers = () => ({ 'Content-Type': 'application/json', 'X-Client-Id': clientId(), 'Accept-Language': 'en' })
  async function req<T>(path: string, init: RequestInit = {}): Promise<T> {
    const res = await fetch(`${base}${path}`, { ...init, headers: { ...headers(), ...init.headers } })
    if (!res.ok) throw await responseError(res)
    if (res.status === 204) return undefined as T
    return res.json() as Promise<T>
  }
  const unavailable = async (): Promise<never> => { throw new ApiError(501, 'feature_unavailable', 'This feature is available in demo mode only.') }
  const sc = (s: Scenario) => new URLSearchParams({ delta_t_c: String(s.delta_t_c), delta_p_pct: String(s.delta_p_pct) })
  const conversations = new Map<string, string>()
  const keyFor = (fieldId: string | null) => `fs-conversation:${base}:${clientId()}:${fieldId ?? '_'}`
  function conversation(fieldId: string | null) {
    const key = keyFor(fieldId)
    try { return localStorage.getItem(key) ?? conversations.get(key) } catch { return conversations.get(key) }
  }
  function remember(fieldId: string | null, id: string) {
    conversations.set(keyFor(fieldId), id)
    try { localStorage.setItem(keyFor(fieldId), id) } catch { /* In-memory fallback. */ }
  }
  function forget(fieldId: string | null) {
    conversations.delete(keyFor(fieldId))
    try { localStorage.removeItem(keyFor(fieldId)) } catch { /* In-memory fallback. */ }
  }
  return {
    mode: 'live',
    listFields: async () => (await req<B['Field'][]>('/fields')).map(fieldFromBackend),
    getField: async (id) => fieldFromBackend(await req(`/fields/${id}`)),
    createField: async (input) => fieldFromBackend(await req('/fields', { method: 'POST', body: JSON.stringify(input satisfies B['FieldCreate']) })),
    updateField: async (id, patch) => fieldFromBackend(await req(`/fields/${id}`, { method: 'PATCH', body: JSON.stringify(patch) })),
    deleteField: (id) => req(`/fields/${id}`, { method: 'DELETE' }),
    getProfile: async (id) => profileFromBackend(await req(`/fields/${id}/profile`)),
    getCrops: async () => (await req<B['Crop'][]>('/crops')).map(cropFromBackend),
    getSources: async () => (await req<B['Source'][]>('/sources')).map(sourceFromBackend),
    getSuitabilityMatrix: (id, s) => req<B['SuitabilityMatrix']>(`/fields/${id}/suitability?${sc(s)}`),
    getSuitability: (id, crop, month, s) => req<B['SuitabilityDetail']>(`/fields/${id}/suitability?crop_id=${encodeURIComponent(crop)}&planting_month=${month}&${sc(s)}`),
    getRotations: (id, body) => req<B['RotationResponse']>(`/fields/${id}/rotations`, { method: 'POST', body: JSON.stringify(body) }),
    getGreenhouse: async (id) => greenhouseFromBackend(await req(`/fields/${id}/greenhouse`)),
    getWaterQuality: unavailable, predictYield: unavailable, saveSoilLab: unavailable, getFutureClimate: unavailable,
    async extractSoilReport(id, file) {
      if (file.size > 10 * 1024 * 1024) throw new ApiError(413, 'file_too_large', 'Choose a file no larger than 10 MB.')
      if (!/\.(pdf|jpe?g|png)$/i.test(file.name)) throw new ApiError(415, 'unsupported_file_type', 'Choose a PDF, JPG or PNG file.')
      const form = new FormData()
      form.append('file', file)
      const res = await fetch(`${base}/fields/${id}/soil-report`, { method: 'POST', body: form, headers: { 'X-Client-Id': clientId(), 'Accept-Language': 'en' } })
      if (!res.ok) throw await responseError(res)
      return soilReportFromBackend(await res.json() as B['SoilReportResult'])
    },
    newConversation: forget,
    async getChatHistory(fieldId, signal) {
      const id = conversation(fieldId)
      if (!id) return null
      try { return await req<ConversationHistory>(`/chat/conversations/${id}`, { signal }) }
      catch (error) {
        if (error instanceof ApiError && error.status === 404) { forget(fieldId); return null }
        throw error
      }
    },
    async chat(fieldId, content, onEvent, signal) {
      let id = conversation(fieldId)
      if (!id) {
        const created = await req<B['Conversation']>('/chat/conversations', { method: 'POST', body: JSON.stringify({ field_id: fieldId } satisfies B['ConversationCreate']), signal })
        id = created.conversation_id
        remember(fieldId, id)
      }
      const res = await fetch(`${base}/chat/conversations/${id}/messages`, {
        method: 'POST', headers: { ...headers(), Accept: 'text/event-stream' },
        body: JSON.stringify({ text: content, field_id: fieldId } satisfies B['MessageCreate']), signal,
      })
      if (!res.ok) throw await responseError(res)
      if (!res.body) throw new ApiError(502, 'stream_unavailable', 'The response stream is unavailable.')
      await readChatStream(res.body, onEvent)
    },
  }
}
