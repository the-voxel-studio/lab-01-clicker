/**
 * Missives flying from the wax seal on each decree, ported from the prototype's
 * `handleProduceClick` (removed with the showcase): one or two, 85 to 190 px in any direction, a
 * slight rotation, over 750 ms. Each carries the icon of an administration unit the player owns, so the
 * burst shows who does the work (design 5).
 *
 * @module ui/sealBurst
 */

import type { GameState, UnitId } from '@/core/types'
import type { GameIconKey } from '@/data/icons'

/** One missive: its icon and where it lands relative to the seal. */
export interface Missive {
  id: number
  icon: GameIconKey
  dx: number
  dy: number
  rotate: number
  scale: number
}

/** How long a missive flies, in milliseconds. */
export const MISSIVE_MS = 750

const MIN_DISTANCE = 85
const DISTANCE_SPREAD = 105
const ROTATION_SPREAD = 65
const MIN_SCALE = 0.9
const SCALE_SPREAD = 0.4

/** Administration units and their icons, in the order of the Chancery. */
const ADMIN_ICONS: readonly [UnitId, GameIconKey][] = [
  ['scribe', 'roleScribe'],
  ['clerk', 'roleClerk'],
  ['supervisor', 'roleSupervisor'],
  ['provincial_steward', 'roleProvincialSteward'],
  ['archivist', 'roleArchivist'],
  ['audit_chamber', 'roleAuditChamber'],
  ['collector', 'roleTaxCollector'],
  ['farmer_general', 'roleGeneralFarmer'],
]

/** Icons of the administration units owned, or the scroll when none. */
export function missiveIcons(state: GameState): GameIconKey[] {
  const owned = ADMIN_ICONS.filter(([unit]) => (state.units[unit] ?? 0) > 0).map(([, icon]) => icon)
  return owned.length > 0 ? owned : ['scroll']
}

/**
 * Draws the missives of one decree.
 *
 * @param random - Source in [0, 1); tests pass a fixed one.
 * @param icons - Icons to pick from (`missiveIcons`).
 * @param nextId - Id of the first missive.
 */
export function burstMissives(
  random: () => number,
  icons: readonly GameIconKey[],
  nextId: number,
): Missive[] {
  const count = random() > 0.5 ? 2 : 1
  return Array.from({ length: count }, (_, index) => {
    const angle = random() * Math.PI * 2
    const distance = MIN_DISTANCE + random() * DISTANCE_SPREAD
    return {
      id: nextId + index,
      icon: icons[Math.floor(random() * icons.length)] ?? 'scroll',
      dx: Math.round(Math.cos(angle) * distance),
      dy: Math.round(Math.sin(angle) * distance),
      rotate: Math.round((random() - 0.5) * ROTATION_SPREAD),
      scale: Number((MIN_SCALE + random() * SCALE_SPREAD).toFixed(2)),
    }
  })
}
