<script setup lang="ts">
import { computed } from 'vue'
import { useMotionAllowed } from '@/components/game/run/useAmbientMotion'
import { FATE } from '@/data/fateCopy'
import { useArchivesStore } from '@/stores/archives'
import { useGameStore } from '@/stores/game'
import { useNavStore } from '@/stores/nav'
import { auditsPassed, closestLockedFeat } from '@/ui/register'
import RegisterEnding from './end/RegisterEnding.vue'
import RegisterFeats from './end/RegisterFeats.vue'
import RegisterFigures from './end/RegisterFigures.vue'

/** The register of the reign (Figma `53:356`): the body scrolls, the way on stays in view. */
const archives = useArchivesStore()
const game = useGameStore()
const nav = useNavStore()
const motionOn = useMotionAllowed()

const register = computed(() => {
  const last = game.lastConclusion
  const outcome = last?.record.outcome ?? 'abandoned'
  const state = game.run
  return {
    reign: archives.history.length,
    won: outcome === 'victory',
    epitaph: FATE[outcome].epitaph,
    audits: state ? auditsPassed(state) : 0,
    apSealed: last?.record.totalCumulativeAp ?? 0,
    points: last?.conclusion.pointsEarned ?? 0,
    entries: last?.finalEntries ?? [],
    earned: last?.conclusion.newFeats ?? [],
    closest: state ? closestLockedFeat(archives.archive, archives.history, state) : null,
    held: archives.archive.points,
  }
})

function beginNewReign(): void {
  game.begin()
  nav.go('run')
}

function restartSameSeed(): void {
  game.restart()
  nav.go('run')
}
</script>

<template>
  <section
    data-register
    :data-motion="motionOn ? 'on' : 'off'"
    class="flex min-h-0 flex-1 flex-col overflow-hidden border-t-[6px] border-rubric"
  >
    <div
      data-register-body
      class="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-5 pt-4 pb-3"
    >
      <header>
        <h2 class="font-display text-[34px] leading-[42px] text-ink">
          Reign {{ register.reign }} is {{ register.won ? 'won' : 'over' }}
        </h2>
        <p v-if="register.epitaph" class="font-body text-base italic leading-[22px] text-ink-faded">
          {{ register.epitaph }}
        </p>
      </header>
      <RegisterFigures
        :audits="register.audits"
        :ap-sealed="register.apSealed"
        :points="register.points"
      />
      <RegisterEnding :entries="register.entries" />
      <RegisterFeats :earned="register.earned" :closest="register.closest" />
      <p class="rounded-lg border border-gold bg-gold/15 px-3 py-2 font-body text-[15px] text-ink">
        You hold {{ register.held }} archive {{ register.held === 1 ? 'point' : 'points' }}.
      </p>
    </div>
    <footer
      class="flex shrink-0 flex-col items-center gap-1 border-t border-ink-faded/30 px-5 py-2"
    >
      <button
        type="button"
        class="min-h-14 w-full rounded-[10px] border-2 border-gold bg-wax px-4 py-1 text-left shadow-[0_4px_0_0_rgb(77_13_5/0.4)]"
        @click="beginNewReign"
      >
        <span class="block font-display text-[22px] leading-7 text-cream">
          Begin reign {{ register.reign + 1 }}
        </span>
        <span class="block font-body text-[13px] italic leading-[18px] text-gold-light">
          A new seed, the same Crown
        </span>
      </button>
      <div class="flex flex-wrap items-baseline justify-center gap-x-4">
        <button
          type="button"
          class="min-h-8 font-body text-base text-rubric underline"
          @click="nav.go('hall')"
        >
          Return to the hall
        </button>
        <button
          type="button"
          class="min-h-8 font-body text-[13px] italic text-ink-faded underline"
          @click="restartSameSeed"
        >
          Restart reign {{ register.reign }} with the same seed
        </button>
      </div>
    </footer>
  </section>
</template>
