/**
 * Contracts shared by the simulation runner and the bots.
 *
 * A bot reads the public state and returns commands; only the runner dispatches them and ticks.
 *
 * @module __tests__/simulation/bots/strategy
 */

import type { Command, GameState } from '@/core/types'
import type { EngineConfig } from '@/core/config'
import type { PRNG } from '@/core/prng'
import type { DilemmaDef } from '@/data/dilemmas'

/** Response to a Crown threat herald. */
export type ThreatResponse = 'defense' | 'tribute' | 'levy'

/** What the runner hands to a bot besides the state. */
export interface BotContext {
  /** Engine configuration of the run (balance and quotas). */
  readonly config: EngineConfig
  /** The bot's own generator, derived from the run seed by the runner (not a game stream). */
  readonly rng: PRNG
}

/** A bot: one decision function per kind of choice the run asks for. */
export interface BotStrategy {
  /** Short name used in logs and reports. */
  readonly name: string
  /** Commands issued at the start of each simulated second of `ACTIVE_CYCLE`. */
  governActive(state: Readonly<GameState>, ctx: BotContext): Command[]
  /** Index of the chosen choice of the drafted dilemma. */
  resolveDilemma(state: Readonly<GameState>, ctx: BotContext, dilemma: DilemmaDef): number
  /** `ENACT_LAW` for a drafted law, or `REJECT_LAWS`. */
  chooseLaw(state: Readonly<GameState>, ctx: BotContext): Command
  /** Response to the announced threat. */
  answerThreat(state: Readonly<GameState>, ctx: BotContext): ThreatResponse
  /** `LAUNCH_ATTACK`, `RECON_PATROL` or `SKIP_EXPEDITION`; asked until the expedition ends. */
  planExpedition(state: Readonly<GameState>, ctx: BotContext): Command
  /** Whether to accept the Lombard bailout. */
  answerLombard(state: Readonly<GameState>, ctx: BotContext): boolean
}
