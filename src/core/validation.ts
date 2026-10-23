/**
 * Runtime validation of untrusted GameState values (save import).
 * Narrows `unknown` with type guards; throws on the first invalid field.
 *
 * @module core/validation
 */

import { UNITS_DATA, BIOMES_DATA } from '@/data/balance'
import { LAWS_DATA } from '@/data/laws'
import { DILEMMAS_DATA } from '@/data/dilemmas'
import { ALLOWED_COMMANDS_BY_PHASE } from './phases'
import { MODIFIER_OPS, RESOLVER_KEYS, STAT_KEYS } from './types'
import type {
  BiomeId,
  GameState,
  ModifierOp,
  ResolverKey,
  RunPhase,
  StatKey,
  UnitId,
} from './types'

/** Tolerance of the population invariant `totalPopulation = freeSerfs + sum(units)`. */
const POPULATION_EPSILON = 1e-6

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0
}

function isRunPhase(value: unknown): value is RunPhase {
  return typeof value === 'string' && Object.hasOwn(ALLOWED_COMMANDS_BY_PHASE, value)
}

function isUnitId(value: string): value is UnitId {
  return Object.hasOwn(UNITS_DATA, value)
}

function isBiomeId(value: unknown): value is BiomeId {
  return typeof value === 'string' && Object.hasOwn(BIOMES_DATA, value)
}

function isLawId(value: unknown): value is string {
  return typeof value === 'string' && Object.hasOwn(LAWS_DATA, value)
}

function isStatKey(value: unknown): value is StatKey {
  return STAT_KEYS.some((key) => key === value)
}

function isModifierOp(value: unknown): value is ModifierOp {
  return MODIFIER_OPS.some((op) => op === value)
}

function isResolverKey(value: unknown): value is ResolverKey {
  return RESOLVER_KEYS.some((key) => key === value)
}

function fail(field: string, reason: string): never {
  throw new Error(`Save import failed: invalid '${field}' (${reason}).`)
}

function checkFiniteNumber(state: Record<string, unknown>, field: string): number {
  const value = state[field]
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fail(field, 'expected a finite number')
  }
  return value
}

function checkUnits(value: unknown): number {
  if (!isRecord(value)) {
    return fail('units', 'expected an object')
  }
  let sum = 0
  for (const [id, count] of Object.entries(value)) {
    if (!isUnitId(id)) {
      return fail(`units.${id}`, 'unknown unit id')
    }
    if (!isCount(count)) {
      return fail(`units.${id}`, 'expected a finite integer >= 0')
    }
    sum += count
  }
  return sum
}

function checkModifiers(value: unknown): void {
  if (!Array.isArray(value)) {
    return fail('activeModifiers', 'expected an array')
  }
  value.forEach((modifier: unknown, index) => {
    const field = `activeModifiers[${index}]`
    if (!isRecord(modifier)) {
      return fail(field, 'expected an object')
    }
    if (!isStatKey(modifier.stat)) {
      return fail(`${field}.stat`, 'unknown stat key')
    }
    if (!isModifierOp(modifier.op)) {
      return fail(`${field}.op`, 'unknown modifier op')
    }
    if (typeof modifier.value !== 'number' || !Number.isFinite(modifier.value)) {
      return fail(`${field}.value`, 'expected a finite number')
    }
    if (modifier.resolverKey !== undefined && !isResolverKey(modifier.resolverKey)) {
      return fail(`${field}.resolverKey`, 'unknown resolver key')
    }
  })
}

const OBJECT_FIELDS = ['units', 'edictUsageCounts', 'unlockedPatents', 'rngStreams'] as const
const ARRAY_FIELDS = ['activeLaws', 'activeModifiers', 'provinceBiomes', 'currentLawDraft'] as const

/**
 * Rejects fields that are present in a raw state with the wrong shape (null, wrong type, non array
 * where an array is expected, non object where an object is expected, unknown phase).
 * Absent fields are accepted: older saves lack newer fields and receive defaults later.
 *
 * @param state - Raw state object, before defaults are filled.
 * @throws Error naming the first malformed field.
 */
export function assertPresentFieldShapes(state: Record<string, unknown>): void {
  if (state.phase !== undefined && !isRunPhase(state.phase)) {
    fail('phase', 'unknown run phase')
  }
  for (const field of OBJECT_FIELDS) {
    if (state[field] !== undefined && !isRecord(state[field])) {
      fail(field, 'expected an object')
    }
  }
  for (const field of ARRAY_FIELDS) {
    if (state[field] !== undefined && !Array.isArray(state[field])) {
      fail(field, 'expected an array')
    }
  }
}

/**
 * Validates an untrusted value as a complete GameState.
 * Checks the run phase, unit ids and counts, biomes, active laws, modifiers, the province
 * invariant (`provinces === provinceBiomes.length`), `capturedProvincesCount`, and the population
 * invariant (`|totalPopulation - freeSerfs - sum(units)| < 1e-6`).
 *
 * @param value - Candidate state, typically a migrated save payload.
 * @returns The same value, typed as GameState.
 * @throws Error naming the first invalid field.
 */
export function validateGameState(value: unknown): GameState {
  if (!isRecord(value)) {
    return fail('state', 'expected an object')
  }

  if (!isRunPhase(value.phase)) {
    return fail('phase', 'unknown run phase')
  }

  const unitSum = checkUnits(value.units)

  const biomes = value.provinceBiomes
  if (!Array.isArray(biomes)) {
    return fail('provinceBiomes', 'expected an array')
  }
  biomes.forEach((biome: unknown, index) => {
    if (!isBiomeId(biome)) {
      fail(`provinceBiomes[${index}]`, 'unknown biome id')
    }
  })

  const laws = value.activeLaws
  if (!Array.isArray(laws)) {
    return fail('activeLaws', 'expected an array')
  }
  laws.forEach((law: unknown, index) => {
    if (!isLawId(law)) {
      fail(`activeLaws[${index}]`, 'unknown law id')
    }
  })

  const draft = value.currentLawDraft
  if (!Array.isArray(draft)) {
    return fail('currentLawDraft', 'expected an array')
  }
  draft.forEach((law: unknown, index) => {
    if (!isLawId(law)) {
      fail(`currentLawDraft[${index}]`, 'unknown law id')
    }
  })

  const dilemmaId = value.currentDilemmaId
  if (
    dilemmaId !== null &&
    !(typeof dilemmaId === 'string' && Object.hasOwn(DILEMMAS_DATA, dilemmaId))
  ) {
    return fail('currentDilemmaId', 'expected null or a known dilemma id')
  }

  checkModifiers(value.activeModifiers)

  const provinces = checkFiniteNumber(value, 'provinces')
  if (provinces !== biomes.length) {
    return fail('provinces', `must equal provinceBiomes.length (${biomes.length})`)
  }

  if (!isCount(value.capturedProvincesCount)) {
    return fail('capturedProvincesCount', 'expected a finite integer >= 0')
  }

  const totalPopulation = checkFiniteNumber(value, 'totalPopulation')
  const freeSerfs = checkFiniteNumber(value, 'freeSerfs')
  if (totalPopulation < 0) {
    return fail('totalPopulation', 'expected a number >= 0')
  }
  if (freeSerfs < 0) {
    return fail('freeSerfs', 'expected a number >= 0')
  }
  if (Math.abs(totalPopulation - freeSerfs - unitSum) >= POPULATION_EPSILON) {
    return fail('totalPopulation', 'must equal freeSerfs plus the sum of units')
  }

  // Checked above: phase, units, provinces, provinceBiomes, activeLaws, currentLawDraft,
  // currentDilemmaId, activeModifiers (stat, op, value, resolverKey), capturedProvincesCount,
  // totalPopulation, freeSerfs. Other fields come from createInitialGameState and are not checked.
  return value as unknown as GameState
}
