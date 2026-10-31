<script setup lang="ts">
import { computed } from 'vue'
import type { ClashView } from '@/ui/moments'
import { formatCompact } from '@/ui/realmText'

/** Your defensive force against theirs on one scale, rolls aside (Figma `53:330`). */
const props = defineProps<{ clash: ClashView }>()

/** Room past the larger force, so neither mark sits on the end of the bar. */
const SCALE_MARGIN = 1.25

const scale = computed(() => Math.max(props.clash.yours, props.clash.theirs, 1) * SCALE_MARGIN)
const percent = (value: number) => `${(value / scale.value) * 100}%`
const yours = computed(() => percent(props.clash.yours))
const theirs = computed(() => percent(props.clash.theirs))
</script>

<template>
  <div data-clash class="mt-3">
    <p class="font-body text-[15px] leading-6 text-ink">Your force against theirs</p>
    <div class="relative mt-0.5 h-3 rounded-md border border-ink-faded/50 bg-vellum-shade">
      <div class="absolute inset-y-0 left-0 rounded-md bg-rubric/55" :style="{ width: theirs }" />
      <div class="absolute -top-1.5 h-6 w-[3px] bg-verdigris" :style="{ left: yours }" />
    </div>
    <p class="mt-1.5 flex justify-between font-body text-[13px] italic leading-[18px]">
      <span class="text-verdigris">you, {{ formatCompact(clash.yours) }}</span>
      <span class="text-rubric">them, {{ formatCompact(clash.theirs, 0, 'up') }}</span>
    </p>
  </div>
</template>
