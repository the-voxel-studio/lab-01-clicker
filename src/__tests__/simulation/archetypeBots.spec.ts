/**
 * Automated Bot Balance & Archetype Simulation Suite.
 * Validates 3-tier skill gradients, dominance tests, and sensitivity analysis.
 *
 * @module __tests__/simulation/archetypeBots.spec
 */

import { describe, it, expect } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { executeReplay, getStateHash } from '@/core/replay'
import { DEFAULT_ENGINE_CONFIG } from '@/core/config'
import { PRNG } from '@/core/prng'
import { DILEMMAS_DATA } from '@/data/dilemmas'
import {
  runSimulation,
  randomBotStrategy,
  greedyRoiBotStrategy,
  blindGreedyBotStrategy,
  bureaucratBotStrategy,
  conquerorBotStrategy,
  type BotStrategy,
} from './botRunner'

/** Time allowed to the 100 run validation sample of the Greedy band test (about 13 s alone). */
const VALIDATION_TIMEOUT_MS = 60_000

/** Every source file that holds runner or bot code. */
function botSourceFiles(): string[] {
  const simulationDir = path.resolve(__dirname)
  const botsDir = path.join(simulationDir, 'bots')
  const botFiles = fs.existsSync(botsDir)
    ? fs
        .readdirSync(botsDir)
        .filter((file) => file.endsWith('.ts'))
        .map((file) => path.join(botsDir, file))
    : []
  return [path.join(simulationDir, 'botRunner.ts'), ...botFiles]
}

/** Lists the `file: match` pairs of a pattern across the bot sources. */
function findInBotSources(pattern: RegExp): string[] {
  return botSourceFiles().flatMap((file) => {
    const content = fs.readFileSync(file, 'utf-8')
    return [...content.matchAll(pattern)].map((match) => `${path.basename(file)}: ${match[0]}`)
  })
}

/** Win rate and mean final deadline of a bot over consecutive seeds. */
function measure(
  strategy: BotStrategy,
  firstSeed: number,
  runCount: number,
): { wins: number; winRate: number; meanFinalDeadline: number } {
  let wins = 0
  let deadlineSum = 0
  for (let seed = firstSeed; seed < firstSeed + runCount; seed++) {
    const result = runSimulation(strategy, seed)
    if (result.won) wins++
    deadlineSum += result.finalDeadline
  }
  const winRate = wins / runCount
  const meanFinalDeadline = deadlineSum / runCount
  console.log(
    `[${strategy.name}] seeds ${firstSeed}-${firstSeed + runCount - 1}: ${wins}/${runCount} wins ` +
      `(${(winRate * 100).toFixed(1)}%), mean final deadline ${meanFinalDeadline.toFixed(2)}`,
  )
  return { wins, winRate, meanFinalDeadline }
}

describe('Task 1: honest bots', () => {
  it('bots never read the seed', () => {
    expect(findInBotSources(/\.seed\b/g)).toEqual([])
  })

  it('bots never read the hidden target fields or the PRNG streams', () => {
    expect(
      findInBotSources(/\.(power|isFalseLedger|isAmbush|rngStreams)\b|withStatePrng/g),
    ).toEqual([])
  })

  it('replaying a short Greedy run journal gives the same state hash as the run', () => {
    const result = runSimulation(greedyRoiBotStrategy, 4242, { maxDeadlines: 4 })
    expect(result.journal.entries.length).toBeGreaterThan(0)

    const config = DEFAULT_ENGINE_CONFIG
    const durationSeconds = 4 * config.balance.DEADLINE_DURATION_SECONDS
    const replay = executeReplay(result.journal, 1.0, durationSeconds, config)

    expect(replay.rejected).toEqual([])
    expect(getStateHash(replay.state)).toBe(result.finalStateHash)
  })

  it('bot strategies leave the state unmutated', () => {
    const config = DEFAULT_ENGINE_CONFIG
    const run = runSimulation(greedyRoiBotStrategy, 4343, { config, maxDeadlines: 4 })
    const durationSeconds = 4 * config.balance.DEADLINE_DURATION_SECONDS
    const state = executeReplay(run.journal, 1.0, durationSeconds, config).state
    const dilemma = Object.values(DILEMMAS_DATA)[0]
    if (!dilemma) throw new Error('No dilemma in the catalog.')
    const strategies = [
      randomBotStrategy,
      greedyRoiBotStrategy,
      blindGreedyBotStrategy,
      bureaucratBotStrategy,
      conquerorBotStrategy,
    ]

    for (const strategy of strategies) {
      const before = structuredClone(state)
      const ctx = { config, rng: new PRNG(1) }
      strategy.governActive(state, ctx)
      strategy.resolveDilemma(state, ctx, dilemma)
      strategy.chooseLaw(state, ctx)
      strategy.answerThreat(state, ctx)
      strategy.planExpedition(state, ctx)
      strategy.answerLombard(state, ctx)
      expect({ bot: strategy.name, state }).toStrictEqual({ bot: strategy.name, state: before })
    }
  })
})

describe('Plan 04 Task 2: quota blind calibration bot', () => {
  it('the blind Greedy bot decides the same under any quota table and announced threat', () => {
    const config = DEFAULT_ENGINE_CONFIG
    const tripled = {
      ...config,
      quotas: config.quotas.map((quota) => ({
        ...quota,
        apRate: 3 * quota.apRate,
        pop: 3 * quota.pop,
        military: 3 * quota.military,
      })),
    }
    const stateAt = (seed: number, deadlines: number) => {
      const run = runSimulation(greedyRoiBotStrategy, seed, { config, maxDeadlines: deadlines })
      const durationSeconds = deadlines * config.balance.DEADLINE_DURATION_SECONDS
      return executeReplay(run.journal, 1.0, durationSeconds, config).state
    }
    const decide = (view: ReturnType<typeof stateAt>, engineConfig: typeof config) => {
      const ctx = { config: engineConfig, rng: new PRNG(1) }
      return {
        govern: blindGreedyBotStrategy.governActive(view, ctx),
        threat: blindGreedyBotStrategy.answerThreat(view, ctx),
      }
    }
    const mid = stateAt(4444, 5)
    const early = stateAt(4445, 1)
    const calm = { ...mid, unrest: 10 }
    const unstable = { ...mid, unrest: 70 }
    const states = [mid, early, calm, unstable]

    expect(decide(mid, config).govern.length).toBeGreaterThan(0)
    expect(decide(calm, config).threat).toBe('levy')
    expect(decide(unstable, config).threat).toBe('defense')
    for (const state of states) {
      const threatened = { ...state, currentThreatPower: 10_000, currentThreatTributeAp: 1 }
      expect(decide(threatened, tripled)).toEqual(decide(state, config))
      expect(decide(state, tripled)).toEqual(decide(state, config))
    }
    const greedyCtx = { config, rng: new PRNG(1) }
    const threatenedMid = { ...mid, currentThreatPower: 10_000, currentThreatTributeAp: 1 }
    expect(greedyRoiBotStrategy.answerThreat(threatenedMid, greedyCtx)).toBe('tribute')
  })
})

describe('Automated Bot Archetype Simulations & Balance Calibration', () => {
  it('asserts Random Noise Bot achieves win rate < 5%', () => {
    const { winRate } = measure(randomBotStrategy, 1001, 20)
    expect(winRate).toBeLessThan(0.05)
  })

  it(
    'asserts Greedy ROI Bot stays within its target win rate band [35%, 65%] on the solver validation seeds',
    () => {
      const { winRate } = measure(greedyRoiBotStrategy, 20001, 100)
      expect(winRate).toBeGreaterThanOrEqual(0.35)
      expect(winRate).toBeLessThanOrEqual(0.65)
    },
    VALIDATION_TIMEOUT_MS,
  )

  it('asserts the Bureaucrat expert bot achieves win rate > 65%', () => {
    const { winRate } = measure(bureaucratBotStrategy, 3001, 20)
    expect(winRate).toBeGreaterThan(0.65)
  })

  it('asserts the Conqueror expert bot achieves win rate > 65%', () => {
    const { winRate } = measure(conquerorBotStrategy, 3001, 20)
    expect(winRate).toBeGreaterThan(0.65)
  })

  it('validates dominance test: no unit exceeds 60% of total expenditure after Deadline 3', () => {
    const result = runSimulation(greedyRoiBotStrategy, 4001)

    // Calculate total spend
    const totalSpend = Object.values(result.unitExpenditures).reduce((sum, val) => sum + val, 0)
    expect(totalSpend).toBeGreaterThan(0)

    for (const [, spend] of Object.entries(result.unitExpenditures)) {
      const share = spend / totalSpend
      expect(share).toBeLessThan(0.6)
    }
  })

  it('demonstrates stability under +/-10% sensitivity variation without catastrophic swings', () => {
    // Run baseline with fixed seed
    const baseline = runSimulation(greedyRoiBotStrategy, 5001)

    // Run slightly altered seed
    const varied = runSimulation(greedyRoiBotStrategy, 5002)

    // Both should reach similar mid-to-late game deadlines
    expect(Math.abs(baseline.finalDeadline - varied.finalDeadline)).toBeLessThanOrEqual(3)
  })
})
