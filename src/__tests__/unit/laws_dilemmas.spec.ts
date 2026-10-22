/**
 * Unit tests for the 30 Imperial Laws and 20 Steward Dilemmas (Task 2.3, GAME_RULES §9, §10).
 *
 * @module __tests__/unit/laws_dilemmas.spec
 */

import { describe, it, expect } from 'vitest'
import { createInitialGameState } from '@/core/state'
import { LAWS_DATA } from '@/data/laws'
import { DILEMMAS_DATA } from '@/data/dilemmas'
import { dispatch } from '@/core/commands'

describe('Task 2.3: Imperial Laws (30) & Steward Dilemmas (20)', () => {
  describe('Catalogs Completeness & Integrity', () => {
    it('contains exactly 30 imperial laws distributed equally across 3 orders', () => {
      const laws = Object.values(LAWS_DATA)
      expect(laws.length).toBe(30)

      const chancellor = laws.filter((l) => l.order === 'chancellor')
      const prelate = laws.filter((l) => l.order === 'prelate')
      const marshal = laws.filter((l) => l.order === 'marshal')

      expect(chancellor.length).toBe(10)
      expect(prelate.length).toBe(10)
      expect(marshal.length).toBe(10)
    })

    it('contains exactly 20 steward dilemmas with binary choices', () => {
      const dilemmas = Object.values(DILEMMAS_DATA)
      expect(dilemmas.length).toBe(20)

      for (const d of dilemmas) {
        expect(d.choices.length).toBe(2)
        expect(typeof d.trigger).toBe('function')
      }
    })
  })

  describe('Council Sequence & Deterministic Drafting', () => {
    it('deterministically drafts an eligible dilemma on entering COUNCIL_DILEMMA', () => {
      const state = createInitialGameState({ seed: 777 })
      state.phase = 'AUDIT_ASSESSMENT'
      state.unrest = 60 // Triggers peasant salt boycott

      const res = dispatch(state, { type: 'SUBMIT_AUDIT' })
      expect(res.success).toBe(true)
      expect(state.phase).toBe('COUNCIL_DILEMMA')
      expect(state.currentDilemmaId).toBeDefined()
      expect(state.currentDilemmaId).not.toBeNull()
      expect(DILEMMAS_DATA[state.currentDilemmaId!]).toBeDefined()
    })

    it('drafts 3 laws (1 per order) on entering COUNCIL_LAWS', () => {
      const state = createInitialGameState({ seed: 1234 })
      state.phase = 'COUNCIL_DILEMMA'
      state.currentDilemmaId = 'dilemma:taxable_windows'

      // Choice 1: Forbid tax
      const res = dispatch(state, {
        type: 'RESOLVE_DILEMMA',
        dilemmaId: 'dilemma:taxable_windows',
        choiceIndex: 1,
      })
      expect(res.success).toBe(true)
      expect(state.phase).toBe('COUNCIL_LAWS')
      expect(state.currentLawDraft.length).toBe(3)

      const draftLaws = state.currentLawDraft.map((id) => LAWS_DATA[id]!)
      expect(draftLaws.some((l) => l.order === 'chancellor')).toBe(true)
      expect(draftLaws.some((l) => l.order === 'prelate')).toBe(true)
      expect(draftLaws.some((l) => l.order === 'marshal')).toBe(true)
    })
  })

  describe('Dilemma Choice Solvency & Application', () => {
    it('applies dilemma choice effects and advances to COUNCIL_LAWS', () => {
      const state = createInitialGameState()
      state.phase = 'COUNCIL_DILEMMA'
      state.currentDilemmaId = 'dilemma:foreign_envoy_bribe'
      state.ap = 500
      state.unrest = 10

      // Choice 0: Accept gold (+1200 AP, +15 Unrest)
      const res = dispatch(state, {
        type: 'RESOLVE_DILEMMA',
        dilemmaId: 'dilemma:foreign_envoy_bribe',
        choiceIndex: 0,
      })
      expect(res.success).toBe(true)
      expect(state.ap).toBe(1700)
      expect(state.unrest).toBe(25)
      expect(state.phase).toBe('COUNCIL_LAWS')
    })

    it('rejects an unaffordable dilemma choice without changing phase', () => {
      const state = createInitialGameState()
      state.phase = 'COUNCIL_DILEMMA'
      state.currentDilemmaId = 'dilemma:astrologer_comet'
      state.ap = 100 // Costs 500 AP

      // Choice 1: Mass prayers (-500 AP, -25 Unrest)
      const res = dispatch(state, {
        type: 'RESOLVE_DILEMMA',
        dilemmaId: 'dilemma:astrologer_comet',
        choiceIndex: 1,
      })
      expect(res.success).toBe(false)
      expect(res.error).toContain('Cannot afford')
      expect(state.phase).toBe('COUNCIL_DILEMMA')
      expect(state.ap).toBe(100)
    })
  })

  describe('Law Enactment & Slot Limits', () => {
    it('enacts drafted law, applies modifiers, and transitions to THREAT_HERALD', () => {
      const state = createInitialGameState()
      state.deadline = 2
      state.phase = 'COUNCIL_LAWS'
      state.currentLawDraft = [
        'law:royal_scriptorium',
        'law:holy_days_vigils',
        'law:standing_garrisons',
      ]

      const res = dispatch(state, { type: 'ENACT_LAW', lawId: 'law:royal_scriptorium' })
      expect(res.success).toBe(true)
      expect(state.activeLaws).toContain('law:royal_scriptorium')
      expect(state.activeModifiers.some((m) => m.source === 'law:royal_scriptorium')).toBe(true)
      expect(state.phase).toBe('THREAT_HERALD')
    })

    it('rejects enacting a law that is not in the current draft', () => {
      const state = createInitialGameState()
      state.phase = 'COUNCIL_LAWS'
      state.currentLawDraft = [
        'law:royal_scriptorium',
        'law:holy_days_vigils',
        'law:standing_garrisons',
      ]

      const res = dispatch(state, { type: 'ENACT_LAW', lawId: 'law:crown_monopolies' })
      expect(res.success).toBe(false)
      expect(res.error).toContain('not in current council draft')
      expect(state.phase).toBe('COUNCIL_LAWS')
      expect(state.activeLaws).not.toContain('law:crown_monopolies')
    })

    it('rejects enacting beyond the 5 active law slot capacity', () => {
      const state = createInitialGameState()
      state.phase = 'COUNCIL_LAWS'
      state.activeLaws = ['law:1', 'law:2', 'law:3', 'law:4', 'law:5']
      state.currentLawDraft = [
        'law:royal_scriptorium',
        'law:holy_days_vigils',
        'law:standing_garrisons',
      ]

      const res = dispatch(state, { type: 'ENACT_LAW', lawId: 'law:royal_scriptorium' })
      expect(res.success).toBe(false)
      expect(res.error).toContain('Maximum active law capacity')
      expect(state.phase).toBe('COUNCIL_LAWS')
    })

    it('rejects an unaffordable law without changing phase', () => {
      const state = createInitialGameState()
      state.phase = 'COUNCIL_LAWS'
      state.ap = 50
      state.currentLawDraft = [
        'law:grand_kermesse',
        'law:holy_days_vigils',
        'law:standing_garrisons',
      ]

      // Grand Kermesse costs 400 AP
      const res = dispatch(state, { type: 'ENACT_LAW', lawId: 'law:grand_kermesse' })
      expect(res.success).toBe(false)
      expect(res.error).toContain('Cannot afford')
      expect(state.phase).toBe('COUNCIL_LAWS')
      expect(state.ap).toBe(50)
    })
  })
})
