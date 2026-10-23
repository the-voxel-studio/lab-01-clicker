/**
 * Unit tests for the single province list (provinces and provinceBiomes stay in sync).
 *
 * @module __tests__/unit/provinces.spec
 */

import { describe, it, expect } from 'vitest'
import { createInitialGameState } from '@/core/state'
import { dispatch } from '@/core/commands'
import { evaluateDeadlineAudit, calculateMaxPopulation } from '@/core/engine'
import { resolveDefensiveClash, resolveOffensiveCampaign } from '@/core/battle'
import { applyEffect } from '@/core/modifiers'
import { PRNG } from '@/core/prng'
import { DEFAULT_ENGINE_CONFIG } from '@/core/config'
import type { GameState } from '@/core/types'

function expectInSync(state: GameState): void {
  expect(state.provinces).toBe(state.provinceBiomes.length)
}

describe('One province list', () => {
  it('keeps provinces equal to provinceBiomes.length across colonise', () => {
    const state = createInitialGameState()
    state.ap = 10000
    expect(dispatch(state, { type: 'COLONISE_PROVINCE' }).success).toBe(true)
    expectInSync(state)
    expect(state.provinces).toBe(4)
  })

  it('keeps provinces equal to provinceBiomes.length across a campaign win with the target biome', () => {
    const state = createInitialGameState()
    state.units.soldier = 20
    const result = resolveOffensiveCampaign(
      state,
      200,
      10,
      'ap',
      300,
      new PRNG(123),
      DEFAULT_ENGINE_CONFIG,
      'farmlands',
    )
    expect(result.provinceWon).toBe(true)
    expectInSync(state)
    expect(state.provinceBiomes[3]).toBe('farmlands')
  })

  it('keeps provinces equal to provinceBiomes.length across a dispatched LAUNCH_ATTACK win', () => {
    const state = createInitialGameState()
    state.phase = 'EXPEDITION'
    state.units.soldier = 200
    state.currentTarget = {
      power: 1,
      uncertaintyMargin: 0,
      perceivedMin: 1,
      perceivedMax: 1,
      biome: 'trade_hub',
      lootType: 'ap',
      isFalseLedger: false,
      isAmbush: false,
    }
    dispatch(state, { type: 'LAUNCH_ATTACK' })
    expectInSync(state)
    expect(state.provinces).toBe(4)
    expect(state.provinceBiomes[3]).toBe('trade_hub')
  })

  it('keeps provinces equal to provinceBiomes.length across censure', () => {
    const state = createInitialGameState()
    state.deadline = 5
    state.strikes = 0
    state.totalPopulation = 0
    evaluateDeadlineAudit(state, DEFAULT_ENGINE_CONFIG)
    expect(state.provinces).toBe(2)
    expectInSync(state)
  })

  it('keeps provinces equal to provinceBiomes.length across Lombard', () => {
    const state = createInitialGameState()
    state.phase = 'LOMBARD_OFFER'
    state.lombardBailoutAvailable = true
    expect(dispatch(state, { type: 'ACCEPT_LOMBARD_LOAN' }).success).toBe(true)
    expectInSync(state)
    expect(state.provinces).toBe(2)
  })

  it('keeps provinces equal to provinceBiomes.length across collapse', () => {
    const state = createInitialGameState()
    resolveDefensiveClash(state, 0, 1000, 0, new PRNG(1))
    expect(state.provinces).toBe(2)
    expectInSync(state)
  })

  it('keeps provinces equal to provinceBiomes.length across the instant_resource effect', () => {
    const state = createInitialGameState()
    applyEffect({ type: 'instant_resource', resource: 'provinces', amount: 1 }, state)
    expect(state.provinces).toBe(4)
    expectInSync(state)
    expect(state.provinceBiomes[3]).toBe('heartland')

    applyEffect({ type: 'instant_resource', resource: 'provinces', amount: -2 }, state)
    expect(state.provinces).toBe(2)
    expectInSync(state)

    applyEffect({ type: 'instant_resource', resource: 'provinces', amount: -10 }, state)
    expect(state.provinces).toBe(1)
    expectInSync(state)
  })

  it('truncates a fractional instant_resource amount toward zero', () => {
    const state = createInitialGameState()
    applyEffect({ type: 'instant_resource', resource: 'provinces', amount: 1.5 }, state)
    expect(state.provinces).toBe(4)
    expectInSync(state)

    applyEffect({ type: 'instant_resource', resource: 'provinces', amount: -1.5 }, state)
    expect(state.provinces).toBe(3)
    expectInSync(state)
  })

  it('gives zero housing at zero provinces', () => {
    const state = createInitialGameState()
    state.provinceBiomes = []
    state.provinces = 0
    expect(calculateMaxPopulation(state)).toBe(0)
  })

  it('sums housing per province', () => {
    const state = createInitialGameState()
    state.provinceBiomes = ['heartland', 'farmlands', 'wilderness']
    state.provinces = 3
    expect(calculateMaxPopulation(state)).toBe(250 + 375 + 200)
  })
})
