<script setup lang="ts">
import { computed } from 'vue'
import GameIcon from '@/components/common/GameIcon.vue'
import { useGameStore } from '@/stores/game'
import { useNavStore } from '@/stores/nav'
import { formatCompact, formatRate, unrestPhrase } from '@/ui/realmText'
import { useMotionAllowed, useRolledNumber } from './useAmbientMotion'
import CandleClock from './CandleClock.vue'
import StableFigure from '../ledger/StableFigure.vue'
import TallyStick from './TallyStick.vue'
import TimeControls from './TimeControls.vue'

/** Top of the run screen (Figma `39:902`): Menu, coffer, rate, candle clock, quotas, unrest. */
defineProps<{ compact?: boolean }>()

const game = useGameStore()
const nav = useNavStore()
const motionOn = useMotionAllowed()
const coffer = useRolledNumber(
  () => game.coffer,
  () => motionOn.value,
)

const cofferText = computed(() => formatCompact(Math.floor(coffer.value)))
/** Long figures shrink so that the coffer never runs under the clock. */
const cofferClass = computed(() => {
  const length = cofferText.value.length
  if (length > 7) return 'text-[23px]'
  if (length > 5) return 'text-[28px]'
  return 'text-[38px] min-[400px]:text-5xl min-[400px]:leading-[44px]'
})

const rate = useRolledNumber(
  () => game.netApPerSecond,
  () => motionOn.value,
)

const unrest = computed(() => {
  void game.revision
  const value = game.run?.unrest ?? 0
  return { figure: Math.round(value), phrase: unrestPhrase(value) }
})
</script>

<template>
  <header class="px-3 pt-2" :class="compact ? 'hud-compact' : ''">
    <div class="flex items-start gap-2">
      <button
        type="button"
        aria-label="Menu"
        class="flex h-[52px] w-12 shrink-0 flex-col items-center justify-center rounded border border-gold bg-vellum-shade"
        @click="nav.menuOpen = true"
      >
        <GameIcon name="book" class="size-6 text-ink" label="Menu" />
        <span class="font-caps text-base text-ink">Menu</span>
      </button>

      <div class="min-w-0 flex-1 text-center">
        <p class="font-caps text-base leading-[20px] text-rubric">In the coffer</p>
        <p
          data-coffer
          class="whitespace-nowrap font-display leading-[40px] text-ink"
          :class="cofferClass"
        >
          <StableFigure :value="cofferText" />
          <span class="ml-1.5 font-display text-[22px] italic text-ink-faded">AP</span>
        </p>
        <p
          data-rate
          class="whitespace-nowrap font-display text-base"
          :class="game.netApPerSecond < 0 ? 'text-rubric' : 'text-verdigris'"
        >
          <StableFigure :value="formatRate(rate)" />
        </p>
      </div>

      <div class="flex shrink-0 flex-col items-end gap-1">
        <CandleClock />
        <TimeControls />
      </div>
    </div>

    <div class="hud-quotas mt-1 flex gap-2">
      <TallyStick v-for="quota in game.quotas" :key="quota.axis" :quota="quota" />
    </div>

    <p
      data-unrest
      :title="unrest.phrase"
      class="mt-1 flex items-center gap-1.5 whitespace-nowrap font-body text-base text-ink"
    >
      <GameIcon name="discontent" class="size-3.5 text-rubric" label="Unrest" />
      Unrest
      <StableFigure :value="String(unrest.figure)" class="font-display text-[21px] leading-none" />
      of 100, overthrown at 100
    </p>
  </header>
</template>

<style scoped>
/* Order pages give their lists the height of the tally sticks on short screens. */
@media (max-height: 560px) {
  .hud-compact .hud-quotas,
  .hud-compact [data-unrest] {
    display: none;
  }
}
</style>
