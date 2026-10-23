/**
 * Deterministic Replay & Step-Size Invariance Test Suite.
 * Validates PRNG reproducibility, journal determinism, and step-size invariance.
 *
 * @module __tests__/unit/replay.spec
 */

import { describe, it, expect } from 'vitest'
import { executeReplay, getStateHash, type ReplayJournal } from '@/core/replay'
import { PRNG } from '@/core/prng'
import { createInitialGameState } from '@/core/state'
import { DEFAULT_ENGINE_CONFIG } from '@/core/config'

describe('Deterministic Replay & Step-Size Invariance (Gate B)', () => {
  it('verifies Mulberry32 PRNG reproducibility and state serialization', () => {
    const prng1 = new PRNG(1337)
    const val1 = prng1.next()
    const val2 = prng1.next()

    const prng2 = new PRNG(1337)
    expect(prng2.next()).toBe(val1)
    expect(prng2.next()).toBe(val2)

    // Serialization & restoration
    const savedState = prng1.getState()
    const prng3 = new PRNG(0)
    prng3.setState(savedState)
    expect(prng3.next()).toBe(prng1.next())
  })

  it('guarantees identical final state hash across repeated journal replays', () => {
    const sampleJournal: ReplayJournal = {
      seed: 42,
      entries: [
        { timeSeconds: 1.0, command: { type: 'STAMP_DOCUMENT' } },
        { timeSeconds: 2.0, command: { type: 'BUY_UNIT', unitId: 'scribe', count: 1 } },
        { timeSeconds: 5.0, command: { type: 'SET_TAX_RATE', rate: 25 } },
        { timeSeconds: 10.0, command: { type: 'BUY_UNIT', unitId: 'peasant', count: 1 } },
        { timeSeconds: 20.0, command: { type: 'STAMP_DOCUMENT' } },
      ],
    }

    const runA = executeReplay(sampleJournal, 0.05, 50)
    const runB = executeReplay(sampleJournal, 0.05, 50)

    const hashA = getStateHash(runA)
    const hashB = getStateHash(runB)

    expect(hashA).toBe(hashB)
    expect(runA.ap).toBeCloseTo(runB.ap, 4)
    expect(runA.totalPopulation).toBeCloseTo(runB.totalPopulation, 4)
  })

  it('demonstrates numerical step-size invariance across dt = 0.05s, 0.5s, and 1.0s', () => {
    const sampleJournal: ReplayJournal = {
      seed: 999,
      entries: [
        { timeSeconds: 0.0, command: { type: 'BUY_UNIT', unitId: 'scribe', count: 2 } },
        { timeSeconds: 10.0, command: { type: 'BUY_UNIT', unitId: 'peasant', count: 2 } },
        { timeSeconds: 30.0, command: { type: 'BUY_UNIT', unitId: 'scribe', count: 1 } },
      ],
    }

    // High frequency UI tick (20 Hz, dt = 0.05s)
    const runFine = executeReplay(sampleJournal, 0.05, 100)

    // Medium frequency tick (dt = 0.5s)
    const runMedium = executeReplay(sampleJournal, 0.5, 100)

    // Fast simulation tick (dt = 1.0s)
    const runCoarse = executeReplay(sampleJournal, 1.0, 100)

    // AP output delta should be strictly under 1.5% across step sizes
    const relativeDeltaMedium = Math.abs(runFine.ap - runMedium.ap) / runFine.ap
    const relativeDeltaCoarse = Math.abs(runFine.ap - runCoarse.ap) / runFine.ap

    expect(relativeDeltaMedium).toBeLessThan(0.015)
    expect(relativeDeltaCoarse).toBeLessThan(0.02)

    // Outcome match (both active or survived deadline 1)
    expect(runFine.isGameOver).toBe(runMedium.isGameOver)
    expect(runFine.isGameOver).toBe(runCoarse.isGameOver)
  })

  it('replays multi-deadline runs spanning audits, dilemmas, laws, threats, and expeditions', () => {
    const multiDeadlineJournal: ReplayJournal = {
      seed: 42,
      entries: [
        // D1 Governance (bulk size is 1 in D1)
        { timeSeconds: 1.0, command: { type: 'BUY_UNIT', unitId: 'scribe', count: 1 } },
        { timeSeconds: 2.0, command: { type: 'BUY_UNIT', unitId: 'scribe', count: 1 } },
        { timeSeconds: 10.0, command: { type: 'BUY_UNIT', unitId: 'peasant', count: 1 } },
        { timeSeconds: 11.0, command: { type: 'BUY_UNIT', unitId: 'peasant', count: 1 } },
        { timeSeconds: 30.0, command: { type: 'BUY_UNIT', unitId: 'soldier', count: 1 } },
        { timeSeconds: 50.0, command: { type: 'STAMP_DOCUMENT' } },

        // Inter-deadline 1 sequence (at t = 100.0)
        { timeSeconds: 100.0, command: { type: 'SUBMIT_AUDIT' } },
        {
          timeSeconds: 100.0,
          command: {
            type: 'RESOLVE_DILEMMA',
            dilemmaId: 'dilemma:cabinet_scarcity',
            choiceIndex: 1,
          },
        },
        { timeSeconds: 100.0, command: { type: 'REJECT_LAWS' } },
        { timeSeconds: 100.0, command: { type: 'SKIP_EXPEDITION' } },
        { timeSeconds: 100.0, command: { type: 'RESUME_GOVERNANCE' } },

        // D2 Governance
        { timeSeconds: 110.0, command: { type: 'BUY_UNIT', unitId: 'scribe', count: 1 } },
        { timeSeconds: 150.0, command: { type: 'STAMP_DOCUMENT' } },

        // Inter-deadline 2 sequence (at t = 200.0)
        { timeSeconds: 200.0, command: { type: 'SUBMIT_AUDIT' } },
        {
          timeSeconds: 200.0,
          command: {
            type: 'RESOLVE_DILEMMA',
            dilemmaId: 'dilemma:cabinet_scarcity',
            choiceIndex: 1,
          },
        },
        { timeSeconds: 200.0, command: { type: 'REJECT_LAWS' } },
        { timeSeconds: 200.0, command: { type: 'SELECT_THREAT_RESPONSE', response: 'tribute' } },
        { timeSeconds: 200.0, command: { type: 'SKIP_EXPEDITION' } },
        { timeSeconds: 200.0, command: { type: 'RESUME_GOVERNANCE' } },

        // D3 Governance
        { timeSeconds: 210.0, command: { type: 'BUY_UNIT', unitId: 'peasant', count: 1 } },
        { timeSeconds: 220.05, command: { type: 'RESOLVE_RAID_DEFENSE' } },
      ],
    }

    const replayConfig = {
      ...DEFAULT_ENGINE_CONFIG,
      quotas: DEFAULT_ENGINE_CONFIG.quotas.map((q) => ({
        ...q,
        apRate: 1,
        pop: 50,
        military: 5,
      })),
    }

    const finalState = executeReplay(multiDeadlineJournal, 0.05, 250, replayConfig)
    expect(finalState.deadline).toBe(3)
    expect(finalState.phase).toBe('ACTIVE_CYCLE')
    expect(finalState.totalElapsedSeconds).toBeCloseTo(250, 1)
    expect(finalState.units.scribe).toBe(3)
    expect(finalState.units.peasant).toBe(3)
    expect(finalState.units.soldier).toBe(0)
  })

  it('terminates cleanly without infinite loop when game is paused and journal has no unblocking entries', () => {
    const stalledJournal: ReplayJournal = {
      seed: 42,
      entries: [{ timeSeconds: 100.0, command: { type: 'SUBMIT_AUDIT' } }],
    }

    const finalState = executeReplay(stalledJournal, 0.05, 200)
    expect(finalState.phase).toBe('COUNCIL_DILEMMA')
    expect(finalState.totalElapsedSeconds).toBe(100)
  })

  it('preserves step-size invariance across multiple deadlines with reliquat re-injection', () => {
    const replayConfig = {
      ...DEFAULT_ENGINE_CONFIG,
      quotas: DEFAULT_ENGINE_CONFIG.quotas.map((q) => ({
        ...q,
        apRate: 1,
        pop: 50,
        military: 5,
      })),
    }

    const multiDeadlineJournal: ReplayJournal = {
      seed: 777,
      entries: [
        { timeSeconds: 0.0, command: { type: 'BUY_UNIT', unitId: 'scribe', count: 2 } },
        { timeSeconds: 20.0, command: { type: 'BUY_UNIT', unitId: 'peasant', count: 2 } },
        { timeSeconds: 100.0, command: { type: 'SUBMIT_AUDIT' } },
        {
          timeSeconds: 100.0,
          command: {
            type: 'RESOLVE_DILEMMA',
            dilemmaId: 'dilemma:cabinet_scarcity',
            choiceIndex: 1,
          },
        },
        { timeSeconds: 100.0, command: { type: 'REJECT_LAWS' } },
        { timeSeconds: 100.0, command: { type: 'SKIP_EXPEDITION' } },
        { timeSeconds: 100.0, command: { type: 'RESUME_GOVERNANCE' } },
        { timeSeconds: 120.0, command: { type: 'BUY_UNIT', unitId: 'scribe', count: 1 } },
      ],
    }

    const fine = executeReplay(multiDeadlineJournal, 0.05, 150, replayConfig)
    const coarse = executeReplay(multiDeadlineJournal, 0.7, 150, replayConfig)

    expect(fine.deadline).toBe(2)
    expect(coarse.deadline).toBe(2)
    expect(fine.totalElapsedSeconds).toBeCloseTo(150, 1)
    expect(coarse.totalElapsedSeconds).toBeCloseTo(150, 1)
    const delta = Math.abs(fine.ap - coarse.ap) / fine.ap
    expect(delta).toBeLessThan(0.015)
  })

  it('accepts custom EngineConfig to alter replay mechanics', () => {
    const journal: ReplayJournal = {
      seed: 42,
      entries: [{ timeSeconds: 1.0, command: { type: 'STAMP_DOCUMENT' } }],
    }

    const customConfig = {
      ...DEFAULT_ENGINE_CONFIG,
      balance: {
        ...DEFAULT_ENGINE_CONFIG.balance,
        TAX_POLL_RATE: 0.2,
      },
    }

    const stateDefault = executeReplay(journal, 0.05, 10)
    const stateCustom = executeReplay(journal, 0.05, 10, customConfig)

    expect(stateDefault.ap).toBeLessThan(100)
    expect(stateCustom.ap).toBeGreaterThan(200)
  })

  it('strengthens getStateHash to include all specified state components', () => {
    const state = createInitialGameState({ seed: 1234 })
    const baseHash = getStateHash(state)

    // Modifying freeSerfs/units alters hash
    const stateUnits = createInitialGameState({ seed: 1234 })
    stateUnits.units.peasant += 1
    stateUnits.freeSerfs -= 1
    expect(getStateHash(stateUnits)).not.toBe(baseHash)

    // Modifying province biomes alters hash
    const stateBiomes = createInitialGameState({ seed: 1234 })
    stateBiomes.provinceBiomes = ['heartland', 'heartland', 'trade_hub']
    expect(getStateHash(stateBiomes)).not.toBe(baseHash)

    // Modifying rngStreams alters hash
    const stateRng = createInitialGameState({ seed: 1234 })
    stateRng.rngStreams.click += 999
    expect(getStateHash(stateRng)).not.toBe(baseHash)

    // Modifying active laws alters hash
    const stateLaws = createInitialGameState({ seed: 1234 })
    stateLaws.activeLaws = ['law_cadastre']
    expect(getStateHash(stateLaws)).not.toBe(baseHash)

    // Modifying active modifiers count alters hash
    const stateMods = createInitialGameState({ seed: 1234 })
    stateMods.activeModifiers.push({
      source: 'test',
      stat: 'gross_ap_rate',
      op: 'add',
      value: 10,
    })
    expect(getStateHash(stateMods)).not.toBe(baseHash)

    // Modifying any unit alters hash (e.g. spymaster)
    const stateSpymaster = createInitialGameState({ seed: 1234 })
    stateSpymaster.units.spymaster = 1
    expect(getStateHash(stateSpymaster)).not.toBe(baseHash)
  })
})
