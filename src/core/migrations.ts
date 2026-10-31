import type { GameState, BiomeId, ResolverKey, RuleFlag, FactionId } from './types'
import { LAWS_DATA } from '@/data/laws'
import { createInitialGameState } from './state'
import { deriveStreamSeed } from './prng'
import {
  assertPresentFieldShapes,
  isRecord,
  validateArchiveData,
  validateGameState,
} from './validation'
import { createArchiveData, type ArchiveData } from './archives'

/** Active master save schema version. */
export const CURRENT_SCHEMA_VERSION = 6

/** Integrity prefix for clipboard import and export strings. */
export const SAVE_PREFIX = 'GRA-v1:'

/**
 * Standard versioned serializable payload contract.
 * `archive` is present from schema 5 on; older payloads receive it from `migrateV4ToV5`.
 */
export interface SerializedSavePayload {
  schemaVersion: number
  timestamp: number
  state: GameState
  archive?: ArchiveData
}

/** A decoded and validated save: the run state and the persistent archive. */
export interface ImportedSave {
  state: GameState
  archive: ArchiveData
}

/**
 * Migration transform function signature.
 * Strictly typed with unknown -> unknown; zero any.
 */
export type MigrationFunction = (oldData: unknown) => unknown

/**
 * Migrates a legacy schema v1 save payload to schema v2.
 * Injects deterministic PRNG streams, province biomes, and all newly introduced GameState fields.
 *
 * @param oldData - Raw v1 payload to migrate.
 * @returns Migrated SerializedSavePayload conforming to schema v2.
 */
export function migrateV1ToV2(oldData: unknown): unknown {
  if (!isSerializedSavePayload(oldData)) {
    throw new Error('Migration v1 -> v2 failed: Source data is not a valid SerializedSavePayload.')
  }

  const oldState = oldData.state as unknown as Record<string, unknown>
  const seed = typeof oldState.seed === 'number' ? oldState.seed : 1337
  const provinces = typeof oldState.provinces === 'number' ? oldState.provinces : 3

  // Derive PRNG streams deterministically from seed
  const rngStreams = {
    click: deriveStreamSeed(seed, 'click'),
    combat: deriveStreamSeed(seed, 'combat'),
    events: deriveStreamSeed(seed, 'events'),
    council: deriveStreamSeed(seed, 'council'),
  }

  // Assign 'heartland' biome to all existing provinces
  const provinceBiomes: BiomeId[] = Array.from(
    { length: Math.max(0, Math.trunc(provinces)) },
    () => 'heartland',
  )

  const migratedState: GameState = createInitialGameState({
    ...(oldData.state as Partial<GameState>),
    rngStreams,
    provinceBiomes,
    desertionTimer: typeof oldState.desertionTimer === 'number' ? oldState.desertionTimer : 0,
    forcedTitheFreezeTimer:
      typeof oldState.forcedTitheFreezeTimer === 'number' ? oldState.forcedTitheFreezeTimer : 0,
    currentTarget: null,
    lastSurpriseRaidTime:
      typeof oldState.lastSurpriseRaidTime === 'number' ? oldState.lastSurpriseRaidTime : -60,
    surpriseRaidTriggeredThisDeadline: false,
    disbandedMilitaryHistory: [],
    victoriesCount: typeof oldState.victoriesCount === 'number' ? oldState.victoriesCount : 0,
    currentLawDraft: [],
    currentDilemmaId: null,
    lastEdictDeadline:
      typeof oldState.lastEdictDeadline === 'number' ? oldState.lastEdictDeadline : 0,
    edictUsageCounts:
      typeof oldState.edictUsageCounts === 'object' && oldState.edictUsageCounts !== null
        ? (oldState.edictUsageCounts as GameState['edictUsageCounts'])
        : { forced_tithe: 0, church_seizure: 0, grand_festival: 0 },
    clickTokens: typeof oldState.clickTokens === 'number' ? oldState.clickTokens : 12,
    interimWarningOnTrack: null,
    pendingDeadlineAudit: false,
  })

  const newPayload: SerializedSavePayload = {
    schemaVersion: 2,
    timestamp: oldData.timestamp,
    state: migratedState,
  }

  return newPayload
}

/**
 * Migrates a schema v2 save payload to schema v3.
 * Adds `capturedProvincesCount` (0) and rebuilds `provinceBiomes` so its length equals `provinces`:
 * existing entries keep their order, missing ones are padded with 'heartland', extra ones are
 * truncated from the end.
 *
 * @param oldData - Raw v2 payload to migrate.
 * @returns Migrated SerializedSavePayload conforming to schema v3.
 */
export function migrateV2ToV3(oldData: unknown): unknown {
  if (!isSerializedSavePayload(oldData)) {
    throw new Error('Migration v2 -> v3 failed: Source data is not a valid SerializedSavePayload.')
  }

  const oldState: unknown = oldData.state
  if (!isRecord(oldState)) {
    throw new Error('Migration v2 -> v3 failed: State is not an object.')
  }
  const provinces = typeof oldState.provinces === 'number' ? oldState.provinces : 0
  const length = Number.isInteger(provinces) && provinces > 0 ? provinces : 0
  const existing: unknown = oldState.provinceBiomes ?? []
  if (!Array.isArray(existing)) {
    throw new Error("Migration v2 -> v3 failed: 'provinceBiomes' is not an array.")
  }
  // Keep every existing entry as is (bad ones fail validation); pad only the missing tail.
  const provinceBiomes: unknown[] = Array.from({ length }, (_, i) =>
    i < existing.length ? existing[i] : 'heartland',
  )

  // tickRemainderSeconds is absent from v2 saves: createInitialGameState defaults it to 0, and
  // validateGameState then checks it.
  const newPayload: unknown = {
    schemaVersion: 3,
    timestamp: oldData.timestamp,
    state: { ...oldState, capturedProvincesCount: 0, provinceBiomes },
  }
  return newPayload
}

/** Legacy resolver keys of schema 3 saves and their schema 4 names. */
const RESOLVER_RENAMES: Readonly<Record<string, ResolverKey>> = {
  'law:isolationism': 'max_3_provinces',
  'law:provincial_tithe': 'per_province',
  'law:border_fortifications': 'per_province',
  'law:feudal_levy': 'per_100_free_serfs',
  'law:monastic_scriptoria': 'per_clergy',
  'perk:iron_fist': 'unrest_at_least_30',
}

/**
 * Maps a modifier of the removed `threat_mitigation_rate` stat to its replacement, or drops it
 * (returns undefined) when its source is unknown: the stat was never read by the engine.
 */
function migrateThreatMitigation(modifier: Record<string, unknown>): unknown {
  if (modifier.source === 'archive:spymaster_network') {
    return { ...modifier, stat: 'scout_uncertainty_margin', op: 'add', value: -0.12 }
  }
  if (modifier.source === 'dilemma:princely_cousin') {
    return { ...modifier, stat: 'threat_power', op: 'mul', value: 1.15 }
  }
  return undefined
}

/** Faction a legacy target gets from its loot type, which the faction now decides. */
const LEGACY_LOOT_FACTIONS: Readonly<Record<string, FactionId>> = {
  ap: 'mercenaries',
  population: 'outlaws',
  soldiers: 'barons',
  mixed: 'steppe_horsemen',
}

/**
 * Adds the perceived power band and the faction that schema 3 targets lack: the band is centered
 * on the real power, the faction is the one whose loot matches the saved loot type.
 */
function migrateCampaignTarget(target: unknown): unknown {
  if (!isRecord(target) || target.perceivedMin !== undefined) return target
  const { power, uncertaintyMargin } = target
  if (typeof power !== 'number' || typeof uncertaintyMargin !== 'number') return target
  const factionId =
    typeof target.lootType === 'string' && Object.hasOwn(LEGACY_LOOT_FACTIONS, target.lootType)
      ? LEGACY_LOOT_FACTIONS[target.lootType]
      : undefined
  return {
    ...target,
    factionId,
    perceivedMin: Math.round(power * (1 - uncertaintyMargin)),
    perceivedMax: Math.round(power * (1 + uncertaintyMargin)),
  }
}

/**
 * Migrates a schema v3 save payload to schema v4.
 * Rebuilds `ruleFlags` from the `rule_flag` effects of the laws in `activeLaws` (catalog lookup,
 * deduplicated, unknown law ids skipped for validation to reject), sets `currentThreatId` to
 * null, renames the legacy `resolverKey` of saved `activeModifiers` (`RESOLVER_RENAMES`), maps or
 * drops the modifiers of the removed `threat_mitigation_rate` stat and adds the perceived band to
 * a saved `currentTarget` with its faction.
 *
 * @param oldData - Raw v3 payload to migrate.
 * @returns Migrated SerializedSavePayload conforming to schema v4.
 */
export function migrateV3ToV4(oldData: unknown): unknown {
  if (!isSerializedSavePayload(oldData)) {
    throw new Error('Migration v3 -> v4 failed: Source data is not a valid SerializedSavePayload.')
  }

  const oldState: unknown = oldData.state
  if (!isRecord(oldState)) {
    throw new Error('Migration v3 -> v4 failed: State is not an object.')
  }
  const laws: unknown = oldState.activeLaws ?? []
  if (!Array.isArray(laws)) {
    throw new Error("Migration v3 -> v4 failed: 'activeLaws' is not an array.")
  }
  const ruleFlags: RuleFlag[] = []
  for (const lawId of laws) {
    const law =
      typeof lawId === 'string' && Object.hasOwn(LAWS_DATA, lawId) ? LAWS_DATA[lawId] : undefined
    for (const effect of law?.effects ?? []) {
      if (effect.type === 'rule_flag' && !ruleFlags.includes(effect.flag)) {
        ruleFlags.push(effect.flag)
      }
    }
  }

  const newState: Record<string, unknown> = { ...oldState, ruleFlags, currentThreatId: null }
  const oldModifiers: unknown = oldState.activeModifiers
  if (Array.isArray(oldModifiers)) {
    newState.activeModifiers = oldModifiers
      .map((modifier: unknown) => {
        if (!isRecord(modifier)) return modifier
        if (modifier.stat === 'threat_mitigation_rate') return migrateThreatMitigation(modifier)
        if (typeof modifier.resolverKey !== 'string') return modifier
        const renamed = Object.hasOwn(RESOLVER_RENAMES, modifier.resolverKey)
          ? RESOLVER_RENAMES[modifier.resolverKey]
          : undefined
        return renamed === undefined ? modifier : { ...modifier, resolverKey: renamed }
      })
      .filter((modifier: unknown) => modifier !== undefined)
  }
  if (oldState.currentTarget !== undefined) {
    newState.currentTarget = migrateCampaignTarget(oldState.currentTarget)
  }

  const newPayload: unknown = {
    schemaVersion: 4,
    timestamp: oldData.timestamp,
    state: newState,
  }
  return newPayload
}

/**
 * Migrates a schema v4 save payload to schema v5.
 * Moves the state's `archivePoints` into a new payload `archive` (no perk, no feat) and resets
 * the run points to 0, sets `peakActiveLaws` and `peakProvinces` from the current
 * `activeLaws.length` and `provinces`, and sets `archiveConcluded` to false.
 *
 * @param oldData - Raw v4 payload to migrate.
 * @returns Migrated payload conforming to schema v5.
 */
export function migrateV4ToV5(oldData: unknown): unknown {
  if (!isSerializedSavePayload(oldData)) {
    throw new Error('Migration v4 -> v5 failed: Source data is not a valid SerializedSavePayload.')
  }
  const oldState: unknown = oldData.state
  if (!isRecord(oldState)) {
    throw new Error('Migration v4 -> v5 failed: State is not an object.')
  }
  const laws = Array.isArray(oldState.activeLaws) ? oldState.activeLaws : []
  const provinces = typeof oldState.provinces === 'number' ? oldState.provinces : 0
  const archive: unknown = {
    ...createArchiveData(),
    points: typeof oldState.archivePoints === 'number' ? oldState.archivePoints : 0,
  }
  const newPayload: unknown = {
    schemaVersion: 5,
    timestamp: oldData.timestamp,
    state: {
      ...oldState,
      archivePoints: 0,
      archiveConcluded: false,
      peakActiveLaws: laws.length,
      peakProvinces: provinces,
    },
    archive,
  }
  return newPayload
}

/**
 * Migrates a schema v5 save payload to schema v6.
 * Moves a saved `EXPEDITION` to `AWAIT_RESUME`, drops `campaignsLaunchedThisDeadline` and starts the
 * conquest counts at 0. A null target stays null: `LAUNCH_ATTACK` generates one.
 *
 * @param oldData - Raw v5 payload to migrate.
 * @returns Migrated payload conforming to schema v6.
 */
export function migrateV5ToV6(oldData: unknown): unknown {
  if (!isSerializedSavePayload(oldData)) {
    throw new Error('Migration v5 -> v6 failed: Source data is not a valid SerializedSavePayload.')
  }
  const oldState: unknown = oldData.state
  if (!isRecord(oldState)) {
    throw new Error('Migration v5 -> v6 failed: State is not an object.')
  }
  const { campaignsLaunchedThisDeadline: _dropped, ...state } = oldState
  const newPayload: unknown = {
    ...oldData,
    schemaVersion: 6,
    state: {
      ...state,
      phase: state.phase === 'EXPEDITION' ? 'AWAIT_RESUME' : state.phase,
      conquestsThisAudit: 0,
      crownSurchargeSteps: 0,
    },
  }
  return newPayload
}

/**
 * Ordered registry of sequential version migrations.
 * Migrations chain sequentially: v1 -> v2 -> v3 -> v4 -> v5.
 */
export const MIGRATIONS: Record<number, MigrationFunction> = {
  1: migrateV1ToV2,
  2: migrateV2ToV3,
  3: migrateV3ToV4,
  4: migrateV4ToV5,
  5: migrateV5ToV6,
}

/**
 * Type guard validating if an unknown value is a well-formed SerializedSavePayload.
 *
 * @param value - Value to inspect.
 * @returns boolean indicating payload validity.
 */
export function isSerializedSavePayload(value: unknown): value is SerializedSavePayload {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  const candidate = value as Record<string, unknown>
  return (
    typeof candidate.schemaVersion === 'number' &&
    typeof candidate.timestamp === 'number' &&
    typeof candidate.state === 'object' &&
    candidate.state !== null
  )
}

/**
 * Recursively inspects a value to ensure all numbers are finite.
 * Rejects NaN, Infinity, -Infinity.
 */
function hasNonFiniteNumbers(obj: unknown): boolean {
  if (obj === null || obj === undefined) {
    return false
  }
  if (typeof obj === 'number') {
    return !Number.isFinite(obj)
  }
  if (typeof obj === 'object') {
    if (Array.isArray(obj)) {
      return obj.some(hasNonFiniteNumbers)
    }
    return Object.values(obj as Record<string, unknown>).some(hasNonFiniteNumbers)
  }
  return false
}

/**
 * Validates that all numeric fields in state are present, valid, and finite.
 *
 * @param state - State object to inspect.
 * @throws Error if NaN or non-finite values are found.
 */
function validateStateNumbers(state: Record<string, unknown>): void {
  const requiredNumericFields = [
    'ap',
    'totalPopulation',
    'freeSerfs',
    'provinces',
    'taxRate',
    'unrest',
    'strikes',
    'deadline',
    'deadlineTimeSeconds',
    'totalElapsedSeconds',
    'tickIndex',
  ]

  for (const field of requiredNumericFields) {
    const val = state[field]
    if (typeof val !== 'number' || !Number.isFinite(val)) {
      throw new Error(
        `Save import failed: State contains NaN or non-finite numerical values in '${field}'.`,
      )
    }
  }

  if (hasNonFiniteNumbers(state)) {
    throw new Error('Save import failed: State contains NaN or non-finite numerical values.')
  }
}

/**
 * Serializes a GameState and the archive into an exportable Base64 string with GRA-v1: prefix.
 * The JSON payload is `{ schemaVersion, timestamp, state, archive }` (GAME_RULES §18).
 *
 * @param state - The active GameState to serialize.
 * @param archive - The persistent archive to serialize with it.
 * @returns Encoded string safe for clipboard sharing.
 */
export function exportSaveToBase64(state: GameState, archive: ArchiveData): string {
  const payload: SerializedSavePayload = {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    timestamp: Date.now(),
    state,
    archive,
  }

  const json = JSON.stringify(payload)
  let base64: string

  if (typeof globalThis.btoa === 'function') {
    base64 = globalThis.btoa(unescape(encodeURIComponent(json)))
  } else if (typeof (globalThis as Record<string, unknown>).Buffer === 'function') {
    const Buf = (globalThis as Record<string, unknown>).Buffer as {
      from: (data: string, encoding?: string) => { toString: (enc: string) => string }
    }
    base64 = Buf.from(json, 'utf-8').toString('base64')
  } else {
    throw new Error('Base64 encoding not supported in this runtime environment.')
  }

  return `${SAVE_PREFIX}${base64}`
}

/**
 * Imports and deserializes a GameState and its archive from an exportable string.
 * Validates integrity prefix, executes sequential migrations, and ensures type safety. A save
 * older than schema 5 gets an archive holding its former `archivePoints`.
 *
 * @param encodedString - Raw encoded string with GRA-v1: prefix.
 * @returns Deserialized, migrated and validated state and archive.
 * @throws Error if the string is corrupt or malformed, or the state or archive is invalid.
 */
export function importSaveFromBase64(encodedString: string): ImportedSave {
  if (!encodedString || typeof encodedString !== 'string') {
    throw new Error('Save import failed: Input must be a non-empty string.')
  }

  const trimmed = encodedString.trim()
  if (!trimmed.startsWith(SAVE_PREFIX)) {
    throw new Error(
      `Save import failed: Invalid integrity prefix. Expected string starting with '${SAVE_PREFIX}'.`,
    )
  }

  const base64Data = trimmed.slice(SAVE_PREFIX.length)
  let jsonString: string

  try {
    if (typeof globalThis.atob === 'function') {
      jsonString = decodeURIComponent(escape(globalThis.atob(base64Data)))
    } else if (typeof (globalThis as Record<string, unknown>).Buffer === 'function') {
      const Buf = (globalThis as Record<string, unknown>).Buffer as {
        from: (data: string, encoding?: string) => { toString: (enc: string) => string }
      }
      jsonString = Buf.from(base64Data, 'base64').toString('utf-8')
    } else {
      throw new Error('Base64 decoding not supported in this runtime environment.')
    }
  } catch (err) {
    throw new Error(`Save import failed: Base64 decoding failed (${String(err)}).`)
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(jsonString)
  } catch (err) {
    throw new Error(`Save import failed: Malformed JSON payload (${String(err)}).`)
  }

  if (!isSerializedSavePayload(parsed)) {
    throw new Error('Save import failed: Payload does not conform to SerializedSavePayload schema.')
  }

  // Schema version validation
  if (!Number.isInteger(parsed.schemaVersion) || parsed.schemaVersion < 1) {
    throw new Error(
      `Save import failed: Invalid schema version ${parsed.schemaVersion}. Schema version must be an integer >= 1.`,
    )
  }

  if (parsed.schemaVersion > CURRENT_SCHEMA_VERSION) {
    throw new Error(
      `Save import failed: Unsupported future schema version ${parsed.schemaVersion}. Current engine schema version is ${CURRENT_SCHEMA_VERSION}.`,
    )
  }

  // Validate numeric values and field shapes in source state
  validateStateNumbers(parsed.state as unknown as Record<string, unknown>)
  assertPresentFieldShapes(parsed.state as unknown as Record<string, unknown>)

  let currentPayload: unknown = parsed
  let currentVersion = parsed.schemaVersion

  // Run sequential migrations pipeline
  while (currentVersion < CURRENT_SCHEMA_VERSION) {
    const migration = MIGRATIONS[currentVersion]
    if (!migration) {
      throw new Error(
        `Save import failed: Missing migration pipeline step for schema version ${currentVersion}.`,
      )
    }
    currentPayload = migration(currentPayload)
    currentVersion += 1
  }

  if (!isSerializedSavePayload(currentPayload)) {
    throw new Error('Save import failed: Migrated payload failed schema validation.')
  }

  // Validate numeric values in migrated state
  validateStateNumbers(currentPayload.state as unknown as Record<string, unknown>)
  assertPresentFieldShapes(currentPayload.state as unknown as Record<string, unknown>)

  // Fill missing fields with defaults, then reject anything the engine cannot run on
  const state = validateGameState(createInitialGameState(currentPayload.state))
  const archive = validateArchiveData(currentPayload.archive)
  return { state, archive }
}
