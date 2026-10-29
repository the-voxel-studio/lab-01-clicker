/**
 * Dread level of a run: one score in [0, 1] read from the engine state each frame, and the band it
 * falls in. The bands drive the rot of the interface, the kingdom view and the music layer
 * (design section 3.2). Weights are starting values, tuned by the user in playtest.
 *
 * @module ui/dread
 */

import { DEFAULT_ENGINE_CONFIG, quotaForDeadline, type EngineConfig } from '@/core/config'
import {
  calculateGrossApRate,
  calculateMilitaryPower,
  calculateNetApRate,
  effectiveQuota,
} from '@/core/engine'
import type { GameState, RunPhase } from '@/core/types'

/** The four looks of the interface, from the enchanted realm to the death throes. */
export type DreadBand = 'enchanted' | 'uneasy' | 'rotting' | 'death_throes'

/** A dread score in [0, 1] and its band. */
export interface DreadReading {
  score: number
  band: DreadBand
}

const UNREST_CALM = 30
const STRIKE_WEIGHT = 0.2
const BANKRUPTCY_WEIGHT = 0.35
const THREAT_WEIGHT = 0.15
const THREAT_PHASES: readonly RunPhase[] = ['THREAT_HERALD', 'SURPRISE_RAID', 'LOMBARD_OFFER']

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value))
}

/** Share of a quota still missing, 0 when met or when nothing is required. */
function shortfall(current: number, required: number): number {
  return required > 0 ? clamp01(1 - current / required) : 0
}

/**
 * Maps a dread score to its band: below 0.25 enchanted, below 0.5 uneasy, below 0.75 rotting,
 * otherwise death throes.
 */
export function bandForScore(score: number): DreadBand {
  if (score < 0.25) return 'enchanted'
  if (score < 0.5) return 'uneasy'
  if (score < 0.75) return 'rotting'
  return 'death_throes'
}

/**
 * Computes the dread of a run from its unrest, its quota deficit weighted by the time spent in the
 * deadline, strikes, the bankruptcy countdown condition and a pending threat. A defeat always reads
 * death throes and a victory always reads enchanted.
 *
 * @param state - The run state, read only.
 * @param config - Engine configuration (quota table and deadline duration).
 */
export function computeDread(
  state: GameState,
  config: EngineConfig = DEFAULT_ENGINE_CONFIG,
): DreadReading {
  if (state.phase === 'RUN_DEFEAT') return { score: 1, band: 'death_throes' }
  if (state.phase === 'RUN_VICTORY') return { score: 0, band: 'enchanted' }

  const unrestTerm = clamp01((state.unrest - UNREST_CALM) / (100 - UNREST_CALM))

  const required = effectiveQuota(state, quotaForDeadline(config, state.deadline))
  const deficit = Math.max(
    shortfall(calculateGrossApRate(state, config).total, required.apRate),
    shortfall(state.totalPopulation, required.pop),
    shortfall(calculateMilitaryPower(state, config), required.military),
  )
  const elapsed = clamp01(state.deadlineTimeSeconds / config.balance.DEADLINE_DURATION_SECONDS)
  const quotaTerm = deficit * elapsed

  // Same condition as the engine's bankruptcy countdown in the fixed step.
  const bankrupt = state.ap <= 0 && calculateNetApRate(state, config) < 0
  const threat = THREAT_PHASES.includes(state.phase)

  const score = clamp01(
    Math.max(unrestTerm, quotaTerm) +
      (state.strikes > 0 ? STRIKE_WEIGHT : 0) +
      (bankrupt ? BANKRUPTCY_WEIGHT : 0) +
      (threat ? THREAT_WEIGHT : 0),
  )
  return { score, band: bandForScore(score) }
}
