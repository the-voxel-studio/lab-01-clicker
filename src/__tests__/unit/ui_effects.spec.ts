/**
 * Plan V2_NUMBERS_EVERYWHERE Task 1: the effect of one more unit, from the real formulas.
 *
 * @module __tests__/unit/ui_effects.spec
 */

import { describe, expect, it } from 'vitest'
import { dispatch } from '@/core/commands'
import { calculateMaxPopulation, calculateMilitaryPower, calculateNetApRate } from '@/core/engine'
import { createInitialGameState } from '@/core/state'
import type { GameState, UnitId } from '@/core/types'
import { UNIT_COPY } from '@/data/orderCopy'
import { effectLines, realmRates, unitEffect } from '@/ui/effects'
import { unitRows } from '@/ui/orderRows'

function realm(units: Partial<Record<UnitId, number>> = {}, serfs = 500): GameState {
  const state = createInitialGameState({ seed: 3 })
  state.phase = 'ACTIVE_CYCLE'
  state.deadline = 6
  state.ap = 1e7
  state.unlockedPatents = { people: true, admin: true, military: true }
  state.freeSerfs = serfs
  state.totalPopulation = serfs
  for (const [id, count] of Object.entries(units)) {
    state.units[id as UnitId] = count
    state.totalPopulation += count
  }
  return state
}

describe('Task 1: the effect of one more', () => {
  it('reads the rates of the engine', () => {
    const state = realm({ soldier: 10 })
    const rates = realmRates(state)
    expect(rates.netAp).toBeCloseTo(calculateNetApRate(state))
    expect(rates.room).toBeCloseTo(calculateMaxPopulation(state))
    expect(rates.force).toBeCloseTo(calculateMilitaryPower(state))
  })

  it('gives a scribe the move of a real purchase', () => {
    const state = realm()
    const effect = unitEffect(state, 'scribe')
    const before = calculateNetApRate(state)
    dispatch(state, { type: 'BUY_UNIT', unitId: 'scribe', count: 1 })
    expect(effect.netAp).toBeCloseTo(calculateNetApRate(state) - before, 6)
  })

  it('tells what notables and soldiers do', () => {
    expect(unitEffect(realm(), 'notable').room).toBeGreaterThan(0)
    const soldier = unitEffect(realm(), 'soldier')
    expect(soldier.force).toBeCloseTo(1)
    expect(soldier.netAp).toBeLessThan(0)
  })

  it('shows the loss of a grand marshal on a small army', () => {
    const lines = effectLines(unitEffect(realm({ soldier: 28 }), 'grand_marshal'))
    expect(lines.join(' ')).toMatch(/−0\.\d+ AP\/s/)
  })

  it('leaves the state and its generators untouched', () => {
    const state = realm({ soldier: 10 })
    const before = structuredClone(state)
    unitEffect(state, 'peasant')
    expect(state).toEqual(before)
  })

  it('keeps the effect of a unit at its order cap, beside its block', () => {
    const state = realm({ soldier: 200 })
    const row = unitRows(state, 'military', 1).find((item) => item.unitId === 'man_at_arms')
    expect(row?.blocked).toBe('The order is full')
    expect(unitEffect(state, 'man_at_arms').force).toBeCloseTo(7)
  })

  it('scales the effect with the chosen bulk', () => {
    expect(unitEffect(realm(), 'soldier', 10).force).toBeCloseTo(10)
  })

  it('reads births through a tithe freeze', () => {
    const state = realm()
    state.forcedTitheFreezeTimer = 20
    expect(realmRates(state).births).toBeCloseTo(realmRates(realm()).births)
  })

  it('keeps the running cost beside a large effect', () => {
    const lines = effectLines(unitEffect(realm(), 'baron')).join(' ')
    expect(lines).toContain('room')
    expect(lines).toContain('AP/s')
  })

  it('gives every unit a line with a figure', () => {
    for (const id of Object.keys(UNIT_COPY) as UnitId[]) {
      expect(effectLines(unitEffect(realm(), id)).join(' ')).toMatch(/\d/)
    }
  })
})
