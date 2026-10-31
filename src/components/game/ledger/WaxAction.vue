<script setup lang="ts">
import GameIcon from '@/components/common/GameIcon.vue'
import type { GameIconKey } from '@/data/icons'

/** The wax button with its gold border, seal and small line, as in `Begin reign`. */
defineProps<{ label: string; line: string; icon: GameIconKey; disabled?: boolean }>()
defineEmits<{ press: [] }>()
</script>

<template>
  <button
    type="button"
    :disabled="disabled"
    class="flex min-h-[62px] w-full items-center gap-3 rounded-[10px] border-2 border-gold bg-wax px-3 py-1.5 text-left text-cream disabled:opacity-70"
    @click="$emit('press')"
  >
    <span
      class="flex size-11 shrink-0 items-center justify-center rounded-full bg-blood text-gold-light"
    >
      <GameIcon :name="icon" class="size-6" />
    </span>
    <span class="min-w-0">
      <span class="block font-display text-[21px] leading-6">{{ label }}</span>
      <span class="block font-body text-base leading-5 text-gold-light">{{ line }}</span>
    </span>
  </button>
</template>
