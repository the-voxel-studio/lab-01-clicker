/**
 * Seal burst: the missives that fly from the seal on each decree.
 *
 * @module __tests__/unit/ui_seal_burst.spec
 */

import { describe, expect, it } from 'vitest'
import { createInitialGameState } from '@/core/state'
import { burstMissives, missiveIcons } from '@/ui/sealBurst'

/** A random source that replays the given values in a loop. */
function replay(values: number[]): () => number {
  let index = 0
  return () => values[index++ % values.length] ?? 0
}

describe('Task 7: seal', () => {
  it('sends one missive on a low draw and two on a high one', () => {
    expect(burstMissives(replay([0.2, 0.5, 0.5, 0.5, 0.5, 0.5]), ['scroll'], 0)).toHaveLength(1)
    expect(burstMissives(replay([0.9, 0.5, 0.5, 0.5, 0.5, 0.5]), ['scroll'], 0)).toHaveLength(2)
  })

  it('keeps every missive within the prototype bounds', () => {
    for (const seed of [0, 0.13, 0.5, 0.77, 0.999]) {
      const missives = burstMissives(replay([0.9, seed, 1 - seed, seed / 2]), ['scroll'], 4)
      for (const missive of missives) {
        const distance = Math.hypot(missive.dx, missive.dy)
        expect(distance).toBeGreaterThanOrEqual(84)
        expect(distance).toBeLessThanOrEqual(191)
        expect(Math.abs(missive.rotate)).toBeLessThanOrEqual(32.5)
        expect(missive.scale).toBeGreaterThanOrEqual(0.9)
        expect(missive.scale).toBeLessThanOrEqual(1.3)
      }
      expect(missives[0]?.id).toBe(4)
    }
  })

  it('carries the scroll when no administration unit is owned', () => {
    expect(missiveIcons(createInitialGameState())).toEqual(['scroll'])
  })

  it('carries the icons of the administration units owned', () => {
    const state = createInitialGameState()
    state.units.scribe = 3
    state.units.supervisor = 1
    expect(missiveIcons(state)).toEqual(['roleScribe', 'roleSupervisor'])
  })
})
