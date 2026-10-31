<script setup lang="ts">
import { computed, ref } from 'vue'
import GameIcon from '@/components/common/GameIcon.vue'
import type { BiomeId } from '@/core/types'
import { BIOME_MARK } from '@/ui/gauges'
import { formatCompact } from '@/ui/realmText'
import type { WarForecast } from '@/ui/war'
import OddsSwords from '../ledger/OddsSwords.vue'
import WarBanners from '../ledger/WarBanners.vue'

/** What a campaign means before it is launched (`WAR.png`). */
const props = defineProps<{ forecast: WarForecast; biome: BiomeId }>()

const surcharged = computed(() => props.forecast.quotasAfter.pop > props.forecast.quotasBefore.pop)
/** The fight stays large; the land and the Crown's terms wait behind their tab. */
const tab = ref<'fight' | 'land'>('fight')
/** Both reports of the spies, on one line of the fight. */
const warningLine = computed(() => props.forecast.warnings.join(' '))
const mark = computed(() => BIOME_MARK[props.biome])
/** The free conquest of the audit, then what each further one adds in all. */
const allowance = computed(() => {
  const { conquests, step } = props.forecast
  if (conquests === 0) return `1 free this audit, then +${Math.round(step * 100)}% each`
  return `free one taken, the next adds +${Math.round(step * 100)}%`
})
const asks = computed(() => {
  const { quotasAfter } = props.forecast
  return `${formatCompact(quotasAfter.apRate)} AP/s, ${formatCompact(quotasAfter.pop)} people, ${formatCompact(quotasAfter.military)} force`
})
</script>

<template>
  <section data-war-panel class="flex flex-col gap-2">
    <div class="flex gap-5 font-caps text-[18px] leading-6" role="tablist">
      <button
        type="button"
        role="tab"
        data-war-tab="fight"
        :aria-selected="tab === 'fight'"
        class="min-h-7"
        :class="tab === 'fight' ? 'text-rubric underline underline-offset-4' : 'text-ink-faded'"
        @click="tab = 'fight'"
      >
        The fight
      </button>
      <button
        type="button"
        role="tab"
        data-war-tab="land"
        :aria-selected="tab === 'land'"
        class="min-h-7"
        :class="tab === 'land' ? 'text-rubric underline underline-offset-4' : 'text-ink-faded'"
        @click="tab = 'land'"
      >
        The land
      </button>
    </div>

    <template v-if="tab === 'fight'">
      <p v-if="forecast.warnings.length" class="font-body text-[18px] leading-[22px] text-rubric">
        {{ warningLine }}
      </p>
      <WarBanners
        class="war-banners"
        :yours="forecast.yours"
        :theirs-min="forecast.theirsMin"
        :theirs-max="forecast.theirsMax"
      />
      <OddsSwords class="war-odds" :chance="forecast.outOfTen" />
      <div class="grid grid-cols-2 gap-3 font-body text-[18px] leading-6 text-ink">
        <div>
          <h3 class="font-caps text-verdigris">If you win</h3>
          <p>+1 province</p>
          <p class="font-display">{{ forecast.lossOnWin }}</p>
        </div>
        <div>
          <h3 class="font-caps text-rubric">If you lose</h3>
          <p>Unrest rises</p>
          <p class="font-display">{{ forecast.lossOnLoss }}</p>
        </div>
      </div>
    </template>

    <div v-else data-war-land class="flex flex-col gap-2 font-body text-[18px] leading-6 text-ink">
      <div class="flex items-center gap-3">
        <span
          class="war-shield flex h-16 w-14 shrink-0 items-center justify-center pb-3 text-cream"
          :style="{ background: mark.tincture }"
        >
          <GameIcon :name="mark.icon" class="size-8" />
        </span>
        <div class="min-w-0">
          <p>{{ forecast.land }}</p>
          <p class="text-ink-faded">Held by {{ forecast.faction }}</p>
        </div>
      </div>
      <p><span class="font-caps text-rubric">Loot</span> {{ forecast.loot }}</p>
      <p data-allowance><span class="font-caps text-rubric">Conquests</span> {{ allowance }}</p>
      <p v-if="surcharged" data-crown-asks>
        <span class="font-caps text-rubric">Next, the Crown asks</span> {{ asks }}
      </p>
    </div>
  </section>
</template>

<style scoped>
.war-shield {
  clip-path: polygon(0 0, 100% 0, 100% 62%, 50% 100%, 0 62%);
}
@media (max-height: 700px) {
  .war-odds :deep(.mt-1) {
    display: none;
  }
}
/* Landscape reads the chance on the Attack button. */
@media (max-height: 520px) {
  .war-odds {
    display: none;
  }
  .war-banners :deep(p:last-child) {
    display: none;
  }
}
</style>
