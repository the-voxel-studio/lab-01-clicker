/**
 * Conqueror expert bot: aggressive plunder campaigns (GAME_RULES §21, expected win rate above 65%).
 *
 * @module __tests__/simulation/bots/conquerorBot
 */

import type { CampaignTarget, Command, GameState } from '@/core/types'
import type { EngineConfig } from '@/core/config'
import { calculateMilitaryPower } from '@/core/engine'
import { hasRule } from '@/core/rules'
import {
  EXPERT_OPENING_LAST_DEADLINE,
  expertProfileFor,
  paybackPurchases,
  type PaybackProfile,
} from './payback'
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
import { canRecruit } from './realm'
import type { BotStrategy } from './strategy'

/** Stamps per second: every click token. */
const STAMPS_PER_SECOND = 12

/** Purchases per decision at most. */
const MAX_PURCHASES = 5

/**
 * Payback weighing after the opening: military aimed at twice the quota, so the worst case clash
 * ratio stays above the capture threshold against the perceived bands the bot reads before each
 * attack, AP rate at 120% to pay the army, population at 110% (helped by captured provinces and
 * loot).
 */
const PROFILE: PaybackProfile = {
  targets: { apRate: 1.2, pop: 1.1, military: 2.0 },
  minHorizonSeconds: 20,
  excludedUnits: ['clergy', 'prelate', 'scout', 'spymaster'],
  colonise: false,
}

/** Scouts kept after the opening, and the reserve a recon patrol never spends. */
const SCOUT_TARGET = 3
const SCOUT_RESERVE = 1

/** Lowest worst case clash ratio the bot attacks at: just above the razor thin band. */
const ATTACK_RATIO_MARGIN = 0.01

/** Unrest care thresholds (campaigns move unrest both ways). */
const UNREST_POLICY: UnrestPolicy = { calmAt: 35, festivalAt: 70 }

/** Dilemma choice ceiling on unrest. */
const DILEMMA_UNREST_CEILING = 55

/** Laws in order of preference: military power, campaign odds, then housing. */
const LAW_PREFERENCES: readonly string[] = [
  'law:marshals_carte_blanche',
  'law:officer_academies',
  'law:vanguard_drills',
  'law:scorched_earth',
  'law:census_edict',
  'law:primogeniture_decrees',
  'law:sanctioned_plunder',
]

/** Preferred dilemma choices (0 when not listed): the shared base plus military first. */
const DILEMMA_PREFERENCES: Readonly<Record<string, number>> = {
  ...BASE_DILEMMA_PREFERENCES,
  'dilemma:princely_cousin': 1,
  'dilemma:smugglers_cove': 1,
}

/** Scout or spymaster purchase that keeps the reconnaissance corps staffed. */
function reconCommands(state: Readonly<GameState>, config: EngineConfig): Command[] {
  if (state.deadline <= EXPERT_OPENING_LAST_DEADLINE) return []
  if (state.units.scout < SCOUT_TARGET && canRecruit(state, 'scout', config)) {
    return [{ type: 'BUY_UNIT', unitId: 'scout', count: 1 }]
  }
  if (state.units.spymaster < 1 && canRecruit(state, 'spymaster', config)) {
    return [{ type: 'BUY_UNIT', unitId: 'spymaster', count: 1 }]
  }
  return []
}

/**
 * Clash ratio with the worst rolls against an enemy of `enemyPower`: the attacker's lowest roll
 * after siege friction over the fortified defender's highest roll.
 */
function worstClashRatio(
  state: Readonly<GameState>,
  config: EngineConfig,
  enemyPower: number,
): number {
  const b = config.balance
  const attackerRoll = hasRule(state, 'law:vanguard_drills')
    ? b.VANGUARD_ROLL_MIN
    : b.ATTACKER_ROLL_MIN
  const attack =
    calculateMilitaryPower(state, config) * (1 - b.ATTACKER_SIEGE_FRICTION) * attackerRoll
  const defense = enemyPower * (1 + b.DEFENDER_FORTIFICATION_BONUS) * b.DEFENDER_ROLL_MAX
  return defense > 0 ? attack / defense : Infinity
}

/** Worst case ratio that still captures the province (above the razor thin band). */
function captureRatio(config: EngineConfig): number {
  return 1 + config.balance.RAZOR_THIN_VICTORY_MARGIN + ATTACK_RATIO_MARGIN
}

/**
 * Expedition rule on the perceived band only: attack when the worst case against the top of the
 * band still captures the province and no ambush is revealed; otherwise send a recon patrol when a
 * scout above the reserve is left and the band is the problem (an ambush revealed, or the bottom of
 * the band would be captured); otherwise skip.
 */
function expeditionCommand(
  state: Readonly<GameState>,
  config: EngineConfig,
  target: CampaignTarget | null,
): Command {
  if (target === null || calculateMilitaryPower(state, config) <= 0) {
    return { type: 'SKIP_EXPEDITION' }
  }
  const ambushRevealed = target.revealedAmbush === true
  const required = captureRatio(config)
  if (!ambushRevealed && worstClashRatio(state, config, target.perceivedMax) >= required) {
    return { type: 'LAUNCH_ATTACK' }
  }
  const bandIsTheProblem =
    ambushRevealed || worstClashRatio(state, config, target.perceivedMin) >= required
  if (state.units.scout > SCOUT_RESERVE && bandIsTheProblem) return { type: 'RECON_PATROL' }
  return { type: 'SKIP_EXPEDITION' }
}

/**
 * Conqueror expert bot: a large army that captures provinces from the perceived band.
 *
 * Heuristic (fixed, documented, deterministic): each second every stamp token, tax kept at the
 * reference rate, unrest care (pacifier from 35 unrest, Grand Festival from 70), after the
 * opening three scouts and then one spymaster, then up to 5 purchases ranked by payback seconds
 * (`payback.ts`): the shared expert opening up to deadline 3 (every metric at 120% of the quota,
 * colonisation allowed), then units and patents only with military aimed at 200% of the current
 * quota, AP rate at 120% and population at 110%. Expeditions: attack from the perceived band
 * only (never the real power or the hidden flags), recon patrol when the band is the obstacle (see
 * `expeditionCommand`). Council: the first enactable law of a military list, else reject;
 * dilemmas by a fixed table under an unrest ceiling of 55; threats by the safe response rule; the
 * Lombard bailout accepted.
 */
export const conquerorBotStrategy: BotStrategy = {
  name: 'Conqueror',

  governActive(state, { config }): Command[] {
    const commands = [
      ...stampCommands(state, STAMPS_PER_SECOND),
      ...taxCommands(state, config.balance.TAX_REFERENCE_RATE),
    ]
    const care = unrestCareCommands(state, config, UNREST_POLICY)
    if (care.length > 0) return [...commands, ...care]
    const recon = reconCommands(state, config)
    if (recon.length > 0) return [...commands, ...recon]
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

  planExpedition(state, { config }): Command {
    return expeditionCommand(state, config, state.currentTarget)
  },

  answerLombard(): boolean {
    return true
  },
}
