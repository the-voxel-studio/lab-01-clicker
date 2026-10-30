<script setup lang="ts">
import { computed } from 'vue'
import { useGameStore } from '@/stores/game'
import { useNavStore } from '@/stores/nav'
import { BAND_TEMPO } from '@/ui/motion'
import { useMotionAllowed } from './run/useAmbientMotion'
import ActionBar from './run/ActionBar.vue'
import ChroniclePanel from './run/ChroniclePanel.vue'
import CounselLine from './run/CounselLine.vue'
import GameMenu from './run/GameMenu.vue'
import KingdomView from './run/KingdomView.vue'
import RunHud from './run/RunHud.vue'
import SealButton from './run/SealButton.vue'
import PhaseStub from './PhaseStub.vue'

/** The run screen of Figma `Screens v7`, rotting with the dread band (design 3.2). */
const game = useGameStore()
const nav = useNavStore()
const motionOn = useMotionAllowed()

const paused = computed(() => {
  void game.revision
  return game.run?.isPaused ?? false
})
/** Every loop stops while the reign is paused or the menu is open. */
const frozen = computed(() => paused.value || nav.menuOpen)
const tempo = computed(() => {
  const { sway, flicker, jitter } = BAND_TEMPO[game.dread.band]
  return { '--tempo-sway': sway, '--tempo-flicker': flicker, '--tempo-jitter': jitter }
})

const showStub = computed(
  () =>
    game.phase !== null &&
    game.phase !== 'ACTIVE_CYCLE' &&
    game.phase !== 'RUN_DEFEAT' &&
    game.phase !== 'RUN_VICTORY',
)
</script>

<template>
  <section
    :data-dread="game.dread.band"
    :data-paused="String(frozen)"
    :data-motion="motionOn ? 'on' : 'off'"
    :style="tempo"
    class="run relative flex min-h-screen flex-1 flex-col"
  >
    <div :inert="nav.menuOpen" class="flex flex-1 flex-col">
      <RunHud />
      <div class="relative mt-1">
        <KingdomView :band="game.dread.band" :paused="paused" />
      </div>
      <div class="relative z-10 -mt-[76px]">
        <SealButton />
      </div>
      <div class="mt-1 flex flex-col gap-2">
        <CounselLine />
        <ChroniclePanel />
      </div>
      <div class="flex-1" />
      <div class="sticky bottom-0 z-20">
        <ActionBar />
      </div>
    </div>
    <PhaseStub v-if="showStub" />
    <GameMenu />
  </section>
</template>

<style scoped>
/* The vellum fouls at the edges as the realm rots; the text keeps its contrast in every band. */
.run::after {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  transition: box-shadow 1.2s ease;
}
.run[data-dread='uneasy']::after {
  box-shadow: inset 0 0 40px rgb(122 82 40 / 0.18);
}
.run[data-dread='rotting']::after {
  box-shadow: inset 0 0 70px rgb(74 50 32 / 0.32);
}
.run[data-dread='death_throes']::after {
  box-shadow: inset 0 0 90px rgb(122 8 8 / 0.4);
}
</style>
