/**
 * Plan 03 Task 3: the Commons, Chancery and Host pages.
 *
 * @vitest-environment jsdom
 */

import { beforeEach, describe, expect, it } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import OrderPage from '@/components/game/orders/OrderPage.vue'
import type { UnitOrder } from '@/core/types'
import { useArchivesStore } from '@/stores/archives'
import { useGameStore } from '@/stores/game'
import { useSettingsStore } from '@/stores/settings'

function page(order: UnitOrder, prepare?: (game: ReturnType<typeof useGameStore>) => void) {
  const pinia = createPinia()
  setActivePinia(pinia)
  useArchivesStore().load()
  useSettingsStore().load()
  const game = useGameStore()
  game.begin(42)
  game.run!.ap = 100000
  game.run!.freeSerfs = 500
  prepare?.(game)
  game.advance(0)
  return { game, wrapper: mount(OrderPage, { props: { order }, global: { plugins: [pinia] } }) }
}

describe('Task 3: order pages', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('buys a unit from its row', async () => {
    const { game, wrapper } = page('people')
    await wrapper.get('[data-unit="peasant"] [data-buy]').trigger('click')
    await flushPromises()
    expect(game.run!.units.peasant).toBe(1)
    expect(wrapper.find('[data-coin]').exists()).toBe(true)
    expect(wrapper.get('[data-unit="peasant"]').text()).toContain('1 working')
  })

  it('disables a blocked row and says why', () => {
    const { wrapper } = page('people', (game) => {
      game.run!.ap = 0
    })
    const buy = wrapper.get('[data-unit="peasant"] [data-buy]')
    expect(buy.attributes('disabled')).toBeDefined()
    expect(buy.text()).toContain('Not enough AP')
  })

  it('reprices the rows with the chosen bulk size', async () => {
    const { wrapper } = page('people', (game) => {
      game.run!.deadline = 3
    })
    const one = wrapper.get('[data-unit="peasant"] [data-buy]').text()
    await wrapper.get('[data-bulk="10"]').trigger('click')
    expect(wrapper.get('[data-unit="peasant"] [data-buy]').text()).not.toBe(one)
  })

  it('shows a refusal of the engine on the page', async () => {
    const { game, wrapper } = page('people')
    game.run!.phase = 'EXPEDITION'
    await wrapper.get('[data-unit="peasant"] [data-buy]').trigger('click')
    await flushPromises()
    expect(wrapper.find('[data-refusal]').exists()).toBe(true)
  })

  it('states the paperwork on the Chancery', () => {
    const { wrapper } = page('admin', (game) => {
      game.run!.units.scribe = 200
    })
    expect(wrapper.get('[data-panel]').text()).toMatch(/Paperwork eats \d+% of your AP\./)
  })

  it('states force, demand and upkeep on the Host', () => {
    const { wrapper } = page('military', (game) => {
      game.run!.units.soldier = 5
    })
    const text = wrapper.get('[data-panel]').text()
    expect(text).toMatch(/Force 5\. The Crown wants \d+\./)
    expect(text).toMatch(/Upkeep [\d.]+ AP each second\./)
  })

  it('reveals Tier II once the patent is sealed', async () => {
    const { game, wrapper } = page('people', (run) => {
      run.run!.deadline = 4
      run.run!.units.peasant = 12
    })
    expect(wrapper.find('[data-unit="farmer"]').exists()).toBe(false)
    await wrapper.get('[data-patent]').trigger('click')
    await flushPromises()
    expect(game.run!.unlockedPatents.people).toBe(true)
    expect(wrapper.find('[data-unit="farmer"]').exists()).toBe(true)
    expect(wrapper.find('[data-patent]').exists()).toBe(false)
    expect(wrapper.find('[data-lock-break]').exists()).toBe(true)
  })

  it('disbands from the Host only', async () => {
    const { game, wrapper } = page('military', (run) => {
      run.run!.units.soldier = 5
    })
    await wrapper.get('[data-disband-open]').trigger('click')
    await wrapper.get('[data-disband="soldier"]').trigger('click')
    expect(game.run!.units.soldier).toBe(4)
    expect(page('people').wrapper.find('[data-disband-open]').exists()).toBe(false)
  })

  it('warns when the coffer cannot pay the severance', async () => {
    const { wrapper } = page('military', (run) => {
      run.run!.units.soldier = 5
      run.run!.ap = 0
    })
    await wrapper.get('[data-disband-open]').trigger('click')
    expect(wrapper.text()).toContain('unpaid men stir unrest')
  })
})
