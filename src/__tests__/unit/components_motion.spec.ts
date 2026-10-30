/**
 * Motion of the run screen: pause and reduced motion switches, band tempo, rolling coffer, petals.
 *
 * @module __tests__/unit/components_motion.spec
 */

import { readFileSync } from 'node:fs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import RunScreen from '@/components/game/RunScreen.vue'
import CounselLine from '@/components/game/run/CounselLine.vue'
import KingdomView from '@/components/game/run/KingdomView.vue'
import SealButton from '@/components/game/run/SealButton.vue'
import { useArchivesStore } from '@/stores/archives'
import { useGameStore } from '@/stores/game'
import { useSettingsStore } from '@/stores/settings'

const motionCss = readFileSync('src/assets/motion.css', 'utf8')

/** Animation frames run by hand: `runFrames(ms)` advances the clock frame by frame. */
function manualFrames() {
  let callbacks: FrameRequestCallback[] = []
  let now = 0
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    callbacks.push(cb)
    return callbacks.length
  })
  vi.stubGlobal('cancelAnimationFrame', () => undefined)
  vi.spyOn(performance, 'now').mockImplementation(() => now)
  return (ms: number) => {
    for (let t = 0; t < ms; t += 16) {
      now += 16
      const due = callbacks
      callbacks = []
      due.forEach((cb) => cb(now))
    }
  }
}

/**
 * Frames in browser order, honouring cancellation: reactive effects flush after each callback, as
 * microtasks do, so a callback cancelled by an earlier one in the same frame never runs.
 */
function browserFrames() {
  const callbacks = new Map<number, FrameRequestCallback>()
  let nextId = 0
  let now = 0
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    callbacks.set(++nextId, cb)
    return nextId
  })
  vi.stubGlobal('cancelAnimationFrame', (id: number) => callbacks.delete(id))
  vi.spyOn(performance, 'now').mockImplementation(() => now)
  return async () => {
    now += 16
    for (const id of Array.from(callbacks.keys())) {
      const cb = callbacks.get(id)
      if (!cb) continue
      callbacks.delete(id)
      cb(now)
      await flushPromises()
    }
  }
}

function stubSystemReducedMotion(): void {
  vi.stubGlobal('matchMedia', (query: string) => ({ matches: query.includes('reduce') }))
}

function mountRun() {
  const pinia = createPinia()
  setActivePinia(pinia)
  useArchivesStore().load()
  const settings = useSettingsStore()
  settings.load()
  const game = useGameStore()
  game.begin(42)
  const wrapper = mount(RunScreen, { global: { plugins: [pinia] } })
  return { wrapper, game, settings }
}

describe('Task 11: motion of the run screen', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('freezes every loop while the reign is paused', async () => {
    const { wrapper, game } = mountRun()
    expect(wrapper.attributes('data-paused')).toBe('false')
    game.act({ type: 'SET_PAUSED', paused: true })
    await flushPromises()
    expect(wrapper.attributes('data-paused')).toBe('true')
  })

  it('turns motion off under the reduced motion setting', async () => {
    const { wrapper, settings } = mountRun()
    expect(wrapper.attributes('data-motion')).toBe('on')
    settings.reducedMotion = true
    await flushPromises()
    expect(wrapper.attributes('data-motion')).toBe('off')
  })

  it('gives the realm the tempo of its band', () => {
    const { wrapper } = mountRun()
    expect(wrapper.attributes('style')).toContain('--tempo-sway: 6')
  })

  it('rolls the coffer to its new value', async () => {
    const runFrames = manualFrames()
    const { wrapper, game } = mountRun()
    const shown = () => Number(wrapper.get('[data-coffer]').text().replace(/\D/g, ''))
    const start = shown()
    game.run!.ap += 400
    game.act({ type: 'SET_PAUSED', paused: false })
    await flushPromises()
    runFrames(100)
    await flushPromises()
    const midway = shown()
    expect(midway).toBeGreaterThan(start)
    expect(midway).toBeLessThan(Math.floor(game.coffer))
    runFrames(500)
    await flushPromises()
    expect(shown()).toBe(Math.floor(game.coffer))
  })

  it('keeps rolling while the game loop changes the coffer every frame', async () => {
    const nextFrame = browserFrames()
    const { wrapper, game } = mountRun()
    const shown = () => Number(wrapper.get('[data-coffer]').text().replace(/\D/g, ''))
    const start = shown()
    const loop = (): void => {
      requestAnimationFrame(loop)
      game.run!.ap += 10
      game.act({ type: 'SET_PAUSED', paused: false })
    }
    requestAnimationFrame(loop)
    for (let frame = 0; frame < 30; frame++) await nextFrame()
    expect(shown()).toBeGreaterThan(start + 100)
  })

  it('rolls the rate and the quota figures too', async () => {
    const runFrames = manualFrames()
    const { wrapper, game } = mountRun()
    const rate = () => wrapper.get('[data-rate]').text()
    const people = () => wrapper.get('[data-quota="pop"]').text()
    const rateBefore = rate()
    const peopleBefore = people()
    game.run!.totalPopulation += 40
    game.run!.units.peasant = (game.run!.units.peasant ?? 0) + 40
    game.act({ type: 'SET_PAUSED', paused: false })
    await flushPromises()
    expect(people()).toBe(peopleBefore)
    expect(rate()).toBe(rateBefore)
    runFrames(800)
    await flushPromises()
    expect(people()).not.toBe(peopleBefore)
  })

  it('keeps the counsel in place when only its figure changes', async () => {
    const { game } = mountRun()
    const wrapper = mount(CounselLine)
    const before = wrapper.get('[data-counsel-text]')
    const text = before.text()
    game.run!.units.soldier = 1
    game.act({ type: 'SET_PAUSED', paused: false })
    await flushPromises()
    const after = wrapper.get('[data-counsel-text]')
    expect(after.text()).not.toBe(text)
    expect(after.element).toBe(before.element)
  })

  it('throws no missive under the system reduced motion preference', async () => {
    stubSystemReducedMotion()
    const { settings } = mountRun()
    settings.reducedMotion = false
    const wrapper = mount(SealButton)
    await wrapper.get('button').trigger('click')
    expect(wrapper.find('.missive').exists()).toBe(false)
    expect(wrapper.find('.gain').exists()).toBe(false)
  })

  it('gutters the candle in the last ten seconds', async () => {
    const { wrapper, game } = mountRun()
    expect(wrapper.find('[data-candle].motion-gutter').exists()).toBe(false)
    game.run!.deadlineTimeSeconds = game.secondsLeft + game.run!.deadlineTimeSeconds - 8
    game.act({ type: 'SET_PAUSED', paused: false })
    await flushPromises()
    expect(wrapper.find('[data-candle].motion-gutter').exists()).toBe(true)
  })

  it('melts the wax with a transform, not its height', () => {
    const { wrapper } = mountRun()
    const wax = wrapper.get('[data-wax]')
    expect(wax.attributes('style')).toContain('scaleY(')
    expect(wax.attributes('style')).not.toContain('height')
  })

  it('draws the candle in red wax with a vivid flame over its burnt track', () => {
    const { wrapper } = mountRun()
    expect(wrapper.get('[data-wax]').classes()).toContain('bg-wax')
    expect(wrapper.get('[data-wax-track]').classes()).toContain('bg-ink/15')
    expect(wrapper.get('[data-candle]').classes()).toContain('text-vermilion')
  })

  it('flourishes the thread of a met quota', async () => {
    const { wrapper, game } = mountRun()
    expect(wrapper.find('[data-quota="pop"] .motion-flourish').exists()).toBe(false)
    game.run!.totalPopulation += 100000
    game.act({ type: 'SET_PAUSED', paused: false })
    await flushPromises()
    expect(wrapper.find('[data-quota="pop"] .motion-flourish').exists()).toBe(true)
  })

  it('pauses the loops only, so one-shot feedback is never stuck on its first frame', () => {
    expect(motionCss).not.toMatch(/\[data-paused='true'\] \*/)
    expect(motionCss).toMatch(/\[data-paused='true'\] \.kingdom-scene \*/)
    expect(motionCss).toMatch(/\[data-paused='true'\] \.motion-candle/)
  })

  it('leaves exported transforms alone: only animated layers change their transform box', () => {
    expect(motionCss).not.toMatch(/\.kingdom-scene (g|rect|ellipse|path)\b/)
  })

  it('hides the petals when motion is off', () => {
    expect(motionCss).toMatch(/\[data-motion='off'\] \.petal\s*{\s*display: none/)
  })

  it('walks the villagers and keeps the crowd where it stands', () => {
    expect(motionCss).toMatch(/\.villager-commuter {[^}]*animation:[^;]*commute[^;]*skip/)
    expect(motionCss).toMatch(/\.villager-worker {[^}]*animation:[^;]*stroll[^;]*skip/)
    expect(motionCss).toMatch(/\.villager-rioter {[^}]*animation:[^;]*riot/)
    expect(motionCss).not.toMatch(/\.villager-rioter {[^}]*stroll/)
  })

  it('keeps the officials on the vellum, beside the lower half of the seal', async () => {
    const { game } = mountRun()
    game.run!.units.scribe = 1
    game.act({ type: 'SET_PAUSED', paused: false })
    const wrapper = mount(SealButton)
    await flushPromises()
    const official = wrapper.get('[data-official]')
    expect(official.classes()).toContain('top-[92px]')
  })

  it('draws the rings around the seal strongly enough for the pale vellum', () => {
    mountRun()
    const wrapper = mount(SealButton)
    expect(wrapper.get('.spin-slow').classes()).toContain('border-wax/70')
    expect(wrapper.get('.spin-slow').classes().join(' ')).not.toContain('gold/30')
  })

  it('holds the inner ring against the outer one while the clicks follow each other', async () => {
    mountRun()
    vi.useFakeTimers()
    const wrapper = mount(SealButton)
    const ring = () => wrapper.get('[data-seal-ring]').classes()
    for (let click = 0; click < 6; click++) {
      await wrapper.get('button').trigger('click')
      expect(ring()).toContain('scale-[1.16]')
      vi.advanceTimersByTime(200)
      await wrapper.vm.$nextTick()
      expect(ring()).toContain('scale-[1.16]')
    }
    vi.advanceTimersByTime(500)
    await wrapper.vm.$nextTick()
    expect(ring()).not.toContain('scale-[1.16]')
    vi.useRealTimers()
  })

  it('writes the decree gains in ink, readable on any band', async () => {
    mountRun()
    const wrapper = mount(SealButton)
    await wrapper.get('button').trigger('click')
    expect(wrapper.get('.gain').classes().join(' ')).not.toMatch(/rose|#/)
    expect(wrapper.get('.gain').classes()).toContain('text-ink')
  })

  it('fits the run screen to its frame: the chronicle is cut short, never scrolled', () => {
    const { wrapper } = mountRun()
    expect(wrapper.classes()).toContain('h-full')
    expect(wrapper.classes()).toContain('overflow-hidden')
    expect(wrapper.classes().join(' ')).not.toMatch(/min-h-\[|min-h-screen/)
    const panel = wrapper.get('.chronicle-excerpt').classes()
    expect(panel).toContain('flex-1')
    expect(panel).toContain('overflow-hidden')
    expect(panel).not.toContain('overflow-y-auto')
  })

  it('lets the kingdom give up its sky on short screens, down to its fields', () => {
    const wrapper = mount(KingdomView, { props: { band: 'enchanted', paused: false } })
    expect(wrapper.html()).toContain('preserveAspectRatio="xMidYMax slice"')
    expect(wrapper.classes()).toContain('h-full')
  })

  it('fades the seal while paused, so it never stands in front of the veil', async () => {
    const { wrapper, game } = mountRun()
    expect(wrapper.get('.seal-slot').classes()).not.toContain('opacity-50')
    game.act({ type: 'SET_PAUSED', paused: true })
    await flushPromises()
    expect(wrapper.get('.seal-slot').classes()).toContain('opacity-50')
  })

  it('hides the run behind an event: opaque, and out of reach', async () => {
    const { wrapper, game } = mountRun()
    game.run!.phase = 'AUDIT_ASSESSMENT'
    game.act({ type: 'SET_PAUSED', paused: false })
    await flushPromises()
    const stub = wrapper.get('[data-phase-stub]')
    expect(stub.classes()).toContain('bg-vellum')
    expect(stub.classes().join(' ')).not.toContain('bg-vellum/')
    expect(wrapper.find('[inert]').exists()).toBe(true)
  })

  it('lets petals fall in the enchanted band only', () => {
    const enchanted = mount(KingdomView, { props: { band: 'enchanted', paused: false } })
    const death = mount(KingdomView, { props: { band: 'death_throes', paused: false } })
    expect(enchanted.findAll('[data-petal]').length).toBeGreaterThan(0)
    expect(death.findAll('[data-petal]')).toHaveLength(0)
    expect(enchanted.html()).toContain('id="enchanted-Kingdom"')
  })
})
