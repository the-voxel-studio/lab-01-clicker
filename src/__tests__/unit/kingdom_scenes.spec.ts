/**
 * Kingdom view: the four band scenes exported from Figma and the rose of grace fading.
 *
 * @module __tests__/unit/kingdom_scenes.spec
 */

import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import KingdomView from '@/components/game/run/KingdomView.vue'
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
