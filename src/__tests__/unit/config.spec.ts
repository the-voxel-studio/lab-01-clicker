/**
 * Injectable EngineConfig & Full State Reset Tests (Task 1.1).
 *
 * @module __tests__/unit/config.spec
 */

import { describe, it, expect } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { DEFAULT_ENGINE_CONFIG, type BalanceConfig, type EngineConfig } from '@/core/config'
import {
  calculateMilitaryPower,
  evaluateDeadlineAudit,
  isFastForwardUnlocked,
  tick,
} from '@/core/engine'
import { dispatch } from '@/core/commands'
import { createInitialGameState, cloneGameState } from '@/core/state'
import {
  calculateRunScore,
  calculateUnitCost,
  calculateHousingCapacity,
  getDynasticTitle,
} from '@/core/formulas'
import {
  evaluateCampaignOutcome,
  generateCampaignTarget,
  resolveCampaignLoot,
  resolveDefensiveClash,
  resolveOffensiveCampaign,
} from '@/core/battle'
import { PRNG } from '@/core/prng'
import { getStateHash } from '@/core/replay'
import type { Command, GameState, Modifier } from '@/core/types'
import { getHousingBase } from '@/core/provinces'
import { BALANCE, DEADLINE_QUOTAS, BIOMES_DATA, UNITS_DATA, type UnitId } from '@/data/balance'

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

  it('fully resets all state fields on RESTART_RUN, run archive points included', () => {
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
    expect(state.archivePoints).toBe(0) // Run points live in ArchiveData once the run is concluded
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

/** Factor applied to a balance key to prove the engine reads it (a zero value is moved by +0.1). */
const KEY_SCALE = 1.1

/** Quotas that every state meets, so an audit passes unless a row overrides a metric. */
function easyQuotas(override: { apRate?: number; pop?: number; military?: number } = {}) {
  return DEADLINE_QUOTAS.map((q) => ({ ...q, apRate: 0, pop: 0, military: 0, ...override }))
}

const IMPOSSIBLE_QUOTAS = easyQuotas({ apRate: 1e9, pop: 1e9, military: 1e9 })

function isUnitId(id: string): id is UnitId {
  return id in UNITS_DATA
}

function isBalanceConfig(value: unknown): value is BalanceConfig {
  if (typeof value !== 'object' || value === null) return false
  const keys = Object.keys(value).sort()
  const expected = Object.keys(BALANCE).sort()
  return keys.length === expected.length && keys.every((key, index) => key === expected[index])
}

/** Copy of `node` with the number at the dotted path multiplied by `KEY_SCALE`. */
function scaleAt(node: unknown, parts: readonly string[]): unknown {
  if (parts.length === 0) {
    if (typeof node !== 'number') throw new Error('Balance path does not end on a number.')
    return node === 0 ? KEY_SCALE - 1 : node * KEY_SCALE
  }
  if (typeof node !== 'object' || node === null) throw new Error('Unknown balance path.')
  const record = Object.fromEntries(Object.entries(node))
  const [head, ...rest] = parts
  if (head === undefined || !(head in record)) throw new Error(`Unknown balance key ${head}.`)
  record[head] = scaleAt(record[head], rest)
  return record
}

function withScaledKey(config: EngineConfig, path: string): EngineConfig {
  const balance = scaleAt(config.balance, path.split('.'))
  if (!isBalanceConfig(balance)) throw new Error('Scaled balance lost a key.')
  return { ...config, balance }
}

/** Dotted paths of every number held by `node`. */
function leafPaths(node: object, prefix = ''): string[] {
  return Object.entries(node).flatMap(([key, value]) => {
    const path = prefix === '' ? key : `${prefix}.${key}`
    return typeof value === 'object' && value !== null ? leafPaths(value, path) : [path]
  })
}

/** State of a realm: `patch` applied, then `units` set and the population settled. */
function realm(
  seed: number,
  units: Partial<Record<UnitId, number>> = {},
  patch: Partial<GameState> = {},
): GameState {
  const state = createInitialGameState({ seed })
  Object.assign(state, patch)
  for (const [id, count] of Object.entries(units)) {
    if (isUnitId(id)) state.units[id] = count ?? 0
  }
  state.totalPopulation =
    state.freeSerfs + Object.values(state.units).reduce((sum, count) => sum + count, 0)
  return state
}

/** Full state hash, plus the result a scenario returned when the state does not keep it. */
function sign(state: GameState, extra?: unknown): string {
  return `${getStateHash(state)}${extra === undefined ? '' : JSON.stringify(extra)}`
}

function ticked(state: GameState, seconds: number, config: EngineConfig): string {
  tick(state, seconds, config)
  return sign(state)
}

function commanded(state: GameState, command: Command, config: EngineConfig): string {
  return sign(state, dispatch(state, command, config))
}

function audited(
  state: GameState,
  config: EngineConfig,
  quotas: EngineConfig['quotas'] = easyQuotas(),
): string {
  return sign(state, evaluateDeadlineAudit(state, { ...config, quotas }))
}

/** One scenario run for a config and a variant (a seed, for rolls that gate the effect). */
type Scenario = (config: EngineConfig, variant: number) => string

type Row = readonly [path: string, run: Scenario, variants: number]

function row(path: string, run: Scenario, variants = 1): Row {
  return [path, run, variants]
}

const WIDE = 4000
const NEAR_PARITY = 300

const buy = (unitId: UnitId, count: number): Command => ({ type: 'BUY_UNIT', unitId, count })
const disband = (unitId: UnitId, count: number): Command => ({
  type: 'DISBAND_UNIT',
  unitId,
  count,
})
const taxRate = (rate: number): Command => ({ type: 'SET_TAX_RATE', rate })

const economy: Scenario = (c) =>
  ticked(
    realm(
      1,
      {
        scribe: 30,
        clerk: 5,
        supervisor: 3,
        provincial_steward: 2,
        artisan: 5,
        guild: 3,
        collector: 4,
        farmer_general: 1,
        peasant: 20,
        farmer: 5,
        soldier: 50,
        sergeant: 2,
        quartermaster: 10,
        grand_marshal: 10,
        archivist: 5,
        audit_chamber: 3,
        notable: 4,
        baron: 2,
      },
      { taxRate: 40, ap: 1e5, freeSerfs: 400, unrest: 20 },
    ),
    5,
    c,
  )

/** Identity that types an arrow function as a Scenario. */
function scenarioOf(run: Scenario): Scenario {
  return run
}

const scenario = {
  taxUnrest: scenarioOf((c) => ticked(realm(1, {}, { taxRate: 50, unrest: 30, ap: 1e5 }), 5, c)),
  prelate: scenarioOf((c) =>
    ticked(realm(1, { prelate: 1 }, { taxRate: 60, unrest: 40, ap: 1e5 }), 5, c),
  ),
  prelateCap: scenarioOf((c) =>
    ticked(realm(1, { prelate: 6 }, { taxRate: 60, unrest: 40, ap: 1e5 }), 5, c),
  ),
  overcrowded: scenarioOf((c) =>
    ticked(realm(1, {}, { freeSerfs: 900, unrest: 20, ap: 1e5 }), 2, c),
  ),
  overcrowdedHeavily: scenarioOf((c) =>
    ticked(realm(1, {}, { freeSerfs: 3000, unrest: 20, ap: 1e5 }), 2, c),
  ),
  fiscalFloor: scenarioOf((c) => ticked(realm(1, {}, { taxRate: 80, ap: 1e5 }), 5, c)),
  boycott: scenarioOf((c) => ticked(realm(1, { scribe: 20 }, { unrest: 52, ap: 1e5 }), 2, c)),
  strife: scenarioOf((c) => ticked(realm(1, { soldier: 5 }, { unrest: 80, ap: 1e5 }), 2, c)),
  rebellion: scenarioOf((c) => ticked(realm(1, { scribe: 20 }, { unrest: 95, ap: 1e5 }), 2, c)),
  soldierDesertion: scenarioOf((c) =>
    ticked(realm(1, { soldier: 10 }, { unrest: 80, ap: 1e5 }), 20, c),
  ),
  manAtArmsDesertion: scenarioOf((c) =>
    ticked(realm(1, { man_at_arms: 5 }, { unrest: 80, ap: 1e5 }), 40, c),
  ),
  paperworkReduction: scenarioOf((c) =>
    ticked(realm(1, { archivist: 100, scribe: 20 }, { ap: 1e5 }), 1, c),
  ),
  paperworkCeiling: scenarioOf((c) => ticked(realm(1, { scribe: 30000 }, { ap: 1e9 }), 1, c)),
  bankruptcyGrace: scenarioOf((c) => ticked(realm(1, { audit_chamber: 2 }, { ap: 10 }), 0.05, c)),
  lombardOffer: scenarioOf((c) => ticked(realm(1, { soldier: 100 }, { ap: -1000 }), 14, c)),
  lombardOfferTwoProvinces: scenarioOf((c) =>
    ticked(
      realm(
        1,
        { soldier: 100 },
        { ap: -1000, provinces: 2, provinceBiomes: ['heartland', 'heartland'] },
      ),
      14,
      c,
    ),
  ),
  clickRefill: scenarioOf((c) => ticked(realm(1, {}, { clickTokens: 0 }), 1, c)),
  taxPledge: scenarioOf((c) => ticked(realm(1, {}, { taxRate: 16 }), 0.05, c)),
  deadlineEnd: scenarioOf((c) =>
    ticked(realm(1, {}, { ap: 1e5 }), 105, { ...c, quotas: easyQuotas() }),
  ),
  stepSplit: scenarioOf((c) => ticked(realm(1), 1, c)),
  interimWarning: scenarioOf((c) => ticked(realm(1, {}, { ap: 1e5 }), 52, c)),
}

/** One raid roll: the step that crosses the 10 s mark of deadline 3. */
function raidRoll(
  c: EngineConfig,
  v: number,
  soldiers = 80,
  patch: Partial<GameState> = {},
): string {
  return ticked(
    realm(
      v,
      { soldier: soldiers },
      {
        deadline: 3,
        deadlineTimeSeconds: 9.95,
        totalElapsedSeconds: 9.95,
        ap: 100,
        unrest: 10,
        ...patch,
      },
    ),
    0.05,
    c,
  )
}

/** Defense near parity between the realm and the attackers. */
function defended(
  c: EngineConfig,
  v: number,
  o: {
    units?: Partial<Record<UnitId, number>>
    flags?: GameState['ruleFlags']
    enemy?: number
    strongholds?: number
    tribute?: number
  } = {},
): string {
  const state = realm(v, o.units ?? { soldier: 100 }, {
    ap: 1000,
    unrest: 30,
    ruleFlags: o.flags ?? [],
  })
  const result = resolveDefensiveClash(
    state,
    100,
    o.enemy ?? 133,
    o.strongholds ?? 0,
    undefined,
    c,
    o.tribute ?? 0,
  )
  return sign(state, result)
}

/** Offensive campaign near the razor thin margin. */
function attacked(
  c: EngineConfig,
  v: number,
  o: {
    flags?: GameState['ruleFlags']
    power?: number
    enemy?: number
    base?: number
  } = {},
): string {
  const state = realm(v, { soldier: 100 }, { ap: 1000, unrest: 30, ruleFlags: o.flags ?? [] })
  const result = resolveOffensiveCampaign(
    state,
    o.power ?? 120,
    o.enemy ?? 100,
    'ap',
    o.base,
    undefined,
    c,
    'heartland',
  )
  return sign(state, result)
}

/** LAUNCH_ATTACK against a prepared target. */
function launched(
  c: EngineConfig,
  v: number,
  o: {
    army?: number
    target?: Partial<NonNullable<GameState['currentTarget']>>
    patch?: Partial<GameState>
  } = {},
): string {
  const state = realm(
    v,
    { soldier: o.army ?? 400 },
    {
      phase: 'EXPEDITION',
      deadline: 3,
      ap: 100,
      unrest: 30,
      currentTarget: {
        power: 100,
        uncertaintyMargin: 0.2,
        perceivedMin: 80,
        perceivedMax: 120,
        biome: 'heartland',
        lootType: 'ap',
        factionId: 'outlaws',
        isFalseLedger: false,
        isAmbush: false,
        ...o.target,
      },
      ...o.patch,
    },
  )
  return commanded(state, { type: 'LAUNCH_ATTACK' }, c)
}

function lootOf(
  c: EngineConfig,
  type: 'ap' | 'population' | 'soldiers' | 'mixed',
  units: Partial<Record<UnitId, number>> = {},
): string {
  const state = realm(1, units)
  return [1, 2, 3]
    .map((seed) => JSON.stringify(resolveCampaignLoot(type, 500, 20, new PRNG(seed), state, c)))
    .join('|')
}

function outcomeAt(c: EngineConfig, ratio: number): string {
  return JSON.stringify(evaluateCampaignOutcome(ratio, c, new PRNG(3)))
}

function targeted(
  c: EngineConfig,
  v: number,
  units: Partial<Record<UnitId, number>> = {},
  patch: Partial<GameState> = {},
  modifier?: Modifier,
): string {
  const state = realm(v, units, patch)
  if (modifier) state.activeModifiers.push(modifier)
  return sign(state, generateCampaignTarget(state, c))
}

function titled(c: EngineConfig, patch: Partial<GameState>): string {
  const state = realm(1, {}, { isGameOver: true, isVictory: true, ...patch })
  return sign(state, getDynasticTitle(state, undefined, c))
}

function scored(c: EngineConfig): string {
  const state = realm(
    1,
    {},
    { totalCumulativeAp: 5000, peakPopulation: 300, victoriesCount: 4, strikes: 1 },
  )
  return sign(state, calculateRunScore(state, c))
}

const standingMilitary = (c: EngineConfig, flags: GameState['ruleFlags']): string => {
  const state = realm(1, { soldier: 100, sergeant: 100 }, { ruleFlags: flags })
  const power = calculateMilitaryPower(state, DEFAULT_ENGINE_CONFIG)
  return audited(state, c, easyQuotas({ military: power * 1.05 }))
}

const ROWS: readonly Row[] = [
  // Cost scaling, demography and fiscal
  row('TIER_I_COST_RATIO', (c) =>
    commanded(realm(1, { peasant: 5 }, { ap: 1e5 }), buy('peasant', 1), c),
  ),
  row('TIER_II_COST_RATIO', (c) =>
    commanded(
      realm(
        1,
        { clerk: 5 },
        { ap: 1e5, unlockedPatents: { people: false, admin: true, military: false } },
      ),
      buy('clerk', 1),
      c,
    ),
  ),
  row('BASE_HOUSING_PER_PROVINCE', economy),
  row('BASE_POP_GROWTH_RATE_R', economy),
  row('OVERCROWDING_BLEED_RATE', scenario.overcrowded),
  row('OVERCROWDING_UNREST_RATE', scenario.overcrowded),
  row('OVERCROWDING_EXCESS_POP_SCALE', scenario.overcrowded),
  row('OVERCROWDING_UNREST_MAX', scenario.overcrowdedHeavily),
  row('COLONISATION_BASE_COST', (c) =>
    commanded(
      realm(1, {}, { ap: 1e6, colonisedProvincesCount: 2 }),
      { type: 'COLONISE_PROVINCE' },
      c,
    ),
  ),
  row('COLONISATION_COST_MULTIPLIER', (c) =>
    commanded(
      realm(1, {}, { ap: 1e6, colonisedProvincesCount: 2 }),
      { type: 'COLONISE_PROVINCE' },
      c,
    ),
  ),
  row('BUREAUCRACY_SCALE_S', economy),
  row('TAX_POLL_RATE', economy),
  row('TAX_REFERENCE_RATE', economy),
  row('TAX_RATE_MAX', (c) => commanded(realm(1), taxRate(63), c)),
  row('TAX_PROMULGATION_DELAY_SECONDS', (c) => commanded(realm(1), taxRate(30), c)),
  row('TAX_SHOCK_THRESHOLD', (c) => commanded(realm(1), taxRate(41), c)),
  row('TAX_SHOCK_UNREST_SPIKE', (c) => commanded(realm(1), taxRate(45), c)),
  row('TAX_PLEDGE_RATE_LIMIT', scenario.taxPledge),
  row('TAX_UNREST_STEP_PERCENT', scenario.taxUnrest),
  row('TAX_UNREST_PER_STEP', scenario.taxUnrest),
  row('PRELATE_TAX_UNREST_DISCOUNT', scenario.prelate),
  row('PRELATE_TAX_UNREST_DISCOUNT_MAX', scenario.prelateCap),
  row('FISCAL_FACTOR_TAX_SPAN', economy),
  row('FISCAL_FACTOR_MIN', scenario.fiscalFloor),
  row('SERFS_PER_COLLECTOR', economy),
  // Click
  row('CLICK_MAX_TOKENS_PER_SECOND', scenario.clickRefill),
  row(
    'CLICK_CRITICAL_CHANCE',
    (c, v) =>
      commanded(realm(v, { scribe: 20 }, { clickTokens: 5 }), { type: 'STAMP_DOCUMENT' }, c),
    WIDE,
  ),
  row(
    'CLICK_CRITICAL_MULTIPLIER',
    (c, v) =>
      commanded(realm(v, { scribe: 20 }, { clickTokens: 5 }), { type: 'STAMP_DOCUMENT' }, c),
    WIDE,
  ),
  row('CLICK_PAPERWORK_MITIGATION', (c) =>
    commanded(
      realm(1, { scribe: 20, clerk: 10 }, { clickTokens: 5 }),
      { type: 'STAMP_DOCUMENT' },
      c,
    ),
  ),
  row('CLICK_GROSS_RATE_SHARE', (c) =>
    commanded(realm(1, { scribe: 20 }, { clickTokens: 5 }), { type: 'STAMP_DOCUMENT' }, c),
  ),
  // Orders, bulk and patents
  row('ORDER_CAP_SHARE_ADMIN', (c) =>
    commanded(realm(1, { scribe: 112 }, { ap: 1e5 }), buy('scribe', 1), c),
  ),
  row('ORDER_CAP_SHARE_MILITARY', (c) =>
    commanded(realm(1, { soldier: 90 }, { ap: 1e5 }), buy('soldier', 1), c),
  ),
  row('ORDER_CAP_SHARE_PEOPLE', (c) =>
    commanded(realm(1, { peasant: 187 }, { ap: 1e5 }), buy('peasant', 1), c),
  ),
  row('BULK_10_MIN_DEADLINE', (c) =>
    commanded(realm(1, {}, { ap: 1e5, deadline: 3 }), buy('peasant', 10), c),
  ),
  row('BULK_10_MIN_POPULATION', (c) =>
    commanded(realm(1, {}, { ap: 1e5, freeSerfs: 260 }), buy('peasant', 10), c),
  ),
  row('BULK_50_MIN_DEADLINE', (c) =>
    commanded(realm(1, {}, { ap: 1e5, deadline: 6 }), buy('peasant', 50), c),
  ),
  row('BULK_50_MIN_POPULATION', (c) =>
    commanded(realm(1, {}, { ap: 1e5, freeSerfs: 1050 }), buy('peasant', 50), c),
  ),
  row('BULK_100_MIN_DEADLINE', (c) =>
    commanded(realm(1, {}, { ap: 1e5, deadline: 8, freeSerfs: 200 }), buy('peasant', 100), c),
  ),
  row('PATENT_COSTS.people', (c) =>
    commanded(
      realm(1, { peasant: 12 }, { ap: 1e5, deadline: 4 }),
      { type: 'UNLOCK_PATENT', order: 'people' },
      c,
    ),
  ),
  row('PATENT_COSTS.admin', (c) =>
    commanded(
      realm(1, { scribe: 12 }, { ap: 1e5, deadline: 4 }),
      { type: 'UNLOCK_PATENT', order: 'admin' },
      c,
    ),
  ),
  row('PATENT_COSTS.military', (c) =>
    commanded(
      realm(1, { soldier: 12 }, { ap: 1e5, deadline: 4 }),
      { type: 'UNLOCK_PATENT', order: 'military' },
      c,
    ),
  ),
  row('PATENT_MIN_DEADLINE', (c) =>
    commanded(
      realm(1, { scribe: 12 }, { ap: 1e5, deadline: 4 }),
      { type: 'UNLOCK_PATENT', order: 'admin' },
      c,
    ),
  ),
  row('PATENT_MIN_TIER_I_UNITS', (c) =>
    commanded(
      realm(1, { scribe: 12 }, { ap: 1e5, deadline: 4 }),
      { type: 'UNLOCK_PATENT', order: 'admin' },
      c,
    ),
  ),
  row('DISBAND_SEVERANCE_SHARE', (c) =>
    commanded(realm(1, { soldier: 10 }, { ap: 1000 }), disband('soldier', 4), c),
  ),
  row('DISBAND_UNPAID_UNREST', (c) =>
    commanded(realm(1, { soldier: 10 }, { ap: 0 }), disband('soldier', 4), c),
  ),
  row('MUTINY_WINDOW_SECONDS', (c) =>
    commanded(
      realm(
        1,
        { soldier: 100 },
        {
          ap: 1e5,
          totalElapsedSeconds: 50,
          disbandedMilitaryHistory: [{ timeSeconds: 39.5, count: 15 }],
        },
      ),
      disband('soldier', 1),
      c,
    ),
  ),
  row('MUTINY_THRESHOLD_SHARE', (c) =>
    commanded(realm(1, { soldier: 95 }, { ap: 1e5 }), disband('soldier', 10), c),
  ),
  row('MUTINY_UNREST', (c) =>
    commanded(realm(1, { soldier: 100 }, { ap: 1e5 }), disband('soldier', 50), c),
  ),
  // Economy units and paperwork
  row('PAPERWORK_SIZE_SOLDIER', economy),
  row('PAPERWORK_SIZE_TIER_I', economy),
  row('PAPERWORK_SIZE_TIER_II', economy),
  row('PAPERWORK_SIZE_PER_PROVINCE', economy),
  row('PAPERWORK_REDUCTION_MAX', scenario.paperworkReduction),
  row('PAPERWORK_FRICTION_MAX', scenario.paperworkCeiling),
  row('MILITARY_UPKEEP_MIN_FACTOR', economy),
  // Unrest stages
  row('UNREST_FISCAL_BOYCOTT_THRESHOLD', scenario.boycott),
  row('FISCAL_BOYCOTT_TAX_FACTOR', scenario.boycott),
  row('UNREST_STRIFE_DESERTION_THRESHOLD', scenario.strife),
  row('UNREST_URBAN_REBELLION_THRESHOLD', scenario.rebellion),
  row('URBAN_REBELLION_PRODUCTION_FACTOR', scenario.rebellion),
  row('DESERTION_INTERVAL_SOLDIER_SECONDS', scenario.soldierDesertion),
  row('DESERTION_INTERVAL_MAN_AT_ARMS_SECONDS', scenario.manAtArmsDesertion),
  // Failsafes
  row('BANKRUPTCY_GRACE_BASE_SECONDS', scenario.bankruptcyGrace),
  row('BANKRUPTCY_GRACE_PER_AUDIT_CHAMBER_SECONDS', scenario.bankruptcyGrace),
  row('LOMBARD_OFFER_REMAINING_SECONDS', scenario.lombardOffer),
  row('LOMBARD_MIN_PROVINCES', scenario.lombardOfferTwoProvinces),
  row('LOMBARD_BAILOUT_AP', (c) =>
    commanded(realm(1, {}, { phase: 'LOMBARD_OFFER' }), { type: 'ACCEPT_LOMBARD_LOAN' }, c),
  ),
  row('SURPRISE_RAID_MIN_DEADLINE', (c, v) => raidRoll(c, v), WIDE),
  row('SURPRISE_RAID_CHECK_INTERVAL_SECONDS', (c, v) => raidRoll(c, v), WIDE),
  row(
    'SURPRISE_RAID_COOLDOWN_SECONDS',
    (c, v) => raidRoll(c, v, 80, { lastSurpriseRaidTime: 9.95 - 62 }),
    WIDE,
  ),
  row('RAID_BASE_PROBABILITY', (c, v) => raidRoll(c, v), WIDE),
  row('RAID_WEALTH_THRESHOLD_AP', (c, v) => raidRoll(c, v, 80, { ap: 2100 }), WIDE),
  row('RAID_WEALTH_MULTIPLIER', (c, v) => raidRoll(c, v, 80, { ap: 2100 }), WIDE),
  row('RAID_WEAK_ARMY_RATIO', (c, v) => raidRoll(c, v, 15), WIDE),
  row('RAID_WEAK_ARMY_PROBABILITY', (c, v) => raidRoll(c, v, 0), WIDE),
  row('RAID_UNREST_THRESHOLD', (c, v) => raidRoll(c, v, 80, { unrest: 63 }), WIDE),
  row('RAID_UNREST_PROBABILITY', (c, v) => raidRoll(c, v, 80, { unrest: 63 }), WIDE),
  row(
    'RAID_POWER_QUOTA_SHARE',
    (c, v) =>
      commanded(
        realm(v, { soldier: 11 }, { phase: 'SURPRISE_RAID', deadline: 3, ap: 1000, unrest: 30 }),
        { type: 'RESOLVE_RAID_DEFENSE' },
        c,
      ),
    NEAR_PARITY,
  ),
  // Threats and levy
  row('THREAT_POWER_QUOTA_SHARE', (c) =>
    commanded(realm(1, {}, { phase: 'COUNCIL_LAWS', deadline: 3 }), { type: 'REJECT_LAWS' }, c),
  ),
  row('THREAT_TRIBUTE_QUOTA_SECONDS', (c) =>
    commanded(realm(1, {}, { phase: 'COUNCIL_LAWS', deadline: 3 }), { type: 'REJECT_LAWS' }, c),
  ),
  row('THREAT_HERALD_FIRST_DEADLINE', (c) =>
    commanded(realm(1, {}, { phase: 'COUNCIL_LAWS', deadline: 2 }), { type: 'REJECT_LAWS' }, c),
  ),
  row('LEVY_CASUALTY_SHARE', (c) =>
    commanded(
      realm(
        1,
        {},
        { phase: 'THREAT_HERALD', deadline: 3, currentThreatId: 3, freeSerfs: 500, unrest: 10 },
      ),
      { type: 'SELECT_THREAT_RESPONSE', response: 'levy' },
      c,
    ),
  ),
  row('LEVY_UNREST', (c) =>
    commanded(
      realm(
        1,
        {},
        { phase: 'THREAT_HERALD', deadline: 3, currentThreatId: 3, freeSerfs: 500, unrest: 10 },
      ),
      { type: 'SELECT_THREAT_RESPONSE', response: 'levy' },
      c,
    ),
  ),
  // Time structure
  row('DEADLINE_DURATION_SECONDS', scenario.deadlineEnd),
  row('FIXED_STEP_SECONDS', scenario.stepSplit),
  row('INTERIM_AUDIT_WARNING_SECONDS', scenario.interimWarning),
  row('TOTAL_DEADLINES', (c) => audited(realm(1, {}, { deadline: 10 }), c)),
  row('FAST_FORWARD_MIN_DEADLINE', (c) => {
    const state = realm(1, {}, { deadline: 5 })
    return sign(state, isFastForwardUnlocked(state, c))
  }),
  // Audit
  row('AUDIT_METRICS_REQUIRED', (c) => audited(realm(1), c, easyQuotas({ military: 1e9 }))),
  row('MAX_STRIKES', (c) => audited(realm(1, {}, { strikes: 2 }), c, IMPOSSIBLE_QUOTAS)),
  row('ROYAL_CENSURE_AP_CONFISCATION', (c) =>
    audited(realm(1, {}, { ap: 1000 }), c, IMPOSSIBLE_QUOTAS),
  ),
  row('PROVINCE_MIN_FLOOR_FOR_FINES', (c) =>
    audited(realm(1, {}, { provinces: 1.05, provinceBiomes: ['heartland'] }), c, IMPOSSIBLE_QUOTAS),
  ),
  row('AUDITORS_INQUISITION_UNREST', (c) =>
    audited(realm(1, {}, { ruleFlags: ['law:auditors_inquisition'], unrest: 10 }), c),
  ),
  row('EXCEPTIONAL_TITHE_UNREST', (c) =>
    audited(
      realm(
        1,
        {},
        {
          ruleFlags: ['law:exceptional_tithe'],
          activeLaws: ['law:exceptional_tithe'],
          unrest: 10,
        },
      ),
      c,
    ),
  ),
  row('OFFICER_ACADEMIES_BONUS_FACTOR', (c) => standingMilitary(c, ['law:officer_academies'])),
  row('LAW_SLOTS_BASE', (c) =>
    commanded(
      realm(
        1,
        {},
        {
          phase: 'COUNCIL_LAWS',
          currentLawDraft: ['law:royal_scriptorium'],
          activeLaws: ['law:a', 'law:b', 'law:c', 'law:d', 'law:e'],
        },
      ),
      { type: 'ENACT_LAW', lawId: 'law:royal_scriptorium' },
      c,
    ),
  ),
  row('SCORE_PER_CUMULATIVE_AP', scored),
  row('SCORE_PER_PEAK_POPULATION', scored),
  row('SCORE_PER_PROVINCE', scored),
  row('SCORE_PER_VICTORY', scored),
  row('SCORE_PENALTY_PER_STRIKE', scored),
  row('TITLE_CONQUEROR_CAPTURED_PROVINCES', (c) => titled(c, { capturedProvincesCount: 8 })),
  row('TITLE_NATION_FATHER_POPULATION', (c) => titled(c, { freeSerfs: 4100, starvationLosses: 0 })),
  row('TITLE_TREASURER_ADMIN_SHARE', (c) =>
    titled(c, { totalCumulativeAp: 6300, peakPopulation: 18.5, provinces: 0 }),
  ),
  // Combat
  row('ATTACKER_SIEGE_FRICTION', (c, v) => defended(c, v), NEAR_PARITY),
  row('DEFENDER_FORTIFICATION_BONUS', (c, v) => defended(c, v), NEAR_PARITY),
  row('ATTACKER_ROLL_MIN', (c, v) => defended(c, v), NEAR_PARITY),
  row('ATTACKER_ROLL_MAX', (c, v) => defended(c, v), NEAR_PARITY),
  row('DEFENDER_ROLL_MIN', (c, v) => defended(c, v), NEAR_PARITY),
  row('DEFENDER_ROLL_MAX', (c, v) => defended(c, v), NEAR_PARITY),
  row('BORDER_STRONGHOLD_DEFENSE_FLAT', (c, v) => defended(c, v, { strongholds: 2 }), NEAR_PARITY),
  row(
    'MAN_AT_ARMS_DEFENSE_FLAT',
    (c, v) => defended(c, v, { units: { soldier: 100, man_at_arms: 40 } }),
    NEAR_PARITY,
  ),
  row(
    'GUERRILLA_STRONGHOLD_FACTOR',
    (c, v) => defended(c, v, { strongholds: 2, flags: ['law:guerrilla_border_watch'] }),
    NEAR_PARITY,
  ),
  row(
    'VANGUARD_ROLL_MIN',
    (c, v) => defended(c, v, { flags: ['law:vanguard_drills'] }),
    NEAR_PARITY,
  ),
  row(
    'VANGUARD_ROLL_MAX',
    (c, v) => defended(c, v, { flags: ['law:vanguard_drills'] }),
    NEAR_PARITY,
  ),
  row('DEFENSE_VICTORY_CASUALTY_RATE', (c, v) => defended(c, v), NEAR_PARITY),
  row('DEFENSE_VICTORY_UNREST_DELTA', (c, v) => defended(c, v), NEAR_PARITY),
  row('DEFENSE_SALVAGE_SHARE', (c, v) => defended(c, v, { tribute: 500 }), NEAR_PARITY),
  row('SALVAGE_ROLL_MIN', (c, v) => defended(c, v, { tribute: 500 }), NEAR_PARITY),
  row('SALVAGE_ROLL_MAX', (c, v) => defended(c, v, { tribute: 500 }), NEAR_PARITY),
  row(
    'CAPTAIN_CASUALTY_DISCOUNT',
    (c, v) => defended(c, v, { units: { soldier: 100, captain: 3 } }),
    NEAR_PARITY,
  ),
  row(
    'CAPTAIN_CASUALTY_DISCOUNT_MAX',
    (c, v) => defended(c, v, { units: { soldier: 1000, captain: 20 } }),
    NEAR_PARITY,
  ),
  row('COLLAPSE_CIVILIAN_LOSS_MIN', (c, v) => defended(c, v, { enemy: 1000 })),
  row('COLLAPSE_CIVILIAN_LOSS_MAX', (c, v) => defended(c, v, { enemy: 1000 })),
  row('COLLAPSE_AP_LOSS_MIN', (c, v) => defended(c, v, { enemy: 1000 })),
  row('COLLAPSE_AP_LOSS_MAX', (c, v) => defended(c, v, { enemy: 1000 })),
  row('COLLAPSE_UNREST', (c, v) => defended(c, v, { enemy: 1000 })),
  row('RAZOR_THIN_VICTORY_MARGIN', (c) => outcomeAt(c, 1.052)),
  row('SANCTIONED_PLUNDER_UNREST', (c, v) => attacked(c, v, { flags: ['law:sanctioned_plunder'] })),
  row('UNDEFENDED_CLASH_RATIO', (c, v) => attacked(c, v, { enemy: 0 })),
  row('CAMPAIGN_DEFAULT_BASE_LOOT_AP', (c, v) => attacked(c, v, { power: 300 })),
  row('CAMPAIGN_BASE_LOOT_QUOTA_SECONDS', (c, v) => launched(c, v)),
  row('CAMPAIGNS_PER_DEADLINE', (c, v) =>
    launched(c, v, { patch: { campaignsLaunchedThisDeadline: 1 } }),
  ),
  row('FALSE_LEDGER_LOOT_MIN', (c, v) => launched(c, v, { target: { isFalseLedger: true } })),
  row('FALSE_LEDGER_LOOT_MAX', (c, v) => launched(c, v, { target: { isFalseLedger: true } })),
  row(
    'AMBUSH_POWER_FACTOR',
    (c, v) => launched(c, v, { army: 170, target: { isAmbush: true } }),
    NEAR_PARITY,
  ),
  row('LOOT_VARIANCE_MIN', (c) => lootOf(c, 'ap')),
  row('LOOT_VARIANCE_MAX', (c) => lootOf(c, 'ap')),
  row('SERGEANT_LOOT_BONUS', (c) => lootOf(c, 'population', { sergeant: 10 })),
  row('GUILD_LOOT_AP_BONUS', (c) => lootOf(c, 'ap', { guild: 10 })),
  row('LOOT_POPULATION_MIN', (c) => lootOf(c, 'population')),
  row('LOOT_POPULATION_MAX', (c) => lootOf(c, 'population')),
  row('LOOT_SOLDIERS_MIN', (c) => lootOf(c, 'soldiers')),
  row('LOOT_SOLDIERS_MAX', (c) => lootOf(c, 'soldiers')),
  row('LOOT_MIXED_AP_SHARE', (c) => lootOf(c, 'mixed')),
  row('LOOT_MIXED_POPULATION_MIN', (c) => lootOf(c, 'mixed')),
  row('LOOT_MIXED_POPULATION_MAX', (c) => lootOf(c, 'mixed')),
  row('LOOT_MIXED_SOLDIERS_MIN', (c) => lootOf(c, 'mixed')),
  row('LOOT_MIXED_SOLDIERS_MAX', (c) => lootOf(c, 'mixed')),
  row('CAMPAIGN_OUTCOMES.decisive.minRatio', (c) => outcomeAt(c, 1.45)),
  row('CAMPAIGN_OUTCOMES.decisive.lootMultiplier', (c) => outcomeAt(c, 1.5)),
  row('CAMPAIGN_OUTCOMES.decisive.casualtyMin', (c) => outcomeAt(c, 1.5)),
  row('CAMPAIGN_OUTCOMES.decisive.casualtyMax', (c) => outcomeAt(c, 1.5)),
  row('CAMPAIGN_OUTCOMES.decisive.unrestDelta', (c) => outcomeAt(c, 1.5)),
  row('CAMPAIGN_OUTCOMES.clear.lootMultiplier', (c) => outcomeAt(c, 1.2)),
  row('CAMPAIGN_OUTCOMES.clear.casualtyMin', (c) => outcomeAt(c, 1.2)),
  row('CAMPAIGN_OUTCOMES.clear.casualtyMax', (c) => outcomeAt(c, 1.2)),
  row('CAMPAIGN_OUTCOMES.clear.unrestDelta', (c) => outcomeAt(c, 1.2)),
  row('CAMPAIGN_OUTCOMES.razorThin.lootMultiplier', (c) => outcomeAt(c, 1.02)),
  row('CAMPAIGN_OUTCOMES.razorThin.casualtyMin', (c) => outcomeAt(c, 1.02)),
  row('CAMPAIGN_OUTCOMES.razorThin.casualtyMax', (c) => outcomeAt(c, 1.02)),
  row('CAMPAIGN_OUTCOMES.razorThin.unrestDelta', (c) => outcomeAt(c, 1.02)),
  row('CAMPAIGN_OUTCOMES.pyrrhic.minRatio', (c) => outcomeAt(c, 0.85)),
  row('CAMPAIGN_OUTCOMES.pyrrhic.lootMultiplier', (c) => outcomeAt(c, 0.85)),
  row('CAMPAIGN_OUTCOMES.pyrrhic.casualtyMin', (c) => outcomeAt(c, 0.85)),
  row('CAMPAIGN_OUTCOMES.pyrrhic.casualtyMax', (c) => outcomeAt(c, 0.85)),
  row('CAMPAIGN_OUTCOMES.pyrrhic.unrestDelta', (c) => outcomeAt(c, 0.85)),
  row('CAMPAIGN_OUTCOMES.crushing.lootMultiplier', (c) => outcomeAt(c, 0.5)),
  row('CAMPAIGN_OUTCOMES.crushing.casualtyRate', (c) => outcomeAt(c, 0.5)),
  row('CAMPAIGN_OUTCOMES.crushing.unrestDelta', (c) => outcomeAt(c, 0.5)),
  // Targets and reconnaissance
  row('TARGET_MIN_POWER', (c, v) => targeted(c, v)),
  row('TARGET_POWER_ROLL_MIN', (c, v) => targeted(c, v, {}, { deadline: 5 })),
  row('TARGET_POWER_ROLL_MAX', (c, v) => targeted(c, v, {}, { deadline: 5 })),
  row('SCOUT_UNCERTAINTY_BASE', (c, v) => targeted(c, v)),
  row('SCOUT_UNCERTAINTY_MIN', (c, v) => targeted(c, v, { scout: 10 })),
  row('SCOUT_MARGIN_PER_SCOUT', (c, v) => targeted(c, v, { scout: 1 })),
  row('SCOUT_MARGIN_PER_SPYMASTER', (c, v) => targeted(c, v, { spymaster: 1 })),
  row('STEPPE_MARGIN_FACTOR', (c, v) => targeted(c, v, { scout: 1 }), NEAR_PARITY),
  row(
    'STEPPE_MAX_MARGIN',
    (c, v) =>
      targeted(
        c,
        v,
        {},
        {},
        {
          source: 'test',
          stat: 'scout_uncertainty_margin',
          op: 'add',
          value: 0.1,
        },
      ),
    NEAR_PARITY,
  ),
  row('AMBUSH_BASE_CHANCE', (c, v) => targeted(c, v), WIDE),
  row('FALSE_LEDGER_CHANCE', (c, v) => targeted(c, v), WIDE),
]

/** Balance numbers the engine config cannot move, with the reason. */
const NOT_INJECTABLE: Readonly<Record<string, string>> = {
  STARTING_POPULATION: 'createInitialGameState reads static BALANCE (documented exception)',
  STARTING_PROVINCES: 'createInitialGameState reads static BALANCE (documented exception)',
  STARTING_AP: 'createInitialGameState reads static BALANCE (documented exception)',
  STARTING_TAX_RATE: 'createInitialGameState reads static BALANCE (documented exception)',
  STARTING_UNREST: 'createInitialGameState reads static BALANCE (documented exception)',
  BANKRUPTCY_GRACE_BASE_SECONDS:
    'initial timer set by createInitialGameState from static BALANCE (documented exception); the engine reset is injectable',
  SURPRISE_RAID_COOLDOWN_SECONDS:
    'initial lastSurpriseRaidTime set by createInitialGameState from static BALANCE (documented exception); the engine check is injectable',
}

describe('Task 7: every balance number is injectable', () => {
  it('has a scenario or a documented reason for every balance number', () => {
    const covered = new Set([...ROWS.map(([path]) => path), ...Object.keys(NOT_INJECTABLE)])
    expect(leafPaths(BALANCE).filter((path) => !covered.has(path))).toEqual([])
    const known = new Set(leafPaths(BALANCE))
    expect([...covered].filter((path) => !known.has(path))).toEqual([])
  })

  it('keeps the canonical balance numbers in the default config', () => {
    expect(DEFAULT_ENGINE_CONFIG.balance).toBe(BALANCE)
    expect(BALANCE.OVERCROWDING_UNREST_RATE).toBe(0.1)
  })

  it.each(ROWS)('%s changes the state hash when scaled', (path, run, variants) => {
    const scaled = withScaledKey(DEFAULT_ENGINE_CONFIG, path)
    let moved = false
    let variant = 1
    for (; variant <= variants && !moved; variant++) {
      moved = run(DEFAULT_ENGINE_CONFIG, variant) !== run(scaled, variant)
    }
    expect(moved, `${path} unmoved after ${variants} variants`).toBe(true)
  })
})
