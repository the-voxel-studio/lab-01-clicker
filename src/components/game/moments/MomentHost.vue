<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useMotionAllowed } from '@/components/game/run/useAmbientMotion'
import type { Command } from '@/core/types'
import { useGameStore } from '@/stores/game'
import { useNavStore } from '@/stores/nav'
import { momentView } from '@/ui/moments'
import MomentLetter from './MomentLetter.vue'

/**
 * Holds the letter of the current phase over the dimmed run, drawn from the state alone. It sits
 * above the screens, so a last letter finishes leaving, and its seal breaking, over the next one.
 */
const game = useGameStore()
const nav = useNavStore()
const motionOn = useMotionAllowed()
const error = ref<string | null>(null)

const view = computed(() => {
  void game.revision
  return game.run && game.inMoment && nav.screen === 'run' ? momentView(game.run) : null
})

watch(
  () => game.phase,
  () => {
    error.value = null
  },
)

function answer(command: Command): void {
  const result = game.act(command)
  error.value = result.success ? null : (result.error ?? 'The Crown refuses.')
}
</script>

<template>
  <div
    data-moment-host
    :data-motion="motionOn ? 'on' : 'off'"
    class="pointer-events-none absolute inset-0 z-30 flex items-center justify-center px-4 pt-12 pb-4"
  >
    <Transition name="fade">
      <div v-if="view" class="pointer-events-auto absolute inset-0 bg-bar/70" />
    </Transition>
    <Transition name="letter" mode="out-in" appear>
      <MomentLetter
        v-if="view"
        :key="game.phase ?? ''"
        class="pointer-events-auto"
        :view="view"
        :band="game.dread.band"
        :error="error"
        @choose="answer"
      />
    </Transition>
  </div>
</template>
