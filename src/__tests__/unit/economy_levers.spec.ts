/**
 * Unit scoped economy levers: upkeep, recruit cost and output modifiers of laws and dilemmas.
 *
 * @module __tests__/unit/economy_levers.spec
 */

import { describe, it, expect } from 'vitest'
import { createInitialGameState } from '@/core/state'
import { applyEffect, composeStat, composeUnitStat } from '@/core/modifiers'
import {
  calculateGrossApRate,
  calculateNetApRate,
  calculateNetPaperwork,
  calculateUpkeep,
  tick,
} from '@/core/engine'
import {
  calculateMaxAffordableUnits,
  calculatePaperworkFriction,
  calculateUnitCost,
} from '@/core/formulas'
import { dispatch } from '@/core/commands'
import { PRNG } from '@/core/prng'
import {
  CURRENT_SCHEMA_VERSION,
  SAVE_PREFIX,
  exportSaveToBase64,
  importSaveFromBase64,
} from '@/core/migrations'
import { createArchiveData } from '@/core/archives'
import { DEFAULT_ENGINE_CONFIG } from '@/core/config'
import { UNITS_DATA } from '@/data/balance'
import { LAWS_DATA } from '@/data/laws'
import { DILEMMAS_DATA } from '@/data/dilemmas'
import type { Effect, GameState, Modifier, UnitId } from '@/core/types'

function firstClickDraw(seed: number): number {
  return new PRNG(createInitialGameState({ seed }).rngStreams.click).next()
}

function findSeed(min: number, max: number): number {
  for (let seed = 1; seed < 100000; seed++) {
    const draw = firstClickDraw(seed)
    if (draw >= min && draw < max) return seed
  }
  throw new Error(`no seed with a first click draw in [${min}, ${max})`)
}

function stampIsCritical(seed: number, lawId?: string): boolean {
  const state = createInitialGameState({ seed })
  if (lawId !== undefined) enact(state, lawId)
  const result = dispatch(state, { type: 'STAMP_DOCUMENT' })
  if (!result.success) throw new Error(result.error)
  return result.events?.some((event) => event.startsWith('CRITICAL STAMP')) ?? false
}

const config = DEFAULT_ENGINE_CONFIG

function stateWith(units: Partial<Record<UnitId, number>>, provinces = 3): GameState {
  const state = createInitialGameState()
  state.freeSerfs = 0
  state.totalPopulation = 0
  for (const def of Object.values(UNITS_DATA)) {
    const count = units[def.id] ?? 0
    state.units[def.id] = count
    state.totalPopulation += count
  }
  state.provinces = provinces
  state.provinceBiomes = Array.from({ length: provinces }, () => 'heartland' as const)
  return state
}

function applyModifiers(state: GameState, effects: readonly Effect[]): void {
  for (const effect of effects) {
    if (effect.type === 'stat_modifier' || effect.type === 'rule_flag') {
      applyEffect(effect, state)
    }
  }
}

function enact(state: GameState, lawId: string): void {
  const law = LAWS_DATA[lawId]
  if (!law) throw new Error(`unknown law ${lawId}`)
  applyModifiers(state, law.effects)
}

function choose(state: GameState, dilemmaId: string, choiceIndex: 0 | 1): void {
  const dilemma = DILEMMAS_DATA[dilemmaId]
  if (!dilemma) throw new Error(`unknown dilemma ${dilemmaId}`)
  applyModifiers(state, dilemma.choices[choiceIndex].effects)
}

function grossWithoutPollTax(state: GameState): number {
  const { total, pollTax } = calculateGrossApRate(state, config)
  return total - pollTax
}

function cost(state: GameState, unitId: UnitId): number {
  return calculateUnitCost(unitId, 0, 1, config, state.activeModifiers)
}

describe('Task 2: unit scoped economy levers', () => {
  describe('composeUnitStat', () => {
    const scribe = UNITS_DATA.scribe

    it('ignores a modifier without scope', () => {
      const mods: Modifier[] = [{ source: 'x', stat: 'unit_output', op: 'mul', value: 2 }]
      expect(composeUnitStat('unit_output', 0.5, scribe, mods)).toBe(0.5)
    })

    it('applies a modifier only when every scope field matches the unit', () => {
      const mods: Modifier[] = [
        { source: 'a', stat: 'unit_output', op: 'mul', value: 2, scope: { order: 'admin' } },
        {
          source: 'b',
          stat: 'unit_output',
          op: 'mul',
          value: 3,
          scope: { order: 'admin', tier: 2 },
        },
        { source: 'c', stat: 'unit_output', op: 'mul', value: 5, scope: { unitId: 'clerk' } },
        { source: 'd', stat: 'unit_upkeep', op: 'mul', value: 7, scope: { unitId: 'scribe' } },
      ]
      expect(composeUnitStat('unit_output', 0.5, scribe, mods)).toBe(1)
    })

    it('clamps the result at 0', () => {
      const mods: Modifier[] = [
        { source: 'a', stat: 'unit_upkeep', op: 'add', value: -3, scope: { unitId: 'scribe' } },
      ]
      expect(composeUnitStat('unit_upkeep', 1, scribe, mods)).toBe(0)
    })

    it('composes stacked modifiers in the order add, addPct, mul, set', () => {
      const mods: Modifier[] = [
        { source: 'm', stat: 'unit_upkeep', op: 'mul', value: 2, scope: { order: 'admin' } },
        { source: 'p', stat: 'unit_upkeep', op: 'addPct', value: 0.5, scope: { order: 'admin' } },
        { source: 'a', stat: 'unit_upkeep', op: 'add', value: 1, scope: { order: 'admin' } },
      ]
      expect(composeUnitStat('unit_upkeep', 1, scribe, mods)).toBe(6)
    })
  })

  describe('chancellor laws', () => {
    it('royal_scriptorium raises scribe output by 50%', () => {
      const state = stateWith({ scribe: 10 })
      expect(grossWithoutPollTax(state)).toBe(5)
      enact(state, 'law:royal_scriptorium')
      expect(grossWithoutPollTax(state)).toBe(7.5)
    })

    it('general_cadastre adds 2 AP/s of upkeep per province', () => {
      const state = stateWith({ prelate: 10 }, 3)
      const before = calculateUpkeep(state, config)
      enact(state, 'law:general_cadastre')
      expect(calculateUpkeep(state, config) - before).toBe(6)
    })

    it('single_window_bureaucracy doubles archivist reduction', () => {
      const state = stateWith({ archivist: 10 })
      expect(calculateNetPaperwork(state, config)).toBeCloseTo(
        calculatePaperworkFriction(state.units, 3, 0.15, config),
        12,
      )
      enact(state, 'law:single_window_bureaucracy')
      expect(calculateNetPaperwork(state, config)).toBeCloseTo(
        calculatePaperworkFriction(state.units, 3, 0.3, config),
        12,
      )
    })

    it('single_window_bureaucracy halves supervisor output', () => {
      const state = stateWith({ scribe: 10, supervisor: 10 })
      expect(grossWithoutPollTax(state)).toBeCloseTo(6, 12)
      enact(state, 'law:single_window_bureaucracy')
      expect(grossWithoutPollTax(state)).toBeCloseTo(5.5, 12)
    })

    it('crown_monopolies raises tier 1 recruit cost by 25%', () => {
      const state = stateWith({})
      const scribeBase = cost(state, 'scribe')
      const clerkBase = cost(state, 'clerk')
      enact(state, 'law:crown_monopolies')
      expect(cost(state, 'scribe')).toBe(Math.round(scribeBase * 1.25 * 100) / 100)
      expect(cost(state, 'clerk')).toBe(clerkBase)
    })

    it('crown_monopolies lowers the Buy Max count to what the raised cost allows', () => {
      const state = stateWith({})
      expect(calculateMaxAffordableUnits('scribe', 0, 200, 100, 100)).toBe(9)
      enact(state, 'law:crown_monopolies')
      const count = calculateMaxAffordableUnits(
        'scribe',
        0,
        200,
        100,
        100,
        undefined,
        config,
        state.activeModifiers,
      )
      expect(count).toBe(8)
      expect(
        calculateUnitCost('scribe', 0, count, config, state.activeModifiers),
      ).toBeLessThanOrEqual(200)
      expect(
        calculateUnitCost('scribe', 0, count + 1, config, state.activeModifiers),
      ).toBeGreaterThan(200)
    })

    it('a zero recruit cost lets Buy Max hire up to the serf, headroom and bulk limits', () => {
      const free: Modifier[] = [
        { source: 'test', stat: 'recruit_cost', op: 'set', value: 0, scope: { unitId: 'scribe' } },
      ]
      expect(calculateMaxAffordableUnits('scribe', 0, 1, 40, 30, 25, config, free)).toBe(25)
      expect(calculateMaxAffordableUnits('scribe', 0, 1, 40, 30, undefined, config, free)).toBe(30)
      expect(calculateMaxAffordableUnits('scribe', 0, 1, 12.5, 30, undefined, config, free)).toBe(
        12,
      )
      expect(calculateMaxAffordableUnits('scribe', 0, 1, 40, 30, 25, config)).toBe(0)
    })

    it('chancery_red_tape extends the bankruptcy grace timer to 50 s', () => {
      const plain = stateWith({})
      plain.ap = 100
      tick(plain, 0.05, config)
      expect(plain.bankruptcyGraceTimer).toBe(30)

      const state = stateWith({})
      state.ap = 100
      enact(state, 'law:chancery_red_tape')
      tick(state, 0.05, config)
      expect(state.bankruptcyGraceTimer).toBe(50)
    })

    it('auditors_inquisition doubles audit chamber reduction', () => {
      const state = stateWith({ audit_chamber: 2 })
      expect(calculateNetPaperwork(state, config)).toBeCloseTo(
        calculatePaperworkFriction(state.units, 3, 0.13, config),
        12,
      )
      enact(state, 'law:auditors_inquisition')
      expect(calculateNetPaperwork(state, config)).toBeCloseTo(
        calculatePaperworkFriction(state.units, 3, 0.26, config),
        12,
      )
    })
  })

  describe('prelate laws', () => {
    it('tithe_commutation sets clergy and prelate upkeep to 0', () => {
      const state = stateWith({ prelate: 10, clergy: 10, farmer: 10 })
      expect(calculateUpkeep(state, config)).toBe(6)
      enact(state, 'law:tithe_commutation')
      expect(calculateUpkeep(state, config)).toBe(1)
    })

    it('sumptuary_edicts lowers people and admin upkeep by 15%', () => {
      const state = stateWith({ prelate: 10, clerk: 10, soldier: 10 })
      expect(calculateUpkeep(state, config)).toBe(13)
      enact(state, 'law:sumptuary_edicts')
      expect(calculateUpkeep(state, config)).toBeCloseTo(11.5, 12)
    })

    it('sumptuary_edicts halves the click critical chance', () => {
      const state = stateWith({})
      const base = config.balance.CLICK_CRITICAL_CHANCE
      expect(composeStat('click_critical_chance', base, state.activeModifiers)).toBe(0.05)
      enact(state, 'law:sumptuary_edicts')
      expect(composeStat('click_critical_chance', base, state.activeModifiers)).toBe(0.025)
    })

    it('sumptuary_edicts halves the critical chance used by a stamp', () => {
      const betweenHalfAndFull = findSeed(0.025, 0.05)
      const justBelowHalf = findSeed(0.024, 0.025)
      const justAboveHalf = findSeed(0.025, 0.026)
      expect(stampIsCritical(betweenHalfAndFull)).toBe(true)
      expect(stampIsCritical(betweenHalfAndFull, 'law:sumptuary_edicts')).toBe(false)
      expect(stampIsCritical(justAboveHalf, 'law:sumptuary_edicts')).toBe(false)
      expect(stampIsCritical(justBelowHalf, 'law:sumptuary_edicts')).toBe(true)
    })

    it('sanctuary_rights raises military recruit cost by 30%', () => {
      const state = stateWith({})
      const soldierBase = cost(state, 'soldier')
      const scribeBase = cost(state, 'scribe')
      enact(state, 'law:sanctuary_rights')
      expect(cost(state, 'soldier')).toBe(Math.round(soldierBase * 1.3 * 100) / 100)
      expect(cost(state, 'scribe')).toBe(scribeBase)
    })

    it('upkeep never goes below 0', () => {
      const state = stateWith({ prelate: 10 })
      enact(state, 'law:tithe_commutation')
      enact(state, 'law:sumptuary_edicts')
      expect(calculateUpkeep(state, config)).toBe(0)

      const cut = stateWith({ prelate: 10 })
      cut.activeModifiers.push({
        source: 'test',
        stat: 'unit_upkeep',
        op: 'addPct',
        value: -2,
        scope: { order: 'people' },
      })
      cut.activeModifiers.push({
        source: 'test',
        stat: 'flat_upkeep',
        op: 'add',
        value: -5,
      })
      expect(calculateUpkeep(cut, config)).toBe(0)
    })

    it('recruit cost never goes below 0', () => {
      const state = stateWith({})
      state.activeModifiers.push({
        source: 'test',
        stat: 'recruit_cost',
        op: 'addPct',
        value: -2,
        scope: { tier: 1 },
      })
      expect(cost(state, 'scribe')).toBe(0)
    })
  })

  describe('marshal laws', () => {
    it('standing_garrisons raises military upkeep by 30%', () => {
      const state = stateWith({ man_at_arms: 10, prelate: 10 })
      expect(calculateUpkeep(state, config)).toBe(20)
      enact(state, 'law:standing_garrisons')
      expect(calculateUpkeep(state, config)).toBeCloseTo(24.5, 12)
    })

    it('guerrilla_border_watch raises military upkeep by 10%', () => {
      const state = stateWith({ man_at_arms: 10 })
      enact(state, 'law:guerrilla_border_watch')
      expect(calculateUpkeep(state, config)).toBeCloseTo(16.5, 12)
    })

    it('merit_pay lowers military upkeep by 30% at 3 provinces', () => {
      const state = stateWith({ man_at_arms: 10 }, 3)
      enact(state, 'law:merit_pay')
      expect(calculateUpkeep(state, config)).toBeCloseTo(10.5, 12)
    })

    it('merit_pay stops at 4 provinces', () => {
      const state = stateWith({ man_at_arms: 10 }, 4)
      enact(state, 'law:merit_pay')
      expect(calculateUpkeep(state, config)).toBe(15)
    })

    it('standing_garrisons and merit_pay stack instead of overwriting', () => {
      const state = stateWith({ man_at_arms: 10 }, 3)
      enact(state, 'law:standing_garrisons')
      enact(state, 'law:merit_pay')
      expect(calculateUpkeep(state, config)).toBeCloseTo(15, 12)
      state.provinces = 4
      expect(calculateUpkeep(state, config)).toBeCloseTo(19.5, 12)
    })

    it('military upkeep modifiers compose on top of the quartermaster discount', () => {
      const state = stateWith({ man_at_arms: 10, quartermaster: 10 })
      expect(calculateUpkeep(state, config)).toBeCloseTo(15 * 0.85, 12)
      enact(state, 'law:standing_garrisons')
      expect(calculateUpkeep(state, config)).toBeCloseTo(15 * 0.85 * 1.3, 12)
    })

    it('officer_academies raises soldier cost by 20%', () => {
      const state = stateWith({})
      const soldierBase = cost(state, 'soldier')
      const manAtArmsBase = cost(state, 'man_at_arms')
      enact(state, 'law:officer_academies')
      expect(cost(state, 'soldier')).toBe(Math.round(soldierBase * 1.2 * 100) / 100)
      expect(cost(state, 'man_at_arms')).toBe(manAtArmsBase)
    })

    it('mercenary_capitulation doubles man at arms upkeep', () => {
      const state = stateWith({ man_at_arms: 10, soldier: 10 })
      expect(calculateUpkeep(state, config)).toBe(18)
      enact(state, 'law:mercenary_capitulation')
      expect(calculateUpkeep(state, config)).toBe(33)
    })

    it('mercenary_capitulation hires men at arms without free serfs', () => {
      const state = stateWith({ soldier: 4 })
      state.ap = 1000
      state.unlockedPatents.military = true
      const before = { population: state.totalPopulation, serfs: state.freeSerfs }
      expect(
        dispatch(state, { type: 'BUY_UNIT', unitId: 'man_at_arms', count: 1 }, config).success,
      ).toBe(false)
      enact(state, 'law:mercenary_capitulation')
      const result = dispatch(state, { type: 'BUY_UNIT', unitId: 'man_at_arms', count: 1 }, config)
      expect(result.success).toBe(true)
      expect(state.units.man_at_arms).toBe(1)
      expect(state.freeSerfs).toBe(before.serfs)
      expect(state.totalPopulation).toBe(before.population + 1)
    })

    it('mercenary_capitulation still charges serfs for other units and keeps the AP check', () => {
      const state = stateWith({ soldier: 4 })
      state.ap = 1000
      state.unlockedPatents.military = true
      enact(state, 'law:mercenary_capitulation')
      expect(
        dispatch(state, { type: 'BUY_UNIT', unitId: 'soldier', count: 1 }, config).success,
      ).toBe(false)
      state.ap = 0
      const broke = dispatch(state, { type: 'BUY_UNIT', unitId: 'man_at_arms', count: 1 }, config)
      expect(broke.success).toBe(false)
    })
  })

  describe('dilemmas', () => {
    it('princely_cousin B lowers military upkeep by 10%', () => {
      const state = stateWith({ man_at_arms: 10 })
      choose(state, 'dilemma:princely_cousin', 1)
      expect(calculateUpkeep(state, config)).toBeCloseTo(13.5, 12)
    })

    it('mutinous_quartermaster B raises military upkeep by 5%', () => {
      const state = stateWith({ man_at_arms: 10 })
      choose(state, 'dilemma:mutinous_quartermaster', 1)
      expect(calculateUpkeep(state, config)).toBeCloseTo(15.75, 12)
    })

    it('ghost_scribes B raises supervisor output by 10%', () => {
      const state = stateWith({ scribe: 10, supervisor: 10 })
      choose(state, 'dilemma:ghost_scribes', 1)
      expect(grossWithoutPollTax(state)).toBeCloseTo(6.1, 12)
    })

    it('false_relic_merchant A raises prelate pacification by 5%', () => {
      const plain = stateWith({ prelate: 10 })
      plain.ap = 100
      const state = stateWith({ prelate: 10 })
      state.ap = 100
      choose(state, 'dilemma:false_relic_merchant', 0)
      tick(plain, 0.05, config)
      tick(state, 0.05, config)
      expect(plain.unrest).toBeCloseTo(10 - 1.5 * 0.05, 12)
      expect(state.unrest).toBeCloseTo(10 - 1.575 * 0.05, 12)
    })
  })

  describe('net AP rate and saves', () => {
    it('calculateNetApRate matches the net rate reported by tick', () => {
      const state = stateWith({ scribe: 10, man_at_arms: 4, prelate: 2 })
      state.ap = 100
      enact(state, 'law:standing_garrisons')
      const result = tick(state, 0.05, config)
      expect(calculateNetApRate(state, config)).toBe(result.netApPerSecond)
    })

    it('keeps a scoped law effect through export and import', () => {
      const state = stateWith({ man_at_arms: 10 }, 3)
      state.phase = 'ACTIVE_CYCLE'
      state.activeLaws = ['law:merit_pay']
      enact(state, 'law:merit_pay')
      const before = calculateUpkeep(state, config)
      const imported = importSaveFromBase64(exportSaveToBase64(state, createArchiveData())).state
      expect(imported.activeModifiers).toEqual(state.activeModifiers)
      expect(calculateUpkeep(imported, config)).toBe(before)
    })

    it('rejects a scope on a stat that is not unit scoped', () => {
      const state: Record<string, unknown> = { ...createInitialGameState() }
      state.activeModifiers = [
        { source: 'x', stat: 'gross_ap_rate', op: 'add', value: 1, scope: { order: 'admin' } },
      ]
      const encoded = `${SAVE_PREFIX}${Buffer.from(
        JSON.stringify({
          schemaVersion: CURRENT_SCHEMA_VERSION,
          timestamp: 1,
          state,
          archive: createArchiveData(),
        }),
        'utf-8',
      ).toString('base64')}`
      expect(() => importSaveFromBase64(encoded)).toThrow(
        /activeModifiers\[0\]\.scope.*unit scoped stat/,
      )
    })

    it('rejects a saved modifier with an invalid scope', () => {
      const bad: unknown[] = [{ order: 'clergy' }, { tier: 3 }, { unitId: 'dragon' }, 'military']
      for (const scope of bad) {
        const state: Record<string, unknown> = { ...createInitialGameState() }
        state.activeModifiers = [{ source: 'x', stat: 'unit_upkeep', op: 'add', value: 1, scope }]
        const encoded = `${SAVE_PREFIX}${Buffer.from(
          JSON.stringify({
            schemaVersion: CURRENT_SCHEMA_VERSION,
            timestamp: 1,
            state,
            archive: createArchiveData(),
          }),
          'utf-8',
        ).toString('base64')}`
        expect(() => importSaveFromBase64(encoded)).toThrow(/activeModifiers\[0\]\.scope/)
      }
    })

    it('renames resolver keys when importing a schema 3 save', () => {
      const state: Record<string, unknown> = { ...createInitialGameState() }
      delete state.ruleFlags
      delete state.currentThreatId
      const oldKeys = [
        ['law:isolationism', 'max_3_provinces'],
        ['law:provincial_tithe', 'per_province'],
        ['law:border_fortifications', 'per_province'],
        ['law:feudal_levy', 'per_100_free_serfs'],
        ['law:monastic_scriptoria', 'per_clergy'],
        ['perk:iron_fist', 'unrest_at_least_30'],
      ] as const
      state.activeModifiers = oldKeys.map(([resolverKey]) => ({
        source: 'law:old',
        stat: 'tax_efficiency',
        op: 'add',
        value: 1,
        resolverKey,
      }))
      const encoded = `${SAVE_PREFIX}${Buffer.from(
        JSON.stringify({ schemaVersion: 3, timestamp: 1, state }),
        'utf-8',
      ).toString('base64')}`
      const imported = importSaveFromBase64(encoded).state
      expect(imported.activeModifiers.map((m) => m.resolverKey)).toEqual(
        oldKeys.map(([, renamed]) => renamed),
      )
    })
  })
})
