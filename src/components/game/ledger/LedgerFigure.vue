<script setup lang="ts">
import StableFigure from './StableFigure.vue'

/** A figure that matters, in Great Primer: IM Fell's old style digits read small in the body face. */
withDefaults(
  defineProps<{
    value: string
    size?: 'lg' | 'md'
    tone?: 'ink' | 'rubric' | 'good'
  }>(),
  { size: 'md', tone: 'ink' },
)

const TONES = { ink: 'text-ink', rubric: 'text-rubric', good: 'text-verdigris' }
</script>

<template>
  <StableFigure
    :value="value"
    class="font-display leading-none"
    :class="[size === 'lg' ? 'text-[25px]' : 'text-[21px]', TONES[tone]]"
  />
</template>
