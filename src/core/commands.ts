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
import { deriveSeed, withStatePrng } from './prng'
import { composeStat, extractRawEvaluationState, canAffordEffects, applyEffect } from './modifiers'
import { hasRule } from './rules'
import { LAWS_DATA } from '@/data/laws'
import {
  FACTIONS_DATA,
  SCHEDULED_THREATS_DATA,
  neutralTrait,
  type FactionTraitResult,
} from '@/data/threats'
import { DILEMMAS_DATA } from '@/data/dilemmas'
import { EDICTS_DATA, EDICT_ESCALATION_PER_USE } from '@/data/edicts'
import {
  tick,
  calculateGrossApRate,
  calculateMaxPopulation,
  calculateNetPaperwork,
  calculateMilitaryPower,
  effectiveQuota,
  calculateNetApRate,
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
  calculateBaseCampaignLoot,
  calculateEnemyPower,
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
      error: `Order '${def.order}' Tier II patent is locked. Reached Deadline ${config.balance.PATENT_MIN_DEADLINE}, ${config.balance.PATENT_MIN_TIER_I_UNITS} Tier I units, and charter fee required.`,
    }
  }

  // Mercenary Capitulation hires Men-at-Arms from outside the realm (GAME_RULES.md §10.3.9)
  const isExternalHire = unitId === 'man_at_arms' && hasRule(state, 'law:mercenary_capitulation')

  // Check demographic availability (Free Serfs)
  if (!isExternalHire && state.freeSerfs < count) {
    return {
      success: false,
      error: `Not enough free serfs (requested: ${count}, available: ${state.freeSerfs}).`,
    }
  }

  // Check Order Headroom
  const maxPop = calculateMaxPopulation(state, config)
  const orderCaps = calculateOrderCaps(
    maxPop,
    state.activeModifiers,
    extractRawEvaluationState(state),
    config,
  )
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
  const totalCost = calculateUnitCost(unitId, currentOwned, count, config, state.activeModifiers)
  if (state.ap < totalCost) {
    return {
      success: false,
      error: `Insufficient AP treasury (required: ${totalCost} AP, available: ${Math.floor(state.ap)} AP).`,
    }
  }

  // Execute mutation
  state.ap -= totalCost
  if (isExternalHire) {
    // Keeps the §3.1 balance: the hired units join the population instead of leaving the serfs
    state.totalPopulation += count
    state.peakPopulation = Math.max(state.peakPopulation, state.totalPopulation)
  } else {
    state.freeSerfs -= count
  }
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

  const targetRate = Math.max(0, Math.min(config.balance.TAX_RATE_MAX, Math.round(command.rate)))
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
  events.push(
    `Tax rate adjustment to ${targetRate}% initiated (promulgation delay: ${config.balance.TAX_PROMULGATION_DELAY_SECONDS}s).`,
  )

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
  const severancePerUnit = config.balance.DISBAND_SEVERANCE_SHARE * def.baseCost
  const maxPaid = Math.floor(Math.max(0, state.ap) / severancePerUnit)
  const paidUnits = Math.min(count, maxPaid)
  const unpaidUnits = count - paidUnits

  // Deduct severance from available positive treasury
  state.ap -= paidUnits * severancePerUnit

  // Unpaid veterans inflict +2 Unrest each
  if (unpaidUnits > 0) {
    addUnrest(state, config.balance.DISBAND_UNPAID_UNREST * unpaidUnits, config)
  }

  // Return disbanded units to free serf pool (total population remains invariant)
  state.units[unitId] -= count
  state.freeSerfs += count

  const events: string[] = [
    `Disbanded ${count}x ${unitId} (${paidUnits} paid severance of ${paidUnits * severancePerUnit} AP${
      unpaidUnits > 0
        ? `, ${unpaidUnits} unpaid causing +${config.balance.DISBAND_UNPAID_UNREST * unpaidUnits} Unrest`
        : ''
    }).`,
  ]

  // Mutiny detection for military orders: > 10% within 10s rolling window
  if (def.order === 'military') {
    state.disbandedMilitaryHistory = state.disbandedMilitaryHistory.filter(
      (entry) =>
        state.totalElapsedSeconds - entry.timeSeconds <= config.balance.MUTINY_WINDOW_SECONDS,
    )
    state.disbandedMilitaryHistory.push({
      timeSeconds: state.totalElapsedSeconds,
      count,
    })

    const totalDisbandedIn10s = state.disbandedMilitaryHistory.reduce(
      (sum, entry) => sum + entry.count,
      0,
    )

    if (totalDisbandedIn10s > config.balance.MUTINY_THRESHOLD_SHARE * totalActiveMilitaryBefore) {
      addUnrest(state, config.balance.MUTINY_UNREST, config)
      state.disbandedMilitaryHistory = []
      events.push(
        `Mutiny! Rapid demobilization exceeding ${Math.round(config.balance.MUTINY_THRESHOLD_SHARE * 100)}% of military forces stirred +${config.balance.MUTINY_UNREST} Unrest.`,
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
      error: `The ink on your previous decree has not yet dried... (click ceiling: ${config.balance.CLICK_MAX_TOKENS_PER_SECOND}/s).`,
    }
  }

  state.clickTokens -= 1

  const grossApRate = calculateGrossApRate(state, config).total
  const rawState = extractRawEvaluationState(state)
  const sealMultiplier = composeStat('click_power', 1.0, state.activeModifiers, rawState)

  const criticalChance = composeStat(
    'click_critical_chance',
    config.balance.CLICK_CRITICAL_CHANCE,
    state.activeModifiers,
    rawState,
  )
  const isCritical = withStatePrng(state, 'click', (prng) => prng.next() < criticalChance)

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
      `Colonised province #${state.provinces} for ${cost} AP. Housing capacity expanded by +${config.balance.BASE_HOUSING_PER_PROVINCE}.`,
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
  const mult = 1 + EDICT_ESCALATION_PER_USE * k

  const events: string[] = []

  switch (command.edictId) {
    case 'forced_tithe': {
      // Poll tax income seized, escalated Unrest, population growth freeze
      const edict = EDICTS_DATA.forced_tithe.values
      const { pollTax } = calculateGrossApRate(state, config)
      const instantTax = edict.pollTaxSeconds * pollTax
      state.ap += instantTax
      // Zero AP quota credit!
      const unrest = edict.unrest * mult
      addUnrest(state, unrest, config)
      state.forcedTitheFreezeTimer = edict.growthFreezeSeconds
      events.push(
        `Forced Tithe enacted: +${Math.round(instantTax)} AP seized, +${unrest.toFixed(1)} Unrest stirred, population growth frozen for ${edict.growthFreezeSeconds}s.`,
      )
      break
    }

    case 'church_seizure': {
      const edict = EDICTS_DATA.church_seizure.values
      if (k >= edict.maxUsesPerRun) {
        return {
          success: false,
          error: `Maximum of ${edict.maxUsesPerRun} church seizures permitted per run.`,
        }
      }
      // max(minPayout, grossRateSeconds * Gross AP/s); pacification cut and Unrest escalate
      const grossRate = calculateGrossApRate(state, config).total
      const payout = Math.max(edict.minPayout, edict.grossRateSeconds * grossRate)
      state.ap += payout
      // Zero AP quota credit!
      const duration = edict.pacificationSeconds * mult
      state.activeModifiers.push({
        source: 'edict:church_seizure',
        stat: 'unrest_pacification',
        op: 'mul',
        value: edict.pacificationMultiplier,
        appliedAt: state.totalElapsedSeconds,
        expiresAt: state.totalElapsedSeconds + duration,
      })
      const unrest = edict.unrest * mult
      addUnrest(state, unrest, config)
      events.push(
        `Church Seizure enacted: +${Math.round(payout)} AP seized, church pacification cut for ${duration.toFixed(1)}s, +${unrest.toFixed(1)} Unrest.`,
      )
      break
    }

    case 'grand_festival': {
      // Cost = max(minCost, treasuryShare * max(0, state.ap), grossRateSeconds * Gross AP/s)
      const edict = EDICTS_DATA.grand_festival.values
      const grossRate = calculateGrossApRate(state, config).total
      const cost = Math.max(
        edict.minCost,
        edict.treasuryShare * Math.max(0, state.ap),
        edict.grossRateSeconds * grossRate,
      )
      if (state.ap < cost) {
        return {
          success: false,
          error: `Insufficient funds for Grand Festival (required: ${Math.round(cost)} AP, available: ${Math.floor(state.ap)} AP).`,
        }
      }
      state.ap -= cost
      addUnrest(state, -edict.unrestRelief, config)
      events.push(
        `Grand Festival celebrated: -${edict.unrestRelief} Unrest pacified for ${Math.round(cost)} AP.`,
      )
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
  state.ap += config.balance.LOMBARD_BAILOUT_AP
  state.lombardBailoutAvailable = false
  state.lombardBailoutAccepted = true
  state.bankruptcyGraceTimer = config.balance.BANKRUPTCY_GRACE_BASE_SECONDS
  state.phase = 'ACTIVE_CYCLE'

  return {
    success: true,
    events: [
      `Lombard Bailout accepted: Ceded 1 Province for +${config.balance.LOMBARD_BAILOUT_AP.toLocaleString('en-US')} AP. Bankruptcy averted.`,
    ],
  }
}

/**
 * Handles the Lombard Bailout refusal (REFUSE_LOMBARD_LOAN).
 */
function handleRefuseLombardLoan(
  state: GameState,
  config: EngineConfig = DEFAULT_ENGINE_CONFIG,
): DispatchResult {
  if (state.phase !== 'LOMBARD_OFFER') {
    return { success: false, error: "Lombard offer is only valid during 'LOMBARD_OFFER' phase." }
  }

  state.lombardBailoutAvailable = false
  state.phase = 'ACTIVE_CYCLE'

  return {
    success: true,
    events: [
      `Lombard Bailout refused. Bankruptcy countdown resumes from ${config.balance.LOMBARD_OFFER_REMAINING_SECONDS} seconds.`,
    ],
  }
}

/**
 * Tells whether at least one choice of a dilemma can be paid by the state, using the same
 * affordability check as the RESOLVE_DILEMMA command.
 *
 * @param state - The current game state.
 * @param dilemma - The dilemma definition to evaluate.
 * @param config - Balance configuration (net AP rate of income priced costs).
 * @returns True when a choice has all its costs payable.
 */
export function hasAffordableChoice(
  state: GameState,
  dilemma: DilemmaDef,
  config: EngineConfig = DEFAULT_ENGINE_CONFIG,
): boolean {
  const netApRate = calculateNetApRate(state, config)
  return dilemma.choices.some((choice) => canAffordEffects(state, choice.effects, netApRate))
}

/**
 * Composes the `threat_power` modifiers (base 1) onto the power of a new threat or raid.
 *
 * @param state - Active state that supplies the modifiers.
 * @param basePower - Threat power before modifiers.
 * @returns The modified power, rounded and never below 0.
 */
function composeThreatPower(state: GameState, basePower: number): number {
  const factor = composeStat(
    'threat_power',
    1,
    state.activeModifiers,
    extractRawEvaluationState(state),
  )
  return Math.max(0, Math.round(basePower * factor))
}

/** Scheduled threat of a deadline once the faction trait and `threat_power` are applied. */
interface ScheduledThreatForecast {
  power: number
  tribute: number
  trait: FactionTraitResult
}

/**
 * Builds the threat of a deadline from its quota, its faction trait, then `threat_power`.
 *
 * @param state - Active state read by the trait and the modifiers.
 * @param deadline - Deadline the threat attacks.
 * @param config - Balance configuration (quotas).
 * @returns Power, tribute and the trait values for that deadline.
 */
function forecastScheduledThreat(
  state: GameState,
  deadline: number,
  config: EngineConfig,
): ScheduledThreatForecast {
  const trait = forecastThreatTrait(state, deadline, config)
  return {
    power: composeThreatPower(state, trait.adjustedThreatPower),
    tribute: trait.adjustedTributeCost,
    trait,
  }
}

/**
 * Applies the faction trait of the threat of a deadline to its base power and tribute.
 *
 * @param state - Active state read by the trait.
 * @param deadline - Deadline the threat attacks.
 * @param config - Balance configuration (quotas).
 * @returns The trait values, with the adjusted power before `threat_power`.
 */
function forecastThreatTrait(
  state: GameState,
  deadline: number,
  config: EngineConfig,
): FactionTraitResult {
  const quota =
    config.quotas.find((q) => q.deadline === deadline) ?? config.quotas[config.quotas.length - 1]!
  const basePower = getThreatPower(quota.military, config.balance.THREAT_POWER_QUOTA_SHARE)
  const baseTribute = getThreatTributeAp(quota.apRate, config.balance.THREAT_TRIBUTE_QUOTA_SECONDS)
  const def = SCHEDULED_THREATS_DATA.find((t) => t.deadline === deadline)
  return def
    ? FACTIONS_DATA[def.factionId].applyReactiveTrait(state, basePower, baseTribute, {
        militaryPower: calculateMilitaryPower(state, config),
        militaryQuota: effectiveQuota(state, quota).military,
      })
    : neutralTrait(basePower, baseTribute)
}

/**
 * Transitions to the next inter-deadline phase, populating threat and expedition targets when entering them.
 */
function transitionToNextInterDeadlinePhase(
  state: GameState,
  config: EngineConfig = DEFAULT_ENGINE_CONFIG,
): void {
  if (state.phase === 'THREAT_HERALD' || state.isGameOver) state.currentThreatId = null
  if (state.isGameOver) return
  if (state.phase === 'COUNCIL_DILEMMA') state.currentDilemmaId = null
  if (state.phase === 'COUNCIL_LAWS') state.currentLawDraft = []
  const nextPhase = getNextInterDeadlinePhase(state.phase, state.deadline, config)
  state.phase = nextPhase

  if (nextPhase === 'COUNCIL_DILEMMA') {
    const pool = Object.values(DILEMMAS_DATA).filter(
      (d) => d.trigger(state, config) && hasAffordableChoice(state, d, config),
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
    const forecast = forecastScheduledThreat(state, state.deadline + 1, config)
    state.currentThreatId = state.deadline + 1
    state.currentThreatPower = forecast.power
    state.currentThreatTributeAp = forecast.tribute
  } else if (nextPhase === 'EXPEDITION') {
    state.campaignsLaunchedThisDeadline = 0
    generateCampaignTarget(state, config)
  }
}

/**
 * Handles moving to the next inter-deadline phase or advancing governance (RESUME_GOVERNANCE).
 */
function handleResumeGovernance(
  state: GameState,
  config: EngineConfig = DEFAULT_ENGINE_CONFIG,
): DispatchResult {
  if (state.phase !== 'AWAIT_RESUME') {
    return { success: false, error: "Cannot resume governance outside of 'AWAIT_RESUME' phase." }
  }
  if (state.deadline >= config.balance.TOTAL_DEADLINES) {
    return {
      success: false,
      error: `Cannot resume governance beyond Deadline ${config.balance.TOTAL_DEADLINES}.`,
    }
  }

  state.deadline += 1
  state.deadlineTimeSeconds = 0
  state.cumulativeApThisDeadline = 0
  state.interimWarningShown = false
  state.campaignsLaunchedThisDeadline = 0
  state.surpriseRaidTriggeredThisDeadline = false
  state.interimWarningOnTrack = null
  state.phase = 'ACTIVE_CYCLE'

  return {
    success: true,
    events: [`Governance resumed. Entering Deadline ${state.deadline}.`],
  }
}

/**
 * Handles restarting a run (RESTART_RUN): a bare run with no perk and 0 run archive points.
 * The UI concludes the finished run into the archive first and uses `startRun` to apply perks.
 */
function handleRestartRun(
  state: GameState,
  command: Extract<Command, { type: 'RESTART_RUN' }>,
): DispatchResult {
  const seed = command.seed ?? deriveSeed(state.seed, 'restart')
  const initial = createInitialGameState({ seed })
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

    case 'SET_PAUSED':
      state.isPaused = command.paused
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
      return handleRefuseLombardLoan(state, config)

    case 'RESUME_GOVERNANCE':
      return handleResumeGovernance(state, config)

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
      const dilemmaNetApRate = calculateNetApRate(state, config)
      if (!canAffordEffects(state, choice.effects, dilemmaNetApRate)) {
        return {
          success: false,
          error: `Cannot afford choice: ${choice.text}.`,
        }
      }
      for (const eff of choice.effects) {
        applyEffect(eff, state, dilemmaNetApRate)
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
      let maxLawSlots = composeStat(
        'law_slots',
        config.balance.LAW_SLOTS_BASE,
        state.activeModifiers,
        extractRawEvaluationState(state),
      )
      if (hasRule(state, 'law:papal_concordat') && command.lawId !== 'law:papal_concordat') {
        maxLawSlots -= 1
      }
      if (law.order === 'chancellor' && hasRule(state, 'law:marshals_carte_blanche')) {
        return {
          success: false,
          error: `Chancellor laws cannot be enacted while Marshal's Carte Blanche is active.`,
        }
      }
      if (state.activeLaws.length >= maxLawSlots) {
        return { success: false, error: `Maximum active law capacity (${maxLawSlots}) reached.` }
      }
      const lawNetApRate = calculateNetApRate(state, config)
      if (!canAffordEffects(state, law.effects, lawNetApRate)) {
        return { success: false, error: `Cannot afford requirements to enact law ${law.name}.` }
      }
      for (const eff of law.effects) {
        applyEffect(eff, state, lawNetApRate)
      }
      state.activeLaws.push(command.lawId)
      state.peakActiveLaws = Math.max(state.peakActiveLaws, state.activeLaws.length)
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

      const threatDeadline = state.currentThreatId ?? state.deadline + 1
      const trait = forecastThreatTrait(state, threatDeadline, config)
      if (threatPower <= 0 || tributeAp <= 0) {
        const forecast = forecastScheduledThreat(state, threatDeadline, config)
        threatPower = forecast.power
        tributeAp = forecast.tribute
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
        trait,
      )
      if (!res.success && command.response === 'tribute') {
        // Insufficient treasury for tribute: do NOT advance phase, stay in THREAT_HERALD
        return { success: false, error: res.message }
      }

      transitionToNextInterDeadlinePhase(state, config)
      return { success: true, events: [res.message] }
    }

    case 'LAUNCH_ATTACK': {
      const playerPower = calculateMilitaryPower(state, config)
      if (playerPower <= 0) {
        return { success: false, error: 'Cannot launch an attack without an army.' }
      }
      const target = state.currentTarget ?? generateCampaignTarget(state, config)
      const enemyPower = calculateEnemyPower(target, config)
      let baseLootAp = calculateBaseCampaignLoot(state, config)
      if (target.isFalseLedger) {
        baseLootAp = Math.round(
          baseLootAp *
            withStatePrng(state, 'combat', (p) =>
              p.nextBetween(
                config.balance.FALSE_LEDGER_LOOT_MIN,
                config.balance.FALSE_LEDGER_LOOT_MAX,
              ),
            ),
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
      if (state.campaignsLaunchedThisDeadline < config.balance.CAMPAIGNS_PER_DEADLINE) {
        generateCampaignTarget(state, config)
      } else {
        if (!state.isGameOver) {
          state.phase = getNextInterDeadlinePhase(state.phase, state.deadline, config)
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
        state.phase = getNextInterDeadlinePhase(state.phase, state.deadline, config)
      }
      return { success: true }
    }

    case 'RESOLVE_RAID_DEFENSE': {
      const playerPower = calculateMilitaryPower(state, config)
      const quota = config.quotas.find((q) => q.deadline === state.deadline) ?? config.quotas[0]!
      const raidPower = composeThreatPower(
        state,
        Math.round(config.balance.RAID_POWER_QUOTA_SHARE * quota.military),
      )
      const strongholdCount = state.provinceBiomes.filter((b) => b === 'stronghold').length
      const tributeCost = getThreatTributeAp(
        quota.apRate,
        config.balance.THREAT_TRIBUTE_QUOTA_SECONDS,
      )
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
