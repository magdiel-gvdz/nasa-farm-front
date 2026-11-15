// Agrónomo de demostración: sin LLM. Responde con reglas sobre los mismos
// datos y motores, emitiendo los mismos eventos SSE que el backend real
// (status → tool → text → citation → done) para que la UI sea idéntica.

import type { ChatEvent, Field, FieldProfile, FutureClimate, RotationResponse, Scenario, SuitabilityDetail } from '../types'
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
const FUTURE_WORDS = ['futur', '2040', '2050', '2035', '2030', 'cambio climatico', 'calentamiento', 'proyecc', 'proximos anos', 'dentro de', 'a largo plazo', 'en unos anos']

const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
const dEs = (mmdd?: string | null) => {
  if (!mmdd) return '—'
  const [m, d] = mmdd.split('-').map(Number)
  return `${d} de ${MONTHS[m - 1]}`
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
  const i = MONTHS.findIndex((m) => n.includes(m))
  return i >= 0 ? i + 1 : null
}

function soilCitation(p: FieldProfile) {
  return { source_id: p.soil.source_id, label: p.soil.lab ? 'Tu análisis de laboratorio' : p.soil.source_id === 'ssurgo' ? 'USDA SSURGO' : 'SoilGrids 250 m' }
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
      tools: [{ name: 'list_user_fields', label: 'Buscando tus parcelas' }],
      text: 'Para darte respuestas con datos necesito una parcela. Dibuja tu terreno en el mapa o abre uno de los ejemplos (Saltillo, Arteaga o Nevada) y vuelve a preguntarme.',
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
    const verdict = best.status === 'suitable' ? 'se da bien' : best.status === 'marginal' ? 'se puede, con riesgos' : 'no es recomendable'
    const icon = (st: string) => (st === 'ok' ? '✅' : st === 'warn' ? '⚠️' : '⛔')
    let text = `**${crop.name.es}** en ${d.field.name}: **${verdict}** (${best.score}/100).\n\nEs un cultivo perenne: se planta una vez${crop.plant_months ? ` (mejor en ${crop.plant_months.map((m) => MONTHS[m - 1]).join(', ')})` : ''}, da la primera cosecha al **año ${per.years_to_first_harvest}** y se cosecha de ${MONTHS[per.harvest_months[0] - 1]} a ${MONTHS[per.harvest_months[1] - 1]}. Por eso importa el clima de todo el año, no solo el de una temporada:\n\n${best.reasons.map((r) => `- ${icon(r.status)} ${r.detail}`).join('\n')}`
    const fut = await tryFuture(d)
    if (fut) {
      const later = d.evaluate(crop.id, best.planting_month, fut.scenario)
      const chillNow = per.chill_hours_est
      const chillLater = later.perennial?.chill_hours_est
      text += `\n\n**Pensando a ${fut.period[1]}** (un árbol vive 20–30 años): con ${sg(fut.scenario.delta_t_c, 1)} °C quedaría en ${later.score}/100.${chillNow != null && chillLater != null ? ` Las horas frío bajarían de ~${chillNow} a ~${chillLater}${crop.chill_hours && chillLater < crop.chill_hours[1] ? ': elige variedades de bajo requerimiento de frío desde ahora' : ''}.` : ''}`
    }
    text += '\n\nLa variedad, el portainjerto y el microclima de tu huerta cambian mucho el resultado: revísalo con tu agrónomo o con productores de la zona.'
    return {
      tools: [
        { name: 'get_field_profile', label: 'Revisando inviernos, heladas y calor' },
        { name: 'evaluate_crop', label: `Evaluando ${crop.name.es.toLowerCase()}` },
        ...(fut ? [{ name: 'get_future_climate', label: 'Revisando el clima de las próximas décadas' }] : []),
      ],
      text,
      citations: [power, soilCitation(p), ...(fut ? [futureCitation(fut)] : [])],
      card: { card: 'suitability', payload: best },
    }
  }

  if (crop && (n.includes('sembr') || n.includes('plant') || n.includes('cuando') || n.includes('puedo') || n.includes('se da') || n.includes('cultiv') || n.includes('conviene') || findMonth(q))) {
    const month = findMonth(q)
    const months = month ? [month] : Array.from({ length: 12 }, (_, i) => i + 1)
    const evals = months.map((m) => d.evaluate(crop.id, m))
    const best = evals.reduce((a, b) => (b.score > a.score ? b : a))
    const good = evals.filter((e) => e.status === 'suitable').map((e) => MONTHS[e.planting_month - 1])
    const issues = best.reasons.filter((r) => r.status !== 'ok').map((r) => `- ${r.detail}`)
    const text = month
      ? `Sembrar **${crop.name.es.toLowerCase()} en ${MONTHS[month - 1]}** en ${d.field.name} sale **${best.status === 'suitable' ? 'apto' : best.status === 'marginal' ? 'con riesgos' : 'no recomendable'}** (${best.score}/100).\n\n${best.reasons.map((r) => `- ${r.status === 'ok' ? '✅' : r.status === 'warn' ? '⚠️' : '⛔'} ${r.detail}`).join('\n')}\n\nCosecharías entre el ${dEs(best.harvest_window.from)} y el ${dEs(best.harvest_window.to)}.`
      : `El mejor momento para sembrar **${crop.name.es.toLowerCase()}** es **${MONTHS[best.planting_month - 1]}** (${best.score}/100).${good.length > 1 ? ` También funciona en: ${good.join(', ')}.` : ''}\n\n${issues.length ? `Lo que hay que cuidar:\n${issues.join('\n')}` : 'No veo riesgos fuertes en esa fecha.'}\n\nLa última helada suele caer el ${dEs(fr.last_spring_frost.p50?.date)}, y 9 de cada 10 años antes del ${dEs(fr.last_spring_frost.p90?.date)}.`
    const fut = await tryFuture(d)
    let futureText = ''
    if (fut) {
      const later = d.evaluate(crop.id, best.planting_month, fut.scenario)
      const diff = later.score - best.score
      futureText = `\n\n**Hacia ${fut.period[0]}–${fut.period[1]}** (${sg(fut.scenario.delta_t_c, 1)} °C, lluvia ${sg(fut.scenario.delta_p_pct)} %), esa misma fecha quedaría en ${later.score}/100${Math.abs(diff) < 3 ? ': prácticamente igual.' : diff > 0 ? ` (mejora ${diff} puntos).` : ` (baja ${-diff} puntos${later.reasons.find((r) => r.status !== 'ok') ? `: ${later.reasons.find((r) => r.status !== 'ok')!.detail.toLowerCase()}` : ''}).`}`
    }
    return {
      tools: [
        { name: 'get_risk_calendar', label: 'Revisando heladas y calor' },
        { name: 'evaluate_crop', label: `Evaluando ${crop.name.es.toLowerCase()}` },
        ...(fut ? [{ name: 'get_future_climate', label: 'Revisando el clima proyectado' }] : []),
      ],
      text: text + futureText,
      citations: [power, soilCitation(p), ...(fut ? [futureCitation(fut)] : [])],
      card: { card: 'suitability', payload: best },
    }
  }

  if (FUTURE_WORDS.some((w) => n.includes(w))) {
    const fut = await tryFuture(d)
    if (!fut) {
      return { tools: [{ name: 'get_future_climate', label: 'Buscando proyecciones climáticas' }], text: 'No pude descargar las proyecciones climáticas en este momento. Intenta de nuevo en un minuto.', citations: [] }
    }
    const sc = fut.scenario
    const crops = [...new Set((d.field.current_rotation ?? []).map((r) => r.crop_id).filter((x): x is string => !!x))]
    const lines = crops.map((id) => {
      const months = Array.from({ length: 12 }, (_, i) => i + 1)
      const now = months.map((m) => d.evaluate(id, m)).reduce((a, b) => (b.score > a.score ? b : a))
      const later = d.evaluate(id, now.planting_month, sc)
      const bestLater = months.map((m) => d.evaluate(id, m, sc)).reduce((a, b) => (b.score > a.score ? b : a))
      const name = CROP_BY_ID.get(id)?.name.es ?? id
      const shift = bestLater.planting_month !== now.planting_month && bestLater.score - later.score >= 5 ? ` Conviene mover la siembra a **${MONTHS[bestLater.planting_month - 1]}** (${bestLater.score}/100).` : ''
      return `- **${name}** sembrado en ${MONTHS[now.planting_month - 1]}: ${now.score} → ${later.score}/100.${shift}`
    })
    const rotNow = d.rotations()
    const rotLater = d.rotations(sc)
    const bestNow = rotNow.strategies.find((x) => x.id === rotNow.recommended_id)!
    const bestLater = rotLater.strategies.find((x) => x.id === rotLater.recommended_id)!
    const fr = c.frost
    return {
      tools: [
        { name: 'get_future_climate', label: `Consultando ${fut.models.length} modelos climáticos` },
        { name: 'run_scenario', label: 'Recalculando cultivos con el clima futuro' },
        { name: 'compare_rotations', label: 'Comparando rotaciones' },
      ],
      text: `Para **${fut.period[0]}–${fut.period[1]}** los modelos proyectan en ${d.field.name}:\n\n- Temperatura: **${sg(fut.median.delta_t_c, 1)} °C** (entre ${sg(fut.range.delta_t_c[0], 1)} y ${sg(fut.range.delta_t_c[1], 1)}).\n- Lluvia: **${sg(fut.median.delta_p_pct)} %** (entre ${sg(fut.range.delta_p_pct[0])} y ${sg(fut.range.delta_p_pct[1])} %). ${fut.note}\n- Heladas: ${sg(fut.median.delta_frost_days)} días al año; días sobre 35 °C: ${sg(fut.median.delta_days_over_35c)}.${fr.last_spring_frost.p50 ? ` Hoy la última helada típica es el ${dEs(fr.last_spring_frost.p50.date)}; con menos heladas tenderá a adelantarse, pero las heladas tardías no desaparecen.` : ''}\n\n${lines.length ? `Lo que siembras hoy, con ese clima (mejor fecha actual):\n${lines.join('\n')}\n\n` : ''}${bestLater.id === bestNow.id ? `La rotación que más te conviene **sigue siendo ${bestNow.name}** (${bestNow.scores.overall} → ${bestLater.scores.overall}/100).` : `La rotación recomendada **cambia de ${bestNow.name} a ${bestLater.name}** (${bestLater.scores.overall}/100): ${bestLater.why[0]?.toLowerCase() ?? ''}`}\n\nEs una tendencia de 20 años, no un pronóstico. Úsala para decidir inversiones de largo plazo (riego, cultivos perennes, variedades) y revísala con tu agrónomo.`,
      citations: [power, futureCitation(fut)],
      card: { card: 'rotations', payload: bestLater },
    }
  }

  if (n.includes('helad') || n.includes('frio') || n.includes('frost')) {
    const worst = [...fr.by_month].sort((a, b) => (b.prob_any_frost ?? 0) - (a.prob_any_frost ?? 0)).filter((m) => (m.prob_any_frost ?? 0) > 0.1)
    return {
      tools: [{ name: 'get_field_profile', label: 'Consultando 35 años de temperaturas' }],
      text: `En ${d.field.name} las heladas van de **${dEs(fr.first_fall_frost.p50?.date)}** a **${dEs(fr.last_spring_frost.p50?.date)}** en un año típico.\n\n- Para ir a la segura, siembra cultivos sensibles **después del ${dEs(fr.last_spring_frost.p90?.date)}** (9 de cada 10 años ya no heló).\n- Una helada temprana puede llegar desde el **${dEs(fr.first_fall_frost.p10?.date)}** (1 de cada 10 años).\n- Meses con más riesgo: ${worst.map((m) => `${MONTHS[m.month - 1]} (${Math.round((m.prob_any_frost ?? 0) * 100)} % de los años)`).join(', ')}.\n\nOjo: medimos el aire a 2 m; a ras de suelo y en los bajíos puede helar con 2–3 °C.`,
      citations: [power],
    }
  }

  if (n.includes('lluv') || n.includes('agua de temporal') || n.includes('rain') || n.includes('temporal')) {
    const r = c.rain
    return {
      tools: [{ name: 'get_climate_stat', label: 'Analizando la temporada de lluvias' }],
      text: `Llueven en promedio **${r.annual_mean_mm} mm al año** (un año seco ~${r.annual_p20_mm} mm, uno húmedo ~${r.annual_p80_mm} mm). La temporada fuerte es **${r.rainy_months.map((m) => MONTHS[m - 1]).join(', ')}**.\n\nHay ~${r.days_per_year_over_25mm} días al año con aguaceros de más de 25 mm: ahí es cuando más se erosiona el suelo desnudo.${r.trend_mm_per_decade != null ? `\n\nTendencia: ${r.trend_mm_per_decade > 0 ? '+' : ''}${r.trend_mm_per_decade} mm por década.` : ''}`,
      citations: [power],
    }
  }

  if (n.includes('calor') || n.includes('temperatura') || n.includes('heat')) {
    const h = c.heat
    const hot = h.by_month[h.hottest_month - 1]
    return {
      tools: [{ name: 'get_climate_stat', label: 'Revisando olas de calor' }],
      text: `El mes más caliente es **${MONTHS[h.hottest_month - 1]}**, con máximas promedio de ${hot.mean_tmax_c} °C y ~${hot.mean_days_over_35c} días por encima de 35 °C.\n\nSi la floración de tu cultivo cae ahí, puede fallar el amarre de grano o fruto. La temperatura media sube ${h.trend_c_per_decade ?? 0} °C por década en esta zona.`,
      citations: [power],
    }
  }

  if (n.includes('viento') || n.includes('invernadero') || n.includes('estructura') || n.includes('wind')) {
    const w = c.wind
    const rl = w.return_levels_kmh
    const rated = d.field.greenhouse?.rated_wind_kmh
    return {
      tools: [{ name: 'get_greenhouse_risk', label: 'Calculando vientos extremos' }],
      text: `Los meses con más viento son alrededor de **${MONTHS[w.windiest_month - 1]}**. Ráfagas estimadas:\n\n${rl.map((l) => `- Cada ${l.return_period_years} años: ~${Math.round(l.estimated_gust_kmh ?? 0)} km/h`).join('\n')}\n\n${rated ? `Tu estructura está declarada para ${rated} km/h, ${rated < (rl[0]?.estimated_gust_kmh ?? 0) ? '**por debajo** de la ráfaga de 10 años: conviene reforzar anclajes.' : 'por encima de la ráfaga típica de 10 años.'}` : 'Si me dices para cuántos km/h está diseñada tu estructura, te digo qué tan seguido podría superarse.'}\n\nEs una estimación a ~50 km de resolución; cerros y cañadas pueden acelerar el viento.`,
      citations: [power, { source_id: 'era5', label: 'ERA5 (próximamente)' }],
    }
  }

  if (n.includes('ganado') || n.includes('vaca') || n.includes('pozo') || n.includes('dureza') || n.includes('calidad del agua') || n.includes('sarro')) {
    return {
      tools: [{ name: 'get_water_quality', label: 'Buscando la estación de agua más cercana' }],
      text: 'Abre la pestaña **Agua** para ver el semáforo completo. En resumen: si el agua es muy dura (mucho calcio y magnesio) no es tóxica, pero forma sarro en bebederos y tuberías y el ganado puede tomar menos. Lo que más hay que vigilar para bovinos son los **sulfatos** (arriba de ~500 mg/L) y las **sales totales**. Confírmalo con un análisis de tu pozo y con tu veterinario.',
      citations: [{ source_id: 'conagua_renameca', label: 'CONAGUA calidad del agua' }],
    }
  }

  if (n.includes('suelo') || n.includes('materia organica') || n.includes('nutrient') || n.includes('nitrog') || n.includes('ph') || n.includes('fosforo') || n.includes('potasio') || n.includes('analisis')) {
    const l = p.soil.layers[0]
    const lab = p.soil.lab
    if (lab) {
      const rows = LAB_PARAMS.filter((x) => lab[x.key] != null).map((x) => {
        const band = interpret(x, lab[x.key])
        return `- ${x.name}: **${lab[x.key]} ${x.unit}**${band ? ` (${band.label.toLowerCase()})` : ''}${band && x.advice?.[band.level] ? `. ${x.advice[band.level]}` : ''}`
      })
      return {
        tools: [{ name: 'get_soil', label: 'Leyendo tu análisis de laboratorio' }],
        text: `Según tu análisis${lab.lab_name ? ` de ${lab.lab_name}` : ''}${lab.sample_date ? ` (${lab.sample_date})` : ''}, tu suelo es **${p.soil.texture_class}**:\n\n${rows.join('\n')}\n\nCon estos valores ya recalculé la aptitud de cultivos y las rotaciones. Las dosis exactas de fertilizante dependen del cultivo y del rendimiento que busques: revísalas con tu agrónomo.`,
        citations: [soilCitation(p)],
      }
    }
    return {
      tools: [{ name: 'get_soil', label: 'Leyendo el perfil de suelo' }],
      text: `Tu suelo es **${p.soil.texture_class}**, con pH ${l.ph} y materia orgánica de ~${l.om_pct} %. ${(l.om_pct ?? 0) < 2 ? 'Es baja: rotaciones con leguminosas, coberturas y dejar rastrojo la pueden subir poco a poco.' : 'Es un nivel aceptable; mantenla con coberturas.'}\n\nNitrógeno, fósforo y potasio **no se pueden ver desde el satélite**: sube tu análisis de laboratorio en la pestaña **Suelo** y ajusto las recomendaciones.`,
      citations: [soilCitation(p)],
    }
  }

  if (n.includes('rotac') || n.includes('que siembro') || n.includes('que sembrar') || n.includes('recomiend') || n.includes('conviene')) {
    const rot = d.rotations()
    const best = rot.strategies.find((s) => s.id === rot.recommended_id)!
    return {
      tools: [{ name: 'compare_rotations', label: 'Comparando rotaciones' }],
      text: `Comparé ${rot.strategies.length} opciones con tus prioridades. La que mejor sale es **${best.name}** (${best.scores.overall}/100).\n\n${best.why[0]}\n\n${best.benefits.map((b) => `- ${b}`).join('\n')}\n\nRevísala con tu agrónomo: ${best.risks_local_review[0]?.toLowerCase()}.`,
      citations: [power, { source_id: p.vegetation.source_id, label: 'MODIS NDVI' }],
      card: { card: 'rotations', payload: best },
    }
  }

  return {
    tools: [],
    text: `Puedo ayudarte con tu parcela **${d.field.name}**. Prueba preguntarme:\n\n- ¿Cuándo siembro frijol?\n- ¿Qué tanto riesgo de helada hay?\n- ¿Qué rotación me conviene?\n- ¿Aguanta mi invernadero el viento?\n- ¿Cómo está mi suelo?\n- ¿Cómo cambiará el clima hacia 2040?`,
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
