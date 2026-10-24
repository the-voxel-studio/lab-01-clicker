/**
 * Bureaucrat expert bot: civil colonisation and administration (GAME_RULES §21, expected win rate
 * above 65%).
 *
 * @module __tests__/simulation/bots/bureaucratBot
 */

import type { Command } from '@/core/types'
import { expertProfileFor, paybackPurchases, type PaybackProfile } from './payback'
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

/** Stamps per second: every click token. */
const STAMPS_PER_SECOND = 12

/** Purchases per decision at most. */
const MAX_PURCHASES = 5

/**
 * Payback weighing after the opening: AP rate and population (the archetype's metrics) aimed at
 * 130% of the quota, military at 110% as a fallback. Population is projected at least 40 s ahead,
 * so colonies and housing are valued past the audit.
 */
const PROFILE: PaybackProfile = {
  targets: { apRate: 1.3, pop: 1.3, military: 1.1 },
  minHorizonSeconds: 40,
  excludedUnits: ['clergy', 'prelate', 'scout', 'spymaster'],
  colonise: true,
}

/** Unrest care thresholds. */
const UNREST_POLICY: UnrestPolicy = { calmAt: 30, festivalAt: 65 }

/** Dilemma choice ceiling on unrest. */
const DILEMMA_UNREST_CEILING = 50

/** Laws in order of preference: administration output, housing, then threat relief. */
const LAW_PREFERENCES: readonly string[] = [
  'law:royal_scriptorium',
  'law:crown_monopolies',
  'law:census_edict',
  'law:primogeniture_decrees',
  'law:general_cadastre',
  'law:monastic_granaries',
  'law:corvee_exemption_tax',
  'law:standing_garrisons',
  'law:imperial_bond_floating',
]

/**
 * Preferred dilemma choices (0 when not listed): the shared base plus administration first,
 * calm second.
 */
const DILEMMA_PREFERENCES: Readonly<Record<string, number>> = {
  ...BASE_DILEMMA_PREFERENCES,
  'dilemma:great_archive_fire': 1,
  'dilemma:astrologer_comet': 1,
}

/**
 * Bureaucrat expert bot: wins the AP rate and population audits through administration and civil
 * colonisation.
 *
 * Heuristic (fixed, documented, deterministic): each second every stamp token, tax kept at the
 * reference rate, unrest care (pacifier from 30 unrest, Grand Festival from 65), then up to 5
 * purchases ranked by payback seconds among units, patents and colonisation (`payback.ts`): the
 * shared expert opening up to deadline 3 (every metric at 120% of the quota), then AP rate and
 * population aimed at 130% of the current quota and military at 110%. Council: the
 * first enactable law of an administration and housing list, else reject; dilemmas by a fixed
 * table under an unrest ceiling of 50; threats by the safe response rule (tribute when the army is
 * too small); expeditions skipped; the Lombard bailout accepted.
 */
export const bureaucratBotStrategy: BotStrategy = {
  name: 'Bureaucrat',

  governActive(state, { config }): Command[] {
    const commands = [
      ...stampCommands(state, STAMPS_PER_SECOND),
      ...taxCommands(state, config.balance.TAX_REFERENCE_RATE),
    ]
    const care = unrestCareCommands(state, config, UNREST_POLICY)
    if (care.length > 0) return [...commands, ...care]
    return [
      ...commands,
      ...paybackPurchases(state, config, expertProfileFor(state, PROFILE), MAX_PURCHASES),
    ]
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
