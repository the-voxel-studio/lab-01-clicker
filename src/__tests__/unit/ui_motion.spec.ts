/**
 * Motion foundation: rolling figures, loop offsets, band tempo, reduced motion, scoped scene ids.
 *
 * @module __tests__/unit/ui_motion.spec
 */

import { describe, expect, it } from 'vitest'
import { scopedScene } from '@/data/kingdomScenes'
import { BAND_TEMPO, MOTION, motionAllowed, phaseOffset, rollTowards } from '@/ui/motion'
import { formatCompact, formatRate } from '@/ui/realmText'

describe('Task 11: motion foundation', () => {
  it('rolls a figure towards its target and lands on it exactly', () => {
    const steps = [0, 50, 100, 200, 300, 400].map((ms) => rollTowards(100, 250, ms, 400))
    expect(steps[0]).toBe(100)
    expect(steps[steps.length - 1]).toBe(250)
    for (let i = 1; i < steps.length; i++) {
      expect(steps[i]).toBeGreaterThanOrEqual(steps[i - 1] ?? 0)
    }
    expect(rollTowards(100, 250, 900, 400)).toBe(250)
    expect(rollTowards(80, -20, 400, 400)).toBe(-20)
  })

  it('follows a target that moves every frame', () => {
    let shown = 0
    for (let target = 10; target <= 300; target += 10) shown = rollTowards(shown, target, 16, 400)
    expect(shown).toBeGreaterThan(200)
    expect(shown).toBeLessThan(300)
  })

  it('shows every large figure in thousands, rounded the way the player is safe', () => {
    expect(formatCompact(999)).toBe('999')
    expect(formatCompact(2.46, 1)).toBe('2.5')
    expect(formatCompact(1000)).toBe('1.0k')
    expect(formatCompact(1999)).toBe('1.9k')
    expect(formatCompact(12340)).toBe('12.3k')
    expect(formatCompact(1234567)).toBe('1,234.5k')
    expect(formatCompact(-1500)).toBe('−1.5k')
    expect(formatCompact(1910, 0, 'up')).toBe('2.0k')
    expect(formatCompact(1901, 0, 'up')).toBe('2.0k')
    expect(formatCompact(1234567, 0, 'up')).toBe('1,234.6k')
    expect(formatCompact(-1510, 0, 'up')).toBe('−1.5k')
    expect(formatCompact(-1510)).toBe('−1.6k')
  })

  it('writes the rate with the same thousands', () => {
    expect(formatRate(1500)).toBe('+1.5k AP each second')
    expect(formatRate(-2000)).toBe('−2.0k AP each second')
  })

  it('gives loops their own phase, stable for a seed', () => {
    const offsets = [0, 1, 2, 3, 4, 5].map((index) => phaseOffset(42, index))
    expect(new Set(offsets).size).toBe(offsets.length)
    expect(phaseOffset(42, 3)).toBe(offsets[3])
    for (const offset of offsets) {
      expect(offset).toBeGreaterThanOrEqual(0)
      expect(offset).toBeLessThan(6000)
    }
  })

  it('turns motion off when either reduced motion source asks for it', () => {
    expect(motionAllowed(false, false)).toBe(true)
    expect(motionAllowed(true, false)).toBe(false)
    expect(motionAllowed(false, true)).toBe(false)
  })

  it('sets a tempo for every band, nervous when the realm rots', () => {
    const bands = ['enchanted', 'uneasy', 'rotting', 'death_throes'] as const
    for (const band of bands) expect(BAND_TEMPO[band]).toBeDefined()
    const jitters = bands.map((band) => BAND_TEMPO[band].jitter)
    expect(Math.max(...jitters)).toBe(BAND_TEMPO.rotting.jitter)
    expect(BAND_TEMPO.enchanted.sway).toBeGreaterThan(BAND_TEMPO.rotting.sway)
    expect(MOTION.crossfade).toBe(1200)
  })

  it('scopes the ids of each scene so two can be shown at once', () => {
    const ids = (svg: string) => new Set([...svg.matchAll(/id="([^"]+)"/g)].map((m) => m[1]))
    const a = scopedScene('enchanted')
    const b = scopedScene('uneasy')
    const shared = [...ids(a)].filter((id) => ids(b).has(id))
    expect(shared).toEqual([])
    for (const [, ref] of a.matchAll(/url\(#([^)]+)\)/g)) expect(ids(a).has(ref)).toBe(true)
    expect(a).toContain('id="enchanted-Kingdom"')
  })
})
