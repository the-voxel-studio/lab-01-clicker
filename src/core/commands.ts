/**
 * Command Dispatcher API & Action Handlers.
 * Pure TypeScript, enforces phase permissions and strict domain invariants.
 *
 * @module core/commands
 */

import {
  BALANCE,
  UNITS_DATA,
  DEADLINE_QUOTAS,
  type UnitId,
  type UnitOrder,
} from '@/data/balance'
import { assertCommandAllowed, getNextInterDeadlinePhase } from './phases'
import {
  calculateUnitCost,
  calculateColonisationCost,
  calculateClickValue,
  calculateHousingCapacity,
  calculateOrderCaps,
  calculatePaperworkFriction,
} from './formulas'
import { PRNG } from './prng'
import { composeStat, extractRawEvaluationState } from './modifiers'
import { tick } from './engine'
import {
  resolveOffensiveCampaign,
  resolveDefensiveClash,
  performScoutReroll,
  resolveScheduledThreat,
} from './battle'
import type {
  Command,
  GameState,
  DispatchResult,
} from './types'

/**
 * Handles unit recruitment (BUY_UNIT).
 */
function handleBuyUnit(
  state: GameState,
  command: Extract<Command, { type: 'BUY_UNIT' }>
): DispatchResult {
  const { unitId, count } = command
  if (count <= 0) {
    return { success: false, error: 'Purchase count must be greater than 0.' }
  }

  const def = UNITS_DATA[unitId]
  if (!def) {
    return { success: false, error: `Unknown unit: ${unitId}` }
  }

  // 1. Check Tier II Royal Patent
  if (def.tier === 2 && !state.unlockedPatents[def.order]) {
    return {
      success: false,
      error: `Order '${def.order}' Tier II patent is locked. Reached Deadline 4, 12 Tier I units, and charter fee required.`,
    }
  }

  // 2. Check demographic availability (Free Serfs)
  if (state.freeSerfs < count) {
    return {
      success: false,
      error: `Not enough free serfs (requested: ${count}, available: ${state.freeSerfs}).`,
    }
  }

  // 3. Check Order Headroom
  const maxPop = calculateHousingCapacity(
    state.provinces,
    state.units.notable,
    state.units.baron
  )
  const orderCaps = calculateOrderCaps(maxPop)
  const currentOrderCount = Object.entries(state.units).reduce((sum, [id, qty]) => {
    return UNITS_DATA[id as UnitId]?.order === def.order ? sum + qty : sum
  }, 0)

  if (currentOrderCount + count > orderCaps[def.order]) {
    return {
      success: false,
      error: `Order cap exceeded for '${def.order}' (cap: ${orderCaps[def.order]}, current: ${currentOrderCount}, requested: ${count}).`,
    }
  }

  // 4. Check AP treasury
  const currentOwned = state.units[unitId] ?? 0
  const totalCost = calculateUnitCost(unitId, currentOwned, count)
  if (state.ap < totalCost) {
    return {
      success: false,
      error: `Insufficient AP treasury (required: ${totalCost} AP, available: ${Math.floor(state.ap)} AP).`,
    }
  }

  // Execute mutation
  state.ap -= totalCost
  state.freeSerfs -= count
  state.units[unitId] = currentOwned + count

  return {
    success: true,
    events: [`Recruited ${count}x ${unitId} for ${totalCost} AP.`],
  }
}

/**
 * Handles purchasing Royal Patents to unlock Tier II units (UNLOCK_PATENT).
 */
function handleUnlockPatent(
  state: GameState,
  command: Extract<Command, { type: 'UNLOCK_PATENT' }>
): DispatchResult {
  const { order } = command
  if (state.unlockedPatents[order]) {
    return { success: false, error: `Patent for order '${order}' is already unlocked.` }
  }

  // 1. Reached at least Deadline 4
  if (state.deadline < BALANCE.PATENT_MIN_DEADLINE) {
    return {
      success: false,
      error: `Institutional Maturity prerequisite not met: Must reach Deadline ${BALANCE.PATENT_MIN_DEADLINE} (currently: ${state.deadline}).`,
    }
  }

  // 2. Maintaining at least 12 active Tier I units in that order
  const tierICount = Object.entries(state.units).reduce((sum, [id, qty]) => {
    const def = UNITS_DATA[id as UnitId]
    return def && def.order === order && def.tier === 1 ? sum + qty : sum
  }, 0)

  if (tierICount < BALANCE.PATENT_MIN_TIER_I_UNITS) {
    return {
      success: false,
      error: `Order Mastery prerequisite not met: Must maintain at least ${BALANCE.PATENT_MIN_TIER_I_UNITS} Tier I units in '${order}' (currently: ${tierICount}).`,
    }
  }

  // 3. Purchasing the royal charter fee
  const fee = BALANCE.PATENT_COSTS[order]
  if (state.ap < fee) {
    return {
      success: false,
      error: `Insufficient AP treasury to purchase royal patent (required: ${fee} AP, available: ${Math.floor(state.ap)} AP).`,
    }
  }

  state.ap -= fee
  state.unlockedPatents[order] = true

  return {
    success: true,
    events: [`Purchased Royal Patent for '${order}' for ${fee} AP. Tier II units unlocked.`],
  }
}

/**
 * Handles tax rate adjustments with 8s promulgation delay and shock penalty (SET_TAX_RATE).
 */
function handleSetTaxRate(
  state: GameState,
  command: Extract<Command, { type: 'SET_TAX_RATE' }>
): DispatchResult {
  const targetRate = Math.max(0, Math.min(60, Math.round(command.rate)))
  const currentRate = state.taxRate

  const events: string[] = []

  // Check for Tax Shock penalty (> 15 percentage points in single adjustment)
  if (targetRate - currentRate > BALANCE.TAX_SHOCK_THRESHOLD) {
    state.unrest = Math.min(100, state.unrest + BALANCE.TAX_SHOCK_UNREST_SPIKE)
    events.push(
      `Tax Shock! Raising taxes by ${targetRate - currentRate}% triggered +${BALANCE.TAX_SHOCK_UNREST_SPIKE} Unrest.`
    )
  }

  state.pendingTaxRate = targetRate
  state.taxPromulgationTimer = BALANCE.TAX_PROMULGATION_DELAY_SECONDS
  events.push(`Tax rate adjustment to ${targetRate}% initiated (promulgation delay: 8s).`)

  return { success: true, events }
}

/**
 * Handles executive seal stamp click decrees (STAMP_DOCUMENT).
 */
function handleStampDocument(
  state: GameState,
  command: Extract<Command, { type: 'STAMP_DOCUMENT' }>
): DispatchResult {
  if (state.clickTokens < 1) {
    return {
      success: false,
      error: 'The ink on your previous decree has not yet dried... (click ceiling: 12/s).',
    }
  }

  state.clickTokens -= 1

  // Compute gross AP rate for scaling
  let grossApRate = 0
  for (const [id, count] of Object.entries(state.units) as [UnitId, number][]) {
    if (count <= 0) continue
    const def = UNITS_DATA[id]
    if (def?.role === 'producer' && def.order === 'admin') {
      grossApRate += count * def.baseValue
    }
  }
  grossApRate += state.freeSerfs * BALANCE.TAX_POLL_RATE * (state.taxRate / 25)

  const rawState = extractRawEvaluationState(state)
  const sealMultiplier = composeStat('click_power', 1.0, state.activeModifiers, rawState)

  const isCritical =
    command.isCritical !== undefined
      ? command.isCritical
      : new PRNG(state.seed + state.tickIndex * 17 + Math.floor(state.clickTokens * 3)).next() <
        BALANCE.CLICK_CRITICAL_CHANCE

  const rawClickValue = calculateClickValue(grossApRate, sealMultiplier, isCritical)

  // The Lord's Privilege: Decrees bypass 50% of bureaucratic paperwork
  const archivistReduction =
    (state.units.archivist ?? 0) * 0.015 + (state.units.audit_chamber ?? 0) * 0.065
  const basePaperwork = calculatePaperworkFriction(
    state.units,
    state.provinces,
    archivistReduction
  )
  const netPaperwork = Math.min(
    0.99,
    Math.max(
      0,
      composeStat('paperwork_friction', basePaperwork, state.activeModifiers, rawState)
    )
  )
  const effectivePaperwork = netPaperwork * BALANCE.CLICK_PAPERWORK_MITIGATION
  const clickValue = Math.round(rawClickValue * (1.0 - effectivePaperwork) * 100) / 100

  state.ap += clickValue
  state.cumulativeApThisDeadline += clickValue
  state.totalCumulativeAp += clickValue

  return {
    success: true,
    events: [
      isCritical
        ? `CRITICAL STAMP! Affixed Imperial Wax Seal for +${clickValue.toFixed(1)} AP.`
        : `Affixed Royal Decree for +${clickValue.toFixed(1)} AP.`,
    ],
  }
}

/**
 * Handles civil province colonisation (COLONISE_PROVINCE).
 */
function handleColoniseProvince(state: GameState): DispatchResult {
  const cost = calculateColonisationCost(state.colonisedProvincesCount)
  if (state.ap < cost) {
    return {
      success: false,
      error: `Insufficient AP to colonise province (required: ${cost} AP, available: ${Math.floor(state.ap)} AP).`,
    }
  }

  state.ap -= cost
  state.provinces += 1
  state.colonisedProvincesCount += 1

  return {
    success: true,
    events: [
      `Colonised province #${state.provinces} for ${cost} AP. Housing capacity expanded by +250.`,
    ],
  }
}

/**
 * Handles emergency executive edicts (ENACT_EDICT).
 */
function handleEnactEdict(
  state: GameState,
  command: Extract<Command, { type: 'ENACT_EDICT' }>
): DispatchResult {
  switch (command.edictId) {
    case 'forced_tithe': {
      // 30 seconds of poll tax income + 35 Unrest
      const taxRateFactor = state.taxRate / 25
      const instantTax = state.freeSerfs * BALANCE.TAX_POLL_RATE * taxRateFactor * 30
      state.ap += instantTax
      state.cumulativeApThisDeadline += instantTax
      state.totalCumulativeAp += instantTax
      state.unrest = Math.min(100, state.unrest + 35)
      return {
        success: true,
        events: [`Forced Tithe enacted: +${Math.round(instantTax)} AP seized, +35 Unrest stirred.`],
      }
    }

    case 'church_seizure': {
      // +500 AP instantly, cuts clergy/prelate pacification by 50% for 60s
      state.ap += 500
      state.cumulativeApThisDeadline += 500
      state.totalCumulativeAp += 500
      state.activeModifiers.push({
        source: 'edict:church_seizure',
        stat: 'unrest_growth',
        op: 'add',
        value: 0.05,
        appliedAt: state.totalElapsedSeconds,
        expiresAt: state.totalElapsedSeconds + 60,
      })
      return {
        success: true,
        events: ['Church Seizure enacted: +500 AP confiscated, Church pacification halved for 60s.'],
      }
    }

    case 'grand_festival': {
      // -20 Unrest for 20% of current AP treasury
      const cost = state.ap * 0.2
      state.ap -= cost
      state.unrest = Math.max(0, state.unrest - 20)
      return {
        success: true,
        events: [`Grand Festival celebrated: -20 Unrest pacified for ${Math.round(cost)} AP.`],
      }
    }
  }
}

/**
 * Handles the Lombard Bailout acceptance (ACCEPT_LOMBARD_LOAN).
 */
function handleAcceptLombardLoan(state: GameState): DispatchResult {
  if (state.phase !== 'LOMBARD_OFFER') {
    return { success: false, error: "Lombard offer is only valid during 'LOMBARD_OFFER' phase." }
  }
  if (!state.lombardBailoutAvailable) {
    return { success: false, error: 'Lombard Bailout has already been claimed this run.' }
  }
  if (state.provinces <= BALANCE.PROVINCE_MIN_FLOOR_FOR_FINES) {
    return { success: false, error: 'Cannot cede your final sovereign seat (Province Floor = 1).' }
  }

  state.provinces -= 1
  state.ap += 2000
  state.lombardBailoutAvailable = false
  state.bankruptcyGraceTimer = 30.0
  state.phase = 'ACTIVE_CYCLE'

  return {
    success: true,
    events: ['Lombard Bailout accepted: Ceded 1 Province for +2,000 AP. Bankruptcy averted.'],
  }
}

/**
 * Handles the Lombard Bailout refusal (REFUSE_LOMBARD_LOAN).
 */
function handleRefuseLombardLoan(state: GameState): DispatchResult {
  if (state.phase !== 'LOMBARD_OFFER') {
    return { success: false, error: "Lombard offer is only valid during 'LOMBARD_OFFER' phase." }
  }

  state.lombardBailoutAvailable = false
  state.phase = 'ACTIVE_CYCLE'

  return {
    success: true,
    events: ['Lombard Bailout refused. Bankruptcy countdown resumes from 20 seconds.'],
  }
}

/**
 * Handles moving to the next inter-deadline phase or advancing governance (RESUME_GOVERNANCE).
 */
function handleResumeGovernance(state: GameState): DispatchResult {
  if (state.phase !== 'AWAIT_RESUME') {
    return { success: false, error: "Cannot resume governance outside of 'AWAIT_RESUME' phase." }
  }

  state.deadline += 1
  state.deadlineTimeSeconds = 0
  state.cumulativeApThisDeadline = 0
  state.interimWarningShown = false
  state.phase = 'ACTIVE_CYCLE'

  return {
    success: true,
    events: [`Governance resumed. Entering Deadline ${state.deadline}.`],
  }
}

/**
 * Handles restarting a run (RESTART_RUN).
 */
function handleRestartRun(
  state: GameState,
  command: Extract<Command, { type: 'RESTART_RUN' }>
): DispatchResult {
  const seed = command.seed ?? 1337
  state.seed = seed
  state.phase = 'ACTIVE_CYCLE'
  state.deadline = 1
  state.deadlineTimeSeconds = 0
  state.totalElapsedSeconds = 0
  state.tickIndex = 0
  state.interimWarningShown = false
  state.ap = BALANCE.STARTING_AP
  state.cumulativeApThisDeadline = 0
  state.totalCumulativeAp = 0
  state.totalPopulation = BALANCE.STARTING_POPULATION
  state.freeSerfs = BALANCE.STARTING_POPULATION
  state.provinces = BALANCE.STARTING_PROVINCES
  state.colonisedProvincesCount = 0
  state.taxRate = BALANCE.STARTING_TAX_RATE
  state.pendingTaxRate = null
  state.taxPromulgationTimer = 0
  state.unrest = BALANCE.STARTING_UNREST
  state.bankruptcyGraceTimer = 30.0
  state.lombardBailoutAvailable = true
  state.strikes = 0
  state.isPaused = false
  state.isGameOver = false
  state.isVictory = false
  state.defeatReason = null

  for (const key of Object.keys(state.units) as UnitId[]) {
    state.units[key] = 0
  }
  for (const order of ['people', 'admin', 'military'] as UnitOrder[]) {
    state.unlockedPatents[order] = false
  }
  state.activeLaws = []
  state.activeModifiers = []

  return { success: true, events: [`Run restarted with seed ${seed}.`] }
}

/**
 * Dispatches and evaluates a Command against the active GameState.
 * Validates phase legality before mutating domain state.
 *
 * @param state - The active mutable GameState.
 * @param command - The command to process.
 * @returns DispatchResult indicating success or failure.
 */
export function dispatch(state: GameState, command: Command): DispatchResult {
  // 1. Enforce RunPhase command permissions
  try {
    assertCommandAllowed(state.phase, command)
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    }
  }

  // 2. Dispatch to specific handler
  switch (command.type) {
    case 'BUY_UNIT':
      return handleBuyUnit(state, command)

    case 'TICK':
      tick(state, command.dt)
      return { success: true }

    case 'UNLOCK_PATENT':
      return handleUnlockPatent(state, command)

    case 'SET_TAX_RATE':
      return handleSetTaxRate(state, command)

    case 'STAMP_DOCUMENT':
      return handleStampDocument(state, command)

    case 'COLONISE_PROVINCE':
      return handleColoniseProvince(state)

    case 'ENACT_EDICT':
      return handleEnactEdict(state, command)

    case 'ACCEPT_LOMBARD_LOAN':
      return handleAcceptLombardLoan(state)

    case 'REFUSE_LOMBARD_LOAN':
      return handleRefuseLombardLoan(state)

    case 'RESUME_GOVERNANCE':
      return handleResumeGovernance(state)

    case 'SUBMIT_AUDIT': {
      state.phase = getNextInterDeadlinePhase(state.phase, state.deadline)
      return { success: true }
    }

    case 'RESOLVE_DILEMMA': {
      state.phase = getNextInterDeadlinePhase(state.phase, state.deadline)
      return { success: true }
    }

    case 'ENACT_LAW': {
      if (state.activeLaws.length < 5) {
        state.activeLaws.push(command.lawId)
      }
      state.phase = getNextInterDeadlinePhase(state.phase, state.deadline)
      return { success: true }
    }

    case 'REJECT_LAWS': {
      state.archivePoints += 1
      state.phase = getNextInterDeadlinePhase(state.phase, state.deadline)
      return { success: true, events: ['Laws rejected. Gained +1 Archive Point.'] }
    }

    case 'SELECT_THREAT_RESPONSE': {
      const quota = DEADLINE_QUOTAS.find((q) => q.deadline === state.deadline) ?? DEADLINE_QUOTAS[0]!
      const threatPower = state.currentThreatPower || Math.round(quota.military * 0.8)
      const tributeAp = state.currentThreatTributeAp || Math.round(quota.ap * 0.2)
      const res = resolveScheduledThreat(state, command.response, threatPower, tributeAp)
      state.phase = getNextInterDeadlinePhase(state.phase, state.deadline)
      return { success: res.success, events: [res.message] }
    }

    case 'LAUNCH_ATTACK': {
      const playerPower = (state.units.soldier ?? 0) * 1.0 + (state.units.man_at_arms ?? 0) * 7.0
      const enemyPower = Math.max(15, state.deadline * 20)
      const result = resolveOffensiveCampaign(state, playerPower, enemyPower)
      state.phase = getNextInterDeadlinePhase(state.phase, state.deadline)
      return {
        success: true,
        events: [`Campaign executed: ${result.outcome} (ratio: ${result.clashRatio.toFixed(2)}).`],
      }
    }

    case 'RECON_PATROL': {
      const success = performScoutReroll(state)
      if (!success) {
        return { success: false, error: 'No active scouts available for recon patrol.' }
      }
      return { success: true, events: ['Recon patrol dispatched. 1 Scout died in action.'] }
    }

    case 'SKIP_EXPEDITION': {
      state.phase = getNextInterDeadlinePhase(state.phase, state.deadline)
      return { success: true }
    }

    case 'RESOLVE_RAID_DEFENSE': {
      const playerPower = (state.units.soldier ?? 0) * 1.0 + (state.units.man_at_arms ?? 0) * 7.0
      const raidPower = Math.max(20, state.deadline * 15)
      const res = resolveDefensiveClash(state, playerPower, raidPower)
      state.phase = 'ACTIVE_CYCLE'
      return { success: res.success, events: res.events }
    }

    case 'RESTART_RUN':
      return handleRestartRun(state, command)

    default:
      return { success: true }
  }
}
