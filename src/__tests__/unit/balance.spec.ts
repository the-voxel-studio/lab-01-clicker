/**
 * Master Balance Constants & Game Catalog Verification Suite.
 * Validates integrity of constants, 24-unit catalog, 4 biomes, and threat matrices.
 *
 * @module __tests__/unit/balance.spec
 */

import { describe, it, expect } from 'vitest'
import {
  BALANCE,
  UNITS_DATA,
  BIOMES_DATA,
  DEADLINE_QUOTAS,
  getThreatPower,
  getThreatTributeAp,
  getThreatTributeSeconds,
  getDeadlineThreat,
  type UnitId,
} from '@/data/balance'

describe('Game Balance Constants & Catalog Integrity (Gate A)', () => {
  it('declares canonical equilibrium constants in BALANCE', () => {
    expect(BALANCE.TIER_I_COST_RATIO).toBe(1.07)
    expect(BALANCE.TIER_II_COST_RATIO).toBe(1.05)
    expect(BALANCE.STARTING_POPULATION).toBe(100)
    expect(BALANCE.STARTING_PROVINCES).toBe(3)
    expect(BALANCE.BASE_HOUSING_PER_PROVINCE).toBe(250)
    expect(BALANCE.BASE_POP_GROWTH_RATE_R).toBe(0.005)
    expect(BALANCE.COLONISATION_BASE_COST).toBe(1500)
    expect(BALANCE.COLONISATION_COST_MULTIPLIER).toBe(2.0)
    expect(BALANCE.STARTING_AP).toBe(50)
    expect(BALANCE.STARTING_TAX_RATE).toBe(25)
    expect(BALANCE.STARTING_UNREST).toBe(10)
    expect(BALANCE.BUREAUCRACY_SCALE_S).toBe(220)
    expect(BALANCE.CLICK_MAX_TOKENS_PER_SECOND).toBe(12)
    expect(BALANCE.CLICK_CRITICAL_CHANCE).toBe(0.05)
    expect(BALANCE.CLICK_CRITICAL_MULTIPLIER).toBe(3.0)
    expect(BALANCE.PROVINCE_MIN_FLOOR_FOR_FINES).toBe(1)
  })

  it('validates the complete 24-unit catalog exhaustively', () => {
    const unitIds = Object.keys(UNITS_DATA) as UnitId[]
    expect(unitIds).toHaveLength(24)

    const orderCounts = { people: 0, admin: 0, military: 0 }
    const tierCounts = { 1: 0, 2: 0 }

    for (const id of unitIds) {
      const def = UNITS_DATA[id]
      expect(def.id).toBe(id)
      expect(def.baseCost).toBeGreaterThan(0)
      expect(def.upkeepAp).toBeGreaterThanOrEqual(0)
      expect(def.baseValue).toBeGreaterThan(0)

      // Tier & Cost ratio consistency
      const expectedRatio = def.tier === 1 ? BALANCE.TIER_I_COST_RATIO : BALANCE.TIER_II_COST_RATIO
      expect(def.costRatio).toBe(expectedRatio)

      orderCounts[def.order]++
      tierCounts[def.tier]++
    }

    // Exactly 8 units per order, 12 per tier
    expect(orderCounts.people).toBe(8)
    expect(orderCounts.admin).toBe(8)
    expect(orderCounts.military).toBe(8)
    expect(tierCounts[1]).toBe(12)
    expect(tierCounts[2]).toBe(12)
  })

  it('enforces that bulk x100 mode is strictly restricted to Peasants and Scribes', () => {
    for (const [id, def] of Object.entries(UNITS_DATA)) {
      const expectedBulk = id === 'peasant' || id === 'scribe'
      expect(def.allowsBulk100).toBe(expectedBulk)
    }
  })

  it('exports calibrated biome traits with capacity multipliers and deltaR', () => {
    expect(BIOMES_DATA.heartland.housingMultiplier).toBe(1.0)
    expect(BIOMES_DATA.heartland.deltaR).toBe(0)
    expect(BIOMES_DATA.heartland.taxEfficiencyBonus).toBe(0)
    expect(BIOMES_DATA.heartland.passiveDefense).toBe(0)
    expect(BIOMES_DATA.heartland.paperworkReduction).toBe(0)
    expect(BIOMES_DATA.farmlands.housingMultiplier).toBe(1.5)
    expect(BIOMES_DATA.farmlands.deltaR).toBe(0.001)
    expect(BIOMES_DATA.trade_hub.taxEfficiencyBonus).toBe(0.15)
    expect(BIOMES_DATA.stronghold.passiveDefense).toBe(12)
    expect(BIOMES_DATA.wilderness.housingMultiplier).toBe(0.8)
    expect(BIOMES_DATA.wilderness.paperworkReduction).toBe(0.05)
  })

  it('calculates scheduled crown threats dynamically from quotas (80% military, AP rate quota seconds)', () => {
    expect(getThreatPower(45)).toBe(36)
    expect(getThreatPower(75)).toBe(60)
    expect(getThreatTributeAp(28)).toBe(560)
    expect(getThreatTributeAp(55)).toBe(1100)

    const threatDeadlines = DEADLINE_QUOTAS.filter((q) => q.deadline >= 3)
    expect(threatDeadlines).toHaveLength(8)

    for (const quota of threatDeadlines) {
      const threat = getDeadlineThreat(quota)
      expect(threat.deadline).toBe(quota.deadline)
      expect(threat.power).toBe(Math.round(quota.military * 0.8))
      const seconds = quota.deadline >= 8 ? 4 : 20
      expect(threat.tributeAp).toBe(Math.round(seconds * quota.apRate))
    }
  })

  it('asks 20 seconds of the AP rate quota as tribute up to deadline 7 and 4 seconds from deadline 8', () => {
    expect(BALANCE.THREAT_TRIBUTE_QUOTA_SECONDS).toBe(20)
    expect(BALANCE.THREAT_TRIBUTE_LATE_QUOTA_SECONDS).toBe(4)
    expect(BALANCE.THREAT_TRIBUTE_LATE_FIRST_DEADLINE).toBe(8)
    expect(getThreatTributeSeconds(3)).toBe(20)
    expect(getThreatTributeSeconds(7)).toBe(20)
    expect(getThreatTributeSeconds(8)).toBe(4)
    expect(getThreatTributeSeconds(10)).toBe(4)
  })

  it('validates strictly ascending quotas across all 10 deadlines', () => {
    expect(DEADLINE_QUOTAS).toHaveLength(10)

    for (let i = 1; i < DEADLINE_QUOTAS.length; i++) {
      const prev = DEADLINE_QUOTAS[i - 1]!
      const curr = DEADLINE_QUOTAS[i]!
      expect(curr.deadline).toBe(prev.deadline + 1)
      expect(curr.apRate).toBeGreaterThan(prev.apRate)
      expect(curr.pop).toBeGreaterThan(prev.pop)
      expect(curr.military).toBeGreaterThan(prev.military)
    }
  })

  it('keeps the calibrated quota table and the threat figures of GAME_RULES §8.1', () => {
    expect(DEADLINE_QUOTAS.map((q) => [q.apRate, q.pop, q.military])).toEqual([
      [11, 151, 11],
      [21, 289, 21],
      [33, 500, 28],
      [57, 682, 30],
      [152, 784, 114],
      [268, 872, 178],
      [468, 954, 305],
      [997, 1157, 906],
      [1901, 3674, 1406],
      [2936, 6710, 2337],
    ])

    const documentedThreats = [
      [3, 22, 660],
      [4, 24, 1140],
      [5, 91, 3040],
      [6, 142, 5360],
      [7, 244, 9360],
      [8, 725, 3988],
      [9, 1125, 7604],
      [10, 1870, 11744],
    ]
    const computed = DEADLINE_QUOTAS.filter((q) => q.deadline >= 3).map((q) => {
      const threat = getDeadlineThreat(q)
      return [threat.deadline, threat.power, threat.tributeAp]
    })
    expect(computed).toEqual(documentedThreats)
  })
})
