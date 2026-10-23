/**
 * Immutable State Factory & Snapshot Cloner.
 * Provides pristine baseline GameState instantiation and deep copying.
 * Completely deterministic; zero Math.random() or Date.now() in production runtime.
 *
 * @module core/state
 */

import { BALANCE, type UnitId } from '@/data/balance'
import type { GameState } from './types'
import { deriveStreamSeed } from './prng'

/**
 * Creates an empty unit count record initialized to 0 for all 24 canonical units.
 */
export function createEmptyUnitRoster(): Record<UnitId, number> {
  return {
    peasant: 0,
    farmer: 0,
    artisan: 0,
    guild: 0,
    clergy: 0,
    prelate: 0,
    notable: 0,
    baron: 0,
    scribe: 0,
    clerk: 0,
    supervisor: 0,
    provincial_steward: 0,
    archivist: 0,
    audit_chamber: 0,
    collector: 0,
    farmer_general: 0,
    soldier: 0,
    man_at_arms: 0,
    sergeant: 0,
    captain: 0,
    quartermaster: 0,
    grand_marshal: 0,
    scout: 0,
    spymaster: 0,
  }
}

/**
 * Creates a pristine, fully initialized GameState for a new run.
 * Baseline values follow GAME_RULES §2.1 and BALANCE definitions.
 *
 * @param overrides - Optional property overrides for testing or seeded runs.
 * @returns Complete GameState ready for simulation.
 */
export function createInitialGameState(overrides: Partial<GameState> = {}): GameState {
  const seed = overrides.seed ?? 1337
  const baseState: GameState = {
    runId: overrides.runId ?? `run_${seed}`,
    seed,
    rngStreams: {
      click: deriveStreamSeed(seed, 'click'),
      combat: deriveStreamSeed(seed, 'combat'),
      events: deriveStreamSeed(seed, 'events'),
      council: deriveStreamSeed(seed, 'council'),
    },
    phase: 'ACTIVE_CYCLE',
    deadline: 1,
    deadlineTimeSeconds: 0,
    totalElapsedSeconds: 0,
    tickIndex: 0,
    tickRemainderSeconds: 0,
    interimWarningShown: false,
    interimWarningOnTrack: null,

    // Treasury & Resources
    ap: BALANCE.STARTING_AP, // 50 AP
    cumulativeApThisDeadline: 0,
    totalCumulativeAp: 0,

    // Demographics & Territory
    totalPopulation: BALANCE.STARTING_POPULATION, // 100 Pop
    freeSerfs: BALANCE.STARTING_POPULATION, // 100 Free Serfs
    provinces: BALANCE.STARTING_PROVINCES, // 3 Provinces
    provinceBiomes: ['heartland', 'heartland', 'heartland'],
    colonisedProvincesCount: 0,
    peakPopulation: BALANCE.STARTING_POPULATION,
    starvationLosses: 0,

    // Fiscal & Discontent
    taxRate: BALANCE.STARTING_TAX_RATE, // 25% Tax
    pendingTaxRate: null,
    taxPromulgationTimer: 0,
    unrest: BALANCE.STARTING_UNREST, // 10 Unrest
    desertionTimer: 0,
    forcedTitheFreezeTimer: 0,

    // Failsafes & Crises
    bankruptcyGraceTimer: 30.0,
    lombardBailoutAvailable: true,
    strikes: 0,
    lastAuditOutcome: null,

    // Military & Threats
    currentThreatPower: 0,
    currentThreatTributeAp: 0,
    currentTarget: null,
    campaignsLaunchedThisDeadline: 0,
    lastSurpriseRaidTime: -60,
    surpriseRaidTriggeredThisDeadline: false,
    disbandedMilitaryHistory: [],
    victoriesCount: 0,
    capturedProvincesCount: 0,

    // Roster, Patents & Decrees
    units: createEmptyUnitRoster(),
    unlockedPatents: {
      people: false,
      admin: false,
      military: false,
    },
    activeLaws: [],
    currentLawDraft: [],
    currentDilemmaId: null,
    lastEdictDeadline: 0,
    edictUsageCounts: {
      forced_tithe: 0,
      church_seizure: 0,
      grand_festival: 0,
    },
    activeModifiers: [],

    // Clicker Ergonomics
    clickTokens: BALANCE.CLICK_MAX_TOKENS_PER_SECOND, // 12 Tokens

    // Meta & Persistence
    archivePoints: 0,
    scoutsSacrificed: 0,
    militaryRecruitedCount: 0,
    taxRateViolated15: false,
    lombardBailoutAccepted: false,

    // Run Lifecycle
    isPaused: false,
    pendingDeadlineAudit: false,
    isGameOver: false,
    isVictory: false,
    defeatReason: null,
  }

  return {
    ...baseState,
    ...overrides,
    rngStreams: {
      ...baseState.rngStreams,
      ...overrides.rngStreams,
    },
    provinceBiomes: [...(overrides.provinceBiomes ?? baseState.provinceBiomes)],
    units: {
      ...baseState.units,
      ...overrides.units,
    },
    unlockedPatents: {
      ...baseState.unlockedPatents,
      ...overrides.unlockedPatents,
    },
    activeLaws: [...(overrides.activeLaws ?? baseState.activeLaws)],
    currentLawDraft: [...(overrides.currentLawDraft ?? baseState.currentLawDraft)],
    currentTarget:
      overrides.currentTarget !== undefined
        ? overrides.currentTarget
          ? { ...overrides.currentTarget }
          : null
        : baseState.currentTarget,
    disbandedMilitaryHistory: [
      ...(overrides.disbandedMilitaryHistory ?? baseState.disbandedMilitaryHistory),
    ],
    edictUsageCounts: {
      ...baseState.edictUsageCounts,
      ...overrides.edictUsageCounts,
    },
    activeModifiers: [...(overrides.activeModifiers ?? baseState.activeModifiers)],
  }
}

/**
 * Creates a deep copy of a GameState instance.
 *
 * @param state - The source state.
 * @returns Fully detached, identical clone.
 */
export function cloneGameState(state: GameState): GameState {
  return {
    ...state,
    rngStreams: { ...state.rngStreams },
    provinceBiomes: [...state.provinceBiomes],
    units: { ...state.units },
    unlockedPatents: { ...state.unlockedPatents },
    activeLaws: [...state.activeLaws],
    currentLawDraft: [...state.currentLawDraft],
    currentTarget: state.currentTarget ? { ...state.currentTarget } : null,
    disbandedMilitaryHistory: state.disbandedMilitaryHistory.map((entry) => ({ ...entry })),
    edictUsageCounts: { ...state.edictUsageCounts },
    activeModifiers: state.activeModifiers.map((mod) => ({ ...mod })),
  }
}
