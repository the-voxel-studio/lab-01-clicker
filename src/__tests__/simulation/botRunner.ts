/**
 * Entry point of the simulation bots: the runner and the four bots of `bots/`.
 *
 * @module __tests__/simulation/botRunner
 */

export {
  runSimulation,
  type AuditSnapshot,
  type BotRunResult,
  type SimulationOptions,
} from './bots/runner'
export type { BotContext, BotStrategy, ThreatResponse } from './bots/strategy'
export { randomBotStrategy } from './bots/randomBot'
export { greedyRoiBotStrategy } from './bots/greedyRoiBot'
export { blindGreedyBotStrategy } from './bots/blindGreedyBot'
export { bureaucratBotStrategy } from './bots/bureaucratBot'
export { conquerorBotStrategy } from './bots/conquerorBot'
