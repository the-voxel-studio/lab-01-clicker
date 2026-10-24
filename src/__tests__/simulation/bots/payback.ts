/**
 * Payback engine: ranks the purchases of a realm by payback seconds (GAME_RULES §21).
 *
 * The options are one more unit, a royal patent (priced with the best Tier II unit it unlocks) and
 * a civil colony. Each option is valued in AP per second: the change of net AP income, plus, for
 * each audited metric below its target, the change of that metric as a share of its quota, times
 * the exchange rate: one full quota of a metric is worth the realm's gross AP rate (at least the AP
 * rate quota). Population is the closed form projection at the audit. Payback seconds = AP cost /
 * value; an option is scored by its payback plus the seconds of net income needed to afford it,
 * and the lowest score wins. A purchase that would drive net income below 0 is never chosen.
 *
 * @module __tests__/simulation/bots/payback
 */

import { UNITS_DATA, type UnitId } from '@/data/balance'
import type { Command, GameState } from '@/core/types'
import type { EngineConfig } from '@/core/config'
import type { EffectiveQuota } from '@/core/engine'
import {
  ORDERS,
  UNIT_IDS,
  canHouseUnit,
  colonyCost,
  currentQuota,
  isPatentEligible,
  realmMetrics,
  recruitCost,
  secondsToAudit,
  withColony,
  withPatent,
  withUnit,
  type RealmMetrics,
} from './realm'

/** Targets of the audited metrics as multiples of the current quota; 0 ignores a metric. */
export interface MetricTargets {
  readonly apRate: number
  readonly pop: number
  readonly military: number
}

/** How a bot weighs its purchases. */
export interface PaybackProfile {
  readonly targets: MetricTargets
  /** Floor of the population projection horizon, in seconds. */
  readonly minHorizonSeconds: number
  /** Units never weighed by payback (bought by the bot's own rules, or never). */
  readonly excludedUnits: readonly UnitId[]
  /** Whether civil colonisation is an option. */
  readonly colonise: boolean
}

/** Last deadline of the expert opening (Tier II patents need deadline 4). */
export const EXPERT_OPENING_LAST_DEADLINE = 3

/**
 * Opening shared by the expert bots before their archetype takes over: every metric aimed at 120%
 * of the quota, population projected at least 40 s ahead, colonisation allowed.
 */
export const EXPERT_OPENING_PROFILE: PaybackProfile = {
  targets: { apRate: 1.2, pop: 1.2, military: 1.2 },
  minHorizonSeconds: 40,
  excludedUnits: ['clergy', 'prelate', 'scout', 'spymaster'],
  colonise: true,
}

/**
 * The shared expert opening up to `EXPERT_OPENING_LAST_DEADLINE`, then the archetype profile.
 *
 * @param state - Current state (its deadline).
 * @param archetype - Profile played after the opening.
 * @returns The profile to weigh purchases with now.
 */
export function expertProfileFor(
  state: Readonly<GameState>,
  archetype: PaybackProfile,
): PaybackProfile {
  return state.deadline <= EXPERT_OPENING_LAST_DEADLINE ? EXPERT_OPENING_PROFILE : archetype
}

/** A ranked purchase. */
export interface PaybackOption {
  /** Command dispatched when the option is chosen. */
  readonly command: Command
  /** AP the command takes now. */
  readonly cost: number
  /** AP of the whole option (a patent includes the unit it unlocks). */
  readonly totalCost: number
  /** AP per second the option is worth. */
  readonly value: number
  /** Payback seconds plus the seconds of net income needed to afford it. */
  readonly score: number
}

/** 1 for each metric still below its target, else 0. */
interface MetricNeeds {
  apRate: number
  pop: number
  military: number
}

/** Which metrics are below their target. */
function metricNeeds(
  metrics: RealmMetrics,
  quota: EffectiveQuota,
  targets: MetricTargets,
): MetricNeeds {
  const below = (value: number, target: number, required: number): number =>
    target > 0 && value < target * required ? 1 : 0
  return {
    apRate: below(metrics.grossApRate, targets.apRate, quota.apRate),
    pop: below(metrics.population, targets.pop, quota.pop),
    military: below(metrics.military, targets.military, quota.military),
  }
}

/** AP per second a change of the realm is worth (see the module comment). */
function valueOf(
  before: RealmMetrics,
  after: RealmMetrics,
  needs: MetricNeeds,
  quota: EffectiveQuota,
): number {
  const exchange = Math.max(quota.apRate, before.grossApRate)
  const rate = (delta: number, required: number): number =>
    required > 0 ? (exchange * delta) / required : 0
  return (
    after.netApRate -
    before.netApRate +
    needs.apRate * (after.grossApRate - before.grossApRate) +
    needs.pop * rate(after.population - before.population, quota.pop) +
    needs.military * rate(after.military - before.military, quota.military)
  )
}

/** Shared inputs of one ranking. */
interface RankingFrame {
  config: EngineConfig
  quota: EffectiveQuota
  horizon: number
  before: RealmMetrics
  needs: MetricNeeds
}

/** Builds an option from a what-if view, or null when it is worth nothing or bankrupts. */
function option(
  frame: RankingFrame,
  state: Readonly<GameState>,
  view: GameState,
  command: Command,
  cost: number,
  totalCost: number,
): PaybackOption | null {
  const after = realmMetrics(view, frame.config, frame.horizon)
  if (after.netApRate < 0 && after.netApRate < frame.before.netApRate) return null
  const value = valueOf(frame.before, after, frame.needs, frame.quota)
  if (!(value > 0)) return null
  const missing = Math.max(0, totalCost - state.ap)
  const wait =
    missing === 0 ? 0 : frame.before.netApRate > 0 ? missing / frame.before.netApRate : Infinity
  return { command, cost, totalCost, value, score: wait + totalCost / value }
}

/** Unit options that pass every check but the treasury. */
function unitOptions(
  frame: RankingFrame,
  state: Readonly<GameState>,
  profile: PaybackProfile,
): PaybackOption[] {
  return UNIT_IDS.filter(
    (id) => !profile.excludedUnits.includes(id) && canHouseUnit(state, id, frame.config),
  ).flatMap((unitId) => {
    const cost = recruitCost(state, unitId, frame.config)
    const command: Command = { type: 'BUY_UNIT', unitId, count: 1 }
    return option(frame, state, withUnit(state, unitId), command, cost, cost) ?? []
  })
}

/** Patent options, each priced and valued with its best Tier II unit. */
function patentOptions(
  frame: RankingFrame,
  state: Readonly<GameState>,
  profile: PaybackProfile,
): PaybackOption[] {
  return ORDERS.filter((order) => isPatentEligible(state, order, frame.config)).flatMap((order) => {
    const fee = frame.config.balance.PATENT_COSTS[order]
    const patented = withPatent(state, order)
    const unlocked = UNIT_IDS.filter(
      (id) =>
        UNITS_DATA[id].order === order &&
        UNITS_DATA[id].tier === 2 &&
        !profile.excludedUnits.includes(id) &&
        canHouseUnit(patented, id, frame.config),
    )
    const command: Command = { type: 'UNLOCK_PATENT', order }
    const candidates = unlocked.flatMap((unitId) => {
      const total = fee + recruitCost(patented, unitId, frame.config)
      return option(frame, state, withUnit(patented, unitId), command, fee, total) ?? []
    })
    return candidates.sort((a, b) => a.score - b.score).slice(0, 1)
  })
}

/** The civil colony option, when the profile allows it. */
function colonyOptions(
  frame: RankingFrame,
  state: Readonly<GameState>,
  profile: PaybackProfile,
): PaybackOption[] {
  if (!profile.colonise) return []
  const cost = colonyCost(state, frame.config)
  const colony = option(frame, state, withColony(state), { type: 'COLONISE_PROVINCE' }, cost, cost)
  return colony ? [colony] : []
}

/** Every option of the realm, lowest score first. */
export function rankOptions(
  state: Readonly<GameState>,
  config: EngineConfig,
  profile: PaybackProfile,
): PaybackOption[] {
  const quota = currentQuota(state, config)
  const horizon = Math.max(profile.minHorizonSeconds, secondsToAudit(state, config))
  const before = realmMetrics(state, config, horizon)
  const frame: RankingFrame = {
    config,
    quota,
    horizon,
    before,
    needs: metricNeeds(before, quota, profile.targets),
  }
  return [
    ...unitOptions(frame, state, profile),
    ...patentOptions(frame, state, profile),
    ...colonyOptions(frame, state, profile),
  ].sort((a, b) => a.score - b.score)
}

/** What-if view after an option is bought. */
function afterPurchase(state: Readonly<GameState>, chosen: PaybackOption): GameState {
  const paid = { ...state, ap: state.ap - chosen.cost }
  const command = chosen.command
  if (command.type === 'BUY_UNIT') return withUnit(paid, command.unitId)
  if (command.type === 'UNLOCK_PATENT') return withPatent(paid, command.order)
  return withColony(paid)
}

/**
 * Greedy purchases of one decision: while the best ranked option is affordable, buy it and rank
 * again on the what-if view, at most `maxPurchases` times. When the best option is not affordable
 * the bot saves for it.
 */
export function paybackPurchases(
  state: Readonly<GameState>,
  config: EngineConfig,
  profile: PaybackProfile,
  maxPurchases: number,
): Command[] {
  const commands: Command[] = []
  let view: Readonly<GameState> = state
  for (let i = 0; i < maxPurchases; i++) {
    const best = rankOptions(view, config, profile)[0]
    if (!best || view.ap < best.cost) break
    commands.push(best.command)
    view = afterPurchase(view, best)
  }
  return commands
}
