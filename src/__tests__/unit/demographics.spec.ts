/**
 * Demographic Invariant, Signed Treasury, Overcrowding & Military Desertion Test Suite (Task 1.3).
 *
 * @module __tests__/unit/demographics.spec
 */

import { describe, it, expect } from 'vitest'
import { createInitialGameState } from '@/core/state'
import { applyPopulationLoss } from '@/core/mutations'
import { applyEffect } from '@/core/modifiers'
import { tick } from '@/core/engine'
import { resolveDefensiveClash, resolveScheduledThreat } from '@/core/battle'
import { dispatch } from '@/core/commands'
import type { GameState } from '@/core/types'

/** Helper to sum all unit counts in GameState */
export function sumUnits(state: GameState): number {
  return Object.values(state.units).reduce((acc, count) => acc + (count ?? 0), 0)
}

/** Asserts the Demographic Invariant: TotalPopulation === FreeSerfs + sum(Units) */
export function assertDemographicInvariant(state: GameState): void {
  const unitsTotal = sumUnits(state)
  const balance = Math.abs(state.totalPopulation - (state.freeSerfs + unitsTotal))
  expect(balance).toBeLessThan(1e-6)
}

describe('Task 1.3: Demographic Invariant, Signed Treasury & Military Desertion', () => {
  describe('Demographic Invariant & applyPopulationLoss (§3.1)', () => {
    it('deducts loss primarily from freeSerfs when sufficient serfs exist', () => {
      const state = createInitialGameState()
      state.totalPopulation = 100
      state.freeSerfs = 100
      state.units.peasant = 0

      assertDemographicInvariant(state)
      const lost = applyPopulationLoss(state, 30)

      expect(lost).toBe(30)
      expect(state.totalPopulation).toBe(70)
      expect(state.freeSerfs).toBe(70)
      assertDemographicInvariant(state)
    })

    it('cascades excess loss to units in deterministic order (Tier I civil -> Tier II civil -> military)', () => {
      const state = createInitialGameState()
      state.totalPopulation = 25
      state.freeSerfs = 5
      state.units.peasant = 10 // Tier 1 civil
      state.units.farmer = 5 // Tier 2 civil
      state.units.soldier = 5 // Tier 1 military

      assertDemographicInvariant(state)

      // Loss of 20: 5 from freeSerfs, 10 from peasants (Tier 1 civil exhausted), 5 from farmers (Tier 2 civil)
      const lost = applyPopulationLoss(state, 20)

      expect(lost).toBe(20)
      expect(state.freeSerfs).toBe(0)
      expect(state.units.peasant).toBe(0)
      expect(state.units.farmer).toBe(0)
      expect(state.units.soldier).toBe(5) // Soldiers untouched!
      expect(state.totalPopulation).toBe(5)
      assertDemographicInvariant(state)
    })

    it('tracks starvationLosses counter when isStarvation is true', () => {
      const state = createInitialGameState()
      expect(state.starvationLosses).toBe(0)

      applyPopulationLoss(state, 12, true)
      expect(state.starvationLosses).toBe(12)

      applyPopulationLoss(state, 8, true)
      expect(state.starvationLosses).toBe(20)

      // Non-starvation loss does not increment starvationLosses
      applyPopulationLoss(state, 5, false)
      expect(state.starvationLosses).toBe(20)
    })
  })

  describe('Proportional Overcrowding (§14.3)', () => {
    it('applies proportional unrest: +0.10/s per 50 excess inhabitants up to +1.0/s', () => {
      const state = createInitialGameState()
      // Starting capacity is 750 (3 provinces * 250)
      // Test at 850 pop (100 excess): rate = 0.10 * (100 / 50) = 0.20/s
      state.totalPopulation = 850
      state.freeSerfs = 850
      state.unrest = 10

      tick(state, 1.0)
      // Bleed = 2.5 pop
      expect(state.totalPopulation).toBeCloseTo(847.5, 2)
      expect(state.starvationLosses).toBeCloseTo(2.5, 2)
      // Unrest rate for 100 excess = 0.20/s -> unrest becomes 10.20
      expect(state.unrest).toBeCloseTo(10.2, 1)
      assertDemographicInvariant(state)
    })

    it('caps overcrowding unrest at +1.0/s when excess is extreme', () => {
      const state = createInitialGameState()
      // 1500 pop with 750 cap (750 excess): 0.10 * (750 / 50) = 1.50 -> capped at 1.00/s
      state.totalPopulation = 1500
      state.freeSerfs = 1500
      state.unrest = 10

      tick(state, 1.0)
      expect(state.unrest).toBeCloseTo(11.0, 1)
      assertDemographicInvariant(state)
    })
  })

  describe('Military Desertion (§6.5, Arbitrage 1.0 §2)', () => {
    it('deserts 1 soldier every 15s during unrest >= 75 and decrements totalPopulation', () => {
      const state = createInitialGameState()
      state.unrest = 80 // Stage strife_desertion
      state.units.soldier = 5
      state.totalPopulation = 105
      state.freeSerfs = 100

      assertDemographicInvariant(state)

      // 14 seconds: no desertion yet
      tick(state, 14.0)
      expect(state.units.soldier).toBe(5)
      expect(state.desertionTimer).toBeCloseTo(14.0, 1)
      assertDemographicInvariant(state)

      // 2 more seconds (total 16s >= 15s): 1 soldier deserts
      tick(state, 2.0)
      expect(state.units.soldier).toBe(4)
      expect(state.totalPopulation).toBe(104)
      expect(state.desertionTimer).toBeCloseTo(1.0, 1) // 16 - 15 = 1s left
      assertDemographicInvariant(state)
    })

    it('falls back to 1 man_at_arms every 30s when 0 soldiers remain', () => {
      const state = createInitialGameState()
      state.ap = 5000 // Prevent bankruptcy countdown during 30s simulation
      state.unrest = 80
      state.units.soldier = 0
      state.units.man_at_arms = 3
      state.totalPopulation = 103
      state.freeSerfs = 100

      // 29 seconds: no desertion
      tick(state, 29.0)
      expect(state.units.man_at_arms).toBe(3)
      expect(state.desertionTimer).toBeCloseTo(29.0, 1)

      // 2 more seconds: 31s >= 30s -> 1 man_at_arms deserts
      tick(state, 2.0)
      expect(state.units.man_at_arms).toBe(2)
      expect(state.totalPopulation).toBe(102)
      expect(state.desertionTimer).toBeCloseTo(1.0, 1)
      assertDemographicInvariant(state)
    })

    it('continues desertion at 95% unrest (urban_rebellion stage)', () => {
      const state = createInitialGameState()
      state.unrest = 95 // urban_rebellion
      state.units.soldier = 2
      state.totalPopulation = 102
      state.freeSerfs = 100

      tick(state, 15.0)
      expect(state.units.soldier).toBe(1)
      expect(state.totalPopulation).toBe(101)
      assertDemographicInvariant(state)
    })

    it('blocks desertion below 90% unrest with Sanctuary Rights law, but resumes at >= 90%', () => {
      const state = createInitialGameState()
      state.ruleFlags.push('law:sanctuary_rights')
      state.units.soldier = 3
      state.totalPopulation = 103
      state.freeSerfs = 100

      // At 80% unrest (< 90%): desertion blocked and timer reset to 0
      state.unrest = 80
      tick(state, 30.0)
      expect(state.units.soldier).toBe(3)
      expect(state.desertionTimer).toBe(0)

      // At 92% unrest (>= 90%): desertion resumes
      state.unrest = 92
      tick(state, 16.0)
      expect(state.units.soldier).toBe(2)
      expect(state.totalPopulation).toBe(102)
      assertDemographicInvariant(state)
    })

    it('regression: no immediate desertion when recruiting soldier after 60s at 80% unrest without military', () => {
      const state = createInitialGameState()
      state.unrest = 80
      state.units.soldier = 0
      state.units.man_at_arms = 0

      // Run 60s without any military units
      tick(state, 60.0)
      // Timer MUST stay at 0
      expect(state.desertionTimer).toBe(0)

      // Now grant 1 soldier
      state.units.soldier = 1
      state.totalPopulation += 1

      // 10s tick: total timer 10s < 15s threshold -> soldier does NOT desert immediately
      tick(state, 10.0)
      expect(state.units.soldier).toBe(1)
      expect(state.desertionTimer).toBeCloseTo(10.0, 1)
      assertDemographicInvariant(state)
    })
  })

  describe('Signed Treasury & applyEffect (§1.0 Arbitrages 3-4)', () => {
    it('regression: ap = -500 + instant AP 100 yields -400 without zero clamp or quota credit', () => {
      const state = createInitialGameState()
      state.ap = -500
      state.cumulativeApThisDeadline = 0

      applyEffect({ type: 'instant_resource', resource: 'ap', amount: 100 }, state)

      expect(state.ap).toBe(-400) // Not clamped to 0!
      expect(state.cumulativeApThisDeadline).toBe(0) // Does not credit quota!
      expect(state.totalCumulativeAp).toBe(0)
    })

    it('grant_units consumes freeSerfs by default to preserve demographic invariant', () => {
      const state = createInitialGameState()
      state.totalPopulation = 100
      state.freeSerfs = 100

      applyEffect({ type: 'grant_units', unitId: 'peasant', count: 10 }, state)

      expect(state.units.peasant).toBe(10)
      expect(state.freeSerfs).toBe(90)
      expect(state.totalPopulation).toBe(100)
      assertDemographicInvariant(state)
    })

    it('grant_units with external: true increments totalPopulation', () => {
      const state = createInitialGameState()
      state.totalPopulation = 100
      state.freeSerfs = 100

      applyEffect({ type: 'grant_units', unitId: 'soldier', count: 5, external: true }, state)

      expect(state.units.soldier).toBe(5)
      expect(state.freeSerfs).toBe(100) // freeSerfs untouched
      expect(state.totalPopulation).toBe(105)
      assertDemographicInvariant(state)
    })

    it('instant_resource population negative uses applyPopulationLoss and preserves invariant', () => {
      const state = createInitialGameState()
      state.totalPopulation = 100
      state.freeSerfs = 10
      state.units.peasant = 90

      assertDemographicInvariant(state)

      // Loss of 20: 10 from freeSerfs, 10 from peasant
      applyEffect({ type: 'instant_resource', resource: 'population', amount: -20 }, state)

      expect(state.freeSerfs).toBe(0)
      expect(state.units.peasant).toBe(80)
      expect(state.totalPopulation).toBe(80)
      assertDemographicInvariant(state)
    })
  })

  describe('Battle Demographic Invariant Preservation (§3.1)', () => {
    it('preserves demographic invariant during defensive collapse with civilian casualties', () => {
      const state = createInitialGameState()
      state.totalPopulation = 200
      state.freeSerfs = 150
      state.units.soldier = 30
      state.units.peasant = 20
      assertDemographicInvariant(state)

      // Player force = 0, enemy force = 1000 -> guaranteed collapse
      const res = resolveDefensiveClash(state, 0, 1000)
      expect(res.isCollapse).toBe(true)
      expect(state.units.soldier).toBe(0) // Soldiers wiped out
      assertDemographicInvariant(state)
    })

    it('preserves demographic invariant during levy en masse threat response', () => {
      const state = createInitialGameState()
      state.totalPopulation = 100
      state.freeSerfs = 2 // Very few free serfs so casualties cascade to units
      state.units.peasant = 98
      assertDemographicInvariant(state)

      const res = resolveScheduledThreat(state, 'levy', 50, 100)
      expect(res.success).toBe(true)
      assertDemographicInvariant(state)
    })
  })

  describe('Province Biomes Synchronization', () => {
    it('pushes heartland biome on COLONISE_PROVINCE and keeps provinces === provinceBiomes.length', () => {
      const state = createInitialGameState()
      expect(state.provinces).toBe(3)
      expect(state.provinceBiomes).toEqual(['heartland', 'heartland', 'heartland'])

      state.ap = 5000
      const res = dispatch(state, { type: 'COLONISE_PROVINCE' })
      expect(res.success).toBe(true)
      expect(state.provinces).toBe(4)
      expect(state.provinceBiomes.length).toBe(4)
      expect(state.provinceBiomes[3]).toBe('heartland')
    })

    it('pops provinceBiomes on ACCEPT_LOMBARD_LOAN and keeps provinces === provinceBiomes.length', () => {
      const state = createInitialGameState()
      state.provinces = 3
      state.provinceBiomes = ['heartland', 'heartland', 'heartland']
      state.phase = 'LOMBARD_OFFER'
      state.lombardBailoutAvailable = true

      const res = dispatch(state, { type: 'ACCEPT_LOMBARD_LOAN' })
      expect(res.success).toBe(true)
      expect(state.provinces).toBe(2)
      expect(state.provinceBiomes.length).toBe(2)
    })
  })
})
