<script setup lang="ts">
import { computed } from 'vue'
import type { QuotaView } from '@/stores/game'
import { useMotionAllowed, useRolledNumber } from './useAmbientMotion'

/** One Crown quota drawn as a notched tally stick with the target as a vermilion thread. */
const props = defineProps<{ quota: QuotaView }>()

const LABELS: Record<QuotaView['axis'], string> = { ap: 'AP', pop: 'People', military: 'Army' }
const NOTCHES = 12
/** The stick reaches a quarter past the target, so the thread sits inside it. */
const SCALE = 1.25

const label = computed(() => LABELS[props.quota.axis])
const amount = (value: number): string =>
  props.quota.axis === 'pop'
    ? Math.floor(value).toLocaleString('en')
    : (Math.round(value * 10) / 10).toLocaleString('en', { maximumFractionDigits: 1 })
const motionOn = useMotionAllowed()
const current = useRolledNumber(
  () => props.quota.current,
  () => motionOn.value,
)
const figures = computed(
  () =>
    `${amount(current.value)} / ${amount(props.quota.required)}` +
    (props.quota.axis === 'ap' ? ' AP/s' : ''),
)
const ariaLabel = computed(
  () =>
    `${label.value} quota ${props.quota.met ? 'met' : 'short'}, ` +
    `${amount(props.quota.current)} of ${amount(props.quota.required)}`,
)
const filled = computed(() => {
  const top = props.quota.required * SCALE
  return top > 0 ? Math.min(1, props.quota.current / top) : 1
})
const notches = computed(() => Math.round(filled.value * NOTCHES))
const threadAt = `${(100 / SCALE).toFixed(1)}%`
</script>

<template>
  <div :data-quota="quota.axis" :aria-label="ariaLabel" role="meter" class="min-w-0 flex-1">
    <div class="flex items-baseline justify-between gap-1">
      <span class="font-caps text-sm text-ink">{{ label }}</span>
      <span class="font-body text-xs" :class="quota.met ? 'text-verdigris' : 'text-ink-faded'">
        <span v-if="quota.met" data-met-mark aria-hidden="true">✓ </span>{{ figures }}
      </span>
    </div>
    <div class="relative mt-1 h-[9px] rounded-[1px] bg-wood" aria-hidden="true">
      <span
        v-for="n in notches"
        :key="n"
        class="motion-pop absolute top-px h-[7px] w-[2px] bg-wood-dark"
        :style="{ left: `${(n / (NOTCHES + 1)) * 100}%` }"
      />
      <span
        class="absolute -top-[3px] h-[15px] w-[3px] transition-colors duration-300"
        :class="quota.met ? 'motion-flourish bg-verdigris' : 'bg-vermilion'"
        :style="{ left: threadAt }"
      />
    </div>
  </div>
</template>
