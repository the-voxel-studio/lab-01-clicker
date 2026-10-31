<script setup lang="ts">
import type { FateView } from '@/ui/fate'

/** The words of a fate, written after the beat. */
defineProps<{ view: FateView; reign: number; dark?: boolean; lead?: string }>()
</script>

<template>
  <div class="fate-text px-12" :class="dark ? 'text-[#ecd6aa]' : 'text-[#1e120a]'">
    <p v-if="lead" class="font-display text-[22px] italic leading-7">{{ lead }}</p>
    <h2 class="font-display text-[26px] leading-[30px]">{{ view.title }}</h2>
    <slot />
    <p
      class="mt-2 font-body text-base italic leading-[22px]"
      :class="dark ? 'text-[#c8aa82]' : 'text-[#463223]'"
    >
      {{ view.line }}
    </p>
    <p
      class="mt-2 font-body text-base italic leading-[22px] text-[#6e5037]"
      :class="dark ? 'text-[#c8aa82]' : ''"
    >
      Reign {{ reign }}, {{ view.foot }}
    </p>
  </div>
</template>
