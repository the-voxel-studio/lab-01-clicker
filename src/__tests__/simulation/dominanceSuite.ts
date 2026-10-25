/**
 * Shared body of the per archetype dominance specs (GAME_RULES §21): spending shares after the
 * opening and role coverage. Each archetype has its own spec file so Vitest runs them in parallel.
 *
 * @module __tests__/simulation/dominanceSuite
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { UNITS_DATA, type UnitId } from '@/data/balance'
import type { UnitRole } from '@/core/types'
import { runSimulation, type BotRunResult, type BotStrategy } from './botRunner'

/** Spending before this game time belongs to the opening, where Scribes and Peasants dominate. */
const OPENING_SECONDS = 300

/** Largest share of the late spending one unit may take inside an archetype. */
const MAX_UNIT_SHARE = 0.6

/** Seeds of the dominance sample, outside the calibration, validation and sensitivity seeds. */
const FIRST_SEED = 50001
const RUNS_PER_ARCHETYPE = 200

/** Time allowed to build the 200 run sample of one archetype (about 47 s measured). */
const SAMPLE_TIMEOUT_MS = 120_000

/** Purchases of one archetype over all its runs. */
interface ArchetypeSpending {
  /** AP spent per unit after the opening. */
  lateSpend: Map<UnitId, number>
  /** Successful purchase commands per unit, whole run. */
  purchaseCount: Map<UnitId, number>
}

/** Every unit role of the catalog; all four are reachable in V1 (each has a purchasable unit). */
function catalogRoles(): UnitRole[] {
  return [...new Set(Object.values(UNITS_DATA).map((unit) => unit.role))]
}

/** Adds an amount to a map entry. */
function addTo(map: Map<UnitId, number>, unitId: UnitId, amount: number): void {
  map.set(unitId, (map.get(unitId) ?? 0) + amount)
}

/** Folds the purchases of one run into the archetype totals. */
function accumulate(spending: ArchetypeSpending, run: BotRunResult): void {
  for (const purchase of run.purchases) {
    addTo(spending.purchaseCount, purchase.unitId, 1)
    if (purchase.timeSeconds > OPENING_SECONDS) {
      addTo(spending.lateSpend, purchase.unitId, purchase.cost)
    }
  }
}

/** Plays every run of an archetype and sums its purchases. */
function playArchetype(strategy: BotStrategy): ArchetypeSpending {
  const spending: ArchetypeSpending = { lateSpend: new Map(), purchaseCount: new Map() }
  for (let seed = FIRST_SEED; seed < FIRST_SEED + RUNS_PER_ARCHETYPE; seed++) {
    accumulate(spending, runSimulation(strategy, seed))
  }
  return spending
}

/** Share of the late spending taken by each unit. */
function spendingShares(spending: ArchetypeSpending): number[] {
  const total = [...spending.lateSpend.values()].reduce((sum, value) => sum + value, 0)
  return [...spending.lateSpend.values()].map((value) => value / total)
}

/** Number of purchase commands per role. */
function purchasesPerRole(spending: ArchetypeSpending): Map<UnitRole, number> {
  const perRole = new Map<UnitRole, number>(catalogRoles().map((role) => [role, 0]))
  for (const [unitId, count] of spending.purchaseCount) {
    const role = UNITS_DATA[unitId].role
    perRole.set(role, (perRole.get(role) ?? 0) + count)
  }
  return perRole
}

/**
 * Registers the dominance tests of one archetype: 200 runs, spending shares after 300 s, and role
 * coverage. Each archetype alone must buy every role, which is stronger than "across all runs".
 *
 * @param strategy - Expert bot under test.
 */
export function describeDominance(strategy: BotStrategy): void {
  describe(`Plan 04 Task 3: dominance of the ${strategy.name} expert bot`, () => {
    let spending: ArchetypeSpending = { lateSpend: new Map(), purchaseCount: new Map() }

    beforeAll(() => {
      spending = playArchetype(strategy)
    }, SAMPLE_TIMEOUT_MS)

    it('no unit takes more than 60% of the spending after 300 s', () => {
      const shares = spendingShares(spending)
      expect(shares.length).toBeGreaterThan(0)
      expect(Math.max(...shares)).toBeLessThanOrEqual(MAX_UNIT_SHARE)
    })

    it('every unit role of the catalog is bought at least once across the runs', () => {
      const counts = [...purchasesPerRole(spending).values()]
      expect(counts).toHaveLength(catalogRoles().length)
      expect(Math.min(...counts)).toBeGreaterThan(0)
    })
  })
}
