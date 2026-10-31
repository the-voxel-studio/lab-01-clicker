<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useMotionAllowed, useRolledNumber } from '@/components/game/run/useAmbientMotion'
import { formatCompact, signedPoints } from '@/ui/realmText'

/** The three figures of the register, rolling up from nothing (Figma `53:360`). */
const props = defineProps<{ audits: number; apSealed: number; points: number }>()
const motionOn = useMotionAllowed()

const started = ref(false)
onMounted(() => (started.value = true))
const rolled = (value: () => number) =>
  useRolledNumber(
    () => (started.value ? value() : 0),
    () => motionOn.value,
  )
const audits = rolled(() => props.audits)
const apSealed = rolled(() => props.apSealed)
</script>

<template>
  <dl class="grid grid-cols-3 divide-x divide-ink-faded/40">
    <div data-figure class="pr-2">
      <dd class="font-display text-[28px] leading-[30px] text-ink">{{ Math.round(audits) }}</dd>
      <dt class="font-body text-[13px] italic leading-[18px] text-ink-faded">audits passed</dt>
    </div>
    <div data-figure class="px-3">
      <dd class="font-display text-[28px] leading-[30px] text-ink">
        {{ formatCompact(apSealed) }}
      </dd>
      <dt class="font-body text-[13px] italic leading-[18px] text-ink-faded">AP sealed</dt>
    </div>
    <div data-figure class="pl-3">
      <dd class="font-display text-[28px] leading-[30px] text-gold">{{ signedPoints(points) }}</dd>
      <dt class="font-body text-[13px] italic leading-[18px] text-ink-faded">archive points</dt>
    </div>
  </dl>
</template>
