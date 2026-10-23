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

/** Dilemmas drafted for seed 42 with the easy quota config below (probed). */
const D1_DILEMMA = 'dilemma:cabinet_scarcity'
const D2_DILEMMA = 'dilemma:cabinet_scarcity'

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

    const runA = executeReplay(sampleJournal, 0.05, 50).state
    const runB = executeReplay(sampleJournal, 0.05, 50).state

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
    const runFine = executeReplay(sampleJournal, 0.05, 100).state

    // Medium frequency tick (dt = 0.5s)
    const runMedium = executeReplay(sampleJournal, 0.5, 100).state

    // Fast simulation tick (dt = 1.0s)
    const runCoarse = executeReplay(sampleJournal, 1.0, 100).state

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

    const finalState = executeReplay(multiDeadlineJournal, 0.05, 250, replayConfig).state
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

    const finalState = executeReplay(stalledJournal, 0.05, 200).state
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

    const fine = executeReplay(multiDeadlineJournal, 0.05, 150, replayConfig).state
    const coarse = executeReplay(multiDeadlineJournal, 0.7, 150, replayConfig).state

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

    const stateDefault = executeReplay(journal, 0.05, 10).state
    const stateCustom = executeReplay(journal, 0.05, 10, customConfig).state

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

  it('gives the same hash at dt 0.05 and dt 1.0', () => {
    const replayConfig = {
      ...DEFAULT_ENGINE_CONFIG,
      quotas: DEFAULT_ENGINE_CONFIG.quotas.map((q) => ({
        ...q,
        apRate: 1,
        pop: 50,
        military: 5,
      })),
    }

    const journal: ReplayJournal = {
      seed: 42,
      entries: [
        { timeSeconds: 5.0, command: { type: 'BUY_UNIT', unitId: 'scribe', count: 1 } },
        { timeSeconds: 12.5, command: { type: 'BUY_UNIT', unitId: 'peasant', count: 1 } },
        { timeSeconds: 33.3, command: { type: 'BUY_UNIT', unitId: 'scribe', count: 1 } },

        // Council after deadline 1 (t = 100)
        { timeSeconds: 100.0, command: { type: 'SUBMIT_AUDIT' } },
        {
          timeSeconds: 100.0,
          command: { type: 'RESOLVE_DILEMMA', dilemmaId: D1_DILEMMA, choiceIndex: 1 },
        },
        { timeSeconds: 100.0, command: { type: 'REJECT_LAWS' } },
        { timeSeconds: 100.0, command: { type: 'SKIP_EXPEDITION' } },
        { timeSeconds: 100.0, command: { type: 'RESUME_GOVERNANCE' } },

        // Council after deadline 2 (t = 200)
        { timeSeconds: 200.0, command: { type: 'SUBMIT_AUDIT' } },
        {
          timeSeconds: 200.0,
          command: { type: 'RESOLVE_DILEMMA', dilemmaId: D2_DILEMMA, choiceIndex: 1 },
        },
        { timeSeconds: 200.0, command: { type: 'REJECT_LAWS' } },
        { timeSeconds: 200.0, command: { type: 'SELECT_THREAT_RESPONSE', response: 'tribute' } },
        { timeSeconds: 200.0, command: { type: 'SKIP_EXPEDITION' } },
        { timeSeconds: 200.0, command: { type: 'RESUME_GOVERNANCE' } },
      ],
    }

    const fine = executeReplay(journal, 0.05, 205, replayConfig)
    const coarse = executeReplay(journal, 1.0, 205, replayConfig)

    expect(fine.rejected).toEqual([])
    expect(coarse.rejected).toEqual([])
    expect(fine.state.deadline).toBe(3)
    expect(fine.state.phase).toBe('ACTIVE_CYCLE')
    expect(fine.state.units.scribe).toBe(2)
    expect(fine.state.units.peasant).toBe(1)
    expect(getStateHash(fine.state)).toBe(getStateHash(coarse.state))
  })

  it('lands an entry off the step grid at the next step boundary for every dt', () => {
    const journal: ReplayJournal = {
      seed: 42,
      entries: [{ timeSeconds: 12.52, command: { type: 'BUY_UNIT', unitId: 'scribe', count: 1 } }],
    }

    expect(executeReplay(journal, 0.05, 12.5).state.units.scribe).toBe(0)
    expect(executeReplay(journal, 0.05, 12.55).state.units.scribe).toBe(1)

    const hashes = [0.05, 0.3, 0.7, 1.0].map((dt) => {
      const result = executeReplay(journal, dt, 20)
      expect(result.state.totalElapsedSeconds).toBe(20)
      expect(result.state.tickRemainderSeconds).toBe(0)
      return getStateHash(result.state)
    })
    expect(new Set(hashes).size).toBe(1)
  })

  it('reports rejected entries', () => {
    const journal: ReplayJournal = {
      seed: 42,
      entries: [
        { timeSeconds: 1.0, command: { type: 'BUY_UNIT', unitId: 'scribe', count: 0 } },
        { timeSeconds: 2.0, command: { type: 'BUY_UNIT', unitId: 'scribe', count: 1 } },
        { timeSeconds: 100.0, command: { type: 'SUBMIT_AUDIT' } },
        { timeSeconds: 100.0, command: { type: 'STAMP_DOCUMENT' } },
      ],
    }

    const result = executeReplay(journal, 0.05, 200)

    expect(result.rejected.map((r) => r.index)).toEqual([0, 3])
    for (const entry of result.rejected) {
      expect(entry.error.length).toBeGreaterThan(0)
    }
    expect(result.state.units.scribe).toBe(1)
    expect(result.state.phase).toBe('COUNCIL_DILEMMA')
    expect(result.state.totalElapsedSeconds).toBe(100)
  })

  it('hashes the whole state, including timers and modifier contents', () => {
    const base = createInitialGameState({ seed: 1234 })
    const baseHash = getStateHash(base)

    const timer = createInitialGameState({ seed: 1234 })
    timer.taxPromulgationTimer += 1
    expect(getStateHash(timer)).not.toBe(baseHash)

    const archive = createInitialGameState({ seed: 1234 })
    archive.archivePoints += 1
    expect(getStateHash(archive)).not.toBe(baseHash)

    const modA = createInitialGameState({ seed: 1234 })
    modA.activeModifiers.push({ source: 'test', stat: 'gross_ap_rate', op: 'add', value: 10 })
    const modB = createInitialGameState({ seed: 1234 })
    modB.activeModifiers.push({ source: 'test', stat: 'gross_ap_rate', op: 'add', value: 11 })
    expect(getStateHash(modA)).not.toBe(getStateHash(modB))

    const tiny = createInitialGameState({ seed: 1234 })
    tiny.ap += 1e-9
    expect(getStateHash(tiny)).toBe(baseHash)
  })
})
