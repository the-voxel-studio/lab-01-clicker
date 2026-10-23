/**
 * Task 1.6 Verification Suite: Military, Threats, Clock Bounding & Governance Transitions.
 * Validates the 11 acceptance criteria of legacy remediation Task 1.6.
 *
 * @module __tests__/unit/military_threats_clock.spec
 */

import { describe, it, expect } from 'vitest'
import { createInitialGameState } from '@/core/state'
import { DEFAULT_ENGINE_CONFIG } from '@/core/config'
import { dispatch } from '@/core/commands'
import { tick, evaluateDeadlineAudit } from '@/core/engine'
import {
  resolveDefensiveClash,
  resolveOffensiveCampaign,
  resolveScheduledThreat,
  generateCampaignTarget,
} from '@/core/battle'
import { FACTIONS_DATA, neutralTrait } from '@/data/threats'
import { getNextInterDeadlinePhase } from '@/core/phases'
import { UNITS_DATA, getThreatPower, getThreatTributeAp } from '@/data/balance'
import { DILEMMAS_DATA } from '@/data/dilemmas'
import { applyEffect } from '@/core/modifiers'
import { calculateGrossApRate, calculateUpkeep, calculateMilitaryPower } from '@/core/engine'
import { hasRule } from '@/core/rules'
import {
  CURRENT_SCHEMA_VERSION,
  SAVE_PREFIX,
  exportSaveToBase64,
  importSaveFromBase64,
} from '@/core/migrations'
import { createArchiveData } from '@/core/archives'
import { LAWS_DATA } from '@/data/laws'
import type { CampaignTarget } from '@/core/types'
import { PRNG } from '@/core/prng'

describe('Task 1.6: Military, Threats & Clock Bounding (Gate C/D)', () => {
  // Criterion 1: Rejection of unaffordable tribute without phase transition
  it('rejects unaffordable tribute without advancing phase in THREAT_HERALD', () => {
    const state = createInitialGameState()
    state.phase = 'THREAT_HERALD'
    state.deadline = 2
    state.currentThreatPower = 100
    state.currentThreatTributeAp = 400
    state.ap = 250 // Insufficient funds

    const res = dispatch(state, { type: 'SELECT_THREAT_RESPONSE', response: 'tribute' })
    expect(res.success).toBe(false)
    expect(res.error).toContain('Insufficient treasury')
    expect(state.phase).toBe('THREAT_HERALD')
    expect(state.ap).toBe(250) // Untouched

    // When funds become sufficient, tribute succeeds and transitions to EXPEDITION
    state.ap = 500
    const successRes = dispatch(state, { type: 'SELECT_THREAT_RESPONSE', response: 'tribute' })
    expect(successRes.success).toBe(true)
    expect(state.ap).toBe(100)
    expect(state.phase).toBe('EXPEDITION')
  })

  // Criterion 2: Immediate defeat on Deadline 10 audit failure with 0 strikes
  it('triggers immediate quota_failure defeat on Deadline 10 failure even with 0 strikes', () => {
    const state = createInitialGameState()
    state.deadline = 10
    state.strikes = 0
    state.totalPopulation = 0
    state.freeSerfs = 0

    const outcome = evaluateDeadlineAudit(state, DEFAULT_ENGINE_CONFIG)
    expect(outcome.success).toBe(false)
    expect(outcome.isGameOver).toBe(true)
    expect(outcome.royalPardonIssued).toBe(false)
    expect(state.isGameOver).toBe(true)
    expect(state.defeatReason).toBe('quota_failure')
    expect(state.phase).toBe('RUN_DEFEAT')
  })

  it('issues royal censure and pardon on Deadline 1-9 failure with 0 strikes', () => {
    const state = createInitialGameState()
    state.deadline = 5
    state.strikes = 0
    state.provinces = 3
    state.provinceBiomes = ['heartland', 'farmlands', 'stronghold']
    state.ap = 1000
    state.totalPopulation = 0

    const outcome = evaluateDeadlineAudit(state, DEFAULT_ENGINE_CONFIG)
    expect(outcome.success).toBe(false)
    expect(outcome.royalPardonIssued).toBe(true)
    expect(outcome.isGameOver).toBe(false)
    expect(state.strikes).toBe(1)
    expect(state.provinces).toBe(2)
    expect(state.provinceBiomes).toEqual(['heartland', 'farmlands'])
    expect(state.ap).toBe(500) // 50% confiscated
  })

  // Criterion 3: Effective reroll of currentTarget by RECON_PATROL
  it('sacrifices exactly 1 scout and rerolls currentTarget with RECON_PATROL', () => {
    const state = createInitialGameState()
    state.phase = 'EXPEDITION'
    state.units.scout = 2
    state.totalPopulation = 100
    state.currentTarget = generateCampaignTarget(state, DEFAULT_ENGINE_CONFIG, new PRNG(111))

    const oldTarget = { ...state.currentTarget }

    const res1 = dispatch(state, { type: 'RECON_PATROL' })
    expect(res1.success).toBe(true)
    expect(state.units.scout).toBe(1)
    expect(state.totalPopulation).toBe(99)
    expect(state.currentTarget).toBeDefined()
    expect(state.currentTarget?.uncertaintyMargin).toBeCloseTo(0.33, 2)
    expect(state.currentTarget).not.toEqual(oldTarget)

    // Second patrol
    const res2 = dispatch(state, { type: 'RECON_PATROL' })
    expect(res2.success).toBe(true)
    expect(state.units.scout).toBe(0)
    expect(state.totalPopulation).toBe(98)
    // The second reroll draws Steppe Horsemen, which double the 0.45 base margin
    expect(state.currentTarget?.factionId).toBe('steppe_horsemen')
    expect(state.currentTarget?.uncertaintyMargin).toBe(0.9)

    // Third patrol with 0 scouts is rejected
    const res3 = dispatch(state, { type: 'RECON_PATROL' })
    expect(res3.success).toBe(false)
    expect(res3.error).toContain('No active scouts')
    expect(state.units.scout).toBe(0)
    expect(state.totalPopulation).toBe(98)
  })

  // Criterion 4: Deterministic trigger of SURPRISE_RAID
  it('triggers SURPRISE_RAID deterministically at 10s boundary in Deadline 3+', () => {
    // Seed 21 yields a PRNG roll of ~0.0304 < p (0.08) on the events stream
    const state = createInitialGameState({ seed: 21 })
    state.deadline = 3
    state.totalElapsedSeconds = 120
    state.lastSurpriseRaidTime = 0
    state.deadlineTimeSeconds = 9.8
    state.surpriseRaidTriggeredThisDeadline = false
    state.ap = 3000 // ap > 2000 increases probability
    state.unrest = 70 // unrest > 60 increases probability

    // Tick across the 10-second mark (9.8 -> 10.3)
    tick(state, 0.5, DEFAULT_ENGINE_CONFIG)

    expect(state.phase).toBe('SURPRISE_RAID')
    expect(state.surpriseRaidTriggeredThisDeadline).toBe(true)
    expect(state.lastSurpriseRaidTime).toBe(state.totalElapsedSeconds)

    // Resolving raid defense brings back to ACTIVE_CYCLE
    const raidRes = dispatch(state, { type: 'RESOLVE_RAID_DEFENSE' })
    expect(raidRes.success).toBe(true)
    expect(state.phase).toBe('ACTIVE_CYCLE')
  })

  it('never triggers SURPRISE_RAID before Deadline 3', () => {
    const state = createInitialGameState({ seed: 10 })
    state.deadline = 2
    state.totalElapsedSeconds = 120
    state.lastSurpriseRaidTime = 0
    state.deadlineTimeSeconds = 9.8
    state.surpriseRaidTriggeredThisDeadline = false
    state.ap = 3000
    state.unrest = 70

    tick(state, 0.5, DEFAULT_ENGINE_CONFIG)
    expect(state.phase).toBe('ACTIVE_CYCLE')
    expect(state.surpriseRaidTriggeredThisDeadline).toBe(false)
  })

  // Criterion 5: Defensive collapse at ap = -800 preserves signed debt
  it('preserves negative debt upon defensive collapse without erasing or halving it', () => {
    const state = createInitialGameState()
    state.ap = -800
    state.provinces = 3
    state.units.soldier = 10
    state.totalPopulation = 100

    // Overwhelming enemy power triggers collapse
    const clash = resolveDefensiveClash(
      state,
      0, // player forces
      500, // enemy forces
      0,
      new PRNG(999),
      DEFAULT_ENGINE_CONFIG,
    )

    expect(clash.isCollapse).toBe(true)
    expect(state.ap).toBe(-800) // Negative debt must remain intact!
    expect(clash.unrestDelta).toBe(20)
    expect(state.unrest).toBe(30) // 10 starting unrest + 20 from collapse
  })

  // Criterion 6: Defensive collapse at 1 province triggers defeatReason === 'conquest'
  it('triggers conquest defeat when defensive collapse reduces provinces from 1 to 0', () => {
    const state = createInitialGameState()
    state.provinces = 1
    state.provinceBiomes = ['heartland']
    state.units.soldier = 15
    state.units.man_at_arms = 5
    state.totalPopulation = 100

    const clash = resolveDefensiveClash(state, 0, 500, 0, new PRNG(777), DEFAULT_ENGINE_CONFIG)

    expect(clash.isCollapse).toBe(true)
    expect(state.provinces).toBe(0)
    expect(state.provinceBiomes.length).toBe(0)
    expect(state.isGameOver).toBe(true)
    expect(state.defeatReason).toBe('conquest')
    expect(state.phase).toBe('RUN_DEFEAT')

    // 100% of all military personnel killed
    expect(state.units.soldier).toBe(0)
    expect(state.units.man_at_arms).toBe(0)
  })

  // Criterion 7: Resolution of 8 threats (D3 to D10) over a full run across deadlines 2 through 9
  it('heralds and resolves exactly 8 threats across Deadlines 2 to 9 for targets D3 to D10', () => {
    const heraldedThreats: { heraldAtDeadline: number; targetDeadline: number }[] = []

    for (let d = 1; d <= 10; d++) {
      const nextPhase = getNextInterDeadlinePhase('COUNCIL_LAWS', d, DEFAULT_ENGINE_CONFIG)
      if (nextPhase === 'THREAT_HERALD') {
        heraldedThreats.push({
          heraldAtDeadline: d,
          targetDeadline: d + 1,
        })
      }
    }

    // Exactly 8 threats announced in D2 through D9, targeting D3 through D10
    expect(heraldedThreats).toHaveLength(8)
    expect(heraldedThreats[0]).toEqual({ heraldAtDeadline: 2, targetDeadline: 3 })
    expect(heraldedThreats[7]).toEqual({ heraldAtDeadline: 9, targetDeadline: 10 })

    // Verify D1 skips herald and goes straight to EXPEDITION
    expect(getNextInterDeadlinePhase('COUNCIL_LAWS', 1, DEFAULT_ENGINE_CONFIG)).toBe('EXPEDITION')

    // Verify D10 skips herald
    expect(getNextInterDeadlinePhase('COUNCIL_LAWS', 10, DEFAULT_ENGINE_CONFIG)).toBe('EXPEDITION')
  })

  it('automatically initializes currentThreatPower and currentThreatTributeAp when transitioning to THREAT_HERALD via ENACT_LAW / REJECT_LAWS', () => {
    const state = createInitialGameState()
    state.deadline = 2
    state.phase = 'COUNCIL_LAWS'

    const res = dispatch(state, { type: 'REJECT_LAWS' }, DEFAULT_ENGINE_CONFIG)
    expect(res.success).toBe(true)
    expect(state.phase).toBe('THREAT_HERALD')

    const d3Quota = DEFAULT_ENGINE_CONFIG.quotas.find((q) => q.deadline === 3)!
    expect(state.currentThreatPower).toBe(getThreatPower(d3Quota.military))
    expect(state.currentThreatTributeAp).toBe(getThreatTributeAp(d3Quota.apRate))

    // Responding to threat directly reads these fields without fallback
    state.ap = state.currentThreatTributeAp + 100
    const threatRes = dispatch(
      state,
      { type: 'SELECT_THREAT_RESPONSE', response: 'tribute' },
      DEFAULT_ENGINE_CONFIG,
    )
    expect(threatRes.success).toBe(true)
    expect(state.phase).toBe('EXPEDITION')
  })

  // Criterion 8: Tick clock bounds stepDt, advances clock, and exposes consumedDt when switching to LOMBARD_OFFER
  it('advances clock by consumedDt before switching to LOMBARD_OFFER', () => {
    const state = createInitialGameState()
    state.ap = -10
    state.units.soldier = 50 // Negative net AP/s
    state.provinces = 2
    state.lombardBailoutAvailable = true
    state.bankruptcyGraceTimer = 20.5
    state.deadlineTimeSeconds = 15.0
    state.totalElapsedSeconds = 15.0

    const res = tick(state, 1.0, DEFAULT_ENGINE_CONFIG)

    // Fixed 0.05 s steps: the offer opens on the step where the timer reaches 20.0 (after 0.5 s);
    // the rest of the 1.0 s is not simulated
    expect(state.bankruptcyGraceTimer).toBe(20.0)
    expect(state.phase).toBe('LOMBARD_OFFER')
    expect(res.consumedDt).toBe(0.5)
    expect(state.deadlineTimeSeconds).toBe(15.5)
    expect(state.totalElapsedSeconds).toBe(15.5)
  })

  // Criterion 9: No Lombard offer when provinces === 1
  it('does not trigger LOMBARD_OFFER when sovereign has only 1 province', () => {
    const state = createInitialGameState()
    state.ap = -10
    state.units.soldier = 50
    state.provinces = 1 // Last sovereign seat
    state.lombardBailoutAvailable = true
    state.bankruptcyGraceTimer = 20.5

    tick(state, 1.0, DEFAULT_ENGINE_CONFIG)

    expect(state.bankruptcyGraceTimer).toBe(19.5)
    expect(state.phase).toBe('ACTIVE_CYCLE') // Must not switch to LOMBARD_OFFER!

    // Continuing to deplete grace timer triggers bankruptcy
    tick(state, 20.0, DEFAULT_ENGINE_CONFIG)
    expect(state.isGameOver).toBe(true)
    expect(state.defeatReason).toBe('bankruptcy')
  })

  // Criterion 10: AP quota evaluated via instantaneous gross rate and NOT satisfied by treasury
  it('evaluates AP audit quota via instantaneous gross rate, rejecting inflated treasury', () => {
    const config = DEFAULT_ENGINE_CONFIG
    const quotaD1 = config.quotas.find((q) => q.deadline === 1)!

    // Case A: Inflated treasury (50,000 AP) but zero production -> FAILS AP quota
    const stateNoRate = createInitialGameState()
    stateNoRate.deadline = 1
    stateNoRate.ap = 50000
    stateNoRate.freeSerfs = 0 // No serfs producing poll tax

    const outcomeNoRate = evaluateDeadlineAudit(stateNoRate, config)
    expect(outcomeNoRate.grossApRate).toBeLessThan(quotaD1.apRate)
    expect(outcomeNoRate.apMet).toBe(false)

    // Case B: Negative treasury (-200 AP) but high gross rate (10 Scribes) -> PASSES AP quota
    const stateWithRate = createInitialGameState()
    stateWithRate.deadline = 1
    stateWithRate.ap = -200
    stateWithRate.units.scribe = 10 // 10 Scribes = 10 AP/s > 5 AP/s quota
    stateWithRate.freeSerfs = 50

    const outcomeWithRate = evaluateDeadlineAudit(stateWithRate, config)
    expect(outcomeWithRate.grossApRate).toBeGreaterThanOrEqual(quotaD1.apRate)
    expect(outcomeWithRate.apMet).toBe(true)
  })

  it('calculates interimWarningOnTrack according to 2-out-of-3 rule at 50 seconds mark', () => {
    const config = DEFAULT_ENGINE_CONFIG
    const quotaD1 = config.quotas.find((q) => q.deadline === 1)!

    // Sub-case A: 2 of 3 met (Pop met, AP met, Mil failed) -> onTrack === true
    const stateA = createInitialGameState()
    stateA.deadline = 1
    stateA.deadlineTimeSeconds = 49.5
    stateA.totalPopulation = quotaD1.pop + 10
    stateA.units.scribe = 10 // >= 5 AP/s
    stateA.units.soldier = 0 // < quota.military

    tick(stateA, 1.0, config)
    expect(stateA.interimWarningShown).toBe(true)
    expect(stateA.interimWarningOnTrack).toBe(true)

    // Sub-case B: Only 1 of 3 met (Pop met, AP failed, Mil failed) -> onTrack === false
    const stateB = createInitialGameState()
    stateB.deadline = 1
    stateB.deadlineTimeSeconds = 49.5
    stateB.totalPopulation = quotaD1.pop + 10
    stateB.freeSerfs = 0
    stateB.units.scribe = 0 // 0 AP/s < 5
    stateB.units.soldier = 0 // < quota.military

    tick(stateB, 1.0, config)
    expect(stateB.interimWarningShown).toBe(true)
    expect(stateB.interimWarningOnTrack).toBe(false)
  })

  // Criterion 11: Plunder & salvage & military cap
  it('does not credit deadline cumulative AP with campaign plunder and respects military headroom', () => {
    const state = createInitialGameState()
    state.cumulativeApThisDeadline = 100
    state.totalCumulativeAp = 100
    state.ap = 500
    state.units.soldier = 20
    state.units.scout = 0
    state.units.man_at_arms = 0
    state.freeSerfs = 100
    state.totalPopulation = 120

    // Campaign with soldiers loot
    const result = resolveOffensiveCampaign(
      state,
      200, // player power
      10, // enemy power -> decisive victory
      'soldiers',
      300,
      new PRNG(123),
      DEFAULT_ENGINE_CONFIG,
      'heartland',
    )

    expect(result.provinceWon).toBe(true)
    // Plunder does NOT credit quota accumulators
    expect(state.cumulativeApThisDeadline).toBe(100)
    expect(state.totalCumulativeAp).toBe(100)

    // FreeSerfs + sum(units) === totalPopulation invariant
    const unitSum = Object.values(state.units).reduce((a, b) => a + (b ?? 0), 0)
    expect(state.totalPopulation).toBe(state.freeSerfs + unitSum)
  })

  it('overflows 100% of captured soldiers into freeSerfs when military order headroom is full', () => {
    const state = createInitialGameState()
    // Set 200 soldiers so that even after decisive victory casualties (8% to 12%)
    // and province gain (cap becomes 120), military count exceeds cap (180 > 120, headroom 0)
    state.units.soldier = 200
    state.freeSerfs = 50
    state.totalPopulation = 250

    const result = resolveOffensiveCampaign(
      state,
      500, // overwhelmingly beats enemy -> decisive victory (8% to 12% casualties)
      10,
      'soldiers',
      300,
      new PRNG(123),
      DEFAULT_ENGINE_CONFIG,
      'heartland',
    )

    expect(result.provinceWon).toBe(true)
    expect(result.loot.soldiers).toBeGreaterThan(0)
    // Soldiers suffered 8% to 12% casualties and received 0 new recruits because headroom was 0
    const dead = 200 - state.units.soldier!
    expect(dead).toBeGreaterThanOrEqual(16)
    expect(dead).toBeLessThanOrEqual(24)
    // All captured soldiers diverted to freeSerfs
    expect(state.freeSerfs).toBe(50 + result.loot.soldiers)
    // Total population reflects casualties (-20) plus admitted captives (+result.loot.soldiers)
    expect(state.totalPopulation).toBe(250 - dead + result.loot.soldiers)
    expect(state.totalPopulation).toBe(state.freeSerfs + state.units.soldier)
  })

  it('credits state.ap with defensive salvage upon victory without crediting quota', () => {
    const state = createInitialGameState()
    state.cumulativeApThisDeadline = 200
    state.ap = 500

    const tributeAp = 400
    const clash = resolveDefensiveClash(
      state,
      300, // Player forces
      20, // Enemy forces
      0,
      new PRNG(456),
      DEFAULT_ENGINE_CONFIG,
      tributeAp,
    )

    expect(clash.success).toBe(true)
    expect(clash.isCollapse).toBe(false)
    // Salvage credited to ap: ~25% of 400 * [0.8, 1.2] = 80 to 120
    expect(state.ap).toBeGreaterThan(500)
    // Cumulative AP remains untouched
    expect(state.cumulativeApThisDeadline).toBe(200)
  })

  it('enforces 2 campaigns maximum per expedition phase before transitioning to AWAIT_RESUME', () => {
    const state = createInitialGameState()
    state.phase = 'EXPEDITION'
    state.campaignsLaunchedThisDeadline = 0
    state.units.soldier = 50

    // First campaign
    const res1 = dispatch(state, { type: 'LAUNCH_ATTACK' })
    expect(res1.success).toBe(true)
    expect(state.campaignsLaunchedThisDeadline).toBe(1)
    expect(state.phase).toBe('EXPEDITION') // Still in expedition

    // Second campaign
    const res2 = dispatch(state, { type: 'LAUNCH_ATTACK' })
    expect(res2.success).toBe(true)
    expect(state.campaignsLaunchedThisDeadline).toBe(2)
    expect(state.phase).toBe('AWAIT_RESUME') // Auto-transition to AWAIT_RESUME
  })

  it('rejects RESUME_GOVERNANCE when state.deadline >= 10', () => {
    const state = createInitialGameState()
    state.phase = 'AWAIT_RESUME'
    state.deadline = 10

    const res = dispatch(state, { type: 'RESUME_GOVERNANCE' })
    expect(res.success).toBe(false)
    expect(res.error).toContain('Cannot resume governance beyond Deadline 10')
    expect(state.phase).toBe('AWAIT_RESUME')
    expect(state.deadline).toBe(10)
  })

  it('arms pendingDeadlineAudit if 100s deadline mark is reached during a crisis phase, executing it on active cycle resumption', () => {
    const state = createInitialGameState()
    state.deadline = 1
    state.deadlineTimeSeconds = 99.5
    state.ap = -10
    state.units.soldier = 50 // Negative net AP/s
    state.provinces = 2
    state.lombardBailoutAvailable = true
    state.bankruptcyGraceTimer = 20.5 // Crosses into LOMBARD_OFFER

    // Tick 1.0s: deadlineTimeSeconds reaches 100.0s while phase switches to LOMBARD_OFFER
    tick(state, 1.0, DEFAULT_ENGINE_CONFIG)
    expect(state.phase).toBe('LOMBARD_OFFER')
    expect(state.deadlineTimeSeconds).toBe(100.0)
    expect(state.pendingDeadlineAudit).toBe(true)

    // Resolve Lombard offer
    dispatch(state, { type: 'ACCEPT_LOMBARD_LOAN' }, DEFAULT_ENGINE_CONFIG)
    expect(state.phase).toBe('ACTIVE_CYCLE')

    // Next tick in ACTIVE_CYCLE immediately triggers the deferred audit assessment without integrating economy
    const tickAudit = tick(state, 1.0, DEFAULT_ENGINE_CONFIG)
    expect(state.pendingDeadlineAudit).toBe(false)
    expect(state.phase).toBe('AUDIT_ASSESSMENT')
    expect(tickAudit.deadlineCompleted).toBe(true)
    expect(tickAudit.consumedDt).toBe(0)
  })

  it('rejects an attack with no army', () => {
    const state = createInitialGameState()
    state.phase = 'EXPEDITION'
    state.units.soldier = 0
    state.units.man_at_arms = 0
    const before = state.campaignsLaunchedThisDeadline
    const res = dispatch(state, { type: 'LAUNCH_ATTACK' })
    expect(res.success).toBe(false)
    expect(state.phase).toBe('EXPEDITION')
    expect(state.campaignsLaunchedThisDeadline).toBe(before)
  })

  it('standing garrisons absorbs 60% of threat power', () => {
    const announce = (law: boolean): number => {
      const state = createInitialGameState()
      state.phase = 'COUNCIL_LAWS'
      state.deadline = 3
      state.currentLawDraft = ['law:standing_garrisons']
      const res = law
        ? dispatch(state, { type: 'ENACT_LAW', lawId: 'law:standing_garrisons' })
        : dispatch(state, { type: 'REJECT_LAWS' })
      expect(res.success).toBe(true)
      expect(state.phase).toBe('THREAT_HERALD')
      return state.currentThreatPower
    }
    const full = announce(false)
    expect(full).toBe(
      getThreatPower(DEFAULT_ENGINE_CONFIG.quotas.find((q) => q.deadline === 4)!.military),
    )
    expect(announce(true)).toBe(Math.round(full * 0.4))
  })

  it('the harsh frontier choice of the princely cousin raises threat power by 15%', () => {
    const state = createInitialGameState()
    state.phase = 'COUNCIL_LAWS'
    state.deadline = 3
    const choice = DILEMMAS_DATA['dilemma:princely_cousin']!.choices[1]!
    for (const effect of choice.effects) applyEffect(effect, state)
    dispatch(state, { type: 'REJECT_LAWS' })
    const quota = DEFAULT_ENGINE_CONFIG.quotas.find((q) => q.deadline === 4)!
    expect(state.currentThreatPower).toBe(Math.round(getThreatPower(quota.military) * 1.15))
  })

  describe('military laws and saves', () => {
    function encode(schemaVersion: number, state: unknown): string {
      return `${SAVE_PREFIX}${Buffer.from(
        JSON.stringify({ schemaVersion, timestamp: 1, state, archive: createArchiveData() }),
        'utf-8',
      ).toString('base64')}`
    }

    const target: CampaignTarget = {
      power: 40,
      uncertaintyMargin: 0.45,
      perceivedMin: 22,
      perceivedMax: 58,
      biome: 'farmlands',
      lootType: 'mixed',
      factionId: 'steppe_horsemen',
      isFalseLedger: false,
      isAmbush: true,
    }

    it('keeps military laws, flags and a campaign target through export and import', () => {
      const state = createInitialGameState()
      for (const lawId of [
        'law:standing_garrisons',
        'law:scorched_earth',
        'law:vanguard_drills',
        'law:officer_academies',
      ]) {
        for (const effect of LAWS_DATA[lawId]!.effects) applyEffect(effect, state)
        state.activeLaws.push(lawId)
      }
      state.currentTarget = { ...target }
      const imported = importSaveFromBase64(exportSaveToBase64(state, createArchiveData())).state
      expect(imported.activeModifiers).toEqual(state.activeModifiers)
      expect(imported.ruleFlags).toEqual(state.ruleFlags)
      expect(hasRule(imported, 'law:vanguard_drills')).toBe(true)
      expect(imported.currentTarget).toEqual(target)
    })

    it('rejects a saved target whose perceived band is invalid', () => {
      const base = { ...createInitialGameState() }
      const inverted = { ...base, currentTarget: { ...target, perceivedMin: 60, perceivedMax: 50 } }
      expect(() => importSaveFromBase64(encode(CURRENT_SCHEMA_VERSION, inverted))).toThrow(
        /currentTarget\.perceivedMin/,
      )
      const infinite = {
        ...base,
        currentTarget: { ...target, perceivedMax: null },
      }
      expect(() => importSaveFromBase64(encode(CURRENT_SCHEMA_VERSION, infinite))).toThrow(
        /currentTarget\.perceivedMax/,
      )
    })

    it('migrates schema 3 threat mitigation modifiers and targets', () => {
      const legacyTarget = {
        power: 40,
        uncertaintyMargin: 0.45,
        biome: 'farmlands',
        lootType: 'mixed',
        isFalseLedger: false,
        isAmbush: true,
      }
      const state = {
        ...createInitialGameState(),
        currentTarget: legacyTarget,
        activeModifiers: [
          {
            source: 'archive:spymaster_network',
            stat: 'threat_mitigation_rate',
            op: 'add',
            value: 0.12,
          },
          {
            source: 'dilemma:princely_cousin',
            stat: 'threat_mitigation_rate',
            op: 'addPct',
            value: -0.15,
          },
          { source: 'other', stat: 'threat_mitigation_rate', op: 'add', value: 1 },
          { source: 'kept', stat: 'gross_ap_rate', op: 'add', value: 1 },
        ],
      }
      const imported = importSaveFromBase64(encode(3, state)).state
      expect(imported.activeModifiers).toEqual([
        {
          source: 'archive:spymaster_network',
          stat: 'scout_uncertainty_margin',
          op: 'add',
          value: -0.12,
        },
        { source: 'dilemma:princely_cousin', stat: 'threat_power', op: 'mul', value: 1.15 },
        { source: 'kept', stat: 'gross_ap_rate', op: 'add', value: 1 },
      ])
      expect(imported.currentTarget?.perceivedMin).toBe(22)
      expect(imported.currentTarget?.perceivedMax).toBe(58)
      expect(imported.currentTarget?.factionId).toBe('steppe_horsemen')
    })

    it('composes standing garrisons and merit pay upkeep without overwriting', () => {
      const state = createInitialGameState()
      state.units.soldier = 50
      state.provinces = 3
      const plain = calculateUpkeep(state, DEFAULT_ENGINE_CONFIG)
      for (const lawId of ['law:standing_garrisons', 'law:merit_pay']) {
        for (const effect of LAWS_DATA[lawId]!.effects) applyEffect(effect, state)
      }
      const both = calculateUpkeep(state, DEFAULT_ENGINE_CONFIG)
      const unitUpkeep = 50 * UNITS_DATA.soldier.upkeepAp
      expect(both).toBeCloseTo(plain, 9)
      state.provinces = 4
      state.provinceBiomes = [...state.provinceBiomes, 'heartland']
      expect(calculateUpkeep(state, DEFAULT_ENGINE_CONFIG) - plain).toBeCloseTo(unitUpkeep * 0.3, 6)
    })

    it('composes threat power on a surprise raid', () => {
      const quota = DEFAULT_ENGINE_CONFIG.quotas.find((q) => q.deadline === 6)!
      const setup = (law: boolean): ReturnType<typeof createInitialGameState> => {
        const state = createInitialGameState()
        state.phase = 'SURPRISE_RAID'
        state.deadline = 6
        state.units.soldier = 18
        state.units.man_at_arms = 0
        if (law) {
          for (const effect of LAWS_DATA['law:standing_garrisons']!.effects) {
            applyEffect(effect, state)
          }
        }
        return state
      }
      const state = setup(true)
      const res = dispatch(state, { type: 'RESOLVE_RAID_DEFENSE' })
      const raidPower = Math.round(Math.round(0.5 * quota.military) * 0.4)
      expect(raidPower).toBe(15)
      const reference = setup(true)
      const expected = resolveDefensiveClash(
        reference,
        calculateMilitaryPower(reference),
        raidPower,
        0,
        undefined,
        DEFAULT_ENGINE_CONFIG,
        getThreatTributeAp(quota.apRate),
      )
      expect(res.events).toEqual(expected.events)
      expect(expected.success).toBe(true)
      const uncomposed = setup(false)
      const full = resolveDefensiveClash(
        uncomposed,
        calculateMilitaryPower(uncomposed),
        Math.round(0.5 * quota.military),
        0,
        undefined,
        DEFAULT_ENGINE_CONFIG,
        getThreatTributeAp(quota.apRate),
      )
      expect(full.success).toBe(false)
    })

    it('keeps the officer academies power bonus after a save round trip', () => {
      const state = createInitialGameState()
      state.units.soldier = 100
      state.units.sergeant = 10
      state.totalPopulation = 110
      state.freeSerfs = 0
      for (const effect of LAWS_DATA['law:officer_academies']!.effects) applyEffect(effect, state)
      const imported = importSaveFromBase64(exportSaveToBase64(state, createArchiveData())).state
      expect(calculateMilitaryPower(imported)).toBe(calculateMilitaryPower(state))
      expect(calculateGrossApRate(imported).total).toBe(calculateGrossApRate(state).total)
    })
  })
})

describe('Factions and scheduled threats (GAME_RULES 7.5, 8.1)', () => {
  const quotaOf = (deadline: number) =>
    DEFAULT_ENGINE_CONFIG.quotas.find((q) => q.deadline === deadline)!

  const heraldFor = (deadline: number) => {
    const state = createInitialGameState()
    state.deadline = deadline
    state.phase = 'COUNCIL_LAWS'
    dispatch(state, { type: 'REJECT_LAWS' }, DEFAULT_ENGINE_CONFIG)
    return state
  }

  it('mercenary threat tribute is 25% higher', () => {
    const state = heraldFor(5)
    expect(state.phase).toBe('THREAT_HERALD')
    expect(state.currentThreatId).toBe(6)
    expect(state.currentThreatTributeAp).toBe(Math.round(1.25 * 20 * quotaOf(6).apRate))
    expect(heraldFor(4).currentThreatTributeAp).toBe(20 * quotaOf(5).apRate)
  })

  it('clears the announced threat once it is resolved', () => {
    const state = heraldFor(2)
    expect(state.currentThreatId).toBe(3)
    state.ap = 1_000_000
    dispatch(state, { type: 'SELECT_THREAT_RESPONSE', response: 'tribute' }, DEFAULT_ENGINE_CONFIG)
    expect(state.currentThreatId).toBeNull()
    expect(state.phase).toBe('EXPEDITION')
  })

  it('keeps the threat announced when the tribute is refused', () => {
    const state = heraldFor(2)
    state.ap = 0
    const res = dispatch(state, { type: 'SELECT_THREAT_RESPONSE', response: 'tribute' })
    expect(res.success).toBe(false)
    expect(state.currentThreatId).toBe(3)
  })

  it('barons deploy armored veterans against a huge army', () => {
    const small = heraldFor(3)
    const base = getThreatPower(quotaOf(4).military)
    expect(small.currentThreatPower).toBe(base)

    const state = createInitialGameState()
    state.deadline = 3
    state.phase = 'COUNCIL_LAWS'
    state.units.soldier = Math.ceil(1.2 * quotaOf(4).military)
    state.totalPopulation += state.units.soldier
    dispatch(state, { type: 'REJECT_LAWS' }, DEFAULT_ENGINE_CONFIG)
    expect(state.currentThreatPower).toBe(Math.round(base * 1.1))
  })

  it('imperial legions take 2 provinces on collapse', () => {
    const state = heraldFor(9)
    expect(state.currentThreatId).toBe(10)
    state.provinces = 5
    state.provinceBiomes = ['heartland', 'farmlands', 'farmlands', 'trade_hub', 'wilderness']
    dispatch(state, { type: 'SELECT_THREAT_RESPONSE', response: 'defense' }, DEFAULT_ENGINE_CONFIG)
    expect(state.provinces).toBe(3)
    expect(state.provinceBiomes).toHaveLength(3)
  })

  it('a non imperial collapse takes a single province', () => {
    const state = heraldFor(3)
    state.provinces = 5
    state.provinceBiomes = ['heartland', 'farmlands', 'farmlands', 'trade_hub', 'wilderness']
    state.currentThreatPower = 100_000
    dispatch(state, { type: 'SELECT_THREAT_RESPONSE', response: 'defense' }, DEFAULT_ENGINE_CONFIG)
    expect(state.provinces).toBe(4)
  })

  it('imperial legions never take the realm below 0 provinces', () => {
    const state = heraldFor(9)
    state.provinces = 1
    state.provinceBiomes = ['heartland']
    dispatch(state, { type: 'SELECT_THREAT_RESPONSE', response: 'defense' }, DEFAULT_ENGINE_CONFIG)
    expect(state.provinces).toBe(0)
    expect(state.defeatReason).toBe('conquest')
  })

  it('zealots add 15 unrest and desert one soldier per 10 when unrest is above 60', () => {
    const state = heraldFor(6)
    expect(state.currentThreatId).toBe(7)
    state.unrest = 65
    state.units.soldier = 25
    state.totalPopulation += 25
    const popBefore = state.totalPopulation
    const res = resolveScheduledThreat(
      state,
      'defense',
      0,
      0,
      new PRNG(1),
      DEFAULT_ENGINE_CONFIG,
      FACTIONS_DATA.zealots.applyReactiveTrait(state, 0, 0, { militaryPower: 0, militaryQuota: 1 }),
    )
    expect(res.success).toBe(true)
    // 65 + 15 defection, then -5 for the repelled threat
    expect(state.unrest).toBe(75)
    expect(state.units.soldier).toBe(23 - Math.round((25 - 2) * 0.1))
    expect(state.totalPopulation).toBe(popBefore - 2 - Math.round((25 - 2) * 0.1))
  })

  it('zealot levy applies the 15 unrest before the 30 of the levy and the 5% casualties after desertions', () => {
    const state = createInitialGameState()
    state.unrest = 20
    state.units.soldier = 25
    state.totalPopulation += 25
    const popBefore = state.totalPopulation
    resolveScheduledThreat(state, 'levy', 0, 0, new PRNG(1), DEFAULT_ENGINE_CONFIG, {
      ...neutralTrait(0, 0),
      unrestDelta: 15,
      soldierDesertions: 2,
    })
    expect(state.unrest).toBe(65)
    expect(state.totalPopulation).toBe(popBefore - 2 - Math.round((popBefore - 2) * 0.05))
  })

  it('a zealot defection that reaches 100 unrest ends the run in revolution and keeps the phase', () => {
    const state = heraldFor(6)
    state.unrest = 80
    const res = dispatch(
      state,
      { type: 'SELECT_THREAT_RESPONSE', response: 'levy' },
      DEFAULT_ENGINE_CONFIG,
    )
    expect(res.success).toBe(true)
    expect(state.unrest).toBe(100)
    expect(state.isGameOver).toBe(true)
    expect(state.defeatReason).toBe('revolution')
    expect(state.phase).toBe('RUN_DEFEAT')
    expect(state.currentThreatId).toBeNull()
  })

  it('keeps the catalog factions and the campaign faction draw in sync', () => {
    const drawn = new Set<string>()
    for (let seed = 1; seed <= 400; seed++) {
      const state = createInitialGameState()
      drawn.add(generateCampaignTarget(state, DEFAULT_ENGINE_CONFIG, new PRNG(seed)).factionId)
    }
    expect([...drawn].sort()).toEqual(Object.keys(FACTIONS_DATA).sort())
  })

  it('campaign loot type follows the faction', () => {
    const expected: Record<string, string> = {
      outlaws: 'population',
      barons: 'soldiers',
      mercenaries: 'ap',
      zealots: 'population',
    }
    const seen = new Set<string>()
    const mismatches: string[] = []
    for (let seed = 1; seed <= 400; seed++) {
      const state = createInitialGameState()
      const target = generateCampaignTarget(state, DEFAULT_ENGINE_CONFIG, new PRNG(seed))
      seen.add(target.factionId)
      const loot = expected[target.factionId]
      if (loot !== undefined && target.lootType !== loot) mismatches.push(target.factionId)
    }
    expect(mismatches).toEqual([])
    expect([...seen].sort()).toEqual([
      'barons',
      'imperial_legions',
      'mercenaries',
      'outlaws',
      'steppe_horsemen',
      'zealots',
    ])
  })

  it('steppe horsemen double the scout uncertainty margin up to 0.9', () => {
    const margins: Record<string, number> = {}
    for (let seed = 1; seed <= 400; seed++) {
      const state = createInitialGameState()
      const target = generateCampaignTarget(state, DEFAULT_ENGINE_CONFIG, new PRNG(seed))
      margins[target.factionId] = target.uncertaintyMargin
    }
    expect(margins.steppe_horsemen).toBeCloseTo(0.9, 10)
    expect(margins.outlaws).toBeCloseTo(0.45, 10)

    const state = createInitialGameState()
    state.units.scout = 2
    for (let seed = 1; seed <= 400; seed++) {
      const target = generateCampaignTarget(state, DEFAULT_ENGINE_CONFIG, new PRNG(seed))
      const expectedMargin = target.factionId === 'steppe_horsemen' ? 0.42 : 0.21
      expect(target.uncertaintyMargin).toBeCloseTo(expectedMargin, 10)
    }
  })

  it('outlaws inflict 15% more civilian casualties on collapse when soldiers < 10', () => {
    const run = (extra: number) => {
      const state = createInitialGameState()
      state.provinces = 5
      state.provinceBiomes = ['heartland', 'farmlands', 'farmlands', 'trade_hub', 'wilderness']
      state.totalPopulation = 1000
      state.freeSerfs = 1000
      state.units = { ...state.units, peasant: 0 }
      resolveDefensiveClash(state, 0, 500, 0, new PRNG(5), DEFAULT_ENGINE_CONFIG, 0, {
        extraCivilianCasualtyRate: extra,
        extraProvincesLost: 0,
      })
      return 1000 - state.totalPopulation
    }
    expect(run(0.15)).toBeGreaterThan(run(0))
    expect([run(0), run(0.15)]).toEqual([172, 198])
  })
})

describe('Campaign target faction on save import', () => {
  const encode = (schemaVersion: number, state: unknown): string =>
    `${SAVE_PREFIX}${Buffer.from(
      JSON.stringify({ schemaVersion, timestamp: 1, state, archive: createArchiveData() }),
      'utf-8',
    ).toString('base64')}`
  const legacy = (lootType: string) => ({
    power: 40,
    uncertaintyMargin: 0.45,
    biome: 'farmlands',
    lootType,
    isFalseLedger: false,
    isAmbush: false,
  })

  it('maps the legacy loot type of a v3 target to its faction', () => {
    const expected: Record<string, string> = {
      ap: 'mercenaries',
      population: 'outlaws',
      soldiers: 'barons',
      mixed: 'steppe_horsemen',
    }
    for (const [loot, faction] of Object.entries(expected)) {
      const state = { ...createInitialGameState(), currentTarget: legacy(loot) }
      expect(importSaveFromBase64(encode(3, state)).state.currentTarget?.factionId).toBe(faction)
    }
  })

  it('rejects a v3 target with an unknown loot type', () => {
    const state = { ...createInitialGameState(), currentTarget: legacy('gold') }
    expect(() => importSaveFromBase64(encode(3, state))).toThrow(/currentTarget/)
  })

  it('rejects a missing or unknown factionId', () => {
    const target = generateCampaignTarget(
      createInitialGameState(),
      DEFAULT_ENGINE_CONFIG,
      new PRNG(1),
    )
    for (const factionId of [undefined, 'dragons', 7]) {
      const state = { ...createInitialGameState(), currentTarget: { ...target, factionId } }
      expect(() => importSaveFromBase64(encode(CURRENT_SCHEMA_VERSION, state))).toThrow(
        /currentTarget\.factionId/,
      )
    }
  })
})
