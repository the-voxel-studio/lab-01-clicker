<script setup lang="ts">
import { computed } from 'vue'
import { useArchivesStore } from '@/stores/archives'
import { useGameStore } from '@/stores/game'
import { useNavStore } from '@/stores/nav'
import type { RunOutcome } from '@/ui/runRecord'

const archives = useArchivesStore()
const game = useGameStore()
const nav = useNavStore()

/** How each kind of ending is told; a victory needs no epitaph. */
const EPITAPHS: Record<Exclude<RunOutcome, 'victory'>, string> = {
  quota_failure: 'Struck from the rolls.',
  revolution: 'The people came at dawn.',
  bankruptcy: 'The Lombard took the rest.',
  conquest: 'Sum sine regno.',
  abandoned: 'You laid down the crown.',
}

const ending = computed(() => {
  const last = game.lastConclusion
  const outcome = last?.record.outcome ?? 'abandoned'
  return {
    reign: archives.history.length,
    won: outcome === 'victory',
    epitaph: outcome === 'victory' ? null : EPITAPHS[outcome],
    points: signed(last?.conclusion.pointsEarned ?? 0),
  }
})

/** Writes a signed figure with a plus or a true minus sign (U+2212). */
function signed(value: number): string {
  return value < 0 ? `\u2212${Math.abs(value)}` : `+${value}`
}

function beginNewReign(): void {
  game.begin()
  nav.go('run')
}
</script>

<template>
  <section class="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-5 py-10">
    <h2 class="font-display text-3xl text-ink">
      Reign {{ ending.reign }} is {{ ending.won ? 'won' : 'over' }}
    </h2>
    <p v-if="ending.epitaph" class="font-body text-xl italic text-ink">{{ ending.epitaph }}</p>
    <p class="font-body text-ink-faded">{{ ending.points }} archive points</p>
    <button
      type="button"
      class="self-start rounded bg-wax px-6 py-3 font-display text-xl text-cream"
      @click="beginNewReign"
    >
      Begin a new reign
    </button>
    <button
      type="button"
      class="self-start font-body italic text-rubric underline"
      @click="nav.go('hall')"
    >
      Return to the hall
    </button>
  </section>
</template>
