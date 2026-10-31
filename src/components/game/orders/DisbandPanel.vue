<script setup lang="ts">
import { computed, ref } from 'vue'
import type { Command, UnitId } from '@/core/types'
import { useGameStore } from '@/stores/game'
import { disbandRows } from '@/ui/orderRows'
import { formatCompact } from '@/ui/realmText'

/** The disband link of the Host and the list it opens: one man at a time, by choice. */
const emit = defineEmits<{ act: [command: Command] }>()

const game = useGameStore()
const open = ref(false)
const rows = computed(() => {
  void game.revision
  return game.run ? disbandRows(game.run) : []
})
const unpaid = computed(() => rows.value.some((row) => row.unpaid))

function disband(unitId: UnitId): void {
  emit('act', { type: 'DISBAND_UNIT', unitId, count: 1 })
}
</script>

<template>
  <div class="pt-3">
    <button
      type="button"
      data-disband-open
      class="min-h-6 font-body text-base italic text-rubric underline"
      :aria-expanded="open"
      @click="open = !open"
    >
      Disband soldiers
    </button>
    <span class="font-body text-base italic text-ink-faded"> to save upkeep</span>
    <div v-if="open" class="mt-2 flex flex-col gap-1">
      <p class="font-body text-base italic text-ink-faded">
        A tenth of the army sent home at once will mutiny.
      </p>
      <p v-if="unpaid" class="font-body text-base italic text-rubric">
        The coffer cannot pay them: unpaid men stir unrest.
      </p>
      <button
        v-for="row in rows"
        :key="row.unitId"
        type="button"
        :data-disband="row.unitId"
        class="flex min-h-11 items-center justify-between rounded border border-ink-faded/60 bg-vellum-shade px-3 font-body text-base text-ink"
        @click="disband(row.unitId)"
      >
        <span>{{ row.name }}, {{ formatCompact(row.owned) }} left</span>
        <span class="italic text-ink-faded">{{ formatCompact(row.severance, 1) }} AP each</span>
      </button>
    </div>
  </div>
</template>
