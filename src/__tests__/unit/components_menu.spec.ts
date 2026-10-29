/**
 * Game menu: pause while open, save, restart, chronicle, hall, settings, abandon.
 *
 * @module __tests__/unit/components_menu.spec
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import GameMenu from '@/components/game/run/GameMenu.vue'
import { useArchivesStore } from '@/stores/archives'
import { useGameStore } from '@/stores/game'
import { useNavStore } from '@/stores/nav'
import { useSettingsStore } from '@/stores/settings'

function setup() {
  const pinia = createPinia()
  setActivePinia(pinia)
  const archives = useArchivesStore()
  archives.load()
  useSettingsStore().load()
  const game = useGameStore()
  const nav = useNavStore()
  game.begin(42)
  nav.go('run')
  const wrapper = mount(GameMenu, { global: { plugins: [pinia] } })
  return { wrapper, game, nav, archives }
}

async function open(nav: ReturnType<typeof useNavStore>) {
  nav.menuOpen = true
  await flushPromises()
}

function item(wrapper: VueWrapper, label: string) {
  const found = wrapper.findAll('button').find((b) => b.text().startsWith(label))
  if (!found) throw new Error(`No item "${label}" in: ${wrapper.text()}`)
  return found
}

describe('Task 9: game menu', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('pauses the reign while open and resumes it on close', async () => {
    const { wrapper, game, nav } = setup()
    await open(nav)
    expect(game.run?.isPaused).toBe(true)
    expect(wrapper.text()).toContain('Reign 1')
    expect(wrapper.text()).toContain('First audit, 1 min 40 s left')
    expect(wrapper.text()).toContain('Game paused while this menu is open.')
    await item(wrapper, 'Resume').trigger('click')
    expect(nav.menuOpen).toBe(false)
    expect(game.run?.isPaused).toBe(false)
  })

  it('keeps a reign paused that was paused before the menu opened', async () => {
    const { wrapper, game, nav } = setup()
    game.act({ type: 'SET_PAUSED', paused: true })
    await open(nav)
    await item(wrapper, 'Resume').trigger('click')
    expect(game.run?.isPaused).toBe(true)
  })

  it('saves the reign and says when', async () => {
    const { wrapper, nav } = setup()
    await open(nav)
    expect(wrapper.text()).toContain('Not saved yet')
    await item(wrapper, 'Save the reign').trigger('click')
    expect(wrapper.text()).toContain('Last saved at the first audit')
  })

  it('restarts the reign on the same seed', async () => {
    const { wrapper, game, nav, archives } = setup()
    game.advance(5)
    await open(nav)
    await item(wrapper, 'Restart the reign').trigger('click')
    expect(archives.history).toHaveLength(1)
    expect(archives.history[0]?.outcome).toBe('abandoned')
    expect(game.run?.seed).toBe(42)
    expect(game.secondsLeft).toBe(100)
    expect(game.run?.isPaused).toBe(false)
  })

  it('opens the chronicle', async () => {
    const { wrapper, nav } = setup()
    await open(nav)
    await item(wrapper, 'Read the chronicle').trigger('click')
    expect(nav.screen).toBe('chronicle')
  })

  it('returns to the hall with the reign saved and not paused', async () => {
    const { wrapper, game, nav } = setup()
    await open(nav)
    await item(wrapper, 'Return to the hall').trigger('click')
    expect(nav.screen).toBe('hall')
    expect(game.savedDeadline).toBe(1)
    setActivePinia(createPinia())
    useArchivesStore().load()
    const reloaded = useGameStore()
    expect(reloaded.resume()).toBe(true)
    expect(reloaded.run?.isPaused).toBe(false)
  })

  it('asks a second tap before abandoning', async () => {
    const { wrapper, game, nav, archives } = setup()
    await open(nav)
    await item(wrapper, 'Abandon the reign').trigger('click')
    expect(archives.history).toHaveLength(0)
    expect(wrapper.text()).toContain('Tap again to abandon')
    vi.advanceTimersByTime(3100)
    await flushPromises()
    expect(wrapper.text()).not.toContain('Tap again to abandon')
    await item(wrapper, 'Abandon the reign').trigger('click')
    await item(wrapper, 'Tap again to abandon').trigger('click')
    expect(archives.history[0]?.outcome).toBe('abandoned')
    expect(game.isOver).toBe(true)
    expect(nav.screen).toBe('end')
  })

  it('is a dialog that closes on Escape and blocks what lies behind', async () => {
    const { wrapper, nav } = setup()
    await open(nav)
    const dialog = wrapper.get('[role="dialog"]')
    expect(dialog.attributes('aria-modal')).toBe('true')
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await flushPromises()
    expect(nav.menuOpen).toBe(false)
  })

  it('keeps the reign paused while the chronicle is read from the menu', async () => {
    const { wrapper, game, nav } = setup()
    await open(nav)
    await item(wrapper, 'Read the chronicle').trigger('click')
    expect(nav.screen).toBe('chronicle')
    expect(game.run?.isPaused).toBe(true)
  })

  it('gives a fresh abandon confirmation its full three seconds', async () => {
    const { wrapper, nav } = setup()
    await open(nav)
    await item(wrapper, 'Abandon the reign').trigger('click')
    vi.advanceTimersByTime(2000)
    await item(wrapper, 'Resume').trigger('click')
    await open(nav)
    await item(wrapper, 'Abandon the reign').trigger('click')
    vi.advanceTimersByTime(2000)
    await flushPromises()
    expect(wrapper.text()).toContain('Tap again to abandon')
  })
})
