/**
 * PRNG, Multi-Stream Independence & Deterministic State Initialization Tests (Task 1.1).
 *
 * @module __tests__/unit/prng.spec
 */

import { describe, it, expect } from 'vitest'
import { PRNG, deriveStreamSeed, withStatePrng, type RngStream } from '@/core/prng'
import { createInitialGameState } from '@/core/state'
import { dispatch } from '@/core/commands'

describe('Task 1.1: PRNG 32-bit Truncation & Stream Independence', () => {
  it('truncates Mulberry32 state strictly to 32-bit unsigned integers', () => {
    const prng = new PRNG(0xffffffff)
    for (let i = 0; i < 50; i++) {
      prng.next()
      const st = prng.getState()
      expect(st).toBeGreaterThanOrEqual(0)
      expect(st).toBeLessThanOrEqual(0xffffffff)
      expect(Number.isInteger(st)).toBe(true)
    }
  })

  it('derives unique deterministic 32-bit seeds for each RngStream', () => {
    const seed = 1337
    const streams: RngStream[] = ['click', 'combat', 'events', 'council']
    const derived = streams.map((s) => deriveStreamSeed(seed, s))

    // All must be valid 32-bit unsigned integers
    for (const val of derived) {
      expect(val).toBeGreaterThanOrEqual(0)
      expect(val).toBeLessThanOrEqual(0xffffffff)
      expect(Number.isInteger(val)).toBe(true)
    }

    // All must be distinct
    const unique = new Set(derived)
    expect(unique.size).toBe(4)

    // Must be deterministic
    expect(deriveStreamSeed(seed, 'click')).toBe(derived[0])
  })

  it('preserves stream isolation: click draw does not affect combat or events stream', () => {
    const state = createInitialGameState({ seed: 42 })

    const initialCombatState = state.rngStreams.combat
    const initialEventsState = state.rngStreams.events

    // Draw from click stream 20 times
    for (let i = 0; i < 20; i++) {
      withStatePrng(state, 'click', (p) => p.next())
    }

    // Combat and events streams must remain strictly untouched
    expect(state.rngStreams.combat).toBe(initialCombatState)
    expect(state.rngStreams.events).toBe(initialEventsState)

    // Combat draw sequence is identical whether clicks happened or not
    const combatValueWithClicks = withStatePrng(state, 'combat', (p) => p.next())

    const freshState = createInitialGameState({ seed: 42 })
    const combatValueWithoutClicks = withStatePrng(freshState, 'combat', (p) => p.next())

    expect(combatValueWithClicks).toBe(combatValueWithoutClicks)
  })

  it('initializes GameState deterministically without Math.random or Date.now', () => {
    const state1 = createInitialGameState({ seed: 777 })
    const state2 = createInitialGameState({ seed: 777 })

    expect(state1.runId).toBe('run_777')
    expect(state2.runId).toBe('run_777')
    expect(state1.rngStreams).toEqual(state2.rngStreams)
    expect(state1.provinceBiomes).toEqual(['heartland', 'heartland', 'heartland'])
  })

  it('guarantees STAMP_DOCUMENT dispatch preserves combat and events stream draws', () => {
    const stateA = createInitialGameState({ seed: 555 })
    const stateB = createInitialGameState({ seed: 555 })

    // Execute STAMP_DOCUMENT on stateA
    dispatch(stateA, { type: 'STAMP_DOCUMENT' })
    dispatch(stateA, { type: 'STAMP_DOCUMENT' })

    // Combat draw sequence on stateA must match stateB without clicks
    const combatDrawA = withStatePrng(stateA, 'combat', (p) => p.next())
    const combatDrawB = withStatePrng(stateB, 'combat', (p) => p.next())
    expect(combatDrawA).toBe(combatDrawB)

    // Events draw sequence on stateA must match stateB without clicks
    const eventsDrawA = withStatePrng(stateA, 'events', (p) => p.next())
    const eventsDrawB = withStatePrng(stateB, 'events', (p) => p.next())
    expect(eventsDrawA).toBe(eventsDrawB)
  })
})
