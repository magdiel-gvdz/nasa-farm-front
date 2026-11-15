import { expect, test, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { env } from 'node:process'

const fixture = (name: string) => JSON.parse(readFileSync(new URL(`../fixtures/${name}.json`, import.meta.url), 'utf8'))
const api = 'https://na-80276c48174345cab83857032d88d2ac.ecs.us-east-1.on.aws'

async function setup(page: Page, sparse = false) {
  let field = fixture('create-field')
  const crops = fixture('catalog')
  const profile = fixture('profile')
  const calls: { path: string; method: string; body: Record<string, unknown> | null }[] = []
  if (sparse) {
    profile.soil = null; profile.vegetation = null; profile.terrain = null
    profile.climate.wind = null
    profile.climate.frost.last_spring_frost = null
    profile.climate.frost.first_fall_frost = null
    profile.climate.frost.frost_free_days = null
    profile.water.soil_moisture = null
  }
  await page.route(`${api}/api/v1/**`, async (route) => {
    const req = route.request()
    const url = new URL(req.url())
    const path = url.pathname.replace('/api/v1', '')
    const body = req.headers()['content-type']?.includes('application/json') && req.postData() ? req.postDataJSON() : null
    calls.push({ path, method: req.method(), body })
    let result: unknown
    if (path === '/crops') result = crops
    else if (path === '/sources') result = profile.sources
    else if (path === '/fields') result = [field]
    else if (path === '/fields/fld_test' && req.method() === 'PATCH') { field = { ...field, ...body }; result = field }
    else if (path === '/fields/fld_test') result = field
    else if (path.endsWith('/profile')) result = profile
    else if (path.endsWith('/suitability')) result = url.searchParams.has('crop_id') ? fixture('suitability') : { months: Array.from({ length: 12 }, (_, i) => i + 1), crops: crops.map((c: { id: string }) => ({ crop_id: c.id, scores: Array(12).fill(72), status: Array(12).fill('suitable') })), scenario: { delta_t_c: 0, delta_p_pct: 0, daily_origin: null, not_recomputed: [], note: null } }
    else if (path.endsWith('/rotations')) result = fixture('rotations')
    else if (path.endsWith('/soil-report')) {
      if (profile.soil) profile.soil.lab = { lab: 'Example laboratory', ph: 7.1, n_mg_kg: 42 }
      result = { field_id: field.id, applied: true, extracted: { lab: 'Example laboratory', ph: 7.1, n_mg_kg: 42 }, unreadable_fields: [] }
    }
    else if (path === '/chat/conversations') result = { conversation_id: 'conv_test' }
    else if (path.endsWith('/messages')) {
      await route.fulfill({ contentType: 'text/event-stream', body: 'event: tool\ndata: {"name":"compare_rotations","state":"failed","label":"Comparing"}\n\nevent: text\ndata: {"delta":"Your zonal assessment is available."}\n\nevent: done\ndata: {"message_id":"m1"}\n\n' }); return
    }
    else if (path === '/chat/conversations/conv_test') result = { conversation_id: 'conv_test', field_id: field.id, messages: [{ role: 'assistant', text: 'Restored from server history', message_id: 'm1', created_at: '2026-11-15T00:00:00Z', status: 'done', citations: [], cards: [{ type: 'rotations', payload: fixture('rotations') }] }] }
    else { await route.fulfill({ status: 404, json: { error: { code: 'not_found', message: `Unexpected route ${path}`, details: {} } } }); return }
    await route.fulfill({ json: result })
  })
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  return { calls, errors }
}

test('renders sparse profiles, 36 decadal periods and the server catalog', async ({ page }) => {
  const { calls, errors } = await setup(page, true)
  await page.goto('/parcela/fld_test')
  await expect(page.getByText('Zonal analysis:', { exact: false })).toBeVisible()
  await expect(page.getByText('No groundwater source available')).toBeVisible()
  await page.getByRole('button', { name: 'Calendar', exact: true }).click()
  await expect(page.getByRole('button', { name: /10-day period of.*: Frost / })).toHaveCount(36)
  await expect(page.getByText('Frost dates are unavailable', { exact: false })).toBeVisible()
  await page.getByRole('button', { name: 'What to plant?', exact: true }).click()
  await expect(page.getByRole('row', { name: /Forage oat/ })).toBeVisible()
  await page.getByPlaceholder(/Search|Busca|crops|cultivos/i).fill('oat')
  await expect(page.getByRole('row', { name: /Forage oat/ })).toBeVisible()
  await page.getByRole('button', { name: 'Water', exact: true }).click()
  await expect(page.getByText('No soil moisture data available.')).toBeVisible()
  expect(calls.some((c) => /future-climate|predict-yield|water-quality|profile:refresh|soil-lab/.test(c.path))).toBe(false)
  expect(errors).toEqual([])
})

test('compares rotations with constraints and saves field settings', async ({ page }) => {
  const { calls, errors } = await setup(page)
  await page.goto('/parcela/fld_test?tab=rotaciones')
  await expect(page.getByText('Erosion exposure index').first()).toBeVisible()
  await page.getByLabel('Irrigation budget', { exact: true }).fill('250')
  await page.getByText('Exclude crops (0)', { exact: true }).click()
  await page.getByLabel('Maize', { exact: true }).check()
  await expect.poll(() => calls.filter((c) => c.path.endsWith('/rotations')).at(-1)?.body).toMatchObject({ constraints: { irrigation_mm_per_year: 250, exclude_crops: ['maiz'] } })
  await page.getByRole('button', { name: 'Edit field', exact: true }).click()
  await page.getByLabel('Name', { exact: true }).fill('Updated field')
  await page.getByRole('button', { name: 'Save field', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Updated field', exact: true })).toBeVisible()
  expect(calls.find((c) => c.method === 'PATCH')?.body).not.toHaveProperty('kind')
  expect(errors).toEqual([])
})

test('uploads and applies a soil report without a second save request', async ({ page }) => {
  const { calls, errors } = await setup(page)
  await page.goto('/parcela/fld_test?tab=suelo')
  await page.getByLabel('Soil report file').setInputFiles({ name: 'soil.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-test') })
  await expect(page.getByText('Accepted values were saved', { exact: false })).toBeVisible()
  await expect(page.getByText('Example laboratory', { exact: false })).toBeVisible()
  expect(calls.some((c) => c.path.endsWith('/soil-lab'))).toBe(false)
  expect(errors).toEqual([])
})

test('streams chat, shows tool failures and restores full rotation cards after reload', async ({ page }) => {
  const { calls, errors } = await setup(page)
  await page.goto('/parcela/fld_test')
  await page.getByRole('button', { name: 'Ask the agronomist', exact: true }).click()
  await page.getByPlaceholder('Write your question…').fill('Compare rotations')
  await page.getByRole('button', { name: 'Send', exact: true }).click()
  await expect(page.getByText('Your zonal assessment is available.')).toBeVisible()
  await expect(page.getByText('Failed', { exact: true })).toBeVisible()
  expect(calls.find((c) => c.path.endsWith('/messages'))?.body).toEqual({ text: 'Compare rotations', field_id: 'fld_test' })
  await page.reload()
  await page.getByRole('button', { name: 'Ask the agronomist', exact: true }).click()
  await expect(page.getByText('Restored from server history')).toBeVisible()
  expect(errors).toEqual([])
})

test('live dev: loads a disposable field and its main tabs', async ({ page, request }) => {
  test.skip(env.LIVE_API_TEST !== '1', 'Opt-in live smoke test')
  const client = randomUUID()
  const headers = { 'X-Client-Id': client, 'Accept-Language': 'en' }
  const input = fixture('create-field')
  const response = await request.post(`${api}/api/v1/fields`, { headers, data: { name: 'Frontend browser validation', kind: input.kind, geometry: input.geometry, irrigation: input.irrigation, current_rotation: input.current_rotation } })
  expect(response.status()).toBe(201)
  const field = await response.json()
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  try {
    await page.addInitScript((id) => localStorage.setItem('fs-client-id', id), client)
    await page.goto(`/parcela/${field.id}`)
    await expect(page.getByRole('heading', { name: 'Frontend browser validation' })).toBeVisible()
    await expect(page.getByText('Zonal analysis:', { exact: false })).toBeVisible()
    await page.getByRole('button', { name: 'Calendar', exact: true }).click()
    await expect(page.getByRole('button', { name: /10-day period of.*: Frost / })).toHaveCount(36)
    await page.getByRole('button', { name: 'What to plant?', exact: true }).click()
    await expect(page.getByRole('row', { name: /Maize/ })).toBeVisible()
    await page.getByRole('button', { name: 'Rotations', exact: true }).click()
    await expect(page.getByText('Erosion exposure index').first()).toBeVisible()
    await page.getByRole('button', { name: 'Water', exact: true }).click()
    await expect(page.getByText('Monthly water balance')).toBeVisible()
    expect(errors).toEqual([])
    await expect(page.locator('.recharts-bar-rectangle path').first()).toBeVisible()
    await page.screenshot({ path: 'test-results/live-dev-water.png', fullPage: true })
  } finally {
    expect((await request.delete(`${api}/api/v1/fields/${field.id}`, { headers })).status()).toBe(204)
  }
})
