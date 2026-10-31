<script setup lang="ts">
import knight from '@assets/engravings/THE_KNIGHT.webp'
import type { FateView } from '@/ui/fate'
import FatePlate from './FatePlate.vue'
import FateText from './FateText.vue'
import FateWheel from './FateWheel.vue'

/** The wheel turns and stops on `sum sine regno` (Figma `53:110`). */
defineProps<{ view: FateView; reign: number }>()
</script>

<template>
  <div
    data-scene="conquest"
    class="flex h-full flex-col gap-3 bg-gradient-to-b from-[#1a0f0a] via-[#5c140d] via-60% to-[#1f140f] pt-6 pb-2"
  >
    <div class="min-h-0 flex-[3]"><FateWheel rest="sum sine regno" /></div>
    <div class="plate-slot min-h-0 flex-[2] px-12"><FatePlate :src="knight" dark /></div>
    <FateText class="shrink-0" :view="view" :reign="reign" dark lead="Sum sine regno." />
  </div>
</template>

<style scoped>
/* A landscape phone gives the wheel the room of the hidden plate. */
@media (max-height: 520px) {
  .plate-slot {
    display: none;
  }
}
</style>
