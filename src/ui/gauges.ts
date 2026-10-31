/**
 * Plain arithmetic of the gauges: how many figures, torches and marks a number draws.
 *
 * @module ui/gauges
 */

import type { BiomeId } from '@/core/types'
import type { GameIconKey } from '@/data/icons'

const PEOPLE_FIGURES = 20
const TORCHES = 10

/** The twenty figures of `PeopleCount`. */
export interface FigureRow {
  ink: number
  projection: number
  pale: number
  over: boolean
}

/**
 * Maps people to the twenty figures of the room. Above the room all are ink and `over` is set.
 *
 * @param living - People alive now.
 * @param projected - People expected at the audit, `living` or more.
 * @param room - People the realm can house.
 */
export function figureRow(living: number, projected: number, room: number): FigureRow {
  const over = living > room
  if (over) return { ink: PEOPLE_FIGURES, projection: 0, pale: 0, over }
  if (room <= 0) return { ink: 0, projection: 0, pale: PEOPLE_FIGURES, over }
  const share = (people: number): number =>
    Math.min(PEOPLE_FIGURES, Math.round((people / room) * PEOPLE_FIGURES))
  const ink = share(living)
  const projection = Math.max(0, share(projected) - ink)
  return { ink, projection, pale: PEOPLE_FIGURES - ink - projection, over }
}

/**
 * Torches of `TorchGauge` lit at an unrest, one for each ten, 0 to 10.
 *
 * @param unrest - Unrest points.
 */
export function torchesLit(unrest: number): number {
  return Math.min(TORCHES, Math.max(0, Math.floor(unrest / 10)))
}

/** Icon and tincture of a province on its shield. */
export const BIOME_MARK: Record<BiomeId, { icon: GameIconKey; tincture: string }> = {
  heartland: { icon: 'hutsVillage', tincture: '#2c8a6c' },
  farmlands: { icon: 'wheatHarvest', tincture: '#b8861f' },
  trade_hub: { icon: 'threatTribute', tincture: '#cf4a28' },
  stronghold: { icon: 'stoneTower', tincture: '#6b5039' },
  wilderness: { icon: 'forest', tincture: '#3d5a3a' },
}
