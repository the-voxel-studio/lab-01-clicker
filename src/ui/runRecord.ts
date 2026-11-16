/**
 * Run records: one entry appended to the persisted history when a reign concludes, the source of
 * the cross run trophies (design section 6). The history is stored as a versioned JSON document and
 * read back tolerantly: anything missing, corrupt or malformed is dropped, never thrown.
 *
 * @module ui/runRecord
 */

import type { RunConclusion } from '@/core/archives'
import type { DefeatReason, GameState } from '@/core/types'
import { FEATS_DATA, type FeatId } from '@/data/feats'
import { isDifficultyLevel, type DifficultyLevel } from '@/data/levels'

/** How a reign ended: a victory, one of the four defeats, or laid down by the player. */
export type RunOutcome = 'victory' | DefeatReason | 'abandoned'

/** One concluded reign, as kept in the history. */
export interface RunRecord {
  runId: string
  seed: number
  endedAt: string
  outcome: RunOutcome
  deadlineReached: number
  elapsedSeconds: number
  totalCumulativeAp: number
  peakPopulation: number
  peakProvinces: number
  colonisedProvinces: number
  capturedProvinces: number
  battlesWon: number
  scoutsSacrificed: number
  militaryRecruited: number
  starvationLosses: number
  strikes: number
  lombardBailoutAccepted: boolean
  newFeats: FeatId[]
  /** Level the reign was played at. */
  level: DifficultyLevel
}

/**
 * Version of the stored history document. Version 1, from before the levels, reads with every
 * record at `ordinary`; any other version reads as an empty history.
 */
export const HISTORY_SCHEMA_VERSION = 2

const LEVELLESS_HISTORY_VERSION = 1

const OUTCOMES: readonly RunOutcome[] = [
  'victory',
  'abandoned',
  'quota_failure',
  'revolution',
  'bankruptcy',
  'conquest',
]

const NUMBER_FIELDS = [
  'seed',
  'deadlineReached',
  'elapsedSeconds',
  'totalCumulativeAp',
  'peakPopulation',
  'peakProvinces',
  'colonisedProvinces',
  'capturedProvinces',
  'battlesWon',
  'scoutsSacrificed',
  'militaryRecruited',
  'starvationLosses',
  'strikes',
] as const satisfies readonly (keyof RunRecord)[]

/**
 * Builds the history entry of a concluded reign.
 *
 * @param state - The final run state.
 * @param conclusion - What the archive banked (`concludeRun`).
 * @param endedAt - When the reign ended, stored as an ISO string.
 * @param abandoned - True when the player laid down the crown; wins over the engine outcome.
 * @param level - Level the reign was played at.
 */
export function createRunRecord(
  state: GameState,
  conclusion: RunConclusion,
  endedAt: Date,
  abandoned = false,
  level: DifficultyLevel = 'ordinary',
): RunRecord {
  return {
    runId: state.runId,
    seed: state.seed,
    endedAt: endedAt.toISOString(),
    outcome: outcomeOf(state, abandoned),
    deadlineReached: state.deadline,
    elapsedSeconds: state.playedSeconds,
    totalCumulativeAp: state.totalCumulativeAp,
    peakPopulation: state.peakPopulation,
    peakProvinces: state.peakProvinces,
    colonisedProvinces: state.colonisedProvincesCount,
    capturedProvinces: state.capturedProvincesCount,
    battlesWon: state.victoriesCount,
    scoutsSacrificed: state.scoutsSacrificed,
    militaryRecruited: state.militaryRecruitedCount,
    starvationLosses: state.starvationLosses,
    strikes: state.strikes,
    lombardBailoutAccepted: state.lombardBailoutAccepted,
    newFeats: [...conclusion.newFeats],
    level,
  }
}

/** A run concluded without a victory or a recorded defeat can only have been laid down. */
function outcomeOf(state: GameState, abandoned: boolean): RunOutcome {
  if (abandoned) return 'abandoned'
  if (state.isVictory) return 'victory'
  return state.defeatReason ?? 'abandoned'
}

/** Serializes the history as `{ "version": 2, "records": [...] }`. */
export function serializeHistory(records: readonly RunRecord[]): string {
  return JSON.stringify({ version: HISTORY_SCHEMA_VERSION, records })
}

/**
 * Reads a stored history. Returns `[]` for null, invalid JSON, another version or a non array, and
 * drops every record whose fields have the wrong type. Records of version 1 are read as `ordinary`.
 */
export function parseHistory(raw: string | null): RunRecord[] {
  if (raw === null) return []
  let document: unknown
  try {
    document = JSON.parse(raw)
  } catch {
    return []
  }
  if (!isObject(document)) return []
  const records = document.records
  if (!Array.isArray(records)) return []
  if (document.version === LEVELLESS_HISTORY_VERSION) {
    return records.filter(isObject).map(asOrdinary).filter(isRunRecord)
  }
  return document.version === HISTORY_SCHEMA_VERSION ? records.filter(isRunRecord) : []
}

/** A record kept before the levels: every reign then was ordinary. */
function asOrdinary(record: Record<string, unknown>): unknown {
  return { ...record, level: 'ordinary' }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isRunRecord(value: unknown): value is RunRecord {
  if (!isObject(value)) return false
  return (
    typeof value.runId === 'string' &&
    typeof value.endedAt === 'string' &&
    OUTCOMES.some((outcome) => outcome === value.outcome) &&
    NUMBER_FIELDS.every((field) => typeof value[field] === 'number') &&
    typeof value.lombardBailoutAccepted === 'boolean' &&
    Array.isArray(value.newFeats) &&
    value.newFeats.every((id) => typeof id === 'string' && Object.hasOwn(FEATS_DATA, id)) &&
    isDifficultyLevel(value.level)
  )
}
