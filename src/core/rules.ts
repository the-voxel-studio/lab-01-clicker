/**
 * Typed rule flags: runtime list and lookup.
 *
 * @module core/rules
 */

import type { GameState, RuleFlag } from './types'

/** Every known rule flag; `Record<RuleFlag, true>` keeps it in step with the `RuleFlag` union. */
const RULE_FLAGS: Record<RuleFlag, true> = {
  'law:auditors_inquisition': true,
  'law:census_edict': true,
  'law:chancery_red_tape': true,
  'law:corvee_exemption_tax': true,
  'law:crown_monopolies': true,
  'law:exceptional_tithe': true,
  'law:general_cadastre': true,
  'law:guerrilla_border_watch': true,
  'law:marshals_carte_blanche': true,
  'law:mercenary_capitulation': true,
  'law:merit_pay': true,
  'law:officer_academies': true,
  'law:papal_concordat': true,
  'law:parish_relief_registers': true,
  'law:sanctioned_plunder': true,
  'law:sanctuary_rights': true,
  'law:scorched_earth': true,
  'law:single_window_bureaucracy': true,
  'law:standing_garrisons': true,
  'law:sumptuary_edicts': true,
  'law:tithe_commutation': true,
  'law:vanguard_drills': true,
  'law_effect:pardon_forfeited': true,
}

/** Tells whether a value is a known rule flag. */
export function isRuleFlag(value: unknown): value is RuleFlag {
  return typeof value === 'string' && Object.hasOwn(RULE_FLAGS, value)
}

/** Tells whether a rule flag is raised in the game state. */
export function hasRule(state: GameState, flag: RuleFlag): boolean {
  return state.ruleFlags.includes(flag)
}
