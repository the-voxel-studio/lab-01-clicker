/**
 * Tactical Combat & Asymmetric Battle Engine Test Suite.
 * Validates siege friction, fortification bonus, razor-thin victory rule, and scout mortality.
 *
 * @module __tests__/unit/battle.spec
 */

import { describe, it, expect } from 'vitest'
import {
  calculateAttackerPower,
  calculateDefenderPower,
  evaluateCampaignOutcome,
  resolveCampaignLoot,
  resolveDefensiveClash,
  performScoutReroll,
  resolveScheduledThreat,
} from '@/core/battle'
import { createInitialGameState } from '@/core/state'
import { PRNG } from '@/core/prng'

describe('Tactical Battle & Combat Asymmetry (Gate C)', () => {
  it('applies attacker siege friction (-10%) and rolls within [0.92, 1.08]', () => {
    const prng = new PRNG(100)
    const forces = 100

    const { roll, effectivePower } = calculateAttackerPower(forces, prng)
    expect(roll).toBeGreaterThanOrEqual(0.92)
    expect(roll).toBeLessThan(1.08)

    // 100 * 0.90 * roll
    expect(effectivePower).toBeCloseTo(100 * 0.90 * roll, 2)
  })

  it('applies defender fortification (+20%), stronghold flat defense (+12), and rolls [0.95, 1.10]', () => {
    const prng = new PRNG(200)
    const forces = 50
    const strongholds = 2

    const { roll, effectivePower } = calculateDefenderPower(forces, strongholds, prng)
    expect(roll).toBeGreaterThanOrEqual(0.95)
    expect(roll).toBeLessThan(1.10)

    // (50 * 1.20 + 2 * 12) * roll = (60 + 24) * roll = 84 * roll
    expect(effectivePower).toBeCloseTo(84 * roll, 2)
  })

  it('enforces the Razor-Thin Victory Rule: NO province awarded when 1.00 <= R <= 1.05', () => {
    // 1. Decisive Victory (R >= 1.40)
    const decisive = evaluateCampaignOutcome(1.45)
    expect(decisive.outcome).toBe('decisive_victory')
    expect(decisive.provinceWon).toBe(true)
    expect(decisive.lootMultiplier).toBe(1.2)
    expect(decisive.casualtyRate).toBe(0.10)
    expect(decisive.unrestDelta).toBe(-5)

    // 2. Clear Victory (1.05 < R < 1.40)
    const clear = evaluateCampaignOutcome(1.20)
    expect(clear.outcome).toBe('clear_victory')
    expect(clear.provinceWon).toBe(true)
    expect(clear.lootMultiplier).toBe(1.0)
    expect(clear.casualtyRate).toBe(0.25)

    // 3. RAZOR-THIN VICTORY (1.00 <= R <= 1.05): Army exhausted, NO PROVINCE WON!
    const razorThin = evaluateCampaignOutcome(1.03)
    expect(razorThin.outcome).toBe('razor_thin_victory')
    expect(razorThin.provinceWon).toBe(false) // Core specification!
    expect(razorThin.lootMultiplier).toBe(0.5)
    expect(razorThin.casualtyRate).toBe(0.50)
    expect(razorThin.unrestDelta).toBe(5)

    // 4. Pyrrhic Standoff (0.80 <= R < 1.00)
    const pyrrhic = evaluateCampaignOutcome(0.85)
    expect(pyrrhic.outcome).toBe('pyrrhic_standoff')
    expect(pyrrhic.provinceWon).toBe(false)
    expect(pyrrhic.lootMultiplier).toBe(0)
    expect(pyrrhic.casualtyRate).toBe(0.75)

    // 5. Crushing Defeat (R < 0.80)
    const crushing = evaluateCampaignOutcome(0.60)
    expect(crushing.outcome).toBe('crushing_defeat')
    expect(crushing.provinceWon).toBe(false)
    expect(crushing.casualtyRate).toBe(1.00)
    expect(crushing.unrestDelta).toBe(25)
  })

  it('distributes diverse loot types (AP, Free Serfs, Soldiers, Mixed)', () => {
    const prng = new PRNG(300)

    // AP Loot (+/- 20% variance)
    const apLoot = resolveCampaignLoot('ap', 500, 1.0, prng)
    expect(apLoot.ap).toBeGreaterThanOrEqual(400)
    expect(apLoot.ap).toBeLessThanOrEqual(600)
    expect(apLoot.population).toBe(0)
    expect(apLoot.soldiers).toBe(0)

    // Population Loot (Free Serfs liberated)
    const popLoot = resolveCampaignLoot('population', 500, 1.0, prng)
    expect(popLoot.ap).toBe(0)
    expect(popLoot.population).toBeGreaterThanOrEqual(25)
    expect(popLoot.population).toBeLessThanOrEqual(75)

    // Soldiers Loot
    const milLoot = resolveCampaignLoot('soldiers', 500, 1.0, prng)
    expect(milLoot.soldiers).toBeGreaterThanOrEqual(5)
    expect(milLoot.soldiers).toBeLessThanOrEqual(15)

    // Mixed Loot
    const mixedLoot = resolveCampaignLoot('mixed', 500, 1.0, prng)
    expect(mixedLoot.ap).toBeGreaterThan(0)
    expect(mixedLoot.population).toBeGreaterThan(0)
    expect(mixedLoot.soldiers).toBeGreaterThan(0)
  })

  it('resolves defensive collapse devastatingly (1 province lost, 100% army killed, civilians & treasury lost)', () => {
    const state = createInitialGameState()
    state.provinces = 3
    state.units.soldier = 20
    state.totalPopulation = 200
    state.ap = 1000

    // Enemy power overwhelm
    const res = resolveDefensiveClash(state, 5, 200, 0, new PRNG(400))
    expect(res.success).toBe(false)
    expect(res.isCollapse).toBe(true)

    // 1 Province lost
    expect(state.provinces).toBe(2)
    expect(res.lostProvinces).toBe(1)

    // 100% soldiers killed
    expect(state.units.soldier).toBe(0)

    // Civilian casualties (15% to 25%)
    expect(res.lostPopulation).toBeGreaterThanOrEqual(20)

    // AP looted (30% to 50%)
    expect(state.ap).toBeLessThanOrEqual(700)
  })

  it('enforces scout patrol mortality: exactly 1 scout dies per reroll', () => {
    const state = createInitialGameState()
    state.units.scout = 3
    state.totalPopulation = 100

    // First reroll: 1 scout dies
    const success1 = performScoutReroll(state)
    expect(success1).toBe(true)
    expect(state.units.scout).toBe(2)
    expect(state.totalPopulation).toBe(99)

    // Second reroll
    const success2 = performScoutReroll(state)
    expect(success2).toBe(true)
    expect(state.units.scout).toBe(1)
    expect(state.totalPopulation).toBe(98)

    // Third reroll
    const success3 = performScoutReroll(state)
    expect(success3).toBe(true)
    expect(state.units.scout).toBe(0)
    expect(state.totalPopulation).toBe(97)

    // Fourth reroll with 0 scouts -> disabled & rejected!
    const failedReroll = performScoutReroll(state)
    expect(failedReroll).toBe(false)
    expect(state.units.scout).toBe(0)
    expect(state.totalPopulation).toBe(97)
  })

  it('evaluates scheduled threat response choices (defense, tribute, levy en masse)', () => {
    const state = createInitialGameState()
    state.ap = 2000
    state.totalPopulation = 200
    state.freeSerfs = 200
    state.unrest = 10

    // 1. Pay Tribute (bypasses combat, deducts AP)
    const tributeRes = resolveScheduledThreat(state, 'tribute', 50, 400)
    expect(tributeRes.success).toBe(true)
    expect(state.ap).toBe(1600)

    // 2. Levy en Masse (mobilizes 10% pop, +30 unrest, 5% casualties)
    const levyRes = resolveScheduledThreat(state, 'levy', 50, 400)
    expect(levyRes.success).toBe(true)
    expect(state.unrest).toBe(40) // 10 + 30
    expect(state.totalPopulation).toBe(190) // 200 - 10 casualties (5% of 200)
  })
})
