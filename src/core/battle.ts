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

import type { GameState, CampaignTarget, BiomeId, FactionId } from './types'
import { PRNG, withStatePrng } from './prng'
import { DEFAULT_ENGINE_CONFIG, type EngineConfig } from './config'
import { addUnrest, applyPopulationLoss, removeUnits, triggerDefeat } from './mutations'
import { calculateMilitaryPower, calculateMaxPopulation } from './engine'
import { addProvince, removeLastProvince } from './provinces'
import { calculateOrderCaps, recordPeakPopulation } from './formulas'
import { composeStat, extractRawEvaluationState } from './modifiers'
import { hasRule } from './rules'
import { UNITS_DATA, type UnitId } from '@/data/balance'
import type { FactionTraitResult } from '@/data/threats'

/**
 * Distributes military casualties proportionally between Soldier and Man-at-Arms retinues.
 *
 * @param state - GameState to mutate.
 * @param casualtyRate - Casualty fraction to apply [0, 1].
 * @returns Total soldier and man-at-arms casualties inflicted.
 */
export function applyRetinueCasualties(
  state: GameState,
  casualtyRate: number,
): { soldierCasualties: number; manAtArmsCasualties: number; totalCasualties: number } {
  const soldiers = state.units.soldier ?? 0
  const menAtArms = state.units.man_at_arms ?? 0
  const total = soldiers + menAtArms
  if (total <= 0 || casualtyRate <= 0) {
    return { soldierCasualties: 0, manAtArmsCasualties: 0, totalCasualties: 0 }
  }

  const totalCasualties = Math.round(total * casualtyRate)
  const soldierCasualties = Math.min(soldiers, Math.round(totalCasualties * (soldiers / total)))
  const manAtArmsCasualties = Math.min(menAtArms, totalCasualties - soldierCasualties)
  const sumLoss = soldierCasualties + manAtArmsCasualties

  state.units.soldier = soldiers - soldierCasualties
  state.units.man_at_arms = menAtArms - manAtArmsCasualties
  state.totalPopulation = Math.max(0, state.totalPopulation - sumLoss)

  return { soldierCasualties, manAtArmsCasualties, totalCasualties: sumLoss }
}

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

/** Faction trait values that shape a defensive collapse. */
export type CollapseTrait = Pick<
  FactionTraitResult,
  'extraCivilianCasualtyRate' | 'extraProvincesLost'
>

/** Collapse trait of a threat without faction effects, such as a surprise raid. */
const NO_COLLAPSE_TRAIT: CollapseTrait = { extraCivilianCasualtyRate: 0, extraProvincesLost: 0 }

/** Every faction a campaign target can belong to, in draw order. */
const FACTION_IDS: readonly FactionId[] = [
  'outlaws',
  'barons',
  'mercenaries',
  'zealots',
  'steppe_horsemen',
  'imperial_legions',
]

/** Maximum scout uncertainty margin of a Steppe Horsemen target (twice the base 0.45). */
const STEPPE_MAX_MARGIN = 0.9

/** Loot type each faction always carries; steppe and imperial targets roll a mixed draw. */
const FACTION_LOOT: Partial<Record<FactionId, LootType>> = {
  outlaws: 'population',
  barons: 'soldiers',
  mercenaries: 'ap',
  zealots: 'population',
}

/** Combat roll range of the side the player commands under Vanguard Drills (GAME_RULES §10.3). */
const VANGUARD_ROLL_RANGE: readonly [number, number] = [1.05, 1.2]

/**
 * Calculates attacker effective power with siege friction and a combat roll.
 *
 * @param forces - Raw attack combat power.
 * @param prng - Deterministic PRNG instance.
 * @param config - Injected engine configuration.
 * @param rollRange - Combat roll range, [0.92, 1.08] by default.
 * @returns Object with roll and effective power.
 */
export function calculateAttackerPower(
  forces: number,
  prng: PRNG,
  config: EngineConfig = DEFAULT_ENGINE_CONFIG,
  rollRange: readonly [number, number] = [0.92, 1.08],
): { roll: number; effectivePower: number } {
  const friction = 1.0 - config.balance.ATTACKER_SIEGE_FRICTION // 0.90
  const roll = prng.nextBetween(rollRange[0], rollRange[1])
  const effectivePower = forces * friction * roll
  return { roll, effectivePower }
}

/**
 * Calculates defender effective power with fortification bonus (+20%), strongholds, and roll [0.95, 1.10].
 *
 * @param forces - Raw defending combat power.
 * @param strongholdCount - Number of Border Stronghold provinces held.
 * @param prng - Deterministic PRNG instance.
 * @param config - Injected engine configuration.
 * @param manAtArmsCount - Men-at-Arms held, each adding flat defense.
 * @param strongholdMultiplier - Factor on the stronghold defense, 2 under Guerrilla Border Watch.
 * @param rollRange - Combat roll range, [0.95, 1.10] by default.
 * @returns Object with roll and effective power.
 */
export function calculateDefenderPower(
  forces: number,
  strongholdCount: number,
  prng: PRNG,
  config: EngineConfig = DEFAULT_ENGINE_CONFIG,
  manAtArmsCount: number = 0,
  strongholdMultiplier: number = 1,
  rollRange: readonly [number, number] = [0.95, 1.1],
): { roll: number; effectivePower: number } {
  const fortBonus = 1.0 + config.balance.DEFENDER_FORTIFICATION_BONUS // 1.20
  const strongholdFlat =
    strongholdCount * config.balance.BORDER_STRONGHOLD_DEFENSE_FLAT * strongholdMultiplier // +12 flat
  const manAtArmsFlat = manAtArmsCount * 0.5 // +0.5 flat defense per Man-at-Arms (§4)
  const roll = prng.nextBetween(rollRange[0], rollRange[1])
  const effectivePower = (forces * fortBonus + strongholdFlat + manAtArmsFlat) * roll
  return { roll, effectivePower }
}

/**
 * Calculates clash ratio R = AttackerPower / DefenderPower.
 */
export function calculateClashRatio(
  attackerEffectivePower: number,
  defenderEffectivePower: number,
): number {
  if (defenderEffectivePower <= 0) return 999
  return attackerEffectivePower / defenderEffectivePower
}

/**
 * Evaluates the offensive campaign outcome matrix according to GAME_RULES §10.1 and §7.4.1.
 *
 * Paliers (casualties are rolled uniformly in their range):
 * - R >= 1.40: Decisive Victory (Province Won, 120% loot, 8-12% casualties, -5 unrest)
 * - 1.05 < R < 1.40: Clear Victory (Province Won, 100% loot, 20-30% casualties, 0 unrest)
 * - 1.00 <= R <= 1.05: Razor-Thin Victory (NO PROVINCE WON, 50% loot, 45-55% casualties, +5 unrest)
 * - 0.80 <= R < 1.00: Pyrrhic Standoff (Defeat, no province, no loot, 70-80% casualties, +15 unrest)
 * - R < 0.80: Crushing Defeat (Defeat, no province, no loot, 100% casualties, +25 unrest)
 *
 * @param ratio - Calculated clash ratio.
 * @param config - Injected engine configuration.
 * @param prng - Deterministic PRNG instance that rolls the casualty rate.
 * @returns Campaign outcome metrics, with the rolled casualty rate before any modifier.
 */
export function evaluateCampaignOutcome(
  ratio: number,
  config: EngineConfig,
  prng: PRNG,
): {
  outcome: CampaignResultType
  provinceWon: boolean
  lootMultiplier: number
  casualtyRate: number
  unrestDelta: number
} {
  const razorThinCeiling = 1.0 + config.balance.RAZOR_THIN_VICTORY_MARGIN

  if (ratio >= 1.4) {
    return {
      outcome: 'decisive_victory',
      provinceWon: true,
      lootMultiplier: 1.2,
      casualtyRate: prng.nextBetween(0.08, 0.12),
      unrestDelta: -5,
    }
  }

  if (ratio > razorThinCeiling) {
    return {
      outcome: 'clear_victory',
      provinceWon: true,
      lootMultiplier: 1.0,
      casualtyRate: prng.nextBetween(0.2, 0.3),
      unrestDelta: 0,
    }
  }

  if (ratio >= 1.0) {
    // Razor-Thin Victory: army too bloodied and exhausted to occupy territory!
    return {
      outcome: 'razor_thin_victory',
      provinceWon: false,
      lootMultiplier: 0.5,
      casualtyRate: prng.nextBetween(0.45, 0.55),
      unrestDelta: 5,
    }
  }

  if (ratio >= 0.8) {
    return {
      outcome: 'pyrrhic_standoff',
      provinceWon: false,
      lootMultiplier: 0,
      casualtyRate: prng.nextBetween(0.7, 0.8),
      unrestDelta: 15,
    }
  }

  return {
    outcome: 'crushing_defeat',
    provinceWon: false,
    lootMultiplier: 0,
    casualtyRate: 1.0,
    unrestDelta: 25,
  }
}

/**
 * Base AP value of campaign spoils: 10 seconds of the AP rate quota of the current deadline.
 *
 * @param state - The active GameState (its deadline picks the quota).
 * @param config - Injected engine configuration.
 * @returns Base loot before outcome, variance and modifier multipliers.
 */
export function calculateBaseCampaignLoot(
  state: GameState,
  config: EngineConfig = DEFAULT_ENGINE_CONFIG,
): number {
  const quota = config.quotas.find((q) => q.deadline === state.deadline) ?? config.quotas[0]!
  return 10 * quota.apRate
}

/**
 * Enemy defending power of a campaign target: its real power, or 25% above the highest scouted
 * estimate when the target is an ambush (GAME_RULES §7.3).
 *
 * @param target - The campaign target being attacked.
 * @returns Rounded enemy power.
 */
export function calculateEnemyPower(target: CampaignTarget): number {
  return target.isAmbush ? Math.round(target.perceivedMax * 1.25) : target.power
}

/**
 * Computes concrete campaign loot based on loot type and estimation variance (+/-20%).
 *
 * @param lootType - Category of spoils.
 * @param baseValue - Baseline value (typically target preview AP).
 * @param multiplier - Multiplier from campaign outcome (0 to 1.2), further scaled by the
 *   `battle_loot_multiplier` modifiers of `state`.
 * @param prng - Deterministic PRNG instance.
 * @param state - Active state that supplies the loot bonuses and modifiers.
 * @returns Concrete distributed rewards.
 */
export function resolveCampaignLoot(
  lootType: LootType,
  baseValue: number,
  multiplier: number,
  prng: PRNG,
  state?: GameState,
): ResolvedLoot {
  if (multiplier <= 0) {
    return { ap: 0, population: 0, soldiers: 0 }
  }

  const variance = prng.nextBetween(0.8, 1.2) // +/- 20% variance
  const lootModifier = state
    ? composeStat(
        'battle_loot_multiplier',
        1,
        state.activeModifiers,
        extractRawEvaluationState(state),
      )
    : 1
  multiplier *= Math.max(0, lootModifier)
  const sergeantCount = state?.units.sergeant ?? 0
  const sergeantBonus = 1.0 + sergeantCount * 0.02 // +2% battle loot value per Sergeant (§4)
  const guildCount = state?.units.guild ?? 0
  const guildApBonus = 1.0 + guildCount * 0.01 // +1% battle AP loot per Guild (§4)

  switch (lootType) {
    case 'ap':
      return {
        ap: Math.round(baseValue * multiplier * variance * sergeantBonus * guildApBonus),
        population: 0,
        soldiers: 0,
      }

    case 'population':
      return {
        ap: 0,
        population: Math.round(prng.nextBetween(25, 75) * multiplier * sergeantBonus),
        soldiers: 0,
      }

    case 'soldiers':
      return {
        ap: 0,
        population: 0,
        soldiers: Math.round(prng.nextBetween(5, 15) * multiplier * sergeantBonus),
      }

    case 'mixed':
      return {
        ap: Math.round(baseValue * 0.5 * multiplier * variance * sergeantBonus * guildApBonus),
        population: Math.round(prng.nextBetween(15, 35) * multiplier * sergeantBonus),
        soldiers: Math.round(prng.nextBetween(2, 6) * multiplier * sergeantBonus),
      }
  }
}

/** Unrest added by each campaign battle under Sanctioned Plunder (GAME_RULES §10.3). */
const SANCTIONED_PLUNDER_UNREST = 15

/**
 * Applies the `battle_casualty_rate` modifiers (base 1) to a casualty rate.
 *
 * @param state - Active state that supplies the modifiers.
 * @param rate - Casualty rate after captain mitigation.
 * @returns The modified rate, clamped to [0, 1].
 */
function modifiedCasualtyRate(state: GameState, rate: number): number {
  const factor = composeStat(
    'battle_casualty_rate',
    1,
    state.activeModifiers,
    extractRawEvaluationState(state),
  )
  return Math.min(1, Math.max(0, rate * factor))
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
 * @param config - Injected engine configuration.
 * @param targetBiome - Biome of the province awarded on a win.
 * @returns CampaignClashResult summary.
 */
export function resolveOffensiveCampaign(
  state: GameState,
  attackingPower: number,
  enemyDefendingPower: number,
  lootType: LootType = 'ap',
  baseLootAp: number = 300,
  prng: PRNG | undefined,
  config: EngineConfig,
  targetBiome: BiomeId,
): CampaignClashResult {
  if (!prng) {
    return withStatePrng(state, 'combat', (p) =>
      resolveOffensiveCampaign(
        state,
        attackingPower,
        enemyDefendingPower,
        lootType,
        baseLootAp,
        p,
        config,
        targetBiome,
      ),
    )
  }
  const { effectivePower: attackerEff } = calculateAttackerPower(
    attackingPower,
    prng,
    config,
    hasRule(state, 'law:vanguard_drills') ? VANGUARD_ROLL_RANGE : undefined,
  )
  const { effectivePower: defenderEff } = calculateDefenderPower(
    enemyDefendingPower,
    0,
    prng,
    config,
  )

  const clashRatio = calculateClashRatio(attackerEff, defenderEff)
  const outcomeData = evaluateCampaignOutcome(clashRatio, config, prng)
  if (clashRatio >= 1.0) {
    state.victoriesCount += 1
  }
  const loot = resolveCampaignLoot(lootType, baseLootAp, outcomeData.lootMultiplier, prng, state)

  // Apply state mutations
  if (outcomeData.provinceWon) {
    addProvince(state, targetBiome)
    state.capturedProvincesCount += 1
  }

  // Casualties applied proportionally to soldiers and men-at-arms, mitigated by Captains (-5% per Captain, max -50%)
  const captainCount = state.units.captain ?? 0
  const captainDiscount = Math.min(0.5, captainCount * 0.05)
  applyRetinueCasualties(
    state,
    modifiedCasualtyRate(state, outcomeData.casualtyRate * (1.0 - captainDiscount)),
  )

  // Apply loot (Neither cumulativeApThisDeadline nor totalCumulativeAp is credited with spoils of war!)
  state.ap += loot.ap

  state.totalPopulation += loot.population
  state.freeSerfs += loot.population

  // Soldier captives capped by military order headroom; excess joins freeSerfs
  if (loot.soldiers > 0) {
    const maxPop = calculateMaxPopulation(state, config)
    const orderCaps = calculateOrderCaps(
      maxPop,
      state.activeModifiers,
      extractRawEvaluationState(state),
    )
    let currentMil = 0
    for (const [id, count] of Object.entries(state.units) as [UnitId, number][]) {
      if (UNITS_DATA[id]?.order === 'military') {
        currentMil += count
      }
    }
    const milHeadroom = Math.max(0, orderCaps.military - currentMil)
    const soldiersAdmitted = Math.min(loot.soldiers, milHeadroom)
    const excessToFreeSerfs = loot.soldiers - soldiersAdmitted

    state.units.soldier = (state.units.soldier ?? 0) + soldiersAdmitted
    state.freeSerfs += excessToFreeSerfs
    state.totalPopulation += loot.soldiers
  }
  recordPeakPopulation(state)

  // Apply unrest delta
  addUnrest(state, outcomeData.unrestDelta, config)
  if (hasRule(state, 'law:sanctioned_plunder')) {
    addUnrest(state, SANCTIONED_PLUNDER_UNREST, config)
  }

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
 * @param config - Injected engine configuration.
 * @param tributeCost - Tribute of the repelled threat, basis of the battlefield salvage.
 * @param trait - Faction trait values applied if the defense collapses.
 * @returns DefensiveClashResult summary.
 */
export function resolveDefensiveClash(
  state: GameState,
  playerForces: number,
  enemyAttackForces: number,
  strongholdCount: number = 0,
  prng?: PRNG,
  config: EngineConfig = DEFAULT_ENGINE_CONFIG,
  tributeCost: number = 0,
  trait: CollapseTrait = NO_COLLAPSE_TRAIT,
): DefensiveClashResult {
  if (!prng) {
    return withStatePrng(state, 'combat', (p) =>
      resolveDefensiveClash(
        state,
        playerForces,
        enemyAttackForces,
        strongholdCount,
        p,
        config,
        tributeCost,
        trait,
      ),
    )
  }
  const { effectivePower: defenderEff } = calculateDefenderPower(
    playerForces,
    strongholdCount,
    prng,
    config,
    state.units.man_at_arms ?? 0,
    hasRule(state, 'law:guerrilla_border_watch') ? 2 : 1,
    hasRule(state, 'law:vanguard_drills') ? VANGUARD_ROLL_RANGE : undefined,
  )
  const { effectivePower: attackerEff } = calculateAttackerPower(enemyAttackForces, prng, config)

  const enemyRatio = calculateClashRatio(attackerEff, defenderEff)
  const events: string[] = []

  if (enemyRatio < 1.0) {
    // Player wins defense! (Casualties mitigated by Captains: -5% per Captain, max -50%)
    const captainCount = state.units.captain ?? 0
    const captainDiscount = Math.min(0.5, captainCount * 0.05)
    const { totalCasualties, soldierCasualties } = applyRetinueCasualties(
      state,
      modifiedCasualtyRate(state, 0.1 * (1.0 - captainDiscount)),
    )
    addUnrest(state, -5, config)
    state.victoriesCount += 1

    // Defensive salvage: 25% of the repelled threat's tribute cost with [0.8, 1.2] roll
    const salvage =
      tributeCost > 0 ? Math.round(0.25 * tributeCost * prng.nextBetween(0.8, 1.2)) : 0
    state.ap += salvage

    events.push(
      salvage > 0
        ? `Enemy repelled! Suffered ${totalCasualties} casualties, recovered +${salvage} AP in battlefield salvage (-5 Unrest).`
        : `Enemy repelled! Suffered ${totalCasualties} casualties (-5 Unrest).`,
    )

    return {
      success: true,
      clashRatio: 1.0 / enemyRatio,
      isCollapse: false,
      lostProvinces: 0,
      lostPopulation: totalCasualties,
      lostAp: 0,
      soldierCasualties,
      unrestDelta: -5,
      events,
    }
  }

  // Defensive Collapse: Devastating breach!
  // 1 Province permanently lost (No floor! Triggers conquest defeat if reduced to 0)
  let lostProvinces = 0
  for (let i = 0; i < 1 + trait.extraProvincesLost && state.provinces > 0; i++) {
    removeLastProvince(state)
    lostProvinces += 1
  }
  if (state.provinces <= 0) {
    triggerDefeat(state, 'conquest')
  }

  // 100% of entire military retinue killed
  let killedMilitary = 0
  for (const [id, count] of Object.entries(state.units) as [UnitId, number][]) {
    if (count > 0 && UNITS_DATA[id]?.order === 'military') {
      killedMilitary += count
      state.units[id] = 0
    }
  }
  state.totalPopulation = Math.max(0, state.totalPopulation - killedMilitary)

  // 15% to 25% of civilian population slaughtered or abducted
  const civilianLossFraction = prng.nextBetween(0.15, 0.25)
  const rawLostCivilians = Math.round(
    state.totalPopulation * civilianLossFraction * (1 + trait.extraCivilianCasualtyRate),
  )
  const lostCivilians = applyPopulationLoss(state, rawLostCivilians)

  // 30% to 50% AP treasury looted (signed treasury: existing debts are never cleared)
  const apLossFraction = prng.nextBetween(0.3, 0.5)
  const lostAp = Math.round(Math.max(0, state.ap) * apLossFraction)
  state.ap -= lostAp

  addUnrest(state, 20, config)

  events.push(
    `Defensive Collapse! Lost ${lostProvinces} ${lostProvinces === 1 ? 'Province' : 'Provinces'}, ${killedMilitary} military personnel killed, ${lostCivilians} civilians lost, ${lostAp} AP pillaged (+20 Unrest).`,
  )

  return {
    success: false,
    clashRatio: 1.0 / enemyRatio,
    isCollapse: true,
    lostProvinces,
    lostPopulation: killedMilitary + lostCivilians,
    lostAp,
    soldierCasualties: killedMilitary,
    unrestDelta: 20,
    events,
  }
}

/**
 * Generates a deterministic prospective campaign target for the Expedition phase.
 *
 * @param state - The active GameState.
 * @param config - Injected engine configuration.
 * @param prng - Optional PRNG instance (defaults to state combat stream).
 * @returns CampaignTarget populated with real enemy force and reconnaissance data.
 */
export function generateCampaignTarget(
  state: GameState,
  config: EngineConfig = DEFAULT_ENGINE_CONFIG,
  prng?: PRNG,
): CampaignTarget {
  if (!prng) {
    return withStatePrng(state, 'combat', (p) => generateCampaignTarget(state, config, p))
  }

  const biomes: BiomeId[] = ['farmlands', 'trade_hub', 'stronghold', 'wilderness']
  const lootTypes: LootType[] = ['ap', 'population', 'soldiers', 'mixed']

  const biomeIndex = Math.min(biomes.length - 1, Math.floor(prng.next() * biomes.length))
  const biome = biomes[biomeIndex]!

  const factionIndex = Math.min(
    FACTION_IDS.length - 1,
    Math.floor(prng.next() * FACTION_IDS.length),
  )
  const factionId = FACTION_IDS[factionIndex]!

  const lootIndex = Math.min(lootTypes.length - 1, Math.floor(prng.next() * lootTypes.length))
  const lootType = FACTION_LOOT[factionId] ?? lootTypes[lootIndex]!

  const quota = config.quotas.find((q) => q.deadline === state.deadline) ?? config.quotas[0]!
  const basePower = Math.max(15, Math.round(quota.military * prng.nextBetween(0.85, 1.25)))

  const scoutCount = state.units.scout ?? 0
  const spymasterCount = state.units.spymaster ?? 0
  const rawState = extractRawEvaluationState(state)
  const baseMargin = composeStat('scout_uncertainty_margin', 0.45, state.activeModifiers, rawState)
  const marginReduction = scoutCount * 0.12 + spymasterCount * 0.3
  const reducedMargin = baseMargin - marginReduction
  const uncertaintyMargin =
    factionId === 'steppe_horsemen'
      ? Math.min(STEPPE_MAX_MARGIN, Math.max(0.05, 2 * reducedMargin))
      : Math.max(0.05, reducedMargin)

  const ambushChance = composeStat('ambush_chance', 0.1, state.activeModifiers, rawState)
  const isFalseLedger = prng.next() < 0.15
  const isAmbush = prng.next() < ambushChance

  const target: CampaignTarget = {
    power: basePower,
    uncertaintyMargin,
    perceivedMin: Math.round(basePower * (1 - uncertaintyMargin)),
    perceivedMax: Math.round(basePower * (1 + uncertaintyMargin)),
    biome,
    lootType,
    factionId,
    isFalseLedger,
    isAmbush,
    revealedFalseLedger: spymasterCount >= 1 ? isFalseLedger : false,
    revealedAmbush: spymasterCount >= 1 ? isAmbush : false,
  }

  state.currentTarget = target
  return target
}

/**
 * Executes an infinite scout recon patrol reroll.
 * Enforces the Mortality Rule: exactly 1 scout dies permanently, and generates a fresh campaign target.
 *
 * @param state - The active mutable GameState.
 * @param config - Injected engine configuration.
 * @param prng - Optional PRNG instance.
 * @returns boolean indicating if scout reroll succeeded (false if no scouts available).
 */
export function performScoutReroll(
  state: GameState,
  config: EngineConfig = DEFAULT_ENGINE_CONFIG,
  prng?: PRNG,
): boolean {
  const currentScouts = state.units.scout ?? 0
  if (currentScouts < 1) {
    return false
  }

  // 1 Scout slain during deep reconnaissance
  state.units.scout = currentScouts - 1
  state.totalPopulation = Math.max(0, state.totalPopulation - 1)
  state.scoutsSacrificed = (state.scoutsSacrificed ?? 0) + 1

  // Generate a fresh campaign target on the combat stream
  generateCampaignTarget(state, config, prng)

  return true
}

/**
 * Handles the three responses to scheduled Crown threats (GAME_RULES §8.2).
 *
 * 1. Armed Defense: Player acts as Defender (+20% fortification).
 * 2. Pay Crown Tribute: Costs 20 seconds of AP gross rate quota (tributeAp). Bypasses combat.
 * 3. Levy en Masse: Mobilizes 10% pop, +30 unrest, 5% casualties. Repels threat.
 *
 * @param state - The active mutable GameState.
 * @param response - Chosen defense strategy.
 * @param threatPower - Base power of incoming threat.
 * @param tributeAp - Required tribute AP cost.
 * @param prng - Deterministic PRNG instance.
 * @param config - Injected engine configuration.
 * @param trait - Faction trait values: unrest and desertions hit before a fight or a levy, the
 *   collapse values shape a lost defense.
 * @returns Resolution summary.
 */
export function resolveScheduledThreat(
  state: GameState,
  response: 'defense' | 'tribute' | 'levy',
  threatPower: number,
  tributeAp: number,
  prng?: PRNG,
  config: EngineConfig = DEFAULT_ENGINE_CONFIG,
  trait: Pick<FactionTraitResult, keyof CollapseTrait | 'unrestDelta' | 'soldierDesertions'> = {
    ...NO_COLLAPSE_TRAIT,
    unrestDelta: 0,
    soldierDesertions: 0,
  },
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

  if (!prng) {
    return withStatePrng(state, 'combat', (p) =>
      resolveScheduledThreat(state, response, threatPower, tributeAp, p, config, trait),
    )
  }

  removeUnits(state, 'soldier', trait.soldierDesertions)
  if (trait.unrestDelta !== 0) addUnrest(state, trait.unrestDelta, config)

  if (response === 'levy') {
    const rawCasualties = Math.round(state.totalPopulation * 0.05)
    const casualties = applyPopulationLoss(state, rawCasualties)
    addUnrest(state, 30, config)
    return {
      success: true,
      message: `Levy en Masse repelled the threat! Suffered ${casualties} civilian casualties and +30 Unrest.`,
    }
  }

  // response === 'defense':
  const playerMilPower = calculateMilitaryPower(state)
  const strongholdCount = state.provinceBiomes.filter((b) => b === 'stronghold').length
  const result = resolveDefensiveClash(
    state,
    playerMilPower,
    threatPower,
    strongholdCount,
    prng,
    config,
    tributeAp,
    trait,
  )

  return {
    success: result.success,
    message: result.events.join(' '),
  }
}
