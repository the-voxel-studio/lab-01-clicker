/**
 * Plan 04 Task 4: a full Greedy run replays to the same final state for any tick size.
 *
 * @module __tests__/simulation/stepSize.spec
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { DEFAULT_ENGINE_CONFIG } from '@/core/config'
import { calculateMilitaryPower } from '@/core/engine'
import { executeReplay, getStateHash, type ReplayResult } from '@/core/replay'
import { runSimulation, greedyRoiBotStrategy, type BotRunResult } from './botRunner'

/** Seeds of the 20 Greedy runs. */
const FIRST_SEED = 30001
const SEED_COUNT = 20
const SEEDS: readonly number[] = Array.from(
  { length: SEED_COUNT },
  (_, index) => FIRST_SEED + index,
)

/** Fine and coarse replay tick sizes in seconds. */
const FINE_DT = 0.05
const COARSE_DT = 1.0

/** Largest relative gap allowed on AP, population and military power. */
const TOLERANCE = 0.01

/** Replay duration limit covering the 10 deadlines of 100 s with a wide margin. */
const REPLAY_LIMIT_SECONDS = 2000

/** Seeds whose run defers an audit behind a raid: their journal holds a TICK entry. */
const DEFERRED_AUDIT_SEEDS: readonly number[] = [30017, 30020]

/** Time allowed to the 20 runs and 40 replays. */
const SUITE_TIMEOUT_MS = 60_000

/** One seed: the original run and its two replays. */
interface SeedRuns {
  seed: number
  run: BotRunResult
  fine: ReplayResult
  coarse: ReplayResult
}

/** Runs the Greedy bot on a seed to its natural end and replays the journal at both tick sizes. */
function playSeed(seed: number): SeedRuns {
  const run = runSimulation(greedyRoiBotStrategy, seed)
  const replay = (dt: number): ReplayResult =>
    executeReplay(run.journal, dt, REPLAY_LIMIT_SECONDS, DEFAULT_ENGINE_CONFIG)
  return { seed, run, fine: replay(FINE_DT), coarse: replay(COARSE_DT) }
}

/** Whether two values are within the relative tolerance of each other. */
function withinTolerance(a: number, b: number): boolean {
  return Math.abs(a - b) <= TOLERANCE * Math.max(Math.abs(a), Math.abs(b))
}

/** Seeds whose two replays end on different state hashes. */
function hashMismatches(all: readonly SeedRuns[]): number[] {
  return all
    .filter(({ fine, coarse }) => getStateHash(fine.state) !== getStateHash(coarse.state))
    .map(({ seed }) => seed)
}

describe('Plan 04 Task 4: step size invariance of full runs', () => {
  const all: SeedRuns[] = []

  beforeAll(() => {
    all.push(...SEEDS.map(playSeed))
  }, SUITE_TIMEOUT_MS)

  it(
    'reproduces the original outcome and final state with the fine replay',
    { timeout: SUITE_TIMEOUT_MS },
    () => {
      for (const { seed, run, fine } of all) {
        expect(fine.state.isVictory, `seed ${seed} won`).toBe(run.won)
        expect(fine.state.defeatReason, `seed ${seed} defeat`).toBe(run.defeatReason)
        expect(fine.state.deadline, `seed ${seed} deadline`).toBe(run.finalDeadline)
        expect(getStateHash(fine.state), `seed ${seed} hash`).toBe(run.finalStateHash)
      }
    },
  )

  it('journals the zero time tick that opens a deferred audit', () => {
    for (const seed of DEFERRED_AUDIT_SEEDS) {
      const entry = all.find((runs) => runs.seed === seed)
      const ticks = entry?.run.journal.entries.filter(({ command }) => command.type === 'TICK')
      expect(ticks?.length, `seed ${seed} TICK entries`).toBeGreaterThan(0)
    }
  })

  it('accepts every journal entry at both tick sizes', () => {
    for (const { seed, fine, coarse } of all) {
      expect(fine.rejected, `seed ${seed} fine`).toEqual([])
      expect(coarse.rejected, `seed ${seed} coarse`).toEqual([])
    }
  })

  it('rejects the same entries at both tick sizes', () => {
    for (const { seed, fine, coarse } of all) {
      expect(coarse.rejected, `seed ${seed} rejected`).toEqual(fine.rejected)
    }
  })

  it('ends in the same phase and deadline at both tick sizes', () => {
    for (const { seed, fine, coarse } of all) {
      expect(coarse.state.phase, `seed ${seed} phase`).toBe(fine.state.phase)
      expect(coarse.state.deadline, `seed ${seed} deadline`).toBe(fine.state.deadline)
    }
  })

  it('ends with AP, population and military within 1% at both tick sizes', () => {
    for (const { seed, fine, coarse } of all) {
      expect(withinTolerance(fine.state.ap, coarse.state.ap), `seed ${seed} ap`).toBe(true)
      expect(
        withinTolerance(fine.state.totalPopulation, coarse.state.totalPopulation),
        `seed ${seed} population`,
      ).toBe(true)
      expect(
        withinTolerance(calculateMilitaryPower(fine.state), calculateMilitaryPower(coarse.state)),
        `seed ${seed} military`,
      ).toBe(true)
    }
  })

  it('ends on the same state hash at both tick sizes', () => {
    expect(hashMismatches(all)).toEqual([])
  })
})
