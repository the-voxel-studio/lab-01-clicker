<script setup lang="ts">
import { computed } from 'vue'
import { KINGDOM_SCENES } from '@/data/kingdomScenes'
import type { DreadBand } from '@/ui/dread'

/** The kingdom under the HUD, drawn for the current dread band; veiled while time is paused. */
const props = defineProps<{ band: DreadBand; paused: boolean }>()

// The scenes are the project's own Figma exports, never user input.
const scene = computed(() =>
  KINGDOM_SCENES[props.band].replace(/width="390" height="268"/, 'width="100%" height="100%"'),
)
</script>

<template>
  <div :data-band="band" class="relative aspect-[390/268] w-full overflow-hidden">
    <div class="absolute inset-0" aria-hidden="true" v-html="scene" />
    <div
      v-if="paused"
      class="absolute inset-0 flex items-center justify-center bg-vellum/45 backdrop-blur-[1px]"
    >
      <div class="rounded border border-gold bg-vellum px-5 py-2 text-center shadow">
        <p class="font-display text-xl text-ink">Time stands still</p>
        <p class="font-body text-sm italic text-ink-faded">Tap the pause button to resume</p>
      </div>
    </div>
  </div>
</template>
