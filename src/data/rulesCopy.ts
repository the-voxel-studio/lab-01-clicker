/**
 * The plain rules of `How to reign`. Every figure is read from the balance, so the page cannot
 * disagree with the engine.
 *
 * @module data/rulesCopy
 */

import { DEFAULT_ENGINE_CONFIG } from '@/core/config'
import { UNITS_DATA } from '@/data/balance'
import { EDICT_ESCALATION_PER_USE } from '@/data/edicts'

const { balance } = DEFAULT_ENGINE_CONFIG

/** One rule of the realm. */
export interface RealmRule {
  title: string
  text: string
}

/** The rules, in the order a new ruler needs them. */
export const REALM_RULES: readonly RealmRule[] = [
  {
    title: 'The goal',
    text: `Pass ${balance.TOTAL_DEADLINES} audits. Each lasts ${balance.DEADLINE_DURATION_SECONDS} seconds of reign.`,
  },
  {
    title: 'An audit',
    text: 'The Crown counts AP each second, people and force. Meeting two of the three passes.',
  },
  {
    title: 'Unrest',
    text: `At 100 unrest the people overthrow you. Priests and festivals bring it down.`,
  },
  {
    title: 'Births',
    text: `Peasants and farmers raise births. A tax above ${balance.TAX_REFERENCE_RATE}% slows them, and they stop when the room is full.`,
  },
  {
    title: 'Room',
    text: 'Room is what your provinces can house. The Crown asks for people, not for room.',
  },
  {
    title: 'Force',
    text: `Battles and audits count force, not soldiers. Each soldier costs ${Math.round((UNITS_DATA.soldier.costRatio - 1) * 100)}% more than the last, and a man-at-arms holds ${UNITS_DATA.man_at_arms.baseValue} force.`,
  },
  {
    title: 'War',
    text: `One conquest each audit is free. Each further one raises all the Crown demands by ${Math.round(balance.CONQUEST_SURCHARGE_STEP * 100)}%, for good.`,
  },
  {
    title: 'Edicts',
    text: `One edict each audit. Each use of the tithe or the seizure costs ${Math.round(EDICT_ESCALATION_PER_USE * 100)}% more unrest.`,
  },
  {
    title: 'Double speed',
    text: `The ×2 button opens at the ${balance.FAST_FORWARD_MIN_DEADLINE}th audit.`,
  },
  {
    title: 'After a reign',
    text: 'A reign earns archive points. They buy lasting perks. They and your feats carry over to the next reign, and nothing else does.',
  },
]
