/**
 * Dread level: score and band read from the run state (design section 3.2).
 *
 * @module __tests__/unit/ui_dread.spec
 */

import { DEFAULT_ENGINE_CONFIG } from '@/core/config'
import { describe, it, expect } from 'vitest'
import { calculateNetApRate } from '@/core/engine'
import { createInitialGameState } from '@/core/state'
import type { GameState } from '@/core/types'
import { LEVEL_DATA } from '@/data/levels'
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
    expect(computeDread(createInitialGameState(), DEFAULT_ENGINE_CONFIG).band).toBe('enchanted')
  })

  it('reads full unrest as death throes', () => {
    expect(computeDread(createInitialGameState({ unrest: 100 }), DEFAULT_ENGINE_CONFIG).band).toBe(
      'death_throes',
    )
  })

  it('reads unrest 30 at the start of a deadline as enchanted', () => {
    const reading = computeDread(
      createInitialGameState({ unrest: 30, deadlineTimeSeconds: 0 }),
      DEFAULT_ENGINE_CONFIG,
    )
    expect(reading.score).toBe(0)
    expect(reading.band).toBe('enchanted')
  })

  it('reads every quota at zero at the end of the deadline as death throes', () => {
    const reading = computeDread(emptyRealm({ deadlineTimeSeconds: 100 }), DEFAULT_ENGINE_CONFIG)
    expect(reading.score).toBe(1)
    expect(reading.band).toBe('death_throes')
  })

  it('adds 0.35 when the treasury is empty and the net AP rate is negative', () => {
    const solvent = realmInDebt(1)
    const bankrupt = realmInDebt(-1)
    expect(calculateNetApRate(bankrupt)).toBeLessThan(0)
    expect(
      computeDread(bankrupt, DEFAULT_ENGINE_CONFIG).score -
        computeDread(solvent, DEFAULT_ENGINE_CONFIG).score,
    ).toBeCloseTo(0.35)
  })

  it('adds nothing for an empty treasury while the net AP rate is positive', () => {
    const solvent = createInitialGameState({ ap: 1 })
    const empty = createInitialGameState({ ap: -1 })
    expect(calculateNetApRate(empty)).toBeGreaterThan(0)
    expect(computeDread(empty, DEFAULT_ENGINE_CONFIG).score).toBe(
      computeDread(solvent, DEFAULT_ENGINE_CONFIG).score,
    )
  })

  it('reads a defeat as death throes and a victory as enchanted whatever the numbers', () => {
    expect(
      computeDread(createInitialGameState({ phase: 'RUN_DEFEAT' }), DEFAULT_ENGINE_CONFIG).band,
    ).toBe('death_throes')
    expect(
      computeDread(emptyRealm({ phase: 'RUN_VICTORY', unrest: 100 }), DEFAULT_ENGINE_CONFIG).band,
    ).toBe('enchanted')
  })

  it('leaves the finished audit out of the open resume', () => {
    const state = emptyRealm({ phase: 'AWAIT_RESUME', unrest: 0 })
    state.deadlineTimeSeconds = 100
    expect(computeDread(state, DEFAULT_ENGINE_CONFIG).band).toBe('enchanted')
  })
})

describe('Plan V2_DIFFICULTY Task 5: dread by level', () => {
  /** Unrest alone, so the score is known: (60 - 30) / 70 of the way. */
  function uneasyRealm(): GameState {
    return emptyRealm({ unrest: 50, phase: 'ACTIVE_CYCLE' })
  }

  it('reads an ordinary reign as it always did', () => {
    const state = uneasyRealm()
    expect(computeDread(state, DEFAULT_ENGINE_CONFIG, 'ordinary')).toEqual(
      computeDread(state, DEFAULT_ENGINE_CONFIG),
    )
  })

  it('raises the score by the dread factor of the level, clamped at 1', () => {
    const state = uneasyRealm()
    const base = computeDread(state, DEFAULT_ENGINE_CONFIG).score
    expect(base).toBeGreaterThan(0)
    expect(computeDread(state, DEFAULT_ENGINE_CONFIG, 'stern').score).toBeCloseTo(
      base * LEVEL_DATA.stern.dreadFactor,
    )
    expect(computeDread(state, DEFAULT_ENGINE_CONFIG, 'tyrannical').score).toBeCloseTo(
      base * LEVEL_DATA.tyrannical.dreadFactor,
    )
    state.unrest = 95
    expect(computeDread(state, DEFAULT_ENGINE_CONFIG, 'tyrannical').score).toBe(1)
  })

  it('keeps defeat in death throes and victory enchanted at every level', () => {
    for (const level of ['stern', 'tyrannical'] as const) {
      expect(
        computeDread(emptyRealm({ phase: 'RUN_DEFEAT' }), DEFAULT_ENGINE_CONFIG, level).band,
      ).toBe('death_throes')
      expect(
        computeDread(emptyRealm({ phase: 'RUN_VICTORY' }), DEFAULT_ENGINE_CONFIG, level),
      ).toEqual({ score: 0, band: 'enchanted' })
    }
  })

  it('lets the realm of a hard reign rot sooner', () => {
    const state = uneasyRealm()
    state.unrest = 70
    expect(computeDread(state, DEFAULT_ENGINE_CONFIG).band).toBe('rotting')
    expect(computeDread(state, DEFAULT_ENGINE_CONFIG, 'tyrannical').band).toBe('death_throes')
  })
})
