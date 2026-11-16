/**
 * The voice of each level: the lines a player meets most, colder in a stern reign and menacing in a
 * tyrannical one. Only the voice changes; figures and orders stay in the lines built around them.
 *
 * @module data/levelCopy
 */

import type { DifficultyLevel } from '@/data/levels'

/** The lines that have a harder voice. */
export const TONE_KEYS = [
  'auditClean',
  'auditNarrow',
  'auditPardon',
  'chronicleFailed',
  'chronicleSatisfied',
  'chronicleWine',
  'heraldBody',
  'counselAllMet',
  'counselFled',
] as const

/** One line with a voice by level. */
export type ToneKey = (typeof TONE_KEYS)[number]

const TONE: Record<ToneKey, Record<DifficultyLevel, string>> = {
  auditClean: {
    ordinary: 'The Crown is satisfied.',
    stern: 'The Crown has counted, and found no fault.',
    tyrannical: 'The Crown is satisfied. For now.',
  },
  auditNarrow: {
    ordinary: 'The Crown lets it pass, this once.',
    stern: 'The Crown lets it pass, and writes your name down.',
    tyrannical: 'The Crown lets it pass. It will not forget the shortfall.',
  },
  auditPardon: {
    ordinary: 'The Crown grants its pardon, once.',
    stern: 'The Crown grants its pardon, once, and coldly.',
    tyrannical: 'The Crown spares you, once. Its mercy is spent.',
  },
  chronicleFailed: {
    ordinary: 'Audit failed. The Crown marks a strike against you.',
    stern: 'Audit failed. The Crown marks a strike, and remembers.',
    tyrannical: 'Audit failed. The Crown marks a strike and sends its bailiffs to watch you.',
  },
  chronicleSatisfied: {
    ordinary: 'The Crown is satisfied.',
    stern: 'The Crown says nothing.',
    tyrannical: 'The Crown counts it twice.',
  },
  chronicleWine: {
    ordinary: 'Audit passed. The Crown sends a cask of wine and a warning.',
    stern: 'Audit passed. The Crown sends no wine, only a warning.',
    tyrannical: 'Audit passed. The Crown sends a warning sealed in black wax.',
  },
  heraldBody: {
    ordinary: 'Open your coffers, or we open your walls.',
    stern: 'Open your coffers, or we open your walls. No one rides to help you.',
    tyrannical: 'Open your coffers, or we open your walls. The Crown will not mourn you.',
  },
  counselAllMet: {
    ordinary: 'Every quota is met. Keep the realm quiet.',
    stern: 'Every quota is met. The Crown will ask more.',
    tyrannical: 'Every quota is met. Do not let the Crown find a gap.',
  },
  counselFled: {
    ordinary: 'Your counsellors have fled the castle.',
    stern: 'Your counsellors have fled. The halls are cold.',
    tyrannical: 'Your counsellors have fled before the Crown comes for them.',
  },
}

/**
 * A line in the voice of the level.
 *
 * @param level - Level of the reign.
 * @param key - The line.
 */
export function toneFor(level: DifficultyLevel, key: ToneKey): string {
  return TONE[key][level]
}
