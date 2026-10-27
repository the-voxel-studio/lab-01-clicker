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

/** Outcome values shared by the campaign bands that roll a casualty range. */
export interface CampaignBand {
  readonly lootMultiplier: number
  readonly casualtyMin: number
  readonly casualtyMax: number
  readonly unrestDelta: number
}

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
  /** Fixed integration step in seconds; `tick` runs whole steps of this size. */
  readonly FIXED_STEP_SECONDS: number
  readonly INTERIM_AUDIT_WARNING_SECONDS: number
  readonly TOTAL_DEADLINES: number
  readonly PATENT_COSTS: {
    readonly people: number
    readonly admin: number
    readonly military: number
  }
  readonly PATENT_MIN_DEADLINE: number
  readonly PATENT_MIN_TIER_I_UNITS: number
  readonly UNREST_FISCAL_BOYCOTT_THRESHOLD: number
  readonly UNREST_STRIFE_DESERTION_THRESHOLD: number
  readonly UNREST_URBAN_REBELLION_THRESHOLD: number
  readonly FISCAL_BOYCOTT_TAX_FACTOR: number
  readonly URBAN_REBELLION_PRODUCTION_FACTOR: number
  readonly TAX_REFERENCE_RATE: number
  readonly TAX_RATE_MAX: number
  readonly TAX_PLEDGE_RATE_LIMIT: number
  readonly TAX_UNREST_STEP_PERCENT: number
  readonly TAX_UNREST_PER_STEP: number
  readonly PRELATE_TAX_UNREST_DISCOUNT: number
  readonly PRELATE_TAX_UNREST_DISCOUNT_MAX: number
  readonly OVERCROWDING_EXCESS_POP_SCALE: number
  readonly OVERCROWDING_UNREST_MAX: number
  readonly FISCAL_FACTOR_TAX_SPAN: number
  readonly FISCAL_FACTOR_MIN: number
  readonly CLICK_GROSS_RATE_SHARE: number
  readonly ORDER_CAP_SHARE_ADMIN: number
  readonly ORDER_CAP_SHARE_MILITARY: number
  readonly ORDER_CAP_SHARE_PEOPLE: number
  readonly PAPERWORK_SIZE_SOLDIER: number
  readonly PAPERWORK_SIZE_TIER_I: number
  readonly PAPERWORK_SIZE_TIER_II: number
  readonly PAPERWORK_SIZE_PER_PROVINCE: number
  readonly PAPERWORK_REDUCTION_MAX: number
  readonly PAPERWORK_FRICTION_MAX: number
  readonly MILITARY_UPKEEP_MIN_FACTOR: number
  readonly OFFICER_ACADEMIES_BONUS_FACTOR: number
  readonly PRINCELY_COUSIN_UPKEEP_SHARE: number
  readonly BULK_100_MIN_DEADLINE: number
  readonly BULK_50_MIN_DEADLINE: number
  readonly BULK_50_MIN_POPULATION: number
  readonly BULK_10_MIN_DEADLINE: number
  readonly BULK_10_MIN_POPULATION: number
  readonly BANKRUPTCY_GRACE_BASE_SECONDS: number
  readonly BANKRUPTCY_GRACE_PER_AUDIT_CHAMBER_SECONDS: number
  readonly LOMBARD_OFFER_REMAINING_SECONDS: number
  readonly LOMBARD_MIN_PROVINCES: number
  readonly LOMBARD_BAILOUT_AP: number
  readonly DESERTION_INTERVAL_SOLDIER_SECONDS: number
  readonly DESERTION_INTERVAL_MAN_AT_ARMS_SECONDS: number
  readonly SURPRISE_RAID_MIN_DEADLINE: number
  readonly SURPRISE_RAID_COOLDOWN_SECONDS: number
  readonly SURPRISE_RAID_CHECK_INTERVAL_SECONDS: number
  readonly RAID_BASE_PROBABILITY: number
  readonly RAID_WEALTH_THRESHOLD_AP: number
  readonly RAID_WEALTH_MULTIPLIER: number
  readonly RAID_WEAK_ARMY_RATIO: number
  readonly RAID_WEAK_ARMY_PROBABILITY: number
  readonly RAID_UNREST_THRESHOLD: number
  readonly RAID_UNREST_PROBABILITY: number
  readonly RAID_POWER_QUOTA_SHARE: number
  readonly THREAT_POWER_QUOTA_SHARE: number
  readonly THREAT_TRIBUTE_QUOTA_SECONDS: number
  readonly THREAT_TRIBUTE_LATE_QUOTA_SECONDS: number
  readonly THREAT_TRIBUTE_LATE_FIRST_DEADLINE: number
  readonly THREAT_HERALD_FIRST_DEADLINE: number
  readonly LEVY_CASUALTY_SHARE: number
  readonly LEVY_UNREST: number
  readonly AUDIT_METRICS_REQUIRED: number
  readonly MAX_STRIKES: number
  readonly ROYAL_CENSURE_AP_CONFISCATION: number
  readonly AUDITORS_INQUISITION_UNREST: number
  readonly EXCEPTIONAL_TITHE_UNREST: number
  readonly FAST_FORWARD_MIN_DEADLINE: number
  readonly LAW_SLOTS_BASE: number
  readonly DISBAND_SEVERANCE_SHARE: number
  readonly DISBAND_UNPAID_UNREST: number
  readonly MUTINY_WINDOW_SECONDS: number
  readonly MUTINY_THRESHOLD_SHARE: number
  readonly MUTINY_UNREST: number
  readonly SCORE_PER_CUMULATIVE_AP: number
  readonly SCORE_PER_PEAK_POPULATION: number
  readonly SCORE_PER_PROVINCE: number
  readonly SCORE_PER_VICTORY: number
  readonly SCORE_PENALTY_PER_STRIKE: number
  readonly TITLE_CONQUEROR_CAPTURED_PROVINCES: number
  readonly TITLE_NATION_FATHER_POPULATION: number
  readonly TITLE_TREASURER_ADMIN_SHARE: number
  readonly ATTACKER_ROLL_MIN: number
  readonly ATTACKER_ROLL_MAX: number
  readonly DEFENDER_ROLL_MIN: number
  readonly DEFENDER_ROLL_MAX: number
  readonly VANGUARD_ROLL_MIN: number
  readonly VANGUARD_ROLL_MAX: number
  readonly MAN_AT_ARMS_DEFENSE_FLAT: number
  readonly GUERRILLA_STRONGHOLD_FACTOR: number
  readonly UNDEFENDED_CLASH_RATIO: number
  readonly AMBUSH_POWER_FACTOR: number
  readonly CAPTAIN_CASUALTY_DISCOUNT: number
  readonly CAPTAIN_CASUALTY_DISCOUNT_MAX: number
  readonly SANCTIONED_PLUNDER_UNREST: number
  readonly DEFENSE_VICTORY_CASUALTY_RATE: number
  readonly DEFENSE_VICTORY_UNREST_DELTA: number
  readonly DEFENSE_SALVAGE_SHARE: number
  readonly SALVAGE_ROLL_MIN: number
  readonly SALVAGE_ROLL_MAX: number
  readonly COLLAPSE_CIVILIAN_LOSS_MIN: number
  readonly COLLAPSE_CIVILIAN_LOSS_MAX: number
  readonly COLLAPSE_AP_LOSS_MIN: number
  readonly COLLAPSE_AP_LOSS_MAX: number
  readonly COLLAPSE_UNREST: number
  readonly CAMPAIGN_BASE_LOOT_QUOTA_SECONDS: number
  readonly CAMPAIGNS_PER_DEADLINE: number
  readonly CAMPAIGN_DEFAULT_BASE_LOOT_AP: number
  readonly LOOT_VARIANCE_MIN: number
  readonly LOOT_VARIANCE_MAX: number
  readonly SERGEANT_LOOT_BONUS: number
  readonly GUILD_LOOT_AP_BONUS: number
  readonly LOOT_POPULATION_MIN: number
  readonly LOOT_POPULATION_MAX: number
  readonly LOOT_SOLDIERS_MIN: number
  readonly LOOT_SOLDIERS_MAX: number
  readonly LOOT_MIXED_AP_SHARE: number
  readonly LOOT_MIXED_POPULATION_MIN: number
  readonly LOOT_MIXED_POPULATION_MAX: number
  readonly LOOT_MIXED_SOLDIERS_MIN: number
  readonly LOOT_MIXED_SOLDIERS_MAX: number
  readonly FALSE_LEDGER_LOOT_MIN: number
  readonly FALSE_LEDGER_LOOT_MAX: number
  readonly TARGET_MIN_POWER: number
  readonly TARGET_POWER_ROLL_MIN: number
  readonly TARGET_POWER_ROLL_MAX: number
  readonly SCOUT_MARGIN_PER_SCOUT: number
  readonly SCOUT_MARGIN_PER_SPYMASTER: number
  readonly STEPPE_MARGIN_FACTOR: number
  readonly STEPPE_MAX_MARGIN: number
  readonly AMBUSH_BASE_CHANCE: number
  readonly FALSE_LEDGER_CHANCE: number
  readonly CAMPAIGN_OUTCOMES: {
    readonly decisive: CampaignBand & { readonly minRatio: number }
    readonly clear: CampaignBand
    readonly razorThin: CampaignBand
    readonly pyrrhic: CampaignBand & { readonly minRatio: number }
    readonly crushing: {
      readonly lootMultiplier: number
      readonly casualtyRate: number
      readonly unrestDelta: number
    }
  }
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

/**
 * Quota row of a deadline; a deadline without its own row reads the last row of the table.
 *
 * @param config - Engine configuration holding the quota table.
 * @param deadline - Deadline index.
 * @throws Error when the quota table is empty.
 */
export function quotaForDeadline(config: EngineConfig, deadline: number): DeadlineQuota {
  const quota =
    config.quotas.find((q) => q.deadline === deadline) ?? config.quotas[config.quotas.length - 1]
  if (!quota) throw new Error('The quota table is empty.')
  return quota
}
