/**
 * Plan V2_NUMBERS_EVERYWHERE Task 3: edicts, tax, patents and plain rules.
 *
 * @module __tests__/unit/ui_crown_figures.spec
 */

import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import App from '@/App.vue'
import CrownPage from '@/components/game/orders/CrownPage.vue'
import { dispatch } from '@/core/commands'
import { createInitialGameState } from '@/core/state'
import type { GameState } from '@/core/types'
import { useArchivesStore } from '@/stores/archives'
import { useGameStore } from '@/stores/game'
import { useNavStore } from '@/stores/nav'
import { useSettingsStore } from '@/stores/settings'
import { coloniseView, edictRows, taxEffect } from '@/ui/crown'
import { patentRow } from '@/ui/orderRows'

function realm(): GameState {
  const state = createInitialGameState({ seed: 3 })
  state.phase = 'ACTIVE_CYCLE'
  state.deadline = 3
  state.ap = 500
  return state
}

function row(state: GameState, id: string) {
  const found = edictRows(state).find((item) => item.id === id)
  if (!found) throw new Error('no edict')
  return found
}

function begin() {
  const pinia = createPinia()
  setActivePinia(pinia)
  useArchivesStore().load()
  useSettingsStore().load()
  const game = useGameStore()
  game.begin(7)
  return { pinia, game, nav: useNavStore() }
}

describe('Task 3: edicts, tax, patents and plain rules', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('states what church seizure really pays', () => {
    const state = realm()
    const copy = structuredClone(state)
    dispatch(copy, { type: 'ENACT_EDICT', edictId: 'church_seizure' })
    const gain = Math.round(copy.ap - state.ap)
    expect(row(state, 'church_seizure').gain).toBe(`+${gain} AP`)
    expect(row(state, 'church_seizure').unrestAfter).toBe(Math.round(copy.unrest))
  })

  it('marks an edict that ends the reign', () => {
    const state = realm()
    state.unrest = 82
    expect(row(state, 'forced_tithe').fatal).toBe(true)
    state.unrest = 40
    expect(row(state, 'forced_tithe').fatal).toBe(false)
  })

  it('counts a tax still being chosen in the fatal warning', () => {
    const state = realm()
    state.unrest = 50
    state.taxRate = 10
    expect(row(state, 'forced_tithe').fatal).toBe(false)
    const rows = edictRows(state, 60)
    expect(rows.find((item) => item.id === 'forced_tithe')?.fatal).toBe(true)
  })

  it('needs a second press for a fatal edict', async () => {
    const { pinia, game } = begin()
    game.run!.unrest = 82
    const page = mount(CrownPage, { global: { plugins: [pinia] } })
    await flushPromises()
    const button = page.get('[data-edict="forced_tithe"]')
    expect(button.text()).toBe('This ends your reign')
    await button.trigger('click')
    expect(game.run!.lastEdictDeadline).toBe(0)
    expect(page.get('[data-edict="forced_tithe"]').text()).toBe('Press again to fall')
    await page.get('[data-edict="forced_tithe"]').trigger('click')
    expect(game.isOver).toBe(true)
    page.unmount()
  })

  it('tells the one edict rule before the first, and the price of the festival', async () => {
    const { pinia, game } = begin()
    game.run!.ap = 0
    const page = mount(CrownPage, { global: { plugins: [pinia] } })
    await flushPromises()
    expect(page.text()).toContain('One edict each audit')
    expect(page.get('[data-edict-row="grand_festival"]').text()).toMatch(/Costs \d/)
    page.unmount()
  })

  it('states income and unrest at a chosen tax', () => {
    const line = taxEffect(realm(), 60)
    expect(line).toMatch(/[+−][\d.]+ AP\/s/)
    expect(line).toMatch(/unrest\/s/)
  })

  it('states what a patent unlocks and what colonising adds', () => {
    expect(patentRow(realm(), 'military')?.unlocks).toContain('Men-at-arms')
    expect(coloniseView(realm()).gain).toMatch(/^\+\d+ room$/)
  })

  it('holds a tax chosen while time stands still until it runs again', () => {
    const { game } = begin()
    const state = game.run!
    const rate = state.taxRate
    game.act({ type: 'SET_PAUSED', paused: true })
    expect(game.act({ type: 'SET_TAX_RATE', rate: 60 }).success).toBe(true)
    game.act({ type: 'SET_TAX_RATE', rate: 0 })
    game.advance(0.25)
    expect(state.taxRate).toBe(rate)
    expect(game.heldTax).toBe(0)
    game.act({ type: 'SET_PAUSED', paused: false })
    game.advance(0.25)
    expect(state.taxRate).toBe(0)
    expect(game.heldTax).toBeNull()
  })

  it('holds a tax chosen during the open resume', () => {
    const { game } = begin()
    const state = game.run!
    const rate = state.taxRate
    state.phase = 'AWAIT_RESUME'
    game.act({ type: 'SET_TAX_RATE', rate: 5 })
    expect(state.taxRate).toBe(rate)
    game.act({ type: 'RESUME_GOVERNANCE' })
    game.advance(0.25)
    expect(state.taxRate).toBe(5)
  })

  it('holds the plain rules in the menu', async () => {
    const { pinia, nav } = begin()
    nav.go('how_to_reign')
    const app = mount(App, { global: { plugins: [pinia] } })
    await flushPromises()
    const text = app.text()
    for (const part of ['10 audits', '100 unrest', 'births', '5th', 'archive points']) {
      expect(text.toLowerCase()).toContain(part.toLowerCase())
    }
    app.unmount()
  })
})
