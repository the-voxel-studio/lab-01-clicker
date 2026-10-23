/**
 * Core Domain Types, State Interfaces, and Command Contracts.
 * Completely decoupled from Vue reactivity, DOM APIs, and data catalogs.
 * Single source of truth for engine types.
 *
 * @module core/types
 */

import type { RngStream } from './prng'
import type { RunPhase } from './phases'

export type { RngStream }
export type { RunPhase }
export { ALLOWED_COMMANDS_BY_PHASE, isCommandAllowedInPhase } from './phases'

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

/** Unit Order category. */
export type UnitOrder = 'people' | 'admin' | 'military'

/** Unit Role taxonomy. */
export type UnitRole = 'producer' | 'multiplier' | 'reducer' | 'special'

/** Unit Tier level. */
export type UnitTier = 1 | 2

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

/** Province Biome definition contract. */
export interface BiomeDef {
  id: BiomeId
  name: string
  /** Housing capacity multiplier: 1.0 for Heartland, 1.5 for Farmlands, 0.8 for Wilderness. */
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

/** Runtime list of every stat key that Modifiers can alter. */
export const STAT_KEYS = [
  'gross_ap_rate',
  'net_ap_rate',
  'click_power',
  'paperwork_friction',
  'unrest_generation',
  'unrest_pacification',
  'pop_growth_rate',
  'housing_capacity',
  'military_power',
  'tax_efficiency',
  'battle_loot_multiplier',
  'threat_mitigation_rate',
] as const

/** Stat keys that can be dynamically altered by Modifiers. */
export type StatKey = (typeof STAT_KEYS)[number]

/** Runtime list of every arithmetic composition operation. */
export const MODIFIER_OPS = ['add', 'addPct', 'mul', 'set'] as const

/** Arithmetic composition operation: 'add' -> 'addPct' -> 'mul' -> 'set'. */
export type ModifierOp = (typeof MODIFIER_OPS)[number]

/** Runtime list of every supported dynamic conditional resolver key. */
export const RESOLVER_KEYS = [
  'law:isolationism',
  'law:provincial_tithe',
  'law:border_fortifications',
  'law:feudal_levy',
  'law:monastic_scriptoria',
  'perk:iron_fist',
] as const

/** Literal union of supported dynamic conditional resolver keys. */
export type ResolverKey = (typeof RESOLVER_KEYS)[number]

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
   * Relative lifetime in seconds of active time. On a catalog template it is converted to an
   * absolute `expiresAt` (application time plus this duration) when the effect is applied.
   */
  durationSeconds?: number
  /**
   * Optional strongly typed resolver key for dynamic conditional modifiers.
   * Evaluated dynamically against current GameState, never serialized as a function.
   */
  resolverKey?: ResolverKey
}

/** Typed rule flag raised by a law effect and read through `hasRule`. */
export type RuleFlag =
  | 'law:auditors_inquisition'
  | 'law:census_edict'
  | 'law:chancery_red_tape'
  | 'law:corvee_exemption_tax'
  | 'law:crown_monopolies'
  | 'law:exceptional_tithe'
  | 'law:general_cadastre'
  | 'law:guerrilla_border_watch'
  | 'law:marshals_carte_blanche'
  | 'law:mercenary_capitulation'
  | 'law:merit_pay'
  | 'law:officer_academies'
  | 'law:papal_concordat'
  | 'law:parish_relief_registers'
  | 'law:sanctioned_plunder'
  | 'law:sanctuary_rights'
  | 'law:scorched_earth'
  | 'law:single_window_bureaucracy'
  | 'law:standing_garrisons'
  | 'law:sumptuary_edicts'
  | 'law:tithe_commutation'
  | 'law:vanguard_drills'
  | 'law_effect:pardon_forfeited'

/**
 * Universal Effect Taxonomy:
 * Distinguishes continuous StatModifiers from instant resource transfers, unit grants, and global rule flags.
 */
export type Effect =
  | { type: 'stat_modifier'; modifier: Modifier }
  | {
      type: 'instant_resource'
      resource: 'ap' | 'population' | 'unrest' | 'provinces' | 'archive_points'
      amount: number
    }
  | { type: 'grant_units'; unitId: UnitId; count: number; external?: boolean }
  | { type: 'rule_flag'; flag: RuleFlag }

/**
 * Command Interface Taxonomy:
 * Single dispatchable command contracts for the engine state machine.
 */
export type Command =
  // Active governance commands
  | { type: 'BUY_UNIT'; unitId: UnitId; count: number }
  | { type: 'DISBAND_UNIT'; unitId: UnitId; count: number }
  | { type: 'SET_TAX_RATE'; rate: number }
  | { type: 'STAMP_DOCUMENT' }
  | { type: 'COLONISE_PROVINCE' }
  | { type: 'ENACT_EDICT'; edictId: 'forced_tithe' | 'church_seizure' | 'grand_festival' }
  | { type: 'UNLOCK_PATENT'; order: UnitOrder }
  | { type: 'TICK'; dt: number }
  | { type: 'SET_PAUSED'; paused: boolean }

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
  | { type: 'RESTART_RUN'; seed?: number }

/** Province Biome Identifiers. */
export type BiomeId = 'heartland' | 'farmlands' | 'trade_hub' | 'stronghold' | 'wilderness'

/** Expedition campaign reconnaissance target. */
export interface CampaignTarget {
  power: number
  uncertaintyMargin: number
  biome: BiomeId
  lootType: 'ap' | 'population' | 'soldiers' | 'mixed'
  isFalseLedger: boolean
  isAmbush: boolean
  revealedFalseLedger?: boolean
  revealedAmbush?: boolean
}

/** Crisis escalation stages governed by public unrest level. */
export type UnrestCrisisStage =
  | 'tranquility' // 0% - 49%: Normal governance
  | 'fiscal_boycott' // 50% - 74%: -20% Tax revenue
  | 'strife_desertion' // 75% - 89%: Pop growth frozen, desertions
  | 'urban_rebellion' // 90% - 99%: Admin AP output cut by 50%
  | 'total_revolution' // 100%: Realm collapse (Defeat)

/** Defeat mode classification. */
export type DefeatReason = 'quota_failure' | 'revolution' | 'bankruptcy' | 'conquest'

/** Bulk purchase multiplier modes. */
export type BulkBuyCount = 1 | 10 | 50 | 100

/**
 * Complete serializable Game State representation for The Grand Audit.
 */
export interface GameState {
  /** Unique run identifier. */
  runId: string
  /** PRNG seed for deterministic runs. */
  seed: number
  /** Independent deterministic PRNG stream states. */
  rngStreams: Record<RngStream, number>
  /** Current state machine phase. */
  phase: RunPhase
  /** Current deadline inspection index (1 to 10). */
  deadline: number
  /** Elapsed active seconds in the current deadline interval (0 to 100). */
  deadlineTimeSeconds: number
  /** Cumulative active seconds across the entire run. */
  totalElapsedSeconds: number
  /** Monotonic count of fixed simulation steps run. */
  tickIndex: number
  /**
   * Seconds passed to `tick` and not yet simulated, always in [0, FIXED_STEP_SECONDS). Carried to
   * the next `tick` call.
   */
  tickRemainderSeconds: number
  /** Whether the mid-deadline 50-second interim warning has been issued. */
  interimWarningShown: boolean
  /** Whether the interim warning was on track at 50s. */
  interimWarningOnTrack: boolean | null

  // Treasury & Resources
  /** Current spendable Administrative Power (AP). */
  ap: number
  /** Cumulative AP generated during the current deadline interval (used for quota). */
  cumulativeApThisDeadline: number
  /** Lifetime cumulative AP generated across all deadlines. */
  totalCumulativeAp: number

  // Demographics & Territory
  /** Total living population in the sovereign realm. */
  totalPopulation: number
  /** Free serfs available for recruitment and paying baseline poll tax. */
  freeSerfs: number
  /** Total provinces held by the sovereign. */
  provinces: number
  /** Biomes assigned to each controlled province in order of acquisition. */
  provinceBiomes: BiomeId[]
  /** Number of provinces colonised peacefully via executive decree. */
  colonisedProvincesCount: number
  /** Number of provinces taken by offensive conquest during this run. */
  capturedProvincesCount: number
  /** Peak historical population achieved during this run. */
  peakPopulation: number
  /** Cumulative citizens lost to starvation/overcrowding bleed. */
  starvationLosses: number

  // Fiscal & Discontent
  /** Promulgated active tax rate percentage [0, 60]. */
  taxRate: number
  /** Target tax rate pending the 8-second promulgation delay. */
  pendingTaxRate: number | null
  /** Seconds remaining until pending tax rate is legally promulgated. */
  taxPromulgationTimer: number
  /** Public discontent level [0, 100]. */
  unrest: number
  /** Elapsed timer tracking military desertion intervals during strife. */
  desertionTimer: number
  /** Remaining timer for demographic freeze after forced tithe edict. */
  forcedTitheFreezeTimer: number

  // Failsafes & Bankruptcy
  /** Seconds remaining on bankruptcy grace countdown before sovereign collapse. */
  bankruptcyGraceTimer: number
  /** Whether the emergency Lombard Bailout is still available (permitted once per run). */
  lombardBailoutAvailable: boolean
  /** Number of royal strikes received (1 strike = Royal Censure, 2 strikes = Execution). */
  strikes: number
  /** Outcome of the most recent deadline audit inspection. */
  lastAuditOutcome: AuditOutcome | null

  // Military, Threat & Expeditions
  /** Target threat power for the upcoming/current deadline. */
  currentThreatPower: number
  /** Tribute AP cost to appease current threat. */
  currentThreatTributeAp: number
  /** Currently scouted target province during expedition phase. */
  currentTarget: CampaignTarget | null
  /** Number of campaigns launched during the current deadline expedition. */
  campaignsLaunchedThisDeadline: number
  /** Timestamp of the last surprise border raid. */
  lastSurpriseRaidTime: number
  /** Whether a surprise raid already triggered during the current deadline. */
  surpriseRaidTriggeredThisDeadline: boolean
  /** History of disbanded military units for mutiny tracking. */
  disbandedMilitaryHistory: Array<{ timeSeconds: number; count: number }>
  /** Total military campaign/defensive clash victories won. */
  victoriesCount: number

  // Roster, Patents, Laws & Edicts
  /** Active unit head counts indexed by unit ID. */
  units: Record<UnitId, number>
  /** Royal charter patent unlock status per order. */
  unlockedPatents: Record<UnitOrder, boolean>
  /** Active laws enacted in the Royal Council (max 5, or 6 with archive perk). */
  activeLaws: string[]
  /** Rule flags raised by enacted law effects, without duplicates. */
  ruleFlags: RuleFlag[]
  /** Id of the threat being resolved, or null when none (not read yet). */
  currentThreatId: number | null
  /** Offered law IDs currently drafted in Council of Laws. */
  currentLawDraft: string[]
  /** Active dilemma ID presented in Council Dilemma. */
  currentDilemmaId: string | null
  /** Deadline during which an emergency edict was last enacted. */
  lastEdictDeadline: number
  /** Lifetime usage counters for each emergency edict. */
  edictUsageCounts: Record<'forced_tithe' | 'church_seizure' | 'grand_festival', number>
  /** Active temporary and permanent stat modifiers. */
  activeModifiers: Modifier[]

  // Clicker Ergonomics
  /** Available click decree tokens (max 12 tokens/sec, refilled via delta-time). */
  clickTokens: number

  // Meta & Persistence
  /** Total archive points accumulated for permanent Crown Charters. */
  archivePoints: number
  /** Total scouts sacrificed in reconnaissance patrols. */
  scoutsSacrificed: number
  /** Total military combat units recruited via BUY_UNIT during run. */
  militaryRecruitedCount: number
  /** Whether the tax rate ever exceeded 15% during simulation ticks. */
  taxRateViolated15: boolean
  /** Whether the Lombard Bailout was accepted during this run. */
  lombardBailoutAccepted: boolean

  // Run Lifecycle State
  /** Whether the game loop is manually paused by the lord. */
  isPaused: boolean
  /** Whether a deadline audit is pending immediate execution. */
  pendingDeadlineAudit: boolean
  /** Whether the run has concluded. */
  isGameOver: boolean
  /** Whether the sovereign achieved victory at Deadline 10. */
  isVictory: boolean
  /** Reason for royal downfall if defeated. */
  defeatReason: DefeatReason | null
}

/** Result returned by the command dispatcher API. */
export interface DispatchResult {
  /** Whether the command was successfully dispatched and processed. */
  success: boolean
  /** Error message if the command was rejected or invalid. */
  error?: string
  /** Informational gameplay events triggered by this command. */
  events?: string[]
}

/**
 * Result summary returned after every engine delta-time tick. `netApPerSecond` and
 * `paperworkFriction` come from the last step run, and are 0 when the call ran no step.
 */
export interface TickResult {
  /** Effective delta-time integrated in seconds. */
  dt: number
  /** Delta-time consumed by simulation before any pause/phase transition. */
  consumedDt?: number
  /** Gross AP generated during this tick. */
  grossApGenerated: number
  /** Net AP gained or lost this tick after upkeep and paperwork. */
  netApDelta: number
  /** Current net AP rate per second. */
  netApPerSecond: number
  /** Living population added or lost during this tick. */
  popGrowth: number
  /** Bureaucratic paperwork inertia drag percentage [0, 1]. */
  paperworkFriction: number
  /** Active crisis stage based on discontent. */
  crisisStage: UnrestCrisisStage
  /** Whether the 50-second interim warning fired on this tick. */
  interimWarningTriggered: boolean
  /** Whether the 100-second deadline concluded on this tick. */
  deadlineCompleted: boolean
  /** Whether the run terminated on this tick. */
  isGameOver: boolean
}

/** Outcome of a deadline audit inspection. */
export interface AuditOutcome {
  deadline: number
  apMet: boolean
  popMet: boolean
  militaryMet: boolean
  passedCount: number
  success: boolean
  royalPardonIssued: boolean
  isGameOver: boolean
  victory: boolean
  grossApRate: number
}
