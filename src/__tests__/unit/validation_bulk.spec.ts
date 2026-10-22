/**
 * Input Validation, Click Harmonization, Bulk Ceilings & Buy Max Test Suite (Task 1.5).
 *
 * @module __tests__/unit/validation_bulk.spec
 */

import { describe, it, expect } from 'vitest'
import { createInitialGameState } from '@/core/state'
import { dispatch } from '@/core/commands'
import { getMaxBulkSize, calculateMaxAffordableUnits } from '@/core/formulas'
import { ALLOWED_COMMANDS_BY_PHASE } from '@/core/phases'
import type { Command } from '@/core/types'
import {
  calculateMaxPopulation,
  calculateNetPaperwork,
  calculateGrossApRate,
  getBiomeModifiers,
} from '@/core/engine'
import { UNITS_DATA, type UnitId } from '@/data/balance'

describe('Task 1.5: Strict Validation, Bulk Purchasing & Engine Helper Harmonization', () => {
  describe('Dispatch & Command Input Validation (§1.5)', () => {
    it('strictly rejects non-positive or non-finite dt values in TICK command', () => {
      const state = createInitialGameState()

      const res0 = dispatch(state, { type: 'TICK', dt: 0 })
      expect(res0.success).toBe(false)
      expect(res0.error).toContain('positive finite')

      const resNeg = dispatch(state, { type: 'TICK', dt: -0.5 })
      expect(resNeg.success).toBe(false)

      const resNaN = dispatch(state, { type: 'TICK', dt: NaN })
      expect(resNaN.success).toBe(false)

      const resInf = dispatch(state, { type: 'TICK', dt: Infinity })
      expect(resInf.success).toBe(false)
    })

    it('strictly rejects non-integer or non-positive unit counts in BUY_UNIT', () => {
      const state = createInitialGameState()
      state.ap = 10000

      const resFractional = dispatch(state, {
        type: 'BUY_UNIT',
        unitId: 'peasant',
        count: 2.5,
      })
      expect(resFractional.success).toBe(false)
      expect(resFractional.error).toContain('positive integer')

      const resZero = dispatch(state, {
        type: 'BUY_UNIT',
        unitId: 'peasant',
        count: 0,
      })
      expect(resZero.success).toBe(false)

      const resNeg = dispatch(state, {
        type: 'BUY_UNIT',
        unitId: 'peasant',
        count: -1,
      })
      expect(resNeg.success).toBe(false)
    })

    it('returns error on unhandled / unsupported commands in default dispatch', () => {
      const state = createInitialGameState()
      const allowed = ALLOWED_COMMANDS_BY_PHASE.ACTIVE_CYCLE as unknown as string[]
      allowed.push('MOCK_UNHANDLED_COMMAND')
      try {
        const res = dispatch(state, { type: 'MOCK_UNHANDLED_COMMAND' } as unknown as Command)
        expect(res.success).toBe(false)
        expect(res.error).toContain('Unsupported command')
      } finally {
        allowed.pop()
      }
    })
  })

  describe('Bulk Purchasing Maxima (getMaxBulkSize, §5.1 & Arbitrage 1.0 §8)', () => {
    it('calculates correct max bulk size milestones', () => {
      const peasantDef = UNITS_DATA.peasant
      const soldierDef = UNITS_DATA.soldier

      // D1, Pop < 250 -> 1
      expect(getMaxBulkSize(1, 100, peasantDef)).toBe(1)
      expect(getMaxBulkSize(2, 240, peasantDef)).toBe(1)

      // Pop >= 250 or D >= 3 -> 10
      expect(getMaxBulkSize(1, 250, peasantDef)).toBe(10)
      expect(getMaxBulkSize(3, 100, peasantDef)).toBe(10)
      expect(getMaxBulkSize(5, 500, soldierDef)).toBe(10)

      // Pop >= 1000 or D >= 6 -> 50
      expect(getMaxBulkSize(1, 1000, peasantDef)).toBe(50)
      expect(getMaxBulkSize(6, 100, peasantDef)).toBe(50)
      expect(getMaxBulkSize(7, 500, soldierDef)).toBe(50)

      // D >= 8 and allowsBulk100 -> 100
      expect(peasantDef.allowsBulk100).toBe(true)
      expect(getMaxBulkSize(8, 100, peasantDef)).toBe(100)
      expect(getMaxBulkSize(10, 5000, peasantDef)).toBe(100)

      // D >= 8 but allowsBulk100 is false -> 50
      expect(soldierDef.allowsBulk100).toBe(false)
      expect(getMaxBulkSize(8, 100, soldierDef)).toBe(50)
      expect(getMaxBulkSize(10, 5000, soldierDef)).toBe(50)
    })

    it('enforces bulk purchase ceilings in BUY_UNIT', () => {
      const state = createInitialGameState()
      state.deadline = 1
      state.totalPopulation = 100
      state.freeSerfs = 100
      state.ap = 100000

      // In D1 with 100 pop, max bulk is 1 -> buying 99 is rejected!
      const res99 = dispatch(state, { type: 'BUY_UNIT', unitId: 'peasant', count: 99 })
      expect(res99.success).toBe(false)
      expect(res99.error).toContain('maximum bulk size')

      // Buying 1 succeeds
      const res1 = dispatch(state, { type: 'BUY_UNIT', unitId: 'peasant', count: 1 })
      expect(res1.success).toBe(true)

      // Advance to D8: buying 100 soldiers is rejected (allowsBulk100: false)
      state.deadline = 8
      const res100Soldier = dispatch(state, { type: 'BUY_UNIT', unitId: 'soldier', count: 100 })
      expect(res100Soldier.success).toBe(false)
      expect(res100Soldier.error).toContain('maximum bulk size')

      // But buying 50 soldiers is allowed in D8
      const res50Soldier = dispatch(state, { type: 'BUY_UNIT', unitId: 'soldier', count: 50 })
      expect(res50Soldier.success).toBe(true)

      // And buying 100 peasants is allowed in D8 (with sufficient AP and serfs)
      state.ap = 1000000
      state.freeSerfs = 200
      const res100Peasant = dispatch(state, { type: 'BUY_UNIT', unitId: 'peasant', count: 100 })
      expect(res100Peasant.success).toBe(true)
    })
  })

  describe('Buy Max (calculateMaxAffordableUnits) Invariants & Accuracy', () => {
    it('never returns fractional counts when freeSerfs or orderHeadroom are fractional', () => {
      // Fractional freeSerfs = 15.8 -> must return 15
      const count = calculateMaxAffordableUnits('scribe', 0, 10000, 15.8, 100)
      expect(count).toBe(15)
      expect(Number.isInteger(count)).toBe(true)

      // Fractional orderHeadroom = 7.4 -> must return 7
      const count2 = calculateMaxAffordableUnits('scribe', 0, 10000, 100, 7.4)
      expect(count2).toBe(7)
      expect(Number.isInteger(count2)).toBe(true)
    })

    it('caps Buy Max by maxBulkSize when provided', () => {
      const count = calculateMaxAffordableUnits('peasant', 0, 100000, 1000, 1000, 10)
      expect(count).toBe(10)
    })

    it('property test: BUY_UNIT always succeeds with the count returned by Buy Max', () => {
      const testUnits: UnitId[] = ['peasant', 'scribe', 'soldier']
      const budgets = [25, 50, 150, 500, 1500, 5000]
      const currentOwnedValues = [0, 5, 15]

      for (const unitId of testUnits) {
        for (const budget of budgets) {
          for (const currentOwned of currentOwnedValues) {
            const state = createInitialGameState()
            state.deadline = 8 // High bulk limit
            state.totalPopulation = 2000
            state.freeSerfs = 1000
            state.ap = budget
            state.units[unitId] = currentOwned

            const def = UNITS_DATA[unitId]
            const maxBulk = getMaxBulkSize(state.deadline, state.totalPopulation, def)
            const maxPop = calculateMaxPopulation(state)
            const orderCaps = {
              people: Math.floor(maxPop * 0.25),
              admin: Math.floor(maxPop * 0.15),
              military: Math.floor(maxPop * 0.12),
            }
            const orderHeadroom = Math.max(0, orderCaps[def.order] - currentOwned)

            const affordable = calculateMaxAffordableUnits(
              unitId,
              currentOwned,
              state.ap,
              state.freeSerfs,
              orderHeadroom,
              maxBulk,
            )

            const res =
              affordable > 0
                ? dispatch(state, {
                    type: 'BUY_UNIT',
                    unitId,
                    count: affordable,
                  })
                : { success: true, error: undefined }

            expect(
              res.success,
              `BUY_UNIT failed for ${affordable}x ${unitId} with budget ${budget}`,
            ).toBe(true)
          }
        }
      }
    })
  })

  describe('Shared Helpers & STAMP_DOCUMENT Harmonization', () => {
    it('calculateMaxPopulation aggregates biomes and stat modifiers', () => {
      const state = createInitialGameState()
      // 3 heartland provinces: 3 * 250 = 750
      expect(calculateMaxPopulation(state)).toBe(750)

      // State with a modifier to housing_capacity
      const stateWithMod = createInitialGameState()
      stateWithMod.activeModifiers.push({
        source: 'law:test',
        stat: 'housing_capacity',
        op: 'addPct',
        value: 0.2,
      })
      expect(calculateMaxPopulation(stateWithMod)).toBe(900)
    })

    it('calculateNetPaperwork integrates biome reduction and stat modifiers', () => {
      const state = createInitialGameState()
      const basePaperwork = calculateNetPaperwork(state)
      expect(basePaperwork).toBeGreaterThanOrEqual(0)
      expect(basePaperwork).toBeLessThan(1.0)
    })

    it('STAMP_DOCUMENT uses calculateGrossApRate and persists click PRNG stream', () => {
      // Normal click test with seed 1 (prng.next() >= 0.05)
      const normalState = createInitialGameState()
      normalState.clickTokens = 5
      normalState.units.scribe = 10
      normalState.ap = 0
      const grossRate = calculateGrossApRate(normalState).total
      expect(grossRate).toBeGreaterThan(0)
      normalState.rngStreams.click = 1

      const initialStreamState = normalState.rngStreams.click
      const resNormal = dispatch(normalState, { type: 'STAMP_DOCUMENT' })
      expect(resNormal.success).toBe(true)
      expect(resNormal.events?.[0]).toContain('Affixed Royal Decree')
      expect(normalState.ap).toBeGreaterThan(0)
      expect(normalState.clickTokens).toBe(4)
      expect(normalState.rngStreams.click).not.toBe(initialStreamState)

      // Critical click test with seed 7 (prng.next() = 0.0117 < 0.05)
      const critState = createInitialGameState()
      critState.clickTokens = 5
      critState.units.scribe = 10
      critState.ap = 0
      critState.rngStreams.click = 7

      const resCrit = dispatch(critState, { type: 'STAMP_DOCUMENT' })
      expect(resCrit.success).toBe(true)
      expect(resCrit.events?.[0]).toContain('CRITICAL STAMP!')
      // Critical hit applies x3 multiplier
      expect(critState.ap).toBeCloseTo(normalState.ap * 3, 1)
      expect(critState.rngStreams.click).not.toBe(7)
    })

    it('getBiomeModifiers returns neutral multipliers on initial state (heartland)', () => {
      const state = createInitialGameState()
      const biomes = getBiomeModifiers(state)
      expect(biomes.housingMultiplier).toBe(1.0)
      expect(biomes.deltaR).toBe(0)
      expect(biomes.taxEfficiencyBonus).toBe(0)
      expect(biomes.passiveDefense).toBe(0)
      expect(biomes.paperworkReduction).toBe(0)
    })
  })
})
