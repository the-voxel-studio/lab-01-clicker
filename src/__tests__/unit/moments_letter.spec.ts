/**
 * Plan 04 Task 2: the letter that replaces the phase stub.
 *
 * @vitest-environment jsdom
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import App from '@/App.vue'
import MomentHost from '@/components/game/moments/MomentHost.vue'
import type { GameState, RunPhase } from '@/core/types'
import { useArchivesStore } from '@/stores/archives'
import { useGameStore } from '@/stores/game'
import { useNavStore } from '@/stores/nav'
import { useSettingsStore } from '@/stores/settings'
import { routeForPhase } from '@/ui/fortune'
import type { MomentView } from '@/ui/moments'

/** Puts a state on the phase of a kind, with what its letter reads. */
const SETUP: Record<MomentView['kind'], (state: GameState) => void> = {
  audit(state) {
    state.phase = 'AUDIT_ASSESSMENT'
    state.lastAuditOutcome = {
      deadline: 1,
      apMet: true,
      popMet: true,
      militaryMet: true,
      passedCount: 3,
      success: true,
      royalPardonIssued: false,
      isGameOver: false,
      victory: false,
      grossApRate: 12,
    }
  },
  dilemma(state) {
    state.phase = 'COUNCIL_DILEMMA'
    state.currentDilemmaId = 'dilemma:taxable_windows'
  },
  laws(state) {
    state.phase = 'COUNCIL_LAWS'
    state.currentLawDraft = []
  },
  herald(state) {
    state.phase = 'THREAT_HERALD'
    state.currentThreatId = 6
    state.currentThreatPower = 70
    state.currentThreatTributeAp = 1900
    state.ap = 5000
  },
  raid(state) {
    state.phase = 'SURPRISE_RAID'
  },
  lombard(state) {
    state.phase = 'LOMBARD_OFFER'
    state.bankruptcyGraceTimer = 30
  },
}

const KINDS = Object.keys(SETUP) as MomentView['kind'][]

function begin() {
  const pinia = createPinia()
  setActivePinia(pinia)
  useArchivesStore().load()
  useSettingsStore().load()
  const game = useGameStore()
  game.begin(7)
  const nav = useNavStore()
  nav.go('run')
  return { pinia, game, nav, state: game.run! }
}

function refresh(game: ReturnType<typeof useGameStore>): void {
  game.act({ type: 'SET_PAUSED', paused: false })
}

describe('Task 2: the letter replaces the stub', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.stubGlobal('requestAnimationFrame', () => 0)
    vi.stubGlobal('cancelAnimationFrame', () => undefined)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it.each(KINDS)('renders the %s letter with its answers, in its dread band', async (kind) => {
    const { pinia, game, state } = begin()
    SETUP[kind](state)
    refresh(game)
    const host = mount(MomentHost, { global: { plugins: [pinia] } })
    await flushPromises()
    const letter = host.get('[data-moment-letter]')
    expect(letter.attributes('data-kind')).toBe(kind)
    expect(letter.attributes('data-dread')).toBe(game.dread.band)
    expect(letter.get('h2').text()).not.toBe('')
    expect(host.findAll('[data-moment-answer]').length).toBeGreaterThan(0)
  })

  it('dispatches the command of the answer that is clicked', async () => {
    const { pinia, game, state } = begin()
    SETUP.lombard(state)
    refresh(game)
    const host = mount(MomentHost, { global: { plugins: [pinia] } })
    const accept = host.findAll('[data-moment-answer]').find((b) => b.text().includes('Take'))
    await accept!.trigger('click')
    expect(game.phase).toBe('ACTIVE_CYCLE')
  })

  it('disables a blocked answer and states its reason', async () => {
    const { pinia, game, state } = begin()
    SETUP.herald(state)
    state.ap = 0
    refresh(game)
    const host = mount(MomentHost, { global: { plugins: [pinia] } })
    const tribute = host.findAll('[data-moment-answer]').find((b) => b.text().includes('tribute'))!
    expect(tribute.attributes('disabled')).toBeDefined()
    expect(tribute.text()).toContain('The coffer cannot pay it')
    await tribute.trigger('click')
    expect(game.phase).toBe('THREAT_HERALD')
  })

  it('shows a refusal of the engine inside the letter', async () => {
    const { pinia, game, state } = begin()
    SETUP.herald(state)
    refresh(game)
    const host = mount(MomentHost, { global: { plugins: [pinia] } })
    state.ap = 0
    const tribute = host.findAll('[data-moment-answer]').find((b) => b.text().includes('tribute'))!
    await tribute.trigger('click')
    expect(game.phase).toBe('THREAT_HERALD')
    expect(host.get('[data-moment-error]').text()).not.toBe('')
  })

  it('draws the clash from the model, one figure each', async () => {
    const { pinia, game, state } = begin()
    SETUP.herald(state)
    refresh(game)
    const host = mount(MomentHost, { global: { plugins: [pinia] } })
    const clash = host.get('[data-clash]').text()
    expect(clash).toContain('your force, ')
    expect(clash).toContain('their force, 70')
  })

  it('says whether each quota was met in words as well as in colour', async () => {
    const { pinia, game, state } = begin()
    SETUP.audit(state)
    state.lastAuditOutcome = { ...state.lastAuditOutcome!, popMet: false, passedCount: 2 }
    refresh(game)
    const host = mount(MomentHost, { global: { plugins: [pinia] } })
    const lines = host.findAll('[data-quota]').map((line) => line.text())
    expect(lines).toHaveLength(3)
    expect(lines[0]).toContain('met')
    expect(lines[1]).toContain('short')
  })

  it('plays the sequence in the mounted app from the audit to Fortune', async () => {
    const { pinia, game, nav, state } = begin()
    SETUP.audit(state)
    state.deadline = 2
    state.lastAuditOutcome = { ...state.lastAuditOutcome!, deadline: 2 }
    refresh(game)
    const app = mount(App, { global: { plugins: [pinia] } })
    await flushPromises()
    const seen: (RunPhase | null)[] = []
    const inMoment = () => game.inMoment
    for (let guard = 0; guard < 12 && inMoment(); guard++) {
      expect(nav.screen).toBe('run')
      seen.push(game.phase)
      const answers = app.findAll('[data-moment-answer]:not([disabled])')
      await answers[answers.length - 1]!.trigger('click')
      await flushPromises()
    }
    expect(seen).toEqual(['AUDIT_ASSESSMENT', 'COUNCIL_DILEMMA', 'COUNCIL_LAWS', 'THREAT_HERALD'])
    expect(game.phase).toBe('AWAIT_RESUME')
    expect(nav.screen).toBe('run')
  })

  it.each(KINDS)('lands on the same %s letter after a save and a resume', async (kind) => {
    const { pinia, game, state } = begin()
    SETUP[kind](state)
    refresh(game)
    game.save()
    const title = mount(MomentHost, { global: { plugins: [pinia] } })
      .get('h2')
      .text()

    const next = createPinia()
    setActivePinia(next)
    useArchivesStore().load()
    useSettingsStore().load()
    const resumed = useGameStore()
    expect(resumed.resume()).toBe(true)
    const nav = useNavStore()
    nav.go('run')
    const app = mount(App, { global: { plugins: [next] } })
    await flushPromises()
    expect(app.get('[data-moment-letter]').attributes('data-kind')).toBe(kind)
    expect(app.get('[data-moment-letter] h2').text()).toBe(title)
  })

  it('follows a loan taken at the deadline straight into the audit letter', async () => {
    const { pinia, game, state } = begin()
    SETUP.lombard(state)
    state.pendingDeadlineAudit = true
    state.deadlineTimeSeconds = 100
    refresh(game)
    const app = mount(App, { global: { plugins: [pinia] } })
    await flushPromises()
    expect(game.act({ type: 'ACCEPT_LOMBARD_LOAN' }).success).toBe(true)
    await flushPromises()
    expect(game.phase).toBe('AUDIT_ASSESSMENT')
    expect(app.get('[data-moment-letter]').attributes('data-kind')).toBe('audit')
  })

  it('follows a raid held at the deadline straight into the audit letter', async () => {
    const { pinia, game, state } = begin()
    SETUP.raid(state)
    state.pendingDeadlineAudit = true
    state.deadlineTimeSeconds = 100
    refresh(game)
    const app = mount(App, { global: { plugins: [pinia] } })
    await flushPromises()
    expect(game.act({ type: 'RESOLVE_RAID_DEFENSE' }).success).toBe(true)
    await flushPromises()
    expect(game.phase).toBe('AUDIT_ASSESSMENT')
    expect(app.get('[data-moment-letter]').attributes('data-kind')).toBe('audit')
  })

  it('keeps the run inert behind a letter', async () => {
    const { pinia, game, state } = begin()
    const app = mount(App, { global: { plugins: [pinia] } })
    SETUP.herald(state)
    refresh(game)
    await flushPromises()
    expect(game.inMoment).toBe(true)
    expect(app.find('[inert]').exists()).toBe(true)
    expect(app.get('[inert]').find('[data-moment-letter]').exists()).toBe(false)
  })

  it('fits a small screen: the letter is bounded and its answers scroll inside', async () => {
    const { pinia, game, state } = begin()
    SETUP.herald(state)
    refresh(game)
    const host = mount(MomentHost, { global: { plugins: [pinia] } })
    const letter = host.get('[data-moment-letter]')
    expect(letter.classes()).toContain('max-h-full')
    const scroller = letter.get('[data-letter-scroll]')
    expect(scroller.classes()).toContain('overflow-y-auto')
    expect(scroller.classes()).toContain('min-h-0')
    expect(scroller.findAll('[data-moment-answer]').length).toBe(3)
  })

  it('lets the last letter leave over the next screen, so its seal breaks', async () => {
    const { pinia, game, nav, state } = begin()
    SETUP.herald(state)
    state.deadline = 3
    state.currentThreatId = 4
    refresh(game)
    const app = mount(App, { global: { plugins: [pinia], stubs: { transition: false } } })
    await flushPromises()
    nav.go('run')
    game.act({ type: 'SELECT_THREAT_RESPONSE', response: 'tribute' })
    await flushPromises()
    expect(game.phase).toBe('AWAIT_RESUME')
    expect(app.find('[data-moment-letter].letter-leave-active').exists()).toBe(true)
  })

  it('draws no letter over the hall for a resumed moment', async () => {
    const { pinia, game, nav, state } = begin()
    SETUP.herald(state)
    refresh(game)
    nav.go('hall')
    const app = mount(App, { global: { plugins: [pinia] } })
    await flushPromises()
    expect(app.find('[data-moment-letter]').exists()).toBe(false)
  })

  it('routes a moment to the run screen', () => {
    expect(routeForPhase('AUDIT_ASSESSMENT', 'crown')).toBe('run')
    expect(routeForPhase('COUNCIL_LAWS', 'run')).toBeNull()
    expect(routeForPhase('LOMBARD_OFFER', 'hall')).toBeNull()
  })
})

describe('Task 4: the missive of a fight', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.stubGlobal('requestAnimationFrame', () => 0)
    vi.stubGlobal('cancelAnimationFrame', () => undefined)
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  function atHerald() {
    const context = begin()
    SETUP.herald(context.state)
    context.state.deadline = 3
    context.state.currentThreatId = 4
    refresh(context.game)
    return context
  }

  it('opens the missive on the next screen and folds it', async () => {
    const { pinia, game } = atHerald()
    const app = mount(App, { global: { plugins: [pinia] } })
    game.act({ type: 'SELECT_THREAT_RESPONSE', response: 'tribute' })
    await flushPromises()
    expect(app.get('[data-battle-report]').text()).toContain('They took the gold')
    await app.get('[data-report-close]').trigger('click')
    await flushPromises()
    expect(game.report).toBeNull()
  })

  it('opens after a raid', async () => {
    const { pinia, game, state } = begin()
    SETUP.raid(state)
    refresh(game)
    const app = mount(App, { global: { plugins: [pinia] } })
    game.act({ type: 'RESOLVE_RAID_DEFENSE' })
    await flushPromises()
    expect(app.find('[data-battle-report]').exists()).toBe(true)
  })

  it('stays silent over a refused tribute', () => {
    const { game, state } = atHerald()
    state.ap = 0
    game.act({ type: 'SELECT_THREAT_RESPONSE', response: 'tribute' })
    expect(game.report).toBeNull()
  })

  it('opens no missive when the fight ends the reign', () => {
    const { game, state } = atHerald()
    state.provinces = 1
    state.provinceBiomes = ['heartland']
    state.currentThreatPower = 10000000
    game.act({ type: 'SELECT_THREAT_RESPONSE', response: 'defense' })
    expect(game.phase).toBe('RUN_DEFEAT')
    expect(game.report).toBeNull()
  })
})
