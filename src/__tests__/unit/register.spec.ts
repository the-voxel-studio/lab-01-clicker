/**
 * Plan 04 Task 6: the register of the reign.
 *
 * @vitest-environment jsdom
 */

import { beforeEach, describe, expect, it, vi, afterEach } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import App from '@/App.vue'
import { createArchiveData } from '@/core/archives'
import { triggerDefeat } from '@/core/mutations'
import { createInitialGameState } from '@/core/state'
import type { GameState } from '@/core/types'
import { FEAT_COPY } from '@/data/featCopy'
import { FEATS_DATA, type FeatId } from '@/data/feats'
import { useArchivesStore } from '@/stores/archives'
import { useChronicleStore } from '@/stores/chronicle'
import { useGameStore } from '@/stores/game'
import { useNavStore } from '@/stores/nav'
import { useSettingsStore } from '@/stores/settings'
import { auditsPassed, closestLockedFeat } from '@/ui/register'
import type { RunRecord } from '@/ui/runRecord'

function begin() {
  const pinia = createPinia()
  setActivePinia(pinia)
  useArchivesStore().load()
  const settings = useSettingsStore()
  settings.load()
  settings.reducedMotion = true
  const game = useGameStore()
  game.begin(7)
  const nav = useNavStore()
  nav.go('run')
  return { pinia, game, nav, state: game.run! }
}

function audited(deadline: number, strikes: number): GameState {
  const state = createInitialGameState({ seed: 7 })
  state.deadline = deadline
  state.strikes = strikes
  state.lastAuditOutcome = {
    deadline,
    apMet: true,
    popMet: true,
    militaryMet: true,
    passedCount: 3,
    success: true,
    royalPardonIssued: false,
    isGameOver: false,
    victory: false,
    grossApRate: 1,
  }
  return state
}

function record(overrides: Partial<RunRecord>): RunRecord {
  return {
    runId: 'r',
    seed: 1,
    endedAt: '2026-10-31T00:00:00.000Z',
    outcome: 'revolution',
    deadlineReached: 1,
    elapsedSeconds: 10,
    totalCumulativeAp: 0,
    peakPopulation: 0,
    peakProvinces: 1,
    colonisedProvinces: 0,
    capturedProvinces: 0,
    battlesWon: 0,
    scoutsSacrificed: 0,
    militaryRecruited: 0,
    starvationLosses: 0,
    strikes: 0,
    lombardBailoutAccepted: false,
    newFeats: [],
    ...overrides,
  }
}

function button(wrapper: VueWrapper, label: string) {
  const found = wrapper.findAll('button').find((b) => b.text().includes(label))
  if (!found) throw new Error(`No button "${label}" in: ${wrapper.text()}`)
  return found
}

async function toRegister(pinia: ReturnType<typeof createPinia>, finish: () => void) {
  const app = mount(App, { global: { plugins: [pinia] } })
  finish()
  await flushPromises()
  const next = app.find('[data-fate-continue]')
  if (next.exists()) await next.trigger('click')
  await flushPromises()
  return app
}

describe('Task 6: the register of the reign', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.stubGlobal('requestAnimationFrame', () => 0)
    vi.stubGlobal('cancelAnimationFrame', () => undefined)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('keeps its own copy of the last three lines of the chronicle, oldest first', () => {
    const { game, state } = begin()
    game.act({ type: 'SET_TAX_RATE', rate: 30 })
    const told = useChronicleStore().entries.slice(0, 3).reverse()
    triggerDefeat(state, 'revolution')
    game.advance(0.05)
    useChronicleStore().entries = []
    expect(game.lastConclusion?.finalEntries.map((entry) => entry.text)).toEqual(
      told.map((entry) => entry.text),
    )
  })

  it('counts the audits passed', () => {
    expect(auditsPassed(audited(1, 1))).toBe(0)
    expect(auditsPassed(audited(10, 1))).toBe(9)
    expect(auditsPassed(audited(2, 0))).toBe(2)
    const none = createInitialGameState({ seed: 7 })
    expect(auditsPassed(none)).toBe(0)
  })

  it('picks the locked feat with the highest progress, from the best of the history', () => {
    const state = createInitialGameState({ seed: 7 })
    const feat = closestLockedFeat(createArchiveData(), [record({ peakProvinces: 6 })], state)
    expect(feat?.id).toBe('imperial_barony')
    expect(feat?.progress).toBeCloseTo(6 / 8)
    expect(feat?.caption).toBe('Best reign: 6 of the 8 towers')
  })

  it('reads scouts, AP and audits on their own scales', () => {
    const state = createInitialGameState({ seed: 7 })
    const archive = createArchiveData()
    archive.unlockedFeats = ['imperial_barony']
    expect(closestLockedFeat(archive, [record({ scoutsSacrificed: 18 })], state)?.id).toBe(
      'scout_butcher',
    )
    const rich = closestLockedFeat(archive, [record({ totalCumulativeAp: 900000 })], state)
    expect(rich?.id).toBe('croesus_of_the_realm')
    expect(rich?.progress).toBeCloseTo(0.9)
    const far = closestLockedFeat(archive, [record({ deadlineReached: 9 })], state)
    expect(far?.id).toBe('royal_pacifist')
    expect(far?.progress).toBeCloseTo(0.9)
  })

  it('reads the Six Seals from the last reign only', () => {
    const state = createInitialGameState({ seed: 7 })
    state.peakActiveLaws = 5
    const archive = createArchiveData()
    archive.unlockedFeats = ['imperial_barony']
    const feat = closestLockedFeat(archive, [], state)
    expect(feat?.id).toBe('the_six_seals')
    expect(feat?.caption).toBe('Last reign: 5 of the 6 seals')
  })

  it('returns nothing when all eight are held', () => {
    const archive = createArchiveData()
    archive.unlockedFeats = Object.keys(FEATS_DATA) as FeatId[]
    expect(closestLockedFeat(archive, [], createInitialGameState({ seed: 7 }))).toBeNull()
  })

  it('has a hint for every feat', () => {
    for (const id of Object.keys(FEATS_DATA) as FeatId[]) {
      expect(FEAT_COPY[id].hint).not.toBe('')
    }
  })

  it('shows the whole register of a defeat', async () => {
    const { pinia, game, state } = begin()
    state.scoutsSacrificed = 20
    state.totalCumulativeAp = 1200
    game.act({ type: 'SET_TAX_RATE', rate: 30 })
    const app = await toRegister(pinia, () => {
      triggerDefeat(state, 'revolution')
      game.advance(0.05)
    })
    const text = app.text()
    expect(text).toContain('Reign 1 is over')
    expect(text).toContain('The people came at dawn.')
    expect(app.findAll('[data-figure]')).toHaveLength(3)
    expect(text).toContain('audits passed')
    expect(text).toContain('1.2k')
    expect(app.findAll('[data-ending-line]').length).toBeGreaterThan(0)
    expect(text).toContain(FEATS_DATA.scout_butcher.title)
    expect(app.find('[data-closest-feat]').exists()).toBe(true)
    expect(text).toContain('You hold')
    expect(text).toContain('Begin reign 2')
    expect(text).toContain('Return to the hall')
    expect(text).toContain('Restart reign 1 with the same seed')
  })

  it('restarts on the same seed', async () => {
    const { pinia, game, nav, state } = begin()
    const seed = state.seed
    const app = await toRegister(pinia, () => {
      triggerDefeat(state, 'revolution')
      game.advance(0.05)
    })
    await button(app, 'Restart reign 1').trigger('click')
    await flushPromises()
    expect(game.run!.seed).toBe(seed)
    expect(game.phase).toBe('ACTIVE_CYCLE')
    expect(nav.screen).toBe('run')
  })

  it('renders an abandoned reign whole, with no hole for an empty ending', async () => {
    const { pinia, game } = begin()
    const app = await toRegister(pinia, () => {
      game.abandon()
    })
    useChronicleStore().clear()
    game.lastConclusion!.finalEntries = []
    await flushPromises()
    expect(app.text()).toContain('You laid down the crown.')
    expect(app.find('[data-ending]').exists()).toBe(false)
  })

  it('reads a victory as won', async () => {
    const { pinia, game, state } = begin()
    const app = await toRegister(pinia, () => {
      state.isGameOver = true
      state.isVictory = true
      state.phase = 'RUN_VICTORY'
      game.advance(0.05)
    })
    expect(app.text()).toContain('Reign 1 is won')
  })

  it('keeps the primary button out of the only scroller', async () => {
    const { pinia, game } = begin()
    const app = await toRegister(pinia, () => {
      game.abandon()
    })
    const body = app.get('[data-register-body]')
    expect(body.classes()).toContain('overflow-y-auto')
    expect(body.classes()).toContain('min-h-0')
    expect(body.text()).not.toContain('Begin reign')
    expect(app.get('[data-register]').classes()).toContain('overflow-hidden')
  })
})
