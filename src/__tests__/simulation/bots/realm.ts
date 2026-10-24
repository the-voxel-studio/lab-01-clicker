/**
 * Read-only realm helpers shared by the bots: quotas, recruitment checks and what-if views.
 *
 * Every helper reads public state through public engine functions, composing the active modifiers
 * as the engine does. A what-if view is a shallow copy with a few fields changed; the real state is
 * never mutated.
 *
 * @module __tests__/simulation/bots/realm
 */

import { UNITS_DATA, type UnitId, type UnitOrder } from '@/data/balance'
import type { GameState } from '@/core/types'
import type { EngineConfig } from '@/core/config'
import {
  calculateGrossApRate,
  calculateMaxPopulation,
  calculateMilitaryPower,
  calculateNetApRate,
  effectiveQuota,
  getBiomeModifiers,
  type EffectiveQuota,
} from '@/core/engine'
import {
  calculateColonisationCost,
  calculateFiscalFactor,
  calculateOrderCaps,
  calculateUnitCost,
  getMaxBulkSize,
  getUnrestCrisisStage,
} from '@/core/formulas'
import { composeStat, extractRawEvaluationState } from '@/core/modifiers'
import { hasRule } from '@/core/rules'

/** Every unit identifier, in catalog order. */
export const UNIT_IDS: readonly UnitId[] = Object.values(UNITS_DATA).map((def) => def.id)

/** The three orders, in patent priority order. */
export const ORDERS: readonly UnitOrder[] = ['admin', 'military', 'people']

/** Quota of the current deadline as the next audit checks it (the only quota a player sees). */
export function currentQuota(state: Readonly<GameState>, config: EngineConfig): EffectiveQuota {
  const quota = config.quotas.find((q) => q.deadline === state.deadline)
  if (!quota) throw new Error(`Bot: no quota for deadline ${state.deadline}.`)
  return effectiveQuota(state, quota)
}

/** Head count of an order, optionally restricted to one tier. */
export function orderCount(state: Readonly<GameState>, order: UnitOrder, tier?: 1 | 2): number {
  let total = 0
  for (const id of UNIT_IDS) {
    const def = UNITS_DATA[id]
    if (def.order === order && (tier === undefined || def.tier === tier)) total += state.units[id]
  }
  return total
}

/** AP price of the next unit, with the `recruit_cost` modifiers composed as `BUY_UNIT` does. */
export function recruitCost(
  state: Readonly<GameState>,
  unitId: UnitId,
  config: EngineConfig,
): number {
  return calculateUnitCost(unitId, state.units[unitId], 1, config, state.activeModifiers)
}

/** Whether a Man-at-Arms is hired from outside the realm (Mercenary Capitulation). */
function isExternalHire(state: Readonly<GameState>, unitId: UnitId): boolean {
  return unitId === 'man_at_arms' && hasRule(state, 'law:mercenary_capitulation')
}

/**
 * Whether one more unit passes every `BUY_UNIT` check except the treasury: patent, free serfs,
 * order cap composed with its modifiers, and bulk size.
 */
export function canHouseUnit(
  state: Readonly<GameState>,
  unitId: UnitId,
  config: EngineConfig,
): boolean {
  const def = UNITS_DATA[unitId]
  if (def.tier === 2 && !state.unlockedPatents[def.order]) return false
  if (!isExternalHire(state, unitId) && state.freeSerfs < 1) return false
  if (getMaxBulkSize(state.deadline, state.totalPopulation, def, config) < 1) return false
  const caps = calculateOrderCaps(
    calculateMaxPopulation(state, config),
    state.activeModifiers,
    extractRawEvaluationState(state),
    config,
  )
  return orderCount(state, def.order) + 1 <= caps[def.order]
}

/** Whether one more unit can be bought now, keeping `reserveAp` in the treasury. */
export function canRecruit(
  state: Readonly<GameState>,
  unitId: UnitId,
  config: EngineConfig,
  reserveAp = 0,
): boolean {
  return (
    canHouseUnit(state, unitId, config) &&
    state.ap - reserveAp >= recruitCost(state, unitId, config)
  )
}

/** Whether the patent of an order can be bought now, the fee aside. */
export function isPatentEligible(
  state: Readonly<GameState>,
  order: UnitOrder,
  config: EngineConfig,
): boolean {
  return (
    !state.unlockedPatents[order] &&
    state.deadline >= config.balance.PATENT_MIN_DEADLINE &&
    orderCount(state, order, 1) >= config.balance.PATENT_MIN_TIER_I_UNITS
  )
}

/** What-if view with one more unit bought (treasury not changed). */
export function withUnit(state: Readonly<GameState>, unitId: UnitId): GameState {
  const external = isExternalHire(state, unitId)
  return {
    ...state,
    units: { ...state.units, [unitId]: state.units[unitId] + 1 },
    freeSerfs: external ? state.freeSerfs : state.freeSerfs - 1,
    totalPopulation: external ? state.totalPopulation + 1 : state.totalPopulation,
  }
}

/** What-if view with the patent of an order bought. */
export function withPatent(state: Readonly<GameState>, order: UnitOrder): GameState {
  return { ...state, unlockedPatents: { ...state.unlockedPatents, [order]: true } }
}

/** What-if view with one more colonised Heartland province. */
export function withColony(state: Readonly<GameState>): GameState {
  return {
    ...state,
    provinces: state.provinces + 1,
    provinceBiomes: [...state.provinceBiomes, 'heartland'],
    colonisedProvincesCount: state.colonisedProvincesCount + 1,
  }
}

/** AP price of the next civil colony. */
export function colonyCost(state: Readonly<GameState>, config: EngineConfig): number {
  return calculateColonisationCost(state.colonisedProvincesCount, config)
}

/**
 * Population expected after `horizonSeconds`, from the closed form of the engine's logistic
 * growth (rate `r` composed with its modifiers, fiscal factor, housing capacity). Growth is 0 when
 * the realm is full, in strife or worse, or under the forced tithe freeze.
 */
export function projectPopulation(
  state: Readonly<GameState>,
  config: EngineConfig,
  horizonSeconds: number,
): number {
  const population = state.totalPopulation
  const capacity = calculateMaxPopulation(state, config)
  const stage = getUnrestCrisisStage(state.unrest, config)
  const frozen =
    stage === 'strife_desertion' ||
    stage === 'urban_rebellion' ||
    stage === 'total_revolution' ||
    state.forcedTitheFreezeTimer > 0
  if (population <= 0 || population >= capacity || frozen) return population

  const baseRate =
    config.balance.BASE_POP_GROWTH_RATE_R +
    state.units.peasant * UNITS_DATA.peasant.baseValue +
    state.units.farmer * UNITS_DATA.farmer.baseValue +
    getBiomeModifiers(state).deltaR
  const rate =
    composeStat(
      'pop_growth_rate',
      baseRate,
      state.activeModifiers,
      extractRawEvaluationState(state),
    ) * calculateFiscalFactor(state.taxRate, config)
  const spread = (capacity - population) / population
  return capacity / (1 + spread * Math.exp(-rate * horizonSeconds))
}

/** The three audited metrics and the net income of a realm. */
export interface RealmMetrics {
  grossApRate: number
  netApRate: number
  military: number
  /** Population projected at the horizon. */
  population: number
}

/** Evaluates the audited metrics of a (possibly what-if) realm. */
export function realmMetrics(
  state: Readonly<GameState>,
  config: EngineConfig,
  horizonSeconds: number,
): RealmMetrics {
  return {
    grossApRate: calculateGrossApRate(state, config).total,
    netApRate: calculateNetApRate(state, config),
    military: calculateMilitaryPower(state, config),
    population: projectPopulation(state, config, horizonSeconds),
  }
}

/** Game seconds left before the audit of the current deadline. */
export function secondsToAudit(state: Readonly<GameState>, config: EngineConfig): number {
  return Math.max(0, config.balance.DEADLINE_DURATION_SECONDS - state.deadlineTimeSeconds)
}
