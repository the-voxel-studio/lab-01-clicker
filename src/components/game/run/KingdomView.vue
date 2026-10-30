<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { scopedScene } from '@/data/kingdomScenes'
import type { DreadBand } from '@/ui/dread'
import { phaseOffset } from '@/ui/motion'
import { spreadPhases } from './useAmbientMotion'

/** The kingdom under the HUD, alive in its dread band; it crossfades when the band changes. */
const props = defineProps<{ band: DreadBand; paused: boolean }>()

const PETALS = 6
const PHASE_SEED = 7
const root = ref<HTMLElement | null>(null)

// The scenes are the project's own Figma exports, never user input.
const scene = computed(() =>
  scopedScene(props.band).replace(/width="390" height="268"/, 'width="100%" height="100%"'),
)
const petals = computed(() =>
  props.band === 'enchanted'
    ? Array.from({ length: PETALS }, (_, index) => ({
        index,
        left: `${12 + ((index * 53) % 76)}%`,
        delay: `-${phaseOffset(PHASE_SEED, index + 20)}ms`,
      }))
    : [],
)

async function phase(): Promise<void> {
  await nextTick()
  if (root.value) spreadPhases(root.value, PHASE_SEED)
}
onMounted(phase)
watch(() => props.band, phase)
</script>

<template>
  <div ref="root" :data-band="band" class="relative aspect-[390/268] w-full overflow-hidden">
    <Transition name="crossfade">
      <div :key="band" class="kingdom-scene absolute inset-0" aria-hidden="true" v-html="scene" />
    </Transition>
    <span
      v-for="petal in petals"
      :key="petal.index"
      data-petal
      class="petal pointer-events-none absolute top-[35%] size-1.5 rounded-full bg-rose-bloom"
      :style="{ left: petal.left, animationDelay: petal.delay }"
    />
    <Transition name="fade">
      <div
        v-if="paused"
        class="absolute inset-0 flex items-center justify-center bg-vellum/45 backdrop-blur-[1px]"
      >
        <div class="rounded border border-gold bg-vellum px-5 py-2 text-center shadow">
          <p class="font-display text-xl text-ink">Time stands still</p>
          <p class="font-body text-sm italic text-ink-faded">Tap the pause button to resume</p>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.petal {
  animation: fall 7s linear infinite;
}
</style>
