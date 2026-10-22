/**
 * Royal Feats & Achievements Catalog (GAME_RULES §19).
 *
 * @module data/feats
 */

import type { GameState } from '@/core/types'

export type FeatId =
  | 'royal_pacifist'
  | 'scout_butcher'
  | 'fiscal_paradise'
  | 'iron_bailout'
  | 'croesus_of_the_realm'
  | 'the_six_seals'
  | 'unyielding_governance'
  | 'imperial_barony'

export interface FeatDef {
  id: FeatId
  title: string
  description: string
  rewardArchivePoints: number
}

export const FEATS_DATA: Record<FeatId, FeatDef> = {
  royal_pacifist: {
    id: 'royal_pacifist',
    title: 'Royal Pacifist',
    description: 'Win a run without recruiting a single military unit.',
    rewardArchivePoints: 0.5,
  },
  scout_butcher: {
    id: 'scout_butcher',
    title: 'Scout Butcher',
    description: 'Sacrifice >= 20 scouts in reconnaissance rerolls across a single run.',
    rewardArchivePoints: 0.5,
  },
  fiscal_paradise: {
    id: 'fiscal_paradise',
    title: 'Fiscal Paradise',
    description: 'Win a run maintaining tax rate <= 15% at all times.',
    rewardArchivePoints: 0.5,
  },
  iron_bailout: {
    id: 'iron_bailout',
    title: 'Iron Bailout',
    description: 'Survive a run after triggering the Lombard Bailout at >= 20 seconds of bankruptcy.',
    rewardArchivePoints: 0.5,
  },
  croesus_of_the_realm: {
    id: 'croesus_of_the_realm',
    title: 'Crœsus of the Realm',
    description: 'Produce > 1,000,000 cumulative AP in a single run.',
    rewardArchivePoints: 0.5,
  },
  the_six_seals: {
    id: 'the_six_seals',
    title: 'The Six Seals',
    description: 'Enact and maintain 6 active laws simultaneously.',
    rewardArchivePoints: 0.5,
  },
  unyielding_governance: {
    id: 'unyielding_governance',
    title: 'Unyielding Governance',
    description: 'Win a run with zero strikes (no Royal Pardon used).',
    rewardArchivePoints: 0.5,
  },
  imperial_barony: {
    id: 'imperial_barony',
    title: 'Imperial Barony',
    description: 'Control >= 8 provinces simultaneously.',
    rewardArchivePoints: 0.5,
  },
}

/**
 * Evaluates all unlocked royal feats based on the current GameState.
 *
 * @param state - The active GameState snapshot.
 * @returns Array of unlocked FeatId values.
 */
export function evaluateFeats(state: GameState): FeatId[] {
  const completed: FeatId[] = []

  if (state.isVictory && (state.militaryRecruitedCount ?? 0) === 0) {
    completed.push('royal_pacifist')
  }

  if ((state.scoutsSacrificed ?? 0) >= 20) {
    completed.push('scout_butcher')
  }

  if (state.isVictory && !state.taxRateViolated15) {
    completed.push('fiscal_paradise')
  }

  if (state.isVictory && state.lombardBailoutAccepted) {
    completed.push('iron_bailout')
  }

  if (state.totalCumulativeAp > 1_000_000) {
    completed.push('croesus_of_the_realm')
  }

  if (state.activeLaws.length >= 6) {
    completed.push('the_six_seals')
  }

  if (state.isVictory && state.strikes === 0) {
    completed.push('unyielding_governance')
  }

  if (state.provinces >= 8) {
    completed.push('imperial_barony')
  }

  return completed
}
