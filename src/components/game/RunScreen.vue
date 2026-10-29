<script setup lang="ts">
import { computed } from 'vue'
import { DEFAULT_ENGINE_CONFIG } from '@/core/config'
import { isFastForwardUnlocked } from '@/core/engine'
import { useGameStore } from '@/stores/game'
import { useSettingsStore } from '@/stores/settings'
import PhaseStub from './PhaseStub.vue'

const game = useGameStore()
const settings = useSettingsStore()

/** Run fields the engine mutates in place, read after the last engine call. */
const run = computed(() => {
  void game.revision
  const state = game.run
  return {
    deadline: state?.deadline ?? 1,
    paused: state?.isPaused ?? false,
    fastForward: state ? isFastForwardUnlocked(state, DEFAULT_ENGINE_CONFIG) : false,
  }
})

const clock = computed(() => {
  const total = Math.max(0, Math.ceil(game.secondsLeft))
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
})

const showStub = computed(
  () =>
    game.phase !== null &&
    game.phase !== 'ACTIVE_CYCLE' &&
    game.phase !== 'RUN_DEFEAT' &&
    game.phase !== 'RUN_VICTORY',
)

function togglePause(): void {
  game.act({ type: 'SET_PAUSED', paused: !run.value.paused })
}
</script>

<template>
  <section :data-dread="game.dread.band" class="relative flex flex-1 flex-col gap-6 px-5 py-6">
    <header class="flex items-start justify-between gap-4">
      <div>
        <p class="font-caps text-rubric">In the coffer</p>
        <p data-coffer class="font-display text-4xl text-ink">
          {{ Math.floor(game.coffer).toLocaleString('en') }} AP
        </p>
      </div>
      <div class="text-right">
        <p class="font-display text-3xl text-ink">{{ clock }}</p>
        <p class="font-body italic text-ink-faded">Audit {{ run.deadline }} of 10</p>
      </div>
    </header>

    <div class="flex gap-3">
      <button
        type="button"
        class="rounded border border-ink-faded bg-vellum-shade px-4 py-2 font-body text-ink"
        @click="togglePause"
      >
        {{ run.paused ? 'Resume' : 'Pause' }}
      </button>
      <button
        type="button"
        class="rounded border border-ink-faded px-4 py-2 font-body disabled:opacity-50"
        :class="
          settings.doubleSpeed && run.fastForward ? 'bg-wax text-cream' : 'bg-vellum-shade text-ink'
        "
        :disabled="!run.fastForward"
        :title="run.fastForward ? 'Double speed' : 'Unlocked at the fifth audit'"
        @click="settings.doubleSpeed = !settings.doubleSpeed"
      >
        ×2
      </button>
    </div>

    <button
      type="button"
      class="mx-auto size-40 rounded-full bg-wax font-display text-xl text-cream"
      @click="game.act({ type: 'STAMP_DOCUMENT' })"
    >
      Seal a decree
    </button>

    <PhaseStub v-if="showStub" />
  </section>
</template>
