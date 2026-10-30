/**
 * The people of the kingdom, drawn over the Figma scenes: workers pace the fields, commuters leave
 * a house and go back in, and at death throes the village stands together as a crowd that no
 * longer walks anywhere (design 4.2.1). Coordinates are scene units, at the villager's feet.
 *
 * @module data/kingdomVillagers
 */

import type { DreadBand } from '@/ui/dread'

/** How a villager moves: `rioter` stays on `from`, the others go to `to` and back. */
export type VillagerKind = 'worker' | 'commuter' | 'rioter'

/** One person of a scene. */
export interface Villager {
  kind: VillagerKind
  from: readonly [number, number]
  to: readonly [number, number]
  /** Length of the round trip, in seconds. */
  seconds: number
}

/** Feet at the door of each house, left to right. */
export const DOORS = [
  [57, 180],
  [101, 187],
  [149, 179],
  [205, 183],
] as const

const SILHOUETTE =
  'M162.989 209.149L161.484 212.004L162.427 212.383L162.226 212.895L160.125 214.233L158.605 212.425L157.82 212.141C158.192 211.695 158.528 211.096 158.69 210.524C159.051 210.506 159.934 210.54 160.348 210.457C160.237 210.07 159.405 209.687 158.761 209.595C158.828 208.867 158.631 208.535 157.749 208.42C156.867 208.306 156.567 208.447 156.482 209.497C155.804 209.525 155.086 209.701 154.941 210.192C155.216 210.23 156.1 210.293 156.369 210.337C156.306 210.829 156.352 211.328 156.493 211.657L155.313 211.23L152.474 213.43L154.811 215.837L154.764 216.43L152.263 223.691L153.592 223.925L155.952 218.3L156.576 224.452L157.873 224.68L157.85 224.091L158.342 224.763L162.494 213.981C162.695 213.855 162.866 213.744 162.982 213.663C163.052 213.3 163.009 212.992 162.955 212.784L163.018 212.62L163.926 212.985L164.787 209.812L163.576 212.054L163.215 211.91L163.888 209.435L162.717 211.711L162.342 211.562L162.989 209.149ZM155.394 212.427L155.015 214.648L154.069 213.634L155.394 212.427ZM158.312 213.7L159.793 215.601C159.793 215.601 160.708 215.068 161.582 214.541L157.85 224.077L157.574 216.977L158.312 213.7Z'
/** Feet of the silhouette in its own coordinates. */
const SILHOUETTE_FEET = { x: 163.5, y: 224 }
const PHASE_STEP_SECONDS = 2.7

const FILLS: Record<DreadBand, string> = {
  enchanted: '#3A2414',
  uneasy: '#3A2414',
  rotting: '#2A1A10',
  death_throes: '#D9B98C',
}

const worker = (from: [number, number], to: [number, number], seconds: number): Villager => ({
  kind: 'worker',
  from,
  to,
  seconds,
})
const commuter = (door: number, to: [number, number], seconds: number): Villager => ({
  kind: 'commuter',
  from: DOORS[door] ?? DOORS[0],
  to,
  seconds,
})
const rioter = (x: number, y: number): Villager => ({
  kind: 'rioter',
  from: [x, y],
  to: [x, y],
  seconds: 0,
})

/** Who is out in each band: fewer and faster as the realm rots, a crowd at the end. */
export const VILLAGERS: Record<DreadBand, Villager[]> = {
  enchanted: [
    worker([72, 206], [128, 206], 13),
    worker([88, 226], [132, 226], 11),
    worker([292, 212], [350, 212], 14),
    worker([300, 232], [358, 232], 12),
    commuter(0, [96, 216], 15),
    commuter(1, [122, 198], 13),
    commuter(2, [186, 202], 14),
    commuter(3, [318, 200], 16),
  ],
  uneasy: [
    worker([76, 214], [130, 214], 11),
    worker([296, 214], [352, 214], 12),
    commuter(0, [92, 204], 12),
    commuter(2, [184, 204], 11),
    commuter(3, [312, 202], 13),
  ],
  rotting: [
    worker([78, 214], [126, 214], 8),
    commuter(1, [116, 204], 8),
    commuter(3, [300, 208], 9),
  ],
  death_throes: [
    rioter(104, 224),
    rioter(120, 212),
    rioter(142, 204),
    rioter(166, 208),
    rioter(190, 199),
    rioter(214, 206),
    rioter(236, 200),
    rioter(258, 208),
    rioter(276, 216),
  ],
}

function villagerMarkup(villager: Villager, index: number, band: DreadBand): string {
  const [fromX, fromY] = villager.from
  const [toX, toY] = villager.to
  const name = villager.kind === 'rioter' ? 'Mob' : 'Peasant'
  const style = [
    `--from-x:${fromX}px`,
    `--from-y:${fromY}px`,
    `--to-x:${toX}px`,
    `--to-y:${toY}px`,
    `--face:${toX < fromX ? -1 : 1}`,
    `--trip:${villager.seconds}s`,
    `--delay:-${(index * PHASE_STEP_SECONDS).toFixed(1)}s`,
  ].join(';')
  const offset = `translate(${-SILHOUETTE_FEET.x} ${-SILHOUETTE_FEET.y})`
  return (
    `<g id="${name}_${index + 1}" class="villager villager-${villager.kind}" style="${style}">` +
    `<path transform="${offset}" d="${SILHOUETTE}" fill="${FILLS[band]}"/></g>`
  )
}

/** SVG markup of the people of a band, to sit on top of its scene. */
export function villagerLayer(band: DreadBand): string {
  return VILLAGERS[band].map((villager, index) => villagerMarkup(villager, index, band)).join('')
}
