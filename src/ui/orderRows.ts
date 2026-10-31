/**
 * The rows of the Commons, Chancery and Host: what each unit costs at the chosen bulk size, what
 * blocks it, and the patents. Prices follow `handleBuyUnit` without copying the state, since the
 * rows refresh with the game loop; the engine keeps the last word on every command.
 *
 * @module ui/orderRows
 */

import { DEFAULT_ENGINE_CONFIG, quotaForDeadline } from '@/core/config'
import {
  calculateMaxPopulation,
  calculateMilitaryPower,
  calculateMilitaryUpkeep,
  calculateNetPaperwork,
  effectiveQuota,
} from '@/core/engine'
import {
  calculateMaxAffordableUnits,
  calculateOrderCaps,
  calculateUnitCost,
  getMaxBulkSize,
} from '@/core/formulas'
import { extractRawEvaluationState } from '@/core/modifiers'
import { hasRule } from '@/core/rules'
import type { Command, GameState, UnitId, UnitOrder } from '@/core/types'
import { UNITS_DATA } from '@/data/balance'
import { UNIT_COPY } from '@/data/orderCopy'
import { auditOrdinal, formatCompact } from '@/ui/realmText'

const config = DEFAULT_ENGINE_CONFIG

/** A bulk size of the selector; `max` buys as many as the coffer and the order allow. */
export type BulkChoice = 1 | 10 | 50 | 100 | 'max'

/** One unit on an order page. */
export interface UnitRow {
  unitId: UnitId
  name: string
  owned: number
  line: string
  count: number
  price: number
  command: Command | null
  blocked: string | null
}

/** The padlock row of an order until its patent is sealed. */
export interface PatentRow {
  order: UnitOrder
  cost: number
  unmet: string[]
  command: Command | null
}

/** One entry of the bulk selector. */
export interface BulkOption {
  choice: BulkChoice
  enabled: boolean
  note: string | null
}

const BULK_CHOICES: readonly BulkChoice[] = [1, 10, 50, 100, 'max']

function unitsOf(order: UnitOrder): UnitId[] {
  return Object.values(UNITS_DATA)
    .filter((def) => def.order === order)
    .map((def) => def.id)
}

function headroom(state: GameState, order: UnitOrder): number {
  const caps = calculateOrderCaps(
    calculateMaxPopulation(state, config),
    state.activeModifiers,
    extractRawEvaluationState(state),
    config,
  )
  const held = unitsOf(order).reduce((sum, id) => sum + (state.units[id] ?? 0), 0)
  return caps[order] - held
}

function freeSerfsFor(state: GameState, unitId: UnitId): number {
  const external = unitId === 'man_at_arms' && hasRule(state, 'law:mercenary_capitulation')
  return external ? Infinity : state.freeSerfs
}

function resolveCount(
  state: GameState,
  unitId: UnitId,
  bulk: BulkChoice,
  room: number,
  limit: number,
): number {
  if (bulk !== 'max') return Math.min(bulk, limit)
  const count = calculateMaxAffordableUnits(
    unitId,
    state.units[unitId] ?? 0,
    state.ap,
    freeSerfsFor(state, unitId),
    room,
    limit,
    config,
    state.activeModifiers,
  )
  return Math.max(1, count)
}

function blockReason(
  state: GameState,
  unitId: UnitId,
  count: number,
  price: number,
  room: number,
): string | null {
  if (state.ap < price) return 'Not enough AP'
  if (freeSerfsFor(state, unitId) < count) return 'No free serfs'
  if (room < count) return 'The order is full'
  return null
}

/** Builds the rows of an order: Tier I always, Tier II once its patent is sealed. */
export function unitRows(state: GameState, order: UnitOrder, bulk: BulkChoice): UnitRow[] {
  const room = headroom(state, order)
  return unitsOf(order)
    .filter((id) => UNITS_DATA[id].tier === 1 || state.unlockedPatents[order])
    .map((unitId) => {
      const def = UNITS_DATA[unitId]
      const owned = state.units[unitId] ?? 0
      const limit = getMaxBulkSize(state.deadline, state.totalPopulation, def, config)
      const count = resolveCount(state, unitId, bulk, room, limit)
      const price = calculateUnitCost(unitId, owned, count, config, state.activeModifiers)
      const blocked = blockReason(state, unitId, count, price, room)
      const copy = UNIT_COPY[unitId]
      return {
        unitId,
        name: copy.name,
        owned,
        line: `${formatCompact(owned)} ${copy.verb}, ${copy.effect}`,
        count,
        price,
        command: blocked ? null : { type: 'BUY_UNIT', unitId, count },
        blocked,
      }
    })
}

/** The patent of an order and what it still needs; null once it is sealed. */
export function patentRow(state: GameState, order: UnitOrder): PatentRow | null {
  if (state.unlockedPatents[order]) return null
  const { PATENT_COSTS, PATENT_MIN_DEADLINE, PATENT_MIN_TIER_I_UNITS } = config.balance
  const cost = PATENT_COSTS[order]
  const tierOne = unitsOf(order)
    .filter((id) => UNITS_DATA[id].tier === 1)
    .reduce((sum, id) => sum + (state.units[id] ?? 0), 0)
  const unmet: string[] = []
  if (state.deadline < PATENT_MIN_DEADLINE)
    unmet.push(`Reach the ${auditOrdinal(PATENT_MIN_DEADLINE)} audit`)
  if (tierOne < PATENT_MIN_TIER_I_UNITS) unmet.push(`Keep ${PATENT_MIN_TIER_I_UNITS} Tier I units`)
  if (state.ap < cost) unmet.push(`Hold ${cost} AP`)
  return {
    order,
    cost,
    unmet,
    command: unmet.length === 0 ? { type: 'UNLOCK_PATENT', order } : null,
  }
}

/** The bulk selector of an order: a size is open when one unit of the order allows it. */
export function bulkOptions(state: GameState, order: UnitOrder): BulkOption[] {
  const limit = Math.max(
    ...unitsOf(order).map((id) =>
      getMaxBulkSize(state.deadline, state.totalPopulation, UNITS_DATA[id], config),
    ),
  )
  return BULK_CHOICES.map((choice) => {
    const enabled = choice === 'max' || choice <= limit
    return { choice, enabled, note: enabled ? null : 'Not yet' }
  })
}

/** The panel of the Chancery: how much of the AP the paperwork eats, and what cuts it. */
export function paperworkLine(state: GameState): { title: string; note: string } {
  const share = Math.round(calculateNetPaperwork(state, config) * 100)
  return {
    title: `Paperwork eats ${share}% of your AP.`,
    note: state.unlockedPatents.admin
      ? 'Archivists and audit chambers cut it.'
      : 'Archivists cut it. Audit chambers need the Tier II patent.',
  }
}

/** The panel of the Host: force against the Crown's demand, and what the army costs. */
export function hostLine(state: GameState): { title: string; note: string } {
  const force = calculateMilitaryPower(state, config)
  const wanted = effectiveQuota(state, quotaForDeadline(config, state.deadline)).military
  const upkeep = calculateMilitaryUpkeep(state, config)
  const short = Math.ceil(wanted - force)
  const upkeepText = `Upkeep ${formatCompact(Math.ceil(upkeep * 10) / 10, 1)} AP each second.`
  return {
    title: `Force ${formatCompact(Math.floor(force))}. The Crown wants ${formatCompact(wanted)}.`,
    note: short > 0 ? `${upkeepText} ${formatCompact(short)} force short.` : upkeepText,
  }
}

/** One owned unit of the Host that can be sent home. */
export interface DisbandRow {
  unitId: UnitId
  name: string
  owned: number
  severance: number
  unpaid: boolean
}

/** The soldiers that can be disbanded, with the severance of one man. */
export function disbandRows(state: GameState): DisbandRow[] {
  return unitsOf('military')
    .filter((id) => (state.units[id] ?? 0) > 0)
    .map((unitId) => {
      const severance = config.balance.DISBAND_SEVERANCE_SHARE * UNITS_DATA[unitId].baseCost
      return {
        unitId,
        name: UNIT_COPY[unitId].name,
        owned: state.units[unitId] ?? 0,
        severance,
        unpaid: state.ap < severance,
      }
    })
}
