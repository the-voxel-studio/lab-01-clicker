/**
 * Universal Modifier & Dynamic Resolver Engine.
 * Provides deterministic mathematical composition, dynamic resolver evaluation,
 * and high-frequency per-tick caching.
 *
 * @module core/modifiers
 */

import type { UnitId, StatKey, ResolverKey, Modifier, Effect, GameState } from './types'
import { addUnrest, applyPopulationLoss } from './mutations'

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
  'law:isolationism': (state, mod) => ({
    active: state.provinces <= 3,
    value: mod.value,
  }),
  'law:provincial_tithe': (state, mod) => ({
    active: true,
    value: state.provinces * mod.value,
  }),
  'law:border_fortifications': (state, mod) => ({
    active: true,
    value: state.provinces * mod.value,
  }),
  'law:feudal_levy': (state, mod) => ({
    active: true,
    value: Math.floor(state.freeSerfs / 100) * mod.value,
  }),
  'law:monastic_scriptoria': (state, mod) => ({
    active: true,
    value: (state.units.clergy ?? 0) * mod.value,
  }),
  'perk:iron_fist': (state, mod) => ({
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

/**
 * High-performance per-tick cache for stat evaluations.
 * Avoids recalculating identical stats when tick index and active modifiers have not changed.
 */
export class TickStatCache {
  private cache = new Map<string, number>()
  private tickIndex = -1
  private stateRef: unknown = null

  /**
   * Retrieves or computes a stat evaluation with tick-scoped memoization.
   *
   * @param statKey - The stat key or identifier to retrieve.
   * @param currentTick - Monotonic engine tick counter.
   * @param computeFn - Evaluation callback invoked on cache miss.
   * @param stateRef - Optional reference to GameState to ensure cache isolation between instances.
   * @returns Composed stat value.
   */
  public getOrCompute(
    statKey: string,
    currentTick: number,
    computeFn: () => number,
    stateRef?: unknown,
  ): number {
    if (this.tickIndex !== currentTick || (stateRef !== undefined && this.stateRef !== stateRef)) {
      this.cache.clear()
      this.tickIndex = currentTick
      this.stateRef = stateRef ?? null
    }

    const cached = this.cache.get(statKey)
    if (cached !== undefined) {
      return cached
    }

    const computed = computeFn()
    this.cache.set(statKey, computed)
    return computed
  }

  /** Clears cached values manually. */
  public clear(): void {
    this.cache.clear()
    this.tickIndex = -1
    this.stateRef = null
  }
}

/**
 * Applies an Effect payload (from laws, dilemmas, or edicts) directly to GameState.
 *
 * @param effect - The effect descriptor.
 * @param state - The game state to mutate.
 */
export function applyEffect(effect: Effect, state: GameState): void {
  switch (effect.type) {
    case 'stat_modifier':
      state.activeModifiers.push(effect.modifier)
      break

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
          }
          break
        case 'unrest':
          addUnrest(state, effect.amount)
          break
        case 'provinces':
          state.provinces = Math.max(1, state.provinces + effect.amount)
          break
        case 'archive_points':
          state.archivePoints = Math.max(0, state.archivePoints + effect.amount)
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
      } else {
        const grantable = Math.min(effect.count, Math.max(0, Math.floor(state.freeSerfs)))
        state.units[effect.unitId] = (state.units[effect.unitId] ?? 0) + grantable
        state.freeSerfs -= grantable
      }
      break
    }

    case 'rule_flag':
      // Flags can be tracked in activeModifiers or dedicated state as needed
      break
  }
}

/**
 * Verifies whether the player can afford all negative resource/unit costs in an Effect list.
 * Requires state.ap >= apCost (no deficit spending allowed for choices).
 *
 * @param state - The active GameState.
 * @param effects - The list of effects to validate.
 * @returns boolean indicating if all costs can be paid.
 */
export function canAffordEffects(state: GameState, effects: readonly Effect[]): boolean {
  let apCost = 0
  const unitCosts: Partial<Record<UnitId, number>> = {}
  let serfCost = 0

  for (const effect of effects) {
    if (effect.type === 'instant_resource') {
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
