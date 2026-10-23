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

/** Loot type each faction always carries; steppe and imperial targets roll a mixed draw. */
const FACTION_LOOT: Partial<Record<FactionId, LootType>> = {
  outlaws: 'population',
  barons: 'soldiers',
  mercenaries: 'ap',
  zealots: 'population',
}

/** Combat roll range of the side the player commands under Vanguard Drills (GAME_RULES §10.3). */
function vanguardRollRange(config: EngineConfig): readonly [number, number] {
  return [config.balance.VANGUARD_ROLL_MIN, config.balance.VANGUARD_ROLL_MAX]
}

/**
 * Calculates attacker effective power with siege friction and a combat roll.
 *
 * @param forces - Raw attack combat power.
 * @param prng - Deterministic PRNG instance.
 * @param config - Injected engine configuration.
 * @param rollRange - Combat roll range, `ATTACKER_ROLL_MIN` to `ATTACKER_ROLL_MAX` by default.
 * @returns Object with roll and effective power.
 */
export function calculateAttackerPower(
  forces: number,
  prng: PRNG,
  config: EngineConfig = DEFAULT_ENGINE_CONFIG,
  rollRange: readonly [number, number] = [
    config.balance.ATTACKER_ROLL_MIN,
    config.balance.ATTACKER_ROLL_MAX,
  ],
): { roll: number; effectivePower: number } {
  const friction = 1.0 - config.balance.ATTACKER_SIEGE_FRICTION // 0.90
  const roll = prng.nextBetween(rollRange[0], rollRange[1])
  const effectivePower = forces * friction * roll
  return { roll, effectivePower }
}

/**
 * Calculates defender effective power with fortification bonus, strongholds, men-at-arms and a roll.
 *
 * @param forces - Raw defending combat power.
 * @param strongholdCount - Number of Border Stronghold provinces held.
 * @param prng - Deterministic PRNG instance.
 * @param config - Injected engine configuration.
 * @param manAtArmsCount - Men-at-Arms held, each adding flat defense.
 * @param strongholdMultiplier - Factor on the stronghold defense, 2 under Guerrilla Border Watch.
 * @param rollRange - Combat roll range, `DEFENDER_ROLL_MIN` to `DEFENDER_ROLL_MAX` by default.
 * @returns Object with roll and effective power.
 */
export function calculateDefenderPower(
  forces: number,
  strongholdCount: number,
  prng: PRNG,
  config: EngineConfig = DEFAULT_ENGINE_CONFIG,
  manAtArmsCount: number = 0,
  strongholdMultiplier: number = 1,
  rollRange: readonly [number, number] = [
    config.balance.DEFENDER_ROLL_MIN,
    config.balance.DEFENDER_ROLL_MAX,
  ],
): { roll: number; effectivePower: number } {
  const fortBonus = 1.0 + config.balance.DEFENDER_FORTIFICATION_BONUS // 1.20
  const strongholdFlat =
    strongholdCount * config.balance.BORDER_STRONGHOLD_DEFENSE_FLAT * strongholdMultiplier // +12 flat
  const manAtArmsFlat = manAtArmsCount * config.balance.MAN_AT_ARMS_DEFENSE_FLAT // flat defense per Man-at-Arms (§4)
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
  config: EngineConfig = DEFAULT_ENGINE_CONFIG,
): number {
  if (defenderEffectivePower <= 0) return config.balance.UNDEFENDED_CLASH_RATIO
  return attackerEffectivePower / defenderEffectivePower
}

/**
 * Evaluates the offensive campaign outcome matrix according to GAME_RULES §10.1 and §7.4.1.
 *
 * Paliers (values from `CAMPAIGN_OUTCOMES`, casualties rolled uniformly in their range):
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

  const table = config.balance.CAMPAIGN_OUTCOMES

  if (ratio >= table.decisive.minRatio) {
    return {
      outcome: 'decisive_victory',
      provinceWon: true,
      lootMultiplier: table.decisive.lootMultiplier,
      casualtyRate: prng.nextBetween(table.decisive.casualtyMin, table.decisive.casualtyMax),
      unrestDelta: table.decisive.unrestDelta,
    }
  }

  if (ratio > razorThinCeiling) {
    return {
      outcome: 'clear_victory',
      provinceWon: true,
      lootMultiplier: table.clear.lootMultiplier,
      casualtyRate: prng.nextBetween(table.clear.casualtyMin, table.clear.casualtyMax),
      unrestDelta: table.clear.unrestDelta,
    }
  }

  if (ratio >= 1.0) {
    // Razor-Thin Victory: army too bloodied and exhausted to occupy territory!
    return {
      outcome: 'razor_thin_victory',
      provinceWon: false,
      lootMultiplier: table.razorThin.lootMultiplier,
      casualtyRate: prng.nextBetween(table.razorThin.casualtyMin, table.razorThin.casualtyMax),
      unrestDelta: table.razorThin.unrestDelta,
    }
  }

  if (ratio >= table.pyrrhic.minRatio) {
    return {
      outcome: 'pyrrhic_standoff',
      provinceWon: false,
      lootMultiplier: table.pyrrhic.lootMultiplier,
      casualtyRate: prng.nextBetween(table.pyrrhic.casualtyMin, table.pyrrhic.casualtyMax),
      unrestDelta: table.pyrrhic.unrestDelta,
    }
  }

  return {
    outcome: 'crushing_defeat',
    provinceWon: false,
    lootMultiplier: table.crushing.lootMultiplier,
    casualtyRate: table.crushing.casualtyRate,
    unrestDelta: table.crushing.unrestDelta,
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
  return config.balance.CAMPAIGN_BASE_LOOT_QUOTA_SECONDS * quota.apRate
}

/**
 * Enemy defending power of a campaign target: its real power, or `AMBUSH_POWER_FACTOR` times the highest scouted
 * estimate when the target is an ambush (GAME_RULES §7.3).
 *
 * @param target - The campaign target being attacked.
 * @param config - Injected engine configuration.
 * @returns Rounded enemy power.
 */
export function calculateEnemyPower(
  target: CampaignTarget,
  config: EngineConfig = DEFAULT_ENGINE_CONFIG,
): number {
  return target.isAmbush
    ? Math.round(target.perceivedMax * config.balance.AMBUSH_POWER_FACTOR)
    : target.power
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
 * @param config - Injected engine configuration.
 * @returns Concrete distributed rewards.
 */
export function resolveCampaignLoot(
  lootType: LootType,
  baseValue: number,
  multiplier: number,
  prng: PRNG,
  state?: GameState,
  config: EngineConfig = DEFAULT_ENGINE_CONFIG,
): ResolvedLoot {
  const balance = config.balance
  if (multiplier <= 0) {
    return { ap: 0, population: 0, soldiers: 0 }
  }

  const variance = prng.nextBetween(balance.LOOT_VARIANCE_MIN, balance.LOOT_VARIANCE_MAX)
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
  const sergeantBonus = 1.0 + sergeantCount * balance.SERGEANT_LOOT_BONUS // per Sergeant (§4)
  const guildCount = state?.units.guild ?? 0
  const guildApBonus = 1.0 + guildCount * balance.GUILD_LOOT_AP_BONUS // per Guild (§4)

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
        population: Math.round(
          prng.nextBetween(balance.LOOT_POPULATION_MIN, balance.LOOT_POPULATION_MAX) *
            multiplier *
            sergeantBonus,
        ),
        soldiers: 0,
      }

    case 'soldiers':
      return {
        ap: 0,
        population: 0,
        soldiers: Math.round(
          prng.nextBetween(balance.LOOT_SOLDIERS_MIN, balance.LOOT_SOLDIERS_MAX) *
            multiplier *
            sergeantBonus,
        ),
      }

    case 'mixed':
      return {
        ap: Math.round(
          baseValue *
            balance.LOOT_MIXED_AP_SHARE *
            multiplier *
            variance *
            sergeantBonus *
            guildApBonus,
        ),
        population: Math.round(
          prng.nextBetween(balance.LOOT_MIXED_POPULATION_MIN, balance.LOOT_MIXED_POPULATION_MAX) *
            multiplier *
            sergeantBonus,
        ),
        soldiers: Math.round(
          prng.nextBetween(balance.LOOT_MIXED_SOLDIERS_MIN, balance.LOOT_MIXED_SOLDIERS_MAX) *
            multiplier *
            sergeantBonus,
        ),
      }
  }
}

/**
 * Casualty discount of the Captains: `CAPTAIN_CASUALTY_DISCOUNT` per Captain, capped at
 * `CAPTAIN_CASUALTY_DISCOUNT_MAX`.
 */
function captainCasualtyDiscount(state: GameState, config: EngineConfig): number {
  return Math.min(
    config.balance.CAPTAIN_CASUALTY_DISCOUNT_MAX,
    (state.units.captain ?? 0) * config.balance.CAPTAIN_CASUALTY_DISCOUNT,
  )
}

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
  baseLootAp: number | undefined,
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
    hasRule(state, 'law:vanguard_drills') ? vanguardRollRange(config) : undefined,
  )
  const { effectivePower: defenderEff } = calculateDefenderPower(
    enemyDefendingPower,
    0,
    prng,
    config,
  )

  const clashRatio = calculateClashRatio(attackerEff, defenderEff, config)
  const outcomeData = evaluateCampaignOutcome(clashRatio, config, prng)
  if (clashRatio >= 1.0) {
    state.victoriesCount += 1
  }
  const loot = resolveCampaignLoot(
    lootType,
    baseLootAp ?? config.balance.CAMPAIGN_DEFAULT_BASE_LOOT_AP,
    outcomeData.lootMultiplier,
    prng,
    state,
    config,
  )

  // Apply state mutations
  if (outcomeData.provinceWon) {
    addProvince(state, targetBiome)
    state.capturedProvincesCount += 1
  }

  // Casualties applied proportionally to soldiers and men-at-arms, mitigated by Captains
  const captainDiscount = captainCasualtyDiscount(state, config)
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
      config,
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
    addUnrest(state, config.balance.SANCTIONED_PLUNDER_UNREST, config)
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
    hasRule(state, 'law:guerrilla_border_watch') ? config.balance.GUERRILLA_STRONGHOLD_FACTOR : 1,
    hasRule(state, 'law:vanguard_drills') ? vanguardRollRange(config) : undefined,
  )
  const { effectivePower: attackerEff } = calculateAttackerPower(enemyAttackForces, prng, config)

  const enemyRatio = calculateClashRatio(attackerEff, defenderEff, config)
  const events: string[] = []

  if (enemyRatio < 1.0) {
    // Player wins defense! (Casualties mitigated by Captains)
    const captainDiscount = captainCasualtyDiscount(state, config)
    const { totalCasualties, soldierCasualties } = applyRetinueCasualties(
      state,
      modifiedCasualtyRate(
        state,
        config.balance.DEFENSE_VICTORY_CASUALTY_RATE * (1.0 - captainDiscount),
      ),
    )
    addUnrest(state, config.balance.DEFENSE_VICTORY_UNREST_DELTA, config)
    state.victoriesCount += 1

    // Defensive salvage: a share of the repelled threat's tribute cost with a roll
    const salvage =
      tributeCost > 0
        ? Math.round(
            config.balance.DEFENSE_SALVAGE_SHARE *
              tributeCost *
              prng.nextBetween(config.balance.SALVAGE_ROLL_MIN, config.balance.SALVAGE_ROLL_MAX),
          )
        : 0
    state.ap += salvage

    events.push(
      salvage > 0
        ? `Enemy repelled! Suffered ${totalCasualties} casualties, recovered +${salvage} AP in battlefield salvage (${config.balance.DEFENSE_VICTORY_UNREST_DELTA} Unrest).`
        : `Enemy repelled! Suffered ${totalCasualties} casualties (${config.balance.DEFENSE_VICTORY_UNREST_DELTA} Unrest).`,
    )

    return {
      success: true,
      clashRatio: 1.0 / enemyRatio,
      isCollapse: false,
      lostProvinces: 0,
      lostPopulation: totalCasualties,
      lostAp: 0,
      soldierCasualties,
      unrestDelta: config.balance.DEFENSE_VICTORY_UNREST_DELTA,
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
  const civilianLossFraction = prng.nextBetween(
    config.balance.COLLAPSE_CIVILIAN_LOSS_MIN,
    config.balance.COLLAPSE_CIVILIAN_LOSS_MAX,
  )
  const rawLostCivilians = Math.round(
    state.totalPopulation * civilianLossFraction * (1 + trait.extraCivilianCasualtyRate),
  )
  const lostCivilians = applyPopulationLoss(state, rawLostCivilians)

  // 30% to 50% AP treasury looted (signed treasury: existing debts are never cleared)
  const apLossFraction = prng.nextBetween(
    config.balance.COLLAPSE_AP_LOSS_MIN,
    config.balance.COLLAPSE_AP_LOSS_MAX,
  )
  const lostAp = Math.round(Math.max(0, state.ap) * apLossFraction)
  state.ap -= lostAp

  addUnrest(state, config.balance.COLLAPSE_UNREST, config)

  events.push(
    `Defensive Collapse! Lost ${lostProvinces} ${lostProvinces === 1 ? 'Province' : 'Provinces'}, ${killedMilitary} military personnel killed, ${lostCivilians} civilians lost, ${lostAp} AP pillaged (+${config.balance.COLLAPSE_UNREST} Unrest).`,
  )

  return {
    success: false,
    clashRatio: 1.0 / enemyRatio,
    isCollapse: true,
    lostProvinces,
    lostPopulation: killedMilitary + lostCivilians,
    lostAp,
    soldierCasualties: killedMilitary,
    unrestDelta: config.balance.COLLAPSE_UNREST,
    events,
  }
}

/**
 * Places a perceived power band of width `2 x margin x power` with the real power at a drawn
 * position inside it, so the band midpoint no longer reveals the real power.
 *
 * @param power - Real enemy power.
 * @param margin - Uncertainty margin M (ratio).
 * @param position - Uniform draw in [0, 1): 0 puts the real power on the lower edge.
 * @returns Rounded lower and upper estimates; the real power is always inside.
 */
function perceivedBand(
  power: number,
  margin: number,
  position: number,
): { perceivedMin: number; perceivedMax: number } {
  const width = 2 * margin
  return {
    perceivedMin: Math.round(power * (1 - width * position)),
    perceivedMax: Math.round(power * (1 + width * (1 - position))),
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
  const basePower = Math.max(
    config.balance.TARGET_MIN_POWER,
    Math.round(
      quota.military *
        prng.nextBetween(
          config.balance.TARGET_POWER_ROLL_MIN,
          config.balance.TARGET_POWER_ROLL_MAX,
        ),
    ),
  )

  const scoutCount = state.units.scout ?? 0
  const spymasterCount = state.units.spymaster ?? 0
  const rawState = extractRawEvaluationState(state)
  const baseMargin = composeStat(
    'scout_uncertainty_margin',
    config.balance.SCOUT_UNCERTAINTY_BASE,
    state.activeModifiers,
    rawState,
  )
  const marginReduction =
    scoutCount * config.balance.SCOUT_MARGIN_PER_SCOUT +
    spymasterCount * config.balance.SCOUT_MARGIN_PER_SPYMASTER
  const reducedMargin = baseMargin - marginReduction
  const uncertaintyMargin =
    factionId === 'steppe_horsemen'
      ? Math.min(
          config.balance.STEPPE_MAX_MARGIN,
          Math.max(
            config.balance.SCOUT_UNCERTAINTY_MIN,
            config.balance.STEPPE_MARGIN_FACTOR * reducedMargin,
          ),
        )
      : Math.max(config.balance.SCOUT_UNCERTAINTY_MIN, reducedMargin)

  const ambushChance = composeStat(
    'ambush_chance',
    config.balance.AMBUSH_BASE_CHANCE,
    state.activeModifiers,
    rawState,
  )
  const isFalseLedger = prng.next() < config.balance.FALSE_LEDGER_CHANCE
  const isAmbush = prng.next() < ambushChance
  // Drawn last so the earlier draws of a target keep their sequence.
  const bandPosition = prng.next()

  const target: CampaignTarget = {
    power: basePower,
    uncertaintyMargin,
    ...perceivedBand(basePower, uncertaintyMargin, bandPosition),
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
 * 3. Levy en Masse: Costs `LEVY_CASUALTY_SHARE` of the population and `LEVY_UNREST` unrest. Repels threat.
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
    const rawCasualties = Math.round(state.totalPopulation * config.balance.LEVY_CASUALTY_SHARE)
    const casualties = applyPopulationLoss(state, rawCasualties)
    addUnrest(state, config.balance.LEVY_UNREST, config)
    return {
      success: true,
      message: `Levy en Masse repelled the threat! Suffered ${casualties} civilian casualties and +${config.balance.LEVY_UNREST} Unrest.`,
    }
  }

  // response === 'defense':
  const playerMilPower = calculateMilitaryPower(state, config)
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
