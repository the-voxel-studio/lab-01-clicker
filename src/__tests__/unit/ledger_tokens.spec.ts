/**
 * Plan V2_LEDGER_LANGUAGE Task 1: colour tokens and the figure run.
 *
 * @module __tests__/unit/ledger_tokens.spec
 */

import { readFileSync } from 'node:fs'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import LedgerFigure from '@/components/game/ledger/LedgerFigure.vue'

const css = readFileSync('src/assets/main.css', 'utf8')

function token(name: string): string {
  const match = new RegExp(`--color-${name}: (#[0-9a-f]{6});`).exec(css)
  if (!match?.[1]) throw new Error(`no token ${name}`)
  return match[1]
}

function luminance(hex: string): number {
  const channels = [1, 3, 5].map((start) => {
    const value = Number.parseInt(hex.slice(start, start + 2), 16) / 255
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  })
  const [red = 0, green = 0, blue = 0] = channels
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue
}

function contrast(one: string, two: string): number {
  const [light, dark] = [luminance(one), luminance(two)].sort((a, b) => b - a)
  return ((light ?? 0) + 0.05) / ((dark ?? 0) + 0.05)
}

describe('Task 1: tokens and figures', () => {
  it.each([
    ['vellum', '#f4e6c8'],
    ['ink', '#21130a'],
    ['rubric', '#96180e'],
    ['verdigris', '#1f7a5e'],
    ['wax', '#b5262b'],
    ['gold', '#d6a93a'],
  ])('sets %s to the value of the design', (name, value) => {
    expect(token(name)).toBe(value)
  })

  it('reaches the contrast floors on the vellum', () => {
    expect(contrast(token('ink'), token('vellum'))).toBeGreaterThanOrEqual(7)
    expect(contrast(token('ink-faded'), token('vellum'))).toBeGreaterThanOrEqual(4.5)
    expect(contrast(token('rubric'), token('vellum'))).toBeGreaterThanOrEqual(4.5)
  })

  it('draws a figure in the display face, at its size and tone', () => {
    const large = mount(LedgerFigure, { props: { value: '2.4k', size: 'lg', tone: 'rubric' } })
    expect(large.text()).toBe('2.4k')
    expect(large.classes()).toEqual(expect.arrayContaining(['font-display', 'text-[25px]']))
    expect(large.classes()).toContain('text-rubric')
    const medium = mount(LedgerFigure, { props: { value: '12' } })
    expect(medium.classes()).toEqual(expect.arrayContaining(['text-[21px]', 'text-ink']))
  })
})
