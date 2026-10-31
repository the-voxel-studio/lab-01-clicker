/**
 * The Fortune page: provinces held towards the Imperial Barony, and war at any time of the reign.
 * Only what the scouts report reaches the view: the true force of a target, its ambush and
 * its false ledger stay hidden until a spymaster reveals them.
 *
 * @module ui/fortune
 */

import { hasFieldArmy } from '@/core/engine'
import type { Command, GameState, RunPhase } from '@/core/types'
import type { Screen } from '@/stores/nav'
import { isMomentPhase } from '@/ui/moments'
import { warForecast, type WarForecast } from '@/ui/war'

/** Provinces of the Imperial Barony feat, inline in `evaluateFeats`. */
export const IMPERIAL_BARONY_PROVINCES = 8

/** An action of a war and what stops it. */
export interface FortuneAction {
  command: Command | null
  blocked: string | null
}

/** Everything the Fortune page shows. */
export interface FortuneView {
  provinces: number
  goal: number
  live: boolean
  forecast: WarForecast | null
  attack: FortuneAction
  scout: FortuneAction
}

/** Reads the page: live while the reign runs or rests, a tally of provinces otherwise. */
export function fortuneView(state: GameState): FortuneView {
  const live = state.phase === 'ACTIVE_CYCLE' || state.phase === 'AWAIT_RESUME'
  const noArmy = hasFieldArmy(state) ? null : 'You have no army'
  const noScout = (state.units.scout ?? 0) <= 0 ? 'No scouts to send' : null
  return {
    provinces: state.provinces,
    goal: IMPERIAL_BARONY_PROVINCES,
    live,
    forecast: live ? warForecast(state) : null,
    attack: { command: noArmy ? null : { type: 'LAUNCH_ATTACK' }, blocked: noArmy },
    scout: { command: noScout ? null : { type: 'RECON_PATROL' }, blocked: noScout },
  }
}

const OUTSIDE_THE_REIGN: readonly Screen[] = [
  'hall',
  'fate',
  'end',
  'chronicle',
  'how_to_reign',
  'hall_of_feats',
]

/**
 * The screen a phase requires, or null when the current one is right: a letter is answered on the
 * run screen. It takes the screen as well as the phase, because a resumed reign keeps its phase.
 */
export function routeForPhase(phase: RunPhase | null, screen: Screen): Screen | null {
  if (OUTSIDE_THE_REIGN.includes(screen)) return null
  return isMomentPhase(phase) && screen !== 'run' ? 'run' : null
}
