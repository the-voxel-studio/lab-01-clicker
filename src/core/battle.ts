/**
 * Tactical Campaign & Asymmetric Battle Resolver.
 * Pure TypeScript, deterministic via injected PRNG.
 *
 * Implements:
 * - Asymmetric formula: Attacker -10% friction vs Defender +20% fortification + stronghold
 * - Razor-Thin Victory Rule (1.00 <= R <= 1.05 -> NO province awarded)
 * - Diverse Loot Types (AP, Population, Soldiers, Mixed) with +/-20% variance
 * - Defensive battle resolution & Defensive Collapse
 * - Scout recon reroll with permanent mortality
 *
 * @module core/battle
 */

import { BALANCE } from '@/data/balance'
import type { GameState } from './types'
import { PRNG } from './prng'

/** Possible offensive campaign outcomes. */
export type CampaignResultType =
  | 'decisive_victory'
  | 'clear_victory'
  | 'razor_thin_victory'
  | 'pyrrhic_standoff'
  | 'crushing_defeat'

/** Loot reward category. */
export type LootType = 'ap' | 'population' | 'soldiers' | 'mixed'

/** Concrete resolved loot distribution. */
export interface ResolvedLoot {
  ap: number
  population: number
  soldiers: number
}

/** Result summary of an offensive campaign clash. */
export interface CampaignClashResult {
  outcome: CampaignResultType
  clashRatio: number
  attackerEffectivePower: number
  defenderEffectivePower: number
  provinceWon: boolean
  casualtyRate: number
  unrestDelta: number
  loot: ResolvedLoot
}

/** Result summary of a defensive clash against scheduled threats or surprise raids. */
export interface DefensiveClashResult {
  success: boolean
  clashRatio: number
  isCollapse: boolean
  lostProvinces: number
  lostPopulation: number
  lostAp: number
  soldierCasualties: number
  unrestDelta: number
  events: string[]
}

/**
 * Calculates attacker effective power with siege friction and roll [0.92, 1.08].
 *
 * @param forces - Raw attack combat power.
 * @param prng - Deterministic PRNG instance.
 * @returns Object with roll and effective power.
 */
export function calculateAttackerPower(
  forces: number,
  prng: PRNG
): { roll: number; effectivePower: number } {
  const friction = 1.0 - BALANCE.ATTACKER_SIEGE_FRICTION // 0.90
  const roll = prng.nextBetween(0.92, 1.08)
  const effectivePower = forces * friction * roll
  return { roll, effectivePower }
}

/**
 * Calculates defender effective power with fortification bonus (+20%), strongholds, and roll [0.95, 1.10].
 *
 * @param forces - Raw defending combat power.
 * @param strongholdCount - Number of Border Stronghold provinces held.
 * @param prng - Deterministic PRNG instance.
 * @returns Object with roll and effective power.
 */
export function calculateDefenderPower(
  forces: number,
  strongholdCount: number,
  prng: PRNG
): { roll: number; effectivePower: number } {
  const fortBonus = 1.0 + BALANCE.DEFENDER_FORTIFICATION_BONUS // 1.20
  const strongholdFlat = strongholdCount * BALANCE.BORDER_STRONGHOLD_DEFENSE_FLAT // +12 flat
  const roll = prng.nextBetween(0.95, 1.10)
  const effectivePower = (forces * fortBonus + strongholdFlat) * roll
  return { roll, effectivePower }
}

/**
 * Calculates clash ratio R = AttackerPower / DefenderPower.
 */
export function calculateClashRatio(
  attackerEffectivePower: number,
  defenderEffectivePower: number
): number {
  if (defenderEffectivePower <= 0) return 999
  return attackerEffectivePower / defenderEffectivePower
}

/**
 * Evaluates the offensive campaign outcome matrix according to GAME_RULES §10.1.
 *
 * Paliers:
 * - R >= 1.40: Decisive Victory (Province Won, 120% loot, 10% casualties, -5 unrest)
 * - 1.05 < R < 1.40: Clear Victory (Province Won, 100% loot, 25% casualties, 0 unrest)
 * - 1.00 <= R <= 1.05: Razor-Thin Victory (NO PROVINCE WON, 50% loot, 50% casualties, +5 unrest)
 * - 0.80 <= R < 1.00: Pyrrhic Standoff (Defeat, no province, no loot, 75% casualties, +15 unrest)
 * - R < 0.80: Crushing Defeat (Defeat, no province, no loot, 100% casualties, +25 unrest)
 *
 * @param ratio - Calculated clash ratio.
 * @returns Campaign outcome metrics.
 */
export function evaluateCampaignOutcome(ratio: number): {
  outcome: CampaignResultType
  provinceWon: boolean
  lootMultiplier: number
  casualtyRate: number
  unrestDelta: number
} {
  if (ratio >= 1.40) {
    return {
      outcome: 'decisive_victory',
      provinceWon: true,
      lootMultiplier: 1.2,
      casualtyRate: 0.10,
      unrestDelta: -5,
    }
  }

  if (ratio > 1.05) {
    return {
      outcome: 'clear_victory',
      provinceWon: true,
      lootMultiplier: 1.0,
      casualtyRate: 0.25,
      unrestDelta: 0,
    }
  }

  if (ratio >= 1.00) {
    // Razor-Thin Victory: army too bloodied and exhausted to occupy territory!
    return {
      outcome: 'razor_thin_victory',
      provinceWon: false,
      lootMultiplier: 0.5,
      casualtyRate: 0.50,
      unrestDelta: 5,
    }
  }

  if (ratio >= 0.80) {
    return {
      outcome: 'pyrrhic_standoff',
      provinceWon: false,
      lootMultiplier: 0,
      casualtyRate: 0.75,
      unrestDelta: 15,
    }
  }

  return {
    outcome: 'crushing_defeat',
    provinceWon: false,
    lootMultiplier: 0,
    casualtyRate: 1.00,
    unrestDelta: 25,
  }
}

/**
 * Computes concrete campaign loot based on loot type and estimation variance (+/-20%).
 *
 * @param lootType - Category of spoils.
 * @param baseValue - Baseline value (typically target preview AP).
 * @param multiplier - Multiplier from campaign outcome (0 to 1.2).
 * @param prng - Deterministic PRNG instance.
 * @returns Concrete distributed rewards.
 */
export function resolveCampaignLoot(
  lootType: LootType,
  baseValue: number,
  multiplier: number,
  prng: PRNG
): ResolvedLoot {
  if (multiplier <= 0) {
    return { ap: 0, population: 0, soldiers: 0 }
  }

  const variance = prng.nextBetween(0.8, 1.2) // +/- 20% variance

  switch (lootType) {
    case 'ap':
      return {
        ap: Math.round(baseValue * multiplier * variance),
        population: 0,
        soldiers: 0,
      }

    case 'population':
      return {
        ap: 0,
        population: Math.round(prng.nextBetween(25, 75) * multiplier),
        soldiers: 0,
      }

    case 'soldiers':
      return {
        ap: 0,
        population: 0,
        soldiers: Math.round(prng.nextBetween(5, 15) * multiplier),
      }

    case 'mixed':
      return {
        ap: Math.round(baseValue * 0.5 * multiplier * variance),
        population: Math.round(prng.nextBetween(15, 35) * multiplier),
        soldiers: Math.round(prng.nextBetween(2, 6) * multiplier),
      }
  }
}

/**
 * Resolves a full offensive campaign clash and mutates state accordingly.
 *
 * @param state - The active mutable GameState.
 * @param attackingPower - Military power committed by player.
 * @param enemyDefendingPower - Enemy garrison power.
 * @param lootType - Previewed loot category.
 * @param baseLootAp - Estimated base AP value.
 * @param prng - Deterministic PRNG instance.
 * @returns CampaignClashResult summary.
 */
export function resolveOffensiveCampaign(
  state: GameState,
  attackingPower: number,
  enemyDefendingPower: number,
  lootType: LootType = 'ap',
  baseLootAp: number = 300,
  prng: PRNG = new PRNG(state.seed + state.tickIndex)
): CampaignClashResult {
  const { effectivePower: attackerEff } = calculateAttackerPower(attackingPower, prng)
  const { effectivePower: defenderEff } = calculateDefenderPower(enemyDefendingPower, 0, prng)

  const clashRatio = calculateClashRatio(attackerEff, defenderEff)
  const outcomeData = evaluateCampaignOutcome(clashRatio)
  const loot = resolveCampaignLoot(lootType, baseLootAp, outcomeData.lootMultiplier, prng)

  // Apply state mutations
  if (outcomeData.provinceWon) {
    state.provinces += 1
  }

  // Casualties applied to soldiers
  const soldierCount = state.units.soldier ?? 0
  const soldierCasualties = Math.round(soldierCount * outcomeData.casualtyRate)
  state.units.soldier = Math.max(0, soldierCount - soldierCasualties)
  state.totalPopulation = Math.max(0, state.totalPopulation - soldierCasualties)

  // Apply loot
  state.ap += loot.ap
  state.cumulativeApThisDeadline += loot.ap
  state.totalCumulativeAp += loot.ap

  state.totalPopulation += loot.population
  state.freeSerfs += loot.population

  state.units.soldier = (state.units.soldier ?? 0) + loot.soldiers
  state.totalPopulation += loot.soldiers

  // Apply unrest delta
  state.unrest = Math.max(0, Math.min(100, state.unrest + outcomeData.unrestDelta))

  return {
    outcome: outcomeData.outcome,
    clashRatio,
    attackerEffectivePower: attackerEff,
    defenderEffectivePower: defenderEff,
    provinceWon: outcomeData.provinceWon,
    casualtyRate: outcomeData.casualtyRate,
    unrestDelta: outcomeData.unrestDelta,
    loot,
  }
}

/**
 * Resolves a defensive battle where the player defends their realm.
 *
 * @param state - The active mutable GameState.
 * @param playerForces - Active military combat power of the player.
 * @param enemyAttackForces - Attack power of invading threat / raid.
 * @param strongholdCount - Controlled Border Strongholds granting +12 passive defense.
 * @param prng - Deterministic PRNG instance.
 * @returns DefensiveClashResult summary.
 */
export function resolveDefensiveClash(
  state: GameState,
  playerForces: number,
  enemyAttackForces: number,
  strongholdCount: number = 0,
  prng: PRNG = new PRNG(state.seed + state.tickIndex + 42)
): DefensiveClashResult {
  const { effectivePower: defenderEff } = calculateDefenderPower(playerForces, strongholdCount, prng)
  const { effectivePower: attackerEff } = calculateAttackerPower(enemyAttackForces, prng)

  const enemyRatio = calculateClashRatio(attackerEff, defenderEff)
  const events: string[] = []

  if (enemyRatio < 1.0) {
    // Player wins defense!
    const casualtyRate = 0.10
    const currentSoldiers = state.units.soldier ?? 0
    const deadSoldiers = Math.round(currentSoldiers * casualtyRate)
    state.units.soldier = Math.max(0, currentSoldiers - deadSoldiers)
    state.totalPopulation = Math.max(0, state.totalPopulation - deadSoldiers)
    state.unrest = Math.max(0, state.unrest - 5)

    events.push(`Enemy repelled! Suffered ${deadSoldiers} soldier casualties (-5 Unrest).`)

    return {
      success: true,
      clashRatio: 1.0 / enemyRatio,
      isCollapse: false,
      lostProvinces: 0,
      lostPopulation: deadSoldiers,
      lostAp: 0,
      soldierCasualties: deadSoldiers,
      unrestDelta: -5,
      events,
    }
  }

  // Defensive Collapse: Devastating breach!
  const lostProvinces = state.provinces > BALANCE.PROVINCE_MIN_FLOOR_FOR_FINES ? 1 : 0
  state.provinces = Math.max(BALANCE.PROVINCE_MIN_FLOOR_FOR_FINES, state.provinces - lostProvinces)

  // 100% of committed soldiers killed
  const soldierCasualties = (state.units.soldier ?? 0) + (state.units.man_at_arms ?? 0)
  state.units.soldier = 0
  state.units.man_at_arms = 0
  state.totalPopulation = Math.max(0, state.totalPopulation - soldierCasualties)

  // 15% to 25% of civilian population slaughtered or abducted
  const civilianLossFraction = prng.nextBetween(0.15, 0.25)
  const lostCivilians = Math.round(state.totalPopulation * civilianLossFraction)
  state.totalPopulation = Math.max(0, state.totalPopulation - lostCivilians)
  state.freeSerfs = Math.max(0, state.freeSerfs - lostCivilians)

  // 30% to 50% AP treasury looted
  const apLossFraction = prng.nextBetween(0.30, 0.50)
  const lostAp = Math.round(state.ap * apLossFraction)
  state.ap = Math.max(0, state.ap - lostAp)

  state.unrest = Math.min(100, state.unrest + 20)

  events.push(
    `Defensive Collapse! Lost ${lostProvinces} Province, ${soldierCasualties} soldiers killed, ${lostCivilians} civilians lost, ${lostAp} AP pillaged.`
  )

  return {
    success: false,
    clashRatio: 1.0 / enemyRatio,
    isCollapse: true,
    lostProvinces,
    lostPopulation: soldierCasualties + lostCivilians,
    lostAp,
    soldierCasualties,
    unrestDelta: 20,
    events,
  }
}

/**
 * Executes an infinite scout recon patrol reroll.
 * Enforces the Mortality Rule: exactly 1 scout dies permanently.
 *
 * @param state - The active mutable GameState.
 * @returns boolean indicating if scout reroll succeeded (false if no scouts available).
 */
export function performScoutReroll(state: GameState): boolean {
  const currentScouts = state.units.scout ?? 0
  if (currentScouts < 1) {
    return false
  }

  // 1 Scout slain during deep reconnaissance
  state.units.scout = currentScouts - 1
  state.totalPopulation = Math.max(0, state.totalPopulation - 1)
  return true
}

/**
 * Handles the three responses to scheduled Crown threats (GAME_RULES §8.2).
 *
 * 1. Armed Defense: Player acts as Defender (+20% fortification).
 * 2. Pay Crown Tribute: Costs 20% of current deadline AP quota. Bypasses combat.
 * 3. Levy en Masse: Mobilizes 10% pop, +30 unrest, 5% casualties. Repels threat.
 *
 * @param state - The active mutable GameState.
 * @param response - Chosen defense strategy.
 * @param threatPower - Base power of incoming threat.
 * @param tributeAp - Required tribute AP cost.
 * @param prng - Deterministic PRNG instance.
 * @returns Resolution summary.
 */
export function resolveScheduledThreat(
  state: GameState,
  response: 'defense' | 'tribute' | 'levy',
  threatPower: number,
  tributeAp: number,
  prng: PRNG = new PRNG(state.seed + state.deadline * 100)
): { success: boolean; message: string } {
  if (response === 'tribute') {
    if (state.ap < tributeAp) {
      return {
        success: false,
        message: `Insufficient treasury to pay tribute (${tributeAp} AP required, ${Math.floor(state.ap)} AP available).`,
      }
    }
    state.ap -= tributeAp
    return {
      success: true,
      message: `Paid Crown Tribute of ${tributeAp} AP. Threat averted peacefully.`,
    }
  }

  if (response === 'levy') {
    const casualties = Math.round(state.totalPopulation * 0.05)
    state.totalPopulation = Math.max(0, state.totalPopulation - casualties)
    state.freeSerfs = Math.max(0, state.freeSerfs - casualties)
    state.unrest = Math.min(100, state.unrest + 30)
    return {
      success: true,
      message: `Levy en Masse repelled the threat! Suffered ${casualties} civilian casualties and +30 Unrest.`,
    }
  }

  // response === 'defense':
  let playerMilPower = (state.units.soldier ?? 0) * 1.0 + (state.units.man_at_arms ?? 0) * 7.0
  const sergeantBonus = (state.units.sergeant ?? 0) * 0.015
  const captainBonus = (state.units.captain ?? 0) * 0.07
  playerMilPower *= 1.0 + sergeantBonus + captainBonus

  const result = resolveDefensiveClash(state, playerMilPower, threatPower, 0, prng)

  return {
    success: result.success,
    message: result.events.join(' '),
  }
}
