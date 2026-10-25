/**
 * Greedy ROI Bot, the baseline human (GAME_RULES §21, expected win rate 35% to 65%).
 *
 * @module __tests__/simulation/bots/greedyRoiBot
 */

import type { Command } from '@/core/types'
import { paybackPurchases, type PaybackProfile } from './payback'
import {
  BASE_DILEMMA_PREFERENCES,
  preferredDilemmaChoice,
  preferredLaw,
  safeThreatResponse,
  stampCommands,
  taxCommands,
  unrestCareCommands,
  type UnrestPolicy,
} from './council'
import type { BotStrategy } from './strategy'

/**
 * Stamps per second of the reference human: GAME_RULES §2.1 counts a player clicking 4 times per
 * second (the engine allows 12).
 */
export const GREEDY_STAMPS_PER_SECOND = 4

/** Purchases per decision at most. */
export const GREEDY_MAX_PURCHASES = 3

/** Payback weighing: every metric aimed at 110% of the current quota. */
export const GREEDY_PROFILE: PaybackProfile = {
  targets: { apRate: 1.1, pop: 1.1, military: 1.1 },
  minHorizonSeconds: 20,
  excludedUnits: ['clergy', 'prelate', 'scout', 'spymaster'],
  colonise: true,
}

/** Unrest care thresholds. */
export const GREEDY_UNREST_POLICY: UnrestPolicy = { calmAt: 40, festivalAt: 75 }

/** Dilemma choice ceiling on unrest. */
const DILEMMA_UNREST_CEILING = 60

/** Laws in order of preference: plain economic and housing gains. */
const LAW_PREFERENCES: readonly string[] = [
  'law:crown_monopolies',
  'law:royal_scriptorium',
  'law:census_edict',
  'law:primogeniture_decrees',
  'law:general_cadastre',
  'law:stamp_duty_monopoly',
  'law:imperial_bond_floating',
  'law:corvee_exemption_tax',
]

/** Preferred dilemma choices (0 when not listed): the shared base plus the AP gain. */
const DILEMMA_PREFERENCES: Readonly<Record<string, number>> = {
  ...BASE_DILEMMA_PREFERENCES,
  'dilemma:princely_cousin': 1,
}

/**
 * Greedy ROI Bot: buys the option with the lowest payback seconds.
 *
 * Heuristic (fixed, documented, deterministic): each second 4 stamps (GAME_RULES §2.1), tax kept
 * at the reference rate, unrest care (pacifier from 40 unrest, Grand Festival from 75), then up to
 * 3 purchases ranked by payback seconds among units, patents and colonisation (`payback.ts`),
 * every audited metric aimed at 110% of the current quota. Council: the first enactable law of an
 * economic preference list, else reject; dilemmas by a fixed table under an unrest ceiling of 60;
 * threats by the safe response rule; expeditions skipped; the Lombard bailout accepted.
 */
export const greedyRoiBotStrategy: BotStrategy = {
  name: 'Greedy ROI',

  governActive(state, { config }): Command[] {
    const commands = [
      ...stampCommands(state, GREEDY_STAMPS_PER_SECOND),
      ...taxCommands(state, config.balance.TAX_REFERENCE_RATE),
    ]
    const care = unrestCareCommands(state, config, GREEDY_UNREST_POLICY)
    if (care.length > 0) return [...commands, ...care]
    return [...commands, ...paybackPurchases(state, config, GREEDY_PROFILE, GREEDY_MAX_PURCHASES)]
  },

  resolveDilemma(state, { config }, dilemma): number {
    return preferredDilemmaChoice(
      state,
      config,
      dilemma,
      DILEMMA_PREFERENCES,
      DILEMMA_UNREST_CEILING,
    )
  },

  chooseLaw(state, { config }): Command {
    return preferredLaw(state, config, LAW_PREFERENCES)
  },

  answerThreat(state, { config }) {
    return safeThreatResponse(state, config)
  },

  planExpedition(): Command {
    return { type: 'SKIP_EXPEDITION' }
  },

  answerLombard(): boolean {
    return true
  },
}
