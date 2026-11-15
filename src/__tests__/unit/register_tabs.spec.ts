/**
 * Plan V2_CROWN_TABS: the register tabs shared by the Crown and the war panel.
 *
 * @module __tests__/unit/register_tabs.spec
 */

import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import RegisterTabs from '@/components/game/ledger/RegisterTabs.vue'

const TABS = [
  { id: 'fight', label: 'The fight' },
  { id: 'land', label: 'The land', mark: '!' },
] as const

function tabs(selected: 'fight' | 'land') {
  return mount(RegisterTabs, {
    props: { tabs: TABS, selected, label: 'War', attr: 'data-war-tab' },
  })
}

describe('Register tabs', () => {
  it('draws each tab as a framed button and the open one in wax', () => {
    const bar = tabs('fight')
    expect(bar.get('[role="tablist"]').attributes('aria-label')).toBe('War')
    const fight = bar.get('[data-war-tab="fight"]')
    const land = bar.get('[data-war-tab="land"]')
    expect(fight.attributes('role')).toBe('tab')
    expect(fight.attributes('aria-selected')).toBe('true')
    expect(fight.classes()).toEqual(expect.arrayContaining(['border-gold', 'bg-wax']))
    expect(land.attributes('aria-selected')).toBe('false')
    expect(land.classes()).toEqual(expect.arrayContaining(['border-gold', 'bg-vellum-shade']))
    expect(land.attributes('tabindex')).toBe('-1')
  })

  it('asks for a tab on a press and on the arrow keys, round the ends', async () => {
    const bar = tabs('fight')
    await bar.get('[data-war-tab="land"]').trigger('click')
    await bar.get('[role="tablist"]').trigger('keydown', { key: 'ArrowRight' })
    await bar.get('[role="tablist"]').trigger('keydown', { key: 'ArrowLeft' })
    expect(bar.emitted('select')).toEqual([['land'], ['land'], ['land']])
  })

  it('shows the mark of a tab on its corner', () => {
    const bar = tabs('fight')
    expect(bar.get('[data-war-tab="land"] [data-tab-mark]').text()).toBe('!')
    expect(bar.find('[data-war-tab="fight"] [data-tab-mark]').exists()).toBe(false)
  })
})
