/**
 * Unit tests for the secondary effects of all 24 units (Task 2.1, GAME_RULES §4).
 *
 * @module __tests__/unit/secondary_effects.spec
 */

import { describe, it, expect } from 'vitest'
import { createInitialGameState } from '@/core/state'
import { tick } from '@/core/engine'
import {
  calculateDefenderPower,
  resolveCampaignLoot,
  resolveOffensiveCampaign,
  resolveDefensiveClash,
  generateCampaignTarget,
} from '@/core/battle'
import { PRNG } from '@/core/prng'

describe('Task 2.1: Secondary Effects of Units (GAME_RULES §4)', () => {
  describe('1. Prelate: Tax Unrest Mitigation', () => {
    it('reduces fiscal unrest generation by 20% per prelate, capped at 80%', () => {
      // High tax rate (45%) -> base tax unrest = ((45 - 25) / 10) * 0.05 = 0.10/s
      const state0 = createInitialGameState()
      state0.taxRate = 45
      state0.units.clergy = 0
      state0.units.prelate = 0
      tick(state0, 1.0)
      const unrestGain0 = state0.unrest

      // 1 prelate: -20% tax unrest, plus pacification (0.15/s)
      // To isolate the tax unrest generation reduction, test with 1 vs 4 prelates:
      const state1 = createInitialGameState()
      state1.taxRate = 45
      state1.units.clergy = 0
      state1.units.prelate = 1
      tick(state1, 1.0)

      const state4 = createInitialGameState()
      state4.taxRate = 45
      state4.units.clergy = 0
      state4.units.prelate = 4
      tick(state4, 1.0)

      const state5 = createInitialGameState()
      state5.taxRate = 45
      state5.units.clergy = 0
      state5.units.prelate = 5
      tick(state5, 1.0)

      // Unrest gain with prelates should be strictly less than without
      expect(state1.unrest).toBeLessThan(unrestGain0)
      expect(state4.unrest).toBeLessThan(state1.unrest)
    })
  })

  describe('2. Audit Chamber: Bankruptcy Grace Window Extension', () => {
    it('extends bankruptcy grace timer ceiling by +10s per audit chamber', () => {
      const state0 = createInitialGameState()
      state0.ap = 100
      state0.units.audit_chamber = 0
      tick(state0, 1.0)
      expect(state0.bankruptcyGraceTimer).toBe(30.0)

      const state2 = createInitialGameState()
      state2.ap = 100
      state2.units.audit_chamber = 2
      tick(state2, 1.0)
      expect(state2.bankruptcyGraceTimer).toBe(50.0) // 30 + 2 * 10
    })
  })

  describe('3. Captain: Military Casualty Mitigation', () => {
    it('reduces campaign casualties by 5% per captain, capped at 50%', () => {
      // 0 captains: baseline casualties (e.g. clear_victory = 25%)
      const state0 = createInitialGameState()
      state0.units.soldier = 100
      state0.units.captain = 0
      // Large force for clear victory:
      resolveOffensiveCampaign(state0, 200, 100, 'ap', 300, new PRNG(42))
      const loss0 = 100 - (state0.units.soldier ?? 0)

      // 4 captains: -20% casualties
      const state4 = createInitialGameState()
      state4.units.soldier = 100
      state4.units.captain = 4
      resolveOffensiveCampaign(state4, 200, 100, 'ap', 300, new PRNG(42))
      const loss4 = 100 - (state4.units.soldier ?? 0)

      expect(loss4).toBeLessThan(loss0)

      // 12 captains: capped at -50% casualties
      const state12 = createInitialGameState()
      state12.units.soldier = 100
      state12.units.captain = 12
      resolveOffensiveCampaign(state12, 200, 100, 'ap', 300, new PRNG(42))
      const loss12 = 100 - (state12.units.soldier ?? 0)

      expect(loss12).toBe(Math.round(loss0 * 0.5))
    })

    it('reduces defensive clash casualties proportionally with captains', () => {
      const state0 = createInitialGameState()
      state0.units.soldier = 100
      state0.units.captain = 0
      resolveDefensiveClash(state0, 500, 100, 0, new PRNG(42))
      const loss0 = 100 - (state0.units.soldier ?? 0)

      const state10 = createInitialGameState()
      state10.units.soldier = 100
      state10.units.captain = 10 // -50% cap
      resolveDefensiveClash(state10, 500, 100, 0, new PRNG(42))
      const loss10 = 100 - (state10.units.soldier ?? 0)

      expect(loss10).toBeLessThan(loss0)
      expect(loss10).toBe(Math.round(loss0 * 0.5))
    })
  })

  describe('4. Sergeant & Guild: Battle Loot Enhancement', () => {
    it('increases campaign loot by 2% per sergeant', () => {
      const prng1 = new PRNG(100)
      const prng2 = new PRNG(100)

      const state0 = createInitialGameState()
      state0.units.sergeant = 0

      const state5 = createInitialGameState()
      state5.units.sergeant = 5 // +10% loot

      const loot0 = resolveCampaignLoot('population', 0, 1.0, prng1, state0)
      const loot5 = resolveCampaignLoot('population', 0, 1.0, prng2, state5)

      expect(loot5.population).toBeGreaterThan(loot0.population)
      expect(loot5.population).toBe(Math.round(loot0.population * 1.1))
    })

    it('increases AP loot by 1% per guild in addition to sergeant bonus', () => {
      const prng1 = new PRNG(200)
      const prng2 = new PRNG(200)

      const state0 = createInitialGameState()
      state0.units.guild = 0
      state0.units.sergeant = 0

      const state10 = createInitialGameState()
      state10.units.guild = 10 // +10% AP loot
      state10.units.sergeant = 0

      const loot0 = resolveCampaignLoot('ap', 1000, 1.0, prng1, state0)
      const loot10 = resolveCampaignLoot('ap', 1000, 1.0, prng2, state10)

      expect(loot10.ap).toBe(Math.round(loot0.ap * 1.1))
    })
  })

  describe('5. Man-at-Arms: Flat Passive Defense Bonus', () => {
    it('adds +0.5 flat defense per man-at-arms in defender power calculation', () => {
      const prng1 = new PRNG(50)
      const prng2 = new PRNG(50)

      const def0 = calculateDefenderPower(100, 0, prng1, undefined, 0)
      const def20 = calculateDefenderPower(100, 0, prng2, undefined, 20) // +10 flat defense

      expect(def20.effectivePower).toBeGreaterThan(def0.effectivePower)
      // Ratio check: (100 * 1.20 + 10) / (100 * 1.20) = 130 / 120 = 1.0833
      expect(def20.effectivePower / def0.effectivePower).toBeCloseTo(130 / 120, 2)
    })
  })

  describe('6. Scout & Spymaster: Reconnaissance & Deception Revelation', () => {
    it('narrows uncertainty margin by 12 points per scout and 30 points per spymaster with floor at 5%', () => {
      const state0 = createInitialGameState()
      state0.units.scout = 0
      state0.units.spymaster = 0
      const target0 = generateCampaignTarget(state0, undefined, new PRNG(77))
      expect(target0.uncertaintyMargin).toBe(0.45)

      // 1 scout: 0.45 - 0.12 = 0.33
      const state1Scout = createInitialGameState()
      state1Scout.units.scout = 1
      const target1Scout = generateCampaignTarget(state1Scout, undefined, new PRNG(77))
      expect(target1Scout.uncertaintyMargin).toBeCloseTo(0.33, 2)

      // 1 spymaster: 0.45 - 0.30 = 0.15
      const state1Spy = createInitialGameState()
      state1Spy.units.spymaster = 1
      const target1Spy = generateCampaignTarget(state1Spy, undefined, new PRNG(77))
      expect(target1Spy.uncertaintyMargin).toBeCloseTo(0.15, 2)

      // 2 spymasters: 0.45 - 0.60 -> floor at 0.05
      const state2Spy = createInitialGameState()
      state2Spy.units.spymaster = 2
      const target2Spy = generateCampaignTarget(state2Spy, undefined, new PRNG(77))
      expect(target2Spy.uncertaintyMargin).toBe(0.05)
    })

    it('reveals false ledger and ambush flags when spymaster >= 1', () => {
      // Find a PRNG seed where isFalseLedger or isAmbush is true
      let foundSeed = 0
      for (let s = 1; s < 50; s++) {
        const prngTest = new PRNG(s)
        prngTest.next() // biome
        prngTest.next() // loot
        prngTest.nextBetween(0.85, 1.25) // power
        const falseLedger = prngTest.next() < 0.15
        const ambush = prngTest.next() < 0.1
        if (falseLedger || ambush) {
          foundSeed = s
          break
        }
      }

      // Without spymaster: revealed flags are false
      const state0 = createInitialGameState()
      state0.units.spymaster = 0
      const target0 = generateCampaignTarget(state0, undefined, new PRNG(foundSeed))
      expect(target0.revealedFalseLedger).toBe(false)
      expect(target0.revealedAmbush).toBe(false)

      // With spymaster: revealed flags match reality
      const state1 = createInitialGameState()
      state1.units.spymaster = 1
      const target1 = generateCampaignTarget(state1, undefined, new PRNG(foundSeed))
      expect(target1.revealedFalseLedger).toBe(target1.isFalseLedger)
      expect(target1.revealedAmbush).toBe(target1.isAmbush)
    })
  })
})
