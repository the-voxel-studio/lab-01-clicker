<script setup lang="ts">
import { computed } from 'vue'
import { importSaveFromBase64 } from '@/core/migrations'
import { useGameStore } from '@/stores/game'
import { useNavStore } from '@/stores/nav'
import { readKey, SAVE_KEY } from '@/ui/storage'

const game = useGameStore()
const nav = useNavStore()

/** Audit of the saved reign, or null when there is none to continue. */
const savedAudit = computed<number | null>(() => {
  if (!game.hasSave) return null
  const raw = readKey(SAVE_KEY)
  if (raw === null) return null
  try {
    return importSaveFromBase64(raw).state.deadline
  } catch {
    return null
  }
})

function beginReign(): void {
  game.begin()
  nav.go('run')
}

function continueReign(): void {
  if (game.resume()) nav.go('run')
}
</script>

<template>
  <section class="flex flex-1 flex-col gap-6 px-5 py-10">
    <h1 class="font-display text-4xl text-ink">The Grand Audit</h1>
    <p class="font-body text-lg italic text-ink-faded">
      Ten audits stand between you and the Crown.
    </p>
    <button
      type="button"
      class="self-start rounded bg-wax px-6 py-3 font-display text-xl text-cream"
      @click="beginReign"
    >
      Begin a reign
    </button>
    <a
      v-if="savedAudit !== null"
      href="#"
      class="font-body italic text-rubric underline"
      @click.prevent="continueReign"
    >
      Continue the reign at audit {{ savedAudit }}
    </a>
  </section>
</template>
