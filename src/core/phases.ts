/**
 * RunPhase State Machine & Phase Transition Rules.
 * Governs the 6 inter-deadline phases, in-run active governance, and emergency crises.
 * Pure TypeScript, zero DOM/Vue dependencies.
 *
 * @module core/phases
 */

import type { Command } from './types'
import type { EngineConfig } from './config'

/**
 * Engine Run Phase State Machine.
 * Inter-deadline sequence follows GAME_RULES §8 exactly.
 */
export type RunPhase =
  // Inter-deadline sequence (GAME_RULES §8)
  | 'AUDIT_ASSESSMENT' // 1. Quotas evaluated, sanction/pardon or victory
  | 'COUNCIL_DILEMMA' // 2. Steward dilemma presentation
  | 'COUNCIL_LAWS' // 3. Council laws draft / reject
  | 'THREAT_HERALD' // 4. Upcoming threat announcement & response
  | 'EXPEDITION' // Old saves only: migration v6 moves it to AWAIT_RESUME
  | 'AWAIT_RESUME' // 6. Paused before unpausing, "Resume Governance" CTA

  // Active loop & Crisis states
  | 'ACTIVE_CYCLE' // Main ticking governance phase
  | 'SURPRISE_RAID' // Spontaneous border raid interrupting cycle
  | 'LOMBARD_OFFER' // Offered at 20s of bankruptcy grace timer (pauses countdown)
  | 'RUN_VICTORY' // Beat deadline 10
  | 'RUN_DEFEAT' // Game over

/** Allowed dispatchable commands per RunPhase. */
export const ALLOWED_COMMANDS_BY_PHASE: Record<RunPhase, readonly Command['type'][]> = {
  ACTIVE_CYCLE: [
    'BUY_UNIT',
    'DISBAND_UNIT',
    'SET_TAX_RATE',
    'STAMP_DOCUMENT',
    'COLONISE_PROVINCE',
    'ENACT_EDICT',
    'UNLOCK_PATENT',
    'LAUNCH_ATTACK',
    'RECON_PATROL',
    'TICK',
    'SET_PAUSED',
  ],
  AUDIT_ASSESSMENT: ['SUBMIT_AUDIT', 'SET_PAUSED'],
  COUNCIL_DILEMMA: ['RESOLVE_DILEMMA', 'SET_PAUSED'],
  COUNCIL_LAWS: ['ENACT_LAW', 'REJECT_LAWS', 'SET_PAUSED'],
  THREAT_HERALD: ['SELECT_THREAT_RESPONSE', 'SET_PAUSED'],
  // Left for the type only: migration v6 moves saved expeditions to the resume.
  EXPEDITION: ['SET_PAUSED'],
  AWAIT_RESUME: [
    'RESUME_GOVERNANCE',
    'LAUNCH_ATTACK',
    'RECON_PATROL',
    'BUY_UNIT',
    'DISBAND_UNIT',
    'COLONISE_PROVINCE',
    'SET_TAX_RATE',
    'UNLOCK_PATENT',
    'SET_PAUSED',
  ],
  SURPRISE_RAID: ['RESOLVE_RAID_DEFENSE', 'SET_PAUSED'],
  LOMBARD_OFFER: ['ACCEPT_LOMBARD_LOAN', 'REFUSE_LOMBARD_LOAN', 'SET_PAUSED'],
  RUN_VICTORY: ['RESTART_RUN'],
  RUN_DEFEAT: ['RESTART_RUN'],
}

/** Validates whether a command type is permitted in the given run phase. */
export function isCommandAllowedInPhase(phase: RunPhase, commandType: Command['type']): boolean {
  return ALLOWED_COMMANDS_BY_PHASE[phase]?.includes(commandType) ?? false
}

/**
 * Asserts that a command is legally permitted in the current RunPhase.
 * Throws an explicit error if the command is disallowed.
 *
 * @param phase - Current engine RunPhase.
 * @param command - The command attempting dispatch.
 * @throws Error if command is rejected for this phase.
 */
export function assertCommandAllowed(phase: RunPhase, command: Command): void {
  if (!isCommandAllowedInPhase(phase, command.type)) {
    throw new Error(
      `Command '${command.type}' is illegal during phase '${phase}'. Allowed commands: [${ALLOWED_COMMANDS_BY_PHASE[phase].join(', ')}]`,
    )
  }
}

/**
 * Sequential inter-deadline progression pipeline following GAME_RULES §8.
 *
 * Flow:
 * AUDIT_ASSESSMENT -> COUNCIL_DILEMMA -> COUNCIL_LAWS -> THREAT_HERALD -> AWAIT_RESUME -> ACTIVE_CYCLE
 *
 * @param currentPhase - The current inter-deadline phase.
 * @param deadline - The deadline index just evaluated (1 to 10).
 * @param config - Engine configuration that provides the herald window.
 * @returns The next RunPhase in the sequence.
 */
export function getNextInterDeadlinePhase(
  currentPhase: RunPhase,
  deadline: number,
  config: EngineConfig,
): RunPhase {
  switch (currentPhase) {
    case 'AUDIT_ASSESSMENT':
      // At deadline 10, passing audit triggers victory; failure triggers defeat.
      return 'COUNCIL_DILEMMA'

    case 'COUNCIL_DILEMMA':
      return 'COUNCIL_LAWS'

    case 'COUNCIL_LAWS':
      // Upcoming threat announced at D+1 from THREAT_HERALD_FIRST_DEADLINE to the one before the last
      return deadline >= config.balance.THREAT_HERALD_FIRST_DEADLINE &&
        deadline < config.balance.TOTAL_DEADLINES
        ? 'THREAT_HERALD'
        : 'AWAIT_RESUME'

    case 'THREAT_HERALD':
      return 'AWAIT_RESUME'

    case 'AWAIT_RESUME':
      return 'ACTIVE_CYCLE'

    default:
      return currentPhase
  }
}
