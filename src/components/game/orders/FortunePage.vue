<script setup lang="ts">
import { computed, onUnmounted, ref } from 'vue'
import GameIcon from '@/components/common/GameIcon.vue'
import type { Command } from '@/core/types'
import { useGameStore } from '@/stores/game'
import { fortuneView } from '@/ui/fortune'
import OrderFrame from './OrderFrame.vue'
import TargetCard from './TargetCard.vue'

/** Fortune: the tally of provinces during the reign, the live expedition between two audits. */
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
    :closed="view?.live ?? false"
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
      <p class="font-caps text-sm text-rubric">
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
      <p class="font-body text-[13px] italic text-ink-faded">
        {{ view.goal }} to win Imperial Barony
      </p>
      <p v-if="outcome" data-outcome class="motion-ink font-body text-[15px] italic text-rubric">
        {{ outcome }}
      </p>
      <template v-if="view.live">
        <TargetCard v-if="view.target" :target="view.target" class="mt-3" />
        <div class="mt-3 grid grid-cols-2 gap-2.5">
          <button
            type="button"
            data-scout
            :disabled="view.scout.command === null"
            class="flex h-14 flex-col items-center justify-center rounded-lg border-[1.5px] border-ink-faded/60 bg-vellum-shade text-ink disabled:text-ink-faded"
            @click="view?.scout.command && attempt(view.scout.command)"
          >
            <span class="font-caps text-[15px] leading-5">Send a scout</span>
            <span class="font-body text-[13px] italic leading-[18px]">
              {{ view.scout.blocked ?? '1 scout dies, new target' }}
            </span>
          </button>
          <button
            type="button"
            data-attack
            :disabled="view.attack.command === null || holding"
            class="flex h-14 flex-col items-center justify-center rounded-lg border-[1.5px]"
            :class="
              view.attack.command
                ? 'border-gold bg-wax text-cream'
                : 'border-ink-faded/60 bg-vellum-shade text-ink-faded'
            "
            @click="view?.attack.command && attempt(view.attack.command)"
          >
            <span class="font-caps text-[15px] leading-5">Attack</span>
            <span class="font-body text-[13px] italic leading-[18px]">
              {{ view.attack.blocked ?? view.target?.odds }}
            </span>
          </button>
        </div>
        <button
          type="button"
          data-leave
          class="mt-3 min-h-6 font-body text-sm italic text-rubric underline"
          @click="attempt(view!.leave)"
        >
          Leave in peace
        </button>
      </template>
      <p v-else class="mt-3 font-body text-[15px] italic text-ink-faded">
        The next campaign follows the audit.
      </p>
    </template>
  </OrderFrame>
</template>
