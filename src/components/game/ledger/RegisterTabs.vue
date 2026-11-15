<script setup lang="ts" generic="T extends string">
import { nextTick, ref } from 'vue'

/**
 * The thumb tabs of a register: gilt framed buttons standing on a gilt rule, the open one in wax.
 * `attr` names the data attribute that carries the id of each tab, `fill` shares the width between
 * the tabs, and a `mark` sits on the corner of its tab. Arrow keys move round the ends.
 */
const props = defineProps<{
  tabs: readonly { id: T; label: string; mark?: string }[]
  selected: T
  label: string
  attr: string
  fill?: boolean
}>()
const emit = defineEmits<{ select: [id: T] }>()
const bar = ref<HTMLElement | null>(null)

async function step(delta: number): Promise<void> {
  const index = props.tabs.findIndex((tab) => tab.id === props.selected)
  const next = props.tabs[(index + delta + props.tabs.length) % props.tabs.length]
  if (!next) return
  emit('select', next.id)
  await nextTick()
  bar.value?.querySelector<HTMLElement>('[aria-selected="true"]')?.focus()
}
</script>

<template>
  <div
    ref="bar"
    role="tablist"
    :aria-label="label"
    class="gap-1 border-b-2 border-gold"
    :class="fill ? 'grid' : 'flex'"
    :style="fill ? { gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` } : undefined"
    @keydown.left.prevent="step(-1)"
    @keydown.right.prevent="step(1)"
  >
    <button
      v-for="tab in tabs"
      :key="tab.id"
      v-bind="{ [attr]: tab.id }"
      type="button"
      role="tab"
      :aria-selected="tab.id === selected"
      :tabindex="tab.id === selected ? 0 : -1"
      class="register-tab relative h-[38px] rounded-t-lg border-[1.5px] border-b-0 border-gold font-caps text-[18px] max-[360px]:text-base"
      :class="[
        tab.id === selected ? 'bg-wax text-cream' : 'bg-vellum-shade text-ink',
        fill ? '' : 'px-4',
      ]"
      @click="emit('select', tab.id)"
    >
      {{ tab.label }}
      <span
        v-if="tab.mark"
        data-tab-mark
        class="motion-pop absolute -right-1.5 -top-2.5 min-w-5 rounded-full border border-cream bg-wax px-1 text-center font-body text-base leading-5 text-cream"
        >{{ tab.mark }}</span
      >
    </button>
  </div>
</template>

<style scoped>
/* Landscape keeps the height of a line of text for the tabs: every pixel goes to the page. */
@media (max-height: 520px) {
  .register-tab {
    height: 26px;
  }
}
</style>
