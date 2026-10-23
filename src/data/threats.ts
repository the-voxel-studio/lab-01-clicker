/**
 * Scheduled Threats & Enemy Factions Catalog (Task 2.4, GAME_RULES §7.5, §8.1).
 *
 * @module data/threats
 */

import type { FactionId, GameState } from '@/core/types'

export type { FactionId }

/** Engine figures a faction trait reads, so the pure catalog needs no engine import. */
export interface FactionTraitContext {
  /** Military power of the player. */
  militaryPower: number
  /** Military quota the threat deadline asks for, after `quota_requirement`. */
  militaryQuota: number
}

/** Values a faction trait hands back; the engine applies them to the state. */
export interface FactionTraitResult {
  adjustedThreatPower: number
  adjustedTributeCost: number
  /** Extra share of the civilian casualties of a defensive collapse, 0.15 meaning +15%. */
  extraCivilianCasualtyRate: number
  /** Provinces lost on a defensive collapse on top of the first one. */
  extraProvincesLost: number
  /** Unrest added when the threat is faced. */
  unrestDelta: number
  /** Soldiers who desert when the threat is faced. */
  soldierDesertions: number
}

export interface FactionDef {
  id: FactionId
  name: string
  description: string
  reactiveTraitDescription: string
  /**
   * Returns the reactive faction modifiers for the current state, without mutating it.
   */
  applyReactiveTrait: (
    state: Readonly<GameState>,
    threatPower: number,
    tributeCost: number,
    context: FactionTraitContext,
  ) => FactionTraitResult
}

/**
 * Trait result that changes nothing, spread under the fields a faction overrides.
 *
 * @param threatPower - Threat power passed through.
 * @param tributeCost - Tribute cost passed through.
 * @returns A result with no extra effect.
 */
export function neutralTrait(threatPower: number, tributeCost: number): FactionTraitResult {
  return {
    adjustedThreatPower: threatPower,
    adjustedTributeCost: tributeCost,
    extraCivilianCasualtyRate: 0,
    extraProvincesLost: 0,
    unrestDelta: 0,
    soldierDesertions: 0,
  }
}

export interface ScheduledThreatDef {
  deadline: number
  title: string
  factionId: FactionId
}

/**
 * The 6 Feudal Enemy Factions with their subtle state-reactive traits (§7.5).
 */
export const FACTIONS_DATA: Record<FactionId, FactionDef> = {
  outlaws: {
    id: 'outlaws',
    name: 'Outlaw Bandits & Marauders',
    description:
      'Bandits and deserters preying on poorly defended villages. Loot yields rescued captive serfs.',
    reactiveTraitDescription:
      'If player possesses < 10 soldiers, bandits inflict +15% civilian casualties upon collapse.',
    applyReactiveTrait: (state, threatPower, tributeCost) => ({
      ...neutralTrait(threatPower, tributeCost),
      extraCivilianCasualtyRate: (state.units.soldier ?? 0) < 10 ? 0.15 : 0,
    }),
  },
  barons: {
    id: 'barons',
    name: 'Rebel Barons & Armored Knights',
    description:
      'Disciplined armored retinues fighting for feudal privileges. Surrenders yield armored soldiers.',
    reactiveTraitDescription:
      'If player maintains a huge army (>= 1.2x Quota), enemies deploy Armored Veterans (+10% power).',
    applyReactiveTrait: (_state, threatPower, tributeCost, context) => ({
      ...neutralTrait(threatPower, tributeCost),
      adjustedThreatPower:
        context.militaryPower >= 1.2 * context.militaryQuota
          ? Math.round(threatPower * 1.1)
          : threatPower,
    }),
  },
  mercenaries: {
    id: 'mercenaries',
    name: 'Free Company Mercenaries',
    description: 'Gold-hungry sellswords. Victory yields heavy AP chests.',
    reactiveTraitDescription: 'Tribute demand increases by +25%.',
    applyReactiveTrait: (_state, threatPower, tributeCost) => ({
      ...neutralTrait(threatPower, tributeCost),
      adjustedTributeCost: Math.round(tributeCost * 1.25),
    }),
  },
  zealots: {
    id: 'zealots',
    name: 'Holy League Zealots',
    description: 'Religious fanatics exploiting peasant discontent. Victory yields converts.',
    reactiveTraitDescription:
      'If player Unrest is > 60%, zealots trigger Religious Defection (+15 Unrest and one soldier desertion per 10 soldiers).',
    applyReactiveTrait: (state, threatPower, tributeCost) => {
      if (state.unrest <= 60) return neutralTrait(threatPower, tributeCost)
      return {
        ...neutralTrait(threatPower, tributeCost),
        unrestDelta: 15,
        soldierDesertions: Math.floor((state.units.soldier ?? 0) / 10),
      }
    },
  },
  steppe_horsemen: {
    id: 'steppe_horsemen',
    name: 'Steppe Horsemen',
    description: 'Lightning cavalry raids across the open plains.',
    reactiveTraitDescription: 'Scout uncertainty margin is doubled (up to 90%).',
    applyReactiveTrait: (_state, threatPower, tributeCost) =>
      neutralTrait(threatPower, tributeCost),
  },
  imperial_legions: {
    id: 'imperial_legions',
    name: 'Imperial Crown Legions',
    description: 'Ironclad imperial siege host sent to punish insubordination.',
    reactiveTraitDescription: 'Threaten 2 provinces if defensive collapse occurs.',
    applyReactiveTrait: (_state, threatPower, tributeCost) => ({
      ...neutralTrait(threatPower, tributeCost),
      extraProvincesLost: 1,
    }),
  },
}

/**
 * The 8 Scheduled Threats announced after Deadlines 2 to 9 for Deadlines 3 to 10 (§8.1).
 */
export const SCHEDULED_THREATS_DATA: ScheduledThreatDef[] = [
  { deadline: 3, title: 'Border Raiders & Deserters', factionId: 'outlaws' },
  { deadline: 4, title: 'The Rebellious Marches Baron', factionId: 'barons' },
  { deadline: 5, title: 'Nomadic Steppe Horde', factionId: 'steppe_horsemen' },
  { deadline: 6, title: 'The Renegade Free Companies', factionId: 'mercenaries' },
  { deadline: 7, title: 'The Holy League Crusade', factionId: 'zealots' },
  { deadline: 8, title: "The Pretender Duke's Vanguard", factionId: 'barons' },
  { deadline: 9, title: 'The Grand Inquisitorial Armada', factionId: 'zealots' },
  { deadline: 10, title: "The Royal Auditor's Iron Host", factionId: 'imperial_legions' },
]
