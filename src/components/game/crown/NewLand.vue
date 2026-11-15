<script setup lang="ts">
import GameIcon from '@/components/common/GameIcon.vue'
import type { Command } from '@/core/types'
import type { ColoniseView } from '@/ui/crown'
import { formatCompact } from '@/ui/realmText'

/** The price of an empty province and the order that settles it. `raised` counts the towers built. */
defineProps<{ colonise: ColoniseView; raised: number }>()
const emit = defineEmits<{ act: [command: Command] }>()
</script>

<template>
  <section data-new-land class="flex items-center gap-3">
    <div class="relative min-w-0 flex-1">
      <GameIcon
        v-if="raised"
        :key="raised"
        name="stoneTower"
        data-raised
        class="motion-raise absolute right-1 top-0 size-7 text-ink"
        label=""
      />
      <h2 class="font-caps text-base text-rubric">New land</h2>
      <p class="font-body text-base italic leading-[22px] text-ink-faded">
        Colonise an empty province: {{ colonise.gain }} for your people.
      </p>
    </div>
    <button
      type="button"
      data-colonise
      :disabled="colonise.command === null"
      class="flex min-h-12 w-[112px] shrink-0 flex-col items-center justify-center rounded-lg border-[1.5px] py-1"
      :class="
        colonise.command
          ? 'border-gold bg-wax text-cream'
          : 'border-ink-faded bg-vellum-shade text-ink-faded'
      "
      @click="colonise.command && emit('act', colonise.command)"
    >
      <span class="font-caps text-[18px] leading-5">{{ colonise.blocked ?? 'Colonise' }}</span>
      <span class="font-body text-base italic leading-[22px]">
        {{ formatCompact(colonise.cost) }} AP
      </span>
    </button>
  </section>
</template>
