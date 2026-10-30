<script setup lang="ts">
import { computed } from 'vue'
import GameIcon from '@/components/common/GameIcon.vue'
import { useGameStore } from '@/stores/game'
import { useNavStore } from '@/stores/nav'
import { formatCoffer, formatRate, unrestLine } from '@/ui/realmText'
import { useMotionAllowed, useRolledNumber } from './useAmbientMotion'
import CandleClock from './CandleClock.vue'
import TallyStick from './TallyStick.vue'
import TimeControls from './TimeControls.vue'

/** Top of the run screen (Figma `39:902`): Menu, coffer, rate, candle clock, quotas, unrest. */
const game = useGameStore()
const nav = useNavStore()
const motionOn = useMotionAllowed()
const coffer = useRolledNumber(
  () => game.coffer,
  () => motionOn.value,
)

const rate = useRolledNumber(
  () => game.netApPerSecond,
  () => motionOn.value,
)

const unrest = computed(() => {
  void game.revision
  return unrestLine(game.run?.unrest ?? 0)
})
</script>

<template>
  <header class="relative px-4 pt-3">
    <button
      type="button"
      aria-label="Menu"
      class="absolute left-3 top-3 flex h-[52px] w-12 flex-col items-center justify-center rounded border border-gold bg-vellum-shade"
      @click="nav.menuOpen = true"
    >
      <GameIcon name="book" class="size-6 text-ink" label="Menu" />
      <span class="font-caps text-xs text-ink">Menu</span>
    </button>

    <div class="text-center">
      <p class="font-caps text-sm text-rubric">In the coffer</p>
      <p data-coffer class="font-display text-5xl leading-[44px] text-ink">
        {{ formatCoffer(Math.floor(coffer)) }}
        <span class="font-display text-[28px] italic text-ink-faded">AP</span>
      </p>
      <p
        data-rate
        class="font-body text-sm italic"
        :class="game.netApPerSecond < 0 ? 'text-rubric' : 'text-verdigris'"
      >
        {{ formatRate(rate) }}
      </p>
    </div>

    <div class="absolute right-3 top-1.5 flex flex-col items-end gap-1">
      <CandleClock />
      <TimeControls />
    </div>

    <div class="mt-1.5 flex gap-2.5">
      <TallyStick v-for="quota in game.quotas" :key="quota.axis" :quota="quota" />
    </div>

    <p class="mt-1.5 flex items-center gap-1.5 font-body text-sm italic text-ink">
      <GameIcon name="discontent" class="size-3.5 text-rubric" label="Unrest" />
      {{ unrest }}
    </p>
  </header>
</template>
