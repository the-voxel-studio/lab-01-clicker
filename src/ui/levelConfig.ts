/**
 * Engine configuration of each level, built once from the default one, which stays untouched.
 *
 * @module ui/levelConfig
 */

import { DEFAULT_ENGINE_CONFIG, type EngineConfig } from '@/core/config'
import { DIFFICULTY_LEVELS, LEVEL_DATA, rampedFactor, type DifficultyLevel } from '@/data/levels'

const built = new Map<DifficultyLevel, EngineConfig>()

function build(level: DifficultyLevel): EngineConfig {
  if (level === 'ordinary') return DEFAULT_ENGINE_CONFIG
  const { quotaFactor, surchargeStep } = LEVEL_DATA[level]
  return {
    balance: { ...DEFAULT_ENGINE_CONFIG.balance, CONQUEST_SURCHARGE_STEP: surchargeStep },
    quotas: DEFAULT_ENGINE_CONFIG.quotas.map((row) => {
      const factor = rampedFactor(quotaFactor, row.deadline)
      return {
        deadline: row.deadline,
        apRate: Math.round(row.apRate * factor),
        pop: Math.round(row.pop * factor),
        military: Math.round(row.military * factor),
      }
    }),
  }
}

/**
 * The engine configuration of a level: `ordinary` is `DEFAULT_ENGINE_CONFIG` itself, the others
 * scale every quota row by the level's factor, ramped in over the first audits, and set their conquest surcharge step.
 *
 * @param level - Level of the reign.
 * @returns The same configuration object on every call for that level.
 */
export function configForLevel(level: DifficultyLevel): EngineConfig {
  let config = built.get(level)
  if (!config) {
    config = build(level)
    built.set(level, config)
  }
  return config
}

/**
 * The level whose configuration this is, so a view handed the reign's config also knows its voice.
 *
 * @param config - A configuration from `configForLevel`; any other reads as `ordinary`.
 */
export function levelOfConfig(config: EngineConfig): DifficultyLevel {
  return DIFFICULTY_LEVELS.find((level) => configForLevel(level) === config) ?? 'ordinary'
}
