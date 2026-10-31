/**
 * Plan 03 Task 2: the unit rows of the three order pages.
 */

import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { dispatch } from '@/core/commands'
import { DEFAULT_ENGINE_CONFIG } from '@/core/config'
import { calculateUnitCost, getMaxBulkSize } from '@/core/formulas'
import type { GameState, UnitOrder } from '@/core/types'
import { UNITS_DATA } from '@/data/balance'
import { useArchivesStore } from '@/stores/archives'
import { useGameStore } from '@/stores/game'
import { useSettingsStore } from '@/stores/settings'
import { bulkOptions, hostLine, patentRow, unitRows } from '@/ui/orderRows'

function run(): GameState {
  setActivePinia(createPinia())
  useArchivesStore().load()
  useSettingsStore().load()
  const game = useGameStore()
  game.begin(42)
  return game.run!
}

const ids = (state: GameState, order: UnitOrder) =>
  unitRows(state, order, 1).map((row) => row.unitId)

describe('Task 2: unit rows', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('lists the Tier I units until the patent is sealed', () => {
    const state = run()
    expect(ids(state, 'people')).toEqual(['peasant', 'artisan', 'clergy', 'notable'])
    expect(ids(state, 'military')).toEqual(['soldier', 'sergeant', 'quartermaster', 'scout'])
    state.unlockedPatents.people = true
    expect(ids(state, 'people')).toHaveLength(8)
  })

  it('prices a row like the engine', () => {
    const state = run()
    state.ap = 100000
    state.units.peasant = 7
    const row = unitRows(state, 'people', 1)[0]!
    expect(row.price).toBe(
      calculateUnitCost('peasant', 7, 1, DEFAULT_ENGINE_CONFIG, state.activeModifiers),
    )
  })

  it('names what blocks a purchase, the coffer first', () => {
    const state = run()
    state.ap = 0
    state.freeSerfs = 0
    expect(unitRows(state, 'people', 1)[0]).toMatchObject({
      blocked: 'Not enough AP',
      command: null,
    })
    state.ap = 100000
    expect(unitRows(state, 'people', 1)[0]).toMatchObject({
      blocked: 'No free serfs',
      command: null,
    })
    state.freeSerfs = 100
    state.units.peasant = 100000
    expect(unitRows(state, 'people', 1)[1]).toMatchObject({
      blocked: 'The order is full',
      command: null,
    })
  })

  it('resolves max within the room left in the order', () => {
    const state = run()
    state.ap = 1e12
    state.freeSerfs = 100000
    state.deadline = 8
    const free = unitRows(state, 'people', 'max')[0]!
    expect(free.count).toBe(getMaxBulkSize(8, state.totalPopulation, UNITS_DATA.peasant))
    state.units.peasant = 100000
    expect(unitRows(state, 'people', 'max')[1]!.count).toBeLessThanOrEqual(1)
  })

  it('writes large figures in thousands, rounding upkeep up', () => {
    const state = run()
    state.units.peasant = 12340
    expect(unitRows(state, 'people', 1)[0]!.line).toContain('12.3k working')
    state.units.soldier = 100000
    expect(hostLine(state).note).toMatch(/Upkeep [\d.,]+k AP each second\./)
  })

  it('lets the mercenaries come without free serfs', () => {
    const state = run()
    state.ap = 100000
    state.freeSerfs = 0
    state.unlockedPatents.military = true
    const blocked = unitRows(state, 'military', 1).find((row) => row.unitId === 'man_at_arms')!
    expect(blocked.blocked).toBe('No free serfs')
    state.ruleFlags.push('law:mercenary_capitulation')
    const hired = unitRows(state, 'military', 1).find((row) => row.unitId === 'man_at_arms')!
    expect(hired.blocked).toBeNull()
    expect(dispatch(structuredClone(state), hired.command!).success).toBe(true)
  })

  it('never offers what the engine refuses', () => {
    const state = run()
    state.ap = 5000
    state.deadline = 8
    state.unlockedPatents.people = true
    for (const bulk of [1, 10, 50, 100, 'max'] as const) {
      for (const row of unitRows(state, 'people', bulk)) {
        if (!row.command) continue
        expect(dispatch(structuredClone(state), row.command).success).toBe(true)
      }
    }
  })

  it('lists every unmet condition of a patent', () => {
    const state = run()
    state.ap = 0
    expect(patentRow(state, 'people')).toMatchObject({
      cost: 500,
      unmet: ['Reach the third audit', 'Keep 12 Tier I units', 'Hold 500 AP'],
      command: null,
    })
    state.ap = 500
    state.deadline = 4
    state.units.peasant = 12
    expect(patentRow(state, 'people')).toMatchObject({
      unmet: [],
      command: { type: 'UNLOCK_PATENT', order: 'people' },
    })
    state.unlockedPatents.people = true
    expect(patentRow(state, 'people')).toBeNull()
  })

  it('locks the bulk sizes above the limit of the reign', () => {
    const state = run()
    const options = bulkOptions(state, 'people')
    expect(options.map((option) => option.choice)).toEqual([1, 10, 50, 100, 'max'])
    expect(options.find((option) => option.choice === 10)).toMatchObject({ enabled: false })
    state.deadline = 8
    expect(bulkOptions(state, 'people').find((o) => o.choice === 100)?.enabled).toBe(true)
  })
})
