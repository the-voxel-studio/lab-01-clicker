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
    'COMBAT_RESOLUTION',
    'RUN_VICTORY',
    'RUN_DEFEAT',
  ]

  const SAMPLE_COMMANDS: readonly Command[] = [
    { type: 'BUY_UNIT', unitId: 'peasant', count: 1 },
    { type: 'UNLOCK_PATENT', order: 'admin' },
    { type: 'SET_TAX_RATE', rate: 25 },
    { type: 'STAMP_DOCUMENT' },
    { type: 'COLONISE_PROVINCE' },
    { type: 'ENACT_EDICT', edictId: 'forced_tithe' },
    { type: 'TICK', dt: 1.0 },
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
    { type: 'RESOLVE_COMBAT' },
    { type: 'RESTART_RUN' },
  ]

  it('exhaustively validates the full phase-command permission matrix (12 phases x 21 commands)', () => {
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
    // Deadline 1 (Threats inactive)
    expect(getNextInterDeadlinePhase('AUDIT_ASSESSMENT', 1)).toBe('COUNCIL_DILEMMA')
    expect(getNextInterDeadlinePhase('COUNCIL_DILEMMA', 1)).toBe('COUNCIL_LAWS')
    // Before Deadline 3, skips THREAT_HERALD straight to EXPEDITION
    expect(getNextInterDeadlinePhase('COUNCIL_LAWS', 1)).toBe('EXPEDITION')
    expect(getNextInterDeadlinePhase('EXPEDITION', 1)).toBe('AWAIT_RESUME')
    expect(getNextInterDeadlinePhase('AWAIT_RESUME', 1)).toBe('ACTIVE_CYCLE')

    // Deadline 3 onwards (Crown Threats active)
    for (let deadline = 3; deadline <= 10; deadline++) {
      expect(getNextInterDeadlinePhase('COUNCIL_LAWS', deadline)).toBe('THREAT_HERALD')
      expect(getNextInterDeadlinePhase('THREAT_HERALD', deadline)).toBe('EXPEDITION')
    }
  })

  it('permits patent unlocks in active governance and inter-deadline resume', () => {
    const unlockCmd: Command = { type: 'UNLOCK_PATENT', order: 'people' }
    expect(() => assertCommandAllowed('ACTIVE_CYCLE', unlockCmd)).not.toThrow()
    expect(() => assertCommandAllowed('AWAIT_RESUME', unlockCmd)).not.toThrow()
    expect(() => assertCommandAllowed('AUDIT_ASSESSMENT', unlockCmd)).toThrow(/illegal/i)
  })
})
