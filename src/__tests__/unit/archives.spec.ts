/**
 * National Archives meta progression, feats award, schema 5 envelope and edict catalog.
 *
 * @module __tests__/unit/archives.spec
 */

import { describe, it, expect } from 'vitest'
import { concludeRun, createArchiveData, investPerk, resetPerks, startRun } from '@/core/archives'
import { createInitialGameState } from '@/core/state'
import { dispatch } from '@/core/commands'
import { DEFAULT_ENGINE_CONFIG } from '@/core/config'
import { calculateGrossApRate, calculateMaxPopulation } from '@/core/engine'
import { calculateOrderCaps } from '@/core/formulas'
import { extractRawEvaluationState } from '@/core/modifiers'
import { addProvince, removeLastProvince } from '@/core/provinces'
import {
  CURRENT_SCHEMA_VERSION,
  SAVE_PREFIX,
  exportSaveToBase64,
  importSaveFromBase64,
} from '@/core/migrations'
import { ARCHIVES_DATA, applyArchivePerks, type ArchivePerkId } from '@/data/archives'
import { evaluateFeats } from '@/data/feats'
import { EDICTS_DATA } from '@/data/edicts'
import { dilemmaOf } from './catalog_lookup'
import { applyEffect } from '@/core/modifiers'

function encode(payload: unknown): string {
  return `${SAVE_PREFIX}${Buffer.from(JSON.stringify(payload), 'utf-8').toString('base64')}`
}

describe('National Archives meta progression', () => {
  it('starting treasury perk adds 150 AP', () => {
    const archive = createArchiveData()
    archive.points = 1
    expect(investPerk(archive, 'starting_treasury').success).toBe(true)

    const bare = createInitialGameState({ seed: 7 })
    const perked = startRun(archive, 7)
    expect(perked.ap).toBe(bare.ap + 150)
    expect(perked.seed).toBe(7)
    expect(perked.archivePoints).toBe(0)
  })

  it('perks cost points and can be reset', () => {
    const archive = createArchiveData()
    archive.points = 4
    expect(investPerk(archive, 'standing_vanguard').success).toBe(true)
    expect(archive.points).toBe(1)
    expect(archive.investedPerks).toEqual(['standing_vanguard'])

    const before = structuredClone(archive)
    expect(investPerk(archive, 'standing_vanguard').success).toBe(false)
    expect(investPerk(archive, 'ancient_cadastre').success).toBe(false)
    expect(investPerk(archive, 'no_such_perk').success).toBe(false)
    expect(archive).toEqual(before)

    resetPerks(archive)
    expect(archive.points).toBe(4)
    expect(archive.investedPerks).toEqual([])
    expect(startRun(archive, 1).units.soldier).toBe(0)
  })

  it('concluding a pacifist victory unlocks Royal Pacifist once and adds 0.5 point', () => {
    const archive = createArchiveData()
    const state = createInitialGameState()
    state.isGameOver = true
    state.isVictory = true
    state.phase = 'RUN_VICTORY'
    state.taxRateViolated15 = true
    state.strikes = 1
    state.archivePoints = 3

    const first = concludeRun(archive, state)
    expect(first.newFeats).toEqual(['royal_pacifist'])
    expect(first.pointsEarned).toBe(3.5)
    expect(archive.points).toBe(3.5)
    expect(archive.unlockedFeats).toEqual(['royal_pacifist'])

    expect(concludeRun(archive, state)).toEqual({ newFeats: [], pointsEarned: 0 })
    expect(archive.points).toBe(3.5)

    const nextRun = createInitialGameState({ seed: 2 })
    nextRun.isGameOver = true
    nextRun.isVictory = true
    nextRun.taxRateViolated15 = true
    nextRun.strikes = 1
    const second = concludeRun(archive, nextRun)
    expect(second.newFeats).toEqual([])
    expect(second.pointsEarned).toBe(0)
    expect(archive.unlockedFeats).toEqual(['royal_pacifist'])
  })

  it('burning a record at run start costs 1 archive point at conclusion', () => {
    const archive = createArchiveData()
    archive.points = 3
    const state = startRun(archive, 4)
    const burn = dilemmaOf('dilemma:cabinet_scarcity').choices[1]
    for (const effect of burn.effects) applyEffect(effect, state)
    expect(state.archivePoints).toBe(-1)

    const imported = importSaveFromBase64(exportSaveToBase64(state, archive))
    expect(imported.state.archivePoints).toBe(-1)

    expect(concludeRun(archive, state)).toEqual({ newFeats: [], pointsEarned: -1 })
    expect(archive.points).toBe(2)
  })

  it('clamps the archive total at 0 when a run ends with negative points', () => {
    const archive = createArchiveData()
    const state = startRun(archive, 4)
    state.archivePoints = -2
    expect(concludeRun(archive, state).pointsEarned).toBe(-2)
    expect(archive.points).toBe(0)
  })

  it('export and import keep the archive', () => {
    const archive = createArchiveData()
    archive.points = 12.5
    investPerk(archive, 'sixth_law_slot')
    archive.unlockedFeats.push('scout_butcher')
    const state = startRun(archive, 11)
    state.archivePoints = 2

    const imported = importSaveFromBase64(exportSaveToBase64(state, archive))
    expect(imported.archive).toEqual(archive)
    expect(imported.state.archivePoints).toBe(2)
    expect(imported.state.seed).toBe(11)
  })

  it('moves the archive points of a schema 4 save into the archive', () => {
    const state: Record<string, unknown> = { ...createInitialGameState() }
    state.archivePoints = 6
    state.activeLaws = ['law:royal_scriptorium', 'law:general_cadastre']
    state.provinces = 4
    state.provinceBiomes = ['heartland', 'heartland', 'heartland', 'farmlands']
    for (const key of ['peakActiveLaws', 'peakProvinces', 'archiveConcluded']) {
      delete state[key]
    }
    const imported = importSaveFromBase64(encode({ schemaVersion: 4, timestamp: 1, state }))
    expect(CURRENT_SCHEMA_VERSION).toBe(6)
    expect(imported.archive).toEqual({ points: 6, investedPerks: [], unlockedFeats: [] })
    expect(imported.state.archivePoints).toBe(0)
    expect(imported.state.peakActiveLaws).toBe(2)
    expect(imported.state.peakProvinces).toBe(4)
    expect(imported.state.archiveConcluded).toBe(false)
  })

  it('rejects a schema 5 save with a missing or invalid archive', () => {
    const state = createInitialGameState()
    const bad = [
      undefined,
      { points: -1, investedPerks: [], unlockedFeats: [] },
      { points: Number.NaN, investedPerks: [], unlockedFeats: [] },
      { points: 1, investedPerks: ['bogus'], unlockedFeats: [] },
      { points: 1, investedPerks: ['starting_treasury', 'starting_treasury'], unlockedFeats: [] },
      { points: 1, investedPerks: [], unlockedFeats: ['bogus'] },
      { points: 1, investedPerks: [], unlockedFeats: ['royal_pacifist', 'royal_pacifist'] },
    ]
    for (const archive of bad) {
      expect(() =>
        importSaveFromBase64(encode({ schemaVersion: 5, timestamp: 1, state, archive })),
      ).toThrow(/archive/)
    }
  })

  it('RESTART_RUN starts a bare run with no run points and no perks', () => {
    const state = createInitialGameState({ seed: 3 })
    state.archivePoints = 4
    state.phase = 'RUN_DEFEAT'
    expect(dispatch(state, { type: 'RESTART_RUN', seed: 5 }).success).toBe(true)
    expect(state.archivePoints).toBe(0)
    expect(state.archiveConcluded).toBe(false)
    expect(state.activeModifiers).toEqual([])
  })

  it('primogeniture decrees raise the civil and admin caps by 8% and leave housing and military alone', () => {
    const caps = (perks: ArchivePerkId[]) => {
      const state = createInitialGameState()
      applyArchivePerks(state, perks)
      const housing = calculateMaxPopulation(state, DEFAULT_ENGINE_CONFIG)
      const orderCaps = calculateOrderCaps(
        housing,
        state.activeModifiers,
        extractRawEvaluationState(state),
        DEFAULT_ENGINE_CONFIG,
      )
      return { housing, orderCaps }
    }
    expect(caps([])).toEqual({ housing: 750, orderCaps: { admin: 112, military: 90, people: 187 } })
    expect(caps(['primogeniture_decrees'])).toEqual({
      housing: 750,
      orderCaps: { admin: 121, military: 90, people: 202 },
    })
  })

  it('exposes perk costs from the catalog', () => {
    expect(ARCHIVES_DATA.sixth_law_slot.cost).toBe(10)
  })
})

describe('Feats tracked over the whole run', () => {
  it('The Six Seals counts the peak of active laws', () => {
    const archive = createArchiveData()
    archive.points = 10
    investPerk(archive, 'sixth_law_slot')
    const state = startRun(archive, 1)
    state.phase = 'COUNCIL_LAWS'
    state.activeLaws = [
      'law:royal_scriptorium',
      'law:general_cadastre',
      'law:census_edict',
      'law:standing_garrisons',
      'law:merit_pay',
    ]
    state.currentLawDraft = ['law:scorched_earth']
    expect(dispatch(state, { type: 'ENACT_LAW', lawId: 'law:scorched_earth' }).success).toBe(true)
    expect(state.peakActiveLaws).toBe(6)

    state.activeLaws = state.activeLaws.slice(0, 2)
    expect(evaluateFeats(state)).toContain('the_six_seals')
  })

  it('Imperial Barony counts the peak of provinces', () => {
    const state = createInitialGameState()
    for (let i = 0; i < 5; i++) addProvince(state, 'heartland')
    expect(state.peakProvinces).toBe(8)
    removeLastProvince(state)
    removeLastProvince(state)
    expect(state.provinces).toBe(6)
    expect(evaluateFeats(state)).toContain('imperial_barony')
  })

  it('Iron Bailout needs an accepted Lombard Bailout and a victory', () => {
    const state = createInitialGameState()
    state.phase = 'LOMBARD_OFFER'
    state.bankruptcyGraceTimer = 20
    expect(dispatch(state, { type: 'ACCEPT_LOMBARD_LOAN' }).success).toBe(true)
    expect(evaluateFeats(state)).not.toContain('iron_bailout')
    state.isVictory = true
    expect(evaluateFeats(state)).toContain('iron_bailout')
  })
})

describe('Edict catalog is the single source of edict numbers', () => {
  it('Forced Tithe reads its unrest from EDICTS_DATA', () => {
    const values = EDICTS_DATA.forced_tithe.values
    const original = values.unrest
    try {
      values.unrest = 12
      const state = createInitialGameState()
      state.unrest = 0
      expect(dispatch(state, { type: 'ENACT_EDICT', edictId: 'forced_tithe' }).success).toBe(true)
      expect(state.unrest).toBe(12)
      expect(state.forcedTitheFreezeTimer).toBe(values.growthFreezeSeconds)
    } finally {
      values.unrest = original
    }
  })

  it('keeps the GAME_RULES §11 numbers', () => {
    expect(EDICTS_DATA.forced_tithe.values).toEqual({
      pollTaxSeconds: 30,
      unrest: 35,
      growthFreezeSeconds: 20,
    })
    expect(EDICTS_DATA.church_seizure.values).toEqual({
      maxUsesPerRun: 2,
      minPayout: 300,
      grossRateSeconds: 25,
      pacificationMultiplier: 0.5,
      pacificationSeconds: 60,
      unrest: 10,
    })
    expect(EDICTS_DATA.grand_festival.values).toEqual({
      minCost: 100,
      treasuryShare: 0.2,
      grossRateSeconds: 30,
      unrestRelief: 20,
    })
  })

  it('Church Seizure escalates with prior uses and stops at its cap', () => {
    const state = createInitialGameState()
    state.unrest = 0
    state.edictUsageCounts.church_seizure = 1
    const gross = calculateGrossApRate(state, DEFAULT_ENGINE_CONFIG).total
    const ap = state.ap
    expect(dispatch(state, { type: 'ENACT_EDICT', edictId: 'church_seizure' }).success).toBe(true)
    expect(state.ap).toBe(ap + Math.max(300, 25 * gross))
    expect(state.unrest).toBe(15)
    expect(state.activeModifiers.at(-1)?.expiresAt).toBe(90)

    state.deadline += 1
    expect(dispatch(state, { type: 'ENACT_EDICT', edictId: 'church_seizure' }).success).toBe(false)
  })
})
