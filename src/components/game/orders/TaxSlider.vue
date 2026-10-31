<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import type { GameState } from '@/core/types'
import { TAX_SETTLE_MS, taxEffect, taxView, taxWarning } from '@/ui/crown'

/** The tax rate: moving it only previews; the settled rate is proclaimed, once. */
const props = defineProps<{ run: GameState; revision: number; held: number | null }>()
const emit = defineEmits<{ proclaim: [rate: number]; draft: [rate: number] }>()

const view = computed(() => {
  void props.revision
  return taxView(props.run)
})
const decided = computed(() => props.held ?? view.value.pending ?? view.value.rate)
const draft = ref(decided.value)
const warning = computed(() => {
  void props.revision
  return taxWarning(props.run, draft.value)
})

/** Steps a copy of the realm, so it follows the draft and not every frame. */
const effect = ref(taxEffect(props.run, draft.value))
watch(draft, (rate) => {
  effect.value = taxEffect(props.run, rate)
  emit('draft', rate)
})

const fuse = computed(() => view.value.secondsLeft / view.value.delay)
let settle: ReturnType<typeof setTimeout> | null = null

function flush(): void {
  if (settle === null) return
  clearTimeout(settle)
  settle = null
  if (draft.value !== decided.value) emit('proclaim', draft.value)
}

function settleLater(): void {
  if (settle !== null) clearTimeout(settle)
  settle = setTimeout(flush, TAX_SETTLE_MS)
}

watch(decided, (rate) => {
  if (settle === null) draft.value = rate
})
onBeforeUnmount(flush)
</script>

<template>
  <section>
    <div class="flex items-baseline justify-between">
      <h2 class="font-caps text-base text-rubric">Tax rate</h2>
      <p class="font-display text-[22px] leading-[30px] text-ink">{{ draft }}%</p>
    </div>
    <input
      v-model.number="draft"
      data-tax
      type="range"
      min="0"
      :max="view.max"
      step="1"
      aria-label="Tax rate"
      class="tax-slider w-full"
      :style="{ '--fill': `${(draft / view.max) * 100}%` }"
      @change="settleLater"
    />
    <div class="flex justify-between font-body text-base italic text-ink-faded">
      <span>0%</span><span>{{ view.max / 2 }}%</span><span>{{ view.max }}%</span>
    </div>
    <p data-tax-effect class="font-display text-base leading-[22px] text-ink">{{ effect }}</p>
    <p
      v-if="held !== null"
      data-tax-held
      class="font-body text-base italic leading-[22px] text-rubric"
    >
      {{ held }}% takes effect when time runs again.
    </p>
    <p
      v-else-if="view.pending !== null"
      data-proclaim
      class="motion-ink font-body text-base italic leading-[22px] text-rubric"
    >
      {{ view.pending }}% proclaimed in {{ view.secondsLeft }} seconds.
    </p>
    <div
      v-if="held === null && view.pending !== null"
      class="h-3 rounded-[3px] border border-gold bg-vellum-shade p-px"
    >
      <div
        data-proclaim-fuse
        class="h-full origin-left rounded-[1px] bg-wax transition-transform duration-300 ease-linear"
        :style="{ transform: `scaleX(${fuse})` }"
      />
    </div>
    <p
      v-if="held === null && view.pending === null"
      class="font-body text-base italic leading-[22px] text-ink-faded"
    >
      A rise is proclaimed after {{ view.delay }} seconds, a cut at once.
    </p>
    <p
      v-if="warning"
      data-tax-warning
      class="font-body text-base italic leading-[22px] text-rubric"
    >
      {{ warning }}
    </p>
  </section>
</template>

<style scoped>
.tax-slider {
  appearance: none;
  height: 26px;
  background: transparent;
}
.tax-slider::-webkit-slider-runnable-track {
  height: 10px;
  box-sizing: border-box;
  border: 1px solid var(--color-gold);
  border-radius: 3px;
  background: linear-gradient(
    to right,
    var(--color-wax) var(--fill),
    var(--color-vellum-shade) var(--fill)
  );
}
.tax-slider::-moz-range-track {
  height: 10px;
  box-sizing: border-box;
  border: 1px solid var(--color-gold);
  border-radius: 3px;
  background: linear-gradient(
    to right,
    var(--color-wax) var(--fill),
    var(--color-vellum-shade) var(--fill)
  );
}
.tax-slider::-webkit-slider-thumb {
  appearance: none;
  width: 26px;
  height: 26px;
  margin-top: -9px;
  border: 2px solid var(--color-gold);
  border-radius: 50%;
  background: var(--color-wax);
}
.tax-slider::-moz-range-thumb {
  width: 22px;
  height: 22px;
  border: 2px solid var(--color-gold);
  border-radius: 50%;
  background: var(--color-wax);
}
</style>
