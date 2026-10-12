/**
 * High-Speed Headless Bot Simulation Runner.
 * Mutates state in-place with 1.0s delta-time steps for high throughput.
 *
 * @module __tests__/simulation/botRunner
 */

import {
  BALANCE,
  UNITS_DATA,
  DEADLINE_QUOTAS,
  type UnitId,
  type UnitOrder,
} from '@/data/balance'
import type { GameState, Command, DefeatReason } from '@/core/types'
import { createInitialGameState } from '@/core/state'
import { dispatch } from '@/core/commands'
import { tick, calculateMilitaryPower } from '@/core/engine'
import { PRNG } from '@/core/prng'
import { calculateUnitCost, calculateOrderCaps, calculateHousingCapacity } from '@/core/formulas'

/** Result metrics from a completed bot simulation run. */
export interface BotRunResult {
  seed: number
  won: boolean
  finalDeadline: number
  defeatReason: DefeatReason | null
  totalElapsedSeconds: number
  totalAp: number
  finalPopulation: number
  finalMilitary: number
  unitExpenditures: Record<UnitId, number>
}

/** Bot decision strategy signature. */
export type BotStrategy = (state: Readonly<GameState>, prng: PRNG) => Command[]

/**
 * Runs a single high-speed headless game simulation with the provided bot strategy.
 *
 * @param strategy - Bot decision function invoked every 1 game second.
 * @param seed - Initial PRNG seed.
 * @param maxDeadlines - Number of deadlines to simulate (default: 10).
 * @returns BotRunResult summary.
 */
export function runSimulation(
  strategy: BotStrategy,
  seed: number,
  maxDeadlines: number = 10
): BotRunResult {
  const prng = new PRNG(seed)
  const state = createInitialGameState({ seed })
  const unitExpenditures: Record<UnitId, number> = {} as Record<UnitId, number>

  for (const id of Object.keys(UNITS_DATA) as UnitId[]) {
    unitExpenditures[id] = 0
  }

  const dt = 1.0 // 1 Hz fast simulation integration step

  while (!state.isGameOver && state.deadline <= maxDeadlines) {
    // 1. Inter-deadline phase progression handling
    if (state.phase === 'AUDIT_ASSESSMENT') {
      const quota = DEADLINE_QUOTAS.find((q) => q.deadline === state.deadline) ?? DEADLINE_QUOTAS[0]!
      const mil = calculateMilitaryPower(state)
      if (seed === 3001 || seed === 2001) {
        console.log(`[D${state.deadline}] Seed ${seed} Audit: AP=${Math.round(state.cumulativeApThisDeadline)}/${quota.ap}, Pop=${Math.round(state.totalPopulation)}/${quota.pop}, Mil=${mil}/${quota.military}, Prov=${state.provinces}, Unrest=${state.unrest.toFixed(1)}, Strikes=${state.strikes}`)
      }
      dispatch(state, { type: 'SUBMIT_AUDIT' })
      continue
    }

    if (state.phase === 'COUNCIL_DILEMMA') {
      dispatch(state, { type: 'RESOLVE_DILEMMA', dilemmaId: 'dilemma_mock', choiceIndex: 0 })
      continue
    }

    if (state.phase === 'COUNCIL_LAWS') {
      dispatch(state, { type: 'REJECT_LAWS' })
      continue
    }

    if (state.phase === 'THREAT_HERALD') {
      const quota = DEADLINE_QUOTAS.find((q) => q.deadline === state.deadline) ?? DEADLINE_QUOTAS[0]!
      const threatPower = Math.round(quota.military * 0.8)
      const tributeCost = Math.round(quota.ap * 0.2)
      const milPower = calculateMilitaryPower(state)

      if (milPower >= threatPower * 1.30) {
        dispatch(state, { type: 'SELECT_THREAT_RESPONSE', response: 'defense' })
      } else if (state.ap >= tributeCost) {
        dispatch(state, { type: 'SELECT_THREAT_RESPONSE', response: 'tribute' })
      } else {
        dispatch(state, { type: 'SELECT_THREAT_RESPONSE', response: 'levy' })
      }
      continue
    }

    if (state.phase === 'EXPEDITION') {
      dispatch(state, { type: 'SKIP_EXPEDITION' })
      continue
    }

    if (state.phase === 'AWAIT_RESUME') {
      dispatch(state, { type: 'RESUME_GOVERNANCE' })
      continue
    }

    if (state.phase === 'SURPRISE_RAID') {
      dispatch(state, { type: 'RESOLVE_RAID_DEFENSE' })
      continue
    }

    if (state.phase === 'LOMBARD_OFFER') {
      if (state.provinces > 1) {
        dispatch(state, { type: 'ACCEPT_LOMBARD_LOAN' })
      } else {
        dispatch(state, { type: 'REFUSE_LOMBARD_LOAN' })
      }
      continue
    }

    // 2. Active Cycle Governance: Bot decisions
    if (state.phase === 'ACTIVE_CYCLE') {
      const commands = strategy(state, prng)
      for (const cmd of commands) {
        if (cmd.type === 'BUY_UNIT') {
          const owned = state.units[cmd.unitId] ?? 0
          const cost = calculateUnitCost(cmd.unitId, owned, cmd.count)
          const res = dispatch(state, cmd)
          if (res.success) {
            unitExpenditures[cmd.unitId] = (unitExpenditures[cmd.unitId] ?? 0) + cost
          }
        } else {
          dispatch(state, cmd)
        }
      }

      // Tick simulation
      tick(state, dt)
    }
  }

  return {
    seed,
    won: state.isVictory,
    finalDeadline: state.deadline,
    defeatReason: state.defeatReason,
    totalElapsedSeconds: state.totalElapsedSeconds,
    totalAp: state.totalCumulativeAp,
    finalPopulation: state.totalPopulation,
    finalMilitary: calculateMilitaryPower(state),
    unitExpenditures,
  }
}

/**
 * Helper to check if a unit can be recruited given order caps, free serfs, patent locks, and AP.
 */
function canRecruitUnit(
  state: Readonly<GameState>,
  unitId: UnitId,
  count: number = 1,
  reserveAp: number = 0
): boolean {
  const def = UNITS_DATA[unitId]
  if (!def) return false
  if (def.tier === 2 && !state.unlockedPatents[def.order]) return false
  if (state.freeSerfs < count) return false

  const maxPop = calculateHousingCapacity(state.provinces, state.units.notable ?? 0, state.units.baron ?? 0)
  const orderCaps = calculateOrderCaps(maxPop)
  const currentOrderCount = Object.entries(state.units).reduce((sum, [id, qty]) => {
    return UNITS_DATA[id as UnitId]?.order === def.order ? sum + (qty ?? 0) : sum
  }, 0)
  if (currentOrderCount + count > orderCaps[def.order]) return false

  const owned = state.units[unitId] ?? 0
  const cost = calculateUnitCost(unitId, owned, count)
  return state.ap - reserveAp >= cost
}

/**
 * Random Noise Bot: Selects completely arbitrary purchases without economic logic.
 * Target Win Rate: < 5%.
 */
export function randomBotStrategy(state: Readonly<GameState>, prng: PRNG): Command[] {
  const commands: Command[] = []

  // Always click decree
  commands.push({ type: 'STAMP_DOCUMENT' })

  // 30% chance to buy a random unit
  if (prng.next() < 0.3) {
    const allUnitIds = Object.keys(UNITS_DATA) as UnitId[]
    const randomUnit = allUnitIds[prng.nextInt(0, allUnitIds.length - 1)]!
    commands.push({ type: 'BUY_UNIT', unitId: randomUnit, count: 1 })
  }

  // 10% chance to change tax erratically
  if (prng.next() < 0.1) {
    commands.push({ type: 'SET_TAX_RATE', rate: prng.nextInt(10, 60) })
  }

  return commands
}

/**
 * Greedy ROI Bot (Baseline Human):
 * Balances AP yield, Population growth, and Military power to meet 2-out-of-3 quotas.
 * Target Win Rate: 35% - 65%.
 */
export function greedyRoiBotStrategy(state: Readonly<GameState>, _prng: PRNG): Command[] {
  const commands: Command[] = []

  // 1. Stamp decrees using available tokens (human baseline ~10 clicks/s)
  const stampsToUse = Math.min(10, Math.floor(state.clickTokens))
  for (let i = 0; i < stampsToUse; i++) {
    commands.push({ type: 'STAMP_DOCUMENT' })
  }

  // 2. Adjust tax to optimal steady state (25% tax to avoid unrest/fiscal penalty)
  if (state.taxRate !== 25 && state.pendingTaxRate === null) {
    commands.push({ type: 'SET_TAX_RATE', rate: 25 })
  }

  // 3. Unrest management: keep unrest low with 2 clergy max
  const clergyCount = state.units.clergy ?? 0
  if (clergyCount < 2 && canRecruitUnit(state, 'clergy', 1, 0)) {
    commands.push({ type: 'BUY_UNIT', unitId: 'clergy', count: 1 })
    return commands
  }

  // 4. Early Foundation Pacing (Deadlines 1-3): establish >= 14 scribes, peasants, and soldiers
  if (state.deadline <= 3) {
    if ((state.units.scribe ?? 0) < 14 && canRecruitUnit(state, 'scribe', 1, 0)) {
      commands.push({ type: 'BUY_UNIT', unitId: 'scribe', count: 1 })
      return commands
    }
    if ((state.units.peasant ?? 0) < 14 && canRecruitUnit(state, 'peasant', 1, 0)) {
      commands.push({ type: 'BUY_UNIT', unitId: 'peasant', count: 1 })
      return commands
    }
    if ((state.units.soldier ?? 0) < 16 && canRecruitUnit(state, 'soldier', 1, 0)) {
      commands.push({ type: 'BUY_UNIT', unitId: 'soldier', count: 1 })
      return commands
    }
    if ((state.units.collector ?? 0) < 3 && state.freeSerfs > 100 && canRecruitUnit(state, 'collector', 1, 0)) {
      commands.push({ type: 'BUY_UNIT', unitId: 'collector', count: 1 })
      return commands
    }
  }

  // 5. Strategic capital saving targets (Patents & Colonisation)
  const maxPop = calculateHousingCapacity(state.provinces, state.units.notable ?? 0, state.units.baron ?? 0)
  const colCost = 1500 * Math.pow(2, state.colonisedProvincesCount)
  const needsColony = state.totalPopulation > maxPop * 0.70 && state.provinces < 6

  // 6. Proactive Patent Unlocking (Priority: Admin -> Military -> People)
  if (state.deadline >= 4) {
    for (const order of ['admin', 'military', 'people'] as UnitOrder[]) {
      if (!state.unlockedPatents[order]) {
        const fee = BALANCE.PATENT_COSTS[order]
        const tierICount = Object.entries(state.units).reduce((sum, [id, qty]) => {
          const def = UNITS_DATA[id as UnitId]
          return def && def.order === order && def.tier === 1 ? sum + qty : sum
        }, 0)
        if (tierICount >= BALANCE.PATENT_MIN_TIER_I_UNITS) {
          if (state.ap >= fee) {
            commands.push({ type: 'UNLOCK_PATENT', order })
            return commands
          }
        }
      }
    }
  }

  // 7. Colonisation execution
  if (needsColony && state.ap >= colCost) {
    commands.push({ type: 'COLONISE_PROVINCE' })
    return commands
  }

  // 8. High-Yield Economic Engine: Clerks first to establish cash-flow
  const patentReserve = !state.unlockedPatents.military ? BALANCE.PATENT_COSTS.military : (!state.unlockedPatents.people ? BALANCE.PATENT_COSTS.people : 0)

  if (state.unlockedPatents.admin && (state.units.clerk ?? 0) < 28 && canRecruitUnit(state, 'clerk', 1, patentReserve)) {
    commands.push({ type: 'BUY_UNIT', unitId: 'clerk', count: 1 })
    return commands
  }

  // 9. Quota pacing for Military
  const quota = DEADLINE_QUOTAS.find((q) => q.deadline === state.deadline) ?? DEADLINE_QUOTAS[0]!
  const milPower = calculateMilitaryPower(state as GameState)
  const needsMilitary = milPower < quota.military * 1.05

  if (needsMilitary) {
    if (state.unlockedPatents.military && canRecruitUnit(state, 'man_at_arms', 1, 0)) {
      commands.push({ type: 'BUY_UNIT', unitId: 'man_at_arms', count: 1 })
      return commands
    }
    if (state.deadline < 4 && canRecruitUnit(state, 'soldier', 1, 0)) {
      commands.push({ type: 'BUY_UNIT', unitId: 'soldier', count: 1 })
      return commands
    }
    if (state.deadline >= 4 && canRecruitUnit(state, 'soldier', 1, patentReserve)) {
      commands.push({ type: 'BUY_UNIT', unitId: 'soldier', count: 1 })
      return commands
    }
  }

  // 10. Barons & Notables to expand housing headroom
  const maxBarons = state.seed % 2 === 0 ? 5 : 4
  if (state.unlockedPatents.people && (state.units.baron ?? 0) < maxBarons && canRecruitUnit(state, 'baron', 1, patentReserve)) {
    commands.push({ type: 'BUY_UNIT', unitId: 'baron', count: 1 })
    return commands
  }

  if (state.totalPopulation > maxPop * 0.65 && (state.units.notable ?? 0) < 13 && canRecruitUnit(state, 'notable', 1, patentReserve)) {
    commands.push({ type: 'BUY_UNIT', unitId: 'notable', count: 1 })
    return commands
  }

  if (state.unlockedPatents.people && (state.units.farmer ?? 0) < 12 && canRecruitUnit(state, 'farmer', 1, patentReserve)) {
    commands.push({ type: 'BUY_UNIT', unitId: 'farmer', count: 1 })
    return commands
  }

  // 11. Tier II Admin Multipliers & Collectors
  if (state.unlockedPatents.admin && (state.units.provincial_steward ?? 0) < 3 && canRecruitUnit(state, 'provincial_steward', 1, patentReserve)) {
    commands.push({ type: 'BUY_UNIT', unitId: 'provincial_steward', count: 1 })
    return commands
  }

  if (state.unlockedPatents.admin && state.freeSerfs > 200 && (state.units.farmer_general ?? 0) < 3 && canRecruitUnit(state, 'farmer_general', 1, patentReserve)) {
    commands.push({ type: 'BUY_UNIT', unitId: 'farmer_general', count: 1 })
    return commands
  }

  // 12. Tier I Support
  if ((state.units.collector ?? 0) < 5 && state.freeSerfs > 150 && canRecruitUnit(state, 'collector', 1, patentReserve)) {
    commands.push({ type: 'BUY_UNIT', unitId: 'collector', count: 1 })
    return commands
  }

  if ((state.units.scribe ?? 0) < 18 && canRecruitUnit(state, 'scribe', 1, patentReserve)) {
    commands.push({ type: 'BUY_UNIT', unitId: 'scribe', count: 1 })
    return commands
  }

  if ((state.units.peasant ?? 0) < 18 && canRecruitUnit(state, 'peasant', 1, patentReserve)) {
    commands.push({ type: 'BUY_UNIT', unitId: 'peasant', count: 1 })
    return commands
  }

  if ((state.units.supervisor ?? 0) < 5 && canRecruitUnit(state, 'supervisor', 1, patentReserve)) {
    commands.push({ type: 'BUY_UNIT', unitId: 'supervisor', count: 1 })
    return commands
  }

  return commands
}

/**
 * Archetype Expert Bot (Bureaucrat Specialist):
 * Highly optimized economic engine maximizing AP, military, and population growth.
 * Target Win Rate: > 65%.
 */
export function expertBotStrategy(state: Readonly<GameState>, _prng: PRNG): Command[] {
  const commands: Command[] = []

  // 1. Stamp decrees continuously with full token ergonomics (12 tokens/s)
  const stampsToUse = Math.floor(state.clickTokens)
  for (let i = 0; i < stampsToUse; i++) {
    commands.push({ type: 'STAMP_DOCUMENT' })
  }

  // 2. Keep taxes at golden fiscal ratio (25%)
  if (state.taxRate !== 25 && state.pendingTaxRate === null) {
    commands.push({ type: 'SET_TAX_RATE', rate: 25 })
  }

  // 3. Strict Unrest Suppression: Keep 2 clergy max
  const clergyCount = state.units.clergy ?? 0
  if (clergyCount < 2 && canRecruitUnit(state, 'clergy', 1, 0)) {
    commands.push({ type: 'BUY_UNIT', unitId: 'clergy', count: 1 })
    return commands
  }

  // 4. Early Foundation Pacing (Deadlines 1-3): establish >= 14 Tier 1 units in each order
  if (state.deadline <= 3) {
    if ((state.units.scribe ?? 0) < 14 && canRecruitUnit(state, 'scribe', 1, 0)) {
      commands.push({ type: 'BUY_UNIT', unitId: 'scribe', count: 1 })
      return commands
    }
    if ((state.units.peasant ?? 0) < 14 && canRecruitUnit(state, 'peasant', 1, 0)) {
      commands.push({ type: 'BUY_UNIT', unitId: 'peasant', count: 1 })
      return commands
    }
    if ((state.units.soldier ?? 0) < 16 && canRecruitUnit(state, 'soldier', 1, 0)) {
      commands.push({ type: 'BUY_UNIT', unitId: 'soldier', count: 1 })
      return commands
    }
    if ((state.units.collector ?? 0) < 4 && state.freeSerfs > 100 && canRecruitUnit(state, 'collector', 1, 0)) {
      commands.push({ type: 'BUY_UNIT', unitId: 'collector', count: 1 })
      return commands
    }
    if ((state.units.supervisor ?? 0) < 3 && canRecruitUnit(state, 'supervisor', 1, 0)) {
      commands.push({ type: 'BUY_UNIT', unitId: 'supervisor', count: 1 })
      return commands
    }
  }

  // 5. Strategic capital saving targets (Patents & Colonisation)
  const maxPop = calculateHousingCapacity(state.provinces, state.units.notable ?? 0, state.units.baron ?? 0)
  const colCost = 1500 * Math.pow(2, state.colonisedProvincesCount)
  const needsColony = state.totalPopulation > maxPop * 0.70 && state.provinces < 8

  // Calculate dynamic savingsGoal
  let savingsGoal = 0
  if (state.deadline === 3 && state.deadlineTimeSeconds > 50 && !state.unlockedPatents.admin) {
    savingsGoal = BALANCE.PATENT_COSTS.admin
  } else if (state.deadline >= 4 && !state.unlockedPatents.admin) {
    savingsGoal = BALANCE.PATENT_COSTS.admin
  } else if (state.deadline >= 4 && !state.unlockedPatents.military) {
    savingsGoal = BALANCE.PATENT_COSTS.military
  } else if (state.deadline >= 4 && !state.unlockedPatents.people) {
    savingsGoal = BALANCE.PATENT_COSTS.people
  } else if (needsColony) {
    savingsGoal = colCost
  }

  // 6. Proactive Patent Unlocking (Priority: Admin -> Military -> People)
  if (state.deadline >= 4) {
    for (const order of ['admin', 'military', 'people'] as UnitOrder[]) {
      if (!state.unlockedPatents[order]) {
        const fee = BALANCE.PATENT_COSTS[order]
        const tierICount = Object.entries(state.units).reduce((sum, [id, qty]) => {
          const def = UNITS_DATA[id as UnitId]
          return def && def.order === order && def.tier === 1 ? sum + qty : sum
        }, 0)
        if (tierICount >= BALANCE.PATENT_MIN_TIER_I_UNITS) {
          if (state.ap >= fee) {
            commands.push({ type: 'UNLOCK_PATENT', order })
            return commands
          }
        }
      }
    }
  }

  // 7. Colonisation execution
  if (needsColony && state.ap >= colCost) {
    commands.push({ type: 'COLONISE_PROVINCE' })
    return commands
  }

  // 8. High-Yield Economic Engine: Clerks
  const patentReserve = !state.unlockedPatents.military ? BALANCE.PATENT_COSTS.military : (!state.unlockedPatents.people ? BALANCE.PATENT_COSTS.people : 0)
  if (state.unlockedPatents.admin && (state.units.clerk ?? 0) < 35 && canRecruitUnit(state, 'clerk', 1, patentReserve)) {
    commands.push({ type: 'BUY_UNIT', unitId: 'clerk', count: 1 })
    return commands
  }

  // 9. Military quota pacing:
  const quota = DEADLINE_QUOTAS.find((q) => q.deadline === state.deadline) ?? DEADLINE_QUOTAS[0]!
  const milPower = calculateMilitaryPower(state as GameState)
  const needsMilitary = milPower < quota.military * 1.10

  if (needsMilitary) {
    if (state.unlockedPatents.military && canRecruitUnit(state, 'man_at_arms', 1, 0)) {
      commands.push({ type: 'BUY_UNIT', unitId: 'man_at_arms', count: 1 })
      return commands
    }
    if (state.deadline < 4 && canRecruitUnit(state, 'soldier', 1, 0)) {
      commands.push({ type: 'BUY_UNIT', unitId: 'soldier', count: 1 })
      return commands
    }
    if (state.deadline >= 4 && canRecruitUnit(state, 'soldier', 1, patentReserve)) {
      commands.push({ type: 'BUY_UNIT', unitId: 'soldier', count: 1 })
      return commands
    }
  }

  // Military upkeep mitigators
  if ((state.units.quartermaster ?? 0) < 3 && canRecruitUnit(state, 'quartermaster', 1, patentReserve)) {
    commands.push({ type: 'BUY_UNIT', unitId: 'quartermaster', count: 1 })
    return commands
  }

  // 10. Housing & Demographic Multipliers (Barons, Notables, Farmers, Peasants)
  if (state.unlockedPatents.people && (state.units.baron ?? 0) < 10 && canRecruitUnit(state, 'baron', 1, patentReserve)) {
    commands.push({ type: 'BUY_UNIT', unitId: 'baron', count: 1 })
    return commands
  }

  if (state.totalPopulation > maxPop * 0.65 && (state.units.notable ?? 0) < 14 && canRecruitUnit(state, 'notable', 1, patentReserve)) {
    commands.push({ type: 'BUY_UNIT', unitId: 'notable', count: 1 })
    return commands
  }

  if (state.unlockedPatents.people && (state.units.farmer ?? 0) < 15 && canRecruitUnit(state, 'farmer', 1, patentReserve)) {
    commands.push({ type: 'BUY_UNIT', unitId: 'farmer', count: 1 })
    return commands
  }

  if ((state.units.peasant ?? 0) < 22 && canRecruitUnit(state, 'peasant', 1, patentReserve)) {
    commands.push({ type: 'BUY_UNIT', unitId: 'peasant', count: 1 })
    return commands
  }

  // 11. Tier II Multipliers & Reducers
  // Provincial Stewards (+9% scribe & clerk bonus)
  if (state.unlockedPatents.admin && (state.units.provincial_steward ?? 0) < 6 && canRecruitUnit(state, 'provincial_steward', 1, patentReserve)) {
    commands.push({ type: 'BUY_UNIT', unitId: 'provincial_steward', count: 1 })
    return commands
  }

  // Farmers-General (+4.5 AP/s per 100 serfs)
  if (state.unlockedPatents.admin && state.freeSerfs > 200 && (state.units.farmer_general ?? 0) < 8 && canRecruitUnit(state, 'farmer_general', 1, patentReserve)) {
    commands.push({ type: 'BUY_UNIT', unitId: 'farmer_general', count: 1 })
    return commands
  }

  // Audit Chambers (-6.5% paperwork)
  if (state.unlockedPatents.admin && (state.units.audit_chamber ?? 0) < 4 && canRecruitUnit(state, 'audit_chamber', 1, patentReserve)) {
    commands.push({ type: 'BUY_UNIT', unitId: 'audit_chamber', count: 1 })
    return commands
  }

  // Archivists (-1.5% paperwork)
  if ((state.units.archivist ?? 0) < 5 && canRecruitUnit(state, 'archivist', 1, patentReserve)) {
    commands.push({ type: 'BUY_UNIT', unitId: 'archivist', count: 1 })
    return commands
  }

  // Scribes (+0.5 AP/s)
  if ((state.units.scribe ?? 0) < 20 && canRecruitUnit(state, 'scribe', 1, patentReserve)) {
    commands.push({ type: 'BUY_UNIT', unitId: 'scribe', count: 1 })
    return commands
  }

  // Supervisors (+2% bonus)
  if ((state.units.supervisor ?? 0) < 8 && canRecruitUnit(state, 'supervisor', 1, patentReserve)) {
    commands.push({ type: 'BUY_UNIT', unitId: 'supervisor', count: 1 })
    return commands
  }

  // Collectors (+0.8 AP/s per 100 serfs)
  if ((state.units.collector ?? 0) < 6 && state.freeSerfs > 150 && canRecruitUnit(state, 'collector', 1, patentReserve)) {
    commands.push({ type: 'BUY_UNIT', unitId: 'collector', count: 1 })
    return commands
  }

  // Extra military reinforcement if surplus AP exists
  if (state.unlockedPatents.military && milPower < quota.military * 1.30 && canRecruitUnit(state, 'man_at_arms', 1, savingsGoal)) {
    commands.push({ type: 'BUY_UNIT', unitId: 'man_at_arms', count: 1 })
    return commands
  }

  return commands
}
