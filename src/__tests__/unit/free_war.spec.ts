/**
 * Plan V2_FREE_WAR: war during the reign and casualties on a curve.
 *
 * @module __tests__/unit/free_war.spec
 */

import { describe, expect, it } from 'vitest'
import { startRun, createArchiveData } from '@/core/archives'
import {
  campaignCasualtyRate,
  evaluateCampaignOutcome,
  generateCampaignTarget,
} from '@/core/battle'
import { dispatch } from '@/core/commands'
import { DEFAULT_ENGINE_CONFIG } from '@/core/config'
import { calculateMilitaryPower } from '@/core/engine'
import { getNextInterDeadlinePhase, isCommandAllowedInPhase } from '@/core/phases'
import { PRNG } from '@/core/prng'
import { createInitialGameState } from '@/core/state'
import { fortuneView } from '@/ui/fortune'

const config = DEFAULT_ENGINE_CONFIG

function reign(soldiers = 500) {
  const state = createInitialGameState({ seed: 11 })
  state.phase = 'ACTIVE_CYCLE'
  state.units.soldier = soldiers
  state.totalPopulation += soldiers
  return state
}

describe('Task 1: war during the reign', () => {
  it('allows war in the cycle and the resume, never during a letter', () => {
    for (const phase of ['ACTIVE_CYCLE', 'AWAIT_RESUME'] as const) {
      expect(isCommandAllowedInPhase(phase, 'LAUNCH_ATTACK')).toBe(true)
      expect(isCommandAllowedInPhase(phase, 'RECON_PATROL')).toBe(true)
    }
    for (const phase of ['THREAT_HERALD', 'SURPRISE_RAID'] as const) {
      expect(isCommandAllowedInPhase(phase, 'LAUNCH_ATTACK')).toBe(false)
    }
  })

  it('goes from the council or the herald straight to the resume', () => {
    expect(getNextInterDeadlinePhase('COUNCIL_LAWS', 1, config)).toBe('AWAIT_RESUME')
    expect(getNextInterDeadlinePhase('THREAT_HERALD', 3, config)).toBe('AWAIT_RESUME')
  })

  it('holds a target from the coronation and reads a new one at the resume', () => {
    const state = startRun(createArchiveData(), 3)
    expect(state.currentTarget).not.toBeNull()
    state.phase = 'AWAIT_RESUME'
    state.deadline = 5
    const before = state.currentTarget
    dispatch(state, { type: 'RESUME_GOVERNANCE' })
    expect(state.deadline).toBe(6)
    expect(state.currentTarget).not.toBe(before)
    expect(state.currentTarget).not.toBeNull()
  })

  it('fights three campaigns in a row and leaves a fresh target each time', () => {
    const state = reign()
    state.deadlineTimeSeconds = 40
    for (let i = 0; i < 3; i++) {
      state.currentTarget = null
      expect(dispatch(state, { type: 'LAUNCH_ATTACK' }).success).toBe(true)
      expect(state.phase).toBe('ACTIVE_CYCLE')
      expect(state.deadlineTimeSeconds).toBe(40)
      expect(state.currentTarget).not.toBeNull()
    }
  })

  it('leaves the target alone when a campaign ends the reign', () => {
    const state = reign(1)
    state.unrest = 99
    generateCampaignTarget(state, config)
    const target = state.currentTarget
    dispatch(state, { type: 'LAUNCH_ATTACK' })
    expect(state.phase).toBe('RUN_DEFEAT')
    expect(state.defeatReason).toBe('revolution')
    expect(state.currentTarget).toBe(target)
  })
})

describe('Task 4: casualties on a curve', () => {
  it.each([
    [0.5, 1],
    [0.8, 1],
    [0.85, 0.875],
    [0.9, 0.75],
    [1.0, 0.5],
    [1.1, 0.375],
    [1.2, 0.25],
    [1.3, 0.175],
    [1.4, 0.1],
    [3, 0.1],
  ])('loses at ratio %f a share of %f', (ratio, rate) => {
    expect(campaignCasualtyRate(ratio, config)).toBeCloseTo(rate, 9)
  })

  it('rolls within 0.02 of the curve and within the whole army', () => {
    for (let seed = 1; seed < 200; seed++) {
      const rolled = evaluateCampaignOutcome(1.2, config, new PRNG(seed)).casualtyRate
      expect(Math.abs(rolled - 0.25)).toBeLessThanOrEqual(0.02 + 1e-9)
      const whole = evaluateCampaignOutcome(0.5, config, new PRNG(seed)).casualtyRate
      expect(whole).toBeLessThanOrEqual(1)
      expect(whole).toBeGreaterThanOrEqual(0.98)
    }
    expect(evaluateCampaignOutcome(1.2, config, new PRNG(5))).toEqual(
      evaluateCampaignOutcome(1.2, config, new PRNG(5)),
    )
  })

  it('leaves the tiers deciding the province, the loot and the unrest', () => {
    const tier = (ratio: number) => {
      const { outcome, provinceWon, lootMultiplier, unrestDelta } = evaluateCampaignOutcome(
        ratio,
        config,
        new PRNG(1),
      )
      return [outcome, provinceWon, lootMultiplier, unrestDelta]
    }
    expect(tier(1.5)).toEqual(['decisive_victory', true, 1.2, -5])
    expect(tier(1.2)).toEqual(['clear_victory', true, 1, 0])
    expect(tier(1.02)).toEqual(['razor_thin_victory', false, 0.5, 5])
    expect(tier(0.9)).toEqual(['pyrrhic_standoff', false, 0, 15])
    expect(tier(0.5)).toEqual(['crushing_defeat', false, 0, 25])
  })

  it('leaves the reign going when the whole army dies, and refuses the next attack', () => {
    const state = reign(5)
    state.currentTarget = null
    dispatch(state, { type: 'LAUNCH_ATTACK' })
    state.units.soldier = 0
    state.units.man_at_arms = 0
    expect(state.phase).toBe('ACTIVE_CYCLE')
    expect(state.currentTarget).not.toBeNull()
    expect(dispatch(state, { type: 'LAUNCH_ATTACK' })).toEqual({
      success: false,
      error: 'Cannot launch an attack without an army.',
    })
  })

  it('refuses a host of nobody, whatever its flat force', () => {
    const state = reign(0)
    state.activeModifiers = [{ source: 'test', stat: 'military_power', op: 'add', value: 15 }]
    expect(calculateMilitaryPower(state, config)).toBeGreaterThan(0)
    expect(dispatch(state, { type: 'LAUNCH_ATTACK' })).toEqual({
      success: false,
      error: 'Cannot launch an attack without an army.',
    })
    expect(fortuneView(state).attack.blocked).toBe('You have no army')
  })

  it('flags a target already on the page once a spymaster serves', () => {
    const state = reign()
    generateCampaignTarget(state, config)
    state.currentTarget = { ...state.currentTarget!, isAmbush: true, isFalseLedger: true }
    expect(fortuneView(state).target?.warnings).toEqual([])
    state.units.spymaster = 1
    expect(fortuneView(state).target?.warnings).toHaveLength(2)
  })
})
