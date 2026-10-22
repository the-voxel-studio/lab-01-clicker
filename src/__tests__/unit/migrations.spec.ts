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

  it('loads and validates legacy save fixtures (v1-save.json) via v1 -> v2 migration pipeline', () => {
    expect(isSerializedSavePayload(fixtureV1)).toBe(true)
    expect(fixtureV1.schemaVersion).toBe(1)
    expect(CURRENT_SCHEMA_VERSION).toBe(2)

    // Encode raw v1 fixture directly into save string
    const jsonStr = JSON.stringify(fixtureV1)
    const base64Str = Buffer.from(jsonStr, 'utf-8').toString('base64')
    const encodedV1 = `${SAVE_PREFIX}${base64Str}`

    const imported = importSaveFromBase64(encodedV1)
    expect(imported.runId).toBe('fixture_run_v1')
    expect(imported.ap).toBeCloseTo(320.5, 1)
    expect(imported.units.scribe).toBe(8)
    expect(imported.units.peasant).toBe(5)

    // Verify v2 injected properties
    expect(imported.provinceBiomes).toEqual(['heartland', 'heartland', 'heartland'])
    expect(imported.provinceBiomes.length).toBe(imported.provinces)
    expect(imported.rngStreams).toBeDefined()
    expect(typeof imported.rngStreams.click).toBe('number')
    expect(typeof imported.rngStreams.combat).toBe('number')
    expect(typeof imported.rngStreams.events).toBe('number')
    expect(typeof imported.rngStreams.council).toBe('number')
    expect(imported.desertionTimer).toBe(0)
    expect(imported.forcedTitheFreezeTimer).toBe(0)
    expect(imported.currentTarget).toBeNull()
    expect(imported.campaignsLaunchedThisDeadline).toBe(0)
    expect(imported.lastSurpriseRaidTime).toBe(-60)
    expect(imported.surpriseRaidTriggeredThisDeadline).toBe(false)
    expect(imported.disbandedMilitaryHistory).toEqual([])
    expect(imported.victoriesCount).toBe(0)
    expect(imported.lastEdictDeadline).toBe(0)
    expect(imported.edictUsageCounts).toEqual({
      forced_tithe: 0,
      church_seizure: 0,
      grand_festival: 0,
    })
    expect(imported.clickTokens).toBe(12)
    expect(imported.interimWarningOnTrack).toBeNull()
    expect(imported.pendingDeadlineAudit).toBe(false)
  })

  it('rejects corrupt, malformed, or tampered save strings with explicit errors', () => {
    // Missing prefix
    expect(() => importSaveFromBase64('INVALID_BASE64_STRING')).toThrow(/Invalid integrity prefix/)

    // Corrupt Base64 content
    expect(() => importSaveFromBase64(`${SAVE_PREFIX}???not-base64???`)).toThrow(
      /Base64 decoding failed|Malformed JSON/,
    )

    // Valid Base64 but not JSON
    const notJsonBase64 = Buffer.from('hello world', 'utf-8').toString('base64')
    expect(() => importSaveFromBase64(`${SAVE_PREFIX}${notJsonBase64}`)).toThrow(
      /Malformed JSON payload/,
    )

    // Valid JSON but invalid schema
    const invalidSchema = Buffer.from(JSON.stringify({ bad: 'schema' }), 'utf-8').toString('base64')
    expect(() => importSaveFromBase64(`${SAVE_PREFIX}${invalidSchema}`)).toThrow(
      /does not conform to SerializedSavePayload schema/,
    )
  })

  it('rejects unsupported future schema versions (schemaVersion > CURRENT_SCHEMA_VERSION)', () => {
    const futurePayload = {
      schemaVersion: CURRENT_SCHEMA_VERSION + 1,
      timestamp: Date.now(),
      state: createInitialGameState(),
    }
    const encoded = `${SAVE_PREFIX}${Buffer.from(JSON.stringify(futurePayload), 'utf-8').toString('base64')}`
    expect(() => importSaveFromBase64(encoded)).toThrow(/Unsupported future schema version/)
  })

  it('rejects invalid schema versions (schemaVersion < 1 or non-integer)', () => {
    const invalidVersionPayload = {
      schemaVersion: 0,
      timestamp: Date.now(),
      state: createInitialGameState(),
    }
    const encoded = `${SAVE_PREFIX}${Buffer.from(JSON.stringify(invalidVersionPayload), 'utf-8').toString('base64')}`
    expect(() => importSaveFromBase64(encoded)).toThrow(/Invalid schema version/)
  })

  it('rejects saves containing NaN or non-finite numerical values', () => {
    const corruptPayload = {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      timestamp: Date.now(),
      state: {
        ...createInitialGameState(),
        ap: null as unknown as number,
      },
    }
    const encoded = `${SAVE_PREFIX}${Buffer.from(JSON.stringify(corruptPayload), 'utf-8').toString('base64')}`
    expect(() => importSaveFromBase64(encoded)).toThrow(/non-finite|invalid/i)
  })
})
