/**
 * Counsel line of the run screen: one counsellor names the quota furthest behind and offers a
 * purchase the engine accepts now (design 4.2, fourth pass). The offer is checked by dispatching
 * it on a copy of the run, so it never shows a button the engine would refuse.
 *
 * @module ui/counsel
 */

import { dispatch } from '@/core/commands'
import { DEFAULT_ENGINE_CONFIG } from '@/core/config'
import { calculateMaxPopulation } from '@/core/engine'
import { calculateMaxAffordableUnits, getMaxBulkSize } from '@/core/formulas'
import type { Command, GameState, UnitId } from '@/core/types'
import { UNITS_DATA } from '@/data/balance'
import type { QuotaView } from '@/stores/game'
import type { DreadBand } from '@/ui/dread'
import { formatCompact } from '@/ui/realmText'

/** What the counsel line shows: who speaks, what they say, and the purchase they offer. */
export interface Counsel {
  title: string
  text: string
  action: { label: string; command: Command } | null
}

const WARNING_SECONDS = 30
const ROUND_PURCHASE = 10
/** Highest tax that does not slow the births. */
const FAIR_TAX = 25
/** Share of the housing cap from which the villages count as full. */
const FULL_VILLAGES = 0.9

/** Who speaks for each quota, the unit they offer, and how they phrase it. */
const ADVISERS: Record<
  QuotaView['axis'],
  { name: string; unit: UnitId; label: (count: number, cost: string) => string }
> = {
  military: {
    name: 'The Marshal',
    unit: 'soldier',
    label: (count, cost) => `Recruit ${count}, ${cost} AP`,
  },
  pop: {
    name: 'The Steward',
    unit: 'peasant',
    label: (count, cost) => `Buy ${count} ${count === 1 ? 'peasant' : 'peasants'}, ${cost} AP`,
  },
  ap: {
    name: 'The Chancellor',
    unit: 'scribe',
    label: (count, cost) => `Hire ${count} ${count === 1 ? 'scribe' : 'scribes'}, ${cost} AP`,
  },
}

function shortfallText(quota: QuotaView, men: number, warn: boolean): string {
  const missing = quota.required - quota.current
  switch (quota.axis) {
    case 'military':
      return warn
        ? `The army is ${men} men short, and the audit is close.`
        : `The army is ${men} men short of the Crown's demand.`
    case 'pop':
      return `The People are ${formatCompact(Math.ceil(missing), 0, 'up')} souls short of the Crown's demand.`
    case 'ap':
      return `The Chancery is ${formatCompact(missing, 1, 'up')} AP each second short of the Crown's demand.`
  }
}

/** Largest count up to `wanted` the engine accepts now, with its cost; null when none. */
function acceptedPurchase(
  state: GameState,
  unit: UnitId,
  wanted: number,
): { count: number; cost: number } | null {
  const owned = state.units[unit] ?? 0
  const bulk = getMaxBulkSize(state.deadline, state.totalPopulation, UNITS_DATA[unit])
  const affordable = calculateMaxAffordableUnits(
    unit,
    owned,
    state.ap,
    state.freeSerfs,
    Infinity,
    bulk,
    DEFAULT_ENGINE_CONFIG,
    state.activeModifiers,
  )
  const candidates = [...new Set([Math.min(wanted, affordable), 1])].filter((count) => count >= 1)
  for (const count of candidates) {
    const trial = structuredClone(state)
    if (dispatch(trial, { type: 'BUY_UNIT', unitId: unit, count }).success) {
      return { count, cost: state.ap - trial.ap }
    }
  }
  return null
}

/**
 * What holds the births back before peasants can help (`docs/GAME_RULES.md` 6.2): a tax above 25%
 * slows the logistic growth, and a realm near its housing cap barely grows at all.
 */
function birthBrake(state: GameState, shortfall: string): Pick<Counsel, 'text' | 'action'> | null {
  const opening = shortfall.replace(/\.$/, '')
  if (state.taxRate > FAIR_TAX) {
    const command: Command = { type: 'SET_TAX_RATE', rate: FAIR_TAX }
    if (dispatch(structuredClone(state), command).success) {
      return {
        text: `${opening}, and a tax above ${FAIR_TAX}% slows the births.`,
        action: { label: `Lower the tax to ${FAIR_TAX}%`, command },
      }
    }
  }
  if (state.totalPopulation >= FULL_VILLAGES * calculateMaxPopulation(state)) {
    return {
      text: `${opening}, and the villages are full. Colonise a province to house more souls.`,
      action: null,
    }
  }
  return null
}

/**
 * Chooses the counsel for the run: nobody at death throes, praise when every quota is met, else
 * the counsellor of the quota with the largest shortfall ratio, warning when the band is rotting
 * or less than 30 s are left.
 *
 * @param quotas - The three quota views of the game store.
 * @param secondsLeft - Seconds left in the deadline.
 */
export function adviseCounsel(
  state: GameState,
  quotas: QuotaView[],
  band: DreadBand,
  secondsLeft: number,
): Counsel {
  if (band === 'death_throes') {
    return {
      title: 'No one advises you',
      text: 'Your counsellors have fled the castle.',
      action: null,
    }
  }
  const unmet = quotas
    .filter((quota) => !quota.met && quota.required > 0)
    .sort((a, b) => b.required / Math.max(b.current, 1e-9) - a.required / Math.max(a.current, 1e-9))
  const worst = unmet[0]
  if (!worst) {
    return {
      title: 'The Steward advises',
      text: 'Every quota is met. Keep the realm quiet.',
      action: null,
    }
  }
  const adviser = ADVISERS[worst.axis]
  const warn = band === 'rotting' || secondsLeft < WARNING_SECONDS
  const title = `${adviser.name} ${warn ? 'warns' : 'advises'}`
  const men = Math.ceil((worst.required - worst.current) / UNITS_DATA.soldier.baseValue)
  if (worst.axis === 'pop') {
    const brake = birthBrake(state, shortfallText(worst, men, warn))
    if (brake) return { title, ...brake }
  }
  const wanted = worst.axis === 'military' ? men : ROUND_PURCHASE
  const purchase = acceptedPurchase(state, adviser.unit, wanted)
  return {
    title,
    text: shortfallText(worst, men, warn),
    action: purchase
      ? {
          // Whole AP, rounded up: the player never holds less than the price shown.
          label: adviser.label(purchase.count, formatCompact(Math.ceil(purchase.cost), 0, 'up')),
          command: { type: 'BUY_UNIT', unitId: adviser.unit, count: purchase.count },
        }
      : null,
  }
}
