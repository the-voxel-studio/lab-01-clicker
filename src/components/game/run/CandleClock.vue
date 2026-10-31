<script setup lang="ts">
import { computed } from 'vue'
import GameIcon from '@/components/common/GameIcon.vue'
import { DEFAULT_ENGINE_CONFIG } from '@/core/config'
import { useGameStore } from '@/stores/game'
import { auditOrdinal, formatClock } from '@/ui/realmText'

/** The deadline countdown: a candle burning down beside the clock and the audit ordinal. */
const game = useGameStore()

const WAX_PX = 37
const WAX_MIN_PX = 4
const LAST_SECONDS = 10

const burnt = computed(
  () => 1 - game.secondsLeft / DEFAULT_ENGINE_CONFIG.balance.DEADLINE_DURATION_SECONDS,
)
const waxLeft = computed(() => Math.max(WAX_MIN_PX, Math.round(WAX_PX * (1 - burnt.value))))
const guttering = computed(() => game.secondsLeft <= LAST_SECONDS)
</script>

<template>
  <div class="flex items-end gap-2">
    <div class="text-right">
      <p
        class="font-display text-[26px] leading-[30px]"
        :class="guttering ? 'motion-beat text-rubric' : 'text-ink'"
      >
        {{ formatClock(game.secondsLeft) }}
      </p>
      <p class="font-body text-sm italic text-ink-faded">
        {{ auditOrdinal(game.auditAhead) }} audit
      </p>
    </div>
    <div class="flex w-7 flex-col items-center" aria-hidden="true">
      <div
        class="transition-transform duration-1000 ease-linear"
        :style="{ transform: `translateY(${WAX_PX - waxLeft}px)` }"
      >
        <GameIcon
          name="candleFlame"
          data-candle
          class="size-[18px] text-vermilion"
          :class="guttering ? 'motion-gutter' : 'motion-candle'"
        />
      </div>
      <div data-wax-track class="relative h-[37px] w-4 rounded-t-sm bg-ink/15">
        <div
          data-wax
          class="absolute inset-0 origin-bottom rounded-t-sm bg-wax transition-transform duration-1000 ease-linear"
          :style="{ transform: `scaleY(${waxLeft / WAX_PX})` }"
        />
      </div>
      <div class="h-[5px] w-7 rounded-sm bg-wood-dark" />
    </div>
  </div>
</template>
