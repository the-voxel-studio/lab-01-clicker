<script setup lang="ts">
import GameIcon from '@/components/common/GameIcon.vue'
import LedgerFigure from './LedgerFigure.vue'

/** The chance of taking a province out of ten, as ten swords and in words. */
defineProps<{ chance: number }>()
</script>

<template>
  <div>
    <p class="flex items-baseline justify-between font-body text-[18px] text-ink">
      Your chance
      <LedgerFigure :value="`${chance} in 10`" size="lg" />
    </p>
    <div class="mt-1 flex justify-between">
      <span
        v-for="index in 10"
        :key="index"
        :data-sword="index <= chance ? 'won' : 'lost'"
        :class="index <= chance ? 'text-verdigris' : 'text-ink/25'"
      >
        <GameIcon name="roleSoldier" class="size-6" />
      </span>
    </div>
  </div>
</template>
