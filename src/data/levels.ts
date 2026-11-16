/**
 * The levels of a reign: how hard the Crown demands, what a conquest costs and how fast the realm
 * rots on screen. Chosen at the seal, fixed for the whole reign.
 *
 * @module data/levels
 */

/** Level of a reign. */
export type DifficultyLevel = 'ordinary' | 'stern' | 'tyrannical'

/** The levels in the order they are offered, the gentlest first. */
export const DIFFICULTY_LEVELS: readonly DifficultyLevel[] = ['ordinary', 'stern', 'tyrannical']

/** What a level changes. */
export interface LevelData {
  /** Name shown to the player. */
  name: string
  /** One line on what the Crown demands and what a conquest costs. */
  description: string
  /** Multiplies the three quotas from audit 5, ramped in before (`rampedFactor`). */
  quotaFactor: number
  /** `CONQUEST_SURCHARGE_STEP` of the reign. */
  surchargeStep: number
  /** Multiplies the dread score before its clamp: the realm rots sooner. */
  dreadFactor: number
}

/** Each level and what it changes; `ordinary` is the game as it always was. */
export const LEVEL_DATA: Record<DifficultyLevel, LevelData> = {
  ordinary: {
    name: 'Ordinary',
    description: 'The Crown asks its usual due. Each conquest past the free one raises it by 5%.',
    quotaFactor: 1,
    surchargeStep: 0.05,
    dreadFactor: 1,
  },
  stern: {
    name: 'Stern',
    description:
      'The Crown asks up to 28% more, in full from the fifth audit. Each conquest past the free one adds 10%.',
    quotaFactor: 1.28,
    surchargeStep: 0.1,
    dreadFactor: 1.2,
  },
  tyrannical: {
    name: 'Tyrannical',
    description:
      'The Crown asks up to 60% more, in full from the fifth audit. Each conquest past the free one adds 15%.',
    quotaFactor: 1.6,
    surchargeStep: 0.15,
    dreadFactor: 1.4,
  },
}

/**
 * Share of a level's extra demand applied at audits 1, 2, 3 and 4; from audit 5 on the whole factor
 * applies. The opening audits stay as in an ordinary reign so a hard reign does not die at audit 2.
 */
export const QUOTA_RAMP: readonly number[] = [0, 0, 1 / 3, 2 / 3]

/**
 * The quota factor of a level at one audit, ramped in over the first audits.
 *
 * @param quotaFactor - Full factor of the level.
 * @param deadline - Audit number, from 1.
 * @returns 1 at audits 1 and 2, the full factor from audit 5.
 */
export function rampedFactor(quotaFactor: number, deadline: number): number {
  const share = QUOTA_RAMP[deadline - 1] ?? 1
  return 1 + (quotaFactor - 1) * share
}

/** True when the value is one of the three level ids. */
export function isDifficultyLevel(value: unknown): value is DifficultyLevel {
  return typeof value === 'string' && (DIFFICULTY_LEVELS as readonly string[]).includes(value)
}
