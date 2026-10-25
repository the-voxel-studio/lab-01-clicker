/**
 * Quota blind Greedy bot: the calibration variant of the Greedy ROI bot (GAME_RULES §21).
 *
 * @module __tests__/simulation/bots/blindGreedyBot
 */

import type { Command } from '@/core/types'
import type { EngineConfig } from '@/core/config'
import { paybackPurchases, type PaybackProfile } from './payback'
import { stampCommands, taxCommands, unrestCareCommands } from './council'
import {
  GREEDY_MAX_PURCHASES,
  GREEDY_PROFILE,
  GREEDY_STAMPS_PER_SECOND,
  GREEDY_UNREST_POLICY,
  greedyRoiBotStrategy,
} from './greedyRoiBot'
import type { BotStrategy, ThreatResponse } from './strategy'

/**
 * The Greedy payback profile with the `relative` valuation: a 1% gain of population or military
 * power is worth a 1% gain of the gross AP rate. GAME_RULES §1.1 audits the three metrics with
 * equal weight (two out of three) and §21 sets each quota as the same multiple c of a median, so
 * without reading the quotas the neutral rule is to grow the three metrics in proportion.
 */
const BLIND_PROFILE: PaybackProfile = { ...GREEDY_PROFILE, valuation: 'relative' }

/** Unrest of the Urban Rebellion stage (GAME_RULES §6.5), which a levy must not reach. */
const REBELLION_UNREST = 90

/**
 * Threat rule that reads neither the announced power nor the tribute, both derived from the
 * quotas (GAME_RULES §8.1): the outcome of a defense depends on the power and a tribute on its
 * price, while the levy always repels the threat at a fixed cost (5% population, +30 unrest,
 * §8.2). So: levy while it keeps the unrest below the Urban Rebellion stage (§6.5), otherwise armed
 * defense. This is the levy clause of the shared `safeThreatResponse` rule, without its two
 * quota derived clauses.
 */
function blindThreatResponse(unrest: number, config: EngineConfig): ThreatResponse {
  return unrest + config.balance.LEVY_UNREST < REBELLION_UNREST ? 'levy' : 'defense'
}

/**
 * Quota blind Greedy bot, used only to calibrate the quotas.
 *
 * Heuristic: the Greedy ROI bot (4 stamps per second, reference tax, unrest care, up to 3 payback
 * purchases per second, the same laws, dilemmas, expeditions and Lombard answer) except that it
 * never reads a quota, the threat power, the tribute or the quota requirement: purchases are ranked
 * with `BLIND_PROFILE` and threats are answered by `blindThreatResponse`. Both rules are fixed from
 * the public rules above, not tuned on win rates.
 */
export const blindGreedyBotStrategy: BotStrategy = {
  ...greedyRoiBotStrategy,
  name: 'Blind Greedy',

  governActive(state, { config }): Command[] {
    const commands = [
      ...stampCommands(state, GREEDY_STAMPS_PER_SECOND),
      ...taxCommands(state, config.balance.TAX_REFERENCE_RATE),
    ]
    const care = unrestCareCommands(state, config, GREEDY_UNREST_POLICY)
    if (care.length > 0) return [...commands, ...care]
    return [...commands, ...paybackPurchases(state, config, BLIND_PROFILE, GREEDY_MAX_PURCHASES)]
  },

  answerThreat(state, { config }) {
    return blindThreatResponse(state.unrest, config)
  },
}
