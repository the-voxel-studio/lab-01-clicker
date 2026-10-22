/**
 * Universal Modifier & Dynamic Resolver Test Suite.
 * Validates composition priority, dynamic resolver contracts, and tick caching.
 *
 * @module __tests__/unit/modifiers.spec
 */

import { describe, it, expect } from 'vitest'
import { composeStat, applyEffect, type RawEvaluationState } from '@/core/modifiers'
import { createInitialGameState } from '@/core/state'
import type { Modifier } from '@/core/types'
import { dispatch } from '@/core/commands'
import { tick } from '@/core/engine'
import { LAWS_DATA } from '@/data/laws'
import { DILEMMAS_DATA } from '@/data/dilemmas'

describe('Universal Modifier Engine & Dynamic Resolvers (Gate A & D)', () => {
  it('composes stats strictly in arithmetic priority: add -> addPct -> mul -> set', () => {
    const baseValue = 10

    const modifiers: Modifier[] = [
      { source: 'law:a', stat: 'gross_ap_rate', op: 'add', value: 5 }, // 10 + 5 = 15
      { source: 'law:b', stat: 'gross_ap_rate', op: 'addPct', value: 0.2 }, // 15 * 1.2 = 18
      { source: 'law:c', stat: 'gross_ap_rate', op: 'mul', value: 2 }, // 18 * 2 = 36
    ]

    expect(composeStat('gross_ap_rate', baseValue, modifiers)).toBe(36)

    // Overriding with a 'set' modifier
    const overrideMod: Modifier = { source: 'edict:d', stat: 'gross_ap_rate', op: 'set', value: 99 }
    expect(composeStat('gross_ap_rate', baseValue, [...modifiers, overrideMod])).toBe(99)
  })

  it('filters modifiers by statKey when evaluating composite lists', () => {
    const modifiers: Modifier[] = [
      { source: 'law:a', stat: 'gross_ap_rate', op: 'add', value: 10 },
      { source: 'law:b', stat: 'unrest_generation', op: 'add', value: 5 },
    ]

    expect(composeStat('gross_ap_rate', 20, modifiers)).toBe(30)
    expect(composeStat('unrest_generation', 0, modifiers)).toBe(5)
  })

  it('evaluates dynamic conditional resolvers against raw state', () => {
    const baseIncome = 100

    const isolationismMod: Modifier = {
      source: 'law:isolationism',
      stat: 'tax_efficiency',
      op: 'addPct',
      value: 0.15,
      resolverKey: 'law:isolationism',
    }

    const stateSmall: RawEvaluationState = {
      ap: 500,
      population: 200,
      freeSerfs: 100,
      provinces: 3,
      taxRate: 25,
      unrest: 10,
      units: { clergy: 4 },
      laws: ['law:isolationism'],
      currentDeadline: 1,
    }

    // <= 3 provinces -> active (+15%)
    expect(composeStat('tax_efficiency', baseIncome, [isolationismMod], stateSmall)).toBeCloseTo(
      115,
    )

    // > 3 provinces -> inactive
    const stateExpanded: RawEvaluationState = { ...stateSmall, provinces: 4 }
    expect(composeStat('tax_efficiency', baseIncome, [isolationismMod], stateExpanded)).toBe(100)

    // Without state passed -> gracefully bypassed
    expect(composeStat('tax_efficiency', baseIncome, [isolationismMod])).toBe(100)

    // Scaling resolver: provincial tithe (+2 AP/s per province)
    const titheMod: Modifier = {
      source: 'law:provincial_tithe',
      stat: 'gross_ap_rate',
      op: 'add',
      value: 2.0,
      resolverKey: 'law:provincial_tithe',
    }
    expect(composeStat('gross_ap_rate', 10, [titheMod], stateExpanded)).toBe(10 + 4 * 2.0)

    // Monastic scriptoria: scales with clergy
    const monasticMod: Modifier = {
      source: 'law:monastic_scriptoria',
      stat: 'gross_ap_rate',
      op: 'add',
      value: 1.5,
      resolverKey: 'law:monastic_scriptoria',
    }
    expect(composeStat('gross_ap_rate', 0, [monasticMod], stateSmall)).toBe(4 * 1.5)
  })

  it('applies effect taxonomy completely (stat_modifier, instant_resource, grant_units)', () => {
    const state = createInitialGameState()

    // Instant resource: AP
    applyEffect({ type: 'instant_resource', resource: 'ap', amount: 300 }, state)
    expect(state.ap).toBe(350)
    expect(state.cumulativeApThisDeadline).toBe(0)

    // Instant resource: Provinces
    applyEffect({ type: 'instant_resource', resource: 'provinces', amount: 2 }, state)
    expect(state.provinces).toBe(5)

    // Instant resource: Archive Points
    applyEffect({ type: 'instant_resource', resource: 'archive_points', amount: 3 }, state)
    expect(state.archivePoints).toBe(3)

    // Grant Units
    applyEffect({ type: 'grant_units', unitId: 'man_at_arms', count: 15 }, state)
    expect(state.units.man_at_arms).toBe(15)

    // Stat Modifier
    const mod: Modifier = { source: 'law:test', stat: 'gross_ap_rate', op: 'add', value: 10 }
    applyEffect({ type: 'stat_modifier', modifier: mod }, state)
    expect(state.activeModifiers).toHaveLength(1)
    expect(state.activeModifiers[0]?.source).toBe('law:test')
  })

  it('clones catalog modifiers on apply', () => {
    const state = createInitialGameState()
    state.phase = 'COUNCIL_LAWS'
    state.currentLawDraft = ['law:royal_scriptorium']
    const res = dispatch(state, { type: 'ENACT_LAW', lawId: 'law:royal_scriptorium' })
    expect(res.success).toBe(true)
    const template = LAWS_DATA['law:royal_scriptorium']!.effects[0]
    if (template?.type !== 'stat_modifier') throw new Error('expected a stat_modifier template')
    const clone = state.activeModifiers[0]
    expect(clone).not.toBe(template.modifier)
    expect(template.modifier.appliedAt).toBeUndefined()
    expect(clone).toBeDefined()
    if (clone === undefined) throw new Error('expected an applied modifier')
    expect('expiresAt' in clone).toBe(false)
    expect('durationSeconds' in clone).toBe(false)
  })

  it('stamps expiresAt = totalElapsedSeconds + durationSeconds on a 30 s modifier', () => {
    const state = createInitialGameState()
    state.totalElapsedSeconds = 200
    applyEffect(
      {
        type: 'stat_modifier',
        modifier: {
          source: 'dilemma:test',
          stat: 'gross_ap_rate',
          op: 'mul',
          value: 0.85,
          durationSeconds: 30,
        },
      },
      state,
    )
    expect(state.activeModifiers[0]?.expiresAt).toBe(230)
    expect(state.activeModifiers[0]?.appliedAt).toBe(200)
  })

  it('keeps a 30 s dilemma modifier for 30 s of active time', () => {
    const state = createInitialGameState()
    state.totalElapsedSeconds = 200
    state.phase = 'COUNCIL_DILEMMA'
    state.currentDilemmaId = 'dilemma:crowns_forced_loan'
    state.ap = 10000
    const choices = DILEMMAS_DATA['dilemma:crowns_forced_loan']!.choices
    const choiceIndex = choices.findIndex((c) =>
      c.effects.some((e) => e.type === 'stat_modifier' && e.modifier.durationSeconds === 30),
    )
    expect(choiceIndex).toBeGreaterThanOrEqual(0)
    const res = dispatch(state, {
      type: 'RESOLVE_DILEMMA',
      dilemmaId: 'dilemma:crowns_forced_loan',
      choiceIndex,
    })
    expect(res.success).toBe(true)
    state.phase = 'ACTIVE_CYCLE'
    const has = () => state.activeModifiers.some((m) => m.source === 'dilemma:crowns_forced_loan')
    for (let i = 0; i < 299; i++) tick(state, 0.1)
    expect(has()).toBe(true)
    tick(state, 0.1)
    tick(state, 0.1)
    expect(has()).toBe(false)
  })

  it('keeps the 30 s salt boycott modifier (tax_efficiency addPct -0.25) for 30 s of active time', () => {
    const state = createInitialGameState()
    state.totalElapsedSeconds = 200
    state.phase = 'COUNCIL_DILEMMA'
    state.currentDilemmaId = 'dilemma:peasant_salt_boycott'
    state.ap = 10000
    const choices = DILEMMAS_DATA['dilemma:peasant_salt_boycott']!.choices
    const choiceIndex = choices.findIndex((c) =>
      c.effects.some((e) => e.type === 'stat_modifier' && e.modifier.durationSeconds === 30),
    )
    expect(choiceIndex).toBeGreaterThanOrEqual(0)
    const res = dispatch(state, {
      type: 'RESOLVE_DILEMMA',
      dilemmaId: 'dilemma:peasant_salt_boycott',
      choiceIndex,
    })
    expect(res.success).toBe(true)
    state.phase = 'ACTIVE_CYCLE'
    const has = () => state.activeModifiers.some((m) => m.source === 'dilemma:peasant_salt_boycott')
    for (let i = 0; i < 299; i++) tick(state, 0.1)
    expect(has()).toBe(true)
    tick(state, 0.1)
    tick(state, 0.1)
    expect(has()).toBe(false)
  })
})
