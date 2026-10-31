<script setup lang="ts">
import type { BulkChoice, BulkOption } from '@/ui/orderRows'

/** The bulk sizes of an order page; a size above the limit of the reign stays closed. */
defineProps<{ options: BulkOption[]; modelValue: BulkChoice }>()
defineEmits<{ 'update:modelValue': [choice: BulkChoice] }>()

const label = (choice: BulkChoice): string =>
  choice === 'max' ? 'As many as I can' : choice === 1 ? 'Buy 1' : String(choice)
</script>

<template>
  <div
    class="flex items-baseline gap-3.5 font-body text-base italic"
    role="group"
    aria-label="Bulk"
  >
    <button
      v-for="option in options"
      :key="option.choice"
      type="button"
      :data-bulk="option.choice"
      :disabled="!option.enabled"
      :aria-pressed="option.choice === modelValue"
      :title="option.note ?? undefined"
      class="min-h-6"
      :class="[
        option.choice === modelValue ? 'text-rubric underline' : 'text-ink-faded',
        option.enabled ? '' : 'opacity-40',
      ]"
      @click="$emit('update:modelValue', option.choice)"
    >
      {{ label(option.choice) }}
    </button>
  </div>
</template>
