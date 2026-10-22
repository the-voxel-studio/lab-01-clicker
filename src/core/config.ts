/**
 * Headless Engine Configuration & Decoupled Balancing Parameters.
 * Injected into simulation tick, dispatch, and formula evaluations without mutating GameState.
 *
 * NOTE ON ARCHITECTURAL SEPARATION:
 * All simulation runtime functions (tick, dispatch, battle, formulas) receive `config: EngineConfig`
 * and must strictly read balancing constants from `config.balance.*` or `config.quotas`.
 * Single admitted exception: `createInitialGameState` in `state.ts`, which reads initial default values
 * (STARTING_AP, STARTING_POPULATION, etc.) from static `BALANCE` to instantiate pristine baseline runs.
 *
 * @module core/config
 */

import { BALANCE, type DeadlineQuota, DEADLINE_QUOTAS } from '@/data/balance'

/** Numerical balance configuration interface matching constants in BALANCE. */
export interface BalanceConfig {
  readonly TIER_I_COST_RATIO: number
  readonly TIER_II_COST_RATIO: number
  readonly STARTING_POPULATION: number
  readonly STARTING_PROVINCES: number
  readonly BASE_HOUSING_PER_PROVINCE: number
  readonly BASE_POP_GROWTH_RATE_R: number
  readonly OVERCROWDING_BLEED_RATE: number
  readonly OVERCROWDING_UNREST_RATE: number
  readonly COLONISATION_BASE_COST: number
  readonly COLONISATION_COST_MULTIPLIER: number
  readonly STARTING_AP: number
  readonly STARTING_TAX_RATE: number
  readonly STARTING_UNREST: number
  readonly BUREAUCRACY_SCALE_S: number
  readonly TAX_POLL_RATE: number
  readonly TAX_PROMULGATION_DELAY_SECONDS: number
  readonly TAX_SHOCK_THRESHOLD: number
  readonly TAX_SHOCK_UNREST_SPIKE: number
  readonly CLICK_MAX_TOKENS_PER_SECOND: number
  readonly CLICK_CRITICAL_CHANCE: number
  readonly CLICK_CRITICAL_MULTIPLIER: number
  readonly CLICK_PAPERWORK_MITIGATION: number
  readonly SERFS_PER_COLLECTOR: number
  readonly PROVINCE_MIN_FLOOR_FOR_FINES: number
  readonly ATTACKER_SIEGE_FRICTION: number
  readonly DEFENDER_FORTIFICATION_BONUS: number
  readonly BORDER_STRONGHOLD_DEFENSE_FLAT: number
  readonly RAZOR_THIN_VICTORY_MARGIN: number
  readonly SCOUT_UNCERTAINTY_BASE: number
  readonly SCOUT_UNCERTAINTY_MIN: number
  readonly DEADLINE_DURATION_SECONDS: number
  readonly INTERIM_AUDIT_WARNING_SECONDS: number
  readonly TOTAL_DEADLINES: number
  readonly PATENT_COSTS: {
    readonly people: number
    readonly admin: number
    readonly military: number
  }
  readonly PATENT_MIN_DEADLINE: number
  readonly PATENT_MIN_TIER_I_UNITS: number
}

/** Complete engine configuration injected into tick, dispatch, and formulas. */
export interface EngineConfig {
  balance: BalanceConfig
  quotas: readonly DeadlineQuota[]
}

/** Default canonical engine configuration. */
export const DEFAULT_ENGINE_CONFIG: EngineConfig = {
  balance: BALANCE,
  quotas: DEADLINE_QUOTAS,
}
