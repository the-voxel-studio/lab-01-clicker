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
  Effect,
  GameState,
} from './types'

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
  mod: Readonly<Modifier>
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
/**
 * Evaluates and composes a numeric game statistic from base value and active modifiers.
 *
 * Supports both signatures:
 * - composeStat(statKey, baseValue, modifiers, rawState?)
 * - composeStat(baseValue, modifiers, rawState?)
 *
 * Composition Pipeline:
 * 1. Base value
 * 2. Sum of all 'add' modifiers: Base' = Base + sum(Add)
 * 3. Percentage additions: Base'' = Base' * (1 + sum(AddPct))
 * 4. Multipliers: Base''' = Base'' * prod(Mul)
 * 5. Override: If any 'set' modifier is active, takes the value of the most recently applied set modifier.
 */
export function composeStat(
  arg1: StatKey | number,
  arg2: number | readonly Modifier[],
  arg3?: readonly Modifier[] | RawEvaluationState,
  arg4?: RawEvaluationState
): number {
  let statKey: StatKey | undefined
  let baseValue: number
  let modifiers: readonly Modifier[]
  let rawState: RawEvaluationState | undefined

  if (typeof arg1 === 'string') {
    statKey = arg1
    baseValue = arg2 as number
    modifiers = (arg3 as readonly Modifier[]) ?? []
    rawState = arg4
  } else {
    statKey = undefined
    baseValue = arg1
    modifiers = (arg2 as readonly Modifier[]) ?? []
    rawState = arg3 as RawEvaluationState | undefined
  }

  let addSum = 0
  let addPctSum = 0
  let mulProduct = 1.0
  let setValue: number | null = null

  for (const mod of modifiers) {
    if (statKey !== undefined && mod.stat !== statKey) continue

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
  private tickIndex = -1
  private cache = new Map<string, number>()

  /**
   * Retrieves or computes a stat evaluation with tick-scoped memoization.
   *
   * @param statKey - The stat key or identifier to retrieve.
   * @param currentTick - Monotonic engine tick counter.
   * @param computeFn - Evaluation callback invoked on cache miss.
   * @returns Composed stat value.
   */
  public getOrCompute(
    statKey: string,
    currentTick: number,
    computeFn: () => number
  ): number {
    if (this.tickIndex !== currentTick) {
      this.cache.clear()
      this.tickIndex = currentTick
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
          state.ap = Math.max(0, state.ap + effect.amount)
          if (effect.amount > 0) {
            state.cumulativeApThisDeadline += effect.amount
            state.totalCumulativeAp += effect.amount
          }
          break
        case 'population':
          state.totalPopulation = Math.max(0, state.totalPopulation + effect.amount)
          state.freeSerfs = Math.max(0, state.freeSerfs + effect.amount)
          break
        case 'unrest':
          state.unrest = Math.max(0, Math.min(100, state.unrest + effect.amount))
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
      const current = state.units[effect.unitId] ?? 0
      state.units[effect.unitId] = current + effect.count
      break
    }

    case 'rule_flag':
      // Flags can be tracked in activeModifiers or dedicated state as needed
      break
  }
}
