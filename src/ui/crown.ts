/**
 * The Crown page: the tax and its proclamation, the emergency edicts with their escalating
 * penalties, and the price of new land. Every figure mirrors its handler in `core/commands.ts`.
 *
 * @module ui/crown
 */

import { DEFAULT_ENGINE_CONFIG } from '@/core/config'
import { calculateGrossApRate } from '@/core/engine'
import { calculateColonisationCost } from '@/core/formulas'
import type { Command, GameState } from '@/core/types'
import { EDICT_ESCALATION_PER_USE, EDICTS_DATA, type EdictId } from '@/data/edicts'
import { formatCompact } from '@/ui/realmText'

const config = DEFAULT_ENGINE_CONFIG

/**
 * Quiet time before a new rate is proclaimed. Arrow keys fire `change` at each press and the
 * engine charges a shock per step while a rate is pending, so only the settled rate is sent.
 */
export const TAX_SETTLE_MS = 500

/** The tax in force, the rate waiting for its proclamation and the seconds left before it. */
export interface TaxView {
  rate: number
  pending: number | null
  secondsLeft: number
  delay: number
  max: number
}

/** One emergency edict on the page. */
export interface EdictRow {
  id: EdictId
  name: string
  text: string
  priceLabel: string
  command: Command | null
  blocked: string | null
}

/** The colonise action and its price. */
export interface ColoniseView {
  cost: number
  command: Command | null
  blocked: string | null
}

/** Reads the tax of the reign. */
export function taxView(state: GameState): TaxView {
  return {
    rate: state.taxRate,
    pending: state.pendingTaxRate,
    secondsLeft: Math.ceil(state.taxPromulgationTimer),
    delay: config.balance.TAX_PROMULGATION_DELAY_SECONDS,
    max: config.balance.TAX_RATE_MAX,
  }
}

/** What a new rate would stir, or null when it is harmless. */
export function taxWarning(state: GameState, target: number): string | null {
  const { TAX_SHOCK_THRESHOLD, TAX_SHOCK_UNREST_SPIKE, TAX_REFERENCE_RATE } = config.balance
  const rise = target - state.taxRate
  if (rise > TAX_SHOCK_THRESHOLD) {
    return `A rise of ${rise} points at once: unrest +${TAX_SHOCK_UNREST_SPIKE}.`
  }
  return target > TAX_REFERENCE_RATE
    ? `Above ${TAX_REFERENCE_RATE}%, the villages grow angry.`
    : null
}

function festivalCost(state: GameState): number {
  const { minCost, treasuryShare, grossRateSeconds } = EDICTS_DATA.grand_festival.values
  const gross = calculateGrossApRate(state, config).total
  return Math.max(minCost, treasuryShare * Math.max(0, state.ap), grossRateSeconds * gross)
}

function edictMultiplier(state: GameState, id: EdictId): number {
  return 1 + EDICT_ESCALATION_PER_USE * (state.edictUsageCounts[id] ?? 0)
}

function edictText(state: GameState, id: EdictId): string {
  const { forced_tithe: tithe, church_seizure: seizure, grand_festival: festival } = EDICTS_DATA
  const unrest = (base: number): string => `Unrest +${base * edictMultiplier(state, id)}`
  switch (id) {
    case 'forced_tithe': {
      const { pollTaxSeconds, growthFreezeSeconds } = tithe.values
      return (
        `Seize ${pollTaxSeconds} seconds of taxes now. ${unrest(tithe.values.unrest)}, ` +
        `births stop for ${growthFreezeSeconds} seconds.`
      )
    }
    case 'church_seizure':
      return `Melt the reliquaries for gold. The Prelate will remember. ${unrest(seizure.values.unrest)}.`
    case 'grand_festival':
      return `Open the wine cellars. Unrest falls by ${festival.values.unrestRelief}.`
  }
}

const EDICT_NAMES: Record<EdictId, string> = {
  forced_tithe: 'The forced tithe',
  church_seizure: 'Church seizure',
  grand_festival: 'The grand festival',
}

function edictBlock(state: GameState, id: EdictId, cost: number): string | null {
  if (state.lastEdictDeadline === state.deadline) return 'One edict each audit'
  const uses = state.edictUsageCounts[id] ?? 0
  if (id === 'church_seizure' && uses >= EDICTS_DATA.church_seizure.values.maxUsesPerRun) {
    return 'Nothing left to melt'
  }
  return state.ap < cost ? 'Not enough AP' : null
}

/** The three edicts, with their escalated effects and what blocks them. */
export function edictRows(state: GameState): EdictRow[] {
  const ids: EdictId[] = ['forced_tithe', 'church_seizure', 'grand_festival']
  return ids.map((id) => {
    const cost = id === 'grand_festival' ? festivalCost(state) : 0
    const blocked = edictBlock(state, id, cost)
    return {
      id,
      name: EDICT_NAMES[id],
      text: edictText(state, id),
      priceLabel: cost > 0 ? `Pay ${formatCompact(Math.ceil(cost), 0, 'up')} AP` : 'Proclaim',
      command: blocked ? null : { type: 'ENACT_EDICT', edictId: id },
      blocked,
    }
  })
}

/** The price of the next colonised province. */
export function coloniseView(state: GameState): ColoniseView {
  const cost = calculateColonisationCost(state.colonisedProvincesCount, config)
  const blocked = state.ap < cost ? 'Not enough AP' : null
  return { cost, command: blocked ? null : { type: 'COLONISE_PROVINCE' }, blocked }
}
