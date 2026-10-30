/**
 * Counsel line, chronicle panel and page, action bar and order placeholders.
 *
 * @module __tests__/unit/components_chronicle.spec
 */

import { beforeEach, describe, expect, it } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import ChroniclePage from '@/components/game/ChroniclePage.vue'
import CrownPage from '@/components/game/orders/CrownPage.vue'
import ActionBar from '@/components/game/run/ActionBar.vue'
import ChroniclePanel from '@/components/game/run/ChroniclePanel.vue'
import CounselLine from '@/components/game/run/CounselLine.vue'
import { useArchivesStore } from '@/stores/archives'
import { useGameStore } from '@/stores/game'
import { useNavStore } from '@/stores/nav'
import { useSettingsStore } from '@/stores/settings'

function stores() {
  const pinia = createPinia()
  setActivePinia(pinia)
  useArchivesStore().load()
  useSettingsStore().load()
  const game = useGameStore()
  game.begin(42)
  return { pinia, game, nav: useNavStore() }
}

describe('Task 8: counsel line, chronicle, action bar', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('buys what the counsel offers and the chronicle tells it', async () => {
    const { pinia, game } = stores()
    game.run!.ap = 5000
    game.advance(0.05)
    const counsel = mount(CounselLine, { global: { plugins: [pinia] } })
    const panel = mount(ChroniclePanel, { global: { plugins: [pinia] } })
    const offer = counsel.get('[data-counsel-action]')
    await offer.trigger('click')
    await flushPromises()
    expect(panel.text()).toMatch(/You (hired your first|recruited)/)
  })

  it('opens the full chronicle and comes back to the reign', async () => {
    const { pinia, nav } = stores()
    nav.go('run')
    const panel = mount(ChroniclePanel, { global: { plugins: [pinia] } })
    await panel.get('[data-read-all]').trigger('click')
    expect(nav.screen).toBe('chronicle')
    const page = mount(ChroniclePage, { global: { plugins: [pinia] } })
    expect(page.text()).toContain('Coronation')
    expect(page.text()).toContain('Reign 1, from the coronation to now')
    for (const kind of ['your decisions', 'audits', 'folklore', 'deaths', 'money']) {
      expect(page.text()).toContain(kind)
    }
    await page.get('[data-back]').trigger('click')
    expect(nav.screen).toBe('run')
  })

  it('shows the army shortfall on the Host and the order screens', async () => {
    const { pinia, game, nav } = stores()
    const bar = mount(ActionBar, { global: { plugins: [pinia] } })
    const military = game.quotas.find((quota) => quota.axis === 'military')
    const host = bar.get('[data-order="order_military"]')
    expect(military?.met).toBe(false)
    expect(host.find('[data-badge]').text()).toBe(
      String(Math.ceil((military?.required ?? 0) - (military?.current ?? 0))),
    )
    for (const [label, screen] of [
      ['Commons', 'order_people'],
      ['Chancery', 'order_admin'],
      ['Host', 'order_military'],
      ['Fortune', 'fortune'],
      ['Crown', 'crown'],
    ] as const) {
      await bar.get(`[data-order="${screen}"]`).trigger('click')
      expect(nav.screen).toBe(screen)
      expect(bar.get(`[data-order="${screen}"]`).text()).toContain(label)
    }
    const page = mount(CrownPage, { global: { plugins: [pinia] } })
    expect(page.text()).toContain('The Crown')
    await page.get('[data-order="run"]').trigger('click')
    expect(nav.screen).toBe('run')
  })

  it('hides the Host badge when the army meets the demand', () => {
    const { pinia, game } = stores()
    game.run!.units.soldier = 500
    game.advance(0.05)
    const bar = mount(ActionBar, { global: { plugins: [pinia] } })
    expect(bar.get('[data-order="order_military"]').find('[data-badge]').exists()).toBe(false)
  })
})
