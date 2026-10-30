<script setup lang="ts">
import { computed } from 'vue'
import GameIcon from '@/components/common/GameIcon.vue'
import type { GameIconKey } from '@/data/icons'
import { useGameStore } from '@/stores/game'
import { useNavStore, type Screen } from '@/stores/nav'

/** The bar kept at the bottom of every screen of a reign: the main screen and the five orders. */
const game = useGameStore()
const nav = useNavStore()

const ORDERS: { screen: Screen; label: string; icon: GameIconKey }[] = [
  { screen: 'run', label: 'Reign', icon: 'waxSeal' },
  { screen: 'order_people', label: 'Commons', icon: 'roleFarmer' },
  { screen: 'order_admin', label: 'Chancery', icon: 'quill' },
  { screen: 'order_military', label: 'Host', icon: 'militaryPower' },
  { screen: 'fortune', label: 'Fortune', icon: 'fortuneWheel' },
  { screen: 'crown', label: 'Crown', icon: 'crown' },
]
const UNREST_ALARM = 75

const badges = computed<Partial<Record<Screen, string>>>(() => {
  const military = game.quotas.find((quota) => quota.axis === 'military')
  void game.revision
  const unrest = game.run?.unrest ?? 0
  const result: Partial<Record<Screen, string>> = {}
  if (military && !military.met) {
    result.order_military = String(Math.ceil(military.required - military.current))
  }
  if (unrest >= UNREST_ALARM) result.crown = '!'
  return result
})
</script>

<template>
  <nav class="grid grid-cols-6 gap-0.5 border-t-[3px] border-gold bg-bar px-1 pb-2 pt-2.5">
    <button
      v-for="order in ORDERS"
      :key="order.screen"
      type="button"
      :data-order="order.screen"
      class="relative flex h-[74px] flex-col items-center justify-center gap-1 rounded"
      :class="nav.screen === order.screen ? 'bg-wax' : ''"
      @click="nav.go(order.screen)"
    >
      <GameIcon :name="order.icon" class="size-[28px] text-gold" :label="order.label" />
      <span class="font-caps text-xs text-cream max-[360px]:text-[10px]">{{ order.label }}</span>
      <span
        v-if="badges[order.screen]"
        :key="badges[order.screen]"
        data-badge
        class="motion-pop absolute right-0.5 top-1 min-w-5 rounded-full border border-cream bg-wax px-1 text-center font-body text-xs text-cream"
      >
        {{ badges[order.screen] }}
      </span>
    </button>
  </nav>
</template>
