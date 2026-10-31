/**
 * Plan V2_NUMBERS_EVERYWHERE Task 4: the war panel.
 *
 * @module __tests__/unit/ui_war.spec
 */

import { describe, expect, it } from 'vitest'
import { resolveOffensiveCampaign } from '@/core/battle'
import { DEFAULT_ENGINE_CONFIG as config } from '@/core/config'
import { PRNG } from '@/core/prng'
import { createInitialGameState } from '@/core/state'
import type { CampaignTarget, GameState } from '@/core/types'
import { warForecast, warOdds } from '@/ui/war'

const TARGET: CampaignTarget = {
  power: 100,
  uncertaintyMargin: 0.2,
  perceivedMin: 80,
  perceivedMax: 120,
  biome: 'farmlands',
  lootType: 'ap',
  factionId: 'outlaws',
  isFalseLedger: false,
  isAmbush: false,
}

function atWar(soldiers: number): GameState {
  const state = createInitialGameState({ seed: 8 })
  state.phase = 'ACTIVE_CYCLE'
  state.deadline = 3
  state.units.soldier = soldiers
  state.totalPopulation += soldiers
  state.currentTarget = { ...TARGET }
  return state
}

describe('Task 4: the war panel', () => {
  it('reads certainty at both ends', () => {
    expect(warOdds(1000, 80, 120, config).chance).toBe(1)
    const hopeless = warOdds(10, 80, 120, config)
    expect(hopeless.chance).toBe(0)
    expect(hopeless.lossOnLoss[1]).toBeCloseTo(1)
  })

  it('agrees with real campaigns on seeded rolls', () => {
    const odds = warOdds(150, 80, 120, config)
    let taken = 0
    const fights = 2000
    const prng = new PRNG(11)
    for (let fight = 0; fight < fights; fight++) {
      const state = atWar(1)
      const power = 80 + prng.next() * 40
      const result = resolveOffensiveCampaign(state, 150, power, 'ap', 0, prng, config, 'farmlands')
      if (result.provinceWon) taken++
    }
    expect(Math.abs(taken / fights - odds.chance)).toBeLessThan(0.05)
  })

  it('counts the public chance of an ambush', () => {
    const plain = warOdds(150, 80, 120, config)
    const wary = warOdds(150, 80, 120, config, undefined, { chance: 0.5, power: 150 })
    expect(wary.chance).toBeLessThan(plain.chance)
    expect(wary.chance).toBeCloseTo(plain.chance * 0.5, 1)
  })

  it('says a defeat is not expected rather than a false range', () => {
    const state = atWar(2000)
    expect(warForecast(state)?.lossOnLoss).toBe('Not expected')
  })

  it('never reads the truth of the target', () => {
    const honest = warForecast(atWar(150))
    const state = atWar(150)
    state.currentTarget = { ...TARGET, power: 1, isAmbush: true, isFalseLedger: true }
    expect(warForecast(state)?.chance).toBe(honest?.chance)
  })

  it('shows the quotas a conquest would raise', () => {
    const free = warForecast(atWar(150))!
    expect(free.quotasAfter).toEqual(free.quotasBefore)
    const state = atWar(150)
    state.conquestsThisAudit = 1
    const paid = warForecast(state)!
    expect(paid.quotasAfter.pop).toBeCloseTo(
      paid.quotasBefore.pop * (1 + config.balance.CONQUEST_SURCHARGE_STEP),
    )
  })

  it('shows the real effect of the land and its losses as a range', () => {
    const forecast = warForecast(atWar(150))!
    expect(forecast.land).toContain('Arable Plains')
    expect(forecast.land).toMatch(/\+50% room/)
    expect(forecast.lossOnWin).toMatch(/^−\d+ to −\d+ soldiers$/)
  })

  it('refuses an army of nobody in words', () => {
    const forecast = warForecast(atWar(0))!
    expect(forecast.blocked).toBe('You have no army')
    expect(forecast.chance).toBe(0)
  })

  it('has nothing to show without a target', () => {
    const state = atWar(50)
    state.currentTarget = null
    expect(warForecast(state)).toBeNull()
  })
})
