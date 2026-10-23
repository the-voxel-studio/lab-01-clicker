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
import { createArchiveData } from '@/core/archives'
import { createInitialGameState } from '@/core/state'
import { validateGameState } from '@/core/validation'
import { DILEMMAS_DATA } from '@/data/dilemmas'
import fixtureV1 from '../__fixtures__/saves/v1-save.json'
import fixtureV2 from '../__fixtures__/saves/v2-save.json'

function encode(payload: unknown): string {
  return `${SAVE_PREFIX}${Buffer.from(JSON.stringify(payload), 'utf-8').toString('base64')}`
}

function encodeCurrent(mutate: (state: Record<string, unknown>) => void): string {
  const state: Record<string, unknown> = { ...createInitialGameState() }
  mutate(state)
  return encode({
    schemaVersion: CURRENT_SCHEMA_VERSION,
    timestamp: 1,
    state,
    archive: createArchiveData(),
  })
}

describe('Save State Versioning & Migrations (Gate B)', () => {
  it('exports state to a Base64 string prefixed with GRA-v1:', () => {
    const state = createInitialGameState()
    state.ap = 999.5
    state.provinces = 4

    const encoded = exportSaveToBase64(state, createArchiveData())
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
    state.provinceBiomes = ['heartland', 'farmlands', 'trade_hub', 'stronghold', 'wilderness']
    state.freeSerfs = 195
    state.units.scribe = 15
    state.units.soldier = 10
    state.archivePoints = 2

    const encoded = exportSaveToBase64(state, createArchiveData())
    const imported = importSaveFromBase64(encoded).state

    expect(imported.ap).toBeCloseTo(1250.75, 2)
    expect(imported.totalPopulation).toBe(220)
    expect(imported.provinces).toBe(5)
    expect(imported.units.scribe).toBe(15)
    expect(imported.units.soldier).toBe(10)
    expect(imported.archivePoints).toBe(2)
  })

  it('loads and validates legacy save fixtures (v1-save.json) via v1 -> v5 migration pipeline', () => {
    expect(isSerializedSavePayload(fixtureV1)).toBe(true)
    expect(fixtureV1.schemaVersion).toBe(1)
    expect(CURRENT_SCHEMA_VERSION).toBe(5)

    // Encode raw v1 fixture directly into save string
    const jsonStr = JSON.stringify(fixtureV1)
    const base64Str = Buffer.from(jsonStr, 'utf-8').toString('base64')
    const encodedV1 = `${SAVE_PREFIX}${base64Str}`

    const imported = importSaveFromBase64(encodedV1).state
    expect(importSaveFromBase64(encodedV1).archive.points).toBe(1)
    expect(imported.archivePoints).toBe(0)
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
    expect(imported.capturedProvincesCount).toBe(0)
    expect(() => validateGameState(imported)).not.toThrow()
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

  it('imports a real v2 export into a valid v3 state', () => {
    expect(fixtureV2.schemaVersion).toBe(2)
    expect('capturedProvincesCount' in fixtureV2.state).toBe(false)

    const imported = importSaveFromBase64(encode(fixtureV2)).state
    expect(imported.runId).toBe('fixture_run_v2')
    expect(imported.capturedProvincesCount).toBe(0)
    expect(imported.provinces).toBe(4)
    expect(imported.provinceBiomes).toEqual(['heartland', 'farmlands', 'trade_hub', 'heartland'])
    expect(imported.units.scribe).toBe(6)
    expect(() => validateGameState(imported)).not.toThrow()
  })

  it('rebuilds rule flags from active laws when importing a schema 3 save', () => {
    const state: Record<string, unknown> = { ...createInitialGameState() }
    delete state.ruleFlags
    delete state.currentThreatId
    state.activeLaws = ['law:sanctuary_rights', 'law:papal_concordat', 'law:royal_scriptorium']
    const imported = importSaveFromBase64(encode({ schemaVersion: 3, timestamp: 1, state })).state
    expect([...imported.ruleFlags].sort()).toEqual(['law:papal_concordat', 'law:sanctuary_rights'])
    expect(imported.currentThreatId).toBeNull()
  })

  it('rejects an unknown rule flag and a bad currentThreatId', () => {
    expect(() =>
      importSaveFromBase64(
        encodeCurrent((s) => {
          s.ruleFlags = ['law:nope']
        }),
      ),
    ).toThrow(/ruleFlags/)
    for (const bad of [-1, 1.5, 'x', 2, 11]) {
      expect(() =>
        importSaveFromBase64(
          encodeCurrent((s) => {
            s.currentThreatId = bad
          }),
        ),
      ).toThrow(/currentThreatId/)
    }
  })

  it('rebuilds provinceBiomes to match provinces when migrating v2 to v3', () => {
    const pad = structuredClone(fixtureV2)
    pad.state.provinces = 6
    expect(importSaveFromBase64(encode(pad)).state.provinceBiomes).toEqual([
      'heartland',
      'farmlands',
      'trade_hub',
      'heartland',
      'heartland',
      'heartland',
    ])

    const cut = structuredClone(fixtureV2)
    cut.state.provinces = 2
    expect(importSaveFromBase64(encode(cut)).state.provinceBiomes).toEqual([
      'heartland',
      'farmlands',
    ])
  })

  it('produces a valid state when a v1 save has zero provinces', () => {
    const v1 = structuredClone(fixtureV1)
    v1.state.provinces = 0
    const imported = importSaveFromBase64(encode(v1)).state
    expect(imported.provinces).toBe(0)
    expect(imported.provinceBiomes).toEqual([])
  })

  it('rejects an unknown phase', () => {
    expect(() =>
      importSaveFromBase64(
        encodeCurrent((s) => {
          s.phase = 'FOO'
        }),
      ),
    ).toThrow(/phase/)
  })

  it('rejects an unknown unit id', () => {
    expect(() =>
      importSaveFromBase64(
        encodeCurrent((s) => {
          s.units = { dragon: 1 }
        }),
      ),
    ).toThrow(/units\.dragon/)
  })

  it('rejects a negative or fractional unit count', () => {
    expect(() =>
      importSaveFromBase64(
        encodeCurrent((s) => {
          s.units = { scribe: -1 }
        }),
      ),
    ).toThrow(/units\.scribe/)
    expect(() =>
      importSaveFromBase64(
        encodeCurrent((s) => {
          s.units = { scribe: 1.5 }
        }),
      ),
    ).toThrow(/units\.scribe/)
  })

  it('rejects unknown biomes, laws, and modifier fields', () => {
    expect(() =>
      importSaveFromBase64(
        encodeCurrent((s) => {
          s.provinceBiomes = ['heartland', 'heartland', 'moon']
        }),
      ),
    ).toThrow(/provinceBiomes/)
    expect(() =>
      importSaveFromBase64(
        encodeCurrent((s) => {
          s.activeLaws = ['law:nope']
        }),
      ),
    ).toThrow(/activeLaws/)
    const badModifiers: unknown[] = [
      { source: 'x', stat: 'bogus', op: 'add', value: 1 },
      { source: 'x', stat: 'gross_ap_rate', op: 'bogus', value: 1 },
      { source: 'x', stat: 'gross_ap_rate', op: 'add', value: 1, resolverKey: 'bogus' },
    ]
    for (const modifier of badModifiers) {
      expect(() =>
        importSaveFromBase64(
          encodeCurrent((s) => {
            s.activeModifiers = [modifier]
          }),
        ),
      ).toThrow(/activeModifiers\[0\]/)
    }
  })

  it('rejects a broken province invariant and a broken population invariant', () => {
    expect(() =>
      importSaveFromBase64(
        encodeCurrent((s) => {
          s.provinces = 5
        }),
      ),
    ).toThrow(/provinces/)
    expect(() =>
      importSaveFromBase64(
        encodeCurrent((s) => {
          s.freeSerfs = 1
        }),
      ),
    ).toThrow(/totalPopulation/)
  })

  it('rejects an invalid capturedProvincesCount', () => {
    expect(() =>
      importSaveFromBase64(
        encodeCurrent((s) => {
          s.capturedProvincesCount = -1
        }),
      ),
    ).toThrow(/capturedProvincesCount/)
  })

  it('validates tickRemainderSeconds and defaults it when absent', () => {
    for (const bad of [-0.01, 0.05, 1]) {
      expect(() =>
        importSaveFromBase64(
          encodeCurrent((s) => {
            s.tickRemainderSeconds = bad
          }),
        ),
      ).toThrow(/tickRemainderSeconds/)
    }
    const kept = importSaveFromBase64(
      encodeCurrent((s) => {
        s.tickRemainderSeconds = 0.02
      }),
    ).state
    expect(kept.tickRemainderSeconds).toBe(0.02)
    const absent = importSaveFromBase64(
      encodeCurrent((s) => {
        delete s.tickRemainderSeconds
      }),
    ).state
    expect(absent.tickRemainderSeconds).toBe(0)
  })

  it('rejects present fields with a wrong shape instead of defaulting them', () => {
    const cases: Array<[string, unknown, RegExp]> = [
      ['units', null, /units/],
      ['activeLaws', null, /activeLaws/],
      ['activeModifiers', null, /activeModifiers/],
      ['currentLawDraft', 'x', /currentLawDraft/],
      ['edictUsageCounts', null, /edictUsageCounts/],
      ['unlockedPatents', 5, /unlockedPatents/],
      ['rngStreams', null, /rngStreams/],
    ]
    for (const [field, bad, pattern] of cases) {
      expect(() =>
        importSaveFromBase64(
          encodeCurrent((s) => {
            s[field] = bad
          }),
        ),
      ).toThrow(pattern)
    }
    expect(() =>
      importSaveFromBase64(
        encodeCurrent((s) => {
          s.provinceBiomes = 'x'
          s.provinces = 3
        }),
      ),
    ).toThrow(/provinceBiomes/)
  })

  it('rejects a null entry in provinceBiomes during v2 migration instead of padding it', () => {
    const bad = structuredClone(fixtureV2)
    const biomes: unknown[] = bad.state.provinceBiomes
    biomes[1] = null
    expect(() => importSaveFromBase64(encode(bad))).toThrow(/provinceBiomes\[1\]/)
  })

  it('still imports a save that lacks optional fields', () => {
    const imported = importSaveFromBase64(
      encodeCurrent((s) => {
        delete s.currentLawDraft
        delete s.edictUsageCounts
        delete s.clickTokens
      }),
    ).state
    expect(imported.currentLawDraft).toEqual([])
    expect(imported.clickTokens).toBeGreaterThan(0)
  })

  it('rejects a bad law draft id, a bad dilemma id, and negative freeSerfs', () => {
    expect(() =>
      importSaveFromBase64(
        encodeCurrent((s) => {
          s.currentLawDraft = ['law:nope']
        }),
      ),
    ).toThrow(/currentLawDraft\[0\]/)
    expect(() =>
      importSaveFromBase64(
        encodeCurrent((s) => {
          s.currentDilemmaId = 'nope'
        }),
      ),
    ).toThrow(/currentDilemmaId/)
    expect(() =>
      importSaveFromBase64(
        encodeCurrent((s) => {
          s.freeSerfs = -5
          s.totalPopulation = 95
          s.units = { scribe: 100 }
        }),
      ),
    ).toThrow(/freeSerfs/)
  })

  it('rejects a COUNCIL_DILEMMA save without a drafted dilemma', () => {
    const encoded = encodeCurrent((state) => {
      state.phase = 'COUNCIL_DILEMMA'
      state.currentDilemmaId = null
    })
    expect(() => importSaveFromBase64(encoded)).toThrow(/currentDilemmaId/)
  })

  it('rejects a COUNCIL_DILEMMA save whose drafted dilemma has no affordable choice', () => {
    const silos = DILEMMAS_DATA['dilemma:rotting_grain_silos']!
    const encoded = encodeCurrent((state) => {
      state.ap = 100
      state.freeSerfs = 10
      state.totalPopulation = 10
      state.phase = 'COUNCIL_DILEMMA'
      state.currentDilemmaId = silos.id
    })
    expect(() => importSaveFromBase64(encoded)).toThrow(/currentDilemmaId/)
  })

  it('accepts a COUNCIL_DILEMMA save with a drafted dilemma and an affordable choice', () => {
    const taxable = DILEMMAS_DATA['dilemma:taxable_windows']!
    const encoded = encodeCurrent((state) => {
      state.phase = 'COUNCIL_DILEMMA'
      state.currentDilemmaId = taxable.id
      state.ap = 10000
      state.freeSerfs = 100
      state.totalPopulation = 100
    })
    expect(importSaveFromBase64(encoded).state.currentDilemmaId).toBe(taxable.id)
  })
})
