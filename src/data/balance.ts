/**
 * Master Game Balance & System Constants for The Grand Audit.
 * Single source of truth for economic curves, unit pricing, population mechanics,
 * and quota scaling.
 *
 * @module data/balance
 */

/** Canonical Unit Identifiers (English only). */
export type UnitId =
  // The People (Tier I & II)
  | 'peasant'
  | 'farmer'
  | 'artisan'
  | 'guild'
  | 'clergy'
  | 'prelate'
  | 'notable'
  | 'baron'
  // Administration (Tier I & II)
  | 'scribe'
  | 'clerk'
  | 'supervisor'
  | 'provincial_steward'
  | 'archivist'
  | 'audit_chamber'
  | 'collector'
  | 'farmer_general'
  // The Military (Tier I & II)
  | 'soldier'
  | 'man_at_arms'
  | 'sergeant'
  | 'captain'
  | 'quartermaster'
  | 'grand_marshal'
  | 'scout'
  | 'spymaster'

/** Stat keys that can be dynamically altered by Modifiers. */
export type StatKey =
  | 'gross_ap_rate'
  | 'net_ap_rate'
  | 'click_power'
  | 'paperwork_friction'
  | 'unrest_growth'
  | 'pop_growth_rate'
  | 'housing_capacity'
  | 'military_power'
  | 'tax_efficiency'
  | 'battle_loot_multiplier'
  | 'threat_mitigation_rate'

/** Arithmetic composition operation: 'add' -> 'addPct' -> 'mul' -> 'set'. */
export type ModifierOp = 'add' | 'addPct' | 'mul' | 'set'

/** Literal union of supported dynamic conditional resolver keys. */
export type ResolverKey =
  | 'law:isolationism'
  | 'law:provincial_tithe'
  | 'law:border_fortifications'
  | 'law:feudal_levy'
  | 'law:monastic_scriptoria'
  | 'perk:iron_fist'

/** Universal Modifier Contract for laws, perks, edicts, and faction traits. */
export interface Modifier {
  /** Optional unique modifier instance ID. */
  id?: string
  /** Identifier of the originating system (e.g. 'law:cadastre', 'faction:veterans'). */
  source: string
  /** The target stat modified. */
  stat: StatKey
  /** Arithmetic composition operation: 'add' -> 'addPct' -> 'mul' -> 'set'. */
  op: ModifierOp
  /** The scalar value to apply. */
  value: number
  /** Game timestamp (in seconds) or tick when this modifier was applied. */
  appliedAt?: number
  /** Game timestamp (in seconds) when this modifier expires (undefined = permanent). */
  expiresAt?: number
  /**
   * Optional strongly typed resolver key for dynamic conditional modifiers.
   * Evaluated dynamically against current GameState, never serialized as a function.
   */
  resolverKey?: ResolverKey
}

/** Unit Tier level. */
export type UnitTier = 1 | 2

/** Unit Order category. */
export type UnitOrder = 'people' | 'admin' | 'military'

/** Unit Role taxonomy. */
export type UnitRole = 'producer' | 'multiplier' | 'reducer' | 'special'

/** Unit definition contract. */
export interface UnitBalanceDef {
  id: UnitId
  order: UnitOrder
  tier: UnitTier
  role: UnitRole
  baseCost: number
  upkeepAp: number
  baseValue: number
  /** Base geometric scaling ratio: 1.07 for Tier I, 1.05 for Tier II. */
  costRatio: number
  /** Whether bulk mode x100 is enabled for this unit. */
  allowsBulk100: boolean
}

/**
 * Fundamental Scaling & Balance Constants.
 */
export const BALANCE = {
  // 1. Economic Cost Scaling (Tier I vs Tier II)
  TIER_I_COST_RATIO: 1.07,
  TIER_II_COST_RATIO: 1.05,

  // 2. Demographic Balance
  STARTING_POPULATION: 100,
  STARTING_PROVINCES: 3,
  BASE_HOUSING_PER_PROVINCE: 250, // Starting capacity = 750
  BASE_POP_GROWTH_RATE_R: 0.005, // 0.5% per second base logistic rate (r_0)
  OVERCROWDING_BLEED_RATE: 2.5, // Citizens dying/fleeing per second when Pop > MaxPop
  OVERCROWDING_UNREST_RATE: 0.15, // Unrest generated per second during housing crisis

  // Civil Province Colonisation (Civilian expansion route)
  COLONISATION_BASE_COST: 1500,
  COLONISATION_COST_MULTIPLIER: 2.0, // Cost = 1500 * (2^k) for k colonised provinces

  // 3. Fiscal & Bureaucracy
  STARTING_AP: 50,
  STARTING_TAX_RATE: 25, // Percent (0 - 60)
  STARTING_UNREST: 10,
  BUREAUCRACY_SCALE_S: 220,
  TAX_POLL_RATE: 0.02, // Base AP/s per free serf at 25% tax
  TAX_PROMULGATION_DELAY_SECONDS: 8,
  TAX_SHOCK_THRESHOLD: 15,
  TAX_SHOCK_UNREST_SPIKE: 20,

  // 4. Ergonomic Clicker (Token Bucket)
  CLICK_MAX_TOKENS_PER_SECOND: 12,
  CLICK_CRITICAL_CHANCE: 0.05,
  CLICK_CRITICAL_MULTIPLIER: 3.0,
  CLICK_PAPERWORK_MITIGATION: 0.5, // Executive seals bypass 50% of paperwork

  // 5. Special Roles Non-Quadratic Coverage Limit
  SERFS_PER_COLLECTOR: 100, // Each collector covers up to 100 free serfs

  // 6. Province Floors
  PROVINCE_MIN_FLOOR_FOR_FINES: 1, // Royal censure & Lombard bailout cannot reduce below 1 province

  // 7. Tactical Combat Asymmetry
  ATTACKER_SIEGE_FRICTION: 0.1, // -10% combat power when attacking
  DEFENDER_FORTIFICATION_BONUS: 0.2, // +20% combat power when defending
  BORDER_STRONGHOLD_DEFENSE_FLAT: 12,
  RAZOR_THIN_VICTORY_MARGIN: 0.05, // Within 5% of defeat -> no province won
  SCOUT_UNCERTAINTY_BASE: 0.45, // +/- 45% base fog of war
  SCOUT_UNCERTAINTY_MIN: 0.05, // +/- 5% with full scouts

  // 8. Inter-Deadline Council
  DEADLINE_DURATION_SECONDS: 100,
  INTERIM_AUDIT_WARNING_SECONDS: 50,
  TOTAL_DEADLINES: 10,

  // 9. Royal Patent Charters (Tier II Unlocks)
  PATENT_COSTS: {
    people: 500,
    admin: 600,
    military: 700,
  },
  PATENT_MIN_DEADLINE: 4,
  PATENT_MIN_TIER_I_UNITS: 12,
} as const

import { DEADLINE_QUOTAS, type DeadlineQuota } from './balance.generated'
export { DEADLINE_QUOTAS, type DeadlineQuota }

/**
 * 24 Unit Definitions Table with exact formulas and scaling ratios.
 */
export const UNITS_DATA: Record<UnitId, UnitBalanceDef> = {
  // THE PEOPLE
  peasant: {
    id: 'peasant',
    order: 'people',
    tier: 1,
    role: 'producer',
    baseCost: 20,
    upkeepAp: 0,
    baseValue: 0.0005, // Modulates r by +0.05%
    costRatio: BALANCE.TIER_I_COST_RATIO,
    allowsBulk100: true,
  },
  farmer: {
    id: 'farmer',
    order: 'people',
    tier: 2,
    role: 'producer',
    baseCost: 120,
    upkeepAp: 0.1,
    baseValue: 0.003, // Modulates r by +0.30%
    costRatio: BALANCE.TIER_II_COST_RATIO,
    allowsBulk100: false,
  },
  artisan: {
    id: 'artisan',
    order: 'people',
    tier: 1,
    role: 'multiplier',
    baseCost: 60,
    upkeepAp: 0,
    baseValue: 0.005, // +0.5% tax efficiency
    costRatio: BALANCE.TIER_I_COST_RATIO,
    allowsBulk100: false,
  },
  guild: {
    id: 'guild',
    order: 'people',
    tier: 2,
    role: 'multiplier',
    baseCost: 300,
    upkeepAp: 0.3,
    baseValue: 0.035, // +3.5% tax efficiency
    costRatio: BALANCE.TIER_II_COST_RATIO,
    allowsBulk100: false,
  },
  clergy: {
    id: 'clergy',
    order: 'people',
    tier: 1,
    role: 'reducer',
    baseCost: 50,
    upkeepAp: 0,
    baseValue: 0.02, // -0.02 Unrest/s
    costRatio: BALANCE.TIER_I_COST_RATIO,
    allowsBulk100: false,
  },
  prelate: {
    id: 'prelate',
    order: 'people',
    tier: 2,
    role: 'reducer',
    baseCost: 250,
    upkeepAp: 0.5,
    baseValue: 0.15, // -0.15 Unrest/s
    costRatio: BALANCE.TIER_II_COST_RATIO,
    allowsBulk100: false,
  },
  notable: {
    id: 'notable',
    order: 'people',
    tier: 1,
    role: 'special',
    baseCost: 150,
    upkeepAp: 0,
    baseValue: 0.015, // +1.5% housing capacity and order caps
    costRatio: BALANCE.TIER_I_COST_RATIO,
    allowsBulk100: false,
  },
  baron: {
    id: 'baron',
    order: 'people',
    tier: 2,
    role: 'special',
    baseCost: 800,
    upkeepAp: 2.0,
    baseValue: 0.06, // +6.0% housing capacity and order caps
    costRatio: BALANCE.TIER_II_COST_RATIO,
    allowsBulk100: false,
  },

  // ADMINISTRATION
  scribe: {
    id: 'scribe',
    order: 'admin',
    tier: 1,
    role: 'producer',
    baseCost: 15,
    upkeepAp: 0,
    baseValue: 0.5, // +0.5 gross AP/s
    costRatio: BALANCE.TIER_I_COST_RATIO,
    allowsBulk100: true,
  },
  clerk: {
    id: 'clerk',
    order: 'admin',
    tier: 2,
    role: 'producer',
    baseCost: 100,
    upkeepAp: 0.5,
    baseValue: 4.0, // +4.0 gross AP/s
    costRatio: BALANCE.TIER_II_COST_RATIO,
    allowsBulk100: false,
  },
  supervisor: {
    id: 'supervisor',
    order: 'admin',
    tier: 1,
    role: 'multiplier',
    baseCost: 80,
    upkeepAp: 0,
    baseValue: 0.02, // +2.0% production of scribes & clerks
    costRatio: BALANCE.TIER_I_COST_RATIO,
    allowsBulk100: false,
  },
  provincial_steward: {
    id: 'provincial_steward',
    order: 'admin',
    tier: 2,
    role: 'multiplier',
    baseCost: 400,
    upkeepAp: 1.0,
    baseValue: 0.09, // +9.0% production of scribes & clerks
    costRatio: BALANCE.TIER_II_COST_RATIO,
    allowsBulk100: false,
  },
  archivist: {
    id: 'archivist',
    order: 'admin',
    tier: 1,
    role: 'reducer',
    baseCost: 70,
    upkeepAp: 0,
    baseValue: 0.015, // -1.5% paperwork inertia
    costRatio: BALANCE.TIER_I_COST_RATIO,
    allowsBulk100: false,
  },
  audit_chamber: {
    id: 'audit_chamber',
    order: 'admin',
    tier: 2,
    role: 'reducer',
    baseCost: 350,
    upkeepAp: 1.0,
    baseValue: 0.065, // -6.5% paperwork inertia
    costRatio: BALANCE.TIER_II_COST_RATIO,
    allowsBulk100: false,
  },
  collector: {
    id: 'collector',
    order: 'admin',
    tier: 1,
    role: 'special',
    baseCost: 120,
    upkeepAp: 0,
    baseValue: 0.8, // +0.80 AP/s per covered 100 free serfs
    costRatio: BALANCE.TIER_I_COST_RATIO,
    allowsBulk100: false,
  },
  farmer_general: {
    id: 'farmer_general',
    order: 'admin',
    tier: 2,
    role: 'special',
    baseCost: 600,
    upkeepAp: 2.0,
    baseValue: 4.5, // +4.50 AP/s per covered 100 free serfs
    costRatio: BALANCE.TIER_II_COST_RATIO,
    allowsBulk100: false,
  },

  // THE MILITARY
  soldier: {
    id: 'soldier',
    order: 'military',
    tier: 1,
    role: 'producer',
    baseCost: 25,
    upkeepAp: 0.3,
    baseValue: 1.0, // +1.0 Military Power
    costRatio: BALANCE.TIER_I_COST_RATIO,
    allowsBulk100: false,
  },
  man_at_arms: {
    id: 'man_at_arms',
    order: 'military',
    tier: 2,
    role: 'producer',
    baseCost: 150,
    upkeepAp: 1.5,
    baseValue: 7.0, // +7.0 Military Power
    costRatio: BALANCE.TIER_II_COST_RATIO,
    allowsBulk100: false,
  },
  sergeant: {
    id: 'sergeant',
    order: 'military',
    tier: 1,
    role: 'multiplier',
    baseCost: 100,
    upkeepAp: 0,
    baseValue: 0.015, // +1.5% military power
    costRatio: BALANCE.TIER_I_COST_RATIO,
    allowsBulk100: false,
  },
  captain: {
    id: 'captain',
    order: 'military',
    tier: 2,
    role: 'multiplier',
    baseCost: 500,
    upkeepAp: 1.0,
    baseValue: 0.07, // +7.0% military power
    costRatio: BALANCE.TIER_II_COST_RATIO,
    allowsBulk100: false,
  },
  quartermaster: {
    id: 'quartermaster',
    order: 'military',
    tier: 1,
    role: 'reducer',
    baseCost: 90,
    upkeepAp: 0,
    baseValue: 0.015, // -1.5% military upkeep
    costRatio: BALANCE.TIER_I_COST_RATIO,
    allowsBulk100: false,
  },
  grand_marshal: {
    id: 'grand_marshal',
    order: 'military',
    tier: 2,
    role: 'reducer',
    baseCost: 450,
    upkeepAp: 1.0,
    baseValue: 0.07, // -7.0% military upkeep
    costRatio: BALANCE.TIER_II_COST_RATIO,
    allowsBulk100: false,
  },
  scout: {
    id: 'scout',
    order: 'military',
    tier: 1,
    role: 'special',
    baseCost: 110,
    upkeepAp: 0.1,
    baseValue: 12, // Narrows fog of war uncertainty
    costRatio: BALANCE.TIER_I_COST_RATIO,
    allowsBulk100: false,
  },
  spymaster: {
    id: 'spymaster',
    order: 'military',
    tier: 2,
    role: 'special',
    baseCost: 550,
    upkeepAp: 2.0,
    baseValue: 30, // Reveals ambushes and false loot
    costRatio: BALANCE.TIER_II_COST_RATIO,
    allowsBulk100: false,
  },
}

// Re-export core formulas and modifier engines from single source of truth (src/core/)
export {
  calculateUnitCost,
  calculateColonisationCost,
  calculateLogisticGrowth,
  calculateCollectorYield,
} from '@/core/formulas'

export {
  composeStat,
  TickStatCache,
  DYNAMIC_MODIFIER_RESOLVERS,
  type RawEvaluationState,
  type DynamicResolverResult,
  type DynamicModifierResolver,
} from '@/core/modifiers'

/** Province Biome Identifiers. */
export type BiomeId = 'farmlands' | 'trade_hub' | 'stronghold' | 'wilderness'

/** Province Biome definition contract. */
export interface BiomeDef {
  id: BiomeId
  name: string
  /** Housing capacity multiplier: 1.5 for Farmlands, 0.8 for Wilderness, 1.0 for others. */
  housingMultiplier: number
  /** Additive modulation to base logistic growth rate r: +0.001 for Farmlands. */
  deltaR: number
  /** Realm-wide tax efficiency bonus: +0.15 for Trade Hub. */
  taxEfficiencyBonus: number
  /** Passive defense power in defensive battles: +12 for Stronghold. */
  passiveDefense: number
  /** Bureaucratic paperwork reduction: +0.05 (5%) for Wilderness. */
  paperworkReduction: number
}

/** 4 Province Biomes data catalog. */
export const BIOMES_DATA: Record<BiomeId, BiomeDef> = {
  farmlands: {
    id: 'farmlands',
    name: 'Arable Plains',
    housingMultiplier: 1.5,
    deltaR: 0.001,
    taxEfficiencyBonus: 0,
    passiveDefense: 0,
    paperworkReduction: 0,
  },
  trade_hub: {
    id: 'trade_hub',
    name: 'Trade Hub',
    housingMultiplier: 1.0,
    deltaR: 0,
    taxEfficiencyBonus: 0.15,
    passiveDefense: 0,
    paperworkReduction: 0,
  },
  stronghold: {
    id: 'stronghold',
    name: 'Border Stronghold',
    housingMultiplier: 1.0,
    deltaR: 0,
    taxEfficiencyBonus: 0,
    passiveDefense: 12,
    paperworkReduction: 0,
  },
  wilderness: {
    id: 'wilderness',
    name: 'Marshes & Forests',
    housingMultiplier: 0.8,
    deltaR: 0,
    taxEfficiencyBonus: 0,
    passiveDefense: 0,
    paperworkReduction: 0.05,
  },
}

/**
 * Dynamic calculation of Crown threat power based on deadline military quota (80%).
 */
export function getThreatPower(militaryQuota: number): number {
  return Math.round(0.8 * militaryQuota)
}

/**
 * Dynamic calculation of Crown threat tribute based on deadline AP quota (20%).
 */
export function getThreatTributeAp(apQuota: number): number {
  return Math.round(0.2 * apQuota)
}

/**
 * Returns the dynamically computed threat definition for a given deadline quota.
 */
export function getDeadlineThreat(quota: DeadlineQuota): {
  deadline: number
  power: number
  tributeAp: number
} {
  return {
    deadline: quota.deadline,
    power: getThreatPower(quota.military),
    tributeAp: getThreatTributeAp(quota.ap),
  }
}

/**
 * Universal Effect Taxonomy:
 * Distinguishes continuous StatModifiers from instant resource transfers, unit grants, and global rule flags.
 */
export type Effect =
  | { type: 'stat_modifier'; modifier: Modifier }
  | { type: 'instant_resource'; resource: 'ap' | 'population' | 'unrest' | 'provinces' | 'archive_points'; amount: number }
  | { type: 'grant_units'; unitId: UnitId; count: number }
  | { type: 'rule_flag'; flag: string; enabled: boolean }

/**
 * Command Interface Taxonomy:
 * Single dispatchable command contracts for the engine state machine.
 */
export type Command =
  // Active governance commands
  | { type: 'BUY_UNIT'; unitId: UnitId; count: number }
  | { type: 'SET_TAX_RATE'; rate: number }
  | { type: 'STAMP_DOCUMENT'; isCritical?: boolean }
  | { type: 'COLONISE_PROVINCE' }
  | { type: 'ENACT_EDICT'; edictId: 'forced_tithe' | 'church_seizure' | 'grand_festival' }
  | { type: 'UNLOCK_PATENT'; order: UnitOrder }
  | { type: 'TICK'; dt: number }

  // Inter-deadline sequence commands
  | { type: 'SUBMIT_AUDIT' }
  | { type: 'RESOLVE_DILEMMA'; dilemmaId: string; choiceIndex: number }
  | { type: 'ENACT_LAW'; lawId: string }
  | { type: 'REJECT_LAWS' }
  | { type: 'SELECT_THREAT_RESPONSE'; response: 'defense' | 'tribute' | 'levy' }
  | { type: 'LAUNCH_ATTACK'; targetProvinceIndex?: number }
  | { type: 'RECON_PATROL' }
  | { type: 'SKIP_EXPEDITION' }
  | { type: 'RESUME_GOVERNANCE' }

  // Crisis & Special commands
  | { type: 'RESOLVE_RAID_DEFENSE' }
  | { type: 'ACCEPT_LOMBARD_LOAN' }
  | { type: 'REFUSE_LOMBARD_LOAN' }
  | { type: 'RESOLVE_COMBAT' }
  | { type: 'RESTART_RUN'; seed?: number }

/**
 * Engine Run Phase State Machine.
 * Inter-deadline sequence follows GAME_RULES §8 exactly.
 */
export type RunPhase =
  // Inter-deadline sequence (GAME_RULES §8)
  | 'AUDIT_ASSESSMENT'     // 1. Quotas evaluated, sanction/pardon or victory
  | 'COUNCIL_DILEMMA'      // 2. Steward dilemma presentation
  | 'COUNCIL_LAWS'         // 3. Council laws draft / reject
  | 'THREAT_HERALD'        // 4. Upcoming threat announcement & response
  | 'EXPEDITION'           // 5. Campaign planning, scout rerolls, launch
  | 'AWAIT_RESUME'         // 6. Paused before unpausing, "Resume Governance" CTA

  // Active loop & Crisis states
  | 'ACTIVE_CYCLE'         // Main ticking governance phase
  | 'SURPRISE_RAID'        // Spontaneous border raid interrupting cycle
  | 'LOMBARD_OFFER'        // Offered at 20s of bankruptcy grace timer (pauses countdown)
  | 'COMBAT_RESOLUTION'    // Tactical battle clash resolution
  | 'RUN_VICTORY'          // Beat deadline 10
  | 'RUN_DEFEAT'           // Game over

/** Allowed dispatchable commands per RunPhase. */
export const ALLOWED_COMMANDS_BY_PHASE: Record<RunPhase, readonly Command['type'][]> = {
  ACTIVE_CYCLE: ['BUY_UNIT', 'SET_TAX_RATE', 'STAMP_DOCUMENT', 'COLONISE_PROVINCE', 'ENACT_EDICT', 'UNLOCK_PATENT', 'TICK'],
  AUDIT_ASSESSMENT: ['SUBMIT_AUDIT'],
  COUNCIL_DILEMMA: ['RESOLVE_DILEMMA'],
  COUNCIL_LAWS: ['ENACT_LAW', 'REJECT_LAWS'],
  THREAT_HERALD: ['SELECT_THREAT_RESPONSE'],
  EXPEDITION: ['LAUNCH_ATTACK', 'RECON_PATROL', 'SKIP_EXPEDITION'],
  AWAIT_RESUME: ['RESUME_GOVERNANCE', 'BUY_UNIT', 'COLONISE_PROVINCE', 'SET_TAX_RATE', 'UNLOCK_PATENT'],
  SURPRISE_RAID: ['RESOLVE_RAID_DEFENSE'],
  LOMBARD_OFFER: ['ACCEPT_LOMBARD_LOAN', 'REFUSE_LOMBARD_LOAN'],
  COMBAT_RESOLUTION: ['RESOLVE_COMBAT'],
  RUN_VICTORY: ['RESTART_RUN'],
  RUN_DEFEAT: ['RESTART_RUN'],
}

/** Validates whether a command type is permitted in the given run phase. */
export function isCommandAllowedInPhase(phase: RunPhase, commandType: Command['type']): boolean {
  return ALLOWED_COMMANDS_BY_PHASE[phase]?.includes(commandType) ?? false
}
