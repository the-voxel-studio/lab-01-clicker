<script setup lang="ts">
import { useGameStore } from '@/stores/game'
import { computed } from 'vue'
import LeafPager from '@/components/game/ledger/LeafPager.vue'
import EdictRow from '@/components/game/orders/EdictRow.vue'
import type { Command, GameState } from '@/core/types'
import type { EdictId } from '@/data/edicts'
import type { EdictRow as EdictView } from '@/ui/crown'
import { decreesRecap } from '@/ui/crownRecap'

const game = useGameStore()

/**
 * The emergency edicts, then the laws in force and their seats. Nothing scrolls: what does not
 * fit turns onto a further leaf, and a heading never parts from its first entry.
 */
const props = defineProps<{
  run: GameState
  revision: number
  edicts: EdictView[]
  stamped: EdictId | null
}>()
const emit = defineEmits<{ enact: [command: Command] }>()
const recap = computed(() => {
  void props.revision
  return decreesRecap(props.run, game.config)
})
</script>

<template>
  <LeafPager data-tab-decrees>
    <div
      v-for="(row, index) in edicts"
      :key="row.id"
      class="break-inside-avoid"
      :data-edict-block="row.id"
    >
      <h2 v-if="index === 0" class="font-caps text-base text-rubric">
        Emergency edicts, one each audit
      </h2>
      <EdictRow :row="row" :stamped="stamped === row.id" @enact="emit('enact', $event)" />
    </div>
    <div data-laws class="mt-3 break-inside-avoid font-body text-base leading-[22px] text-ink">
      <h2 class="font-caps text-rubric">
        Laws, {{ recap.laws.length }} of {{ recap.seats }} seats
      </h2>
      <p v-if="recap.laws.length === 0" class="text-ink-faded">No law in force yet.</p>
      <p v-else class="py-0.5">
        <span class="text-[18px]">{{ recap.laws[0]?.name }}.</span> {{ recap.laws[0]?.text }}
      </p>
    </div>
    <p
      v-for="law in recap.laws.slice(1)"
      :key="law.id"
      class="break-inside-avoid py-0.5 font-body text-base leading-[22px] text-ink"
    >
      <span class="text-[18px]">{{ law.name }}.</span> {{ law.text }}
    </p>
  </LeafPager>
</template>
