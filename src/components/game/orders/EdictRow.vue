<script setup lang="ts">
import { computed, onUnmounted, ref } from 'vue'
import type { Command } from '@/core/types'
import type { EdictRow } from '@/ui/crown'

/** One emergency edict and its proclaim button. */
const props = defineProps<{ row: EdictRow; stamped?: boolean }>()
const emit = defineEmits<{ enact: [command: Command] }>()

const ARMED_MS = 4000
const armed = ref(false)
let disarm: ReturnType<typeof setTimeout> | null = null

const label = computed(() => {
  if (props.row.blocked) return props.row.blocked
  if (!props.row.fatal) return props.row.priceLabel
  return armed.value ? 'Press again to fall' : 'This ends your reign'
})

function press(): void {
  const { command, fatal } = props.row
  if (!command) return
  if (fatal && !armed.value) {
    armed.value = true
    disarm = setTimeout(() => (armed.value = false), ARMED_MS)
    return
  }
  emit('enact', command)
}

onUnmounted(() => {
  if (disarm !== null) clearTimeout(disarm)
})
</script>

<template>
  <div :data-edict-row="row.id" class="flex items-center gap-3 border-b border-ink-faded/25 py-2">
    <div class="min-w-0 flex-1">
      <p class="font-body text-[18px] leading-6 text-ink">{{ row.name }}</p>
      <p class="font-body text-base italic leading-[22px] text-ink-faded">{{ row.text }}</p>
      <p class="font-display text-base leading-[22px] text-ink">
        <span v-if="row.gain">{{ row.gain }}, </span>unrest to {{ row.unrestAfter }}
        <span v-if="row.priceLabel !== 'Proclaim'"
          >, {{ row.priceLabel.replace('Pay', 'Costs') }}</span
        >
      </p>
    </div>
    <button
      type="button"
      :data-edict="row.id"
      :disabled="row.command === null"
      class="flex min-h-11 w-[112px] shrink-0 items-center justify-center rounded-lg border-[1.5px] px-1 py-1 font-caps text-base leading-5"
      :class="[
        stamped ? 'motion-stamp' : '',
        row.command
          ? 'border-gold bg-wax text-cream'
          : 'border-ink-faded/60 bg-vellum-shade text-ink-faded',
      ]"
      @click="press"
    >
      {{ label }}
    </button>
  </div>
</template>
