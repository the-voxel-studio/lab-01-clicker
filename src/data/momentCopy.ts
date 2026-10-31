/**
 * Fixed words of the decision moments. Figures, names and costs come from the engine and its
 * catalogs through `ui/moments`.
 *
 * @module data/momentCopy
 */

/** Fixed copy of the moment letters. */
export const MOMENT_COPY = {
  audit: {
    clean: 'The Crown is satisfied.',
    narrow: 'The Crown lets it pass, this once.',
    pardon: 'The Crown grants its pardon, once.',
    pardonBody: (share: number) =>
      `It takes a province, if you can spare one, and ${share}% of your coffer. The next failure is the last.`,
    answer: 'Seal the verdict',
  },
  dilemma: { eyebrow: 'The steward asks' },
  laws: {
    eyebrow: 'The royal council',
    title: 'The council lays its laws before you.',
    reject: 'Reject the council',
    rejectDetail: '+1 archive point. No law is passed.',
  },
  herald: {
    body: 'Open your coffers, or we open your walls.',
    note: 'The council will not rise until you answer.',
    fight: 'Stand and fight',
    tribute: 'Pay the tribute',
    levy: 'Raise the levy',
    lastProvince: 'This is your last province.',
    fatalUnrest: 'Unrest would reach its end, and the reign with it.',
  },
  raid: {
    eyebrow: 'A raid at the border',
    title: 'Riders in the night.',
    body: 'They sent no herald and they want no tribute.',
    answer: 'Hold the border',
  },
  lombard: {
    eyebrow: 'The Lombard at your door',
    title: 'He offers to buy a province.',
    accept: 'Take the loan',
    refuse: 'Refuse him',
    refuseDetail: 'The countdown resumes. He will not ask again.',
  },
  blocked: {
    bear: 'The coffer cannot bear it',
    pay: 'The coffer cannot pay it',
    full: 'The council is full',
    marshal: 'The Marshal forbids it',
  },
} as const
