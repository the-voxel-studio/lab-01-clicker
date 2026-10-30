/**
 * Run HUD: coffer, rate, candle clock, tally sticks, unrest line, time controls and Menu.
 *
 * @module __tests__/unit/components_hud.spec
 */

import { beforeEach, describe, expect, it } from 'vitest'
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
    expect(wrapper.text()).toMatch(/Unrest \d+%, the realm is quiet/)
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
    expect(double.attributes('disabled')).toBeDefined()
    expect(double.attributes('title')).toBe('Unlocked at the fifth audit')
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
