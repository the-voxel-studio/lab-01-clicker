/**
 * Core Headless Simulation Engine & Auditor Test Suite.
 * Validates delta-time tick loop, economic dynamics, audits, and defeat conditions.
 *
 * @module __tests__/unit/engine.spec
 */

import { describe, it, expect } from 'vitest'
import { tick, evaluateDeadlineAudit, calculateMaxPopulation } from '@/core/engine'
import { createInitialGameState } from '@/core/state'
import { dispatch } from '@/core/commands'
import { getStateHash } from '@/core/replay'

describe('Simulation Engine Tick Loop & Governance (Gate A & B)', () => {
  it('advances simulation delta-time and calculates exact economic yields', () => {
    const state = createInitialGameState()
    state.units.scribe = 10 // 10 * 0.5 = 5.0 AP/s gross

    const tickRes = tick(state, 1.0)
    expect(tickRes.dt).toBe(1.0)
    expect(state.tickIndex).toBe(20) // 20 fixed steps of 0.05 s
    expect(state.totalElapsedSeconds).toBe(1.0)

    // Gross AP includes Scribes (5.0 AP/s) + base poll tax (100 serfs * 0.02 * (25/25) = 2.0 AP/s) = 7.0 AP/s
    expect(tickRes.grossApGenerated).toBeCloseTo(7.0, 1)
    expect(state.ap).toBeGreaterThan(50)
  })

  it('gives the same full state hash for tick(1.0) and 20 x tick(0.05)', () => {
    const coarse = createInitialGameState({ seed: 7 })
    coarse.units.scribe = 10
    const fine = createInitialGameState({ seed: 7 })
    fine.units.scribe = 10

    tick(coarse, 1.0)
    for (let i = 0; i < 20; i++) tick(fine, 0.05)

    expect(coarse.tickIndex).toBe(20)
    expect(fine.tickIndex).toBe(20)
    expect(coarse.totalElapsedSeconds).toBe(1)
    expect(fine.totalElapsedSeconds).toBe(1)
    expect(coarse.tickRemainderSeconds).toBe(0)
    expect(fine.tickRemainderSeconds).toBe(0)
    expect(getStateHash(coarse)).toBe(getStateHash(fine))
  })

  it('runs one step for two tick(0.03) calls and carries 0.01 s', () => {
    const state = createInitialGameState()

    const first = tick(state, 0.03)
    expect(first.dt).toBe(0)
    expect(state.tickIndex).toBe(0)
    expect(state.tickRemainderSeconds).toBeCloseTo(0.03, 12)

    const second = tick(state, 0.03)
    expect(second.dt).toBe(0.05)
    expect(state.tickIndex).toBe(1)
    expect(state.totalElapsedSeconds).toBe(0.05)
    expect(state.tickRemainderSeconds).toBeCloseTo(0.01, 12)
  })

  it('keeps the remainder and runs no step while paused', () => {
    const state = createInitialGameState()
    tick(state, 0.03)
    state.isPaused = true
    tick(state, 1.0)
    expect(state.tickIndex).toBe(0)
    expect(state.tickRemainderSeconds).toBeCloseTo(0.03, 12)
  })

  it('triggers mid-deadline interim warning at 50 seconds without phase interruption', () => {
    const state = createInitialGameState()
    state.deadlineTimeSeconds = 49.5

    const tick1 = tick(state, 1.0) // Crosses 50.5s
    expect(state.interimWarningShown).toBe(true)
    expect(tick1.interimWarningTriggered).toBe(true)
    expect(state.phase).toBe('ACTIVE_CYCLE') // No phase interruption!

    const tick2 = tick(state, 1.0)
    expect(tick2.interimWarningTriggered).toBe(false)
  })

  it('concludes deadline at 100 seconds and transitions to AUDIT_ASSESSMENT', () => {
    const state = createInitialGameState()
    state.deadlineTimeSeconds = 99.5

    const tickRes = tick(state, 1.0)
    expect(tickRes.deadlineCompleted).toBe(true)
    expect(state.phase).toBe('AUDIT_ASSESSMENT')
  })

  it('evaluates Two-Out-Of-Three rule and Royal Pardon grace rule', () => {
    const state = createInitialGameState()
    expect(state.strikes).toBe(0)
    expect(state.provinces).toBe(3)

    // D1 quota failure: Strike 1 -> Royal Censure
    const audit1 = evaluateDeadlineAudit(state)
    expect(audit1.success).toBe(false)
    expect(audit1.royalPardonIssued).toBe(true)
    expect(state.strikes).toBe(1)
    expect(state.provinces).toBe(2)
    expect(state.isGameOver).toBe(false)

    // Strike 2 -> Execution
    const audit2 = evaluateDeadlineAudit(state)
    expect(audit2.success).toBe(false)
    expect(state.strikes).toBe(2)
    expect(state.isGameOver).toBe(true)
    expect(state.defeatReason).toBe('quota_failure')
    expect(state.phase).toBe('RUN_DEFEAT')
  })

  it('enforces the hard province floor of 1 during Royal Censure', () => {
    const state = createInitialGameState()
    state.provinces = 1 // Already at minimum floor

    evaluateDeadlineAudit(state)
    expect(state.strikes).toBe(1)
    expect(state.provinces).toBe(1) // Cannot reduce below 1
  })

  it('activates demographic overcrowding bleed when population exceeds housing capacity', () => {
    const state = createInitialGameState()
    // Housing capacity = 750 (3 provinces)
    state.totalPopulation = 800 // 50 over capacity
    state.freeSerfs = 800

    // Overcrowding bleed rate = 2.5 pop/s, proportional unrest rate = 0.10/s per 50 excess pop (§14.3)
    tick(state, 2.0)

    expect(state.totalPopulation).toBeCloseTo(800 - 2.5 * 2.0, 1)
    expect(state.unrest).toBeCloseTo(10 + 0.1 * 2.0, 1)
  })

  it('applies unrest stage penalties during simulation tick', () => {
    const state = createInitialGameState()

    // Fiscal boycott (unrest = 60 >= 50): -20% tax revenue
    state.unrest = 60
    const tickBoycott = tick(state, 1.0)
    expect(tickBoycott.crisisStage).toBe('fiscal_boycott')

    // Strife & Desertion (unrest = 80 >= 75): population growth frozen to 0
    state.unrest = 80
    const initialPop = state.totalPopulation
    tick(state, 1.0)
    expect(state.totalPopulation).toBe(initialPop)

    // Urban Rebellion (unrest = 95 >= 90): Scribe AP output halved
    state.unrest = 95
    state.units.scribe = 10
    const tickRebellion = tick(state, 1.0)
    expect(tickRebellion.crisisStage).toBe('urban_rebellion')

    // Total Revolution (unrest = 100): Realm collapse
    state.unrest = 100
    tick(state, 1.0)
    expect(state.isGameOver).toBe(true)
    expect(state.defeatReason).toBe('revolution')
    expect(state.phase).toBe('RUN_DEFEAT')
  })

  it('handles bankruptcy countdown and Lombard Bailout offer', () => {
    const state = createInitialGameState()
    state.ap = 0
    state.units.soldier = 50 // High upkeep creates negative net AP

    // Tick into negative treasury
    tick(state, 9.0) // 30 - 9 = 21s left
    expect(state.phase).toBe('ACTIVE_CYCLE')

    tick(state, 2.0) // Crosses 19s -> triggers LOMBARD_OFFER
    expect(state.phase).toBe('LOMBARD_OFFER')

    // Accept loan -> +2000 AP, -1 province, resumes ACTIVE_CYCLE
    const acceptRes = dispatch(state, { type: 'ACCEPT_LOMBARD_LOAN' })
    expect(acceptRes.success).toBe(true)
    expect(state.ap).toBeGreaterThan(1800)
    expect(state.provinces).toBe(2)
    expect(state.phase).toBe('ACTIVE_CYCLE')
  })

  it('triggers bankruptcy defeat if countdown expires without bailout', () => {
    const state = createInitialGameState()
    state.ap = 0
    state.units.soldier = 50
    state.lombardBailoutAvailable = false // Already used

    tick(state, 31.0) // Depletes full 30s grace timer
    expect(state.isGameOver).toBe(true)
    expect(state.defeatReason).toBe('bankruptcy')
    expect(state.phase).toBe('RUN_DEFEAT')
  })

  it('manages Royal Patent unlocking and Tier II unit recruitment requirements', () => {
    const state = createInitialGameState()
    state.ap = 2000

    // Try buying Clerk before patent unlock -> rejected
    const buyLocked = dispatch(state, { type: 'BUY_UNIT', unitId: 'clerk', count: 1 })
    expect(buyLocked.success).toBe(false)
    expect(buyLocked.error).toContain('Tier II patent is locked')

    // Unlock patent prerequisite checks:
    // Must reach Deadline 4
    const earlyUnlock = dispatch(state, { type: 'UNLOCK_PATENT', order: 'admin' })
    expect(earlyUnlock.success).toBe(false)
    expect(earlyUnlock.error).toContain('Institutional Maturity prerequisite not met')

    // Set deadline = 4, but < 12 Tier I units
    state.deadline = 4
    state.units.scribe = 5
    const fewUnitsUnlock = dispatch(state, { type: 'UNLOCK_PATENT', order: 'admin' })
    expect(fewUnitsUnlock.success).toBe(false)
    expect(fewUnitsUnlock.error).toContain('Order Mastery prerequisite not met')

    // Satisfy all prerequisites (Deadline 4, 12 Scribes, 600 AP fee)
    state.units.scribe = 12
    const validUnlock = dispatch(state, { type: 'UNLOCK_PATENT', order: 'admin' })
    expect(validUnlock.success).toBe(true)
    expect(state.unlockedPatents.admin).toBe(true)

    // Now buying Clerk succeeds!
    const buyClerk = dispatch(state, { type: 'BUY_UNIT', unitId: 'clerk', count: 1 })
    expect(buyClerk.success).toBe(true)
    expect(state.units.clerk).toBe(1)
  })

  it('executes forced_tithe edict in deadline 1', () => {
    const state = createInitialGameState()
    state.deadline = 1

    const titheRes = dispatch(state, { type: 'ENACT_EDICT', edictId: 'forced_tithe' })
    expect(titheRes.success).toBe(true)
    expect(state.unrest).toBe(45) // 10 + 35
    expect(state.lastEdictDeadline).toBe(1)
    expect(state.forcedTitheFreezeTimer).toBe(20)
  })

  it('rejects a second emergency edict within the same deadline', () => {
    const state = createInitialGameState()
    state.deadline = 1

    const firstRes = dispatch(state, { type: 'ENACT_EDICT', edictId: 'forced_tithe' })
    expect(firstRes.success).toBe(true)

    const secondRes = dispatch(state, { type: 'ENACT_EDICT', edictId: 'church_seizure' })
    expect(secondRes.success).toBe(false)
    expect(secondRes.error).toContain('Only one emergency edict is permitted per deadline')
  })

  it('executes church_seizure in deadline 2', () => {
    const state = createInitialGameState()
    state.deadline = 2
    state.lastEdictDeadline = 1

    const churchRes = dispatch(state, { type: 'ENACT_EDICT', edictId: 'church_seizure' })
    expect(churchRes.success).toBe(true)
    expect(state.ap).toBeGreaterThan(0)
    expect(state.activeModifiers.some((m) => m.source === 'edict:church_seizure')).toBe(true)
  })

  it('executes grand_festival in deadline 3 when funds are sufficient', () => {
    const state = createInitialGameState()
    state.deadline = 3
    state.lastEdictDeadline = 2
    state.ap = 2000
    state.unrest = 40

    const festivalRes = dispatch(state, { type: 'ENACT_EDICT', edictId: 'grand_festival' })
    expect(festivalRes.success).toBe(true)
    expect(state.unrest).toBe(20) // 40 - 20
    expect(state.ap).toBeLessThan(2000)
  })

  it('reads fresh housing capacity after buying notables outside ticks', () => {
    const state = createInitialGameState({
      phase: 'AWAIT_RESUME',
      ap: 10_000,
      deadline: 3,
      freeSerfs: 300,
      totalPopulation: 300,
    })
    const before = calculateMaxPopulation(state)
    dispatch(state, { type: 'BUY_UNIT', unitId: 'notable', count: 10 })
    expect(calculateMaxPopulation(state)).toBeGreaterThan(before)
    // GAME_RULES 6.1: 3 heartland x 250 = 750; 750 x (1 + 0.015 x 10) = 862.5, rounded up to 863
    expect(calculateMaxPopulation(state)).toBe(863)
  })
})
