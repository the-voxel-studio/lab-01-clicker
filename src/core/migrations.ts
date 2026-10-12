/**
 * Versioned Save State & Sequential Typed Migrations Pipeline.
 * Enforces zero any, strict unknown guards, and Base64 clipboard format with GRA-v1: prefix.
 *
 * @module core/migrations
 */

import type { GameState } from './types'
import { createInitialGameState } from './state'

/** Active master save schema version. */
export const CURRENT_SCHEMA_VERSION = 1

/** Integrity prefix for clipboard import and export strings. */
export const SAVE_PREFIX = 'GRA-v1:'

/** Standard versioned serializable payload contract. */
export interface SerializedSavePayload {
  schemaVersion: number
  timestamp: number
  state: GameState
}

/**
 * Migration transform function signature.
 * Strictly typed with unknown -> unknown; zero any.
 */
export type MigrationFunction = (oldData: unknown) => unknown

/**
 * Ordered registry of sequential version migrations.
 * Migrations chain sequentially: v1 -> v2 -> v3 etc.
 */
export const MIGRATIONS: Record<number, MigrationFunction> = {
  // Version 1 is initial schema baseline; future migrations registered here:
  // 1: (v0Data: unknown) => migrateV0ToV1(v0Data),
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
 * Serializes a GameState into an exportable Base64 string with GRA-v1: prefix.
 *
 * @param state - The active GameState to serialize.
 * @returns Encoded string safe for clipboard sharing.
 */
export function exportSaveToBase64(state: GameState): string {
  const payload: SerializedSavePayload = {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    timestamp: Date.now(),
    state,
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
 * Imports and deserializes a GameState from an exportable string.
 * Validates integrity prefix, executes sequential migrations, and ensures type safety.
 *
 * @param encodedString - Raw encoded string with GRA-v1: prefix.
 * @returns Deserialized and migrated GameState.
 * @throws Error if the string is corrupt or malformed.
 */
export function importSaveFromBase64(encodedString: string): GameState {
  if (!encodedString || typeof encodedString !== 'string') {
    throw new Error('Save import failed: Input must be a non-empty string.')
  }

  const trimmed = encodedString.trim()
  if (!trimmed.startsWith(SAVE_PREFIX)) {
    throw new Error(
      `Save import failed: Invalid integrity prefix. Expected string starting with '${SAVE_PREFIX}'.`
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

  let currentPayload: unknown = parsed
  let currentVersion = parsed.schemaVersion

  // Run sequential migrations pipeline
  while (currentVersion < CURRENT_SCHEMA_VERSION) {
    const migration = MIGRATIONS[currentVersion]
    if (!migration) {
      throw new Error(`Save import failed: Missing migration pipeline step for schema version ${currentVersion}.`)
    }
    currentPayload = migration(currentPayload)
    currentVersion += 1
  }

  if (!isSerializedSavePayload(currentPayload)) {
    throw new Error('Save import failed: Migrated payload failed schema validation.')
  }

  // Ensure state has complete fields with safe fallback defaults
  return createInitialGameState(currentPayload.state)
}
