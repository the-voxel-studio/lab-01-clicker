/**
 * RunPhase Finite State Machine & Command Permissions Test Suite.
 * Exhaustively validates phase transition pipelines and permission matrices.
 *
 * @module __tests__/unit/phases.spec
 */

import { describe, it, expect } from 'vitest'
import {
  assertCommandAllowed,
  getNextInterDeadlinePhase,
  ALLOWED_COMMANDS_BY_PHASE,
  isCommandAllowedInPhase,
} from '@/core/phases'
import type { RunPhase, Command } from '@/data/balance'
import { dispatch } from '@/core/commands'
import { isFastForwardUnlocked, tick } from '@/core/engine'
import { createInitialGameState } from '@/core/state'

describe('RunPhase State Machine & Permissions Matrix (Gate B)', () => {
  const ALL_PHASES: readonly RunPhase[] = [
    'ACTIVE_CYCLE',
    'AUDIT_ASSESSMENT',
    'COUNCIL_DILEMMA',
    'COUNCIL_LAWS',
    'THREAT_HERALD',
    'EXPEDITION',
    'AWAIT_RESUME',
    'SURPRISE_RAID',
    'LOMBARD_OFFER',
    'RUN_VICTORY',
    'RUN_DEFEAT',
  ]

  const SAMPLE_COMMANDS: readonly Command[] = [
    { type: 'BUY_UNIT', unitId: 'peasant', count: 1 },
    { type: 'DISBAND_UNIT', unitId: 'peasant', count: 1 },
    { type: 'UNLOCK_PATENT', order: 'admin' },
    { type: 'SET_TAX_RATE', rate: 25 },
    { type: 'STAMP_DOCUMENT' },
    { type: 'COLONISE_PROVINCE' },
    { type: 'ENACT_EDICT', edictId: 'forced_tithe' },
    { type: 'TICK', dt: 1.0 },
    { type: 'SET_PAUSED', paused: true },
    { type: 'SUBMIT_AUDIT' },
    { type: 'RESOLVE_DILEMMA', dilemmaId: 'd1', choiceIndex: 0 },
    { type: 'ENACT_LAW', lawId: 'law_1' },
    { type: 'REJECT_LAWS' },
    { type: 'SELECT_THREAT_RESPONSE', response: 'defense' },
    { type: 'LAUNCH_ATTACK' },
    { type: 'RECON_PATROL' },
    { type: 'SKIP_EXPEDITION' },
    { type: 'RESUME_GOVERNANCE' },
    { type: 'RESOLVE_RAID_DEFENSE' },
    { type: 'ACCEPT_LOMBARD_LOAN' },
    { type: 'REFUSE_LOMBARD_LOAN' },
    { type: 'RESTART_RUN' },
  ]

  it('exhaustively validates the full phase-command permission matrix (11 phases x 22 commands)', () => {
    for (const phase of ALL_PHASES) {
      const allowedList = ALLOWED_COMMANDS_BY_PHASE[phase]
      expect(allowedList).toBeDefined()

      for (const cmd of SAMPLE_COMMANDS) {
        const isAllowed = isCommandAllowedInPhase(phase, cmd.type)
        const inAllowedList = allowedList.includes(cmd.type)
        expect(isAllowed).toBe(inAllowedList)

        let threwError = false
        try {
          assertCommandAllowed(phase, cmd)
        } catch {
          threwError = true
        }
        expect(threwError).toBe(!isAllowed)
      }
    }
  })

  it('progresses through inter-deadline phases according to GAME_RULES §8', () => {
    // Deadline 1 (Threat herald inactive, announced at D+1 from D2)
    expect(getNextInterDeadlinePhase('AUDIT_ASSESSMENT', 1)).toBe('COUNCIL_DILEMMA')
    expect(getNextInterDeadlinePhase('COUNCIL_DILEMMA', 1)).toBe('COUNCIL_LAWS')
    expect(getNextInterDeadlinePhase('COUNCIL_LAWS', 1)).toBe('EXPEDITION')
    expect(getNextInterDeadlinePhase('EXPEDITION', 1)).toBe('AWAIT_RESUME')
    expect(getNextInterDeadlinePhase('AWAIT_RESUME', 1)).toBe('ACTIVE_CYCLE')

    // Deadlines 2 to 9 (Herald announces upcoming threat D+1 for D3..D10)
    for (let deadline = 2; deadline <= 9; deadline++) {
      expect(getNextInterDeadlinePhase('COUNCIL_LAWS', deadline)).toBe('THREAT_HERALD')
      expect(getNextInterDeadlinePhase('THREAT_HERALD', deadline)).toBe('EXPEDITION')
    }

    // Deadline 10 (No further threats beyond D10)
    expect(getNextInterDeadlinePhase('COUNCIL_LAWS', 10)).toBe('EXPEDITION')
  })

  it('permits patent unlocks in active governance and inter-deadline resume', () => {
    const unlockCmd: Command = { type: 'UNLOCK_PATENT', order: 'people' }
    expect(() => assertCommandAllowed('ACTIVE_CYCLE', unlockCmd)).not.toThrow()
    expect(() => assertCommandAllowed('AWAIT_RESUME', unlockCmd)).not.toThrow()
    expect(() => assertCommandAllowed('AUDIT_ASSESSMENT', unlockCmd)).toThrow(/illegal/i)
  })

  it('pauses and resumes the active cycle', () => {
    const state = createInitialGameState({ seed: 1337 })

    expect(dispatch(state, { type: 'SET_PAUSED', paused: true }).success).toBe(true)
    expect(state.isPaused).toBe(true)
    tick(state, 1)
    expect(state.deadlineTimeSeconds).toBe(0)

    expect(dispatch(state, { type: 'SET_PAUSED', paused: false }).success).toBe(true)
    expect(state.isPaused).toBe(false)
    tick(state, 1)
    expect(state.deadlineTimeSeconds).toBe(1)
  })

  it('unlocks fast forward at deadline 5', () => {
    const state = createInitialGameState({ seed: 1337 })

    state.deadline = 4
    expect(isFastForwardUnlocked(state)).toBe(false)
    state.deadline = 5
    expect(isFastForwardUnlocked(state)).toBe(true)
  })

  it('restarts with a new deterministic seed', () => {
    const restartFromDefeat = (): number => {
      const state = createInitialGameState({ seed: 1337 })
      state.phase = 'RUN_DEFEAT'
      expect(dispatch(state, { type: 'RESTART_RUN' }).success).toBe(true)
      return state.seed
    }

    const firstSeed = restartFromDefeat()
    const secondSeed = restartFromDefeat()
    expect(firstSeed).toBe(secondSeed)
    expect(firstSeed).not.toBe(1337)
  })

  it('clears the interim on-track flag when governance resumes', () => {
    const state = createInitialGameState({ seed: 1337 })
    state.phase = 'AWAIT_RESUME'
    state.interimWarningOnTrack = true

    expect(dispatch(state, { type: 'RESUME_GOVERNANCE' }).success).toBe(true)
    expect(state.interimWarningOnTrack).toBeNull()
  })
})
