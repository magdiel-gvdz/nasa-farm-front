import { useEffect, useState } from 'react'
import type { ProfileStep } from '@/api/types'

/** Stages of the live backend profile. The server answers in a single call, so progress is paced on the client. */
const LIVE_STEPS = ['locate', 'nasa_power', 'risk_calendar', 'soilgrids', 'copernicus_dem_glo90', 'water_balance', 'crops']
const TICK_MS = 450
const FINISH_STEP_MS = 140
const HOLD_MS = 450

/**
 * Progress of the loading screen between drawing the field and receiving its profile.
 * While waiting, steps advance with a decelerating pace and the last one waits for the real
 * response. When the data arrives the remaining steps complete quickly, all of them are shown
 * as done for a moment, and only then `settling` turns false so the tabs can appear.
 * A profile already in cache (ready on the first render) skips the screen entirely.
 */
export function useLiveProcessing(ready: boolean, key: string) {
  const [tick, setTick] = useState(0)
  const [extra, setExtra] = useState(0)
  const [prev, setPrev] = useState({ ready, key })
  const [settling, setSettling] = useState(false)

  // Adjust state while rendering when the field or the readiness changes.
  if (prev.key !== key || prev.ready !== ready) {
    const sameField = prev.key === key
    setPrev({ ready, key })
    if (!sameField) setTick(0)
    setExtra(0)
    setSettling(sameField && ready && !prev.ready)
  }

  const base = Math.min(LIVE_STEPS.length - 1, Math.floor(Math.sqrt(tick * 1.6)))
  const finished = ready ? (settling ? Math.min(LIVE_STEPS.length, base + extra) : LIVE_STEPS.length) : base

  useEffect(() => {
    if (ready) return
    const t = setInterval(() => setTick((x) => x + 1), TICK_MS)
    return () => clearInterval(t)
  }, [ready, key])

  useEffect(() => {
    if (!settling) return
    const t = finished < LIVE_STEPS.length ? setTimeout(() => setExtra((x) => x + 1), FINISH_STEP_MS) : setTimeout(() => setSettling(false), HOLD_MS)
    return () => clearTimeout(t)
  }, [settling, finished])

  const steps: ProfileStep[] = LIVE_STEPS.map((source_id, i) => ({
    source_id,
    status: i < finished ? 'done' : i === finished ? 'running' : 'pending',
  }))
  return { steps, settling }
}
