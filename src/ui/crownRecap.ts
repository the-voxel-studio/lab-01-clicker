/**
 * The recap of a reign on the four tabs of the Crown. Figures already on the HUD stay there: each
 * tab holds what the HUD does not say, read from the engine.
 *
 * @module ui/crownRecap
 */

import type { EngineConfig } from '@/core/config'
import {
  calculateGrossApRate,
  calculateMilitaryPower,
  calculateNetApRate,
  calculateNetPaperwork,
  calculateUpkeep,
  crownSurchargeFactor,
} from '@/core/engine'
import { calculateClickValue } from '@/core/formulas'
import { composeStat, extractRawEvaluationState } from '@/core/modifiers'
import { hasRule } from '@/core/rules'
import type { BiomeId, GameState, UnitId } from '@/core/types'
import type { CrownTab } from '@/stores/nav'
import { UNITS_DATA } from '@/data/balance'
import { BIOMES_DATA } from '@/data/biomes'
import { LAWS_DATA } from '@/data/laws'
import { UNIT_COPY } from '@/data/orderCopy'
import { FACTIONS_DATA, SCHEDULED_THREATS_DATA } from '@/data/threats'
import type { RealmRates } from '@/ui/effects'
import { defensiveForce } from '@/ui/moments'

/** Unrest from which the order bar and the tabs of the Crown raise their mark. */
export const UNREST_ALARM = 75

/** One province on its shield. */
export interface ShieldView {
  biome: BiomeId
  room: number
  note: string
}

/** The Realm tab. */
export interface RealmRecap {
  surcharge: number
  births: number
  room: number
  shields: ShieldView[]
  unrestPerSecond: number
  pardon: string
}

/** One line of the coffer. */
export interface CofferLine {
  label: string
  value: number
}

/** The Coffer tab. */
export interface CofferRecap {
  lines: CofferLine[]
  net: number
  clickValue: number
}

/** The Army tab. */
export interface ArmyRecap {
  field: number
  home: number
  units: { id: UnitId; name: string; count: number }[]
  threat: string | null
  conquests: number
  wars: number
}

/** The laws of the Decrees tab. */
export interface DecreesRecap {
  laws: { id: string; name: string; text: string }[]
  seats: number
}

function shieldNote(biome: BiomeId): string {
  const def = BIOMES_DATA[biome]
  if (def.deltaR > 0) return `births +${Math.round(def.deltaR * 1000) / 10}%`
  if (def.taxEfficiencyBonus > 0) return `taxes +${Math.round(def.taxEfficiencyBonus * 100)}%`
  if (def.passiveDefense > 0) return `defence +${def.passiveDefense}`
  if (def.paperworkReduction > 0) return `paperwork −${Math.round(def.paperworkReduction * 100)}%`
  return 'no bonus'
}

function pardonLine(state: GameState): string {
  if (hasRule(state, 'law_effect:pardon_forfeited')) {
    return 'No pardon at this audit. A failure is the last.'
  }
  return state.strikes > 0 ? 'Pardon spent. The next failure is the last.' : 'Pardon still yours.'
}

/** Reads the Realm tab. */
export function realmRecap(state: GameState, config: EngineConfig, rates: RealmRates): RealmRecap {
  return {
    surcharge: Math.round((crownSurchargeFactor(state, config) - 1) * 100),
    births: rates.births,
    room: rates.room,
    shields: state.provinceBiomes.map((biome) => ({
      biome,
      room: config.balance.BASE_HOUSING_PER_PROVINCE * BIOMES_DATA[biome].housingMultiplier,
      note: shieldNote(biome),
    })),
    unrestPerSecond: rates.unrestPerSecond,
    pardon: pardonLine(state),
  }
}

/**
 * What a plain press of the seal pays, with the laws on the seal and the paperwork a decree
 * does not bypass. Mirrors `STAMP_DOCUMENT` without its critical roll.
 */
function sealValue(state: GameState, config: EngineConfig, gross: number): number {
  const power = composeStat(
    'click_power',
    1,
    state.activeModifiers,
    extractRawEvaluationState(state),
  )
  const paperwork = calculateNetPaperwork(state, config) * config.balance.CLICK_PAPERWORK_MITIGATION
  return Math.round(calculateClickValue(gross, power, false, config) * (1 - paperwork) * 100) / 100
}

/**
 * Reads the Coffer tab: the lines sum to the net rate of the engine. Taxes is what the income
 * loses with a tax of 0, so the laws on the whole income fall on both lines.
 */
export function cofferRecap(state: GameState, config: EngineConfig): CofferRecap {
  const { total } = calculateGrossApRate(state, config)
  const work = calculateGrossApRate({ ...state, taxRate: 0 }, config).total
  const paperwork = total * calculateNetPaperwork(state, config)
  const wages = calculateUpkeep(state, config)
  return {
    lines: [
      { label: 'Taxes', value: total - work },
      { label: 'Work', value: work },
      { label: 'Paperwork', value: -paperwork },
      { label: 'Wages', value: -wages },
    ],
    net: calculateNetApRate(state, config),
    clickValue: sealValue(state, config, total),
  }
}

function nextThreat(state: GameState): string | null {
  const ahead = state.phase === 'AWAIT_RESUME' ? state.deadline + 1 : state.deadline
  const threat = SCHEDULED_THREATS_DATA.find((item) => item.deadline > ahead)
  return threat ? `${threat.title}, ${FACTIONS_DATA[threat.factionId].name}` : null
}

/** Reads the Army tab. */
export function armyRecap(state: GameState, config: EngineConfig): ArmyRecap {
  const units = Object.values(UNITS_DATA)
    .filter((def) => def.order === 'military' && (state.units[def.id] ?? 0) > 0)
    .map((def) => ({ id: def.id, name: UNIT_COPY[def.id].name, count: state.units[def.id] ?? 0 }))
  return {
    field: calculateMilitaryPower(state, config),
    home: defensiveForce(state, config),
    units,
    threat: nextThreat(state),
    conquests: state.conquestsThisAudit,
    wars: state.victoriesCount,
  }
}

/** Reads the laws in force and the seats of the council. */
export function decreesRecap(state: GameState, config: EngineConfig): DecreesRecap {
  const seats = Math.floor(
    composeStat(
      'law_slots',
      config.balance.LAW_SLOTS_BASE,
      state.activeModifiers,
      extractRawEvaluationState(state),
    ),
  )
  const laws = state.activeLaws.flatMap((id) => {
    const law = LAWS_DATA[id]
    return law
      ? [
          {
            id,
            name: law.name,
            text: law.description.replaceAll(' | ', '. ').replace(/\.\.$/, '.'),
          },
        ]
      : []
  })
  return { laws, seats }
}

/**
 * Marks the tabs that answer an alarm of unrest: Decrees holds the festival, and Coffer a tax
 * above the rate the villages bear.
 */
export function crownMarks(
  state: GameState,
  config: EngineConfig,
): Partial<Record<CrownTab, string>> {
  if (state.unrest < UNREST_ALARM) return {}
  const marks: Partial<Record<CrownTab, string>> = { decrees: '!' }
  if (state.taxRate > config.balance.TAX_REFERENCE_RATE) marks.coffer = '!'
  return marks
}
