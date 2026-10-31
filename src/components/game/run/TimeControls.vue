<script setup lang="ts">
import { computed, onUnmounted, ref } from 'vue'
import GameIcon from '@/components/common/GameIcon.vue'
import { DEFAULT_ENGINE_CONFIG } from '@/core/config'
import { isFastForwardUnlocked } from '@/core/engine'
import { useGameStore } from '@/stores/game'
import { useSettingsStore } from '@/stores/settings'
import { auditOrdinal } from '@/ui/realmText'

/** Pause and double speed, under the candle (design 4.2, sixth pass). */
const game = useGameStore()
const settings = useSettingsStore()

const state = computed(() => {
  void game.revision
  const run = game.run
  return {
    paused: run?.isPaused ?? false,
    unlocked: run ? isFastForwardUnlocked(run, DEFAULT_ENGINE_CONFIG) : false,
  }
})
const doubleOn = computed(() => settings.doubleSpeed && state.value.unlocked)
const lockedReason = `Unlocks at the ${auditOrdinal(DEFAULT_ENGINE_CONFIG.balance.FAST_FORWARD_MIN_DEADLINE)} audit`
const REASON_MS = 4000
const reasonShown = ref(false)
let reasonTimer: ReturnType<typeof setTimeout> | null = null

function hideReason(): void {
  reasonShown.value = false
  if (reasonTimer !== null) clearTimeout(reasonTimer)
  reasonTimer = null
  window.removeEventListener('pointerdown', hideReason)
}

function toggleDouble(): void {
  if (state.value.unlocked) {
    settings.doubleSpeed = !settings.doubleSpeed
  } else if (reasonShown.value) {
    hideReason()
  } else {
    reasonShown.value = true
    reasonTimer = setTimeout(hideReason, REASON_MS)
    window.addEventListener('pointerdown', hideReason)
  }
}

onUnmounted(hideReason)

function togglePause(): void {
  game.act({ type: 'SET_PAUSED', paused: !state.value.paused })
}
</script>

<template>
  <div class="relative flex gap-1.5">
    <button
      type="button"
      :aria-label="state.paused ? 'Resume' : 'Pause'"
      class="flex h-[30px] w-[38px] items-center justify-center rounded border border-gold"
      :class="state.paused ? 'bg-wax' : 'bg-vellum-shade'"
      @click="togglePause"
    >
      <span
        v-if="state.paused"
        class="ml-0.5 size-0 border-y-[7px] border-l-[11px] border-y-transparent border-l-cream"
      />
      <span v-else class="flex gap-1">
        <span class="h-3.5 w-1 bg-ink" />
        <span class="h-3.5 w-1 bg-ink" />
      </span>
    </button>
    <button
      type="button"
      data-double-speed
      :aria-pressed="doubleOn"
      :aria-disabled="!state.unlocked"
      :title="state.unlocked ? 'Double speed' : lockedReason"
      class="flex h-[30px] w-11 items-center justify-center gap-1 rounded border font-body"
      :class="
        doubleOn
          ? 'border-gold bg-wax text-cream'
          : 'border-ink-faded/40 bg-vellum-shade text-ink-faded'
      "
      @click="toggleDouble"
    >
      ×2
      <GameIcon v-if="!state.unlocked" name="padlock" class="size-[11px]" label="Locked" />
    </button>
    <p
      v-if="reasonShown && !state.unlocked"
      data-double-reason
      role="status"
      class="absolute right-0 top-[34px] z-30 whitespace-nowrap rounded border border-gold bg-vellum-shade px-2 py-0.5 font-body text-base text-ink"
    >
      {{ lockedReason }}
    </p>
  </div>
</template>
