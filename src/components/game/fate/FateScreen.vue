<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, type Component } from 'vue'
import { useMotionAllowed } from '@/components/game/run/useAmbientMotion'
import { useArchivesStore } from '@/stores/archives'
import { useGameStore } from '@/stores/game'
import { useNavStore } from '@/stores/nav'
import { fateView, type FateView } from '@/ui/fate'
import FateAudit from './FateAudit.vue'
import FateBankruptcy from './FateBankruptcy.vue'
import FateConquest from './FateConquest.vue'
import FateRevolution from './FateRevolution.vue'
import FateVictory from './FateVictory.vue'

/** Between the last tick and the register: stillness, one beat, the words. Nothing advances alone. */
const archives = useArchivesStore()
const game = useGameStore()
const nav = useNavStore()
const motionOn = useMotionAllowed()

const SCENES: Record<FateView['outcome'], Component> = {
  quota_failure: FateAudit,
  revolution: FateRevolution,
  bankruptcy: FateBankruptcy,
  conquest: FateConquest,
  victory: FateVictory,
}
/** The foot of each scene, so the way on never lies over its words. */
const FOOT: Record<FateView['outcome'], string> = {
  quota_failure: '#ceb486',
  revolution: '#7f3310',
  bankruptcy: '#3c281c',
  conquest: '#1f140f',
  victory: 'var(--color-vellum)',
}
/** Stillness 600 ms, the beat 900 ms, the text 900 ms (plan 04 Task 5). */
const SCENE_MS = 2400
const DEATH_VIBRATION_MS = 180

const view = computed(() => (game.run ? fateView(game.run) : null))
const canLeave = ref(!motionOn.value)
let timer: ReturnType<typeof setTimeout> | null = null

onMounted(() => {
  if (!motionOn.value) return
  timer = setTimeout(() => (canLeave.value = true), SCENE_MS)
  if (view.value?.outcome !== 'victory') navigator.vibrate?.(DEATH_VIBRATION_MS)
})
onUnmounted(() => {
  if (timer !== null) clearTimeout(timer)
})
</script>

<template>
  <section
    v-if="view"
    data-fate
    :data-outcome="view.outcome"
    :data-motion="motionOn ? 'on' : 'off'"
    class="relative flex h-full min-h-0 flex-1 flex-col overflow-hidden"
  >
    <component
      :is="SCENES[view.outcome]"
      class="min-h-0 flex-1"
      :view="view"
      :reign="archives.history.length"
    />
    <footer
      class="flex min-h-[60px] shrink-0 items-center justify-end px-4"
      :style="{ background: FOOT[view.outcome] }"
    >
      <button
        v-if="canLeave"
        data-fate-continue
        type="button"
        class="motion-pop min-h-11 rounded bg-wax px-4 py-1 font-display text-lg text-cream shadow"
        @click="nav.go('end')"
      >
        Read the register
      </button>
    </footer>
  </section>
</template>
