/**
 * How the register speaks of a locked feat: a hint rather than the rule, and its mark.
 *
 * @module data/featCopy
 */

import type { FeatId } from '@/data/feats'
import type { GameIconKey } from '@/data/icons'

/** Hint and mark of each royal feat. */
export const FEAT_COPY: Record<FeatId, { hint: string; icon: GameIconKey }> = {
  royal_pacifist: { hint: 'A crown kept without a sword.', icon: 'shield' },
  scout_butcher: { hint: 'Twenty scouts for one good map.', icon: 'roleScout' },
  fiscal_paradise: { hint: 'A light tax, from first to last.', icon: 'coins' },
  iron_bailout: { hint: 'Owe the Lombard, and still win.', icon: 'defeatBankruptcy' },
  croesus_of_the_realm: { hint: 'A million sealed in one reign.', icon: 'archiveTreasury' },
  the_six_seals: { hint: 'Six laws, all at once.', icon: 'lawDecree' },
  unyielding_governance: { hint: 'Ten audits, and no pardon.', icon: 'crown' },
  imperial_barony: { hint: 'Eight towers bow to one.', icon: 'threatBastion' },
}
