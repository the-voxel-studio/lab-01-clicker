<script setup lang="ts">
import { computed } from 'vue'
import GameIcon from '@/components/common/GameIcon.vue'
import type { BiomeId } from '@/core/types'
import { BIOMES_DATA } from '@/data/biomes'
import { BIOME_MARK } from '@/ui/gauges'
import { formatCompact } from '@/ui/realmText'
import LedgerFigure from './LedgerFigure.vue'

/** A province as a heraldic shield: its tincture, the room it holds and what it really does. */
const props = defineProps<{ biome: BiomeId; room: number; note: string }>()

const mark = computed(() => BIOME_MARK[props.biome])
const name = computed(() => BIOMES_DATA[props.biome].name)
</script>

<template>
  <div class="flex min-w-0 flex-1 flex-col items-center text-center font-body text-base leading-5">
    <div class="shield p-[3px]">
      <div
        class="shield flex h-[70px] w-[60px] items-center justify-center pb-3 text-cream"
        :style="{ background: mark.tincture }"
      >
        <GameIcon :name="mark.icon" class="size-8" />
      </div>
    </div>
    <LedgerFigure :value="formatCompact(room)" size="lg" class="mt-1" />
    <span class="text-ink">{{ name }}</span>
    <span class="text-ink-faded">{{ note }}</span>
  </div>
</template>

<style scoped>
.shield {
  background-color: var(--color-gold);
  clip-path: polygon(0 0, 100% 0, 100% 62%, 50% 100%, 0 62%);
}
</style>
