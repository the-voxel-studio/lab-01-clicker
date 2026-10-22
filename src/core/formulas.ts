/**
 * Canonical Mathematical Models & System Formulas.
 * Pure TypeScript, deterministic, fully covered by unit tests.
 *
 * @module core/formulas
 */

import { UNITS_DATA } from '@/data/balance'
import type { UnitId, UnitOrder, UnrestCrisisStage, UnitBalanceDef, GameState } from './types'
import { DEFAULT_ENGINE_CONFIG, type EngineConfig } from './config'

/**
 * Refills the ergonomic click token bucket based on elapsed delta-time.
 * Strictly deterministic; relies exclusively on injected delta-time, never system clocks.
 *
 * @param currentTokens - Available click tokens before tick.
 * @param dt - Elapsed delta-time in seconds.
 * @param maxTokens - Maximum token bucket capacity.
 * @param config - Injected engine configuration.
 * @returns The new token count capped at maxTokens.
 */
export function refillTokenBucket(
  currentTokens: number,
  dt: number,
  maxTokens?: number,
  config: EngineConfig = DEFAULT_ENGINE_CONFIG,
): number {
  const capacity = maxTokens ?? config.balance.CLICK_MAX_TOKENS_PER_SECOND
  return Math.min(capacity, currentTokens + capacity * dt)
}

/**
 * Calculates the Administrative Power awarded by an executive decree click.
 *
 * Formula: ClickValue = [1 + max(0, Gross AP/s * 0.035)] * SealMultiplier * CriticalMultiplier
 *
 * @param grossApRate - Current gross AP production per second across all sources.
 * @param sealMultiplier - Active decree power multipliers (e.g. laws, perks).
 * @param isCritical - Whether this click triggered an Imperial Wax Seal critical strike.
 * @param config - Injected engine configuration.
 * @returns The total AP produced by the click.
 */
export function calculateClickValue(
  grossApRate: number,
  sealMultiplier: number = 1.0,
  isCritical: boolean = false,
  config: EngineConfig = DEFAULT_ENGINE_CONFIG,
): number {
  const baseValue = 1.0 + Math.max(0, grossApRate * 0.035)
  const critMultiplier = isCritical ? config.balance.CLICK_CRITICAL_MULTIPLIER : 1.0
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
  countToBuy: number,
  config: EngineConfig = DEFAULT_ENGINE_CONFIG,
): number {
  if (countToBuy <= 0) return 0
  const unit = UNITS_DATA[unitId]
  if (!unit) {
    throw new Error(`Unknown unit identifier: ${unitId}`)
  }

  const baseCost = unit.baseCost
  const ratio =
    unit.tier === 1 ? config.balance.TIER_I_COST_RATIO : config.balance.TIER_II_COST_RATIO

  if (countToBuy === 1) {
    return Math.round(baseCost * Math.pow(ratio, currentOwned) * 100) / 100
  }

  // Geometric sum: base * r^n * (r^K - 1) / (r - 1)
  const cost =
    baseCost * Math.pow(ratio, currentOwned) * ((Math.pow(ratio, countToBuy) - 1) / (ratio - 1))
  return Math.round(cost * 100) / 100
}

/**
 * Determines the maximum allowable bulk purchase size (1x, 10x, 50x, 100x).
 *
 * Rules (GAME_RULES.md §5.1 & Arbitrage 1.0 §8):
 * - 100x: Deadline >= 8 AND unit allowsBulk100 (Peasants and Scribes only)
 * - 50x: Deadline >= 6 OR TotalPopulation >= 1000
 * - 10x: Deadline >= 3 OR TotalPopulation >= 250
 * - 1x: Base default
 *
 * @param deadline - Current deadline index (1 to 10).
 * @param totalPopulation - Total living population.
 * @param def - Target unit balance definition.
 * @param _config - Injected engine configuration.
 * @returns Maximum allowable purchase count (1, 10, 50, or 100).
 */
export function getMaxBulkSize(
  deadline: number,
  totalPopulation: number,
  def: UnitBalanceDef,
  _config: EngineConfig = DEFAULT_ENGINE_CONFIG,
): 1 | 10 | 50 | 100 {
  if (deadline >= 8 && def.allowsBulk100) {
    return 100
  }
  if (deadline >= 6 || totalPopulation >= 1000) {
    return 50
  }
  if (deadline >= 3 || totalPopulation >= 250) {
    return 10
  }
  return 1
}

/**
 * Computes the maximum affordable units (Buy Max) given budget, demographic, and headroom constraints.
 *
 * Inverts the geometric progression formula:
 * K = floor( log(1 + (budget * (r - 1)) / (base * r^n)) / log(r) )
 *
 * @param unitId - Target unit identifier.
 * @param currentOwned - Currently owned unit count.
 * @param availableAp - Available treasury budget.
 * @param freeSerfs - Available free serfs for recruitment (0 if unconstrained).
 * @param orderHeadroom - Remaining slot capacity under the order cap.
 * @param maxBulkSizeOrConfig - Maximum bulk size ceiling OR injected engine configuration.
 * @param maybeConfig - Injected engine configuration if maxBulkSize was provided.
 * @returns Maximum valid count that can be purchased.
 */
export function calculateMaxAffordableUnits(
  unitId: UnitId,
  currentOwned: number,
  availableAp: number,
  freeSerfs: number,
  orderHeadroom: number,
  maxBulkSizeOrConfig?: number | EngineConfig,
  maybeConfig?: EngineConfig,
): number {
  const maxBulkSize = typeof maxBulkSizeOrConfig === 'number' ? maxBulkSizeOrConfig : Infinity
  const config =
    typeof maxBulkSizeOrConfig === 'object' && maxBulkSizeOrConfig !== null
      ? maxBulkSizeOrConfig
      : (maybeConfig ?? DEFAULT_ENGINE_CONFIG)

  if (availableAp <= 0 || freeSerfs <= 0 || orderHeadroom <= 0 || maxBulkSize <= 0) return 0
  const unit = UNITS_DATA[unitId]
  if (!unit) return 0

  const baseCost = unit.baseCost
  const ratio =
    unit.tier === 1 ? config.balance.TIER_I_COST_RATIO : config.balance.TIER_II_COST_RATIO

  const costOfCurrent = baseCost * Math.pow(ratio, currentOwned)
  if (availableAp < costOfCurrent) return 0

  // Inverted geometric series sum:
  // budget = costOfCurrent * (r^K - 1) / (r - 1)
  // r^K = 1 + budget * (r - 1) / costOfCurrent
  const term = 1 + (availableAp * (ratio - 1)) / costOfCurrent
  if (term <= 1) return 0

  const theoreticalMax = Math.floor(Math.log(term) / Math.log(ratio))
  let affordableByAp = Math.max(0, theoreticalMax)

  // Floating point rounding correction: decrement until cost <= availableAp
  while (
    affordableByAp > 0 &&
    calculateUnitCost(unitId, currentOwned, affordableByAp, config) > availableAp
  ) {
    affordableByAp--
  }

  return Math.min(affordableByAp, Math.floor(freeSerfs), Math.floor(orderHeadroom), maxBulkSize)
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
  growthRateR?: number,
  taxRate?: number,
  config: EngineConfig = DEFAULT_ENGINE_CONFIG,
): number {
  if (population <= 0 || maxPopulation <= 0) return 0

  // If population exceeds capacity, growth drops to 0 (overcrowding handles bleed)
  if (population >= maxPopulation) return 0

  const r = growthRateR ?? config.balance.BASE_POP_GROWTH_RATE_R
  const t = taxRate ?? config.balance.STARTING_TAX_RATE
  const fiscalFactor = calculateFiscalFactor(t)
  const saturationRatio = 1.0 - population / maxPopulation
  return r * population * saturationRatio * fiscalFactor
}

/**
 * Calculates maximum living population capacity from the per-province base housing.
 *
 * Formula: MaxPop = BaseHousing * [1 + 0.015 * Notables + 0.06 * Barons]
 *
 * @param baseHousing - Sum of the per-province base housing (see getHousingBase).
 * @param notables - Count of active Notables (Tier I).
 * @param barons - Count of active Barons (Tier II).
 * @returns Maximum sustainable population.
 */
export function calculateHousingCapacity(
  baseHousing: number,
  notables: number = 0,
  barons: number = 0,
): number {
  // Integer thousandths: floating point 1 + 0.015 x n is inexact and broke .5 rounding.
  return Math.round((baseHousing * (1000 + notables * 15 + barons * 60)) / 1000)
}

/**
 * Calculates AP cost for peaceful civil province colonisation.
 *
 * Formula: Cost = 1500 * (2^k)
 *
 * @param colonisedCount - Number of previously colonised provinces.
 * @param config - Injected engine configuration.
 * @returns AP cost for the next colony.
 */
export function calculateColonisationCost(
  colonisedCount: number,
  config: EngineConfig = DEFAULT_ENGINE_CONFIG,
): number {
  return (
    config.balance.COLONISATION_BASE_COST *
    Math.pow(config.balance.COLONISATION_COST_MULTIPLIER, colonisedCount)
  )
}

/**
 * Calculates continuous non-quadratic Special Collector output.
 *
 * Formula: Output = YieldRate * min(n, FreeSerfs / 100)
 *
 * @param collectorCount - Number of Collectors or Farmers-General active.
 * @param freeSerfs - Living free serfs available to be taxed.
 * @param yieldRate - Base production rate per 100 serfs (0.80 for Collector, 4.50 for Farmer-General).
 * @param config - Injected engine configuration.
 * @returns Gross AP produced per second.
 */
export function calculateCollectorYield(
  collectorCount: number,
  freeSerfs: number,
  yieldRate: number,
  config: EngineConfig = DEFAULT_ENGINE_CONFIG,
): number {
  if (collectorCount <= 0 || freeSerfs <= 0) return 0
  const coveragePool = freeSerfs / config.balance.SERFS_PER_COLLECTOR
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
 * @param config - Injected engine configuration.
 * @returns Paperwork friction ratio [0, 1].
 */
export function calculatePaperworkFriction(
  units: Record<UnitId, number>,
  provinces: number,
  archivistReduction: number = 0,
  config: EngineConfig = DEFAULT_ENGINE_CONFIG,
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

  const rawPaperwork = size / (size + config.balance.BUREAUCRACY_SCALE_S)
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

/**
 * Calculates historical run score upon conclusion of a run (GAME_RULES §13.1).
 *
 * Formula:
 * Score = (TotalCumulativeAp * 0.01) + (PeakPopulation * 2) + (Provinces * 500) + (Victories * 200) - (Strikes * 1000)
 *
 * @param state - The active or terminal GameState.
 * @returns Integer score representing sovereign dynasty prestige.
 */
export function calculateRunScore(state: GameState): number {
  const apScore = (state.totalCumulativeAp ?? 0) * 0.01
  const popScore = (state.peakPopulation ?? 0) * 2
  const provScore = (state.provinces ?? 0) * 500
  const victoryScore = (state.victoriesCount ?? 0) * 200
  const penalty = (state.strikes ?? 0) * 1000
  return Math.round(apScore + popScore + provScore + victoryScore - penalty)
}

/**
 * Derives the dynastic nobility title awarded upon victory or defeat (GAME_RULES §13.2).
 *
 * @param state - The active or terminal GameState.
 * @param score - Optional precomputed run score.
 * @returns Dynastic nobility title string.
 */
export function getDynasticTitle(state: GameState, score?: number): string {
  // Defeat outcomes
  if (!state.isVictory && state.isGameOver) {
    switch (state.defeatReason) {
      case 'bankruptcy':
        return 'Bankrupt Beggar'
      case 'revolution':
        return 'The Fallen Tyrant'
      case 'conquest':
        return 'The Subjugated Vassal'
      case 'quota_failure':
      default:
        return 'The Disgraced Regent'
    }
  }

  // Victory outcomes
  if (state.isVictory) {
    if (state.provinces >= 8) {
      return 'The Bloodied Conqueror'
    }
    if (state.totalPopulation >= 4000 && (state.starvationLosses ?? 0) === 0) {
      return 'Father of the Nation'
    }
    const finalScore = score ?? calculateRunScore(state)
    const adminContribution = (state.totalCumulativeAp ?? 0) * 0.01
    if (finalScore > 0 && adminContribution > 0.6 * finalScore) {
      return 'Grand Treasurer of the Crown'
    }
    return 'Universal Sovereign'
  }

  // Active / in-progress run
  return 'The Sovereign Regent'
}
