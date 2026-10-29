<script setup lang="ts">
import EndScreen from '@/components/game/EndScreen.vue'
import HallScreen from '@/components/game/HallScreen.vue'
import RunScreen from '@/components/game/RunScreen.vue'
import { useGameLoop } from '@/components/game/useGameLoop'
import { useNavStore } from '@/stores/nav'

const nav = useNavStore()
useGameLoop()
</script>

<template>
  <div class="flex min-h-screen justify-center bg-bar">
    <main class="flex min-h-screen w-full max-w-[430px] flex-col bg-vellum font-body text-ink">
      <HallScreen v-if="nav.screen === 'hall'" />
      <EndScreen v-else-if="nav.screen === 'end'" />
      <RunScreen v-else />
    </main>
  </div>
</template>
