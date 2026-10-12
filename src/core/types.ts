/**
 * Core Domain Types, State Interfaces, and Command Contracts.
 * Completely decoupled from Vue reactivity and DOM APIs.
 *
 * @module core/types
 */

import type {
  UnitId,
  UnitOrder,
  UnitRole,
  UnitTier,
  StatKey,
  ModifierOp,
  ResolverKey,
  Modifier,
  Effect,
  Command,
  RunPhase,
  DeadlineQuota,
  BiomeId,
} from '@/data/balance'

export type {
  UnitId,
  UnitOrder,
  UnitRole,
  UnitTier,
  StatKey,
  ModifierOp,
  ResolverKey,
  Modifier,
  Effect,
  Command,
  RunPhase,
  DeadlineQuota,
  BiomeId,
}

/** Crisis escalation stages governed by public unrest level. */
export type UnrestCrisisStage =
  | 'tranquility'        // 0% - 49%: Normal governance
  | 'fiscal_boycott'     // 50% - 74%: -20% Tax revenue
  | 'strife_desertion'   // 75% - 89%: Pop growth frozen, desertions
  | 'urban_rebellion'    // 90% - 99%: Admin AP output cut by 50%
  | 'total_revolution'   // 100%: Realm collapse (Defeat)

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
  /** Current state machine phase. */
  phase: RunPhase
  /** Current deadline inspection index (1 to 10). */
  deadline: number
  /** Elapsed active seconds in the current deadline interval (0 to 100). */
  deadlineTimeSeconds: number
  /** Cumulative active seconds across the entire run. */
  totalElapsedSeconds: number
  /** Monotonic simulation tick counter. */
  tickIndex: number
  /** Whether the mid-deadline 50-second interim warning has been issued. */
  interimWarningShown: boolean

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
  /** Number of provinces colonised peacefully via executive decree. */
  colonisedProvincesCount: number

  // Fiscal & Discontent
  /** Promulgated active tax rate percentage [0, 60]. */
  taxRate: number
  /** Target tax rate pending the 8-second promulgation delay. */
  pendingTaxRate: number | null
  /** Seconds remaining until pending tax rate is legally promulgated. */
  taxPromulgationTimer: number
  /** Public discontent level [0, 100]. */
  unrest: number

  // Failsafes & Bankruptcy
  /** Seconds remaining on bankruptcy grace countdown before sovereign collapse. */
  bankruptcyGraceTimer: number
  /** Whether the emergency Lombard Bailout is still available (permitted once per run). */
  lombardBailoutAvailable: boolean
  /** Number of royal strikes received (1 strike = Royal Censure, 2 strikes = Execution). */
  strikes: number

  // Military & Threat
  /** Target threat power for the upcoming/current deadline. */
  currentThreatPower: number
  /** Tribute AP cost to appease current threat. */
  currentThreatTributeAp: number

  // Roster, Patents & Decrees
  /** Active unit head counts indexed by unit ID. */
  units: Record<UnitId, number>
  /** Royal charter patent unlock status per order. */
  unlockedPatents: Record<UnitOrder, boolean>
  /** Active laws enacted in the Royal Council (max 5, or 6 with archive perk). */
  activeLaws: string[]
  /** Active temporary and permanent stat modifiers. */
  activeModifiers: Modifier[]

  // Clicker Ergonomics
  /** Available click decree tokens (max 12 tokens/sec, refilled via delta-time). */
  clickTokens: number

  // Meta & Persistence
  /** Total archive points accumulated for permanent Crown Charters. */
  archivePoints: number

  // Run Lifecycle State
  /** Whether the game loop is manually paused by the lord. */
  isPaused: boolean
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

/** Result summary returned after every engine delta-time tick. */
export interface TickResult {
  /** Effective delta-time integrated in seconds. */
  dt: number
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
}
