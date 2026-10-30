/**
 * The Fortune page: provinces held towards the Imperial Barony, and the expedition between two
 * audits. Only what the scouts report reaches the view: the true force of a target, its ambush and
 * its false ledger stay hidden until a spymaster reveals them.
 *
 * @module ui/fortune
 */

import { DEFAULT_ENGINE_CONFIG } from '@/core/config'
import { calculateMilitaryPower } from '@/core/engine'
import type { Command, GameState, RunPhase } from '@/core/types'
import { BIOMES_DATA } from '@/data/biomes'
import { FACTIONS_DATA } from '@/data/threats'
import type { Screen } from '@/stores/nav'

const config = DEFAULT_ENGINE_CONFIG

/** Provinces of the Imperial Barony feat, inline in `evaluateFeats`. */
export const IMPERIAL_BARONY_PROVINCES = 8

/** An action of the expedition and what stops it. */
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
  campaignsLeft: number
}

/** Everything the Fortune page shows. */
export interface FortuneView {
  provinces: number
  goal: number
  live: boolean
  target: TargetView | null
  attack: FortuneAction
  scout: FortuneAction
  leave: Command
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
  if (state.phase !== 'EXPEDITION' || !target) return null
  const reach = siegeReach(calculateMilitaryPower(state, config))
  const warnings: string[] = []
  if (target.revealedAmbush) warnings.push('Your spies smell an ambush.')
  if (target.revealedFalseLedger) warnings.push('Your spies doubt the loot.')
  return {
    biome: BIOMES_DATA[target.biome].name,
    faction: FACTIONS_DATA[target.factionId].name,
    guessMin: Math.floor(target.perceivedMin),
    guessMax: Math.ceil(target.perceivedMax),
    reach: Math.floor(reach),
    odds: oddsCaption(reach, target.perceivedMin, target.perceivedMax),
    warnings,
    campaignsLeft: config.balance.CAMPAIGNS_PER_DEADLINE - state.campaignsLaunchedThisDeadline,
  }
}

/** Reads the page: live with its target during the expedition, a tally of provinces otherwise. */
export function fortuneView(state: GameState): FortuneView {
  const force = calculateMilitaryPower(state, config)
  const noArmy = force <= 0 ? 'You have no army' : null
  const noScout = (state.units.scout ?? 0) <= 0 ? 'No scouts to send' : null
  return {
    provinces: state.provinces,
    goal: IMPERIAL_BARONY_PROVINCES,
    live: state.phase === 'EXPEDITION',
    target: targetView(state),
    attack: { command: noArmy ? null : { type: 'LAUNCH_ATTACK' }, blocked: noArmy },
    scout: { command: noScout ? null : { type: 'RECON_PATROL' }, blocked: noScout },
    leave: { type: 'SKIP_EXPEDITION' },
  }
}

const OUTSIDE_THE_REIGN: readonly Screen[] = ['hall', 'end', 'chronicle', 'hall_of_feats']

/**
 * The screen a phase requires, or null when the current one is right. It takes the screen as well
 * as the phase: `awaitingAnswer` stays true from one moment to the next, and a resumed reign keeps
 * its phase, so neither change alone tells when to move.
 */
export function routeForPhase(
  phase: RunPhase | null,
  awaiting: boolean,
  screen: Screen,
): Screen | null {
  if (OUTSIDE_THE_REIGN.includes(screen)) return null
  if (phase === 'EXPEDITION') return screen === 'fortune' ? null : 'fortune'
  return awaiting && screen !== 'run' ? 'run' : null
}
