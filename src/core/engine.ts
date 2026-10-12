/**
 * Core Headless Simulation Engine & Royal Auditor.
 * Executes fixed or variable delta-time physics and state transitions.
 * Pure TypeScript, zero DOM/Vue dependencies.
 *
 * @module core/engine
 */

import {
  BALANCE,
  UNITS_DATA,
  DEADLINE_QUOTAS,
  type UnitId,
} from '@/data/balance'
import {
  refillTokenBucket,
  calculateHousingCapacity,
  calculateLogisticGrowth,
  calculateCollectorYield,
  calculatePaperworkFriction,
  getUnrestCrisisStage,
} from './formulas'
import { composeStat, extractRawEvaluationState } from './modifiers'
import type {
  GameState,
  TickResult,
  AuditOutcome,
  DeadlineQuota,
} from './types'

/**
 * Calculates current total military combat power across active armed retinues.
 *
 * @param state - The active GameState.
 * @returns Total active military power.
 */
export function calculateMilitaryPower(state: GameState): number {
  let power = 0
  power += (state.units.soldier ?? 0) * 1.0
  power += (state.units.man_at_arms ?? 0) * 7.0

  // Multipliers from Sergeants (+1.5%) and Captains (+7.0%)
  const sergeantBonus = (state.units.sergeant ?? 0) * 0.015
  const captainBonus = (state.units.captain ?? 0) * 0.07
  power *= 1.0 + sergeantBonus + captainBonus

  const rawState = extractRawEvaluationState(state)
  const composedPower = composeStat('military_power', power, state.activeModifiers, rawState)

  return Math.round(composedPower * 10) / 10
}

/**
 * Evaluates the tri-metric Crown Audit at the conclusion of a deadline.
 * Enforces the Two-Out-Of-Three rule and the single Royal Pardon grace rule.
 *
 * @param state - The active GameState.
 * @param quotas - Optional calibrated quotas matrix (defaults to DEADLINE_QUOTAS).
 * @returns AuditOutcome summary.
 */
export function evaluateDeadlineAudit(
  state: GameState,
  quotas: readonly DeadlineQuota[] = DEADLINE_QUOTAS
): AuditOutcome {
  const quota = quotas.find((q) => q.deadline === state.deadline) ?? {
    deadline: state.deadline,
    ap: 500 * state.deadline,
    pop: 150 + 50 * state.deadline,
    military: 15 * state.deadline,
  }

  const apMet = state.cumulativeApThisDeadline >= quota.ap
  const popMet = state.totalPopulation >= quota.pop
  const militaryPower = calculateMilitaryPower(state)
  const militaryMet = militaryPower >= quota.military

  const passedCount = (apMet ? 1 : 0) + (popMet ? 1 : 0) + (militaryMet ? 1 : 0)
  const passedAudit = passedCount >= 2

  let royalPardonIssued = false
  let isGameOver = false
  let victory = false

  if (passedAudit) {
    if (state.deadline >= 10) {
      state.isGameOver = true
      state.isVictory = true
      state.phase = 'RUN_VICTORY'
      victory = true
      isGameOver = true
    } else {
      state.archivePoints += 1
    }
  } else {
    // Audit failed
    if (state.strikes === 0) {
      // Strike 1: Royal Censure (Confiscate 1 Province and 50% AP, respecting Province Floor)
      state.strikes = 1
      state.provinces = Math.max(
        BALANCE.PROVINCE_MIN_FLOOR_FOR_FINES,
        state.provinces - 1
      )
      state.ap *= 0.5
      royalPardonIssued = true
    } else {
      // Strike 2: Royal Execution
      state.strikes = 2
      state.isGameOver = true
      state.isVictory = false
      state.defeatReason = 'quota_failure'
      state.phase = 'RUN_DEFEAT'
      isGameOver = true
    }
  }

  return {
    deadline: state.deadline,
    apMet,
    popMet,
    militaryMet,
    passedCount,
    success: passedAudit,
    royalPardonIssued,
    isGameOver,
    victory,
  }
}

/**
 * Advances the simulation by delta-time dt seconds.
 * Pure state mutation, thread-safe, step-size invariant.
 *
 * @param state - The active mutable GameState.
 * @param dt - Delta time in seconds (e.g. 0.05 for 20 Hz, 1.0 for fast sim).
 * @returns TickResult metrics summary.
 */
export function tick(state: GameState, dt: number): TickResult {
  if (state.isPaused || state.isGameOver || state.phase !== 'ACTIVE_CYCLE') {
    return {
      dt: 0,
      grossApGenerated: 0,
      netApDelta: 0,
      netApPerSecond: 0,
      popGrowth: 0,
      paperworkFriction: 0,
      crisisStage: getUnrestCrisisStage(state.unrest),
      interimWarningTriggered: false,
      deadlineCompleted: false,
      isGameOver: state.isGameOver,
    }
  }

  state.tickIndex += 1
  const rawState = extractRawEvaluationState(state)

  // 1. Refill ergonomic click token bucket (12 tokens/s max)
  state.clickTokens = refillTokenBucket(state.clickTokens, dt)

  // 2. Tax promulgation delay processing (8s timer)
  if (state.pendingTaxRate !== null) {
    state.taxPromulgationTimer -= dt
    if (state.taxPromulgationTimer <= 0) {
      state.taxRate = state.pendingTaxRate
      state.pendingTaxRate = null
      state.taxPromulgationTimer = 0
    }
  }

  // 3. Demographics: Housing Capacity & Proportional Logistic Growth
  const baseHousing = calculateHousingCapacity(
    state.provinces,
    state.units.notable ?? 0,
    state.units.baron ?? 0
  )
  const maxPop = composeStat('housing_capacity', baseHousing, state.activeModifiers, rawState)

  const peasantRateBonus = (state.units.peasant ?? 0) * 0.0005
  const farmerRateBonus = (state.units.farmer ?? 0) * 0.003
  const baseGrowthRateR =
    BALANCE.BASE_POP_GROWTH_RATE_R + peasantRateBonus + farmerRateBonus
  const effectiveGrowthRateR = composeStat(
    'pop_growth_rate',
    baseGrowthRateR,
    state.activeModifiers,
    rawState
  )

  let popGrowthThisTick = 0
  const crisisStage = getUnrestCrisisStage(state.unrest)

  // Growth freezes during severe strife (crisisStage >= 'strife_desertion')
  const canGrow =
    state.totalPopulation < maxPop &&
    crisisStage !== 'strife_desertion' &&
    crisisStage !== 'urban_rebellion' &&
    crisisStage !== 'total_revolution'

  if (canGrow) {
    const growthPerSec = calculateLogisticGrowth(
      state.totalPopulation,
      maxPop,
      effectiveGrowthRateR,
      state.taxRate
    )
    popGrowthThisTick = growthPerSec * dt
    state.totalPopulation += popGrowthThisTick
    state.freeSerfs += popGrowthThisTick
  } else if (state.totalPopulation > maxPop) {
    // Housing crisis overcrowding bleed
    const bleed = Math.min(
      state.totalPopulation - maxPop,
      BALANCE.OVERCROWDING_BLEED_RATE * dt
    )
    state.totalPopulation -= bleed
    state.freeSerfs = Math.max(0, state.freeSerfs - bleed)
    state.unrest = Math.min(100, state.unrest + BALANCE.OVERCROWDING_UNREST_RATE * dt)
  }

  // 4. Bureaucracy Paperwork Inertia
  const archivistReduction =
    (state.units.archivist ?? 0) * 0.015 + (state.units.audit_chamber ?? 0) * 0.065
  const basePaperwork = calculatePaperworkFriction(
    state.units,
    state.provinces,
    archivistReduction
  )
  const paperworkFriction = Math.min(
    0.99,
    Math.max(
      0,
      composeStat('paperwork_friction', basePaperwork, state.activeModifiers, rawState)
    )
  )

  // 5. AP Economics: Production, Upkeep & Friction Drag
  let grossApRate = 0

  // Scribes & Clerks
  const supervisorBonus = (state.units.supervisor ?? 0) * 0.02
  const stewardBonus = (state.units.provincial_steward ?? 0) * 0.09
  const adminMultiplier = 1.0 + supervisorBonus + stewardBonus

  // Urban rebellion halves administrative scribe/clerk production
  const rebellionFriction = crisisStage === 'urban_rebellion' ? 0.5 : 1.0

  grossApRate +=
    (state.units.scribe ?? 0) *
    UNITS_DATA.scribe.baseValue *
    adminMultiplier *
    rebellionFriction
  grossApRate +=
    (state.units.clerk ?? 0) *
    UNITS_DATA.clerk.baseValue *
    adminMultiplier *
    rebellionFriction

  // Collectors & Farmers-General (Non-quadratic yield with shared finite serf pool)
  const fgCount = state.units.farmer_general ?? 0
  const colCount = state.units.collector ?? 0
  const fgYield = calculateCollectorYield(
    fgCount,
    state.freeSerfs,
    UNITS_DATA.farmer_general.baseValue
  )
  const serfsUsedByFg = Math.min(
    state.freeSerfs,
    fgCount * BALANCE.SERFS_PER_COLLECTOR
  )
  const remainingSerfs = Math.max(0, state.freeSerfs - serfsUsedByFg)
  const colYield = calculateCollectorYield(
    colCount,
    remainingSerfs,
    UNITS_DATA.collector.baseValue
  )
  grossApRate += fgYield + colYield

  // Baseline poll tax from free serfs
  // Fiscal boycott applies whenever Unrest >= 50%
  const fiscalBoycottPenalty = state.unrest >= 50 ? 0.8 : 1.0
  const baseArtisanTaxBonus =
    1.0 + (state.units.artisan ?? 0) * 0.005 + (state.units.guild ?? 0) * 0.035
  const taxEfficiencyMultiplier = composeStat(
    'tax_efficiency',
    baseArtisanTaxBonus,
    state.activeModifiers,
    rawState
  )
  const taxYieldPerSec =
    state.freeSerfs *
    BALANCE.TAX_POLL_RATE *
    (state.taxRate / 25) *
    taxEfficiencyMultiplier *
    fiscalBoycottPenalty
  grossApRate += taxYieldPerSec

  // Apply global gross_ap_rate modifiers
  grossApRate = composeStat(
    'gross_ap_rate',
    grossApRate,
    state.activeModifiers,
    rawState
  )

  // Upkeep costs
  let totalUpkeep = 0
  for (const [id, count] of Object.entries(state.units) as [UnitId, number][]) {
    if (count <= 0) continue
    const def = UNITS_DATA[id]
    if (def && def.upkeepAp > 0) {
      let unitUpkeep = def.upkeepAp
      // Military upkeep mitigations
      if (def.order === 'military') {
        const qmDiscount = (state.units.quartermaster ?? 0) * 0.015
        const gmDiscount = (state.units.grand_marshal ?? 0) * 0.07
        unitUpkeep *= Math.max(0.2, 1.0 - qmDiscount - gmDiscount)
      }
      totalUpkeep += count * unitUpkeep
    }
  }

  // Net AP Calculation
  const netApPerSecond = grossApRate * (1.0 - paperworkFriction) - totalUpkeep
  const netApDelta = netApPerSecond * dt
  state.ap += netApDelta

  const grossApThisTick = grossApRate * dt
  state.cumulativeApThisDeadline += grossApThisTick
  state.totalCumulativeAp += grossApThisTick

  // 6. Public Discontent (Unrest) Dynamics
  let unrestDeltaPerSec = 0
  if (state.taxRate > 25) {
    unrestDeltaPerSec += ((state.taxRate - 25) / 10) * 0.05
  }
  // Clergy & Prelate continuous pacification
  unrestDeltaPerSec -= (state.units.clergy ?? 0) * 0.02
  unrestDeltaPerSec -= (state.units.prelate ?? 0) * 0.15

  state.unrest = Math.max(0, Math.min(100, state.unrest + unrestDeltaPerSec * dt))

  // Revolution Defeat Check
  if (state.unrest >= 100) {
    state.isGameOver = true
    state.defeatReason = 'revolution'
    state.phase = 'RUN_DEFEAT'
  }

  // 7. Bankruptcy Countdown & Lombard Bailout Offer
  if (state.ap <= 0 && netApPerSecond < 0) {
    if (state.phase === 'ACTIVE_CYCLE') {
      state.bankruptcyGraceTimer -= dt
      if (state.bankruptcyGraceTimer <= 20.0 && state.lombardBailoutAvailable) {
        state.phase = 'LOMBARD_OFFER'
      }
      if (state.bankruptcyGraceTimer <= 0) {
        state.isGameOver = true
        state.defeatReason = 'bankruptcy'
        state.phase = 'RUN_DEFEAT'
      }
    }
  } else if (state.ap > 0) {
    state.bankruptcyGraceTimer = 30.0
  }

  // 8. Deadline Timing & Interim Warnings (Active Governance)
  let interimWarningTriggered = false
  let deadlineCompleted = false

  if (state.phase === 'ACTIVE_CYCLE') {
    state.deadlineTimeSeconds += dt
    state.totalElapsedSeconds += dt

    if (state.deadlineTimeSeconds >= 50.0 && !state.interimWarningShown) {
      state.interimWarningShown = true
      interimWarningTriggered = true
    }

    if (state.deadlineTimeSeconds >= 100.0) {
      deadlineCompleted = true
      state.phase = 'AUDIT_ASSESSMENT'
      evaluateDeadlineAudit(state)
    }
  }

  // 9. Conquest Defeat Check
  if (state.provinces <= 0) {
    state.isGameOver = true
    state.defeatReason = 'conquest'
    state.phase = 'RUN_DEFEAT'
  }

  return {
    dt,
    grossApGenerated: grossApThisTick,
    netApDelta,
    netApPerSecond,
    popGrowth: popGrowthThisTick,
    paperworkFriction,
    crisisStage,
    interimWarningTriggered,
    deadlineCompleted,
    isGameOver: state.isGameOver,
  }
}
