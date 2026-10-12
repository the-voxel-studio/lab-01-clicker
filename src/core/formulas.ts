/**
 * Canonical Mathematical Models & System Formulas.
 * Pure TypeScript, deterministic, fully covered by unit tests.
 *
 * @module core/formulas
 */

import { BALANCE, UNITS_DATA } from '@/data/balance'
import type { UnitId, UnitOrder, UnrestCrisisStage } from './types'

/**
 * Refills the ergonomic click token bucket based on elapsed delta-time.
 * Strictly deterministic; relies exclusively on injected delta-time, never system clocks.
 *
 * @param currentTokens - Available click tokens before tick.
 * @param dt - Elapsed delta-time in seconds.
 * @param maxTokens - Maximum token bucket capacity (default: 12 tokens).
 * @returns The new token count capped at maxTokens.
 */
export function refillTokenBucket(
  currentTokens: number,
  dt: number,
  maxTokens: number = BALANCE.CLICK_MAX_TOKENS_PER_SECOND
): number {
  return Math.min(maxTokens, currentTokens + maxTokens * dt)
}

/**
 * Calculates the Administrative Power awarded by an executive decree click.
 *
 * Formula: ClickValue = [1 + max(0, Gross AP/s * 0.035)] * SealMultiplier * CriticalMultiplier
 *
 * @param grossApRate - Current gross AP production per second across all sources.
 * @param sealMultiplier - Active decree power multipliers (e.g. laws, perks).
 * @param isCritical - Whether this click triggered an Imperial Wax Seal critical strike.
 * @returns The total AP produced by the click.
 */
export function calculateClickValue(
  grossApRate: number,
  sealMultiplier: number = 1.0,
  isCritical: boolean = false
): number {
  const baseValue = 1.0 + Math.max(0, grossApRate * 0.035)
  const critMultiplier = isCritical ? BALANCE.CLICK_CRITICAL_MULTIPLIER : 1.0
  return baseValue * sealMultiplier * critMultiplier
}

/**
 * Calculates the total cost of purchasing K units using geometric scaling.
 *
 * Sum formula: Cost = BaseCost * r^n * (r^K - 1) / (r - 1)
 *
 * @param unitId - The unit identifier.
 * @param currentOwned - Current quantity of this unit owned by the realm.
 * @param countToBuy - Desired purchase count K (1, 10, 50, 100).
 * @returns Total AP required for the purchase.
 */
export function calculateUnitCost(
  unitId: UnitId,
  currentOwned: number,
  countToBuy: number
): number {
  if (countToBuy <= 0) return 0
  const unit = UNITS_DATA[unitId]
  if (!unit) {
    throw new Error(`Unknown unit identifier: ${unitId}`)
  }

  const baseCost = unit.baseCost
  const ratio = unit.costRatio

  if (countToBuy === 1) {
    return Math.round(baseCost * Math.pow(ratio, currentOwned) * 100) / 100
  }

  // Geometric sum: base * r^n * (r^K - 1) / (r - 1)
  const cost =
    baseCost *
    Math.pow(ratio, currentOwned) *
    ((Math.pow(ratio, countToBuy) - 1) / (ratio - 1))
  return Math.round(cost * 100) / 100
}

/**
 * Computes the maximum affordable units (Buy Max) given budget and demographic constraints.
 *
 * Inverts the geometric progression formula:
 * K = floor( log(1 + (budget * (r - 1)) / (base * r^n)) / log(r) )
 *
 * @param unitId - Target unit identifier.
 * @param currentOwned - Currently owned unit count.
 * @param availableAp - Available treasury budget.
 * @param freeSerfs - Available free serfs for recruitment (0 if unconstrained).
 * @param orderHeadroom - Remaining slot capacity under the order cap.
 * @returns Maximum valid count that can be purchased.
 */
export function calculateMaxAffordableUnits(
  unitId: UnitId,
  currentOwned: number,
  availableAp: number,
  freeSerfs: number,
  orderHeadroom: number
): number {
  if (availableAp <= 0 || freeSerfs <= 0 || orderHeadroom <= 0) return 0
  const unit = UNITS_DATA[unitId]
  if (!unit) return 0

  const baseCost = unit.baseCost
  const ratio = unit.costRatio

  const costOfCurrent = baseCost * Math.pow(ratio, currentOwned)
  if (availableAp < costOfCurrent) return 0

  // Inverted geometric series sum:
  // budget = costOfCurrent * (r^K - 1) / (r - 1)
  // r^K = 1 + budget * (r - 1) / costOfCurrent
  const term = 1 + (availableAp * (ratio - 1)) / costOfCurrent
  if (term <= 1) return 0

  const theoreticalMax = Math.floor(Math.log(term) / Math.log(ratio))
  const affordableByAp = Math.max(0, theoreticalMax)

  return Math.min(affordableByAp, freeSerfs, orderHeadroom)
}

/**
 * Calculates fiscal drag factor on demographic growth based on tax rate.
 *
 * Formula: FiscalFactor = max(0.1, 1 - max(0, TaxRate - 25) / 50)
 *
 * @param taxRate - Active promulgated tax rate percentage [0, 60].
 * @returns Scalar multiplier on demographic growth [0.1, 1.0].
 */
export function calculateFiscalFactor(taxRate: number): number {
  const excessTax = Math.max(0, taxRate - 25)
  return Math.max(0.1, 1.0 - excessTax / 50)
}

/**
 * Calculates proportional logistic demographic growth per second.
 *
 * Formula: Growth/s = r * Pop * (1 - Pop / MaxPop) * FiscalFactor
 *
 * @param population - Current living population.
 * @param maxPopulation - Maximum housing capacity.
 * @param growthRateR - Total growth rate parameter r (including peasants, farmers, and modifiers).
 * @param taxRate - Active promulgated tax rate percentage.
 * @returns Net population growth per second.
 */
export function calculateLogisticGrowth(
  population: number,
  maxPopulation: number,
  growthRateR: number = BALANCE.BASE_POP_GROWTH_RATE_R,
  taxRate: number = BALANCE.STARTING_TAX_RATE
): number {
  if (population <= 0 || maxPopulation <= 0) return 0

  // If population exceeds capacity, growth drops to 0 (overcrowding handles bleed)
  if (population >= maxPopulation) return 0

  const fiscalFactor = calculateFiscalFactor(taxRate)
  const saturationRatio = 1.0 - population / maxPopulation
  return growthRateR * population * saturationRatio * fiscalFactor
}

/**
 * Calculates maximum living population capacity across all controlled provinces.
 *
 * Formula: MaxPop = 250 * Provinces * [1 + 0.015 * Notables + 0.06 * Barons + Modifiers]
 *
 * @param provinces - Number of controlled provinces.
 * @param notables - Count of active Notables (Tier I).
 * @param barons - Count of active Barons (Tier II).
 * @param additionalMultiplier - Additional modifiers (e.g. Farmlands biome x1.5, Wilderness x0.8).
 * @returns Maximum sustainable population.
 */
export function calculateHousingCapacity(
  provinces: number,
  notables: number = 0,
  barons: number = 0,
  additionalMultiplier: number = 1.0
): number {
  const baseCap = BALANCE.BASE_HOUSING_PER_PROVINCE * Math.max(1, provinces)
  const roleBonus = 1.0 + notables * 0.015 + barons * 0.06
  return Math.round(baseCap * roleBonus * additionalMultiplier)
}

/**
 * Calculates AP cost for peaceful civil province colonisation.
 *
 * Formula: Cost = 1500 * (2^k)
 *
 * @param colonisedCount - Number of previously colonised provinces.
 * @returns AP cost for the next colony.
 */
export function calculateColonisationCost(colonisedCount: number): number {
  return BALANCE.COLONISATION_BASE_COST * Math.pow(BALANCE.COLONISATION_COST_MULTIPLIER, colonisedCount)
}

/**
 * Calculates continuous non-quadratic Special Collector output.
 *
 * Formula: Output = YieldRate * min(n, FreeSerfs / 100)
 *
 * @param collectorCount - Number of Collectors or Farmers-General active.
 * @param freeSerfs - Living free serfs available to be taxed.
 * @param yieldRate - Base production rate per 100 serfs (0.80 for Collector, 4.50 for Farmer-General).
 * @returns Gross AP produced per second.
 */
export function calculateCollectorYield(
  collectorCount: number,
  freeSerfs: number,
  yieldRate: number
): number {
  if (collectorCount <= 0 || freeSerfs <= 0) return 0
  const coveragePool = freeSerfs / BALANCE.SERFS_PER_COLLECTOR
  const effectiveCollectors = Math.min(collectorCount, coveragePool)
  return effectiveCollectors * yieldRate
}

/**
 * Calculates bureaucratic paperwork inertia friction percentage.
 *
 * Formula:
 * Size = sum(Tier I * 1 + Tier II * 2) + 0.5 * Soldiers + 10 * Provinces
 * RawPaperwork = Size / (Size + 220)
 * NetPaperwork = RawPaperwork * (1 - ArchivistReduction)
 *
 * @param units - Current unit counts across the realm.
 * @param provinces - Total controlled provinces.
 * @param archivistReduction - Sum of paperwork mitigations (e.g. Archivists, Audit Chambers).
 * @returns Paperwork friction ratio [0, 1].
 */
export function calculatePaperworkFriction(
  units: Record<UnitId, number>,
  provinces: number,
  archivistReduction: number = 0
): number {
  let size = 0

  for (const [id, count] of Object.entries(units) as [UnitId, number][]) {
    if (count <= 0) continue
    const def = UNITS_DATA[id]
    if (!def) continue

    if (id === 'soldier') {
      size += count * 0.5
    } else if (def.tier === 1) {
      size += count * 1.0
    } else {
      size += count * 2.0
    }
  }

  size += provinces * 10

  const rawPaperwork = size / (size + BALANCE.BUREAUCRACY_SCALE_S)
  const clampedReduction = Math.min(0.95, Math.max(0, archivistReduction))
  return Math.max(0, Math.min(0.99, rawPaperwork * (1 - clampedReduction)))
}

/**
 * Calculates dynamic order allocation caps based on current maximum population.
 *
 * Thresholds:
 * - Administration: <= 15% of MaxPop
 * - The Military: <= 12% of MaxPop
 * - The People (Specialized): <= 25% of MaxPop
 *
 * @param maxPopulation - Total housing capacity.
 * @returns Max allowable units per order category.
 */
export function calculateOrderCaps(maxPopulation: number): Record<UnitOrder, number> {
  return {
    admin: Math.floor(maxPopulation * 0.15),
    military: Math.floor(maxPopulation * 0.12),
    people: Math.floor(maxPopulation * 0.25),
  }
}

/**
 * Evaluates the active unrest crisis stage according to GAME_RULES §6.5.
 *
 * @param unrest - Current public discontent level [0, 100].
 * @returns Active crisis classification.
 */
export function getUnrestCrisisStage(unrest: number): UnrestCrisisStage {
  if (unrest >= 100) return 'total_revolution'
  if (unrest >= 90) return 'urban_rebellion'
  if (unrest >= 75) return 'strife_desertion'
  if (unrest >= 50) return 'fiscal_boycott'
  return 'tranquility'
}
