/**
 * Scheduled Threats & Enemy Factions Catalog (Task 2.4, GAME_RULES §7.5, §8.1).
 *
 * @module data/threats
 */

import type { GameState } from '@/core/types'

export type FactionId =
  | 'outlaws'
  | 'barons'
  | 'mercenaries'
  | 'zealots'
  | 'steppe_horsemen'
  | 'imperial_legions'

export interface FactionDef {
  id: FactionId
  name: string
  description: string
  reactiveTraitDescription: string
  /**
   * Applies the reactive faction modifier or penalty to state / threat.
   */
  applyReactiveTrait: (
    state: GameState,
    threatPower: number,
    tributeCost: number
  ) => { adjustedThreatPower: number; adjustedTributeCost: number; extraCivilianCasualtyRate: number }
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
    description: 'Bandits and deserters preying on poorly defended villages. Loot yields rescued captive serfs.',
    reactiveTraitDescription: 'If player possesses < 10 soldiers, bandits inflict +15% civilian casualties upon collapse.',
    applyReactiveTrait: (state, threatPower, tributeCost) => {
      const soldiers = state.units.soldier ?? 0
      return {
        adjustedThreatPower: threatPower,
        adjustedTributeCost: tributeCost,
        extraCivilianCasualtyRate: soldiers < 10 ? 0.15 : 0,
      }
    },
  },
  barons: {
    id: 'barons',
    name: 'Rebel Barons & Armored Knights',
    description: 'Disciplined armored retinues fighting for feudal privileges. Surrenders yield armored soldiers.',
    reactiveTraitDescription: 'If player maintains a huge army (>= 1.2x Quota), enemies deploy Armored Veterans (+10% power).',
    applyReactiveTrait: (state, threatPower, tributeCost) => {
      // In combat, threat power increases by 10% if player military exceeds 1.2x quota
      return {
        adjustedThreatPower: Math.round(threatPower * 1.10),
        adjustedTributeCost: tributeCost,
        extraCivilianCasualtyRate: 0,
      }
    },
  },
  mercenaries: {
    id: 'mercenaries',
    name: 'Free Company Mercenaries',
    description: 'Gold-hungry sellswords. Victory yields heavy AP chests.',
    reactiveTraitDescription: 'Tribute demand increases by +25%.',
    applyReactiveTrait: (_state, threatPower, tributeCost) => ({
      adjustedThreatPower: threatPower,
      adjustedTributeCost: Math.round(tributeCost * 1.25),
      extraCivilianCasualtyRate: 0,
    }),
  },
  zealots: {
    id: 'zealots',
    name: 'Holy League Zealots',
    description: 'Religious fanatics exploiting peasant discontent. Victory yields converts.',
    reactiveTraitDescription: 'If player Unrest is > 60%, zealots trigger Religious Defection (+15 Unrest and soldier desertions).',
    applyReactiveTrait: (state, threatPower, tributeCost) => {
      if (state.unrest > 60) {
        state.unrest = Math.min(100, state.unrest + 15)
        if ((state.units.soldier ?? 0) > 0) {
          state.units.soldier = Math.max(0, (state.units.soldier ?? 0) - 2)
          state.totalPopulation = Math.max(0, state.totalPopulation - 2)
        }
      }
      return {
        adjustedThreatPower: threatPower,
        adjustedTributeCost: tributeCost,
        extraCivilianCasualtyRate: 0,
      }
    },
  },
  steppe_horsemen: {
    id: 'steppe_horsemen',
    name: 'Steppe Horsemen',
    description: 'Lightning cavalry raids across the open plains.',
    reactiveTraitDescription: 'Scout uncertainty margin is doubled (up to 60%).',
    applyReactiveTrait: (_state, threatPower, tributeCost) => ({
      adjustedThreatPower: threatPower,
      adjustedTributeCost: tributeCost,
      extraCivilianCasualtyRate: 0,
    }),
  },
  imperial_legions: {
    id: 'imperial_legions',
    name: 'Imperial Crown Legions',
    description: 'Ironclad imperial siege host sent to punish insubordination.',
    reactiveTraitDescription: 'Threaten 2 provinces if defensive collapse occurs.',
    applyReactiveTrait: (_state, threatPower, tributeCost) => ({
      adjustedThreatPower: threatPower,
      adjustedTributeCost: tributeCost,
      extraCivilianCasualtyRate: 0,
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
