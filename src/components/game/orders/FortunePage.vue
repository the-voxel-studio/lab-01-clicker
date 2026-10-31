<script setup lang="ts">
import { computed, onUnmounted, ref } from 'vue'
import GameIcon from '@/components/common/GameIcon.vue'
import { DEFAULT_ENGINE_CONFIG } from '@/core/config'
import type { Command } from '@/core/types'
import { useGameStore } from '@/stores/game'
import { BIOMES_DATA } from '@/data/biomes'
import { fortuneView } from '@/ui/fortune'
import OrderFrame from './OrderFrame.vue'
import WarPanel from './WarPanel.vue'
import WaxAction from '../ledger/WaxAction.vue'

/** Fortune: the tally of provinces and war, at any time of the reign outside a letter. */
const ATTACK_HOLD_MS = 900

const { BASE_HOUSING_PER_PROVINCE } = DEFAULT_ENGINE_CONFIG.balance
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
  return forecast ? `${forecast.outOfTen} in 10 to take it` : 'Send your force'
})
/** What the land would house. */
const landRoom = computed(() => {
  const biome = game.run?.currentTarget?.biome
  return biome ? BIOMES_DATA[biome].housingMultiplier * BASE_HOUSING_PER_PROVINCE : 0
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
  <OrderFrame
    title="Fortune"
    intro="Every conquest is a gamble. Scouts narrow the odds, and some of them do not come back."
  >
    <template #aside>
      <GameIcon
        :key="spins"
        name="fortuneWheel"
        class="float-right size-14 text-gold"
        data-wheel
        :class="spinning ? 'motion-wheel-spin' : 'motion-wheel-turn'"
        @animationend="spinning = false"
        label="Wheel of Fortune"
      />
    </template>
    <template v-if="view">
      <div class="fortune-tally">
        <p class="font-caps text-base text-rubric">
          You hold {{ view.provinces }} {{ view.provinces === 1 ? 'province' : 'provinces' }}
        </p>
        <div class="flex items-center gap-1.5">
          <GameIcon
            v-for="index in view.goal"
            :key="index"
            name="stoneTower"
            class="size-[22px]"
            :class="index <= view.provinces ? 'text-ink' : 'text-ink-faded/30'"
            :label="index <= view.provinces ? 'Province held' : 'Province to win'"
          />
        </div>
        <p class="font-body text-base italic text-ink-faded">
          {{ view.goal }} to win Imperial Barony
        </p>
        <p v-if="outcome" data-outcome class="motion-ink font-body text-[18px] italic text-rubric">
          {{ outcome }}
        </p>
      </div>
      <WarPanel
        v-if="view.live && view.forecast && game.run?.currentTarget"
        :forecast="view.forecast"
        :biome="game.run.currentTarget.biome"
        :room="landRoom"
        class="mt-3"
      />
    </template>
    <template v-if="view?.live" #foot>
      <div class="grid grid-cols-[1fr_2fr] gap-2">
        <button
          type="button"
          data-scout
          :disabled="view.scout.command === null"
          class="flex min-h-[62px] flex-col items-center justify-center rounded-[10px] border-2 border-ink-faded/60 bg-vellum-shade px-1 text-ink disabled:text-ink-faded"
          @click="view?.scout.command && attempt(view.scout.command)"
        >
          <span class="font-caps text-base leading-5">Send a scout</span>
          <span class="font-body text-base leading-5">{{
            view.scout.blocked ?? '1 scout dies, new target'
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
/* Short screens give the tally's height to the war panel. */
@media (max-height: 700px) {
  .fortune-tally {
    display: none;
  }
}
</style>
