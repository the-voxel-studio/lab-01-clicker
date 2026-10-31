<script setup lang="ts">
import { computed } from 'vue'
import StableFigure from '@/components/game/ledger/StableFigure.vue'
import { useGameStore, type QuotaView } from '@/stores/game'
import { formatCompact } from '@/ui/realmText'
import { useMotionAllowed, useRolledNumber } from './useAmbientMotion'

/** One Crown quota: a gilt frame like the buttons, wax rising to the demand, verdigris once met. */
const props = defineProps<{ quota: QuotaView }>()
const game = useGameStore()

const LABELS: Record<QuotaView['axis'], string> = { ap: 'AP/s', pop: 'People', military: 'Force' }

const label = computed(() => LABELS[props.quota.axis])
/** Whole souls, tenths of AP or force; what is held rounds down, what is demanded rounds up. */
const amount = (value: number, round: 'down' | 'up' = 'down'): string =>
  props.quota.axis === 'pop'
    ? formatCompact(Math.floor(value), 0, round)
    : formatCompact(value, 1, round)
const motionOn = useMotionAllowed()
const current = useRolledNumber(
  () => props.quota.current,
  () => motionOn.value,
)
const figures = computed(() => `${amount(current.value)} / ${amount(props.quota.required, 'up')}`)
const room = computed(() =>
  props.quota.axis === 'pop' ? `Room ${formatCompact(game.room)}` : null,
)
const ariaLabel = computed(
  () =>
    `${label.value} quota ${props.quota.met ? 'met' : 'short'}, ` +
    `${amount(props.quota.current)} of ${amount(props.quota.required, 'up')}`,
)
const filled = computed(() => {
  const { required } = props.quota
  return required > 0 ? Math.min(1, current.value / required) : 1
})
</script>

<template>
  <div
    :data-quota="quota.axis"
    :aria-label="ariaLabel"
    role="meter"
    class="flex min-w-0 flex-col justify-end"
    :class="quota.axis === 'pop' ? 'flex-[1.65]' : 'flex-1'"
  >
    <div class="flex items-baseline justify-between gap-x-1.5 leading-[20px]">
      <span class="font-caps text-base text-ink">{{ label }}</span>
      <span
        v-if="room"
        data-room
        class="font-display text-[18px] whitespace-nowrap text-ink max-[360px]:text-base max-[360px]:tracking-tight"
        ><StableFigure :value="room"
      /></span>
    </div>
    <p
      class="stick-figures flex items-center gap-1 font-display text-[18px] leading-[22px] whitespace-nowrap max-[360px]:text-base"
      :class="quota.met ? 'text-verdigris' : 'text-ink'"
    >
      <StableFigure :value="figures" />
    </p>
    <div
      class="mt-1 h-3 rounded-[3px] border border-gold bg-vellum-shade p-px"
      aria-hidden="true"
      :data-met-mark="quota.met ? '' : undefined"
    >
      <div
        data-quota-fill
        class="h-full rounded-[1px]"
        :class="quota.met ? 'motion-flourish bg-verdigris' : 'bg-wax'"
        :style="{ width: `${filled * 100}%` }"
      />
    </div>
  </div>
</template>

<style scoped>
/* The spaces around the slash give way before the digits do. */
.stick-figures {
  word-spacing: -0.15em;
}
</style>
