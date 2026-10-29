/**
 * Kingdom scenes of the run screen, one per dread band, exported from Figma `Screens v7`
 * (frames `Kingdom` of `39:902`, `39:1079`, `39:1257`, `39:1448`) as SVG with the layer names as
 * ids, so later motion work can target the clouds, the mob or Death. The rose of grace fades from
 * scene to scene and is absent at death throes (design 3.1.1).
 *
 * @module data/kingdomScenes
 */

import deathThroesSvg from './kingdom/death_throes.svg?raw'
import enchantedSvg from './kingdom/enchanted.svg?raw'
import rottingSvg from './kingdom/rotting.svg?raw'
import uneasySvg from './kingdom/uneasy.svg?raw'
import type { DreadBand } from '@/ui/dread'

/** SVG markup of the kingdom in each dread band. */
export const KINGDOM_SCENES: Record<DreadBand, string> = {
  enchanted: enchantedSvg,
  uneasy: uneasySvg,
  rotting: rottingSvg,
  death_throes: deathThroesSvg,
}
