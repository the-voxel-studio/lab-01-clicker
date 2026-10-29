<script setup lang="ts">
import ChroniclePage from '@/components/game/ChroniclePage.vue'
import EndScreen from '@/components/game/EndScreen.vue'
import HallScreen from '@/components/game/HallScreen.vue'
import OrderPlaceholder from '@/components/game/OrderPlaceholder.vue'
import RunScreen from '@/components/game/RunScreen.vue'
import { useGameLoop } from '@/components/game/useGameLoop'
import { useNavStore, type Screen } from '@/stores/nav'

const nav = useNavStore()
useGameLoop()

/** Order pages drawn by plan 03; a placeholder until then. */
const ORDER_SCREENS: readonly Screen[] = [
  'order_people',
  'order_admin',
  'order_military',
  'fortune',
  'crown',
]
</script>

<template>
  <div class="flex min-h-screen justify-center bg-bar">
    <main
      class="relative flex min-h-screen w-full max-w-[430px] flex-col bg-vellum font-body text-ink"
    >
      <HallScreen v-if="nav.screen === 'hall'" />
      <EndScreen v-else-if="nav.screen === 'end'" />
      <ChroniclePage v-else-if="nav.screen === 'chronicle'" />
      <OrderPlaceholder v-else-if="ORDER_SCREENS.includes(nav.screen)" />
      <RunScreen v-else />
    </main>
  </div>
</template>
