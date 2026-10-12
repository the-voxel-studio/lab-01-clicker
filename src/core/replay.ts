/**
 * Deterministic Replay Journal & State Verification Engine.
 * Pure TypeScript, indexed strictly by game seconds (not tick counts).
 *
 * @module core/replay
 */

import type { GameState, Command } from './types'
import { createInitialGameState } from './state'
import { dispatch } from './commands'
import { tick, calculateMilitaryPower } from './engine'

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
 *
 * @param state - The active GameState.
 * @returns Deterministic hash representation.
 */
export function getStateHash(state: GameState): string {
  const milPower = calculateMilitaryPower(state)
  const payload = [
    state.deadline,
    Math.round(state.ap * 10) / 10,
    Math.round(state.totalPopulation * 10) / 10,
    milPower,
    state.provinces,
    Math.round(state.unrest * 10) / 10,
    state.strikes,
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
 * @returns Final GameState after journal execution.
 */
export function executeReplay(
  journal: ReplayJournal,
  dt: number = 0.05,
  maxDurationSeconds: number = 1000
): GameState {
  const state = createInitialGameState({ seed: journal.seed })

  // Sort entries by time
  const sortedEntries = [...journal.entries].sort((a, b) => a.timeSeconds - b.timeSeconds)
  let nextEntryIndex = 0

  while (state.totalElapsedSeconds < maxDurationSeconds && !state.isGameOver) {
    const currentTime = state.totalElapsedSeconds

    // Dispatch all commands scheduled up to currentTime
    while (
      nextEntryIndex < sortedEntries.length &&
      sortedEntries[nextEntryIndex]!.timeSeconds <= currentTime
    ) {
      const entry = sortedEntries[nextEntryIndex]!
      dispatch(state, entry.command)
      nextEntryIndex++
    }

    if (state.isGameOver) break

    // Advance simulation tick
    tick(state, dt)
  }

  // Dispatch any remaining entries scheduled at exact end
  while (nextEntryIndex < sortedEntries.length) {
    const entry = sortedEntries[nextEntryIndex]!
    dispatch(state, entry.command)
    nextEntryIndex++
  }

  return state
}
