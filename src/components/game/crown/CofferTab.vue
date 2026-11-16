<script setup lang="ts">
import { useGameStore } from '@/stores/game'
import { computed } from 'vue'
import type { GameState } from '@/core/types'
import { cofferRecap } from '@/ui/crownRecap'
import { formatFigure } from '@/ui/realmText'

const game = useGameStore()

/** Where the AP comes from and where it goes, in the gilt bars of the Crown's demands. */
const props = defineProps<{ run: GameState; revision: number }>()
const recap = computed(() => {
  void props.revision
  return cofferRecap(props.run, game.config)
})
const top = computed(() => Math.max(1, ...recap.value.lines.map((line) => Math.abs(line.value))))
const signed = (value: number): string => `${value > 0 ? '+' : ''}${formatFigure(value, 1)} AP/s`
</script>

<template>
  <section data-tab-coffer class="flex flex-col gap-1.5 font-body text-[18px] leading-6 text-ink">
    <div v-for="line in recap.lines" :key="line.label">
      <p class="flex justify-between">
        {{ line.label }} <span class="font-display">{{ signed(line.value) }}</span>
      </p>
      <div class="h-3 rounded-[3px] border border-gold bg-vellum-shade p-px" aria-hidden="true">
        <div
          class="h-full rounded-[1px]"
          :class="line.value < 0 ? 'bg-wax' : 'bg-verdigris'"
          :style="{ width: `${(Math.abs(line.value) / top) * 100}%` }"
        />
      </div>
    </div>
    <p class="flex justify-between border-t border-ink-faded/40 pt-1">
      Net <span class="font-display">{{ signed(recap.net) }}</span>
    </p>
    <p class="flex justify-between">
      Each seal <span class="font-display">+{{ formatFigure(recap.clickValue, 1) }} AP</span>
    </p>
  </section>
</template>
