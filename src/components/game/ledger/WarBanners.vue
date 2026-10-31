<script setup lang="ts">
import GameIcon from '@/components/common/GameIcon.vue'
import { formatCompact } from '@/ui/realmText'

/** Your host against the force the scouts report, as two banners. */
defineProps<{ yours: number; theirsMin: number; theirsMax: number }>()
</script>

<template>
  <div class="grid grid-cols-[1fr_44px_1fr] items-center">
    <div class="banner-yours bg-verdigris px-2 py-2 text-center text-cream">
      <p class="font-display text-[25px] leading-7">{{ formatCompact(yours) }}</p>
      <p class="font-body text-base leading-5">your host</p>
    </div>
    <span
      class="z-10 flex size-11 items-center justify-center rounded-full bg-wax text-gold-light"
      aria-hidden="true"
    >
      <GameIcon name="sword" class="size-6" />
    </span>
    <div class="banner-theirs bg-blood px-2 py-2 text-center text-cream">
      <p class="font-display text-[25px] leading-7">
        {{ formatCompact(theirsMin) }} to {{ formatCompact(theirsMax) }}
      </p>
      <p class="font-body text-base leading-5">their force</p>
    </div>
  </div>
</template>

<style scoped>
.banner-yours {
  clip-path: polygon(0 0, 100% 0, 100% 100%, 0 100%, 8% 50%);
}
.banner-theirs {
  clip-path: polygon(0 0, 100% 0, 92% 50%, 100% 100%, 0 100%);
}
</style>
