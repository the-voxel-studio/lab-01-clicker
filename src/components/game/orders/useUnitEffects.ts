/**
 * The effects of an order page, refreshed at most 4 times a second: each one steps a copy of the
 * realm, so the rows cannot afford them on every frame, and quick buying must not flicker.
 *
 * @module components/game/orders/useUnitEffects
 */

import { onMounted, onUnmounted, ref, type Ref } from 'vue'
import type { GameState, UnitId, UnitOrder } from '@/core/types'
import { UNITS_DATA } from '@/data/balance'
import { useGameStore } from '@/stores/game'
import { effectLines, realmRates, unitEffect, type RealmRates } from '@/ui/effects'

const REFRESH_MS = 250

/** The lines of the units of an order at their chosen bulk, and the rates of the realm. */
export function useUnitEffects(
  order: () => UnitOrder,
  bulkOf: (unitId: UnitId) => number,
): {
  lines: Ref<Partial<Record<UnitId, string>>>
  rates: Ref<RealmRates | null>
  refresh: () => void
} {
  const game = useGameStore()
  const lines = ref<Partial<Record<UnitId, string>>>({})
  const rates = ref<RealmRates | null>(null)

  function read(state: GameState): void {
    rates.value = realmRates(state)
    const next: Partial<Record<UnitId, string>> = {}
    for (const def of Object.values(UNITS_DATA)) {
      if (def.order !== order()) continue
      if (def.tier === 1 || state.unlockedPatents[def.order]) {
        next[def.id] = effectLines(unitEffect(state, def.id, bulkOf(def.id))).join(', ')
      }
    }
    lines.value = next
  }

  function refresh(): void {
    if (game.run) read(game.run)
  }

  let timer: ReturnType<typeof setInterval> | null = null
  onMounted(() => {
    refresh()
    timer = setInterval(refresh, REFRESH_MS)
  })
  onUnmounted(() => {
    if (timer !== null) clearInterval(timer)
  })
  return { lines, rates, refresh }
}
