import { describe, it, expect } from 'vitest'
import { createInitialGameState } from '@/core/state'
import { dispatch } from '@/core/commands'
import { applyArchivePerks } from '@/data/archives'
import { STAT_KEYS } from '@/core/types'
import type { GameState, LawId } from '@/core/types'

const FIVE: LawId[] = [
  'law:royal_scriptorium',
  'law:general_cadastre',
  'law:census_edict',
  'law:standing_garrisons',
  'law:merit_pay',
]

function councilWith(active: LawId[], draft: LawId): GameState {
  const state = createInitialGameState()
  state.phase = 'COUNCIL_LAWS'
  state.activeLaws = [...active]
  state.currentLawDraft = [draft]
  return state
}

describe('Task 0: typed law slot count', () => {
  it('declares law_slots as a stat key', () => {
    expect(STAT_KEYS).toContain('law_slots')
  })

  it('makes the Sixth Law Slot perk target the law_slots stat', () => {
    const state = createInitialGameState()
    applyArchivePerks(state, ['sixth_law_slot'])
    expect(state.activeModifiers).toContainEqual({
      source: 'archive:sixth_law_slot',
      stat: 'law_slots',
      op: 'add',
      value: 1,
    })
  })

  it('refuses the sixth law without the perk', () => {
    const state = councilWith(FIVE, 'law:scorched_earth')
    const res = dispatch(state, { type: 'ENACT_LAW', lawId: 'law:scorched_earth' })
    expect(res.success).toBe(false)
    expect(res.error).toBe('Maximum active law capacity (5) reached.')
  })

  it('enacts a sixth law with the perk and refuses a seventh', () => {
    const state = councilWith(FIVE, 'law:scorched_earth')
    applyArchivePerks(state, ['sixth_law_slot'])
    expect(dispatch(state, { type: 'ENACT_LAW', lawId: 'law:scorched_earth' }).success).toBe(true)
    state.phase = 'COUNCIL_LAWS'
    state.currentLawDraft = ['law:crown_monopolies']
    const res = dispatch(state, { type: 'ENACT_LAW', lawId: 'law:crown_monopolies' })
    expect(res.success).toBe(false)
    expect(res.error).toBe('Maximum active law capacity (6) reached.')
  })

  it('leaves 5 slots for other laws with the perk and the Papal Concordat', () => {
    const state = councilWith(FIVE, 'law:scorched_earth')
    applyArchivePerks(state, ['sixth_law_slot'])
    state.ruleFlags.push('law:papal_concordat')
    const res = dispatch(state, { type: 'ENACT_LAW', lawId: 'law:scorched_earth' })
    expect(res.success).toBe(false)
    expect(res.error).toBe('Maximum active law capacity (5) reached.')
  })
})
