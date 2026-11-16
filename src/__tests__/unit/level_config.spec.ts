/**
 * Plan V2_DIFFICULTY, Task 1: the three levels and the engine configuration of each.
 *
 * @module __tests__/unit/level_config.spec
 */

import { describe, expect, it } from 'vitest'
import { DEFAULT_ENGINE_CONFIG } from '@/core/config'
import { DEADLINE_QUOTAS } from '@/data/balance'
import {
  DIFFICULTY_LEVELS,
  LEVEL_DATA,
  QUOTA_RAMP,
  isDifficultyLevel,
  rampedFactor,
} from '@/data/levels'
import { configForLevel } from '@/ui/levelConfig'

const defaultBefore = structuredClone({
  balance: DEFAULT_ENGINE_CONFIG.balance,
  quotas: DEADLINE_QUOTAS,
})

describe('Task 1: levels as configurations', () => {
  it('lists the three levels, ordinary first', () => {
    expect(DIFFICULTY_LEVELS).toEqual(['ordinary', 'stern', 'tyrannical'])
  })

  it('gives ordinary the default configuration itself', () => {
    expect(configForLevel('ordinary')).toBe(DEFAULT_ENGINE_CONFIG)
  })

  it('returns the same configuration object on every call', () => {
    expect(configForLevel('stern')).toBe(configForLevel('stern'))
    expect(configForLevel('tyrannical')).toBe(configForLevel('tyrannical'))
  })

  it('ramps the factor in: the first two audits unchanged, full from the fifth', () => {
    expect(QUOTA_RAMP).toEqual([0, 0, 1 / 3, 2 / 3])
    expect(rampedFactor(1.6, 1)).toBe(1)
    expect(rampedFactor(1.6, 2)).toBe(1)
    expect(rampedFactor(1.6, 3)).toBeCloseTo(1.2)
    expect(rampedFactor(1.6, 4)).toBeCloseTo(1.4)
    expect(rampedFactor(1.6, 5)).toBe(1.6)
    expect(rampedFactor(1.6, 10)).toBe(1.6)
    expect(rampedFactor(1, 7)).toBe(1)
  })

  it.each(['stern', 'tyrannical'] as const)(
    'scales every quota row of %s by its ramped factor',
    (level) => {
      const { quotaFactor } = LEVEL_DATA[level]
      const { quotas } = configForLevel(level)
      expect(quotas).toHaveLength(10)
      quotas.forEach((row, index) => {
        const base = DEADLINE_QUOTAS[index]!
        const factor = rampedFactor(quotaFactor, base.deadline)
        expect(row).toEqual({
          deadline: base.deadline,
          apRate: Math.round(base.apRate * factor),
          pop: Math.round(base.pop * factor),
          military: Math.round(base.military * factor),
        })
      })
      expect(quotas.slice(0, 2)).toEqual(DEADLINE_QUOTAS.slice(0, 2))
    },
  )

  it('sets the conquest surcharge step of each level', () => {
    expect(configForLevel('ordinary').balance.CONQUEST_SURCHARGE_STEP).toBe(0.05)
    expect(configForLevel('stern').balance.CONQUEST_SURCHARGE_STEP).toBe(0.1)
    expect(configForLevel('tyrannical').balance.CONQUEST_SURCHARGE_STEP).toBe(0.15)
  })

  it.each(['stern', 'tyrannical'] as const)('keeps every other balance value of %s', (level) => {
    const { CONQUEST_SURCHARGE_STEP: _step, ...rest } = configForLevel(level).balance
    const { CONQUEST_SURCHARGE_STEP: _base, ...defaults } = DEFAULT_ENGINE_CONFIG.balance
    expect(rest).toEqual(defaults)
  })

  it('makes each level stricter than the one before', () => {
    const [ordinary, stern, tyrannical] = DIFFICULTY_LEVELS.map((level) => LEVEL_DATA[level])
    expect(ordinary!.quotaFactor).toBe(1)
    expect(stern!.quotaFactor).toBeGreaterThan(1)
    expect(tyrannical!.quotaFactor).toBeGreaterThan(stern!.quotaFactor)
    expect(ordinary!.dreadFactor).toBe(1)
    expect(stern!.dreadFactor).toBeGreaterThan(1)
    expect(tyrannical!.dreadFactor).toBeGreaterThan(stern!.dreadFactor)
  })

  it('names and describes every level', () => {
    for (const level of DIFFICULTY_LEVELS) {
      expect(LEVEL_DATA[level].name.length).toBeGreaterThan(0)
      expect(LEVEL_DATA[level].description.length).toBeGreaterThan(0)
    }
  })

  it('leaves the default configuration untouched', () => {
    for (const level of DIFFICULTY_LEVELS) configForLevel(level)
    expect({ balance: DEFAULT_ENGINE_CONFIG.balance, quotas: DEADLINE_QUOTAS }).toEqual(
      defaultBefore,
    )
  })

  it('states the full factor and the surcharge step of each level in its description', () => {
    for (const level of ['stern', 'tyrannical'] as const) {
      const { description, quotaFactor, surchargeStep } = LEVEL_DATA[level]
      expect(description).toContain(`${Math.round((quotaFactor - 1) * 100)}% more`)
      expect(description).toContain('fifth audit')
      expect(description).toContain(`adds ${Math.round(surchargeStep * 100)}%`)
    }
    expect(LEVEL_DATA.ordinary.description).toContain(
      `by ${Math.round(LEVEL_DATA.ordinary.surchargeStep * 100)}%`,
    )
  })

  it('recognises the three level ids only', () => {
    for (const level of DIFFICULTY_LEVELS) expect(isDifficultyLevel(level)).toBe(true)
    for (const value of ['easy', '', 'Stern', 1, null, undefined, {}]) {
      expect(isDifficultyLevel(value)).toBe(false)
    }
  })
})
