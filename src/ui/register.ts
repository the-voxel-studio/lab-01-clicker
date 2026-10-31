/**
 * The register of a reign: what it counts once the reign is over, and the closest feat left to win.
 *
 * @module ui/register
 */

import type { ArchiveData } from '@/core/archives'
import { DEFAULT_ENGINE_CONFIG } from '@/core/config'
import type { GameState } from '@/core/types'
import { FEAT_COPY } from '@/data/featCopy'
import { FEATS_DATA, type FeatId } from '@/data/feats'
import { IMPERIAL_BARONY_PROVINCES } from '@/ui/fortune'
import { formatCompact } from '@/ui/realmText'
import type { RunRecord } from '@/ui/runRecord'

/** Thresholds inline in `evaluateFeats`. */
const SCOUTS_GOAL = 20
const AP_GOAL = 1_000_000
const LAWS_GOAL = 6

/** A locked feat and how near the best reign came to it. */
export interface LockedFeat {
  id: FeatId
  hint: string
  /** In [0, 1]. */
  progress: number
  caption: string
}

/** Audits the reign came through: each strike is an audit it failed. */
export function auditsPassed(state: GameState): number {
  const outcome = state.lastAuditOutcome
  return outcome ? Math.max(0, outcome.deadline - state.strikes) : 0
}

function best(history: readonly RunRecord[], read: (record: RunRecord) => number, last: number) {
  return Math.max(last, ...history.map(read))
}

/** How far the reigns went towards a feat, as `[held, goal, caption]`. */
function reach(
  id: FeatId,
  history: readonly RunRecord[],
  state: GameState,
): [number, number, string] {
  const of = (
    held: number,
    goal: number,
    unit: string,
    prefix = 'Best',
  ): [number, number, string] => [
    held,
    goal,
    `${prefix} reign: ${formatCompact(held)} of the ${formatCompact(goal)} ${unit}`,
  ]
  switch (id) {
    case 'imperial_barony':
      return of(
        best(history, (run) => run.peakProvinces, state.peakProvinces),
        IMPERIAL_BARONY_PROVINCES,
        'towers',
      )
    case 'scout_butcher':
      return of(
        best(history, (run) => run.scoutsSacrificed, state.scoutsSacrificed),
        SCOUTS_GOAL,
        'scouts',
      )
    case 'croesus_of_the_realm':
      return of(
        best(history, (run) => run.totalCumulativeAp, state.totalCumulativeAp),
        AP_GOAL,
        'AP',
      )
    case 'the_six_seals':
      return of(state.peakActiveLaws, LAWS_GOAL, 'seals', 'Last')
    default:
      return of(
        best(history, (run) => run.deadlineReached, state.deadline),
        DEFAULT_ENGINE_CONFIG.balance.TOTAL_DEADLINES,
        'audits',
      )
  }
}

/** The locked feat nearest to completion, the first of the catalog on a tie; null when all are held. */
export function closestLockedFeat(
  archive: ArchiveData,
  history: readonly RunRecord[],
  state: GameState,
): LockedFeat | null {
  const locked = (Object.keys(FEATS_DATA) as FeatId[])
    .filter((id) => !archive.unlockedFeats.includes(id))
    .map((id) => {
      const [held, goal, caption] = reach(id, history, state)
      return { id, hint: FEAT_COPY[id].hint, progress: Math.min(1, held / goal), caption }
    })
  return locked.reduce<LockedFeat | null>(
    (closest, feat) => (closest && closest.progress >= feat.progress ? closest : feat),
    null,
  )
}
