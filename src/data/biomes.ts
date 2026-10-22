/**
 * Province Biomes Catalog & Data Definitions (Task 2.2, GAME_RULES §7.2).
 *
 * @module data/biomes
 */

import type { BiomeId, BiomeDef } from '@/core/types'

/**
 * 5 Province Biomes data catalog:
 * - heartland: Sovereign's Core Demesne (neutral baseline, capacity 250, no modifiers)
 * - farmlands: Arable Plains (+50% housing capacity = 375, +0.001 delta r)
 * - trade_hub: Inland Port & Market Towns (+15% tax efficiency)
 * - stronghold: Border Fortress (+12 passive defense in defensive clashes)
 * - wilderness: Primeval Forest & Swamps (-20% housing capacity = 200, -5% paperwork friction)
 */
export const BIOMES_DATA: Record<BiomeId, BiomeDef> = {
  heartland: {
    id: 'heartland',
    name: 'Heartland',
    housingMultiplier: 1.0,
    deltaR: 0,
    taxEfficiencyBonus: 0,
    passiveDefense: 0,
    paperworkReduction: 0,
  },
  farmlands: {
    id: 'farmlands',
    name: 'Arable Plains',
    housingMultiplier: 1.5,
    deltaR: 0.001,
    taxEfficiencyBonus: 0,
    passiveDefense: 0,
    paperworkReduction: 0,
  },
  trade_hub: {
    id: 'trade_hub',
    name: 'Trade Hub',
    housingMultiplier: 1.0,
    deltaR: 0,
    taxEfficiencyBonus: 0.15,
    passiveDefense: 0,
    paperworkReduction: 0,
  },
  stronghold: {
    id: 'stronghold',
    name: 'Border Stronghold',
    housingMultiplier: 1.0,
    deltaR: 0,
    taxEfficiencyBonus: 0,
    passiveDefense: 12,
    paperworkReduction: 0,
  },
  wilderness: {
    id: 'wilderness',
    name: 'Marshes & Forests',
    housingMultiplier: 0.8,
    deltaR: 0,
    taxEfficiencyBonus: 0,
    passiveDefense: 0,
    paperworkReduction: 0.05,
  },
}
