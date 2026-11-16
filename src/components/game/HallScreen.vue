<script setup lang="ts">
import LevelChoice from '@/components/game/LevelChoice.vue'
import { LEVEL_DATA } from '@/data/levels'
import { useGameStore } from '@/stores/game'
import { useNavStore } from '@/stores/nav'

const game = useGameStore()
const nav = useNavStore()

function beginReign(): void {
  game.begin()
  nav.go('run')
}

function continueReign(): void {
  if (game.resume()) nav.go('run')
}
</script>

<template>
  <section class="hall flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-5 py-10">
    <h1 class="font-display text-4xl text-ink">The Grand Audit</h1>
    <p class="hall-tagline font-body text-lg italic text-ink-faded">
      Ten audits stand between you and the Crown.
    </p>
    <LevelChoice />
    <button
      type="button"
      class="self-start rounded bg-wax px-6 py-3 font-display text-xl text-cream"
      @click="beginReign"
    >
      Begin a reign
    </button>
    <a
      v-if="game.savedDeadline !== null"
      href="#"
      data-continue
      class="font-body italic text-rubric underline"
      @click.prevent="continueReign"
    >
      Continue the {{ LEVEL_DATA[game.savedLevel ?? 'ordinary'].name }} reign at audit
      {{ game.savedDeadline }}
    </a>
  </section>
</template>

<style scoped>
/* Short screens keep the seal in view under the three levels: less air, no tagline. */
@media (max-height: 640px) {
  .hall {
    gap: 12px;
    padding-top: 16px;
    padding-bottom: 16px;
  }
}
@media (max-height: 520px) {
  .hall-tagline {
    display: none;
  }
}
</style>
