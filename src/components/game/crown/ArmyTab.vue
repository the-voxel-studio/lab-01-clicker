<script setup lang="ts">
import { computed } from 'vue'
import GameIcon from '@/components/common/GameIcon.vue'
import type { GameState } from '@/core/types'
import { UNIT_COPY } from '@/data/orderCopy'
import { armyRecap } from '@/ui/crownRecap'
import { formatCompact } from '@/ui/realmText'

/** The force of the realm, who carries it, and what comes next. */
const props = defineProps<{ run: GameState; revision: number }>()
const recap = computed(() => {
  void props.revision
  return armyRecap(props.run)
})
</script>

<template>
  <section data-tab-army class="flex flex-col gap-1.5 font-body text-[18px] leading-6 text-ink">
    <p class="flex justify-between">
      Force in the field <span class="font-display">{{ formatCompact(recap.field) }}</span>
    </p>
    <p class="flex justify-between">
      Strength at home <span class="font-display">{{ formatCompact(recap.home) }}</span>
    </p>
    <p v-for="unit in recap.units" :key="unit.id" class="flex items-center gap-2">
      <GameIcon :name="UNIT_COPY[unit.id].icon" class="size-5 text-ink" />
      {{ unit.name }}
      <span class="ml-auto font-display">{{ formatCompact(unit.count) }}</span>
    </p>
    <p v-if="recap.units.length === 0" class="text-ink-faded">No one in arms.</p>
    <p class="flex justify-between">
      Wars won <span class="font-display">{{ recap.wars }}</span>
    </p>
    <p class="flex justify-between">
      Conquests this audit <span class="font-display">{{ recap.conquests }}, 1 free</span>
    </p>
    <h2 class="font-caps text-rubric">What comes next</h2>
    <p>{{ recap.threat ?? 'No more threats are announced.' }}</p>
  </section>
</template>
