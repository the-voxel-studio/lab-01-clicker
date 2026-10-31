<script setup lang="ts">
import { computed } from 'vue'
import GameIcon from '@/components/common/GameIcon.vue'
import { FEAT_COPY } from '@/data/featCopy'
import { FEATS_DATA, type FeatId } from '@/data/feats'
import type { LockedFeat } from '@/ui/register'

/** The feats unsealed this reign and the closest one left (Figma `53:380`, `53:388`). */
const props = defineProps<{ earned: FeatId[]; closest: LockedFeat | null }>()

/** A new feat unseals once the figures have rolled. */
const UNSEAL_DELAY_MS = 700
const feats = computed(() => props.earned.map((id) => ({ ...FEATS_DATA[id], ...FEAT_COPY[id] })))
</script>

<template>
  <section v-if="feats.length > 0">
    <h3 class="font-caps text-base leading-5 text-rubric">Unsealed this reign</h3>
    <ul class="mt-1 flex flex-col gap-2">
      <li
        v-for="(feat, index) in feats"
        :key="feat.id"
        data-new-feat
        class="flex items-center gap-3"
      >
        <span
          class="register-unseal flex size-14 shrink-0 items-center justify-center rounded-full border-[3px] border-gold bg-vellum-shade"
          :style="{ animationDelay: `${UNSEAL_DELAY_MS + index * 200}ms` }"
        >
          <GameIcon :name="feat.icon" label="" class="size-8 text-ink" />
        </span>
        <span class="min-w-0">
          <span class="block font-display text-[21px] leading-[26px] text-ink">{{
            feat.title
          }}</span>
          <span class="block font-body text-base italic leading-[22px] text-ink-faded">
            {{ feat.description }}
          </span>
        </span>
      </li>
    </ul>
  </section>

  <section v-if="closest" data-closest-feat>
    <h3 class="font-caps text-base leading-5 text-rubric">Closest locked feat</h3>
    <div class="mt-1 flex items-center gap-3">
      <span
        class="flex size-14 shrink-0 items-center justify-center rounded-full border-[3px] border-gold bg-bar"
      >
        <GameIcon :name="FEAT_COPY[closest.id].icon" label="" class="size-8 text-ink-faded" />
      </span>
      <div class="min-w-0 flex-1">
        <p class="font-display text-xl italic leading-7 text-ink">{{ closest.hint }}</p>
        <div class="h-2 overflow-hidden rounded bg-vellum-shade">
          <div
            data-feat-progress
            class="register-fill h-full origin-left rounded bg-gold"
            :style="{ transform: `scaleX(${closest.progress})` }"
          />
        </div>
        <p class="mt-1 font-body text-base italic leading-[22px] text-ink-faded">
          {{ closest.caption }}
        </p>
      </div>
    </div>
  </section>
</template>
