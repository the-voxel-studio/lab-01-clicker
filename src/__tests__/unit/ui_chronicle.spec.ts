/**
 * Chronicle model: entries written from run changes, commands and folklore.
 *
 * @module __tests__/unit/ui_chronicle.spec
 */

import { describe, expect, it } from 'vitest'
import { dispatch } from '@/core/commands'
import { DEFAULT_ENGINE_CONFIG, quotaForDeadline } from '@/core/config'
import { effectiveQuota } from '@/core/engine'
import { createInitialGameState } from '@/core/state'
import type { AuditOutcome, Command, GameState } from '@/core/types'
import { FOLKLORE } from '@/data/chronicleCopy'
import {
  entryFromCommand,
  formatReignClock,
  mergeEntries,
  observeChange,
  type RunSnapshot,
} from '@/ui/chronicle'
import { formatFigure } from '@/ui/realmText'

/** Snapshot taken at the coronation of `state` in `band`. */
function crowned(
  state: GameState,
  band: Parameters<typeof observeChange>[2] = 'enchanted',
): RunSnapshot {
  return observeChange(null, state, band, 0).snapshot
}

function outcome(overrides: Partial<AuditOutcome>): AuditOutcome {
  return {
    deadline: 1,
    apMet: true,
    popMet: true,
    militaryMet: true,
    passedCount: 3,
    success: true,
    royalPardonIssued: false,
    isGameOver: false,
    victory: false,
    grossApRate: 0,
    ...overrides,
  }
}

function buy(state: GameState, command: Command) {
  const before = structuredClone(state)
  const result = dispatch(state, command)
  return entryFromCommand(command, result, before, state, 1)
}

describe('Task 2: chronicle model', () => {
  it('writes the coronation when there is no earlier snapshot', () => {
    const state = createInitialGameState()
    const [entry] = observeChange(null, state, 'enchanted', 0).entries
    expect(entry?.deadline).toBe(0)
    expect(entry?.kind).toBe('audit')
    expect(entry?.text).toBe(
      'You are crowned before a crowd of 100. Someone in the back does not cheer.',
    )
  })

  it('writes a narrowly passed audit with its figures', () => {
    const state = createInitialGameState()
    const before = crowned(state)
    const required = effectiveQuota(state, quotaForDeadline(DEFAULT_ENGINE_CONFIG, 1)).apRate
    state.lastAuditOutcome = outcome({ grossApRate: required + 2 })
    const audits = observeChange(before, state, 'enchanted', 5).entries.filter(
      (e) => e.kind === 'audit',
    )
    expect(audits[0]?.text).toMatch(/^Audit passed by 2 AP\. The Crown is satisfied\. AP /)
    expect(audits[0]?.text).toMatch(/People [\d,]+ of [\d,]+, Army [\d,.]+ of [\d,.]+\.$/)
  })

  it('writes a pardoned audit', () => {
    const state = createInitialGameState()
    const before = crowned(state)
    state.lastAuditOutcome = outcome({ success: true, royalPardonIssued: true })
    const [audit] = observeChange(before, state, 'uneasy', 5).entries.filter(
      (e) => e.kind === 'audit',
    )
    expect(
      audit?.text.startsWith('Audit passed with the Royal Pardon. You will not get another.'),
    ).toBe(true)
  })

  it('writes a failed audit as a strike', () => {
    const state = createInitialGameState()
    const before = crowned(state)
    state.lastAuditOutcome = outcome({ success: false, apMet: false, passedCount: 2 })
    const [audit] = observeChange(before, state, 'rotting', 5).entries.filter(
      (e) => e.kind === 'audit',
    )
    expect(audit?.text.startsWith('Audit failed. The Crown marks a strike against you.')).toBe(true)
  })

  it('writes purchases, a first hire included', () => {
    // From the third audit the engine allows lots of 10.
    const state = createInitialGameState({ ap: 100000, deadline: 3 })
    const peasants = buy(state, { type: 'BUY_UNIT', unitId: 'peasant', count: 10 })
    expect(peasants?.kind).toBe('decision')
    expect(peasants?.text).toMatch(/^You recruited 10 peasants for [\d,]+ AP\.$/)
    const scribe = buy(state, { type: 'BUY_UNIT', unitId: 'scribe', count: 1 })
    expect(scribe?.text).toBe('You hired your first scribe.')
  })

  it('writes nothing for the seal or a refused command', () => {
    const state = createInitialGameState()
    expect(buy(state, { type: 'STAMP_DOCUMENT' })).toBeNull()
    const poor = createInitialGameState({ ap: 0 })
    expect(buy(poor, { type: 'BUY_UNIT', unitId: 'peasant', count: 1 })).toBeNull()
  })

  it('writes folklore at most once every 25 seconds of reign within a band', () => {
    const state = createInitialGameState({ seed: 9 })
    let snapshot = crowned(state)
    const folklore = []
    for (let i = 1; i <= 2000; i++) {
      state.totalElapsedSeconds = i * 0.05
      const change = observeChange(snapshot, state, 'enchanted', i)
      folklore.push(...change.entries.filter((e) => e.kind === 'folklore'))
      snapshot = change.snapshot
    }
    expect(folklore.length).toBeGreaterThan(0)
    expect(folklore.length).toBeLessThanOrEqual(Math.floor(100 / 25))
    for (let i = 1; i < folklore.length; i++) {
      const gap = (folklore[i]?.reignSeconds ?? 0) - (folklore[i - 1]?.reignSeconds ?? 0)
      expect(gap).toBeGreaterThanOrEqual(25)
      expect(folklore[i]?.text).not.toBe(folklore[i - 1]?.text)
    }
  })

  it('writes a line of the new band at once when the realm worsens', () => {
    const state = createInitialGameState({ seed: 9, totalElapsedSeconds: 3 })
    const before = crowned(state)
    const { entries } = observeChange(before, state, 'rotting', 4)
    const folklore = entries.filter((e) => e.kind === 'folklore')
    expect(folklore).toHaveLength(1)
    expect(FOLKLORE.rotting).toContain(folklore[0]?.text)
  })

  it('chooses the same line for the same seed and id', () => {
    const a = createInitialGameState({ seed: 77, totalElapsedSeconds: 3 })
    const b = createInitialGameState({ seed: 77, totalElapsedSeconds: 3 })
    const first = observeChange(crowned(a), a, 'uneasy', 12).entries
    const second = observeChange(crowned(b), b, 'uneasy', 12).entries
    expect(first).toEqual(second)
  })

  it('formats the reign clock as minutes and seconds', () => {
    expect(formatReignClock(125)).toBe('2:05')
    expect(formatReignClock(0)).toBe('0:00')
  })
})

describe('Task 2 review fixes: chronicle model', () => {
  /** Observes `state` after `apply`, `seconds` later, and returns the new entries. */
  function step(
    snapshot: RunSnapshot,
    state: GameState,
    seconds: number,
    band: Parameters<typeof observeChange>[2] = 'enchanted',
  ) {
    state.totalElapsedSeconds += seconds
    const change = observeChange(snapshot, state, band, 100)
    return change
  }

  it('tells an empty coffer once and its rescue only after a lasting recovery', () => {
    const state = createInitialGameState({ seed: 3, ap: 1 })
    state.units.soldier = 40
    let snapshot = crowned(state)
    const money: string[] = []
    for (let i = 0; i < 20; i++) {
      state.ap = i % 2 === 0 ? -1 : 2
      const change = step(snapshot, state, 0.05)
      money.push(...change.entries.filter((e) => e.kind === 'money').map((e) => e.text))
      snapshot = change.snapshot
    }
    expect(money).toEqual(["The coffer is empty. The Lombard's men are on the road."])
    state.ap = 40
    for (let i = 0; i < 120; i++) {
      const change = step(snapshot, state, 0.05)
      money.push(...change.entries.filter((e) => e.kind === 'money').map((e) => e.text))
      snapshot = change.snapshot
    }
    expect(money).toHaveLength(2)
    expect(money[1]).toMatch(/^The near bankruptcy was averted/)
  })

  it('writes at once only when the band reaches a new worst for the audit', () => {
    const state = createInitialGameState({ seed: 5 })
    let snapshot = crowned(state)
    const folklore: string[] = []
    const bands = ['uneasy', 'enchanted', 'uneasy', 'enchanted', 'uneasy', 'rotting'] as const
    for (const band of bands) {
      const change = step(snapshot, state, 1, band)
      folklore.push(...change.entries.filter((e) => e.kind === 'folklore').map((e) => e.text))
      snapshot = change.snapshot
    }
    expect(folklore).toHaveLength(2)
  })

  it('gathers small starvation losses into one line of deaths', () => {
    const state = createInitialGameState({ seed: 8 })
    let snapshot = crowned(state)
    const deaths: string[] = []
    for (let i = 0; i < 100; i++) {
      state.starvationLosses += 0.125
      const change = step(snapshot, state, 0.05)
      deaths.push(...change.entries.filter((e) => e.kind === 'death').map((e) => e.text))
      snapshot = change.snapshot
    }
    expect(deaths.length).toBeGreaterThan(0)
    expect(deaths[0]).toMatch(/^Death reaped \d+ souls in the marsh villages\./)
  })

  it('never tells a negative margin on a passed audit', () => {
    const state = createInitialGameState()
    const before = crowned(state)
    state.lastAuditOutcome = outcome({
      success: true,
      apMet: false,
      passedCount: 2,
      grossApRate: 1,
    })
    const [audit] = observeChange(before, state, 'enchanted', 5).entries.filter(
      (e) => e.kind === 'audit',
    )
    expect(audit?.text.startsWith('Audit passed, though the Chancery fell short.')).toBe(true)
  })

  it('merges repeated purchases of one unit into one line', () => {
    const state = createInitialGameState({ ap: 100000, deadline: 3 })
    const first = buy(state, { type: 'BUY_UNIT', unitId: 'peasant', count: 10 })
    const second = buy(state, { type: 'BUY_UNIT', unitId: 'peasant', count: 10 })
    if (!first || !second) throw new Error('entries expected')
    const merged = mergeEntries(first, second)
    expect(merged?.text).toMatch(/^You recruited 20 peasants for [\d,]+ AP\.$/)
    const tax1 = buy(state, { type: 'SET_TAX_RATE', rate: 30 })
    const tax2 = buy(state, { type: 'SET_TAX_RATE', rate: 35 })
    if (!tax1 || !tax2) throw new Error('entries expected')
    expect(mergeEntries(tax1, tax2)?.text).toBe('You raised the tax to 35%.')
    expect(mergeEntries(first, tax2)).toBeNull()
  })

  it('writes negative figures with a true minus sign', () => {
    expect(formatFigure(-1234)).toBe('−1,234')
    expect(formatFigure(2.55, 1)).toBe('2.6')
  })
})
