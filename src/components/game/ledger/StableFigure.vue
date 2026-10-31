<script setup lang="ts">
import { computed } from 'vue'

/**
 * A figure whose digits never move their neighbours: IM Fell has no tabular digits, so
 * `tabular-nums` does nothing and each digit gets a cell of its own.
 */
const props = defineProps<{ value: string }>()

const parts = computed(() => [...props.value].map((char) => ({ char, digit: /\d/.test(char) })))
</script>

<template>
  <span class="tabular-nums"
    ><span v-for="(part, index) in parts" :key="index" :class="part.digit ? 'digit-cell' : ''">{{
      part.char
    }}</span></span
  >
</template>

<style scoped>
.digit-cell {
  display: inline-block;
  width: 0.58em;
  text-align: center;
}
</style>
