/**
 * Plan V2_FREE_WAR Task 3: the Crown's surcharge on conquests beyond the free one.
 *
 * @module __tests__/unit/crown_surcharge.spec
 */

import { describe, expect, it } from 'vitest'
import { resolveOffensiveCampaign } from '@/core/battle'
import { dispatch } from '@/core/commands'
import { DEFAULT_ENGINE_CONFIG, quotaForDeadline } from '@/core/config'
import {
  calculateMilitaryPower,
  crownSurchargeFactor,
  effectiveQuota,
  evaluateDeadlineAudit,
} from '@/core/engine'
import { PRNG } from '@/core/prng'
import { createInitialGameState } from '@/core/state'
import type { GameState, Modifier } from '@/core/types'
import { SCHEDULED_THREATS_DATA } from '@/data/threats'

const config = DEFAULT_ENGINE_CONFIG
const step = config.balance.CONQUEST_SURCHARGE_STEP

function reign(): GameState {
  const state = createInitialGameState({ seed: 21 })
  state.phase = 'ACTIVE_CYCLE'
  state.deadline = 3
  state.units.soldier = 100
  return state
}

/** A campaign at a known ratio, on a province free to be won. */
function campaign(state: GameState, ratio: number): void {
  resolveOffensiveCampaign(state, ratio * 100, 100, 'ap', 0, new PRNG(4), config, 'farmlands')
}

function oneSoldier(): GameState {
  const state = reign()
  state.units.soldier = 1
  return state
}

describe('Task 3: the Crown surcharge', () => {
  it('charges nothing for the first conquest of an audit', () => {
    const state = reign()
    const before = effectiveQuota(state, quotaForDeadline(config, 3))
    campaign(state, 1.5)
    expect(state.conquestsThisAudit).toBe(1)
    expect(state.crownSurchargeSteps).toBe(0)
    expect(effectiveQuota(state, quotaForDeadline(config, 3))).toEqual(before)
  })

  it('raises the three quotas for each further conquest, cumulatively', () => {
    const state = reign()
    const quota = quotaForDeadline(config, 3)
    campaign(state, 1.5)
    campaign(state, 1.5)
    expect(state.crownSurchargeSteps).toBe(1)
    expect(crownSurchargeFactor(state, config)).toBeCloseTo(1 + step)
    campaign(state, 1.5)
    expect(state.crownSurchargeSteps).toBe(2)
    const raised = effectiveQuota(state, quota)
    expect(raised.apRate).toBeCloseTo(quota.apRate * (1 + 2 * step))
    expect(raised.pop).toBeCloseTo(quota.pop * (1 + 2 * step))
    expect(raised.military).toBeCloseTo(quota.military * (1 + 2 * step))
  })

  it('stacks on the quota requirement', () => {
    const state = reign()
    state.crownSurchargeSteps = 1
    const scoped: Modifier = {
      source: 'test',
      stat: 'quota_requirement',
      op: 'mul',
      value: 0.5,
    }
    state.activeModifiers = [scoped]
    const quota = quotaForDeadline(config, 3)
    expect(effectiveQuota(state, quota).pop).toBeCloseTo(quota.pop * 0.5 * (1 + step))
  })

  it('counts neither a razor thin victory nor a defeat nor a colony', () => {
    const state = reign()
    campaign(state, 1.02)
    campaign(state, 0.5)
    expect(state.conquestsThisAudit).toBe(0)
    state.ap = 1e9
    dispatch(state, { type: 'COLONISE_PROVINCE' })
    expect(state.conquestsThisAudit).toBe(0)
    expect(state.crownSurchargeSteps).toBe(0)
  })

  it('counts a war of the resume towards the audit ahead', () => {
    const state = reign()
    state.phase = 'AWAIT_RESUME'
    campaign(state, 1.5)
    dispatch(state, { type: 'RESUME_GOVERNANCE' })
    expect(state.conquestsThisAudit).toBe(1)
    campaign(state, 1.5)
    expect(state.crownSurchargeSteps).toBe(1)
  })

  it('resets the count at the audit, and keeps the steps through it and any loss', () => {
    const state = reign()
    campaign(state, 1.5)
    campaign(state, 1.5)
    evaluateDeadlineAudit(state, config)
    expect(state.conquestsThisAudit).toBe(0)
    expect(state.crownSurchargeSteps).toBe(1)
    state.provinces -= 1
    expect(crownSurchargeFactor(state, config)).toBeCloseTo(1 + step)
  })

  it('reads the surcharge in an audit, even raised at the last second', () => {
    const state = reign()
    const quota = quotaForDeadline(config, 3)
    state.totalPopulation = Math.ceil(quota.pop)
    expect(evaluateDeadlineAudit(state, config).popMet).toBe(true)
    state.crownSurchargeSteps = 1
    expect(evaluateDeadlineAudit(state, config).popMet).toBe(false)
  })

  it('leaves the force of the Barons on the quota without surcharge', () => {
    const announce = (steps: number): number => {
      const state = reign()
      state.deadline = 3
      state.phase = 'COUNCIL_LAWS'
      state.currentLawDraft = []
      state.crownSurchargeSteps = steps
      state.units.soldier = 300
      expect(SCHEDULED_THREATS_DATA.find((item) => item.deadline === 4)?.factionId).toBe('barons')
      const quota = quotaForDeadline(config, 4).military
      state.units.soldier = Math.ceil((quota * 1.22) / calculateMilitaryPower(oneSoldier(), config))
      dispatch(state, { type: 'REJECT_LAWS' })
      return state.currentThreatPower
    }
    expect(announce(2)).toBe(announce(0))
  })

  it('leaves targets on the bare quota', () => {
    const quiet = reign()
    const raised = reign()
    raised.crownSurchargeSteps = 5
    dispatch(quiet, { type: 'LAUNCH_ATTACK' })
    dispatch(raised, { type: 'LAUNCH_ATTACK' })
    expect(raised.currentTarget?.power).toBe(quiet.currentTarget?.power)
  })
})
