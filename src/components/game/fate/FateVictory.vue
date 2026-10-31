<script setup lang="ts">
import type { FateView } from '@/ui/fate'
import FateText from './FateText.vue'
import FateWheel from './FateWheel.vue'

/** Dawn vellum, the gold wheel at rest on `regnavi`, blossoms falling: the grace of the realm. */
defineProps<{ view: FateView; reign: number }>()

const BLOSSOMS = [6, 17, 28, 41, 53, 64, 76, 88, 95]
</script>

<template>
  <div
    data-scene="victory"
    class="relative flex h-full flex-col gap-3 overflow-hidden bg-gradient-to-b from-rose-dawn to-vellum pt-6 pb-2"
  >
    <span
      v-for="(left, index) in BLOSSOMS"
      :key="left"
      class="fate-blossom pointer-events-none absolute -top-2 size-2 rounded-full bg-rose-bloom"
      :style="{ left: `${left}%`, animationDelay: `${index * 700}ms` }"
    />
    <div class="wheel min-h-0 flex-1"><FateWheel rest="regnavi" /></div>
    <FateText class="shrink-0" :view="view" :reign="reign">
      <p class="font-display text-[22px] italic leading-7 text-ink">I have reigned.</p>
    </FateText>
  </div>
</template>

<style scoped>
.wheel {
  --wheel-word: var(--color-ink);
}
</style>
