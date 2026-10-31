/**
 * The war panel: the odds of a campaign, walked over a grid of the rolls of the battle and of what
 * the scouts report. It never reads the true force of a target, its ambush or its false ledger.
 *
 * @module ui/war
 */

import {
  calculateBaseCampaignLoot,
  campaignAmbushChance,
  campaignCasualtyRate,
  campaignLossRate,
} from '@/core/battle'
import { DEFAULT_ENGINE_CONFIG, quotaForDeadline, type EngineConfig } from '@/core/config'
import {
  calculateMilitaryPower,
  effectiveQuota,
  hasFieldArmy,
  type EffectiveQuota,
} from '@/core/engine'
import { hasRule } from '@/core/rules'
import type { GameState } from '@/core/types'
import { BIOMES_DATA } from '@/data/biomes'
import { FACTIONS_DATA } from '@/data/threats'
import { formatCompact } from '@/ui/realmText'

const config = DEFAULT_ENGINE_CONFIG
const GRID = 9
const CHANCE_SCALE = 10

/** What the grid of rolls says about a campaign. */
export interface WarOdds {
  chance: number
  lossOnWin: [number, number]
  lossOnLoss: [number, number]
  lossPossible: boolean
}

/** Everything the war panel shows. */
export interface WarForecast {
  land: string
  faction: string
  yours: number
  theirsMin: number
  theirsMax: number
  warnings: string[]
  chance: number
  /** Chances out of ten, as the swords draw them. */
  outOfTen: number
  lossOnWin: string
  lossOnLoss: string
  loot: string
  blocked: string | null
  conquests: number
  step: number
  quotasBefore: EffectiveQuota
  quotasAfter: EffectiveQuota
}

function steps(low: number, high: number): number[] {
  return Array.from({ length: GRID }, (_, index) => low + ((high - low) * index) / (GRID - 1))
}

function rangeOf(values: number[]): [number, number] {
  return values.length > 0 ? [Math.min(...values), Math.max(...values)] : [0, 0]
}

/** Walks the rolls of the battle against each enemy force of a range. */
function walkRolls(
  force: number,
  enemies: readonly number[],
  engine: EngineConfig,
  attackerRolls: readonly [number, number],
): { share: number; onWin: number[]; onLoss: number[] } {
  const b = engine.balance
  const captureAbove = 1 + b.RAZOR_THIN_VICTORY_MARGIN
  const onWin: number[] = []
  const onLoss: number[] = []
  for (const enemy of enemies) {
    for (const attacker of steps(attackerRolls[0], attackerRolls[1])) {
      for (const defender of steps(b.DEFENDER_ROLL_MIN, b.DEFENDER_ROLL_MAX)) {
        const attack = force * (1 - b.ATTACKER_SIEGE_FRICTION) * attacker
        const ratio = attack / (enemy * (1 + b.DEFENDER_FORTIFICATION_BONUS) * defender)
        ;(ratio > captureAbove ? onWin : onLoss).push(campaignCasualtyRate(ratio, engine))
      }
    }
  }
  return { share: onWin.length / (onWin.length + onLoss.length || 1), onWin, onLoss }
}

/**
 * Walks the battle over the scouted force and both rolls, weighted by the chance of an ambush.
 *
 * @param force - Your force.
 * @param perceivedMin - Bottom of the scouted range.
 * @param perceivedMax - Top of the scouted range.
 * @param engine - Engine configuration.
 * @param attackerRolls - Your roll range, when a law changes it.
 * @param ambush - Chance of an ambush and the force it would bring.
 * @returns The chance of taking the province, and the shares of the army lost.
 */
export function warOdds(
  force: number,
  perceivedMin: number,
  perceivedMax: number,
  engine: EngineConfig,
  attackerRolls: readonly [number, number] = [
    engine.balance.ATTACKER_ROLL_MIN,
    engine.balance.ATTACKER_ROLL_MAX,
  ],
  ambush: { chance: number; power: number } = { chance: 0, power: 0 },
): WarOdds {
  const open = walkRolls(force, steps(perceivedMin, perceivedMax), engine, attackerRolls)
  const trapped = walkRolls(force, [ambush.power], engine, attackerRolls)
  const usesTrap = ambush.chance > 0
  const onLoss = usesTrap ? [...open.onLoss, ...trapped.onLoss] : open.onLoss
  const onWin = usesTrap ? [...open.onWin, ...trapped.onWin] : open.onWin
  return {
    chance: usesTrap
      ? open.share * (1 - ambush.chance) + trapped.share * ambush.chance
      : open.share,
    lossOnWin: rangeOf(onWin),
    lossOnLoss: rangeOf(onLoss),
    lossPossible: onLoss.length > 0,
  }
}

function landEffect(state: GameState): string {
  const target = state.currentTarget
  if (!target) return ''
  const biome = BIOMES_DATA[target.biome]
  const room = Math.round((biome.housingMultiplier - 1) * 100)
  const effects: string[] = []
  if (room !== 0) effects.push(`${room > 0 ? '+' : '−'}${Math.abs(room)}% room`)
  if (biome.deltaR > 0) effects.push(`+${Math.round(biome.deltaR * 1000) / 10}% births`)
  if (biome.taxEfficiencyBonus > 0) {
    effects.push(`+${Math.round(biome.taxEfficiencyBonus * 100)}% taxes`)
  }
  if (biome.passiveDefense > 0) effects.push(`+${biome.passiveDefense} defence`)
  if (biome.paperworkReduction > 0) {
    effects.push(`−${Math.round(biome.paperworkReduction * 100)}% paperwork`)
  }
  return effects.length > 0 ? `${biome.name}: ${effects.join(', ')}` : `${biome.name}: no bonus`
}

function lossText(state: GameState, range: [number, number], roll: number): string {
  const soldiers = (state.units.soldier ?? 0) + (state.units.man_at_arms ?? 0)
  const share = (rate: number): number =>
    Math.round(soldiers * campaignLossRate(state, rate, config))
  const low = share(Math.max(0, range[0] - roll))
  const high = share(Math.min(1, range[1] + roll))
  return low === high ? `−${high} soldiers` : `−${low} to −${high} soldiers`
}

function lootText(state: GameState): string {
  const base = formatCompact(calculateBaseCampaignLoot(state, config))
  switch (state.currentTarget?.lootType) {
    case 'population':
      return 'freed serfs join you'
    case 'soldiers':
      return 'captives join your ranks'
    case 'mixed':
      return `about ${base} AP and men`
    default:
      return `about ${base} AP`
  }
}

function auditQuota(state: GameState, steps_: number): EffectiveQuota {
  const deadline = state.phase === 'AWAIT_RESUME' ? state.deadline + 1 : state.deadline
  return effectiveQuota(
    { ...state, crownSurchargeSteps: steps_ },
    quotaForDeadline(config, deadline),
    state.activeModifiers,
    config,
  )
}

/** Reads the war panel, or null without a target. */
export function warForecast(state: GameState): WarForecast | null {
  const target = state.currentTarget
  if (!target) return null
  const army = hasFieldArmy(state)
  const force = army ? calculateMilitaryPower(state, config) : 0
  const b = config.balance
  const rolls = hasRule(state, 'law:vanguard_drills')
    ? ([b.VANGUARD_ROLL_MIN, b.VANGUARD_ROLL_MAX] as const)
    : undefined
  const spies = (state.units.spymaster ?? 0) >= 1
  // A spymaster settles the question; without one the player only knows how often it happens.
  const trapChance = spies ? (target.isAmbush ? 1 : 0) : campaignAmbushChance(state, config)
  const odds = warOdds(force, target.perceivedMin, target.perceivedMax, config, rolls, {
    chance: trapChance,
    power: target.perceivedMax * b.AMBUSH_POWER_FACTOR,
  })
  const warnings: string[] = []
  if (spies && target.isAmbush) warnings.push('An ambush waits.')
  if (spies && target.isFalseLedger) warnings.push('The loot is a lie.')
  const steps_ = state.crownSurchargeSteps
  const roll = b.CAMPAIGN_CASUALTY_ROLL
  return {
    land: landEffect(state),
    faction: FACTIONS_DATA[target.factionId].name,
    yours: force,
    theirsMin: Math.floor(target.perceivedMin),
    theirsMax: Math.ceil(target.perceivedMax),
    warnings,
    chance: odds.chance,
    outOfTen: Math.round(odds.chance * CHANCE_SCALE),
    lossOnWin: lossText(state, odds.lossOnWin, roll),
    lossOnLoss: odds.lossPossible ? lossText(state, odds.lossOnLoss, roll) : 'Not expected',
    loot: lootText(state),
    blocked: army ? null : 'You have no army',
    conquests: state.conquestsThisAudit,
    step: b.CONQUEST_SURCHARGE_STEP,
    quotasBefore: auditQuota(state, steps_),
    quotasAfter: auditQuota(state, state.conquestsThisAudit >= 1 ? steps_ + 1 : steps_),
  }
}
