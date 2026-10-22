/**
 * Emergency Edict Safeguards, Disband Unit & Taxation Test Suite (Task 1.4).
 *
 * @module __tests__/unit/edicts_disband.spec
 */

import { describe, it, expect } from 'vitest'
import { createInitialGameState } from '@/core/state'
import { dispatch } from '@/core/commands'
import { tick, calculateGrossApRate } from '@/core/engine'
import { assertDemographicInvariant } from './demographics.spec'

describe('Task 1.4: Emergency Edicts, Disband Unit & Dynamic Fiscality', () => {
  describe('Emergency Edicts Safeguards (§11)', () => {
    it('enforces strictly one emergency edict per deadline', () => {
      const state = createInitialGameState()
      state.deadline = 1
      state.ap = 1000

      // First edict succeeds
      const edict1 = dispatch(state, { type: 'ENACT_EDICT', edictId: 'forced_tithe' })
      expect(edict1.success).toBe(true)
      expect(state.lastEdictDeadline).toBe(1)
      expect(state.edictUsageCounts.forced_tithe).toBe(1)

      // Second edict in the same deadline is rejected
      const edict2 = dispatch(state, { type: 'ENACT_EDICT', edictId: 'church_seizure' })
      expect(edict2.success).toBe(false)
      expect(edict2.error).toContain('Only one emergency edict is permitted per deadline')

      // Advance to deadline 2: edict is permitted again
      state.deadline = 2
      const edict3 = dispatch(state, { type: 'ENACT_EDICT', edictId: 'church_seizure' })
      expect(edict3.success).toBe(true)
      expect(state.lastEdictDeadline).toBe(2)
      expect(state.edictUsageCounts.church_seizure).toBe(1)
    })

    it('applies escalating penalties (+50% per prior use) on repeated edicts', () => {
      const state = createInitialGameState()
      state.unrest = 10
      state.deadline = 1

      // 1st use (k=0, mult=1.0): +35 Unrest -> unrest becomes 45
      dispatch(state, { type: 'ENACT_EDICT', edictId: 'forced_tithe' })
      expect(state.unrest).toBeCloseTo(45, 1)

      // 2nd use in D2 (k=1, mult=1.5): +35 * 1.5 = +52.5 Unrest -> 45 + 52.5 = 97.5
      state.deadline = 2
      dispatch(state, { type: 'ENACT_EDICT', edictId: 'forced_tithe' })
      expect(state.unrest).toBeCloseTo(97.5, 1)
      expect(state.edictUsageCounts.forced_tithe).toBe(2)
    })

    it('forced_tithe adds 30s poll tax without crediting quota counters, and freezes pop growth for 20s', () => {
      const state = createInitialGameState()
      const initialAp = state.ap
      const initialQuotaAp = state.cumulativeApThisDeadline

      const rates = calculateGrossApRate(state)
      const expectedTithe = 30 * rates.pollTax

      dispatch(state, { type: 'ENACT_EDICT', edictId: 'forced_tithe' })

      expect(state.ap).toBeCloseTo(initialAp + expectedTithe, 1)
      // Zero AP quota credit!
      expect(state.cumulativeApThisDeadline).toBe(initialQuotaAp)
      expect(state.totalCumulativeAp).toBe(0)
      expect(state.forcedTitheFreezeTimer).toBe(20)

      // In tick(), growth is frozen while forcedTitheFreezeTimer > 0
      const popBefore = state.totalPopulation
      tick(state, 5.0)
      expect(state.totalPopulation).toBe(popBefore) // No growth!
      expect(state.forcedTitheFreezeTimer).toBeCloseTo(15.0, 1)
    })

    it('church_seizure is capped at 2 uses per run and adds expiring pacification reduction', () => {
      const state = createInitialGameState()
      state.totalElapsedSeconds = 100

      // 1st use in D1: succeeds
      state.deadline = 1
      const res1 = dispatch(state, { type: 'ENACT_EDICT', edictId: 'church_seizure' })
      expect(res1.success).toBe(true)
      expect(state.edictUsageCounts.church_seizure).toBe(1)
      expect(state.cumulativeApThisDeadline).toBe(0) // No quota credit

      const mod1 = state.activeModifiers.find((m) => m.source === 'edict:church_seizure')
      expect(mod1).toBeDefined()
      expect(mod1?.expiresAt).toBe(100 + 60)

      // 2nd use in D2: succeeds
      state.deadline = 2
      const res2 = dispatch(state, { type: 'ENACT_EDICT', edictId: 'church_seizure' })
      expect(res2.success).toBe(true)
      expect(state.edictUsageCounts.church_seizure).toBe(2)

      // 3rd use in D3: strictly rejected!
      state.deadline = 3
      const res3 = dispatch(state, { type: 'ENACT_EDICT', edictId: 'church_seizure' })
      expect(res3.success).toBe(false)
      expect(res3.error).toContain('Maximum of 2 church seizures permitted per run')
    })

    it('grand_festival calculates dynamic cost and is rejected if treasury cannot afford it (e.g. ap = -1000)', () => {
      const state = createInitialGameState()
      state.ap = -1000 // In debt
      state.unrest = 50

      // Festival cost is >= 100 AP, cannot afford with negative treasury
      const res = dispatch(state, { type: 'ENACT_EDICT', edictId: 'grand_festival' })
      expect(res.success).toBe(false)
      expect(res.error).toContain('Insufficient funds')
      expect(state.ap).toBe(-1000) // Unchanged
      expect(state.unrest).toBe(50) // Unchanged

      // Provide ample AP: cost = max(100, 0.20 * 2000 = 400, 30 * grossApRate)
      state.ap = 2000
      const grossAp = calculateGrossApRate(state).total
      const expectedCost = Math.max(100, 400, 30 * grossAp)

      const successRes = dispatch(state, { type: 'ENACT_EDICT', edictId: 'grand_festival' })
      expect(successRes.success).toBe(true)
      expect(state.ap).toBeCloseTo(2000 - expectedCost, 1)
      expect(state.unrest).toBe(30) // 50 - 20
    })
  })

  describe('Demobilization (DISBAND_UNIT, §14.1)', () => {
    it('disbands units with severance paid from positive treasury and returns serfs', () => {
      const state = createInitialGameState()
      state.ap = 500
      state.units.peasant = 10
      state.freeSerfs = 90
      state.totalPopulation = 100

      assertDemographicInvariant(state)

      // Peasant baseCost = 20 -> severance = 10 each. 5 peasants = 50 AP.
      const res = dispatch(state, { type: 'DISBAND_UNIT', unitId: 'peasant', count: 5 })
      expect(res.success).toBe(true)
      expect(state.units.peasant).toBe(5)
      expect(state.freeSerfs).toBe(95)
      expect(state.totalPopulation).toBe(100)
      expect(state.ap).toBe(450)
      expect(state.unrest).toBe(10) // Fully paid -> 0 unrest
      assertDemographicInvariant(state)
    })

    it('handles unpaid disbanding when treasury is insufficient with +2 Unrest per unpaid unit', () => {
      const state = createInitialGameState()
      state.ap = 25 // Can only pay for 2 peasants (2 * 10 = 20 AP), leaving 3 unpaid
      state.unrest = 10
      state.units.peasant = 10
      state.freeSerfs = 90
      state.totalPopulation = 100

      const res = dispatch(state, { type: 'DISBAND_UNIT', unitId: 'peasant', count: 5 })
      expect(res.success).toBe(true)
      expect(state.units.peasant).toBe(5)
      expect(state.freeSerfs).toBe(95)
      expect(state.totalPopulation).toBe(100)
      expect(state.ap).toBe(5) // 25 - 20
      // 3 unpaid units * 2 Unrest = +6 Unrest -> 10 + 6 = 16
      expect(state.unrest).toBe(16)
      assertDemographicInvariant(state)
    })

    it('allows disbanding without AP when insolvent (ap < 0) with all units unpaid (+2 Unrest each)', () => {
      const state = createInitialGameState()
      state.ap = -500 // Insolvent
      state.unrest = 10
      state.units.peasant = 10
      state.freeSerfs = 90

      const res = dispatch(state, { type: 'DISBAND_UNIT', unitId: 'peasant', count: 4 })
      expect(res.success).toBe(true)
      expect(state.ap).toBe(-500) // Insolvent treasury is untouched
      expect(state.units.peasant).toBe(6)
      expect(state.freeSerfs).toBe(94)
      // 4 unpaid units * 2 = +8 Unrest
      expect(state.unrest).toBe(18)
      assertDemographicInvariant(state)
    })

    it('triggers mutiny spike (+15 Unrest) when disbanding > 10% of military within 10 seconds', () => {
      const state = createInitialGameState()
      state.ap = 10000
      state.unrest = 10
      state.units.soldier = 50
      state.totalPopulation = 150
      state.freeSerfs = 100
      state.totalElapsedSeconds = 50

      assertDemographicInvariant(state)

      // Disband 10 soldiers out of 50 (20% > 10%)
      const res = dispatch(state, { type: 'DISBAND_UNIT', unitId: 'soldier', count: 10 })
      expect(res.success).toBe(true)
      expect(state.units.soldier).toBe(40)
      expect(state.freeSerfs).toBe(110)
      expect(state.totalPopulation).toBe(150)
      // Mutiny spike (+15 Unrest): 10 starting unrest + 15 = 25
      expect(state.unrest).toBe(25)
      // History cleared after mutiny spike
      expect(state.disbandedMilitaryHistory).toHaveLength(0)
      assertDemographicInvariant(state)
    })
  })

  describe('Dynamic Fiscality (SET_TAX_RATE, §14.2)', () => {
    it('applies downward tax rate adjustments immediately without promulgation delay', () => {
      const state = createInitialGameState()
      state.taxRate = 35

      const res = dispatch(state, { type: 'SET_TAX_RATE', rate: 20 })
      expect(res.success).toBe(true)
      expect(state.taxRate).toBe(20)
      expect(state.pendingTaxRate).toBeNull()
      expect(state.taxPromulgationTimer).toBe(0)
    })

    it('applies upward tax rate adjustments with 8s promulgation delay and fiscal shock', () => {
      const state = createInitialGameState()
      state.taxRate = 25
      state.unrest = 10

      // Increase from 25% to 45% (delta = 20 > 15 threshold)
      const res = dispatch(state, { type: 'SET_TAX_RATE', rate: 45 })
      expect(res.success).toBe(true)
      expect(state.taxRate).toBe(25) // Not applied immediately!
      expect(state.pendingTaxRate).toBe(45)
      expect(state.taxPromulgationTimer).toBe(8)
      // Tax shock (+20 Unrest): 10 + 20 = 30
      expect(state.unrest).toBe(30)

      // Tick 8 seconds
      tick(state, 8.0)
      expect(state.taxRate).toBe(45) // Promulgated!
      expect(state.pendingTaxRate).toBeNull()
      expect(state.taxPromulgationTimer).toBe(0)
    })

    it('rejects non-finite tax rates', () => {
      const state = createInitialGameState()
      const res = dispatch(state, { type: 'SET_TAX_RATE', rate: NaN })
      expect(res.success).toBe(false)
      expect(res.error).toContain('finite')
    })
  })
})
