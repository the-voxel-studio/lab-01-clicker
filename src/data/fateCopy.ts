/**
 * Words of the fate of a reign. Ordinals and shortfalls come from the state through `ui/fate`.
 *
 * @module data/fateCopy
 */

import type { RunOutcome } from '@/ui/runRecord'

/** Title of each fate, and the epitaph the register keeps; a victory needs no epitaph. */
export const FATE: Record<RunOutcome, { title: string; epitaph: string | null }> = {
  quota_failure: { title: 'Struck from the rolls.', epitaph: 'Struck from the rolls.' },
  revolution: { title: 'The people came at dawn.', epitaph: 'The people came at dawn.' },
  bankruptcy: { title: 'The Lombard took the rest.', epitaph: 'The Lombard took the rest.' },
  conquest: { title: 'I am without a kingdom.', epitaph: 'Sum sine regno.' },
  abandoned: { title: 'You laid down the crown.', epitaph: 'You laid down the crown.' },
  victory: { title: 'Regnavi.', epitaph: null },
}

/** Number words of the audit count; a count outside it is written in figures. */
export const COUNT_WORDS: Record<number, string> = { 10: 'Ten' }
