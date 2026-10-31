<script setup lang="ts">
import GameIcon from '@/components/common/GameIcon.vue'
import type { GameIconKey } from '@/data/icons'
import type { ChronicleEntry, ChronicleKind } from '@/ui/chronicle'
import { formatClock } from '@/ui/realmText'

/** The last lines of the chronicle, timed from the coronation (Figma `53:369`). */
defineProps<{ entries: ChronicleEntry[] }>()

const MARKS: Record<ChronicleKind, GameIconKey> = {
  decision: 'quill',
  audit: 'crown',
  folklore: 'scroll',
  death: 'skull',
  money: 'coins',
}
</script>

<template>
  <section v-if="entries.length > 0" data-ending>
    <h3 class="font-caps text-base leading-5 text-rubric">How it ended</h3>
    <ul class="mt-1 flex flex-col gap-1">
      <li
        v-for="entry in entries"
        :key="entry.id"
        data-ending-line
        class="grid grid-cols-[16px_36px_1fr] items-start gap-x-2"
      >
        <GameIcon :name="MARKS[entry.kind]" label="" class="mt-0.5 size-4 text-ink" />
        <span class="font-caps text-base leading-5 text-rubric">
          {{ formatClock(entry.reignSeconds) }}
        </span>
        <span class="font-body text-[18px] leading-5 text-ink">{{ entry.text }}</span>
      </li>
    </ul>
  </section>
</template>
