<script setup lang="ts">
/** A woodcut of the Dance of Death, ink on transparent; on a dark page the ink turns to bone. */
defineProps<{ src: string; dark?: boolean }>()
</script>

<template>
  <img
    :src="src"
    alt=""
    class="fate-plate mx-auto block h-full min-h-0 max-w-full object-contain"
    :class="dark ? 'fate-plate-dark' : ''"
  />
</template>

<style scoped>
.fate-plate-dark {
  filter: invert(1) sepia(0.4);
}
/* A landscape phone keeps the words and the button. */
@media (max-height: 520px) {
  .fate-plate {
    display: none;
  }
}
</style>
