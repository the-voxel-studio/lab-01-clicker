<script setup lang="ts">
import { useGameStore } from '@/stores/game'

/** How the last fight went: a fight leaves its letter at once and the next screen does not say. */
const game = useGameStore()
</script>

<template>
  <button
    v-if="game.tidings"
    :key="game.tidings"
    data-tidings
    type="button"
    class="min-h-9 rounded border border-gold/70 bg-vellum px-3 py-1 text-left font-body text-sm italic leading-[18px] text-ink shadow"
    @click="game.dismissTidings()"
  >
    <span class="motion-ink block">{{ game.tidings }}</span>
  </button>
</template>
