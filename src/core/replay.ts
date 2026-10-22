/**
 * Deterministic Replay Journal & State Verification Engine.
 * Pure TypeScript, indexed strictly by game seconds (not tick counts).
 *
 * @module core/replay
 */

import type { GameState, Command, UnitId } from './types'
import { createInitialGameState } from './state'
import { dispatch } from './commands'
import { tick, calculateMilitaryPower } from './engine'
import { DEFAULT_ENGINE_CONFIG, type EngineConfig } from './config'
import { isCommandAllowedInPhase } from './phases'

/** Entry in a replay journal with scheduled game timestamp. */
export interface ReplayEntry {
  /** Timestamp in active game seconds when the command was issued. */
  timeSeconds: number
  /** The command dispatched. */
  command: Command
}

/** Complete serializable Replay Journal. */
export interface ReplayJournal {
  /** Initial PRNG seed. */
  seed: number
  /** Monotonically ordered entries. */
  entries: ReplayEntry[]
}

/**
 * Computes a deterministic string hash of the core state for invariant testing.
 * Includes all essential components: deadline, phase, ap, population, free serfs,
 * military power, provinces, biomes, tax rate, unrest, strikes, PRNG streams, 24 units,
 * active laws, and active modifier counts.
 *
 * @param state - The active GameState.
 * @returns Deterministic hash representation.
 */
export function getStateHash(state: GameState): string {
  const milPower = calculateMilitaryPower(state)
  const unitRoster = (Object.keys(state.units) as UnitId[])
    .sort()
    .map((id) => `${id}:${state.units[id]}`)
    .join(',')

  const rngStreamStr = `${state.rngStreams.click},${state.rngStreams.combat},${state.rngStreams.events},${state.rngStreams.council}`

  const payload = [
    state.deadline,
    state.phase,
    Math.round(state.ap * 10) / 10,
    Math.round(state.totalPopulation * 10) / 10,
    Math.round(state.freeSerfs * 10) / 10,
    milPower,
    state.provinces,
    state.provinceBiomes.join(','),
    state.taxRate,
    Math.round(state.unrest * 10) / 10,
    state.strikes,
    rngStreamStr,
    unitRoster,
    state.activeLaws.join(','),
    state.activeModifiers.length,
    state.isGameOver ? 1 : 0,
    state.isVictory ? 1 : 0,
    state.defeatReason ?? 'none',
  ].join(':')

  // FNV-1a 32-bit hash implementation
  let hash = 0x811c9dc5
  for (let i = 0; i < payload.length; i++) {
    hash ^= payload.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

/**
 * Replays a journal deterministically with configurable simulation step size.
 *
 * @param journal - Replay journal to evaluate.
 * @param dt - Integration step size (e.g. 0.05 for 20 Hz, 0.5 or 1.0 for fast sim).
 * @param maxDurationSeconds - Maximum simulated run time (default: 1000s = 10 deadlines).
 * @param config - Optional engine configuration overrides.
 * @returns Final GameState after journal execution.
 */
export function executeReplay(
  journal: ReplayJournal,
  dt: number = 0.05,
  maxDurationSeconds: number = 1000,
  config: EngineConfig = DEFAULT_ENGINE_CONFIG,
): GameState {
  const state = createInitialGameState({ seed: journal.seed })

  // Sort entries by time
  const sortedEntries = [...journal.entries].sort((a, b) => a.timeSeconds - b.timeSeconds)
  let nextEntryIndex = 0
  let leftoverDt = 0

  while (state.totalElapsedSeconds < maxDurationSeconds && !state.isGameOver) {
    const currentTime = state.totalElapsedSeconds

    // Dispatch all commands scheduled up to currentTime
    while (
      nextEntryIndex < sortedEntries.length &&
      sortedEntries[nextEntryIndex]!.timeSeconds <= currentTime
    ) {
      const entry = sortedEntries[nextEntryIndex]!
      if (!isCommandAllowedInPhase(state.phase, entry.command.type)) {
        // Command belongs to another phase (e.g. inter-deadline phase); wait until phase transition
        break
      }
      dispatch(state, entry.command, config)
      nextEntryIndex++
      if (state.isGameOver) break
    }

    if (state.isGameOver) break

    // Infinite loop guard when in paused or crisis phases (where tick does not advance totalElapsedSeconds)
    if (state.phase !== 'ACTIVE_CYCLE') {
      const canProgress = sortedEntries
        .slice(nextEntryIndex)
        .some((entry) => isCommandAllowedInPhase(state.phase, entry.command.type))

      if (!canProgress) {
        // No remaining entry can exit this paused phase; exit cleanly
        break
      }

      // If the immediate next entry is permitted in this phase, allow dispatching it
      const nextEntry = sortedEntries[nextEntryIndex]
      if (nextEntry && isCommandAllowedInPhase(state.phase, nextEntry.command.type)) {
        dispatch(state, nextEntry.command, config)
        nextEntryIndex++
        if (state.isGameOver) break
        continue
      } else {
        // Intermediate blocking command; exit cleanly
        break
      }
    }

    // Simulation step in ACTIVE_CYCLE
    // Re-inject unconsumed reliquat if available, otherwise tick standard dt
    let stepDt = dt
    if (leftoverDt > 1e-9) {
      stepDt = leftoverDt
      leftoverDt = 0
    }

    stepDt = Math.min(stepDt, maxDurationSeconds - state.totalElapsedSeconds)
    if (stepDt <= 0) {
      break
    }

    const tickResult = tick(state, stepDt, config)
    const consumed = tickResult.consumedDt ?? stepDt
    if (consumed < stepDt) {
      leftoverDt += stepDt - consumed
    }
  }

  // Dispatch any remaining entries scheduled at or before the final elapsed time
  while (
    nextEntryIndex < sortedEntries.length &&
    sortedEntries[nextEntryIndex]!.timeSeconds <= state.totalElapsedSeconds + 1e-6 &&
    !state.isGameOver
  ) {
    const entry = sortedEntries[nextEntryIndex]!
    dispatch(state, entry.command, config)
    nextEntryIndex++
  }

  return state
}
