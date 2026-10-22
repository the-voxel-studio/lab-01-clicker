/**
 * Unit tests for Province Biomes modeling and system bonuses (Task 2.2, GAME_RULES §7.2).
 *
 * @module __tests__/unit/biomes.spec
 */

import { describe, it, expect } from 'vitest'
import { createInitialGameState } from '@/core/state'
import {
  calculateMaxPopulation,
  calculateNetPaperwork,
  calculateGrossApRate,
  getBiomeModifiers,
  tick,
} from '@/core/engine'
import { calculateDefenderPower, resolveDefensiveClash } from '@/core/battle'
import { dispatch } from '@/core/commands'
import { PRNG } from '@/core/prng'

describe('Task 2.2: Province Biomes Modeling & System Modifiers', () => {
  it('initializes new state with 3 heartland provinces and baseline 750 capacity', () => {
    const state = createInitialGameState()
    expect(state.provinces).toBe(3)
    expect(state.provinceBiomes).toEqual(['heartland', 'heartland', 'heartland'])

    const mods = getBiomeModifiers(state)
    expect(mods.housingMultiplier).toBe(1.0)
    expect(mods.deltaR).toBe(0)
    expect(mods.taxEfficiencyBonus).toBe(0)
    expect(mods.passiveDefense).toBe(0)
    expect(mods.paperworkReduction).toBe(0)

    expect(calculateMaxPopulation(state)).toBe(750)
  })

  it('farmlands biome provides +50% housing (375) and +0.001 delta r', () => {
    const state = createInitialGameState()
    state.provinces = 4
    state.provinceBiomes = ['heartland', 'heartland', 'heartland', 'farmlands']

    // 3 * 250 + 1 * 375 = 1125
    expect(calculateMaxPopulation(state)).toBe(1125)

    const mods = getBiomeModifiers(state)
    expect(mods.deltaR).toBe(0.001)

    // Verify logistic growth integration in tick
    state.freeSerfs = 100
    state.totalPopulation = 100
    state.unrest = 0
    state.forcedTitheFreezeTimer = 0

    // Compare with baseline growth
    const stateBase = createInitialGameState()
    stateBase.freeSerfs = 100
    stateBase.totalPopulation = 100
    stateBase.unrest = 0
    stateBase.forcedTitheFreezeTimer = 0

    tick(state, 10.0)
    tick(stateBase, 10.0)

    expect(state.totalPopulation).toBeGreaterThan(stateBase.totalPopulation)
  })

  it('trade_hub biome grants +15% tax efficiency', () => {
    const state0 = createInitialGameState()
    state0.taxRate = 30
    state0.freeSerfs = 100
    const gross0 = calculateGrossApRate(state0)

    const stateTrade = createInitialGameState()
    stateTrade.taxRate = 30
    stateTrade.freeSerfs = 100
    stateTrade.provinces = 4
    stateTrade.provinceBiomes = ['heartland', 'heartland', 'heartland', 'trade_hub']
    const grossTrade = calculateGrossApRate(stateTrade)

    expect(grossTrade.pollTax).toBeGreaterThan(gross0.pollTax)
    // 15% bonus on tax efficiency
    expect(grossTrade.pollTax).toBeCloseTo(gross0.pollTax * 1.15, 2)
  })

  it('stronghold biome provides +12 flat passive defense in combat', () => {
    const prng1 = new PRNG(88)
    const prng2 = new PRNG(88)

    const def0 = calculateDefenderPower(100, 0, prng1)
    const def1Stronghold = calculateDefenderPower(100, 1, prng2) // +12 flat

    expect(def1Stronghold.effectivePower).toBeGreaterThan(def0.effectivePower)
    // Formula: (forces * 1.20 + 12) * roll vs (forces * 1.20) * roll -> diff is exactly 12 * roll
    expect(def1Stronghold.effectivePower - def0.effectivePower).toBeCloseTo(12 * def0.roll, 4)
  })

  it('wilderness biome provides -20% housing (200) and -5% paperwork friction', () => {
    const state = createInitialGameState()
    state.provinces = 4
    state.provinceBiomes = ['heartland', 'heartland', 'heartland', 'wilderness']

    // 3 * 250 + 1 * 200 = 950
    expect(calculateMaxPopulation(state)).toBe(950)

    const mods = getBiomeModifiers(state)
    expect(mods.paperworkReduction).toBe(0.05)

    // Compare with 4 heartland provinces
    const state4Heartland = createInitialGameState()
    state4Heartland.provinces = 4
    state4Heartland.provinceBiomes = ['heartland', 'heartland', 'heartland', 'heartland']

    const paper4Heartland = calculateNetPaperwork(state4Heartland)
    const paperWilderness = calculateNetPaperwork(state)
    expect(paperWilderness).toBeLessThan(paper4Heartland)
    expect(paperWilderness).toBeCloseTo(paper4Heartland * 0.95, 4)
  })

  it('enforces LIFO province loss ordering across censure and defensive collapse', () => {
    const state = createInitialGameState()
    state.provinces = 5
    state.provinceBiomes = ['heartland', 'heartland', 'heartland', 'farmlands', 'trade_hub']

    // Simulate defensive collapse
    resolveDefensiveClash(state, 0, 1000, 0, new PRNG(1))
    expect(state.provinces).toBe(4)
    expect(state.provinceBiomes).toEqual(['heartland', 'heartland', 'heartland', 'farmlands'])

    // Another collapse
    resolveDefensiveClash(state, 0, 1000, 0, new PRNG(2))
    expect(state.provinces).toBe(3)
    expect(state.provinceBiomes).toEqual(['heartland', 'heartland', 'heartland'])
  })

  it('colonisation decree appends heartland biome maintaining count parity', () => {
    const state = createInitialGameState()
    state.ap = 10000
    const res = dispatch(state, { type: 'COLONISE_PROVINCE' })
    expect(res.success).toBe(true)
    expect(state.provinces).toBe(4)
    expect(state.provinceBiomes).toEqual(['heartland', 'heartland', 'heartland', 'heartland'])
  })
})
