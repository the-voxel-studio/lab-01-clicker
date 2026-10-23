/**
 * Blank card guard (plan 03, Task 8): every law, dilemma choice and archive perk must change at
 * least one measured realm metric, and the royal chronicle foresight reads the upcoming quotas.
 *
 * @module __tests__/unit/catalog_coverage.spec
 */

import { describe, it, expect } from 'vitest'
import { createInitialGameState, cloneGameState, createEmptyUnitRoster } from '@/core/state'
import {
  calculateGrossApRate,
  calculateMaxPopulation,
  calculateMilitaryPower,
  calculateNetApRate,
  calculateNetPaperwork,
  calculateUpkeep,
  effectiveQuota,
  evaluateDeadlineAudit,
  getForesightQuotas,
  tick,
} from '@/core/engine'
import { calculateOrderCaps, calculateUnitCost } from '@/core/formulas'
import { composeStat, extractRawEvaluationState } from '@/core/modifiers'
import { generateCampaignTarget } from '@/core/battle'
import { dispatch } from '@/core/commands'
import { startRun, createArchiveData, investPerk } from '@/core/archives'
import { DEFAULT_ENGINE_CONFIG } from '@/core/config'
import { UNITS_DATA } from '@/data/balance'
import { LAWS_DATA } from '@/data/laws'
import { DILEMMAS_DATA } from '@/data/dilemmas'
import { ARCHIVES_DATA, applyArchivePerks } from '@/data/archives'
import type { DeadlineQuota } from '@/data/balance.generated'
import type { CampaignTarget, GameState, StatKey, UnitId } from '@/core/types'

const config = DEFAULT_ENGINE_CONFIG
const UNIT_IDS: UnitId[] = Object.values(UNITS_DATA).map((unit) => unit.id)

/** Quota of a deadline, failing loudly when the config has none. */
function quotaOf(deadline: number): DeadlineQuota {
  const quota = config.quotas.find((q) => q.deadline === deadline)
  if (!quota) throw new Error(`no quota for deadline ${deadline}`)
  return quota
}

/** Rng streams every scenario starts from, so a baseline and a candidate draw the same numbers. */
const FIXED_STREAMS = createInitialGameState({ seed: 90210 }).rngStreams

type Metrics = Record<string, string | number | boolean>

/** A deadline 6 realm with mixed units, 4 provinces (one stronghold), rich and below its housing. */
function referenceState(): GameState {
  const state = createInitialGameState({ seed: 90210 })
  state.phase = 'ACTIVE_CYCLE'
  state.deadline = 6
  state.ap = 100000
  state.unrest = 35
  state.provinces = 4
  state.provinceBiomes = ['heartland', 'heartland', 'heartland', 'stronghold']
  state.unlockedPatents = { people: true, admin: true, military: true }
  state.units = {
    ...state.units,
    peasant: 40,
    farmer: 20,
    artisan: 10,
    guild: 4,
    clergy: 10,
    prelate: 3,
    notable: 2,
    baron: 1,
    scribe: 30,
    clerk: 10,
    supervisor: 5,
    provincial_steward: 2,
    archivist: 4,
    audit_chamber: 1,
    collector: 5,
    farmer_general: 1,
    soldier: 40,
    man_at_arms: 15,
    sergeant: 4,
    captain: 2,
    quartermaster: 2,
    grand_marshal: 1,
    scout: 3,
    spymaster: 1,
  }
  state.freeSerfs = 200
  state.totalPopulation =
    Object.values(state.units).reduce((sum, count) => sum + count, 0) + state.freeSerfs
  state.peakPopulation = state.totalPopulation
  return state
}

/** Clone of a state with the fixed rng streams, in the given phase. */
function scenario(state: GameState, phase: GameState['phase']): GameState {
  const copy = cloneGameState(state)
  copy.rngStreams = { ...FIXED_STREAMS }
  copy.phase = phase
  copy.isGameOver = false
  copy.isPaused = false
  copy.surpriseRaidTriggeredThisDeadline = true
  return copy
}

/** Records the immediate values of a state that instant effects change. */
function recordState(prefix: string, state: GameState, out: Metrics): void {
  out[`${prefix}.ap`] = state.ap
  out[`${prefix}.unrest`] = state.unrest
  out[`${prefix}.population`] = state.totalPopulation
  out[`${prefix}.freeSerfs`] = state.freeSerfs
  out[`${prefix}.provinces`] = state.provinces
  out[`${prefix}.archivePoints`] = state.archivePoints
  out[`${prefix}.strikes`] = state.strikes
  out[`${prefix}.gameOver`] = state.isGameOver
  out[`${prefix}.defeat`] = state.defeatReason ?? 'none'
  out[`${prefix}.victories`] = state.victoriesCount
  for (const id of UNIT_IDS) out[`${prefix}.unit.${id}`] = state.units[id]
}

/** Fixed enemy for the campaign scenarios: `power` is absolute, never derived from the candidate. */
function fixedTarget(power: number, lootType: CampaignTarget['lootType']): CampaignTarget {
  return {
    power,
    uncertaintyMargin: 0.2,
    perceivedMin: power * 0.9,
    perceivedMax: power * 1.1,
    biome: 'farmlands',
    lootType,
    factionId: 'outlaws',
    isFalseLedger: false,
    isAmbush: false,
  }
}

const REFERENCE_POWER = calculateMilitaryPower(referenceState(), config)

/** Measures a realm through the engine functions and short event scenarios on clones. */
function measure(state: GameState): Metrics {
  const out: Metrics = {}
  const raw = extractRawEvaluationState(state)
  const mods = state.activeModifiers
  const stat = (key: StatKey, base: number): number => composeStat(key, base, mods, raw)

  out['rate.gross'] = calculateGrossApRate(state, config).total
  out['rate.net'] = calculateNetApRate(state, config)
  out['rate.upkeep'] = calculateUpkeep(state, config)
  out['rate.paperwork'] = calculateNetPaperwork(state, config)
  const housing = calculateMaxPopulation(state, config)
  out['housing'] = housing
  const caps = calculateOrderCaps(housing, mods, raw, config)
  out['cap.admin'] = caps.admin
  out['cap.military'] = caps.military
  out['cap.people'] = caps.people
  out['power.military'] = calculateMilitaryPower(state, config)
  for (const id of UNIT_IDS) {
    out[`cost.${id}`] = calculateUnitCost(id, state.units[id], 1, config, mods)
    out[`cost10.${id}`] = calculateUnitCost(id, state.units[id], 10, config, mods)
  }
  out['stat.lootMultiplier'] = stat('battle_loot_multiplier', 1)
  out['stat.graceSeconds'] = stat('bankruptcy_grace_seconds', 30)
  out['stat.ambushChance'] = stat('ambush_chance', config.balance.AMBUSH_BASE_CHANCE)
  out['stat.scoutMargin'] = stat('scout_uncertainty_margin', config.balance.SCOUT_UNCERTAINTY_BASE)
  out['stat.casualtyRate'] = stat('battle_casualty_rate', 1)
  out['stat.clickCritical'] = stat('click_critical_chance', config.balance.CLICK_CRITICAL_CHANCE)
  out['stat.clickPower'] = stat('click_power', 1)
  out['stat.threatPower'] = stat('threat_power', 1)
  out['stat.unrestGeneration'] = stat('unrest_generation', 1)
  out['stat.unrestPacification'] = stat('unrest_pacification', 1)
  const quota = effectiveQuota(state, { apRate: 100, pop: 100, military: 100 })
  out['quota.requirement'] = quota.apRate
  out['foresight.length'] = getForesightQuotas(state, config).length
  recordState('now', state, out)

  const small = scenario(state, 'ACTIVE_CYCLE')
  small.provinces = 3
  small.provinceBiomes = small.provinceBiomes.slice(0, 3)
  out['small.upkeep'] = calculateUpkeep(small, config)
  out['small.net'] = calculateNetApRate(small, config)

  const running = scenario(state, 'ACTIVE_CYCLE')
  tick(running, 10, config)
  out['tick.growth'] = running.totalPopulation - state.totalPopulation
  recordState('tick', running, out)

  const crowded = scenario(state, 'ACTIVE_CYCLE')
  const excess = Math.ceil(calculateMaxPopulation(crowded, config)) + 50 - crowded.totalPopulation
  crowded.totalPopulation += excess
  crowded.freeSerfs += excess
  tick(crowded, 5, config)
  recordState('crowded', crowded, out)

  const unrestful = scenario(state, 'ACTIVE_CYCLE')
  unrestful.unrest = 80
  tick(unrestful, 5, config)
  recordState('strife', unrestful, out)

  const landless = scenario(state, 'ACTIVE_CYCLE')
  landless.freeSerfs = 0
  const mercenary = dispatch(landless, { type: 'BUY_UNIT', unitId: 'soldier', count: 1 }, config)
  out['recruit.noSerfs'] = mercenary.success
  recordState('recruit', landless, out)

  const clicking = scenario(state, 'ACTIVE_CYCLE')
  dispatch(clicking, { type: 'STAMP_DOCUMENT' }, config)
  out['click.value'] = clicking.ap - state.ap

  const colonising = scenario(state, 'ACTIVE_CYCLE')
  const colonise = dispatch(colonising, { type: 'COLONISE_PROVINCE' }, config)
  out['colonise.success'] = colonise.success
  recordState('colonise', colonising, out)

  const auditing = scenario(state, 'AUDIT_ASSESSMENT')
  const lawsBeforeAudit = auditing.activeLaws.length
  const audit = evaluateDeadlineAudit(auditing, config)
  out['audit.passed'] = audit.passedCount
  out['audit.grossRate'] = audit.grossApRate
  out['audit.lawsRepealed'] = lawsBeforeAudit - auditing.activeLaws.length
  recordState('audit', auditing, out)

  const failing = scenario(state, 'AUDIT_ASSESSMENT')
  failing.totalPopulation = 1
  failing.freeSerfs = 1
  failing.units = createEmptyUnitRoster()
  evaluateDeadlineAudit(failing, config)
  recordState('failedAudit', failing, out)

  const herald = scenario(state, 'COUNCIL_LAWS')
  herald.currentLawDraft = []
  dispatch(herald, { type: 'REJECT_LAWS' }, config)
  out['threat.power'] = herald.currentThreatPower
  out['threat.tribute'] = herald.currentThreatTributeAp

  const target = scenario(state, 'EXPEDITION')
  generateCampaignTarget(target, config)
  out['target.margin'] = target.currentTarget?.uncertaintyMargin ?? -1
  out['target.ambush'] = target.currentTarget?.isAmbush ?? false

  const campaigns: Array<[string, number, CampaignTarget['lootType']]> = [
    ['winAp', REFERENCE_POWER * 0.4, 'ap'],
    ['winMixed', REFERENCE_POWER * 0.4, 'mixed'],
    ['narrow', REFERENCE_POWER * 0.95, 'soldiers'],
    ['rout', REFERENCE_POWER * 3, 'population'],
  ]
  for (const [name, power, lootType] of campaigns) {
    const campaign = scenario(state, 'EXPEDITION')
    campaign.currentTarget = fixedTarget(power, lootType)
    const result = dispatch(campaign, { type: 'LAUNCH_ATTACK' }, config)
    out[`campaign.${name}.events`] = (result.events ?? []).join(' ')
    recordState(`campaign.${name}`, campaign, out)
  }

  for (const response of ['defense', 'levy', 'tribute'] as const) {
    const defending = scenario(state, 'THREAT_HERALD')
    defending.currentThreatId = defending.deadline + 1
    defending.currentThreatPower = REFERENCE_POWER * 0.8
    defending.currentThreatTributeAp = 500
    const result = dispatch(defending, { type: 'SELECT_THREAT_RESPONSE', response }, config)
    out[`threat.${response}.events`] = (result.events ?? []).join(' ')
    recordState(`threat.${response}`, defending, out)
  }

  const raid = scenario(state, 'SURPRISE_RAID')
  const raidResult = dispatch(raid, { type: 'RESOLVE_RAID_DEFENSE' }, config)
  out['raid.events'] = (raidResult.events ?? []).join(' ')
  recordState('raid', raid, out)

  const fillers = ['law:filler_a', 'law:filler_b', 'law:filler_c', 'law:filler_d', 'law:filler_e']
  const probeLaw = 'law:royal_scriptorium'
  for (const filled of [4, 5]) {
    const council = scenario(state, 'COUNCIL_LAWS')
    council.activeLaws = fillers.slice(0, filled)
    council.currentLawDraft = [probeLaw]
    const result = dispatch(council, { type: 'ENACT_LAW', lawId: probeLaw }, config)
    out[`council.${filled}.enacted`] = result.success
  }
  return out
}

/** Names of the metrics that differ between two measurements. */
function changedMetrics(before: Metrics, after: Metrics): string[] {
  const keys = new Set([...Object.keys(before), ...Object.keys(after)])
  return [...keys].filter((key) => !Object.is(before[key], after[key]))
}

const BASELINE = measure(referenceState())

function lawCandidate(lawId: string): GameState {
  const state = scenario(referenceState(), 'COUNCIL_LAWS')
  state.currentLawDraft = [lawId]
  const result = dispatch(state, { type: 'ENACT_LAW', lawId }, config)
  expect(result.success, `${lawId} must be enactable: ${result.error}`).toBe(true)
  return scenario(state, 'ACTIVE_CYCLE')
}

function choiceCandidate(dilemmaId: string, choiceIndex: number): GameState {
  const state = scenario(referenceState(), 'COUNCIL_DILEMMA')
  state.currentDilemmaId = dilemmaId
  const result = dispatch(state, { type: 'RESOLVE_DILEMMA', dilemmaId, choiceIndex }, config)
  expect(result.success, `${dilemmaId}[${choiceIndex}] must resolve: ${result.error}`).toBe(true)
  return scenario(state, 'ACTIVE_CYCLE')
}

describe('Task 8: catalog coverage guard', () => {
  describe('the measurement', () => {
    it('is stable for an unchanged realm', () => {
      expect(changedMetrics(BASELINE, measure(referenceState()))).toEqual([])
    })

    it('sees a real change', () => {
      const richer = referenceState()
      richer.ap += 1
      expect(changedMetrics(BASELINE, measure(richer))).toContain('now.ap')
    })

    it('does not count a raised rule flag as a change', () => {
      const flagged = referenceState()
      flagged.ruleFlags.push('law:census_edict')
      flagged.activeLaws.push('law:census_edict')
      expect(changedMetrics(BASELINE, measure(flagged))).toEqual([])
    })
  })

  describe('laws', () => {
    it.each(Object.values(LAWS_DATA).map((law) => [law.name, law.id] as const))(
      'law %s changes the realm',
      (_name, lawId) => {
        const changed = changedMetrics(BASELINE, measure(lawCandidate(lawId)))
        expect(changed, `${lawId} changed no metric`).not.toEqual([])
      },
    )
  })

  describe('dilemma choices', () => {
    const choices = Object.values(DILEMMAS_DATA).flatMap((dilemma) =>
      dilemma.choices.map(
        (_choice, index) => [`${dilemma.name} #${index}`, dilemma.id, index] as const,
      ),
    )
    it.each(choices)('dilemma %s changes the realm', (_name, dilemmaId, index) => {
      const changed = changedMetrics(BASELINE, measure(choiceCandidate(dilemmaId, index)))
      expect(changed, `${dilemmaId}[${index}] changed no metric`).not.toEqual([])
    })
  })

  describe('archive perks', () => {
    it.each(Object.values(ARCHIVES_DATA).map((perk) => [perk.name, perk.id] as const))(
      'perk %s changes the realm',
      (_name, perkId) => {
        const state = referenceState()
        applyArchivePerks(state, [perkId])
        const changed = changedMetrics(BASELINE, measure(scenario(state, 'ACTIVE_CYCLE')))
        expect(changed, `${perkId} changed no metric`).not.toEqual([])
      },
    )

    it('invested perks reach a new run through startRun', () => {
      const archive = createArchiveData()
      archive.points = 100
      for (const id of Object.keys(ARCHIVES_DATA)) investPerk(archive, id)
      const bare = startRun(createArchiveData(), 7)
      const perked = startRun(archive, 7)
      expect(perked.activeModifiers.length).toBeGreaterThan(bare.activeModifiers.length)
    })
  })

  describe('royal chronicle foresight', () => {
    function withChronicle(deadline: number, phase: GameState['phase']): GameState {
      const state = createInitialGameState({ seed: 5 })
      applyArchivePerks(state, ['royal_chronicle'])
      state.deadline = deadline
      state.phase = phase
      return state
    }

    it('is empty without the perk', () => {
      const state = createInitialGameState({ seed: 5 })
      expect(getForesightQuotas(state, config)).toEqual([])
    })

    it('lists the current and the next deadline quota during active play', () => {
      const state = withChronicle(3, 'ACTIVE_CYCLE')
      const quotas = getForesightQuotas(state, config)
      expect(quotas.map((q) => q.deadline)).toEqual([3, 4])
      expect(quotas[0]).toMatchObject({
        apRate: quotaOf(3).apRate,
        pop: quotaOf(3).pop,
        military: quotaOf(3).military,
      })
    })

    it('starts at the next deadline once the current one is audited', () => {
      const state = withChronicle(3, 'COUNCIL_LAWS')
      expect(getForesightQuotas(state, config).map((q) => q.deadline)).toEqual([4, 5])
    })

    it('stops at the last deadline', () => {
      const state = withChronicle(10, 'ACTIVE_CYCLE')
      expect(getForesightQuotas(state, config).map((q) => q.deadline)).toEqual([10])
    })

    it('scales the quotas by the quota requirement', () => {
      const state = withChronicle(3, 'ACTIVE_CYCLE')
      state.activeModifiers.push({
        source: 'test',
        stat: 'quota_requirement',
        op: 'mul',
        value: 2,
      })
      expect(getForesightQuotas(state, config)[0]?.apRate).toBe(quotaOf(3).apRate * 2)
    })
  })
})
