<script setup lang="ts">
import { computed } from 'vue'
import type { TargetView } from '@/ui/fortune'
import { formatCompact } from '@/ui/realmText'

/** The target of the expedition, as the scouts guess it (Figma `53:1914`). */
const props = defineProps<{ target: TargetView }>()

/** The scale ends past both the guess and the army, so neither mark sits on the edge. */
const top = computed(() => Math.max(props.target.guessMax, props.target.reach) * 1.25 || 1)
const percent = (value: number): string => `${(value / top.value) * 100}%`
</script>

<template>
  <article class="rounded-lg border-[1.5px] border-gold bg-vellum-shade/70 p-3.5">
    <p class="font-caps text-sm text-rubric">Next target</p>
    <h2 class="font-display text-2xl leading-[30px] text-ink">{{ target.biome }}</h2>
    <p class="font-body text-[13px] italic leading-[18px] text-ink-faded">
      Held by {{ target.faction }}. Campaigns left: {{ target.campaignsLeft }}.
    </p>
    <p
      v-for="warning in target.warnings"
      :key="warning"
      class="font-body text-sm italic text-rubric"
    >
      {{ warning }}
    </p>
    <p class="mt-2 font-body text-[15px] leading-6 text-ink">
      Their force, as your scouts guess it
    </p>
    <div class="relative mt-1.5 h-3 rounded-md border border-ink-faded/50 bg-vellum">
      <div
        :key="target.guessMin"
        data-guess
        class="motion-pop absolute inset-y-0 rounded-md bg-rubric/55"
        :style="{
          left: percent(target.guessMin),
          width: percent(target.guessMax - target.guessMin),
        }"
      />
      <div
        class="absolute -top-1.5 h-6 w-[3px] bg-verdigris"
        :style="{ left: percent(target.reach) }"
      />
    </div>
    <p class="mt-2.5 flex justify-between font-body text-[13px] italic">
      <span class="text-verdigris">your reach, {{ formatCompact(target.reach) }}</span>
      <span class="text-rubric">
        {{ formatCompact(target.guessMin) }} to {{ formatCompact(target.guessMax, 0, 'up') }}
      </span>
    </p>
    <p class="mt-2 font-body text-[13px] italic leading-[18px] text-ink-faded">
      Win and you take the land and its loot. Lose and you lose men, and unrest rises.
    </p>
  </article>
</template>
