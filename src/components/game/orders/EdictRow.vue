<script setup lang="ts">
import type { Command } from '@/core/types'
import type { EdictRow } from '@/ui/crown'

/** One emergency edict and its proclaim button. */
defineProps<{ row: EdictRow; stamped?: boolean }>()
defineEmits<{ enact: [command: Command] }>()
</script>

<template>
  <div class="flex items-center gap-3 border-b border-ink-faded/25 py-2">
    <div class="min-w-0 flex-1">
      <p class="font-body text-[17px] leading-6 text-ink">{{ row.name }}</p>
      <p class="font-body text-[13px] italic leading-[18px] text-ink-faded">{{ row.text }}</p>
    </div>
    <button
      type="button"
      :data-edict="row.id"
      :disabled="row.command === null"
      class="flex min-h-11 w-[112px] shrink-0 items-center justify-center rounded-lg border-[1.5px] px-1 font-caps text-[13px] leading-4"
      :class="[
        stamped ? 'motion-stamp' : '',
        row.command
          ? 'border-gold bg-wax text-cream'
          : 'border-ink-faded/60 bg-vellum-shade text-ink-faded',
      ]"
      @click="row.command && $emit('enact', row.command)"
    >
      {{ row.blocked ?? row.priceLabel }}
    </button>
  </div>
</template>
