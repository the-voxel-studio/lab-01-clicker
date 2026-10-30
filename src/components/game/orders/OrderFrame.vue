<script setup lang="ts">
import { computed } from 'vue'
import ActionBar from '@/components/game/run/ActionBar.vue'
import GameMenu from '@/components/game/run/GameMenu.vue'
import RunHud from '@/components/game/run/RunHud.vue'
import { useMotionAllowed } from '@/components/game/run/useAmbientMotion'
import { useGameStore } from '@/stores/game'
import { useNavStore } from '@/stores/nav'
import { BAND_TEMPO } from '@/ui/motion'

/**
 * The frame of the five order pages: fixed HUD, title and bar, with the body scrolling inside.
 * `closed` shuts the order bar while a moment must be answered here.
 */
defineProps<{ title: string; intro: string; closed?: boolean }>()

const game = useGameStore()
const nav = useNavStore()
const motionOn = useMotionAllowed()

const frozen = computed(() => {
  void game.revision
  return (game.run?.isPaused ?? false) || nav.menuOpen
})
const tempo = computed(() => {
  const { sway, flicker, jitter } = BAND_TEMPO[game.dread.band]
  return { '--tempo-sway': sway, '--tempo-flicker': flicker, '--tempo-jitter': jitter }
})
</script>

<template>
  <section
    :data-dread="game.dread.band"
    :data-paused="String(frozen)"
    :data-motion="motionOn ? 'on' : 'off'"
    :style="tempo"
    class="relative flex h-full min-h-0 flex-1 flex-col overflow-hidden"
  >
    <div :inert="nav.menuOpen" class="flex min-h-0 flex-1 flex-col">
      <RunHud compact class="shrink-0" />
      <div class="shrink-0 px-4 pt-2">
        <slot name="aside" />
        <h1 class="font-display text-[26px] leading-[30px] text-ink">{{ title }}</h1>
        <p class="order-intro font-body text-base italic leading-[22px] text-ink-faded">
          {{ intro }}
        </p>
        <slot name="header" />
      </div>
      <div data-order-body class="min-h-0 flex-1 overflow-y-auto px-4 pb-3 pt-2">
        <slot />
      </div>
      <div data-order-bar :inert="closed" class="z-20 shrink-0" :class="closed ? 'opacity-60' : ''">
        <ActionBar />
      </div>
    </div>
    <GameMenu />
  </section>
</template>

<style scoped>
/* Lists keep the room on short screens: the intro repeats what the player already knows. */
@media (max-height: 700px) {
  .order-intro {
    display: none;
  }
}
</style>
