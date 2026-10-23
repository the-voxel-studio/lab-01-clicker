/**
 * Injectable EngineConfig & Full State Reset Tests (Task 1.1).
 *
 * @module __tests__/unit/config.spec
 */

import { describe, it, expect } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { DEFAULT_ENGINE_CONFIG, type EngineConfig } from '@/core/config'
import { tick } from '@/core/engine'
import { dispatch } from '@/core/commands'
import { createInitialGameState, cloneGameState } from '@/core/state'
import { calculateUnitCost, calculateHousingCapacity } from '@/core/formulas'
import { getHousingBase } from '@/core/provinces'
import { BALANCE, DEADLINE_QUOTAS, BIOMES_DATA } from '@/data/balance'

describe('Task 1.1: EngineConfig Injection & Decoupling', () => {
  it('exports DEFAULT_ENGINE_CONFIG matching canonical balance and quotas', () => {
    expect(DEFAULT_ENGINE_CONFIG.balance.BASE_POP_GROWTH_RATE_R).toBe(
      BALANCE.BASE_POP_GROWTH_RATE_R,
    )
    expect(DEFAULT_ENGINE_CONFIG.quotas).toBe(DEADLINE_QUOTAS)
  })

  it('produces different population growth when EngineConfig r0 is altered', () => {
    const stateA = createInitialGameState({ seed: 100 })
    const stateB = createInitialGameState({ seed: 100 })

    const customConfig: EngineConfig = {
      ...DEFAULT_ENGINE_CONFIG,
      balance: {
        ...DEFAULT_ENGINE_CONFIG.balance,
        BASE_POP_GROWTH_RATE_R: BALANCE.BASE_POP_GROWTH_RATE_R * 1.5,
      },
    }

    const resA = tick(stateA, 1.0, DEFAULT_ENGINE_CONFIG)
    const resB = tick(stateB, 1.0, customConfig)

    expect(resB.popGrowth).toBeGreaterThan(resA.popGrowth)
    expect(stateB.totalPopulation).toBeGreaterThan(stateA.totalPopulation)
  })

  it('produces different poll tax yield when EngineConfig TAX_POLL_RATE is altered', () => {
    const stateA = createInitialGameState({ seed: 100 })
    const stateB = createInitialGameState({ seed: 100 })

    const customConfig: EngineConfig = {
      ...DEFAULT_ENGINE_CONFIG,
      balance: {
        ...DEFAULT_ENGINE_CONFIG.balance,
        TAX_POLL_RATE: BALANCE.TAX_POLL_RATE * 2.0,
      },
    }

    const resA = tick(stateA, 1.0, DEFAULT_ENGINE_CONFIG)
    const resB = tick(stateB, 1.0, customConfig)

    expect(resB.grossApGenerated).toBeGreaterThan(resA.grossApGenerated)
  })

  it('guarantees starting housing capacity of exactly 750 with 3 heartland provinces', () => {
    const state = createInitialGameState({ seed: 123 })

    expect(state.provinces).toBe(3)
    expect(state.provinceBiomes).toEqual(['heartland', 'heartland', 'heartland'])

    // Each heartland province has housingMultiplier = 1.0
    for (const b of state.provinceBiomes) {
      expect(BIOMES_DATA[b].housingMultiplier).toBe(1.0)
    }

    const cap = calculateHousingCapacity(
      getHousingBase(state),
      state.units.notable,
      state.units.baron,
    )
    expect(cap).toBe(750)
  })

  it('reads tier cost ratio from EngineConfig in calculateUnitCost', () => {
    const customConfig: EngineConfig = {
      ...DEFAULT_ENGINE_CONFIG,
      balance: {
        ...DEFAULT_ENGINE_CONFIG.balance,
        TIER_I_COST_RATIO: 1.15,
      },
    }

    const defaultCost = calculateUnitCost('peasant', 5, 1, DEFAULT_ENGINE_CONFIG)
    const customCost = calculateUnitCost('peasant', 5, 1, customConfig)

    expect(customCost).toBeGreaterThan(defaultCost)
  })

  it('deeply clones GameState via cloneGameState ensuring no reference leaks', () => {
    const source = createInitialGameState({ seed: 42 })
    source.units.peasant = 5
    source.activeLaws.push('law_test')
    source.currentLawDraft.push('draft_1')
    source.disbandedMilitaryHistory.push({ timeSeconds: 10, count: 2 })
    source.currentTarget = {
      power: 20,
      uncertaintyMargin: 0.45,
      perceivedMin: 11,
      perceivedMax: 29,
      biome: 'farmlands',
      lootType: 'ap',
      factionId: 'outlaws',
      isFalseLedger: false,
      isAmbush: false,
    }

    const clone = cloneGameState(source)

    // Deep equality
    expect(clone).toEqual(source)

    // Detached reference mutations
    clone.rngStreams.click = 9999
    expect(source.rngStreams.click).not.toBe(9999)

    clone.units.peasant = 99
    expect(source.units.peasant).toBe(5)

    clone.activeLaws.push('law_leak')
    expect(source.activeLaws).not.toContain('law_leak')

    clone.currentLawDraft.push('draft_leak')
    expect(source.currentLawDraft).not.toContain('draft_leak')

    clone.provinceBiomes.push('wilderness')
    expect(source.provinceBiomes).toHaveLength(3)

    clone.disbandedMilitaryHistory[0]!.count = 999
    expect(source.disbandedMilitaryHistory[0]!.count).toBe(2)

    expect(clone.currentTarget).not.toBeNull()
    clone.currentTarget!.power = 999
    expect(source.currentTarget!.power).toBe(20)
  })

  it('fully resets all state fields on RESTART_RUN while preserving archivePoints', () => {
    const state = createInitialGameState({ seed: 42 })
    state.archivePoints = 15
    state.units.peasant = 10
    state.units.scribe = 5
    state.ap = 9999
    state.provinceBiomes = ['farmlands', 'wilderness', 'stronghold']
    state.activeLaws = ['law_1', 'law_2']
    state.currentThreatPower = 50
    state.phase = 'RUN_DEFEAT'

    const res = dispatch(state, { type: 'RESTART_RUN', seed: 99 })
    expect(res.success).toBe(true)

    expect(state.seed).toBe(99)
    expect(state.runId).toBe('run_99')
    expect(state.archivePoints).toBe(15) // Preserved
    expect(state.units.peasant).toBe(0) // Reset
    expect(state.units.scribe).toBe(0) // Reset
    expect(state.ap).toBe(BALANCE.STARTING_AP) // Reset to 50
    expect(state.provinceBiomes).toEqual(['heartland', 'heartland', 'heartland']) // Reset
    expect(state.activeLaws).toEqual([]) // Reset
    expect(state.currentThreatPower).toBe(0) // Reset
  })

  it('guard test: BALANCE. and DEADLINE_QUOTAS must not appear in src/core outside config.ts and state.ts', () => {
    const coreDir = path.resolve(__dirname, '../../core')
    const files = fs.readdirSync(coreDir).filter((f) => f.endsWith('.ts'))

    const allowedFiles = new Set(['config.ts', 'state.ts'])
    const violations: string[] = []

    for (const file of files) {
      if (allowedFiles.has(file)) continue
      const content = fs.readFileSync(path.join(coreDir, file), 'utf-8')
      const matches = [...content.matchAll(/\b(BALANCE\.|DEADLINE_QUOTAS)\b/g)]
      if (matches.length > 0) {
        violations.push(`${file} contains forbidden: ${matches.map((m) => m[0]).join(', ')}`)
      }
    }

    expect(violations).toEqual([])
  })

  it('coherence test: overriding SERFS_PER_COLLECTOR changes collector yield in tick()', () => {
    const stateA = createInitialGameState({ seed: 100 })
    stateA.units.collector = 2
    stateA.freeSerfs = 100

    const stateB = cloneGameState(stateA)

    const customConfig: EngineConfig = {
      ...DEFAULT_ENGINE_CONFIG,
      balance: {
        ...DEFAULT_ENGINE_CONFIG.balance,
        SERFS_PER_COLLECTOR: 50,
      },
    }

    const resA = tick(stateA, 1.0, DEFAULT_ENGINE_CONFIG)
    const resB = tick(stateB, 1.0, customConfig)

    // With 100 serfs and SERFS_PER_COLLECTOR=100: coverage = 1 collector -> 0.8 AP/s
    // With 100 serfs and SERFS_PER_COLLECTOR=50: coverage = 2 collectors -> 1.6 AP/s
    expect(resB.grossApGenerated).toBeGreaterThan(resA.grossApGenerated)
    expect(resB.grossApGenerated - resA.grossApGenerated).toBeCloseTo(0.8, 2)
  })
})
