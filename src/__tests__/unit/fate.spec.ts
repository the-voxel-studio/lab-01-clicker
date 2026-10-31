/**
 * Plan 04 Task 5: the fate of a reign.
 *
 * @vitest-environment jsdom
 */

import { readFileSync, readdirSync } from 'node:fs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import App from '@/App.vue'
import type { DefeatReason, GameState } from '@/core/types'
import { triggerDefeat } from '@/core/mutations'
import { useArchivesStore } from '@/stores/archives'
import { useGameStore } from '@/stores/game'
import { useNavStore } from '@/stores/nav'
import { useSettingsStore } from '@/stores/settings'
import { fateView } from '@/ui/fate'
import { routeForPhase } from '@/ui/fortune'

function begin(reducedMotion = true) {
  const pinia = createPinia()
  setActivePinia(pinia)
  useArchivesStore().load()
  const settings = useSettingsStore()
  settings.load()
  settings.reducedMotion = reducedMotion
  const game = useGameStore()
  game.begin(7)
  const nav = useNavStore()
  nav.go('run')
  return { pinia, game, nav, state: game.run! }
}

function failed(state: GameState): void {
  state.deadline = 3
  state.ap = 2400
  state.lastAuditOutcome = {
    deadline: 3,
    apMet: false,
    popMet: false,
    militaryMet: true,
    passedCount: 1,
    success: false,
    royalPardonIssued: false,
    isGameOver: true,
    victory: false,
    grossApRate: 1,
  }
}

function die(game: ReturnType<typeof useGameStore>, reason: DefeatReason): void {
  triggerDefeat(game.run!, reason)
  game.advance(0.05)
}

function win(game: ReturnType<typeof useGameStore>): void {
  const state = game.run!
  state.isGameOver = true
  state.isVictory = true
  state.phase = 'RUN_VICTORY'
  game.advance(0.05)
}

const TITLES: [DefeatReason, string][] = [
  ['quota_failure', 'Struck from the rolls.'],
  ['revolution', 'The people came at dawn.'],
  ['bankruptcy', 'The Lombard took the rest.'],
  ['conquest', 'I am without a kingdom.'],
]

describe('Task 5: the fate of a reign', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.stubGlobal('requestAnimationFrame', () => 0)
    vi.stubGlobal('cancelAnimationFrame', () => undefined)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    Reflect.deleteProperty(navigator, 'vibrate')
  })

  it('goes through the fate screen on a defeat and on a victory', () => {
    const first = begin()
    die(first.game, 'revolution')
    expect(first.nav.screen).toBe('fate')
    const second = begin()
    win(second.game)
    expect(second.nav.screen).toBe('fate')
  })

  it('skips the fate screen when the crown is laid down or the reign restarted', () => {
    const first = begin()
    first.game.abandon()
    expect(first.nav.screen).toBe('end')
    const second = begin()
    second.game.restart()
    expect(second.nav.screen).toBe('run')
  })

  it('leads on to the register', async () => {
    const { pinia, game, nav } = begin()
    const app = mount(App, { global: { plugins: [pinia] } })
    die(game, 'revolution')
    await flushPromises()
    await app.get('[data-fate-continue]').trigger('click')
    expect(nav.screen).toBe('end')
  })

  it('stays outside the reign for the router', () => {
    expect(routeForPhase('THREAT_HERALD', 'fate')).toBeNull()
    expect(routeForPhase('AUDIT_ASSESSMENT', 'fate')).toBeNull()
  })

  it.each(TITLES)('renders the %s scene with its title', async (reason, title) => {
    const { pinia, game, state } = begin()
    failed(state)
    const app = mount(App, { global: { plugins: [pinia] } })
    die(game, reason)
    await flushPromises()
    expect(app.get('[data-fate]').attributes('data-outcome')).toBe(reason)
    expect(app.get('[data-fate] h2').text()).toBe(title)
    expect(app.get(`[data-scene="${reason}"]`).find('img').exists()).toBe(true)
  })

  it('writes the ledger of a failed audit from what was counted', async () => {
    const { pinia, game, state } = begin()
    failed(state)
    const app = mount(App, { global: { plugins: [pinia] } })
    die(game, 'quota_failure')
    await flushPromises()
    const ledger = app.get('.ledger').text()
    expect(ledger).toContain('AP, 1 AP/s, short')
    expect(ledger).toContain('Force')
    expect(ledger).not.toMatch(/\d of \d/)
  })

  it('renders the victory at dawn', async () => {
    const { pinia, game } = begin()
    const app = mount(App, { global: { plugins: [pinia] } })
    win(game)
    await flushPromises()
    expect(app.get('[data-fate] h2').text()).toBe('Regnavi.')
    expect(app.text()).toContain('I have reigned.')
    expect(app.text()).toContain("Ten audits passed. The Crown's auditor lays down his pen.")
  })

  it('names the first unmet quota with the shortfall the audit counted', () => {
    const { state } = begin()
    failed(state)
    state.lastAuditOutcome = {
      ...state.lastAuditOutcome!,
      required: { apRate: 413, pop: 1, military: 1 },
    }
    triggerDefeat(state, 'quota_failure')
    expect(fateView(state).line).toMatch(/^The Crown counted 412 AP\/s short at the third audit/)
  })

  it('names the first unmet quota alone for an audit saved without its target', () => {
    const { state } = begin()
    failed(state)
    triggerDefeat(state, 'quota_failure')
    expect(fateView(state).line).toMatch(/^The Crown found your AP short at the third audit/)
    state.lastAuditOutcome = { ...state.lastAuditOutcome!, apMet: true, popMet: false }
    expect(fateView(state).line).toContain('your people short')
    state.lastAuditOutcome = {
      ...state.lastAuditOutcome!,
      popMet: true,
      militaryMet: false,
    }
    expect(fateView(state).line).toContain('your force short')
  })

  it.each(['conquest', 'revolution', 'bankruptcy'] as const)(
    'names the audit in the %s line',
    (reason) => {
      const { state } = begin()
      state.deadline = 5
      triggerDefeat(state, reason)
      expect(fateView(state).line).toContain('fifth audit')
    },
  )

  it('shows text and button at once without motion', async () => {
    const { pinia, game } = begin(true)
    const app = mount(App, { global: { plugins: [pinia] } })
    die(game, 'conquest')
    await flushPromises()
    expect(app.find('[data-fate-continue]').exists()).toBe(true)
  })

  it('holds the button until the beat is over, then waits for the player', async () => {
    vi.useFakeTimers()
    const { pinia, game, nav } = begin(false)
    const app = mount(App, { global: { plugins: [pinia] }, attachTo: document.body })
    die(game, 'conquest')
    await flushPromises()
    expect(app.find('[data-fate-continue]').exists()).toBe(false)
    await vi.advanceTimersByTimeAsync(5000)
    const button = app.get<HTMLButtonElement>('[data-fate-continue]')
    button.element.focus()
    expect(document.activeElement).toBe(button.element)
    await vi.advanceTimersByTimeAsync(60000)
    expect(nav.screen).toBe('fate')
    app.unmount()
  })

  it('shakes the phone once on a death, with motion allowed', async () => {
    const vibrate = vi.fn<() => boolean>()
    Object.defineProperty(navigator, 'vibrate', { value: vibrate, configurable: true })
    const { pinia, game } = begin(false)
    mount(App, { global: { plugins: [pinia] } })
    die(game, 'bankruptcy')
    await flushPromises()
    expect(vibrate).toHaveBeenCalledTimes(1)
  })

  it('never shakes the phone on a victory or without motion', async () => {
    const vibrate = vi.fn<() => boolean>()
    Object.defineProperty(navigator, 'vibrate', { value: vibrate, configurable: true })
    const first = begin(false)
    mount(App, { global: { plugins: [first.pinia] } })
    win(first.game)
    await flushPromises()
    const second = begin(true)
    mount(App, { global: { plugins: [second.pinia] } })
    die(second.game, 'bankruptcy')
    await flushPromises()
    expect(vibrate).not.toHaveBeenCalled()
  })

  it('leaves the fallen page out of the way of the button', async () => {
    const { pinia, game } = begin()
    const app = mount(App, { global: { plugins: [pinia] } })
    die(game, 'bankruptcy')
    await flushPromises()
    expect(app.get('.fate-tear').classes()).toContain('pointer-events-none')
    expect(app.get('[data-scene="bankruptcy"]').classes()).toContain('overflow-hidden')
  })

  it('keeps rose out of the death scenes', () => {
    const dir = 'src/components/game/fate'
    const deaths = readdirSync(dir).filter((file) => !file.includes('Victory'))
    expect(deaths.length).toBeGreaterThan(4)
    for (const file of deaths) expect(readFileSync(`${dir}/${file}`, 'utf8')).not.toMatch(/rose/i)
  })
})
