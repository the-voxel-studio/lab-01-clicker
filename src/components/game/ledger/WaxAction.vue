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
    class="flex min-h-[52px] w-full items-center gap-2 rounded-[10px] border-2 border-gold bg-wax px-2 py-1 text-left text-cream disabled:opacity-70"
    @click="$emit('press')"
  >
    <span
      class="flex size-9 shrink-0 items-center justify-center rounded-full bg-blood text-gold-light"
    >
      <GameIcon :name="icon" class="size-5" />
    </span>
    <span class="min-w-0">
      <span class="block font-display text-[21px] leading-6">{{ label }}</span>
      <span class="block font-body text-base leading-5 text-gold-light">{{ line }}</span>
    </span>
  </button>
</template>
