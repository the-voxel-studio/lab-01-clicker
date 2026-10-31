<script setup lang="ts">
import merchant from '@assets/engravings/THE_MERCHANT.webp'
import type { FateView } from '@/ui/fate'
import FatePlate from './FatePlate.vue'
import FateText from './FateText.vue'

/** The page tears and falls under the three gold balls of the Lombard (Figma `53:67`). */
defineProps<{ view: FateView; reign: number }>()

const BALLS = ['left-0 top-0', 'right-0 top-0', 'left-[25px] top-[42px]']
</script>

<template>
  <div data-scene="bankruptcy" class="relative flex h-full flex-col overflow-hidden bg-[#3c281c]">
    <div class="page flex min-h-0 flex-1 flex-col gap-3 bg-[#ceb486] pt-6 pb-10">
      <div class="flex shrink-0 justify-between px-14">
        <div>
          <p class="font-caps text-base leading-5 text-[#96180e]">In the coffer</p>
          <p class="zero font-display text-[96px] leading-[96px] text-[#1e120a]">0</p>
        </div>
        <div>
          <div class="balls relative h-[86px] w-[94px]" aria-hidden="true">
            <span
              v-for="place in BALLS"
              :key="place"
              class="fate-ball absolute size-11 rounded-full bg-gold"
              :class="place"
            />
          </div>
          <p class="font-body text-base italic leading-[22px] text-[#6e5037]">The Lombard's mark</p>
        </div>
      </div>
      <div class="min-h-0 flex-1 px-12"><FatePlate :src="merchant" /></div>
      <FateText class="shrink-0" :view="view" :reign="reign" />
    </div>
    <div
      class="fate-tear page pointer-events-none bg-[#ceb486] absolute inset-x-0 bottom-0 h-16"
      aria-hidden="true"
    />
  </div>
</template>

<style scoped>
.balls span {
  background: radial-gradient(
    circle at 40% 35%,
    var(--color-gold-light),
    var(--color-gold) 60%,
    #8a6a1a
  );
}
.page {
  clip-path: polygon(
    0 0,
    100% 0,
    100% calc(100% - 30px),
    88% calc(100% - 12px),
    76% 100%,
    63% calc(100% - 22px),
    50% calc(100% - 4px),
    37% calc(100% - 26px),
    24% calc(100% - 6px),
    11% calc(100% - 24px),
    0 calc(100% - 10px)
  );
}
.fate-tear {
  clip-path: polygon(0 0, 100% 0, 100% 100%, 50% 80%, 0 100%);
}
@media (max-height: 700px) {
  .zero {
    font-size: 48px;
    line-height: 48px;
  }
  .balls {
    transform: scale(0.6);
    transform-origin: top right;
  }
}
</style>
