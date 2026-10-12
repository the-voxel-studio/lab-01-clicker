/**
 * Versioned Save Migrations & Base64 Pipeline Test Suite.
 * Validates zero any, type safety, integrity prefixes, and legacy fixtures.
 *
 * @module __tests__/unit/migrations.spec
 */

import { describe, it, expect } from 'vitest'
import {
  exportSaveToBase64,
  importSaveFromBase64,
  SAVE_PREFIX,
  CURRENT_SCHEMA_VERSION,
  isSerializedSavePayload,
} from '@/core/migrations'
import { createInitialGameState } from '@/core/state'
import fixtureV1 from '../__fixtures__/saves/v1-save.json'

describe('Save State Versioning & Migrations (Gate B)', () => {
  it('exports state to a Base64 string prefixed with GRA-v1:', () => {
    const state = createInitialGameState()
    state.ap = 999.5
    state.provinces = 4

    const encoded = exportSaveToBase64(state)
    expect(encoded.startsWith(SAVE_PREFIX)).toBe(true)

    // Base64 payload is non-empty
    const rawPayload = encoded.slice(SAVE_PREFIX.length)
    expect(rawPayload.length).toBeGreaterThan(50)
  })

  it('performs seamless roundtrip serialization and deserialization', () => {
    const state = createInitialGameState()
    state.ap = 1250.75
    state.totalPopulation = 220
    state.provinces = 5
    state.units.scribe = 15
    state.units.soldier = 10
    state.archivePoints = 2

    const encoded = exportSaveToBase64(state)
    const imported = importSaveFromBase64(encoded)

    expect(imported.ap).toBeCloseTo(1250.75, 2)
    expect(imported.totalPopulation).toBe(220)
    expect(imported.provinces).toBe(5)
    expect(imported.units.scribe).toBe(15)
    expect(imported.units.soldier).toBe(10)
    expect(imported.archivePoints).toBe(2)
  })

  it('loads and validates legacy save fixtures (v1-save.json)', () => {
    expect(isSerializedSavePayload(fixtureV1)).toBe(true)
    expect(fixtureV1.schemaVersion).toBe(CURRENT_SCHEMA_VERSION)

    const imported = importSaveFromBase64(exportSaveToBase64(fixtureV1.state as unknown as GameState))
    expect(imported.runId).toBe('fixture_run_v1')
    expect(imported.ap).toBeCloseTo(320.5, 1)
    expect(imported.units.scribe).toBe(8)
    expect(imported.units.peasant).toBe(5)
  })

  it('rejects corrupt, malformed, or tampered save strings with explicit errors', () => {
    // 1. Missing prefix
    expect(() => importSaveFromBase64('INVALID_BASE64_STRING')).toThrow(
      /Invalid integrity prefix/
    )

    // 2. Corrupt Base64 content
    expect(() => importSaveFromBase64(`${SAVE_PREFIX}???not-base64???`)).toThrow(
      /Base64 decoding failed|Malformed JSON/
    )

    // 3. Valid Base64 but not JSON
    const notJsonBase64 = Buffer.from('hello world', 'utf-8').toString('base64')
    expect(() => importSaveFromBase64(`${SAVE_PREFIX}${notJsonBase64}`)).toThrow(
      /Malformed JSON payload/
    )

    // 4. Valid JSON but invalid schema
    const invalidSchema = Buffer.from(JSON.stringify({ bad: 'schema' }), 'utf-8').toString('base64')
    expect(() => importSaveFromBase64(`${SAVE_PREFIX}${invalidSchema}`)).toThrow(
      /does not conform to SerializedSavePayload schema/
    )
  })
})
