<script setup lang="ts">
import { watch } from 'vue'
import ChroniclePage from '@/components/game/ChroniclePage.vue'
import EndScreen from '@/components/game/EndScreen.vue'
import MomentHost from '@/components/game/moments/MomentHost.vue'
import FateScreen from '@/components/game/fate/FateScreen.vue'
import HallScreen from '@/components/game/HallScreen.vue'
import CrownPage from '@/components/game/orders/CrownPage.vue'
import FortunePage from '@/components/game/orders/FortunePage.vue'
import OrderPage from '@/components/game/orders/OrderPage.vue'
import RunScreen from '@/components/game/RunScreen.vue'
import { useGameLoop } from '@/components/game/useGameLoop'
import { useGameStore } from '@/stores/game'
import { useNavStore } from '@/stores/nav'
import { routeForPhase } from '@/ui/fortune'

const nav = useNavStore()
const game = useGameStore()
useGameLoop()

// Events are answered on their own screen: without this the reign would wait behind an order page.
watch([() => game.phase, () => nav.screen], ([phase, screen]) => {
  const next = routeForPhase(phase, screen)
  if (next) nav.go(next)
})
</script>

<template>
  <div data-frame class="flex h-dvh justify-center overflow-hidden bg-bar">
    <main
      class="relative flex h-full w-full max-w-[430px] flex-col overflow-hidden bg-vellum font-body text-ink"
    >
      <HallScreen v-if="nav.screen === 'hall'" />
      <FateScreen v-else-if="nav.screen === 'fate'" />
      <EndScreen v-else-if="nav.screen === 'end'" />
      <ChroniclePage v-else-if="nav.screen === 'chronicle'" />
      <OrderPage v-else-if="nav.screen === 'order_people'" order="people" />
      <OrderPage v-else-if="nav.screen === 'order_admin'" order="admin" />
      <OrderPage v-else-if="nav.screen === 'order_military'" order="military" />
      <FortunePage v-else-if="nav.screen === 'fortune'" />
      <CrownPage v-else-if="nav.screen === 'crown'" />
      <RunScreen v-else />
      <MomentHost />
    </main>
  </div>
</template>
