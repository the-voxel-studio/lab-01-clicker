<script setup lang="ts">
import { computed } from 'vue'
import GameIcon from '@/components/common/GameIcon.vue'
import { figureRow } from '@/ui/gauges'
import { formatCompact } from '@/ui/realmText'
import LedgerFigure from './LedgerFigure.vue'

/** Twenty peasants of the room: ink for the living, verdigris for the projection, pale for room. */
const props = defineProps<{ living: number; crown: number; room: number; projected?: number }>()

const row = computed(() => figureRow(props.living, props.projected ?? props.living, props.room))
const figures = computed(() => [
  ...Array.from({ length: row.value.ink }, () => 'living'),
  ...Array.from({ length: row.value.projection }, () => 'projected'),
  ...Array.from({ length: row.value.pale }, () => 'pale'),
])
const COLOURS: Record<string, string> = {
  living: 'text-ink',
  projected: 'text-verdigris',
  pale: 'text-ink/35',
}
const pinAt = computed(() => {
  const top = Math.max(props.room, props.living, 1)
  return `${Math.min(100, (props.crown / top) * 100)}%`
})
const overBy = computed(() => formatCompact(Math.ceil(props.living - props.room)))
</script>

<template>
  <div>
    <div class="relative pt-7">
      <span
        data-crown-pin
        class="absolute top-0 flex -translate-x-1/2 flex-col items-center"
        :style="{ left: pinAt }"
        aria-hidden="true"
      >
        <span class="flex size-5 items-center justify-center rounded-full bg-wax text-cream">
          <GameIcon name="crown" class="size-3.5" />
        </span>
        <span class="h-4 w-0.5 bg-rubric" />
      </span>
      <div class="flex" role="img" :aria-label="`${living} living, room for ${room}`">
        <span
          v-for="(kind, index) in figures"
          :key="index"
          :data-person="kind"
          class="flex min-w-0 flex-1 justify-center"
          :class="COLOURS[kind]"
        >
          <GameIcon name="peasant" class="size-[18px]" />
        </span>
      </div>
    </div>
    <div class="mt-1 flex justify-between text-center font-body text-base leading-5">
      <span><LedgerFigure :value="formatCompact(living)" size="lg" /><br />living</span>
      <span>
        <LedgerFigure :value="formatCompact(crown)" size="lg" tone="rubric" /><br />Crown
      </span>
      <span><LedgerFigure :value="formatCompact(room)" size="lg" /><br />room</span>
    </div>
    <p v-if="projected !== undefined" data-projection class="font-body text-base text-verdigris">
      {{ formatCompact(projected) }} at the audit
    </p>
    <p v-if="row.over" data-overcrowded class="font-body text-base text-rubric">
      {{ overBy }} over the room
    </p>
  </div>
</template>
