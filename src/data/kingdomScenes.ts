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
import { villagerLayer } from './kingdomVillagers'
import type { DreadBand } from '@/ui/dread'

/** Adds the villagers at the end of the `Kingdom` group, above the scene and clipped with it. */
function peopled(svg: string, band: DreadBand): string {
  return svg.replace('</g>\n<defs>', `${villagerLayer(band)}</g>\n<defs>`)
}

/** SVG markup of the kingdom in each dread band. */
export const KINGDOM_SCENES: Record<DreadBand, string> = {
  enchanted: peopled(enchantedSvg, 'enchanted'),
  uneasy: peopled(uneasySvg, 'uneasy'),
  rotting: peopled(rottingSvg, 'rotting'),
  death_throes: peopled(deathThroesSvg, 'death_throes'),
}

/**
 * The scene of a band with every id and reference prefixed by the band, so two scenes can be
 * shown together during a crossfade without their clip paths and gradients colliding.
 */
export function scopedScene(band: DreadBand): string {
  return KINGDOM_SCENES[band]
    .replace(/id="([^"]+)"/g, `id="${band}-$1"`)
    .replace(/url\(#([^)]+)\)/g, `url(#${band}-$1)`)
    .replace(/href="#([^"]+)"/g, `href="#${band}-$1"`)
}
