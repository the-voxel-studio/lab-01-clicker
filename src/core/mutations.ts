/**
 * Core State Mutations & Lifecycle Transitions.
 * Pure TypeScript, deterministic, enforces terminal invariant boundaries.
 *
 * @module core/mutations
 */

import type { GameState, DefeatReason, UnitId } from './types'
import { DEFAULT_ENGINE_CONFIG, type EngineConfig } from './config'

/**
 * Triggers a terminal game-over defeat for the active run.
 * Idempotent: has no effect if the run is already completed (isGameOver === true).
 *
 * @param state - Mutable game state to transition.
 * @param reason - Cause of run defeat.
 */
export function triggerDefeat(state: GameState, reason: DefeatReason): void {
  if (state.isGameOver) return
  state.isGameOver = true
  state.isVictory = false
  state.defeatReason = reason
  state.phase = 'RUN_DEFEAT'
}

/**
 * Adjusts public discontent (Unrest) by a signed delta and checks for immediate revolution.
 * Clamps unrest to [0, 100]. If unrest reaches 100, immediately triggers a 'revolution' defeat.
 *
 * @param state - Mutable game state.
 * @param delta - Signed unrest change to add.
 * @param config - Injected engine configuration.
 */
export function addUnrest(
  state: GameState,
  delta: number,
  config: EngineConfig = DEFAULT_ENGINE_CONFIG,
): void {
  void config // Reserved for potential config overrides
  state.unrest = Math.max(0, Math.min(100, state.unrest + delta))
  if (state.unrest >= 100) {
    triggerDefeat(state, 'revolution')
  }
}

/**
 * Removes units of one type and the matching population, keeping the §3.1 balance.
 *
 * @param state - Mutable game state.
 * @param unitId - Unit type that leaves.
 * @param count - Requested number of units, capped at the units held.
 * @returns The number of units actually removed.
 */
export function removeUnits(state: GameState, unitId: UnitId, count: number): number {
  const removed = Math.max(0, Math.min(count, state.units[unitId] ?? 0))
  state.units[unitId] = (state.units[unitId] ?? 0) - removed
  state.totalPopulation = Math.max(0, state.totalPopulation - removed)
  return removed
}

/**
 * Deterministic unit cascade order for demographic population losses.
 * Follows Tier I Civil -> Tier II Civil -> Tier I Military -> Tier II Military in declaration order.
 */
export const POPULATION_LOSS_CASCADE_ORDER: readonly UnitId[] = [
  // Tier I civilian / administrative
  'peasant',
  'artisan',
  'clergy',
  'notable',
  'scribe',
  'supervisor',
  'archivist',
  'collector',
  // Tier II civilian / administrative
  'farmer',
  'guild',
  'prelate',
  'baron',
  'clerk',
  'provincial_steward',
  'audit_chamber',
  'farmer_general',
  // Tier I military
  'soldier',
  'sergeant',
  'quartermaster',
  'scout',
  // Tier II military
  'man_at_arms',
  'captain',
  'grand_marshal',
  'spymaster',
]

/**
 * Deducts population from GameState while strictly preserving the Demographic Invariant:
 * TotalPopulation === FreeSerfs + sum(Units).
 *
 * Loss is deducted primarily from freeSerfs. Any excess cascades to active units
 * in deterministic order (Tier I civil -> Tier II civil -> Tier I military -> Tier II military).
 *
 * @param state - Mutable game state.
 * @param loss - Requested population loss (positive number).
 * @param isStarvation - When true, tracks actual losses in state.starvationLosses.
 * @returns The actual population lost.
 */
export function applyPopulationLoss(state: GameState, loss: number, isStarvation = false): number {
  if (loss <= 0 || state.totalPopulation <= 0) return 0

  const targetLoss = Math.min(loss, state.totalPopulation)
  let remainingLoss = targetLoss

  // Deduct from freeSerfs first
  const serfsLost = Math.min(remainingLoss, state.freeSerfs)
  state.freeSerfs -= serfsLost
  remainingLoss -= serfsLost

  // Cascade excess loss to units in deterministic hierarchy
  if (remainingLoss > 0) {
    for (const unitId of POPULATION_LOSS_CASCADE_ORDER) {
      if (remainingLoss <= 0) break
      const count = state.units[unitId] ?? 0
      if (count <= 0) continue

      const take = Math.min(count, Math.ceil(remainingLoss))
      state.units[unitId] = count - take
      remainingLoss -= take

      // If ceiling took more than fractional remaining loss, return the excess to freeSerfs
      if (remainingLoss < 0) {
        state.freeSerfs += -remainingLoss
        remainingLoss = 0
      }
    }
  }

  // Compute actual loss and reconcile totalPopulation
  let currentUnitsTotal = 0
  for (const count of Object.values(state.units)) {
    currentUnitsTotal += count ?? 0
  }
  const prevTotal = state.totalPopulation
  state.totalPopulation = state.freeSerfs + currentUnitsTotal
  const actualLoss = Math.max(0, prevTotal - state.totalPopulation)

  if (isStarvation && actualLoss > 0) {
    state.starvationLosses += actualLoss
  }

  return actualLoss
}
