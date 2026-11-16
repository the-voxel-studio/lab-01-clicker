<script setup lang="ts">
import { nextTick, ref } from 'vue'
import { DIFFICULTY_LEVELS, LEVEL_DATA, type DifficultyLevel } from '@/data/levels'
import { useSettingsStore } from '@/stores/settings'

/**
 * The level of the next reign, chosen before the seal: three ledger rows, the checked one in wax.
 * The choice is the remembered level, so the seal begins at it. Arrow keys move round the ends.
 */
const settings = useSettingsStore()
const group = ref<HTMLElement | null>(null)

function choose(level: DifficultyLevel): void {
  settings.lastLevel = level
}

async function step(delta: number): Promise<void> {
  const index = DIFFICULTY_LEVELS.indexOf(settings.lastLevel)
  const count = DIFFICULTY_LEVELS.length
  const next = DIFFICULTY_LEVELS[(index + delta + count) % count]
  if (!next) return
  choose(next)
  await nextTick()
  group.value?.querySelector<HTMLElement>('[aria-checked="true"]')?.focus()
}
</script>

<template>
  <div
    ref="group"
    role="radiogroup"
    aria-label="Level of the reign"
    class="flex flex-col gap-2"
    @keydown.down.prevent="step(1)"
    @keydown.right.prevent="step(1)"
    @keydown.up.prevent="step(-1)"
    @keydown.left.prevent="step(-1)"
  >
    <button
      v-for="level in DIFFICULTY_LEVELS"
      :key="level"
      :data-level="level"
      type="button"
      role="radio"
      :aria-checked="level === settings.lastLevel"
      :tabindex="level === settings.lastLevel ? 0 : -1"
      class="level rounded-lg border-[1.5px] border-gold px-3 py-2 text-left"
      :class="level === settings.lastLevel ? 'bg-wax text-cream' : 'bg-vellum-shade text-ink'"
      @click="choose(level)"
    >
      <span class="level-name block font-caps text-[20px] leading-7">{{
        LEVEL_DATA[level].name
      }}</span>
      <span
        class="block font-body text-base italic leading-[22px]"
        :class="level === settings.lastLevel ? 'text-gold-light' : 'text-ink-faded'"
      >
        {{ LEVEL_DATA[level].description }}
      </span>
    </button>
  </div>
</template>

<style scoped>
/* Landscape: the name stands beside its line, so the seal stays in view under the three rows. */
@media (max-height: 520px) {
  .level {
    display: flex;
    align-items: baseline;
    gap: 12px;
    padding-top: 4px;
    padding-bottom: 4px;
  }
  .level-name {
    flex: 0 0 7.5rem;
  }
}
</style>
