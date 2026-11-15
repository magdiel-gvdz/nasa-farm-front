// Agrónomo de demostración: sin LLM. Responde con reglas sobre los mismos
// datos y motores, emitiendo los mismos eventos SSE que el backend real
// (status → tool → text → citation → done) para que la UI sea idéntica.

import type { ChatEvent, Field, FieldProfile, FutureClimate, RotationResponse, Scenario, SuitabilityDetail } from './types'
import { CROP_BY_ID, findCropInText } from './engine/crops'
import { interpret, LAB_PARAMS } from '@/lib/soil-lab'

export interface ChatDeps {
  field: Field | null
  profile: FieldProfile | null
  /** Sin escenario = clima actual. */
  evaluate: (cropId: string, month: number, scenario?: Scenario) => SuitabilityDetail
  rotations: (scenario?: Scenario) => RotationResponse
  future: () => Promise<FutureClimate>
}

const sg = (x: number, d = 0) => `${x > 0 ? '+' : x < 0 ? '−' : ''}${Math.abs(x).toFixed(d)}`
const FUTURE_WORDS = ['future', '2040', '2050', '2035', '2030', 'climate change', 'warming', 'projection', 'coming years', 'long term', 'in a few years']

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const dEs = (mmdd?: string | null) => {
  if (!mmdd) return '—'
  const [m, d] = mmdd.split('-').map(Number)
  return `${MONTHS[m - 1]} ${d}`
}
const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((res, rej) => {
    const t = setTimeout(res, ms)
    signal?.addEventListener('abort', () => {
      clearTimeout(t)
      rej(new DOMException('aborted', 'AbortError'))
    })
  })

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

const findCrop = findCropInText

function findMonth(q: string) {
  const n = norm(q)
  const i = MONTHS.findIndex((m) => n.includes(m.toLowerCase()))
  return i >= 0 ? i + 1 : null
}

function soilCitation(p: FieldProfile) {
  return { source_id: p.soil.source_id, label: p.soil.lab ? 'Your laboratory analysis' : p.soil.source_id === 'ssurgo' ? 'USDA SSURGO' : 'SoilGrids 250 m' }
}

function futureCitation(f: FutureClimate) {
  return { source_id: f.source_id, label: `${f.dataset.split(' (')[0]} ${f.period[0]}–${f.period[1]}` }
}

interface Plan {
  tools: { name: string; label: string }[]
  text: string
  citations: { source_id: string; label: string }[]
  card?: { card: 'suitability' | 'rotations'; payload: unknown }
}

async function tryFuture(d: ChatDeps): Promise<FutureClimate | null> {
  try {
    return await d.future()
  } catch {
    return null
  }
}

async function answer(q: string, d: ChatDeps): Promise<Plan> {
  const n = norm(q)
  const p = d.profile
  if (!d.field || !p) {
    return {
      tools: [{ name: 'list_user_fields', label: 'Searching for your fields' }],
      text: 'To give you answers with data I need a field. Draw your land on the map or open one of the examples (Saltillo, Arteaga or Nevada) and ask me again.',
      citations: [],
    }
  }
  const c = p.climate
  const fr = c.frost
  const power = { source_id: 'nasa_power', label: `NASA POWER ${c.years[0]}–${c.years[1]}` }
  const crop = findCrop(q)

  if (crop && crop.perennial) {
    const month = findMonth(q)
    const months = month ? [month] : Array.from({ length: 12 }, (_, i) => i + 1)
    const best = months.map((m) => d.evaluate(crop.id, m)).reduce((a, b) => (b.score > a.score ? b : a))
    const per = best.perennial!
    const verdict = best.status === 'suitable' ? 'is good' : best.status === 'marginal' ? 'you can, with risks' : 'is not recommended'
    const icon = (st: string) => (st === 'ok' ? '✅' : st === 'warn' ? '⚠️' : '⛔')
    let text = `**${crop.name.en}** in ${d.field.name}: **${verdict}** (${best.score}/100).\n\nIt is a perennial crop: it is planted once${crop.plant_months ? ` (best in ${crop.plant_months.map((m) => MONTHS[m - 1]).join(', ')})` : ''}, produces its first harvest in **year ${per.years_to_first_harvest}** and is harvested from ${MONTHS[per.harvest_months[0] - 1]} to ${MONTHS[per.harvest_months[1] - 1]}. That is why the weather throughout the year matters, not just that of a season:\n\n${best.reasons.map((r) => `- ${icon(r.status)} ${r.detail}`).join('\n')}`
    const fut = await tryFuture(d)
    if (fut) {
      const later = d.evaluate(crop.id, best.planting_month, fut.scenario)
      const chillNow = per.chill_hours_est
      const chillLater = later.perennial?.chill_hours_est
      text += `\n\n**Thinking about ${fut.period[1]}** (a tree lives 20–30 years): with ${sg(fut.scenario.delta_t_c, 1)} °C would remain at ${later.score}/100.${chillNow != null && chillLater != null ? ` Chill hours would drop from ~${chillNow} to ~${chillLater}${crop.chill_hours && chillLater < crop.chill_hours[1] ? ': choose varieties with low chilling requirements now' : ''}.` : ''}`
    }
    text += '\n\nThe variety, the rootstock and the microclimate of your orchard greatly change the result: check it with your agronomist or with producers in the area.'
    return {
      tools: [
        { name: 'get_field_profile', label: 'Reviewing winters, frosts and heat' },
        { name: 'evaluate_crop', label: `Evaluating ${crop.name.en.toLowerCase()}` },
        ...(fut ? [{ name: 'get_future_climate', label: 'Reviewing the climate of the coming decades' }] : []),
      ],
      text,
      citations: [power, soilCitation(p), ...(fut ? [futureCitation(fut)] : [])],
      card: { card: 'suitability', payload: best },
    }
  }

  if (crop) {
    const month = findMonth(q)
    const months = month ? [month] : Array.from({ length: 12 }, (_, i) => i + 1)
    const evals = months.map((m) => d.evaluate(crop.id, m))
    const best = evals.reduce((a, b) => (b.score > a.score ? b : a))
    const good = evals.filter((e) => e.status === 'suitable').map((e) => MONTHS[e.planting_month - 1])
    const issues = best.reasons.filter((r) => r.status !== 'ok').map((r) => `- ${r.detail}`)
    const text = month
      ? `Planting **${crop.name.en.toLowerCase()} in ${MONTHS[month - 1]}** in ${d.field.name} is **${best.status === 'suitable' ? 'suitable' : best.status === 'marginal' ? 'with risks' : 'not recommended'}** (${best.score}/100).\n\n${best.reasons.map((r) => `- ${r.status === 'ok' ? '✅' : r.status === 'warn' ? '⚠️' : '⛔'} ${r.detail}`).join('\n')}\n\nYou would harvest between the ${dEs(best.harvest_window.from)} and the ${dEs(best.harvest_window.to)}.`
      : `Best time to sow **${crop.name.en.toLowerCase()}** is **${MONTHS[best.planting_month - 1]}** (${best.score}/100).${good.length > 1 ? ` Also works on: ${good.join(', ')}.` : ''}\n\n${issues.length ? `What to take care of:\n${issues.join('\n')}` : 'I don\'t see strong risks on that date.'}\n\nThe last frost usually falls on ${dEs(fr.last_spring_frost.p50?.date)}, and 9 out of 10 years before ${dEs(fr.last_spring_frost.p90?.date)}.`
    const fut = await tryFuture(d)
    let futureText = ''
    if (fut) {
      const later = d.evaluate(crop.id, best.planting_month, fut.scenario)
      const diff = later.score - best.score
      futureText = `\n\n**By ${fut.period[0]}–${fut.period[1]}** (${sg(fut.scenario.delta_t_c, 1)} °C, rain ${sg(fut.scenario.delta_p_pct)} %), that same date would be in ${later.score}/100${Math.abs(diff) < 3 ? ': practically the same.' : diff > 0 ? ` (improves by ${diff} points).` : ` (drops by ${-diff} points${later.reasons.find((r) => r.status !== 'ok') ? `: ${later.reasons.find((r) => r.status !== 'ok')!.detail.toLowerCase()}` : ''}).`}`
    }
    return {
      tools: [
        { name: 'get_risk_calendar', label: 'Checking frost and heat' },
        { name: 'evaluate_crop', label: `Evaluating ${crop.name.en.toLowerCase()}` },
        ...(fut ? [{ name: 'get_future_climate', label: 'Reviewing Projected Climate' }] : []),
      ],
      text: text + futureText,
      citations: [power, soilCitation(p), ...(fut ? [futureCitation(fut)] : [])],
      card: { card: 'suitability', payload: best },
    }
  }

  if (FUTURE_WORDS.some((w) => n.includes(w))) {
    const fut = await tryFuture(d)
    if (!fut) {
      return { tools: [{ name: 'get_future_climate', label: 'Searching for climate projections' }], text: 'I was unable to download the climate projections at this time. Try again in a minute.', citations: [] }
    }
    const sc = fut.scenario
    const crops = [...new Set((d.field.current_rotation ?? []).map((r) => r.crop_id).filter((x): x is string => !!x))]
    const lines = crops.map((id) => {
      const months = Array.from({ length: 12 }, (_, i) => i + 1)
      const now = months.map((m) => d.evaluate(id, m)).reduce((a, b) => (b.score > a.score ? b : a))
      const later = d.evaluate(id, now.planting_month, sc)
      const bestLater = months.map((m) => d.evaluate(id, m, sc)).reduce((a, b) => (b.score > a.score ? b : a))
      const name = CROP_BY_ID.get(id)?.name.en ?? id
      const shift = bestLater.planting_month !== now.planting_month && bestLater.score - later.score >= 5 ? ` It is advisable to move sowing to **${MONTHS[bestLater.planting_month - 1]}** (${bestLater.score}/100).` : ''
      return `- **${name}** sown in ${MONTHS[now.planting_month - 1]}: ${now.score} → ${later.score}/100.${shift}`
    })
    const rotNow = d.rotations()
    const rotLater = d.rotations(sc)
    const bestNow = rotNow.strategies.find((x) => x.id === rotNow.recommended_id)!
    const bestLater = rotLater.strategies.find((x) => x.id === rotLater.recommended_id)!
    const fr = c.frost
    return {
      tools: [
        { name: 'get_future_climate', label: `Consulting ${fut.models.length} climate models` },
        { name: 'run_scenario', label: 'Recalculating crops with future climate' },
        { name: 'compare_rotations', label: 'Comparing rotations' },
      ],
      text: `For **${fut.period[0]}–${fut.period[1]}** models project for ${d.field.name}:\n\n- Temperature: **${sg(fut.median.delta_t_c, 1)} °C** (between ${sg(fut.range.delta_t_c[0], 1)} and ${sg(fut.range.delta_t_c[1], 1)}).\n- Rain: **${sg(fut.median.delta_p_pct)} %** (between ${sg(fut.range.delta_p_pct[0])} and ${sg(fut.range.delta_p_pct[1])} %). ${fut.note}\n- Frost: ${sg(fut.median.delta_frost_days)} days per year; days above 35 °C: ${sg(fut.median.delta_days_over_35c)}.${fr.last_spring_frost.p50 ? ` Today the typical last frost is the ${dEs(fr.last_spring_frost.p50.date)}; With less frost it will tend to come sooner, but late frosts do not disappear.` : ''}\n\n${lines.length ? `What you plant today, with that weather (current best date):\n${lines.join('\n')}\n\n` : ''}${bestLater.id === bestNow.id ? `The rotation that best suits you **remains ${bestNow.name}** (${bestNow.scores.overall} → ${bestLater.scores.overall}/100).` : `Recommended rotation **changes ${bestNow.name} to ${bestLater.name}** (${bestLater.scores.overall}/100): ${bestLater.why[0]?.toLowerCase() ?? ''}`}\n\nThis is a 20-year trend, not a forecast. Use it to decide long-term investments (irrigation, perennial crops, varieties) and review it with your agronomist.`,
      citations: [power, futureCitation(fut)],
      card: { card: 'rotations', payload: bestLater },
    }
  }

  if (n.includes('cold') || n.includes('freez') || n.includes('frost')) {
    const worst = [...fr.by_month].sort((a, b) => (b.prob_any_frost ?? 0) - (a.prob_any_frost ?? 0)).filter((m) => (m.prob_any_frost ?? 0) > 0.1)
    return {
      tools: [{ name: 'get_field_profile', label: 'Consulting 35 years of temperatures' }],
      text: `In ${d.field.name} frost goes from **${dEs(fr.first_fall_frost.p50?.date)}** to **${dEs(fr.last_spring_frost.p50?.date)}** in a typical year.\n\n- To play it safe, plant sensitive crops **after ${dEs(fr.last_spring_frost.p90?.date)}** (9 out of 10 years it no longer froze).\n- An early frost may arrive from **${dEs(fr.first_fall_frost.p10?.date)}** (1 in 10 years).\n- Months with more risk: ${worst.map((m) => `${MONTHS[m.month - 1]} (${Math.round((m.prob_any_frost ?? 0) * 100)} % of years)`).join(', ')}.\n\nNote: we measure the air at 2 m; At ground level and in shallows it can freeze at 2–3 °C.`,
      citations: [power],
    }
  }

  if (n.includes('rain') || n.includes('precipitation')) {
    const r = c.rain
    return {
      tools: [{ name: 'get_climate_stat', label: 'Analyzing the rainy season' }],
      text: `It rains on average **${r.annual_mean_mm} mm per year** (one dry year ~${r.annual_p20_mm} mm, one wet ~${r.annual_p80_mm} mm). The strong season is **${r.rainy_months.map((m) => MONTHS[m - 1]).join(', ')}**.\n\nThere is ~${r.days_per_year_over_25mm} days a year with downpours of more than 25 mm: that is when bare soil erodes the most.${r.trend_mm_per_decade != null ? `\n\nTrend: ${r.trend_mm_per_decade > 0 ? '+' : ''}${r.trend_mm_per_decade} mm per decade.` : ''}`,
      citations: [power],
    }
  }

  if (n.includes('heat') || n.includes('temperature') || n.includes('hot')) {
    const h = c.heat
    const hot = h.by_month[h.hottest_month - 1]
    return {
      tools: [{ name: 'get_climate_stat', label: 'Reviewing heat waves' }],
      text: `The hottest month is **${MONTHS[h.hottest_month - 1]}**, with average maximums of ${hot.mean_tmax_c} °C and ~${hot.mean_days_over_35c} days above 35 °C.\n\nIf the flowering of your crop falls there, the grain or fruit set may fail. The average temperature rises ${h.trend_c_per_decade ?? 0} °C per decade in this area.`,
      citations: [power],
    }
  }

  if (n.includes('wind') || n.includes('greenhouse') || n.includes('structure')) {
    const w = c.wind
    const rl = w.return_levels_kmh
    const rated = d.field.greenhouse?.rated_wind_kmh
    return {
      tools: [{ name: 'get_greenhouse_risk', label: 'Calculating extreme winds' }],
      text: `The windiest months are around **${MONTHS[w.windiest_month - 1]}**. Estimated Gusts:\n\n${rl.map((l) => `- Each ${l.return_period_years} years: ~${Math.round(l.estimated_gust_kmh ?? 0)} km/h`).join('\n')}\n\n${rated ? `Your structure is declared for ${rated} km/h, ${rated < (rl[0]?.estimated_gust_kmh ?? 0) ? '**below** the 10-year gust: it is advisable to reinforce anchors.' : 'above the typical 10-year gust.'}` : 'If you tell me how many km/h your structure is designed for, I\'ll tell you how often it could be exceeded.'}\n\nThis is an estimate at ~50 km resolution; Hills and ravines can accelerate the wind.`,
      citations: [power, { source_id: 'era5', label: 'ERA5 (coming soon)' }],
    }
  }

  if (n.includes('cattle') || n.includes('cow') || n.includes('livestock') || n.includes('well') || n.includes('hardness') || n.includes('water quality') || n.includes('scale')) {
    return {
      tools: [{ name: 'get_water_quality', label: 'Finding the nearest water station' }],
      text: 'Open the **Water** tab to see the full quality assessment. In summary: if the water is very hard (a lot of calcium and magnesium) it is not toxic, but it forms scale in water troughs and pipes and the livestock can drink less. What needs to be monitored the most for cattle are **sulfates** (above ~500 mg/L) and **total salts**. Confirm this with an analysis of your well and with your veterinarian.',
      citations: [{ source_id: 'conagua_renameca', label: 'CONAGUA water quality' }],
    }
  }

  if (n.includes('soil') || n.includes('organic matter') || n.includes('nutrient') || n.includes('nitrog') || n.includes('ph') || n.includes('phosphor') || n.includes('potassium') || n.includes('analysis')) {
    const l = p.soil.layers[0]
    const lab = p.soil.lab
    if (lab) {
      const rows = LAB_PARAMS.filter((x) => lab[x.key] != null).map((x) => {
        const band = interpret(x, lab[x.key])
        return `- ${x.name}: **${lab[x.key]} ${x.unit}**${band ? ` (${band.label.toLowerCase()})` : ''}${band && x.advice?.[band.level] ? `. ${x.advice[band.level]}` : ''}`
      })
      return {
        tools: [{ name: 'get_soil', label: 'Reading your lab analysis' }],
        text: `According to your analysis${lab.lab_name ? ` of ${lab.lab_name}` : ''}${lab.sample_date ? ` (${lab.sample_date})` : ''}, your soil is **${p.soil.texture_class}**:\n\n${rows.join('\n')}\n\nWith these values I already recalculated the crop suitability and rotations. The exact doses of fertilizer depend on the crop and the yield you are looking for: check them with your agronomist.`,
        citations: [soilCitation(p)],
      }
    }
    return {
      tools: [{ name: 'get_soil', label: 'Reading the soil profile' }],
      text: `Your soil is **${p.soil.texture_class}**, with pH ${l.ph} and organic matter ~${l.om_pct} %. ${(l.om_pct ?? 0) < 2 ? 'It is low: rotations with legumes, soil cover and leaving stubble can increase it little by little.' : 'This is an acceptable level; keep it covered.'}\n\nNitrogen, phosphorus and potassium **cannot be seen from the satellite**: upload your lab analysis in the **Soil** tab and I adjust the recommendations.`,
      citations: [soilCitation(p)],
    }
  }

  if (n.includes('rotation') || n.includes('what should i plant') || n.includes('what to plant') || n.includes('recommend') || n.includes('best for me')) {
    const rot = d.rotations()
    const best = rot.strategies.find((s) => s.id === rot.recommended_id)!
    return {
      tools: [{ name: 'compare_rotations', label: 'Comparing rotations' }],
      text: `I compared ${rot.strategies.length} options with your priorities. The one that comes out the best is **${best.name}** (${best.scores.overall}/100).\n\n${best.why[0]}\n\n${best.benefits.map((b) => `- ${b}`).join('\n')}\n\nReview it with your agronomist: ${best.risks_local_review[0]?.toLowerCase()}.`,
      citations: [power, { source_id: p.vegetation.source_id, label: 'MODIS NDVI' }],
      card: { card: 'rotations', payload: best },
    }
  }

  return {
    tools: [],
    text: `I can help you with your field **${d.field.name}**. Try asking me:\n\n- When do I plant beans?\n- How much risk of frost is there?\n- Which rotation is best for me?\n- Can my greenhouse withstand the wind?\n- How is my soil?\n- How will the climate change by 2040?`,
    citations: [],
  }
}

export async function mockChat(q: string, deps: ChatDeps, onEvent: (e: ChatEvent) => void, signal?: AbortSignal) {
  onEvent({ type: 'status', state: 'thinking' })
  await sleep(450, signal)
  const plan = await answer(q, deps)
  for (const t of plan.tools) {
    onEvent({ type: 'tool', name: t.name, state: 'running', label: t.label })
    await sleep(550, signal)
    onEvent({ type: 'tool', name: t.name, state: 'done', label: t.label })
  }
  const tokens = plan.text.match(/\S+\s*/g) ?? [plan.text]
  for (let i = 0; i < tokens.length; i += 2) {
    onEvent({ type: 'text', delta: tokens.slice(i, i + 2).join('') })
    await sleep(28, signal)
  }
  if (plan.card) onEvent({ type: 'card', card: plan.card.card, payload: plan.card.payload })
  for (const c of plan.citations) onEvent({ type: 'citation', ...c })
  onEvent({ type: 'done', message_id: crypto.randomUUID() })
}
