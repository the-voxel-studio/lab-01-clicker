/**
 * Plan V2_CROWN_TABS: the four tabs of the Crown and their recap.
 *
 * @module __tests__/unit/crown_tabs.spec
 */

import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import CrownTabs from '@/components/game/crown/CrownTabs.vue'
import CrownPage from '@/components/game/orders/CrownPage.vue'
import { dispatch } from '@/core/commands'
import { calculateMilitaryPower, calculateNetApRate } from '@/core/engine'
import { createInitialGameState } from '@/core/state'
import { LAWS_DATA } from '@/data/laws'
import { useArchivesStore } from '@/stores/archives'
import { useGameStore } from '@/stores/game'
import { useNavStore } from '@/stores/nav'
import { useSettingsStore } from '@/stores/settings'
import {
  armyRecap,
  cofferRecap,
  crownMarks,
  decreesRecap,
  realmRecap,
  UNREST_ALARM,
} from '@/ui/crownRecap'
import { realmRates } from '@/ui/effects'

function begin() {
  const pinia = createPinia()
  setActivePinia(pinia)
  useArchivesStore().load()
  useSettingsStore().load()
  const game = useGameStore()
  game.begin(7)
  return { pinia, game, nav: useNavStore() }
}

describe('Crown tabs', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('shows four tabs and remembers the choice for the reign only', async () => {
    const { pinia, game, nav } = begin()
    const page = mount(CrownPage, { global: { plugins: [pinia] } })
    await flushPromises()
    expect(page.findAll('[role="tab"]').map((tab) => tab.text())).toEqual([
      'Realm',
      'Coffer',
      'Army',
      'Decrees',
    ])
    await page.get('[data-crown-tab="army"]').trigger('click')
    expect(page.find('[data-tab-army]').exists()).toBe(true)
    await page.get('[role="tablist"]').trigger('keydown', { key: 'ArrowRight' })
    expect(nav.crownTab).toBe('decrees')
    page.unmount()
    game.begin(8)
    expect(nav.crownTab).toBe('realm')
  })

  it('keeps edicts on Decrees and the tax on Coffer', async () => {
    const { pinia, nav } = begin()
    nav.crownTab = 'decrees'
    const page = mount(CrownPage, { global: { plugins: [pinia] } })
    await flushPromises()
    expect(page.find('[data-edict="forced_tithe"]').exists()).toBe(true)
    await page.get('[data-crown-tab="coffer"]').trigger('click')
    expect(page.find('[data-tax]').exists()).toBe(true)
    page.unmount()
  })

  it('sums the coffer to the net rate of the engine', () => {
    const state = createInitialGameState({ seed: 2 })
    const recap = cofferRecap(state)
    const sum = recap.lines.reduce((total, line) => total + line.value, 0)
    expect(sum).toBeCloseTo(calculateNetApRate(state), 6)
  })

  it('reads the force, the pardon, the shields and the seats', () => {
    const state = createInitialGameState({ seed: 2 })
    state.units.soldier = 10
    expect(armyRecap(state).field).toBe(calculateMilitaryPower(state))
    const realm = realmRecap(state, realmRates(state))
    expect(realm.shields).toHaveLength(state.provinceBiomes.length)
    expect(realm.pardon).toContain('still yours')
    state.strikes = 1
    expect(realmRecap(state, realmRates(state)).pardon).toContain('spent')
    expect(decreesRecap(state).seats).toBeGreaterThan(0)
  })

  it('settles new land on Realm, beside the provinces', async () => {
    const { pinia, game, nav } = begin()
    game.run!.ap = 100000
    const page = mount(CrownPage, { global: { plugins: [pinia] } })
    await flushPromises()
    const before = game.run!.provinces
    await page.get('[data-tab-realm] [data-colonise]').trigger('click')
    expect(game.run!.provinces).toBe(before + 1)
    nav.crownTab = 'decrees'
    await flushPromises()
    expect(page.find('[data-colonise]').exists()).toBe(false)
    expect(page.find('[data-edict="forced_tithe"]').exists()).toBe(true)
    page.unmount()
  })

  it('says in one line what each tab holds', async () => {
    const { pinia, nav } = begin()
    const tabs = mount(CrownTabs, { global: { plugins: [pinia] } })
    expect(tabs.get('[data-crown-intro]').text()).toContain('Settle new land here')
    nav.crownTab = 'coffer'
    await flushPromises()
    expect(tabs.get('[data-crown-intro]').text()).toContain('Set the tax here')
    nav.crownTab = 'decrees'
    await flushPromises()
    expect(tabs.get('[data-crown-intro]').text()).toContain('Proclaim an edict')
  })

  it('marks the tabs that answer an alarm of unrest', async () => {
    const { pinia, game } = begin()
    const state = game.run!
    state.taxRate = 25
    expect(crownMarks(state)).toEqual({})
    state.unrest = UNREST_ALARM
    expect(crownMarks(state)).toEqual({ decrees: '!' })
    state.taxRate = 40
    expect(crownMarks(state)).toEqual({ coffer: '!', decrees: '!' })
    game.advance(0)
    const tabs = mount(CrownTabs, { global: { plugins: [pinia] } })
    expect(tabs.get('[data-crown-tab="coffer"] [data-tab-mark]').text()).toBe('!')
    expect(tabs.get('[data-crown-tab="decrees"] [data-tab-mark]').text()).toBe('!')
    expect(tabs.find('[data-crown-tab="realm"] [data-tab-mark]').exists()).toBe(false)
  })

  it('forgets a refusal and an armed edict when the tab changes', async () => {
    const { pinia, game, nav } = begin()
    game.run!.unrest = 82
    nav.crownTab = 'decrees'
    const page = mount(CrownPage, { global: { plugins: [pinia] } })
    await flushPromises()
    await page.get('[data-edict="forced_tithe"]').trigger('click')
    expect(page.get('[data-edict="forced_tithe"]').text()).toBe('Press again to fall')
    await page.get('[data-crown-tab="army"]').trigger('click')
    await page.get('[data-crown-tab="decrees"]').trigger('click')
    expect(page.get('[data-edict="forced_tithe"]').text()).toBe('This ends your reign')
    expect(game.run!.isGameOver).toBe(false)

    game.run!.unrest = 10
    game.run!.ap = 100000
    game.advance(0)
    await page.get('[data-crown-tab="realm"]').trigger('click')
    // The page still shows the open button: the coffer emptied without a new reading.
    game.run!.ap = 0
    await page.get('[data-colonise]').trigger('click')
    expect(page.find('[data-refusal]').exists()).toBe(true)
    await page.get('[data-crown-tab="army"]').trigger('click')
    expect(page.find('[data-refusal]').exists()).toBe(false)
    page.unmount()
  })

  it('sends a tax in flight when the tab changes', async () => {
    const { pinia, game, nav } = begin()
    game.run!.taxRate = 25
    nav.crownTab = 'coffer'
    const page = mount(CrownPage, { global: { plugins: [pinia] } })
    const slider = page.get('[data-tax]')
    ;(slider.element as HTMLInputElement).value = '30'
    await slider.trigger('input')
    await slider.trigger('change')
    await page.get('[data-crown-tab="realm"]').trigger('click')
    expect(game.run!.pendingTaxRate).toBe(30)
    page.unmount()
  })

  it('shows on Coffer what a press of the seal pays', () => {
    const state = createInitialGameState({ seed: 3 })
    state.units.scribe = 200
    state.units.clerk = 40
    state.units.soldier = 50
    state.totalPopulation += 290
    const press = (): number => {
      const copy = structuredClone(state)
      // A critical press pays more: the lowest of many presses is the plain one.
      const gains = Array.from({ length: 30 }, () => {
        copy.clickTokens = 5
        const before = copy.ap
        dispatch(copy, { type: 'STAMP_DOCUMENT' })
        return copy.ap - before
      })
      return Math.min(...gains)
    }
    expect(cofferRecap(state).clickValue).toBeCloseTo(press(), 2)

    const law = LAWS_DATA['law:stamp_duty_monopoly']
    if (!law) throw new Error('expected the stamp duty law')
    state.activeLaws.push(law.id)
    for (const effect of law.effects) {
      if (effect.type === 'stat_modifier') state.activeModifiers.push(effect.modifier)
    }
    expect(cofferRecap(state).clickValue).toBeCloseTo(press(), 2)
  })

  it('never shows work below zero when a law cuts the whole income', () => {
    const state = createInitialGameState({ seed: 3 })
    state.taxRate = 50
    for (const id of [
      'law:imperial_bond_floating',
      'law:holy_days_vigils',
      'law:parish_relief_registers',
    ]) {
      const law = LAWS_DATA[id]
      if (!law) throw new Error(`expected ${id}`)
      state.activeLaws.push(law.id)
      for (const effect of law.effects) {
        if (effect.type === 'stat_modifier') state.activeModifiers.push(effect.modifier)
      }
    }
    const recap = cofferRecap(state)
    const work = recap.lines.find((item) => item.label === 'Work')
    expect(work?.value).toBeGreaterThanOrEqual(0)
    const sum = recap.lines.reduce((total, item) => total + item.value, 0)
    expect(sum).toBeCloseTo(calculateNetApRate(state), 6)
  })

  it('says the pardon is gone once a dilemma has forfeited it', () => {
    const state = createInitialGameState({ seed: 2 })
    state.ruleFlags.push('law_effect:pardon_forfeited')
    const pardon = realmRecap(state, realmRates(state)).pardon
    expect(pardon).not.toContain('still yours')
    expect(pardon).toContain('No pardon')
  })

  it('keeps a held tax in the warning of a deadly edict after the page is left', async () => {
    const { pinia, game, nav } = begin()
    game.run!.unrest = 50
    game.run!.taxRate = 25
    game.act({ type: 'SET_PAUSED', paused: true })
    nav.crownTab = 'coffer'
    let page = mount(CrownPage, { global: { plugins: [pinia] } })
    const slider = page.get('[data-tax]')
    ;(slider.element as HTMLInputElement).value = '45'
    await slider.trigger('input')
    await slider.trigger('change')
    page.unmount()
    expect(game.heldTax).toBe(45)
    nav.go('run')
    nav.go('crown')
    nav.crownTab = 'decrees'
    page = mount(CrownPage, { global: { plugins: [pinia] } })
    await flushPromises()
    expect(page.get('[data-edict="forced_tithe"]').text()).toBe('This ends your reign')
    page.unmount()
  })

  it('charges the shock of a proclaimed rise once in the edict rows', async () => {
    const { pinia, game, nav } = begin()
    game.run!.unrest = 30
    game.run!.taxRate = 25
    nav.crownTab = 'coffer'
    const page = mount(CrownPage, { global: { plugins: [pinia] } })
    const slider = page.get('[data-tax]')
    ;(slider.element as HTMLInputElement).value = '45'
    await slider.trigger('input')
    await slider.trigger('change')
    await page.get('[data-crown-tab="decrees"]').trigger('click')
    await flushPromises()
    expect(game.run!.pendingTaxRate).toBe(45)
    expect(page.get('[data-edict="forced_tithe"]').text()).not.toBe('This ends your reign')
    page.unmount()
  })
})
