/**
 * Random Noise Bot (GAME_RULES §21, expected win rate below 5%).
 *
 * @module __tests__/simulation/bots/randomBot
 */

import type { Command } from '@/core/types'
import { calculateNetApRate } from '@/core/engine'
import { canAffordEffects } from '@/core/modifiers'
import type { PRNG } from '@/core/prng'
import { UNIT_IDS } from './realm'
import { canEnactLaw } from './council'
import type { BotStrategy, ThreatResponse } from './strategy'

/** Chance per second to buy one random unit. */
const BUY_CHANCE = 0.3
/** Chance per second to set a random tax rate. */
const TAX_CHANCE = 0.1

/** Chance per decision of sending the host; a refusal costs nothing. */
const WAR_CHANCE = 0.02
/** Chance to accept the Lombard bailout. */
const LOMBARD_ACCEPT_CHANCE = 0.5
/** Range of the random tax rates. */
const TAX_RANGE: readonly [number, number] = [10, 60]

/** Picks one element of a non empty list with the bot's own generator. */
function pick<T>(rng: PRNG, items: readonly T[], fallback: T): T {
  return items[rng.nextInt(0, items.length - 1)] ?? fallback
}

/**
 * Random Noise Bot: no economic reasoning at all.
 *
 * Heuristic (fixed, documented; every draw uses the bot's own generator, derived from the run
 * seed by the runner): each second one stamp, a 30% chance to buy one unit drawn among all 24
 * (the engine rejects what is not allowed), a 10% chance to set a tax rate drawn in [10, 60].
 * Every council, threat, expedition and Lombard answer is drawn uniformly among the answers
 * the engine accepts.
 */
export const randomBotStrategy: BotStrategy = {
  name: 'Random',

  governActive(_state, { rng }): Command[] {
    const commands: Command[] = [{ type: 'STAMP_DOCUMENT' }]
    if (rng.next() < BUY_CHANCE) {
      commands.push({ type: 'BUY_UNIT', unitId: pick(rng, UNIT_IDS, 'peasant'), count: 1 })
    }
    if (rng.next() < TAX_CHANCE) {
      commands.push({ type: 'SET_TAX_RATE', rate: rng.nextInt(TAX_RANGE[0], TAX_RANGE[1]) })
    }
    if (rng.next() < WAR_CHANCE) commands.push({ type: 'LAUNCH_ATTACK' })
    return commands
  },

  resolveDilemma(state, { config, rng }, dilemma): number {
    const netApRate = calculateNetApRate(state, config)
    const affordable = dilemma.choices.flatMap((choice, index) =>
      canAffordEffects(state, choice.effects, netApRate) ? [index] : [],
    )
    return pick(rng, affordable, 0)
  },

  chooseLaw(state, { config, rng }): Command {
    const answers: Command[] = [
      { type: 'REJECT_LAWS' },
      ...state.currentLawDraft
        .filter((lawId) => canEnactLaw(state, config, lawId))
        .map((lawId): Command => ({ type: 'ENACT_LAW', lawId })),
    ]
    return pick(rng, answers, { type: 'REJECT_LAWS' })
  },

  answerThreat(state, { rng }): ThreatResponse {
    const answers: ThreatResponse[] =
      state.ap >= state.currentThreatTributeAp
        ? ['defense', 'levy', 'tribute']
        : ['defense', 'levy']
    return pick(rng, answers, 'levy')
  },

  answerLombard(_state, { rng }): boolean {
    return rng.next() < LOMBARD_ACCEPT_CHANCE
  },
}
