/**
 * High-Speed Headless Bot Simulation Runner.
 *
 * Plays a run with a bot: asks the bot for commands, dispatches them, and ticks 1 s of game time
 * per active decision. Every dispatched command is journaled with its game time, so the run can be
 * replayed by `executeReplay`.
 *
 * @module __tests__/simulation/bots/runner
 */

import type { UnitId } from '@/data/balance'
import { DILEMMAS_DATA } from '@/data/dilemmas'
import type { AuditOutcome, Command, DefeatReason, DispatchResult, GameState } from '@/core/types'
import { createEmptyUnitRoster, createInitialGameState } from '@/core/state'
import { dispatch } from '@/core/commands'
import { tick, calculateMilitaryPower } from '@/core/engine'
import { calculateUnitCost } from '@/core/formulas'
import { DEFAULT_ENGINE_CONFIG, type EngineConfig } from '@/core/config'
import { PRNG, deriveSeed } from '@/core/prng'
import { getStateHash, type ReplayEntry, type ReplayJournal } from '@/core/replay'
import type { BotContext, BotStrategy } from './strategy'

/** Game seconds simulated after each active decision. */
const DECISION_INTERVAL_SECONDS = 1.0

/** Commands allowed in a row while game time is frozen before the runner assumes a bot loop. */
const MAX_FROZEN_COMMANDS = 500

/** Label of the bot's own random generator, derived from the run seed. */
const BOT_RNG_LABEL = 'bot'

/** Options of a simulation run. */
export interface SimulationOptions {
  /** Engine configuration passed to every dispatch and tick (default `DEFAULT_ENGINE_CONFIG`). */
  config?: EngineConfig
  /** Last deadline played; the run stops when the next one would start (default: all of them). */
  maxDeadlines?: number
}

/** The three audited metrics of one deadline, read when its audit ran. */
export interface AuditSnapshot {
  deadline: number
  /** Gross AP rate the audit compared with its quota (`calculateGrossApRate(state).total`). */
  apRate: number
  /** Total population right after the audit (a censure removes a province, not people). */
  pop: number
  /** Military power right after the audit. */
  military: number
}

/** One successful `BUY_UNIT` command of a run, with the AP it cost. */
export interface UnitPurchase {
  /** Game time at which the command was dispatched. */
  timeSeconds: number
  unitId: UnitId
  count: number
  /** AP paid, the only currency a unit purchase spends. */
  cost: number
}

/** Result metrics from a completed bot simulation run. */
export interface BotRunResult {
  seed: number
  won: boolean
  finalDeadline: number
  defeatReason: DefeatReason | null
  totalElapsedSeconds: number
  totalAp: number
  finalPopulation: number
  finalMilitary: number
  /** AP spent on each unit through successful `BUY_UNIT` commands. */
  unitExpenditures: Record<UnitId, number>
  /** Every successful unit purchase, in dispatch order. */
  purchases: UnitPurchase[]
  /** One snapshot per audit the run reached, in deadline order. */
  audits: AuditSnapshot[]
  /** Every command the runner dispatched, with its game time, in the `executeReplay` format. */
  journal: ReplayJournal
  /** `getStateHash` of the final state. */
  finalStateHash: string
}

/** Turns the bot's answer for a frozen phase into the command that phase expects. */
function frozenPhaseCommand(
  strategy: BotStrategy,
  state: GameState,
  ctx: BotContext,
): Command | null {
  switch (state.phase) {
    case 'AUDIT_ASSESSMENT':
      return { type: 'SUBMIT_AUDIT' }
    case 'COUNCIL_DILEMMA': {
      const dilemmaId = state.currentDilemmaId
      const dilemma = dilemmaId === null ? undefined : DILEMMAS_DATA[dilemmaId]
      if (dilemmaId === null || !dilemma) {
        throw new Error(`Runner: COUNCIL_DILEMMA without a known drafted dilemma (${dilemmaId}).`)
      }
      const choiceIndex = strategy.resolveDilemma(state, ctx, dilemma)
      return { type: 'RESOLVE_DILEMMA', dilemmaId, choiceIndex }
    }
    case 'COUNCIL_LAWS':
      return strategy.chooseLaw(state, ctx)
    case 'THREAT_HERALD':
      return { type: 'SELECT_THREAT_RESPONSE', response: strategy.answerThreat(state, ctx) }
    case 'AWAIT_RESUME':
      return strategy.planResume?.(state, ctx) ?? { type: 'RESUME_GOVERNANCE' }
    case 'SURPRISE_RAID':
      return { type: 'RESOLVE_RAID_DEFENSE' }
    case 'LOMBARD_OFFER':
      return strategy.answerLombard(state, ctx)
        ? { type: 'ACCEPT_LOMBARD_LOAN' }
        : { type: 'REFUSE_LOMBARD_LOAN' }
    default:
      return null
  }
}

/** Snapshot of the audit the state just ran. */
function auditSnapshot(
  state: GameState,
  outcome: AuditOutcome,
  config: EngineConfig,
): AuditSnapshot {
  return {
    deadline: outcome.deadline,
    apRate: outcome.grossApRate,
    pop: state.totalPopulation,
    military: calculateMilitaryPower(state, config),
  }
}

/**
 * Runs a single high-speed headless game simulation with the provided bot.
 *
 * During `ACTIVE_CYCLE` the bot is asked for commands, they are dispatched, then 1 s is ticked.
 * In every other phase the bot's answer is dispatched without ticking; a rejected answer there is a
 * bot bug and throws, as does a bot that keeps game time frozen.
 *
 * @param strategy - Bot that makes every decision.
 * @param seed - Run seed (game state streams and the bot's own generator).
 * @param options - Engine configuration and last deadline played.
 * @returns BotRunResult summary, with the command journal and the final state hash.
 */
export function runSimulation(
  strategy: BotStrategy,
  seed: number,
  options: SimulationOptions = {},
): BotRunResult {
  const config = options.config ?? DEFAULT_ENGINE_CONFIG
  const maxDeadlines = options.maxDeadlines ?? config.balance.TOTAL_DEADLINES
  const state = createInitialGameState({ seed })
  const ctx: BotContext = { config, rng: new PRNG(deriveSeed(seed, BOT_RNG_LABEL)) }
  const unitExpenditures = createEmptyUnitRoster()
  const entries: ReplayEntry[] = []
  const audits: AuditSnapshot[] = []
  const purchases: UnitPurchase[] = []
  let lastAudit = state.lastAuditOutcome
  const recordAudit = (): void => {
    const outcome = state.lastAuditOutcome
    if (outcome === lastAudit) return
    lastAudit = outcome
    if (outcome) audits.push(auditSnapshot(state, outcome, config))
  }

  const send = (command: Command): DispatchResult => {
    const timeSeconds = state.totalElapsedSeconds
    entries.push({ timeSeconds, command })
    const cost =
      command.type === 'BUY_UNIT'
        ? calculateUnitCost(
            command.unitId,
            state.units[command.unitId] ?? 0,
            command.count,
            config,
            state.activeModifiers,
          )
        : 0
    const result = dispatch(state, command, config)
    if (result.success && command.type === 'BUY_UNIT') {
      purchases.push({
        timeSeconds,
        unitId: command.unitId,
        count: command.count,
        cost,
      })
      unitExpenditures[command.unitId] += cost
    }
    recordAudit()
    return result
  }

  let frozenCommands = 0
  while (!state.isGameOver && state.deadline <= maxDeadlines) {
    if (state.phase === 'ACTIVE_CYCLE') {
      for (const command of strategy.governActive(state, ctx)) send(command)
      tick(state, DECISION_INTERVAL_SECONDS, config)
      recordAudit()
      frozenCommands = 0
      continue
    }

    const command = frozenPhaseCommand(strategy, state, ctx)
    if (command === null) {
      throw new Error(`Runner: no command for phase ${state.phase}.`)
    }
    const result = send(command)
    if (!result.success) {
      throw new Error(
        `Runner: ${strategy.name} bot sent a rejected ${command.type} in ${state.phase}: ${result.error}`,
      )
    }
    frozenCommands++
    if (frozenCommands > MAX_FROZEN_COMMANDS) {
      throw new Error(`Runner: ${strategy.name} bot kept game time frozen in ${state.phase}.`)
    }
  }

  return {
    seed,
    won: state.isVictory,
    finalDeadline: state.deadline,
    defeatReason: state.defeatReason,
    totalElapsedSeconds: state.totalElapsedSeconds,
    totalAp: state.totalCumulativeAp,
    finalPopulation: state.totalPopulation,
    finalMilitary: calculateMilitaryPower(state, config),
    unitExpenditures,
    purchases,
    audits,
    journal: { seed, entries },
    finalStateHash: getStateHash(state),
  }
}
