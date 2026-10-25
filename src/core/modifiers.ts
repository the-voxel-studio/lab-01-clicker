/**
 * Universal Modifier & Dynamic Resolver Engine.
 * Provides deterministic mathematical composition, dynamic resolver evaluation,
 * and high-frequency per-tick caching.
 *
 * @module core/modifiers
 */

import type {
  UnitId,
  StatKey,
  ResolverKey,
  Modifier,
  ModifierScope,
  Effect,
  GameState,
  UnitBalanceDef,
} from './types'
import { addProvince, removeLastProvince } from './provinces'
import { addUnrest, applyPopulationLoss } from './mutations'
import { recordPeakPopulation } from './formulas'
import { DEFAULT_ENGINE_CONFIG, type EngineConfig } from './config'

/**
 * Raw game state inspected by dynamic modifier resolvers.
 * Resolvers only inspect raw primitive fields and counts to prevent recursion cycles.
 */
export interface RawEvaluationState {
  readonly ap: number
  readonly population: number
  readonly freeSerfs: number
  readonly provinces: number
  readonly taxRate: number
  readonly unrest: number
  readonly units: Readonly<Partial<Record<UnitId, number>>>
  readonly laws: readonly string[]
  readonly currentDeadline: number
  readonly tickCount?: number
}

/** Result emitted by dynamic modifier resolvers. */
export interface DynamicResolverResult {
  active: boolean
  value: number
}

/** Pure dynamic modifier resolver function signature. */
export type DynamicModifierResolver = (
  state: Readonly<RawEvaluationState>,
  mod: Readonly<Modifier>,
) => DynamicResolverResult | number

/**
 * Registry of pure dynamic modifier resolvers.
 * Resolvers must only read raw state fields and never call `getStat` or composeStat recursively.
 */
export const DYNAMIC_MODIFIER_RESOLVERS: Record<ResolverKey, DynamicModifierResolver> = {
  per_province: (state, mod) => ({
    active: true,
    value: state.provinces * mod.value,
  }),
  per_100_free_serfs: (state, mod) => ({
    active: true,
    value: Math.floor(state.freeSerfs / 100) * mod.value,
  }),
  per_clergy: (state, mod) => ({
    active: true,
    value: (state.units.clergy ?? 0) * mod.value,
  }),
  max_3_provinces: (state, mod) => ({
    active: state.provinces <= 3,
    value: mod.value,
  }),
  unrest_at_least_30: (state, mod) => ({
    active: state.unrest >= 30,
    value: mod.value,
  }),
}

/**
 * Extracts a lightweight, read-only snapshot of raw state variables for dynamic resolver evaluation.
 * Resolvers inspect raw properties only and never invoke recursive stat evaluators.
 *
 * @param state - Current complete or partial GameState.
 * @returns Minimal RawEvaluationState contract.
 */
export function extractRawEvaluationState(state: GameState): RawEvaluationState {
  return {
    ap: state.ap,
    population: state.totalPopulation,
    freeSerfs: state.freeSerfs,
    provinces: state.provinces,
    taxRate: state.taxRate,
    unrest: state.unrest,
    units: state.units,
    laws: state.activeLaws,
    currentDeadline: state.deadline,
    tickCount: state.tickIndex,
  }
}

/**
 * Evaluates and composes a numeric game statistic from base value and active modifiers.
 *
 * Composition Pipeline:
 * 1. Base value
 * 2. Sum of all 'add' modifiers: Base' = Base + sum(Add)
 * 3. Percentage additions: Base'' = Base' * (1 + sum(AddPct))
 * 4. Multipliers: Base''' = Base'' * prod(Mul)
 * 5. Override: If any 'set' modifier is active, takes the value of the most recently applied set modifier.
 *
 * @param statKey - Target stat identifier (or undefined to apply to all in array).
 * @param baseValue - Canonical unadjusted baseline value.
 * @param modifiers - List of active realm modifiers.
 * @param rawState - Raw game state snapshot for dynamic resolvers.
 * @returns The final composed numeric value.
 */
export function composeStat(
  statKey: StatKey,
  baseValue: number,
  modifiers: readonly Modifier[],
  rawState?: RawEvaluationState,
): number {
  let addSum = 0
  let addPctSum = 0
  let mulProduct = 1.0
  let setValue: number | null = null

  for (const mod of modifiers) {
    if (mod.stat !== statKey) continue

    let effectiveValue = mod.value
    let isActive = true

    // Evaluate dynamic conditional resolver if present
    if (mod.resolverKey) {
      if (!rawState) {
        // Without raw state, cannot evaluate dynamic condition
        continue
      }
      const resolver = DYNAMIC_MODIFIER_RESOLVERS[mod.resolverKey]
      if (resolver) {
        const result = resolver(rawState, mod)
        if (typeof result === 'number') {
          effectiveValue = result
        } else {
          isActive = result.active
          effectiveValue = result.value
        }
      }
    }

    if (!isActive) continue

    switch (mod.op) {
      case 'add':
        addSum += effectiveValue
        break
      case 'addPct':
        addPctSum += effectiveValue
        break
      case 'mul':
        mulProduct *= effectiveValue
        break
      case 'set':
        setValue = effectiveValue
        break
    }
  }

  if (setValue !== null) {
    return setValue
  }

  const withAdd = baseValue + addSum
  const withAddPct = withAdd * (1 + addPctSum)
  return withAddPct * mulProduct
}

function scopeMatches(scope: ModifierScope, unit: UnitBalanceDef): boolean {
  return (
    (scope.order === undefined || scope.order === unit.order) &&
    (scope.tier === undefined || scope.tier === unit.tier) &&
    (scope.unitId === undefined || scope.unitId === unit.id)
  )
}

/**
 * Composes a unit scoped stat (`unit_upkeep`, `recruit_cost`, `unit_output`) for one unit type.
 * Only modifiers of `stat` whose `scope` matches the unit are composed (same order as
 * `composeStat`); a modifier without scope is ignored. The result is clamped at 0.
 *
 * @param stat - Unit scoped stat to compose.
 * @param base - Per unit base value of the stat.
 * @param unit - Unit definition the scopes are matched against.
 * @param modifiers - Active modifiers.
 * @param raw - Raw state for dynamic resolvers; without it, resolver modifiers are skipped.
 * @returns The composed per unit value, never below 0.
 */
export function composeUnitStat(
  stat: StatKey,
  base: number,
  unit: UnitBalanceDef,
  modifiers: readonly Modifier[],
  raw?: RawEvaluationState,
): number {
  const matching = modifiers.filter(
    (mod) => mod.stat === stat && mod.scope !== undefined && scopeMatches(mod.scope, unit),
  )
  if (matching.length === 0) return Math.max(0, base)
  return Math.max(0, composeStat(stat, base, matching, raw))
}

/**
 * AP cost of an `ap_cost_income_seconds` effect: `seconds` times the net AP rate, or 0 when that
 * rate is not positive. Throws when the caller did not supply the net rate.
 */
function incomeSecondsCost(seconds: number, netApRate: number | undefined): number {
  if (netApRate === undefined) {
    throw new Error('ap_cost_income_seconds needs the net AP rate (calculateNetApRate).')
  }
  return Math.max(0, seconds) * Math.max(0, netApRate)
}

/**
 * Full bankruptcy grace countdown in seconds: the base plus the audit chamber bonus, composed with
 * the `bankruptcy_grace_seconds` stat. A running countdown restarts from this value.
 *
 * @param state - Current GameState.
 * @param config - Balance configuration.
 * @returns Grace seconds granted before bankruptcy defeat.
 */
export function calculateBankruptcyGraceSeconds(
  state: GameState,
  config: EngineConfig = DEFAULT_ENGINE_CONFIG,
): number {
  const auditChambers = state.units.audit_chamber ?? 0
  return composeStat(
    'bankruptcy_grace_seconds',
    config.balance.BANKRUPTCY_GRACE_BASE_SECONDS +
      auditChambers * config.balance.BANKRUPTCY_GRACE_PER_AUDIT_CHAMBER_SECONDS,
    state.activeModifiers,
    extractRawEvaluationState(state),
  )
}

/**
 * Applies an Effect payload (from laws, dilemmas, or edicts) directly to GameState.
 * A `stat_modifier` template is cloned, never pushed by reference: `appliedAt` is stamped with
 * `totalElapsedSeconds` and `durationSeconds`, when set, becomes `expiresAt` relative to it.
 *
 * @param effect - The effect descriptor.
 * @param state - The game state to mutate.
 * @param netApRate - Net AP rate per second (`calculateNetApRate`), required by
 *   `ap_cost_income_seconds`.
 * @param config - Balance configuration, read by `end_bankruptcy_countdown`.
 * @throws Error when an `ap_cost_income_seconds` effect is applied without `netApRate`.
 */
export function applyEffect(
  effect: Effect,
  state: GameState,
  netApRate?: number,
  config: EngineConfig = DEFAULT_ENGINE_CONFIG,
): void {
  switch (effect.type) {
    case 'stat_modifier': {
      const { modifier } = effect
      const now = state.totalElapsedSeconds
      const { durationSeconds, expiresAt, ...rest } = modifier
      const clone: Modifier = { ...rest, appliedAt: now }
      if (durationSeconds !== undefined) {
        clone.expiresAt = now + durationSeconds
      } else if (expiresAt !== undefined) {
        clone.expiresAt = expiresAt
      }
      state.activeModifiers.push(clone)
      break
    }

    case 'instant_resource':
      switch (effect.resource) {
        case 'ap':
          state.ap += effect.amount
          break
        case 'population':
          if (effect.amount < 0) {
            applyPopulationLoss(state, -effect.amount)
          } else if (effect.amount > 0) {
            state.totalPopulation += effect.amount
            state.freeSerfs += effect.amount
            recordPeakPopulation(state)
          }
          break
        case 'unrest':
          addUnrest(state, effect.amount)
          break
        case 'provinces':
          // Provinces are whole units: a fractional amount truncates toward zero.
          for (let i = 0; i < Math.trunc(effect.amount); i++) {
            addProvince(state, 'heartland')
          }
          for (let i = 0; i > Math.trunc(effect.amount) && state.provinces > 1; i--) {
            removeLastProvince(state)
          }
          break
        case 'archive_points':
          // Run points may go negative; concludeRun clamps the archive total at 0.
          state.archivePoints += effect.amount
          break
      }
      break

    case 'grant_units': {
      if (effect.count < 0) {
        const toRemove = Math.min(-effect.count, state.units[effect.unitId] ?? 0)
        state.units[effect.unitId] = (state.units[effect.unitId] ?? 0) - toRemove
        state.totalPopulation = Math.max(0, state.totalPopulation - toRemove)
      } else if (effect.external) {
        state.units[effect.unitId] = (state.units[effect.unitId] ?? 0) + effect.count
        state.totalPopulation += effect.count
        recordPeakPopulation(state)
      } else {
        const grantable = Math.min(effect.count, Math.max(0, Math.floor(state.freeSerfs)))
        state.units[effect.unitId] = (state.units[effect.unitId] ?? 0) + grantable
        state.freeSerfs -= grantable
      }
      break
    }

    case 'end_bankruptcy_countdown':
      state.bankruptcyGraceTimer = calculateBankruptcyGraceSeconds(state, config)
      break

    case 'rule_flag':
      if (!state.ruleFlags.includes(effect.flag)) {
        state.ruleFlags.push(effect.flag)
      }
      break

    case 'ap_cost_income_seconds':
      state.ap -= incomeSecondsCost(effect.seconds, netApRate)
      break
  }
}

/**
 * Verifies whether the player can afford all negative resource/unit costs in an Effect list.
 * Requires state.ap >= apCost (no deficit spending allowed for choices); an
 * `ap_cost_income_seconds` effect counts its cost at `netApRate`.
 *
 * @param state - The active GameState.
 * @param effects - The list of effects to validate.
 * @param netApRate - Net AP rate per second (`calculateNetApRate`), required by
 *   `ap_cost_income_seconds`.
 * @returns boolean indicating if all costs can be paid.
 * @throws Error when an `ap_cost_income_seconds` effect is checked without `netApRate`.
 */
export function canAffordEffects(
  state: GameState,
  effects: readonly Effect[],
  netApRate?: number,
): boolean {
  let apCost = 0
  const unitCosts: Partial<Record<UnitId, number>> = {}
  let serfCost = 0

  for (const effect of effects) {
    if (effect.type === 'ap_cost_income_seconds') {
      apCost += incomeSecondsCost(effect.seconds, netApRate)
    } else if (effect.type === 'instant_resource') {
      if (effect.resource === 'ap' && effect.amount < 0) {
        apCost += -effect.amount
      } else if (effect.resource === 'population' && effect.amount < 0) {
        serfCost += -effect.amount
      }
    } else if (effect.type === 'grant_units') {
      if (effect.count < 0) {
        unitCosts[effect.unitId] = (unitCosts[effect.unitId] ?? 0) + -effect.count
      } else if (!effect.external) {
        // internal recruitment requires free serfs
        serfCost += effect.count
      }
    }
  }

  if (apCost > 0 && state.ap < apCost) {
    return false
  }

  if (serfCost > 0 && state.freeSerfs < serfCost) {
    return false
  }

  for (const [unitId, count] of Object.entries(unitCosts) as [UnitId, number][]) {
    if ((state.units[unitId] ?? 0) < count) {
      return false
    }
  }

  return true
}
