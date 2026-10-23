/**
 * Demography and council levers: flat population growth, order caps, audit scoped modifiers,
 * quota requirement, income priced costs and the council laws that act at an audit.
 *
 * @module __tests__/unit/council_levers.spec
 */

import { describe, it, expect } from 'vitest'
import { createInitialGameState } from '@/core/state'
import { applyEffect, canAffordEffects } from '@/core/modifiers'
import {
  calculateGrossApRate,
  calculateMaxPopulation,
  calculateNetApRate,
  evaluateDeadlineAudit,
  tick,
} from '@/core/engine'
import { calculateOrderCaps } from '@/core/formulas'
import { dispatch } from '@/core/commands'
import {
  CURRENT_SCHEMA_VERSION,
  SAVE_PREFIX,
  exportSaveToBase64,
  importSaveFromBase64,
} from '@/core/migrations'
import { createArchiveData } from '@/core/archives'
import { DEFAULT_ENGINE_CONFIG } from '@/core/config'
import { hasRule } from '@/core/rules'
import { LAWS_DATA } from '@/data/laws'
import { DILEMMAS_DATA } from '@/data/dilemmas'
import type { Effect, GameState, Modifier } from '@/core/types'

const config = DEFAULT_ENGINE_CONFIG

function applyAll(state: GameState, effects: readonly Effect[]): void {
  const netApRate = calculateNetApRate(state, config)
  for (const effect of effects) applyEffect(effect, state, netApRate)
}

function enact(state: GameState, lawId: string): void {
  const law = LAWS_DATA[lawId]
  if (!law) throw new Error(`unknown law ${lawId}`)
  applyAll(state, law.effects)
  state.activeLaws.push(lawId)
}

function choose(state: GameState, dilemmaId: string, choiceIndex: 0 | 1): void {
  const dilemma = DILEMMAS_DATA[dilemmaId]
  if (!dilemma) throw new Error(`unknown dilemma ${dilemmaId}`)
  applyAll(state, dilemma.choices[choiceIndex].effects)
}

/** A state of `serfs` free serfs only, in active play, 3 heartland provinces (housing 750). */
function serfState(serfs: number): GameState {
  const state = createInitialGameState()
  state.phase = 'ACTIVE_CYCLE'
  state.totalPopulation = serfs
  state.freeSerfs = serfs
  return state
}

/** Population growth of one fixed step, in pop/s. */
function growthRate(state: GameState): number {
  const step = config.balance.FIXED_STEP_SECONDS
  return tick(state, step, config).popGrowth / step
}

/** A deadline 2 state that meets 90% of the population and military quotas and no AP quota. */
function nearQuotaState(deadline = 2): GameState {
  const quota = config.quotas.find((q) => q.deadline === deadline)!
  const state = createInitialGameState()
  state.phase = 'AUDIT_ASSESSMENT'
  state.deadline = deadline
  state.freeSerfs = 0
  state.units.soldier = Math.ceil(quota.military * 0.9)
  state.totalPopulation = Math.ceil(quota.pop * 0.9) + state.units.soldier
  return state
}

/** Fixes the net AP rate through test modifiers: gross `gross`, no paperwork, no upkeep. */
function withNetRate(state: GameState, gross: number, flatUpkeep = 0): void {
  const mods: Modifier[] = [
    { source: 'test', stat: 'gross_ap_rate', op: 'set', value: gross },
    { source: 'test', stat: 'paperwork_friction', op: 'set', value: 0 },
    { source: 'test', stat: 'flat_upkeep', op: 'add', value: flatUpkeep },
  ]
  state.activeModifiers.push(...mods)
}

function encodeSave(state: Record<string, unknown>): string {
  return `${SAVE_PREFIX}${Buffer.from(
    JSON.stringify({
      schemaVersion: CURRENT_SCHEMA_VERSION,
      timestamp: 1,
      state,
      archive: createArchiveData(),
    }),
    'utf-8',
  ).toString('base64')}`
}

describe('Task 3: demography and council levers', () => {
  describe('flat population growth', () => {
    it('monastic_granaries adds 0.4 pop/s with 500 free serfs', () => {
      const without = serfState(500)
      const withLaw = serfState(500)
      enact(withLaw, 'law:monastic_granaries')
      const difference = growthRate(withLaw) - growthRate(without)
      expect(Math.abs(difference - 0.4)).toBeLessThan(1e-9)
    })

    it('runaway_serfs B adds 0.10 pop/s', () => {
      const without = serfState(300)
      const withChoice = serfState(300)
      choose(withChoice, 'dilemma:runaway_serfs', 1)
      const difference = growthRate(withChoice) - growthRate(without)
      expect(Math.abs(difference - 0.1)).toBeLessThan(1e-9)
    })

    it('does not grow the population past the housing capacity', () => {
      const state = serfState(500)
      const maxPop = calculateMaxPopulation(state, config)
      state.totalPopulation = maxPop - 0.001
      state.freeSerfs = state.totalPopulation
      enact(state, 'law:monastic_granaries')
      tick(state, config.balance.FIXED_STEP_SECONDS, config)
      expect(state.totalPopulation).toBeLessThanOrEqual(maxPop)
      expect(state.totalPopulation).toBeCloseTo(maxPop, 9)
    })

    it('is frozen during strife like logistic growth', () => {
      const state = serfState(500)
      state.unrest = 80
      enact(state, 'law:monastic_granaries')
      expect(growthRate(state)).toBe(0)
    })

    it('is frozen during the forced tithe freeze', () => {
      const state = serfState(500)
      state.forcedTitheFreezeTimer = 10
      choose(state, 'dilemma:runaway_serfs', 1)
      expect(growthRate(state)).toBe(0)
    })
  })

  describe('parish_relief_registers', () => {
    function overcrowded(parish: boolean): GameState {
      const state = serfState(800)
      enact(state, 'law:monastic_granaries')
      if (parish) enact(state, 'law:parish_relief_registers')
      return state
    }

    it('keeps flat growth running during overcrowding, the bleed still applies', () => {
      const step = config.balance.FIXED_STEP_SECONDS
      const without = overcrowded(false)
      const withLaw = overcrowded(true)
      tick(without, step, config)
      tick(withLaw, step, config)
      const bleed = config.balance.OVERCROWDING_BLEED_RATE * step
      expect(without.totalPopulation).toBeCloseTo(800 - bleed, 9)
      expect(withLaw.totalPopulation).toBeCloseTo(800 - bleed + 0.08 * 8 * step, 9)
    })
  })

  describe('corvee_exemption_tax', () => {
    it('lowers logistic population growth by 25%', () => {
      const without = serfState(300)
      const withLaw = serfState(300)
      enact(withLaw, 'law:corvee_exemption_tax')
      expect(growthRate(withLaw) / growthRate(without)).toBeCloseTo(0.75, 12)
    })
  })

  describe('census_edict', () => {
    it('reduces only the administration order cap by 20%', () => {
      const state = createInitialGameState()
      enact(state, 'law:census_edict')
      const caps = calculateOrderCaps(1000, state.activeModifiers)
      expect(caps).toEqual({ admin: 120, military: 120, people: 250 })
      expect(calculateOrderCaps(1000)).toEqual({ admin: 150, military: 120, people: 250 })
    })

    it('makes BUY_UNIT reject an administration unit above the reduced cap', () => {
      const state = createInitialGameState()
      state.phase = 'ACTIVE_CYCLE'
      state.ap = 100000
      state.freeSerfs = 400
      state.totalPopulation = 400
      enact(state, 'law:census_edict')
      const maxPop = calculateMaxPopulation(state, config)
      const cap = Math.floor(maxPop * 0.15 * 0.8 + 1e-9)
      state.units.scribe = cap
      state.freeSerfs -= cap
      const res = dispatch(state, { type: 'BUY_UNIT', unitId: 'scribe', count: 1 })
      expect(res.success).toBe(false)
      expect(res.error).toContain(`cap: ${cap}`)
    })

    it('survives export and import with its order scope', () => {
      const state = createInitialGameState()
      enact(state, 'law:census_edict')
      const imported = importSaveFromBase64(exportSaveToBase64(state, createArchiveData())).state
      expect(imported.activeModifiers).toEqual(state.activeModifiers)
      expect(calculateOrderCaps(1000, imported.activeModifiers).admin).toBe(120)
    })

    it('rejects an order_cap scope that names a tier or a unit', () => {
      for (const scope of [{ tier: 1 }, { unitId: 'scribe' }]) {
        const state: Record<string, unknown> = { ...createInitialGameState() }
        state.activeModifiers = [{ source: 'x', stat: 'order_cap', op: 'mul', value: 0.8, scope }]
        expect(() => importSaveFromBase64(encodeSave(state))).toThrow(/activeModifiers\[0\]\.scope/)
      }
    })
  })

  describe('grand_kermesse', () => {
    const law = LAWS_DATA['law:grand_kermesse']!

    it('costs 40 s of net income', () => {
      const state = createInitialGameState()
      withNetRate(state, 10)
      state.ap = 1000
      state.unrest = 40
      expect(calculateNetApRate(state, config)).toBe(10)
      expect(canAffordEffects(state, law.effects, calculateNetApRate(state, config))).toBe(true)
      applyAll(state, law.effects)
      expect(state.ap).toBe(600)
      expect(state.unrest).toBe(15)
    })

    it('is rejected when AP is below 40 s of net income', () => {
      const state = createInitialGameState()
      state.phase = 'COUNCIL_LAWS'
      state.currentLawDraft = ['law:grand_kermesse']
      withNetRate(state, 10)
      state.ap = 399
      expect(canAffordEffects(state, law.effects, calculateNetApRate(state, config))).toBe(false)
      const res = dispatch(state, { type: 'ENACT_LAW', lawId: 'law:grand_kermesse' })
      expect(res.success).toBe(false)
      expect(state.ap).toBe(399)
      expect(state.phase).toBe('COUNCIL_LAWS')
    })

    it('refuses to price the cost without a net rate', () => {
      const state = createInitialGameState()
      expect(() => canAffordEffects(state, law.effects)).toThrow(/net AP rate/)
      expect(() => applyEffect(law.effects[0]!, state)).toThrow(/net AP rate/)
    })

    it('costs nothing when the net rate is not positive', () => {
      const state = createInitialGameState()
      withNetRate(state, 0, 5)
      state.ap = 0
      expect(canAffordEffects(state, law.effects, calculateNetApRate(state, config))).toBe(true)
      applyAll(state, law.effects)
      expect(state.ap).toBe(0)
    })
  })

  describe('untilNextAudit modifiers', () => {
    it('crowns_forced_loan lowers only the next audit', () => {
      const state = nearQuotaState(2)
      state.ap = 6000
      choose(state, 'dilemma:crowns_forced_loan', 0)
      expect(state.ap).toBe(4000)
      const first = evaluateDeadlineAudit(state, config)
      expect(first.popMet).toBe(true)
      expect(first.militaryMet).toBe(true)
      expect(first.success).toBe(true)
      expect(state.activeModifiers.some((m) => m.untilNextAudit)).toBe(false)

      const next = nearQuotaState(3)
      next.activeModifiers = state.activeModifiers
      const second = evaluateDeadlineAudit(next, config)
      expect(second.popMet).toBe(false)
      expect(second.militaryMet).toBe(false)
      expect(second.success).toBe(false)
    })

    it('crowns_forced_loan lowers the quotas of the 50 s interim projection too', () => {
      const run = (loan: boolean): boolean | null => {
        const state = nearQuotaState(2)
        state.phase = 'ACTIVE_CYCLE'
        state.ap = 6000
        if (loan) choose(state, 'dilemma:crowns_forced_loan', 0)
        state.deadlineTimeSeconds = 49.95
        tick(state, 0.05, config)
        expect(state.interimWarningShown).toBe(true)
        return state.interimWarningOnTrack
      }
      expect(run(false)).toBe(false)
      expect(run(true)).toBe(true)
    })

    it('untilNextAudit modifiers are active during their audit', () => {
      const state = nearQuotaState(2)
      state.phase = 'COUNCIL_DILEMMA'
      state.currentDilemmaId = 'dilemma:crowns_forced_loan'
      state.ap = 6000
      const res = dispatch(state, {
        type: 'RESOLVE_DILEMMA',
        dilemmaId: 'dilemma:crowns_forced_loan',
        choiceIndex: 0,
      })
      expect(res.success).toBe(true)
      state.phase = 'ACTIVE_CYCLE'
      state.deadlineTimeSeconds = 99.9
      tick(state, 0.1, config)
      expect(state.phase).toBe('AUDIT_ASSESSMENT')
      expect(state.lastAuditOutcome?.popMet).toBe(true)
      expect(state.lastAuditOutcome?.success).toBe(true)
      expect(state.activeModifiers.some((m) => m.source === 'dilemma:crowns_forced_loan')).toBe(
        false,
      )
    })

    it('are removed after a failed audit too', () => {
      const state = nearQuotaState(3)
      state.activeModifiers.push({
        source: 'test',
        stat: 'gross_ap_rate',
        op: 'add',
        value: 1,
        untilNextAudit: true,
      })
      expect(evaluateDeadlineAudit(state, config).success).toBe(false)
      expect(state.activeModifiers).toEqual([])
    })

    it('clamps the quota requirement at 0', () => {
      const state = nearQuotaState(3)
      state.units.soldier = 0
      state.totalPopulation = 0
      state.activeModifiers.push({
        source: 'test',
        stat: 'quota_requirement',
        op: 'add',
        value: -5,
        untilNextAudit: true,
      })
      expect(evaluateDeadlineAudit(state, config).passedCount).toBe(3)
    })

    it('survive export and import', () => {
      const state = createInitialGameState()
      choose(state, 'dilemma:crowns_forced_loan', 0)
      const imported = importSaveFromBase64(exportSaveToBase64(state, createArchiveData())).state
      expect(imported.activeModifiers).toEqual(state.activeModifiers)
      expect(imported.activeModifiers[0]?.untilNextAudit).toBe(true)
    })

    it('rejects a saved untilNextAudit other than true', () => {
      const state: Record<string, unknown> = { ...createInitialGameState() }
      state.activeModifiers = [
        { source: 'x', stat: 'gross_ap_rate', op: 'add', value: 1, untilNextAudit: false },
      ]
      expect(() => importSaveFromBase64(encodeSave(state))).toThrow(
        /activeModifiers\[0\]\.untilNextAudit/,
      )
    })
  })

  describe('exceptional_tithe', () => {
    it('exceptional_tithe lasts one deadline', () => {
      const state = serfState(300)
      const baseline = calculateGrossApRate(state, config).total
      enact(state, 'law:exceptional_tithe')
      expect(calculateGrossApRate(state, config).total).toBeCloseTo(baseline * 1.8, 9)
      state.unrest = 10
      state.deadlineTimeSeconds = 99.95
      tick(state, 0.05, config)
      expect(state.phase).toBe('AUDIT_ASSESSMENT')
      expect(state.lastAuditOutcome?.grossApRate).toBeCloseTo(
        calculateGrossApRate(state, config).total * 1.8,
        9,
      )
      expect(state.unrest).toBeCloseTo(40, 9)
      expect(state.activeLaws).not.toContain('law:exceptional_tithe')
      expect(hasRule(state, 'law:exceptional_tithe')).toBe(false)
      expect(calculateGrossApRate(state, config).total).toBe(
        calculateGrossApRate({ ...state, activeModifiers: [] }, config).total,
      )
    })
  })

  describe('auditors_inquisition', () => {
    it('adds 15 Unrest at every audit while active', () => {
      const state = nearQuotaState(2)
      enact(state, 'law:auditors_inquisition')
      state.unrest = 10
      evaluateDeadlineAudit(state, config)
      expect(state.unrest).toBe(25)
      state.deadline = 3
      evaluateDeadlineAudit(state, config)
      expect(state.unrest).toBe(40)
    })
  })

  describe('auditor_nephew', () => {
    it('auditor_nephew B makes the next failed audit fatal', () => {
      const state = nearQuotaState(5)
      state.archivePoints = 2
      choose(state, 'dilemma:auditor_nephew', 1)
      expect(state.archivePoints).toBe(3)
      expect(hasRule(state, 'law_effect:pardon_forfeited')).toBe(true)
      expect(state.strikes).toBe(0)
      const outcome = evaluateDeadlineAudit(state, config)
      expect(outcome.success).toBe(false)
      expect(outcome.isGameOver).toBe(true)
      expect(outcome.royalPardonIssued).toBe(false)
      expect(state.phase).toBe('RUN_DEFEAT')
      expect(state.defeatReason).toBe('quota_failure')
      expect(hasRule(state, 'law_effect:pardon_forfeited')).toBe(false)
    })

    it('lets a later failed audit be a censure once a passed audit cleared the flag', () => {
      const state = nearQuotaState(5)
      choose(state, 'dilemma:auditor_nephew', 1)
      state.activeModifiers.push({
        source: 'test',
        stat: 'quota_requirement',
        op: 'mul',
        value: 0.5,
        untilNextAudit: true,
      })
      expect(evaluateDeadlineAudit(state, config).success).toBe(true)
      expect(hasRule(state, 'law_effect:pardon_forfeited')).toBe(false)
      state.deadline = 6
      state.phase = 'AUDIT_ASSESSMENT'
      const outcome = evaluateDeadlineAudit(state, config)
      expect(outcome.success).toBe(false)
      expect(outcome.royalPardonIssued).toBe(true)
      expect(state.strikes).toBe(1)
      expect(state.isGameOver).toBe(false)
    })

    it('auditor_nephew A still grants a supervisor', () => {
      const state = createInitialGameState()
      choose(state, 'dilemma:auditor_nephew', 0)
      expect(state.units.supervisor).toBe(1)
    })
  })

  describe('great_archive_fire', () => {
    it('triggers above 45% paperwork only', () => {
      const trigger = DILEMMAS_DATA['dilemma:great_archive_fire']!.trigger
      const at = (paperwork: number): boolean => {
        const state = createInitialGameState()
        state.activeModifiers.push({
          source: 'test',
          stat: 'paperwork_friction',
          op: 'set',
          value: paperwork,
        })
        return trigger(state, config)
      }
      expect(at(0.42)).toBe(false)
      expect(at(0.45)).toBe(false)
      expect(at(0.46)).toBe(true)
    })
  })

  describe('marshals_carte_blanche', () => {
    it('carte blanche blocks chancellor laws', () => {
      const state = createInitialGameState()
      enact(state, 'law:marshals_carte_blanche')
      state.phase = 'COUNCIL_LAWS'
      state.ap = 100000
      state.currentLawDraft = ['law:exceptional_tithe', 'law:census_edict']
      const res = dispatch(state, { type: 'ENACT_LAW', lawId: 'law:exceptional_tithe' })
      expect(res.success).toBe(false)
      expect(res.error).toContain('Chancellor')
      expect(state.phase).toBe('COUNCIL_LAWS')
      expect(state.activeLaws).not.toContain('law:exceptional_tithe')
      const other = dispatch(state, { type: 'ENACT_LAW', lawId: 'law:census_edict' })
      expect(other.success).toBe(true)
      expect(state.activeLaws).toContain('law:census_edict')
    })
  })
})
