<script setup lang="ts">
import { onMounted, onUnmounted, onUpdated, ref } from 'vue'
import { LEAF_GAP, leafAt, leafCount } from '@/ui/leaves'

/**
 * A list that does not scroll: what does not fit runs onto further leaves, turned from the foot.
 * Each child is one block, marked `break-inside-avoid` by its owner, and is never cut between two
 * leaves: on a sheet too short to hold its tallest block, the list scrolls instead.
 */
const sheet = ref<HTMLElement | null>(null)
const leaf = ref(0)
const count = ref(1)
const scrolls = ref(false)
let watcher: ResizeObserver | null = null

/** Height the foot takes from a leaf: its row, its padding and its rule. */
const FOOT_PX = 41

function blocks(node: HTMLElement): HTMLElement[] {
  return [...node.children].filter((child): child is HTMLElement => child instanceof HTMLElement)
}

/** A block the browser had to cut answers with one box per leaf it runs over. */
function isCut(block: HTMLElement): boolean {
  return block.getClientRects().length > 1
}

/** Whether every block would stand whole on a leaf that gives up the height of the foot. */
function holdsEveryBlock(node: HTMLElement): boolean {
  return blocks(node).every((block) => block.offsetHeight <= node.clientHeight - FOOT_PX)
}

/** Width of one leaf, to the fraction of a pixel when the browser gives it. */
function leafWidth(): number {
  const node = sheet.value
  if (!node) return 0
  return node.getBoundingClientRect().width || node.clientWidth
}

function show(index: number): void {
  const node = sheet.value
  if (!node) return
  leaf.value = Math.min(Math.max(index, 0), count.value - 1)
  node.scrollLeft = leaf.value * (leafWidth() + LEAF_GAP)
}

/**
 * Reads the sheet again after a resize or a change of content: scrolls when a block is cut, turns
 * leaves again once every block fits, and stays on a leaf that still exists.
 */
function measure(): void {
  const node = sheet.value
  if (!node) return
  if (scrolls.value) {
    // The columns come back with the next render, which measures again.
    if (holdsEveryBlock(node)) scrolls.value = false
    return
  }
  if (blocks(node).some(isCut)) {
    scrolls.value = true
    count.value = 1
    leaf.value = 0
    node.scrollLeft = 0
    return
  }
  count.value = leafCount(node.scrollWidth, node.clientWidth)
  show(leaf.value)
}

/** The browser scrolls the sheet by itself when the focus lands on another leaf. */
function follow(): void {
  const node = sheet.value
  if (node) leaf.value = Math.min(leafAt(node.scrollLeft, node.clientWidth), count.value - 1)
}

onMounted(() => {
  measure()
  if (typeof ResizeObserver === 'undefined' || !sheet.value) return
  watcher = new ResizeObserver(measure)
  watcher.observe(sheet.value)
})
onUpdated(measure)
onUnmounted(() => watcher?.disconnect())
</script>

<template>
  <div class="flex h-full min-h-0 flex-col">
    <div
      ref="sheet"
      data-leaves
      :data-leaves-mode="scrolls ? 'scroll' : 'leaves'"
      class="min-h-0 flex-1"
      :class="scrolls ? 'overflow-y-auto' : 'leaves'"
      :style="{ columnGap: `${LEAF_GAP}px` }"
      @scroll="follow"
    >
      <slot />
    </div>
    <div
      v-if="count > 1"
      data-leaf-foot
      class="flex shrink-0 items-center justify-between border-t border-ink-faded/40 pt-1 font-caps text-[18px] leading-6"
    >
      <button
        type="button"
        data-leaf-back
        :disabled="leaf === 0"
        class="min-h-9 text-left text-rubric disabled:text-ink-faded/50"
        @click="show(leaf - 1)"
      >
        Back
      </button>
      <p data-leaf-count class="text-ink" aria-live="polite">Leaf {{ leaf + 1 }} of {{ count }}</p>
      <button
        type="button"
        data-leaf-next
        :disabled="leaf === count - 1"
        class="min-h-9 text-right text-rubric disabled:text-ink-faded/50"
        @click="show(leaf + 1)"
      >
        Next leaf
      </button>
    </div>
  </div>
</template>

<style scoped>
.leaves {
  column-count: 1;
  column-fill: auto;
  overflow: hidden;
}
</style>
