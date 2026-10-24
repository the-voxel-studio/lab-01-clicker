/**
 * Shared decision helpers of the deterministic bots: clicks, unrest care, laws, dilemmas, threats.
 *
 * Each helper is a fixed rule that reads public state only and returns a command or a choice.
 *
 * @module __tests__/simulation/bots/council
 */

import type { Command, Effect, GameState } from '@/core/types'
import type { EngineConfig } from '@/core/config'
import { LAWS_DATA } from '@/data/laws'
import { EDICTS_DATA } from '@/data/edicts'
import type { DilemmaDef } from '@/data/dilemmas'
import { calculateGrossApRate, calculateMilitaryPower, calculateNetApRate } from '@/core/engine'
import { canAffordEffects, composeStat, extractRawEvaluationState } from '@/core/modifiers'
import { hasRule } from '@/core/rules'
import { canRecruit } from './realm'
import type { ThreatResponse } from './strategy'

/** Up to `maxPerSecond` seal stamps, limited by the click tokens available. */
export function stampCommands(state: Readonly<GameState>, maxPerSecond: number): Command[] {
  const count = Math.max(0, Math.min(maxPerSecond, Math.floor(state.clickTokens)))
  return Array.from({ length: count }, (): Command => ({ type: 'STAMP_DOCUMENT' }))
}

/** Unrest thresholds of the unrest care rule. */
export interface UnrestPolicy {
  /** Unrest from which pacifiers (prelate, else clergy) are recruited. */
  readonly calmAt: number
  /** Unrest from which the Grand Festival edict is called, when affordable. */
  readonly festivalAt: number
}

/** AP price of the Grand Festival edict now. */
function festivalCost(state: Readonly<GameState>, config: EngineConfig): number {
  const values = EDICTS_DATA.grand_festival.values
  return Math.max(
    values.minCost,
    values.treasuryShare * Math.max(0, state.ap),
    values.grossRateSeconds * calculateGrossApRate(state, config).total,
  )
}

/**
 * Unrest care: the Grand Festival above `festivalAt` (one edict per deadline), and above `calmAt`
 * one pacifier while the pacification held (clergy, a prelate counting 7) is below the unrest
 * excess plus 5.
 */
export function unrestCareCommands(
  state: Readonly<GameState>,
  config: EngineConfig,
  policy: UnrestPolicy,
): Command[] {
  if (
    state.unrest >= policy.festivalAt &&
    state.lastEdictDeadline < state.deadline &&
    state.ap >= festivalCost(state, config)
  ) {
    return [{ type: 'ENACT_EDICT', edictId: 'grand_festival' }]
  }
  if (state.unrest < policy.calmAt) return []
  const pacifiers = state.units.clergy + 7 * state.units.prelate
  if (pacifiers >= state.unrest - policy.calmAt + 5) return []
  if (canRecruit(state, 'prelate', config))
    return [{ type: 'BUY_UNIT', unitId: 'prelate', count: 1 }]
  if (canRecruit(state, 'clergy', config)) return [{ type: 'BUY_UNIT', unitId: 'clergy', count: 1 }]
  return []
}

/** Command that brings the tax rate back to `rate` when it differs and nothing is pending. */
export function taxCommands(state: Readonly<GameState>, rate: number): Command[] {
  return state.taxRate !== rate && state.pendingTaxRate === null
    ? [{ type: 'SET_TAX_RATE', rate }]
    : []
}

/** Active law slots now, as `ENACT_LAW` counts them for `lawId`. */
function lawSlots(state: Readonly<GameState>, config: EngineConfig, lawId: string): number {
  const slots = composeStat(
    'law_slots',
    config.balance.LAW_SLOTS_BASE,
    state.activeModifiers,
    extractRawEvaluationState(state),
  )
  const pledged = hasRule(state, 'law:papal_concordat') && lawId !== 'law:papal_concordat' ? 1 : 0
  return slots - pledged
}

/** Whether `ENACT_LAW` would accept the drafted law now. */
export function canEnactLaw(
  state: Readonly<GameState>,
  config: EngineConfig,
  lawId: string,
): boolean {
  const law = LAWS_DATA[lawId]
  if (!law || !state.currentLawDraft.includes(lawId) || state.activeLaws.includes(lawId)) {
    return false
  }
  if (law.order === 'chancellor' && hasRule(state, 'law:marshals_carte_blanche')) return false
  if (state.activeLaws.length >= lawSlots(state, config, lawId)) return false
  return canAffordEffects(state, law.effects, calculateNetApRate(state, config))
}

/**
 * Enacts the first law of `preferences` that is drafted and can be enacted; otherwise rejects
 * the draft (+1 archive point).
 */
export function preferredLaw(
  state: Readonly<GameState>,
  config: EngineConfig,
  preferences: readonly string[],
): Command {
  const lawId = preferences.find((id) => canEnactLaw(state, config, id))
  return lawId === undefined ? { type: 'REJECT_LAWS' } : { type: 'ENACT_LAW', lawId }
}

/** Instant unrest change of a list of effects. */
function instantUnrest(effects: readonly Effect[]): number {
  return effects.reduce(
    (sum, effect) =>
      effect.type === 'instant_resource' && effect.resource === 'unrest'
        ? sum + effect.amount
        : sum,
    0,
  )
}

/**
 * Dilemma choices shared by the deterministic bots (choice 1 where listed): calm the realm, keep
 * the serfs, take free scribes, seize coin from a fraud, save the population. Each bot adds its
 * own overrides.
 */
export const BASE_DILEMMA_PREFERENCES: Readonly<Record<string, number>> = {
  'dilemma:peasant_salt_boycott': 1,
  'dilemma:runaway_serfs': 1,
  'dilemma:wandering_troubadours': 1,
  'dilemma:false_relic_merchant': 1,
  'dilemma:rotting_grain_silos': 1,
}

/**
 * Dilemma rule: the preferred choice of the table (choice 0 when the dilemma is not listed) if it
 * is affordable and keeps the unrest below `unrestCeiling`; otherwise the other choice if it is
 * affordable and does; otherwise the affordable choice with the lowest instant unrest.
 */
export function preferredDilemmaChoice(
  state: Readonly<GameState>,
  config: EngineConfig,
  dilemma: DilemmaDef,
  preferences: Readonly<Record<string, number>>,
  unrestCeiling: number,
): number {
  const netApRate = calculateNetApRate(state, config)
  const preferred = preferences[dilemma.id] === 1 ? 1 : 0
  const order = [preferred, 1 - preferred]
  const affordable = order.filter((index) => {
    const choice = dilemma.choices[index]
    return choice !== undefined && canAffordEffects(state, choice.effects, netApRate)
  })
  const unrestAfter = (index: number): number =>
    state.unrest + instantUnrest(dilemma.choices[index]?.effects ?? [])
  const calm = affordable.find((index) => unrestAfter(index) < unrestCeiling)
  if (calm !== undefined) return calm
  const lowest = [...affordable].sort((a, b) => unrestAfter(a) - unrestAfter(b))[0]
  return lowest ?? preferred
}

/**
 * Whether armed defense wins even with the worst rolls: the defender's lowest roll on
 * (military power x fortification + strongholds + Men-at-Arms) against the attacker's highest roll
 * on the announced threat power after siege friction.
 */
export function defenseHoldsAgainst(
  state: Readonly<GameState>,
  config: EngineConfig,
  threatPower: number,
): boolean {
  const b = config.balance
  const strongholds = state.provinceBiomes.filter((biome) => biome === 'stronghold').length
  const strongholdFactor = hasRule(state, 'law:guerrilla_border_watch')
    ? b.GUERRILLA_STRONGHOLD_FACTOR
    : 1
  const defense =
    (calculateMilitaryPower(state, config) * (1 + b.DEFENDER_FORTIFICATION_BONUS) +
      strongholds * b.BORDER_STRONGHOLD_DEFENSE_FLAT * strongholdFactor +
      state.units.man_at_arms * b.MAN_AT_ARMS_DEFENSE_FLAT) *
    b.DEFENDER_ROLL_MIN
  const attack = threatPower * (1 - b.ATTACKER_SIEGE_FRICTION) * b.ATTACKER_ROLL_MAX
  return defense > attack
}

/**
 * Threat rule: defense when it holds with the worst rolls; otherwise tribute when affordable;
 * otherwise a levy when it keeps the unrest below 90; otherwise defense.
 */
export function safeThreatResponse(
  state: Readonly<GameState>,
  config: EngineConfig,
): ThreatResponse {
  if (defenseHoldsAgainst(state, config, state.currentThreatPower)) return 'defense'
  if (state.ap >= state.currentThreatTributeAp) return 'tribute'
  if (state.unrest + config.balance.LEVY_UNREST < 90) return 'levy'
  return 'defense'
}
