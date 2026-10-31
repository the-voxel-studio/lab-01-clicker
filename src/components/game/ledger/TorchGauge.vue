<script setup lang="ts">
import { computed } from 'vue'
import GameIcon from '@/components/common/GameIcon.vue'
import { torchesLit } from '@/ui/gauges'
import { unrestLine } from '@/ui/realmText'

/** Ten torches and a skull at 100: the crowd grows towards the end of the reign. */
const props = defineProps<{ unrest: number }>()

const lit = computed(() => torchesLit(props.unrest))
</script>

<template>
  <div>
    <div class="flex items-center">
      <span
        v-for="index in 10"
        :key="index"
        :data-torch="index <= lit ? 'lit' : 'out'"
        class="flex min-w-0 flex-1 justify-center"
        :class="index <= lit ? 'text-vermilion' : 'text-ink/25'"
      >
        <GameIcon name="discontent" class="size-[22px]" />
      </span>
      <GameIcon name="skull" class="size-[22px] shrink-0 text-ink" label="Overthrown at 100" />
    </div>
    <p class="font-body text-base leading-5 text-ink">{{ unrestLine(unrest) }}</p>
  </div>
</template>
