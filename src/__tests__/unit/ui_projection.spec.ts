/**
 * Plan V2_NUMBERS_EVERYWHERE Task 2: doing this means that.
 *
 * @module __tests__/unit/ui_projection.spec
 */

import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import OrderPage from '@/components/game/orders/OrderPage.vue'
import { createInitialGameState } from '@/core/state'
import { useArchivesStore } from '@/stores/archives'
import { useGameStore } from '@/stores/game'
import { useSettingsStore } from '@/stores/settings'
import type { RealmRates } from '@/ui/effects'
import { projectAudit, verdict } from '@/ui/projection'

const RATES: RealmRates = {
  netAp: 5,
  grossAp: 9,
  births: 1.8,
  room: 875,
  force: 22,
  unrestPerSecond: 0,
}

describe('Task 2: doing this means that', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('projects the people at the audit, up to the room', () => {
    const state = createInitialGameState({ seed: 1 })
    state.totalPopulation = 540
    expect(projectAudit(state, RATES, 62).people).toBe(651)
    expect(projectAudit(state, { ...RATES, room: 600 }, 62).people).toBe(600)
    expect(projectAudit(state, RATES, 62)).toMatchObject({ ap: 9, force: 22 })
  })

  it('says when the people stop at the room', () => {
    const state = createInitialGameState({ seed: 1 })
    state.totalPopulation = 590
    expect(projectAudit(state, { ...RATES, room: 600 }, 62).capped).toBe(true)
    expect(projectAudit(state, RATES, 62).capped).toBe(false)
  })

  it('counts births only once a tithe freeze ends', () => {
    const state = createInitialGameState({ seed: 1 })
    state.totalPopulation = 500
    state.forcedTitheFreezeTimer = 20
    expect(projectAudit(state, RATES, 62).people).toBe(575)
  })

  it('reads the verdict in words', () => {
    expect(verdict(650, 682)).toEqual({ met: false, text: '32 short' })
    expect(verdict(687, 682)).toEqual({ met: true, text: 'met, 5 to spare' })
  })

  it('opens the Commons on its gauge, and a purchase moves the verdict', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    useArchivesStore().load()
    useSettingsStore().load()
    const game = useGameStore()
    game.begin(7)
    game.run!.ap = 1e6
    const page = mount(OrderPage, { props: { order: 'people' }, global: { plugins: [pinia] } })
    await flushPromises()
    expect(page.find('[data-person]').exists()).toBe(true)
    const before = page.get('[data-verdict]').text()
    expect(before).toMatch(/short|met/)
    expect(page.get('[data-unit="peasant"] [data-effect]').text()).toMatch(/\d/)
    await page.get('[data-unit="artisan"] [data-buy]').trigger('click')
    await flushPromises()
    expect(page.find('[data-verdict]').exists()).toBe(true)
    page.unmount()
  })
})
