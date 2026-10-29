<script setup lang="ts">
import { computed } from 'vue'
import GameIcon from '@/components/common/GameIcon.vue'
import { DEFAULT_ENGINE_CONFIG } from '@/core/config'
import { isFastForwardUnlocked } from '@/core/engine'
import { useGameStore } from '@/stores/game'
import { useSettingsStore } from '@/stores/settings'

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

function togglePause(): void {
  game.act({ type: 'SET_PAUSED', paused: !state.value.paused })
}
</script>

<template>
  <div class="flex gap-1.5">
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
      :disabled="!state.unlocked"
      :title="state.unlocked ? 'Double speed' : 'Unlocked at the fifth audit'"
      class="flex h-[30px] w-11 items-center justify-center gap-1 rounded border font-body disabled:opacity-60"
      :class="
        doubleOn
          ? 'border-gold bg-wax text-cream'
          : 'border-ink-faded/40 bg-vellum-shade text-ink-faded'
      "
      @click="settings.doubleSpeed = !settings.doubleSpeed"
    >
      ×2
      <GameIcon v-if="!state.unlocked" name="padlock" class="size-[11px]" label="Locked" />
    </button>
  </div>
</template>
