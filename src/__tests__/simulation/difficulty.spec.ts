/**
 * Plan V2_DIFFICULTY, Task 2: each level wins about as often as its target with the Greedy ROI bot,
 * whose 18 wins in 30 at the ordinary level match the fast human pace measured on 2026-10-31.
 *
 * @module __tests__/simulation/difficulty.spec
 */

import { describe, expect, it } from 'vitest'
import { DIFFICULTY_LEVELS, type DifficultyLevel } from '@/data/levels'
import { configForLevel } from '@/ui/levelConfig'
import { greedyRoiBotStrategy, runSimulation } from './botRunner'

/** 30 runs take a few seconds alone, more when the whole suite runs in parallel. */
const LEVEL_TIMEOUT_MS = 60_000

const SEEDS = Array.from({ length: 30 }, (_, index) => index + 1)

/** Victories out of 30 each level must reach: about 60%, 35% and 15%. */
const TARGETS: Record<DifficultyLevel, readonly [number, number]> = {
  ordinary: [15, 21],
  stern: [8, 13],
  tyrannical: [2, 7],
}

function victories(level: DifficultyLevel): { wins: number; deaths: Record<number, number> } {
  const config = configForLevel(level)
  const deaths: Record<number, number> = {}
  let wins = 0
  for (const seed of SEEDS) {
    const run = runSimulation(greedyRoiBotStrategy, seed, { config })
    if (run.won) wins += 1
    else deaths[run.finalDeadline] = (deaths[run.finalDeadline] ?? 0) + 1
  }
  return { wins, deaths }
}

describe('Task 2: level calibration with the Greedy ROI bot', () => {
  it.each(DIFFICULTY_LEVELS)(
    'wins %s about as often as its target',
    (level) => {
      const { wins, deaths } = victories(level)
      console.info(`${level}: ${wins}/30 wins, deaths by audit ${JSON.stringify(deaths)}`)
      const [low, high] = TARGETS[level]
      expect(wins).toBeGreaterThanOrEqual(low)
      expect(wins).toBeLessThanOrEqual(high)
    },
    LEVEL_TIMEOUT_MS,
  )
})
