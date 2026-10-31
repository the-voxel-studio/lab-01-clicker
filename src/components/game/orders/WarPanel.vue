<script setup lang="ts">
import { computed } from 'vue'
import type { BiomeId } from '@/core/types'
import { formatCompact } from '@/ui/realmText'
import type { WarForecast } from '@/ui/war'
import AllowanceSlots from '../ledger/AllowanceSlots.vue'
import OddsSwords from '../ledger/OddsSwords.vue'
import ProvinceShield from '../ledger/ProvinceShield.vue'
import WarBanners from '../ledger/WarBanners.vue'

/** What a campaign means before it is launched (`WAR.png`). */
const props = defineProps<{ forecast: WarForecast; biome: BiomeId; room: number }>()

const surcharged = computed(() => props.forecast.quotasAfter.pop > props.forecast.quotasBefore.pop)
const AXES = [
  { label: 'AP/s', key: 'apRate' },
  { label: 'People', key: 'pop' },
  { label: 'Force', key: 'military' },
] as const
</script>

<template>
  <section data-war-panel class="flex flex-col gap-2.5">
    <div class="flex items-center gap-3">
      <ProvinceShield :biome="biome" :room="room" note="" class="max-w-[96px]" />
      <div class="min-w-0 flex-1 font-body text-base leading-[22px] text-ink">
        <p>{{ forecast.land }}</p>
        <p class="italic text-ink-faded">Held by {{ forecast.faction }}.</p>
        <p v-for="warning in forecast.warnings" :key="warning" class="italic text-rubric">
          {{ warning }}
        </p>
      </div>
    </div>
    <WarBanners
      :yours="forecast.yours"
      :theirs-min="forecast.theirsMin"
      :theirs-max="forecast.theirsMax"
    />
    <OddsSwords :chance="forecast.outOfTen" />
    <div class="grid grid-cols-2 gap-3 font-body text-base leading-[22px] text-ink">
      <div>
        <h3 class="font-caps text-verdigris">If you win</h3>
        <p>One province</p>
        <p>{{ forecast.loot }}</p>
        <p class="font-display">{{ forecast.lossOnWin }}</p>
      </div>
      <div>
        <h3 class="font-caps text-rubric">If you lose</h3>
        <p>No province</p>
        <p>Unrest rises</p>
        <p class="font-display">{{ forecast.lossOnLoss }}</p>
      </div>
    </div>
    <div>
      <h3 class="font-caps text-base text-rubric">New land the Crown allows</h3>
      <AllowanceSlots :used="forecast.conquests" :step="forecast.step" />
    </div>
    <div v-if="surcharged" data-crown-asks class="font-body text-base leading-[22px] text-ink">
      <p class="italic text-ink-faded">Another conquest and the Crown asks</p>
      <p v-for="axis in AXES" :key="axis.key" class="flex justify-between">
        {{ axis.label }}
        <span class="font-display">
          {{ formatCompact(forecast.quotasBefore[axis.key]) }} to
          {{ formatCompact(forecast.quotasAfter[axis.key]) }}
        </span>
      </p>
    </div>
  </section>
</template>
