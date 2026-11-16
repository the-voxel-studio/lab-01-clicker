/**
 * Plan V2_DIFFICULTY, Task 5: the level is chosen at the seal, named in the menu and on the end of
 * the reign, and never on the HUD.
 *
 * @module __tests__/unit/level_choice.spec
 */

import { beforeEach, describe, expect, it } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import EndScreen from '@/components/game/EndScreen.vue'
import HallScreen from '@/components/game/HallScreen.vue'
import LevelChoice from '@/components/game/LevelChoice.vue'
import GameMenu from '@/components/game/run/GameMenu.vue'
import RunHud from '@/components/game/run/RunHud.vue'
import { DIFFICULTY_LEVELS, LEVEL_DATA } from '@/data/levels'
import { useArchivesStore } from '@/stores/archives'
import { useGameStore } from '@/stores/game'
import { useNavStore } from '@/stores/nav'
import { useSettingsStore } from '@/stores/settings'

function stores() {
  const pinia = createPinia()
  setActivePinia(pinia)
  useArchivesStore().load()
  const settings = useSettingsStore()
  settings.load()
  return { pinia, settings, game: useGameStore(), nav: useNavStore() }
}

describe('Task 5: choose the level at the seal', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('offers the three levels as a radio group, the last one chosen checked', () => {
    const { pinia, settings } = stores()
    settings.lastLevel = 'stern'
    const wrapper = mount(LevelChoice, { global: { plugins: [pinia] } })
    expect(wrapper.find('[role="radiogroup"]').exists()).toBe(true)
    const radios = wrapper.findAll('[role="radio"]')
    expect(radios.map((radio) => radio.attributes('data-level'))).toEqual([...DIFFICULTY_LEVELS])
    expect(radios.map((radio) => radio.attributes('aria-checked'))).toEqual([
      'false',
      'true',
      'false',
    ])
    for (const level of DIFFICULTY_LEVELS) {
      const radio = wrapper.find(`[data-level="${level}"]`)
      expect(radio.text()).toContain(LEVEL_DATA[level].name)
      expect(radio.text()).toContain(LEVEL_DATA[level].description)
    }
  })

  it('moves the choice with the arrow keys, round the ends', async () => {
    const { pinia, settings } = stores()
    const wrapper = mount(LevelChoice, { global: { plugins: [pinia] }, attachTo: document.body })
    const group = wrapper.find('[role="radiogroup"]')
    await group.trigger('keydown', { key: 'ArrowDown' })
    expect(settings.lastLevel).toBe('stern')
    await group.trigger('keydown', { key: 'ArrowRight' })
    expect(settings.lastLevel).toBe('tyrannical')
    await group.trigger('keydown', { key: 'ArrowDown' })
    expect(settings.lastLevel).toBe('ordinary')
    await group.trigger('keydown', { key: 'ArrowUp' })
    expect(settings.lastLevel).toBe('tyrannical')
    expect(document.activeElement?.getAttribute('data-level')).toBe('tyrannical')
    wrapper.unmount()
  })

  it('begins the reign at the level checked when the seal is broken', async () => {
    const { pinia, game, nav } = stores()
    const wrapper = mount(HallScreen, { global: { plugins: [pinia] } })
    await wrapper.find('[data-level="tyrannical"]').trigger('click')
    expect(game.run).toBeNull()
    const seal = wrapper.findAll('button').find((b) => b.text() === 'Begin a reign')!
    await seal.trigger('click')
    expect(game.level).toBe('tyrannical')
    expect(nav.screen).toBe('run')
  })

  it('names the level of the reign in the game menu', async () => {
    const { pinia, game, nav } = stores()
    game.begin(42, 'stern')
    nav.go('run')
    const wrapper = mount(GameMenu, { global: { plugins: [pinia] } })
    nav.menuOpen = true
    await flushPromises()
    expect(wrapper.find('[data-reign-level]').text()).toContain('Stern')
  })

  it('names the level on the end of the reign', async () => {
    const { pinia, game } = stores()
    game.begin(42, 'tyrannical')
    game.abandon()
    const wrapper = mount(EndScreen, { global: { plugins: [pinia] } })
    await flushPromises()
    expect(wrapper.find('[data-reign-level]').text()).toContain('Tyrannical')
  })

  it('keeps the level off the HUD', async () => {
    const { pinia, game, nav } = stores()
    game.begin(42, 'tyrannical')
    nav.go('run')
    const wrapper = mount(RunHud, { global: { plugins: [pinia] } })
    await flushPromises()
    expect(wrapper.text()).not.toContain('Tyrannical')
  })

  it('names the level of the saved reign on the way to continue it', async () => {
    const first = stores()
    first.game.begin(42, 'tyrannical')
    first.game.save()
    const { pinia, settings, game } = stores()
    expect(game.savedLevel).toBe('tyrannical')
    settings.lastLevel = 'ordinary'
    const wrapper = mount(HallScreen, { global: { plugins: [pinia] } })
    expect(wrapper.find('[data-continue]').text()).toBe('Continue the Tyrannical reign at audit 1')
    await wrapper.find('[data-continue]').trigger('click')
    expect(game.level).toBe('tyrannical')
  })
})
