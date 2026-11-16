/**
 * Plan V2_DIFFICULTY, Task 5: a hard reign speaks in a colder voice, never with other figures or
 * other orders.
 *
 * @module __tests__/unit/level_tone.spec
 */

import { describe, expect, it } from 'vitest'
import { createInitialGameState } from '@/core/state'
import type { AuditOutcome, GameState } from '@/core/types'
import { DIFFICULTY_LEVELS } from '@/data/levels'
import { TONE_KEYS, toneFor, type ToneKey } from '@/data/levelCopy'
import { observeChange } from '@/ui/chronicle'
import { adviseCounsel } from '@/ui/counsel'
import { configForLevel, levelOfConfig } from '@/ui/levelConfig'
import { momentView } from '@/ui/moments'

/** The lines of an ordinary reign, as they were before the levels. */
const ORDINARY_LINES: Record<ToneKey, string> = {
  auditClean: 'The Crown is satisfied.',
  auditNarrow: 'The Crown lets it pass, this once.',
  auditPardon: 'The Crown grants its pardon, once.',
  chronicleFailed: 'Audit failed. The Crown marks a strike against you.',
  chronicleSatisfied: 'The Crown is satisfied.',
  chronicleWine: 'Audit passed. The Crown sends a cask of wine and a warning.',
  heraldBody: 'Open your coffers, or we open your walls.',
  counselAllMet: 'Every quota is met. Keep the realm quiet.',
  counselFled: 'Your counsellors have fled the castle.',
}

function auditState(overrides: Partial<AuditOutcome> = {}): GameState {
  const state = createInitialGameState({ seed: 7 })
  state.phase = 'AUDIT_ASSESSMENT'
  state.deadline = 3
  state.lastAuditOutcome = {
    deadline: 3,
    apMet: true,
    popMet: true,
    militaryMet: true,
    passedCount: 3,
    success: true,
    royalPardonIssued: false,
    isGameOver: false,
    victory: false,
    grossApRate: 2400,
    ...overrides,
  }
  return state
}

describe('Task 5: the tone of a level', () => {
  it('keeps every line of an ordinary reign as it was', () => {
    for (const key of TONE_KEYS) expect(toneFor('ordinary', key)).toBe(ORDINARY_LINES[key])
  })

  it('gives stern and tyrannical a voice of their own for every line', () => {
    for (const key of TONE_KEYS) {
      const lines = DIFFICULTY_LEVELS.map((level) => toneFor(level, key))
      expect(new Set(lines).size).toBe(3)
    }
  })

  it('changes no figure and keeps the plain characters of the copy', () => {
    for (const key of TONE_KEYS) {
      for (const level of DIFFICULTY_LEVELS) {
        const line = toneFor(level, key)
        expect(line.match(/\d+/g) ?? []).toEqual(ORDINARY_LINES[key].match(/\d+/g) ?? [])
        expect(line).not.toMatch(/[‒-―·‘’“”…]/)
      }
    }
  })

  it('keeps the order of the counsel the same at every level', () => {
    for (const level of DIFFICULTY_LEVELS) {
      expect(toneFor(level, 'counselAllMet')).toMatch(/^Every quota is met\./)
    }
  })

  it('knows the level of a reign from its config', () => {
    for (const level of DIFFICULTY_LEVELS) expect(levelOfConfig(configForLevel(level))).toBe(level)
    expect(levelOfConfig({ ...configForLevel('stern') })).toBe('ordinary')
  })

  it('titles the audit letter in the voice of the reign', () => {
    const state = auditState()
    expect(momentView(state, configForLevel('ordinary'))?.title).toBe(ORDINARY_LINES.auditClean)
    expect(momentView(state, configForLevel('tyrannical'))?.title).toBe(
      toneFor('tyrannical', 'auditClean'),
    )
  })

  it('writes a failed audit in the chronicle in the voice of the reign, figures unchanged', () => {
    const write = (level: 'ordinary' | 'stern') => {
      // At the second audit every level asks the same, so only the voice may differ.
      const state = auditState({ deadline: 2 })
      state.deadline = 2
      state.lastAuditOutcome = null
      const config = configForLevel(level)
      const before = observeChange(null, config, state, 'enchanted', 0).snapshot
      state.lastAuditOutcome = auditState({
        deadline: 2,
        success: false,
        passedCount: 1,
      }).lastAuditOutcome
      return observeChange(before, config, state, 'enchanted', 1).entries.find(
        (entry) => entry.kind === 'audit',
      )!.text
    }
    expect(write('ordinary').startsWith(ORDINARY_LINES.chronicleFailed)).toBe(true)
    expect(write('stern').startsWith(toneFor('stern', 'chronicleFailed'))).toBe(true)
    const figures = (text: string) => text.slice(text.indexOf(' AP '))
    expect(figures(write('stern'))).toBe(figures(write('ordinary')))
  })

  it('counsels in the voice of the reign', () => {
    const state = createInitialGameState({ seed: 7 })
    const config = configForLevel('tyrannical')
    expect(adviseCounsel(state, config, [], 'enchanted', 60).text).toBe(
      toneFor('tyrannical', 'counselAllMet'),
    )
    expect(adviseCounsel(state, config, [], 'death_throes', 60).text).toBe(
      toneFor('tyrannical', 'counselFled'),
    )
  })

  it('sends the herald in the voice of the reign', () => {
    const state = createInitialGameState({ seed: 7 })
    state.phase = 'THREAT_HERALD'
    state.deadline = 2
    state.currentThreatId = 3
    state.currentThreatPower = 70
    state.currentThreatTributeAp = 1900
    state.provinces = 3
    state.provinceBiomes = ['heartland', 'farmlands', 'heartland']
    state.ap = 5000
    expect(momentView(state, configForLevel('ordinary'))?.body).toBe(ORDINARY_LINES.heraldBody)
    expect(momentView(state, configForLevel('stern'))?.body).toBe(toneFor('stern', 'heraldBody'))
  })
})
