/**
 * Dread level: score and band read from the run state (design section 3.2).
 *
 * @module __tests__/unit/ui_dread.spec
 */

import { describe, it, expect } from 'vitest'
import { calculateNetApRate } from '@/core/engine'
import { createInitialGameState } from '@/core/state'
import type { GameState } from '@/core/types'
import { bandForScore, computeDread } from '@/ui/dread'

/** A state whose three quotas all read zero: no people, no producers, no army. */
function emptyRealm(overrides: Partial<GameState> = {}): GameState {
  return createInitialGameState({ totalPopulation: 0, freeSerfs: 0, ...overrides })
}

/** A state paying soldier upkeep with nothing produced, so its net AP rate is negative. */
function realmInDebt(ap: number): GameState {
  const state = emptyRealm({ ap, unrest: 0 })
  state.units.soldier = 40
  return state
}

describe('Task 2: dread level', () => {
  it('maps scores to bands at the band thresholds', () => {
    expect(bandForScore(0)).toBe('enchanted')
    expect(bandForScore(0.25)).toBe('uneasy')
    expect(bandForScore(0.5)).toBe('rotting')
    expect(bandForScore(0.75)).toBe('death_throes')
    expect(bandForScore(1)).toBe('death_throes')
  })

  it('reads a fresh run as enchanted', () => {
    expect(computeDread(createInitialGameState()).band).toBe('enchanted')
  })

  it('reads full unrest as death throes', () => {
    expect(computeDread(createInitialGameState({ unrest: 100 })).band).toBe('death_throes')
  })

  it('reads unrest 30 at the start of a deadline as enchanted', () => {
    const reading = computeDread(createInitialGameState({ unrest: 30, deadlineTimeSeconds: 0 }))
    expect(reading.score).toBe(0)
    expect(reading.band).toBe('enchanted')
  })

  it('reads every quota at zero at the end of the deadline as death throes', () => {
    const reading = computeDread(emptyRealm({ deadlineTimeSeconds: 100 }))
    expect(reading.score).toBe(1)
    expect(reading.band).toBe('death_throes')
  })

  it('adds 0.35 when the treasury is empty and the net AP rate is negative', () => {
    const solvent = realmInDebt(1)
    const bankrupt = realmInDebt(-1)
    expect(calculateNetApRate(bankrupt)).toBeLessThan(0)
    expect(computeDread(bankrupt).score - computeDread(solvent).score).toBeCloseTo(0.35)
  })

  it('adds nothing for an empty treasury while the net AP rate is positive', () => {
    const solvent = createInitialGameState({ ap: 1 })
    const empty = createInitialGameState({ ap: -1 })
    expect(calculateNetApRate(empty)).toBeGreaterThan(0)
    expect(computeDread(empty).score).toBe(computeDread(solvent).score)
  })

  it('reads a defeat as death throes and a victory as enchanted whatever the numbers', () => {
    expect(computeDread(createInitialGameState({ phase: 'RUN_DEFEAT' })).band).toBe('death_throes')
    expect(computeDread(emptyRealm({ phase: 'RUN_VICTORY', unrest: 100 })).band).toBe('enchanted')
  })
})
