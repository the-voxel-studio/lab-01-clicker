/**
 * Motion foundation of the interface (design 4.2.1): shared durations, the tempo each dread band
 * gives to the ambient loops, the reduced motion rule, loop phase offsets and rolling figures.
 *
 * @module ui/motion
 */

import type { DreadBand } from '@/ui/dread'

/** Shared durations, in milliseconds. */
export const MOTION = {
  press: 160,
  feedback: 300,
  roll: 400,
  write: 900,
  crossfade: 1200,
  missive: 750,
} as const

/**
 * How the realm moves in each band: `sway` is the period of the swaying loops in seconds (slower
 * reads calmer), `flicker` the period of flames and the candle, `jitter` a nervous shake in px.
 */
export const BAND_TEMPO: Record<DreadBand, { sway: number; flicker: number; jitter: number }> = {
  enchanted: { sway: 6, flicker: 1.6, jitter: 0 },
  uneasy: { sway: 4.5, flicker: 1.2, jitter: 0.5 },
  rotting: { sway: 3, flicker: 0.6, jitter: 2 },
  death_throes: { sway: 9, flicker: 0.9, jitter: 1 },
}

const PHASE_SPREAD_MS = 6000
/** Decay of a rolling figure: under 0.1% of the gap is left after the duration. */
const ROLL_SETTLE = 7
/** Below this gap a figure lands on its target: finer than any displayed decimal. */
const ROLL_SNAP = 0.01

/** Motion runs unless the player's setting or the system asks for reduced motion. */
export function motionAllowed(settingReduced: boolean, systemReduced: boolean): boolean {
  return !settingReduced && !systemReduced
}

/**
 * A delay in [0, 6000) ms for the `index`th loop of a scene, stable for a seed, so loops never
 * beat together.
 */
export function phaseOffset(seed: number, index: number): number {
  let hash = (seed ^ Math.imul(index + 1, 0x9e3779b1)) >>> 0
  hash = Math.imul(hash ^ (hash >>> 13), 0x5bd1e995) >>> 0
  hash = (hash ^ (hash >>> 15)) >>> 0
  return hash % PHASE_SPREAD_MS
}

/**
 * The value of a figure `elapsedMs` after it stood at `from` on its way to `to`, eased out and exact
 * once `durationMs` is over. Calling it frame by frame with the last value holds no timer, so `to`
 * may change every frame and the figure still follows it.
 */
export function rollTowards(
  from: number,
  to: number,
  elapsedMs: number,
  durationMs: number,
): number {
  if (elapsedMs >= durationMs || durationMs <= 0) return to
  const left = (from - to) * Math.exp((-ROLL_SETTLE * Math.max(0, elapsedMs)) / durationMs)
  return Math.abs(left) < ROLL_SNAP ? to : to + left
}
