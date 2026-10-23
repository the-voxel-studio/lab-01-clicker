/**
 * Deterministic Replay Journal & State Verification Engine.
 * Pure TypeScript, indexed strictly by game seconds (not tick counts).
 *
 * @module core/replay
 */

import type { GameState, Command } from './types'
import { createInitialGameState } from './state'
import { dispatch } from './commands'
import { tick } from './engine'
import { DEFAULT_ENGINE_CONFIG, type EngineConfig } from './config'

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

/** Outcome of a journal replay. */
export interface ReplayResult {
  /** Final GameState after the replay. */
  state: GameState
  /**
   * Entries whose dispatch failed, in dispatch order. `index` is the position of the entry in
   * `journal.entries`; `error` is the message returned by `dispatch`.
   */
  rejected: Array<{ index: number; error: string }>
}

/** Tolerance in seconds under which an entry timestamp counts as reached, and for step counts. */
const TIME_EPSILON = 1e-9

/** Rounding step applied to every number before hashing. */
const HASH_NUMBER_PRECISION = 1e6

/**
 * Builds the canonical JSON text of a value: object keys sorted recursively, arrays kept in order,
 * numbers rounded to 1e-6 (negative zero written as 0), `undefined` object members omitted as in
 * `JSON.stringify`, and non finite numbers written as the strings `NaN`, `Infinity`, `-Infinity`.
 */
function canonicalJson(value: unknown): string {
  if (value === null || value === undefined) return 'null'
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return JSON.stringify(String(value))
    const rounded = Math.round(value * HASH_NUMBER_PRECISION) / HASH_NUMBER_PRECISION
    return JSON.stringify(rounded === 0 ? 0 : rounded)
  }
  if (typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value)
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalJson(item)).join(',')}]`
  }
  if (typeof value === 'object') {
    const members = Object.entries(value)
      .filter(([, member]) => member !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([key, member]) => `${JSON.stringify(key)}:${canonicalJson(member)}`)
    return `{${members.join(',')}}`
  }
  return 'null'
}

/**
 * Computes a deterministic hash of the whole GameState: the FNV-1a 32 bit hash of its canonical
 * JSON (keys sorted recursively, arrays kept in order, numbers rounded to 1e-6). No field is
 * excluded, so any difference above the rounding step in any field changes the hash.
 *
 * @param state - The GameState to hash.
 * @returns The hash as 8 lowercase hexadecimal digits.
 */
export function getStateHash(state: GameState): string {
  const payload = canonicalJson(state)

  let hash = 0x811c9dc5
  for (let i = 0; i < payload.length; i++) {
    hash ^= payload.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

/** Whether `tick` can advance game time in this state. */
function canAdvanceTime(state: GameState): boolean {
  return !state.isPaused && !state.isGameOver && state.phase === 'ACTIVE_CYCLE'
}

/**
 * Replays a journal deterministically.
 *
 * Entries are taken in timestamp order (ties keep their journal order). Each `tick` call covers a
 * whole number of fixed steps (`config.balance.FIXED_STEP_SECONDS`): at most `dt` rounded up to a
 * whole step, and never past the first step boundary at or after the next entry's timestamp. Each
 * entry is therefore dispatched at that boundary (its exact timestamp when it lies on the step
 * grid, within 1e-9 s), identically for every `dt`. While game time cannot advance
 * (paused flag or a phase other than `ACTIVE_CYCLE`), the next entry with a timestamp not beyond
 * `maxDurationSeconds` is dispatched at the current time. Every entry whose dispatch fails,
 * including one not allowed in the current phase, is listed in `rejected` and the replay goes on.
 * The replay ends at `maxDurationSeconds`, at game over, or when time cannot advance and no entry
 * is left within `maxDurationSeconds`.
 *
 * @param journal - Replay journal to evaluate.
 * @param dt - Maximum tick size in seconds, rounded up to whole fixed steps (e.g. 0.05, 1.0).
 * @param maxDurationSeconds - Simulated duration limit in game seconds (default 1000).
 * @param config - Engine configuration (default DEFAULT_ENGINE_CONFIG).
 * @returns The final state and the rejected entries.
 */
export function executeReplay(
  journal: ReplayJournal,
  dt: number = DEFAULT_ENGINE_CONFIG.balance.FIXED_STEP_SECONDS,
  maxDurationSeconds: number = 1000,
  config: EngineConfig = DEFAULT_ENGINE_CONFIG,
): ReplayResult {
  if (!Number.isFinite(dt) || dt <= 0) {
    throw new Error('Replay step dt must be a positive finite number.')
  }

  const state = createInitialGameState({ seed: journal.seed })
  const rejected: ReplayResult['rejected'] = []

  const order = journal.entries
    .map((entry, index) => ({ entry, index }))
    .sort((a, b) => a.entry.timeSeconds - b.entry.timeSeconds || a.index - b.index)
  let next = 0

  const dispatchNext = (): void => {
    const { entry, index } = order[next]!
    next++
    const result = dispatch(state, entry.command, config)
    if (!result.success) {
      rejected.push({ index, error: result.error ?? 'Command rejected.' })
    }
  }

  while (!state.isGameOver) {
    const now = state.totalElapsedSeconds

    // Dispatch every entry whose timestamp is reached
    if (next < order.length && order[next]!.entry.timeSeconds <= now + TIME_EPSILON) {
      dispatchNext()
      continue
    }

    if (!canAdvanceTime(state)) {
      // Game time is frozen: the next entry can only be dispatched now
      if (
        next < order.length &&
        order[next]!.entry.timeSeconds <= maxDurationSeconds + TIME_EPSILON
      ) {
        dispatchNext()
        continue
      }
      break
    }

    // Whole fixed steps only: up to dt (rounded up), up to the first step boundary at or after the
    // next entry, and never past maxDurationSeconds
    const step = config.balance.FIXED_STEP_SECONDS
    let steps = Math.max(1, Math.ceil(dt / step - TIME_EPSILON))
    if (next < order.length) {
      const untilEntry = order[next]!.entry.timeSeconds - now
      steps = Math.min(steps, Math.max(1, Math.ceil(untilEntry / step - TIME_EPSILON)))
    }
    steps = Math.min(steps, Math.floor((maxDurationSeconds - now) / step + TIME_EPSILON))
    if (steps <= 0) {
      break
    }

    const phaseBefore = state.phase
    const result = tick(state, steps * step, config)
    if ((result.consumedDt ?? 0) <= 0 && state.phase === phaseBefore && !state.isGameOver) {
      // Guard: tick made no progress and changed nothing
      break
    }
  }

  return { state, rejected }
}
