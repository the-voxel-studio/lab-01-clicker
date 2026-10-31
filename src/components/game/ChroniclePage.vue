<script setup lang="ts">
import { useArchivesStore } from '@/stores/archives'
import { useChronicleStore } from '@/stores/chronicle'
import { useGameStore } from '@/stores/game'
import { useNavStore } from '@/stores/nav'
import { formatReignClock, type ChronicleKind } from '@/ui/chronicle'
import ActionBar from './run/ActionBar.vue'
import ChronicleMark from './run/ChronicleMark.vue'

/** The whole chronicle, from the coronation to now (Figma `39:1783`). */
const archives = useArchivesStore()
const chronicle = useChronicleStore()
const game = useGameStore()
const nav = useNavStore()

const LEGEND: [ChronicleKind, string][] = [
  ['decision', 'your decisions'],
  ['audit', 'audits'],
  ['folklore', 'folklore'],
  ['death', 'deaths'],
  ['money', 'money'],
]
</script>

<template>
  <section class="flex min-h-0 flex-1 flex-col">
    <div class="flex min-h-0 flex-1 flex-col px-5 pb-3 pt-6">
      <h1 class="font-display text-[28px] text-ink">Chronicle of the realm</h1>
      <p class="font-body italic text-ink-faded">
        Reign {{ archives.history.length + 1 }}, from the coronation to now
      </p>
      <div data-chronicle-list class="mt-3 min-h-0 flex-1 overflow-y-auto">
        <template v-for="group in chronicle.byAudit" :key="group.deadline">
          <p class="my-2 flex items-center gap-2 font-caps text-base text-ink-faded">
            <span class="h-px flex-1 bg-ink-faded/60" />{{ group.title
            }}<span class="h-px flex-1 bg-ink-faded/60" />
          </p>
          <p
            v-for="entry in group.entries"
            :key="entry.id"
            class="flex items-start gap-2 py-1 font-body text-base leading-5 text-ink"
          >
            <ChronicleMark :kind="entry.kind" />
            <span class="w-9 shrink-0 text-base text-rubric">{{
              formatReignClock(entry.reignSeconds)
            }}</span>
            <button
              v-if="entry.report"
              type="button"
              data-entry-report
              class="text-left underline decoration-rubric underline-offset-2"
              @click="game.openReport(entry.report)"
            >
              {{ entry.text }}
            </button>
            <span v-else>{{ entry.text }}</span>
          </p>
        </template>
      </div>
      <p
        class="mt-3 flex shrink-0 flex-wrap gap-x-4 gap-y-1 font-body text-base italic text-ink-faded"
      >
        <span v-for="[kind, label] in LEGEND" :key="kind" class="flex items-center gap-1">
          <ChronicleMark :kind="kind" />{{ label }}
        </span>
      </p>
      <button
        type="button"
        data-back
        class="mt-2 shrink-0 self-start font-body italic text-rubric underline"
        @click="nav.go('run')"
      >
        Back to the reign
      </button>
    </div>
    <div v-if="!game.isOver" class="z-20 shrink-0">
      <ActionBar />
    </div>
  </section>
</template>
