/**
 * Kingdom view: the four band scenes exported from Figma and the rose of grace fading.
 *
 * @module __tests__/unit/kingdom_scenes.spec
 */

import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import KingdomView from '@/components/game/run/KingdomView.vue'
import { DOORS, VILLAGERS } from '@/data/kingdomVillagers'
import { KINGDOM_SCENES } from '@/data/kingdomScenes'
import type { DreadBand } from '@/ui/dread'

const BANDS: DreadBand[] = ['enchanted', 'uneasy', 'rotting', 'death_throes']
const ROSE = {
  enchanted: ['#F60887', '#FB90C9', '#FBC2D9'],
  uneasy: ['#C94F86', '#D9A3B8', '#E5C3C3'],
  rotting: ['#7E3D5E', '#8D6C72'],
}
const ALL_ROSE = Object.values(ROSE).flat()
const blossoms = (band: DreadBand) =>
  KINGDOM_SCENES[band].match(/id="Blossom(_\d+)?"/g)?.length ?? 0

describe('Task 6: kingdom view', () => {
  it('has one scene per band, drawn at 390 by 268', () => {
    for (const band of BANDS) expect(KINGDOM_SCENES[band]).toMatch(/viewBox="0 0 390 268"/)
  })

  it('fades the rose of grace band after band and leaves none at death throes', () => {
    for (const [band, colours] of Object.entries(ROSE)) {
      for (const colour of colours) expect(KINGDOM_SCENES[band as DreadBand]).toContain(colour)
    }
    for (const colour of ALL_ROSE) {
      expect(KINGDOM_SCENES.death_throes.toUpperCase()).not.toContain(colour)
    }
  })

  it('never lets the blossoms grow back as the realm worsens', () => {
    const counts = BANDS.map(blossoms)
    for (let i = 1; i < counts.length; i++) {
      expect(counts[i]).toBeLessThanOrEqual(counts[i - 1] ?? 0)
    }
    expect(counts[0]).toBeGreaterThan(0)
    expect(counts[3]).toBe(0)
  })

  it('names the layers the motion targets, where each band draws them', () => {
    const has = (band: DreadBand, layer: string) =>
      new RegExp(`id="${layer}(_\\d+)?"`).test(KINGDOM_SCENES[band])
    for (const band of BANDS) {
      for (const layer of ['Death', 'Tree', 'Pennant', 'Sun']) {
        expect(has(band, layer)).toBe(true)
      }
    }
    for (const band of BANDS) expect(has(band, 'Smoke')).toBe(true)
    for (const band of ['uneasy', 'rotting'] as const) expect(has(band, 'Cloud')).toBe(true)
    for (const band of ['rotting', 'death_throes'] as const) {
      expect(has(band, 'Raven')).toBe(true)
      expect(has(band, 'Flame')).toBe(true)
    }
    expect(has('enchanted', 'Peasant')).toBe(true)
    expect(has('death_throes', 'Mob')).toBe(true)
    expect(has('rotting', 'Mob')).toBe(false)
  })

  it('draws the castle as a solid tower with a door, not the keyhole of the old icon', () => {
    for (const band of BANDS) {
      const fortress = KINGDOM_SCENES[band].match(/<g id="Fortress">.*?<\/g>/s)?.[0] ?? ''
      expect(fortress).toContain('data-door')
      expect(fortress).not.toContain('88.0546')
    }
  })

  it('joins every roof to its walls', () => {
    for (const band of BANDS) {
      const svg = KINGDOM_SCENES[band]
      const roofs = [
        ...svg.matchAll(/L[\d.]+ [\d.]+L[\d.]+ ([\d.]+)H[\d.]+Z" fill="#[0-9A-F]{6}"/g),
      ]
      expect(roofs.length).toBeGreaterThanOrEqual(4)
      for (const [, base] of roofs) expect(svg).toContain(`data-wall-top="${base}"`)
    }
  })

  it('peoples the realm, thinning as it worsens, with someone at every door', () => {
    const counts = BANDS.map((band) => VILLAGERS[band].length)
    expect(counts[0]).toBeGreaterThanOrEqual(8)
    expect(counts[1]).toBeGreaterThan(counts[2] ?? 0)
    const doors = new Set(
      VILLAGERS.enchanted.filter((v) => v.kind === 'commuter').map((v) => v.from.join()),
    )
    expect(doors.size).toBe(DOORS.length)
  })

  it('draws the angry crowd as people who stand their ground, never as loose pitchforks', () => {
    expect(VILLAGERS.death_throes.every((v) => v.kind === 'rioter')).toBe(true)
    for (const band of ['enchanted', 'uneasy', 'rotting'] as const) {
      expect(VILLAGERS[band].some((v) => v.kind === 'rioter')).toBe(false)
    }
    for (const band of BANDS) {
      const drawn = KINGDOM_SCENES[band].match(/class="villager [^>]*><path [^>]* d="M[\d.]+ /g)
      expect(drawn?.length).toBe(VILLAGERS[band].length)
    }
  })

  it('shows the scene of its band and veils it while paused', async () => {
    const wrapper = mount(KingdomView, { props: { band: 'rotting', paused: false } })
    expect(wrapper.attributes('data-band')).toBe('rotting')
    expect(wrapper.find('svg').exists()).toBe(true)
    expect(wrapper.text()).not.toContain('Time stands still')
    await wrapper.setProps({ paused: true })
    expect(wrapper.text()).toContain('Time stands still')
    expect(wrapper.text()).toContain('Tap the pause button to resume')
  })
})
