<script setup lang="ts">
import { computed } from 'vue'
import { useChronicleStore } from '@/stores/chronicle'
import { useGameStore } from '@/stores/game'
import { useNavStore } from '@/stores/nav'
import { formatReignClock } from '@/ui/chronicle'
import ChronicleMark from './ChronicleMark.vue'

/** The latest of the chronicle under the counsel, cut short: the full page holds the rest. */
const chronicle = useChronicleStore()
const nav = useNavStore()
const game = useGameStore()

const groups = computed(() => chronicle.byAudit.slice(0, 2))
/** The panel tells the verdict only; the figures sentence belongs to the full page. */
const firstSentence = (text: string): string =>
  text.replace(/ AP [\d,.]+ of [\d,.]+, People .*$/, '')
</script>

<template>
  <section class="flex min-h-0 flex-1 flex-col px-4">
    <div class="flex items-baseline justify-between border-t border-ink-faded pt-2">
      <h2 class="font-display text-[22px] text-ink">Chronicle of the realm</h2>
      <button
        type="button"
        data-read-all
        class="font-body text-base italic text-rubric underline"
        @click="nav.go('chronicle')"
      >
        Read it all
      </button>
    </div>
    <div class="chronicle-excerpt relative mt-1 min-h-0 flex-1 overflow-hidden">
      <template v-for="group in groups" :key="group.deadline">
        <p class="my-1 flex items-center gap-2 font-caps text-base text-ink-faded">
          <span class="h-px flex-1 bg-ink-faded/60" />{{ group.title
          }}<span class="h-px flex-1 bg-ink-faded/60" />
        </p>
        <p
          v-for="entry in group.entries"
          :key="entry.id"
          class="flex items-start gap-2 py-0.5 font-body text-base leading-5 text-ink"
        >
          <ChronicleMark :kind="entry.kind" />
          <span class="w-9 shrink-0 font-body text-base text-rubric">{{
            formatReignClock(entry.reignSeconds)
          }}</span>
          <button
            v-if="entry.report"
            type="button"
            data-entry-report
            class="motion-ink text-left underline decoration-rubric underline-offset-2"
            @click="game.openReport(entry.report)"
          >
            {{ firstSentence(entry.text) }}
          </button>
          <span v-else class="motion-ink">{{ firstSentence(entry.text) }}</span>
        </p>
      </template>
    </div>
  </section>
</template>

<style scoped>
.chronicle-excerpt {
  mask-image: linear-gradient(to bottom, black 70%, transparent);
}
</style>
