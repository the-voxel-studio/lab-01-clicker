/**
 * Bare playable shell: hall, run, moment letters, end of reign.
 *
 * @module __tests__/App.spec
 */

import { readFileSync } from 'node:fs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import App from '../App.vue'
import { useArchivesStore } from '@/stores/archives'
import { useGameStore } from '@/stores/game'
import { useNavStore } from '@/stores/nav'
import { useSettingsStore } from '@/stores/settings'

/** Mounts the app on a fresh pinia with storage loaded; the frame loop is held still. */
function mountApp() {
  const pinia = createPinia()
  setActivePinia(pinia)
  useArchivesStore().load()
  useSettingsStore().load()
  const wrapper = mount(App, { global: { plugins: [pinia] } })
  return { wrapper, game: useGameStore() }
}

function button(wrapper: VueWrapper, label: string) {
  const found = wrapper.findAll('button').find((b) => b.text() === label)
  if (!found) throw new Error(`No button "${label}" in: ${wrapper.text()}`)
  return found
}

async function beginReign(wrapper: VueWrapper) {
  await button(wrapper, 'Begin a reign').trigger('click')
}

describe('Task 7: bare playable shell', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.stubGlobal('requestAnimationFrame', () => 0)
    vi.stubGlobal('cancelAnimationFrame', () => undefined)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('opens on the hall', () => {
    const { wrapper } = mountApp()
    expect(wrapper.find('h1').text()).toBe('The Grand Audit')
    expect(wrapper.text()).toContain('Ten audits stand between you and the Crown.')
    expect(wrapper.text()).toContain('Begin a reign')
  })

  it('begins a reign at the first audit', async () => {
    const { wrapper } = mountApp()
    await beginReign(wrapper)
    expect(wrapper.text()).toContain('In the coffer')
    expect(wrapper.text()).toContain('first audit')
    expect(wrapper.text()).toContain('1:40')
    expect(wrapper.text()).toContain('Chronicle of the realm')
    expect(wrapper.find('[data-band]').exists()).toBe(true)
    expect(wrapper.find('[data-order="crown"]').exists()).toBe(true)
    expect(wrapper.find('[data-dread]').attributes('data-dread')).toBe('enchanted')
  })

  it('raises the displayed coffer when a decree is sealed', async () => {
    const { wrapper } = mountApp()
    // The coffer rolls under normal motion; reduced motion shows each value at once.
    useSettingsStore().reducedMotion = true
    await beginReign(wrapper)
    const coffer = () => Number(wrapper.find('[data-coffer]').text().replace(/\D/g, ''))
    const before = coffer()
    for (let i = 0; i < 5; i++) await button(wrapper, 'Seal a decree').trigger('click')
    expect(coffer()).toBeGreaterThan(before)
  })

  it('pauses and resumes the clock', async () => {
    const { wrapper, game } = mountApp()
    await beginReign(wrapper)
    await wrapper.get('[aria-label="Pause"]').trigger('click')
    expect(wrapper.text()).toContain('Time stands still')
    game.advance(1)
    await flushPromises()
    expect(wrapper.text()).toContain('1:40')
    await wrapper.get('[aria-label="Resume"]').trigger('click')
    game.advance(1)
    await flushPromises()
    expect(wrapper.text()).toContain('1:39')
  })

  it('saves the reign in progress when the page is hidden for good', async () => {
    const { wrapper, game } = mountApp()
    await beginReign(wrapper)
    game.advance(3)
    expect(localStorage.getItem('grand_audit_save')).toBeNull()
    window.dispatchEvent(new Event('pagehide'))
    expect(localStorage.getItem('grand_audit_save')).not.toBeNull()
    wrapper.unmount()
  })

  it('saves the reign in progress when the tab is hidden', async () => {
    const { wrapper, game } = mountApp()
    await beginReign(wrapper)
    game.advance(3)
    const hidden = vi.spyOn(document, 'hidden', 'get').mockReturnValue(true)
    document.dispatchEvent(new Event('visibilitychange'))
    hidden.mockRestore()
    expect(localStorage.getItem('grand_audit_save')).not.toBeNull()
    wrapper.unmount()
  })

  it('writes a negative archive point balance with a minus sign', async () => {
    const { wrapper, game } = mountApp()
    await beginReign(wrapper)
    game.abandon()
    const last = game.lastConclusion
    if (!last) throw new Error('conclusion expected')
    game.lastConclusion = { ...last, conclusion: { ...last.conclusion, pointsEarned: -2 } }
    await flushPromises()
    expect(wrapper.text()).toContain('−2archive points')
    expect(wrapper.text()).not.toContain('+-')
  })

  it('locks double speed before the fifth audit', async () => {
    const { wrapper } = mountApp()
    await beginReign(wrapper)
    const double = button(wrapper, '×2')
    expect(double.attributes('disabled')).toBeDefined()
    expect(double.attributes('title')).toBe('Unlocked at the fifth audit')
  })

  it('ends an abandoned reign and returns to a hall with nothing to continue', async () => {
    const { wrapper, game } = mountApp()
    await beginReign(wrapper)
    game.save()
    game.abandon()
    await flushPromises()
    expect(wrapper.text()).toContain('You laid down the crown.')
    expect(wrapper.text()).toContain('Reign 1 is over')
    await button(wrapper, 'Return to the hall').trigger('click')
    expect(wrapper.find('h1').text()).toBe('The Grand Audit')
    expect(wrapper.text()).not.toContain('Continue')
  })

  it('answers the first audit through its letters and reaches the second', async () => {
    const { wrapper, game } = mountApp()
    await beginReign(wrapper)
    for (let t = 0; t < 100; t += 0.25) game.advance(0.25)
    await flushPromises()
    expect(wrapper.text()).toContain('Seal the verdict')

    // Read through a function: the phase changes behind the store between clicks.
    const inActiveCycle = () => game.phase === 'ACTIVE_CYCLE'
    for (let guard = 0; guard < 20 && !inActiveCycle(); guard++) {
      const before = game.revision
      const open = wrapper.findAll('[data-moment-answer]:not([disabled])')
      await (open[open.length - 1] ?? button(wrapper, 'Resume governance')).trigger('click')
      expect(game.revision).toBeGreaterThan(before)
      await flushPromises()
    }
    expect(wrapper.text()).toContain('second audit')
  })

  it('keeps the order bar on the order pages and the chronicle', async () => {
    const { wrapper } = mountApp()
    await beginReign(wrapper)
    await flushPromises()
    await wrapper.get('[data-order="crown"]').trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('The Crown')
    await wrapper.get('[data-order="fortune"]').trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('Fortune')
    useNavStore().go('chronicle')
    await flushPromises()
    expect(wrapper.find('[data-order="crown"]').exists()).toBe(true)
  })

  it('locks the frame of the game to the viewport, so no screen can ever scroll', () => {
    const { wrapper } = mountApp()
    expect(wrapper.get('[data-frame]').classes()).toEqual(
      expect.arrayContaining(['h-dvh', 'overflow-hidden']),
    )
    expect(readFileSync('src/assets/main.css', 'utf8')).toMatch(
      /html,\s*body\s*{[^}]*overflow: hidden;[^}]*overscroll-behavior: none;/,
    )
  })

  it('scrolls the full chronicle inside its list, under a fixed bar', async () => {
    const { wrapper } = mountApp()
    await beginReign(wrapper)
    await flushPromises()
    useNavStore().go('chronicle')
    await flushPromises()
    expect(wrapper.get('[data-chronicle-list]').classes()).toContain('overflow-y-auto')
  })

  it('goes back to the main screen from the Reign button of the bar', async () => {
    const { wrapper } = mountApp()
    await beginReign(wrapper)
    await flushPromises()
    expect(wrapper.get('[data-order="run"]').classes()).toContain('bg-wax')
    await wrapper.get('[data-order="crown"]').trigger('click')
    await flushPromises()
    await wrapper.get('[data-order="crown"]').trigger('click')
    await flushPromises()
    expect(useNavStore().screen).toBe('crown')
    await wrapper.get('[data-order="run"]').trigger('click')
    await flushPromises()
    expect(useNavStore().screen).toBe('run')
    useNavStore().go('chronicle')
    await flushPromises()
    await wrapper.get('[data-order="run"]').trigger('click')
    await flushPromises()
    expect(useNavStore().screen).toBe('run')
  })

  it('brings the player back to the reign when an event needs an answer', async () => {
    const { wrapper } = mountApp()
    await beginReign(wrapper)
    await flushPromises()
    await wrapper.get('[data-order="crown"]').trigger('click')
    await flushPromises()
    const game = useGameStore()
    game.run!.phase = 'COUNCIL_LAWS'
    game.act({ type: 'SET_PAUSED', paused: false })
    await flushPromises()
    expect(useNavStore().screen).toBe('run')
    expect(wrapper.find('[data-moment-letter]').exists()).toBe(true)
  })
})
