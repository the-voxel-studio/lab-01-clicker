/**
 * Plan V2_LEDGER_LANGUAGE Task 3: the gauges of the finer pass.
 *
 * @module __tests__/unit/ledger_gauges.spec
 */

import { readdirSync, readFileSync } from 'node:fs'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import AllowanceSlots from '@/components/game/ledger/AllowanceSlots.vue'
import OddsSwords from '@/components/game/ledger/OddsSwords.vue'
import PeopleCount from '@/components/game/ledger/PeopleCount.vue'
import ProvinceShield from '@/components/game/ledger/ProvinceShield.vue'
import TorchGauge from '@/components/game/ledger/TorchGauge.vue'
import WarBanners from '@/components/game/ledger/WarBanners.vue'
import WaxAction from '@/components/game/ledger/WaxAction.vue'
import { BIOMES_DATA } from '@/data/biomes'
import { BIOME_MARK, figureRow, torchesLit } from '@/ui/gauges'

describe('Task 3: gauges', () => {
  it('splits the twenty figures of the room', () => {
    expect(figureRow(540, 650, 875)).toEqual({ ink: 12, projection: 3, pale: 5, over: false })
    expect(figureRow(900, 900, 875)).toEqual({ ink: 20, projection: 0, pale: 0, over: true })
    expect(figureRow(0, 0, 0)).toEqual({ ink: 0, projection: 0, pale: 20, over: false })
    expect(figureRow(10, 5, 0).over).toBe(true)
  })

  it('lights one torch for each ten of unrest', () => {
    expect(torchesLit(35)).toBe(3)
    expect(torchesLit(100)).toBe(10)
    expect(torchesLit(0)).toBe(0)
    expect(torchesLit(140)).toBe(10)
  })

  it('marks every biome', () => {
    for (const { id } of Object.values(BIOMES_DATA)) {
      expect(BIOME_MARK[id].tincture).toMatch(/^#[0-9a-f]{6}$/)
    }
  })

  it('names the living, the Crown and the room beside the figures', () => {
    const count = mount(PeopleCount, { props: { living: 540, crown: 682, room: 875 } })
    expect(count.text()).toMatch(/540\s*living/)
    expect(count.text()).toMatch(/682\s*Crown/)
    expect(count.text()).toMatch(/875\s*room/)
    expect(count.findAll('[data-person]')).toHaveLength(20)
    expect(count.find('[data-overcrowded]').exists()).toBe(false)
  })

  it('states the overcrowding in words, and survives no room at all', () => {
    const over = mount(PeopleCount, { props: { living: 900, crown: 500, room: 875 } })
    expect(over.get('[data-overcrowded]').text()).toContain('25 over the room')
    const none = mount(PeopleCount, { props: { living: 0, crown: 0, room: 0 } })
    expect(none.findAll('[data-person="pale"]')).toHaveLength(20)
  })

  it('reads the unrest in words beside its torches', () => {
    const gauge = mount(TorchGauge, { props: { unrest: 35 } })
    expect(gauge.findAll('[data-torch="lit"]')).toHaveLength(3)
    expect(gauge.findAll('[data-torch]')).toHaveLength(10)
    expect(gauge.text()).toContain('35 of 100, overthrown at 100')
  })

  it('shows a province with its room and its effect', () => {
    const shield = mount(ProvinceShield, {
      props: { biome: 'farmlands', room: 375, note: 'births +0.1%' },
    })
    expect(shield.text()).toContain('375')
    expect(shield.text()).toContain('Arable Plains')
    expect(shield.text()).toContain('births +0.1%')
  })

  it('sets the host against the scouted force', () => {
    const banners = mount(WarBanners, { props: { yours: 22, theirsMin: 18, theirsMax: 30 } })
    expect(banners.text()).toContain('22')
    expect(banners.text()).toContain('your host')
    expect(banners.text()).toContain('18 to 30')
  })

  it('reads the odds in words', () => {
    const swords = mount(OddsSwords, { props: { chance: 4 } })
    expect(swords.text()).toContain('4 in 10')
    expect(swords.findAll('[data-sword="won"]')).toHaveLength(4)
    expect(swords.findAll('[data-sword]')).toHaveLength(10)
  })

  it('shows the free conquest and what the next two would cost', () => {
    const slots = mount(AllowanceSlots, { props: { used: 1, step: 0.1 } })
    expect(slots.text()).toContain('1 free')
    expect(slots.text()).toContain('+10%')
    expect(slots.text()).toContain('+20%')
    expect(slots.find('[data-slot="used"]').exists()).toBe(true)
  })

  it('states the projection in words', () => {
    const count = mount(PeopleCount, {
      props: { living: 540, crown: 682, room: 875, projected: 650 },
    })
    expect(count.text()).toContain('650 at the audit')
  })

  it('tells a taken slot from the next in words', () => {
    const slots = mount(AllowanceSlots, { props: { used: 1, step: 0.1 } })
    expect(slots.get('[data-slot="used"]').text()).toContain('taken')
    expect(slots.get('[data-slot="next"]').text()).toContain('next')
  })

  it('emits a press of the wax action, and none when disabled', async () => {
    const live = mount(WaxAction, { props: { label: 'Attack', line: '4 in 10', icon: 'sword' } })
    await live.get('button').trigger('click')
    expect(live.emitted('press')).toHaveLength(1)
    expect(live.text()).toContain('4 in 10')
    const shut = mount(WaxAction, {
      props: { label: 'Attack', line: 'No army', icon: 'sword', disabled: true },
    })
    expect(shut.get('button').attributes('disabled')).toBeDefined()
  })

  it('keeps rose out of the gauges', () => {
    const dir = 'src/components/game/ledger'
    for (const file of readdirSync(dir)) {
      expect(readFileSync(`${dir}/${file}`, 'utf8')).not.toMatch(/rose/i)
    }
  })
})
