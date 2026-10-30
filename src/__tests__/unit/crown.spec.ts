/**
 * Plan 03 Task 4: the Crown page.
 *
 * @vitest-environment jsdom
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import CounselLine from '@/components/game/run/CounselLine.vue'
import CrownPage from '@/components/game/orders/CrownPage.vue'
import { calculateMaxPopulation } from '@/core/engine'
import { useArchivesStore } from '@/stores/archives'
import { useGameStore } from '@/stores/game'
import { useNavStore } from '@/stores/nav'
import { useSettingsStore } from '@/stores/settings'
import { adviseCounsel } from '@/ui/counsel'
import { coloniseView, edictRows, TAX_SETTLE_MS, taxView, taxWarning } from '@/ui/crown'

function begin() {
  const pinia = createPinia()
  setActivePinia(pinia)
  useArchivesStore().load()
  useSettingsStore().load()
  const game = useGameStore()
  game.begin(42)
  return { pinia, game, nav: useNavStore(), state: game.run! }
}

describe('Task 4: Crown', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('escalates the unrest of an edict with its uses', () => {
    const { state } = begin()
    expect(edictRows(state)[0]!.text).toContain('Unrest +35')
    state.edictUsageCounts.forced_tithe = 2
    expect(edictRows(state)[0]!.text).toContain('Unrest +70')
  })

  it('prices the festival like the engine', () => {
    const { state } = begin()
    state.ap = 10000
    expect(edictRows(state)[2]!.priceLabel).toBe('Pay 2k AP')
    state.ap = 50
    const festival = edictRows(state)[2]!
    expect(festival.priceLabel).toBe('Pay 100 AP')
    expect(festival.blocked).toBe('Not enough AP')
    expect(festival.command).toBeNull()
  })

  it('allows one edict each audit', () => {
    const { state } = begin()
    state.lastEdictDeadline = state.deadline
    for (const row of edictRows(state)) {
      expect(row.blocked).toBe('One edict each audit')
      expect(row.command).toBeNull()
    }
  })

  it('closes church seizure after its last use', () => {
    const { state } = begin()
    state.edictUsageCounts.church_seizure = 2
    expect(edictRows(state)[1]!.blocked).toBe('Nothing left to melt')
  })

  it('warns of a tax shock and of anger above the fair rate', () => {
    const { state } = begin()
    state.taxRate = 25
    expect(taxWarning(state, 25)).toBeNull()
    expect(taxWarning(state, 30)).toBe('Above 25%, the villages grow angry.')
    expect(taxWarning(state, 41)).toBe('A rise of 16 points at once: unrest +20.')
  })

  it('counts down a proclamation, and lowers at once', async () => {
    const { game, state } = begin()
    state.taxRate = 25
    game.act({ type: 'SET_TAX_RATE', rate: 35 })
    expect(taxView(state)).toMatchObject({ rate: 25, pending: 35, secondsLeft: 8 })
    game.act({ type: 'SET_TAX_RATE', rate: 10 })
    expect(taxView(state)).toMatchObject({ rate: 10, pending: null, secondsLeft: 0 })
  })

  it('doubles the price of each new province', () => {
    const { state } = begin()
    expect(coloniseView(state).cost).toBe(1500)
    state.colonisedProvincesCount = 2
    expect(coloniseView(state).cost).toBe(6000)
    expect(coloniseView(state)).toMatchObject({ blocked: 'Not enough AP', command: null })
  })

  it('proclaims once when the slider settles, never during the drag', async () => {
    const { pinia, game, state } = begin()
    state.taxRate = 25
    const page = mount(CrownPage, { global: { plugins: [pinia] } })
    const slider = page.get('[data-tax]')
    ;(slider.element as HTMLInputElement).value = '30'
    await slider.trigger('input')
    expect(page.text()).toContain('30%')
    expect(game.run!.pendingTaxRate).toBeNull()
    await slider.trigger('change')
    expect(game.run!.pendingTaxRate).toBeNull()
    vi.advanceTimersByTime(TAX_SETTLE_MS)
    expect(game.run!.pendingTaxRate).toBe(30)
  })

  it('charges one shock for a burst of arrow keys', async () => {
    const { pinia, game, state } = begin()
    state.taxRate = 25
    state.unrest = 10
    const page = mount(CrownPage, { global: { plugins: [pinia] } })
    const slider = page.get('[data-tax]')
    for (let rate = 26; rate <= 45; rate++) {
      ;(slider.element as HTMLInputElement).value = String(rate)
      await slider.trigger('input')
      await slider.trigger('change')
      vi.advanceTimersByTime(50)
    }
    vi.advanceTimersByTime(TAX_SETTLE_MS)
    expect(game.run!.pendingTaxRate).toBe(45)
    expect(game.run!.unrest).toBeLessThanOrEqual(30)
  })

  it('proclaims a settling rate when the page is left', async () => {
    const { pinia, game, state } = begin()
    state.taxRate = 25
    const page = mount(CrownPage, { global: { plugins: [pinia] } })
    const slider = page.get('[data-tax]')
    ;(slider.element as HTMLInputElement).value = '30'
    await slider.trigger('input')
    await slider.trigger('change')
    page.unmount()
    expect(game.run!.pendingTaxRate).toBe(30)
  })

  it('enacts an edict and colonises from the page', async () => {
    const { pinia, game, state } = begin()
    state.ap = 100000
    const page = mount(CrownPage, { global: { plugins: [pinia] } })
    await page.get('[data-edict="grand_festival"]').trigger('click')
    await flushPromises()
    expect(game.run!.lastEdictDeadline).toBe(game.run!.deadline)
    expect(page.get('[data-edict="forced_tithe"]').text()).toContain('One edict each audit')
    expect(page.get('[data-edict="grand_festival"]').classes()).toContain('motion-stamp')
    const before = game.run!.provinces
    await page.get('[data-colonise]').trigger('click')
    expect(game.run!.provinces).toBe(before + 1)
    await flushPromises()
    expect(page.find('[data-raised]').exists()).toBe(true)
  })

  it('sends the steward from full villages to the Crown', async () => {
    const { pinia, game, nav, state } = begin()
    state.taxRate = 0
    state.deadline = 10
    state.units.scribe = 1000000
    state.units.soldier = 1000000
    state.totalPopulation = calculateMaxPopulation(state)
    game.advance(0)
    const counsel = adviseCounsel(state, game.quotas, 'enchanted', 60)
    expect(counsel.go).toBe('crown')
    nav.go('run')
    const line = mount(CounselLine, { global: { plugins: [pinia] } })
    await line.get('[data-counsel-go]').trigger('click')
    expect(nav.screen).toBe('crown')
  })
})
