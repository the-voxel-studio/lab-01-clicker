/**
 * State Factory & Serialization Utilities.
 * Pure TypeScript, immutable cloning, deterministic initialization.
 *
 * @module core/state
 */

import { BALANCE, type UnitId } from '@/data/balance'
import type { GameState } from './types'

/** All 24 canonical unit IDs for initial state allocation. */
const ALL_UNIT_IDS: readonly UnitId[] = [
  'peasant',
  'farmer',
  'artisan',
  'guild',
  'clergy',
  'prelate',
  'notable',
  'baron',
  'scribe',
  'clerk',
  'supervisor',
  'provincial_steward',
  'archivist',
  'audit_chamber',
  'collector',
  'farmer_general',
  'soldier',
  'man_at_arms',
  'sergeant',
  'captain',
  'quartermaster',
  'grand_marshal',
  'scout',
  'spymaster',
]

/**
 * Creates a zero-initialized unit head count record.
 *
 * @returns Record of all 24 units initialized to 0.
 */
export function createEmptyUnitRoster(): Record<UnitId, number> {
  const roster = {} as Record<UnitId, number>
  for (const id of ALL_UNIT_IDS) {
    roster[id] = 0
  }
  return roster
}

/**
 * Creates a pristine, fully initialized GameState for a new run.
 * Baseline values follow GAME_RULES §2.1 and BALANCE definitions.
 *
 * @param overrides - Optional property overrides for testing or seeded runs.
 * @returns Complete GameState ready for simulation.
 */
export function createInitialGameState(overrides: Partial<GameState> = {}): GameState {
  const baseState: GameState = {
    runId: overrides.runId ?? `run_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
    seed: overrides.seed ?? 1337,
    phase: 'ACTIVE_CYCLE',
    deadline: 1,
    deadlineTimeSeconds: 0,
    totalElapsedSeconds: 0,
    tickIndex: 0,
    interimWarningShown: false,

    // Treasury & Resources
    ap: BALANCE.STARTING_AP, // 50 AP
    cumulativeApThisDeadline: 0,
    totalCumulativeAp: 0,

    // Demographics & Territory
    totalPopulation: BALANCE.STARTING_POPULATION, // 100 Pop
    freeSerfs: BALANCE.STARTING_POPULATION, // 100 Free Serfs
    provinces: BALANCE.STARTING_PROVINCES, // 3 Provinces
    colonisedProvincesCount: 0,

    // Fiscal & Discontent
    taxRate: BALANCE.STARTING_TAX_RATE, // 25% Tax
    pendingTaxRate: null,
    taxPromulgationTimer: 0,
    unrest: BALANCE.STARTING_UNREST, // 10 Unrest

    // Failsafes & Crises
    bankruptcyGraceTimer: 30.0,
    lombardBailoutAvailable: true,
    strikes: 0,

    // Military & Threats
    currentThreatPower: 0,
    currentThreatTributeAp: 0,

    // Roster, Patents & Decrees
    units: createEmptyUnitRoster(),
    unlockedPatents: {
      people: false,
      admin: false,
      military: false,
    },
    activeLaws: [],
    activeModifiers: [],

    // Clicker Ergonomics
    clickTokens: BALANCE.CLICK_MAX_TOKENS_PER_SECOND, // 12 Tokens

    // Meta & Persistence
    archivePoints: 0,

    // Run Lifecycle
    isPaused: false,
    isGameOver: false,
    isVictory: false,
    defeatReason: null,
  }

  return {
    ...baseState,
    ...overrides,
    units: {
      ...baseState.units,
      ...overrides.units,
    },
    unlockedPatents: {
      ...baseState.unlockedPatents,
      ...overrides.unlockedPatents,
    },
    activeLaws: [...(overrides.activeLaws ?? baseState.activeLaws)],
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
    units: { ...state.units },
    unlockedPatents: { ...state.unlockedPatents },
    activeLaws: [...state.activeLaws],
    activeModifiers: state.activeModifiers.map((mod) => ({ ...mod })),
  }
}
