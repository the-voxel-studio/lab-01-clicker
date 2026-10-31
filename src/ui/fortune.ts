/**
 * The Fortune page: provinces held towards the Imperial Barony, and war at any time of the reign.
 * Only what the scouts report reaches the view: the true force of a target, its ambush and
 * its false ledger stay hidden until a spymaster reveals them.
 *
 * @module ui/fortune
 */

import { DEFAULT_ENGINE_CONFIG } from '@/core/config'
import { calculateMilitaryPower, hasFieldArmy } from '@/core/engine'
import type { Command, GameState, RunPhase } from '@/core/types'
import { BIOMES_DATA } from '@/data/biomes'
import { FACTIONS_DATA } from '@/data/threats'
import type { Screen } from '@/stores/nav'
import { isMomentPhase } from '@/ui/moments'

const config = DEFAULT_ENGINE_CONFIG

/** Provinces of the Imperial Barony feat, inline in `evaluateFeats`. */
export const IMPERIAL_BARONY_PROVINCES = 8

/** An action of a war and what stops it. */
export interface FortuneAction {
  command: Command | null
  blocked: string | null
}

/** The target as the scouts report it. */
export interface TargetView {
  biome: string
  faction: string
  guessMin: number
  guessMax: number
  /** The strongest enemy this army takes a province from, siege and fortification counted. */
  reach: number
  odds: string
  warnings: string[]
}

/** Everything the Fortune page shows. */
export interface FortuneView {
  provinces: number
  goal: number
  live: boolean
  target: TargetView | null
  attack: FortuneAction
  scout: FortuneAction
}

/** Public terms of a siege: friction, fortification and the margin a province needs (rolls aside). */
function siegeReach(force: number): number {
  const { ATTACKER_SIEGE_FRICTION, DEFENDER_FORTIFICATION_BONUS, RAZOR_THIN_VICTORY_MARGIN } =
    config.balance
  return (
    (force * (1 - ATTACKER_SIEGE_FRICTION)) /
    ((1 + DEFENDER_FORTIFICATION_BONUS) * (1 + RAZOR_THIN_VICTORY_MARGIN))
  )
}

function oddsCaption(reach: number, min: number, max: number): string {
  if (reach > max) return 'odds with you'
  return reach < min ? 'odds against you' : 'a coin toss'
}

function targetView(state: GameState): TargetView | null {
  const target = state.currentTarget
  if (!target) return null
  const reach = siegeReach(calculateMilitaryPower(state, config))
  const warnings: string[] = []
  // A target outlives purchases, so the spymasters are read now, not when it was drawn.
  const spies = (state.units.spymaster ?? 0) >= 1
  if (spies && target.isAmbush) warnings.push('Your spies smell an ambush.')
  if (spies && target.isFalseLedger) warnings.push('Your spies doubt the loot.')
  return {
    biome: BIOMES_DATA[target.biome].name,
    faction: FACTIONS_DATA[target.factionId].name,
    guessMin: Math.floor(target.perceivedMin),
    guessMax: Math.ceil(target.perceivedMax),
    reach: Math.floor(reach),
    odds: oddsCaption(reach, target.perceivedMin, target.perceivedMax),
    warnings,
  }
}

/** Reads the page: live while the reign runs or rests, a tally of provinces otherwise. */
export function fortuneView(state: GameState): FortuneView {
  const noArmy = hasFieldArmy(state) ? null : 'You have no army'
  const noScout = (state.units.scout ?? 0) <= 0 ? 'No scouts to send' : null
  return {
    provinces: state.provinces,
    goal: IMPERIAL_BARONY_PROVINCES,
    live: state.phase === 'ACTIVE_CYCLE' || state.phase === 'AWAIT_RESUME',
    target: targetView(state),
    attack: { command: noArmy ? null : { type: 'LAUNCH_ATTACK' }, blocked: noArmy },
    scout: { command: noScout ? null : { type: 'RECON_PATROL' }, blocked: noScout },
  }
}

const OUTSIDE_THE_REIGN: readonly Screen[] = ['hall', 'fate', 'end', 'chronicle', 'hall_of_feats']

/**
 * The screen a phase requires, or null when the current one is right: a letter is answered on the
 * run screen. It takes the screen as well as the phase, because a resumed reign keeps its phase.
 */
export function routeForPhase(phase: RunPhase | null, screen: Screen): Screen | null {
  if (OUTSIDE_THE_REIGN.includes(screen)) return null
  return isMomentPhase(phase) && screen !== 'run' ? 'run' : null
}
