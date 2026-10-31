/**
 * Plan 03 Tasks 5 and 6: the Fortune page and the expedition moment.
 *
 * @vitest-environment jsdom
 */

import { beforeEach, describe, expect, it } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import App from '@/App.vue'
import FortunePage from '@/components/game/orders/FortunePage.vue'
import type { CampaignTarget } from '@/core/types'
import { evaluateFeats } from '@/data/feats'
import { useArchivesStore } from '@/stores/archives'
import { useGameStore } from '@/stores/game'
import { useNavStore } from '@/stores/nav'
import { useSettingsStore } from '@/stores/settings'
import { fortuneView, IMPERIAL_BARONY_PROVINCES, routeForPhase } from '@/ui/fortune'

const TARGET: CampaignTarget = {
  power: 777,
  uncertaintyMargin: 20,
  perceivedMin: 60,
  perceivedMax: 85,
  biome: 'wilderness',
  lootType: 'ap',
  factionId: 'outlaws',
  isFalseLedger: true,
  isAmbush: true,
  revealedFalseLedger: false,
  revealedAmbush: false,
}

function begin() {
  const pinia = createPinia()
  setActivePinia(pinia)
  useArchivesStore().load()
  useSettingsStore().load()
  const game = useGameStore()
  game.begin(42)
  return { pinia, game, nav: useNavStore(), state: game.run! }
}

function expedition(state: ReturnType<typeof begin>['state']): void {
  state.phase = 'EXPEDITION'
  state.currentTarget = { ...TARGET }
  state.units.soldier = 50
  state.totalPopulation += 50
}

describe('Task 5: Fortune', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('counts towards the same barony as the feat', () => {
    const { state } = begin()
    state.provinces = IMPERIAL_BARONY_PROVINCES
    expect(evaluateFeats(state)).toContain('imperial_barony')
    state.provinces = IMPERIAL_BARONY_PROVINCES - 1
    state.peakProvinces = IMPERIAL_BARONY_PROVINCES - 1
    expect(evaluateFeats(state)).not.toContain('imperial_barony')
  })

  it('never shows a stale target during the reign', () => {
    const { pinia, state } = begin()
    state.currentTarget = { ...TARGET }
    expect(fortuneView(state)).toMatchObject({ live: false, target: null })
    const page = mount(FortunePage, { global: { plugins: [pinia] } })
    expect(page.text()).toContain('The next campaign follows the audit.')
    expect(page.find('[data-attack]').exists()).toBe(false)
  })

  it('shows the guess of the scouts during the expedition', () => {
    const { state } = begin()
    expedition(state)
    expect(fortuneView(state).target).toMatchObject({
      biome: 'Marshes & Forests',
      guessMin: 60,
      guessMax: 85,
    })
  })

  it('keeps the secrets of a target out of the page', () => {
    const { pinia, state } = begin()
    expedition(state)
    const page = mount(FortunePage, { global: { plugins: [pinia] } })
    page.findAll('svg').forEach((icon) => icon.element.remove())
    const html = page.html()
    expect(html).not.toContain('777')
    expect(html.toLowerCase()).not.toContain('ambush')
    expect(html.toLowerCase()).not.toContain('false ledger')
  })

  it('tells a revealed ambush and a false ledger', () => {
    const { state } = begin()
    expedition(state)
    state.currentTarget!.revealedAmbush = true
    state.currentTarget!.revealedFalseLedger = true
    expect(fortuneView(state).target!.warnings).toEqual([
      'Your spies smell an ambush.',
      'Your spies doubt the loot.',
    ])
  })

  it('reads the odds after the siege, as the engine fights them', () => {
    const { state } = begin()
    expedition(state)
    state.units.soldier = 80
    expect(fortuneView(state).target!.odds).toBe('odds against you')
    state.units.soldier = 100
    expect(fortuneView(state).target!.odds).toBe('a coin toss')
    state.units.soldier = 130
    expect(fortuneView(state).target!.odds).toBe('odds with you')
  })

  it('says the scout dies and the target changes', () => {
    const { pinia, state } = begin()
    expedition(state)
    state.units.scout = 2
    const page = mount(FortunePage, { global: { plugins: [pinia] } })
    expect(page.get('[data-scout]').text()).toContain('1 scout dies')
    expect(page.get('[data-scout]').text()).toContain('new target')
  })

  it('holds the attack for a moment, so a double tap sends one host', async () => {
    const { pinia, state } = begin()
    expedition(state)
    state.units.soldier = 5000
    const page = mount(FortunePage, { global: { plugins: [pinia] } })
    await page.get('[data-attack]').trigger('click')
    await flushPromises()
    expect(page.get('[data-attack]').attributes('disabled')).toBeDefined()
  })

  it('keeps the wheel turning after a spin', async () => {
    const { pinia, state } = begin()
    expedition(state)
    const page = mount(FortunePage, { global: { plugins: [pinia] } })
    await page.get('[data-attack]').trigger('click')
    await flushPromises()
    const wheel = page.get('[data-wheel]')
    expect(wheel.classes()).toContain('motion-wheel-spin')
    await wheel.trigger('animationend')
    expect(page.get('[data-wheel]').classes()).toContain('motion-wheel-turn')
  })

  it('names what stops an attack or a scouting', () => {
    const { state } = begin()
    expedition(state)
    state.units.soldier = 0
    expect(fortuneView(state).attack).toMatchObject({ blocked: 'You have no army', command: null })
    expect(fortuneView(state).scout).toMatchObject({ blocked: 'No scouts to send', command: null })
  })

  it('draws a new target after the first of two campaigns', async () => {
    const { pinia, game, state } = begin()
    expedition(state)
    const page = mount(FortunePage, { global: { plugins: [pinia] } })
    expect(fortuneView(state).target!.campaignsLeft).toBe(2)
    await page.get('[data-attack]').trigger('click')
    await flushPromises()
    expect(fortuneView(game.run!).target!.campaignsLeft).toBe(1)
    expect(page.find('[data-outcome]').exists()).toBe(true)
  })
})

describe('Task 6: expedition moment', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('routes each phase, and leaves the screens outside the reign alone', () => {
    expect(routeForPhase('EXPEDITION', 'THREAT_HERALD', 'run')).toBe('fortune')
    expect(routeForPhase('EXPEDITION', 'THREAT_HERALD', 'fortune')).toBeNull()
    expect(routeForPhase('EXPEDITION', 'THREAT_HERALD', 'chronicle')).toBeNull()
    expect(routeForPhase('EXPEDITION', 'THREAT_HERALD', 'hall')).toBeNull()
    expect(routeForPhase('AWAIT_RESUME', 'EXPEDITION', 'fortune')).toBe('run')
    expect(routeForPhase('ACTIVE_CYCLE', 'AWAIT_RESUME', 'crown')).toBeNull()
    expect(routeForPhase('RUN_DEFEAT', 'ACTIVE_CYCLE', 'end')).toBeNull()
  })

  it('moves from the herald to Fortune and on to the resume', async () => {
    const { pinia, game, nav, state } = begin()
    nav.go('run')
    const app = mount(App, { global: { plugins: [pinia] } })
    state.deadline = 5
    state.phase = 'THREAT_HERALD'
    state.currentThreatId = 6
    state.units.soldier = 50
    game.act({ type: 'SET_PAUSED', paused: false })
    await flushPromises()
    expect(nav.screen).toBe('run')
    expect(game.act({ type: 'SELECT_THREAT_RESPONSE', response: 'defense' }).success).toBe(true)
    await flushPromises()
    expect(game.phase).toBe('EXPEDITION')
    expect(nav.screen).toBe('fortune')
    expect(app.find('[data-leave]').exists()).toBe(true)
    await app.get('[data-leave]').trigger('click')
    await flushPromises()
    expect(game.phase).toBe('AWAIT_RESUME')
    expect(nav.screen).toBe('run')
    expect(app.text()).toContain('Resume governance')
  })

  it('brings a resumed expedition back to Fortune', async () => {
    const { pinia, game, nav, state } = begin()
    expedition(state)
    game.save()
    nav.go('hall')
    const app = mount(App, { global: { plugins: [pinia] } })
    await flushPromises()
    expect(game.resume()).toBe(true)
    nav.go('run')
    await flushPromises()
    expect(nav.screen).toBe('fortune')
    expect(app.find('[data-attack]').exists()).toBe(true)
  })

  it('leaves the end screen in place after a fatal attack', async () => {
    const { pinia, game, nav, state } = begin()
    expedition(state)
    nav.go('fortune')
    mount(App, { global: { plugins: [pinia] } })
    state.isGameOver = true
    state.phase = 'RUN_DEFEAT'
    game.act({ type: 'SET_PAUSED', paused: true })
    await flushPromises()
    game.advance(0.05)
    await flushPromises()
    expect(nav.screen).toBe('fate')
  })

  it('closes the order bar during the expedition, but not the menu', async () => {
    const { pinia, nav, state } = begin()
    expedition(state)
    nav.go('fortune')
    const page = mount(FortunePage, { global: { plugins: [pinia] } })
    expect(page.get('[data-order-bar]').attributes('inert')).toBeDefined()
    await page.get('button[aria-label="Menu"]').trigger('click')
    expect(nav.menuOpen).toBe(true)
  })

  it('tells the last campaign before the resume', async () => {
    const { pinia, game, nav, state } = begin()
    expedition(state)
    state.campaignsLaunchedThisDeadline = 1
    nav.go('fortune')
    const app = mount(App, { global: { plugins: [pinia] } })
    await flushPromises()
    await app.get('[data-attack]').trigger('click')
    await flushPromises()
    expect(game.phase).toBe('AWAIT_RESUME')
    expect(app.get('[data-resume-band]').text()).toMatch(
      /Your host (took a province|came back without a province)\./,
    )
  })
})
