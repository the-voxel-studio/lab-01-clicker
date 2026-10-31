<script setup lang="ts">
import { computed, onUnmounted, ref } from 'vue'
import GameIcon from '@/components/common/GameIcon.vue'
import type { Command } from '@/core/types'
import { useGameStore } from '@/stores/game'
import { fortuneView } from '@/ui/fortune'
import OrderFrame from './OrderFrame.vue'
import WarPanel from './WarPanel.vue'
import WaxAction from '../ledger/WaxAction.vue'

/** Fortune: the tally of provinces and war, at any time of the reign outside a letter. */
const ATTACK_HOLD_MS = 900

const game = useGameStore()
const outcome = ref<string | null>(null)
const spins = ref(0)
const spinning = ref(false)
const holding = ref(false)
let hold: ReturnType<typeof setTimeout> | null = null

const view = computed(() => {
  void game.revision
  return game.run ? fortuneView(game.run) : null
})

const chanceLine = computed(() => {
  const forecast = view.value?.forecast
  return forecast ? `${forecast.outOfTen} in 10` : 'Send your force'
})

onUnmounted(() => {
  if (hold !== null) clearTimeout(hold)
})

function attempt(command: Command): void {
  const before = game.run?.provinces ?? 0
  const result = game.act(command)
  if (!result.success) {
    outcome.value = 'The Crown refuses this order.'
    return
  }
  if (command.type !== 'LAUNCH_ATTACK') return
  spins.value++
  spinning.value = true
  holding.value = true
  hold = setTimeout(() => (holding.value = false), ATTACK_HOLD_MS)
  outcome.value =
    (game.run?.provinces ?? 0) > before ? 'The land is yours.' : 'The land stays out of your hand.'
}
</script>

<template>
  <OrderFrame title="Fortune" intro="" tight>
    <template #aside>
      <GameIcon
        :key="spins"
        name="fortuneWheel"
        class="float-right size-8 text-gold"
        data-wheel
        :class="spinning ? 'motion-wheel-spin' : 'motion-wheel-turn'"
        @animationend="spinning = false"
        label="Wheel of Fortune"
      />
    </template>
    <template v-if="view">
      <div class="fortune-tally flex items-center gap-2">
        <p class="font-caps text-base text-rubric">
          {{ view.provinces }} of {{ view.goal }} provinces
        </p>
        <div class="flex items-center gap-0.5">
          <GameIcon
            v-for="index in view.goal"
            :key="index"
            name="stoneTower"
            class="size-4"
            :class="index <= view.provinces ? 'text-ink' : 'text-ink-faded/30'"
            :label="index <= view.provinces ? 'Province held' : 'Province to win'"
          />
        </div>
      </div>
      <p
        v-if="outcome"
        data-outcome
        class="motion-ink font-body text-base italic leading-5 text-rubric"
      >
        {{ outcome }}
      </p>
      <WarPanel
        v-if="view.live && view.forecast && game.run?.currentTarget"
        :forecast="view.forecast"
        :biome="game.run.currentTarget.biome"
        class="mt-1"
      />
    </template>
    <template v-if="view?.live" #foot>
      <div class="grid grid-cols-[1fr_2fr] gap-2">
        <button
          type="button"
          data-scout
          :disabled="view.scout.command === null"
          class="flex min-h-[52px] flex-col items-center justify-center rounded-[10px] border-2 border-ink-faded/60 bg-vellum-shade px-1 text-ink disabled:text-ink-faded"
          @click="view?.scout.command && attempt(view.scout.command)"
        >
          <span class="font-caps text-base leading-5">Scout</span>
          <span class="font-body text-base leading-5">{{
            view.scout.blocked ? 'None left' : '1 dies, new target'
          }}</span>
        </button>
        <WaxAction
          data-attack
          label="Attack"
          :line="view.attack.blocked ?? chanceLine"
          icon="sword"
          :disabled="view.attack.command === null || holding"
          @press="view?.attack.command && attempt(view.attack.command)"
        />
      </div>
    </template>
  </OrderFrame>
</template>

<style scoped>
/* Short screens give the height of the wheel, then of the tally, to the war panel. */
@media (max-height: 700px) {
  [data-wheel] {
    display: none;
  }
}
@media (max-height: 700px) {
  .fortune-tally {
    display: none;
  }
}
</style>
