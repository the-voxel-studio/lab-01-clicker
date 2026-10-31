/**
 * Phrases the run screen writes about the realm: audit ordinals, clocks, the AP rate and the
 * unrest line.
 *
 * @module ui/realmText
 */

import { getUnrestCrisisStage } from '@/core/formulas'
import type { UnrestCrisisStage } from '@/core/types'

const ORDINALS = [
  'first',
  'second',
  'third',
  'fourth',
  'fifth',
  'sixth',
  'seventh',
  'eighth',
  'ninth',
  'tenth',
] as const

/** Ordinal of an audit, "first" to "tenth"; beyond ten, "audit {n}" reads as "{n}th". */
export function auditOrdinal(deadline: number): string {
  return ORDINALS[deadline - 1] ?? `${deadline}th`
}

/** Writes a signed figure with a plus or a true minus sign (U+2212). */
export function signedPoints(value: number): string {
  return value < 0 ? `\u2212${Math.abs(value)}` : `+${value}`
}

/** The same ordinal with a capital, to open a title. */
export function capitalized(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

/** A countdown as `m:ss`, rounded up so the clock reads 0:00 only at the end. */
export function formatClock(seconds: number): string {
  const total = Math.max(0, Math.ceil(seconds))
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

/** The net AP rate as the HUD writes it, with a true minus sign when negative. */
export function formatRate(perSecond: number): string {
  const rounded = Math.round(perSecond)
  const sign = rounded < 0 ? '−' : '+'
  return `${sign}${formatCompact(Math.abs(rounded))} AP each second`
}

const UNREST_PHRASES: Record<UnrestCrisisStage, string> = {
  tranquility: 'the realm is quiet',
  fiscal_boycott: 'the villages refuse to pay',
  strife_desertion: 'strife and desertion',
  urban_rebellion: 'the towns rise against you',
  total_revolution: 'the towns rise against you',
}

/** The unrest line under the HUD, for example "Unrest 28%, the realm is quiet". */
export function unrestLine(unrest: number): string {
  return `Unrest ${Math.round(unrest)}%, ${UNREST_PHRASES[getUnrestCrisisStage(unrest)]}`
}

/** A figure for the interface, rounded to `decimals`, with a true minus sign (U+2212). */
export function formatFigure(value: number, decimals = 0): string {
  const factor = 10 ** decimals
  const text = (Math.round(value * factor) / factor).toLocaleString('en', {
    maximumFractionDigits: decimals,
  })
  return text.replace('-', '−')
}

/**
 * A figure for the interface, in thousands from 1,000: `1.5k`, with one decimal up to `999.9k` and
 * none beyond. Thousands are never rounded to nearest: `down` suits what the player holds, `up` what
 * is owed or demanded, so the screen never promises more than the engine grants.
 *
 * @param decimals - Decimals of figures under 1,000.
 * @param round - Direction of the thousands, on the signed value.
 */
export function formatCompact(value: number, decimals = 0, round: 'down' | 'up' = 'down'): string {
  const magnitude = Math.abs(value)
  if (magnitude < 1000) return formatFigure(value, decimals)
  const towardsZero = (round === 'down') === value > 0
  const step = towardsZero ? Math.floor : Math.ceil
  const thousands = magnitude / 1000
  const shown = thousands < 1000 ? step(thousands * 10) / 10 : step(thousands)
  return `${value < 0 ? '−' : ''}${shown.toLocaleString('en')}k`
}
