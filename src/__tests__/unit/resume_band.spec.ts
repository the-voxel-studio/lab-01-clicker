/**
 * Plan 04 Task 3: the open resume between two audits.
 *
 * @vitest-environment jsdom
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import App from '@/App.vue'
import { DEFAULT_ENGINE_CONFIG, quotaForDeadline } from '@/core/config'
import { effectiveQuota } from '@/core/engine'
import { dispatch } from '@/core/commands'
import type { GameState } from '@/core/types'
import { useArchivesStore } from '@/stores/archives'
import { useChronicleStore } from '@/stores/chronicle'
import { useGameStore } from '@/stores/game'
import { useNavStore } from '@/stores/nav'
import { useSettingsStore } from '@/stores/settings'
import { adviseCounsel } from '@/ui/counsel'
import { edictRows } from '@/ui/crown'
import { routeForPhase } from '@/ui/fortune'

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

/** The reign on the expedition of the second audit, on the Fortune page. */
async function atExpedition(state: GameState, game: ReturnType<typeof useGameStore>) {
  state.deadline = 2
  state.phase = 'EXPEDITION'
  state.ap = 100000
  game.act({ type: 'SET_PAUSED', paused: false })
  await flushPromises()
}

async function preparing() {
  const context = begin()
  const app = mount(App, { global: { plugins: [context.pinia] } })
  await atExpedition(context.state, context.game)
  await app.get('[data-leave]').trigger('click')
  await flushPromises()
  return { ...context, app }
}

describe('Task 3: the open resume', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.stubGlobal('requestAnimationFrame', () => 0)
    vi.stubGlobal('cancelAnimationFrame', () => undefined)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('lands on the run screen with the band and the last deed', async () => {
    const { app, game, nav } = await preparing()
    expect(game.phase).toBe('AWAIT_RESUME')
    expect(game.preparing).toBe(true)
    expect(nav.screen).toBe('run')
    const band = app.get('[data-resume-band]')
    expect(band.text()).toContain('Resume governance')
    expect(band.text()).toContain('Time stands still until you resume.')
    expect(band.text()).toContain(useChronicleStore().entries[0]!.text)
  })

  it('stays on an order page, buys there, and keeps the band', async () => {
    const { app, game, nav } = await preparing()
    await app.get('[data-order="order_people"]').trigger('click')
    await flushPromises()
    expect(nav.screen).toBe('order_people')
    const peasants = game.run!.units.peasant ?? 0
    expect(game.act({ type: 'BUY_UNIT', unitId: 'peasant', count: 1 }).success).toBe(true)
    await flushPromises()
    expect(game.run!.units.peasant).toBe(peasants + 1)
    expect(nav.screen).toBe('order_people')
    expect(app.find('[data-resume-band]').exists()).toBe(true)
  })

  it('reads the quotas of the next audit and a full candle', async () => {
    const { app, game } = await preparing()
    const required = effectiveQuota(
      game.run!,
      quotaForDeadline(DEFAULT_ENGINE_CONFIG, game.run!.deadline + 1),
    )
    expect(game.quotas.map((quota) => quota.required)).toEqual([
      required.apRate,
      required.pop,
      required.military,
    ])
    expect(game.secondsLeft).toBe(100)
    expect(app.text()).toContain('1:40')
    expect(app.text()).toContain('third audit')
  })

  it('holds the seal: disabled, in words, and no stamp reaches the engine', async () => {
    const { app, game } = await preparing()
    const act = vi.spyOn(game, 'act')
    const seal = app.findAll('button').find((b) => b.text().includes('Time stands still'))
    expect(seal).toBeDefined()
    expect(seal!.attributes('disabled')).toBeDefined()
    await seal!.trigger('click')
    expect(act).not.toHaveBeenCalled()
  })

  it('closes the edicts in words and keeps the rest of the Crown open', async () => {
    const { game } = await preparing()
    const rows = edictRows(game.run!)
    expect(rows.every((row) => row.command === null)).toBe(true)
    expect(rows.every((row) => row.blocked === 'Edicts wait for the new audit')).toBe(true)
    expect(game.act({ type: 'SET_TAX_RATE', rate: 30 }).success).toBe(true)
    expect(game.act({ type: 'COLONISE_PROVINCE' }).success).toBe(true)
  })

  it('never has the counsel offer what the engine refuses here', async () => {
    const { game } = await preparing()
    const state = game.run!
    const offered = (['enchanted', 'uneasy', 'rotting'] as const).flatMap((band) =>
      [50, 100000].flatMap((ap) => {
        const trial = structuredClone(state)
        trial.ap = ap
        const action = adviseCounsel(trial, game.quotas, band, game.secondsLeft).action
        return action ? [dispatch(trial, action.command).success] : []
      }),
    )
    expect(offered.length).toBeGreaterThan(0)
    expect(offered.every(Boolean)).toBe(true)
  })

  it('resumes at the button: the band leaves and the deadline rises', async () => {
    const { app, game } = await preparing()
    const deadline = game.run!.deadline
    await app.get('[data-resume]').trigger('click')
    await flushPromises()
    expect(game.phase).toBe('ACTIVE_CYCLE')
    expect(game.run!.deadline).toBe(deadline + 1)
    expect(app.find('[data-resume-band]').exists()).toBe(false)
  })

  it('comes back from a save on the run screen with the band', async () => {
    const { game } = await preparing()
    game.save()
    const next = createPinia()
    setActivePinia(next)
    useArchivesStore().load()
    useSettingsStore().load()
    expect(useGameStore().resume()).toBe(true)
    useNavStore().go('run')
    const app = mount(App, { global: { plugins: [next] } })
    await flushPromises()
    expect(useNavStore().screen).toBe('run')
    expect(app.find('[data-resume-band]').exists()).toBe(true)
  })

  it('moves to the run screen only on the step out of the expedition', () => {
    expect(routeForPhase('AWAIT_RESUME', 'EXPEDITION', 'fortune')).toBe('run')
    expect(routeForPhase('AWAIT_RESUME', 'AWAIT_RESUME', 'fortune')).toBeNull()
    expect(routeForPhase('AWAIT_RESUME', 'EXPEDITION', 'crown')).toBeNull()
  })
})
