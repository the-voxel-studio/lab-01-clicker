/**
 * Single province list: `state.provinces` always equals `state.provinceBiomes.length`.
 * Every addition or removal of a province goes through these helpers.
 *
 * @module core/provinces
 */

import type { GameState, BiomeId } from './types'
import { DEFAULT_ENGINE_CONFIG, type EngineConfig } from './config'
import { BIOMES_DATA } from '@/data/balance'

/**
 * Adds one province of the given biome and keeps the province counter and its run peak in sync.
 *
 * @param state - GameState to mutate.
 * @param biome - Biome of the new province.
 */
export function addProvince(state: GameState, biome: BiomeId): void {
  state.provinceBiomes.push(biome)
  state.provinces = state.provinceBiomes.length
  state.peakProvinces = Math.max(state.peakProvinces, state.provinces)
}

/**
 * Removes the most recently added province and keeps the province counter in sync.
 *
 * @param state - GameState to mutate.
 * @returns The biome of the removed province, or null when no province is held.
 */
export function removeLastProvince(state: GameState): BiomeId | null {
  const biome = state.provinceBiomes.pop() ?? null
  state.provinces = state.provinceBiomes.length
  return biome
}

/**
 * Sums the base housing of every province: `BASE_HOUSING_PER_PROVINCE * housingMultiplier` per biome.
 *
 * @param state - Current GameState.
 * @param config - Injected engine configuration.
 * @returns Base housing capacity before role bonuses and modifiers.
 */
export function getHousingBase(
  state: GameState,
  config: EngineConfig = DEFAULT_ENGINE_CONFIG,
): number {
  let total = 0
  for (const biome of state.provinceBiomes) {
    total += config.balance.BASE_HOUSING_PER_PROVINCE * BIOMES_DATA[biome].housingMultiplier
  }
  return total
}
