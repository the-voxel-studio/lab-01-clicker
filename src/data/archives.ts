/**
 * National Archives Meta-Progression Catalog (GAME_RULES §15).
 *
 * @module data/archives
 */

import type { GameState } from '@/core/types'

/** Identifier of a National Archives perk. */
export type ArchivePerkId =
  | 'starting_treasury'
  | 'ancient_cadastre'
  | 'charter_of_liberties'
  | 'standing_vanguard'
  | 'primogeniture_decrees'
  | 'spymaster_network'
  | 'royal_chronicle'
  | 'sixth_law_slot'

/** Static definition of one National Archives perk. */
export interface ArchivePerkDef {
  id: ArchivePerkId
  name: string
  cost: number
  description: string
  effectDescription: string
}

/** Catalog of the eight National Archives perks and their costs (GAME_RULES §15). */
export const ARCHIVES_DATA: Record<ArchivePerkId, ArchivePerkDef> = {
  starting_treasury: {
    id: 'starting_treasury',
    name: 'Starting Treasury',
    cost: 1,
    description: 'A modest war chest preserved from dynastic ancestors.',
    effectDescription: 'Start every run with +150 AP.',
  },
  ancient_cadastre: {
    id: 'ancient_cadastre',
    name: 'Ancient Cadastre',
    cost: 2,
    description: 'Ancient imperial parchment detailing surveyed fiefs.',
    effectDescription: 'Base paperwork friction reduced by -5%.',
  },
  charter_of_liberties: {
    id: 'charter_of_liberties',
    name: 'Charter of Liberties',
    cost: 2,
    description: 'A sovereign pledge guaranteeing municipal privileges.',
    effectDescription: 'Starting Unrest reduced by -8 points.',
  },
  standing_vanguard: {
    id: 'standing_vanguard',
    name: 'Standing Vanguard',
    cost: 3,
    description: 'A hardened cadre of permanent professional retainers.',
    effectDescription: 'Start every run with 25 Foot Soldiers.',
  },
  primogeniture_decrees: {
    id: 'primogeniture_decrees',
    name: 'Primogeniture Decrees',
    cost: 4,
    description: 'Codified succession laws preventing partition of estates.',
    effectDescription: '+8% to all civil and administration caps.',
  },
  spymaster_network: {
    id: 'spymaster_network',
    name: 'Spymaster Network',
    cost: 5,
    description: 'An entrenched web of informants across frontier borders.',
    effectDescription: 'Scout uncertainty margin narrowed by 12 points base.',
  },
  royal_chronicle: {
    id: 'royal_chronicle',
    name: 'Royal Chronicle',
    cost: 6,
    description: 'Prophetic annals documenting impending imperial quotas.',
    effectDescription: 'Displays quota thresholds for the next 2 upcoming deadlines.',
  },
  sixth_law_slot: {
    id: 'sixth_law_slot',
    name: 'Sixth Law Slot',
    cost: 10,
    description: 'Expanded Great Council chambers permitting another minister decree.',
    effectDescription: 'Unlocks a permanent 6th active law slot.',
  },
}

/** Tells whether a value is a known archive perk id. */
export function isArchivePerkId(value: unknown): value is ArchivePerkId {
  return typeof value === 'string' && Object.hasOwn(ARCHIVES_DATA, value)
}

/**
 * Applies permanent bonuses from active National Archive perks to an initial GameState.
 *
 * @param state - The newly instantiated GameState to mutate.
 * @param activePerkIds - Array of unlocked perk identifiers.
 */
export function applyArchivePerks(state: GameState, activePerkIds: ArchivePerkId[]): void {
  for (const perkId of activePerkIds) {
    switch (perkId) {
      case 'starting_treasury':
        state.ap += 150
        break

      case 'charter_of_liberties':
        state.unrest = Math.max(0, state.unrest - 8)
        break

      case 'standing_vanguard':
        state.units.soldier = (state.units.soldier ?? 0) + 25
        state.totalPopulation += 25
        state.peakPopulation = Math.max(state.peakPopulation, state.totalPopulation)
        break

      case 'ancient_cadastre':
        state.activeModifiers.push({
          source: 'archive:ancient_cadastre',
          stat: 'paperwork_friction',
          op: 'add',
          value: -0.05,
        })
        break

      case 'primogeniture_decrees':
        state.activeModifiers.push({
          source: 'archive:primogeniture_decrees',
          stat: 'housing_capacity',
          op: 'addPct',
          value: 0.08,
        })
        break

      case 'spymaster_network':
        state.activeModifiers.push({
          source: 'archive:spymaster_network',
          stat: 'scout_uncertainty_margin',
          op: 'add',
          value: -0.12,
        })
        break

      case 'royal_chronicle':
        state.activeModifiers.push({
          source: 'archive:royal_chronicle',
          stat: 'quota_foresight_deadlines',
          op: 'add',
          value: 2,
        })
        break

      case 'sixth_law_slot':
        state.activeModifiers.push({
          source: 'archive:sixth_law_slot',
          stat: 'gross_ap_rate',
          op: 'add',
          value: 0,
        })
        break
    }
  }
}
