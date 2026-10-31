<script setup lang="ts">
import { computed } from 'vue'
import king from '@assets/engravings/THE_KING.webp'
import { useGameStore } from '@/stores/game'
import type { FateView } from '@/ui/fate'
import { quotaLines } from '@/ui/moments'
import { auditOrdinal, formatCompact } from '@/ui/realmText'
import FatePlate from './FatePlate.vue'
import FateText from './FateText.vue'

/** The ledger struck through with two rubric strokes, then `vacat` (Figma `53:4`). */
defineProps<{ view: FateView; reign: number }>()
const game = useGameStore()

const ledger = computed(() => {
  void game.revision
  const state = game.run
  const outcome = state?.lastAuditOutcome
  const lines =
    state && outcome
      ? quotaLines(state, outcome).map(
          (line) => `${line.label}, ${line.figure}, ${line.met ? 'met' : 'short'}`,
        )
      : []
  return {
    title: `${auditOrdinal(game.auditAhead)} audit`,
    coffer: `${formatCompact(game.coffer)} AP`,
    lines,
  }
})
</script>

<template>
  <div data-scene="quota_failure" class="flex h-full flex-col gap-3 bg-[#ceb486] pt-6 pb-2">
    <div class="ledger relative shrink-0 px-14">
      <p class="font-display text-[26px] leading-[30px] text-[#1e120a]">The {{ ledger.title }}</p>
      <p class="ledger-more mt-2 font-caps text-base leading-5 text-[#96180e]">In the coffer</p>
      <p class="ledger-more font-display text-[22px] italic leading-7 text-[#1e120a]">
        {{ ledger.coffer }}
      </p>
      <p class="mt-2 font-caps text-base leading-5 text-[#96180e]">What the Crown demands</p>
      <p
        v-for="line in ledger.lines"
        :key="line"
        class="font-body text-[18px] leading-6 text-[#1e120a]"
      >
        {{ line }}
      </p>
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        class="pointer-events-none absolute -inset-x-1 -inset-y-2 size-[calc(100%+1rem)] text-[#96180e]"
        aria-hidden="true"
      >
        <line class="fate-stroke" x1="2" y1="2" x2="98" y2="98" />
        <line class="fate-stroke fate-stroke-late" x1="98" y1="2" x2="2" y2="98" />
      </svg>
      <span
        class="fate-vacat absolute right-10 -bottom-7 rotate-[8deg] font-display text-[54px] italic leading-[42px] text-[#96180e]"
      >
        vacat
      </span>
    </div>
    <div class="mt-5 min-h-0 flex-1 px-12">
      <FatePlate :src="king" />
    </div>
    <FateText class="shrink-0" :view="view" :reign="reign" />
  </div>
</template>

<style scoped>
@media (max-height: 700px) {
  .ledger-more {
    display: none;
  }
}
</style>
