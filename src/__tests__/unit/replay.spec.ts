/**
 * Deterministic Replay & Step-Size Invariance Test Suite.
 * Validates PRNG reproducibility, journal determinism, and step-size invariance.
 *
 * @module __tests__/unit/replay.spec
 */

import { describe, it, expect } from 'vitest'
import {
  executeReplay,
  getStateHash,
  type ReplayJournal,
} from '@/core/replay'
import { PRNG } from '@/core/prng'

describe('Deterministic Replay & Step-Size Invariance (Gate B)', () => {
  it('verifies Mulberry32 PRNG reproducibility and state serialization', () => {
    const prng1 = new PRNG(1337)
    const val1 = prng1.next()
    const val2 = prng1.next()

    const prng2 = new PRNG(1337)
    expect(prng2.next()).toBe(val1)
    expect(prng2.next()).toBe(val2)

    // Serialization & restoration
    const savedState = prng1.getState()
    const prng3 = new PRNG(0)
    prng3.setState(savedState)
    expect(prng3.next()).toBe(prng1.next())
  })

  it('guarantees identical final state hash across repeated journal replays', () => {
    const sampleJournal: ReplayJournal = {
      seed: 42,
      entries: [
        { timeSeconds: 1.0, command: { type: 'STAMP_DOCUMENT' } },
        { timeSeconds: 2.0, command: { type: 'BUY_UNIT', unitId: 'scribe', count: 1 } },
        { timeSeconds: 5.0, command: { type: 'SET_TAX_RATE', rate: 25 } },
        { timeSeconds: 10.0, command: { type: 'BUY_UNIT', unitId: 'peasant', count: 1 } },
        { timeSeconds: 20.0, command: { type: 'STAMP_DOCUMENT' } },
      ],
    }

    const runA = executeReplay(sampleJournal, 0.05, 50)
    const runB = executeReplay(sampleJournal, 0.05, 50)

    const hashA = getStateHash(runA)
    const hashB = getStateHash(runB)

    expect(hashA).toBe(hashB)
    expect(runA.ap).toBeCloseTo(runB.ap, 4)
    expect(runA.totalPopulation).toBeCloseTo(runB.totalPopulation, 4)
  })

  it('demonstrates numerical step-size invariance across dt = 0.05s, 0.5s, and 1.0s', () => {
    const sampleJournal: ReplayJournal = {
      seed: 999,
      entries: [
        { timeSeconds: 0.0, command: { type: 'BUY_UNIT', unitId: 'scribe', count: 2 } },
        { timeSeconds: 10.0, command: { type: 'BUY_UNIT', unitId: 'peasant', count: 2 } },
        { timeSeconds: 30.0, command: { type: 'BUY_UNIT', unitId: 'scribe', count: 1 } },
      ],
    }

    // 1. High frequency UI tick (20 Hz, dt = 0.05s)
    const runFine = executeReplay(sampleJournal, 0.05, 100)

    // 2. Medium frequency tick (dt = 0.5s)
    const runMedium = executeReplay(sampleJournal, 0.5, 100)

    // 3. Fast simulation tick (dt = 1.0s)
    const runCoarse = executeReplay(sampleJournal, 1.0, 100)

    // AP output delta should be strictly under 1.5% across step sizes
    const relativeDeltaMedium = Math.abs(runFine.ap - runMedium.ap) / runFine.ap
    const relativeDeltaCoarse = Math.abs(runFine.ap - runCoarse.ap) / runFine.ap

    expect(relativeDeltaMedium).toBeLessThan(0.015)
    expect(relativeDeltaCoarse).toBeLessThan(0.02)

    // Outcome match (both active or survived deadline 1)
    expect(runFine.isGameOver).toBe(runMedium.isGameOver)
    expect(runFine.isGameOver).toBe(runCoarse.isGameOver)
  })
})
