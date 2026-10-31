<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import GameIcon from '@/components/common/GameIcon.vue'
import { useGameStore } from '@/stores/game'

/** The result of a fight, opened by itself or from the chronicle; time waits while it is read. */
const game = useGameStore()
const closeButton = ref<HTMLButtonElement | null>(null)

watch(
  () => game.report,
  async (report) => {
    if (!report) return
    await nextTick()
    closeButton.value?.focus({ preventScroll: true })
  },
)
</script>

<template>
  <Transition name="fade">
    <div
      v-if="game.report"
      class="absolute inset-0 z-40 flex items-center justify-center bg-bar/70 px-4 py-4"
      @keydown.esc="game.closeReport()"
    >
      <article
        data-battle-report
        role="dialog"
        aria-modal="true"
        aria-labelledby="report-title"
        class="flex max-h-full w-full flex-col overflow-y-auto rounded bg-vellum px-5 py-4 drop-shadow-[0_14px_15px_rgb(0_0_0/0.5)]"
      >
        <div class="flex items-start gap-3">
          <span
            class="flex size-11 shrink-0 items-center justify-center rounded-full text-cream"
            :class="game.report.won ? 'bg-verdigris' : 'bg-wax'"
          >
            <GameIcon :name="game.report.won ? 'waxSeal' : 'skull'" class="size-6" />
          </span>
          <header>
            <p class="font-caps text-base leading-5 text-rubric">{{ game.report.eyebrow }}</p>
            <h2 id="report-title" class="font-display text-[25px] leading-[30px] text-ink">
              {{ game.report.title }}
            </h2>
          </header>
        </div>
        <ul class="mt-3 flex flex-col">
          <li
            v-for="line in game.report.lines"
            :key="line.label"
            class="flex items-baseline justify-between gap-3 border-b border-ink-faded/30 py-1"
          >
            <span class="font-body text-[18px] text-ink">{{ line.label }}</span>
            <span class="font-display text-[21px] text-ink">{{ line.figure }}</span>
          </li>
        </ul>
        <button
          ref="closeButton"
          type="button"
          data-report-close
          class="mt-4 min-h-12 rounded-lg border-2 border-gold bg-wax font-display text-[21px] text-cream"
          @click="game.closeReport()"
        >
          Fold the missive
        </button>
      </article>
    </div>
  </Transition>
</template>
