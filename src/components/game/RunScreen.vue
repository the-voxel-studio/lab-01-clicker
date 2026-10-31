<script setup lang="ts">
import { computed } from 'vue'
import { useGameStore } from '@/stores/game'
import { useNavStore } from '@/stores/nav'
import { BAND_TEMPO } from '@/ui/motion'
import { useMotionAllowed } from './run/useAmbientMotion'
import TidingsBand from './run/TidingsBand.vue'
import ActionBar from './run/ActionBar.vue'
import ChroniclePanel from './run/ChroniclePanel.vue'
import CounselLine from './run/CounselLine.vue'
import GameMenu from './run/GameMenu.vue'
import KingdomView from './run/KingdomView.vue'
import ResumeBand from './run/ResumeBand.vue'
import RunHud from './run/RunHud.vue'
import SealButton from './run/SealButton.vue'

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
</script>

<template>
  <section
    :data-dread="game.dread.band"
    :data-paused="String(frozen)"
    :data-motion="motionOn ? 'on' : 'off'"
    :style="tempo"
    class="run relative flex h-full min-h-0 flex-1 flex-col overflow-hidden"
  >
    <div :inert="nav.menuOpen || game.inMoment" class="flex min-h-0 flex-1 flex-col">
      <RunHud class="shrink-0" />
      <div class="kingdom-slot relative mt-1 min-h-11">
        <KingdomView :band="game.dread.band" :paused="paused" />
        <TidingsBand class="absolute inset-x-3 top-1 z-10" />
      </div>
      <div
        class="seal-slot relative z-10 -mt-[76px] shrink-0 transition-opacity duration-300"
        :class="paused || game.preparing ? 'opacity-50' : ''"
      >
        <SealButton />
      </div>
      <div class="run-lower mt-1 flex flex-col gap-2">
        <CounselLine class="run-counsel shrink-0" />
        <ChroniclePanel class="run-chronicle" />
      </div>
      <ResumeBand v-if="game.preparing" />
      <div class="z-20 shrink-0">
        <ActionBar />
      </div>
    </div>
    <GameMenu />
  </section>
</template>

<style scoped>
/* Full size when it fits; on shorter screens the kingdom gives up its sky first. */
.kingdom-slot {
  flex: 0 1 calc(min(100vw, 430px) * 268 / 390);
}
.run-lower {
  flex: 1 1 0;
  min-height: 150px;
}
@media (max-height: 700px) {
  .run-chronicle {
    display: none;
  }
  .run-lower {
    flex: 0 0 auto;
    min-height: 0;
  }
  .kingdom-slot {
    flex-grow: 1;
  }
}
@media (max-height: 520px) {
  .run-lower {
    display: none;
  }
  .kingdom-slot {
    min-height: 0;
  }
}
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
