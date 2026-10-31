/**
 * What one more unit does: the rates of the realm read from the engine on a copy of the state, so
 * no formula is repeated here. Births and unrest are only computed inside the tick, so they are
 * measured by stepping the copy.
 *
 * @module ui/effects
 */

import { DEFAULT_ENGINE_CONFIG } from '@/core/config'
import {
  calculateGrossApRate,
  calculateMaxPopulation,
  calculateMilitaryPower,
  calculateNetApRate,
  tick,
} from '@/core/engine'
import type { GameState, UnitId } from '@/core/types'
import { formatFigure } from '@/ui/realmText'

const config = DEFAULT_ENGINE_CONFIG
const SAMPLE_SECONDS = 1
const SHOWN_LINES = 3
/** Effects under this read as nothing. */
const NEGLIGIBLE = 0.005

/** The rates a purchase can move. */
export interface RealmRates {
  netAp: number
  grossAp: number
  births: number
  room: number
  force: number
  unrestPerSecond: number
}

/** Steps a copy in a quiet cycle and reads what the tick did. */
function measuredRates(state: GameState): Pick<RealmRates, 'births' | 'unrestPerSecond'> {
  const copy = structuredClone(state)
  copy.phase = 'ACTIVE_CYCLE'
  copy.isPaused = false
  copy.deadlineTimeSeconds = 0
  copy.surpriseRaidTriggeredThisDeadline = true
  copy.forcedTitheFreezeTimer = 0
  tick(copy, SAMPLE_SECONDS, config)
  return {
    births: (copy.totalPopulation - state.totalPopulation) / SAMPLE_SECONDS,
    unrestPerSecond: (copy.unrest - state.unrest) / SAMPLE_SECONDS,
  }
}

/** Reads the rates of the realm. */
export function realmRates(state: GameState): RealmRates {
  return {
    netAp: calculateNetApRate(state, config),
    grossAp: calculateGrossApRate(state, config).total,
    room: calculateMaxPopulation(state, config),
    force: calculateMilitaryPower(state, config),
    ...measuredRates(state),
  }
}

/** A copy of the realm with more of a unit, taken from the free serfs as a purchase does. */
function withMore(state: GameState, unitId: UnitId, count: number): GameState {
  const copy = structuredClone(state)
  copy.units[unitId] = (copy.units[unitId] ?? 0) + count
  const fromSerfs = Math.min(copy.freeSerfs, count)
  copy.freeSerfs -= fromSerfs
  copy.totalPopulation += count - fromSerfs
  return copy
}

/**
 * What a purchase changes, holding only the rates that move.
 *
 * @param state - The run, read only.
 * @param unitId - The unit bought.
 * @param count - How many, the chosen bulk.
 */
export function unitEffect(state: GameState, unitId: UnitId, count = 1): Partial<RealmRates> {
  const before = realmRates(state)
  const after = realmRates(withMore(state, unitId, count))
  const effect: Partial<RealmRates> = {}
  for (const key of Object.keys(before) as (keyof RealmRates)[]) {
    const delta = after[key] - before[key]
    if (Math.abs(delta) >= NEGLIGIBLE) effect[key] = delta
  }
  return effect
}

function signed(value: number, decimals: number): string {
  return `${value > 0 ? '+' : ''}${formatFigure(value, decimals)}`
}

/** The figures of an effect, what the unit is for first and its cost last, at most three. */
export function effectLines(effect: Partial<RealmRates>): string[] {
  const lines: string[] = []
  if (effect.force !== undefined) lines.push(`${signed(effect.force, 1)} force`)
  if (effect.room !== undefined) lines.push(`${signed(effect.room, 0)} room`)
  if (effect.births !== undefined) lines.push(`${signed(effect.births, 2)} births/s`)
  if (effect.unrestPerSecond !== undefined) {
    lines.push(`${signed(effect.unrestPerSecond, 2)} unrest/s`)
  }
  if (effect.netAp !== undefined) lines.push(`${signed(effect.netAp, 2)} AP/s`)
  return lines.length > 0 ? lines.slice(0, SHOWN_LINES) : ['+0 AP/s']
}
