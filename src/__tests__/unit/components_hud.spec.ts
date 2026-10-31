/**
 * Run HUD: coffer, rate, candle clock, tally sticks, unrest line, time controls and Menu.
 *
 * @module __tests__/unit/components_hud.spec
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import RunHud from '@/components/game/run/RunHud.vue'
import { useArchivesStore } from '@/stores/archives'
import { useGameStore } from '@/stores/game'
import { useNavStore } from '@/stores/nav'
import { useSettingsStore } from '@/stores/settings'

function mountHud() {
  const pinia = createPinia()
  setActivePinia(pinia)
  useArchivesStore().load()
  useSettingsStore().load()
  const game = useGameStore()
  game.begin(42)
  game.advance(1)
  const wrapper = mount(RunHud, { global: { plugins: [pinia] } })
  return { wrapper, game, nav: useNavStore() }
}

describe('Plan V2_LEDGER_LANGUAGE Task 4: the HUD says what it means', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('shows the room beside the demand on the People stick', () => {
    const { wrapper, game } = mountHud()
    const people = wrapper.get('[data-quota="pop"]').text()
    const quota = game.quotas[1]!
    expect(people).toContain(`${Math.floor(quota.current)} / ${Math.ceil(quota.required)}`)
    expect(people).toContain(`Room ${game.room}`)
    expect(game.room).toBeGreaterThan(0)
  })

  it('tells why double speed is locked, in words', async () => {
    const { wrapper } = mountHud()
    await wrapper.get('[data-double-speed]').trigger('click')
    expect(wrapper.get('[data-double-reason]').text()).toBe('Unlocks at the fifth audit')
  })

  it('closes the reason on any tap elsewhere and by itself', async () => {
    vi.useFakeTimers()
    const { wrapper } = mountHud()
    await wrapper.get('[data-double-speed]').trigger('click')
    window.dispatchEvent(new Event('pointerdown'))
    await flushPromises()
    expect(wrapper.find('[data-double-reason]').exists()).toBe(false)
    await wrapper.get('[data-double-speed]').trigger('click')
    vi.advanceTimersByTime(4000)
    await flushPromises()
    expect(wrapper.find('[data-double-reason]').exists()).toBe(false)
    vi.useRealTimers()
  })

  it('writes the unrest figure in the display face', () => {
    const { wrapper } = mountHud()
    expect(wrapper.get('[data-unrest] .font-display').text()).toMatch(/^\d+$/)
  })
})

describe('Task 5: HUD', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('shows the coffer, the rate, the clock and the audit', () => {
    const { wrapper, game } = mountHud()
    expect(wrapper.find('[data-coffer]').text()).toContain(
      Math.floor(game.coffer).toLocaleString('en'),
    )
    expect(wrapper.text()).toMatch(/[+−]\d+ AP each second/)
    expect(wrapper.text()).toContain('1:39')
    expect(wrapper.text()).toContain('first audit')
    expect(wrapper.text()).toMatch(/Unrest \d+ of 100, overthrown at 100/)
  })

  it('writes the AP quota as a rate and names each quota state', () => {
    const { wrapper, game } = mountHud()
    const sticks = wrapper.findAll('[data-quota]')
    expect(sticks.map((s) => s.attributes('data-quota'))).toEqual(['ap', 'pop', 'military'])
    expect(sticks[0]?.text()).toContain('AP/s')
    for (const [index, quota] of game.quotas.entries()) {
      const label = sticks[index]?.attributes('aria-label') ?? ''
      expect(label).toContain(quota.met ? 'met' : 'short')
      expect(sticks[index]?.find('[data-met-mark]').exists()).toBe(quota.met)
    }
  })

  it('pauses and resumes the reign', async () => {
    const { wrapper, game } = mountHud()
    const pause = wrapper.get('[aria-label="Pause"]')
    await pause.trigger('click')
    expect(game.run?.isPaused).toBe(true)
    await wrapper.get('[aria-label="Resume"]').trigger('click')
    expect(game.run?.isPaused).toBe(false)
  })

  it('locks double speed before the fifth audit', () => {
    const { wrapper } = mountHud()
    const double = wrapper.get('[data-double-speed]')
    expect(double.attributes('aria-disabled')).toBe('true')
    expect(double.attributes('title')).toBe('Unlocks at the fifth audit')
  })

  it('opens the game menu', async () => {
    const { wrapper, nav } = mountHud()
    await wrapper.get('[aria-label="Menu"]').trigger('click')
    expect(nav.menuOpen).toBe(true)
  })

  it('writes a negative coffer with a true minus sign', async () => {
    const { wrapper, game } = mountHud()
    // The figure rolls under normal motion; reduced motion shows it at once.
    useSettingsStore().reducedMotion = true
    game.run!.ap = -12
    game.act({ type: 'SET_PAUSED', paused: true })
    await flushPromises()
    expect(wrapper.find('[data-coffer]').text()).toContain('\u221212')
  })
})
