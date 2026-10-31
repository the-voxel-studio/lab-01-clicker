<script setup lang="ts">
import { computed, ref } from 'vue'
import GameIcon from '@/components/common/GameIcon.vue'
import type { Command, GameState, UnitOrder } from '@/core/types'
import { useGameStore } from '@/stores/game'
import {
  bulkOptions,
  hostLine,
  paperworkLine,
  patentRow,
  unitRows,
  type BulkChoice,
} from '@/ui/orderRows'
import BulkSelector from './BulkSelector.vue'
import DisbandPanel from './DisbandPanel.vue'
import OrderFrame from './OrderFrame.vue'
import PatentRow from './PatentRow.vue'
import UnitRow from './UnitRow.vue'

/** One of the three orders of the realm: its panel, bulk sizes, unit rows and patent. */
const props = defineProps<{ order: UnitOrder }>()

const COPY: Record<UnitOrder, { title: string; intro: string }> = {
  people: {
    title: 'The Commons',
    intro: 'Those who work the land. They feed the realm and fill the People quota.',
  },
  admin: {
    title: 'The Chancery',
    intro: 'Those who write. They raise AP, and they keep the paperwork from drowning you.',
  },
  military: {
    title: 'The Host',
    intro: 'Those who fight. They fill the Army quota and answer the threats at your border.',
  },
}

const game = useGameStore()
const bulk = ref<BulkChoice>(1)
const refused = ref(false)
/** Bumped by a sealed patent, which breaks the padlock over the new rows. */
const broken = ref(0)

const copy = computed(() => COPY[props.order])
/** Reads the reign after the last engine call: its object never changes, only `revision` does. */
function current(): GameState | null {
  void game.revision
  return game.run
}

const panel = computed(() => {
  const run = current()
  if (!run) return null
  if (props.order === 'admin') return paperworkLine(run)
  return props.order === 'military' ? hostLine(run) : null
})
const options = computed(() => {
  const run = current()
  return run ? bulkOptions(run, props.order) : []
})
const rows = computed(() => {
  const run = current()
  return run ? unitRows(run, props.order, bulk.value) : []
})
const patent = computed(() => {
  const run = current()
  return run ? patentRow(run, props.order) : null
})

function act(command: Command): void {
  refused.value = !game.act(command).success
  if (!refused.value && command.type === 'UNLOCK_PATENT') broken.value++
}
</script>

<template>
  <OrderFrame :title="copy.title" :intro="copy.intro">
    <template #header>
      <BulkSelector v-model="bulk" :options="options" class="mt-2" />
      <p v-if="refused" data-refusal class="font-body text-base italic text-rubric">
        The Crown refuses this order.
      </p>
    </template>
    <div
      v-if="panel"
      data-panel
      class="mb-1 rounded-lg border-[1.5px] border-gold bg-vellum-shade/70 px-3 py-2"
    >
      <p class="font-body text-[18px] leading-5 text-ink">{{ panel.title }}</p>
      <p class="font-body text-base italic leading-[22px] text-ink-faded">{{ panel.note }}</p>
    </div>
    <GameIcon
      v-if="broken"
      :key="broken"
      name="padlock"
      data-lock-break
      class="motion-lock-break absolute right-6 size-10 text-ink-faded"
      label=""
    />
    <UnitRow v-for="row in rows" :key="row.unitId" :row="row" @buy="act" />
    <PatentRow v-if="patent" :row="patent" @seal="act" />
    <DisbandPanel v-if="order === 'military'" @act="act" />
  </OrderFrame>
</template>
