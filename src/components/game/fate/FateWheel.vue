<script setup lang="ts">
/** The wheel of Fortune and its four words (Figma `53:117`); it turns once and stops. */
defineProps<{ rest: 'sum sine regno' | 'regnavi' }>()

const SPOKES = [0, 45, 90, 135]
</script>

<template>
  <div class="relative mx-auto aspect-square h-full max-w-[calc(100%-72px)] p-7">
    <svg viewBox="0 0 220 220" class="fate-wheel size-full text-gold" aria-hidden="true">
      <circle cx="110" cy="110" r="104" fill="none" stroke="currentColor" stroke-width="10" />
      <circle cx="110" cy="110" r="92" fill="none" stroke="currentColor" stroke-width="2" />
      <line
        v-for="angle in SPOKES"
        :key="angle"
        x1="110"
        y1="8"
        x2="110"
        y2="212"
        stroke="currentColor"
        stroke-width="5"
        :transform="`rotate(${angle + 10} 110 110)`"
      />
      <circle cx="110" cy="110" r="18" fill="currentColor" />
    </svg>
    <span class="word top-0 left-1/2 -translate-x-1/2">regnabo</span>
    <span class="word top-1/2 -right-3 -translate-y-1/2 rotate-90">regno</span>
    <span class="word bottom-0 left-1/2 -translate-x-1/2" :class="{ rest: rest === 'regnavi' }">
      regnavi
    </span>
    <span
      class="word top-1/2 -left-9 -translate-y-1/2 -rotate-90"
      :class="{ rest: rest === 'sum sine regno' }"
    >
      sum sine regno
    </span>
  </div>
</template>

<style scoped>
.word {
  position: absolute;
  font-family: var(--font-body);
  font-style: italic;
  font-size: 15px;
  line-height: 22px;
  color: var(--wheel-word, #e8ce96);
  white-space: nowrap;
}
.word.rest {
  font-size: 18px;
}
@media (max-height: 520px) {
  .word:not(.rest) {
    display: none;
  }
}
</style>
