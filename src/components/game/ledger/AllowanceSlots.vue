<script setup lang="ts">
import { computed } from 'vue'
import GameIcon from '@/components/common/GameIcon.vue'

/** The conquests of an audit: one free, then the surcharge the next two would reach in all. */
const props = defineProps<{ used: number; step: number }>()

const slots = computed(() =>
  [1, 2, 3].map((place) => ({
    place,
    state: place <= props.used ? 'used' : place === props.used + 1 ? 'next' : 'open',
    words: place === 1 ? '1 free' : `+${Math.round((place - 1) * props.step * 100)}%`,
  })),
)
const STATE_WORDS: Record<string, string> = { used: 'taken', next: 'next', open: 'after' }
const CLASSES: Record<string, string> = {
  used: 'border-solid border-verdigris text-verdigris',
  next: 'border-solid border-rubric bg-wax/10 text-rubric',
  open: 'border-dashed border-ink/40 text-ink',
}
</script>

<template>
  <div class="grid grid-cols-3 gap-1.5">
    <div
      v-for="slot in slots"
      :key="slot.place"
      :data-slot="slot.state"
      class="flex flex-col items-center rounded-md border-2 px-0.5 py-1 font-display text-[21px] leading-6"
      :class="CLASSES[slot.state]"
    >
      <GameIcon name="stoneTower" class="size-6" />
      {{ slot.words }}
      <span class="font-body text-base leading-5">{{ STATE_WORDS[slot.state] }}</span>
    </div>
  </div>
</template>
