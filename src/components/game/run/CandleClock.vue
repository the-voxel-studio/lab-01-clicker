<script setup lang="ts">
import { computed } from 'vue'
import GameIcon from '@/components/common/GameIcon.vue'
import { DEFAULT_ENGINE_CONFIG } from '@/core/config'
import { useGameStore } from '@/stores/game'
import { auditOrdinal, formatClock } from '@/ui/realmText'

/** The deadline countdown: a candle burning down beside the clock and the audit ordinal. */
const game = useGameStore()

const deadline = computed(() => {
  void game.revision
  return game.run?.deadline ?? 1
})
const burnt = computed(
  () => 1 - game.secondsLeft / DEFAULT_ENGINE_CONFIG.balance.DEADLINE_DURATION_SECONDS,
)
const waxHeight = computed(() => `${Math.max(4, Math.round(37 * (1 - burnt.value)))}px`)
</script>

<template>
  <div class="flex items-end gap-2">
    <div class="text-right">
      <p class="font-display text-[26px] leading-[30px] text-ink">
        {{ formatClock(game.secondsLeft) }}
      </p>
      <p class="font-body text-sm italic text-ink-faded">{{ auditOrdinal(deadline) }} audit</p>
    </div>
    <div class="flex w-7 flex-col items-center" aria-hidden="true">
      <GameIcon name="candleFlame" class="size-[18px] text-gold" />
      <div class="w-[14px] bg-cream" :style="{ height: waxHeight }" />
      <div class="h-[5px] w-7 bg-gold" />
    </div>
  </div>
</template>
