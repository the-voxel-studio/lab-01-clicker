/**
 * Plan V2_CROWN_TABS: leaves that replace an inner scroll.
 *
 * @module __tests__/unit/leaf_pager.spec
 */

import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import LeafPager from '@/components/game/ledger/LeafPager.vue'
import { LEAF_GAP, leafAt, leafCount } from '@/ui/leaves'

/** Gives every element the size of a sheet whose content runs over `leaves` columns. */
function layOut(width: number, leaves: number): void {
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(width)
  vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockReturnValue(
    leaves * width + (leaves - 1) * LEAF_GAP,
  )
}

describe('Leaves', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('counts the leaves from the width of the columns', () => {
    expect(leafCount(358, 358)).toBe(1)
    expect(leafCount(2 * 358 + LEAF_GAP, 358)).toBe(2)
    expect(leafCount(5 * 288 + 4 * LEAF_GAP, 288)).toBe(5)
    expect(leafCount(0, 0)).toBe(1)
  })

  it('reads the leaf under a scroll offset', () => {
    expect(leafAt(0, 358)).toBe(0)
    expect(leafAt(2 * (358 + LEAF_GAP) + 1, 358)).toBe(2)
    expect(leafAt(120, 0)).toBe(0)
  })

  it('shows no foot while everything fits on one leaf', async () => {
    const pager = mount(LeafPager, { slots: { default: '<p data-line>One line.</p>' } })
    await flushPromises()
    expect(pager.find('[data-line]').exists()).toBe(true)
    expect(pager.find('[data-leaf-foot]').exists()).toBe(false)
  })

  it('turns the leaves and stops at both ends', async () => {
    layOut(300, 3)
    const pager = mount(LeafPager, { slots: { default: '<p>Long.</p>' } })
    await flushPromises()
    const sheet = pager.get('[data-leaves]').element as HTMLElement
    expect(pager.get('[data-leaf-count]').text()).toBe('Leaf 1 of 3')
    expect(pager.get('[data-leaf-back]').attributes('disabled')).toBeDefined()
    await pager.get('[data-leaf-next]').trigger('click')
    expect(pager.get('[data-leaf-count]').text()).toBe('Leaf 2 of 3')
    expect(sheet.scrollLeft).toBe(300 + LEAF_GAP)
    await pager.get('[data-leaf-next]').trigger('click')
    expect(pager.get('[data-leaf-next]').attributes('disabled')).toBeDefined()
    await pager.get('[data-leaf-back]').trigger('click')
    expect(pager.get('[data-leaf-count]').text()).toBe('Leaf 2 of 3')
  })

  it('follows the focus onto another leaf', async () => {
    layOut(300, 3)
    const pager = mount(LeafPager, { slots: { default: '<p>Long.</p>' } })
    await flushPromises()
    const sheet = pager.get('[data-leaves]')
    ;(sheet.element as HTMLElement).scrollLeft = 2 * (300 + LEAF_GAP)
    await sheet.trigger('scroll')
    expect(pager.get('[data-leaf-count]').text()).toBe('Leaf 3 of 3')
  })

  it('scrolls rather than cut a block taller than a leaf, then turns leaves again', async () => {
    layOut(300, 2)
    const rects = vi.spyOn(HTMLElement.prototype, 'getClientRects')
    rects.mockReturnValue([{}, {}] as unknown as DOMRectList)
    const pager = mount(LeafPager, { slots: { default: '<p>Tall.</p>' } })
    await flushPromises()
    const sheet = pager.get('[data-leaves]')
    expect(sheet.attributes('data-leaves-mode')).toBe('scroll')
    expect(pager.find('[data-leaf-foot]').exists()).toBe(false)

    rects.mockReturnValue([{}] as unknown as DOMRectList)
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(400)
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(120)
    pager.vm.$forceUpdate()
    await flushPromises()
    expect(sheet.attributes('data-leaves-mode')).toBe('leaves')
    expect(pager.get('[data-leaf-count]').text()).toBe('Leaf 1 of 2')
  })
})
