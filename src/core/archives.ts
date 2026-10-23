/**
 * National Archives meta progression (GAME_RULES §15, §19): persistent points, invested perks and
 * unlocked feats that outlive a run.
 *
 * @module core/archives
 */

import { ARCHIVES_DATA, applyArchivePerks, isArchivePerkId } from '@/data/archives'
import type { ArchivePerkId } from '@/data/archives'
import { FEATS_DATA, evaluateFeats } from '@/data/feats'
import type { FeatId } from '@/data/feats'
import { createInitialGameState } from './state'
import type { DispatchResult, GameState } from './types'

/** Persistent meta progression shared by every run. */
export interface ArchiveData {
  /** Archive points available to invest; feats add 0.5, so it is not always an integer. */
  points: number
  /** Perks currently invested, without duplicates. */
  investedPerks: ArchivePerkId[]
  /** Feats unlocked by any past run, without duplicates. */
  unlockedFeats: FeatId[]
}

/** Result of `concludeRun`. */
export interface RunConclusion {
  /** Feats unlocked for the first time by the concluded run. */
  newFeats: FeatId[]
  /** Points added to the archive: the run points plus each new feat's reward. */
  pointsEarned: number
}

/**
 * Creates an empty archive: no points, no perk, no feat.
 *
 * @returns A fresh ArchiveData.
 */
export function createArchiveData(): ArchiveData {
  return { points: 0, investedPerks: [], unlockedFeats: [] }
}

/**
 * Invests archive points into a perk.
 * Fails without mutation on an unknown perk, an already invested perk, or too few points.
 *
 * @param archive - Archive to mutate.
 * @param perkId - Perk to buy.
 * @returns DispatchResult describing the outcome.
 */
export function investPerk(archive: ArchiveData, perkId: string): DispatchResult {
  if (!isArchivePerkId(perkId)) {
    return { success: false, error: `Unknown archive perk ${perkId}.` }
  }
  if (archive.investedPerks.includes(perkId)) {
    return { success: false, error: `Archive perk ${perkId} is already invested.` }
  }
  const perk = ARCHIVES_DATA[perkId]
  if (archive.points < perk.cost) {
    return {
      success: false,
      error: `Not enough archive points for ${perk.name} (required: ${perk.cost}, available: ${archive.points}).`,
    }
  }
  archive.points -= perk.cost
  archive.investedPerks.push(perkId)
  return { success: true, events: [`Invested ${perk.cost} archive points in ${perk.name}.`] }
}

/**
 * Refunds every invested perk's cost and clears the invested perks.
 *
 * @param archive - Archive to mutate.
 */
export function resetPerks(archive: ArchiveData): void {
  for (const perkId of archive.investedPerks) {
    archive.points += ARCHIVES_DATA[perkId].cost
  }
  archive.investedPerks = []
}

/**
 * Creates the initial state of a new run with the archive's invested perks applied.
 * This is the only place perk effects reach a run; `RESTART_RUN` starts a bare run.
 *
 * @param archive - Archive whose invested perks apply.
 * @param seed - Run seed.
 * @returns The new run state, with `archivePoints` at 0.
 */
export function startRun(archive: ArchiveData, seed: number): GameState {
  const state = createInitialGameState({ seed })
  applyArchivePerks(state, archive.investedPerks)
  return state
}

/**
 * Awards a run to the archive: its run points (negative when the run spent more than it earned)
 * plus 0.5 per feat unlocked for the first time, with the archive total clamped at 0. Records the
 * new feats once and marks the run as concluded; concluding the same run again awards nothing.
 *
 * @param archive - Archive to mutate.
 * @param state - Run to conclude; its `archiveConcluded` flag is set.
 * @returns The new feats and the signed points the run brought, before the clamp.
 */
export function concludeRun(archive: ArchiveData, state: GameState): RunConclusion {
  if (state.archiveConcluded) {
    return { newFeats: [], pointsEarned: 0 }
  }
  const newFeats = evaluateFeats(state).filter((id) => !archive.unlockedFeats.includes(id))
  let pointsEarned = state.archivePoints
  for (const id of newFeats) {
    pointsEarned += FEATS_DATA[id].rewardArchivePoints
  }
  archive.points = Math.max(0, archive.points + pointsEarned)
  archive.unlockedFeats.push(...newFeats)
  state.archiveConcluded = true
  return { newFeats, pointsEarned }
}
