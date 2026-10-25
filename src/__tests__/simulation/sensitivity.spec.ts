/**
 * Plan 04 Task 3: sensitivity of the Greedy ROI win rate to the balance parameters (GAME_RULES §21).
 *
 * @module __tests__/simulation/sensitivity.spec
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { DEFAULT_ENGINE_CONFIG, type BalanceConfig, type EngineConfig } from '@/core/config'
import { calculateUnitCost } from '@/core/formulas'
import { calculateGrossApRate, tick } from '@/core/engine'
import { createInitialGameState } from '@/core/state'
import { runSimulation, greedyRoiBotStrategy } from './botRunner'

/** Balance keys modulated by the sensitivity test. */
type SensitiveKey =
  'BASE_POP_GROWTH_RATE_R' | 'TIER_I_COST_RATIO' | 'TIER_II_COST_RATIO' | 'TAX_POLL_RATE'

/** Balance keys scaled one at a time. */
const SENSITIVE_KEYS: readonly SensitiveKey[] = [
  'BASE_POP_GROWTH_RATE_R',
  'TIER_I_COST_RATIO',
  'TIER_II_COST_RATIO',
  'TAX_POLL_RATE',
]

/** Scale factors applied to each key alone (plus or minus 10%). */
const SCALES: readonly number[] = [0.9, 1.1]

/** Seeds of the sensitivity sample, outside the calibration and validation seeds. */
const FIRST_SEED = 40001
const SEED_COUNT = 50

/** Largest allowed gap between a variant win rate and the baseline win rate. */
const MAX_WIN_RATE_GAP = 0.2

/** Time allowed to the nine 50 run samples (about 57 s measured). */
const SAMPLE_TIMEOUT_MS = 100_000

/** Whether a key is a unit cost ratio, which is scaled on its growth part (ratio - 1). */
function isCostRatio(key: SensitiveKey): key is 'TIER_I_COST_RATIO' | 'TIER_II_COST_RATIO' {
  return key === 'TIER_I_COST_RATIO' || key === 'TIER_II_COST_RATIO'
}

/**
 * Scales a cost ratio on its growth part: 1 + (ratio - 1) x scale, so 1.07 becomes 1.063 or 1.077.
 * Scaling the whole ratio would drop it below 1 at 0.9 and collapse the Greedy win rate.
 */
function scaleCostRatio(ratio: number, scale: number): number {
  return 1 + (ratio - 1) * scale
}

/** Value of one balance key under a scale factor: plain multiplication, or growth part for cost ratios. */
function scaledValue(key: SensitiveKey, scale: number): number {
  const base = DEFAULT_ENGINE_CONFIG.balance[key]
  return isCostRatio(key) ? scaleCostRatio(base, scale) : base * scale
}

/** Default configuration with one balance key scaled by a factor; quotas are untouched. */
function scaledConfig(key: SensitiveKey, scale: number): EngineConfig {
  const balance: BalanceConfig = {
    ...DEFAULT_ENGINE_CONFIG.balance,
    [key]: scaledValue(key, scale),
  }
  return { ...DEFAULT_ENGINE_CONFIG, balance }
}

/** Greedy ROI win rate over the sensitivity seeds under a configuration. */
function greedyWinRate(config: EngineConfig): number {
  let wins = 0
  for (let seed = FIRST_SEED; seed < FIRST_SEED + SEED_COUNT; seed++) {
    if (runSimulation(greedyRoiBotStrategy, seed, { config }).won) wins++
  }
  return wins / SEED_COUNT
}

/** Population of a fresh state after a minute of game time, read through the public tick. */
function populationAfterOneMinute(config: EngineConfig): number {
  const state = createInitialGameState({ seed: 1 })
  tick(state, 60, config)
  return state.totalPopulation
}

/** One public engine reading that must move when the given key moves. */
function engineReading(key: SensitiveKey, config: EngineConfig): number {
  switch (key) {
    case 'TIER_I_COST_RATIO':
      return calculateUnitCost('peasant', 10, 1, config)
    case 'TIER_II_COST_RATIO':
      return calculateUnitCost('farmer', 10, 1, config)
    case 'TAX_POLL_RATE':
      return calculateGrossApRate(createInitialGameState({ seed: 1 }), config).total
    case 'BASE_POP_GROWTH_RATE_R':
      return populationAfterOneMinute(config)
  }
}

/** Win rate gap of a variant, measured once and shared by the band tests. */
interface Variant {
  key: SensitiveKey
  scale: number
  winRate: number
}

describe('Plan 04 Task 3: sensitivity of the Greedy ROI win rate', () => {
  let baseline = 0
  const variants: Variant[] = []

  beforeAll(() => {
    baseline = greedyWinRate(DEFAULT_ENGINE_CONFIG)
    for (const key of SENSITIVE_KEYS) {
      for (const scale of SCALES) {
        variants.push({ key, scale, winRate: greedyWinRate(scaledConfig(key, scale)) })
      }
    }
  }, SAMPLE_TIMEOUT_MS)

  /** Gap between the baseline and the win rate of one variant. */
  function winRateGap(key: SensitiveKey, scale: number): number {
    const variant = variants.find((v) => v.key === key && v.scale === scale)
    if (!variant) throw new Error(`No sample for ${key} x${scale}.`)
    return Math.abs(variant.winRate - baseline)
  }

  it('every modulated balance key changes the engine through EngineConfig', () => {
    for (const key of SENSITIVE_KEYS) {
      for (const scale of SCALES) {
        expect(engineReading(key, scaledConfig(key, scale))).not.toBe(
          engineReading(key, DEFAULT_ENGINE_CONFIG),
        )
      }
    }
  })

  it('scaling the growth rate by 0.9 keeps the Greedy win rate within 0.20 of the baseline', () => {
    expect(winRateGap('BASE_POP_GROWTH_RATE_R', 0.9)).toBeLessThanOrEqual(MAX_WIN_RATE_GAP)
  })

  it('scaling the growth rate by 1.1 keeps the Greedy win rate within 0.20 of the baseline', () => {
    expect(winRateGap('BASE_POP_GROWTH_RATE_R', 1.1)).toBeLessThanOrEqual(MAX_WIN_RATE_GAP)
  })

  it('scaling the tax poll rate by 0.9 keeps the Greedy win rate within 0.20 of the baseline', () => {
    expect(winRateGap('TAX_POLL_RATE', 0.9)).toBeLessThanOrEqual(MAX_WIN_RATE_GAP)
  })

  it('scaling the tax poll rate by 1.1 keeps the Greedy win rate within 0.20 of the baseline', () => {
    expect(winRateGap('TAX_POLL_RATE', 1.1)).toBeLessThanOrEqual(MAX_WIN_RATE_GAP)
  })

  it('scaling the tier I cost ratio growth by 0.9 keeps the Greedy win rate within 0.20 of the baseline', () => {
    expect(winRateGap('TIER_I_COST_RATIO', 0.9)).toBeLessThanOrEqual(MAX_WIN_RATE_GAP)
  })

  it('scaling the tier I cost ratio growth by 1.1 keeps the Greedy win rate within 0.20 of the baseline', () => {
    expect(winRateGap('TIER_I_COST_RATIO', 1.1)).toBeLessThanOrEqual(MAX_WIN_RATE_GAP)
  })

  it('scaling the tier II cost ratio growth by 0.9 keeps the Greedy win rate within 0.20 of the baseline', () => {
    expect(winRateGap('TIER_II_COST_RATIO', 0.9)).toBeLessThanOrEqual(MAX_WIN_RATE_GAP)
  })

  it('scaling the tier II cost ratio growth by 1.1 keeps the Greedy win rate within 0.20 of the baseline', () => {
    expect(winRateGap('TIER_II_COST_RATIO', 1.1)).toBeLessThanOrEqual(MAX_WIN_RATE_GAP)
  })
})
