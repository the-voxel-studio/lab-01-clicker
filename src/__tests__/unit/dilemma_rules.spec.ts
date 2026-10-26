/**
 * Plan 04 Task 5b: two dilemmas follow GAME_RULES (§9 items 3 and 12).
 *
 * @module __tests__/unit/dilemma_rules.spec
 */

import { describe, it, expect } from 'vitest'
import { createInitialGameState } from '@/core/state'
import type { GameState } from '@/core/types'
import { DEFAULT_ENGINE_CONFIG } from '@/core/config'
import { dispatch } from '@/core/commands'
import { calculateGrossApRate, calculateUpkeep, tick } from '@/core/engine'
import { dilemmaOf } from './catalog_lookup'

const config = DEFAULT_ENGINE_CONFIG
const MEN_AT_ARMS = 10

/** A realm with `scribes` scribes (income, no upkeep) and ten men at arms (military upkeep only). */
function realmWithScribes(scribes: number): GameState {
  const state = createInitialGameState({ seed: 1 })
  state.units.scribe = scribes
  state.units.man_at_arms = MEN_AT_ARMS
  return state
}

/** Military upkeep over gross income, as the engine computes both (scribes pay no upkeep). */
function upkeepShare(state: GameState): number {
  return calculateUpkeep(state, config) / calculateGrossApRate(state, config).total
}

function resolve(state: GameState, dilemmaId: string, choiceIndex: number): void {
  state.phase = 'COUNCIL_DILEMMA'
  state.currentDilemmaId = dilemmaId
  const res = dispatch(state, { type: 'RESOLVE_DILEMMA', dilemmaId, choiceIndex }, config)
  expect(res.success).toBe(true)
}

describe('Plan 04 Task 5b: dilemmas follow GAME_RULES', () => {
  describe('The Princely Cousin', () => {
    const line = config.balance.PRINCELY_COUSIN_UPKEEP_SHARE
    const cousin = dilemmaOf('dilemma:princely_cousin')

    /** Largest scribe count searched for the line crossing. */
    const MAX_SCRIBES = 10_000

    /** Smallest scribe count whose income pushes the upkeep share to the line or below. */
    function firstScribeCountAtOrBelowLine(): number {
      for (let scribes = 1; scribes <= MAX_SCRIBES; scribes++) {
        if (upkeepShare(realmWithScribes(scribes)) <= line) return scribes
      }
      throw new Error(`The upkeep share stays above the line up to ${MAX_SCRIBES} scribes.`)
    }

    it('reads the 35% line from the balance config', () => {
      expect(line).toBe(0.35)
    })

    it('fires while military upkeep is above 35% of gross income', () => {
      const scribes = firstScribeCountAtOrBelowLine() - 1
      const state = realmWithScribes(scribes)
      expect(upkeepShare(state)).toBeGreaterThan(line)
      expect(cousin.trigger(state, config)).toBe(true)
    })

    it('does not fire once military upkeep is at or below 35% of gross income', () => {
      const state = realmWithScribes(firstScribeCountAtOrBelowLine())
      expect(upkeepShare(state)).toBeLessThanOrEqual(line)
      expect(cousin.trigger(state, config)).toBe(false)
    })

    it('does not fire on a realm without military upkeep', () => {
      const unarmed = realmWithScribes(40)
      unarmed.units.man_at_arms = 0
      expect(cousin.trigger(unarmed, config)).toBe(false)
    })
  })

  describe('The Deserting Mercenaries', () => {
    const mercenaries = 'dilemma:deserting_mercenaries'

    function bankruptRealm(soldiers: number): GameState {
      const state = createInitialGameState({ seed: 1 })
      state.ap = 0
      state.units.soldier = soldiers
      tick(state, 5)
      return state
    }

    it('choice A melts reliquaries and leaves the countdown running', () => {
      const state = bankruptRealm(50)
      const timer = state.bankruptcyGraceTimer
      expect(timer).toBeLessThan(config.balance.BANKRUPTCY_GRACE_BASE_SECONDS)
      const { ap, unrest } = state
      resolve(state, mercenaries, 0)
      expect(state.ap).toBe(ap + 400)
      expect(state.unrest).toBe(unrest + 15)
      expect(state.units.soldier).toBe(50)
      expect(state.bankruptcyGraceTimer).toBe(timer)
    })

    it('choice B disbands 10 soldiers and restarts the bankruptcy countdown from its full grace', () => {
      const state = bankruptRealm(50)
      expect(state.bankruptcyGraceTimer).toBeLessThan(config.balance.BANKRUPTCY_GRACE_BASE_SECONDS)
      resolve(state, mercenaries, 1)
      expect(state.units.soldier).toBe(40)
      expect(state.bankruptcyGraceTimer).toBe(config.balance.BANKRUPTCY_GRACE_BASE_SECONDS)
    })

    it('choice B is rejected without 10 soldiers and changes nothing', () => {
      const state = bankruptRealm(4)
      state.bankruptcyGraceTimer = 7
      state.phase = 'COUNCIL_DILEMMA'
      state.currentDilemmaId = mercenaries
      const res = dispatch(
        state,
        { type: 'RESOLVE_DILEMMA', dilemmaId: mercenaries, choiceIndex: 1 },
        config,
      )
      expect(res.success).toBe(false)
      expect(state.units.soldier).toBe(4)
      expect(state.bankruptcyGraceTimer).toBe(7)
    })

    it('choice B restarts the countdown from the grace of the injected config', () => {
      const state = bankruptRealm(50)
      const custom = {
        ...config,
        balance: { ...config.balance, BANKRUPTCY_GRACE_BASE_SECONDS: 44 },
      }
      state.phase = 'COUNCIL_DILEMMA'
      state.currentDilemmaId = mercenaries
      const res = dispatch(
        state,
        { type: 'RESOLVE_DILEMMA', dilemmaId: mercenaries, choiceIndex: 1 },
        custom,
      )
      expect(res.success).toBe(true)
      expect(state.bankruptcyGraceTimer).toBe(44)
    })
  })
})
