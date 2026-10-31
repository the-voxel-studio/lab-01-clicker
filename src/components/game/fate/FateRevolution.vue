<script setup lang="ts">
import count from '@assets/engravings/THE_COUNT.webp'
import GameIcon from '@/components/common/GameIcon.vue'
import type { FateView } from '@/ui/fate'
import FatePlate from './FatePlate.vue'
import FateText from './FateText.vue'

/** The burnt edge climbs the page with embers and pitchforks (Figma `53:50`). */
defineProps<{ view: FateView; reign: number }>()

const EMBERS = [8, 22, 37, 51, 66, 79, 92]
const FORKS = [-1, 22, 44, 66, 88]
</script>

<template>
  <div data-scene="revolution" class="relative h-full overflow-hidden bg-[#ceb486]">
    <div class="relative z-10 flex h-[58%] flex-col gap-3 pt-6">
      <div class="min-h-0 flex-1 px-12"><FatePlate :src="count" /></div>
      <FateText class="shrink-0" :view="view" :reign="reign" />
    </div>
    <div class="fate-burn absolute inset-x-0 bottom-0 h-[46%]" aria-hidden="true">
      <svg viewBox="0 0 390 440" preserveAspectRatio="none" class="absolute inset-0 size-full">
        <path
          d="M0 262C30 242 60 202 100 187S160 167 200 142 250 122 290 92 340 52 360 17 380 -13 390 -18V440H0Z"
          fill="#8a5a36"
          opacity="0.7"
        />
        <path
          d="M0 300C30 280 60 240 100 225S160 205 200 180 250 160 290 130 340 90 360 55 380 25 390 20V440H0Z"
          fill="#140a06"
          stroke="#c8641e"
          stroke-width="4"
        />
      </svg>
      <div
        class="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-[#7f3310] to-transparent"
      />
      <GameIcon
        v-for="(left, index) in FORKS"
        :key="left"
        name="threatLevy"
        label=""
        class="absolute bottom-6 size-[62px] text-[#140a06]"
        :class="index % 2 === 0 ? 'rotate-[8deg]' : 'bottom-10 -rotate-[8deg]'"
        :style="{ left: `${left}%` }"
      />
      <span
        v-for="(left, index) in EMBERS"
        :key="left"
        class="fate-ember absolute bottom-[30%] size-1.5 rounded-full bg-vermilion"
        :style="{ left: `${left}%`, animationDelay: `${1000 + index * 170}ms` }"
      />
    </div>
  </div>
</template>
