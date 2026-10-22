/**
 * Unit Test Suite for Mathematical Models & Core Game Formulas.
 * Validates deterministic mathematical scaling, bounds, and boundary edge cases.
 *
 * @module __tests__/unit/formulas.spec
 */

import { describe, it, expect } from 'vitest'
import {
  calculateUnitCost,
  calculateMaxAffordableUnits,
  refillTokenBucket,
  calculateClickValue,
  calculateHousingCapacity,
  calculateColonisationCost,
  calculateCollectorYield,
  calculatePaperworkFriction,
  calculateFiscalFactor,
  calculateLogisticGrowth,
  calculateOrderCaps,
  getUnrestCrisisStage,
} from '@/core/formulas'
import { BALANCE, UNITS_DATA } from '@/data/balance'

describe('Core Formulas & Mathematical Scaling (Gate A)', () => {
  describe('Unit Cost Geometric Scaling', () => {
    it('scales Tier I unit costs at exact ratio 1.07', () => {
      const scribe = UNITS_DATA.scribe
      expect(scribe.costRatio).toBe(1.07)

      // n=0: base = 15
      expect(calculateUnitCost('scribe', 0, 1)).toBe(15)

      // n=1: 15 * 1.07 = 16.05
      expect(calculateUnitCost('scribe', 1, 1)).toBe(16.05)

      // n=25: 15 * 1.07^25 = 81.41
      expect(calculateUnitCost('scribe', 25, 1)).toBeCloseTo(81.41, 1)
    })

    it('scales Tier II unit costs at exact ratio 1.05', () => {
      const clerk = UNITS_DATA.clerk
      expect(clerk.costRatio).toBe(1.05)

      // n=0: base = 100
      expect(calculateUnitCost('clerk', 0, 1)).toBe(100)

      // n=1: 100 * 1.05 = 105
      expect(calculateUnitCost('clerk', 1, 1)).toBe(105)

      // n=50: 100 * 1.05^50 = 1146.74
      expect(calculateUnitCost('clerk', 50, 1)).toBeCloseTo(1146.74, 1)
    })

    it('calculates bulk purchasing sums accurately (1x, 10x, 50x, 100x)', () => {
      // 10 Scribes at n=0 with r=1.07: 15 * (1.07^10 - 1) / 0.07 = 207.25
      const bulk10 = calculateUnitCost('scribe', 0, 10)
      expect(bulk10).toBeCloseTo(207.25, 1)

      // 50 Scribes at n=0: 15 * (1.07^50 - 1) / 0.07 = 6097.93
      const bulk50 = calculateUnitCost('scribe', 0, 50)
      expect(bulk50).toBeCloseTo(6097.93, 1)

      // Count <= 0 returns 0
      expect(calculateUnitCost('scribe', 0, 0)).toBe(0)
      expect(calculateUnitCost('scribe', 0, -5)).toBe(0)
    })

    it('inverts geometric sum for Buy Max respecting all constraints', () => {
      // Scribe base 15, r 1.07
      // 15 AP -> exactly 1
      expect(calculateMaxAffordableUnits('scribe', 0, 15, 100, 100)).toBe(1)

      // 200 AP -> 9 units
      expect(calculateMaxAffordableUnits('scribe', 0, 200, 100, 100)).toBe(9)

      // Constrained by free serfs
      expect(calculateMaxAffordableUnits('scribe', 0, 5000, 4, 100)).toBe(4)

      // Constrained by order headroom
      expect(calculateMaxAffordableUnits('scribe', 0, 5000, 100, 3)).toBe(3)

      // Edge cases: zero budget, zero serfs, zero headroom
      expect(calculateMaxAffordableUnits('scribe', 0, 0, 100, 100)).toBe(0)
      expect(calculateMaxAffordableUnits('scribe', 0, 5000, 0, 100)).toBe(0)
      expect(calculateMaxAffordableUnits('scribe', 0, 5000, 100, 0)).toBe(0)
    })
  })

  describe('Clicker Ergonomics & Token Bucket', () => {
    it('refills tokens deterministically via injected delta-time capped at max', () => {
      // 12 tokens/s: in 0.5s refilling from 0 yields 6
      expect(refillTokenBucket(0, 0.5, 12)).toBe(6)

      // In 2.0s, caps at 12
      expect(refillTokenBucket(10, 2.0, 12)).toBe(12)
    })

    it('calculates click value with gross AP scaling and critical wax seal', () => {
      // Gross AP/s = 0 -> 1.0 AP
      expect(calculateClickValue(0)).toBe(1.0)

      // Gross AP/s = 100 -> 1 + 100 * 0.035 = 4.5 AP
      expect(calculateClickValue(100)).toBe(4.5)

      // Critical stamp delivers 3x click value
      expect(calculateClickValue(100, 1.0, true)).toBe(13.5)

      // With active decree seal multiplier (e.g. 2.0)
      expect(calculateClickValue(100, 2.0, false)).toBe(9.0)
    })
  })

  describe('Demographics, Housing & Colonisation', () => {
    it('calculates housing capacity with Notables, Barons, and Biomes', () => {
      // 3 provinces base = 750
      expect(calculateHousingCapacity(750, 0, 0)).toBe(750)

      // With 2 Notables (+1.5% each = +3%): 750 * 1.03 = 772.5 -> 773
      expect(calculateHousingCapacity(750, 2, 0)).toBe(773)

      // With 1 Baron (+6%): 750 * 1.06 = 795
      expect(calculateHousingCapacity(750, 0, 1)).toBe(795)

      // Base 825 (250 + 375 + 200), 10 Notables (+15%) and 2 Barons (+12%): 825 * 1.27 = 1047.75 -> 1048
      expect(calculateHousingCapacity(825, 10, 2)).toBe(1048)

      // Zero provinces give zero base housing and zero capacity (conquest defeat, no floor of 1)
      expect(calculateHousingCapacity(0, 10, 2)).toBe(0)
    })

    it('calculates civil colonisation cost exponentially (1500 * 2^k)', () => {
      expect(calculateColonisationCost(0)).toBe(1500)
      expect(calculateColonisationCost(1)).toBe(3000)
      expect(calculateColonisationCost(2)).toBe(6000)
      expect(calculateColonisationCost(3)).toBe(12000)
    })

    it('calculates fiscal drag factor on demographic growth', () => {
      // Tax <= 25% -> factor 1.0
      expect(calculateFiscalFactor(25)).toBe(1.0)
      expect(calculateFiscalFactor(15)).toBe(1.0)

      // Tax = 50% -> 1 - (50 - 25)/50 = 0.5
      expect(calculateFiscalFactor(50)).toBe(0.5)

      // Tax = 60% -> 1 - (60 - 25)/50 = 0.3
      expect(calculateFiscalFactor(60)).toBeCloseTo(0.3)
    })

    it('calculates proportional logistic growth per second', () => {
      const pop = 200
      const maxPop = 750
      const r = BALANCE.BASE_POP_GROWTH_RATE_R // 0.005
      const tax = 25 // factor 1.0

      // r * Pop * (1 - Pop/Max) = 0.005 * 200 * (1 - 200/750) = 1.0 * (550/750) = 0.7333
      const growth = calculateLogisticGrowth(pop, maxPop, r, tax)
      expect(growth).toBeCloseTo(0.7333, 3)

      // At or above capacity, growth drops to 0
      expect(calculateLogisticGrowth(750, 750, r, tax)).toBe(0)
      expect(calculateLogisticGrowth(800, 750, r, tax)).toBe(0)
    })

    it('calculates continuous non-quadratic collector yields without floor', () => {
      const rate = 0.8
      // 50 serfs covers 0.5 block: 0.5 * 0.8 = 0.4 AP/s (no early-game stall!)
      expect(calculateCollectorYield(1, 50, rate)).toBeCloseTo(0.4)

      // 250 serfs: 2.5 blocks
      expect(calculateCollectorYield(1, 250, rate)).toBeCloseTo(0.8)
      expect(calculateCollectorYield(2, 250, rate)).toBeCloseTo(1.6)
      expect(calculateCollectorYield(3, 250, rate)).toBeCloseTo(2.0)
      expect(calculateCollectorYield(10, 250, rate)).toBeCloseTo(2.0)
    })
  })

  describe('Bureaucracy, Caps & Crisis Stages', () => {
    it('calculates paperwork friction and archivist mitigations', () => {
      const emptyUnits = {} as Record<UnitId, number>
      // 3 provinces * 10 = size 30 / (30 + 220) = 30 / 250 = 0.12 (12%)
      const basePaperwork = calculatePaperworkFriction(emptyUnits, 3, 0)
      expect(basePaperwork).toBeCloseTo(0.12, 2)

      // With 50% archivist reduction -> 0.06 (6%)
      const reduced = calculatePaperworkFriction(emptyUnits, 3, 0.5)
      expect(reduced).toBeCloseTo(0.06, 2)
    })

    it('calculates dynamic order allocation caps pegged to MaxPop', () => {
      const maxPop = 1000
      const caps = calculateOrderCaps(maxPop)
      expect(caps.admin).toBe(150) // <= 15%
      expect(caps.military).toBe(120) // <= 12%
      expect(caps.people).toBe(250) // <= 25%
    })

    it('classifies unrest crisis stages correctly', () => {
      expect(getUnrestCrisisStage(0)).toBe('tranquility')
      expect(getUnrestCrisisStage(49)).toBe('tranquility')
      expect(getUnrestCrisisStage(50)).toBe('fiscal_boycott')
      expect(getUnrestCrisisStage(74)).toBe('fiscal_boycott')
      expect(getUnrestCrisisStage(75)).toBe('strife_desertion')
      expect(getUnrestCrisisStage(89)).toBe('strife_desertion')
      expect(getUnrestCrisisStage(90)).toBe('urban_rebellion')
      expect(getUnrestCrisisStage(99)).toBe('urban_rebellion')
      expect(getUnrestCrisisStage(100)).toBe('total_revolution')
    })
  })
})
