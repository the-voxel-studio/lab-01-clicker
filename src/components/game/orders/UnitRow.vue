<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import GameIcon from '@/components/common/GameIcon.vue'
import type { Command } from '@/core/types'
import { UNIT_COPY } from '@/data/orderCopy'
import type { UnitRow } from '@/ui/orderRows'
import { formatCompact } from '@/ui/realmText'

/** One unit: icon, name, what it does, and its wax tag buy button (Figma `53:1472`). */
const props = defineProps<{ row: UnitRow }>()
defineEmits<{ buy: [command: Command] }>()

const icon = computed(() => UNIT_COPY[props.row.unitId].icon)
const cost = computed(() => `${formatCompact(Math.ceil(props.row.price), 0, 'up')} AP`)
/** Bumped by each purchase, which replays the falling coin. */
const coin = ref(0)
watch(
  () => props.row.owned,
  (owned, before) => {
    if (owned > before) coin.value++
  },
)
const verb = computed(() => (props.row.count > 1 ? `Buy ${props.row.count}` : 'Buy'))
</script>

<template>
  <div
    :data-unit="row.unitId"
    class="relative flex items-center gap-3 border-b border-ink-faded/60 py-3"
  >
    <GameIcon
      v-if="coin"
      :key="coin"
      name="coins"
      data-coin
      class="motion-coin absolute right-10 top-1 size-5 text-gold"
      label=""
    />
    <span
      class="flex size-11 shrink-0 items-center justify-center rounded-full border border-gold bg-vellum-shade"
    >
      <GameIcon :name="icon" class="size-[26px] text-ink" :label="row.name" />
    </span>
    <div class="min-w-0 flex-1">
      <p class="font-body text-[17px] leading-6 text-ink">{{ row.name }}</p>
      <p
        :key="row.owned"
        class="motion-pop font-body text-[13px] italic leading-[18px] text-ink-faded"
      >
        {{ row.line }}
      </p>
    </div>
    <button
      type="button"
      data-buy
      :disabled="row.command === null"
      class="wax-tag flex h-11 w-[104px] shrink-0 flex-col items-center justify-center pl-3"
      :class="row.command ? 'bg-wax text-cream' : 'bg-vellum-shade text-ink-faded'"
      @click="row.command && $emit('buy', row.command)"
    >
      <span class="font-caps text-[13px] leading-4">{{ row.blocked ?? verb }}</span>
      <span class="font-body text-[13px] italic leading-4">{{ cost }}</span>
    </button>
  </div>
</template>

<style scoped>
.wax-tag {
  clip-path: polygon(10px 0, 100% 0, 100% 100%, 10px 100%, 0 50%);
}
</style>
