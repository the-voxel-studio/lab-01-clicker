/**
 * Command Dispatcher API & Action Handlers.
 * Pure TypeScript, enforces phase permissions and strict domain invariants.
 *
 * @module core/commands
 */

import { UNITS_DATA, type UnitId, getThreatPower, getThreatTributeAp } from '@/data/balance'
import { assertCommandAllowed, getNextInterDeadlinePhase } from './phases'
import {
  calculateUnitCost,
  calculateColonisationCost,
  calculateClickValue,
  calculateOrderCaps,
  getMaxBulkSize,
} from './formulas'
import { withStatePrng } from './prng'
import { composeStat, extractRawEvaluationState, canAffordEffects, applyEffect } from './modifiers'
import { LAWS_DATA } from '@/data/laws'
import { DILEMMAS_DATA } from '@/data/dilemmas'
import {
  tick,
  calculateGrossApRate,
  calculateMaxPopulation,
  calculateNetPaperwork,
  calculateMilitaryPower,
} from './engine'
import { createInitialGameState } from './state'
import { DEFAULT_ENGINE_CONFIG, type EngineConfig } from './config'
import { addUnrest } from './mutations'
import { addProvince, removeLastProvince } from './provinces'
import {
  resolveOffensiveCampaign,
  resolveDefensiveClash,
  performScoutReroll,
  resolveScheduledThreat,
  generateCampaignTarget,
} from './battle'
import type { Command, GameState, DispatchResult } from './types'
import type { DilemmaDef } from '@/data/dilemmas'

/**
 * Handles unit recruitment (BUY_UNIT).
 */
function handleBuyUnit(
  state: GameState,
  command: Extract<Command, { type: 'BUY_UNIT' }>,
  config: EngineConfig = DEFAULT_ENGINE_CONFIG,
): DispatchResult {
  const { unitId, count } = command
  if (!Number.isInteger(count) || count <= 0) {
    return { success: false, error: 'Purchase count must be a positive integer.' }
  }

  const def = UNITS_DATA[unitId]
  if (!def) {
    return { success: false, error: `Unknown unit: ${unitId}` }
  }

  // Check Bulk Purchase Ceiling (GAME_RULES.md §5.1 & Arbitrage 1.0 §8)
  const maxBulk = getMaxBulkSize(state.deadline, state.totalPopulation, def, config)
  if (count > maxBulk) {
    return {
      success: false,
      error: `Cannot purchase ${count} units (maximum bulk size is ${maxBulk}).`,
    }
  }

  // Check Tier II Royal Patent
  if (def.tier === 2 && !state.unlockedPatents[def.order]) {
    return {
      success: false,
      error: `Order '${def.order}' Tier II patent is locked. Reached Deadline 4, 12 Tier I units, and charter fee required.`,
    }
  }

  // Check demographic availability (Free Serfs)
  if (state.freeSerfs < count) {
    return {
      success: false,
      error: `Not enough free serfs (requested: ${count}, available: ${state.freeSerfs}).`,
    }
  }

  // Check Order Headroom
  const maxPop = calculateMaxPopulation(state, config)
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

  // Check AP treasury
  const currentOwned = state.units[unitId] ?? 0
  const totalCost = calculateUnitCost(unitId, currentOwned, count, config)
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
  if (def.order === 'military') {
    state.militaryRecruitedCount = (state.militaryRecruitedCount ?? 0) + count
  }

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
  command: Extract<Command, { type: 'UNLOCK_PATENT' }>,
  config: EngineConfig = DEFAULT_ENGINE_CONFIG,
): DispatchResult {
  const { order } = command
  if (state.unlockedPatents[order]) {
    return { success: false, error: `Patent for order '${order}' is already unlocked.` }
  }

  // Reached at least Deadline 4
  if (state.deadline < config.balance.PATENT_MIN_DEADLINE) {
    return {
      success: false,
      error: `Institutional Maturity prerequisite not met: Must reach Deadline ${config.balance.PATENT_MIN_DEADLINE} (currently: ${state.deadline}).`,
    }
  }

  // Maintaining at least 12 active Tier I units in that order
  const tierICount = Object.entries(state.units).reduce((sum, [id, qty]) => {
    const def = UNITS_DATA[id as UnitId]
    return def && def.order === order && def.tier === 1 ? sum + qty : sum
  }, 0)

  if (tierICount < config.balance.PATENT_MIN_TIER_I_UNITS) {
    return {
      success: false,
      error: `Order Mastery prerequisite not met: Must maintain at least ${config.balance.PATENT_MIN_TIER_I_UNITS} Tier I units in '${order}' (currently: ${tierICount}).`,
    }
  }

  // Purchasing the royal charter fee
  const fee = config.balance.PATENT_COSTS[order]
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
  command: Extract<Command, { type: 'SET_TAX_RATE' }>,
  config: EngineConfig = DEFAULT_ENGINE_CONFIG,
): DispatchResult {
  if (!Number.isFinite(command.rate)) {
    return { success: false, error: 'Tax rate must be a finite number.' }
  }

  const targetRate = Math.max(0, Math.min(60, Math.round(command.rate)))
  const currentRate = state.taxRate

  const events: string[] = []

  // Downward or maintain: applies immediately and cancels any pending upward promulgation
  if (targetRate <= currentRate) {
    state.taxRate = targetRate
    state.pendingTaxRate = null
    state.taxPromulgationTimer = 0
    events.push(`Tax rate adjusted immediately to ${targetRate}%.`)
    return { success: true, events }
  }

  // Upward: check for Tax Shock penalty (> 15 percentage points in single adjustment)
  if (targetRate - currentRate > config.balance.TAX_SHOCK_THRESHOLD) {
    addUnrest(state, config.balance.TAX_SHOCK_UNREST_SPIKE, config)
    events.push(
      `Tax Shock! Raising taxes by ${targetRate - currentRate}% triggered +${config.balance.TAX_SHOCK_UNREST_SPIKE} Unrest.`,
    )
  }

  state.pendingTaxRate = targetRate
  state.taxPromulgationTimer = config.balance.TAX_PROMULGATION_DELAY_SECONDS
  events.push(`Tax rate adjustment to ${targetRate}% initiated (promulgation delay: 8s).`)

  return { success: true, events }
}

/**
 * Handles demobilization and unit disbanding (DISBAND_UNIT).
 */
function handleDisbandUnit(
  state: GameState,
  command: Extract<Command, { type: 'DISBAND_UNIT' }>,
  config: EngineConfig = DEFAULT_ENGINE_CONFIG,
): DispatchResult {
  const { unitId, count } = command

  if (!Number.isInteger(count) || count <= 0) {
    return { success: false, error: 'Disband count must be a positive integer.' }
  }

  const def = UNITS_DATA[unitId]
  if (!def) {
    return { success: false, error: `Invalid unit ID '${unitId}'.` }
  }

  const currentCount = state.units[unitId] ?? 0
  if (currentCount < count) {
    return {
      success: false,
      error: `Cannot disband ${count}x '${unitId}' (currently owned: ${currentCount}).`,
    }
  }

  // Pre-disband military total for mutiny detection
  const totalActiveMilitaryBefore = Object.entries(state.units).reduce((sum, [id, qty]) => {
    const uDef = UNITS_DATA[id as UnitId]
    return uDef && uDef.order === 'military' ? sum + qty : sum
  }, 0)

  // Severance pay per unit = 50% base AP cost
  const severancePerUnit = 0.5 * def.baseCost
  const maxPaid = Math.floor(Math.max(0, state.ap) / severancePerUnit)
  const paidUnits = Math.min(count, maxPaid)
  const unpaidUnits = count - paidUnits

  // Deduct severance from available positive treasury
  state.ap -= paidUnits * severancePerUnit

  // Unpaid veterans inflict +2 Unrest each
  if (unpaidUnits > 0) {
    addUnrest(state, 2 * unpaidUnits, config)
  }

  // Return disbanded units to free serf pool (total population remains invariant)
  state.units[unitId] -= count
  state.freeSerfs += count

  const events: string[] = [
    `Disbanded ${count}x ${unitId} (${paidUnits} paid severance of ${paidUnits * severancePerUnit} AP${
      unpaidUnits > 0 ? `, ${unpaidUnits} unpaid causing +${2 * unpaidUnits} Unrest` : ''
    }).`,
  ]

  // Mutiny detection for military orders: > 10% within 10s rolling window
  if (def.order === 'military') {
    state.disbandedMilitaryHistory = state.disbandedMilitaryHistory.filter(
      (entry) => state.totalElapsedSeconds - entry.timeSeconds <= 10,
    )
    state.disbandedMilitaryHistory.push({
      timeSeconds: state.totalElapsedSeconds,
      count,
    })

    const totalDisbandedIn10s = state.disbandedMilitaryHistory.reduce(
      (sum, entry) => sum + entry.count,
      0,
    )

    if (totalDisbandedIn10s > 0.1 * totalActiveMilitaryBefore) {
      addUnrest(state, 15, config)
      state.disbandedMilitaryHistory = []
      events.push(
        'Mutiny! Rapid demobilization exceeding 10% of military forces stirred +15 Unrest.',
      )
    }
  }

  return { success: true, events }
}

/**
 * Handles executive seal stamp click decrees (STAMP_DOCUMENT).
 */
function handleStampDocument(
  state: GameState,
  _command: Extract<Command, { type: 'STAMP_DOCUMENT' }>,
  config: EngineConfig = DEFAULT_ENGINE_CONFIG,
): DispatchResult {
  if (state.clickTokens < 1) {
    return {
      success: false,
      error: 'The ink on your previous decree has not yet dried... (click ceiling: 12/s).',
    }
  }

  state.clickTokens -= 1

  const grossApRate = calculateGrossApRate(state, config).total
  const rawState = extractRawEvaluationState(state)
  const sealMultiplier = composeStat('click_power', 1.0, state.activeModifiers, rawState)

  const isCritical = withStatePrng(
    state,
    'click',
    (prng) => prng.next() < config.balance.CLICK_CRITICAL_CHANCE,
  )

  const rawClickValue = calculateClickValue(grossApRate, sealMultiplier, isCritical, config)

  // The Lord's Privilege: Decrees bypass 50% of bureaucratic paperwork
  const netPaperwork = calculateNetPaperwork(state, config)
  const effectivePaperwork = netPaperwork * config.balance.CLICK_PAPERWORK_MITIGATION
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
function handleColoniseProvince(
  state: GameState,
  config: EngineConfig = DEFAULT_ENGINE_CONFIG,
): DispatchResult {
  const cost = calculateColonisationCost(state.colonisedProvincesCount, config)
  if (state.ap < cost) {
    return {
      success: false,
      error: `Insufficient AP to colonise province (required: ${cost} AP, available: ${Math.floor(state.ap)} AP).`,
    }
  }

  state.ap -= cost
  addProvince(state, 'heartland')
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
  command: Extract<Command, { type: 'ENACT_EDICT' }>,
  config: EngineConfig = DEFAULT_ENGINE_CONFIG,
): DispatchResult {
  // Enforce strictly one emergency edict per deadline
  if (state.lastEdictDeadline === state.deadline) {
    return {
      success: false,
      error: 'Only one emergency edict is permitted per deadline.',
    }
  }

  const k = state.edictUsageCounts[command.edictId] ?? 0
  const mult = 1 + 0.5 * k

  const events: string[] = []

  switch (command.edictId) {
    case 'forced_tithe': {
      // 30 seconds of poll tax income + 35 * mult Unrest + 20s pop growth freeze
      const { pollTax } = calculateGrossApRate(state, config)
      const instantTax = 30 * pollTax
      state.ap += instantTax
      // Zero AP quota credit!
      addUnrest(state, 35 * mult, config)
      state.forcedTitheFreezeTimer = 20
      events.push(
        `Forced Tithe enacted: +${Math.round(instantTax)} AP seized, +${(35 * mult).toFixed(1)} Unrest stirred, population growth frozen for 20s.`,
      )
      break
    }

    case 'church_seizure': {
      if (k >= 2) {
        return {
          success: false,
          error: 'Maximum of 2 church seizures permitted per run.',
        }
      }
      // max(300, 25 * Gross AP/s), cuts pacification by 50% for 60 * mult seconds, + 10 * mult Unrest
      const grossRate = calculateGrossApRate(state, config).total
      const payout = Math.max(300, 25 * grossRate)
      state.ap += payout
      // Zero AP quota credit!
      state.activeModifiers.push({
        source: 'edict:church_seizure',
        stat: 'unrest_pacification',
        op: 'mul',
        value: 0.5,
        appliedAt: state.totalElapsedSeconds,
        expiresAt: state.totalElapsedSeconds + 60 * mult,
      })
      addUnrest(state, 10 * mult, config)
      events.push(
        `Church Seizure enacted: +${Math.round(payout)} AP seized, church pacification halved for ${(60 * mult).toFixed(1)}s, +${(10 * mult).toFixed(1)} Unrest.`,
      )
      break
    }

    case 'grand_festival': {
      // Cost = max(100, 0.20 * max(0, state.ap), 30 * Gross AP/s)
      const grossRate = calculateGrossApRate(state, config).total
      const cost = Math.max(100, 0.2 * Math.max(0, state.ap), 30 * grossRate)
      if (state.ap < cost) {
        return {
          success: false,
          error: `Insufficient funds for Grand Festival (required: ${Math.round(cost)} AP, available: ${Math.floor(state.ap)} AP).`,
        }
      }
      state.ap -= cost
      addUnrest(state, -20, config)
      events.push(`Grand Festival celebrated: -20 Unrest pacified for ${Math.round(cost)} AP.`)
      break
    }
  }

  // Update tracking on success only
  state.lastEdictDeadline = state.deadline
  state.edictUsageCounts[command.edictId] = k + 1

  return { success: true, events }
}

/**
 * Handles the Lombard Bailout acceptance (ACCEPT_LOMBARD_LOAN).
 */
function handleAcceptLombardLoan(
  state: GameState,
  config: EngineConfig = DEFAULT_ENGINE_CONFIG,
): DispatchResult {
  if (state.phase !== 'LOMBARD_OFFER') {
    return { success: false, error: "Lombard offer is only valid during 'LOMBARD_OFFER' phase." }
  }
  if (!state.lombardBailoutAvailable) {
    return { success: false, error: 'Lombard Bailout has already been claimed this run.' }
  }
  if (state.provinces <= config.balance.PROVINCE_MIN_FLOOR_FOR_FINES) {
    return { success: false, error: 'Cannot cede your final sovereign seat (Province Floor = 1).' }
  }

  removeLastProvince(state)
  state.ap += 2000
  state.lombardBailoutAvailable = false
  state.lombardBailoutAccepted = true
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
 * Tells whether at least one choice of a dilemma can be paid by the state, using the same
 * affordability check as the RESOLVE_DILEMMA command.
 *
 * @param state - The current game state.
 * @param dilemma - The dilemma definition to evaluate.
 * @returns True when a choice has all its costs payable.
 */
export function hasAffordableChoice(state: GameState, dilemma: DilemmaDef): boolean {
  return dilemma.choices.some((choice) => canAffordEffects(state, choice.effects))
}

/**
 * Transitions to the next inter-deadline phase, populating threat and expedition targets when entering them.
 */
function transitionToNextInterDeadlinePhase(
  state: GameState,
  config: EngineConfig = DEFAULT_ENGINE_CONFIG,
): void {
  if (state.isGameOver) return
  if (state.phase === 'COUNCIL_DILEMMA') state.currentDilemmaId = null
  if (state.phase === 'COUNCIL_LAWS') state.currentLawDraft = []
  const nextPhase = getNextInterDeadlinePhase(state.phase, state.deadline)
  state.phase = nextPhase

  if (nextPhase === 'COUNCIL_DILEMMA') {
    const pool = Object.values(DILEMMAS_DATA).filter(
      (d) => d.trigger(state, config) && hasAffordableChoice(state, d),
    )
    if (pool.length === 0) {
      // Nothing qualifies: skip the dilemma step so the run cannot deadlock.
      state.currentDilemmaId = null
      transitionToNextInterDeadlinePhase(state, config)
      return
    }
    state.currentDilemmaId = withStatePrng(state, 'council', (prng) => {
      const idx = Math.min(pool.length - 1, Math.floor(prng.next() * pool.length))
      return pool[idx]!.id
    })
  } else if (nextPhase === 'COUNCIL_LAWS') {
    state.currentLawDraft = withStatePrng(state, 'council', (prng) => {
      const draft: string[] = []
      const orders: Array<'chancellor' | 'prelate' | 'marshal'> = [
        'chancellor',
        'prelate',
        'marshal',
      ]
      for (const ord of orders) {
        const available = Object.values(LAWS_DATA).filter(
          (l) => l.order === ord && !state.activeLaws.includes(l.id),
        )
        if (available.length > 0) {
          const idx = Math.min(available.length - 1, Math.floor(prng.next() * available.length))
          draft.push(available[idx]!.id)
        }
      }
      return draft
    })
  } else if (nextPhase === 'THREAT_HERALD') {
    const nextDeadline = state.deadline + 1
    const nextQuota =
      config.quotas.find((q) => q.deadline === nextDeadline) ??
      config.quotas[config.quotas.length - 1]!
    state.currentThreatPower = getThreatPower(nextQuota.military)
    state.currentThreatTributeAp = getThreatTributeAp(nextQuota.apRate)
  } else if (nextPhase === 'EXPEDITION') {
    state.campaignsLaunchedThisDeadline = 0
    generateCampaignTarget(state, config)
  }
}

/**
 * Handles moving to the next inter-deadline phase or advancing governance (RESUME_GOVERNANCE).
 */
function handleResumeGovernance(state: GameState): DispatchResult {
  if (state.phase !== 'AWAIT_RESUME') {
    return { success: false, error: "Cannot resume governance outside of 'AWAIT_RESUME' phase." }
  }
  if (state.deadline >= 10) {
    return { success: false, error: 'Cannot resume governance beyond Deadline 10.' }
  }

  state.deadline += 1
  state.deadlineTimeSeconds = 0
  state.cumulativeApThisDeadline = 0
  state.interimWarningShown = false
  state.campaignsLaunchedThisDeadline = 0
  state.surpriseRaidTriggeredThisDeadline = false
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
  command: Extract<Command, { type: 'RESTART_RUN' }>,
): DispatchResult {
  const seed = command.seed ?? 1337
  const initial = createInitialGameState({ seed, archivePoints: state.archivePoints })
  Object.assign(state, initial)
  return { success: true, events: [`Run restarted with seed ${seed}.`] }
}

/**
 * Dispatches and evaluates a Command against the active GameState.
 * Validates phase legality before mutating domain state.
 *
 * @param state - The active mutable GameState.
 * @param command - The command to process.
 * @param config - Optional engine configuration.
 * @returns DispatchResult indicating success or failure.
 */
export function dispatch(
  state: GameState,
  command: Command,
  config: EngineConfig = DEFAULT_ENGINE_CONFIG,
): DispatchResult {
  // Enforce RunPhase command permissions
  try {
    assertCommandAllowed(state.phase, command)
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    }
  }

  // Dispatch to specific handler
  switch (command.type) {
    case 'BUY_UNIT':
      return handleBuyUnit(state, command, config)

    case 'DISBAND_UNIT':
      return handleDisbandUnit(state, command, config)

    case 'TICK':
      if (!Number.isFinite(command.dt) || command.dt <= 0) {
        return { success: false, error: 'Tick delta time dt must be a positive finite number.' }
      }
      tick(state, command.dt, config)
      return { success: true }

    case 'UNLOCK_PATENT':
      return handleUnlockPatent(state, command, config)

    case 'SET_TAX_RATE':
      return handleSetTaxRate(state, command, config)

    case 'STAMP_DOCUMENT':
      return handleStampDocument(state, command, config)

    case 'COLONISE_PROVINCE':
      return handleColoniseProvince(state, config)

    case 'ENACT_EDICT':
      return handleEnactEdict(state, command, config)

    case 'ACCEPT_LOMBARD_LOAN':
      return handleAcceptLombardLoan(state, config)

    case 'REFUSE_LOMBARD_LOAN':
      return handleRefuseLombardLoan(state)

    case 'RESUME_GOVERNANCE':
      return handleResumeGovernance(state)

    case 'SUBMIT_AUDIT': {
      transitionToNextInterDeadlinePhase(state, config)
      return { success: true }
    }

    case 'RESOLVE_DILEMMA': {
      const dilemmaId = command.dilemmaId
      if (state.currentDilemmaId === null || dilemmaId !== state.currentDilemmaId) {
        return { success: false, error: `Dilemma ${dilemmaId} is not the drafted dilemma.` }
      }
      const dilemma = DILEMMAS_DATA[dilemmaId]
      if (!dilemma) {
        return { success: false, error: `Unknown dilemma ${dilemmaId}.` }
      }
      const choice = dilemma.choices[command.choiceIndex]
      if (!choice) {
        return {
          success: false,
          error: `Invalid choice index ${command.choiceIndex} for dilemma ${dilemmaId}.`,
        }
      }
      if (!canAffordEffects(state, choice.effects)) {
        return {
          success: false,
          error: `Cannot afford choice: ${choice.text}.`,
        }
      }
      for (const eff of choice.effects) {
        applyEffect(eff, state)
      }
      transitionToNextInterDeadlinePhase(state, config)
      return { success: true, events: [`Resolved dilemma '${dilemma.name}': ${choice.text}`] }
    }

    case 'ENACT_LAW': {
      const law = LAWS_DATA[command.lawId]
      if (!law) {
        return { success: false, error: `Unknown law ${command.lawId}.` }
      }
      if (!state.currentLawDraft.includes(command.lawId)) {
        return { success: false, error: `Law ${command.lawId} is not in current council draft.` }
      }
      if (state.activeLaws.includes(command.lawId)) {
        return { success: false, error: `Law ${command.lawId} is already active.` }
      }
      let maxLawSlots = 5
      if (state.activeModifiers.some((m) => m.source === 'archive:sixth_law_slot')) {
        maxLawSlots = 6
      }
      if (
        state.activeLaws.includes('law:papal_concordat') &&
        command.lawId !== 'law:papal_concordat'
      ) {
        maxLawSlots -= 1
      }
      if (state.activeLaws.length >= maxLawSlots) {
        return { success: false, error: `Maximum active law capacity (${maxLawSlots}) reached.` }
      }
      if (!canAffordEffects(state, law.effects)) {
        return { success: false, error: `Cannot afford requirements to enact law ${law.name}.` }
      }
      for (const eff of law.effects) {
        applyEffect(eff, state)
      }
      state.activeLaws.push(command.lawId)
      transitionToNextInterDeadlinePhase(state, config)
      return { success: true, events: [`Enacted Imperial Law: ${law.name}`] }
    }

    case 'REJECT_LAWS': {
      state.archivePoints += 1
      transitionToNextInterDeadlinePhase(state, config)
      return { success: true, events: ['Laws rejected. Gained +1 Archive Point.'] }
    }

    case 'SELECT_THREAT_RESPONSE': {
      let threatPower = state.currentThreatPower
      let tributeAp = state.currentThreatTributeAp

      if (threatPower <= 0 || tributeAp <= 0) {
        const nextQuota = config.quotas.find((q) => q.deadline === state.deadline + 1)
        if (nextQuota) {
          threatPower = getThreatPower(nextQuota.military)
          tributeAp = getThreatTributeAp(nextQuota.apRate)
        }
      }

      if (command.response === 'tribute' && state.ap < tributeAp) {
        return {
          success: false,
          error: `Insufficient treasury to pay tribute (${tributeAp} AP required, ${Math.floor(state.ap)} AP available).`,
        }
      }

      const res = resolveScheduledThreat(
        state,
        command.response,
        threatPower,
        tributeAp,
        undefined,
        config,
      )
      if (!res.success && command.response === 'tribute') {
        // Insufficient treasury for tribute: do NOT advance phase, stay in THREAT_HERALD
        return { success: false, error: res.message }
      }

      transitionToNextInterDeadlinePhase(state, config)
      return { success: true, events: [res.message] }
    }

    case 'LAUNCH_ATTACK': {
      const playerPower = calculateMilitaryPower(state)
      const target = state.currentTarget ?? generateCampaignTarget(state, config)
      const enemyPower = target.isAmbush ? Math.round(target.power * 1.25) : target.power
      let baseLootAp = 300
      if (target.isFalseLedger) {
        baseLootAp = Math.round(
          baseLootAp * withStatePrng(state, 'combat', (p) => p.nextBetween(0.2, 0.4)),
        )
      }

      const result = resolveOffensiveCampaign(
        state,
        playerPower,
        enemyPower,
        target.lootType,
        baseLootAp,
        undefined,
        config,
        target.biome,
      )

      state.campaignsLaunchedThisDeadline += 1
      if (state.campaignsLaunchedThisDeadline < 2) {
        generateCampaignTarget(state, config)
      } else {
        if (!state.isGameOver) {
          state.phase = getNextInterDeadlinePhase(state.phase, state.deadline)
        }
      }

      return {
        success: true,
        events: [`Campaign executed: ${result.outcome} (ratio: ${result.clashRatio.toFixed(2)}).`],
      }
    }

    case 'RECON_PATROL': {
      const success = performScoutReroll(state, config)
      if (!success) {
        return { success: false, error: 'No active scouts available for recon patrol.' }
      }
      return { success: true, events: ['Recon patrol dispatched. 1 Scout died in action.'] }
    }

    case 'SKIP_EXPEDITION': {
      if (!state.isGameOver) {
        state.phase = getNextInterDeadlinePhase(state.phase, state.deadline)
      }
      return { success: true }
    }

    case 'RESOLVE_RAID_DEFENSE': {
      const playerPower = calculateMilitaryPower(state)
      const quota = config.quotas.find((q) => q.deadline === state.deadline) ?? config.quotas[0]!
      const raidPower = Math.round(0.5 * quota.military)
      const strongholdCount = state.provinceBiomes.filter((b) => b === 'stronghold').length
      const tributeCost = getThreatTributeAp(quota.apRate)
      const res = resolveDefensiveClash(
        state,
        playerPower,
        raidPower,
        strongholdCount,
        undefined,
        config,
        tributeCost,
      )
      if (!state.isGameOver) {
        state.phase = 'ACTIVE_CYCLE'
      }
      return { success: true, events: res.events }
    }

    case 'RESTART_RUN':
      return handleRestartRun(state, command)

    default:
      return { success: false, error: 'Unsupported command' }
  }
}
