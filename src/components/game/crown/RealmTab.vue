<script setup lang="ts">
import { computed } from 'vue'
import ProvinceShield from '@/components/game/ledger/ProvinceShield.vue'
import type { Command, GameState } from '@/core/types'
import type { ColoniseView } from '@/ui/crown'
import { realmRecap } from '@/ui/crownRecap'
import type { RealmRates } from '@/ui/effects'
import { formatCompact, formatFigure } from '@/ui/realmText'
import NewLand from './NewLand.vue'

/**
 * What the HUD does not say about the realm: its growth, its standing and its land, with the
 * order that settles one more province.
 */
const props = defineProps<{
  run: GameState
  rates: RealmRates
  colonise: ColoniseView | null
  raised: number
}>()
const emit = defineEmits<{ act: [command: Command] }>()
const recap = computed(() => realmRecap(props.run, props.rates))
const signed = (value: number): string => `${value > 0 ? '+' : ''}${formatFigure(value, 2)}/s`
</script>

<template>
  <section data-tab-realm class="flex flex-col gap-2 font-body text-[18px] leading-6 text-ink">
    <p class="flex justify-between">
      Births <span class="font-display">{{ signed(recap.births) }}</span>
    </p>
    <p class="flex justify-between">
      Room <span class="font-display">{{ formatCompact(recap.room) }}</span>
    </p>
    <p class="flex justify-between">
      Unrest <span class="font-display">{{ signed(recap.unrestPerSecond) }}</span>
    </p>
    <p>{{ recap.pardon }}</p>
    <p v-if="recap.surcharge > 0" data-surcharge class="text-rubric">
      The Crown asks {{ recap.surcharge }}% more for your conquests.
    </p>
    <NewLand v-if="colonise" :colonise="colonise" :raised="raised" @act="emit('act', $event)" />
    <h2 class="font-caps text-rubric">Your provinces, {{ recap.shields.length }}</h2>
    <div class="flex flex-wrap gap-x-3 gap-y-2">
      <ProvinceShield
        v-for="(shield, index) in recap.shields"
        :key="index"
        class="min-w-[92px]"
        :biome="shield.biome"
        :room="shield.room"
        :note="shield.note"
      />
    </div>
  </section>
</template>
