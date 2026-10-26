/**
 * Core Headless Simulation Engine & Royal Auditor.
 * Executes fixed or variable delta-time physics and state transitions.
 * Pure TypeScript, zero DOM/Vue dependencies.
 *
 * @module core/engine
 */

import { UNITS_DATA, BIOMES_DATA, type UnitId } from '@/data/balance'
import {
  refillTokenBucket,
  calculateHousingCapacity,
  calculateLogisticGrowth,
  calculateCollectorYield,
  calculatePaperworkFriction,
  getUnrestCrisisStage,
  recordPeakPopulation,
} from './formulas'
import { getHousingBase, removeLastProvince } from './provinces'
import {
  calculateBankruptcyGraceSeconds,
  composeStat,
  composeUnitStat,
  extractRawEvaluationState,
} from './modifiers'
import { hasRule } from './rules'
import { triggerDefeat, addUnrest, applyPopulationLoss, removeUnits } from './mutations'
import type { GameState, Modifier, TickResult, AuditOutcome, UnitBalanceDef } from './types'
import { DEFAULT_ENGINE_CONFIG, type EngineConfig } from './config'
import { withStatePrng } from './prng'

/**
 * Calculates current total military combat power across active armed retinues.
 *
 * @param state - The active GameState.
 * @param config - Engine configuration (defaults to DEFAULT_ENGINE_CONFIG).
 * @returns Total active military power.
 */
export function calculateMilitaryPower(
  state: GameState,
  config: EngineConfig = DEFAULT_ENGINE_CONFIG,
): number {
  let power = 0
  power += (state.units.soldier ?? 0) * UNITS_DATA.soldier.baseValue
  power += (state.units.man_at_arms ?? 0) * UNITS_DATA.man_at_arms.baseValue

  // Multipliers from Sergeants and Captains, scaled by Officer Academies
  const officerFactor = hasRule(state, 'law:officer_academies')
    ? config.balance.OFFICER_ACADEMIES_BONUS_FACTOR
    : 1
  const sergeantBonus = (state.units.sergeant ?? 0) * UNITS_DATA.sergeant.baseValue * officerFactor
  const captainBonus = (state.units.captain ?? 0) * UNITS_DATA.captain.baseValue * officerFactor
  power *= 1.0 + sergeantBonus + captainBonus

  const rawState = extractRawEvaluationState(state)
  const composedPower = composeStat('military_power', power, state.activeModifiers, rawState)

  return Math.round(composedPower * 10) / 10
}

/**
 * Calculates current instantaneous gross AP production rate and its poll tax component.
 *
 * @param state - Current GameState.
 * @param config - Balance configuration.
 * @returns Total gross AP rate per second and the poll tax subcomponent.
 */
export function calculateGrossApRate(
  state: GameState,
  config: EngineConfig = DEFAULT_ENGINE_CONFIG,
): { total: number; pollTax: number } {
  const rawState = extractRawEvaluationState(state)
  const crisisStage = getUnrestCrisisStage(state.unrest, config)

  let grossApRate = 0

  // Scribes & Clerks
  const output = (id: UnitId, base: number): number =>
    composeUnitStat('unit_output', base, UNITS_DATA[id], state.activeModifiers, rawState)
  const supervisorBonus =
    (state.units.supervisor ?? 0) * output('supervisor', UNITS_DATA.supervisor.baseValue)
  const stewardBonus =
    (state.units.provincial_steward ?? 0) *
    output('provincial_steward', UNITS_DATA.provincial_steward.baseValue)
  const adminMultiplier = 1.0 + supervisorBonus + stewardBonus

  // Urban rebellion halves administrative scribe/clerk production
  const rebellionFriction =
    crisisStage === 'urban_rebellion' ? config.balance.URBAN_REBELLION_PRODUCTION_FACTOR : 1.0

  grossApRate +=
    (state.units.scribe ?? 0) *
    output('scribe', UNITS_DATA.scribe.baseValue) *
    adminMultiplier *
    rebellionFriction
  grossApRate +=
    (state.units.clerk ?? 0) *
    output('clerk', UNITS_DATA.clerk.baseValue) *
    adminMultiplier *
    rebellionFriction

  // Collectors & Farmers-General (Non-quadratic yield with shared finite serf pool)
  const fgCount = state.units.farmer_general ?? 0
  const colCount = state.units.collector ?? 0
  const fgYield = calculateCollectorYield(
    fgCount,
    state.freeSerfs,
    UNITS_DATA.farmer_general.baseValue,
    config,
  )
  const serfsUsedByFg = Math.min(state.freeSerfs, fgCount * config.balance.SERFS_PER_COLLECTOR)
  const remainingSerfs = Math.max(0, state.freeSerfs - serfsUsedByFg)
  const colYield = calculateCollectorYield(
    colCount,
    remainingSerfs,
    UNITS_DATA.collector.baseValue,
    config,
  )
  grossApRate += fgYield + colYield

  // Baseline poll tax from free serfs
  // Fiscal boycott applies whenever Unrest >= 50%
  const fiscalBoycottPenalty =
    state.unrest >= config.balance.UNREST_FISCAL_BOYCOTT_THRESHOLD
      ? config.balance.FISCAL_BOYCOTT_TAX_FACTOR
      : 1.0
  const biomeMods = getBiomeModifiers(state)
  const baseArtisanTaxBonus =
    1.0 +
    (state.units.artisan ?? 0) * UNITS_DATA.artisan.baseValue +
    (state.units.guild ?? 0) * UNITS_DATA.guild.baseValue +
    biomeMods.taxEfficiencyBonus
  const taxEfficiencyMultiplier = composeStat(
    'tax_efficiency',
    baseArtisanTaxBonus,
    state.activeModifiers,
    rawState,
  )
  const pollTax =
    state.freeSerfs *
    config.balance.TAX_POLL_RATE *
    (state.taxRate / config.balance.TAX_REFERENCE_RATE) *
    taxEfficiencyMultiplier *
    fiscalBoycottPenalty
  grossApRate += pollTax

  // Apply global gross_ap_rate modifiers
  const total = composeStat('gross_ap_rate', grossApRate, state.activeModifiers, rawState)

  return { total, pollTax }
}

/**
 * Calculates the total AP upkeep per second of the realm.
 *
 * Each unit type pays its `upkeepAp` (military units after the quartermaster and grand marshal
 * discount, floor 20%) composed with its scoped `unit_upkeep` modifiers, times its count; the
 * `flat_upkeep` stat (base 0) is added. The total is clamped at 0.
 *
 * @param state - Current GameState.
 * @param config - Balance configuration.
 * @returns Total upkeep in AP per second, never below 0.
 */
export function calculateUpkeep(
  state: GameState,
  config: EngineConfig = DEFAULT_ENGINE_CONFIG,
): number {
  const rawState = extractRawEvaluationState(state)
  const flatUpkeep = composeStat('flat_upkeep', 0, state.activeModifiers, rawState)
  return Math.max(0, sumUnitUpkeep(state, config, () => true) + flatUpkeep)
}

/**
 * Calculates the AP upkeep per second paid by military units alone, exactly as `calculateUpkeep`
 * charges it (quartermaster and grand marshal discount, scoped `unit_upkeep` modifiers). The
 * `flat_upkeep` stat belongs to no unit and is not included.
 *
 * @param state - Current GameState.
 * @param config - Balance configuration.
 * @returns Military upkeep in AP per second, never below 0.
 */
export function calculateMilitaryUpkeep(
  state: GameState,
  config: EngineConfig = DEFAULT_ENGINE_CONFIG,
): number {
  return sumUnitUpkeep(state, config, (def) => def.order === 'military')
}

/** Sums count times upkeep over the unit types accepted by `include` (units only, no flat stat). */
function sumUnitUpkeep(
  state: GameState,
  config: EngineConfig,
  include: (def: UnitBalanceDef) => boolean,
): number {
  const rawState = extractRawEvaluationState(state)
  let totalUpkeep = 0
  for (const [id, count] of Object.entries(state.units) as [UnitId, number][]) {
    if (count <= 0) continue
    const def = UNITS_DATA[id]
    if (!def || !include(def)) continue
    let unitUpkeep = def.upkeepAp
    if (def.order === 'military' && unitUpkeep > 0) {
      const qmDiscount = (state.units.quartermaster ?? 0) * UNITS_DATA.quartermaster.baseValue
      const gmDiscount = (state.units.grand_marshal ?? 0) * UNITS_DATA.grand_marshal.baseValue
      unitUpkeep *= Math.max(
        config.balance.MILITARY_UPKEEP_MIN_FACTOR,
        1.0 - qmDiscount - gmDiscount,
      )
    }
    unitUpkeep = composeUnitStat('unit_upkeep', unitUpkeep, def, state.activeModifiers, rawState)
    if (unitUpkeep > 0) totalUpkeep += count * unitUpkeep
  }
  return totalUpkeep
}

/**
 * Calculates the net AP rate per second: gross rate after paperwork friction, minus upkeep.
 *
 * @param state - Current GameState.
 * @param config - Balance configuration.
 * @returns Net AP per second (negative when upkeep exceeds production).
 */
export function calculateNetApRate(
  state: GameState,
  config: EngineConfig = DEFAULT_ENGINE_CONFIG,
): number {
  return calculateApEconomy(state, config).netApPerSecond
}

/** Gross rate, paperwork friction, upkeep and net rate, each evaluated once (shared by tick). */
function calculateApEconomy(
  state: GameState,
  config: EngineConfig,
): { grossApRate: number; paperworkFriction: number; upkeep: number; netApPerSecond: number } {
  const paperworkFriction = calculateNetPaperwork(state, config)
  const { total: grossApRate } = calculateGrossApRate(state, config)
  const upkeep = calculateUpkeep(state, config)
  const netApPerSecond = grossApRate * (1.0 - paperworkFriction) - upkeep
  return { grossApRate, paperworkFriction, upkeep, netApPerSecond }
}

/** Aggregated biome trait bonuses across all controlled provinces. */
export interface AggregatedBiomeModifiers {
  deltaR: number
  taxEfficiencyBonus: number
  passiveDefense: number
  paperworkReduction: number
}

/**
 * Aggregates all biome traits across currently controlled provinces.
 *
 * @param state - Current GameState.
 * @returns Aggregated biome modifiers.
 */
export function getBiomeModifiers(state: GameState): AggregatedBiomeModifiers {
  let totalDeltaR = 0
  let totalTaxEfficiency = 0
  let totalPassiveDefense = 0
  let totalPaperworkReduction = 0

  for (const biomeId of state.provinceBiomes) {
    const def = BIOMES_DATA[biomeId]
    totalDeltaR += def.deltaR
    totalTaxEfficiency += def.taxEfficiencyBonus
    totalPassiveDefense += def.passiveDefense
    totalPaperworkReduction += def.paperworkReduction
  }

  return {
    deltaR: totalDeltaR,
    taxEfficiencyBonus: totalTaxEfficiency,
    passiveDefense: totalPassiveDefense,
    paperworkReduction: totalPaperworkReduction,
  }
}

/**
 * Calculates current maximum population capacity, integrating Notables, Barons, biomes, and modifiers.
 *
 * @param state - Current GameState.
 * @param config - Injected engine configuration.
 * @returns Maximum living population capacity.
 */
export function calculateMaxPopulation(
  state: GameState,
  config: EngineConfig = DEFAULT_ENGINE_CONFIG,
): number {
  const baseHousing = calculateHousingCapacity(
    getHousingBase(state, config),
    state.units.notable ?? 0,
    state.units.baron ?? 0,
  )
  const rawState = extractRawEvaluationState(state)
  return composeStat('housing_capacity', baseHousing, state.activeModifiers, rawState)
}

/**
 * Calculates current net bureaucratic paperwork friction drag [0, 0.99].
 *
 * @param state - Current GameState.
 * @param config - Injected engine configuration.
 * @returns Net paperwork friction drag.
 */
export function calculateNetPaperwork(
  state: GameState,
  config: EngineConfig = DEFAULT_ENGINE_CONFIG,
): number {
  const biomeMods = getBiomeModifiers(state)
  const rawState = extractRawEvaluationState(state)
  const output = (id: UnitId, base: number): number =>
    composeUnitStat('unit_output', base, UNITS_DATA[id], state.activeModifiers, rawState)
  const archivistReduction =
    (state.units.archivist ?? 0) * output('archivist', UNITS_DATA.archivist.baseValue) +
    (state.units.audit_chamber ?? 0) * output('audit_chamber', UNITS_DATA.audit_chamber.baseValue) +
    biomeMods.paperworkReduction

  const basePaperwork = calculatePaperworkFriction(
    state.units,
    state.provinces,
    archivistReduction,
    config,
  )

  return Math.min(
    config.balance.PAPERWORK_FRICTION_MAX,
    Math.max(0, composeStat('paperwork_friction', basePaperwork, state.activeModifiers, rawState)),
  )
}

/** Quotas checked against a deadline quota: the three targets times `quota_requirement`. */
export interface EffectiveQuota {
  apRate: number
  pop: number
  military: number
}

/**
 * Scales a deadline quota by the `quota_requirement` stat (base 1, clamped at 0), as read by the
 * audit and by the 50 s interim projection.
 *
 * @param state - Current GameState.
 * @param quota - The quota to scale.
 * @param modifiers - Modifiers to compose (defaults to the active ones).
 */
export function effectiveQuota(
  state: GameState,
  quota: EffectiveQuota,
  modifiers: readonly Modifier[] = state.activeModifiers,
): EffectiveQuota {
  const requirement = Math.max(
    0,
    composeStat('quota_requirement', 1, modifiers, extractRawEvaluationState(state)),
  )
  return {
    apRate: quota.apRate * requirement,
    pop: quota.pop * requirement,
    military: quota.military * requirement,
  }
}

/** Quota of one upcoming deadline, as the audit will check it. */
export interface ForesightQuota extends EffectiveQuota {
  deadline: number
}

/**
 * Reads the quotas of the next upcoming deadlines for the royal chronicle (GAME_RULES §15).
 *
 * The count is the `quota_foresight_deadlines` stat (base 0, rounded down, 0 without the perk).
 * Upcoming deadlines start at the current one while it is not audited yet (active play, raid,
 * Lombard offer) and at the next one during the inter-deadline sequence; they stop at the last
 * deadline. The first deadline is the next audit and is scaled by `quota_requirement` as that audit
 * will read it now; later deadlines ignore the `untilNextAudit` modifiers, which expire before they
 * are audited.
 *
 * @param state - Current GameState.
 * @param config - Engine configuration (quotas).
 * @returns The upcoming quotas in deadline order, empty without the perk.
 */
export function getForesightQuotas(
  state: GameState,
  config: EngineConfig = DEFAULT_ENGINE_CONFIG,
): ForesightQuota[] {
  const count = Math.floor(
    composeStat(
      'quota_foresight_deadlines',
      0,
      state.activeModifiers,
      extractRawEvaluationState(state),
    ) + 1e-9,
  )
  if (count <= 0 || state.isGameOver) return []
  const unaudited =
    state.phase === 'ACTIVE_CYCLE' ||
    state.phase === 'SURPRISE_RAID' ||
    state.phase === 'LOMBARD_OFFER'
  const first = unaudited ? state.deadline : state.deadline + 1
  const lastingModifiers = state.activeModifiers.filter((mod) => !mod.untilNextAudit)
  return config.quotas
    .filter((quota) => quota.deadline >= first && quota.deadline < first + count)
    .map((quota) => ({
      deadline: quota.deadline,
      ...effectiveQuota(
        state,
        quota,
        quota.deadline === first ? state.activeModifiers : lastingModifiers,
      ),
    }))
}

/**
 * Evaluates the tri-metric Crown Audit at the conclusion of a deadline.
 * Enforces the Two-Out-Of-Three rule and the single Royal Pardon grace rule.
 *
 * The three quotas are multiplied by the `quota_requirement` stat (base 1, clamped at 0). With
 * `law_effect:pardon_forfeited` raised, a failed audit is a `quota_failure` defeat even with 0
 * strikes. After the outcome: `untilNextAudit` modifiers are removed, the pardon forfeiture flag is
 * cleared, Auditors' Inquisition adds 15 Unrest, and Exceptional Tithe adds 30 Unrest and leaves
 * the active laws and rule flags.
 *
 * @param state - The active GameState.
 * @param config - Optional engine configuration (defaults to DEFAULT_ENGINE_CONFIG).
 * @returns AuditOutcome summary.
 */
export function evaluateDeadlineAudit(
  state: GameState,
  config: EngineConfig = DEFAULT_ENGINE_CONFIG,
): AuditOutcome {
  const quotas = config.quotas
  const quota = quotas.find((q) => q.deadline === state.deadline) ?? quotas[quotas.length - 1]!

  const required = effectiveQuota(state, quota)
  const { total: grossApRate } = calculateGrossApRate(state, config)
  const apMet = grossApRate >= required.apRate
  const popMet = state.totalPopulation >= required.pop
  const militaryPower = calculateMilitaryPower(state, config)
  const militaryMet = militaryPower >= required.military
  const pardonForfeited = hasRule(state, 'law_effect:pardon_forfeited')

  const passedCount = (apMet ? 1 : 0) + (popMet ? 1 : 0) + (militaryMet ? 1 : 0)
  const passedAudit = passedCount >= config.balance.AUDIT_METRICS_REQUIRED

  let royalPardonIssued = false
  let isGameOver = false
  let victory = false

  if (passedAudit) {
    if (state.deadline >= config.balance.TOTAL_DEADLINES) {
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
    if (state.strikes >= 1 || state.deadline >= config.balance.TOTAL_DEADLINES || pardonForfeited) {
      // Strike 2, Deadline 10 or forfeited pardon: Royal Execution / Quota Failure
      state.strikes = Math.min(config.balance.MAX_STRIKES, state.strikes + 1)
      triggerDefeat(state, 'quota_failure')
      isGameOver = true
    } else {
      // Strike 1 (Deadlines 1-9): Royal Censure
      state.strikes = 1
      if (state.provinces > config.balance.PROVINCE_MIN_FLOOR_FOR_FINES) {
        removeLastProvince(state)
      }
      // Confiscate 50% of POSITIVE AP (never divide a debt by 2)
      if (state.ap > 0) {
        state.ap -= state.ap * config.balance.ROYAL_CENSURE_AP_CONFISCATION
      }
      royalPardonIssued = true
    }
  }

  applyAuditAftermath(state, config)

  const outcome: AuditOutcome = {
    deadline: state.deadline,
    apMet,
    popMet,
    militaryMet,
    passedCount,
    success: passedAudit,
    royalPardonIssued,
    isGameOver: isGameOver || state.isGameOver,
    victory,
    grossApRate,
  }
  state.lastAuditOutcome = outcome
  return outcome
}

/** Audit scoped effects resolved right after an audit, whatever its outcome. */
function applyAuditAftermath(state: GameState, config: EngineConfig): void {
  state.activeModifiers = state.activeModifiers.filter((mod) => mod.untilNextAudit !== true)
  state.ruleFlags = state.ruleFlags.filter((flag) => flag !== 'law_effect:pardon_forfeited')
  if (hasRule(state, 'law:auditors_inquisition')) {
    addUnrest(state, config.balance.AUDITORS_INQUISITION_UNREST, config)
  }
  if (hasRule(state, 'law:exceptional_tithe')) {
    addUnrest(state, config.balance.EXCEPTIONAL_TITHE_UNREST, config)
    state.activeLaws = state.activeLaws.filter((id) => id !== 'law:exceptional_tithe')
    state.ruleFlags = state.ruleFlags.filter((flag) => flag !== 'law:exceptional_tithe')
    state.activeModifiers = state.activeModifiers.filter(
      (mod) => mod.source !== 'law:exceptional_tithe',
    )
  }
}

/**
 * Opens a deadline audit that was deferred because the deadline was reached during a crisis
 * (surprise raid or Lombard offer), so no command applies between the deadline and the audit.
 * Does nothing outside `ACTIVE_CYCLE`, after game over, or without a pending audit.
 *
 * @param state - The active GameState; moved to `AUDIT_ASSESSMENT` when an audit opens.
 * @param config - Engine configuration (defaults to DEFAULT_ENGINE_CONFIG).
 * @returns True when the deferred audit was evaluated.
 */
export function openDeferredDeadlineAudit(
  state: GameState,
  config: EngineConfig = DEFAULT_ENGINE_CONFIG,
): boolean {
  if (!state.pendingDeadlineAudit || state.isGameOver || state.phase !== 'ACTIVE_CYCLE') {
    return false
  }
  state.deadlineTimeSeconds = config.balance.DEADLINE_DURATION_SECONDS
  state.pendingDeadlineAudit = false
  state.phase = 'AUDIT_ASSESSMENT'
  evaluateDeadlineAudit(state, config)
  return true
}

/**
 * Reports whether the fast forward control is unlocked for the current deadline.
 * Fast forward unlocks from `FAST_FORWARD_MIN_DEADLINE` onward.
 *
 * @param state - The active GameState.
 * @param config - Engine configuration (defaults to DEFAULT_ENGINE_CONFIG).
 * @returns True when `state.deadline` reaches `FAST_FORWARD_MIN_DEADLINE`.
 */
export function isFastForwardUnlocked(
  state: GameState,
  config: EngineConfig = DEFAULT_ENGINE_CONFIG,
): boolean {
  return state.deadline >= config.balance.FAST_FORWARD_MIN_DEADLINE
}

/** Tolerance used when counting whole fixed steps in an accumulated duration. */
const STEP_EPSILON = 1e-9

/**
 * Advances the simulation by `dt` seconds in whole fixed steps of
 * `config.balance.FIXED_STEP_SECONDS`.
 *
 * `dt` is added to `state.tickRemainderSeconds`; the number of whole steps in that sum is counted
 * with a 1e-9 tolerance (so 20 x 0.05 and 1.0 both give 20 steps), the steps run one after the other,
 * and the part below one step is carried in `tickRemainderSeconds`. Game time, `tickIndex` and every
 * rate advance only by whole steps, so the result does not depend on how `dt` is split.
 *
 * When the state is paused, game over or not in `ACTIVE_CYCLE`, no step runs, `dt` is dropped and
 * the remainder is kept. When a step ends `ACTIVE_CYCLE` (audit, raid, Lombard offer, defeat), the
 * steps not yet run are dropped and the remainder is reset to 0. A non finite or non positive `dt`
 * adds no time.
 *
 * @param state - The active mutable GameState.
 * @param dt - Delta time in seconds (e.g. 0.05 for 20 Hz, 1.0 for fast sim).
 * @param config - Injected engine configuration.
 * @returns TickResult summed over the steps run (`dt` and `consumedDt` are the simulated seconds;
 *   `netApPerSecond`, `paperworkFriction` and `crisisStage` come from the last step).
 */
export function tick(
  state: GameState,
  dt: number,
  config: EngineConfig = DEFAULT_ENGINE_CONFIG,
): TickResult {
  const idle: TickResult = {
    dt: 0,
    consumedDt: 0,
    grossApGenerated: 0,
    netApDelta: 0,
    netApPerSecond: 0,
    popGrowth: 0,
    paperworkFriction: 0,
    crisisStage: getUnrestCrisisStage(state.unrest, config),
    interimWarningTriggered: false,
    deadlineCompleted: false,
    isGameOver: state.isGameOver,
  }
  if (state.isPaused || state.isGameOver || state.phase !== 'ACTIVE_CYCLE') {
    return idle
  }

  // A deadline already reached (e.g. deferred during a crisis) is audited without waiting a step
  if (
    state.pendingDeadlineAudit ||
    config.balance.DEADLINE_DURATION_SECONDS - state.deadlineTimeSeconds < STEP_EPSILON
  ) {
    return runFixedStep(state, config.balance.FIXED_STEP_SECONDS, config)
  }

  const step = config.balance.FIXED_STEP_SECONDS
  const added = Number.isFinite(dt) && dt > 0 ? dt : 0
  const available = state.tickRemainderSeconds + added
  const steps = Math.floor(available / step + STEP_EPSILON)
  state.tickRemainderSeconds = Math.max(0, available - steps * step)
  if (state.tickRemainderSeconds < STEP_EPSILON) {
    state.tickRemainderSeconds = 0
  }

  const total = { ...idle }
  for (let i = 0; i < steps; i++) {
    const result = runFixedStep(state, step, config)
    total.dt += result.dt
    total.grossApGenerated += result.grossApGenerated
    total.netApDelta += result.netApDelta
    total.popGrowth += result.popGrowth
    total.netApPerSecond = result.netApPerSecond
    total.paperworkFriction = result.paperworkFriction
    total.crisisStage = result.crisisStage
    total.interimWarningTriggered ||= result.interimWarningTriggered
    total.deadlineCompleted ||= result.deadlineCompleted
    if (state.isPaused || state.isGameOver || state.phase !== 'ACTIVE_CYCLE') {
      state.tickRemainderSeconds = 0
      break
    }
  }
  total.dt = snapToStepGrid(total.dt, step)
  total.consumedDt = total.dt
  total.isGameOver = state.isGameOver
  return total
}

/**
 * Removes the floating point drift of a value that moves by whole fixed steps: a value within
 * 1e-6 step of a multiple of the step is set to that multiple (computed as `k / stepsPerSecond`
 * when the step divides one second, so 666 steps of 0.05 give exactly 33.3). Other values are
 * returned unchanged.
 */
function snapToStepGrid(value: number, step: number): number {
  const k = Math.round(value / step)
  if (Math.abs(value / step - k) > 1e-6) return value
  const stepsPerSecond = Math.round(1 / step)
  if (stepsPerSecond > 0 && Math.abs(stepsPerSecond * step - 1) < STEP_EPSILON) {
    return k / stepsPerSecond
  }
  return k * step
}

/**
 * Runs one simulation step of `dt` seconds (the per-step formulas of `tick`).
 *
 * @param state - The active mutable GameState.
 * @param dt - Step length in seconds, normally `config.balance.FIXED_STEP_SECONDS`.
 * @param config - Injected engine configuration.
 * @returns TickResult of this step.
 */
function runFixedStep(state: GameState, dt: number, config: EngineConfig): TickResult {
  if (state.isPaused || state.isGameOver || state.phase !== 'ACTIVE_CYCLE') {
    return {
      dt: 0,
      consumedDt: 0,
      grossApGenerated: 0,
      netApDelta: 0,
      netApPerSecond: 0,
      popGrowth: 0,
      paperworkFriction: 0,
      crisisStage: getUnrestCrisisStage(state.unrest, config),
      interimWarningTriggered: false,
      deadlineCompleted: false,
      isGameOver: state.isGameOver,
    }
  }

  // Check pending audit before integrating new step
  if (
    state.pendingDeadlineAudit ||
    state.deadlineTimeSeconds >= config.balance.DEADLINE_DURATION_SECONDS ||
    config.balance.DEADLINE_DURATION_SECONDS - state.deadlineTimeSeconds < 1e-9
  ) {
    state.deadlineTimeSeconds = config.balance.DEADLINE_DURATION_SECONDS
    state.pendingDeadlineAudit = false
    state.phase = 'AUDIT_ASSESSMENT'
    evaluateDeadlineAudit(state, config)
    return {
      dt: 0,
      consumedDt: 0,
      grossApGenerated: 0,
      netApDelta: 0,
      netApPerSecond: 0,
      popGrowth: 0,
      paperworkFriction: 0,
      crisisStage: getUnrestCrisisStage(state.unrest, config),
      interimWarningTriggered: false,
      deadlineCompleted: true,
      isGameOver: state.isGameOver,
    }
  }

  // Bound stepDt to prevent deadline overshooting
  const stepDt = Math.min(
    dt,
    Math.max(0, config.balance.DEADLINE_DURATION_SECONDS - state.deadlineTimeSeconds),
  )
  if (stepDt <= 0 || config.balance.DEADLINE_DURATION_SECONDS - state.deadlineTimeSeconds < 1e-9) {
    state.deadlineTimeSeconds = config.balance.DEADLINE_DURATION_SECONDS
    state.phase = 'AUDIT_ASSESSMENT'
    evaluateDeadlineAudit(state, config)
    return {
      dt: 0,
      consumedDt: 0,
      grossApGenerated: 0,
      netApDelta: 0,
      netApPerSecond: 0,
      popGrowth: 0,
      paperworkFriction: 0,
      crisisStage: getUnrestCrisisStage(state.unrest, config),
      interimWarningTriggered: false,
      deadlineCompleted: true,
      isGameOver: state.isGameOver,
    }
  }

  const grid = config.balance.FIXED_STEP_SECONDS
  state.tickIndex += 1
  const prevDeadlineTime = state.deadlineTimeSeconds
  state.deadlineTimeSeconds = snapToStepGrid(state.deadlineTimeSeconds + stepDt, grid)
  if (config.balance.DEADLINE_DURATION_SECONDS - state.deadlineTimeSeconds < 1e-9) {
    state.deadlineTimeSeconds = config.balance.DEADLINE_DURATION_SECONDS
  }
  const stepStartSeconds = state.totalElapsedSeconds
  state.totalElapsedSeconds = snapToStepGrid(state.totalElapsedSeconds + stepDt, grid)

  // Purge modifiers expired at the step start, so a modifier covers its last step
  state.activeModifiers = state.activeModifiers.filter(
    (mod) => mod.expiresAt === undefined || mod.expiresAt > stepStartSeconds,
  )
  const rawState = extractRawEvaluationState(state)

  // Refill ergonomic click token bucket (12 tokens/s max)
  state.clickTokens = refillTokenBucket(state.clickTokens, stepDt, undefined, config)

  // Tax promulgation delay processing (8s timer)
  if (state.pendingTaxRate !== null) {
    state.taxPromulgationTimer = snapToStepGrid(state.taxPromulgationTimer - stepDt, grid)
    if (state.taxPromulgationTimer <= 0) {
      state.taxRate = state.pendingTaxRate
      state.pendingTaxRate = null
      state.taxPromulgationTimer = 0
    }
  }

  if (state.taxRate > config.balance.TAX_PLEDGE_RATE_LIMIT) {
    state.taxRateViolated15 = true
  }

  // Forced tithe growth freeze countdown (20s timer)
  if (state.forcedTitheFreezeTimer > 0) {
    state.forcedTitheFreezeTimer = Math.max(
      0,
      snapToStepGrid(state.forcedTitheFreezeTimer - stepDt, grid),
    )
  }

  // Demographics: Housing Capacity & Proportional Logistic Growth
  const maxPop = calculateMaxPopulation(state, config)
  const biomeMods = getBiomeModifiers(state)

  const peasantRateBonus = (state.units.peasant ?? 0) * UNITS_DATA.peasant.baseValue
  const farmerRateBonus = (state.units.farmer ?? 0) * UNITS_DATA.farmer.baseValue
  const baseGrowthRateR =
    config.balance.BASE_POP_GROWTH_RATE_R + peasantRateBonus + farmerRateBonus + biomeMods.deltaR
  const effectiveGrowthRateR = composeStat(
    'pop_growth_rate',
    baseGrowthRateR,
    state.activeModifiers,
    rawState,
  )

  let popGrowthThisTick = 0
  const crisisStage = getUnrestCrisisStage(state.unrest, config)

  const isOvercrowded = state.totalPopulation >= maxPop
  const hasParishRelief = hasRule(state, 'law:parish_relief_registers')
  const canGrow =
    (!isOvercrowded || hasParishRelief) &&
    crisisStage !== 'strife_desertion' &&
    crisisStage !== 'urban_rebellion' &&
    crisisStage !== 'total_revolution' &&
    state.forcedTitheFreezeTimer <= 0

  const initialExcessPop = Math.max(0, state.totalPopulation - maxPop)

  if (canGrow) {
    const growthPerSec = calculateLogisticGrowth(
      state.totalPopulation,
      maxPop,
      effectiveGrowthRateR,
      state.taxRate,
      config,
    )
    // Flat growth stops at the housing cap, except under Parish Relief Registers
    const flatPerSec = Math.max(
      0,
      composeStat('pop_growth_flat', 0, state.activeModifiers, rawState),
    )
    let flatGrowth = flatPerSec * stepDt
    if (!hasParishRelief) {
      flatGrowth = Math.min(
        flatGrowth,
        Math.max(0, maxPop - state.totalPopulation - growthPerSec * stepDt),
      )
    }
    popGrowthThisTick = growthPerSec * stepDt + flatGrowth
    state.totalPopulation += popGrowthThisTick
    state.freeSerfs += popGrowthThisTick
  }
  if (initialExcessPop > 0) {
    // Housing crisis overcrowding bleed
    const bleed = Math.min(initialExcessPop, config.balance.OVERCROWDING_BLEED_RATE * stepDt)
    applyPopulationLoss(state, bleed, true)
  }

  // AP Economics: Production, Paperwork Friction Drag & Upkeep
  const { paperworkFriction, grossApRate, netApPerSecond } = calculateApEconomy(state, config)
  const netApDelta = netApPerSecond * stepDt
  state.ap += netApDelta

  const grossApThisTick = grossApRate * stepDt
  state.cumulativeApThisDeadline += grossApThisTick
  state.totalCumulativeAp += grossApThisTick

  // Public Discontent (Unrest) Dynamics & Dual-Stat Composition
  const taxReference = config.balance.TAX_REFERENCE_RATE
  let taxUnrestRate =
    state.taxRate > taxReference
      ? ((state.taxRate - taxReference) / config.balance.TAX_UNREST_STEP_PERCENT) *
        config.balance.TAX_UNREST_PER_STEP
      : 0
  const prelateCount = state.units.prelate ?? 0
  if (taxUnrestRate > 0 && prelateCount > 0) {
    const prelateDiscount = Math.min(
      config.balance.PRELATE_TAX_UNREST_DISCOUNT_MAX,
      prelateCount * config.balance.PRELATE_TAX_UNREST_DISCOUNT,
    )
    taxUnrestRate *= 1.0 - prelateDiscount
  }
  const overcrowdingUnrestRate =
    initialExcessPop > 0
      ? Math.min(
          config.balance.OVERCROWDING_UNREST_MAX,
          config.balance.OVERCROWDING_UNREST_RATE *
            (initialExcessPop / config.balance.OVERCROWDING_EXCESS_POP_SCALE),
        )
      : 0
  const baseUnrestGen = taxUnrestRate + overcrowdingUnrestRate
  const composedGen = Math.max(
    0,
    composeStat('unrest_generation', baseUnrestGen, state.activeModifiers, rawState),
  )

  const baseUnrestPac =
    (state.units.clergy ?? 0) * UNITS_DATA.clergy.baseValue +
    (state.units.prelate ?? 0) *
      composeUnitStat(
        'unit_output',
        UNITS_DATA.prelate.baseValue,
        UNITS_DATA.prelate,
        state.activeModifiers,
        rawState,
      )
  const composedPac = Math.max(
    0,
    composeStat('unrest_pacification', baseUnrestPac, state.activeModifiers, rawState),
  )

  addUnrest(state, (composedGen - composedPac) * stepDt, config)

  // Military Desertion (§6.5, Arbitrage 1.0 §2)
  const hasSanctuaryRights = hasRule(state, 'law:sanctuary_rights')
  const isDesertionActive =
    state.unrest >= config.balance.UNREST_STRIFE_DESERTION_THRESHOLD &&
    !(hasSanctuaryRights && state.unrest < config.balance.UNREST_URBAN_REBELLION_THRESHOLD)

  const getEligibleDesertion = (
    s: GameState,
  ): { unitId: 'soldier' | 'man_at_arms'; threshold: number } | null => {
    if ((s.units.soldier ?? 0) > 0)
      return { unitId: 'soldier', threshold: config.balance.DESERTION_INTERVAL_SOLDIER_SECONDS }
    if ((s.units.man_at_arms ?? 0) > 0)
      return {
        unitId: 'man_at_arms',
        threshold: config.balance.DESERTION_INTERVAL_MAN_AT_ARMS_SECONDS,
      }
    return null
  }

  let eligible = getEligibleDesertion(state)
  if (!isDesertionActive || !eligible) {
    state.desertionTimer = 0
  } else {
    state.desertionTimer = snapToStepGrid(state.desertionTimer + stepDt, grid)
    while (eligible && state.desertionTimer >= eligible.threshold) {
      state.desertionTimer -= eligible.threshold
      removeUnits(state, eligible.unitId, 1)
      eligible = getEligibleDesertion(state)
    }
    if (!eligible) {
      state.desertionTimer = 0
    }
  }

  // Bankruptcy Countdown & Lombard Bailout Offer
  if (state.ap <= 0 && netApPerSecond < 0) {
    if (state.phase === 'ACTIVE_CYCLE') {
      state.bankruptcyGraceTimer = snapToStepGrid(state.bankruptcyGraceTimer - stepDt, grid)
      // Lombard bailout offer only available if provinces >= 2 (§14.4, arbitrage 1.0 §11)
      if (
        state.bankruptcyGraceTimer <= config.balance.LOMBARD_OFFER_REMAINING_SECONDS &&
        state.lombardBailoutAvailable &&
        state.provinces >= config.balance.LOMBARD_MIN_PROVINCES
      ) {
        state.phase = 'LOMBARD_OFFER'
      }
      if (state.bankruptcyGraceTimer <= 0) {
        triggerDefeat(state, 'bankruptcy')
      }
    }
  } else if (state.ap > 0) {
    state.bankruptcyGraceTimer = calculateBankruptcyGraceSeconds(state, config)
  }

  // Spontaneous Surprise Border Raids (GAME_RULES §8.3)
  if (
    state.phase === 'ACTIVE_CYCLE' &&
    !state.isGameOver &&
    state.deadline >= config.balance.SURPRISE_RAID_MIN_DEADLINE &&
    !state.surpriseRaidTriggeredThisDeadline &&
    state.totalElapsedSeconds - state.lastSurpriseRaidTime >=
      config.balance.SURPRISE_RAID_COOLDOWN_SECONDS &&
    Math.floor(prevDeadlineTime / config.balance.SURPRISE_RAID_CHECK_INTERVAL_SECONDS) <
      Math.floor(state.deadlineTimeSeconds / config.balance.SURPRISE_RAID_CHECK_INTERVAL_SECONDS)
  ) {
    const quota = config.quotas.find((q) => q.deadline === state.deadline) ?? config.quotas[0]!
    const milPower = calculateMilitaryPower(state, config)
    const p =
      config.balance.RAID_BASE_PROBABILITY *
        (state.ap > config.balance.RAID_WEALTH_THRESHOLD_AP
          ? config.balance.RAID_WEALTH_MULTIPLIER
          : 1) +
      (milPower < config.balance.RAID_WEAK_ARMY_RATIO * quota.military
        ? config.balance.RAID_WEAK_ARMY_PROBABILITY
        : 0) +
      (state.unrest > config.balance.RAID_UNREST_THRESHOLD
        ? config.balance.RAID_UNREST_PROBABILITY
        : 0)

    const raidTriggered = withStatePrng(state, 'events', (prng) => prng.next() < p)
    if (raidTriggered) {
      state.phase = 'SURPRISE_RAID'
      state.surpriseRaidTriggeredThisDeadline = true
      state.lastSurpriseRaidTime = state.totalElapsedSeconds
    }
  }

  // Deadline Timing & Interim Warnings (Active Governance)
  let interimWarningTriggered = false
  let deadlineCompleted = false

  if (
    state.deadlineTimeSeconds >= config.balance.INTERIM_AUDIT_WARNING_SECONDS &&
    !state.interimWarningShown
  ) {
    state.interimWarningShown = true
    interimWarningTriggered = true

    // Compute 2-out-of-3 on-track status comparing to deadline quotas
    const quota = effectiveQuota(
      state,
      config.quotas.find((q) => q.deadline === state.deadline) ?? config.quotas[0]!,
    )
    const apOnTrack = grossApRate >= quota.apRate
    const popOnTrack = state.totalPopulation >= quota.pop
    const milOnTrack = calculateMilitaryPower(state, config) >= quota.military
    const onTrackCount = (apOnTrack ? 1 : 0) + (popOnTrack ? 1 : 0) + (milOnTrack ? 1 : 0)
    state.interimWarningOnTrack = onTrackCount >= config.balance.AUDIT_METRICS_REQUIRED
  }

  if (
    state.deadlineTimeSeconds >= config.balance.DEADLINE_DURATION_SECONDS ||
    config.balance.DEADLINE_DURATION_SECONDS - state.deadlineTimeSeconds < 1e-9
  ) {
    state.deadlineTimeSeconds = config.balance.DEADLINE_DURATION_SECONDS
    deadlineCompleted = true
    if (state.phase === 'ACTIVE_CYCLE') {
      state.phase = 'AUDIT_ASSESSMENT'
      evaluateDeadlineAudit(state, config)
    } else {
      // Mid-crisis phase (SURPRISE_RAID, LOMBARD_OFFER): defer audit execution
      state.pendingDeadlineAudit = true
    }
  }

  // Conquest Defeat Check
  if (state.provinces <= 0) {
    triggerDefeat(state, 'conquest')
  }

  recordPeakPopulation(state)

  return {
    dt: stepDt,
    consumedDt: stepDt,
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
