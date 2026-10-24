/**
 * Tactical Combat & Asymmetric Battle Engine Test Suite.
 * Validates siege friction, fortification bonus, razor-thin victory rule, and scout mortality.
 *
 * @module __tests__/unit/battle.spec
 */

import { describe, it, expect } from 'vitest'
import {
  calculateAttackerPower,
  calculateBaseCampaignLoot,
  calculateDefenderPower,
  calculateEnemyPower,
  evaluateCampaignOutcome,
  generateCampaignTarget,
  resolveOffensiveCampaign,
  resolveCampaignLoot,
  resolveDefensiveClash,
  performScoutReroll,
  resolveScheduledThreat,
} from '@/core/battle'
import { createInitialGameState } from '@/core/state'
import { PRNG } from '@/core/prng'
import { DEFAULT_ENGINE_CONFIG } from '@/core/config'
import { applyEffect } from '@/core/modifiers'
import { calculateMilitaryPower } from '@/core/engine'
import { hasRule } from '@/core/rules'
import { LAWS_DATA } from '@/data/laws'
import { applyArchivePerks } from '@/data/archives'
import type { CampaignTarget, GameState } from '@/core/types'

describe('Tactical Battle & Combat Asymmetry (Gate C)', () => {
  it('applies attacker siege friction (-10%) and rolls within [0.92, 1.08]', () => {
    const prng = new PRNG(100)
    const forces = 100

    const { roll, effectivePower } = calculateAttackerPower(forces, prng)
    expect(roll).toBeGreaterThanOrEqual(0.92)
    expect(roll).toBeLessThan(1.08)

    // 100 * 0.90 * roll
    expect(effectivePower).toBeCloseTo(100 * 0.9 * roll, 2)
  })

  it('applies defender fortification (+20%), stronghold flat defense (+12), and rolls [0.95, 1.10]', () => {
    const prng = new PRNG(200)
    const forces = 50
    const strongholds = 2

    const { roll, effectivePower } = calculateDefenderPower(forces, strongholds, prng)
    expect(roll).toBeGreaterThanOrEqual(0.95)
    expect(roll).toBeLessThan(1.1)

    // (50 * 1.20 + 2 * 12) * roll = (60 + 24) * roll = 84 * roll
    expect(effectivePower).toBeCloseTo(84 * roll, 2)
  })

  it('enforces the Razor-Thin Victory Rule: NO province awarded when 1.00 <= R <= 1.05', () => {
    // Decisive Victory (R >= 1.40)
    const decisive = evaluateCampaignOutcome(1.45, DEFAULT_ENGINE_CONFIG, new PRNG(1))
    expect(decisive.outcome).toBe('decisive_victory')
    expect(decisive.provinceWon).toBe(true)
    expect(decisive.lootMultiplier).toBe(1.2)
    expect(decisive.casualtyRate).toBeGreaterThanOrEqual(0.08)
    expect(decisive.casualtyRate).toBeLessThanOrEqual(0.12)
    expect(decisive.unrestDelta).toBe(-5)

    // Clear Victory (1.05 < R < 1.40)
    const clear = evaluateCampaignOutcome(1.2, DEFAULT_ENGINE_CONFIG, new PRNG(1))
    expect(clear.outcome).toBe('clear_victory')
    expect(clear.provinceWon).toBe(true)
    expect(clear.lootMultiplier).toBe(1.0)
    expect(clear.casualtyRate).toBeGreaterThanOrEqual(0.2)
    expect(clear.casualtyRate).toBeLessThanOrEqual(0.3)

    // RAZOR-THIN VICTORY (1.00 <= R <= 1.05): Army exhausted, NO PROVINCE WON!
    const razorThin = evaluateCampaignOutcome(1.03, DEFAULT_ENGINE_CONFIG, new PRNG(1))
    expect(razorThin.outcome).toBe('razor_thin_victory')
    expect(razorThin.provinceWon).toBe(false) // Core specification!
    expect(razorThin.lootMultiplier).toBe(0.5)
    expect(razorThin.casualtyRate).toBeGreaterThanOrEqual(0.45)
    expect(razorThin.casualtyRate).toBeLessThanOrEqual(0.55)
    expect(razorThin.unrestDelta).toBe(5)

    // Pyrrhic Standoff (0.80 <= R < 1.00)
    const pyrrhic = evaluateCampaignOutcome(0.85, DEFAULT_ENGINE_CONFIG, new PRNG(1))
    expect(pyrrhic.outcome).toBe('pyrrhic_standoff')
    expect(pyrrhic.provinceWon).toBe(false)
    expect(pyrrhic.lootMultiplier).toBe(0)
    expect(pyrrhic.casualtyRate).toBeGreaterThanOrEqual(0.7)
    expect(pyrrhic.casualtyRate).toBeLessThanOrEqual(0.8)

    // Crushing Defeat (R < 0.80)
    const crushing = evaluateCampaignOutcome(0.6, DEFAULT_ENGINE_CONFIG, new PRNG(1))
    expect(crushing.outcome).toBe('crushing_defeat')
    expect(crushing.provinceWon).toBe(false)
    expect(crushing.casualtyRate).toBe(1.0)
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

    // Pay Tribute (bypasses combat, deducts AP)
    const tributeRes = resolveScheduledThreat(state, 'tribute', 50, 400)
    expect(tributeRes.success).toBe(true)
    expect(state.ap).toBe(1600)

    // Levy en Masse (mobilizes 10% pop, +30 unrest, 5% casualties)
    const levyRes = resolveScheduledThreat(state, 'levy', 50, 400)
    expect(levyRes.success).toBe(true)
    expect(state.unrest).toBe(40) // 10 + 30
    expect(state.totalPopulation).toBe(190) // 200 - 10 casualties (5% of 200)
  })
})

const config = DEFAULT_ENGINE_CONFIG

function enactLaw(state: GameState, lawId: string): void {
  const law = LAWS_DATA[lawId]
  if (!law) throw new Error(`unknown law ${lawId}`)
  for (const effect of law.effects) applyEffect(effect, state)
  state.activeLaws.push(lawId)
}

function outcomeRates(ratio: number): number[] {
  return Array.from(
    { length: 200 },
    (_, seed) => evaluateCampaignOutcome(ratio, config, new PRNG(seed + 1)).casualtyRate,
  )
}

describe('Task 4: rolled casualties and campaign details', () => {
  it('rolls decisive victory casualties between 8% and 12%', () => {
    const rates = outcomeRates(1.5)
    expect(Math.min(...rates)).toBeGreaterThanOrEqual(0.08)
    expect(Math.max(...rates)).toBeLessThanOrEqual(0.12)
    expect(new Set(rates).size).toBeGreaterThan(1)
  })

  it('rolls the other outcome casualties inside their documented ranges', () => {
    const cases: Array<[number, number, number]> = [
      [1.2, 0.2, 0.3],
      [1.03, 0.45, 0.55],
      [0.9, 0.7, 0.8],
    ]
    for (const [ratio, low, high] of cases) {
      const rates = outcomeRates(ratio)
      expect(Math.min(...rates)).toBeGreaterThanOrEqual(low)
      expect(Math.max(...rates)).toBeLessThanOrEqual(high)
      expect(new Set(rates).size).toBeGreaterThan(1)
    }
    expect(new Set(outcomeRates(0.5))).toEqual(new Set([1]))
  })

  it('base loot is 10 x the AP rate quota', () => {
    const state = createInitialGameState()
    state.deadline = 6
    const base = calculateBaseCampaignLoot(state, config)
    expect(base).toBe(850)
    const variance = new PRNG(9).nextBetween(0.8, 1.2)
    const loot = resolveCampaignLoot('ap', base, 1, new PRNG(9), state)
    expect(loot.ap).toBe(Math.round(850 * variance))
  })

  it('sanctioned plunder multiplies AP loot by 1.5', () => {
    const plain = createInitialGameState()
    const plunder = createInitialGameState()
    enactLaw(plunder, 'law:sanctioned_plunder')
    const without = resolveCampaignLoot('ap', 1000, 1, new PRNG(5), plain)
    const withLaw = resolveCampaignLoot('ap', 1000, 1, new PRNG(5), plunder)
    const variance = new PRNG(5).nextBetween(0.8, 1.2)
    expect(without.ap).toBe(Math.round(1000 * 1 * variance))
    expect(withLaw.ap).toBe(Math.round(1000 * 1.5 * variance))
  })

  it('scorched earth halves loot and removes ambushes', () => {
    const plain = createInitialGameState()
    const scorched = createInitialGameState()
    enactLaw(scorched, 'law:scorched_earth')
    const without = resolveCampaignLoot('ap', 1000, 1, new PRNG(5), plain)
    const withLaw = resolveCampaignLoot('ap', 1000, 1, new PRNG(5), scorched)
    const variance = new PRNG(5).nextBetween(0.8, 1.2)
    expect(without.ap).toBe(Math.round(1000 * 1 * variance))
    expect(withLaw.ap).toBe(Math.round(1000 * 0.5 * variance))
    for (let seed = 1; seed <= 300; seed++) {
      expect(generateCampaignTarget(scorched, config, new PRNG(seed)).isAmbush).toBe(false)
    }
    const ambushes = Array.from(
      { length: 300 },
      (_, i) => generateCampaignTarget(plain, config, new PRNG(i + 1)).isAmbush,
    )
    expect(ambushes.some(Boolean)).toBe(true)
  })

  it('sanctioned plunder adds 15 unrest per campaign battle', () => {
    const run = (withLaw: boolean): number => {
      const state = createInitialGameState()
      state.units.soldier = 20
      state.unrest = 20
      if (withLaw) enactLaw(state, 'law:sanctioned_plunder')
      resolveOffensiveCampaign(state, 200, 10, 'ap', 300, new PRNG(7), config, 'heartland')
      return state.unrest
    }
    expect(run(true) - run(false)).toBe(15)
  })

  it('ambush power is 25% above the highest estimate', () => {
    const target: CampaignTarget = {
      power: 100,
      uncertaintyMargin: 0.4,
      perceivedMin: 60,
      perceivedMax: 140,
      biome: 'heartland',
      lootType: 'ap',
      isFalseLedger: false,
      isAmbush: true,
    }
    expect(calculateEnemyPower(target)).toBe(175)
    expect(calculateEnemyPower({ ...target, isAmbush: false })).toBe(100)
  })

  it('stores a perceived band of at most width 2M that contains the real power', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const target = generateCampaignTarget(createInitialGameState(), config, new PRNG(seed))
      const width = target.perceivedMax - target.perceivedMin
      const fullWidth = 2 * target.uncertaintyMargin * target.power
      expect(width).toBeLessThanOrEqual(fullWidth + 1)
      expect(target.perceivedMin === 0 || Math.abs(width - fullWidth) <= 1).toBe(true)
      expect(target.perceivedMin).toBeLessThanOrEqual(target.power)
      expect(target.perceivedMax).toBeGreaterThanOrEqual(target.power)
    }
  })

  it('places the real power at a random position inside the perceived band', () => {
    const positions: number[] = []
    for (let seed = 1; seed <= 200; seed++) {
      const target = generateCampaignTarget(createInitialGameState(), config, new PRNG(seed))
      const width = target.perceivedMax - target.perceivedMin
      positions.push((target.power - target.perceivedMin) / width)
    }
    expect(Math.min(...positions)).toBeLessThan(0.2)
    expect(Math.max(...positions)).toBeGreaterThan(0.8)
  })

  it('vanguard drills raise the player attack roll to [1.05, 1.20]', () => {
    const state = createInitialGameState()
    enactLaw(state, 'law:vanguard_drills')
    expect(hasRule(state, 'law:vanguard_drills')).toBe(true)
    const rolls: number[] = []
    for (let seed = 1; seed <= 200; seed++) {
      const copy = createInitialGameState()
      enactLaw(copy, 'law:vanguard_drills')
      const res = resolveOffensiveCampaign(
        copy,
        100,
        100,
        'ap',
        300,
        new PRNG(seed),
        config,
        'heartland',
      )
      rolls.push(res.attackerEffectivePower / (100 * 0.9))
    }
    expect(Math.min(...rolls)).toBeGreaterThanOrEqual(1.05 - 1e-9)
    expect(Math.max(...rolls)).toBeLessThanOrEqual(1.2)
  })

  it('vanguard drills raise battle casualties by 15%', () => {
    const run = (withLaw: boolean): number => {
      const state = createInitialGameState()
      state.units.soldier = 100
      state.freeSerfs = 0
      state.totalPopulation = 100
      if (withLaw) enactLaw(state, 'law:vanguard_drills')
      resolveOffensiveCampaign(state, 500, 10, 'ap', 300, new PRNG(11), config, 'heartland')
      return 100 - (state.units.soldier ?? 0)
    }
    const base = run(false)
    expect(run(true)).toBe(Math.round(base * 1.15))
  })

  it('officer academies make sergeants and captains count double', () => {
    const state = createInitialGameState()
    state.units.soldier = 100
    state.units.sergeant = 10
    state.units.captain = 5
    const before = calculateMilitaryPower(state)
    enactLaw(state, 'law:officer_academies')
    const after = calculateMilitaryPower(state)
    expect(before).toBeCloseTo(100 * (1 + 0.15 + 0.35), 1)
    expect(after).toBeCloseTo(100 * (1 + 0.3 + 0.7), 1)
  })

  it('guerrilla border watch doubles the stronghold defense', () => {
    const clashRatio = (withLaw: boolean): number => {
      const state = createInitialGameState()
      if (withLaw) enactLaw(state, 'law:guerrilla_border_watch')
      state.units.soldier = 10
      return resolveDefensiveClash(state, 10, 100, 3, new PRNG(8)).clashRatio
    }
    const rolls = new PRNG(8)
    const defenderRoll = rolls.nextBetween(0.95, 1.1)
    const attackerRoll = rolls.nextBetween(0.92, 1.08)
    const attacker = 100 * 0.9 * attackerRoll
    const expected = (stronghold: number): number =>
      ((10 * 1.2 + 3 * 12 * stronghold) * defenderRoll) / attacker
    expect(clashRatio(false)).toBeCloseTo(expected(1), 9)
    expect(clashRatio(true)).toBeCloseTo(expected(2), 9)
  })

  it('the spymaster network narrows the scout uncertainty margin by 12 points', () => {
    const plain = createInitialGameState()
    const perked = createInitialGameState()
    applyArchivePerks(perked, ['spymaster_network'])
    expect(generateCampaignTarget(plain, config, new PRNG(2)).uncertaintyMargin).toBeCloseTo(0.45)
    expect(generateCampaignTarget(perked, config, new PRNG(2)).uncertaintyMargin).toBeCloseTo(0.33)
  })
})
