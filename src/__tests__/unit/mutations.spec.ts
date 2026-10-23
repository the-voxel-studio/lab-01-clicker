/**
 * Immediate Revolution & State Mutation Safety Tests (Task 1.2).
 *
 * @module __tests__/unit/mutations.spec
 */

import { describe, it, expect } from 'vitest'
import { createInitialGameState } from '@/core/state'
import { triggerDefeat, addUnrest } from '@/core/mutations'
import { dispatch } from '@/core/commands'
import { tick } from '@/core/engine'
import type { Modifier } from '@/core/types'

describe('Task 1.2: Dual Unrest Composition & Immediate Revolution', () => {
  it('clamps unrest between 0 and 100 and triggers immediate revolution at 100', () => {
    const state = createInitialGameState()
    state.unrest = 90

    // Pacification clamp floor
    addUnrest(state, -150)
    expect(state.unrest).toBe(0)
    expect(state.isGameOver).toBe(false)

    // Agitation clamp ceiling and instant revolution
    addUnrest(state, 120)
    expect(state.unrest).toBe(100)
    expect(state.isGameOver).toBe(true)
    expect(state.isVictory).toBe(false)
    expect(state.defeatReason).toBe('revolution')
    expect(state.phase).toBe('RUN_DEFEAT')
  })

  it('triggerDefeat is idempotent and does not overwrite existing defeat reason', () => {
    const state = createInitialGameState()
    triggerDefeat(state, 'bankruptcy')
    expect(state.isGameOver).toBe(true)
    expect(state.defeatReason).toBe('bankruptcy')

    // Subsequent defeat call is a no-op
    triggerDefeat(state, 'revolution')
    expect(state.defeatReason).toBe('bankruptcy')
  })

  it('regression: Unrest 70 + forced_tithe with 10 clergy triggers immediate revolution defeat without tick', () => {
    const state = createInitialGameState()
    state.unrest = 70
    state.units.clergy = 10 // Pacification: 10 * 0.02 = 0.20/s

    // Forced Tithe adds +35 Unrest
    // 70 + 35 = 105 -> clamped to 100 -> Immediate Revolution!
    const res = dispatch(state, { type: 'ENACT_EDICT', edictId: 'forced_tithe' })
    expect(res.success).toBe(true)

    expect(state.unrest).toBe(100)
    expect(state.isGameOver).toBe(true)
    expect(state.defeatReason).toBe('revolution')
    expect(state.phase).toBe('RUN_DEFEAT')
  })

  it('regression: Unrest 80 + levy en masse in THREAT_HERALD terminates in RUN_DEFEAT without being overwritten', () => {
    const state = createInitialGameState()
    state.unrest = 80
    state.deadline = 3
    state.phase = 'THREAT_HERALD'

    // Levy adds +30 Unrest -> 80 + 30 = 110 -> clamped to 100 -> Immediate Revolution!
    const res = dispatch(state, { type: 'SELECT_THREAT_RESPONSE', response: 'levy' })
    expect(res.success).toBe(true)

    expect(state.unrest).toBe(100)
    expect(state.isGameOver).toBe(true)
    expect(state.defeatReason).toBe('revolution')
    // Crucial check: phase MUST remain RUN_DEFEAT, NOT overwritten by getNextInterDeadlinePhase ('EXPEDITION')
    expect(state.phase).toBe('RUN_DEFEAT')
  })

  it('evaluates dual unrest composition: pacification reduction does not invert tax generation sign', () => {
    const state = createInitialGameState()
    state.taxRate = 45 // (45 - 25) / 10 * 0.05 = 0.10/s tax unrest generation
    state.units.clergy = 10 // 10 * 0.02 = 0.20/s pacification
    state.unrest = 20

    // Without modifiers: gen = 0.10, pac = 0.20 -> net delta = -0.10/s
    tick(state, 1.0)
    expect(state.unrest).toBeCloseTo(19.9, 2)

    // With church_seizure style pacification cut (mul: 0.5) expiring at 2.5s:
    // gen remains 0.10, pac becomes 0.20 * 0.5 = 0.10 -> net delta = 0.00/s
    const halfPacMod: Modifier = {
      source: 'edict:church_seizure',
      stat: 'unrest_pacification',
      op: 'mul',
      value: 0.5,
      expiresAt: 2.5,
    }
    state.activeModifiers.push(halfPacMod)

    const beforeUnrest = state.unrest
    tick(state, 1.0) // totalElapsedSeconds = 2.0, modifier active (2.5 > 2.0)
    expect(state.unrest).toBeCloseTo(beforeUnrest, 2)
    expect(state.activeModifiers).toContain(halfPacMod)

    // Tick past expiresAt: totalElapsedSeconds = 3.0, modifier expires (2.5 <= 3.0)
    tick(state, 1.0)
    expect(state.activeModifiers).not.toContain(halfPacMod)
    // Fixed 0.05 s steps: the modifier still applies to the 9 steps ending at 2.05 .. 2.45 s and is
    // purged from the step ending at 2.5 s, so full pacification (net -0.10/s) runs for 0.55 s
    expect(state.unrest).toBeCloseTo(beforeUnrest - 0.055, 2)
  })

  it('purges expired modifiers automatically during tick() based on expiresAt', () => {
    const state = createInitialGameState()
    state.totalElapsedSeconds = 10.0

    state.activeModifiers.push({
      source: 'temp_mod_expired',
      stat: 'gross_ap_rate',
      op: 'add',
      value: 50,
      expiresAt: 12.0,
    })
    state.activeModifiers.push({
      source: 'temp_mod_active',
      stat: 'gross_ap_rate',
      op: 'add',
      value: 50,
      expiresAt: 25.0,
    })
    state.activeModifiers.push({
      source: 'permanent_mod',
      stat: 'gross_ap_rate',
      op: 'add',
      value: 50,
    })

    // Advance 5 seconds: totalElapsedSeconds becomes 15.0
    tick(state, 5.0)

    const sources = state.activeModifiers.map((m) => m.source)
    expect(sources).not.toContain('temp_mod_expired')
    expect(sources).toContain('temp_mod_active')
    expect(sources).toContain('permanent_mod')
  })
})
