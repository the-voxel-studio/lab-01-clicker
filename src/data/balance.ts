/**
 * Master Game Balance & System Constants for The Grand Audit.
 * Single source of truth for economic curves, unit pricing, population mechanics,
 * and quota scaling.
 *
 * @module data/balance
 */

import type {
  UnitId,
  UnitOrder,
  UnitRole,
  UnitTier,
  UnitBalanceDef,
  StatKey,
  ModifierOp,
  ResolverKey,
  Modifier,
  Effect,
  Command,
  RunPhase,
  BiomeId,
  BiomeDef,
} from '@/core/types'
import { ALLOWED_COMMANDS_BY_PHASE, isCommandAllowedInPhase } from '@/core/phases'

export type {
  UnitId,
  UnitOrder,
  UnitRole,
  UnitTier,
  UnitBalanceDef,
  StatKey,
  ModifierOp,
  ResolverKey,
  Modifier,
  Effect,
  Command,
  RunPhase,
  BiomeId,
  BiomeDef,
}
export { ALLOWED_COMMANDS_BY_PHASE, isCommandAllowedInPhase }

/**
 * Fundamental Scaling & Balance Constants.
 */
export const BALANCE = {
  // Economic Cost Scaling (Tier I vs Tier II)
  TIER_I_COST_RATIO: 1.07,
  TIER_II_COST_RATIO: 1.05,

  // Demographic Balance
  STARTING_POPULATION: 100,
  STARTING_PROVINCES: 3,
  BASE_HOUSING_PER_PROVINCE: 250, // Starting capacity = 750
  BASE_POP_GROWTH_RATE_R: 0.005, // 0.5% per second base logistic rate (r_0)
  OVERCROWDING_BLEED_RATE: 2.5, // Citizens dying/fleeing per second when Pop > MaxPop
  OVERCROWDING_UNREST_RATE: 0.1, // Unrest/s per 50 citizens of excess population (capped)

  // Civil Province Colonisation (Civilian expansion route)
  COLONISATION_BASE_COST: 1500,
  COLONISATION_COST_MULTIPLIER: 2.0, // Cost = 1500 * (2^k) for k colonised provinces

  // Fiscal & Bureaucracy
  STARTING_AP: 50,
  STARTING_TAX_RATE: 25, // Percent (0 - 60)
  STARTING_UNREST: 10,
  BUREAUCRACY_SCALE_S: 220,
  TAX_POLL_RATE: 0.02, // Base AP/s per free serf at 25% tax
  TAX_PROMULGATION_DELAY_SECONDS: 8,
  TAX_SHOCK_THRESHOLD: 15,
  TAX_SHOCK_UNREST_SPIKE: 20,

  // Ergonomic Clicker (Token Bucket)
  CLICK_MAX_TOKENS_PER_SECOND: 12,
  CLICK_CRITICAL_CHANCE: 0.05,
  CLICK_CRITICAL_MULTIPLIER: 3.0,
  CLICK_PAPERWORK_MITIGATION: 0.5, // Executive seals bypass 50% of paperwork

  // Special Roles Non-Quadratic Coverage Limit
  SERFS_PER_COLLECTOR: 100, // Each collector covers up to 100 free serfs

  // Province Floors
  PROVINCE_MIN_FLOOR_FOR_FINES: 1, // Royal censure & Lombard bailout cannot reduce below 1 province

  // Tactical Combat Asymmetry
  ATTACKER_SIEGE_FRICTION: 0.1, // -10% combat power when attacking
  DEFENDER_FORTIFICATION_BONUS: 0.2, // +20% combat power when defending
  BORDER_STRONGHOLD_DEFENSE_FLAT: 12,
  RAZOR_THIN_VICTORY_MARGIN: 0.05, // Within 5% of defeat -> no province won
  SCOUT_UNCERTAINTY_BASE: 0.45, // +/- 45% base fog of war
  SCOUT_UNCERTAINTY_MIN: 0.05, // +/- 5% with full scouts

  // Inter-Deadline Council
  DEADLINE_DURATION_SECONDS: 100,
  FIXED_STEP_SECONDS: 0.05, // Engine integration step: tick runs whole steps of this size
  INTERIM_AUDIT_WARNING_SECONDS: 50,
  TOTAL_DEADLINES: 10,

  // Royal Patent Charters (Tier II Unlocks)
  PATENT_COSTS: {
    people: 500,
    admin: 600,
    military: 700,
  },
  PATENT_MIN_DEADLINE: 3,
  PATENT_MIN_TIER_I_UNITS: 12,

  // Unrest Scale Thresholds
  UNREST_FISCAL_BOYCOTT_THRESHOLD: 50, // Unrest points: fiscal boycott stage starts
  UNREST_STRIFE_DESERTION_THRESHOLD: 75, // Unrest points: strife stage starts, desertions begin
  UNREST_URBAN_REBELLION_THRESHOLD: 90, // Unrest points: urban rebellion stage starts, ends Sanctuary Rights protection
  FISCAL_BOYCOTT_TAX_FACTOR: 0.8, // ratio: poll tax kept during a fiscal boycott
  URBAN_REBELLION_PRODUCTION_FACTOR: 0.5, // ratio: scribe and clerk output kept during an urban rebellion

  // Taxation & Unrest Generation
  TAX_REFERENCE_RATE: 25, // percent: tax rate at which poll tax, unrest and growth drag are neutral
  TAX_RATE_MAX: 60, // percent: highest tax rate a decree can set
  TAX_PLEDGE_RATE_LIMIT: 15, // percent: a promulgated rate above this breaks the low tax pledge
  TAX_UNREST_STEP_PERCENT: 10, // percent points: size of one tax step above the reference rate
  TAX_UNREST_PER_STEP: 0.05, // Unrest/s per tax step above the reference rate
  PRELATE_TAX_UNREST_DISCOUNT: 0.2, // ratio: tax unrest removed per Prelate
  PRELATE_TAX_UNREST_DISCOUNT_MAX: 0.8, // ratio: highest total tax unrest discount
  OVERCROWDING_EXCESS_POP_SCALE: 50, // citizens: excess population that yields one overcrowding unrest rate
  OVERCROWDING_UNREST_MAX: 1.0, // Unrest/s: ceiling of overcrowding unrest
  FISCAL_FACTOR_TAX_SPAN: 50, // percent points: tax excess that cancels population growth
  FISCAL_FACTOR_MIN: 0.1, // ratio: floor of the tax growth drag factor

  // Click, Orders & Paperwork
  CLICK_GROSS_RATE_SHARE: 0.035, // ratio: share of gross AP/s added to a click
  ORDER_CAP_SHARE_ADMIN: 0.15, // ratio of max population: Administration order cap
  ORDER_CAP_SHARE_MILITARY: 0.12, // ratio of max population: Military order cap
  ORDER_CAP_SHARE_PEOPLE: 0.25, // ratio of max population: People order cap
  PAPERWORK_SIZE_SOLDIER: 0.5, // size points: paperwork weight of one Soldier
  PAPERWORK_SIZE_TIER_I: 1.0, // size points: paperwork weight of one other Tier I unit
  PAPERWORK_SIZE_TIER_II: 2.0, // size points: paperwork weight of one Tier II unit
  PAPERWORK_SIZE_PER_PROVINCE: 10, // size points: paperwork weight of one province
  PAPERWORK_REDUCTION_MAX: 0.95, // ratio: highest paperwork mitigation from archivists
  PAPERWORK_FRICTION_MAX: 0.99, // ratio: highest paperwork friction
  MILITARY_UPKEEP_MIN_FACTOR: 0.2, // ratio: floor of military upkeep after quartermaster and marshal discounts
  PRINCELY_COUSIN_UPKEEP_SHARE: 0.35, // ratio: military upkeep over gross income above which the Princely Cousin appears
  OFFICER_ACADEMIES_BONUS_FACTOR: 2, // ratio: factor on sergeant and captain power bonuses under Officer Academies
  BULK_100_MIN_DEADLINE: 8, // deadline index: x100 bulk purchase unlocks (eligible units)
  BULK_50_MIN_DEADLINE: 6, // deadline index: x50 bulk purchase unlocks
  BULK_50_MIN_POPULATION: 1000, // citizens: population that also unlocks x50 bulk purchase
  BULK_10_MIN_DEADLINE: 3, // deadline index: x10 bulk purchase unlocks
  BULK_10_MIN_POPULATION: 250, // citizens: population that also unlocks x10 bulk purchase

  // Failsafes & Crises
  BANKRUPTCY_GRACE_BASE_SECONDS: 30, // seconds: bankruptcy grace timer before audit chambers
  BANKRUPTCY_GRACE_PER_AUDIT_CHAMBER_SECONDS: 10, // seconds: bankruptcy grace added per Audit Chamber
  LOMBARD_OFFER_REMAINING_SECONDS: 20, // seconds: grace left when the Lombard bailout is offered
  LOMBARD_MIN_PROVINCES: 2, // provinces: minimum held for the Lombard bailout offer
  LOMBARD_BAILOUT_AP: 2000, // AP: gold received by accepting the Lombard bailout
  DESERTION_INTERVAL_SOLDIER_SECONDS: 15, // seconds: between two Soldier desertions during strife
  DESERTION_INTERVAL_MAN_AT_ARMS_SECONDS: 30, // seconds: between two Man-at-Arms desertions during strife
  SURPRISE_RAID_MIN_DEADLINE: 3, // deadline index: surprise raids start
  SURPRISE_RAID_COOLDOWN_SECONDS: 60, // seconds: minimum gap between two surprise raids
  SURPRISE_RAID_CHECK_INTERVAL_SECONDS: 10, // seconds: spacing of surprise raid rolls inside a deadline
  RAID_BASE_PROBABILITY: 0.02, // probability: base surprise raid chance per roll
  RAID_WEALTH_THRESHOLD_AP: 2000, // AP: treasury above which raiders are more tempted
  RAID_WEALTH_MULTIPLIER: 2, // ratio: factor on the base chance when wealthy
  RAID_WEAK_ARMY_RATIO: 0.5, // ratio of the military quota: army below this adds raid chance
  RAID_WEAK_ARMY_PROBABILITY: 0.02, // probability: chance added by a weak army
  RAID_UNREST_THRESHOLD: 60, // Unrest points: unrest above this adds raid chance
  RAID_UNREST_PROBABILITY: 0.02, // probability: chance added by high unrest
  RAID_POWER_QUOTA_SHARE: 0.5, // ratio of the military quota: power of a surprise raid
  THREAT_POWER_QUOTA_SHARE: 0.8, // ratio of the military quota: power of a Crown threat
  THREAT_TRIBUTE_QUOTA_SECONDS: 20, // seconds of the AP rate quota: Crown tribute
  THREAT_TRIBUTE_LATE_QUOTA_SECONDS: 4, // seconds of the AP rate quota: tribute from the late deadlines
  THREAT_TRIBUTE_LATE_FIRST_DEADLINE: 8, // deadline index: first deadline asking the late tribute
  THREAT_HERALD_FIRST_DEADLINE: 2, // deadline index: first deadline that heralds the next threat
  LEVY_CASUALTY_SHARE: 0.05, // ratio of population: lost to a Levy en Masse
  LEVY_UNREST: 30, // Unrest points: added by a Levy en Masse

  // Audit & Run Structure
  AUDIT_METRICS_REQUIRED: 2, // metrics: quotas to meet out of three
  MAX_STRIKES: 2, // strikes: cap of the strike counter
  ROYAL_CENSURE_AP_CONFISCATION: 0.5, // ratio: share of positive AP confiscated by a Royal Censure
  AUDITORS_INQUISITION_UNREST: 15, // Unrest points: added after each audit under Auditors' Inquisition
  EXCEPTIONAL_TITHE_UNREST: 30, // Unrest points: added after the audit under Exceptional Tithe
  FAST_FORWARD_MIN_DEADLINE: 5, // deadline index: fast forward unlocks
  LAW_SLOTS_BASE: 5, // slots: active laws allowed
  DISBAND_SEVERANCE_SHARE: 0.5, // ratio of base cost: severance paid per disbanded unit
  DISBAND_UNPAID_UNREST: 2, // Unrest points: per unpaid disbanded unit
  MUTINY_WINDOW_SECONDS: 10, // seconds: rolling window of military demobilization
  MUTINY_THRESHOLD_SHARE: 0.1, // ratio of military: demobilized inside the window that causes a mutiny
  MUTINY_UNREST: 15, // Unrest points: added by a mutiny
  SCORE_PER_CUMULATIVE_AP: 0.01, // points per AP: cumulative gross AP in the run score
  SCORE_PER_PEAK_POPULATION: 2, // points per citizen: peak population in the run score
  SCORE_PER_PROVINCE: 500, // points per province: held provinces in the run score
  SCORE_PER_VICTORY: 200, // points per victory: battles won in the run score
  SCORE_PENALTY_PER_STRIKE: 1000, // points per strike: subtracted from the run score
  TITLE_CONQUEROR_CAPTURED_PROVINCES: 8, // provinces: captured for the Bloodied Conqueror title
  TITLE_NATION_FATHER_POPULATION: 4000, // citizens: population for the Father of the Nation title
  TITLE_TREASURER_ADMIN_SHARE: 0.6, // ratio of score: administrative share for the Grand Treasurer title

  // Combat
  ATTACKER_ROLL_MIN: 0.92, // ratio: lowest attacker combat roll
  ATTACKER_ROLL_MAX: 1.08, // ratio: highest attacker combat roll
  DEFENDER_ROLL_MIN: 0.95, // ratio: lowest defender combat roll
  DEFENDER_ROLL_MAX: 1.1, // ratio: highest defender combat roll
  VANGUARD_ROLL_MIN: 1.05, // ratio: lowest commanded combat roll under Vanguard Drills
  VANGUARD_ROLL_MAX: 1.2, // ratio: highest commanded combat roll under Vanguard Drills
  MAN_AT_ARMS_DEFENSE_FLAT: 0.5, // power: flat defense per Man-at-Arms
  GUERRILLA_STRONGHOLD_FACTOR: 2, // ratio: factor on stronghold defense under Guerrilla Border Watch
  UNDEFENDED_CLASH_RATIO: 999, // ratio: clash ratio against a defender of no power
  AMBUSH_POWER_FACTOR: 1.25, // ratio: ambush power over the highest scouted estimate
  CAPTAIN_CASUALTY_DISCOUNT: 0.05, // ratio: casualty rate removed per Captain
  CAPTAIN_CASUALTY_DISCOUNT_MAX: 0.5, // ratio: highest casualty discount
  SANCTIONED_PLUNDER_UNREST: 15, // Unrest points: added by each campaign under Sanctioned Plunder
  DEFENSE_VICTORY_CASUALTY_RATE: 0.1, // ratio: military casualties of a won defense
  DEFENSE_VICTORY_UNREST_DELTA: -5, // Unrest points: change after a won defense
  DEFENSE_SALVAGE_SHARE: 0.25, // ratio of tribute: battlefield salvage of a won defense
  SALVAGE_ROLL_MIN: 0.8, // ratio: lowest salvage roll
  SALVAGE_ROLL_MAX: 1.2, // ratio: highest salvage roll
  COLLAPSE_CIVILIAN_LOSS_MIN: 0.15, // ratio of population: lowest civilian loss in a defensive collapse
  COLLAPSE_CIVILIAN_LOSS_MAX: 0.25, // ratio of population: highest civilian loss in a defensive collapse
  COLLAPSE_AP_LOSS_MIN: 0.3, // ratio of treasury: lowest AP looted in a defensive collapse
  COLLAPSE_AP_LOSS_MAX: 0.5, // ratio of treasury: highest AP looted in a defensive collapse
  COLLAPSE_UNREST: 20, // Unrest points: added by a defensive collapse

  // Campaigns, Loot & Reconnaissance
  CAMPAIGN_BASE_LOOT_QUOTA_SECONDS: 10, // seconds of the AP rate quota: base AP spoils of a campaign
  CAMPAIGN_DEFAULT_BASE_LOOT_AP: 300, // AP: base spoils when a caller gives none
  LOOT_VARIANCE_MIN: 0.8, // ratio: lowest AP loot variance
  LOOT_VARIANCE_MAX: 1.2, // ratio: highest AP loot variance
  SERGEANT_LOOT_BONUS: 0.02, // ratio: loot value added per Sergeant
  GUILD_LOOT_AP_BONUS: 0.01, // ratio: AP loot added per Guild
  LOOT_POPULATION_MIN: 25, // citizens: lowest population loot
  LOOT_POPULATION_MAX: 75, // citizens: highest population loot
  LOOT_SOLDIERS_MIN: 5, // soldiers: lowest soldier loot
  LOOT_SOLDIERS_MAX: 15, // soldiers: highest soldier loot
  LOOT_MIXED_AP_SHARE: 0.5, // ratio: AP share of a mixed loot
  LOOT_MIXED_POPULATION_MIN: 15, // citizens: lowest population in a mixed loot
  LOOT_MIXED_POPULATION_MAX: 35, // citizens: highest population in a mixed loot
  LOOT_MIXED_SOLDIERS_MIN: 2, // soldiers: lowest soldiers in a mixed loot
  LOOT_MIXED_SOLDIERS_MAX: 6, // soldiers: highest soldiers in a mixed loot
  FALSE_LEDGER_LOOT_MIN: 0.2, // ratio: lowest loot kept from a false ledger
  FALSE_LEDGER_LOOT_MAX: 0.4, // ratio: highest loot kept from a false ledger
  TARGET_MIN_POWER: 15, // power: floor of a campaign target
  TARGET_POWER_ROLL_MIN: 0.7, // ratio of the military quota: lowest target power
  TARGET_POWER_ROLL_MAX: 1.1, // ratio of the military quota: highest target power
  SCOUT_MARGIN_PER_SCOUT: 0.12, // ratio: uncertainty margin removed per Scout
  SCOUT_MARGIN_PER_SPYMASTER: 0.3, // ratio: uncertainty margin removed per Spymaster
  STEPPE_MARGIN_FACTOR: 2, // ratio: factor on the margin of Steppe Horsemen
  STEPPE_MAX_MARGIN: 0.9, // ratio: ceiling of the margin of Steppe Horsemen
  AMBUSH_BASE_CHANCE: 0.1, // probability: base chance a target is an ambush
  FALSE_LEDGER_CHANCE: 0.15, // probability: chance a target carries a false ledger

  // Campaign outcome table by clash ratio; casualties follow CAMPAIGN_CASUALTY_CURVE
  // Soldiers lost by clash ratio: points of a linear curve, flat outside them
  CAMPAIGN_CASUALTY_CURVE: [
    [0.8, 1],
    [0.9, 0.75],
    [1.0, 0.5],
    [1.2, 0.25],
    [1.4, 0.1],
  ],
  CAMPAIGN_CASUALTY_ROLL: 0.02, // ratio: uniform roll around the curve
  CONQUEST_SURCHARGE_STEP: 0.05, // ratio: added to all quotas per conquest beyond the free one

  CAMPAIGN_OUTCOMES: {
    decisive: {
      minRatio: 1.4, // ratio: clash ratio from which the victory is decisive
      lootMultiplier: 1.2, // ratio: share of the base loot
      unrestDelta: -5, // Unrest points
    },
    clear: {
      lootMultiplier: 1.0, // ratio
      unrestDelta: 0, // Unrest points
    },
    razorThin: {
      lootMultiplier: 0.5, // ratio
      unrestDelta: 5, // Unrest points
    },
    pyrrhic: {
      minRatio: 0.8, // ratio: clash ratio from which a defeat is only a standoff
      lootMultiplier: 0, // ratio
      unrestDelta: 15, // Unrest points
    },
    crushing: {
      lootMultiplier: 0, // ratio
      unrestDelta: 25, // Unrest points
    },
  },
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

/** Re-export 5 Province Biomes catalog from dedicated module. */
export { BIOMES_DATA } from './biomes'

/**
 * Dynamic calculation of Crown threat power based on deadline military quota.
 *
 * @param militaryQuota - Military power quota of the deadline.
 * @param quotaShare - Share of the quota the threat fields (ratio).
 */
export function getThreatPower(
  militaryQuota: number,
  quotaShare: number = BALANCE.THREAT_POWER_QUOTA_SHARE,
): number {
  return Math.round(quotaShare * militaryQuota)
}

/**
 * Seconds of the AP rate quota a tribute asks at a deadline: `THREAT_TRIBUTE_QUOTA_SECONDS`, then
 * `THREAT_TRIBUTE_LATE_QUOTA_SECONDS` from `THREAT_TRIBUTE_LATE_FIRST_DEADLINE`.
 *
 * @param deadline - Deadline the tribute is asked for.
 * @param balance - Balance numbers in force.
 */
export function getThreatTributeSeconds(
  deadline: number,
  balance: Readonly<
    Record<
      | 'THREAT_TRIBUTE_QUOTA_SECONDS'
      | 'THREAT_TRIBUTE_LATE_QUOTA_SECONDS'
      | 'THREAT_TRIBUTE_LATE_FIRST_DEADLINE',
      number
    >
  > = BALANCE,
): number {
  return deadline >= balance.THREAT_TRIBUTE_LATE_FIRST_DEADLINE
    ? balance.THREAT_TRIBUTE_LATE_QUOTA_SECONDS
    : balance.THREAT_TRIBUTE_QUOTA_SECONDS
}

/**
 * Crown tribute for an AP gross rate quota: `quotaSeconds` seconds of required throughput (pick them with
 * `getThreatTributeSeconds`).
 *
 * @param apRate - AP gross rate quota (AP/s).
 * @param quotaSeconds - Seconds of the AP rate quota the tribute asks.
 * @returns Tribute AP cost.
 */
export function getThreatTributeAp(apRate: number, quotaSeconds: number): number {
  return Math.round(quotaSeconds * apRate)
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
    tributeAp: getThreatTributeAp(quota.apRate, getThreatTributeSeconds(quota.deadline)),
  }
}

// Re-exports for Gate D/E Content Catalogs
export * from './edicts'
export * from './archives'
export * from './feats'
export * from './threats'
