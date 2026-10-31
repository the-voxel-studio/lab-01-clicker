<script setup lang="ts">
import GameIcon from '@/components/common/GameIcon.vue'
import type { Command } from '@/core/types'
import type { PatentRow } from '@/ui/orderRows'
import { formatCompact } from '@/ui/realmText'

/** The padlock row of an order until its Tier II patent is sealed. */
defineProps<{ row: PatentRow }>()
defineEmits<{ seal: [command: Command] }>()
</script>

<template>
  <div class="flex items-center gap-3 py-3">
    <span
      class="flex size-11 shrink-0 items-center justify-center rounded-full border border-dashed border-gold bg-vellum-shade"
    >
      <GameIcon name="padlock" class="size-[22px] text-ink-faded" label="Locked" />
    </span>
    <div class="min-w-0 flex-1">
      <p class="font-body text-[18px] leading-6 text-ink">Unlocks {{ row.unlocks }}</p>
      <p class="font-body text-base italic leading-[22px] text-ink-faded">
        {{ row.unmet.length ? row.unmet.join('. ') + '.' : 'Ready to seal.' }}
      </p>
    </div>
    <button
      type="button"
      data-patent
      :disabled="row.command === null"
      class="flex h-11 w-[104px] shrink-0 flex-col items-center justify-center rounded border"
      :class="
        row.command
          ? 'border-gold bg-wax text-cream'
          : 'border-ink-faded/60 bg-vellum-shade text-ink-faded'
      "
      @click="row.command && $emit('seal', row.command)"
    >
      <span class="font-caps text-base leading-4">Seal patent</span>
      <span class="font-body text-base italic leading-4"> {{ formatCompact(row.cost) }} AP </span>
    </button>
  </div>
</template>
