/**
 * RunPhase State Machine & Phase Transition Rules.
 * Governs the 6 inter-deadline phases, in-run active governance, and emergency crises.
 *
 * @module core/phases
 */

import {
  type RunPhase,
  type Command,
  ALLOWED_COMMANDS_BY_PHASE,
  isCommandAllowedInPhase,
} from '@/data/balance'

export {
  type RunPhase,
  ALLOWED_COMMANDS_BY_PHASE,
  isCommandAllowedInPhase,
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
      `Command '${command.type}' is illegal during phase '${phase}'. Allowed commands: [${ALLOWED_COMMANDS_BY_PHASE[phase].join(', ')}]`
    )
  }
}

/**
 * Sequential inter-deadline progression pipeline following GAME_RULES §8.
 *
 * Flow:
 * AUDIT_ASSESSMENT -> COUNCIL_DILEMMA -> COUNCIL_LAWS -> THREAT_HERALD -> EXPEDITION -> AWAIT_RESUME -> ACTIVE_CYCLE
 *
 * @param currentPhase - The current inter-deadline phase.
 * @param deadline - The deadline index just evaluated (1 to 10).
 * @returns The next RunPhase in the sequence.
 */
export function getNextInterDeadlinePhase(currentPhase: RunPhase, deadline: number): RunPhase {
  switch (currentPhase) {
    case 'AUDIT_ASSESSMENT':
      // At deadline 10, passing audit triggers victory; failure triggers defeat.
      // Handled by the auditor; if continuing:
      return 'COUNCIL_DILEMMA'

    case 'COUNCIL_DILEMMA':
      return 'COUNCIL_LAWS'

    case 'COUNCIL_LAWS':
      // Threats commence at Deadline 3 onwards
      return deadline >= 3 ? 'THREAT_HERALD' : 'EXPEDITION'

    case 'THREAT_HERALD':
      return 'EXPEDITION'

    case 'EXPEDITION':
      return 'AWAIT_RESUME'

    case 'AWAIT_RESUME':
      return 'ACTIVE_CYCLE'

    default:
      return currentPhase
  }
}
