/**
 * Plan 03 Task 1: the frame shared by the five order pages.
 *
 * @vitest-environment jsdom
 */

import { beforeEach, describe, expect, it } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import App from '@/App.vue'
import OrderFrame from '@/components/game/orders/OrderFrame.vue'
import { useArchivesStore } from '@/stores/archives'
import { useGameStore } from '@/stores/game'
import { useNavStore, type Screen } from '@/stores/nav'
import { useSettingsStore } from '@/stores/settings'

function stores() {
  const pinia = createPinia()
  setActivePinia(pinia)
  useArchivesStore().load()
  useSettingsStore().load()
  const game = useGameStore()
  game.begin(42)
  return { pinia, game, nav: useNavStore() }
}

describe('Task 1: order frame', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('keeps the coffer, the title, the body and the order bar', () => {
    const { pinia } = stores()
    const frame = mount(OrderFrame, {
      props: { title: 'The Commons', intro: 'Those who work the land.' },
      slots: { default: '<p data-body>rows</p>' },
      global: { plugins: [pinia] },
    })
    expect(frame.find('[data-coffer]').exists()).toBe(true)
    expect(frame.get('h1').text()).toBe('The Commons')
    expect(frame.text()).toContain('Those who work the land.')
    expect(frame.find('[data-order-body] [data-body]').exists()).toBe(true)
    expect(frame.findAll('[data-order]')).toHaveLength(6)
  })

  it('keeps unrest in sight on every order page', () => {
    const { pinia } = stores()
    const frame = mount(OrderFrame, {
      props: { title: 'The Crown', intro: '' },
      global: { plugins: [pinia] },
    })
    expect(frame.find('header [data-unrest]').exists()).toBe(true)
  })

  it('gives the candle the tempo of the dread band', () => {
    const { pinia } = stores()
    const frame = mount(OrderFrame, {
      props: { title: 'The Crown', intro: '' },
      global: { plugins: [pinia] },
    })
    expect(frame.attributes('style')).toContain('--tempo-flicker')
  })

  it('opens the game menu from an order page', async () => {
    const { pinia, nav } = stores()
    const frame = mount(OrderFrame, {
      props: { title: 'The Crown', intro: '' },
      global: { plugins: [pinia] },
    })
    await frame.get('button[aria-label="Menu"]').trigger('click')
    expect(nav.menuOpen).toBe(true)
  })

  it('carries the dread band and the pause like the run screen', () => {
    const { pinia, game } = stores()
    game.run!.isPaused = true
    game.advance(0)
    const frame = mount(OrderFrame, {
      props: { title: 'The Host', intro: '' },
      global: { plugins: [pinia] },
    })
    expect(frame.attributes('data-dread')).toBe(game.dread.band)
    expect(frame.attributes('data-paused')).toBe('true')
  })

  it('gives each order its own page', async () => {
    const { pinia, nav } = stores()
    const app = mount(App, { global: { plugins: [pinia] } })
    const pages: [Screen, string][] = [
      ['order_people', 'The Commons'],
      ['order_admin', 'The Chancery'],
      ['order_military', 'The Host'],
      ['fortune', 'Fortune'],
      ['crown', 'The Crown'],
    ]
    for (const [screen, title] of pages) {
      nav.go(screen)
      await flushPromises()
      expect(app.get('h1').text()).toBe(title)
    }
  })
})
