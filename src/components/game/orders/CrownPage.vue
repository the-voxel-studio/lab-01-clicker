<script setup lang="ts">
import { computed, ref } from 'vue'
import GameIcon from '@/components/common/GameIcon.vue'
import type { Command, GameState } from '@/core/types'
import type { EdictId } from '@/data/edicts'
import { useGameStore } from '@/stores/game'
import { coloniseView, edictRows } from '@/ui/crown'
import { formatCompact } from '@/ui/realmText'
import EdictRow from './EdictRow.vue'
import OrderFrame from './OrderFrame.vue'
import TaxSlider from './TaxSlider.vue'

/** The Crown: the tax, the emergency edicts and new land (Figma `53:1942`). */
const game = useGameStore()
const refused = ref(false)
const stamped = ref<EdictId | null>(null)
const raised = ref(0)

/** Reads the reign after the last engine call: its object never changes, only `revision` does. */
function current(): GameState | null {
  void game.revision
  return game.run
}

const edicts = computed(() => {
  const run = current()
  return run ? edictRows(run) : []
})
const colonise = computed(() => {
  const run = current()
  return run ? coloniseView(run) : null
})

function act(command: Command): void {
  refused.value = !game.act(command).success
  if (refused.value) return
  if (command.type === 'ENACT_EDICT') stamped.value = command.edictId
  if (command.type === 'COLONISE_PROVINCE') raised.value++
}
</script>

<template>
  <OrderFrame title="The Crown" intro="Your own hand: the tax, the emergency edicts, and new land.">
    <TaxSlider
      v-if="game.run"
      :run="game.run"
      :revision="game.revision"
      @proclaim="act({ type: 'SET_TAX_RATE', rate: $event })"
    />
    <p v-if="refused" data-refusal class="font-body text-[13px] italic text-rubric">
      The Crown refuses this order.
    </p>
    <h2 class="mt-3 font-caps text-sm text-rubric">Emergency edicts</h2>
    <EdictRow
      v-for="row in edicts"
      :key="row.id"
      :row="row"
      :stamped="stamped === row.id"
      @enact="act"
    />
    <section v-if="colonise" class="mt-3 flex items-center gap-3">
      <div class="relative min-w-0 flex-1">
        <GameIcon
          v-if="raised"
          :key="raised"
          name="stoneTower"
          data-raised
          class="motion-raise absolute right-1 top-0 size-7 text-ink"
          label=""
        />
        <h2 class="font-caps text-sm text-rubric">New land</h2>
        <p class="font-body text-[13px] italic leading-[18px] text-ink-faded">
          Colonise an empty province: more room for your people.
        </p>
      </div>
      <button
        type="button"
        data-colonise
        :disabled="colonise.command === null"
        class="flex h-12 w-[112px] shrink-0 flex-col items-center justify-center rounded-lg border-[1.5px]"
        :class="
          colonise.command
            ? 'border-gold bg-wax text-cream'
            : 'border-ink-faded bg-vellum-shade text-ink-faded'
        "
        @click="colonise?.command && act(colonise.command)"
      >
        <span class="font-caps text-[15px] leading-5">{{ colonise.blocked ?? 'Colonise' }}</span>
        <span class="font-body text-[13px] italic leading-[18px]">
          {{ formatCompact(colonise.cost, 0, 'up') }} AP
        </span>
      </button>
    </section>
  </OrderFrame>
</template>
