/**
 * Where the realm stands at the audit if nothing changes: a linear estimate from today's rates.
 *
 * @module ui/projection
 */

import type { GameState } from '@/core/types'
import type { RealmRates } from '@/ui/effects'
import { formatCompact } from '@/ui/realmText'

/** The three quotas as the audit would read them. */
export interface AuditProjection {
  people: number
  ap: number
  force: number
  /** True when the room stops the people before the audit. */
  capped: boolean
}

/**
 * Projects the audit ahead; people stop at the room.
 *
 * @param rates - The rates of the realm.
 * @param secondsLeft - Seconds before the audit.
 */
export function projectAudit(
  state: GameState,
  rates: RealmRates,
  secondsLeft: number,
): AuditProjection {
  const growing = Math.max(0, secondsLeft - state.forcedTitheFreezeTimer)
  const grown = Math.max(state.totalPopulation, state.totalPopulation + rates.births * growing)
  return {
    people: Math.floor(Math.min(rates.room, grown)),
    capped: grown >= rates.room,
    ap: rates.grossAp,
    force: rates.force,
  }
}

/** Says how a projected figure stands against the Crown's demand. */
export function verdict(projected: number, demand: number): { met: boolean; text: string } {
  const gap = Math.ceil(demand - projected)
  return gap > 0
    ? { met: false, text: `${formatCompact(gap)} short` }
    : { met: true, text: `met, ${formatCompact(-gap)} to spare` }
}
