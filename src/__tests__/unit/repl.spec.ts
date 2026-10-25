/**
 * Plan 04 Task 4: the engine REPL parses lines into commands and prints state summaries.
 *
 * @module __tests__/unit/repl.spec
 */

import { describe, it, expect } from 'vitest'
import { dispatch } from '@/core/commands'
import { calculateMilitaryPower, tick } from '@/core/engine'
import { createInitialGameState } from '@/core/state'
import { UNITS_DATA } from '@/data/balance'
import { parseLine, parseSeedArgument, runLine, type ReplEngine } from '../../../scripts/repl'

const engine: ReplEngine = {
  dispatch,
  tick,
  calculateMilitaryPower,
  createInitialGameState,
  unitIds: Object.values(UNITS_DATA).map((def) => def.id),
}

describe('Plan 04 Task 4: engine REPL', () => {
  it('shows one scribe after buying one and ticking one second', () => {
    const state = createInitialGameState({ seed: 1 })
    const outputs = [
      ...runLine(state, 'BUY_UNIT scribe 1', engine),
      ...runLine(state, 'TICK 1', engine),
    ]
    const last = outputs[outputs.length - 1] ?? ''
    expect(last).toContain('time=1.00s')
    expect(last).toContain('scribe=1')
    expect(state.units.scribe).toBe(1)
  })

  it('maps lines to commands', () => {
    expect(parseLine('BUY_UNIT scribe 2', engine.unitIds)).toEqual({
      kind: 'command',
      command: { type: 'BUY_UNIT', unitId: 'scribe', count: 2 },
    })
    expect(parseLine('set_tax_rate 0.2', engine.unitIds)).toEqual({
      kind: 'command',
      command: { type: 'SET_TAX_RATE', rate: 0.2 },
    })
    expect(parseLine('STAMP_DOCUMENT', engine.unitIds)).toEqual({
      kind: 'command',
      command: { type: 'STAMP_DOCUMENT' },
    })
    expect(parseLine('TICK 2.5', engine.unitIds)).toEqual({ kind: 'tick', seconds: 2.5 })
    expect(parseLine('   ', engine.unitIds)).toEqual({ kind: 'blank' })
  })

  it('reports unknown or malformed lines and keeps going', () => {
    for (const line of [
      'NOPE',
      'BUY_UNIT ghost 1',
      'BUY_UNIT scribe 0',
      'TICK -1',
      'STAMP_DOCUMENT 3',
      'LAUNCH_ATTACK 1.5',
      'RESOLVE_DILEMMA d -1',
      'RESTART_RUN -4',
    ]) {
      expect(parseLine(line, engine.unitIds).kind).toBe('error')
    }
    const state = createInitialGameState({ seed: 1 })
    const outputs = [...runLine(state, 'NOPE', engine), ...runLine(state, 'TICK 1', engine)]
    expect(outputs[0]).toMatch(/^error: /)
    expect(outputs[1]).toContain('phase=ACTIVE_CYCLE')
  })

  it('prints the dispatch error of a rejected command before the summary', () => {
    const state = createInitialGameState({ seed: 1 })
    const outputs = runLine(state, 'SUBMIT_AUDIT', engine)
    expect(outputs).toHaveLength(2)
    expect(outputs[0]).toMatch(/^error: /)
  })

  it('reads the seed option', () => {
    expect(parseSeedArgument([])).toBe(1)
    expect(parseSeedArgument(['--seed', '42'])).toBe(42)
    expect(parseSeedArgument(['--seed', 'x'])).toBeNull()
    expect(parseSeedArgument(['--seed', '-3'])).toBeNull()
    expect(parseSeedArgument(['--seed', '1.5'])).toBeNull()
  })
})
