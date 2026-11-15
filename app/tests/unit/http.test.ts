import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { createHttpApi, readChatStream } from '../../src/api/http'
import type { ChatEvent } from '../../src/api/types'
import field from '../fixtures/create-field.json'
import profile from '../fixtures/profile.json'
import crops from '../fixtures/catalog.json'

const json = (value: unknown, status = 200, headers = {}) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json', ...headers } })
beforeEach(() => {
  const storage = new Map<string, string>()
  vi.stubGlobal('localStorage', { getItem: (k: string) => storage.get(k) ?? null, setItem: (k: string, v: string) => storage.set(k, v), removeItem: (k: string) => storage.delete(k) })
})
afterEach(() => vi.unstubAllGlobals())

describe('live API contract', () => {
  it('uses server crop IDs and agronomic parameters without a demo catalog', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json(crops)))
    const catalog = await createHttpApi('https://api.example/').getCrops()
    expect(catalog.map((c) => c.id)).toEqual(crops.map((c) => c.id))
    expect(catalog.find((c) => c.id === 'avena_forrajera')).toBeDefined()
    expect(catalog.find((c) => c.id === 'avena')).toBeUndefined()
    expect(catalog.every((c) => Array.isArray(c.aliases))).toBe(true)
    expect(catalog[0].water_need_mm).toEqual(crops[0].water_need_mm)
  })
  it('preserves missing sections, decadal risks and source provenance', async () => {
    const sparse = { ...profile, soil: null, vegetation: null, terrain: null, climate: { ...profile.climate, wind: null, light: null, frost: { ...profile.climate.frost, last_spring_frost: null, first_fall_frost: null, frost_free_days: null } } }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json(sparse)))
    const result = await createHttpApi('https://api.example/api/v1/').getProfile('fld_test')
    expect(result.status).toBe('ready')
    if (result.status !== 'ready') throw new Error('Expected synchronous profile')
    expect(result.soil).toBeNull()
    expect(result.water.groundwater).toBeNull()
    expect(result.climate.frost.last_spring_frost).toBeNull()
    expect(result.climate.risk_calendar).toHaveLength(36)
    expect(result.climate.risk_calendar[0].decade).toBe(1)
    expect(result.sources[0].dataset).toBe(profile.sources[0].name)
    expect(result.sources[0].data_class).toBe(profile.sources[0].data_class)
  })
  it('retains coverage details and retry headers in errors', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ error: { code: 'rate_limited', message: 'Wait', details: { reason: 'per_minute' } } }, 429, { 'Retry-After': '15' })))
    await expect(createHttpApi('https://api.example').listFields()).rejects.toMatchObject({ code: 'rate_limited', retryAfter: 15, details: { reason: 'per_minute' } })
  })
  it('sends text and field_id, persists the conversation and retrieves history', async () => {
    const stream = 'event: text\ndata: {"delta":"Hello"}\n\nevent: done\ndata: {"message_id":"m1"}\n\n'
    const fetcher = vi.fn().mockResolvedValueOnce(json({ conversation_id: 'conv_test' })).mockResolvedValueOnce(new Response(stream)).mockResolvedValueOnce(json({ conversation_id: 'conv_test', field_id: field.id, messages: [] }))
    vi.stubGlobal('fetch', fetcher)
    const api = createHttpApi('https://api.example')
    const events: ChatEvent[] = []
    await api.chat(field.id, 'Hello', (e) => events.push(e))
    expect(JSON.parse(fetcher.mock.calls[1][1].body)).toEqual({ text: 'Hello', field_id: field.id })
    expect(events.map((e) => e.type)).toEqual(['text', 'done'])
    await createHttpApi('https://api.example').getChatHistory?.(field.id)
    expect(fetcher.mock.calls[2][0]).toBe('https://api.example/api/v1/chat/conversations/conv_test')
    api.newConversation?.(field.id)
    expect(await api.getChatHistory?.(field.id)).toBeNull()
  })
  it('treats uploaded soil values as already saved and normalizes mg/kg', async () => {
    const fetcher = vi.fn().mockResolvedValue(json({ field_id: field.id, applied: true, extracted: { lab: 'Example lab', ph: 7.2, n_mg_kg: 24, p_mg_kg: 12, k_mg_kg: 300 }, unreadable_fields: [{ field: 'om_pct', reason: 'missing' }] }))
    vi.stubGlobal('fetch', fetcher)
    const result = await createHttpApi('https://api.example').extractSoilReport(field.id, new File(['%PDF-test'], 'soil.pdf', { type: 'application/pdf' }))
    expect(result.applied).toBe(true)
    expect(result.extracted).toMatchObject({ lab_name: 'Example lab', ph: 7.2, n_ppm: 24, p_ppm: 12, k_ppm: 300 })
    expect(result.unreadable_reasons).toEqual([{ field: 'om_pct', reason: 'missing' }])
    expect(fetcher.mock.calls[0][1].headers['Content-Type']).toBeUndefined()
  })
  it('does not request unsupported routes', async () => {
    const fetcher = vi.fn()
    vi.stubGlobal('fetch', fetcher)
    const api = createHttpApi('https://api.example')
    await expect(api.getFutureClimate(field.id)).rejects.toMatchObject({ code: 'feature_unavailable' })
    await expect(api.saveSoilLab(field.id, null)).rejects.toMatchObject({ code: 'feature_unavailable' })
    expect(fetcher).not.toHaveBeenCalled()
  })
  it('rejects oversized and unsupported soil files before uploading', async () => {
    const fetcher = vi.fn()
    vi.stubGlobal('fetch', fetcher)
    const api = createHttpApi('https://api.example')
    await expect(api.extractSoilReport(field.id, new File(['image'], 'soil.webp'))).rejects.toMatchObject({ code: 'unsupported_file_type' })
    const big = new File([new Uint8Array(10 * 1024 * 1024 + 1)], 'soil.pdf')
    await expect(api.extractSoilReport(field.id, big)).rejects.toMatchObject({ code: 'file_too_large' })
    expect(fetcher).not.toHaveBeenCalled()
  })
  it('keeps an unknown wind assessment and unsupported sections empty', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ field_id: field.id, cell_id: field.cell_id, structure: {}, confidence: 'low', gaps: [], recommendations: [], wind: { rated_wind_kmh: null, return_levels_kmh: null, status: null, annual_exceedance_probability: null, riskiest_months: [], note: 'No wind data', source_id: 'nasa_power', years_used: 0, gust_factor_assumed: 1.4, daily_origin: null } })))
    const result = await createHttpApi('https://api.example').getGreenhouse(field.id)
    expect(result.wind.status).toBeNull()
    expect(result.wind.return_levels_kmh).toBeNull()
    expect(result.light).toBeNull()
    expect(result.temperature).toBeNull()
    expect(result.co2).toBeNull()
  })
})

describe('SSE streaming', () => {
  it('handles byte boundaries, CRLF heartbeats, cards, tool failures and a final event without a blank line', async () => {
    const content = ': ping\r\n\r\nevent: tool\r\ndata: {"name":"evaluate_crop","state":"failed"}\r\n\r\nevent: card\r\ndata: {"type":"suitability_matrix","payload":{"crops":[]}}\r\n\r\nevent: text\r\ndata: {"delta":"Maíz 🌽"}\r\n\r\nevent: done\r\ndata: {"message_id":"m1"}'
    const bytes = new TextEncoder().encode(content)
    const body = new ReadableStream<Uint8Array>({ start(c) { for (const byte of bytes) c.enqueue(new Uint8Array([byte])); c.close() } })
    const events: ChatEvent[] = []
    await readChatStream(body, (e) => events.push(e))
    expect(events).toEqual([{ type: 'tool', name: 'evaluate_crop', state: 'failed' }, { type: 'card', card: 'suitability_matrix', payload: { crops: [] } }, { type: 'text', delta: 'Maíz 🌽' }, { type: 'done', message_id: 'm1' }])
  })
  it('reports an interrupted response instead of silently succeeding', async () => {
    await expect(readChatStream(new Response('event: text\ndata: {"delta":"Partial"}\n\n').body!, () => {})).rejects.toMatchObject({ code: 'stream_interrupted' })
  })
})
